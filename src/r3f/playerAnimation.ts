import type { GameRenderState } from '../engine/GameRuntime';
import type { BodyInputFrame } from '../engine/input/BodyInputFrame';
import {
  getDribbleBallHeightProgress,
  sampleCrossoverPose,
  sampleDribblePose,
  type BallHandlePose,
  type Rotation3,
} from '../data/ballHandlePoses';
import {
  SHOT_GATHER_END_PROGRESS,
  SHOT_RELEASE_END_PROGRESS,
  sampleShotPhase,
} from '../data/shotPhases';
import { BASE_HEAD_Y, SHOULDER_Y, SHOULDER_X, UPPER_ARM_LEN, FOREARM_LEN } from './playerRig';
import { solveTwoBoneIK, cloneIKResult, type IKResult } from '../engine/animation/TwoBoneIKSolver';

interface LimbRotation {
  x: number;
  y: number;
  z: number;
}

export interface PlayerPose {
  rootY: number;
  bodyYaw: number;
  shadowScale: number;
  shadowOpacity: number;
  torsoY: number;
  torsoPitch: number;
  torsoYaw: number;
  torsoRoll: number;
  headY: number;
  headPitch: number;
  headRoll: number;
  leftArm: LimbRotation;
  leftForeArm: LimbRotation;
  rightArm: LimbRotation;
  rightForeArm: LimbRotation;
  /** Local wrist rotation (hand group at end of forearm) */
  leftHand: LimbRotation;
  rightHand: LimbRotation;
  leftLeg: LimbRotation;
  rightLeg: LimbRotation;
  leftShin: LimbRotation;
  rightShin: LimbRotation;
  leftFoot: LimbRotation;
  rightFoot: LimbRotation;
}

/**
 * Shooting is always a right-handed motion: right arm = release, left = light guide.
 * (Ball attach in `shootBallAttach` is already right-biased in +X.)
 */
const GUIDE_HAND_IK_BLEND = 0.34;
const GUIDE_HAND_IK_PITCH_MUL = 0.42;
const GUIDE_HAND_IK_YAW_MUL = 0.26;

const _scratchA: LimbRotation[] = Array.from({ length: 6 }, () => ({ x: 0, y: 0, z: 0 }));
const _scratchB: LimbRotation[] = Array.from({ length: 6 }, () => ({ x: 0, y: 0, z: 0 }));

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

function blendRotation(target: LimbRotation, x: number, y: number, z: number, alpha: number): void {
  if (alpha <= 0) return;
  if (alpha >= 1) {
    target.x = x;
    target.y = y;
    target.z = z;
    return;
  }
  target.x = lerp(target.x, x, alpha);
  target.y = lerp(target.y, y, alpha);
  target.z = lerp(target.z, z, alpha);
}

function assignRotation(target: LimbRotation, x: number, y: number, z: number): void {
  target.x = x;
  target.y = y;
  target.z = z;
}

function blendOptionalRotation(target: LimbRotation, next: Rotation3 | undefined, alpha: number): void {
  if (!next) return;
  blendRotation(target, next.x, next.y, next.z, alpha);
}

function applyBallHandleArmPose(pose: PlayerPose, next: BallHandlePose, alpha: number): void {
  blendOptionalRotation(pose.leftArm, next.leftArm, alpha);
  blendOptionalRotation(pose.leftForeArm, next.leftForeArm, alpha);
  blendOptionalRotation(pose.leftHand, next.leftHand, alpha);
  blendOptionalRotation(pose.rightArm, next.rightArm, alpha);
  blendOptionalRotation(pose.rightForeArm, next.rightForeArm, alpha);
  blendOptionalRotation(pose.rightHand, next.rightHand, alpha);
}

function isHeldBallState(state: GameRenderState['ballState']): boolean {
  return state === 'HELD_RIGHT' || state === 'HELD_LEFT';
}

function isDribbleBallState(state: GameRenderState['ballState']): boolean {
  return (
    state === 'DRIBBLE_RIGHT_DOWN' ||
    state === 'DRIBBLE_RIGHT_UP' ||
    state === 'DRIBBLE_LEFT_DOWN' ||
    state === 'DRIBBLE_LEFT_UP'
  );
}

function isCrossoverBallState(state: GameRenderState['ballState']): boolean {
  return state === 'CROSSOVER_R2L' || state === 'CROSSOVER_L2R';
}

