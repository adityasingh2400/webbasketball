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

export interface NormalizedPosition {
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
  confidence: number;
  wrist: Vector2;
  indexTip: Vector2;
  fingerExtension: number;
}

export interface TrackingFrame {
  timestamp: number;
  hands: HandData[];
  isTracking: boolean;
}

// ============================================
// Input Types
// ============================================

export interface VelocityBuffer {
  positions: Array<{ position: Vector2; timestamp: number }>;
  index: number;
  size: number;
}

export interface ReleaseDetection {
  released: boolean;
  velocity: Vector2 | null;
  power: number;
  angle: number;
  confidence: number;
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
// Audio Types
// ============================================

export type SoundEffect =
  | 'swish'
  | 'rim'
  | 'bounce'
  | 'dribble'
  | 'crowd_cheer'
  | 'crowd_groan'
  | 'whoosh'
  | 'countdown';
