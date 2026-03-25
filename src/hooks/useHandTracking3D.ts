import { useRef, useState, useCallback, useEffect } from 'react';
import { HandTracker } from '../engine/input/HandTracker';
import { ReleaseDetector } from '../engine/input/ReleaseDetector';
import type { HandData, TrackingFrame, ReleaseDetection } from '../types';

const COURT_HALF_WIDTH = 7;
const COURT_LENGTH = 26;
const COURT_NEAR_Z = 12;

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);
  const prevPositionRef = useRef<{ x: number; y: number; t: number } | null>(null);

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

    const frame: TrackingFrame = trackerRef.current.processFrame(videoRef.current);
    const releaseDetector = releaseDetectorRef.current;

    if (!frame.isTracking || frame.hands.length === 0) {
      handDataRef.current = {
        ...handDataRef.current,
        release: null,
        rawHand: null,
        velocity: { x: 0, y: 0 },
      };
      prevPositionRef.current = null;
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const hand = frame.hands.find(h => h.handedness === 'Right') ?? frame.hands[0];
    const now = frame.timestamp;

    let velocity = { x: 0, y: 0 };
    if (prevPositionRef.current) {
      const dt = now - prevPositionRef.current.t;
      if (dt > 0) {
        velocity = {
          x: ((hand.wrist.x - prevPositionRef.current.x) / dt) * 1000,
          y: ((hand.wrist.y - prevPositionRef.current.y) / dt) * 1000,
        };
      }
    }
    prevPositionRef.current = { x: hand.wrist.x, y: hand.wrist.y, t: now };

    let release: ReleaseDetection | null = null;
    if (releaseDetector) {
      const detection = releaseDetector.update(hand, now);
      if (detection.released) {
        release = detection;
      }
    }

    const courtPos = mapHandToCourtPosition(hand.wrist.x, hand.wrist.y);

    handDataRef.current = {
      playerX: courtPos.x,
      playerZ: courtPos.z,
      handNormalized: { x: 1 - hand.wrist.x, y: hand.wrist.y },
      velocity,
      fingerExtension: hand.fingerExtension,
      handedness: hand.handedness,
      release,
      rawHand: hand,
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
