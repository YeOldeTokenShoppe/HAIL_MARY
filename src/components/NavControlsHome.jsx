import React, { useState, useEffect } from 'react';
import { SignInButton, UserButton } from "@clerk/nextjs";

// Home page specific nav controls with integrated 80s mode button
export default function NavControlsHome({ 
  isPlaying, 
  onPlayMusic,
  onStopMusic,
  onSkipTrack,
  onUserClick,
  onMenuClick,
  isUserSignedIn = false,
  isMenuOpen = false,
  is80sMode = false,
  onToggle80sMode,
  userImage = null
}) {
  const [emoji, setEmoji] = useState("😇");
  
  // Alternate emoji for avatar
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
        
        .nav-mobile-home {
          font-family: 'Orbitron', monospace;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          background: rgba(10, 10, 20, 0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid rgba(212, 175, 55, 0.15);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        /* 80s Mode Button */
        .eighties-btn-mobile {
          width: 3rem;
          height: 3rem;
          min-width: 3rem;
          min-height: 3rem;
          flex-shrink: 0;
          border-radius: 10px;
          background: ${is80sMode 
            ? 'rgba(255, 0, 255, 0.1)' 
            : 'rgba(212, 175, 55, 0.05)'};
          border: 1.5px solid ${is80sMode ? 'rgba(255, 0, 255, 0.4)' : 'rgba(212, 175, 55, 0.2)'};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: ${is80sMode 
            ? '0 0 15px rgba(255, 0, 255, 0.3)' 
            : 'none'};
          position: relative;
        }

        .eighties-btn-mobile:hover {
          transform: scale(1.05);
          box-shadow: ${is80sMode 
            ? '0 0 30px rgba(217, 70, 239, 0.7), 0 2px 8px rgba(0, 0, 0, 0.3)'
            : '0 0 15px rgba(217, 70, 239, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)'};
          border-color: ${is80sMode ? '#ff00ff' : '#d946ef'};
        }

        .eighties-btn-mobile:active {
          transform: scale(0.95);
        }

        .eighties-btn-text {
          font-size: 11px;
          font-weight: bold;
          color: ${is80sMode ? '#00ff41' : '#67e8f9'};
          text-shadow: ${is80sMode ? '0 0 10px #00ff41' : 'none'};
          font-family: 'Orbitron', monospace;
          line-height: 0.9;
        }

        .eighties-btn-text-small {
          font-size: 7px;
          font-weight: bold;
          color: ${is80sMode ? '#00ff41' : '#67e8f9'};
          text-shadow: ${is80sMode ? '0 0 10px #00ff41' : 'none'};
          font-family: 'Orbitron', monospace;
        }

        .eighties-btn-emoji {
          position: absolute;
          top: 1px;
          right: 1px;
          font-size: 9px;
          opacity: ${is80sMode ? 1 : 0.5};
        }

        /* Music - Splits when active */
        .music-stack-mobile {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-height: 3rem;
          width: 3rem;
          min-width: 3rem;
          flex-shrink: 0;
          justify-content: center;
        }

        .music-btn-mobile {
          width: 3rem;
          height: 1.4rem;
          border-radius: 6px;
          background: rgba(212, 175, 55, 0.05);
          border: 1.5px solid rgba(212, 175, 55, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: rgba(212, 175, 55, 0.7);
          font-size: 10px;
        }

        .music-btn-mobile.single {
          height: 3rem;
          border-radius: 10px;
          font-size: 16px;
          color: rgba(212, 175, 55, 0.8);
        }
        
        .music-btn-mobile:hover,
        .music-btn-mobile:active {
          background: rgba(212, 175, 55, 0.1);
          border-color: rgba(212, 175, 55, 0.4);
          color: rgba(212, 175, 55, 0.9);
        }

        .music-btn-mobile.active {
          color: rgba(212, 175, 55, 0.9);
          border-color: rgba(212, 175, 55, 0.4);
          background: rgba(212, 175, 55, 0.1);
        }

        /* Avatar - Consistent size */
        .avatar-mobile {
          width: 3rem;
          height: 3rem;
          min-width: 3rem;
          min-height: 3rem;
          flex-shrink: 0;
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.05);
          border: 1.5px solid rgba(212, 175, 55, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          position: relative;
          transition: all 0.2s ease;
        }
        
        .avatar-mobile:hover {
          border-color: rgba(212, 175, 55, 0.4);
          background: rgba(212, 175, 55, 0.1);
        }

        /* Style Clerk's UserButton to match our avatar-mobile style */
        :global(.cl-userButtonBox) {
          width: 3rem !important;
          height: 3rem !important;
        }

        :global(.cl-userButtonTrigger) {
          width: 3rem !important;
          height: 3rem !important;
          min-width: 3rem !important;
          min-height: 3rem !important;
          max-width: 3rem !important;
          max-height: 3rem !important;
          border-radius: 10px !important;
          background: rgba(212, 175, 55, 0.05) !important;
          border: 1.5px solid rgba(212, 175, 55, 0.2) !important;
          transition: all 0.2s ease;
          padding: 0 !important;
          overflow: hidden !important;
        }

        :global(.cl-userButtonTrigger:hover) {
          border-color: rgba(212, 175, 55, 0.4) !important;
          background: rgba(212, 175, 55, 0.1) !important;
        }

        :global(.cl-avatarBox) {
          width: 100% !important;
          height: 100% !important;
          border-radius: 10px !important;
        }

        :global(.cl-avatarImage) {
          width: 100% !important;
          height: 100% !important;
          border-radius: 8px !important;
          object-fit: cover !important;
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

        /* Hamburger - Consistent with other buttons */
        .menu-button-mobile {
          position: relative;
          width: 3rem;
          height: 3rem;
          min-width: 3rem;
          min-height: 3rem;
          flex-shrink: 0;
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.05);
          border: 1.5px solid rgba(212, 175, 55, 0.2);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .menu-button-mobile:hover {
          border-color: rgba(212, 175, 55, 0.4);
          background: rgba(212, 175, 55, 0.1);
        }
        
        .menu-button-mobile:active {
          transform: scale(0.95);
        }

        .menu-line-mobile {
          width: 20px;
          height: 2px;
          background: rgba(212, 175, 55, 0.7);
          border-radius: 1px;
          transition: all 0.2s ease;
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
        
        .menu-button-mobile.open {
          background: rgba(212, 175, 55, 0.1);
        }
        
        .menu-button-mobile.open .menu-line-mobile {
          background: rgba(212, 175, 55, 0.9);
        }

        /* 80s Mode styling */
        .nav-mobile-home.mode-80s {
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

        .mode-80s :global(.cl-userButtonTrigger) {
          border-color: #00ffff !important;
          box-shadow: 0 0 12px rgba(0, 255, 255, 0.3) !important;
        }

        .mode-80s :global(.cl-userButtonTrigger:hover) {
          border-color: #00ffff !important;
          box-shadow: 0 0 20px rgba(0, 255, 255, 0.5) !important;
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

        ${is80sMode ? `
          @keyframes neonFlicker {
            0%, 100% { opacity: 1; }
            33% { opacity: 0.8; }
            66% { opacity: 0.9; }
          }

          .eighties-btn-text {
            animation: neonFlicker 2s infinite;
          }
        ` : ''}
      `}</style>

      <div className={`nav-mobile-home ${is80sMode ? 'mode-80s' : ''}`}>
        {/* 80s Mode Button */}
        <button 
          className="eighties-btn-mobile"
          onClick={onToggle80sMode}
          title={is80sMode ? "Disable 80s Mode" : "Enable 80s Mode"}
        >
          <span className="eighties-btn-emoji">{is80sMode ? '🎸' : ''}</span>
          <span className="eighties-btn-text">
            80s
          </span>
          <span className="eighties-btn-text-small">
            MODE
          </span>
        </button>

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
        <div style={{ width: '3rem', height: '3rem', flexShrink: 0 }}>
          {isUserSignedIn ? (
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "avatar-mobile",
                  userButtonTrigger: "avatar-mobile"
                }
              }}
            />
          ) : (
            <SignInButton mode="modal" forceRedirectUrl="/">
              <button className="avatar-mobile">
                <span style={{ fontSize: '18px' }}>{emoji}</span>
                <div className="avatar-status-mobile offline" />
              </button>
            </SignInButton>
          )}
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