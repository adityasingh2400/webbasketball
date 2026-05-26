import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { QualityLevel } from './Lighting';
import { COURT_TOON, ENV_TOON } from './toonMaterial';

const COURT_WIDTH = 15;
const COURT_HALF_LENGTH = 14;
const LINE_Y = 0.015;
const PAINT_Y = 0.008;
const HOOP_Z = -13;

const LINE_COLOR = '#ffffff';

interface CourtTextures {
  colorMap: THREE.CanvasTexture;
}

function createCourtTextures(resolution: number): CourtTextures {
  const w = resolution;
  const h = resolution;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const colorCtx = colorCanvas.getContext('2d')!;

  colorCtx.fillStyle = '#c08050';
  colorCtx.fillRect(0, 0, w, h);

  const plankCount = 10;
  const plankW = w / plankCount;
  const tones = ['#c48850', '#b87840', '#d09858', '#be8048', '#ca9050',
                 '#b47038', '#cc8c4c', '#c08448', '#d49c5c', '#ba7c44'];

  for (let i = 0; i < plankCount; i++) {
    const x = i * plankW;

    colorCtx.fillStyle = tones[i % tones.length];
    colorCtx.fillRect(x, 0, plankW, h);

    colorCtx.strokeStyle = 'rgba(60, 30, 10, 0.25)';
    colorCtx.lineWidth = 1.5;
    colorCtx.beginPath();
    colorCtx.moveTo(x, 0);
    colorCtx.lineTo(x, h);
    colorCtx.stroke();

    for (let g = 0; g < 30; g++) {
      const gx = x + Math.random() * plankW;
      const gy = Math.random() * h;
      const len = 30 + Math.random() * 100;
      const drift = (Math.random() - 0.5) * 5;

      colorCtx.strokeStyle = `rgba(80, 40, 10, ${0.03 + Math.random() * 0.05})`;
      colorCtx.lineWidth = 0.5 + Math.random() * 1.2;
      colorCtx.beginPath();
      colorCtx.moveTo(gx, gy);
      colorCtx.lineTo(gx + drift, gy + len);
      colorCtx.stroke();
    }

    for (let k = 0; k < 4; k++) {
      const knotX = x + Math.random() * plankW;
      const knotY = Math.random() * h;
      const knotR = 3 + Math.random() * 6;

      const grad = colorCtx.createRadialGradient(knotX, knotY, 0, knotX, knotY, knotR);
      grad.addColorStop(0, 'rgba(90, 45, 15, 0.35)');
      grad.addColorStop(0.6, 'rgba(100, 55, 20, 0.15)');
      grad.addColorStop(1, 'rgba(100, 55, 20, 0)');
      colorCtx.fillStyle = grad;
      colorCtx.beginPath();
      colorCtx.arc(knotX, knotY, knotR, 0, Math.PI * 2);
      colorCtx.fill();
    }
  }

  for (let s = 0; s < 15; s++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    const sr = 30 + Math.random() * 60;
    const sGrad = colorCtx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sGrad.addColorStop(0, 'rgba(255, 240, 200, 0.06)');
    sGrad.addColorStop(1, 'rgba(255, 240, 200, 0)');
    colorCtx.fillStyle = sGrad;
    colorCtx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  function makeTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.anisotropy = 8;
    return tex;
  }

  return {
    colorMap: makeTexture(colorCanvas, true),
  };
}

function createSunGradientTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const sunAngle = Math.atan2(6, 8);
  const cx = size / 2;
  const cy = size / 2;
  const dx = Math.cos(sunAngle);
  const dy = Math.sin(sunAngle);
  const reach = size * 0.7;

  const grad = ctx.createLinearGradient(
    cx + dx * reach, cy + dy * reach,
    cx - dx * reach, cy - dy * reach,
  );
  grad.addColorStop(0, 'rgba(255, 235, 190, 0.18)');
  grad.addColorStop(0.35, 'rgba(255, 245, 220, 0.06)');
  grad.addColorStop(0.55, 'rgba(200, 210, 225, 0.0)');
  grad.addColorStop(0.75, 'rgba(160, 185, 220, 0.06)');
  grad.addColorStop(1, 'rgba(130, 165, 210, 0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 8; i++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const sr = 60 + Math.random() * 120;
    const sunDot = ((sx / size) * dx + (sy / size) * dy);
    const warmth = Math.max(0, sunDot);
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    rg.addColorStop(0, `rgba(${255}, ${240 - warmth * 20}, ${190 + warmth * 30}, 0.04)`);
    rg.addColorStop(1, 'rgba(200, 200, 200, 0)');
    ctx.fillStyle = rg;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function CourtFloor({ quality = 'medium' }: { quality?: QualityLevel }) {
  const resolution = quality === 'high' ? 1536 : quality === 'medium' ? 1024 : 512;
  const textures = useMemo(() => createCourtTextures(resolution), [resolution]);
  const sunGradient = useMemo(() => createSunGradientTexture(), []);
  const courtMat = useMemo(() => COURT_TOON(textures.colorMap), [textures.colorMap]);

  useEffect(() => {
    return () => {
      textures.colorMap.dispose();
      sunGradient.dispose();
      courtMat.dispose();
    };
  }, [textures, sunGradient, courtMat]);

  const courtW = COURT_WIDTH + 2;
  const courtH = COURT_HALF_LENGTH + 4;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -COURT_HALF_LENGTH / 2]} receiveShadow>
        <planeGeometry args={[courtW, courtH]} />
        <primitive object={courtMat} attach="material" />
      </mesh>
      {/* Sun-relative color gradient overlay — warm on the sun-facing side,
          cool blue-gray on the shadow side. This non-tiling overlay is what
          makes the court look like it has natural light falling across it
          instead of uniform flat color. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, -COURT_HALF_LENGTH / 2]}
        renderOrder={1}
      >
        <planeGeometry args={[courtW, courtH]} />
        <meshBasicMaterial
          map={sunGradient}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Boundary() {
  const hw = COURT_WIDTH / 2;
  const points = useMemo(() => [
    new THREE.Vector3(-hw, LINE_Y, 0),
    new THREE.Vector3(-hw, LINE_Y, -COURT_HALF_LENGTH),
    new THREE.Vector3(hw, LINE_Y, -COURT_HALF_LENGTH),
    new THREE.Vector3(hw, LINE_Y, 0),
    new THREE.Vector3(-hw, LINE_Y, 0),
  ], [hw]);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

function HalfCourtLine() {
  const hw = COURT_WIDTH / 2;
  return (
    <Line
      points={[new THREE.Vector3(-hw, LINE_Y, 0), new THREE.Vector3(hw, LINE_Y, 0)]}
      color={LINE_COLOR}
      lineWidth={2}
    />
  );
}

function CenterCircle() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 48;
    const radius = 1.8;
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + (i / segments) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, LINE_Y, Math.sin(angle) * radius));
    }
    return pts;
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

function Paint() {
  const paintW = 4.88;
  const paintD = 5.79;
  const hw = paintW / 2;
  const paintStartZ = HOOP_Z + 1.22;
  const paintEndZ = paintStartZ + paintD;

  const paintMat = useMemo(() => ENV_TOON('#a04020', { transparent: true, opacity: 0.25 }), []);

  useEffect(() => {
    return () => { paintMat.dispose(); };
  }, [paintMat]);

  const outline = useMemo(() => [
    new THREE.Vector3(-hw, LINE_Y, paintStartZ),
    new THREE.Vector3(-hw, LINE_Y, paintEndZ),
    new THREE.Vector3(hw, LINE_Y, paintEndZ),
    new THREE.Vector3(hw, LINE_Y, paintStartZ),
  ], [hw, paintEndZ, paintStartZ]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PAINT_Y, paintStartZ + paintD / 2]}>
        <planeGeometry args={[paintW, paintD]} />
        <primitive object={paintMat} attach="material" />
      </mesh>
      <Line points={outline} color={LINE_COLOR} lineWidth={2} />
    </group>
  );
}

function FreeThrowCircle() {
  const paintStartZ = HOOP_Z + 1.22;
  const ftZ = paintStartZ + 5.79;

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 48;
    const radius = 1.8;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, LINE_Y, ftZ + Math.sin(angle) * radius));
    }
    return pts;
  }, [ftZ]);

  return <Line points={points} color={LINE_COLOR} lineWidth={1.5} />;
}

function ThreePointArc() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const radius = 8.5;
    const segments = 80;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      const x = -Math.cos(angle) * radius;
      const z = HOOP_Z + Math.sin(angle) * radius;
      pts.push(new THREE.Vector3(x, LINE_Y, z));
    }

    return pts;
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

export interface CourtProps {
  quality?: QualityLevel;
}

export const Court = ({ quality = 'medium' }: CourtProps) => {
  return (
    <group>
      <CourtFloor quality={quality} />
      <Boundary />
      <HalfCourtLine />
      <CenterCircle />
      <Paint />
      <FreeThrowCircle />
      <ThreePointArc />
    </group>
  );
};
