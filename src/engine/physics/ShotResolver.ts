import type { BallState, HoopConfig, ShotOutcome, NormalizedPosition, Vector2 } from '../../types';

// ============================================
// Hoop Constants
// ============================================

const DEFAULT_HOOP: HoopConfig = {
  position: { x: 0.5, y: 0.25 },
  width: 0.12,
  rimThickness: 0.015,
  backboardOffset: 0.08,
};

const BACKBOARD_HEIGHT = 0.15;
const HOOP_CROSSING_TOLERANCE = 0.02;

// ============================================
// Collision Types
// ============================================

type CollisionType = 'none' | 'rim_left' | 'rim_right' | 'backboard' | 'through_hoop';

interface CollisionResult {
  type: CollisionType;
  point?: NormalizedPosition;
  normal?: Vector2;
}

const NO_COLLISION: CollisionResult = { type: 'none' };

// ============================================
// ShotResolver
// ============================================

export class ShotResolver {
  private config: HoopConfig;
  private passedThroughHoop = false;
  private hitRim = false;
  private hitBackboard = false;
  private previousBallY = 0;
  private trackingActive = false;

  constructor(config: Partial<HoopConfig> = {}) {
    this.config = { ...DEFAULT_HOOP, ...config };
  }

  startTracking(initialBallY: number): void {
    this.reset();
    this.previousBallY = initialBallY;
    this.trackingActive = true;
  }

  checkCollision(ball: BallState, ballRadius: number): CollisionResult {
    const rimLeftCollision = this.checkRimCollision(ball, ballRadius, 'left');
    if (rimLeftCollision.type !== 'none') return rimLeftCollision;

    const rimRightCollision = this.checkRimCollision(ball, ballRadius, 'right');
    if (rimRightCollision.type !== 'none') return rimRightCollision;

    const backboardCollision = this.checkBackboardCollision(ball, ballRadius);
    if (backboardCollision.type !== 'none') return backboardCollision;

    const hoopCrossing = this.checkHoopCrossing(ball, ballRadius);
    if (hoopCrossing.type !== 'none') return hoopCrossing;

    return NO_COLLISION;
  }

  private checkRimCollision(
    ball: BallState,
    ballRadius: number,
    side: 'left' | 'right',
  ): CollisionResult {
    const hoopX = this.config.position.x;
    const hoopY = this.config.position.y;
    const halfWidth = this.config.width / 2;
    const rimRadius = this.config.rimThickness / 2;

    const rimX = side === 'left' ? hoopX - halfWidth : hoopX + halfWidth;
    const rimY = hoopY;

    const dx = ball.position.x - rimX;
    const dy = ball.position.y - rimY;
    const distSq = dx * dx + dy * dy;
    const minDist = ballRadius + rimRadius;

    if (distSq >= minDist * minDist) return NO_COLLISION;

    const dist = Math.sqrt(distSq);
    const normalX = dist > 0 ? dx / dist : (side === 'left' ? -1 : 1);
    const normalY = dist > 0 ? dy / dist : 0;

    return {
      type: side === 'left' ? 'rim_left' : 'rim_right',
      point: { x: rimX, y: rimY },
      normal: { x: normalX, y: normalY },
    };
  }

  private checkBackboardCollision(ball: BallState, ballRadius: number): CollisionResult {
    const hoopX = this.config.position.x;
    const hoopY = this.config.position.y;
    const halfWidth = this.config.width / 2;
    const backboardX = hoopX + halfWidth + this.config.backboardOffset;

    const backboardTop = hoopY - BACKBOARD_HEIGHT;
    const backboardBottom = hoopY + BACKBOARD_HEIGHT / 3;

    const ballRight = ball.position.x + ballRadius;
    const withinVerticalRange =
      ball.position.y >= backboardTop && ball.position.y <= backboardBottom;
    const movingTowardBackboard = ball.velocity.x > 0;

    if (ballRight >= backboardX && withinVerticalRange && movingTowardBackboard) {
      return {
        type: 'backboard',
        point: { x: backboardX, y: ball.position.y },
        normal: { x: -1, y: 0 },
      };
    }

    return NO_COLLISION;
  }

  /**
   * Detect ball crossing the hoop plane from above (previousY < hoopY, currentY >= hoopY)
   * while horizontally within the rim opening.
   */
  private checkHoopCrossing(ball: BallState, ballRadius: number): CollisionResult {
    if (!this.trackingActive) return NO_COLLISION;

    const hoopY = this.config.position.y;
    const hoopX = this.config.position.x;
    const halfWidth = this.config.width / 2;
    const innerHalfWidth = halfWidth - this.config.rimThickness / 2;

    const ballMovingDown = ball.velocity.y > 0;
    const crossedHoopPlane =
      this.previousBallY < hoopY + HOOP_CROSSING_TOLERANCE &&
      ball.position.y >= hoopY - HOOP_CROSSING_TOLERANCE;
    const withinHoopWidth =
      ball.position.x - ballRadius > hoopX - innerHalfWidth &&
      ball.position.x + ballRadius < hoopX + innerHalfWidth;

    this.previousBallY = ball.position.y;

    if (ballMovingDown && crossedHoopPlane && withinHoopWidth) {
      return {
        type: 'through_hoop',
        point: { x: ball.position.x, y: hoopY },
      };
    }

    return NO_COLLISION;
  }

  update(ball: BallState, ballRadius: number): CollisionResult {
    const collision = this.checkCollision(ball, ballRadius);

    if (collision.type === 'rim_left' || collision.type === 'rim_right') {
      this.hitRim = true;
    }
    if (collision.type === 'backboard') {
      this.hitBackboard = true;
    }
    if (collision.type === 'through_hoop') {
      this.passedThroughHoop = true;
    }

    if (!this.passedThroughHoop) {
      this.previousBallY = ball.position.y;
    }

    return collision;
  }

  resolveShot(): { made: boolean; outcome: ShotOutcome } {
    if (this.passedThroughHoop) {
      if (!this.hitRim && !this.hitBackboard) {
        return { made: true, outcome: 'swish' };
      }
      if (this.hitBackboard) {
        return { made: true, outcome: 'backboard' };
      }
      return { made: true, outcome: 'rim_in' };
    }

    if (this.hitRim) {
      return { made: false, outcome: 'rim_out' };
    }

    return { made: false, outcome: 'airball' };
  }

  getHoopPosition(): NormalizedPosition {
    return this.config.position;
  }

  getHoopWidth(): number {
    return this.config.width;
  }

  getRimPositions(): { left: NormalizedPosition; right: NormalizedPosition } {
    const hoopX = this.config.position.x;
    const hoopY = this.config.position.y;
    const halfWidth = this.config.width / 2;

    return {
      left: { x: hoopX - halfWidth, y: hoopY },
      right: { x: hoopX + halfWidth, y: hoopY },
    };
  }

  getBackboardX(): number {
    const hoopX = this.config.position.x;
    const halfWidth = this.config.width / 2;
    return hoopX + halfWidth + this.config.backboardOffset;
  }

  hasPassedThroughHoop(): boolean {
    return this.passedThroughHoop;
  }

  hasHitRim(): boolean {
    return this.hitRim;
  }

  hasHitBackboard(): boolean {
    return this.hitBackboard;
  }

  reset(): void {
    this.passedThroughHoop = false;
    this.hitRim = false;
    this.hitBackboard = false;
    this.previousBallY = 0;
    this.trackingActive = false;
  }
}