export function createPlayerPose(): PlayerPose {
  return {
    rootY: 0,
    bodyYaw: 0,
    shadowScale: 1,
    shadowOpacity: 0.2,
    torsoY: 0,
    torsoPitch: 0.02,
    torsoYaw: 0,
    torsoRoll: 0,
    headY: BASE_HEAD_Y,
    headPitch: 0,
    headRoll: 0,
    leftArm: { x: 0.15, y: 0.05, z: 0.18 },
    leftForeArm: { x: -0.22, y: 0, z: 0.06 },
    rightArm: { x: 0.15, y: -0.05, z: -0.18 },
    rightForeArm: { x: -0.22, y: 0, z: -0.06 },
    leftHand: { x: -0.1, y: 0.02, z: 0.05 },
    rightHand: { x: -0.1, y: -0.02, z: -0.05 },
    leftLeg: { x: 0, y: 0, z: 0.04 },
    rightLeg: { x: 0, y: 0, z: -0.04 },
    leftShin: { x: 0.14, y: 0, z: 0 },
    rightShin: { x: 0.14, y: 0, z: 0 },
    leftFoot: { x: -0.08, y: 0, z: -0.02 },
    rightFoot: { x: -0.08, y: 0, z: 0.02 },
  };
}

function resetPose(pose: PlayerPose): void {
  pose.rootY = 0;
  pose.bodyYaw = 0;
  pose.shadowScale = 1;
  pose.shadowOpacity = 0.2;
  pose.torsoY = 0;
  pose.torsoPitch = 0.02;
  pose.torsoYaw = 0;
  pose.torsoRoll = 0;
  pose.headY = BASE_HEAD_Y;
  pose.headPitch = 0;
  pose.headRoll = 0;
  assignRotation(pose.leftArm, 0.15, 0.05, 0.18);
  assignRotation(pose.leftForeArm, -0.22, 0, 0.06);
  assignRotation(pose.rightArm, 0.15, -0.05, -0.18);
  assignRotation(pose.rightForeArm, -0.22, 0, -0.06);
  assignRotation(pose.leftHand, -0.1, 0.02, 0.05);
  assignRotation(pose.rightHand, -0.1, -0.02, -0.05);
  assignRotation(pose.leftLeg, 0, 0, 0.04);
  assignRotation(pose.rightLeg, 0, 0, -0.04);
  assignRotation(pose.leftShin, 0.14, 0, 0);
  assignRotation(pose.rightShin, 0.14, 0, 0);
  assignRotation(pose.leftFoot, -0.08, 0, -0.02);
  assignRotation(pose.rightFoot, -0.08, 0, 0.02);
}

/**
 * Forward-run leg chain: a classic jog cycle with knee lift, toe-off, and heel-strike.
 */
function applyRunLegChain(
  thigh: LimbRotation,
  shin: LimbRotation,
  foot: LimbRotation,
  phase: number,
  speed: number,
  sideSign: number,
  lateralLean: number,
): void {
  const swing = phase;
  const strideAmp = speed * 0.62;
  const thighX = swing * strideAmp;

  const kneeBase = 0.1;
  const kneeLiftFwd = Math.max(0, swing) * speed * 0.15;
  const kneeLiftBack = Math.max(0, -swing) * speed * 0.38;
  const passingLift = (1 - swing * swing) * speed * 0.16;
  const kneeX = kneeBase + kneeLiftFwd + kneeLiftBack + passingLift;

  const heelStrike = Math.max(0, swing) * speed * 0.08;
  const toeOff = Math.max(0, -swing) * speed * 0.18;
  const footX = -kneeX * 0.38 + heelStrike - toeOff;

  const thighZ = sideSign * 0.048 - lateralLean * 0.08;
  const footZ = sideSign * -0.016;

  assignRotation(thigh, thighX, 0, thighZ);
  assignRotation(shin, kneeX, 0, 0);
  assignRotation(foot, footX, 0, footZ);
}

/**
 * Basketball lateral shuffle: wide-stance push-pull with staccato hops.
 * Lead foot steps out, trailing foot snaps under hips, low center of gravity.
 * `moveDir` = +1 moving right, -1 moving left.
 */
