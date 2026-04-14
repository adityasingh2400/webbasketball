import { useRef, useState, useCallback, useEffect } from 'react';
import { BodyTracker } from '../engine/input/BodyTracker';
import { HandTracker } from '../engine/input/HandTracker';
import { LandmarkFilter } from '../engine/input/OneEuroFilter';
import { PoseFeatureExtractor, POSE } from '../engine/input/PoseFeatureExtractor';
import { PoseStateClassifier } from '../engine/input/PoseStateClassifier';
import { VelocityEstimator } from '../engine/input/VelocityEstimator';
import { TwoGateReleaseDetector } from '../engine/input/TwoGateReleaseDetector';
import { WristFlickDetector } from '../engine/input/WristFlickDetector';
import { landmarkToBodyInputFrame, createEmptyBodyInputFrame } from '../engine/input/LandmarkToInput';
import type { BodyInputFrame } from '../engine/input/BodyInputFrame';
import type { PoseLandmarkData } from '../types';

const COURT_HALF_WIDTH = 7;
const COURT_LENGTH = 26;
const COURT_NEAR_Z = 12;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;
const MAX_TRACKING_FPS = 30;
const TRACKING_FRAME_INTERVAL_MS = 1000 / MAX_TRACKING_FPS;
const NUM_POSE_LANDMARKS = 33;

export interface BodyTracking3DState {
  isLoading: boolean;
  isTracking: boolean;
  loadProgress: number;
  error: string | null;
}

export interface Body3DData {
  playerX: number;
  playerZ: number;
  velocity: { x: number; y: number };
  handedness: 'Left' | 'Right';
  released: boolean;
  rawLandmarks: PoseLandmarkData[] | null;
  bodyInputFrame: BodyInputFrame | null;
}

export interface BodyTrackingDiagnostics {
  sampleFps: number;
  processMs: number;
  hasBody: boolean;
}

function mapTorsoToCourtPosition(
  torsoCenterX: number,
  hipCenterY: number,
): { x: number; z: number } {
  const mirroredX = 1 - torsoCenterX;
  const x = (mirroredX - 0.5) * 2 * COURT_HALF_WIDTH;
  const z = COURT_NEAR_Z - hipCenterY * COURT_LENGTH * 0.5;
  return {
    x: Math.max(-COURT_HALF_WIDTH, Math.min(COURT_HALF_WIDTH, x)),
    z: Math.max(-13, Math.min(13, z)),
  };
}

