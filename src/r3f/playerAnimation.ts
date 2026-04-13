import type { GameRenderState } from '../engine/GameRuntime';

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
}

/**
 * Shooting is always a right-handed motion: right arm = release, left = light guide.
 * (Ball attach in `shootBallAttach` is already right-biased in +X.)
 */
const GUIDE_HAND_IK_BLEND = 0.34;
const GUIDE_HAND_IK_PITCH_MUL = 0.42;
const GUIDE_HAND_IK_YAW_MUL = 0.26;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
    headY: 1.58,
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
  pose.headY = 1.58;
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
}

function applyLocomotion(pose: PlayerPose, snapshot: GameRenderState, elapsedTime: number): void {
  const speed = clamp(snapshot.playerSpeed, 0, 1);
  const velocityX = snapshot.playerVelocity[0];
  const velocityZ = snapshot.playerVelocity[2];
  const cycle = elapsedTime * (2.5 + speed * 6.4);
  const stride = Math.sin(cycle);
  const counterStride = Math.sin(cycle + Math.PI);
  const bounce = Math.abs(stride) * 0.05 * speed;
  const breathe = Math.sin(elapsedTime * 1.7) * (speed < 0.08 ? 0.014 : 0.004);
  const lateralLean = clamp(velocityX * 0.06, -0.18, 0.18);
  const forwardLean = clamp(-velocityZ * 0.018 + speed * 0.05, -0.04, 0.12);
  const sway = Math.sin(cycle * 0.5) * 0.02 * speed;

  pose.rootY = bounce + breathe;
  pose.torsoY = bounce * 0.4 + breathe * 0.25;
  pose.bodyYaw = lateralLean * 0.55;
  pose.torsoPitch = 0.03 + forwardLean;
  pose.torsoYaw = -lateralLean * 0.15;
  pose.torsoRoll = -lateralLean * 0.7 + sway;
  pose.headY = 1.58 + bounce * 0.18 + breathe * 0.75;
  pose.headPitch = -forwardLean * 0.3 + Math.sin(elapsedTime * 0.6) * 0.02 * (1 - speed);
  pose.headRoll = -pose.torsoRoll * 0.2;

  assignRotation(pose.leftArm, 0.14 - stride * 0.58 * speed, 0.04, 0.18);
  assignRotation(pose.leftForeArm, -0.24 + counterStride * 0.12 * speed, 0, 0.06);
  assignRotation(pose.rightArm, 0.14 - counterStride * 0.58 * speed, -0.04, -0.18);
  assignRotation(pose.rightForeArm, -0.24 + stride * 0.12 * speed, 0, -0.06);
  assignRotation(pose.leftLeg, counterStride * 0.7 * speed, 0, 0.05 - lateralLean * 0.12);
  assignRotation(pose.rightLeg, stride * 0.7 * speed, 0, -0.05 - lateralLean * 0.12);
}

function applyDribbleOverlay(pose: PlayerPose, snapshot: GameRenderState, alpha: number): void {
  if (alpha <= 0) return;

  const side = clamp(snapshot.ballSide, -1, 1);
  const ballHeight = clamp(snapshot.ballLocalPosition[1], 0.16, 0.95);
  const lowCompression = 1 - clamp((ballHeight - 0.18) / 0.64, 0, 1);
  const moveLean = clamp(snapshot.playerVelocity[0] * 0.03, -0.08, 0.08);

  pose.rootY = lerp(pose.rootY, -0.035 + lowCompression * 0.015, alpha);
  pose.torsoY = lerp(pose.torsoY, -0.03 + lowCompression * 0.02, alpha);
  pose.torsoPitch = lerp(pose.torsoPitch, 0.14 + lowCompression * 0.08, alpha);
  pose.torsoRoll = lerp(pose.torsoRoll, -side * (0.08 + lowCompression * 0.06) + moveLean, alpha);
  pose.torsoYaw = lerp(pose.torsoYaw, side * 0.05, alpha);
  pose.bodyYaw = lerp(pose.bodyYaw, side * 0.06 + moveLean * 0.8, alpha);
  pose.headY = lerp(pose.headY, 1.55 - lowCompression * 0.04, alpha);
  pose.headPitch = lerp(pose.headPitch, -0.04, alpha);
  pose.shadowScale = lerp(pose.shadowScale, 1.04, alpha);
  pose.shadowOpacity = lerp(pose.shadowOpacity, 0.22, alpha);

  const cross = snapshot.crossoverAlpha;
  const dribbleArmX = lerp(-0.35 - lowCompression * 0.82, -0.1, cross);
  const dribbleArmZ = lerp(-0.32, -0.1, cross);

  if (side > 0) {
    blendRotation(pose.rightArm, dribbleArmX, -0.1, dribbleArmZ, alpha);
    blendRotation(pose.rightForeArm, -0.4 - lowCompression * 0.78, 0, -0.12, alpha);
    blendRotation(pose.leftArm, 0.02, 0.06, 0.24, alpha);
    blendRotation(pose.leftForeArm, -0.32, 0, 0.08, alpha);
  } else {
    blendRotation(pose.leftArm, dribbleArmX, 0.1, -dribbleArmZ, alpha);
    blendRotation(pose.leftForeArm, -0.4 - lowCompression * 0.78, 0, 0.12, alpha);
    blendRotation(pose.rightArm, 0.02, -0.06, -0.24, alpha);
    blendRotation(pose.rightForeArm, -0.32, 0, -0.08, alpha);
  }
}