function applyShuffleLegChain(
  thigh: LimbRotation,
  shin: LimbRotation,
  foot: LimbRotation,
  phase: number,
  speed: number,
  sideSign: number,
  moveDir: number,
): void {
  const isLead = (sideSign * moveDir) > 0;

  const absSin = Math.abs(phase);
  const absCos = Math.abs(Math.cos(Math.asin(phase)));

  let thighX: number;
  let thighZ: number;
  let kneeX: number;
  let footX: number;
  let footZ: number;

  if (isLead) {
    thighX = 0.06 + absSin * speed * 0.08;
    thighZ = sideSign * (0.14 + absSin * speed * 0.22);
    kneeX = 0.18 + absSin * speed * 0.14;
    footX = -0.08 - absCos * speed * 0.04;
    footZ = sideSign * -0.05;
  } else {
    const snapUp = Math.max(0, phase) * speed;
    thighX = 0.08 + snapUp * 0.12;
    thighZ = sideSign * (0.06 + snapUp * 0.1);
    kneeX = 0.22 + snapUp * 0.26;
    footX = -0.1 - snapUp * 0.06;
    footZ = sideSign * -0.02;
  }

  assignRotation(thigh, thighX, 0, thighZ);
  assignRotation(shin, kneeX, 0, 0);
  assignRotation(foot, footX, 0, footZ);
}

function applyLocomotion(pose: PlayerPose, snapshot: GameRenderState, elapsedTime: number): void {
  const speed = clamp(snapshot.playerSpeed, 0, 1);
  const velocityX = snapshot.playerVelocity[0];
  const velocityZ = snapshot.playerVelocity[2];
  const absVx = Math.abs(velocityX);
  const absVz = Math.abs(velocityZ);
  const totalV = absVx + absVz + 0.001;

  const lateralRatio = clamp(absVx / totalV, 0, 1);
  const shuffleBlend = clamp(lateralRatio * 1.5 - 0.15, 0, 1) * clamp(speed * 5, 0, 1);

  const runFreq = 2.5 + speed * 6.4;
  const shuffleFreq = 3.0 + speed * 7.8;
  const freq = lerp(runFreq, shuffleFreq, shuffleBlend);
  const cycle = elapsedTime * freq;
  const stride = Math.sin(cycle);
  const counterStride = Math.sin(cycle + Math.PI);

  const runBounce = Math.abs(stride) * 0.05 * speed;
  const shuffleBounce = (0.5 + 0.5 * Math.cos(cycle * 2)) * 0.03 * speed;
  const bounce = lerp(runBounce, shuffleBounce, shuffleBlend);

  const breathe = Math.sin(elapsedTime * 1.7) * (speed < 0.08 ? 0.014 : 0.004);

  const lateralLean = clamp(velocityX * 0.06, -0.18, 0.18);
  const forwardLean = clamp(-velocityZ * 0.018 + speed * 0.05, -0.04, 0.12);
  const shuffleCrouch = shuffleBlend * speed * 0.025;
  const sway = Math.sin(cycle * 0.5) * 0.02 * speed;

  pose.rootY = bounce + breathe - shuffleCrouch;
  pose.torsoY = bounce * 0.4 + breathe * 0.25 - shuffleCrouch * 0.6;
  pose.bodyYaw = lerp(lateralLean * 0.55, lateralLean * 0.2, shuffleBlend);
  pose.torsoPitch = 0.03 + forwardLean + shuffleBlend * 0.06 * speed;
  pose.torsoYaw = -lateralLean * 0.15;
  pose.torsoRoll = lerp(-lateralLean * 0.7, -lateralLean * 1.1, shuffleBlend) + sway;
  pose.headY = BASE_HEAD_Y + bounce * 0.16 + breathe * 0.72 - shuffleCrouch * 0.4;
  pose.headPitch = -forwardLean * 0.3 + Math.sin(elapsedTime * 0.6) * 0.02 * (1 - speed);
  pose.headRoll = -pose.torsoRoll * 0.2;

  assignRotation(pose.leftArm, 0.16 - stride * 0.44 * speed, 0.05, 0.22);
  assignRotation(pose.leftForeArm, -0.22 + counterStride * 0.1 * speed, 0, 0.08);
  assignRotation(pose.rightArm, 0.16 - counterStride * 0.44 * speed, -0.05, -0.22);
  assignRotation(pose.rightForeArm, -0.22 + stride * 0.1 * speed, 0, -0.08);

  const moveDir = velocityX > 0 ? 1 : -1;

  applyRunLegChain(_scratchA[0], _scratchA[1], _scratchA[2], counterStride, speed, 1, lateralLean);
  applyRunLegChain(_scratchA[3], _scratchA[4], _scratchA[5], stride, speed, -1, lateralLean);
  applyShuffleLegChain(_scratchB[0], _scratchB[1], _scratchB[2], counterStride, speed, 1, moveDir);
  applyShuffleLegChain(_scratchB[3], _scratchB[4], _scratchB[5], stride, speed, -1, moveDir);

  const sb = shuffleBlend;
  const rb = 1 - sb;
  assignRotation(
    pose.leftLeg,
    _scratchA[0].x * rb + _scratchB[0].x * sb,
    _scratchA[0].y * rb + _scratchB[0].y * sb,
    _scratchA[0].z * rb + _scratchB[0].z * sb,
  );
  assignRotation(
    pose.leftShin,
    _scratchA[1].x * rb + _scratchB[1].x * sb,
    _scratchA[1].y * rb + _scratchB[1].y * sb,
    _scratchA[1].z * rb + _scratchB[1].z * sb,
  );
  assignRotation(
    pose.leftFoot,
    _scratchA[2].x * rb + _scratchB[2].x * sb,
    _scratchA[2].y * rb + _scratchB[2].y * sb,
    _scratchA[2].z * rb + _scratchB[2].z * sb,
  );
  assignRotation(
    pose.rightLeg,
    _scratchA[3].x * rb + _scratchB[3].x * sb,
    _scratchA[3].y * rb + _scratchB[3].y * sb,
    _scratchA[3].z * rb + _scratchB[3].z * sb,
  );
  assignRotation(
    pose.rightShin,
    _scratchA[4].x * rb + _scratchB[4].x * sb,
    _scratchA[4].y * rb + _scratchB[4].y * sb,
    _scratchA[4].z * rb + _scratchB[4].z * sb,
  );
  assignRotation(
    pose.rightFoot,
    _scratchA[5].x * rb + _scratchB[5].x * sb,
    _scratchA[5].y * rb + _scratchB[5].y * sb,
    _scratchA[5].z * rb + _scratchB[5].z * sb,
  );
}

