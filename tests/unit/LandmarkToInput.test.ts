import { describe, it, expect } from 'vitest';
import {
  landmarkToBodyInputFrame,
  createEmptyBodyInputFrame,
} from '../../src/engine/input/LandmarkToInput';
import type { PoseLandmarkData } from '../../src/types';
import type { PoseFeatures } from '../../src/engine/input/PoseFeatureExtractor';
import type { BallInput } from '../../src/engine/BallStateMachine';

function makeLandmark(
  index: number,
  x: number,
  y: number,
  z: number,
  visibility = 1.0,
): PoseLandmarkData {
  return { index, x, y, z, visibility };
}

function make33Landmarks(overrides: Partial<Record<number, { x: number; y: number; z: number }>> = {}): PoseLandmarkData[] {
  const landmarks: PoseLandmarkData[] = [];
  for (let i = 0; i < 33; i++) {
    const o = overrides[i];
    landmarks.push(makeLandmark(i, o?.x ?? 0, o?.y ?? 0, o?.z ?? 0));
  }
  return landmarks;
}

function makeFeatures(overrides: Partial<PoseFeatures> = {}): PoseFeatures {
  return {
    rightWristX: 0.5,
    rightWristY: 0.5,
    leftWristX: 0.5,
    leftWristY: 0.5,
    rightWristRelHipY: 0,
    leftWristRelHipY: 0,
    rightWristAboveShoulder: false,
    leftWristAboveShoulder: false,
    rightElbowAngle: Math.PI,
    leftElbowAngle: Math.PI,
    hipCenterY: 0.6,
    shoulderCenterY: 0.35,
    avgKneeAngle: Math.PI,
    torsoLeanX: 0,
    rightWristVisibility: 1,
    leftWristVisibility: 1,
    lowerHand: 'right',
    valid: true,
    ...overrides,
  };
}

function makeBallInput(overrides: Partial<BallInput> = {}): BallInput {
  return {
    velocityX: 0,
    velocityY: 0,
    dribblePressed: false,
    handSide: 'right',
    released: false,
    timeSinceStateEnter: 0,
    ...overrides,
  };
}

