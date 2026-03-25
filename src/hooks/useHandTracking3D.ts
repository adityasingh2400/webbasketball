import { useRef, useState, useCallback, useEffect } from 'react';
import { HandTracker } from '../engine/input/HandTracker';
import { ReleaseDetector } from '../engine/input/ReleaseDetector';
import { LandmarkFilter } from '../engine/input/OneEuroFilter';
import { TwoGateReleaseDetector } from '../engine/input/TwoGateReleaseDetector';
import type { HandData, TrackingFrame, ReleaseDetection } from '../types';

const COURT_HALF_WIDTH = 7;
const COURT_LENGTH = 26;
const COURT_NEAR_Z = 12;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

export interface HandTracking3DState {
  isLoading: boolean;
  isTracking: boolean;
  loadProgress: number;
  error: string | null;
}

export interface Hand3DData {
  playerX: number;
  playerZ: number;
  handNormalized: { x: number; y: number };
  velocity: { x: number; y: number };
  fingerExtension: number;
  handedness: 'Left' | 'Right';
  release: ReleaseDetection | null;
  twoGateRelease: boolean;
  rawHand: HandData | null;
}

function mapHandToCourtPosition(
  handX: number,
  handY: number,
): { x: number; z: number } {
  const mirroredX = 1 - handX;
  const x = (mirroredX - 0.5) * 2 * COURT_HALF_WIDTH;
  const z = COURT_NEAR_Z - handY * COURT_LENGTH * 0.5;
  return {
    x: Math.max(-COURT_HALF_WIDTH, Math.min(COURT_HALF_WIDTH, x)),
    z: Math.max(-13, Math.min(13, z)),
  };
}

export function useHandTracking3D() {
  const trackerRef = useRef<HandTracker | null>(null);
  const releaseDetectorRef = useRef<ReleaseDetector | null>(null);
  const landmarkFilterRef = useRef(new LandmarkFilter(21, 1.0, 0.007));
  const twoGateRef = useRef(new TwoGateReleaseDetector());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);
  const prevPositionRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const retryCount = useRef(0);

  const [state, setState] = useState<HandTracking3DState>({
    isLoading: false,
    isTracking: false,
    loadProgress: 0,
    error: null,
  });

  const handDataRef = useRef<Hand3DData>({
    playerX: 0,
    playerZ: 5,
    handNormalized: { x: 0.5, y: 0.5 },
    velocity: { x: 0, y: 0 },
    fingerExtension: 0,
    handedness: 'Right',
    release: null,
    twoGateRelease: false,
    rawHand: null,
  });

  const initialize = useCallback(async (videoElement: HTMLVideoElement) => {
    videoRef.current = videoElement;
    setState(s => ({ ...s, isLoading: true, error: null }));

    const tracker = new HandTracker();
    trackerRef.current = tracker;
    releaseDetectorRef.current = new ReleaseDetector();

    await tracker.initialize((trackerState) => {
      setState({
        isLoading: trackerState.isLoading,
        isTracking: trackerState.isTracking,
        loadProgress: trackerState.loadProgress,
        error: trackerState.error,
      });
    });
  }, []);

  const processFrame = useCallback(() => {
    if (!trackerRef.current || !videoRef.current) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    let frame: TrackingFrame;
    try {
      frame = trackerRef.current.processFrame(videoRef.current);
      retryCount.current = 0;
    } catch (err) {
      retryCount.current++;
      if (retryCount.current <= MAX_RETRIES) {
        setTimeout(() => {
          rafRef.current = requestAnimationFrame(processFrame);
        }, RETRY_DELAY_MS);
        return;
      }
      setState(s => ({ ...s, error: 'Hand tracking failed. Please refresh.', isTracking: false }));
      return;
    }

    const releaseDetector = releaseDetectorRef.current;
    const landmarkFilter = landmarkFilterRef.current;
    const twoGate = twoGateRef.current;

    if (!frame.isTracking || frame.hands.length === 0) {
      handDataRef.current = {
        ...handDataRef.current,
        release: null,
        twoGateRelease: false,
        rawHand: null,
        velocity: { x: 0, y: 0 },
      };
      prevPositionRef.current = null;
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const hand = frame.hands.find(h => h.handedness === 'Right') ?? frame.hands[0];
    const now = frame.timestamp;

    const filteredLandmarks = landmarkFilter.filterLandmarks(hand.landmarks, now);
    const filteredHand: HandData = {
      ...hand,
      landmarks: filteredLandmarks.map((lm, i) => ({ ...lm, index: i })),
      wrist: { x: filteredLandmarks[0].x, y: filteredLandmarks[0].y },
      indexTip: { x: filteredLandmarks[8].x, y: filteredLandmarks[8].y },
    };

    let velocity = { x: 0, y: 0 };
    if (prevPositionRef.current) {
      const dt = now - prevPositionRef.current.t;
      if (dt > 0) {
        velocity = {
          x: ((filteredHand.wrist.x - prevPositionRef.current.x) / dt) * 1000,
          y: ((filteredHand.wrist.y - prevPositionRef.current.y) / dt) * 1000,
        };
      }
    }
    prevPositionRef.current = { x: filteredHand.wrist.x, y: filteredHand.wrist.y, t: now };

    let release: ReleaseDetection | null = null;
    if (releaseDetector) {
      const detection = releaseDetector.update(filteredHand, now);
      if (detection.released) {
        release = detection;
      }
    }

    const twoGateRelease = twoGate.update(
      filteredHand.wrist.y,
      velocity.y,
      now,
    );

    const courtPos = mapHandToCourtPosition(filteredHand.wrist.x, filteredHand.wrist.y);

    handDataRef.current = {
      playerX: courtPos.x,
      playerZ: courtPos.z,
      handNormalized: { x: 1 - filteredHand.wrist.x, y: filteredHand.wrist.y },
      velocity,
      fingerExtension: filteredHand.fingerExtension,
      handedness: filteredHand.handedness,
      release,
      twoGateRelease,
      rawHand: filteredHand,
    };

    rafRef.current = requestAnimationFrame(processFrame);
  }, []);

  const start = useCallback(() => {
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const getHandData = useCallback(() => {
    return handDataRef.current;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      trackerRef.current?.close();
    };
  }, [stop]);

  return {
    state,
    initialize,
    start,
    stop,
    getHandData,
    handDataRef,
  };
}