function applyDribbleOverlay(pose: PlayerPose, snapshot: GameRenderState, alpha: number): void {
  if (alpha <= 0) return;

  const state = snapshot.ballState;
  if (!isHeldBallState(state) && !isDribbleBallState(state) && !isCrossoverBallState(state)) {
    return;
  }

  const side = clamp(snapshot.ballSide, -1, 1);
  const ballHeight = clamp(snapshot.ballLocalPosition[1], 0.16, 0.95);
  const heightProgress = getDribbleBallHeightProgress(ballHeight);

  let handlePose: BallHandlePose;

  if (state === 'CROSSOVER_R2L' || state === 'CROSSOVER_L2R') {
    const crossProgress = smoothstep(snapshot.ballStateProgress);
    // Ball states are screen-space; authored poses are rig/anatomical.
    handlePose = sampleCrossoverPose(
      state === 'CROSSOVER_R2L' ? 'left-to-right' : 'right-to-left',
      crossProgress,
    );
  } else {
    const dribbleProgress = isHeldBallState(state) ? 1 : heightProgress;
    handlePose = sampleDribblePose(side >= 0 ? 'left' : 'right', dribbleProgress);
  }

  const poseAlpha = isHeldBallState(state) ? alpha * 0.92 : alpha;
  applyBallHandleArmPose(pose, handlePose, poseAlpha);
}

function applyGatherOverlay(pose: PlayerPose, snapshot: GameRenderState, alpha: number): void {
  if (alpha <= 0) return;

  const charge = clamp(snapshot.shotCharge, 0, 1);
  const crouch = clamp(charge / 0.34, 0, 1);
  const rise = clamp((charge - 0.34) / 0.66, 0, 1);
  const pocket = clamp((charge - 0.12) / 0.88, 0, 1);

  pose.rootY = lerp(pose.rootY, -0.05 * crouch + 0.02 * rise, alpha);
  pose.torsoY = lerp(pose.torsoY, -0.11 * crouch + 0.05 * rise, alpha);
  pose.torsoPitch = lerp(pose.torsoPitch, -0.08 * crouch + 0.05 * rise, alpha);
  pose.torsoRoll = lerp(pose.torsoRoll, -0.05, alpha);
  pose.torsoYaw = lerp(pose.torsoYaw, 0.04, alpha);
  pose.bodyYaw = lerp(pose.bodyYaw, 0.06, alpha);
  pose.headY = lerp(pose.headY, BASE_HEAD_Y - 0.04 - 0.03 * crouch + 0.03 * rise, alpha);
  pose.headPitch = lerp(pose.headPitch, -0.05 + pocket * 0.02, alpha);
  blendRotation(pose.leftLeg, 0.16 + crouch * 0.22 - rise * 0.08, 0, 0.05, alpha);
  blendRotation(pose.rightLeg, 0.16 + crouch * 0.22 - rise * 0.08, 0, -0.05, alpha);
  blendRotation(pose.leftShin, 0.28 + crouch * 0.32 - rise * 0.12, 0, 0, alpha);
  blendRotation(pose.rightShin, 0.28 + crouch * 0.32 - rise * 0.12, 0, 0, alpha);
  blendRotation(pose.leftFoot, -0.14 - crouch * 0.06 + rise * 0.04, 0, -0.02, alpha);
  blendRotation(pose.rightFoot, -0.14 - crouch * 0.06 + rise * 0.04, 0, 0.02, alpha);

  blendRotation(pose.rightArm, -0.74 - pocket * 0.58, -0.08, -0.16, alpha);
  blendRotation(pose.rightForeArm, -0.76 - pocket * 0.36, 0, 0.02, alpha);
  blendRotation(pose.leftArm, -0.58 - pocket * 0.2, 0.18, 0.34, alpha);
  blendRotation(pose.leftForeArm, -0.58 - pocket * 0.12, 0, 0.16, alpha);
}

