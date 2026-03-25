/**
 * Player Class
 * Manages player avatar state, separate from rendering
 */

import type {
  PlayerState,
  PlayerAnimationState,
  PlayerConfig,
  NormalizedPosition,
  GameState,
} from '../types';

// ============================================
// Constants
// ============================================

const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  baseScale: 1.0,
  shadowAlpha: 0.4,
  smoothingFactor: 0.15,
};

const DEFAULT_POSITION: NormalizedPosition = {
  x: 0.5,
  y: 0.6,
};

// ============================================
// Player Class
// ============================================

export default class Player {
  private state: PlayerState;
  private config: PlayerConfig;
  private targetPosition: NormalizedPosition;

  constructor(config?: Partial<PlayerConfig>) {
    this.config = {
      ...DEFAULT_PLAYER_CONFIG,
      ...config,
    };

    this.targetPosition = { ...DEFAULT_POSITION };

    this.state = {
      position: { ...DEFAULT_POSITION },
      animationState: 'idle',
      facingDirection: 'right',
      ballAttached: false,
    };
  }

  /**
   * Get read-only copy of player state
   */
  getState(): Readonly<PlayerState> {
    return Object.freeze({ ...this.state });
  }

  /**
   * Get current player position
   */
  getPosition(): NormalizedPosition {
    return { ...this.state.position };
  }

  /**
   * Set target position and update facing direction based on X movement
   */
  setTargetPosition(pos: NormalizedPosition): void {
    // Update facing direction based on horizontal movement
    if (pos.x < this.state.position.x) {
      this.state.facingDirection = 'left';
    } else if (pos.x > this.state.position.x) {
      this.state.facingDirection = 'right';
    }

    this.targetPosition = { ...pos };
  }

  /**
   * Update player position with exponential smoothing
   */
  update(_deltaTime: number): void {
    const smoothingFactor = this.config.smoothingFactor;

    // Apply exponential smoothing to position
    this.state.position.x +=
      (this.targetPosition.x - this.state.position.x) * smoothingFactor;
    this.state.position.y +=
      (this.targetPosition.y - this.state.position.y) * smoothingFactor;

    // Clamp position to valid range
    this.state.position.x = Math.max(0, Math.min(1, this.state.position.x));
    this.state.position.y = Math.max(0, Math.min(1, this.state.position.y));
  }

  /**
   * Set animation state
   */
  setAnimationState(state: PlayerAnimationState): void {
    this.state.animationState = state;
  }

  /**
   * Set whether ball is attached to player
   */
  setBallAttached(attached: boolean): void {
    this.state.ballAttached = attached;
  }

  /**
   * Reset player to default state
   */
  reset(): void {
    this.state.position = { ...DEFAULT_POSITION };
    this.targetPosition = { ...DEFAULT_POSITION };
    this.state.animationState = 'idle';
    this.state.facingDirection = 'right';
    this.state.ballAttached = false;
  }

  /**
   * Transition animation state based on game state
   */
  transitionToAnimationState(gameState: GameState): void {
    let animationState: PlayerAnimationState;

    switch (gameState) {
      case 'IDLE':
      case 'COOLDOWN':
      case 'HOLDING':
        animationState = 'idle';
        break;
      case 'DRIBBLING':
        animationState = 'dribble';
        break;
      case 'GATHERING':
        animationState = 'gather';
        break;
      case 'SHOOTING':
        animationState = 'shoot';
        break;
      case 'IN_FLIGHT':
        animationState = 'follow_through';
        break;
      case 'SCORED':
        animationState = 'celebrate';
        break;
      case 'MISSED':
      case 'RESOLVING':
      default:
        animationState = 'idle';
        break;
    }

    this.setAnimationState(animationState);
  }

  /**
   * Get arm angle in degrees based on animation state
   */
  getArmAngle(): number {
    switch (this.state.animationState) {
      case 'idle':
        return 0;
      case 'dribble':
        return 0;
      case 'gather':
        return -45;
      case 'shoot':
        return -90;
      case 'follow_through':
        return -90;
      case 'celebrate':
        return -120;
      default:
        return 0;
    }
  }

  /**
   * Get shadow scale based on animation state
   */
  getShadowScale(): number {
    switch (this.state.animationState) {
      case 'gather':
      case 'shoot':
        return 0.7;
      default:
        return 1.0;
    }
  }
}
