import type { BallInput } from '../BallStateMachine';
import { SHOULDER_Y, SHOULDER_X } from '../../r3f/playerRig';

export interface Vec3 {
  x: number; y: number; z: number;
}

/**
 * Device-agnostic body input frame.
 *
 * Coordinate system: Origin at character root (feet on court surface).
 * Y-up, X-right (from character's perspective), Z-forward (toward hoop).
 * Units: meters.
 *
 * All position fields use plain {x,y,z} objects (not THREE.Vector3)
 * to avoid mutability/aliasing bugs when frames are stored in buffers.
 */
export interface BodyInputFrame {
  wristL: Vec3;
  wristR: Vec3;
  elbowL: Vec3;
  elbowR: Vec3;
  shoulderL: Vec3;
  shoulderR: Vec3;
  hipCenter: Vec3;

  playerX: number;
  playerZ: number;

  torsoLean: number;
  headTilt: Vec3;
  dominantHand: 'left' | 'right';

  intent: BallInput;

  confidence: number;

  source: 'webcam' | 'phone' | 'keyboard';
  timestamp: number;
}

// ── Keyboard adapter ────────────────────────────────────────────────

export interface KeyboardState {
  moveX: number;
  moveZ: number;
  dribblePressed: boolean;
  shootHeld: boolean;
  shootReleased: boolean;
  currentBallSide: number;
}

const DEFAULT_WRIST_Y = 0.9;
const SHOOT_WRIST_Y = 1.8;
const DRIBBLE_WRIST_Y = 0.3;
const HIP_Y = 0.95;

export function keyboardToBodyInputFrame(
  state: KeyboardState,
  timestamp: number,
): BodyInputFrame {
  const shoulderL: Vec3 = { x: -SHOULDER_X, y: SHOULDER_Y, z: 0 };
  const shoulderR: Vec3 = { x: SHOULDER_X, y: SHOULDER_Y, z: 0 };

  let wristY = DEFAULT_WRIST_Y;
  if (state.shootHeld) wristY = SHOOT_WRIST_Y;
  else if (state.dribblePressed) wristY = DRIBBLE_WRIST_Y;

  const dominantHand: 'left' | 'right' = state.currentBallSide >= 0 ? 'right' : 'left';
  const dominantX = dominantHand === 'right' ? SHOULDER_X : -SHOULDER_X;
  const offX = dominantHand === 'right' ? -SHOULDER_X : SHOULDER_X;

  const wristDominant: Vec3 = { x: dominantX, y: wristY, z: 0 };
  const wristOff: Vec3 = { x: offX, y: DEFAULT_WRIST_Y, z: 0 };

  const wristL = dominantHand === 'left' ? wristDominant : wristOff;
  const wristR = dominantHand === 'right' ? wristDominant : wristOff;

  const elbowL: Vec3 = {
    x: (shoulderL.x + wristL.x) / 2,
    y: (shoulderL.y + wristL.y) / 2,
    z: 0,
  };
  const elbowR: Vec3 = {
    x: (shoulderR.x + wristR.x) / 2,
    y: (shoulderR.y + wristR.y) / 2,
    z: 0,
  };

  const hipCenter: Vec3 = { x: 0, y: HIP_Y, z: 0 };

  const intent: BallInput = {
    velocityX: state.moveX * 1.5,
    velocityY: state.shootHeld ? -0.8 : state.dribblePressed ? 0.5 : 0,
    dribblePressed: state.dribblePressed,
    handSide: state.currentBallSide >= 0 ? 'right' : 'left',
    released: state.shootReleased,
    timeSinceStateEnter: 0,
  };

  return {
    wristL,
    wristR,
    elbowL,
    elbowR,
    shoulderL,
    shoulderR,
    hipCenter,
    playerX: 0,
    playerZ: 0,
    torsoLean: state.moveX,
    headTilt: { x: 0, y: 0, z: 0 },
    dominantHand,
    intent,
    confidence: 1.0,
    source: 'keyboard',
    timestamp,
  };
}
