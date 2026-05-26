import { describe, expect, it } from 'vitest';
import {
  getDribbleBallHeightProgress,
  sampleCrossoverPose,
  sampleDribblePose,
} from '../../src/data/ballHandlePoses';

describe('ballHandlePoses', () => {
  it('maps dribble ball heights into a normalized progress window', () => {
    expect(getDribbleBallHeightProgress(0.12)).toBe(0);
    expect(getDribbleBallHeightProgress(1.2)).toBe(1);
    expect(getDribbleBallHeightProgress(0.46)).toBeGreaterThan(0.4);
    expect(getDribbleBallHeightProgress(0.46)).toBeLessThan(0.6);
  });

  it('mirrors left and right dribble poses', () => {
    const right = sampleDribblePose('right', 0.35);
    const left = sampleDribblePose('left', 0.35);

    expect(left.leftArm?.x).toBeCloseTo(right.rightArm?.x ?? 0);
    expect(left.leftArm?.y).toBeCloseTo(-(right.rightArm?.y ?? 0));
    expect(left.leftArm?.z).toBeCloseTo(-(right.rightArm?.z ?? 0));
    expect(left.rightArm?.x).toBeCloseTo(right.leftArm?.x ?? 0);
  });

  it('mirrors crossover poses by direction', () => {
    const rightToLeft = sampleCrossoverPose('right-to-left', 0.6);
    const leftToRight = sampleCrossoverPose('left-to-right', 0.6);

    expect(leftToRight.leftForeArm?.x).toBeCloseTo(rightToLeft.rightForeArm?.x ?? 0);
    expect(leftToRight.leftForeArm?.y).toBeCloseTo(-(rightToLeft.rightForeArm?.y ?? 0));
    expect(leftToRight.rightForeArm?.x).toBeCloseTo(rightToLeft.leftForeArm?.x ?? 0);
  });
});
