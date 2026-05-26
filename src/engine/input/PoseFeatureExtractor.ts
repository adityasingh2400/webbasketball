import type { PoseLandmarkData } from '../../types';

/** MediaPipe Pose landmark indices */
export const POSE = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export interface PoseFeatures {
  /** Dominant (right) wrist position in normalized image coords */
  rightWristX: number;
  rightWristY: number;
  leftWristX: number;
  leftWristY: number;

  /** Wrist Y relative to hip center Y — positive = below hips */
  rightWristRelHipY: number;
  leftWristRelHipY: number;

  /** Whether wrist is above the shoulder line */
  rightWristAboveShoulder: boolean;
  leftWristAboveShoulder: boolean;

  /** Elbow flexion angles (radians, 0 = fully extended, PI = fully bent) */
  rightElbowAngle: number;
  leftElbowAngle: number;

  /** Hip center Y (for calibration reference) */
  hipCenterY: number;

  /** Shoulder center Y */
  shoulderCenterY: number;

  /** Average knee angle — smaller = more crouched */
  avgKneeAngle: number;

  /** Torso lateral lean: positive = leaning right */
  torsoLeanX: number;

  /** Wrist visibility (0-1, low = occluded) */
  rightWristVisibility: number;
  leftWristVisibility: number;

  /** Which wrist is lower (closer to ground) — likely the dribble hand */
  lowerHand: 'left' | 'right';

  /** Whether pose data is valid (all key landmarks visible) */
  valid: boolean;
}

function angleBetween(
  a: PoseLandmarkData,
  b: PoseLandmarkData,
  c: PoseLandmarkData,
): number {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const dot = bax * bcx + bay * bcy;
  const magBA = Math.hypot(bax, bay);
  const magBC = Math.hypot(bcx, bcy);
  if (magBA < 1e-6 || magBC < 1e-6) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC))));
}

const EMPTY_FEATURES: PoseFeatures = {
  rightWristX: 0.5,
  rightWristY: 0.5,
  leftWristX: 0.5,
  leftWristY: 0.5,
  rightWristRelHipY: 0,
  leftWristRelHipY: 0,
  rightWristAboveShoulder: false,
  leftWristAboveShoulder: false,
  rightElbowAngle: Math.PI,
  leftElbowAngle: Math.PI,
  hipCenterY: 0.6,
  shoulderCenterY: 0.35,
  avgKneeAngle: Math.PI,
  torsoLeanX: 0,
  rightWristVisibility: 0,
  leftWristVisibility: 0,
  lowerHand: 'right',
  valid: false,
};

/**
 * Extracts geometric features from 33 PoseLandmarker landmarks.
 * All coordinates are in normalized image space (0-1), where:
 * - x=0 is left edge of image (user's right side due to mirror)
 * - y=0 is top of image
 * The mirror flip (1-x) is handled at the hook level, not here.
 */
export class PoseFeatureExtractor {
  private lastFeatures: PoseFeatures = { ...EMPTY_FEATURES };

  extract(landmarks: PoseLandmarkData[]): PoseFeatures {
    if (landmarks.length < 33) {
      this.lastFeatures = { ...EMPTY_FEATURES };
      return this.lastFeatures;
    }

    const lShoulder = landmarks[POSE.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE.RIGHT_SHOULDER];
    const lElbow = landmarks[POSE.LEFT_ELBOW];
    const rElbow = landmarks[POSE.RIGHT_ELBOW];
    const lWrist = landmarks[POSE.LEFT_WRIST];
    const rWrist = landmarks[POSE.RIGHT_WRIST];
    const lHip = landmarks[POSE.LEFT_HIP];
    const rHip = landmarks[POSE.RIGHT_HIP];
    const lKnee = landmarks[POSE.LEFT_KNEE];
    const rKnee = landmarks[POSE.RIGHT_KNEE];
    const lAnkle = landmarks[POSE.LEFT_ANKLE];
    const rAnkle = landmarks[POSE.RIGHT_ANKLE];

    const minVis = Math.min(
      lShoulder.visibility,
      rShoulder.visibility,
      lHip.visibility,
      rHip.visibility,
    );
    if (minVis < 0.3) {
      this.lastFeatures = { ...EMPTY_FEATURES };
      return this.lastFeatures;
    }

    const hipCenterY = (lHip.y + rHip.y) / 2;
    const shoulderCenterY = (lShoulder.y + rShoulder.y) / 2;

    const rightElbowAngle = angleBetween(rShoulder, rElbow, rWrist);
    const leftElbowAngle = angleBetween(lShoulder, lElbow, lWrist);

    const rightKneeAngle = angleBetween(rHip, rKnee, rAnkle);
    const leftKneeAngle = angleBetween(lHip, lKnee, lAnkle);
    const avgKneeAngle = (rightKneeAngle + leftKneeAngle) / 2;

    const torsoLeanX = (rShoulder.x + rHip.x) / 2 - (lShoulder.x + lHip.x) / 2;

    this.lastFeatures = {
      rightWristX: rWrist.x,
      rightWristY: rWrist.y,
      leftWristX: lWrist.x,
      leftWristY: lWrist.y,
      rightWristRelHipY: rWrist.y - hipCenterY,
      leftWristRelHipY: lWrist.y - hipCenterY,
      rightWristAboveShoulder: rWrist.y < rShoulder.y,
      leftWristAboveShoulder: lWrist.y < lShoulder.y,
      rightElbowAngle,
      leftElbowAngle,
      hipCenterY,
      shoulderCenterY,
      avgKneeAngle,
      torsoLeanX,
      rightWristVisibility: rWrist.visibility,
      leftWristVisibility: lWrist.visibility,
      lowerHand: rWrist.y > lWrist.y ? 'right' : 'left',
      valid: true,
    };

    return this.lastFeatures;
  }

  getLastFeatures(): PoseFeatures {
    return this.lastFeatures;
  }
}
