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

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2563eb');
  g.addColorStop(0.15, '#3b82f6');
  g.addColorStop(0.5, '#2563eb');
  g.addColorStop(0.85, '#1d4ed8');
  g.addColorStop(1, '#1e40af');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 6) {
    const o = (y % 12) * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, y + o);
    for (let x = 0; x < w; x += 20) {
      ctx.lineTo(x + 10, y + o + Math.sin(x * 0.02) * 0.4);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.02)';
  for (let x = 0; x < w; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 1.2, h);
    ctx.stroke();
  }

  const sideG = ctx.createLinearGradient(0, 0, w * 0.12, 0);
  sideG.addColorStop(0, 'rgba(10, 25, 70, 0.55)');
  sideG.addColorStop(1, 'rgba(10, 25, 70, 0)');
  ctx.fillStyle = sideG;
  ctx.fillRect(0, 0, w * 0.14, h);
  const sideG2 = ctx.createLinearGradient(w * 0.88, 0, w, 0);
  sideG2.addColorStop(0, 'rgba(10, 25, 70, 0)');
  sideG2.addColorStop(1, 'rgba(10, 25, 70, 0.55)');
  ctx.fillStyle = sideG2;
  ctx.fillRect(w * 0.86, 0, w * 0.14, h);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.18)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.08, w * 0.4, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(w * 0.3, h * 0.52, w * 0.4, h * 0.12);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
  ctx.font = 'bold 190px system-ui, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('7', w * 0.5, h * 0.44);
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.5)';
  ctx.lineWidth = 10;
  ctx.strokeText('7', w * 0.5, h * 0.44);

  const highlightG = ctx.createRadialGradient(w * 0.4, h * 0.28, 0, w * 0.5, h * 0.5, w * 0.5);
  highlightG.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
  highlightG.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = highlightG;
  ctx.fillRect(0, 0, w, h);

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

/** Pants: dark knit with light center seam, inspired by simple toy-sports silhouettes */
export function createPantsFabricTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1f2937');
  g.addColorStop(0.3, '#111827');
  g.addColorStop(0.7, '#0f172a');
  g.addColorStop(1, '#1a202c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + 1);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(0, 0, w * 0.12, h);
  ctx.fillRect(w * 0.88, 0, w * 0.12, h);

  const sheen = ctx.createRadialGradient(w * 0.35, h * 0.35, 0, w * 0.5, h * 0.5, w * 0.55);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Subtle skin variation (warm undertone + micro speckle + SSS-like warmth) */
export function createSkinTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f0c39c';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 300; i++) {
    const x = Math.floor(hash2(i, 1) * w);
    const y = Math.floor(hash2(i, 2) * h);
    const t = hash2(i, 3);
    const colors = [
      'rgba(210, 130, 90, 0.04)',
      'rgba(255, 220, 190, 0.05)',
      'rgba(240, 180, 140, 0.03)',
    ];
    ctx.fillStyle = colors[Math.floor(t * 3)];
    ctx.fillRect(x, y, 2 + Math.floor(hash2(i, 4) * 2), 2);
  }

  const g = ctx.createRadialGradient(w * 0.38, h * 0.32, 0, w * 0.5, h * 0.5, w * 0.6);
  g.addColorStop(0, 'rgba(255, 215, 185, 0.14)');
  g.addColorStop(0.5, 'rgba(245, 195, 160, 0.06)');
  g.addColorStop(1, 'rgba(140, 85, 50, 0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const warmG = ctx.createLinearGradient(0, 0, 0, h);
  warmG.addColorStop(0, 'rgba(255, 200, 170, 0.08)');
  warmG.addColorStop(0.5, 'rgba(255, 215, 190, 0.04)');
  warmG.addColorStop(1, 'rgba(200, 130, 90, 0.06)');
  ctx.fillStyle = warmG;
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

  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#93c5fd');
  g.addColorStop(0.25, '#60a5fa');
  g.addColorStop(0.55, '#2563eb');
  g.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 400; i++) {
    const x = Math.floor(hash2(i + 40, 5) * w);
    const y = Math.floor(hash2(i + 40, 6) * h);
    ctx.fillStyle = `rgba(0,0,0,${0.04 + hash2(i, 7) * 0.08})`;
    ctx.fillRect(x, y, 2, 1);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, h * 0.62, w, h * 0.16);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
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