describe('LandmarkToInput', () => {
  describe('hip re-centering', () => {
    it('shifts Y values so feet are at origin', () => {
      const hipY = 0.5;
      const world = make33Landmarks({
        11: { x: 0, y: hipY + 0.3, z: 0 },   // left shoulder
        12: { x: 0, y: hipY + 0.3, z: 0 },   // right shoulder
        13: { x: 0, y: hipY + 0.15, z: 0 },  // left elbow
        14: { x: 0, y: hipY + 0.15, z: 0 },  // right elbow
        15: { x: 0, y: hipY + 0.05, z: 0 },  // left wrist
        16: { x: 0, y: hipY + 0.05, z: 0 },  // right wrist
        23: { x: 0, y: hipY, z: 0 },          // left hip
        24: { x: 0, y: hipY, z: 0 },          // right hip
      });
      const image = make33Landmarks({
        11: { x: 0.4, y: 0.35, z: 0 },
        12: { x: 0.6, y: 0.35, z: 0 },
      });

      const frame = landmarkToBodyInputFrame(world, image, makeFeatures(), makeBallInput(), 1000);

      expect(frame.hipCenter.y).toBeCloseTo(0, 5);
      expect(frame.shoulderL.y).toBeCloseTo(0.3, 5);
      expect(frame.shoulderR.y).toBeCloseTo(0.3, 5);
      expect(frame.wristL.y).toBeCloseTo(0.05, 5);
    });
  });

  describe('X axis mirror', () => {
    it('negates MediaPipe X so player right is positive', () => {
      const world = make33Landmarks({
        15: { x: -0.3, y: 0, z: 0 },  // MP left wrist at x=-0.3 (user's left)
        16: { x: 0.3, y: 0, z: 0 },   // MP right wrist at x=0.3 (user's right)
        23: { x: 0, y: 0, z: 0 },
        24: { x: 0, y: 0, z: 0 },
      });
      const image = make33Landmarks({
        11: { x: 0.5, y: 0.5, z: 0 },
        12: { x: 0.5, y: 0.5, z: 0 },
      });

      const frame = landmarkToBodyInputFrame(world, image, makeFeatures(), makeBallInput(), 1000);

      // MediaPipe x=-0.3 negated → +0.3 in character space
      expect(frame.wristL.x).toBeCloseTo(0.3, 5);
      // MediaPipe x=0.3 negated → -0.3 in character space
      expect(frame.wristR.x).toBeCloseTo(-0.3, 5);
    });
  });

  describe('Z axis rotation', () => {
    it('negates MediaPipe Z so toward-camera becomes forward', () => {
      const world = make33Landmarks({
        15: { x: 0, y: 0, z: 0.5 },   // wrist 0.5m toward camera in MP
        16: { x: 0, y: 0, z: -0.2 },  // wrist 0.2m away from camera in MP
        23: { x: 0, y: 0, z: 0 },
        24: { x: 0, y: 0, z: 0 },
      });
      const image = make33Landmarks({
        11: { x: 0.5, y: 0.5, z: 0 },
        12: { x: 0.5, y: 0.5, z: 0 },
      });

      const frame = landmarkToBodyInputFrame(world, image, makeFeatures(), makeBallInput(), 1000);

      // MP z=0.5 (toward camera) negated → -0.5 (backward in char space)
      expect(frame.wristL.z).toBeCloseTo(-0.5, 5);
      // MP z=-0.2 (away from camera) negated → 0.2 (forward in char space)
      expect(frame.wristR.z).toBeCloseTo(0.2, 5);
    });
  });

  describe('joint extraction', () => {
    it('extracts all 7 joint groups from 33 landmarks', () => {
      const world = make33Landmarks({
        0:  { x: 0, y: 1.7, z: -0.1 },     // nose
        11: { x: -0.2, y: 1.2, z: 0 },     // left shoulder
        12: { x: 0.2, y: 1.2, z: 0 },      // right shoulder
        13: { x: -0.25, y: 0.9, z: 0.05 }, // left elbow
        14: { x: 0.25, y: 0.9, z: -0.05 }, // right elbow
        15: { x: -0.3, y: 0.6, z: 0.1 },   // left wrist
        16: { x: 0.3, y: 0.6, z: -0.1 },   // right wrist
        23: { x: -0.1, y: 0, z: 0 },       // left hip
        24: { x: 0.1, y: 0, z: 0 },        // right hip
      });
      const image = make33Landmarks({
        11: { x: 0.4, y: 0.3, z: 0 },
        12: { x: 0.6, y: 0.3, z: 0 },
      });

      const frame = landmarkToBodyInputFrame(world, image, makeFeatures(), makeBallInput(), 1000);

      expect(frame.shoulderL).toBeDefined();
      expect(frame.shoulderR).toBeDefined();
      expect(frame.elbowL).toBeDefined();
      expect(frame.elbowR).toBeDefined();
      expect(frame.wristL).toBeDefined();
      expect(frame.wristR).toBeDefined();
      expect(frame.hipCenter).toBeDefined();

      // Hip-centered: hipY = (0 + 0) / 2 = 0, so shoulders at y=1.2
      expect(frame.shoulderL.y).toBeCloseTo(1.2, 5);
      expect(frame.shoulderR.y).toBeCloseTo(1.2, 5);
      expect(frame.elbowL.y).toBeCloseTo(0.9, 5);
      expect(frame.wristR.y).toBeCloseTo(0.6, 5);
    });
  });

  describe('createEmptyBodyInputFrame', () => {
    it('returns confidence=0 and source webcam', () => {
      const frame = createEmptyBodyInputFrame(5000);

      expect(frame.confidence).toBe(0);
      expect(frame.source).toBe('webcam');
      expect(frame.timestamp).toBe(5000);
    });

    it('returns valid joint positions at standing defaults', () => {
      const frame = createEmptyBodyInputFrame(0);

      expect(frame.shoulderL.y).toBeCloseTo(1.18, 2);
      expect(frame.shoulderR.y).toBeCloseTo(1.18, 2);
      expect(frame.hipCenter.y).toBeCloseTo(0.95, 2);
      expect(frame.wristL.x).toBeLessThan(0);
      expect(frame.wristR.x).toBeGreaterThan(0);
    });
  });
});