function applyShootOverlay(pose: PlayerPose, snapshot: GameRenderState, alpha: number): void {
  if (alpha <= 0) return;

  const charge = clamp(snapshot.shotCharge, 0, 1);
  const isFollowThrough = snapshot.ballState === 'FOLLOW_THROUGH';
  const progressBase = isFollowThrough ? 0.52 + snapshot.ballStateProgress * 0.48 : snapshot.ballStateProgress * 0.52;
  const extend = clamp((progressBase - 0.18) / 0.82, 0, 1);
  const settle = clamp((progressBase - 0.62) / 0.38, 0, 1);
  const lift = Math.sin(progressBase * Math.PI) * (0.035 + charge * 0.04);

  pose.rootY = lerp(pose.rootY, 0.004 + lift, alpha);
  pose.torsoY = lerp(pose.torsoY, 0.04 + progressBase * 0.1 + lift * 0.34, alpha);
  pose.torsoPitch = lerp(pose.torsoPitch, -0.01 + extend * 0.08, alpha);
  pose.torsoYaw = lerp(pose.torsoYaw, 0.04, alpha);
  pose.torsoRoll = lerp(pose.torsoRoll, -0.05 + settle * 0.02, alpha);
  pose.bodyYaw = lerp(pose.bodyYaw, 0.05, alpha);
  pose.headY = lerp(pose.headY, BASE_HEAD_Y + progressBase * 0.05 + lift * 0.22, alpha);
  pose.headPitch = lerp(pose.headPitch, -0.08 - extend * 0.04, alpha);
  blendRotation(pose.leftLeg, 0.12 - extend * 0.18, 0, 0.04, alpha);
  blendRotation(pose.rightLeg, 0.12 - extend * 0.18, 0, -0.04, alpha);
  blendRotation(pose.leftShin, 0.26 - extend * 0.18, 0, 0, alpha);
  blendRotation(pose.rightShin, 0.26 - extend * 0.18, 0, 0, alpha);
  blendRotation(pose.leftFoot, -0.1 + extend * 0.08, 0, -0.02, alpha);
  blendRotation(pose.rightFoot, -0.1 + extend * 0.08, 0, 0.02, alpha);

  blendRotation(pose.rightArm, -1.12 - extend * 0.58, -0.06, -0.16 + extend * 0.08, alpha);
  blendRotation(pose.rightForeArm, -1.04 + extend * 1.5, 0, 0.06, alpha);
  blendRotation(pose.leftArm, -0.72 + extend * 0.22, 0.22, 0.34 - extend * 0.08, alpha);
  blendRotation(pose.leftForeArm, -0.58 + extend * 0.22, 0, 0.16, alpha);
}

function getShotPhaseProgress(snapshot: GameRenderState): number | null {
  const state = snapshot.ballState;

  if (snapshot.ballInFlight) {
    return 1;
  }

  if (state === 'GATHER_LOW' || state === 'GATHER_HIGH') {
    return clamp(snapshot.shotCharge, 0, 1) * SHOT_GATHER_END_PROGRESS;
  }

  if (state === 'SHOOTING') {
    return lerp(
      SHOT_GATHER_END_PROGRESS,
      SHOT_RELEASE_END_PROGRESS,
      smoothstep(snapshot.ballStateProgress),
    );
  }

  if (state === 'FOLLOW_THROUGH') {
    return lerp(SHOT_RELEASE_END_PROGRESS, 1, smoothstep(snapshot.ballStateProgress));
  }

  return null;
}

