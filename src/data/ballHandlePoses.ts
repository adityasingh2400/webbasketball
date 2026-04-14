export interface Rotation3 {
  x: number;
  y: number;
  z: number;
}

export interface BallHandlePose {
  rootY?: number;
  torsoY?: number;
  torsoPitch?: number;
  torsoYaw?: number;
  torsoRoll?: number;
  bodyYaw?: number;
  headY?: number;
  headPitch?: number;
  headRoll?: number;
  leftArm?: Rotation3;
  leftForeArm?: Rotation3;
  leftHand?: Rotation3;
  rightArm?: Rotation3;
  rightForeArm?: Rotation3;
  rightHand?: Rotation3;
}

interface BallHandleKeyframe {
  t: number;
  pose: BallHandlePose;
}

export type DribbleSide = 'left' | 'right';
export type CrossoverDirection = 'right-to-left' | 'left-to-right';

const DRIBBLE_BALL_HEIGHT_MIN = 0.22;
const DRIBBLE_BALL_HEIGHT_MAX = 0.7;

const RIGHT_DRIBBLE_KEYFRAMES: BallHandleKeyframe[] = [
  {
    t: 0,
    pose: {
      rootY: -0.055,
      torsoY: -0.06,
      torsoPitch: 0.2,
      torsoYaw: 0.02,
      torsoRoll: -0.16,
      bodyYaw: 0.04,
      headY: 1.515,
      headPitch: -0.08,
      leftArm: { x: 0.1, y: 0.22, z: 0.52 },
      leftForeArm: { x: -0.56, y: 0.04, z: 0.24 },
      leftHand: { x: -0.16, y: 0.1, z: 0.14 },
      rightArm: { x: -1.08, y: -0.16, z: -0.42 },
      rightForeArm: { x: -0.96, y: 0.08, z: -0.28 },
      rightHand: { x: 0.16, y: -0.14, z: -0.24 },
    },
  },
  {
    t: 0.46,
    pose: {
      rootY: -0.038,
      torsoY: -0.044,
      torsoPitch: 0.15,
      torsoYaw: 0.03,
      torsoRoll: -0.115,
      bodyYaw: 0.045,
      headY: 1.532,
      headPitch: -0.06,
      leftArm: { x: 0.06, y: 0.18, z: 0.44 },
      leftForeArm: { x: -0.5, y: 0.03, z: 0.2 },
      leftHand: { x: -0.14, y: 0.08, z: 0.12 },
      rightArm: { x: -0.72, y: -0.18, z: -0.34 },
      rightForeArm: { x: -0.82, y: 0.02, z: -0.2 },
      rightHand: { x: -0.02, y: -0.08, z: -0.14 },
    },
  },
  {
    t: 1,
    pose: {
      rootY: -0.014,
      torsoY: -0.02,
      torsoPitch: 0.08,
      torsoYaw: 0.04,
      torsoRoll: -0.06,
      bodyYaw: 0.05,
      headY: 1.55,
      headPitch: -0.04,
      leftArm: { x: 0.02, y: 0.12, z: 0.3 },
      leftForeArm: { x: -0.4, y: 0.01, z: 0.14 },
      leftHand: { x: -0.12, y: 0.06, z: 0.1 },
      rightArm: { x: -0.26, y: -0.12, z: -0.24 },
      rightForeArm: { x: -0.52, y: -0.03, z: -0.14 },
      rightHand: { x: -0.16, y: -0.06, z: -0.08 },
    },
  },
];

