/**
 * WebBall Type Definitions
 * Core types for the 3D basketball game
 */

// ============================================
// Vector & Position Types
// ============================================

export interface Vector2 {
  x: number;
  y: number;
}

// ============================================
// Hand Tracking Types
// ============================================

export interface HandLandmark {
  index: number;
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
  wrist: Vector2;
}

export interface TrackingFrame {
  timestamp: number;
  hands: HandData[];
  isTracking: boolean;
}

// ============================================
// Calibration Types
// ============================================

export interface CalibrationData {
  maxReachHeight: number;
  standingPosition: number;
  dominantHand: 'Left' | 'Right';
  calibratedAt: number;
  shoulderY: number;
  waistY: number;
}

// ============================================
// Body Pose Tracking Types (PoseLandmarker)
// ============================================

export interface PoseLandmarkData {
  index: number;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface BodyTrackingFrame {
  timestamp: number;
  /** 33 normalized image-space landmarks, or null if no body detected */
  landmarks: PoseLandmarkData[] | null;
  /** 33 world-space landmarks in meters (hip-centered), or null */
  worldLandmarks: PoseLandmarkData[] | null;
  isTracking: boolean;
}
