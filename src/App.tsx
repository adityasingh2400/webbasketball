import { useState } from 'react';
import { MainMenu } from './components/MainMenu';
import GameScreen3D from './components/GameScreen3D';
import './App.css';

type AppScreen = 'menu' | 'game3d';

const STORAGE_KEY = 'webball_stats';

interface StoredStats {
  highScore: number;
}

function loadStats(): StoredStats {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore storage read failures and fall back to defaults.
  }
  return { highScore: 0 };
}

function saveStats(stats: StoredStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage write failures in environments without persistence.
  }
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [stats, setStats] = useState<StoredStats>(loadStats);

  const handleStartGame = () => {
    setScreen('game3d');
  };

  const handleGameEnd = (score: number) => {
    const newStats = {
      highScore: Math.max(stats.highScore, score),
    };
    setStats(newStats);
    saveStats(newStats);
    setScreen('menu');
  };

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          highScore={stats.highScore}
        />
      )}
      {screen === 'game3d' && (
        <GameScreen3D
          onBack={() => setScreen('menu')}
          onGameEnd={handleGameEnd}
        />
      )}
    </div>
  );
}

export default App;
