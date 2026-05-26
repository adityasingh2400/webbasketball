import type { PoseFeatures } from './PoseFeatureExtractor';
import type { BallInput } from '../BallStateMachine';
import type { GestureThresholds } from './GestureCalibrator';

export interface WorldSpaceAngles {
  rightElbowAngle3D: number;
  leftElbowAngle3D: number;
  rightWristAboveShoulderWorld: boolean;
  leftWristAboveShoulderWorld: boolean;
}

export interface GestureConfidence {
  dribble: number;
  crossover: number;
  gather: number;
  overall: number;
}

export interface BodyCalibration {
  shoulderY: number;
  hipY: number;
  restingWristY: number;
  velocityScale: number;
  dominant: 'left' | 'right';
  calibratedAt: number;
}

const DEFAULT_CALIBRATION: BodyCalibration = {
  shoulderY: 0.3,
  hipY: 0.55,
  restingWristY: 0.58,
  velocityScale: 1.0,
  dominant: 'right',
  calibratedAt: 0,
};

const CROSSOVER_VX_THRESHOLD = 0.6;
const DRIBBLE_VY_THRESHOLD = 0.3;
const GATHER_VY_THRESHOLD = -0.5;
const WRIST_BELOW_HIP_THRESHOLD = 0.03;

/**
 * Rule-based classifier that maps PoseFeatures + wrist velocity
 * into BallInput for the BallStateMachine.
 */
export class PoseStateClassifier {
  private calibration: BodyCalibration;
  private adaptiveThresholds: GestureThresholds | null = null;
  private lastConfidence: GestureConfidence = { dribble: 0, crossover: 0, gather: 0, overall: 0 };

  constructor(calibration?: BodyCalibration) {
    this.calibration = calibration ?? { ...DEFAULT_CALIBRATION };
  }

  updateCalibration(cal: Partial<BodyCalibration>): void {
    this.calibration = { ...this.calibration, ...cal };
  }

  setAdaptiveThresholds(thresholds: GestureThresholds): void {
    this.adaptiveThresholds = thresholds;
  }

  getCalibration(): BodyCalibration {
    return { ...this.calibration };
  }

  getLastConfidence(): GestureConfidence {
    return { ...this.lastConfidence };
  }

  private get dribbleThreshold(): number {
    return this.adaptiveThresholds?.dribbleVelocityY ?? DRIBBLE_VY_THRESHOLD;
  }

  private get crossoverThreshold(): number {
    return this.adaptiveThresholds?.crossoverVelocityX ?? CROSSOVER_VX_THRESHOLD;
  }

  private get gatherThreshold(): number {
    return this.adaptiveThresholds?.gatherVelocityY ?? GATHER_VY_THRESHOLD;
  }

  classify(
    features: PoseFeatures,
    wristVelocity: { x: number; y: number },
    released: boolean,
    worldAngles?: WorldSpaceAngles,
  ): BallInput {
    if (!features.valid) {
      return {
        velocityX: 0,
        velocityY: 0,
        dribblePressed: false,
        handSide: this.calibration.dominant === 'left' ? 'left' : 'right',
        released: false,
        timeSinceStateEnter: 0,
      };
    }

    const vScale = this.calibration.velocityScale;
    const scaledVx = -wristVelocity.x * vScale;
    const scaledVy = wristVelocity.y * vScale;

    const handSide = this.detectDribbleHand(features);
    let gameVx = this.computeGameVelocityX(scaledVx);
    const gameVy = this.computeGameVelocityY(scaledVy, features);

    if (worldAngles) {
      const dominantElbow = handSide === 'right' ? worldAngles.rightElbowAngle3D : worldAngles.leftElbowAngle3D;
      if (dominantElbow > 2.4 && Math.abs(gameVx) > 0.2) {
        gameVx *= 1.3;
      }
    }

    const dribbleConf = gameVy > 0 ? Math.min(1, gameVy / (this.dribbleThreshold * 2)) : 0;
    const crossoverConf = Math.abs(gameVx) > this.crossoverThreshold * 0.5
      ? Math.min(1, Math.abs(gameVx) / (this.crossoverThreshold * 1.5))
      : 0;
    const gatherConf = gameVy < 0 ? Math.min(1, Math.abs(gameVy) / Math.abs(this.gatherThreshold * 1.5)) : 0;
    this.lastConfidence = {
      dribble: dribbleConf,
      crossover: crossoverConf,
      gather: gatherConf,
      overall: Math.max(dribbleConf, crossoverConf, gatherConf),
    };

    return {
      velocityX: gameVx,
      velocityY: gameVy,
      dribblePressed: gameVy > 0,
      handSide,
      released,
      timeSinceStateEnter: 0,
    };
  }

  private detectDribbleHand(features: PoseFeatures): 'left' | 'right' {
    return features.lowerHand;
  }

  private computeGameVelocityX(scaledVx: number): number {
    if (Math.abs(scaledVx) < this.crossoverThreshold * 0.5) return 0;
    return scaledVx;
  }

  private computeGameVelocityY(
    scaledVy: number,
    features: PoseFeatures,
  ): number {
    const wristBelowHip =
      features.rightWristRelHipY > WRIST_BELOW_HIP_THRESHOLD ||
      features.leftWristRelHipY > WRIST_BELOW_HIP_THRESHOLD;

    if (wristBelowHip && scaledVy > this.dribbleThreshold) {
      return scaledVy;
    }

    if (scaledVy < this.gatherThreshold) {
      return scaledVy;
    }

    if (Math.abs(scaledVy) < this.dribbleThreshold) {
      return 0;
    }

    return scaledVy;
  }

  calibrateFromSamples(samples: PoseFeatures[]): BodyCalibration {
    if (samples.length === 0) return this.calibration;

    const validSamples = samples.filter((s) => s.valid);
    if (validSamples.length === 0) return this.calibration;

    const avgShoulderY =
      validSamples.reduce((s, f) => s + f.shoulderCenterY, 0) / validSamples.length;
    const avgHipY =
      validSamples.reduce((s, f) => s + f.hipCenterY, 0) / validSamples.length;
    const avgWristY =
      validSamples.reduce((s, f) => s + (f.rightWristY + f.leftWristY) / 2, 0) /
      validSamples.length;

    this.calibration = {
      shoulderY: avgShoulderY,
      hipY: avgHipY,
      restingWristY: avgWristY,
      velocityScale: 1.0,
      dominant: 'right',
      calibratedAt: Date.now(),
    };

    return { ...this.calibration };
  }
}
