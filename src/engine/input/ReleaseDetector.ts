import type { HandData, ReleaseDetection, Vector2, VelocityBuffer } from '../../types';

const DEFAULT_BUFFER_SIZE = 10;
const FINGER_EXTENSION_THRESHOLD = 0.08;
const MIN_VELOCITY_MAGNITUDE = 0.01;
const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const LOW_CONFIDENCE_THRESHOLD = 0.5;
const MIN_SAMPLES_FOR_VELOCITY = 2;

export class ReleaseDetector {
  private velocityBuffer: VelocityBuffer;
  private wasRising = false;
  private prevPosition: { position: Vector2; timestamp: number } | null = null;

  constructor(bufferSize: number = DEFAULT_BUFFER_SIZE) {
    this.velocityBuffer = {
      positions: [],
      index: 0,
      size: bufferSize,
    };
  }

  update(hand: HandData, timestamp: number): ReleaseDetection {
    const instantVelocity = this.getInstantVelocity(hand.wrist, timestamp);
    
    this.addToBuffer(hand.wrist, timestamp);
    this.prevPosition = { position: { ...hand.wrist }, timestamp };

    const smoothedVelocity = this.calculateVelocity();
    const fingerExtension = this.calculateFingerExtension(hand);

    const isRising = instantVelocity.y < 0;
    const velocityReversed = this.wasRising && !isRising;
    this.wasRising = isRising;

    const fingersExtended = fingerExtension > FINGER_EXTENSION_THRESHOLD;
    const released = velocityReversed && fingersExtended;

    const power = released ? this.calculatePower(smoothedVelocity) : 0;
    const angle = released ? this.calculateAngle(smoothedVelocity) : 0;
    const confidence = released
      ? this.calculateConfidence(fingerExtension, smoothedVelocity)
      : 0;

    return {
      released,
      velocity: released ? smoothedVelocity : null,
      power,
      angle,
      confidence,
    };
  }

  reset(): void {
    this.velocityBuffer = {
      positions: [],
      index: 0,
      size: this.velocityBuffer.size,
    };
    this.wasRising = false;
    this.prevPosition = null;
  }

  private getInstantVelocity(position: Vector2, timestamp: number): Vector2 {
    if (!this.prevPosition) {
      return { x: 0, y: 0 };
    }

    const dt = timestamp - this.prevPosition.timestamp;
    if (dt <= 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: ((position.x - this.prevPosition.position.x) / dt) * 1000,
      y: ((position.y - this.prevPosition.position.y) / dt) * 1000,
    };
  }

  private addToBuffer(position: Vector2, timestamp: number): void {
    const entry = { position: { ...position }, timestamp };

    if (this.velocityBuffer.positions.length < this.velocityBuffer.size) {
      this.velocityBuffer.positions.push(entry);
    } else {
      this.velocityBuffer.positions[this.velocityBuffer.index] = entry;
    }

    this.velocityBuffer.index =
      (this.velocityBuffer.index + 1) % this.velocityBuffer.size;
  }

  private calculateVelocity(): Vector2 {
    const positions = this.velocityBuffer.positions;

    if (positions.length < MIN_SAMPLES_FOR_VELOCITY) {
      return { x: 0, y: 0 };
    }

    let totalDx = 0;
    let totalDy = 0;
    let totalDt = 0;
    let pairCount = 0;

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const dt = curr.timestamp - prev.timestamp;

      if (dt <= 0) continue;

      totalDx += curr.position.x - prev.position.x;
      totalDy += curr.position.y - prev.position.y;
      totalDt += dt;
      pairCount++;
    }

    if (pairCount === 0 || totalDt === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: (totalDx / totalDt) * 1000,
      y: (totalDy / totalDt) * 1000,
    };
  }

  /**
   * Finger extension = average of (PIP.y - TIP.y) for index and middle fingers.
   * Positive means fingertip above PIP joint (y=0 is top in normalized coords).
   */
  private calculateFingerExtension(hand: HandData): number {
    const indexTip = hand.landmarks[8];
    const indexPip = hand.landmarks[6];
    const middleTip = hand.landmarks[12];
    const middlePip = hand.landmarks[10];

    if (!indexTip || !indexPip || !middleTip || !middlePip) {
      return 0;
    }

    const indexExtension = indexPip.y - indexTip.y;
    const middleExtension = middlePip.y - middleTip.y;

    return (indexExtension + middleExtension) / 2;
  }

  private calculatePower(velocity: Vector2): number {
    const magnitude = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y,
    );
    return Math.min(1, magnitude / 2);
  }

  private calculateAngle(velocity: Vector2): number {
    return (Math.atan2(-velocity.y, velocity.x) * 180) / Math.PI;
  }

  private calculateConfidence(
    fingerExtension: number,
    velocity: Vector2,
  ): number {
    const magnitude = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y,
    );

    const hasStrongExtension = fingerExtension > FINGER_EXTENSION_THRESHOLD * 2;
    const hasStrongVelocity = magnitude > MIN_VELOCITY_MAGNITUDE * 10;

    if (hasStrongExtension && hasStrongVelocity) {
      return HIGH_CONFIDENCE_THRESHOLD + (fingerExtension * 0.2);
    }

    return LOW_CONFIDENCE_THRESHOLD + (fingerExtension * 0.3);
  }
}
