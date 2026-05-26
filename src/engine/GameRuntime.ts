import { BallStateMachine } from './BallStateMachine';
import type { BallHandlingState, BallInput } from './BallStateMachine';
import { computeAttachedShootBallLocal } from './shootBallAttach';
import { ShotArc } from './ShotArc';
import {
  getShotMeterProgress,
  getShotReleaseQuality,
  isGreenRelease,
  SHOT_METER_SWEET_SPOT_START,
  SHOT_METER_SWEET_SPOT_TOP,
  type ShotReleaseQuality,
} from './shotTiming';
import type { BodyInputFrame } from './input/BodyInputFrame';

export interface RuntimeHandSample {
  hasHand: boolean;
  playerX: number;
  playerZ: number;
  velocity: { x: number; y: number };
  handedness: 'Left' | 'Right';
  released: boolean;
}

export interface RuntimeControls {
  webcamActive: boolean;
  hand: RuntimeHandSample;
  bodyInputFrame: BodyInputFrame | null;
  moveX: number;
  moveZ: number;
  dribblePressed: boolean;
  shootHeld: boolean;
  shootReleased: boolean;
}

export interface GameRenderState {
  playerPosition: [number, number, number];
  playerVelocity: [number, number, number];
  playerSpeed: number;
  ballPosition: [number, number, number];
  ballLocalPosition: [number, number, number];
  ballSpinRate: number;
  /** True while ShotArc owns the ball (in flight) */
  ballInFlight: boolean;
  
  // Continuous Alpha Parameters for Animation
  ballSide: number;
  dribblePhase: number;
  crossoverAlpha: number;
  gatherAlpha: number;
  releaseAlpha: number;
  followThroughAlpha: number;

  jumpProgress: number;
  ballState: BallHandlingState;
  ballStateProgress: number;
  shotCharge: number;
  canMove: boolean;
  netSwishVersion: number;
  latestSwishPerfect: boolean;
  shotMeterValue: number;
  shotMeterVisible: boolean;
  shotReleaseValue: number;
  shotReleaseQuality: ShotReleaseQuality | null;
  shotReleaseVersion: number;
  bodyInputFrame: BodyInputFrame | null;
}

export interface GameUiState {
  score: number;
  streak: number;
  ballState: BallHandlingState;
  shotMeterValue: number;
  shotMeterVisible: boolean;
  shotResult: string | null;
}

export interface GameDebugState {
  simFps: number;
  simFrameMs: number;
  simSteps: number;
  droppedAdvances: number;
  ballState: BallHandlingState;
  animationState: string;

  ballSide: number;
  gatherAlpha: number;

  moveLocked: boolean;
  shotCharge: number;
}

const FIXED_STEP = 1 / 120;
const MAX_SUBSTEPS = 8;
const UI_PUSH_INTERVAL = 1 / 30;
const PLAYER_FOLLOW_RATE = 16;

const AUTO_WALK_SPEED = 1.35;
const HOOP_Z = -13;
const STOP_DISTANCE = 6;
const COURT_HALF_W = 7.12;
const COURT_Z_MIN = -13.8;
const COURT_Z_MAX = -0.5;
const KEYBOARD_MOVE_SPEED = 5.4;

const DEFAULT_HAND: RuntimeHandSample = {
  hasHand: false,
  playerX: 0,
  playerZ: -4,
  velocity: { x: 0, y: 0 },
  handedness: 'Right',
  released: false,
}

