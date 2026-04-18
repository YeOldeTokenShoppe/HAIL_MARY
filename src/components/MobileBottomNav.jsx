import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from "@clerk/nextjs";
import { usePathname } from 'next/navigation';
import { useWalletAuth } from './WalletAuthProvider';
import { UnifiedAccountModal } from './UnifiedAccountModal';
import { useLanguage } from './LanguageProvider';

// Bottom mobile app-style navigation bar — drop-in replacement for NavControlsHome
export default function MobileBottomNav({
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
  userImage = null,
  show80sButton = true,
  onBuyClick,
  isMobile = false,
  onHelpClick = null,
  showHelpActive = false,
  hideMusicOnMobile = false,
  hideUserOnMobile = false,
  hideWallet = false,
  /* When true, render the Account slot on the LEFT of the center FAB
     (between Music and Wallet/Center) instead of the default RIGHT. */
  accountOnLeft = false,
  darkMode = false,
  /* Neon hologram palette (cyan/fuchsia) for the shrine/home page. Yields
     to 80s mode; overrides darkMode when both are set. */
  neonMode = false,
  // Optional overrides so callers can repurpose the center FAB + menu slot.
  // Defaults preserve the original Buy/Menu behavior.
  centerLabel = null,
  centerSubLabel = 'RL80',
  centerTitle = 'Buy RL80',
  menuIcon = null,
  menuLabel = 'MENU',
}) {
  const [emoji, setEmoji] = useState("😇");
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showMenuHint, setShowMenuHint] = useState(false);
  const [buyPulse, setBuyPulse] = useState(false);
  const pathname = usePathname();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const { t } = useLanguage();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const {
    walletAddress,
    tokenBalance,
    isWalletConnected,
    connectWallet,
    disconnectWallet,
    isConnecting
  } = useWalletAuth();

  // Alternate emoji for avatar
  useEffect(() => {
    const interval = setInterval(() => {
      setEmoji(prev => prev === "😇" ? "😈" : "😇");
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Dismiss hint when menu is opened
  useEffect(() => {
    if (isMenuOpen && showMenuHint) {
      setShowMenuHint(false);
      try { localStorage.setItem('hasSeenMenuHint', '1'); } catch {}
    }
  }, [isMenuOpen, showMenuHint]);

  // Subtle pulse on buy button every 8s
  useEffect(() => {
    const interval = setInterval(() => {
      setBuyPulse(true);
      setTimeout(() => setBuyPulse(false), 600);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handlePlayClick = () => { if (onPlayMusic) onPlayMusic(); };
  const handleStopClick = () => { if (onStopMusic) onStopMusic(); };
  const handleSkipClick = () => { if (onSkipTrack) onSkipTrack(); };
  const handleMenuClick = () => { if (onMenuClick) onMenuClick(); };

  const m80 = is80sMode;
  const nm = !m80 && neonMode; // cyan/fuchsia hologram mode
  const dk = !m80 && !nm && darkMode; // dark oil-field mode (fallback)

  /* Account slot — extracted so callers can place it on the LEFT of the
     center FAB via `accountOnLeft`. When signed in the emoji is swapped
     for the user's avatar and the label becomes ACCT. */
  const accountSlot = !hideUserOnMobile && (
    <button
      className="btm-nav-item"
      onClick={() => {
        if (isHydrated && clerkUser) {
          setShowUnifiedModal(true);
        } else {
          clerk.openSignIn();
        }
      }}
    >
      <div className="btm-nav-icon">
        {isHydrated && clerkUser?.imageUrl ? (
          <img
            src={clerkUser.imageUrl}
            alt="Avatar"
            className="btm-wallet-avatar"
          />
        ) : (
          <span className="btm-wallet-emoji">{emoji}</span>
        )}
      </div>
      <span className="btm-nav-label">
        {isHydrated && clerkUser ? 'ACCT' : 'LOGIN'}
      </span>
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

        .btm-nav-dock {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          pointer-events: none;
          /* safe-area inset moved into .btm-nav-bar below so the bar's
             background reaches the viewport edge instead of leaving a
             transparent strip above the home-indicator / chin area. */
          font-family: 'Orbitron', monospace;
        }

        .btm-nav-bar {
          pointer-events: auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          padding: 0 4px;
          padding-top: 6px;
          padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          background: ${nm
            ? 'rgba(6, 10, 18, 0.85)'
            : m80
              ? 'rgba(15, 0, 30, 0.96)'
              : dk
                ? 'rgba(20, 26, 34, 0.96)'
                : 'rgba(255, 253, 248, 0.97)'};
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid ${nm ? 'rgba(42, 214, 238, 0.35)' : m80 ? 'rgba(255, 0, 255, 0.3)' : dk ? 'rgba(212, 168, 84, 0.2)' : 'rgba(180, 160, 130, 0.2)'};
          box-shadow: ${nm
            ? '0 -2px 24px rgba(42, 214, 238, 0.18), 0 -1px 0 rgba(217, 45, 176, 0.2)'
            : m80
              ? '0 -2px 20px rgba(255, 0, 255, 0.12)'
              : dk
                ? '0 -2px 16px rgba(0, 0, 0, 0.3)'
                : '0 -2px 16px rgba(0, 0, 0, 0.08)'};
          position: relative;
        }

        /* ---- NAV ITEM (non-buy) ---- */
        .btm-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
          cursor: pointer;
          padding: 6px 2px 2px;
          border-radius: 12px;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          background: transparent;
          border: none;
          min-width: 60px;
          position: relative;
        }

        .btm-nav-item:active {
          transform: scale(0.93);
        }

        .btm-nav-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.15s ease;
          position: relative;
          background: transparent;
          border: none;
        }

        .btm-nav-icon.active-state {
          background: ${m80 ? 'rgba(255, 0, 255, 0.12)' : dk ? 'rgba(212, 168, 84, 0.15)' : 'rgba(212, 175, 55, 0.1)'};
          border-radius: 10px;
        }

        .btm-nav-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: ${nm ? 'rgba(111, 168, 196, 0.9)' : m80 ? 'rgba(200, 180, 220, 0.6)' : dk ? 'rgba(200, 190, 170, 0.5)' : 'rgba(120, 105, 85, 0.6)'};
          transition: color 0.15s ease;
          line-height: 1;
          white-space: nowrap;
        }

        .btm-nav-item:active .btm-nav-label,
        .btm-nav-label.active-label {
          color: ${nm ? '#d6faff' : m80 ? '#ff00ff' : dk ? '#d4a854' : '#8b6914'};
        }

        /* ---- CYBERNAV (80s toggle) ---- */
        .btm-cyber-icon {
          color: ${m80 ? '#00ff41' : dk ? '#7aaa5a' : '#5a8a3a'};
          font-size: 12px;
          font-weight: 900;
          text-shadow: ${m80 ? '0 0 8px #00ff41' : 'none'};
          line-height: 1;
        }

        .btm-cyber-sub {
          font-size: 6px;
          font-weight: 700;
          color: ${m80 ? '#00ff41' : dk ? '#7aaa5a' : '#5a8a3a'};
          opacity: 0.8;
          text-shadow: ${m80 ? '0 0 6px #00ff41' : 'none'};
        }

        /* ---- MUSIC ---- */
        .btm-music-icon {
          color: ${m80 ? '#ff00ff' : dk ? '#d4a854' : '#b8922e'};
          font-size: 22px;
          line-height: 1;
        }

        .btm-music-playing .btm-nav-icon {
          background: ${m80 ? 'rgba(255, 0, 255, 0.1)' : dk ? 'rgba(212, 168, 84, 0.12)' : 'rgba(184, 146, 46, 0.08)'};
          border-radius: 10px;
        }

        /* Music split controls when playing */
        .btm-music-split {
          display: flex;
          gap: 3px;
          width: 36px;
          height: 32px;
        }

        .btm-music-half {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          border-radius: 8px;
          background: ${m80 ? 'rgba(255, 0, 255, 0.1)' : dk ? 'rgba(212, 168, 84, 0.12)' : 'rgba(184, 146, 46, 0.08)'};
          border: none;
          color: ${m80 ? '#ff00ff' : dk ? '#d4a854' : '#b8922e'};
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .btm-music-half:active {
          background: ${m80 ? 'rgba(255, 0, 255, 0.25)' : dk ? 'rgba(212, 168, 84, 0.25)' : 'rgba(184, 146, 46, 0.18)'};
          transform: scale(0.92);
        }

        /* ---- CENTER BUY FAB ---- */
        .btm-buy-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          margin-top: -28px;
          z-index: 2;
        }

        .btm-buy-fab {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: ${nm ? '2px solid transparent' : `3px solid ${m80 ? 'rgba(255, 255, 255, 0.15)' : dk ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)'}`};
          background: ${nm
            ? 'linear-gradient(180deg, rgba(6, 10, 18, 0.92), rgba(2, 5, 9, 0.95)) padding-box, linear-gradient(135deg, #2ad6ee 0%, #d6faff 40%, #d92db0 60%, #ff7de0 100%) border-box'
            : m80
              ? 'linear-gradient(145deg, #d946ef, #a21caf)'
              : 'linear-gradient(145deg, #d4a854, #b8922e)'};
          box-shadow: ${nm
            ? '0 4px 18px rgba(42, 214, 238, 0.45), 0 0 28px rgba(217, 45, 176, 0.3), 0 2px 6px rgba(0, 0, 0, 0.35)'
            : m80
              ? '0 4px 16px rgba(217, 70, 239, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)'
              : '0 4px 16px rgba(184, 146, 46, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15)'};
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }

        .btm-buy-fab:active {
          transform: scale(0.93);
          box-shadow: ${nm
            ? '0 2px 10px rgba(42, 214, 238, 0.6), 0 0 18px rgba(217, 45, 176, 0.4), 0 1px 3px rgba(0, 0, 0, 0.35)'
            : m80
              ? '0 2px 8px rgba(217, 70, 239, 0.6), 0 1px 3px rgba(0, 0, 0, 0.3)'
              : '0 2px 8px rgba(184, 146, 46, 0.5), 0 1px 3px rgba(0, 0, 0, 0.15)'};
        }

        .btm-buy-text {
          font-family: ${nm ? "'Pirata One', 'IBM Plex Serif', serif" : "'Orbitron', monospace"};
          font-size: ${nm ? '16px' : '14px'};
          font-weight: ${nm ? '400' : '900'};
          letter-spacing: ${nm ? '3px' : '2px'};
          color: #ffffff;
          text-shadow: ${nm
            ? '0 0 8px rgba(42, 214, 238, 0.7), 0 0 14px rgba(217, 45, 176, 0.4)'
            : '0 1px 2px rgba(0, 0, 0, 0.2)'};
        }

        .btm-buy-label {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: ${nm ? 'rgba(111, 168, 196, 0.9)' : m80 ? 'rgba(200, 180, 220, 0.6)' : dk ? 'rgba(200, 190, 170, 0.5)' : 'rgba(120, 105, 85, 0.6)'};
          margin-top: 4px;
          line-height: 1;
        }

        @keyframes btmFabPulse {
          0%, 100% { box-shadow: ${nm
            ? '0 4px 18px rgba(42, 214, 238, 0.45), 0 0 28px rgba(217, 45, 176, 0.3), 0 2px 6px rgba(0, 0, 0, 0.35)'
            : m80
              ? '0 4px 16px rgba(217, 70, 239, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)'
              : '0 4px 16px rgba(184, 146, 46, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15)'}; }
          50% { box-shadow: ${nm
            ? '0 4px 28px rgba(42, 214, 238, 0.7), 0 0 48px rgba(217, 45, 176, 0.4), 0 2px 6px rgba(0, 0, 0, 0.35)'
            : m80
              ? '0 4px 24px rgba(217, 70, 239, 0.7), 0 2px 6px rgba(0, 0, 0, 0.3), 0 0 40px rgba(217, 70, 239, 0.2)'
              : '0 4px 24px rgba(184, 146, 46, 0.6), 0 2px 6px rgba(0, 0, 0, 0.15), 0 0 40px rgba(184, 146, 46, 0.15)'}; }
        }

        .btm-buy-fab.pulse {
          animation: btmFabPulse 0.6s ease;
        }

        /* ---- WALLET/ACCOUNT ---- */
        .btm-wallet-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }

        .btm-wallet-emoji {
          font-size: 22px;
          line-height: 1;
        }

        .btm-wallet-dot {
          position: absolute;
          bottom: 0px;
          right: 0px;
          width: 8px;
          height: 8px;
          background: ${m80 ? '#00ffff' : dk ? '#7aaa5a' : '#5a8a3a'};
          border-radius: 50%;
          border: 2px solid ${m80 ? 'rgba(15, 0, 30, 0.96)' : dk ? 'rgba(20, 26, 34, 0.96)' : 'rgba(255, 253, 248, 0.97)'};
        }

        .btm-nav-icon.wallet-connected-icon {
          /* no extra border styling — clean look */
        }

        /* ---- DEDICATED WALLET BUTTON ---- */
        .btm-wallet-icon-svg {
          width: 24px;
          height: 24px;
          color: ${m80 ? '#00ffff' : dk ? '#7aaa5a' : '#5a8a3a'};
          transition: color 0.15s ease;
        }

        .btm-wallet-connected-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 6px;
          height: 6px;
          background: ${m80 ? '#00ffff' : dk ? '#7aaa5a' : '#5a8a3a'};
          border-radius: 50%;
          border: 1.5px solid ${m80 ? 'rgba(15, 0, 30, 0.96)' : dk ? 'rgba(20, 26, 34, 0.96)' : 'rgba(255, 253, 248, 0.97)'};
        }

        /* ---- HAMBURGER MENU ---- */
        .btm-menu-lines {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          width: 100%;
          height: 100%;
        }

        .btm-menu-line {
          width: 20px;
          height: 2.5px;
          background: ${m80 ? '#ff00ff' : dk ? '#a09080' : '#8b7355'};
          border-radius: 2px;
          transition: all 0.25s ease;
        }

        .btm-menu-open .btm-menu-line:nth-child(1) {
          transform: rotate(45deg) translate(4px, 4px);
          background: ${m80 ? '#ff00ff' : dk ? '#d4a854' : '#b8922e'};
        }

        .btm-menu-open .btm-menu-line:nth-child(2) {
          opacity: 0;
        }

        .btm-menu-open .btm-menu-line:nth-child(3) {
          transform: rotate(-45deg) translate(4px, -4px);
          background: ${m80 ? '#ff00ff' : dk ? '#d4a854' : '#b8922e'};
        }

        .btm-nav-icon.menu-open-icon {
          background: ${m80 ? 'rgba(255, 0, 255, 0.1)' : dk ? 'rgba(212, 168, 84, 0.12)' : 'rgba(184, 146, 46, 0.08)'};
          border-radius: 10px;
        }

        /* Menu hint ring */
        .btm-menu-hint {
          position: absolute;
          inset: -4px;
          border-radius: 14px;
          border: 2px solid ${m80 ? '#ff00ff' : dk ? '#d4a854' : '#b8922e'};
          animation: btmHintPulse 1.2s ease-out infinite;
          pointer-events: none;
        }

        @keyframes btmHintPulse {
          0% { transform: scale(1); opacity: 0.8; }
          70%, 100% { transform: scale(1.6); opacity: 0; }
        }

        /* 80s neon flicker */
        ${m80 ? `
          @keyframes btmNeonFlicker {
            0%, 100% { opacity: 1; }
            33% { opacity: 0.85; }
            66% { opacity: 0.92; }
          }
          .btm-cyber-icon {
            animation: btmNeonFlicker 2s infinite;
          }
        ` : ''}
      `}</style>

      <div className="btm-nav-dock">
        <div className="btm-nav-bar">

          {/* 1 — CyberNav (80s toggle) — only if enabled */}
          {show80sButton && (
            <button
              className="btm-nav-item"
              onClick={onToggle80sMode}
              title={m80 ? "Disable 80s Mode" : "Enable 80s Mode"}
            >
              <div className={`btm-nav-icon ${m80 ? 'active-state' : ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span className="btm-cyber-icon">{t('navControls.eighties')}</span>
                  <span className="btm-cyber-sub">{t('navControls.mode')}</span>
                </div>
              </div>
              <span className={`btm-nav-label ${m80 ? 'active-label' : ''}`}>CYBER</span>
            </button>
          )}

          {/* LEFT 1 — Music (suppressed when hideMusicOnMobile is set) */}
          {onPlayMusic && !hideMusicOnMobile && (
            isPlaying ? (
              <div className="btm-nav-item btm-music-playing">
                <div className="btm-nav-icon active-state">
                  <div className="btm-music-split">
                    <button className="btm-music-half" onClick={handleStopClick} title="Stop">⏹</button>
                    <button className="btm-music-half" onClick={handleSkipClick} title="Skip">⏭</button>
                  </div>
                </div>
                <span className="btm-nav-label active-label">MUSIC</span>
              </div>
            ) : (
              <button
                className="btm-nav-item"
                onClick={handlePlayClick}
              >
                <div className="btm-nav-icon">
                  <span className="btm-music-icon">♫</span>
                </div>
                <span className="btm-nav-label">MUSIC</span>
              </button>
            )
          )}

          {/* Account on the LEFT when requested (otherwise rendered on the
              right after the center FAB). */}
          {accountOnLeft && accountSlot}

          {/* LEFT 2 — Wallet (suppressed when hideWallet is set) */}
          {!hideWallet && (
            <button
              className="btm-nav-item"
              onClick={() => {
                setShowUnifiedModal(true);
              }}
            >
              <div className="btm-nav-icon" style={{ position: 'relative' }}>
                <svg className="btm-wallet-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2.5" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
                {isWalletConnected && <div className="btm-wallet-connected-badge" />}
              </div>
              <span className={`btm-nav-label ${isWalletConnected ? 'active-label' : ''}`}>
                {isWalletConnected ? 'WALLET' : 'WALLET'}
              </span>
            </button>
          )}

          {/* CENTER — big FAB (defaults to BUY; callers can repurpose via
              centerLabel/centerTitle/centerSubLabel + onBuyClick). */}
          {onBuyClick && (
            <div className="btm-buy-wrapper">
              <button
                className={`btm-buy-fab ${buyPulse ? 'pulse' : ''}`}
                onClick={onBuyClick}
                title={centerTitle}
              >
                <span className="btm-buy-text">
                  {centerLabel ?? t('navControls.buy')}
                </span>
              </button>
              <span className="btm-buy-label">{centerSubLabel}</span>
            </div>
          )}

          {/* Default Account position: RIGHT of the center FAB. Skipped
              when `accountOnLeft` has already rendered it on the left. */}
          {!accountOnLeft && accountSlot}

          {/* RIGHT 2 — Menu (or custom slot if menuIcon override is provided).
              When overridden, the hamburger animation + first-run hint are
              skipped since the slot is no longer a menu toggle. */}
          <button
            className="btm-nav-item"
            onClick={handleMenuClick}
          >
            <div className={`btm-nav-icon ${isMenuOpen && !menuIcon ? 'menu-open-icon' : ''}`} style={{ position: 'relative' }}>
              {menuIcon ? (
                menuIcon
              ) : (
                <>
                  {showMenuHint && <span className="btm-menu-hint" />}
                  <div className={`btm-menu-lines ${isMenuOpen ? 'btm-menu-open' : ''}`}>
                    <span className="btm-menu-line" />
                    <span className="btm-menu-line" />
                    <span className="btm-menu-line" />
                  </div>
                </>
              )}
            </div>
            <span className={`btm-nav-label ${isMenuOpen && !menuIcon ? 'active-label' : ''}`}>{menuLabel}</span>
          </button>

        </div>
      </div>

      {/* Unified Account Modal */}
      <UnifiedAccountModal
        isOpen={showUnifiedModal}
        onClose={() => setShowUnifiedModal(false)}
      />
    </>
  );
}
