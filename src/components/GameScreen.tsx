import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { useGameEngine } from '../hooks/useGameEngine';
import type { EngineConfig, GameState } from '../types';
import './GameScreen.css';

type GameMode = 'freeplay' | 'timed' | 'streak';

interface GameScreenProps {
  mode: GameMode;
  onGameEnd: (score: number, streak: number) => void;
}

const STATE_LABELS: Record<GameState, string> = {
  IDLE: 'Move hand to grab ball',
  HOLDING: 'Hold the ball',
  DRIBBLING: 'Dribbling...',
  GATHERING: 'Aim and release!',
  SHOOTING: 'Shot!',
  IN_FLIGHT: '',
  RESOLVING: '',
  SCORED: 'NICE!',
  MISSED: 'Miss',
  COOLDOWN: '',
};

const TIMED_MODE_DURATION = 60;

export function GameScreen({ mode, onGameEnd }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showScoreFlash, setShowScoreFlash] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMED_MODE_DURATION);
  const timerRef = useRef<number | null>(null);

  const { state: webcamState, startWebcam, stopWebcam } = useWebcam({
    width: 1280,
    height: 720,
    frameRate: 30,
  });

  const { state: engineState, gameContext, initEngine, start, stop } = useGameEngine(null);

  useEffect(() => {
    if (videoRef.current && !webcamState.isReady && !webcamState.isLoading) {
      startWebcam(videoRef.current);
    }
  }, [webcamState.isReady, webcamState.isLoading, startWebcam]);

  useEffect(() => {
    if (webcamState.isReady && containerRef.current && videoRef.current && !engineState.initialized) {
      const config: EngineConfig = {
        container: containerRef.current,
        videoElement: videoRef.current,
        render: {
          width: containerRef.current.clientWidth || 1280,
          height: containerRef.current.clientHeight || 720,
          mirrorVideo: true,
          maxParticles: 500,
          enableScreenShake: true,
        },
        physics: {
          gravity: 1.5,
          drag: 0.01,
          bounce: 0.6,
          ballRadius: 0.04,
        },
        audio: {
          masterVolume: 1,
          sfxVolume: 0.8,
          musicVolume: 0.5,
          muted: false,
        },
        hoop: {
          position: { x: 0.5, y: 0.25 },
          width: 0.12,
          rimThickness: 0.015,
          backboardOffset: 0.08,
        },
      };

      initEngine(config);
    }
  }, [webcamState.isReady, engineState.initialized, initEngine]);

  useEffect(() => {
    if (engineState.initialized && !engineState.running) {
      start();
      
      if (mode === 'timed') {
        setTimeRemaining(TIMED_MODE_DURATION);
        timerRef.current = window.setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              handleGameEnd();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [engineState.initialized, mode]);

  const prevScore = useRef(0);
  useEffect(() => {
    if (gameContext && gameContext.score > prevScore.current) {
      setShowScoreFlash(true);
      setTimeout(() => setShowScoreFlash(false), 500);
      prevScore.current = gameContext.score;
    }
  }, [gameContext?.score]);

  useEffect(() => {
    if (mode === 'streak' && gameContext && gameContext.streak === 0 && gameContext.shotsAttempted > 0) {
      handleGameEnd();
    }
  }, [mode, gameContext?.streak, gameContext?.shotsAttempted]);

  const handleGameEnd = useCallback(() => {
    stop();
    stopWebcam();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onGameEnd(gameContext?.score ?? 0, gameContext?.bestStreak ?? 0);
  }, [stop, stopWebcam, onGameEnd, gameContext?.score, gameContext?.bestStreak]);

  const handleQuit = useCallback(() => {
    handleGameEnd();
  }, [handleGameEnd]);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  const currentState = gameContext?.state ?? 'IDLE';
  const stateLabel = STATE_LABELS[currentState];

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="game-screen">
      <div className="game-container" ref={containerRef}>
        <video
          ref={videoRef}
          className="webcam-video"
          playsInline
          muted
          autoPlay
        />

        {webcamState.isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <p>Accessing camera...</p>
          </div>
        )}

        {webcamState.error && (
          <div className="error-overlay">
            <div className="error-content">
              <div className="error-icon">📷</div>
              <h3>Camera Access Required</h3>
              <p>{webcamState.error}</p>
              <button 
                className="retry-button"
                onClick={() => videoRef.current && startWebcam(videoRef.current)}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {engineState.loadProgress > 0 && engineState.loadProgress < 1 && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="loading-icon">🏀</div>
              <div className="loading-bar">
                <div 
                  className="loading-bar-fill" 
                  style={{ width: `${engineState.loadProgress * 100}%` }} 
                />
              </div>
              <p>
                {engineState.loadProgress < 0.6 
                  ? 'Loading hand tracking...' 
                  : engineState.loadProgress < 0.8 
                    ? 'Loading audio...' 
                    : 'Starting game...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {engineState.running && gameContext && (
        <div className="hud">
          <div className="hud-top">
            <div className="score-container">
              <div className={`score ${showScoreFlash ? 'flash' : ''}`}>
                {gameContext.score}
              </div>
              <div className="score-label">SCORE</div>
            </div>

            {mode === 'timed' && (
              <div className="timer-container">
                <div className={`timer ${timeRemaining <= 10 ? 'warning' : ''}`}>
                  {formatTime(timeRemaining)}
                </div>
              </div>
            )}

            <div className="stats-container">
              <div className="stat">
                <span className="stat-value">{gameContext.streak}</span>
                <span className="stat-label">STREAK</span>
              </div>
              <div className="stat">
                <span className="stat-value">{gameContext.bestStreak}</span>
                <span className="stat-label">BEST</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {gameContext.shotsAttempted > 0 
                    ? Math.round((gameContext.shotsMade / gameContext.shotsAttempted) * 100) 
                    : 0}%
                </span>
                <span className="stat-label">FG%</span>
              </div>
            </div>

            <div className="fps-counter">{engineState.fps} FPS</div>
          </div>

          {stateLabel && (
            <div className={`state-indicator ${currentState.toLowerCase()}`}>
              {stateLabel}
            </div>
          )}

          {(currentState === 'SCORED' || currentState === 'MISSED') && gameContext.lastShotOutcome && (
            <div className={`shot-result ${currentState.toLowerCase()}`}>
              {gameContext.lastShotOutcome === 'swish' && '🔥 SWISH!'}
              {gameContext.lastShotOutcome === 'rim_in' && '✨ Nice!'}
              {gameContext.lastShotOutcome === 'backboard' && '📐 Bank!'}
              {gameContext.lastShotOutcome === 'rim_out' && 'Rim out'}
              {gameContext.lastShotOutcome === 'airball' && 'Airball'}
            </div>
          )}

          <button className="stop-button" onClick={handleQuit}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