function applyShotPhaseArmPose(pose: PlayerPose, snapshot: GameRenderState): boolean {
  const progress = getShotPhaseProgress(snapshot);
  if (progress === null) return false;

  const phase = sampleShotPhase(progress);
  const alpha = snapshot.ballInFlight
    ? 1
    : clamp(snapshot.gatherAlpha + snapshot.releaseAlpha + snapshot.followThroughAlpha, 0, 1);

  // PoseMirror stores the artist-facing "right" shot arm on the rig's left side.
  blendRotation(
    pose.leftArm,
    phase.angles.right.shoulderX,
    phase.angles.right.shoulderY,
    phase.angles.right.shoulderZ,
    alpha,
  );
  blendRotation(
    pose.leftForeArm,
    phase.angles.right.elbowX,
    phase.angles.right.elbowY,
    phase.angles.right.elbowZ,
    alpha,
  );
  blendRotation(
    pose.leftHand,
    phase.angles.right.wristX,
    phase.angles.right.wristY,
    phase.angles.right.wristZ,
    alpha,
  );
  blendRotation(
    pose.rightArm,
    phase.angles.left.shoulderX,
    phase.angles.left.shoulderY,
    phase.angles.left.shoulderZ,
    alpha,
  );
  blendRotation(
    pose.rightForeArm,
    phase.angles.left.elbowX,
    phase.angles.left.elbowY,
    phase.angles.left.elbowZ,
    alpha,
  );
  blendRotation(
    pose.rightHand,
    phase.angles.left.wristX,
    phase.angles.left.wristY,
    phase.angles.left.wristZ,
    alpha,
  );

  return true;
}

function applyProceduralIK(pose: PlayerPose, snapshot: GameRenderState): void {
  if (snapshot.ballInFlight || snapshot.ballState === 'FOLLOW_THROUGH') return;

  const totalGatherShootAlpha = clamp(snapshot.gatherAlpha + snapshot.releaseAlpha, 0, 1);
  if (totalGatherShootAlpha < 0.1) return;

  const by = snapshot.ballLocalPosition[1];
  const bz = snapshot.ballLocalPosition[2];

  const idealPitch = clamp((by - 1.26) * 0.38, -0.5, 0.3);
  const idealYaw = clamp((bz) * -0.2, -0.2, 0.2);

  const ikShoot = totalGatherShootAlpha * 0.64;
  const ikGuide = totalGatherShootAlpha * GUIDE_HAND_IK_BLEND;
  blendRotation(pose.rightArm, pose.rightArm.x + idealPitch, pose.rightArm.y + idealYaw, pose.rightArm.z, ikShoot);
  blendRotation(
    pose.leftArm,
    pose.leftArm.x + idealPitch * GUIDE_HAND_IK_PITCH_MUL,
    pose.leftArm.y - idealYaw * GUIDE_HAND_IK_YAW_MUL,
    pose.leftArm.z,
    ikGuide,
  );
}

/**
 * Wrist / hand blobs: cup during gather, coil in SHOOTING, sharp flick at FOLLOW_THROUGH start (when ball launches).
 */
function applyHandWrists(pose: PlayerPose, snapshot: GameRenderState): void {
  const gather = snapshot.gatherAlpha;
  const state = snapshot.ballState;
  const progress = snapshot.ballStateProgress;

  const cupExtraLx = -0.24 * gather;
  const cupExtraRx = -0.42 * gather;
  const cupLyz = gather * 0.05;
  const cupRyz = gather * 0.07;

  let coilR = 0;
  let coilL = 0;
  if (state === 'SHOOTING') {
    coilR = progress * -0.58;
    coilL = progress * -0.08;
  }

  let flickR = 0;
  let flickL = 0;
  let followHoldR = 0;
  let followHoldL = 0;
  if (state === 'FOLLOW_THROUGH') {
    const envelope = Math.pow(Math.max(0, 1 - progress * 2.8), 1.45);
    flickR = envelope * 1.42;
    flickL = envelope * 0.2;
    const hold = 0.54 * (1 - progress * 0.18);
    followHoldR = hold;
    followHoldL = hold * 0.3;
  }

  const inShotMotion =
    state === 'GATHER_LOW' || state === 'GATHER_HIGH' || state === 'SHOOTING' || state === 'FOLLOW_THROUGH';
  const dribbleWrist = inShotMotion ? 0 : snapshot.crossoverAlpha * 0.1;

  pose.leftHand.x += cupExtraLx + coilL + flickL * 0.8 + followHoldL - dribbleWrist;
  pose.leftHand.y += cupLyz + snapshot.releaseAlpha * 0.03 + snapshot.followThroughAlpha * 0.05;
  pose.leftHand.z += cupLyz * 0.7 + flickL * 0.16 + followHoldL * 0.14;

  pose.rightHand.x += cupExtraRx + coilR + flickR * 0.98 + followHoldR - dribbleWrist;
  pose.rightHand.y -= cupRyz + snapshot.releaseAlpha * 0.02;
  pose.rightHand.z -= cupRyz * 0.7 - flickR * 0.34 - followHoldR * 0.2;
}

