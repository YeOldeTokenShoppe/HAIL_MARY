import React, { useState, useEffect } from 'react';

// Cyberpunk Nav Controls v4 - RL80
// Separate toggles for Aurora shader and 80s mode
// Music controls as stacked play/skip buttons

export default function NavControls({ 
  auroraOn, 
  setAuroraOn, 
  is80s, 
  setIs80s, 
  isPlaying, 
  onPlayMusic,
  onStopMusic,
  onSkipTrack,
  onUserClick,
  onMenuClick,
  isUserSignedIn = false,
  isMenuOpen = false  // Accept menu state from parent
}) {
  const [emoji, setEmoji] = useState("😇");
  
  // Alternate emoji
  useEffect(() => {
    const interval = setInterval(() => {
      setEmoji(prev => prev === "😇" ? "😈" : "😇");
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    }
  };

  const handlePlayClick = () => {
    if (onPlayMusic) {
      onPlayMusic();
    }
  };

  const handleStopClick = () => {
    if (onStopMusic) {
      onStopMusic();
    }
  };

  const handleSkipClick = () => {
    if (onSkipTrack) {
      onSkipTrack();
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        
        .nav-controls {
          font-family: 'Orbitron', monospace;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Toggle Pod - Contains both toggles */
        .toggle-pod {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Individual Toggle Row */
        .toggle-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .toggle-row:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .toggle-row .icon {
          font-size: 14px;
          width: 20px;
          text-align: center;
          transition: all 0.3s ease;
        }

        /* Aurora Toggle - Cyan accent */
        .toggle-aurora .toggle-track {
          width: 36px;
          height: 20px;
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-radius: 10px;
          position: relative;
          transition: all 0.3s ease;
          border: 1px solid rgba(0, 245, 212, 0.2);
        }
        
        .toggle-aurora .toggle-track.active {
          background: linear-gradient(135deg, #00f5d4, #00bbf9);
          border-color: rgba(0, 245, 212, 0.6);
          box-shadow: 0 0 15px rgba(0, 245, 212, 0.4);
        }

        .toggle-aurora .toggle-thumb {
          width: 14px;
          height: 14px;
          background: #4a5568;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .toggle-aurora .toggle-thumb.active {
          left: 18px;
          background: #fff;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
        }

        .toggle-aurora.active .icon-left {
          filter: drop-shadow(0 0 6px rgba(0, 245, 212, 0.8));
        }

        .toggle-aurora.active .icon-right {
          filter: drop-shadow(0 0 6px rgba(0, 245, 212, 0.8));
        }

        /* 80s Toggle - Magenta accent */
        .toggle-80s .toggle-track {
          width: 36px;
          height: 20px;
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-radius: 10px;
          position: relative;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 0, 110, 0.2);
        }
        
        .toggle-80s .toggle-track.active {
          background: linear-gradient(135deg, #ff006e, #8338ec);
          border-color: rgba(255, 0, 110, 0.6);
          box-shadow: 0 0 15px rgba(255, 0, 110, 0.4);
        }

        .toggle-80s .toggle-thumb {
          width: 14px;
          height: 14px;
          background: #4a5568;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .toggle-80s .toggle-thumb.active {
          left: 18px;
          background: #fff;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
        }

        .toggle-80s.active .icon-left {
          filter: drop-shadow(0 0 6px rgba(255, 0, 110, 0.8));
        }

        .toggle-80s.active .icon-right {
          filter: drop-shadow(0 0 6px rgba(255, 0, 110, 0.8));
        }

        /* Toggle Labels */
        .toggle-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.35);
          text-transform: uppercase;
          min-width: 42px;
        }

        .toggle-aurora.active .toggle-label {
          color: #00f5d4;
        }

        .toggle-80s.active .toggle-label {
          color: #ff006e;
        }

        /* Avatar */
        .avatar-container {
          position: relative;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1a1a2e, #0d0d1a);
          border: 2px solid #00f5d4;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 0 20px rgba(0, 245, 212, 0.4),
            inset 0 0 20px rgba(0, 245, 212, 0.1);
          transition: all 0.3s ease;
          cursor: pointer;
          overflow: hidden;
        }
        
        .avatar:hover {
          box-shadow: 
            0 0 30px rgba(0, 245, 212, 0.6),
            inset 0 0 20px rgba(0, 245, 212, 0.2);
          transform: scale(1.05);
        }

        .avatar-status {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background: #00ff88;
          border-radius: 50%;
          border: 2px solid #0d0d1a;
          box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
        }

        .avatar-status.offline {
          background: #666;
          box-shadow: none;
        }

        /* Music Stack - Splits from one to two buttons */
        .music-stack {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 44px;
          justify-content: center;
        }

        .music-btn {
          width: 40px;
          height: 1.8rem;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 0, 110, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: rgba(255, 255, 255, 0.7);
          font-size: 10px;
        }

        .music-btn.single {
          height: 44px;
          border-radius: 10px;
          font-size: 18px;
          color: #ff006e;
        }
        
        .music-btn:hover {
          background: rgba(255, 0, 110, 0.2);
          border-color: #ff006e;
          color: #ff006e;
          box-shadow: 0 0 12px rgba(255, 0, 110, 0.3);
        }

        .music-btn.active {
          color: #ff006e;
          border-color: #ff006e;
          box-shadow: 0 0 10px rgba(255, 0, 110, 0.3);
        }

        /* HAMBURGER MENU - THE HERO */
        .menu-button {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255, 0, 110, 0.2), rgba(131, 56, 236, 0.2));
          border: 2px solid #ff006e;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 
            0 0 30px rgba(255, 0, 110, 0.4),
            0 0 60px rgba(255, 0, 110, 0.2);
        }
        
        .menu-button:hover {
          transform: scale(1.08);
          box-shadow: 
            0 0 40px rgba(255, 0, 110, 0.6),
            0 0 80px rgba(255, 0, 110, 0.3);
        }

        .menu-button::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 14px;
          background: linear-gradient(135deg, #ff006e, #8338ec, #00f5d4, #ff006e);
          background-size: 300% 300%;
          animation: borderGlow 3s ease infinite;
          z-index: -1;
          opacity: 0.6;
        }

        @keyframes borderGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .menu-line {
          width: 24px;
          height: 2px;
          background: #ff006e;
          border-radius: 2px;
          transition: all 0.3s ease;
          box-shadow: 0 0 8px rgba(255, 0, 110, 0.8);
        }

        .menu-button:hover .menu-line {
          box-shadow: 0 0 12px rgba(255, 0, 110, 1);
        }

        .menu-button.open .menu-line:nth-child(1) {
          transform: rotate(45deg) translate(5px, 5px);
        }
        
        .menu-button.open .menu-line:nth-child(2) {
          opacity: 0;
        }
        
        .menu-button.open .menu-line:nth-child(3) {
          transform: rotate(-45deg) translate(5px, -5px);
        }

        .menu-label {
          position: absolute;
          bottom: -20px;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #ff006e;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(255, 0, 110, 0.8);
        }

        /* 80s Mode Overrides */
        .nav-controls.mode-80s {
          background: rgba(20, 0, 40, 0.6);
          border-color: rgba(255, 0, 255, 0.3);
        }

        .mode-80s .menu-button {
          border-color: #ff00ff;
          box-shadow: 
            0 0 30px rgba(255, 0, 255, 0.5),
            0 0 60px rgba(255, 0, 255, 0.3);
        }

        .mode-80s .menu-line {
          background: #ff00ff;
          box-shadow: 0 0 8px rgba(255, 0, 255, 0.8);
        }

        .mode-80s .menu-label {
          color: #ff00ff;
          text-shadow: 0 0 10px rgba(255, 0, 255, 0.8);
        }

        .mode-80s .avatar {
          border-color: #00ffff;
          box-shadow: 
            0 0 20px rgba(0, 255, 255, 0.4),
            inset 0 0 20px rgba(0, 255, 255, 0.1);
        }

        .mode-80s .toggle-pod {
          border-color: rgba(255, 0, 255, 0.2);
        }

        .mode-80s .music-btn {
          border-color: rgba(255, 0, 255, 0.4);
        }

        .mode-80s .music-btn:hover,
        .mode-80s .music-btn.playing {
          border-color: #ff00ff;
          color: #ff00ff;
          box-shadow: 0 0 12px rgba(255, 0, 255, 0.3);
        }
      `}</style>

      <div className={`nav-controls ${is80s ? 'mode-80s' : ''}`}>
        {/* Toggle Pod - Both toggles stacked */}
        <div className="toggle-pod">
          {/* Aurora Toggle */}
          <div 
            className={`toggle-row toggle-aurora ${auroraOn ? 'active' : ''}`}
            onClick={() => setAuroraOn(!auroraOn)}
          >
            <span className="icon icon-left">✨</span>
            <div className={`toggle-track ${auroraOn ? 'active' : ''}`}>
              <div className={`toggle-thumb ${auroraOn ? 'active' : ''}`} />
            </div>
            <span className="icon icon-right">🦄</span>
            <span className="toggle-label">Aurora</span>
          </div>

          {/* 80s Mode Toggle */}
          <div 
            className={`toggle-row toggle-80s ${is80s ? 'active' : ''}`}
            onClick={() => setIs80s(!is80s)}
          >
            <span className="icon icon-left">🌴</span>
            <div className={`toggle-track ${is80s ? 'active' : ''}`}>
              <div className={`toggle-thumb ${is80s ? 'active' : ''}`} />
            </div>
            <span className="icon icon-right">🕹️</span>
            <span className="toggle-label">80s</span>
          </div>
        </div>

        {/* Music Controls - Splits when active */}
        <div className="music-stack">
          {isPlaying ? (
            <>
              <button 
                className="music-btn active"
                onClick={handleStopClick}
                title="Stop"
              >
                ⏹
              </button>
              <button 
                className="music-btn"
                onClick={handleSkipClick}
                title="Skip Track"
              >
                ⏭
              </button>
            </>
          ) : (
            <button 
              className="music-btn single"
              onClick={handlePlayClick}
              title="Play Music"
            >
              ♫
            </button>
          )}
        </div>

        {/* Avatar */}
        <div className="avatar-container" onClick={onUserClick}>
          <div className="avatar">
            <span style={{ fontSize: '24px' }}>
              {isUserSignedIn ? '👤' : emoji}
            </span>
          </div>
          <div className={`avatar-status ${isUserSignedIn ? '' : 'offline'}`} />
        </div>

        {/* HAMBURGER MENU - THE HERO */}
        <button 
          className={`menu-button ${isMenuOpen ? 'open' : ''}`}
          onClick={handleMenuClick}
        >
          <span className="menu-line" />
          <span className="menu-line" />
          <span className="menu-line" />
          <span className="menu-label">Menu</span>
        </button>
      </div>
    </>
  );
}