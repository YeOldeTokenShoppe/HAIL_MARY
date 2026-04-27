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
  // When provided, this replaces the entire default center-FAB wrapper —
  // useful for callers that want a multi-button center (e.g. /trade's
  // BUY/HOLD/SELL trio) instead of the single round FAB.
  centerSlot = null,
  // When true the center FAB is rendered dimmed + non-interactive. Used for
  // "coming soon" affordances (e.g. a CHAT FAB that teases a future feature).
  centerDisabled = false,
  // When set (0..1), renders a depleting gold arc around the center FAB —
  // used as the candle melt timer. `null` hides the ring entirely.
  centerProgress = null,
  // When true, force the FAB hover treatment on (used by the root page
  // to mirror the FAB's hover state when the user hovers the actual
  // 3D candle object on the canvas).
  centerHighlight = false,
  menuIcon = null,
  menuLabel = 'MENU',
  // Book overlay trigger — when provided, replaces the Account/LOGIN slot
  // (same physical position) with a book button. Callers that want both
  // the book and the account affordance should surface sign-in/out from
  // another modal (e.g. InscribeModal) per the root-page flow.
  onBookClick = null,
  bookLabel = 'BOOK',
  // Optional custom icon for the book slot — when provided, renders in
  // place of the default open-book SVG. Use this when the slot's action
  // is repurposed (e.g. on /exlibris the slot returns to the root page,
  // so a home glyph reads more accurately than the book icon).
  bookIcon = null,
  // Tooltip text for the book slot. Defaults to the library framing
  // that fits the root-page usage; override per-page when the slot does
  // something else (e.g. "Return to the shrine" on /exlibris).
  bookTitle = '',
  // When true, pulse + brighten the book slot. Used by the root page to
  // call attention to the BUY button while the user is hovering the chart.
  bookHighlight = false,
  // Extra placeholder slots rendered to the left or right of the center
  // FAB. Each slot: { label, iconSrc?, icon?, onClick?, comingSoon? }.
  // When `comingSoon` is set the slot renders dimmed with a SOON badge.
  extraLeft = [],
  extraRight = [],
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

  /* Renders a generic extra slot (placeholder / "coming soon" affordance).
     iconSrc renders as <img> (preserves color for multi-color SVGs like
     /tcg.svg); icon is used as-is for inline JSX. */
  const renderExtraSlot = (slot, idx) => (
    <button
      key={slot.key ?? `${slot.label}-${idx}`}
      className={`btm-nav-item ${slot.comingSoon ? 'btm-coming-soon' : ''}`}
      onClick={slot.onClick}
      title={slot.title ?? (slot.comingSoon ? `${slot.label} — coming soon` : slot.label)}
    >
      <div className="btm-nav-icon" style={{ position: 'relative' }}>
        {slot.iconSrc ? (
          <img
            src={slot.iconSrc}
            alt=""
            aria-hidden="true"
            className="btm-extra-icon-img"
          />
        ) : (
          slot.icon
        )}
        {slot.comingSoon && <span className="btm-nav-soon-badge">SOON</span>}
      </div>
      <span className="btm-nav-label">{slot.label}</span>
    </button>
  );

  /* Book slot — takes the Account/LOGIN position when onBookClick is
     provided. Placed via the same accountSlot insertion points so the
     LEFT/RIGHT positioning logic stays unchanged. */
  const bookSlot = onBookClick ? (
    <button
      className={`btm-nav-item btm-nav-book ${bookHighlight ? 'btm-nav-highlight' : ''}`}
      onClick={onBookClick}
      title={bookTitle}
    >
      <div className="btm-nav-icon">
        {bookIcon ? (
          bookIcon
        ) : (
          <svg
            className="btm-book-icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        )}
      </div>
      <span className="btm-nav-label">{bookLabel}</span>
    </button>
  ) : null;

  /* Account slot — extracted so callers can place it on the LEFT of the
     center FAB via `accountOnLeft`. When signed in the emoji is swapped
     for the user's avatar and the label becomes ACCT. */
  const accountSlot = !hideUserOnMobile && !onBookClick && (
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
          min-width: 56px;
          position: relative;
        }

        /* Coming-soon placeholder — dimmed, still tappable so callers can
           wire a toast/tooltip. */
        .btm-nav-item.btm-coming-soon {
          opacity: 0.55;
        }
        .btm-nav-item.btm-coming-soon:active {
          transform: scale(0.95);
        }

        .btm-extra-icon-img {
          width: 26px;
          height: 26px;
          object-fit: contain;
          display: block;
          filter: ${nm ? 'drop-shadow(0 0 4px rgba(42, 214, 238, 0.4))' : 'none'};
        }

        .btm-nav-soon-badge {
          position: absolute;
          top: -4px;
          right: -6px;
          font-size: 6.5px;
          font-weight: 800;
          letter-spacing: 0.3px;
          padding: 1px 4px;
          border-radius: 6px;
          color: ${nm ? '#061018' : '#1a1408'};
          background: ${nm ? '#2ad6ee' : m80 ? '#ff00ff' : dk ? '#d4a854' : '#d4a854'};
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
          line-height: 1;
          pointer-events: none;
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

        /* Chart-hover highlight on the BUY (book) slot — the icon morphs
           into an encircled FAB (matching the center candle button) and
           lifts above the nav bar. Implemented with transforms only (no
           width/height changes) so the nav row's layout stays static.
           Desktop-only. */
        @media (hover: hover) {
          @keyframes btmNavHighlightPulse {
            0%, 100% {
              box-shadow: 0 4px 12px rgba(212, 168, 84, 0.5),
                          0 0 18px rgba(255, 200, 90, 0.35),
                          0 1px 3px rgba(0, 0, 0, 0.4);
            }
            50% {
              box-shadow: 0 4px 18px rgba(255, 215, 120, 0.85),
                          0 0 30px rgba(255, 200, 90, 0.65),
                          0 1px 3px rgba(0, 0, 0, 0.4);
            }
          }
          .btm-nav-item {
            transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
          }
          .btm-nav-item .btm-nav-icon {
            transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                        border-radius 0.5s ease,
                        background 0.5s ease,
                        border 0.5s ease,
                        box-shadow 0.5s ease;
            transform-origin: center;
          }
          .btm-nav-item .btm-nav-icon svg {
            transition: stroke 0.3s ease, filter 0.3s ease;
          }
          /* Lift the slot above the bar — translateY doesn't affect layout.
             Triggered by:
             - chart hover (.btm-nav-highlight prop-class on the BUY slot)
             - hovering the BUY icon directly (.btm-nav-book:hover)
             - hovering the EX LIBRIS / menu icon (.btm-nav-menu:hover, scoped
               to slots that have an SVG override so hamburger pages stay
               unaffected). */
          .btm-nav-item.btm-nav-highlight,
          .btm-nav-item.btm-nav-book:hover,
          .btm-nav-item.btm-nav-menu:has(.btm-nav-icon svg):hover {
            transform: translateY(-18px);
            z-index: 5;
          }
          /* Morph the icon: scale up + round + glow. Using transform: scale
             instead of width/height so the nav row's height stays fixed. */
          .btm-nav-item.btm-nav-highlight .btm-nav-icon,
          .btm-nav-item.btm-nav-book:hover .btm-nav-icon,
          .btm-nav-item.btm-nav-menu:has(.btm-nav-icon svg):hover .btm-nav-icon {
            transform: scale(1.85);
            border-radius: 50%;
            border: ${nm ? '1.5px solid transparent' : '1.6px solid rgba(255, 255, 255, 0.9)'};
            background: ${nm
              ? 'linear-gradient(180deg, rgba(20, 14, 4, 0.92), rgba(8, 5, 2, 0.95)) padding-box, linear-gradient(135deg, #d4a854 0%, #ffd97a 40%, #ffb347 60%, #d4a854 100%) border-box'
              : 'linear-gradient(145deg, #d4a854, #b8922e)'};
            animation: btmNavHighlightPulse 1.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          }
          /* Brighten the inner glyph (parent transform handles size growth). */
          .btm-nav-item.btm-nav-highlight .btm-nav-icon svg,
          .btm-nav-item.btm-nav-book:hover .btm-nav-icon svg,
          .btm-nav-item.btm-nav-menu:has(.btm-nav-icon svg):hover .btm-nav-icon svg {
            stroke: ${nm ? '#ffd97a' : '#ffffff'};
            filter: drop-shadow(0 0 4px rgba(255, 215, 120, 0.8));
          }
          /* Fade the label out — the scaled icon overlaps the label
             text, so hiding it during the morph reads cleaner than
             trying to peek the label out underneath. */
          .btm-nav-item .btm-nav-label {
            transition: opacity 0.3s ease;
          }
          .btm-nav-item.btm-nav-highlight .btm-nav-label,
          .btm-nav-item.btm-nav-book:hover .btm-nav-label,
          .btm-nav-item.btm-nav-menu:has(.btm-nav-icon svg):hover .btm-nav-label {
            opacity: 0;
          }
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

        /* Hover treatment for the center FAB. The flame img inside can't
           be styled with stroke/fill (loaded via <img>), so we shift it
           via CSS filters: brighten + saturate + drop-shadow glow. The
           FAB itself gets a subtle scale and intensified box-shadow halo.
           Triggered by mouse hover OR by .btm-buy-fab-hovered (forced from
           page.js when the user hovers the 3D candle object on canvas). */
        .btm-buy-fab:not(.btm-disabled) {
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 0.4s ease;
        }
        .btm-buy-fab:not(.btm-disabled) img,
        .btm-buy-fab:not(.btm-disabled) svg {
          transition: filter 0.35s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .btm-buy-fab.btm-buy-fab-hovered:not(.btm-disabled) {
          transform: scale(1.06);
          box-shadow: ${nm
            ? '0 6px 26px rgba(42, 214, 238, 0.7), 0 0 48px rgba(217, 45, 176, 0.55), 0 0 80px rgba(255, 200, 90, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)'
            : m80
              ? '0 6px 24px rgba(217, 70, 239, 0.75), 0 0 48px rgba(217, 70, 239, 0.4), 0 2px 6px rgba(0, 0, 0, 0.35)'
              : '0 6px 24px rgba(255, 215, 120, 0.85), 0 0 48px rgba(255, 200, 90, 0.5), 0 2px 6px rgba(0, 0, 0, 0.2)'};
        }
        .btm-buy-fab.btm-buy-fab-hovered:not(.btm-disabled) img {
          filter: brightness(1.45) saturate(1.4)
                  drop-shadow(0 0 8px rgba(255, 200, 90, 0.95))
                  drop-shadow(0 0 16px rgba(255, 150, 50, 0.55));
          transform: scale(1.08);
        }
        .btm-buy-fab.btm-buy-fab-hovered:not(.btm-disabled) svg {
          filter: brightness(1.35) drop-shadow(0 0 6px rgba(255, 215, 120, 0.85));
        }
        @media (hover: hover) {
          .btm-buy-fab:not(.btm-disabled):hover {
            transform: scale(1.06);
            box-shadow: ${nm
              ? '0 6px 26px rgba(42, 214, 238, 0.7), 0 0 48px rgba(217, 45, 176, 0.55), 0 0 80px rgba(255, 200, 90, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)'
              : m80
                ? '0 6px 24px rgba(217, 70, 239, 0.75), 0 0 48px rgba(217, 70, 239, 0.4), 0 2px 6px rgba(0, 0, 0, 0.35)'
                : '0 6px 24px rgba(255, 215, 120, 0.85), 0 0 48px rgba(255, 200, 90, 0.5), 0 2px 6px rgba(0, 0, 0, 0.2)'};
          }
          .btm-buy-fab:not(.btm-disabled):hover img {
            filter: brightness(1.45) saturate(1.4)
                    drop-shadow(0 0 8px rgba(255, 200, 90, 0.95))
                    drop-shadow(0 0 16px rgba(255, 150, 50, 0.55));
            transform: scale(1.08);
          }
          .btm-buy-fab:not(.btm-disabled):hover svg {
            filter: brightness(1.35) drop-shadow(0 0 6px rgba(255, 215, 120, 0.85));
          }
        }

        /* Disabled center FAB — used for "coming soon" teasers (CHAT etc).
           Replace the gradient with a flat solid panel so the label reads
           cleanly against the bar, and kill pointer events. */
        .btm-buy-fab.btm-disabled {
          background: #1a1a2e !important;
          border: 2px solid rgba(111, 168, 196, 0.35) !important;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45) !important;
          color: rgba(214, 250, 255, 0.75);
          pointer-events: none;
          animation: none !important;
        }
        .btm-buy-fab.btm-disabled .btm-buy-text {
          text-shadow: none;
          color: rgba(214, 250, 255, 0.85);
        }

        /* Sibling wrapper around the FAB so the SVG ring can sit outside
           the button's gradient border without being clipped by its
           padding-box/border-box background trick. */
        .btm-buy-fab-wrap {
          position: relative;
          width: 60px;
          height: 60px;
        }

        /* Melt-timer ring — overlays the FAB and depletes clockwise as the
           candle burns. pointer-events:none so clicks still reach the FAB. */
        .btm-buy-ring {
          position: absolute;
          inset: -6px;
          width: calc(100% + 12px);
          height: calc(100% + 12px);
          pointer-events: none;
          overflow: visible;
          filter: drop-shadow(0 0 5px rgba(241, 215, 122, 0.6));
          z-index: 3;
        }

        .btm-buy-ring circle {
          transition: stroke-dashoffset 600ms linear;
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

        /* ---- BOOK OVERLAY TRIGGER ---- */
        .btm-book-icon-svg {
          width: 24px;
          height: 24px;
          color: ${nm ? '#2ad6ee' : m80 ? '#ff00ff' : dk ? '#d4a854' : '#b8922e'};
          transition: color 0.15s ease;
          filter: ${nm ? 'drop-shadow(0 0 6px rgba(42, 214, 238, 0.5))' : 'none'};
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

          {/* Account (or Book, when onBookClick replaces it) on the LEFT
              when requested — otherwise rendered on the right after the
              center FAB. */}
          {accountOnLeft && (bookSlot || accountSlot)}

          {/* Extra placeholder slots to the LEFT of the center FAB. */}
          {extraLeft.map(renderExtraSlot)}

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

          {/* CENTER — either a custom slot (e.g. /trade's BUY/HOLD/SELL trio)
              or the default round FAB (defaults to BUY). */}
          {centerSlot ? (
            <div className="btm-buy-wrapper">{centerSlot}</div>
          ) : onBuyClick && (
            <div className="btm-buy-wrapper">
              <div className="btm-buy-fab-wrap">
                <button
                  className={`btm-buy-fab ${buyPulse ? 'pulse' : ''} ${centerDisabled ? 'btm-disabled' : ''} ${centerHighlight ? 'btm-buy-fab-hovered' : ''}`}
                  onClick={centerDisabled ? undefined : onBuyClick}
                  disabled={centerDisabled}
                  aria-disabled={centerDisabled || undefined}
                  title={centerTitle}
                >
                  <span className="btm-buy-text">
                    {centerLabel ?? t('navControls.buy')}
                  </span>
                </button>
                {typeof centerProgress === 'number' && (
                  <svg
                    className="btm-buy-ring"
                    viewBox="0 0 72 72"
                    aria-hidden="true"
                  >
                    {/* Track — faint so only the filled arc reads. */}
                    <circle
                      cx="36"
                      cy="36"
                      r="34"
                      fill="none"
                      stroke="rgba(241, 215, 122, 0.15)"
                      strokeWidth="2.5"
                    />
                    {/* Depleting arc — starts at 12 o'clock, goes clockwise. */}
                    <circle
                      cx="36"
                      cy="36"
                      r="34"
                      fill="none"
                      stroke="#f1d77a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 34}
                      strokeDashoffset={
                        2 * Math.PI * 34 *
                        (1 - Math.max(0, Math.min(1, centerProgress)))
                      }
                      transform="rotate(-90 36 36)"
                    />
                  </svg>
                )}
              </div>
              <span className="btm-buy-label">{centerSubLabel}</span>
            </div>
          )}

          {/* Default Account position: RIGHT of the center FAB. Skipped
              when `accountOnLeft` has already rendered it on the left. */}
          {!accountOnLeft && (bookSlot || accountSlot)}

          {/* Extra placeholder slots to the RIGHT of the center FAB. */}
          {extraRight.map(renderExtraSlot)}

          {/* RIGHT 2 — Menu (or custom slot if menuIcon override is provided).
              When overridden, the hamburger animation + first-run hint are
              skipped since the slot is no longer a menu toggle. */}
          <button
            className="btm-nav-item btm-nav-menu"
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