// ---------------------------------------------------------------------------
// Direct-drive body tracking overlay
// ---------------------------------------------------------------------------

const CONFIDENCE_RAMP_DOWN_FRAMES = 6;
const CONFIDENCE_RAMP_UP_FRAMES = 10;
const POSITION_JUMP_THRESHOLD = 0.5;
const POSITION_JUMP_INTERP_FRAMES = 15;

interface DirectDriveState {
  alpha: number;
  lastWristL: { x: number; y: number; z: number } | null;
  lastWristR: { x: number; y: number; z: number } | null;
  interpFramesLeft: number;
  interpTargetL: { x: number; y: number; z: number } | null;
  interpTargetR: { x: number; y: number; z: number } | null;
  lastIKLeft: IKResult | null;
  lastIKRight: IKResult | null;
}

const _ddState: DirectDriveState = {
  alpha: 0,
  lastWristL: null,
  lastWristR: null,
  interpFramesLeft: 0,
  interpTargetL: null,
  interpTargetR: null,
  lastIKLeft: null,
  lastIKRight: null,
};

function vec3Dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function lerpVec3(
  out: { x: number; y: number; z: number },
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number,
): void {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
}

const _interpWristL = { x: 0, y: 0, z: 0 };
const _interpWristR = { x: 0, y: 0, z: 0 };

/**
 * ANIMATION OVERLAY PIPELINE (ORDER MATTERS)
 * =============================================
 * Layer 0: resetPose()              <- default A-pose
 * Layer 1: applyLocomotion()        <- legs + torso (always runs)
 * Layer 2: applyDirectDriveOverlay()<- arms from IK (webcam only, alpha from confidence)
 * Layer 3: applyDribbleOverlay()    <- arms toward dribble keyframes (overrides Layer 2)
 * Layer 4: applyGatherOverlay()     <- crouch + arms (overrides Layers 2-3)
 * Layer 5: applyShootOverlay()      <- full body extension (overrides Layers 2-4)
 * Layer 6: applyShotPhaseArmPose()  <- authored shot arm data (overrides all arm layers)
 * Layer 7: applyProceduralIK()      <- IK nudge fallback (skipped if Layer 2 active)
 * Layer 8: applyHandWrists()        <- wrist curl (additive)
 *
 * Later layers override earlier ones via alpha-based lerp.
 * Moving any layer changes priority behavior.
 */
