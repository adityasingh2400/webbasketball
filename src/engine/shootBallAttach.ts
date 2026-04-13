import type { BallHandlingState } from './BallStateMachine';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * Ball height / position vs shot meter (matches gather phases in playerAnimation.applyGatherOverlay).
 */
export function ballLocalFromShotCharge(charge: number): [number, number, number] {
  const c = clamp(charge, 0, 1);
  const crouch = Math.min(1, c / 0.34);
  const rise = clamp((c - 0.34) / 0.66, 0, 1);
  const yLow = 0.56;
  const yMid = 0.9;
  const yHigh = 1.5;
  const y = yLow + (yMid - yLow) * easeOutQuad(crouch) + (yHigh - yMid) * easeInOutQuad(rise);
  const x = 0.16 - c * 0.1;
  const z = 0.1 - c * 0.085;
  return [x, y, z];
}

/**
 * When non-null, replaces FSM ball offsets so the ball tracks the shooting hands through gather + release wind-up.
 */
export function computeAttachedShootBallLocal(
  state: BallHandlingState,
  stateProgress: number,
  shotCharge: number,
): [number, number, number] | null {
  if (state === 'GATHER_LOW') {
    const t = smoothstep(clamp(stateProgress, 0, 1));
    const target = ballLocalFromShotCharge(shotCharge);
    const entry: [number, number, number] = [0.22, 0.78, 0.1];
    return [
      lerp(entry[0], target[0], t),
      lerp(entry[1], target[1], t),
      lerp(entry[2], target[2], t),
    ];
  }

  if (state === 'GATHER_HIGH') {
    return ballLocalFromShotCharge(shotCharge);
  }

  if (state === 'SHOOTING') {
    const p = smoothstep(clamp(stateProgress, 0, 1));
    const set = ballLocalFromShotCharge(shotCharge);
    const release: [number, number, number] = [0.025, 1.76, -0.14];
    const lift = Math.sin(p * Math.PI) * 0.045;
    return [
      lerp(set[0], release[0], p),
      lerp(set[1], release[1], p) + lift * (1 - p),
      lerp(set[2], release[2], p),
    ];
  }

  return null;
}
