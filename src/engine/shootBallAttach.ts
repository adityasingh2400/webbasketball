import type { BallHandlingState } from './BallStateMachine';
import {
  SHOT_GATHER_END_PROGRESS,
  SHOT_RELEASE_END_PROGRESS,
  sampleShotPhase,
} from '../data/shotPhases';

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

export function ballLocalFromShotCharge(charge: number): [number, number, number] {
  const gatherProgress = clamp(charge, 0, 1) * SHOT_GATHER_END_PROGRESS;
  const phase = sampleShotPhase(gatherProgress);
  return [phase.ball.x, phase.ball.y, phase.ball.z];
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
    const progress = lerp(SHOT_GATHER_END_PROGRESS, SHOT_RELEASE_END_PROGRESS, p);
    const phase = sampleShotPhase(progress);
    const lift = Math.sin(p * Math.PI) * 0.02;
    return [
      phase.ball.x,
      phase.ball.y + lift * (1 - p),
      phase.ball.z,
    ];
  }

  return null;
}
