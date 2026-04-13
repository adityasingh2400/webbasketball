import { describe, expect, it } from 'vitest';
import { ballLocalFromShotCharge, computeAttachedShootBallLocal } from '../../src/engine/shootBallAttach';

describe('shootBallAttach', () => {
  it('raises ball smoothly as shot charge increases', () => {
    const low = ballLocalFromShotCharge(0);
    const mid = ballLocalFromShotCharge(0.5);
    const high = ballLocalFromShotCharge(1);
    expect(low[1]).toBeLessThan(mid[1]);
    expect(mid[1]).toBeLessThan(high[1]);
  });

  it('GATHER_HIGH ball tracks charge (not stuck at one height)', () => {
    const a = computeAttachedShootBallLocal('GATHER_HIGH', 0, 0.2);
    const b = computeAttachedShootBallLocal('GATHER_HIGH', 0, 0.9);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b![1]).toBeGreaterThan(a![1]);
  });

  it('SHOOTING moves ball forward vs set point', () => {
    const charge = 0.7;
    const set = computeAttachedShootBallLocal('GATHER_HIGH', 0, charge);
    const midShot = computeAttachedShootBallLocal('SHOOTING', 0.5, charge);
    expect(set).not.toBeNull();
    expect(midShot).not.toBeNull();
    expect(midShot![2]).toBeLessThan(set![2]);
  });
});
