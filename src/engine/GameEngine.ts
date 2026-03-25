import type {
  EngineConfig,
  EngineState,
  GameEvent,
  GameEventListener,
  NormalizedPosition,
  HandData,
  GameState,
} from '../types';
import { GameLoop } from './GameLoop';
import { GameStateMachine } from './GameStateMachine';
import { HandTracker } from './input/HandTracker';
import { ReleaseDetector } from './input/ReleaseDetector';
import { BallPhysics } from './physics/BallPhysics';
import { ShotResolver } from './physics/ShotResolver';
import { PixiRenderer } from './rendering/PixiRenderer';
import { AudioManager } from './audio/AudioManager';
import Player from './Player';

const SHOT_VELOCITY_SCALE = 1.8;
const RELEASE_POWER_MIN = 0.3;
const RELEASE_POWER_MAX = 2.0;
const GATHERING_RISE_THRESHOLD = -0.05;
const DRIBBLE_VELOCITY_THRESHOLD = 0.3;
const DRIBBLE_COOLDOWN_MS = 200;

export class GameEngine {
  private static instance: GameEngine | null = null;

  private gameLoop: GameLoop | null = null;
  private config: EngineConfig | null = null;
  private listeners: Map<string, Set<GameEventListener>> = new Map();

  private stateMachine: GameStateMachine | null = null;
  private handTracker: HandTracker | null = null;
  private releaseDetector: ReleaseDetector | null = null;
  private ballPhysics: BallPhysics | null = null;
  private shotResolver: ShotResolver | null = null;
  private renderer: PixiRenderer | null = null;
  private audioManager: AudioManager | null = null;

  private videoElement: HTMLVideoElement | null = null;
  private lastHandPosition: NormalizedPosition | null = null;
  private isGathering = false;
  private lastDribbleTime = 0;
  private wasDribblingDown = false;
  private player: Player | null = null;

  private score = 0;
  private streak = 0;

  private state: EngineState = {
    initialized: false,
    running: false,
    fps: 0,
    frameTime: 0,
    mediaPipeLoaded: false,
    loadProgress: 0,
    error: null,
  };

  private constructor() {}

  static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  static resetInstance(): void {
    if (GameEngine.instance) {
      GameEngine.instance.destroy();
    }
    GameEngine.instance = null;
  }

  async init(config: EngineConfig): Promise<void> {
    if (this.state.initialized) {
      throw new Error('GameEngine is already initialized');
    }

    this.config = config;
    this.state = { ...this.state, loadProgress: 0.05 };

    this.stateMachine = new GameStateMachine();
    this.releaseDetector = new ReleaseDetector();
    this.ballPhysics = new BallPhysics();
    this.shotResolver = new ShotResolver();
    this.audioManager = AudioManager.getInstance();
    this.player = new Player();

    this.stateMachine.subscribe(this.onStateChange.bind(this));

    this.state = { ...this.state, loadProgress: 0.1 };

    this.handTracker = new HandTracker();
    await this.handTracker.initialize((trackerState) => {
      this.state = {
        ...this.state,
        mediaPipeLoaded: trackerState.isTracking,
        loadProgress: 0.1 + trackerState.loadProgress * 0.5,
        error: trackerState.error,
      };
    });

    this.state = { ...this.state, loadProgress: 0.65 };

    await this.audioManager.preload();

    this.state = { ...this.state, loadProgress: 0.75 };

    this.gameLoop = new GameLoop(
      this.update.bind(this),
      this.render.bind(this),
    );

    this.state = {
      ...this.state,
      initialized: true,
      loadProgress: 1,
      error: null,
    };

    this.emit({ type: 'CALIBRATION_COMPLETE' });
  }

  async initRenderer(
    container: HTMLElement,
    videoElement: HTMLVideoElement,
  ): Promise<void> {
    this.videoElement = videoElement;

    this.renderer = new PixiRenderer({
      width: container.clientWidth || 1280,
      height: container.clientHeight || 720,
      mirrorVideo: true,
    });

    await this.renderer.initialize(container, videoElement);

    const hoopPos = this.shotResolver?.getHoopPosition() ?? { x: 0.5, y: 0.25 };
    this.renderer.setHoopPosition(hoopPos);
  }

