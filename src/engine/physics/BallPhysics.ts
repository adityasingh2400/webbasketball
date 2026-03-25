import type { BallState, PhysicsConfig, Vector2, NormalizedPosition } from '../../types';

// ============================================
// Physics Constants
// ============================================

const DEFAULT_PHYSICS: PhysicsConfig = {
  gravity: 1.5,
  drag: 0.01,
  bounce: 0.6,
  ballRadius: 0.04,
};

const BOUNDS_MARGIN = 0.15;
const VELOCITY_EPSILON = 0.001;

const HAND_OFFSET_Y = 0.05;
const SPIN_TRANSFER_FACTOR = 2;

// ============================================
// BallPhysics
// ============================================

export class BallPhysics {
  private state: BallState;
  private config: PhysicsConfig;
  private attachedToPlayer = false;
  private _playerPosition: NormalizedPosition | null = null;
  private attachmentOffset: Vector2 = { x: 0.03, y: -0.02 };

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = { ...DEFAULT_PHYSICS, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): BallState {
    return {
      position: { x: 0.5, y: 0.8 },
      velocity: { x: 0, y: 0 },
      angularVelocity: 0,
      rotation: 0,
      inFlight: false,
    };
  }

  update(deltaTime: number): boolean {
    if (this.attachedToPlayer && !this.state.inFlight) {
      return true; // Ball position controlled by player, skip physics
    }
    if (!this.state.inFlight) return true;

    const { gravity, drag } = this.config;
    const vel = this.state.velocity;
    const pos = this.state.position;

    vel.y += gravity * deltaTime;

    const dragFactor = 1 - drag;
    vel.x *= dragFactor;
    vel.y *= dragFactor;

    if (Math.abs(vel.x) < VELOCITY_EPSILON && Math.abs(vel.y) < VELOCITY_EPSILON) {
      vel.x = 0;
      vel.y = 0;
    }

    pos.x += vel.x * deltaTime;
    pos.y += vel.y * deltaTime;

    this.state.rotation += this.state.angularVelocity * deltaTime;

    return !this.isOutOfBounds();
  }

  followHand(handPosition: NormalizedPosition): void {
    this.state.position = {
      x: handPosition.x,
      y: handPosition.y + HAND_OFFSET_Y,
    };
    this.state.velocity = { x: 0, y: 0 };
    this.state.angularVelocity = 0;
    this.state.inFlight = false;
  }

  release(velocity: Vector2, angularVelocity = 0): void {
    this.state.velocity = { x: velocity.x, y: velocity.y };
    this.state.angularVelocity = angularVelocity;
    this.state.inFlight = true;
  }

  applyImpulse(impulse: Vector2): void {
    this.state.velocity.x += impulse.x;
    this.state.velocity.y += impulse.y;
  }

  /**
   * Reflect velocity off a surface defined by its outward unit normal.
   * Formula: v' = v - (1 + bounce) * (v · n) * n
   */
  bounce(normal: Vector2): void {
    const vel = this.state.velocity;
    const dot = vel.x * normal.x + vel.y * normal.y;

    if (dot >= 0) return;

    const factor = (1 + this.config.bounce) * dot;
    vel.x -= factor * normal.x;
    vel.y -= factor * normal.y;

    this.state.angularVelocity += (normal.x * vel.y - normal.y * vel.x) * SPIN_TRANSFER_FACTOR;
  }

  private isOutOfBounds(): boolean {
    const { x, y } = this.state.position;
    const r = this.config.ballRadius;

    return (
      x + r < -BOUNDS_MARGIN ||
      x - r > 1 + BOUNDS_MARGIN ||
      y + r < -BOUNDS_MARGIN ||
      y - r > 1 + BOUNDS_MARGIN
    );
  }

  getState(): BallState {
    return this.state;
  }

  getPosition(): NormalizedPosition {
    return this.state.position;
  }

  getVelocity(): Vector2 {
    return this.state.velocity;
  }

  isInFlight(): boolean {
    return this.state.inFlight;
  }

  getBallRadius(): number {
    return this.config.ballRadius;
  }

  getBounceCoefficient(): number {
    return this.config.bounce;
  }

  reset(): void {
    this.state = this.createInitialState();
    this.attachedToPlayer = false;
    this._playerPosition = null;
  }

  attachToPlayer(playerPos: NormalizedPosition): void {
    this.attachedToPlayer = true;
    this._playerPosition = { ...playerPos };
    this.state.position = {
      x: playerPos.x + this.attachmentOffset.x,
      y: playerPos.y + this.attachmentOffset.y,
    };
    this.state.velocity = { x: 0, y: 0 };
    this.state.inFlight = false;
  }

  detachFromPlayer(): void {
    this.attachedToPlayer = false;
    this._playerPosition = null;
  }

  updatePlayerPosition(playerPos: NormalizedPosition): void {
    if (!this.attachedToPlayer) return;
    this._playerPosition = { ...playerPos };
    this.state.position = {
      x: playerPos.x + this.attachmentOffset.x,
      y: playerPos.y + this.attachmentOffset.y,
    };
  }

  isAttached(): boolean {
    return this.attachedToPlayer;
  }

  setAttachmentOffset(offset: Vector2): void {
    this.attachmentOffset = { ...offset };
  }

  getPlayerPosition(): NormalizedPosition | null {
    return this._playerPosition;
  }
}
