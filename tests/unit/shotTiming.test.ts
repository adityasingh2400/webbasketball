import { describe, expect, it } from 'vitest';
import {
  getShotMeterProgress,
  getShotReleaseQuality,
  isGreenRelease,
  SHOT_METER_SWEET_SPOT_START,
  SHOT_METER_SWEET_SPOT_TOP,
} from '../../src/engine/shotTiming';

describe('shotTiming', () => {
  it('ramps shot meter progress upward and clamps at 1', () => {
    expect(getShotMeterProgress(0)).toBe(0);
    expect(getShotMeterProgress(0.3)).toBeGreaterThan(0);
    expect(getShotMeterProgress(8)).toBe(1);
  });

  it('classifies early, perfect, and late releases around the sweet spot window', () => {
    expect(getShotReleaseQuality(SHOT_METER_SWEET_SPOT_START - 0.02)).toBe('early');
    expect(getShotReleaseQuality((SHOT_METER_SWEET_SPOT_START + SHOT_METER_SWEET_SPOT_TOP) / 2)).toBe('perfect');
    expect(getShotReleaseQuality(SHOT_METER_SWEET_SPOT_TOP + 0.04)).toBe('late');
  });

  it('treats only sweet spot releases as green', () => {
    expect(isGreenRelease(SHOT_METER_SWEET_SPOT_START + 0.01)).toBe(true);
    expect(isGreenRelease(SHOT_METER_SWEET_SPOT_START - 0.01)).toBe(false);
    expect(isGreenRelease(SHOT_METER_SWEET_SPOT_TOP + 0.01)).toBe(false);
  });
});
