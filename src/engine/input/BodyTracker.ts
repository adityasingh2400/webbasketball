import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { PoseLandmarkData, BodyTrackingFrame } from '../../types';

export type BodyTrackerState = {
  isLoading: boolean;
  loadProgress: number;
  isTracking: boolean;
  error: string | null;
};

type NormalizedLandmark = { x: number; y: number; z: number; visibility?: number };

const WASM_BASE_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

const MIN_POSE_DETECTION_CONFIDENCE = 0.6;
const MIN_POSE_PRESENCE_CONFIDENCE = 0.6;
const MIN_TRACKING_CONFIDENCE = 0.6;

export class BodyTracker {
  private poseLandmarker: PoseLandmarker | null = null;
  private state: BodyTrackerState = {
    isLoading: false,
    loadProgress: 0,
    isTracking: false,
    error: null,
  };
  private onStateChange: ((state: BodyTrackerState) => void) | null = null;

  async initialize(
    onStateChange?: (state: BodyTrackerState) => void,
  ): Promise<void> {
    if (onStateChange) {
      this.onStateChange = onStateChange;
    }

    this.updateState({ isLoading: true, loadProgress: 0, error: null });

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
      this.updateState({ loadProgress: 0.3 });

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: MIN_POSE_DETECTION_CONFIDENCE,
        minPosePresenceConfidence: MIN_POSE_PRESENCE_CONFIDENCE,
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
          : 'Failed to initialize body tracking';

      this.updateState({
        isLoading: false,
        loadProgress: 0,
        isTracking: false,
        error: message,
      });
    }
  }

  processFrame(videoElement: HTMLVideoElement): BodyTrackingFrame {
    const timestamp = performance.now();

    if (!this.poseLandmarker || !this.state.isTracking) {
      return { timestamp, landmarks: null, worldLandmarks: null, isTracking: false };
    }

    if (videoElement.readyState < 2) {
      return { timestamp, landmarks: null, worldLandmarks: null, isTracking: true };
    }

    try {
      const result = this.poseLandmarker.detectForVideo(videoElement, timestamp);

      if (!result.landmarks || result.landmarks.length === 0) {
        return { timestamp, landmarks: null, worldLandmarks: null, isTracking: true };
      }

      const rawLandmarks: NormalizedLandmark[] = result.landmarks[0];
      const rawWorld: NormalizedLandmark[] | undefined = result.worldLandmarks?.[0];

      const landmarks: PoseLandmarkData[] = rawLandmarks.map(
        (lm: NormalizedLandmark, i: number) => ({
          index: i,
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility ?? 1,
        }),
      );

      const worldLandmarks: PoseLandmarkData[] | null = rawWorld
        ? rawWorld.map((lm: NormalizedLandmark, i: number) => ({
            index: i,
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility ?? 1,
          }))
        : null;

      return { timestamp, landmarks, worldLandmarks, isTracking: true };
    } catch {
      this.updateState({
        error: 'Frame processing failed',
        isTracking: false,
      });
      return { timestamp, landmarks: null, worldLandmarks: null, isTracking: false };
    }
  }

  getState(): BodyTrackerState {
    return { ...this.state };
  }

  close(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }

    this.updateState({
      isTracking: false,
      isLoading: false,
      loadProgress: 0,
      error: null,
    });
    this.onStateChange = null;
  }

  private updateState(partial: Partial<BodyTrackerState>): void {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.getState());
  }
}
