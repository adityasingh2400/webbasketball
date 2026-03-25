/**
 * WebBall Type Definitions
 * Core types for the basketball game engine
 */

// ============================================
// Vector & Position Types
// ============================================

export interface Vector2 {
  x: number;
  y: number;
}

export interface NormalizedPosition {
  /** 0-1 normalized x position (0 = left, 1 = right) */
  x: number;
  /** 0-1 normalized y position (0 = top, 1 = bottom) */
  y: number;
}

// ============================================
// Hand Tracking Types
// ============================================

export interface HandLandmark {
  /** Landmark index (0-20 for 21 landmarks) */
  index: number;
  /** Normalized x position (0-1) */
  x: number;
  /** Normalized y position (0-1) */
  y: number;
  /** Depth/z position (normalized) */
  z: number;
}

export interface HandData {
  /** All 21 hand landmarks */
  landmarks: HandLandmark[];
  /** Handedness: 'Left' or 'Right' */
  handedness: 'Left' | 'Right';
  /** Detection confidence (0-1) */
  confidence: number;
  /** Wrist position (landmark 0) */
  wrist: Vector2;
  /** Index finger tip position (landmark 8) */
  indexTip: Vector2;
  /** Finger extension ratio (0-1, 1 = fully extended) */
  fingerExtension: number;
}

export interface TrackingFrame {
  /** Timestamp in ms */
  timestamp: number;
  /** Detected hands (usually 1-2) */
  hands: HandData[];
  /** Whether tracking is active */
  isTracking: boolean;
}

// ============================================
// Game State Types
// ============================================

export type GameState = 
  | 'IDLE'
  | 'HOLDING'
  | 'DRIBBLING'
  | 'GATHERING'
  | 'SHOOTING'
  | 'IN_FLIGHT'
  | 'RESOLVING'
  | 'SCORED'
  | 'MISSED'
  | 'COOLDOWN';

export type ShotOutcome = 'swish' | 'rim_in' | 'rim_out' | 'airball' | 'backboard';

export interface GameContext {
  /** Current game state */
  state: GameState;
  /** Ball position in normalized coordinates */
  ballPosition: NormalizedPosition;
  /** Ball velocity in normalized units per second */
  ballVelocity: Vector2;
  /** Current score */
  score: number;
  /** Current streak (consecutive makes) */
  streak: number;
  /** Highest streak this session */
  bestStreak: number;
  /** Total shots taken */
  shotsAttempted: number;
  /** Shots made */
  shotsMade: number;
  /** Time remaining in seconds (if timed mode) */
  timeRemaining: number | null;
  /** Dominant hand preference */
  dominantHand: 'Left' | 'Right';
  /** Last shot outcome */
  lastShotOutcome: ShotOutcome | null;
}

// ============================================
// Physics Types
// ============================================

export interface BallState {
  /** Position in normalized coordinates (0-1) */
  position: NormalizedPosition;
  /** Velocity in normalized units per second */
  velocity: Vector2;
  /** Angular velocity (radians per second) */
  angularVelocity: number;
  /** Current rotation angle (radians) */
  rotation: number;
  /** Whether ball is in flight (affected by gravity) */
  inFlight: boolean;
}

export interface HoopConfig {
  /** Hoop center position in normalized coordinates */
  position: NormalizedPosition;
  /** Hoop width in normalized units */
  width: number;
  /** Rim thickness in normalized units */
  rimThickness: number;
  /** Backboard position relative to hoop */
  backboardOffset: number;
}

export interface PhysicsConfig {
  /** Gravity in normalized units per second squared */
  gravity: number;
  /** Air drag coefficient (0-1) */
  drag: number;
  /** Bounce coefficient for rim/backboard (0-1) */
  bounce: number;
  /** Ball radius in normalized units */
  ballRadius: number;
}

// ============================================
// Rendering Types
// ============================================

export interface RenderConfig {
  /** Target canvas width */
  width: number;
  /** Target canvas height */
  height: number;
  /** Whether to mirror the video feed */
  mirrorVideo: boolean;
  /** Maximum particle count */
  maxParticles: number;
  /** Enable screen shake effects */
  enableScreenShake: boolean;
}

