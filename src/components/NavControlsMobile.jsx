import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageProvider';

// Cyberpunk Nav Controls - Mobile
// Ultra compact: music, avatar, language, menu

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'it', label: 'IT' },
  { code: 'pt', label: 'PT' },
  { code: 'ru', label: 'РУ' },
  { code: 'ja', label: '日本' },
  { code: 'ko', label: '한국' },
  { code: 'hi', label: 'हिं' },
  { code: 'vi', label: 'VI' },
  { code: 'ar', label: 'عر' },
  { code: 'la', label: 'LA' },
];

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
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);
  const { locale, setLocale } = useLanguage();
  
  // Alternate emoji
  useEffect(() => {
    const interval = setInterval(() => {
      setEmoji(prev => prev === "😇" ? "😈" : "😇");
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    if (langOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }
  }, [langOpen]);
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
          gap: 4px;
          min-height: 2.5rem;
          justify-content: center;
        }

        .music-btn-mobile {
          width: 2.5rem;
          height: 1.2rem;
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

        .music-btn-mobile.single {
          height: 2.5rem;
          width: 2.5rem;
          border-radius: 10px;
          font-size: 18px;
          color: #ff006e;
            border: 2px solid #ff006e;
          
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

        /* Avatar - Consistent size */
        .avatar-mobile {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 10px;
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
          bottom: 1px;
          right: 1px;
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

        /* Hamburger - Consistent size */
        .menu-button-mobile {
          position: relative;
          width: 2.5rem;
          height: 2.5rem;
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
          width: 1.2rem;
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

        /* Language button */
        .lang-btn-mobile {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(0, 245, 212, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #00f5d4;
          font-size: 10px;
          font-family: 'Orbitron', monospace;
          font-weight: 700;
          letter-spacing: 0.5px;
          position: relative;
          padding: 0;
        }

        .lang-btn-mobile:hover,
        .lang-btn-mobile:active {
          background: rgba(0, 245, 212, 0.15);
          border-color: #00f5d4;
          box-shadow: 0 0 8px rgba(0, 245, 212, 0.3);
        }

        .lang-dropdown-mobile {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          background: rgba(10, 10, 20, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(0, 245, 212, 0.3);
          border-radius: 10px;
          padding: 6px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          z-index: 10000;
          min-width: 140px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 245, 212, 0.1);
        }

        .lang-option-mobile {
          padding: 6px 8px;
          border-radius: 6px;
          background: transparent;
          border: 1px solid transparent;
          color: rgba(255, 255, 255, 0.7);
          font-family: 'Orbitron', monospace;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .lang-option-mobile:hover {
          background: rgba(0, 245, 212, 0.1);
          color: #00f5d4;
          border-color: rgba(0, 245, 212, 0.3);
        }

        .lang-option-mobile.active {
          background: rgba(0, 245, 212, 0.15);
          color: #00f5d4;
          border-color: #00f5d4;
          box-shadow: 0 0 6px rgba(0, 245, 212, 0.2);
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

        .mode-80s .lang-btn-mobile {
          border-color: rgba(0, 255, 255, 0.4);
          color: #00ffff;
        }

        .mode-80s .lang-btn-mobile:hover,
        .mode-80s .lang-btn-mobile:active {
          border-color: #00ffff;
          background: rgba(0, 255, 255, 0.15);
          box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
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
            <span style={{ fontSize: '1.5rem' }}>
              {isUserSignedIn ? '👤' : emoji}
            </span>
          )}
          <div className={`avatar-status-mobile ${isUserSignedIn ? '' : 'offline'}`} />
        </div>

        {/* Language */}
        <div ref={langRef} style={{ position: 'relative' }}>
          <button
            className="lang-btn-mobile"
            onClick={() => setLangOpen(prev => !prev)}
            title="Language"
          >
            {locale.toUpperCase()}
          </button>
          {langOpen && (
            <div className="lang-dropdown-mobile">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  className={`lang-option-mobile ${locale === lang.code ? 'active' : ''}`}
                  onClick={() => {
                    setLocale(lang.code);
                    setLangOpen(false);
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
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