export const SHOT_METER_SPEED_MIN = 0.72;
export const SHOT_METER_SPEED_MAX = 1.62;
export const SHOT_METER_RAMP_TIME = 2.4;

export const SHOT_METER_SWEET_SPOT_SIZE = 0.12;
export const SHOT_METER_SWEET_SPOT_TOP = 0.86;
export const SHOT_METER_SWEET_SPOT_START =
  SHOT_METER_SWEET_SPOT_TOP - SHOT_METER_SWEET_SPOT_SIZE;

export type ShotReleaseQuality = 'perfect' | 'early' | 'late';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getShotMeterSpeed(gatherElapsed: number): number {
  const ramp = clamp(gatherElapsed / SHOT_METER_RAMP_TIME, 0, 1);
  return SHOT_METER_SPEED_MIN + (SHOT_METER_SPEED_MAX - SHOT_METER_SPEED_MIN) * ramp;
}

export function getShotMeterProgress(gatherElapsed: number): number {
  return clamp(gatherElapsed * getShotMeterSpeed(gatherElapsed), 0, 1);
}

export function getShotReleaseQuality(value: number): ShotReleaseQuality {
  const clampedValue = clamp(value, 0, 1);
  if (clampedValue >= SHOT_METER_SWEET_SPOT_START && clampedValue <= SHOT_METER_SWEET_SPOT_TOP) {
    return 'perfect';
  }
  return clampedValue < SHOT_METER_SWEET_SPOT_START ? 'early' : 'late';
}

export function isGreenRelease(value: number): boolean {
  return getShotReleaseQuality(value) === 'perfect';
}
