import { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import leatherColorUrl from '../assets/basketball-leather-color.png';
import leatherRoughnessUrl from '../assets/basketball-leather-roughness.png';
import basketballSourceUrl from '../assets/basketball-source.png';

interface BasketballMaterialMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface AlphaBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const OUTPUT_WIDTH = 1536;
const OUTPUT_HEIGHT = 768;
const LEATHER_REPEAT_X = 6.4;
const LEATHER_REPEAT_Y = 3.2;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function textureFromCanvas(canvas: HTMLCanvasElement, colorSpace?: THREE.ColorSpace): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  if (colorSpace) {
    texture.colorSpace = colorSpace;
  }
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function imageToRaw(image: CanvasImageSource & { width: number; height: number }): RawImage {
  const canvas = makeCanvas(image.width, image.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Unable to read basketball source image.');
  }

  context.drawImage(image, 0, 0);
  return {
    data: context.getImageData(0, 0, image.width, image.height).data,
    width: image.width,
    height: image.height,
  };
}

function sampleRawImage(raw: RawImage, u: number, v: number, wrap: boolean): [number, number, number, number] {
  const sampleU = wrap ? ((u % 1) + 1) % 1 : THREE.MathUtils.clamp(u, 0, 1);
  const sampleV = wrap ? ((v % 1) + 1) % 1 : THREE.MathUtils.clamp(v, 0, 1);
  const px = Math.min(raw.width - 1, Math.max(0, Math.floor(sampleU * (raw.width - 1))));
  const py = Math.min(raw.height - 1, Math.max(0, Math.floor(sampleV * (raw.height - 1))));
  const index = (py * raw.width + px) * 4;

  return [
    raw.data[index],
    raw.data[index + 1],
    raw.data[index + 2],
    raw.data[index + 3],
  ];
}

function computeAlphaBounds(raw: RawImage): AlphaBounds {
  let minX = raw.width;
  let minY = raw.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      const alpha = raw.data[(y * raw.width + x) * 4 + 3];
      if (alpha < 24) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX > maxX || minY > maxY) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }

  return {
    minX: minX / (raw.width - 1),
    maxX: maxX / (raw.width - 1),
    minY: minY / (raw.height - 1),
    maxY: maxY / (raw.height - 1),
  };
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function buildBasketballMaps(
  leatherColorImage: CanvasImageSource & { width: number; height: number },
  leatherRoughnessImage: CanvasImageSource & { width: number; height: number },
  basketballSourceImage: CanvasImageSource & { width: number; height: number },
): BasketballMaterialMaps {
  const leatherColorRaw = imageToRaw(leatherColorImage);
  const leatherRoughnessRaw = imageToRaw(leatherRoughnessImage);
  const sourceRaw = imageToRaw(basketballSourceImage);
  const sourceBounds = computeAlphaBounds(sourceRaw);

  const colorCanvas = makeCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const bumpCanvas = makeCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const roughnessCanvas = makeCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);

  const colorContext = colorCanvas.getContext('2d');
  const bumpContext = bumpCanvas.getContext('2d');
  const roughnessContext = roughnessCanvas.getContext('2d');

  if (!colorContext || !bumpContext || !roughnessContext) {
    throw new Error('Unable to create basketball material canvases.');
  }

  const colorPixels = colorContext.createImageData(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const bumpPixels = bumpContext.createImageData(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const roughnessPixels = roughnessContext.createImageData(OUTPUT_WIDTH, OUTPUT_HEIGHT);

  for (let y = 0; y < OUTPUT_HEIGHT; y++) {
    const v = y / (OUTPUT_HEIGHT - 1);
    const latitude = (0.5 - v) * Math.PI;
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);

    for (let x = 0; x < OUTPUT_WIDTH; x++) {
      const u = x / (OUTPUT_WIDTH - 1);
      const longitude = (u - 0.5) * Math.PI * 2;
      const projectedX = cosLatitude * Math.sin(longitude);
      const projectedY = sinLatitude;

      const leatherColor = sampleRawImage(leatherColorRaw, u * LEATHER_REPEAT_X, v * LEATHER_REPEAT_Y, true);
      const leatherRoughness = sampleRawImage(leatherRoughnessRaw, u * LEATHER_REPEAT_X, v * LEATHER_REPEAT_Y, true);
      const leatherLum = luminance(leatherColor[0], leatherColor[1], leatherColor[2]);

      const sourceU = sourceBounds.minX + (projectedX * 0.5 + 0.5) * (sourceBounds.maxX - sourceBounds.minX);
      const sourceV = sourceBounds.minY + ((-projectedY) * 0.5 + 0.5) * (sourceBounds.maxY - sourceBounds.minY);
      const sourceColor = sampleRawImage(sourceRaw, sourceU, sourceV, false);
      const sourceAlpha = sourceColor[3] / 255;
      const sourceLum = luminance(sourceColor[0], sourceColor[1], sourceColor[2]);
      const seamMask = sourceAlpha * (1 - THREE.MathUtils.smoothstep(sourceLum, 0.17, 0.34));
      const highlightBias = sourceAlpha * Math.max(0, sourceLum - 0.55) * 0.18;
      const edgeShade = THREE.MathUtils.smoothstep(Math.abs(projectedX) * 0.78 + Math.abs(projectedY) * 0.32, 0.52, 0.92) * 0.18;

      const leatherResponse = THREE.MathUtils.lerp(0.42, 1.08, Math.pow(leatherLum, 0.9));
      let red = THREE.MathUtils.lerp(72, 152, leatherResponse);
      let green = THREE.MathUtils.lerp(28, 74, leatherResponse);
      let blue = THREE.MathUtils.lerp(10, 28, leatherResponse);

      const brightness = THREE.MathUtils.clamp(0.88 + highlightBias - edgeShade - seamMask * 0.48, 0.34, 1.06);
      red *= brightness;
      green *= brightness;
      blue *= brightness;

      const roughnessBase = leatherRoughness[0] / 255;
      const roughnessValue = THREE.MathUtils.clamp(0.56 + roughnessBase * 0.3 - seamMask * 0.16, 0.28, 0.95);
      const bumpValue = THREE.MathUtils.clamp(0.32 + leatherLum * 0.5 - seamMask * 0.2, 0.05, 0.98);

      const pixelIndex = (y * OUTPUT_WIDTH + x) * 4;

      colorPixels.data[pixelIndex] = clampByte(red);
      colorPixels.data[pixelIndex + 1] = clampByte(green);
      colorPixels.data[pixelIndex + 2] = clampByte(blue);
      colorPixels.data[pixelIndex + 3] = 255;

      const bumpChannel = clampByte(bumpValue * 255);
      bumpPixels.data[pixelIndex] = bumpChannel;
      bumpPixels.data[pixelIndex + 1] = bumpChannel;
      bumpPixels.data[pixelIndex + 2] = bumpChannel;
      bumpPixels.data[pixelIndex + 3] = 255;

      const roughnessChannel = clampByte(roughnessValue * 255);
      roughnessPixels.data[pixelIndex] = roughnessChannel;
      roughnessPixels.data[pixelIndex + 1] = roughnessChannel;
      roughnessPixels.data[pixelIndex + 2] = roughnessChannel;
      roughnessPixels.data[pixelIndex + 3] = 255;
    }
  }

  colorContext.putImageData(colorPixels, 0, 0);
  bumpContext.putImageData(bumpPixels, 0, 0);
  roughnessContext.putImageData(roughnessPixels, 0, 0);

  return {
    map: textureFromCanvas(colorCanvas, THREE.SRGBColorSpace),
    bumpMap: textureFromCanvas(bumpCanvas),
    roughnessMap: textureFromCanvas(roughnessCanvas),
  };
}

export function useBasketballMaterialMaps(): BasketballMaterialMaps {
  const [leatherColorTexture, leatherRoughnessTexture, basketballSourceTexture] = useLoader(THREE.TextureLoader, [
    leatherColorUrl,
    leatherRoughnessUrl,
    basketballSourceUrl,
  ]) as [THREE.Texture, THREE.Texture, THREE.Texture];

  const maps = useMemo(
    () =>
      buildBasketballMaps(
        leatherColorTexture.image as CanvasImageSource & { width: number; height: number },
        leatherRoughnessTexture.image as CanvasImageSource & { width: number; height: number },
        basketballSourceTexture.image as CanvasImageSource & { width: number; height: number },
      ),
    [basketballSourceTexture.image, leatherColorTexture.image, leatherRoughnessTexture.image],
  );

  useEffect(() => {
    return () => {
      maps.map.dispose();
      maps.bumpMap.dispose();
      maps.roughnessMap.dispose();
    };
  }, [maps]);

  return maps;
}
