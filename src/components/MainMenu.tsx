import { useState } from 'react';
import './MainMenu.css';

type GameMode = 'freeplay' | 'timed' | 'streak';

interface MainMenuProps {
  onStartGame: (mode: GameMode) => void;
  onStart3D?: () => void;
  highScore: number;
  bestStreak: number;
}

export function MainMenu({ onStartGame, onStart3D, highScore, bestStreak }: MainMenuProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('freeplay');

  const modes: { id: GameMode; name: string; description: string; icon: string }[] = [
    {
      id: 'freeplay',
      name: 'Free Play',
      description: 'Practice your shots with no pressure',
      icon: '🏀',
    },
    {
      id: 'timed',
      name: '60 Second Challenge',
      description: 'Score as many as you can in 60 seconds',
      icon: '⏱️',
    },
    {
      id: 'streak',
      name: 'Streak Mode',
      description: 'How many can you make in a row?',
      icon: '🔥',
    },
  ];

  return (
    <div className="main-menu">
      <div className="menu-content">
        <h1 className="menu-title">WebBall</h1>
        <p className="menu-subtitle">Webcam Basketball</p>

        <div className="stats-row">
          <div className="menu-stat">
            <span className="menu-stat-value">{highScore}</span>
            <span className="menu-stat-label">High Score</span>
          </div>
          <div className="menu-stat">
            <span className="menu-stat-value">{bestStreak}</span>
            <span className="menu-stat-label">Best Streak</span>
          </div>
        </div>

        <div className="mode-selector">
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`mode-option ${selectedMode === mode.id ? 'selected' : ''}`}
              onClick={() => setSelectedMode(mode.id)}
            >
              <span className="mode-icon">{mode.icon}</span>
              <span className="mode-name">{mode.name}</span>
              <span className="mode-description">{mode.description}</span>
            </button>
          ))}
        </div>

        <button className="play-button" onClick={() => onStartGame(selectedMode)}>
          Play Now
        </button>

        {onStart3D && (
          <button 
            className="play-button" 
            onClick={onStart3D}
            style={{ marginTop: '10px', background: 'linear-gradient(135deg, #4a90d9 0%, #357abd 100%)' }}
          >
            🎮 3D Mode (Beta)
          </button>
        )}

        <div className="menu-footer">
          <p>✋ Move your hand to grab the ball</p>
          <p>👆 Flick upward to shoot at the hoop</p>
          <p className="keyboard-hint">
            <kbd>ESC</kbd> during game to quit
          </p>
        </div>
      </div>
    </div>
  );
}
