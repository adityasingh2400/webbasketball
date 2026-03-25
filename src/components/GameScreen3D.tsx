import { useState, useEffect, useRef, useCallback } from 'react';
import { GameCanvas } from '../r3f';
import { useWebcam } from '../hooks/useWebcam';
import { useHandTracking3D } from '../hooks/useHandTracking3D';
import { BallStateMachine } from '../engine/BallStateMachine';
import type { BallInput, BallHandlingState } from '../engine/BallStateMachine';
import { ShotArc } from '../engine/ShotArc';
import type { HandLandmark } from '../types';
import './GameScreen3D.css';

interface GameScreen3DProps {
  mode?: 'freeplay' | 'timed' | 'streak';
  onBack?: () => void;
  onGameEnd?: (score: number, streak: number) => void;
}

const AUTO_WALK_SPEED = 1.2;
const HOOP_Z = -13;
const STOP_DISTANCE = 6;
const COURT_HALF_W = 7.12;
const COURT_Z_MIN = -13.8;
const COURT_Z_MAX = -0.5;
const SHOT_METER_SPEED_MIN = 0.55;
const SHOT_METER_SPEED_MAX = 1.4;
const SHOT_METER_RAMP_TIME = 3;
const SWEET_SPOT_SIZE = 0.15;
const SWEET_SPOT_TOP = 1.0;

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

function ShotMeter({ value, isVisible }: { value: number; isVisible: boolean }) {
  if (!isVisible) return null;

  const sweetSpotStart = SWEET_SPOT_TOP - SWEET_SPOT_SIZE;
  const inSweetSpot = value >= sweetSpotStart && value <= SWEET_SPOT_TOP;

  return (
    <div className="shot-meter">
      <div className="shot-meter__gradient" />
      <div className="shot-meter__sweetspot" style={{ height: `${SWEET_SPOT_SIZE * 100}%` }} />
      <div
        className={`shot-meter__indicator ${inSweetSpot ? 'shot-meter__indicator--sweet' : 'shot-meter__indicator--normal'}`}
        style={{ bottom: `${value * 100}%` }}
      />
    </div>
  );
}

