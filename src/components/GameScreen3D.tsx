import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas } from '../r3f';
import { useWebcam } from '../hooks/useWebcam';
import { useHandTracking3D } from '../hooks/useHandTracking3D';
import { useBodyTracking3D } from '../hooks/useBodyTracking3D';
import { GameRuntime } from '../engine/GameRuntime';
import type { RuntimeControls } from '../engine/GameRuntime';
import type { RenderDiagnostics } from '../r3f/GameCanvas';
import type { QualityLevel } from '../r3f/Lighting';
import type { HandLandmark } from '../types';
import { ShotMeter } from './ShotMeter';
import { keyboardToBodyInputFrame } from '../engine/input/BodyInputFrame';
import './GameScreen3D.css';

interface GameScreen3DProps {
  onBack?: () => void;
  onGameEnd?: (score: number) => void;
}

interface DebugPanelState {
  renderFps: number;
  renderFrameMs: number;
  drawCalls: number;
  triangles: number;
  trackingFps: number;
  trackingProcessMs: number;
  trackingHasHand: boolean;
  simFps: number;
  simFrameMs: number;
  simSteps: number;
  droppedAdvances: number;
  moveLocked: boolean;
  shotCharge: number;
  ballState: string;
  animationState: string;
}

function formatBallStateLabel(state: string): string {
  return state
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmark[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;

  for (const [a, b] of HAND_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    ctx.beginPath();
    ctx.moveTo((1 - la.x) * width, la.y * height);
    ctx.lineTo((1 - lb.x) * width, lb.y * height);
    ctx.stroke();
  }

  ctx.fillStyle = '#00ff88';
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc((1 - lm.x) * width, lm.y * height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function GameScreen3D({ onBack, onGameEnd }: GameScreen3DProps) {
  const runtime = useMemo(() => new GameRuntime(), []);
  const [ui, setUi] = useState(() => runtime.getUiState());
  const [webcamActive, setWebcamActive] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>('medium');
  const [showDebug, setShowDebug] = useState(() => import.meta.env.DEV);
  const [sceneReady, setSceneReady] = useState(false);
  const firstFrameReceived = useRef(false);
  const [debug, setDebug] = useState<DebugPanelState>(() => ({
    renderFps: 0,
    renderFrameMs: 0,
    drawCalls: 0,
    triangles: 0,
    trackingFps: 0,
    trackingProcessMs: 0,
    trackingHasHand: false,
    simFps: 120,
    simFrameMs: 8.33,
    simSteps: 0,
    droppedAdvances: 0,
    moveLocked: false,
    shotCharge: 0,
    ballState: 'IDLE',
    animationState: 'idle',
  }));

  const keysPressed = useRef<Set<string>>(new Set());
  const shootHeld = useRef(false);
  const shootReleased = useRef(false);
  const renderDiagnosticsRef = useRef<RenderDiagnostics>({
    fps: 0,
    frameMs: 0,
    drawCalls: 0,
    triangles: 0,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { startWebcam, stopWebcam } = useWebcam();
  const {
    state: trackingState,
    initialize: initTracking,
    start: startTracking,
    stop: stopTracking,
    getHandData,
    getDiagnostics,
  } = useHandTracking3D();

  const {
    initialize: initBodyTracking,
    start: startBodyTracking,
    stop: stopBodyTracking,
    getBodyData,
    getDiagnostics: getBodyDiagnostics,
  } = useBodyTracking3D();

  useEffect(() => {
    return runtime.subscribeUi(setUi);
  }, [runtime]);

  const stopWebcamMode = useCallback(() => {
    stopTracking();
    stopBodyTracking();
    stopWebcam();
    setWebcamActive(false);

    if (videoRef.current) {
      videoRef.current.remove();
      videoRef.current = null;
    }

    const canvas = skeletonCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [stopTracking, stopBodyTracking, stopWebcam]);

  const startWebcamMode = useCallback(async () => {
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.style.position = 'fixed';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.width = '1px';
    video.style.height = '1px';
    document.body.appendChild(video);
    videoRef.current = video;

    await startWebcam(video);
    await initTracking(video);
    startTracking();

    await initBodyTracking(video);
    startBodyTracking();

    setWebcamActive(true);

    requestAnimationFrame(() => {
      if (pipVideoRef.current && video.srcObject) {
        pipVideoRef.current.srcObject = video.srcObject;
        pipVideoRef.current.play().catch(() => {});
      }
    });
  }, [startWebcam, initTracking, startTracking, initBodyTracking, startBodyTracking]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysPressed.current.add(key);

      if (key === 'f') {
        event.preventDefault();
        if (!shootHeld.current) {
          shootHeld.current = true;
          shootReleased.current = false;
        }
      }

      if (event.repeat) return;

      if (key === 'c') {
        if (webcamActive) stopWebcamMode();
        else void startWebcamMode();
      }

      if (key === 'q') {
        setQuality((previous) => previous === 'high' ? 'medium' : previous === 'medium' ? 'low' : 'high');
      }

      if (key === 'p') {
        setShowDebug((previous) => !previous);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysPressed.current.delete(key);

      if (key === 'f') {
        event.preventDefault();
        if (shootHeld.current) {
          shootHeld.current = false;
          shootReleased.current = true;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startWebcamMode, stopWebcamMode, webcamActive]);

  useEffect(() => {
    if (!webcamActive) return;

    let frameHandle = 0;
    const drawLoop = () => {
      const canvas = skeletonCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const hand = getHandData();

      if (ctx && canvas) {
        if (hand.rawHand && hand.rawHand.landmarks.length > 0) {
          drawHandSkeleton(ctx, hand.rawHand.landmarks, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      frameHandle = requestAnimationFrame(drawLoop);
    };

    frameHandle = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(frameHandle);
  }, [getHandData, webcamActive]);

  useEffect(() => {
    return () => {
      stopWebcamMode();
    };
  }, [stopWebcamMode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const sim = runtime.getDebugState();
      const tracking = getDiagnostics();
      const render = renderDiagnosticsRef.current;

      setDebug({
        renderFps: render.fps,
        renderFrameMs: render.frameMs,
        drawCalls: render.drawCalls,
        triangles: render.triangles,
        trackingFps: tracking.sampleFps,
        trackingProcessMs: tracking.processMs,
        trackingHasHand: tracking.hasHand,
        simFps: sim.simFps,
        simFrameMs: sim.simFrameMs,
        simSteps: sim.simSteps,
        droppedAdvances: sim.droppedAdvances,
        moveLocked: sim.moveLocked,
        shotCharge: sim.shotCharge,
        ballState: sim.ballState,
        animationState: sim.animationState,
      });
    }, 200);

    return () => window.clearInterval(timer);
  }, [getDiagnostics, runtime]);

  const handleRenderSample = useCallback((sample: RenderDiagnostics) => {
    renderDiagnosticsRef.current = sample;
    if (!firstFrameReceived.current && sample.fps > 0) {
      firstFrameReceived.current = true;
      setTimeout(() => setSceneReady(true), 600);
    }
  }, []);

  const getControls = useCallback((): RuntimeControls => {
    let moveX = (keysPressed.current.has('arrowright') || keysPressed.current.has('d') ? 1 : 0)
      - (keysPressed.current.has('arrowleft') || keysPressed.current.has('a') ? 1 : 0);
    let moveZ = (keysPressed.current.has('arrowdown') || keysPressed.current.has('s') ? 1 : 0)
      - (keysPressed.current.has('arrowup') || keysPressed.current.has('w') ? 1 : 0);
    const moveMagnitude = Math.hypot(moveX, moveZ);
    if (moveMagnitude > 1) {
      moveX /= moveMagnitude;
      moveZ /= moveMagnitude;
    }

    const releasedNow = shootReleased.current;
    shootReleased.current = false;

    const hand = getHandData();

    let bodyInputFrame = null;
    if (webcamActive) {
      const bodyData = getBodyData();
      bodyInputFrame = bodyData.bodyInputFrame ?? null;
    } else {
      bodyInputFrame = keyboardToBodyInputFrame({
        moveX,
        moveZ,
        dribblePressed: keysPressed.current.has('e'),
        shootHeld: shootHeld.current,
        shootReleased: releasedNow,
        currentBallSide: runtime.getRenderState().ballSide,
      }, performance.now());
    }

    return {
      webcamActive,
      hand: {
        hasHand: Boolean(hand.rawHand),
        playerX: hand.playerX,
        playerZ: hand.playerZ,
        velocity: hand.velocity,
        handedness: hand.handedness,
        released: hand.released,
      },
      bodyInputFrame,
      moveX,
      moveZ,
      dribblePressed: keysPressed.current.has('e'),
      shootHeld: shootHeld.current,
      shootReleased: releasedNow,
    };
  }, [getHandData, getBodyData, webcamActive, runtime]);

  const handleExit = useCallback(() => {
    onGameEnd?.(ui.score);
    onBack?.();
  }, [onBack, onGameEnd, ui.score]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExit]);

  return (
    <div className="game-screen">
      <GameCanvas
        runtime={runtime}
        getControls={getControls}
        quality={quality}
        onRenderSample={handleRenderSample}
      />

      {/* Loading overlay — covers the canvas until the scene has rendered */}
      <div className={`game-loading ${sceneReady ? 'game-loading--done' : ''}`}>
        <div className="game-loading__content">
          <div className="game-loading__ball" />
          <div className="game-loading__text">Loading</div>
        </div>
      </div>

      <div className={`game-hud ${sceneReady ? 'game-hud--visible' : ''}`}>

      <div className="hud-score">
        <span>{ui.score}</span>
        {ui.streak >= 3 ? <span className="hud-score__streak">🔥 {ui.streak}</span> : null}
      </div>

      <div className="hud-state" aria-live="polite">
        {formatBallStateLabel(ui.ballState)}
      </div>

      {ui.shotResult ? (
        <div className={`shot-result ${
          ui.shotResult === 'GREEN!' ? 'shot-result--green' :
          ui.shotResult.includes('Swish') || ui.shotResult.includes('Bank') ? 'shot-result--make' :
          'shot-result--miss'
        }`}>
          {ui.shotResult}
        </div>
      ) : null}

      <ShotMeter runtime={runtime} />

      {webcamActive ? (
        <div className="webcam-pip">
          <video
            ref={pipVideoRef}
            autoPlay
            playsInline
            muted
            className="webcam-pip__video"
          />
          <canvas
            ref={skeletonCanvasRef}
            width={240}
            height={180}
            className="webcam-pip__skeleton"
          />
          <div className={`webcam-pip__status ${trackingState.isTracking ? 'webcam-pip__status--active' : 'webcam-pip__status--inactive'}`} />
        </div>
      ) : null}

      <div className="controls-panel">
        {webcamActive ? (
          <>
            <div>🏃 Auto-run to the lane</div>
            <div>↔️ Hand position steers left/right</div>
            <div>✊ Hold steady to keep the dribble alive</div>
            <div>👆 Raise and flick to shoot</div>
            <div><kbd>C</kbd> Disable webcam</div>
            <div><kbd>Q</kbd> Quality: {quality}</div>
            <div><kbd>P</kbd> Debug HUD</div>
          </>
        ) : (
          <>
            <div><b>WASD</b> Move</div>
            <div><b>E</b> Dribble</div>
            <div><b>Hold F</b> Start jump shot</div>
            <div><b>Release F</b> Fire the shot</div>
            <div><kbd>C</kbd> Enable webcam</div>
            <div><kbd>Q</kbd> Quality: {quality}</div>
            <div><kbd>P</kbd> Debug HUD</div>
          </>
        )}
      </div>

      {showDebug ? (
        <div className="debug-panel">
          <div className="debug-panel__title">Diagnostics</div>
          <div className="debug-panel__row">
            <span>Render</span>
            <b>{debug.renderFps.toFixed(0)} fps / {debug.renderFrameMs.toFixed(1)} ms</b>
          </div>
          <div className="debug-panel__row">
            <span>Sim</span>
            <b>{debug.simFps.toFixed(0)} fps / {debug.simFrameMs.toFixed(1)} ms / {debug.simSteps} steps</b>
          </div>
          <div className="debug-panel__row">
            <span>Tracking</span>
            <b>{webcamActive ? `${debug.trackingFps.toFixed(0)} fps / ${debug.trackingProcessMs.toFixed(1)} ms` : 'off'}</b>
          </div>
          <div className="debug-panel__row">
            <span>GPU</span>
            <b>{debug.drawCalls} calls / {(debug.triangles / 1000).toFixed(0)}k tris</b>
          </div>
          <div className="debug-panel__row">
            <span>State</span>
            <b>{debug.ballState} / {debug.animationState}</b>
          </div>
          <div className="debug-panel__row">
            <span>Flags</span>
            <b>
              {debug.moveLocked ? 'move-locked' : 'free'}
              {' / '}
              {webcamActive ? (debug.trackingHasHand ? 'body-live' : 'no-body') : 'keyboard'}
            </b>
          </div>
          <div className="debug-panel__row">
            <span>Shot</span>
            <b>{(debug.shotCharge * 100).toFixed(0)}%</b>
          </div>
          <div className="debug-panel__row">
            <span>Quality</span>
            <b>{quality}</b>
          </div>
        </div>
      ) : null}

      {onBack ? (
        <button className="hud-back" onClick={handleExit}>
          ← Back
        </button>
      ) : null}

      </div>
    </div>
  );
}