export interface ParticleConfig {
  /** Starting position */
  position: Vector2;
  /** Initial velocity */
  velocity: Vector2;
  /** Particle color (hex) */
  color: number;
  /** Particle size */
  size: number;
  /** Lifetime in seconds */
  lifetime: number;
  /** Fade out (0-1 over lifetime) */
  fadeOut: boolean;
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

export interface AudioConfig {
  /** Master volume (0-1) */
  masterVolume: number;
  /** Sound effects volume (0-1) */
  sfxVolume: number;
  /** Music volume (0-1) */
  musicVolume: number;
  /** Whether audio is muted */
  muted: boolean;
}

// ============================================
// Event Types
// ============================================

export type GameEvent =
  | { type: 'HAND_DETECTED'; hand: HandData }
  | { type: 'HAND_LOST' }
  | { type: 'DRIBBLE_START' }
  | { type: 'DRIBBLE_BOUNCE' }
  | { type: 'GATHER_START' }
  | { type: 'SHOT_RELEASED'; power: number; angle: number }
  | { type: 'BALL_IN_FLIGHT' }
  | { type: 'BALL_HIT_RIM' }
  | { type: 'BALL_HIT_BACKBOARD' }
  | { type: 'SHOT_MADE'; outcome: ShotOutcome }
  | { type: 'SHOT_MISSED'; outcome: ShotOutcome }
  | { type: 'STREAK_BROKEN' }
  | { type: 'NEW_BEST_STREAK'; streak: number }
  | { type: 'GAME_STARTED' }
  | { type: 'GAME_PAUSED' }
  | { type: 'GAME_RESUMED' }
  | { type: 'GAME_ENDED' }
  | { type: 'TIMER_TICK'; remaining: number }
  | { type: 'CALIBRATION_STARTED' }
  | { type: 'CALIBRATION_COMPLETE' }
  | { type: 'STATE_CHANGED'; state: GameState };

export type GameEventListener = (event: GameEvent) => void;

// ============================================
// Input Types
// ============================================

export interface VelocityBuffer {
  /** Circular buffer of recent positions */
  positions: Array<{ position: Vector2; timestamp: number }>;
  /** Current buffer index */
  index: number;
  /** Buffer size */
  size: number;
}

export interface ReleaseDetection {
  /** Whether a release was detected */
  released: boolean;
  /** Release velocity (if released) */
  velocity: Vector2 | null;
  /** Release power (0-1) */
  power: number;
  /** Release angle in degrees */
  angle: number;
  /** Confidence of detection (0-1) */
  confidence: number;
}

// ============================================
// Calibration Types
// ============================================

export interface CalibrationData {
  /** Player's maximum reach height (normalized y) */
  maxReachHeight: number;
  /** Player's standing position (normalized x center) */
  standingPosition: number;
  /** Detected dominant hand */
  dominantHand: 'Left' | 'Right';
  /** Calibration timestamp */
  calibratedAt: number;
}

// ============================================
// Engine Lifecycle Types
// ============================================

export interface EngineConfig {
  /** Container element for the game canvas */
  container: HTMLElement;
  /** Video element for webcam feed */
  videoElement: HTMLVideoElement;
  /** Rendering configuration */
  render: Partial<RenderConfig>;
  /** Physics configuration */
  physics: Partial<PhysicsConfig>;
  /** Audio configuration */
  audio: Partial<AudioConfig>;
  /** Hoop configuration */
  hoop: Partial<HoopConfig>;
  /** Calibration data (if available) */
  calibration?: CalibrationData;
}

export interface EngineState {
  /** Whether engine is initialized */
  initialized: boolean;
  /** Whether engine is running */
  running: boolean;
  /** Current FPS */
  fps: number;
  /** Frame time in ms */
  frameTime: number;
  /** Whether MediaPipe is loaded */
  mediaPipeLoaded: boolean;
  /** Loading progress (0-1) */
  loadProgress: number;
  /** Error message (if any) */
  error: string | null;
}

// ============================================
// Player Avatar Types
// ============================================

export type PlayerAnimationState =
  | 'idle'
  | 'dribble'
  | 'gather'
  | 'shoot'
  | 'follow_through'
  | 'celebrate';

export interface PlayerState {
  /** Player position in normalized coordinates */
  position: NormalizedPosition;
  /** Current animation state */
  animationState: PlayerAnimationState;
  /** Direction player is facing */
  facingDirection: 'left' | 'right';
  /** Whether ball is attached to player */
  ballAttached: boolean;
}

export interface PlayerConfig {
  /** Base scale multiplier for player size */
  baseScale: number;
  /** Shadow opacity (0-1) */
  shadowAlpha: number;
  /** Position smoothing factor (0-1, higher = more responsive) */
  smoothingFactor: number;
}

// ============================================
// Court Presentation Types
// ============================================

export type CourtZone =
  | 'paint'
  | 'three_point'
  | 'half_court'
  | 'full_court';

export interface CourtConfig {
  /** Amount of perspective narrowing at top (0-1) */
  perspective: number;
  /** Whether to show three-point line */
  showThreePointLine: boolean;
  /** Whether to show the key/paint area */
  showKey: boolean;
  /** Whether to show half-court line */
  showHalfCourt: boolean;
  /** Court floor color (hex) */
  floorColor: number;
  /** Court line color (hex) */
  lineColor: number;
  /** Line width in pixels */
  lineWidth: number;
}

// ============================================
// HUD Component Types
// ============================================

export interface ShotMeterConfig {
  /** Meter width in pixels */
  width: number;
  /** Meter height in pixels */
  height: number;
  /** Oscillation speed (cycles per second) */
  oscillationSpeed: number;
  /** Start of sweet spot zone (0-1) */
  sweetSpotMin: number;
  /** End of sweet spot zone (0-1) */
  sweetSpotMax: number;
  /** Color configuration */
  colors: {
    low: number;
    mid: number;
    high: number;
    perfect: number;
  };
}

export interface ScoreAnimationConfig {
  /** Animation duration in ms */
  duration: number;
  /** Distance to float up in pixels */
  floatDistance: number;
  /** Font size for popup */
  fontSize: number;
  /** Font color (hex) */
  fontColor: number;
}

export interface StreakConfig {
  /** Streak count to trigger fire effect */
  fireThreshold: number;
  /** Position of streak counter */
  position: { x: number; y: number };
}