export function useBodyTracking3D() {
  const trackerRef = useRef<BodyTracker | null>(null);
  const handTrackerRef = useRef<HandTracker | null>(null);
  const landmarkFilterRef = useRef(new LandmarkFilter(NUM_POSE_LANDMARKS, 1.0, 0.007));
  const featureExtractorRef = useRef(new PoseFeatureExtractor());
  const classifierRef = useRef(new PoseStateClassifier());
  const velocityEstLeftRef = useRef(new VelocityEstimator(5));
  const velocityEstRightRef = useRef(new VelocityEstimator(5));
  const releaseDetectorRef = useRef(new TwoGateReleaseDetector());
  const flickDetectorRef = useRef(new WristFlickDetector());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);
  const retryCount = useRef(0);
  const lastProcessedAtRef = useRef(0);

  const diagnosticsRef = useRef<BodyTrackingDiagnostics>({
    sampleFps: 0,
    processMs: 0,
    hasBody: false,
  });

  const [state, setState] = useState<BodyTracking3DState>({
    isLoading: false,
    isTracking: false,
    loadProgress: 0,
    error: null,
  });

  const bodyDataRef = useRef<Body3DData>({
    playerX: 0,
    playerZ: 5,
    velocity: { x: 0, y: 0 },
    handedness: 'Right',
    released: false,
    rawLandmarks: null,
    bodyInputFrame: null,
  });

  const initialize = useCallback(async (videoElement: HTMLVideoElement) => {
    videoRef.current = videoElement;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    const tracker = new BodyTracker();
    trackerRef.current = tracker;

    await tracker.initialize((trackerState) => {
      setState({
        isLoading: trackerState.isLoading,
        isTracking: trackerState.isTracking,
        loadProgress: trackerState.loadProgress,
        error: trackerState.error,
      });
    });

    const handTracker = new HandTracker();
    handTrackerRef.current = handTracker;
    await handTracker.initialize().catch(() => {
      // Hand tracker is optional, body tracking still works without it
    });
  }, []);

  const processFrame = useCallback(function processFrameImpl() {
    if (!trackerRef.current || !videoRef.current) {
      rafRef.current = requestAnimationFrame(processFrameImpl);
      return;
    }

    const loopTime = performance.now();
    if (loopTime - lastProcessedAtRef.current < TRACKING_FRAME_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(processFrameImpl);
      return;
    }
    const elapsedSinceLast =
      lastProcessedAtRef.current > 0
        ? loopTime - lastProcessedAtRef.current
        : TRACKING_FRAME_INTERVAL_MS;
    lastProcessedAtRef.current = loopTime;

    const processStart = performance.now();
    let frame;
    try {
      frame = trackerRef.current.processFrame(videoRef.current);
      retryCount.current = 0;
    } catch {
      retryCount.current++;
      if (retryCount.current <= MAX_RETRIES) {
        setTimeout(() => {
          rafRef.current = requestAnimationFrame(processFrameImpl);
        }, RETRY_DELAY_MS);
        return;
      }
      setState((s) => ({
        ...s,
        error: 'Body tracking failed. Please refresh.',
        isTracking: false,
      }));
      return;
    }

    diagnosticsRef.current.sampleFps =
      diagnosticsRef.current.sampleFps === 0
        ? 1000 / elapsedSinceLast
        : diagnosticsRef.current.sampleFps * 0.82 + (1000 / elapsedSinceLast) * 0.18;
    diagnosticsRef.current.processMs =
      diagnosticsRef.current.processMs === 0
        ? performance.now() - processStart
        : diagnosticsRef.current.processMs * 0.75 + (performance.now() - processStart) * 0.25;

    if (!frame.isTracking || !frame.landmarks) {
      bodyDataRef.current = {
        ...bodyDataRef.current,
        released: false,
        rawLandmarks: null,
        velocity: { x: 0, y: 0 },
        bodyInputFrame: createEmptyBodyInputFrame(frame.timestamp),
      };
      diagnosticsRef.current.hasBody = false;
      releaseDetectorRef.current.reset();
      velocityEstLeftRef.current.reset();
      velocityEstRightRef.current.reset();
      rafRef.current = requestAnimationFrame(processFrameImpl);
      return;
    }

    const landmarks = frame.landmarks;
    const now = frame.timestamp;

    const filteredRaw = landmarkFilterRef.current.filterLandmarks(
      landmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
      now,
    );
    const filtered: PoseLandmarkData[] = filteredRaw.map((lm, i) => ({
      index: i,
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: landmarks[i]?.visibility ?? 1,
    }));

    const features = featureExtractorRef.current.extract(filtered);

    if (!features.valid) {
      bodyDataRef.current = {
        ...bodyDataRef.current,
        released: false,
        rawLandmarks: filtered,
        velocity: { x: 0, y: 0 },
        bodyInputFrame: createEmptyBodyInputFrame(frame.timestamp),
      };
      diagnosticsRef.current.hasBody = false;
      rafRef.current = requestAnimationFrame(processFrameImpl);
      return;
    }

    const rWrist = filtered[POSE.RIGHT_WRIST];
    const lWrist = filtered[POSE.LEFT_WRIST];
    velocityEstRightRef.current.push(rWrist.x, rWrist.y, now);
    velocityEstLeftRef.current.push(lWrist.x, lWrist.y, now);

    const dominantVelocity =
      features.lowerHand === 'right'
        ? velocityEstRightRef.current.get()
        : velocityEstLeftRef.current.get();

    const dominantWristY = features.lowerHand === 'right' ? rWrist.y : lWrist.y;
    const twoGateReleased = releaseDetectorRef.current.update(
      dominantWristY,
      dominantVelocity.y,
      now,
    );

    let flickReleased = false;
    if (handTrackerRef.current && videoRef.current) {
      try {
        const handFrame = handTrackerRef.current.processFrame(videoRef.current);
        if (handFrame.hands.length > 0) {
          const handLandmarks = handFrame.hands[0].landmarks.map(lm => ({
            x: lm.x, y: lm.y, z: lm.z,
          }));
          const handAboveShoulder = features.lowerHand === 'right'
            ? features.rightWristAboveShoulder
            : features.leftWristAboveShoulder;
          const flickState = flickDetectorRef.current.update(
            handLandmarks,
            handAboveShoulder,
            now,
          );
          flickReleased = flickState.detected;
        }
      } catch {
        // Hand tracking frame failed, fall through to two-gate
      }
    }

    const released = flickReleased || twoGateReleased;

    const ballInput = classifierRef.current.classify(
      features,
      dominantVelocity,
      released,
    );

    const torsoCenterX =
      (filtered[POSE.LEFT_SHOULDER].x + filtered[POSE.RIGHT_SHOULDER].x) / 2;
    const courtPos = mapTorsoToCourtPosition(torsoCenterX, features.hipCenterY);

    let bodyInputFrame: BodyInputFrame | null = null;
    if (frame.worldLandmarks && frame.worldLandmarks.length >= 33) {
      bodyInputFrame = landmarkToBodyInputFrame(
        frame.worldLandmarks,
        filtered,
        features,
        ballInput,
        frame.timestamp,
      );
    } else {
      bodyInputFrame = createEmptyBodyInputFrame(frame.timestamp);
    }

    bodyDataRef.current = {
      playerX: courtPos.x,
      playerZ: courtPos.z,
      velocity: { x: ballInput.velocityX, y: ballInput.velocityY },
      handedness: features.lowerHand === 'left' ? 'Left' : 'Right',
      released: ballInput.released,
      rawLandmarks: filtered,
      bodyInputFrame,
    };
    diagnosticsRef.current.hasBody = true;

    rafRef.current = requestAnimationFrame(processFrameImpl);
  }, []);

  const start = useCallback(() => {
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    releaseDetectorRef.current.reset();
    flickDetectorRef.current.reset();
    velocityEstLeftRef.current.reset();
    velocityEstRightRef.current.reset();
  }, []);

  const getBodyData = useCallback(() => {
    return bodyDataRef.current;
  }, []);

  const getDiagnostics = useCallback(() => {
    return diagnosticsRef.current;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      trackerRef.current?.close();
      handTrackerRef.current?.close();
    };
  }, [stop]);

  return {
    state,
    initialize,
    start,
    stop,
    getBodyData,
    getDiagnostics,
    bodyDataRef,
  };
}