function applyDirectDriveOverlay(
  pose: PlayerPose,
  bodyInput: BodyInputFrame | null,
): void {
  if (!bodyInput || bodyInput.source === 'keyboard') {
    _ddState.alpha = Math.max(0, _ddState.alpha - 1 / CONFIDENCE_RAMP_DOWN_FRAMES);
    if (_ddState.alpha <= 0) return;
    if (_ddState.lastIKLeft && _ddState.lastIKRight) {
      blendRotation(pose.leftArm, _ddState.lastIKLeft.shoulderRot.x, _ddState.lastIKLeft.shoulderRot.y, _ddState.lastIKLeft.shoulderRot.z, _ddState.alpha);
      blendRotation(pose.leftForeArm, _ddState.lastIKLeft.forearmRot.x, _ddState.lastIKLeft.forearmRot.y, _ddState.lastIKLeft.forearmRot.z, _ddState.alpha);
      blendRotation(pose.rightArm, _ddState.lastIKRight.shoulderRot.x, _ddState.lastIKRight.shoulderRot.y, _ddState.lastIKRight.shoulderRot.z, _ddState.alpha);
      blendRotation(pose.rightForeArm, _ddState.lastIKRight.forearmRot.x, _ddState.lastIKRight.forearmRot.y, _ddState.lastIKRight.forearmRot.z, _ddState.alpha);
    }
    return;
  }

  const targetAlpha = bodyInput.confidence >= 0.5 ? 1 : 0;
  if (targetAlpha > _ddState.alpha) {
    _ddState.alpha = Math.min(1, _ddState.alpha + 1 / CONFIDENCE_RAMP_UP_FRAMES);
  } else {
    _ddState.alpha = Math.max(0, _ddState.alpha - 1 / CONFIDENCE_RAMP_DOWN_FRAMES);
  }

  if (_ddState.alpha <= 0) return;

  let wristL = bodyInput.wristL;
  let wristR = bodyInput.wristR;

  if (_ddState.lastWristL && vec3Dist(wristL, _ddState.lastWristL) > POSITION_JUMP_THRESHOLD) {
    _ddState.interpFramesLeft = POSITION_JUMP_INTERP_FRAMES;
    _ddState.interpTargetL = { ...wristL };
    _ddState.interpTargetR = { ...wristR };
  }

  if (_ddState.interpFramesLeft > 0 && _ddState.interpTargetL && _ddState.interpTargetR && _ddState.lastWristL && _ddState.lastWristR) {
    const t = 1 - _ddState.interpFramesLeft / POSITION_JUMP_INTERP_FRAMES;
    lerpVec3(_interpWristL, _ddState.lastWristL, _ddState.interpTargetL, t);
    lerpVec3(_interpWristR, _ddState.lastWristR, _ddState.interpTargetR, t);
    wristL = _interpWristL;
    wristR = _interpWristR;
    _ddState.interpFramesLeft--;
  }

  _ddState.lastWristL = { x: wristL.x, y: wristL.y, z: wristL.z };
  _ddState.lastWristR = { x: wristR.x, y: wristR.y, z: wristR.z };

  const shoulderLPos = { x: -SHOULDER_X, y: SHOULDER_Y, z: 0 };
  const shoulderRPos = { x: SHOULDER_X, y: SHOULDER_Y, z: 0 };

  const ikLeft = solveTwoBoneIK(
    shoulderLPos, wristL, bodyInput.elbowL,
    UPPER_ARM_LEN, FOREARM_LEN, true,
  );
  const ikRight = solveTwoBoneIK(
    shoulderRPos, wristR, bodyInput.elbowR,
    UPPER_ARM_LEN, FOREARM_LEN, false,
  );

  _ddState.lastIKLeft = cloneIKResult(ikLeft);
  _ddState.lastIKRight = cloneIKResult(ikRight);

  const a = _ddState.alpha;
  blendRotation(pose.leftArm, ikLeft.shoulderRot.x, ikLeft.shoulderRot.y, ikLeft.shoulderRot.z, a);
  blendRotation(pose.leftForeArm, ikLeft.forearmRot.x, ikLeft.forearmRot.y, ikLeft.forearmRot.z, a);
  blendRotation(pose.rightArm, ikRight.shoulderRot.x, ikRight.shoulderRot.y, ikRight.shoulderRot.z, a);
  blendRotation(pose.rightForeArm, ikRight.forearmRot.x, ikRight.forearmRot.y, ikRight.forearmRot.z, a);
}

export function solvePlayerPose(
  pose: PlayerPose,
  snapshot: GameRenderState,
  elapsedTime: number,
  bodyInput?: BodyInputFrame | null,
): void {
  resetPose(pose);
  
  applyLocomotion(pose, snapshot, elapsedTime);

  applyDirectDriveOverlay(pose, bodyInput ?? null);

  const isBallHandleState =
    isHeldBallState(snapshot.ballState) ||
    isDribbleBallState(snapshot.ballState) ||
    isCrossoverBallState(snapshot.ballState);

  const dribbleAlpha = snapshot.ballInFlight || !isBallHandleState ? 0 : 1;
  
  applyDribbleOverlay(pose, snapshot, dribbleAlpha);
  applyGatherOverlay(pose, snapshot, snapshot.gatherAlpha);
  applyShootOverlay(pose, snapshot, snapshot.releaseAlpha);
  const hasSavedShotPose = applyShotPhaseArmPose(pose, snapshot);
  if (!hasSavedShotPose) {
    if (!bodyInput || bodyInput.source === 'keyboard' || _ddState.alpha < 0.1) {
      applyProceduralIK(pose, snapshot);
    }
    applyHandWrists(pose, snapshot);
  }
}
