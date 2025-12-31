import React, { useState, useEffect } from 'react';

// Cyberpunk Nav Controls - Mobile
// Ultra compact: music, avatar, menu only

export default function NavControlsMobile({ 
  isPlaying, 
  onPlayMusic,
  onStopMusic,
  onSkipTrack,
  onUserClick,
  onMenuClick,
  isUserSignedIn = false,
  isMenuOpen = false,
  is80s = false,
  userImage = null  // Accept user image from parent
}) {
  const [emoji, setEmoji] = useState("😇");
  
  // Alternate emoji
  useEffect(() => {
    const interval = setInterval(() => {
      setEmoji(prev => prev === "😇" ? "😈" : "😇");
    }, 3000);
    return () => clearInterval(interval);
  }, []);
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

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        
        .nav-mobile {
          font-family: 'Orbitron', monospace;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Music - Splits when active */
        .music-stack-mobile {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-height: 36px;
          justify-content: center;
        }

        .music-btn-mobile {
          width: 32px;
          height: 16px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 0, 110, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: rgba(255, 255, 255, 0.7);
          font-size: 8px;
        }

        .music-btn-mobile.single {
          height: 36px;
          border-radius: 8px;
          font-size: 14px;
          color: #ff006e;
        }
        
        .music-btn-mobile:hover,
        .music-btn-mobile:active {
          background: rgba(255, 0, 110, 0.2);
          border-color: #ff006e;
          color: #ff006e;
        }

        .music-btn-mobile.active {
          color: #ff006e;
          border-color: #ff006e;
          box-shadow: 0 0 8px rgba(255, 0, 110, 0.3);
        }

        /* Avatar - Smaller */
        .avatar-mobile {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a1a2e, #0d0d1a);
          border: 2px solid #00f5d4;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(0, 245, 212, 0.3);
          cursor: pointer;
          overflow: hidden;
          position: relative;
        }

        .avatar-status-mobile {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 8px;
          height: 8px;
          background: #00ff88;
          border-radius: 50%;
          border: 1px solid #0d0d1a;
          box-shadow: 0 0 4px rgba(0, 255, 136, 0.6);
        }

        .avatar-status-mobile.offline {
          background: #666;
          box-shadow: none;
        }

        /* Hamburger - Still the hero but smaller */
        .menu-button-mobile {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(255, 0, 110, 0.2), rgba(131, 56, 236, 0.2));
          border: 2px solid #ff006e;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 
            0 0 20px rgba(255, 0, 110, 0.4),
            0 0 40px rgba(255, 0, 110, 0.15);
        }
        
        .menu-button-mobile:active {
          transform: scale(0.95);
        }

        .menu-button-mobile::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 12px;
          background: linear-gradient(135deg, #ff006e, #8338ec, #00f5d4, #ff006e);
          background-size: 300% 300%;
          animation: borderGlowMobile 3s ease infinite;
          z-index: -1;
          opacity: 0.5;
        }

        @keyframes borderGlowMobile {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .menu-line-mobile {
          width: 18px;
          height: 2px;
          background: #ff006e;
          border-radius: 2px;
          transition: all 0.3s ease;
          box-shadow: 0 0 6px rgba(255, 0, 110, 0.8);
        }

        .menu-button-mobile.open .menu-line-mobile:nth-child(1) {
          transform: rotate(45deg) translate(4px, 4px);
        }
        
        .menu-button-mobile.open .menu-line-mobile:nth-child(2) {
          opacity: 0;
        }
        
        .menu-button-mobile.open .menu-line-mobile:nth-child(3) {
          transform: rotate(-45deg) translate(4px, -4px);
        }

        /* 80s Mode styling */
        .nav-mobile.mode-80s {
          background: rgba(20, 0, 40, 0.6);
          border-color: rgba(255, 0, 255, 0.3);
        }

        .mode-80s .menu-button-mobile {
          border-color: #ff00ff;
          box-shadow: 
            0 0 20px rgba(255, 0, 255, 0.5),
            0 0 40px rgba(255, 0, 255, 0.2);
        }

        .mode-80s .menu-line-mobile {
          background: #ff00ff;
          box-shadow: 0 0 6px rgba(255, 0, 255, 0.8);
        }

        .mode-80s .avatar-mobile {
          border-color: #00ffff;
          box-shadow: 0 0 12px rgba(0, 255, 255, 0.3);
        }

        .mode-80s .music-btn-mobile {
          border-color: rgba(255, 0, 255, 0.4);
        }

        .mode-80s .music-btn-mobile:hover,
        .mode-80s .music-btn-mobile:active,
        .mode-80s .music-btn-mobile.active {
          border-color: #ff00ff;
          color: #ff00ff;
          box-shadow: 0 0 8px rgba(255, 0, 255, 0.3);
        }
      `}</style>

      <div className="nav-mobile">
        {/* Music - Splits when active */}
        <div className="music-stack-mobile">
          {isPlaying ? (
            <>
              <button 
                className="music-btn-mobile active"
                onClick={handleStopClick}
                title="Stop"
              >
                ⏹
              </button>
              <button 
                className="music-btn-mobile" 
                onClick={handleSkipClick}
                title="Skip"
              >
                ⏭
              </button>
            </>
          ) : (
            <button 
              className="music-btn-mobile single"
              onClick={handlePlayClick}
              title="Play"
            >
              ♫
            </button>
          )}
        </div>

        {/* Avatar */}
        <div className="avatar-mobile" onClick={onUserClick}>
          {isUserSignedIn && userImage ? (
            <img 
              src={userImage} 
              alt="User" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                borderRadius: '6px'
              }} 
            />
          ) : (
            <span style={{ fontSize: '18px' }}>
              {isUserSignedIn ? '👤' : emoji}
            </span>
          )}
          <div className={`avatar-status-mobile ${isUserSignedIn ? '' : 'offline'}`} />
        </div>

        {/* Menu */}
        <button 
          className={`menu-button-mobile ${isMenuOpen ? 'open' : ''}`}
          onClick={handleMenuClick}
        >
          <span className="menu-line-mobile" />
          <span className="menu-line-mobile" />
          <span className="menu-line-mobile" />
        </button>
      </div>
    </>
  );
}