const DEFAULT_CONTROLS: RuntimeControls = {
  webcamActive: false,
  hand: DEFAULT_HAND,
  moveX: 0,
  moveZ: 0,
  dribblePressed: false,
  shootHeld: false,
  shootReleased: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cloneUiState(state: GameUiState): GameUiState {
  return {
    score: state.score,
    streak: state.streak,
    ballState: state.ballState,
    shotMeterValue: state.shotMeterValue,
    shotMeterVisible: state.shotMeterVisible,
    shotResult: state.shotResult,
  };
}

export class GameRuntime {
  private readonly ballSM = new BallStateMachine();
  private readonly shotArc = new ShotArc();
  private readonly uiListeners = new Set<(state: GameUiState) => void>();

  private accumulator = 0;
  private uiAccumulator = 0;

  private targetX = 0;
  private targetZ = -4;
  private playerX = 0;
  private playerZ = -4;
  private playerVelocityX = 0;
  private playerVelocityZ = 0;

  private shotMeterValue = 0;
  private shotMeterVisible = false;
  private shotMeterStopped: number | null = null;
  private shotReleaseValue = 0;
  private shotReleaseQuality: ShotReleaseQuality | null = null;
  private shotReleaseVersion = 0;
  private jumpProgress = 0;
  private gatherElapsed = 0;

  private score = 0;
  private streak = 0;

  private shotResult: string | null = null;
  private shotResultTimer = 0;

  private netSwishVersion = 0;
  private latestSwishPerfect = false;
  private latestControls: RuntimeControls = DEFAULT_CONTROLS;
  private pendingUiEvent = true;

  /** Keyboard F release can arrive on a frame with 0 fixed substeps; latch until gather consumes it. */
  private keyboardReleaseLatched = false;

  // Animation Alpha states
  private currentCrossoverAlpha = 0;
  private currentGatherAlpha = 0;
  private currentReleaseAlpha = 0;
  private currentFollowThroughAlpha = 0;
  private currentBallSide = 1;
  private currentBodyInput: BodyInputFrame | null = null;

  private readonly renderState: GameRenderState = {
    playerPosition: [0, 0, -4],
    playerVelocity: [0, 0, 0],
    playerSpeed: 0,
    ballPosition: [0.3, 0.8, -4],
    ballLocalPosition: [0.3, 0.8, 0],
    ballSpinRate: 0,
    ballInFlight: false,
    ballSide: 1,
    dribblePhase: 0,
    crossoverAlpha: 0,
    gatherAlpha: 0,
    releaseAlpha: 0,
    followThroughAlpha: 0,
    jumpProgress: 0,
    ballState: 'IDLE',
    ballStateProgress: 0,
    shotCharge: 0,
    canMove: true,
    netSwishVersion: 0,
    latestSwishPerfect: false,
    shotMeterValue: 0,
    shotMeterVisible: false,
    shotReleaseValue: 0,
    shotReleaseQuality: null,
    shotReleaseVersion: 0,
    bodyInputFrame: null,
  };

  private readonly debugState: GameDebugState = {
    simFps: 120,
    simFrameMs: FIXED_STEP * 1000,
    simSteps: 0,
    droppedAdvances: 0,
    ballState: 'IDLE',
    animationState: 'idle',
    ballSide: 1,
    gatherAlpha: 0,
    moveLocked: false,
    shotCharge: 0,
  };

  private uiState: GameUiState = {
    score: 0,
    streak: 0,
    ballState: 'IDLE',
    shotMeterValue: 0,
    shotMeterVisible: false,
    shotResult: null,
  };

  constructor() {
    this.ballSM.onTransition((from, to) => {
      this.handleTransition(from, to);
    });

    this.syncRenderState();
    this.syncUiState(true);
  }

  advance(deltaTime: number, controls: RuntimeControls): void {
    const dt = Math.min(deltaTime, 0.05);
    this.latestControls = controls;
    if (controls.shootReleased && !controls.webcamActive) {
      this.keyboardReleaseLatched = true;
    }
    this.accumulator += dt;
    this.uiAccumulator += dt;

    let steps = 0;
    let keyboardReleasePending = controls.shootReleased;
    let handReleasePending = controls.hand.released;

    while (this.accumulator >= FIXED_STEP && steps < MAX_SUBSTEPS) {
      const stepControls: RuntimeControls = {
        ...controls,
        hand: {
          ...controls.hand,
          released: handReleasePending,
        },
        shootReleased: keyboardReleasePending,
      };

      this.tick(FIXED_STEP, stepControls);
      keyboardReleasePending = false;
      handReleasePending = false;
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }

    if (
      steps === 0 &&
      !controls.webcamActive &&
      this.keyboardReleaseLatched &&
      this.ballSM.isGathering()
    ) {
      const flushControls: RuntimeControls = {
        ...controls,
        hand: {
          ...controls.hand,
          released: false,
        },
        shootReleased: false,
      };
      this.tick(FIXED_STEP, flushControls);
      steps += 1;
    }

    const droppedAdvance = steps === MAX_SUBSTEPS && this.accumulator >= FIXED_STEP;
    if (droppedAdvance) {
      this.debugState.droppedAdvances += 1;
      this.accumulator = 0;
    }

    this.debugState.simSteps = steps;
    this.debugState.simFrameMs = lerp(this.debugState.simFrameMs, dt * 1000, 0.18);
    if (dt > 0 && steps > 0) {
      this.debugState.simFps = lerp(this.debugState.simFps, steps / dt, 0.18);
    }

    if (this.pendingUiEvent || this.uiAccumulator >= UI_PUSH_INTERVAL) {
      this.syncUiState(this.pendingUiEvent);
      this.uiAccumulator = 0;
      this.pendingUiEvent = false;
    }
  }

  getRenderState(): GameRenderState {
    return this.renderState;
  }

  getUiState(): GameUiState {
    return cloneUiState(this.uiState);
  }

  getDebugState(): GameDebugState {
    return { ...this.debugState };
  }

  subscribeUi(listener: (state: GameUiState) => void): () => void {
    this.uiListeners.add(listener);
    listener(this.getUiState());

    return () => {
      this.uiListeners.delete(listener);
    };
  }

  private tick(dt: number, controls: RuntimeControls): void {
    this.currentBodyInput = controls.bodyInputFrame ?? null;
    this.updatePlayer(dt, controls);
    this.updateBallState(dt, controls);
    this.updateShotMeter(dt);
    this.updateShotArc(dt);
    this.updateTransientEffects(dt);
    this.updateAnimationState(dt);
    this.syncRenderState();
  }

  private updatePlayer(dt: number, controls: RuntimeControls): void {
    const canMove = this.ballSM.getConfig().canMove && !this.shotArc.isActive();

    if (canMove) {
      if (controls.webcamActive && controls.hand.hasHand) {
        this.targetX = clamp(controls.hand.playerX * 0.85, -COURT_HALF_W, COURT_HALF_W);

        const distanceToHoop = Math.abs(this.targetZ - HOOP_Z);
        if (distanceToHoop > STOP_DISTANCE && !this.ballSM.isShooting() && !this.shotArc.isActive()) {
          this.targetZ -= AUTO_WALK_SPEED * dt;
        }
      } else {
        this.targetX += controls.moveX * KEYBOARD_MOVE_SPEED * dt;
        this.targetZ += controls.moveZ * KEYBOARD_MOVE_SPEED * dt;
      }
    } else {
      this.targetX = this.playerX;
      this.targetZ = this.playerZ;
    }

    this.targetX = clamp(this.targetX, -COURT_HALF_W, COURT_HALF_W);
    this.targetZ = clamp(this.targetZ, COURT_Z_MIN, COURT_Z_MAX);

    const followRate = canMove ? PLAYER_FOLLOW_RATE : PLAYER_FOLLOW_RATE * 1.5;
    const smoothing = 1 - Math.exp(-followRate * dt);
    const prevX = this.playerX;
    const prevZ = this.playerZ;

    this.playerX = lerp(this.playerX, this.targetX, smoothing);
    this.playerZ = lerp(this.playerZ, this.targetZ, smoothing);

    this.playerVelocityX = (this.playerX - prevX) / dt;
    this.playerVelocityZ = (this.playerZ - prevZ) / dt;
  }

  private updateBallState(dt: number, controls: RuntimeControls): void {
    if (controls.webcamActive) {
      this.keyboardReleaseLatched = false;
      if (!controls.hand.hasHand) return;

      const input: BallInput = {
        velocityX: controls.hand.velocity.x,
        velocityY: controls.hand.velocity.y,
        dribblePressed: this.ballSM.isDribbling() || controls.hand.velocity.y > 0.05,
        // Ball state side labels follow the on-screen view, not the rig's anatomical hand.
        handSide: controls.hand.handedness === 'Left' ? 'right' : 'left',
        released: controls.hand.released,
        timeSinceStateEnter: this.ballSM.getStateTime(),
      };

      this.ballSM.update(dt, input);
      return;
    }

    const isInGather = this.ballSM.isGathering();
    const isInShoot = this.ballSM.isShooting();

    let intendedHand: 'left' | 'right' = this.currentBallSide >= 0 ? 'right' : 'left';
    if (controls.moveX > 0.1) intendedHand = 'right';
    else if (controls.moveX < -0.1) intendedHand = 'left';

    const releasedKeyboard = this.keyboardReleaseLatched && isInGather;

    const input: BallInput = {
      // Keyboard crossover direction follows the on-screen movement direction.
      velocityX: controls.moveX * 1.5,
      velocityY: controls.shootHeld && !isInGather && !isInShoot
        ? -0.8
        : controls.dribblePressed
          ? 0.5
          : 0,
      dribblePressed: controls.dribblePressed,
      handSide: intendedHand,
      released: releasedKeyboard,
      timeSinceStateEnter: this.ballSM.getStateTime(),
    };

    this.ballSM.update(dt, input);

    if (this.keyboardReleaseLatched && !this.ballSM.isGathering()) {
      this.keyboardReleaseLatched = false;
    }
  }

  private updateShotMeter(dt: number): void {
    if (this.ballSM.isGathering()) {
      this.gatherElapsed += dt;
      this.shotMeterValue = getShotMeterProgress(this.gatherElapsed);
      this.jumpProgress = this.shotMeterValue;
      return;
    }

    if (!this.ballSM.isShooting()) {
      this.jumpProgress = 0;
    }
  }

  private updateShotArc(dt: number): void {
    if (!this.shotArc.isActive()) return;

    const arcState = this.shotArc.update(dt);
    if (!arcState.landed) return;

    if (arcState.madeBasket) {
      this.score += 1;
      this.streak += 1;

      const wasPerfect = this.shotArc.isPerfect();
      this.latestSwishPerfect = wasPerfect;
      this.netSwishVersion += 1;

      this.shotResult = wasPerfect
        ? 'GREEN!'
        : arcState.hitRim || arcState.hitBackboard
          ? 'Bank!'
          : 'Swish!';
      this.shotResultTimer = 1.2;
      this.ballSM.forceTransition('DEAD');
    } else {
      this.streak = 0;
      this.shotResult = arcState.hitRim
        ? 'Rim Out'
        : arcState.hitBackboard
          ? 'Off Board'
          : 'Airball';
      this.shotResultTimer = 1.2;
      this.ballSM.forceTransition('BOUNCE');
    }

    this.pendingUiEvent = true;
  }

  private updateTransientEffects(dt: number): void {
    if (this.shotResultTimer > 0) {
      this.shotResultTimer = Math.max(0, this.shotResultTimer - dt);
      if (this.shotResultTimer === 0) {
        this.shotResult = null;
      }
    }
  }

  private updateAnimationState(dt: number): void {
    const state = this.ballSM.getState();
    const isCrossover = this.ballSM.isCrossover();
    const isGathering = state === 'GATHER_LOW' || state === 'GATHER_HIGH';
    const isShooting = state === 'SHOOTING';
    const isFollow = state === 'FOLLOW_THROUGH';
    const holdReleasePose = isShooting || isFollow;

    let targetSide = this.currentBallSide;
    const localX = this.renderState.ballLocalPosition[0];
    if (state === 'DRIBBLE_LEFT_DOWN' || state === 'DRIBBLE_LEFT_UP' || state === 'HELD_LEFT') targetSide = -1;
    else if (state === 'DRIBBLE_RIGHT_DOWN' || state === 'DRIBBLE_RIGHT_UP' || state === 'HELD_RIGHT') targetSide = 1;
    else targetSide = localX < 0 ? 1 : -1;

    const alphaRate = 12;
    const dampen = (cur: number, tar: number) => lerp(cur, tar, 1 - Math.exp(-alphaRate * dt));

    this.currentCrossoverAlpha = dampen(this.currentCrossoverAlpha, isCrossover ? 1 : 0);
    this.currentGatherAlpha = dampen(this.currentGatherAlpha, isGathering ? 1 : 0);
    this.currentReleaseAlpha = dampen(this.currentReleaseAlpha, holdReleasePose ? 1 : 0);
    this.currentFollowThroughAlpha = dampen(this.currentFollowThroughAlpha, isFollow ? 1 : 0);
    this.currentBallSide = dampen(this.currentBallSide, targetSide);
  }

  private handleTransition(from: BallHandlingState, to: BallHandlingState): void {
    if (to === 'GATHER_LOW') {
      this.gatherElapsed = 0;
      this.shotMeterValue = 0;
      this.shotMeterStopped = null;
      this.shotReleaseValue = 0;
      this.shotReleaseQuality = null;
      this.shotMeterVisible = true;
    }

    if (to === 'SHOOTING' && (from === 'GATHER_LOW' || from === 'GATHER_HIGH')) {
      this.shotMeterStopped = this.shotMeterValue;
      this.shotReleaseValue = this.shotMeterValue;
      this.shotReleaseQuality = getShotReleaseQuality(this.shotMeterValue);
      this.shotReleaseVersion += 1;
      this.shotMeterVisible = false;
    }

    if (to === 'FOLLOW_THROUGH' && from === 'SHOOTING') {
      this.launchShot();
    }

    if (to !== 'GATHER_LOW' && to !== 'GATHER_HIGH') {
      this.shotMeterVisible = false;
    }

    if ((from === 'BOUNCE' || from === 'DEAD') && to === 'IDLE') {
      this.shotArc.reset();
    }

    this.pendingUiEvent = true;
  }

  private launchShot(): void {
    const stoppedValue = this.shotMeterStopped ?? 0.5;
    const releaseQuality = getShotReleaseQuality(stoppedValue);
    const isGreen = isGreenRelease(stoppedValue);

    let accuracyBonus = 0;
    if (isGreen) {
      accuracyBonus = 1.0;
    } else {
      accuracyBonus = releaseQuality === 'early'
        ? -(SHOT_METER_SWEET_SPOT_START - stoppedValue) * 0.7
        : -(stoppedValue - SHOT_METER_SWEET_SPOT_TOP) * 0.95;
    }

    const launchPower = this.latestControls.webcamActive
      ? clamp(Math.abs(this.latestControls.hand.velocity.y) * 2, 0.45, 1)
      : clamp(0.52 + stoppedValue * 0.48, 0.45, 1);

    this.shotArc.launch(
      [this.playerX + 0.06, 1.82, this.playerZ - 0.2],
      launchPower,
      accuracyBonus,
      isGreen,
    );
  }

  private syncRenderState(): void {
    const snapshot = this.ballSM.getSnapshot();
    const config = snapshot.config;
    const shotCharge = this.shotMeterStopped ?? this.shotMeterValue;

    let ballPosition: [number, number, number];
    let ballLocalPosition: [number, number, number];
    let ballSpinRate = config.ballSpin;

    const inFlight = this.shotArc.isActive();

    if (inFlight) {
      const arcPos = this.shotArc.getPosition();
      ballPosition = [arcPos[0], arcPos[1], arcPos[2]];
      // Convert world to local. Player faces -Z (Math.PI rotated). World +X is local -X.
      ballLocalPosition = [this.playerX - arcPos[0], arcPos[1], this.playerZ - arcPos[2]];
      ballSpinRate = -10;
    } else {
      const handsAttached = computeAttachedShootBallLocal(
        snapshot.state,
        snapshot.stateProgress,
        shotCharge,
      );

      let bx: number;
      let by: number;
      let bz: number;

      if (handsAttached) {
        [bx, by, bz] = handsAttached;
      } else {
        bx = config.ballOffset.x;
        by = config.ballOffset.y;
        bz = config.ballOffset.z;

        if (snapshot.previousConfig && snapshot.blendFactor < 1) {
          bx = snapshot.previousConfig.ballOffset.x + (bx - snapshot.previousConfig.ballOffset.x) * snapshot.blendFactor;
          by = snapshot.previousConfig.ballOffset.y + (by - snapshot.previousConfig.ballOffset.y) * snapshot.blendFactor;
          bz = snapshot.previousConfig.ballOffset.z + (bz - snapshot.previousConfig.ballOffset.z) * snapshot.blendFactor;
        }

        if (config.ballBounce) {
          const phase = snapshot.stateTime * config.ballBounce.frequency * Math.PI * 2;
          by += Math.abs(Math.sin(phase)) * config.ballBounce.amplitude;
        }

        if (this.ballSM.isCrossover()) {
          const fromX = snapshot.state === 'CROSSOVER_R2L' ? -0.3 : 0.3;
          const toX = snapshot.state === 'CROSSOVER_R2L' ? 0.3 : -0.3;
          bx = lerp(fromX, toX, snapshot.stateProgress);
        }
      }

      ballLocalPosition = [bx, by, bz];
      // Due to the Math.PI body rotation, screen-right states use local -X positions.
      ballPosition = [this.playerX - bx, by, this.playerZ - bz];
    }

    const speed = Math.min(1, Math.hypot(this.playerVelocityX, this.playerVelocityZ) / KEYBOARD_MOVE_SPEED);
    const canMove = config.canMove && !inFlight;

    this.renderState.playerPosition = [this.playerX, 0, this.playerZ];
    this.renderState.playerVelocity = [this.playerVelocityX, 0, this.playerVelocityZ];
    this.renderState.playerSpeed = speed;
    this.renderState.ballPosition = ballPosition;
    this.renderState.ballLocalPosition = ballLocalPosition;
    this.renderState.ballSpinRate = ballSpinRate;
    this.renderState.ballInFlight = inFlight;

    // Continuous Alpha Updates
    this.renderState.ballSide = this.currentBallSide;
    this.renderState.dribblePhase = (snapshot.stateTime * Math.PI * 2) % (Math.PI * 2);
    this.renderState.crossoverAlpha = this.currentCrossoverAlpha;
    this.renderState.gatherAlpha = this.currentGatherAlpha;
    this.renderState.releaseAlpha = this.currentReleaseAlpha;
    this.renderState.followThroughAlpha = this.currentFollowThroughAlpha;

    this.renderState.jumpProgress = this.jumpProgress;
    this.renderState.ballState = snapshot.state;
    this.renderState.ballStateProgress = snapshot.stateProgress;
    this.renderState.shotCharge = shotCharge;
    this.renderState.canMove = canMove;
    this.renderState.netSwishVersion = this.netSwishVersion;
    this.renderState.latestSwishPerfect = this.latestSwishPerfect;
    this.renderState.shotMeterValue = this.shotMeterValue;
    this.renderState.shotMeterVisible = this.shotMeterVisible;
    this.renderState.shotReleaseValue = this.shotReleaseValue;
    this.renderState.shotReleaseQuality = this.shotReleaseQuality;
    this.renderState.shotReleaseVersion = this.shotReleaseVersion;
    this.renderState.bodyInputFrame = this.currentBodyInput;

    this.debugState.ballState = snapshot.state;
    this.debugState.animationState = config.playerAnim;
    this.debugState.ballSide = this.currentBallSide;
    this.debugState.gatherAlpha = this.currentGatherAlpha;
    this.debugState.moveLocked = !canMove;
    this.debugState.shotCharge = shotCharge;
  }

  private syncUiState(forcePush: boolean): void {
    this.uiState.score = this.score;
    this.uiState.streak = this.streak;
    this.uiState.ballState = this.renderState.ballState;
    this.uiState.shotMeterValue = this.shotMeterValue;
    this.uiState.shotMeterVisible = this.shotMeterVisible;
    this.uiState.shotResult = this.shotResult;

    if (forcePush || this.uiListeners.size > 0) {
      const snapshot = this.getUiState();
      for (const listener of this.uiListeners) {
        listener(snapshot);
      }
    }
  }
}