  start(): void {
    if (!this.state.initialized || !this.gameLoop) {
      throw new Error('GameEngine must be initialized before starting');
    }

    if (this.state.running) return;

    this.gameLoop.start();
    this.state = { ...this.state, running: true };
    this.emit({ type: 'GAME_STARTED' });
  }

  stop(): void {
    if (!this.state.running || !this.gameLoop) return;

    this.gameLoop.stop();
    this.state = { ...this.state, running: false };
    this.emit({ type: 'GAME_ENDED' });
  }

  pause(): void {
    if (!this.state.running || !this.gameLoop) return;

    this.gameLoop.pause();
    this.emit({ type: 'GAME_PAUSED' });
  }

  resume(): void {
    if (!this.gameLoop) return;

    this.gameLoop.resume();
    this.emit({ type: 'GAME_RESUMED' });
  }

  destroy(): void {
    this.stop();

    this.handTracker?.close();
    this.renderer?.destroy();
    this.audioManager?.destroy();

    this.gameLoop = null;
    this.config = null;
    this.stateMachine = null;
    this.handTracker = null;
    this.releaseDetector = null;
    this.ballPhysics = null;
    this.shotResolver = null;
    this.renderer = null;
    this.audioManager = null;
    this.videoElement = null;
    this.lastHandPosition = null;
    this.listeners.clear();

    this.state = {
      initialized: false,
      running: false,
      fps: 0,
      frameTime: 0,
      mediaPipeLoaded: false,
      loadProgress: 0,
      error: null,
    };
  }