const RIGHT_TO_LEFT_CROSSOVER_KEYFRAMES: BallHandleKeyframe[] = [
  {
    t: 0,
    pose: {
      rootY: -0.05,
      torsoY: -0.05,
      torsoPitch: 0.18,
      torsoYaw: 0.02,
      torsoRoll: -0.14,
      bodyYaw: 0.04,
      headY: 1.52,
      headPitch: -0.07,
      leftArm: { x: 0.08, y: 0.18, z: 0.44 },
      leftForeArm: { x: -0.52, y: 0.02, z: 0.2 },
      leftHand: { x: -0.14, y: 0.08, z: 0.12 },
      rightArm: { x: -0.92, y: -0.2, z: -0.4 },
      rightForeArm: { x: -0.86, y: 0.08, z: -0.26 },
      rightHand: { x: 0.08, y: -0.12, z: -0.18 },
    },
  },
  {
    t: 0.34,
    pose: {
      rootY: -0.06,
      torsoY: -0.058,
      torsoPitch: 0.21,
      torsoYaw: -0.01,
      torsoRoll: -0.08,
      bodyYaw: 0.02,
      headY: 1.512,
      headPitch: -0.08,
      leftArm: { x: 0.04, y: 0.16, z: 0.38 },
      leftForeArm: { x: -0.48, y: 0.02, z: 0.18 },
      leftHand: { x: -0.14, y: 0.08, z: 0.1 },
      rightArm: { x: -0.96, y: -0.04, z: -0.08 },
      rightForeArm: { x: -0.92, y: 0.26, z: -0.1 },
      rightHand: { x: 0.12, y: 0.08, z: -0.06 },
    },
  },
  {
    t: 0.72,
    pose: {
      rootY: -0.054,
      torsoY: -0.05,
      torsoPitch: 0.18,
      torsoYaw: -0.04,
      torsoRoll: 0.06,
      bodyYaw: -0.04,
      headY: 1.518,
      headPitch: -0.07,
      leftArm: { x: -0.86, y: 0.2, z: 0.34 },
      leftForeArm: { x: -0.82, y: -0.08, z: 0.22 },
      leftHand: { x: 0.06, y: 0.12, z: 0.18 },
      rightArm: { x: -0.12, y: -0.12, z: -0.26 },
      rightForeArm: { x: -0.42, y: -0.02, z: -0.12 },
      rightHand: { x: -0.12, y: -0.04, z: -0.08 },
    },
  },
  {
    t: 1,
    pose: {
      rootY: -0.058,
      torsoY: -0.06,
      torsoPitch: 0.19,
      torsoYaw: -0.02,
      torsoRoll: 0.12,
      bodyYaw: -0.06,
      headY: 1.514,
      headPitch: -0.08,
      leftArm: { x: -1.02, y: 0.16, z: 0.38 },
      leftForeArm: { x: -0.92, y: -0.04, z: 0.24 },
      leftHand: { x: 0.12, y: 0.14, z: 0.18 },
      rightArm: { x: -0.02, y: -0.14, z: -0.3 },
      rightForeArm: { x: -0.36, y: 0, z: -0.12 },
      rightHand: { x: -0.12, y: -0.04, z: -0.08 },
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRotation(a: Rotation3, b: Rotation3, t: number): Rotation3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function lerpOptionalNumber(a?: number, b?: number, t = 0): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return lerp(a ?? b ?? 0, b ?? a ?? 0, t);
}

function lerpOptionalRotation(a?: Rotation3, b?: Rotation3, t = 0): Rotation3 | undefined {
  if (!a && !b) return undefined;
  return lerpRotation(a ?? b ?? { x: 0, y: 0, z: 0 }, b ?? a ?? { x: 0, y: 0, z: 0 }, t);
}

function lerpPose(a: BallHandlePose, b: BallHandlePose, t: number): BallHandlePose {
  return {
    rootY: lerpOptionalNumber(a.rootY, b.rootY, t),
    torsoY: lerpOptionalNumber(a.torsoY, b.torsoY, t),
    torsoPitch: lerpOptionalNumber(a.torsoPitch, b.torsoPitch, t),
    torsoYaw: lerpOptionalNumber(a.torsoYaw, b.torsoYaw, t),
    torsoRoll: lerpOptionalNumber(a.torsoRoll, b.torsoRoll, t),
    bodyYaw: lerpOptionalNumber(a.bodyYaw, b.bodyYaw, t),
    headY: lerpOptionalNumber(a.headY, b.headY, t),
    headPitch: lerpOptionalNumber(a.headPitch, b.headPitch, t),
    headRoll: lerpOptionalNumber(a.headRoll, b.headRoll, t),
    leftArm: lerpOptionalRotation(a.leftArm, b.leftArm, t),
    leftForeArm: lerpOptionalRotation(a.leftForeArm, b.leftForeArm, t),
    leftHand: lerpOptionalRotation(a.leftHand, b.leftHand, t),
    rightArm: lerpOptionalRotation(a.rightArm, b.rightArm, t),
    rightForeArm: lerpOptionalRotation(a.rightForeArm, b.rightForeArm, t),
    rightHand: lerpOptionalRotation(a.rightHand, b.rightHand, t),
  };
}

function sampleKeyframes(keyframes: BallHandleKeyframe[], progress: number): BallHandlePose {
  const clamped = clamp(progress, 0, 1);

  for (let index = 0; index < keyframes.length - 1; index++) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    if (clamped <= next.t) {
      const localT = current.t === next.t ? 0 : (clamped - current.t) / (next.t - current.t);
      return lerpPose(current.pose, next.pose, localT);
    }
  }

  return keyframes[keyframes.length - 1].pose;
}

function mirrorRotation(rotation?: Rotation3): Rotation3 | undefined {
  if (!rotation) return undefined;
  return {
    x: rotation.x,
    y: -rotation.y,
    z: -rotation.z,
  };
}

function mirrorPose(pose: BallHandlePose): BallHandlePose {
  return {
    rootY: pose.rootY,
    torsoY: pose.torsoY,
    torsoPitch: pose.torsoPitch,
    torsoYaw: pose.torsoYaw === undefined ? undefined : -pose.torsoYaw,
    torsoRoll: pose.torsoRoll === undefined ? undefined : -pose.torsoRoll,
    bodyYaw: pose.bodyYaw === undefined ? undefined : -pose.bodyYaw,
    headY: pose.headY,
    headPitch: pose.headPitch,
    headRoll: pose.headRoll === undefined ? undefined : -pose.headRoll,
    leftArm: mirrorRotation(pose.rightArm),
    leftForeArm: mirrorRotation(pose.rightForeArm),
    leftHand: mirrorRotation(pose.rightHand),
    rightArm: mirrorRotation(pose.leftArm),
    rightForeArm: mirrorRotation(pose.leftForeArm),
    rightHand: mirrorRotation(pose.leftHand),
  };
}

export function getDribbleBallHeightProgress(ballHeight: number): number {
  return clamp(
    (ballHeight - DRIBBLE_BALL_HEIGHT_MIN) / (DRIBBLE_BALL_HEIGHT_MAX - DRIBBLE_BALL_HEIGHT_MIN),
    0,
    1,
  );
}

export function sampleDribblePose(side: DribbleSide, progress: number): BallHandlePose {
  const rightPose = sampleKeyframes(RIGHT_DRIBBLE_KEYFRAMES, progress);
  return side === 'right' ? rightPose : mirrorPose(rightPose);
}

export function sampleCrossoverPose(direction: CrossoverDirection, progress: number): BallHandlePose {
  const rightToLeftPose = sampleKeyframes(RIGHT_TO_LEFT_CROSSOVER_KEYFRAMES, progress);
  return direction === 'right-to-left' ? rightToLeftPose : mirrorPose(rightToLeftPose);
}
