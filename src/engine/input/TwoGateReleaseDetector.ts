import type { CalibrationData } from '../../types';

const DEFAULT_CALIBRATION: CalibrationData = {
  maxReachHeight: 0.15,
  standingPosition: 0.5,
  dominantHand: 'Right',
  calibratedAt: 0,
  shoulderY: 0.35,
  waistY: 0.55,
};

const UPWARD_FRAME_THRESHOLD = 3;
const VELOCITY_REVERSAL_THRESHOLD = 0.1;
const UPWARD_VELOCITY_THRESHOLD = -0.15;

export class TwoGateReleaseDetector {
  private calibration: CalibrationData;
  private upwardFrameCount = 0;
  private wasRising = false;
  private lastReleaseTime = 0;
  private cooldownMs = 500;

  constructor(calibration?: CalibrationData) {
    this.calibration = calibration ?? DEFAULT_CALIBRATION;
  }

  updateCalibration(cal: CalibrationData): void {
    this.calibration = cal;
  }

  /**
   * Returns true if both gates are satisfied:
   * Gate 1: hand is above calibrated shoulder height
   * Gate 2: upward motion followed by a distinct downward flick
   */
  update(handY: number, velocityY: number, timestamp: number): boolean {
    if (timestamp - this.lastReleaseTime < this.cooldownMs) return false;

    const aboveShoulder = handY < this.calibration.shoulderY;

    if (velocityY < UPWARD_VELOCITY_THRESHOLD) {
      this.upwardFrameCount++;
    } else {
      if (this.upwardFrameCount >= UPWARD_FRAME_THRESHOLD) {
        this.wasRising = true;
      }
      this.upwardFrameCount = 0;
    }

    const flicked = this.wasRising && velocityY > VELOCITY_REVERSAL_THRESHOLD;

    if (aboveShoulder && flicked) {
      this.wasRising = false;
      this.upwardFrameCount = 0;
      this.lastReleaseTime = timestamp;
      return true;
    }

    if (!aboveShoulder) {
      this.wasRising = false;
      this.upwardFrameCount = 0;
    }

    return false;
  }

  reset(): void {
    this.upwardFrameCount = 0;
    this.wasRising = false;
  }
}
