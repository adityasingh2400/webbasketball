import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { HandData, HandLandmark, TrackingFrame, Vector2 } from '../../types';

export type HandTrackerState = {
  isLoading: boolean;
  loadProgress: number;
  isTracking: boolean;
  error: string | null;
};

type NormalizedLandmarkPoint = { x: number; y: number; z: number; visibility: number };

const LANDMARK_INDEX = {
  WRIST: 0,
  INDEX_TIP: 8,
  INDEX_PIP: 6,
  MIDDLE_TIP: 12,
  MIDDLE_PIP: 10,
} as const;

const WASM_BASE_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const MIN_HAND_DETECTION_CONFIDENCE = 0.7;
const MIN_HAND_PRESENCE_CONFIDENCE = 0.7;
const MIN_TRACKING_CONFIDENCE = 0.7;
const MAX_HANDS = 2;

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private state: HandTrackerState = {
    isLoading: false,
    loadProgress: 0,
    isTracking: false,
    error: null,
  };
  private onStateChange: ((state: HandTrackerState) => void) | null = null;

  async initialize(
    onStateChange?: (state: HandTrackerState) => void,
  ): Promise<void> {
    if (onStateChange) {
      this.onStateChange = onStateChange;
    }

    this.updateState({ isLoading: true, loadProgress: 0, error: null });

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
      this.updateState({ loadProgress: 0.3 });

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: MAX_HANDS,
        minHandDetectionConfidence: MIN_HAND_DETECTION_CONFIDENCE,
        minHandPresenceConfidence: MIN_HAND_PRESENCE_CONFIDENCE,
        minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
      });

      this.updateState({
        isLoading: false,
        loadProgress: 1,
        isTracking: true,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to initialize hand tracking';

      this.updateState({
        isLoading: false,
        loadProgress: 0,
        isTracking: false,
        error: message,
      });
    }
  }

  processFrame(videoElement: HTMLVideoElement): TrackingFrame {
    const timestamp = performance.now();

    if (!this.handLandmarker || !this.state.isTracking) {
      return { timestamp, hands: [], isTracking: false };
    }

    if (videoElement.readyState < 2) {
      return { timestamp, hands: [], isTracking: true };
    }

    try {
      const result = this.handLandmarker.detectForVideo(
        videoElement,
        timestamp,
      );

      const hands: HandData[] = result.landmarks.map(
        (handLandmarks: NormalizedLandmarkPoint[], handIndex: number) => {
          const landmarks: HandLandmark[] = handLandmarks.map(
            (lm: NormalizedLandmarkPoint, lmIndex: number) => ({
              index: lmIndex,
              x: lm.x,
              y: lm.y,
              z: lm.z,
            }),
          );

          const wrist = this.landmarkToVector2(
            handLandmarks[LANDMARK_INDEX.WRIST],
          );
          const indexTip = this.landmarkToVector2(
            handLandmarks[LANDMARK_INDEX.INDEX_TIP],
          );

          const handednessCategory = result.handedness[handIndex]?.[0];
          const handedness: 'Left' | 'Right' =
            handednessCategory?.categoryName === 'Left' ? 'Left' : 'Right';
          const confidence = handednessCategory?.score ?? 0;

          const fingerExtension =
            this.calculateFingerExtension(handLandmarks);

          return {
            landmarks,
            handedness,
            confidence,
            wrist,
            indexTip,
            fingerExtension,
          };
        },
      );

      return { timestamp, hands, isTracking: true };
    } catch (_error: unknown) {
      this.updateState({
        error: 'Frame processing failed',
        isTracking: false,
      });
      return { timestamp, hands: [], isTracking: false };
    }
  }

  getState(): HandTrackerState {
    return { ...this.state };
  }

  close(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }

    this.updateState({
      isTracking: false,
      isLoading: false,
      loadProgress: 0,
      error: null,
    });
    this.onStateChange = null;
  }

  private updateState(partial: Partial<HandTrackerState>): void {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.getState());
  }

  private landmarkToVector2(landmark: { x: number; y: number }): Vector2 {
    return { x: landmark.x, y: landmark.y };
  }

  /**
   * Average extension of index + middle fingers.
   * Extension = PIP.y - TIP.y (positive = fingertip above PIP in image coords where y=0 is top).
   * Result clamped to [0, 1].
   */
  private calculateFingerExtension(
    landmarks: NormalizedLandmarkPoint[],
  ): number {
    const indexTip = landmarks[LANDMARK_INDEX.INDEX_TIP];
    const indexPip = landmarks[LANDMARK_INDEX.INDEX_PIP];
    const middleTip = landmarks[LANDMARK_INDEX.MIDDLE_TIP];
    const middlePip = landmarks[LANDMARK_INDEX.MIDDLE_PIP];

    const indexExtension = indexPip.y - indexTip.y;
    const middleExtension = middlePip.y - middleTip.y;

    const averageExtension = (indexExtension + middleExtension) / 2;
    return Math.max(0, Math.min(1, averageExtension));
  }
}