export default function GameScreen3D({ mode = 'freeplay', onBack, onGameEnd }: GameScreen3DProps) {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0, -4]);
  const [ballPosition, setBallPosition] = useState<[number, number, number]>([0.3, 0.8, -4]);
  const [animationState, setAnimationState] = useState<'idle' | 'dribbling' | 'gathering' | 'shooting'>('idle');
  const [isDribbling, setIsDribbling] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [ballState, setBallState] = useState<BallHandlingState>('IDLE');
  const [webcamActive, setWebcamActive] = useState(false);
  const [shotMeterValue, setShotMeterValue] = useState(0);
  const [shotMeterVisible, setShotMeterVisible] = useState(false);
  const [shotResult, setShotResult] = useState<string | null>(null);
  const [jumpProgress, setJumpProgress] = useState(0);
  const shotMeterValueRef = useRef(0);
  const [netSwish, setNetSwish] = useState(false);
  const [isPerfectSwish, setIsPerfectSwish] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(mode === 'timed' ? 60 : null);
  const [gameOver, setGameOver] = useState(false);
  const hasAttemptedShot = useRef(false);
  const streakRef = useRef(0);

  const ballSM = useRef(new BallStateMachine());
  const shotArc = useRef(new ShotArc());
  const keysPressed = useRef<Set<string>>(new Set());
  const smoothedPlayerPos = useRef({ x: 0, z: -4 });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gatherStartTime = useRef(0);
  const shotMeterStopped = useRef<number | null>(null);
  const fHeld = useRef(false);
  const fJustReleased = useRef(false);

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

  useEffect(() => {
    const sm = ballSM.current;
    const unsub = sm.onTransition((from, to) => {
      setBallState(to);

      if (to === 'GATHER_LOW') {
        gatherStartTime.current = performance.now();
        shotMeterStopped.current = null;
        setShotMeterVisible(true);
      }

      if (to === 'SHOOTING' && (from === 'GATHER_HIGH' || from === 'GATHER_LOW')) {
        shotMeterStopped.current = shotMeterValueRef.current;
        setShotMeterVisible(false);
      }

      if (to === 'FOLLOW_THROUGH' && from === 'SHOOTING') {
        const pos: [number, number, number] = [
          smoothedPlayerPos.current.x,
          1.7,
          smoothedPlayerPos.current.z,
        ];
        const hand = getHandData();
        const power = Math.min(1, Math.abs(hand.velocity.y) * 2);

        const sweetSpotStart = SWEET_SPOT_TOP - SWEET_SPOT_SIZE;
        const stoppedValue = shotMeterStopped.current ?? 0.5;
        const isGreen = stoppedValue >= sweetSpotStart && stoppedValue <= SWEET_SPOT_TOP;
        let accuracyBonus = 0;
        if (isGreen) {
          accuracyBonus = 1.0;
        } else {
          accuracyBonus = -(sweetSpotStart - stoppedValue) * 0.7;
        }

        shotArc.current.launch(pos, Math.max(0.4, power), accuracyBonus, isGreen);
      }

      if (to === 'SHOOTING' || to === 'FOLLOW_THROUGH') {
        setAnimationState('shooting');
      }

      if (!['GATHER_LOW', 'GATHER_HIGH'].includes(to)) {
        setShotMeterVisible(false);
      }

      if ((from === 'BOUNCE' || from === 'DEAD') && to === 'IDLE') {
        shotArc.current.reset();
        setShotResult(null);
      }
    });

    return unsub;
  }, [getHandData]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysPressed.current.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'f' && !fHeld.current) {
      fHeld.current = true;
      fJustReleased.current = false;
    }
    if (e.key === 'c') {
      if (!webcamActive) startWebcamMode();
      else stopWebcamMode();
    }
  }, [webcamActive, startWebcamMode, stopWebcamMode]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysPressed.current.delete(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'f' && fHeld.current) {
      fHeld.current = false;
      fJustReleased.current = true;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    if (mode !== 'timed' || gameOver) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, gameOver]);

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
          const distToHoop = Math.abs(targetZ - HOOP_Z);
          if (distToHoop > STOP_DISTANCE && !sm.isShooting() && !arc.isActive()) {
            targetZ -= AUTO_WALK_SPEED * dt;
          }

          const input: BallInput = {
            handX: hand.handNormalized.x,
            handY: hand.handNormalized.y,
            velocityX: hand.velocity.x,
            velocityY: hand.velocity.y,
            fingerExtension: hand.fingerExtension,
            handSide: hand.handedness === 'Left' ? 'left' : 'right',
            released: hand.release !== null,
            timeSinceStateEnter: sm.getStateTime(),
            twoGateRelease: hand.twoGateRelease,
          };

          sm.update(dt, input);

          if (skeletonCanvasRef.current && hand.rawHand.landmarks.length > 0) {
            const canvas = skeletonCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) drawHandSkeleton(ctx, hand.rawHand.landmarks, canvas.width, canvas.height);
          }
        } else {
          if (skeletonCanvasRef.current) {
            const ctx = skeletonCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, skeletonCanvasRef.current.width, skeletonCanvasRef.current.height);
          }
        }
      } else {
        const moveSpeed = 5;
        if (keysPressed.current.has('arrowup') || keysPressed.current.has('w')) targetZ -= moveSpeed * dt;
        if (keysPressed.current.has('arrowdown') || keysPressed.current.has('s')) targetZ += moveSpeed * dt;
        if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) targetX -= moveSpeed * dt;
        if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) targetX += moveSpeed * dt;

        targetX = Math.max(-COURT_HALF_W, Math.min(COURT_HALF_W, targetX));
        targetZ = Math.max(COURT_Z_MIN, Math.min(COURT_Z_MAX, targetZ));

        const holdingF = fHeld.current;
        const releasedF = fJustReleased.current;
        if (releasedF) fJustReleased.current = false;

        const isInGather = sm.isGathering();
        const isInShoot = sm.isShooting();

        const kbInput: BallInput = {
          handX: 0.5,
          handY: 0.5,
          velocityX: keysPressed.current.has('a') ? -0.6 : keysPressed.current.has('d') ? 0.6 : 0,
          velocityY: holdingF && !isInGather && !isInShoot ? -0.8 : keysPressed.current.has('e') ? 0.5 : 0,
          fingerExtension: releasedF && isInGather ? 0.2 : 0,
          handSide: 'right',
          released: releasedF && isInGather,
          timeSinceStateEnter: sm.getStateTime(),
          twoGateRelease: releasedF && isInGather,
        };

        sm.update(dt, kbInput);
      }

      const smoothFactor = 1 - Math.exp(-8 * dt);
      smoothedPlayerPos.current.x = lerp(smoothedPlayerPos.current.x, targetX, smoothFactor);
      smoothedPlayerPos.current.z = lerp(smoothedPlayerPos.current.z, targetZ, smoothFactor);

      smoothedPlayerPos.current.x = Math.max(-COURT_HALF_W, Math.min(COURT_HALF_W, smoothedPlayerPos.current.x));
      smoothedPlayerPos.current.z = Math.max(COURT_Z_MIN, Math.min(COURT_Z_MAX, smoothedPlayerPos.current.z));

      const px = smoothedPlayerPos.current.x;
      const pz = smoothedPlayerPos.current.z;
      setPlayerPosition([px, 0, pz]);

      if (sm.isGathering()) {
        const elapsed = (now - gatherStartTime.current) / 1000;
        const speed = SHOT_METER_SPEED_MIN + (SHOT_METER_SPEED_MAX - SHOT_METER_SPEED_MIN) *
          Math.min(1, elapsed / SHOT_METER_RAMP_TIME);
        const val = Math.min(1, elapsed * speed);
        shotMeterValueRef.current = val;
        setShotMeterValue(val);
        setJumpProgress(val);
      } else if (!sm.isShooting()) {
        setJumpProgress(0);
      }

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
            setStreak(s => {
              const newStreak = s + 1;
              streakRef.current = newStreak;
              setBestStreak(prev => Math.max(prev, newStreak));
              return newStreak;
            });
            const wasPerfect = arc.isPerfect();
            setShotResult(wasPerfect ? 'GREEN!' : arcState.hitRim || arcState.hitBackboard ? 'Bank!' : 'Swish!');
            setIsPerfectSwish(wasPerfect);
            setNetSwish(true);
            setTimeout(() => { setNetSwish(false); setIsPerfectSwish(false); }, 800);
            sm.forceTransition('DEAD');
          } else {
            if (mode === 'streak' && hasAttemptedShot.current && streakRef.current > 0) {
              setGameOver(true);
            }
            setStreak(0);
            streakRef.current = 0;
            setShotResult(arcState.hitRim ? 'Rim Out' : arcState.hitBackboard ? 'Off Board' : 'Airball');
            sm.forceTransition('BOUNCE');
          }
          hasAttemptedShot.current = true;
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
    return () => { stopWebcamMode(); };
  }, [stopWebcamMode]);

  return (
    <div className="game-screen">
      <GameCanvas
        playerPosition={playerPosition}
        ballPosition={ballPosition}
        ballVisible={true}
        isDribbling={isDribbling}
        animationState={animationState}
        triggerNetSwish={netSwish}
        isPerfectSwish={isPerfectSwish}
        jumpProgress={jumpProgress}
      />

      <div className="hud-score">
        <span>{score}</span>
        {streak >= 3 && (
          <span className="hud-score__streak">
            🔥 {streak}
          </span>
        )}
      </div>

      <div className="hud-state">{ballState}</div>

      {shotResult && (
        <div className={`shot-result ${
          shotResult === 'GREEN!' ? 'shot-result--green' :
          shotResult.includes('Swish') || shotResult.includes('Bank') ? 'shot-result--make' :
          'shot-result--miss'
        }`}>
          {shotResult}
        </div>
      )}

      {timeRemaining !== null && (
        <div className={`hud-timer ${timeRemaining <= 10 ? 'hud-timer--warning' : 'hud-timer--normal'}`}>
          {timeRemaining}s
        </div>
      )}

      {gameOver && (
        <div className="game-over">
          <div className="game-over__title">Game Over</div>
          <div className="game-over__stats">
            Score: {score} | Best Streak: {bestStreak}
          </div>
          <button
            className="game-over__btn"
            onClick={() => {
              onGameEnd?.(score, bestStreak);
              onBack?.();
            }}
          >
            Back to Menu
          </button>
        </div>
      )}

      <ShotMeter value={shotMeterValue} isVisible={shotMeterVisible} />

      {webcamActive && (
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
      )}

      <div className="controls-panel">
        {webcamActive ? (
          <>
            <div>🏃 Auto-walk to hoop</div>
            <div>✊ Hold hand still = dribble</div>
            <div>↔️ Quick swipe = crossover</div>
            <div>👆 Raise + flick = shoot</div>
            <div><kbd>C</kbd> Disable webcam</div>
          </>
        ) : (
          <>
            <div><b>WASD</b> Move</div>
            <div><b>E</b> Dribble</div>
            <div><b>Hold F</b> Jump shot (release in green)</div>
            <div><kbd>C</kbd> Enable webcam</div>
          </>
        )}
      </div>

      {onBack && (
        <button
          className="hud-back"
          onClick={() => {
            onGameEnd?.(score, bestStreak);
            onBack();
          }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}
