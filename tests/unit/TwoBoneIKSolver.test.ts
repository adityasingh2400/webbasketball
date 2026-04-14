import { describe, it, expect } from 'vitest';
import {
  solveTwoBoneIK,
  cloneIKResult,
  type Vec3,
  type IKResult,
} from '../../src/engine/animation/TwoBoneIKSolver';

const UPPER = 0.31;
const FOREARM = 0.28;

function shoulder(): Vec3 {
  return { x: 0.31, y: 1.18, z: 0 };
}

function poleDefault(isLeft: boolean): Vec3 {
  return { x: isLeft ? 0.5 : -0.5, y: 1.0, z: 0.3 };
}

function hasNoNaN(r: IKResult): boolean {
  for (const v of [r.shoulderRot, r.forearmRot]) {
    if (Number.isNaN(v.x) || Number.isNaN(v.y) || Number.isNaN(v.z)) return false;
  }
  return true;
}

function allFinite(r: IKResult): boolean {
  for (const v of [r.shoulderRot, r.forearmRot]) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) return false;
  }
  return true;
}

describe('TwoBoneIKSolver', () => {
  describe('happy path', () => {
    it('produces valid rotations for a reachable target', () => {
      const target: Vec3 = { x: 0.31, y: 1.18, z: -0.4 };
      const result = solveTwoBoneIK(shoulder(), target, poleDefault(true), UPPER, FOREARM, true);

      expect(hasNoNaN(result)).toBe(true);
      expect(allFinite(result)).toBe(true);
    });

    it('produces non-zero shoulder rotation for an offset target', () => {
      const target: Vec3 = { x: 0.5, y: 1.4, z: -0.3 };
      const result = solveTwoBoneIK(shoulder(), target, poleDefault(true), UPPER, FOREARM, true);

      expect(hasNoNaN(result)).toBe(true);
      const { shoulderRot } = result;
      const mag = Math.abs(shoulderRot.x) + Math.abs(shoulderRot.y) + Math.abs(shoulderRot.z);
      expect(mag).toBeGreaterThan(0.01);
    });
  });

  describe('fully extended arm', () => {
    it('returns valid result at exact max reach distance', () => {
      const maxReach = UPPER + FOREARM;
      const s = shoulder();
      const target: Vec3 = { x: s.x, y: s.y, z: s.z - maxReach };
      const result = solveTwoBoneIK(s, target, poleDefault(true), UPPER, FOREARM, true);

      expect(hasNoNaN(result)).toBe(true);
      expect(allFinite(result)).toBe(true);
      // At full extension the elbow angle should be near zero (almost straight)
      expect(Math.abs(result.forearmRot.x)).toBeLessThan(0.15);
    });
  });

  describe('unreachable target', () => {
    it('clamps to max reach without NaN', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x, y: s.y, z: s.z - 5.0 };
      const result = solveTwoBoneIK(s, target, poleDefault(true), UPPER, FOREARM, true);

      expect(hasNoNaN(result)).toBe(true);
      expect(allFinite(result)).toBe(true);
    });

    it('produces a nearly straight arm for far-away target', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x + 10, y: s.y, z: s.z };
      const result = solveTwoBoneIK(s, target, poleDefault(true), UPPER, FOREARM, true);

      expect(hasNoNaN(result)).toBe(true);
      expect(Math.abs(result.forearmRot.x)).toBeLessThan(0.2);
    });
  });

  describe('target at shoulder position', () => {
    it('returns default pose when distance is zero', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x, y: s.y, z: s.z };
      const result = solveTwoBoneIK(s, target, poleDefault(true), UPPER, FOREARM, true);

      expect(hasNoNaN(result)).toBe(true);
      // Should match the default left arm pose
      expect(result.shoulderRot.x).toBeCloseTo(0.15, 1);
      expect(result.shoulderRot.z).toBeCloseTo(0.18, 1);
    });

    it('returns default right arm pose for right arm at zero distance', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x, y: s.y, z: s.z };
      const result = solveTwoBoneIK(s, target, poleDefault(false), UPPER, FOREARM, false);

      expect(hasNoNaN(result)).toBe(true);
      expect(result.shoulderRot.x).toBeCloseTo(0.15, 1);
      expect(result.shoulderRot.z).toBeCloseTo(-0.18, 1);
    });
  });

  describe('left vs right arm mirroring', () => {
    it('produces mirrored Z roll for symmetric targets with mirrored shoulders', () => {
      const SHOULDER_X = 0.31;
      const SHOULDER_Y = 1.18;
      const sL: Vec3 = { x: SHOULDER_X, y: SHOULDER_Y, z: 0 };
      const sR: Vec3 = { x: -SHOULDER_X, y: SHOULDER_Y, z: 0 };

      const targetL: Vec3 = { x: SHOULDER_X + 0.2, y: SHOULDER_Y - 0.2, z: -0.3 };
      const targetR: Vec3 = { x: -SHOULDER_X - 0.2, y: SHOULDER_Y - 0.2, z: -0.3 };

      const left = cloneIKResult(
        solveTwoBoneIK(sL, targetL, { x: 0.5, y: 1.0, z: 0.3 }, UPPER, FOREARM, true),
      );
      const right = cloneIKResult(
        solveTwoBoneIK(sR, targetR, { x: -0.5, y: 1.0, z: 0.3 }, UPPER, FOREARM, false),
      );

      expect(hasNoNaN(left)).toBe(true);
      expect(hasNoNaN(right)).toBe(true);
      // Z rotation (roll / abduction) should be opposite sign for mirrored arms
      expect(Math.sign(left.shoulderRot.z)).not.toBe(Math.sign(right.shoulderRot.z));
    });

    it('forearm z has opposite sign for left vs right', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x, y: s.y, z: s.z - 0.3 };

      const left = cloneIKResult(
        solveTwoBoneIK(s, target, poleDefault(true), UPPER, FOREARM, true),
      );
      const right = cloneIKResult(
        solveTwoBoneIK(s, target, poleDefault(false), UPPER, FOREARM, false),
      );

      expect(Math.sign(left.forearmRot.z)).not.toBe(Math.sign(right.forearmRot.z));
    });
  });

  describe('pole target influence', () => {
    it('changing pole target changes the shoulder yaw', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x, y: s.y, z: s.z - 0.4 };

      const poleA: Vec3 = { x: 1, y: 1, z: 0.5 };
      const poleB: Vec3 = { x: -1, y: 1, z: 0.5 };

      const resultA = cloneIKResult(
        solveTwoBoneIK(s, target, poleA, UPPER, FOREARM, true),
      );
      const resultB = cloneIKResult(
        solveTwoBoneIK(s, target, poleB, UPPER, FOREARM, true),
      );

      expect(hasNoNaN(resultA)).toBe(true);
      expect(hasNoNaN(resultB)).toBe(true);
      // At least one of the shoulder angles should differ
      const diff =
        Math.abs(resultA.shoulderRot.x - resultB.shoulderRot.x) +
        Math.abs(resultA.shoulderRot.y - resultB.shoulderRot.y) +
        Math.abs(resultA.shoulderRot.z - resultB.shoulderRot.z);
      expect(diff).toBeGreaterThan(0.01);
    });
  });

  describe('NaN guard', () => {
    it('never produces NaN across a range of edge cases', () => {
      const s = shoulder();
      const edgeCases: Vec3[] = [
        { x: s.x, y: s.y, z: s.z },
        { x: s.x, y: s.y + 100, z: s.z },
        { x: s.x, y: s.y - 100, z: s.z },
        { x: s.x + 0.001, y: s.y, z: s.z },
        { x: s.x, y: s.y, z: s.z - (UPPER + FOREARM) },
        { x: s.x, y: s.y, z: s.z - (UPPER + FOREARM) * 0.999 },
        { x: s.x, y: s.y, z: s.z - (UPPER + FOREARM) * 1.001 },
        { x: s.x + UPPER, y: s.y - FOREARM, z: s.z },
        { x: 0, y: 0, z: 0 },
        { x: -10, y: 20, z: -30 },
      ];

      const poles: Vec3[] = [
        { x: 0, y: 0, z: 0 },
        { x: s.x, y: s.y, z: s.z },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ];

      for (const target of edgeCases) {
        for (const pole of poles) {
          for (const isLeft of [true, false]) {
            const result = solveTwoBoneIK(s, target, pole, UPPER, FOREARM, isLeft);
            expect(hasNoNaN(result)).toBe(true);
            expect(allFinite(result)).toBe(true);
          }
        }
      }
    });
  });

  describe('known position: arm pointing straight forward', () => {
    it('produces shoulder pitch near -PI/2 for target directly in front', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x, y: s.y, z: s.z - 0.5 };
      const pole: Vec3 = { x: s.x + 0.3, y: s.y - 0.1, z: s.z - 0.25 };

      const result = solveTwoBoneIK(s, target, pole, UPPER, FOREARM, true);

      expect(hasNoNaN(result)).toBe(true);
      // Shoulder pitch (X rotation) should be roughly -PI/2 for forward reach
      // along -Z. Allow generous tolerance since the elbow offset shifts things.
      expect(result.shoulderRot.x).toBeLessThan(-0.8);
      expect(result.shoulderRot.x).toBeGreaterThan(-2.5);
    });
  });

  describe('cloneIKResult', () => {
    it('creates an independent copy', () => {
      const s = shoulder();
      const target: Vec3 = { x: s.x + 0.2, y: s.y + 0.1, z: s.z - 0.3 };
      const original = solveTwoBoneIK(s, target, poleDefault(true), UPPER, FOREARM, true);
      const copy = cloneIKResult(original);

      // Mutate original by calling solver again with different params
      solveTwoBoneIK(s, { x: 0, y: 0, z: 0 }, poleDefault(true), UPPER, FOREARM, true);

      // Copy should still hold the original values
      expect(copy.shoulderRot.x).not.toBe(0);
    });
  });
});
