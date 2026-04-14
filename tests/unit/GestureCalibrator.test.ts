import { describe, it, expect } from 'vitest';
import { GestureCalibrator } from '../../src/engine/input/GestureCalibrator';

describe('GestureCalibrator', () => {
  it('starts in idle phase', () => {
    const cal = new GestureCalibrator();
    expect(cal.getPhase()).toBe('idle');
  });

  it('advances through phases: stand → dribble → shoot → done', () => {
    const cal = new GestureCalibrator();
    cal.startCalibration();
    expect(cal.getPhase()).toBe('stand');
    cal.advancePhase();
    expect(cal.getPhase()).toBe('dribble');
    cal.advancePhase();
    expect(cal.getPhase()).toBe('shoot');
    cal.advancePhase();
    expect(cal.getPhase()).toBe('done');
  });

  it('skipCalibration goes directly to done with defaults', () => {
    const cal = new GestureCalibrator();
    cal.skipCalibration();
    expect(cal.getPhase()).toBe('done');
    const t = cal.getThresholds();
    expect(t.dribbleVelocityY).toBe(0.3);
    expect(t.crossoverVelocityX).toBe(0.6);
  });

  it('computes adaptive thresholds from samples', () => {
    const cal = new GestureCalibrator();
    cal.startCalibration();

    // Stand phase: capture body dimensions
    for (let i = 0; i < 10; i++) {
      cal.addSample({ shoulderY: 0.32, hipY: 0.56 });
    }
    cal.advancePhase();

    // Dribble phase: capture movement ranges
    for (let i = 0; i < 10; i++) {
      cal.addSample({ dribbleVelocityY: 0.5 + Math.random() * 0.3 });
      cal.addSample({ crossoverVelocityX: 0.8 + Math.random() * 0.4 });
    }
    cal.advancePhase();

    // Shoot phase: capture gather and flick
    for (let i = 0; i < 5; i++) {
      cal.addSample({ gatherVelocityY: -0.7 - Math.random() * 0.3 });
      cal.addSample({ flickAngleVelocity: 12 + Math.random() * 5 });
      cal.addSample({ flickCuppedAngle: 120 + Math.random() * 20 });
    }
    cal.advancePhase();

    const t = cal.getThresholds();
    expect(t.shoulderY).toBeCloseTo(0.32, 1);
    expect(t.hipY).toBeCloseTo(0.56, 1);
    // Adaptive thresholds should be lower than raw maximums (65% ratio)
    expect(t.dribbleVelocityY).toBeLessThan(0.8);
    expect(t.dribbleVelocityY).toBeGreaterThan(0.1);
    expect(t.crossoverVelocityX).toBeLessThan(1.2);
    expect(t.crossoverVelocityX).toBeGreaterThan(0.3);
  });

  it('reset clears everything back to idle', () => {
    const cal = new GestureCalibrator();
    cal.startCalibration();
    cal.advancePhase();
    cal.reset();
    expect(cal.getPhase()).toBe('idle');
    const t = cal.getThresholds();
    expect(t.dribbleVelocityY).toBe(0.3);
  });

  it('ignores noise samples below minimum thresholds', () => {
    const cal = new GestureCalibrator();
    cal.startCalibration();
    cal.advancePhase();

    // Feed tiny velocities that should be filtered
    for (let i = 0; i < 10; i++) {
      cal.addSample({ dribbleVelocityY: 0.01 }); // below 0.05 filter
      cal.addSample({ crossoverVelocityX: 0.05 }); // below 0.1 filter
    }
    cal.advancePhase();
    cal.advancePhase();

    const t = cal.getThresholds();
    // Should still be defaults since noise was filtered
    expect(t.dribbleVelocityY).toBe(0.3);
    expect(t.crossoverVelocityX).toBe(0.6);
  });
});
