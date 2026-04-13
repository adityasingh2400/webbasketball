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