function applyGatherOverlay(pose: PlayerPose, snapshot: GameRenderState, alpha: number): void {
  if (alpha <= 0) return;

  const charge = clamp(snapshot.shotCharge, 0, 1);
  const crouch = clamp(charge / 0.34, 0, 1);
  const rise = clamp((charge - 0.34) / 0.66, 0, 1);

  pose.rootY = lerp(pose.rootY, -0.03 * crouch + 0.03 * rise, alpha);
  pose.torsoY = lerp(pose.torsoY, -0.12 * crouch + 0.08 * rise, alpha);
  pose.torsoPitch = lerp(pose.torsoPitch, -0.2 * crouch + 0.12 * rise, alpha);
  pose.torsoRoll = lerp(pose.torsoRoll, -0.03, alpha);
  pose.torsoYaw = lerp(pose.torsoYaw, 0.02, alpha);
  pose.bodyYaw = lerp(pose.bodyYaw, 0.04, alpha);
  pose.headY = lerp(pose.headY, 1.53 - 0.07 * crouch + 0.06 * rise, alpha);
  pose.headPitch = lerp(pose.headPitch, -0.08 * crouch, alpha);

  blendRotation(pose.rightArm, -0.82 - rise * 0.82, -0.08, -0.06, alpha);
  blendRotation(pose.rightForeArm, -0.55 - rise * 0.72, 0, 0, alpha);
  /* Guide hand: less flex / lift so the right arm clearly leads the gather */
  blendRotation(pose.leftArm, -0.48 - rise * 0.38, 0.1, 0.22, alpha);
  blendRotation(pose.leftForeArm, -0.52 - rise * 0.38, 0, 0.08, alpha);
}

function applyShootOverlay(pose: PlayerPose, snapshot: GameRenderState, alpha: number): void {
  if (alpha <= 0) return;

  const charge = clamp(snapshot.shotCharge, 0, 1);
  const isFollowThrough = snapshot.ballState === 'FOLLOW_THROUGH';
  const progressBase = isFollowThrough ? 0.52 + snapshot.ballStateProgress * 0.48 : snapshot.ballStateProgress * 0.52;
  const lift = Math.sin(progressBase * Math.PI) * (0.035 + charge * 0.04);

  pose.rootY = lerp(pose.rootY, 0.01 + lift, alpha);
  pose.torsoY = lerp(pose.torsoY, 0.05 + progressBase * 0.12 + lift * 0.4, alpha);
  pose.torsoPitch = lerp(pose.torsoPitch, 0.08 + progressBase * 0.08, alpha);
  pose.torsoYaw = lerp(pose.torsoYaw, 0.02, alpha);
  pose.torsoRoll = lerp(pose.torsoRoll, -0.02, alpha);
  pose.bodyYaw = lerp(pose.bodyYaw, 0.03, alpha);
  pose.headY = lerp(pose.headY, 1.59 + progressBase * 0.08 + lift * 0.25, alpha);
  pose.headPitch = lerp(pose.headPitch, -0.12 - progressBase * 0.05, alpha);

  /* Longer mesh arms: slightly less extreme flex so release reads tall / extended */
  blendRotation(pose.rightArm, -1.36 - progressBase * 0.26, -0.03, -0.04, alpha);
  blendRotation(pose.rightForeArm, -0.94 + progressBase * 1.22, 0, 0.02, alpha);
  blendRotation(pose.leftArm, -0.58 + progressBase * 0.12, 0.06, 0.2, alpha);
  blendRotation(pose.leftForeArm, -0.4 + progressBase * 0.28, 0, 0.06, alpha);
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

  const cupExtraLx = -0.22 * gather;
  const cupExtraRx = -0.38 * gather;
  const cupLyz = gather * 0.04;
  const cupRyz = gather * 0.06;

  let coilR = 0;
  let coilL = 0;
  if (state === 'SHOOTING') {
    coilR = progress * -0.42;
    coilL = progress * -0.09;
  }

  let flickR = 0;
  let flickL = 0;
  let followHoldR = 0;
  let followHoldL = 0;
  if (state === 'FOLLOW_THROUGH') {
    const envelope = Math.pow(Math.max(0, 1 - progress * 2.8), 1.45);
    flickR = envelope * 1.18;
    flickL = envelope * 0.16;
    const hold = 0.42 * (1 - progress * 0.22);
    followHoldR = hold;
    followHoldL = hold * 0.22;
  }

  const inShotMotion =
    state === 'GATHER_LOW' || state === 'GATHER_HIGH' || state === 'SHOOTING' || state === 'FOLLOW_THROUGH';
  const dribbleWrist = inShotMotion ? 0 : snapshot.crossoverAlpha * 0.1;

  pose.leftHand.x += cupExtraLx + coilL + flickL * 0.85 + followHoldL - dribbleWrist;
  pose.leftHand.y += cupLyz;
  pose.leftHand.z += cupLyz * 0.6 + flickL * 0.12 + followHoldL * 0.08;

  pose.rightHand.x += cupExtraRx + coilR + flickR * 0.95 + followHoldR - dribbleWrist;
  pose.rightHand.y -= cupRyz;
  pose.rightHand.z -= cupRyz * 0.6 - flickR * 0.28 - followHoldR * 0.15;
}

export function solvePlayerPose(
  pose: PlayerPose,
  snapshot: GameRenderState,
  elapsedTime: number,
): void {
  resetPose(pose);
  
  applyLocomotion(pose, snapshot, elapsedTime);

  const dribbleAlpha = clamp(1.0 - snapshot.gatherAlpha - snapshot.releaseAlpha, 0, 1);
  
  applyDribbleOverlay(pose, snapshot, dribbleAlpha);
  applyGatherOverlay(pose, snapshot, snapshot.gatherAlpha);
  applyShootOverlay(pose, snapshot, snapshot.releaseAlpha);
  applyProceduralIK(pose, snapshot);
  applyHandWrists(pose, snapshot);
}
