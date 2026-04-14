import type { PoseLandmarkData } from '../../types';
import type { BodyInputFrame, Vec3 } from './BodyInputFrame';
import type { PoseFeatures } from './PoseFeatureExtractor';
import type { BallInput } from '../BallStateMachine';
import { POSE } from './PoseFeatureExtractor';
import { SHOULDER_Y, SHOULDER_X, UPPER_ARM_LEN, FOREARM_LEN } from '../../r3f/playerRig';

const COURT_HALF_WIDTH = 7;
const COURT_LENGTH = 26;
const COURT_NEAR_Z = 12;

const DEFAULT_SHOULDER_Y = SHOULDER_Y;
const DEFAULT_HIP_Y = 0.95;
const DEFAULT_WRIST_Y = 0.9;
const DEFAULT_ELBOW_Y = (DEFAULT_SHOULDER_Y + DEFAULT_WRIST_Y) / 2;

const CHARACTER_ARM_REACH = UPPER_ARM_LEN + FOREARM_LEN;
const CHARACTER_SHOULDER_HALF_WIDTH = SHOULDER_X;

export interface BodyProportions {
  shoulderToWrist: number;
  shoulderHalfWidth: number;
  shoulderHeight: number;
  hipHeight: number;
}

const _defaultProportions: BodyProportions = {
  shoulderToWrist: CHARACTER_ARM_REACH,
  shoulderHalfWidth: CHARACTER_SHOULDER_HALF_WIDTH,
  shoulderHeight: SHOULDER_Y,
  hipHeight: DEFAULT_HIP_Y,
};

let _calibratedProportions: BodyProportions | null = null;
let _calibrationSamples: BodyProportions[] = [];

function dist3(a: PoseLandmarkData, b: PoseLandmarkData): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Measure the player's body proportions from a single frame of world landmarks.
 * Call during calibration "stand still" phase to accumulate samples.
 */
export function measureProportions(worldLandmarks: PoseLandmarkData[]): BodyProportions {
  const lShoulder = worldLandmarks[POSE.LEFT_SHOULDER];
  const rShoulder = worldLandmarks[POSE.RIGHT_SHOULDER];
  const lElbow = worldLandmarks[POSE.LEFT_ELBOW];
  const rElbow = worldLandmarks[POSE.RIGHT_ELBOW];
  const lWrist = worldLandmarks[POSE.LEFT_WRIST];
  const rWrist = worldLandmarks[POSE.RIGHT_WRIST];
  const lHip = worldLandmarks[POSE.LEFT_HIP];
  const rHip = worldLandmarks[POSE.RIGHT_HIP];

  const leftArmLen = dist3(lShoulder, lElbow) + dist3(lElbow, lWrist);
  const rightArmLen = dist3(rShoulder, rElbow) + dist3(rElbow, rWrist);
  const shoulderToWrist = (leftArmLen + rightArmLen) / 2;

  const shoulderHalfWidth = dist3(lShoulder, rShoulder) / 2;

  const hipY = (lHip.y + rHip.y) / 2;
  const shoulderHeight = (lShoulder.y + rShoulder.y) / 2 - hipY;

  return {
    shoulderToWrist,
    shoulderHalfWidth,
    shoulderHeight,
    hipHeight: hipY,
  };
}

/**
 * Feed a calibration sample during the "stand still" phase.
 * Call once per frame for ~2-3 seconds.
 */
export function addProportionSample(worldLandmarks: PoseLandmarkData[]): void {
  _calibrationSamples.push(measureProportions(worldLandmarks));
}

/**
 * Finalize proportion calibration from accumulated samples.
 * Uses the median of each dimension for robustness.
 */
export function finalizeProportions(): BodyProportions {
  if (_calibrationSamples.length < 3) {
    _calibratedProportions = null;
    return { ..._defaultProportions };
  }

  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  _calibratedProportions = {
    shoulderToWrist: median(_calibrationSamples.map(s => s.shoulderToWrist)),
    shoulderHalfWidth: median(_calibrationSamples.map(s => s.shoulderHalfWidth)),
    shoulderHeight: median(_calibrationSamples.map(s => s.shoulderHeight)),
    hipHeight: median(_calibrationSamples.map(s => s.hipHeight)),
  };

  _calibrationSamples = [];
  return { ..._calibratedProportions };
}

export function resetProportions(): void {
  _calibratedProportions = null;
  _calibrationSamples = [];
}

export function getProportions(): BodyProportions {
  return _calibratedProportions ? { ..._calibratedProportions } : { ..._defaultProportions };
}

/**
 * Remap a joint position from the player's body space to the character's body space.
 * The position is already hip-centered and coordinate-transformed.
 * This scales it so the player's arm reach maps to the character's arm reach.
 */
function remapToCharacter(pos: Vec3, playerProps: BodyProportions): Vec3 {
  const reachScale = CHARACTER_ARM_REACH / Math.max(0.01, playerProps.shoulderToWrist);
  const widthScale = CHARACTER_SHOULDER_HALF_WIDTH / Math.max(0.01, playerProps.shoulderHalfWidth);
  const heightScale = SHOULDER_Y / Math.max(0.01, playerProps.shoulderHeight);

  return {
    x: pos.x * widthScale,
    y: pos.y * heightScale,
    z: pos.z * reachScale,
  };
}

function lmToVec3(lm: PoseLandmarkData, hipY: number): Vec3 {
  return {
    x: -lm.x,
    y: lm.y - hipY,
    z: -lm.z,
  };
}