  on(event: string, listener: GameEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: GameEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: GameEvent): void {
    const eventListeners = this.listeners.get(event.type);
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(event);
      }
    }

    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        listener(event);
      }
    }
  }

  getState(): Readonly<EngineState> {
    if (this.gameLoop) {
      const stats = this.gameLoop.getStats();
      this.state = {
        ...this.state,
        fps: Math.round(stats.fps),
        frameTime: stats.frameTime,
      };
    }
    return this.state;
  }

  getGameState(): GameState | null {
    return this.stateMachine?.getState() ?? null;
  }

  getGameContext() {
    return this.stateMachine?.getContext() ?? null;
  }

  getConfig(): Readonly<EngineConfig> | null {
    return this.config;
  }

  private update(deltaTime: number): void {
    if (!this.stateMachine || !this.ballPhysics || !this.shotResolver) return;

    this.stateMachine.update(deltaTime);

    this.processHandTracking(deltaTime);

    const currentState = this.stateMachine.getState();

    if (currentState === 'IN_FLIGHT') {
      this.updateBallFlight(deltaTime);
    }
  }

  private processHandTracking(_deltaTime: number): void {
    if (!this.handTracker || !this.videoElement || !this.stateMachine) return;
    if (!this.releaseDetector || !this.ballPhysics) return;

    const frame = this.handTracker.processFrame(this.videoElement);

    if (!frame.isTracking || frame.hands.length === 0) {
      if (this.lastHandPosition) {
        this.stateMachine.onHandLost();
        this.lastHandPosition = null;
        this.isGathering = false;
        this.releaseDetector.reset();
        this.renderer?.setHandVisible(false);
        this.renderer?.clearHandSkeleton();
      }
      return;
    }

    const hand = this.selectDominantHand(frame.hands);
    const handPos: NormalizedPosition = { x: 1 - hand.wrist.x, y: hand.wrist.y };

    this.renderer?.setHandPosition(handPos);
    this.renderer?.setHandVisible(true);
    this.renderer?.drawHandSkeleton(hand.landmarks);

    if (this.player) {
      this.player.setTargetPosition(handPos);
      this.player.update(_deltaTime);
      this.renderer?.setPlayerPosition(this.player.getPosition());
      this.renderer?.setPlayerVisible(true);
    }

    const currentState = this.stateMachine.getState();

    if (currentState === 'IDLE') {
      this.stateMachine.onHandDetected(handPos);
    }

    const holdingStates: GameState[] = ['HOLDING', 'DRIBBLING', 'GATHERING'];
    if (holdingStates.includes(currentState)) {
      this.ballPhysics.followHand(handPos);

      const detection = this.releaseDetector.update(hand, frame.timestamp);
      const velocity = this.getInstantVelocity(hand, frame.timestamp);

      if (currentState === 'HOLDING') {
        if (velocity.y < GATHERING_RISE_THRESHOLD && !this.isGathering) {
          this.isGathering = true;
          this.stateMachine.onGatherStart();
        } else {
          this.detectDribble(velocity, frame.timestamp);
        }
      }

      if (currentState === 'DRIBBLING') {
        this.detectDribble(velocity, frame.timestamp);
        
        if (velocity.y < GATHERING_RISE_THRESHOLD) {
          this.isGathering = true;
          this.stateMachine.onGatherStart();
        }
      }

      if (currentState === 'GATHERING') {
        this.updateTrajectoryPreview(handPos, velocity);

        if (detection.released) {
          this.executeShot(detection.power, detection.angle, detection.velocity!);
        }
      } else {
        this.renderer?.clearTrajectoryPreview();
      }
    } else {
      this.renderer?.clearTrajectoryPreview();
    }

    this.lastHandPosition = handPos;
  }

  private getInstantVelocity(
    hand: HandData,
    timestamp: number,
  ): { x: number; y: number } {
    const detector = this.releaseDetector as any;
    if (!detector.prevPosition) {
      return { x: 0, y: 0 };
    }

    const dt = timestamp - detector.prevPosition.timestamp;
    if (dt <= 0) return { x: 0, y: 0 };

    return {
      x: ((hand.wrist.x - detector.prevPosition.position.x) / dt) * 1000,
      y: ((hand.wrist.y - detector.prevPosition.position.y) / dt) * 1000,
    };
  }

  private selectDominantHand(hands: HandData[]): HandData {
    const dominant = this.stateMachine?.getContext().dominantHand ?? 'Right';
    return hands.find((h) => h.handedness === dominant) ?? hands[0];
  }

  private executeShot(
    power: number,
    angle: number,
    velocity: { x: number; y: number },
  ): void {
    if (!this.stateMachine || !this.ballPhysics || !this.shotResolver) return;

    const scaledPower =
      RELEASE_POWER_MIN + power * (RELEASE_POWER_MAX - RELEASE_POWER_MIN);

    const shotVelocity = {
      x: velocity.x * SHOT_VELOCITY_SCALE,
      y: velocity.y * SHOT_VELOCITY_SCALE - scaledPower,
    };

    this.ballPhysics.release(shotVelocity);
    this.shotResolver.startTracking(this.ballPhysics.getPosition().y);

    this.stateMachine.onShotReleased(scaledPower, angle, shotVelocity);

    this.audioManager?.playRelease();
    this.renderer?.spawnReleaseEffect(this.ballPhysics.getPosition());

    this.isGathering = false;
    this.releaseDetector?.reset();
  }

  private updateBallFlight(deltaTime: number): void {
    if (!this.ballPhysics || !this.shotResolver || !this.stateMachine) return;

    const inBounds = this.ballPhysics.update(deltaTime);

    const ballState = this.ballPhysics.getState();
    const ballRadius = this.ballPhysics.getBallRadius();

    const collision = this.shotResolver.update(ballState, ballRadius);

    if (collision.type === 'rim_left' || collision.type === 'rim_right') {
      if (collision.normal) {
        this.ballPhysics.bounce(collision.normal);
      }
      this.audioManager?.playRimHit();
      this.renderer?.triggerScreenShake(3, 100);
    }

    if (collision.type === 'backboard') {
      if (collision.normal) {
        this.ballPhysics.bounce(collision.normal);
      }
      this.audioManager?.play('bounce');
    }

    if (collision.type === 'through_hoop') {
      this.resolveShot(true);
      return;
    }

    if (!inBounds) {
      this.resolveShot(false);
    }
  }

  private resolveShot(passedThrough: boolean): void {
    if (!this.shotResolver || !this.stateMachine || !this.ballPhysics) return;

    const ballPos = this.ballPhysics.getPosition();
    this.stateMachine.onBallLanded(ballPos);

    const { made, outcome } = this.shotResolver.resolveShot();

    if (made || passedThrough) {
      this.audioManager?.playSwish();
      this.renderer?.spawnSwishEffect(this.shotResolver.getHoopPosition());
      
      const context = this.stateMachine.getContext();
      const streak = context.streak + 1;
      
      if (streak >= 2) {
        this.renderer?.spawnStreakEffect(this.shotResolver.getHoopPosition(), streak);
        this.renderer?.triggerScreenShake(8 + streak * 2, 200 + streak * 50);
      } else {
        this.renderer?.triggerScreenShake(8, 200);
      }
    } else {
      this.audioManager?.playMiss();
      this.renderer?.spawnMissEffect(ballPos);
    }

    this.stateMachine.onShotResolved(outcome, made || passedThrough);

    if (made || passedThrough) {
      this.emit({ type: 'SHOT_MADE', outcome });
    } else {
      this.emit({ type: 'SHOT_MISSED', outcome });
    }

    this.ballPhysics.reset();
    this.shotResolver.reset();
  }

  private onStateChange(newState: GameState): void {
    this.emit({ type: 'STATE_CHANGED', state: newState });

    if (this.player) {
      this.player.transitionToAnimationState(newState);
      this.renderer?.setPlayerAnimationState(this.player.getState().animationState);
      this.renderer?.setPlayerShadowScale(this.player.getShadowScale());
    }

    if (newState === 'IDLE') {
      this.renderer?.setBallVisible(false);
      this.renderer?.setDribbling(false);
      this.isGathering = false;
    } else if (newState === 'HOLDING') {
      this.renderer?.setBallVisible(true);
      this.renderer?.setDribbling(false);
    } else if (newState === 'DRIBBLING') {
      this.renderer?.setDribbling(true);
    } else if (newState === 'GATHERING') {
      this.renderer?.setDribbling(false);
      this.renderer?.startShotMeter();
    } else if (newState === 'IN_FLIGHT') {
      this.renderer?.stopShotMeter();
    } else if (newState === 'SCORED') {
      this.score++;
      this.streak++;
      this.renderer?.setScore(this.score);
      this.renderer?.setStreak(this.streak);
      this.renderer?.triggerScorePopup();
    } else if (newState === 'MISSED') {
      this.streak = 0;
      this.renderer?.setStreak(this.streak);
    }
  }

  private detectDribble(
    velocity: { x: number; y: number },
    timestamp: number,
  ): void {
    if (!this.stateMachine || !this.audioManager) return;

    const isDribblingDown = velocity.y > DRIBBLE_VELOCITY_THRESHOLD;
    const isDribblingUp = velocity.y < -DRIBBLE_VELOCITY_THRESHOLD;

    if (this.wasDribblingDown && isDribblingUp) {
      const timeSinceLastDribble = timestamp - this.lastDribbleTime;
      
      if (timeSinceLastDribble > DRIBBLE_COOLDOWN_MS) {
        this.lastDribbleTime = timestamp;
        this.audioManager.playDribble();
        
        const currentState = this.stateMachine.getState();
        if (currentState === 'HOLDING') {
          this.stateMachine.onDribbleStart();
        }
      }
    }

    this.wasDribblingDown = isDribblingDown;
  }

  private updateTrajectoryPreview(
    startPos: NormalizedPosition,
    velocity: { x: number; y: number },
  ): void {
    if (!this.renderer) return;

    const scaledVelocity = {
      x: velocity.x * SHOT_VELOCITY_SCALE,
      y: velocity.y * SHOT_VELOCITY_SCALE - RELEASE_POWER_MIN,
    };

    const points: NormalizedPosition[] = [];
    let x = startPos.x;
    let y = startPos.y;
    let vx = scaledVelocity.x;
    let vy = scaledVelocity.y;

    const gravity = 1.5;
    const dt = 0.016;
    const steps = 40;

    for (let i = 0; i < steps; i++) {
      points.push({ x, y });

      vy += gravity * dt;
      x += vx * dt;
      y += vy * dt;

      if (y > 1.1 || x < -0.1 || x > 1.1) break;
    }

    if (points.length > 1) {
      this.renderer.drawTrajectoryPreview(points);
    }
  }

  private render(_alpha: number): void {
    if (!this.renderer || !this.ballPhysics) return;

    const ballPos = this.ballPhysics.getPosition();
    const ballState = this.ballPhysics.getState();

    this.renderer.setBallPosition(ballPos);
    this.renderer.setBallRotation(ballState.rotation);

    if (this.gameLoop) {
      const stats = this.gameLoop.getStats();
      this.state = {
        ...this.state,
        fps: Math.round(stats.fps),
        frameTime: stats.frameTime,
      };
    }
  }
}
