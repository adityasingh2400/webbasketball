import { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas } from '../r3f';
import { useWebcam } from '../hooks/useWebcam';
import { useHandTracking3D } from '../hooks/useHandTracking3D';
import { BallStateMachine } from '../engine/BallStateMachine';
import type { BallInput, BallHandlingState } from '../engine/BallStateMachine';
import { ShotArc } from '../engine/ShotArc';
import type { HandLandmark } from '../types';

interface GameScreen3DProps {
  onBack?: () => void;
}

const SMOOTHING = 0.12;
const AUTO_WALK_SPEED = 1.2;
const HOOP_Z = -13;
const STOP_DISTANCE = 6;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const HAND_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
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

export default function GameScreen3D({ onBack }: GameScreen3DProps) {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0, 8]);
  const [ballPosition, setBallPosition] = useState<[number, number, number]>([0.3, 0.8, 8]);
  const [animationState, setAnimationState] = useState<'idle' | 'dribbling' | 'gathering' | 'shooting'>('idle');
  const [isDribbling, setIsDribbling] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [ballState, setBallState] = useState<BallHandlingState>('IDLE');
  const [webcamActive, setWebcamActive] = useState(false);

  const ballSM = useRef(new BallStateMachine());
  const shotArc = useRef(new ShotArc());
  const keysPressed = useRef<Set<string>>(new Set());
  const smoothedPlayerPos = useRef({ x: 0, z: 8 });
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
  } = useHandTracking3D();

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
    setWebcamActive(true);

    requestAnimationFrame(() => {
      if (pipVideoRef.current && video.srcObject) {
        pipVideoRef.current.srcObject = video.srcObject;
        pipVideoRef.current.play().catch(() => {});
      }
    });
  }, [startWebcam, initTracking, startTracking]);

  const stopWebcamMode = useCallback(() => {
    stopTracking();
    stopWebcam();
    setWebcamActive(false);
    if (videoRef.current) {
      videoRef.current.remove();
      videoRef.current = null;
    }
  }, [stopTracking, stopWebcam]);

  // Transition listener for shot launch and state display
  useEffect(() => {
    const sm = ballSM.current;
    const unsub = sm.onTransition((from, to) => {
      setBallState(to);

      if (to === 'FOLLOW_THROUGH' && from === 'SHOOTING') {
        const pos: [number, number, number] = [
          smoothedPlayerPos.current.x,
          1.7,
          smoothedPlayerPos.current.z,
        ];
        const hand = getHandData();
        const power = Math.min(1, Math.abs(hand.velocity.y) * 2);
        shotArc.current.launch(pos, Math.max(0.4, power));
      }

      if (to === 'SHOOTING' || to === 'FOLLOW_THROUGH') {
        setAnimationState('shooting');
      }

      if ((from === 'BOUNCE' || from === 'DEAD') && to === 'IDLE') {
        shotArc.current.reset();
      }
    });

    return unsub;
  }, [getHandData]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysPressed.current.add(e.key.toLowerCase());

    if (e.key === 'c') {
      if (!webcamActive) {
        startWebcamMode();
      } else {
        stopWebcamMode();
      }
    }
  }, [webcamActive, startWebcamMode, stopWebcamMode]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysPressed.current.delete(e.key.toLowerCase());
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Main game loop
  useEffect(() => {
    let lastTime = performance.now();
    let rafHandle = 0;
    let running = true;

    const gameLoop = () => {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const sm = ballSM.current;
      const arc = shotArc.current;

      let targetX = smoothedPlayerPos.current.x;
      let targetZ = smoothedPlayerPos.current.z;

      if (webcamActive) {
        const hand = getHandData();
        if (hand.rawHand) {
          // AUTO-WALK: Player walks toward hoop automatically
          const distToHoop = Math.abs(targetZ - HOOP_Z);
          if (distToHoop > STOP_DISTANCE && !sm.isShooting() && !arc.isActive()) {
            targetZ -= AUTO_WALK_SPEED * dt;
          }

          // Hand motions ONLY feed ball state machine — NOT player position
          const input: BallInput = {
            handX: hand.handNormalized.x,
            handY: hand.handNormalized.y,
            velocityX: hand.velocity.x,
            velocityY: hand.velocity.y,
            fingerExtension: hand.fingerExtension,
            handSide: hand.handedness === 'Left' ? 'left' : 'right',
            released: hand.release !== null,
            timeSinceStateEnter: sm.getStateTime(),
          };

          sm.update(dt, input);

          // Draw hand skeleton on PiP canvas
          if (skeletonCanvasRef.current && hand.rawHand.landmarks.length > 0) {
            const canvas = skeletonCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              drawHandSkeleton(ctx, hand.rawHand.landmarks, canvas.width, canvas.height);
            }
          }
        } else {
          // No hand detected — clear skeleton
          if (skeletonCanvasRef.current) {
            const ctx = skeletonCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, skeletonCanvasRef.current.width, skeletonCanvasRef.current.height);
          }
        }
      } else {
        // Keyboard mode
        const moveSpeed = 5;
        if (keysPressed.current.has('arrowup') || keysPressed.current.has('w')) {
          targetZ -= moveSpeed * dt;
        }
        if (keysPressed.current.has('arrowdown') || keysPressed.current.has('s')) {
          targetZ += moveSpeed * dt;
        }
        if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) {
          targetX -= moveSpeed * dt;
        }
        if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) {
          targetX += moveSpeed * dt;
        }

        targetX = Math.max(-7, Math.min(7, targetX));
        targetZ = Math.max(-13, Math.min(13, targetZ));

        const kbInput: BallInput = {
          handX: 0.5,
          handY: 0.5,
          velocityX: keysPressed.current.has('arrowleft') || keysPressed.current.has('a') ? -0.6 :
                     keysPressed.current.has('arrowright') || keysPressed.current.has('d') ? 0.6 : 0,
          velocityY: keysPressed.current.has(' ') ? -0.8 :
                     keysPressed.current.has('e') ? 0.5 : 0,
          fingerExtension: keysPressed.current.has('f') ? 0.2 : 0,
          handSide: 'right',
          released: keysPressed.current.has('f'),
          timeSinceStateEnter: sm.getStateTime(),
        };

        sm.update(dt, kbInput);
      }

      smoothedPlayerPos.current.x = lerp(smoothedPlayerPos.current.x, targetX, SMOOTHING);
      smoothedPlayerPos.current.z = lerp(smoothedPlayerPos.current.z, targetZ, SMOOTHING);

      const px = smoothedPlayerPos.current.x;
      const pz = smoothedPlayerPos.current.z;
      setPlayerPosition([px, 0, pz]);

      const snapshot = sm.getSnapshot();
      const config = snapshot.config;

      setIsDribbling(sm.isDribbling());

      if (arc.isActive()) {
        const arcState = arc.update(dt);
        setBallPosition(arcState.position as [number, number, number]);
        setAnimationState('shooting');

        if (arcState.landed) {
          if (arcState.madeBasket) {
            setScore(s => s + 1);
            setStreak(s => s + 1);
            sm.forceTransition('DEAD');
          } else {
            setStreak(0);
            sm.forceTransition('BOUNCE');
          }
        }
      } else {
        setAnimationState(config.playerAnim);

        const blend = snapshot.blendFactor;
        const prev = snapshot.previousConfig;

        let bx = config.ballOffset.x;
        let by = config.ballOffset.y;
        let bz = config.ballOffset.z;

        if (prev && blend < 1) {
          bx = prev.ballOffset.x + (bx - prev.ballOffset.x) * blend;
          by = prev.ballOffset.y + (by - prev.ballOffset.y) * blend;
          bz = prev.ballOffset.z + (bz - prev.ballOffset.z) * blend;
        }

        if (config.ballBounce) {
          const phase = snapshot.stateTime * config.ballBounce.frequency * Math.PI * 2;
          by += Math.abs(Math.sin(phase)) * config.ballBounce.amplitude;
        }

        setBallPosition([px + bx, by, pz + bz]);
      }

      rafHandle = requestAnimationFrame(gameLoop);
    };

    rafHandle = requestAnimationFrame(gameLoop);
    return () => {
      running = false;
      cancelAnimationFrame(rafHandle);
    };
  }, [webcamActive, getHandData]);

  useEffect(() => {
    return () => {
      stopWebcamMode();
    };
  }, [stopWebcamMode]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <GameCanvas
        playerPosition={playerPosition}
        ballPosition={ballPosition}
        ballVisible={true}
        isDribbling={isDribbling}
        animationState={animationState}
      />

      {/* Score HUD */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontFamily: "'Bebas Neue', Arial, sans-serif",
        fontSize: '48px',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        background: 'rgba(0,0,0,0.3)',
        padding: '5px 30px',
        borderRadius: '12px',
        display: 'flex',
        gap: '30px',
        alignItems: 'center',
      }}>
        <span>{score}</span>
        {streak >= 3 && (
          <span style={{ fontSize: '24px', color: '#ff6b35' }}>
            🔥 {streak}
          </span>
        )}
      </div>

      {/* State debug label */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: "'DM Sans', Arial, sans-serif",
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '2px',
      }}>
        {ballState}
      </div>

      {/* Webcam PiP with skeleton overlay */}
      {webcamActive && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 240,
          height: 180,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <video
            ref={pipVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
          <canvas
            ref={skeletonCanvasRef}
            width={240}
            height={180}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: trackingState.isTracking ? '#00ff88' : '#ff4444',
            width: 8,
            height: 8,
            borderRadius: '50%',
            boxShadow: trackingState.isTracking ? '0 0 6px #00ff88' : '0 0 6px #ff4444',
          }} />
        </div>
      )}

      {/* Controls help */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        color: 'white',
        fontFamily: "'DM Sans', Arial, sans-serif",
        fontSize: '13px',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
        background: 'rgba(0,0,0,0.4)',
        padding: '12px 16px',
        borderRadius: '10px',
        lineHeight: '1.6',
      }}>
        {webcamActive ? (
          <>
            <div>🏃 Player walks to hoop automatically</div>
            <div>👇 Push hand down = dribble</div>
            <div>↔️ Quick swipe = crossover</div>
            <div>👆 Raise hand = gather for shot</div>
            <div>🖐️ Open fingers = release shot</div>
            <div><kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '3px' }}>C</kbd> Disable webcam</div>
          </>
        ) : (
          <>
            <div><b>WASD</b> Move</div>
            <div><b>E</b> Dribble</div>
            <div><b>Space</b> Gather</div>
            <div><b>F</b> Shoot/Release</div>
            <div><kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '3px' }}>C</kbd> Enable webcam</div>
          </>
        )}
      </div>

      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '8px 16px',
            fontSize: '14px',
            background: 'rgba(0,0,0,0.4)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: "'DM Sans', Arial, sans-serif",
          }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}
