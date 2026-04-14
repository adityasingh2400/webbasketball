/**
 * Detects shot release via wrist flick using MediaPipe HandLandmarker (21 landmarks).
 *
 * The flick is the transition from cupped (fingers curled, wrist extended back)
 * to released (fingers extending/pointing down, wrist flexing forward).
 * We measure the angle between the wrist-to-MCP line and the MCP-to-fingertip line.
 *
 * MediaPipe Hand Landmark indices:
 *   0 = WRIST
 *   5 = INDEX_FINGER_MCP
 *   9 = MIDDLE_FINGER_MCP
 *  12 = MIDDLE_FINGER_TIP
 *  17 = PINKY_MCP
 */

export interface HandLandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface FlickState {
  detected: boolean;
  confidence: number;
  wristAngle: number;
  angleVelocity: number;
}

const WRIST = 0;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const PINKY_MCP = 17;

const ANGLE_HISTORY_SIZE = 5;
const CUPPED_ANGLE_MAX = 145;
const FLICK_ANGLE_VELOCITY_THRESHOLD = 8;
const COOLDOWN_MS = 600;
const ABOVE_SHOULDER_GATE = true;

function angleBetweenDeg(
  a: HandLandmarkPoint,
  b: HandLandmarkPoint,
  c: HandLandmarkPoint,
): number {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const dot = bax * bcx + bay * bcy;
  const magBA = Math.hypot(bax, bay);
  const magBC = Math.hypot(bcx, bcy);
  if (magBA < 1e-6 || magBC < 1e-6) return 180;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

function palmOpenness(landmarks: HandLandmarkPoint[]): number {
  const mcpCenter = {
    x: (landmarks[INDEX_MCP].x + landmarks[MIDDLE_MCP].x + landmarks[RING_MCP].x + landmarks[PINKY_MCP].x) / 4,
    y: (landmarks[INDEX_MCP].y + landmarks[MIDDLE_MCP].y + landmarks[RING_MCP].y + landmarks[PINKY_MCP].y) / 4,
    z: 0,
  };
  return angleBetweenDeg(landmarks[WRIST], mcpCenter, landmarks[MIDDLE_TIP]);
}

export class WristFlickDetector {
  private angleHistory: number[] = [];
  private lastFlickTime = 0;
  private wasCupped = false;
  private cuppedMinAngle = CUPPED_ANGLE_MAX;
  private flickVelocityThreshold = FLICK_ANGLE_VELOCITY_THRESHOLD;
  private cooldownMs = COOLDOWN_MS;
  private requireAboveShoulder = ABOVE_SHOULDER_GATE;

  constructor(config?: {
    cuppedMinAngle?: number;
    flickVelocityThreshold?: number;
    cooldownMs?: number;
    requireAboveShoulder?: boolean;
  }) {
    if (config?.cuppedMinAngle !== undefined) this.cuppedMinAngle = config.cuppedMinAngle;
    if (config?.flickVelocityThreshold !== undefined) this.flickVelocityThreshold = config.flickVelocityThreshold;
    if (config?.cooldownMs !== undefined) this.cooldownMs = config.cooldownMs;
    if (config?.requireAboveShoulder !== undefined) this.requireAboveShoulder = config.requireAboveShoulder;
  }

  /**
   * Call every frame with the 21 hand landmarks and whether the hand is above the shoulder.
   * Returns the current flick state with detection result and confidence.
   */
  update(
    handLandmarks: HandLandmarkPoint[] | null,
    handAboveShoulder: boolean,
    timestamp: number,
  ): FlickState {
    const noDetect: FlickState = { detected: false, confidence: 0, wristAngle: 0, angleVelocity: 0 };

    if (!handLandmarks || handLandmarks.length < 21) {
      this.angleHistory = [];
      this.wasCupped = false;
      return noDetect;
    }

    if (timestamp - this.lastFlickTime < this.cooldownMs) {
      return noDetect;
    }

    const angle = palmOpenness(handLandmarks);

    this.angleHistory.push(angle);
    if (this.angleHistory.length > ANGLE_HISTORY_SIZE) {
      this.angleHistory.shift();
    }

    let angleVelocity = 0;
    if (this.angleHistory.length >= 2) {
      const oldest = this.angleHistory[0];
      const newest = this.angleHistory[this.angleHistory.length - 1];
      angleVelocity = (newest - oldest) / this.angleHistory.length;
    }

    if (angle < this.cuppedMinAngle) {
      this.wasCupped = true;
    }

    const shoulderGatePassed = !this.requireAboveShoulder || handAboveShoulder;
    const flickDetected = this.wasCupped
      && shoulderGatePassed
      && angleVelocity > this.flickVelocityThreshold
      && angle > this.cuppedMinAngle + 15;

    const confidence = flickDetected
      ? Math.min(1, angleVelocity / (this.flickVelocityThreshold * 2))
      : 0;

    if (flickDetected) {
      this.wasCupped = false;
      this.angleHistory = [];
      this.lastFlickTime = timestamp;
    }

    if (!handAboveShoulder && angle > 160) {
      this.wasCupped = false;
    }

    return {
      detected: flickDetected,
      confidence,
      wristAngle: angle,
      angleVelocity,
    };
  }

  updateThresholds(config: {
    cuppedMinAngle?: number;
    flickVelocityThreshold?: number;
  }): void {
    if (config.cuppedMinAngle !== undefined) this.cuppedMinAngle = config.cuppedMinAngle;
    if (config.flickVelocityThreshold !== undefined) this.flickVelocityThreshold = config.flickVelocityThreshold;
  }

  reset(): void {
    this.angleHistory = [];
    this.wasCupped = false;
    this.lastFlickTime = 0;
  }
}
