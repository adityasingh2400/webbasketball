import { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import GameScreen3D from './components/GameScreen3D';
import './App.css';

type AppScreen = 'menu' | 'game3d';
type GameMode = 'freeplay' | 'timed' | 'streak';

const STORAGE_KEY = 'webball_stats';

interface StoredStats {
  highScore: number;
  bestStreak: number;
}

function loadStats(): StoredStats {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (_) { }
  return { highScore: 0, bestStreak: 0 };
}

function saveStats(stats: StoredStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (_) { }
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('freeplay');
  const [stats, setStats] = useState<StoredStats>(loadStats);

  const handleStartGame = (mode: GameMode) => {
    setGameMode(mode);
    setScreen('game3d');
  };

  const handleGameEnd = (score: number, streak: number) => {
    const newStats = {
      highScore: Math.max(stats.highScore, score),
      bestStreak: Math.max(stats.bestStreak, streak),
    };
    setStats(newStats);
    saveStats(newStats);
    setScreen('menu');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen === 'game3d') {
        setScreen('menu');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen]);

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          highScore={stats.highScore}
          bestStreak={stats.bestStreak}
        />
      )}
      {screen === 'game3d' && (
        <GameScreen3D
          mode={gameMode}
          onBack={() => setScreen('menu')}
          onGameEnd={handleGameEnd}
        />
      )}
    </div>
  );
}

export default App;
