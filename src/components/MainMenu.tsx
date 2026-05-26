import { useEffect, useState, type CSSProperties } from 'react';
import './MainMenu.css';

interface MainMenuProps {
  onStartGame: () => void;
  onPoseMirror?: () => void;
  highScore: number;
}

export function MainMenu({ onStartGame, onPoseMirror, highScore }: MainMenuProps) {
  const [introVisible, setIntroVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIntroVisible(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const getRevealProps = (delay: string) => {
    const style: CSSProperties & { '--intro-delay': string } = {
      '--intro-delay': delay,
    };

    // Keep elements hidden until our own reveal starts so they never flash in,
    // disappear, and then re-enter after the stylesheet finishes loading.
    if (!introVisible) {
      style.opacity = 0;
      style.transform = 'translateY(28px)';
    }

    return {
      className: `menu-reveal${introVisible ? ' menu-reveal--visible' : ''}`,
      style,
    };
  };

  const titleReveal = getRevealProps('0.1s');
  const subtitleReveal = getRevealProps('0.2s');
  const statsReveal = getRevealProps('0.35s');
  const playReveal = getRevealProps('0.5s');
  const footerReveal = getRevealProps('0.65s');

  return (
    <div className="main-menu">
      <div className="menu-content">
        <h1 className={`menu-title ${titleReveal.className}`} style={titleReveal.style}>WebBall</h1>
        <p className={`menu-subtitle ${subtitleReveal.className}`} style={subtitleReveal.style}>Webcam Basketball</p>

        <div className={`stats-row ${statsReveal.className}`} style={statsReveal.style}>
          <div className="menu-stat">
            <span className="menu-stat-value">{highScore}</span>
            <span className="menu-stat-label">High Score</span>
          </div>
        </div>

        <button
          className={`play-button ${playReveal.className}`}
          style={playReveal.style}
          onClick={onStartGame}
        >
          Play Now
        </button>

        {onPoseMirror ? (
          <button
            className={`play-button play-button--secondary ${playReveal.className}`}
            style={{ ...playReveal.style, marginTop: '10px' }}
            onClick={onPoseMirror}
          >
            Pose Mirror
          </button>
        ) : null}

        <div className={`menu-footer ${footerReveal.className}`} style={footerReveal.style}>
          <p>✋ Move your hand to control the ball</p>
          <p>👆 Raise and flick to shoot</p>
          <p className="keyboard-hint">
            <kbd>ESC</kbd> during game to quit
          </p>
        </div>
      </div>
    </div>
  );
}
