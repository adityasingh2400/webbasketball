import * as THREE from 'three';

function hash2(i: number, j: number): number {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Jersey: knit grain, side panels, yoke, number */
export function createJerseyFabricTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#1e40af');
  g.addColorStop(0.5, '#2563eb');
  g.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 4) {
    const o = (y % 8) * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y + o);
    for (let x = 0; x < w; x += 16) {
      ctx.lineTo(x + 8, y + o + Math.sin(x * 0.02) * 0.6);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.035)';
  for (let x = 0; x < w; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 1.5, h);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(15, 35, 90, 0.5)';
  ctx.fillRect(0, 0, w * 0.11, h);
  ctx.fillRect(w * 0.89, 0, w * 0.11, h);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.22)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.1, w * 0.38, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.28, h * 0.52, w * 0.44, h * 0.14);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
  ctx.font = 'bold 200px system-ui, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('7', w * 0.5, h * 0.45);
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.55)';
  ctx.lineWidth = 12;
  ctx.strokeText('7', w * 0.5, h * 0.45);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Shorts: panel seams + fabric grain */
export function createShortsFabricTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#172554';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1e3a8a');
  g.addColorStop(0.5, '#1d4ed8');
  g.addColorStop(1, '#172554');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  for (let y = 0; y < h; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + 1);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();

  ctx.fillStyle = 'rgba(37, 99, 235, 0.35)';
  ctx.fillRect(0, 0, w * 0.22, h);
  ctx.fillRect(w * 0.78, 0, w * 0.22, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Subtle skin variation (warm undertone + micro speckle) */
export function createSkinTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f0c39c';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 900; i++) {
    const x = Math.floor(hash2(i, 1) * w);
    const y = Math.floor(hash2(i, 2) * h);
    const t = hash2(i, 3);
    ctx.fillStyle = t < 0.5 ? 'rgba(200, 120, 80, 0.06)' : 'rgba(255, 220, 190, 0.07)';
    ctx.fillRect(x, y, 1 + Math.floor(hash2(i, 4) * 2), 1);
  }

  const g = ctx.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.5, h * 0.5, w * 0.65);
  g.addColorStop(0, 'rgba(255, 210, 180, 0.12)');
  g.addColorStop(1, 'rgba(120, 70, 40, 0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Orange shoe upper with wear scuffs */
export function createShoeLeatherTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#fb923c');
  g.addColorStop(0.5, '#f97316');
  g.addColorStop(1, '#c2410c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 400; i++) {
    const x = Math.floor(hash2(i + 40, 5) * w);
    const y = Math.floor(hash2(i + 40, 6) * h);
    ctx.fillStyle = `rgba(0,0,0,${0.04 + hash2(i, 7) * 0.08})`;
    ctx.fillRect(x, y, 2, 1);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Hair: strand noise */
export function createHairTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3b2f20';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 2) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.03 + (y % 7) * 0.008})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.15 + y * 0.08) * 1.2);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
