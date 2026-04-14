/**
 * Gesture calibration system.
 *
 * Captures per-player movement ranges during a brief calibration session,
 * then computes adaptive thresholds for dribble, crossover, shot gather,
 * and wrist flick detection.
 *
 * The calibration produces thresholds at 60-70% of observed maximums,
 * meaning you only need to do ~70% of your calibration intensity to trigger.
 */

export interface GestureThresholds {
  dribbleVelocityY: number;
  crossoverVelocityX: number;
  gatherVelocityY: number;
  flickAngleVelocity: number;
  flickCuppedAngle: number;
  shoulderY: number;
  hipY: number;
}

export interface CalibrationSamples {
  dribbleVelocities: number[];
  crossoverVelocities: number[];
  gatherVelocities: number[];
  flickAngleVelocities: number[];
  flickCuppedAngles: number[];
  shoulderYs: number[];
  hipYs: number[];
}

const DEFAULT_THRESHOLDS: GestureThresholds = {
  dribbleVelocityY: 0.3,
  crossoverVelocityX: 0.6,
  gatherVelocityY: -0.5,
  flickAngleVelocity: 8,
  flickCuppedAngle: 145,
  shoulderY: 0.3,
  hipY: 0.55,
};

const THRESHOLD_RATIO = 0.65;

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

export type CalibrationPhase = 'idle' | 'stand' | 'dribble' | 'shoot' | 'done';

export class GestureCalibrator {
  private samples: CalibrationSamples = this.emptySamples();
  private phase: CalibrationPhase = 'idle';
  private phaseStartTime = 0;
  private thresholds: GestureThresholds = { ...DEFAULT_THRESHOLDS };

  getPhase(): CalibrationPhase {
    return this.phase;
  }

  getThresholds(): GestureThresholds {
    return { ...this.thresholds };
  }

  getDefaultThresholds(): GestureThresholds {
    return { ...DEFAULT_THRESHOLDS };
  }

  startCalibration(): void {
    this.samples = this.emptySamples();
    this.phase = 'stand';
    this.phaseStartTime = performance.now();
  }

  advancePhase(): void {
    if (this.phase === 'stand') {
      this.phase = 'dribble';
    } else if (this.phase === 'dribble') {
      this.phase = 'shoot';
    } else if (this.phase === 'shoot') {
      this.computeThresholds();
      this.phase = 'done';
    }
    this.phaseStartTime = performance.now();
  }

  getPhaseElapsed(): number {
    return performance.now() - this.phaseStartTime;
  }

  /**
   * Feed samples during each calibration phase.
   * Call every frame while calibrating.
   */
  addSample(data: {
    shoulderY?: number;
    hipY?: number;
    dribbleVelocityY?: number;
    crossoverVelocityX?: number;
    gatherVelocityY?: number;
    flickAngleVelocity?: number;
    flickCuppedAngle?: number;
  }): void {
    if (this.phase === 'stand') {
      if (data.shoulderY !== undefined) this.samples.shoulderYs.push(data.shoulderY);
      if (data.hipY !== undefined) this.samples.hipYs.push(data.hipY);
    }

    if (this.phase === 'dribble') {
      if (data.dribbleVelocityY !== undefined && data.dribbleVelocityY > 0.05) {
        this.samples.dribbleVelocities.push(data.dribbleVelocityY);
      }
      if (data.crossoverVelocityX !== undefined && Math.abs(data.crossoverVelocityX) > 0.1) {
        this.samples.crossoverVelocities.push(Math.abs(data.crossoverVelocityX));
      }
    }

    if (this.phase === 'shoot') {
      if (data.gatherVelocityY !== undefined && data.gatherVelocityY < -0.1) {
        this.samples.gatherVelocities.push(data.gatherVelocityY);
      }
      if (data.flickAngleVelocity !== undefined && data.flickAngleVelocity > 1) {
        this.samples.flickAngleVelocities.push(data.flickAngleVelocity);
      }
      if (data.flickCuppedAngle !== undefined && data.flickCuppedAngle < 160) {
        this.samples.flickCuppedAngles.push(data.flickCuppedAngle);
      }
    }
  }

  private computeThresholds(): void {
    const t = { ...DEFAULT_THRESHOLDS };

    if (this.samples.shoulderYs.length > 5) {
      t.shoulderY = percentile(this.samples.shoulderYs, 0.5);
    }
    if (this.samples.hipYs.length > 5) {
      t.hipY = percentile(this.samples.hipYs, 0.5);
    }

    if (this.samples.dribbleVelocities.length > 3) {
      const p80 = percentile(this.samples.dribbleVelocities, 0.8);
      t.dribbleVelocityY = p80 * THRESHOLD_RATIO;
    }

    if (this.samples.crossoverVelocities.length > 3) {
      const p80 = percentile(this.samples.crossoverVelocities, 0.8);
      t.crossoverVelocityX = p80 * THRESHOLD_RATIO;
    }

    if (this.samples.gatherVelocities.length > 2) {
      const p80 = percentile(this.samples.gatherVelocities, 0.2);
      t.gatherVelocityY = p80 * THRESHOLD_RATIO;
    }

    if (this.samples.flickAngleVelocities.length > 2) {
      const p80 = percentile(this.samples.flickAngleVelocities, 0.8);
      t.flickAngleVelocity = p80 * THRESHOLD_RATIO;
    }

    if (this.samples.flickCuppedAngles.length > 2) {
      const p50 = percentile(this.samples.flickCuppedAngles, 0.5);
      t.flickCuppedAngle = p50 + 10;
    }

    this.thresholds = t;
  }

  skipCalibration(): void {
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    this.phase = 'done';
  }

  reset(): void {
    this.samples = this.emptySamples();
    this.phase = 'idle';
    this.thresholds = { ...DEFAULT_THRESHOLDS };
  }

  private emptySamples(): CalibrationSamples {
    return {
      dribbleVelocities: [],
      crossoverVelocities: [],
      gatherVelocities: [],
      flickAngleVelocities: [],
      flickCuppedAngles: [],
      shoulderYs: [],
      hipYs: [],
    };
  }
}
