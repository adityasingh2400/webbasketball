import * as THREE from 'three';

function createGradientCanvas(colors: string[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = colors.length;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i, 0, 1, 1);
  });
  return canvas;
}

function makeGradientTexture(colors: string[]): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(createGradientCanvas(colors));
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let _skinGradient: THREE.CanvasTexture | null = null;
let _fabricBlueGradient: THREE.CanvasTexture | null = null;
let _fabricDarkGradient: THREE.CanvasTexture | null = null;
let _hairGradient: THREE.CanvasTexture | null = null;
let _shoeGradient: THREE.CanvasTexture | null = null;
let _courtGradient: THREE.CanvasTexture | null = null;
let _metalGradient: THREE.CanvasTexture | null = null;
let _ballGradient: THREE.CanvasTexture | null = null;
let _grassGradient: THREE.CanvasTexture | null = null;
let _genericGradient: THREE.CanvasTexture | null = null;

export function skinGradient(): THREE.CanvasTexture {
  if (!_skinGradient) _skinGradient = makeGradientTexture(['#c4946a', '#e8b88c', '#fdd8b4']);
  return _skinGradient;
}

export function fabricBlueGradient(): THREE.CanvasTexture {
  if (!_fabricBlueGradient) _fabricBlueGradient = makeGradientTexture(['#142866', '#1e40af', '#3b82f6']);
  return _fabricBlueGradient;
}

export function fabricDarkGradient(): THREE.CanvasTexture {
  if (!_fabricDarkGradient) _fabricDarkGradient = makeGradientTexture(['#06080d', '#1a1f2e', '#2d3548']);
  return _fabricDarkGradient;
}

export function hairGradient(): THREE.CanvasTexture {
  if (!_hairGradient) _hairGradient = makeGradientTexture(['#0c0704', '#1c1008', '#2e1e12', '#3d2a18']);
  return _hairGradient;
}

export function shoeGradient(): THREE.CanvasTexture {
  if (!_shoeGradient) _shoeGradient = makeGradientTexture(['#0c1a44', '#1d4ed8', '#60a5fa']);
  return _shoeGradient;
}

export function courtGradient(): THREE.CanvasTexture {
  if (!_courtGradient) _courtGradient = makeGradientTexture(['#8c5a2c', '#c08050', '#dca868']);
  return _courtGradient;
}

export function metalGradient(): THREE.CanvasTexture {
  if (!_metalGradient) _metalGradient = makeGradientTexture(['#3a3f48', '#8a919c']);
  return _metalGradient;
}

export function ballGradient(): THREE.CanvasTexture {
  if (!_ballGradient) _ballGradient = makeGradientTexture(['#8c4a1a', '#d4874a', '#f2c098']);
  return _ballGradient;
}

export function grassGradient(): THREE.CanvasTexture {
  if (!_grassGradient) _grassGradient = makeGradientTexture(['#1e4a18', '#3a7c30', '#5aac48']);
  return _grassGradient;
}

export function genericGradient(): THREE.CanvasTexture {
  if (!_genericGradient) _genericGradient = makeGradientTexture(['#3a3a40', '#6a6a74', '#a0a0ac']);
  return _genericGradient;
}

export function disposeAllGradients(): void {
  [_skinGradient, _fabricBlueGradient, _fabricDarkGradient, _hairGradient,
   _shoeGradient, _courtGradient, _metalGradient, _ballGradient,
   _grassGradient, _genericGradient].forEach(t => t?.dispose());
  _skinGradient = _fabricBlueGradient = _fabricDarkGradient = _hairGradient =
    _shoeGradient = _courtGradient = _metalGradient = _ballGradient =
    _grassGradient = _genericGradient = null;
}
