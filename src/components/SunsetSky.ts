/**
 * Sunset sky canvas renderer, adapted from ivsunsets project.
 * Renders a beautiful animated sunset with gradient sky, sun glow, god rays,
 * stars, cloud layers, and horizon haze onto a 2D canvas.
 */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a})`;
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function seededRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function drawSky(
  ctx: CanvasRenderingContext2D, w: number, h: number, v: number,
) {
  const t = clamp01(v);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, lerpColor('#080c18', '#080c28', t));
  g.addColorStop(0.07, lerpColor('#0c1020', '#0e1448', t));
  g.addColorStop(0.16, lerpColor('#12142c', '#1c1862', t));
  g.addColorStop(0.25, lerpColor('#1a1c36', '#38207c', t));
  g.addColorStop(0.34, lerpColor('#22243c', '#642888', t));
  g.addColorStop(0.43, lerpColor('#2c2c3e', '#a42c72', t));
  g.addColorStop(0.52, lerpColor('#363438', '#cc3456', t));
  g.addColorStop(0.60, lerpColor('#3e3838', '#e04838', t));
  g.addColorStop(0.68, lerpColor('#4a4038', '#ec6828', t));
  g.addColorStop(0.76, lerpColor('#564c3c', '#f48820', t));
  g.addColorStop(0.84, lerpColor('#625840', '#f8a818', t));
  g.addColorStop(0.92, lerpColor('#6e6446', '#fcc014', t));
  g.addColorStop(1.00, lerpColor('#7a6e50', '#ffd018', t));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawSunGlow(
  ctx: CanvasRenderingContext2D, w: number, h: number, brightness: number,
) {
  const b = clamp01(brightness);
  const sunX = w * 0.5;
  const sunY = h * 0.9;

  const atmo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.7);
  atmo.addColorStop(0.0, rgba(255, 220, 160, 0.18 * b));
  atmo.addColorStop(0.2, rgba(255, 180, 120, 0.10 * b));
  atmo.addColorStop(0.5, rgba(255, 140, 90, 0.04 * b));
  atmo.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = atmo;
  ctx.fillRect(0, 0, w, h);

  const band = ctx.createLinearGradient(0, h * 0.78, 0, h);
  band.addColorStop(0.0, 'rgba(0,0,0,0)');
  band.addColorStop(0.3, rgba(255, 180, 120, 0.06 * b));
  band.addColorStop(0.6, rgba(255, 160, 100, 0.10 * b));
  band.addColorStop(0.85, rgba(255, 140, 80, 0.08 * b));
  band.addColorStop(1.0, rgba(255, 120, 60, 0.04 * b));
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  const inner = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.2);
  inner.addColorStop(0.0, rgba(255, 250, 240, 0.65 * b));
  inner.addColorStop(0.2, rgba(255, 225, 175, 0.40 * b));
  inner.addColorStop(0.5, rgba(255, 190, 130, 0.18 * b));
  inner.addColorStop(1.0, 'rgba(255,150,90,0)');
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, w, h);

  const r = Math.min(w, h) * 0.024;
  const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r * 3);
  disc.addColorStop(0.0, rgba(255, 255, 250, 0.92 * b));
  disc.addColorStop(0.25, rgba(255, 240, 200, 0.60 * b));
  disc.addColorStop(0.55, rgba(255, 200, 140, 0.25 * b));
  disc.addColorStop(1.0, 'rgba(255,170,100,0)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sunX, sunY, r * 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGodRays(
  ctx: CanvasRenderingContext2D, w: number, h: number, v: number, time: number,
) {
  if (v < 0.12) return;
  const sunX = w * 0.5;
  const sunY = h * 0.9;
  const numRays = 11;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < numRays; i++) {
    const baseAngle = -Math.PI / 2 + (i - numRays / 2) * 0.14;
    const angle = baseAngle + Math.sin(time * 0.12 + i * 1.4) * 0.02;
    const rayLen = h * 0.8;
    const spread = 0.028 + Math.sin(i * 2.3 + 0.5) * 0.012;
    const rayAlpha = (0.04 + Math.sin(i * 1.7) * 0.015) * v;

    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(angle - spread) * rayLen, sunY + Math.sin(angle - spread) * rayLen);
    ctx.lineTo(sunX + Math.cos(angle + spread) * rayLen, sunY + Math.sin(angle + spread) * rayLen);
    ctx.closePath();

    const rg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, rayLen);
    rg.addColorStop(0.0, rgba(255, 220, 150, rayAlpha * 1.6));
    rg.addColorStop(0.3, rgba(255, 180, 110, rayAlpha));
    rg.addColorStop(0.7, rgba(255, 140, 80, rayAlpha * 0.4));
    rg.addColorStop(1.0, 'rgba(255,100,60,0)');
    ctx.fillStyle = rg;
    ctx.fill();
  }

  ctx.restore();
}

export function drawStars(
  ctx: CanvasRenderingContext2D, w: number, h: number, v: number, time: number,
) {
  const alpha = clamp01(1 - v * 1.5) * 0.8;
  if (alpha < 0.04) return;
  const rng = seededRng(999);

  ctx.save();
  for (let i = 0; i < 40; i++) {
    const sx = rng() * w;
    const sy = rng() * h * 0.42;
    const size = 0.4 + rng() * 1.3;
    const twinkle = 0.5 + Math.sin(time * (0.4 + rng() * 0.6) + i * 2.1) * 0.5;
    ctx.fillStyle = rgba(215, 225, 255, alpha * twinkle * (0.3 + rng() * 0.7));
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHighClouds(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  amount: number, v: number, time: number,
) {
  if (amount < 0.02) return;
  const d = clamp01(amount);
  const count = 6 + Math.floor(d * 12);
  const rng = seededRng(42);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < count; i++) {
    const baseX = rng() * w;
    const baseY = h * (0.06 + rng() * 0.3);
    const drift = Math.sin(time * 0.05 + i * 1.7) * 14;

    const haloRx = w * (0.08 + rng() * 0.06);
    const haloRy = h * (0.015 + rng() * 0.01);
    const haloGrad = ctx.createRadialGradient(baseX + drift, baseY, 0, baseX + drift, baseY, haloRx);
    haloGrad.addColorStop(0.0, rgba(255, 200, 140, d * 0.06 * (0.5 + v)));
    haloGrad.addColorStop(0.5, rgba(255, 170, 110, d * 0.025 * (0.5 + v)));
    haloGrad.addColorStop(1.0, 'rgba(255,140,80,0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.ellipse(baseX + drift, baseY, haloRx, haloRy * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const wispCount = 8 + Math.floor(rng() * 5);
    for (let j = 0; j < wispCount; j++) {
      const cx = baseX + drift + (rng() - 0.5) * w * 0.14;
      const cy = baseY + (rng() - 0.5) * h * 0.018;
      const rx = w * (0.02 + rng() * 0.06);
      const ry = h * (0.0015 + rng() * 0.004);
      const rotation = (rng() - 0.5) * 0.12;
      const a = d * (0.12 + rng() * 0.22) * (0.35 + v * 0.75);

      const wg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      wg.addColorStop(0.0, rgba(255, 225, 170, a * 1.1));
      wg.addColorStop(0.3, rgba(255, 195, 135, a * 0.7));
      wg.addColorStop(0.6, rgba(255, 165, 110, a * 0.35));
      wg.addColorStop(1.0, 'rgba(255,140,85,0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawHorizonHaze(
  ctx: CanvasRenderingContext2D, w: number, h: number, v: number,
) {
  const haze = ctx.createLinearGradient(0, h * 0.8, 0, h);
  haze.addColorStop(0.0, 'rgba(0,0,0,0)');
  haze.addColorStop(0.4, rgba(255, 200, 150, 0.03 + v * 0.06));
  haze.addColorStop(0.7, rgba(255, 175, 120, 0.04 + v * 0.05));
  haze.addColorStop(1.0, rgba(255, 150, 90, 0.02 + v * 0.03));
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
}

export function renderSunsetFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number, time: number,
) {
  const v = 0.82;
  drawSky(ctx, w, h, v);
  drawSunGlow(ctx, w, h, v);
  drawGodRays(ctx, w, h, v, time);
  drawStars(ctx, w, h, v, time);
  drawHighClouds(ctx, w, h, 0.45, v, time);
  drawHorizonHaze(ctx, w, h, v);
}
