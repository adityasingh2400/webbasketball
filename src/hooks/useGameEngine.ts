import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../engine/GameEngine';
import type { EngineConfig, EngineState, GameEvent, GameContext } from '../types';

export function useGameEngine(_config: Partial<EngineConfig> | null) {
  const engineRef = useRef<GameEngine | null>(null);
  const [state, setState] = useState<EngineState>({
    initialized: false,
    running: false,
    fps: 0,
    frameTime: 0,
    mediaPipeLoaded: false,
    loadProgress: 0,
    error: null,
  });
  const [gameContext, setGameContext] = useState<GameContext | null>(null);

  const initEngine = useCallback(async (fullConfig: EngineConfig) => {
    if (engineRef.current) {
      engineRef.current.destroy();
    }

    const engine = GameEngine.getInstance();
    engineRef.current = engine;

    engine.on('*', (_event: GameEvent) => {
      setState(engine.getState());
      setGameContext(engine.getGameContext());
    });

    try {
      await engine.init(fullConfig);
      setState(engine.getState());

      await engine.initRenderer(fullConfig.container, fullConfig.videoElement);
      setState(engine.getState());
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to initialize engine',
      }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    engineRef.current?.start();
    if (engineRef.current) {
      setState(engineRef.current.getState());
    }
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    if (engineRef.current) {
      setState(engineRef.current.getState());
    }
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  return {
    engine: engineRef.current,
    state,
    gameContext,
    initEngine,
    start,
    stop,
    pause,
    resume,
  };
}