function midpoint(a: PoseLandmarkData, b: PoseLandmarkData): { x: number; y: number; z: number } {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

function avgVisibility(landmarks: PoseLandmarkData[], indices: number[]): number {
  let sum = 0;
  for (const i of indices) sum += landmarks[i].visibility;
  return sum / indices.length;
}

export function landmarkToBodyInputFrame(
  worldLandmarks: PoseLandmarkData[],
  imageLandmarks: PoseLandmarkData[],
  features: PoseFeatures,
  ballInput: BallInput,
  timestamp: number,
): BodyInputFrame {
  const lHip = worldLandmarks[POSE.LEFT_HIP];
  const rHip = worldLandmarks[POSE.RIGHT_HIP];
  const hipY = (lHip.y + rHip.y) / 2;

  const props = _calibratedProportions ?? _defaultProportions;

  const rawWristL = lmToVec3(worldLandmarks[POSE.LEFT_WRIST], hipY);
  const rawWristR = lmToVec3(worldLandmarks[POSE.RIGHT_WRIST], hipY);
  const rawElbowL = lmToVec3(worldLandmarks[POSE.LEFT_ELBOW], hipY);
  const rawElbowR = lmToVec3(worldLandmarks[POSE.RIGHT_ELBOW], hipY);
  const rawShoulderL = lmToVec3(worldLandmarks[POSE.LEFT_SHOULDER], hipY);
  const rawShoulderR = lmToVec3(worldLandmarks[POSE.RIGHT_SHOULDER], hipY);

  const wristL = remapToCharacter(rawWristL, props);
  const wristR = remapToCharacter(rawWristR, props);
  const elbowL = remapToCharacter(rawElbowL, props);
  const elbowR = remapToCharacter(rawElbowR, props);
  const shoulderL = remapToCharacter(rawShoulderL, props);
  const shoulderR = remapToCharacter(rawShoulderR, props);

  const hipMid = midpoint(lHip, rHip);
  const hipCenter: Vec3 = { x: -hipMid.x, y: hipMid.y - hipY, z: -hipMid.z };

  const lShoulder = worldLandmarks[POSE.LEFT_SHOULDER];
  const rShoulder = worldLandmarks[POSE.RIGHT_SHOULDER];
  const shoulderMidX = -(lShoulder.x + rShoulder.x) / 2;
  const hipMidX = -(lHip.x + rHip.x) / 2;
  const torsoLean = Math.max(-1, Math.min(1, (shoulderMidX - hipMidX) * 5));

  const nose = worldLandmarks[POSE.NOSE];
  const shoulderCenterY = (lShoulder.y + rShoulder.y) / 2 - hipY;
  const shoulderCenterX = -(lShoulder.x + rShoulder.x) / 2;
  const shoulderCenterZ = -(lShoulder.z + rShoulder.z) / 2;
  const noseTransformed: Vec3 = { x: -nose.x, y: nose.y - hipY, z: -nose.z };
  const headTilt: Vec3 = {
    x: noseTransformed.y - shoulderCenterY,
    y: noseTransformed.x - shoulderCenterX,
    z: noseTransformed.z - shoulderCenterZ,
  };

  const torsoCenterX = (imageLandmarks[POSE.LEFT_SHOULDER].x + imageLandmarks[POSE.RIGHT_SHOULDER].x) / 2;
  const mirroredX = 1 - torsoCenterX;
  const playerX = Math.max(-COURT_HALF_WIDTH, Math.min(COURT_HALF_WIDTH,
    (mirroredX - 0.5) * 2 * COURT_HALF_WIDTH));
  const playerZ = Math.max(-13, Math.min(13,
    COURT_NEAR_Z - features.hipCenterY * COURT_LENGTH * 0.5));

  const dominantHand: 'left' | 'right' = features.lowerHand;

  const keyIndices = [
    POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER,
    POSE.LEFT_WRIST, POSE.RIGHT_WRIST,
    POSE.LEFT_HIP, POSE.RIGHT_HIP,
  ];
  const confidence = avgVisibility(worldLandmarks, keyIndices);

  return {
    wristL,
    wristR,
    elbowL,
    elbowR,
    shoulderL,
    shoulderR,
    hipCenter,
    playerX,
    playerZ,
    torsoLean,
    headTilt,
    dominantHand,
    intent: ballInput,
    confidence,
    source: 'webcam',
    timestamp,
  };
}

export function createEmptyBodyInputFrame(timestamp: number): BodyInputFrame {
  const defaultBallInput: BallInput = {
    velocityX: 0,
    velocityY: 0,
    dribblePressed: false,
    handSide: 'right',
    released: false,
    timeSinceStateEnter: 0,
  };

  return {
    wristL: { x: -0.31, y: DEFAULT_WRIST_Y, z: 0 },
    wristR: { x: 0.31, y: DEFAULT_WRIST_Y, z: 0 },
    elbowL: { x: -0.31, y: DEFAULT_ELBOW_Y, z: 0 },
    elbowR: { x: 0.31, y: DEFAULT_ELBOW_Y, z: 0 },
    shoulderL: { x: -0.31, y: DEFAULT_SHOULDER_Y, z: 0 },
    shoulderR: { x: 0.31, y: DEFAULT_SHOULDER_Y, z: 0 },
    hipCenter: { x: 0, y: DEFAULT_HIP_Y, z: 0 },
    playerX: 0,
    playerZ: 0,
    torsoLean: 0,
    headTilt: { x: 0, y: 0, z: 0 },
    dominantHand: 'right',
    intent: defaultBallInput,
    confidence: 0,
    source: 'webcam',
    timestamp,
  };
}
