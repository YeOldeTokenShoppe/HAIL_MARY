import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from "@clerk/nextjs";
import { usePathname } from 'next/navigation';
import { useWalletAuth } from './WalletAuthProvider';
import { UnifiedAccountModal } from './UnifiedAccountModal';
import { useLanguage } from './LanguageProvider';

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
  userImage = null,
  show80sButton = true,
  onBuyClick,
  isMobile = false,
  onHelpClick = null,
  showHelpActive = false,
  hideMusicOnMobile = false
}) {
  const [emoji, setEmoji] = useState("😇");
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showMenuHint, setShowMenuHint] = useState(false);
  const pathname = usePathname(); // Get current path
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const { t } = useLanguage();

  // Fix hydration mismatch by ensuring client and server render the same initially
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

  // First-visit pulse hint for the hamburger menu (only on /about)
  // useEffect(() => {
  //   if (pathname !== '/about') {
  //     setShowMenuHint(false);
  //     return;
  //   }
  //   const timer = setTimeout(() => setShowMenuHint(true), 2000);
  //   return () => clearTimeout(timer);
  // }, [pathname]);

  // Dismiss hint when menu is opened
  useEffect(() => {
    if (isMenuOpen && showMenuHint) {
      setShowMenuHint(false);
      try { localStorage.setItem('hasSeenMenuHint', '1'); } catch {}
    }
  }, [isMenuOpen, showMenuHint]);

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
          gap: 5px;
          padding: 5px;
          background: rgba(10, 10, 20, 0.3);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid rgba(212, 175, 55, 0.15);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          pointer-events: auto;
        }

        /* 80s Mode Button */
        .eighties-btn-mobile {
          width: auto;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          padding: 0 8px;
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
          white-space: nowrap;
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
          font-size: 12px;
          font-weight: bold;
          color: ${is80sMode ? '#00ff41' : '#67e8f9'};
          text-shadow: ${is80sMode ? '0 0 10px #00ff41' : 'none'};
          font-family: 'Orbitron', monospace;
          line-height: 0.9;
        }

        .eighties-btn-text-small {
          font-size: 0.5rem;
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
          min-height: 40px;
          width: 40px;
          min-width: 40px;
          flex-shrink: 0;
          justify-content: center;
        }

        .music-btn-mobile {
          width: 40px;
          height: 22px;
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
          height: 40px;
          width: 40px;
          border-radius: 10px;
          font-size: 2rem;
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

        /* Unified Account/Wallet Container */
        .unified-account-container {
          height: 40px;
          min-width: fit-content;
          flex-shrink: 0;
        }
        
        .account-wallet-split {
          display: flex;
          align-items: center;
          height: 100%;
          background: rgba(0, 0, 0, 0.4);
          border: 1.5px solid rgba(0, 245, 212, 0.2);
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        
        .account-wallet-split:hover {
          border-color: rgba(0, 245, 212, 0.4);
          box-shadow: 0 0 10px rgba(0, 245, 212, 0.2);
        }
        
        .account-section {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 0 0.25rem;
        }
        
        .button-divider {
          width: 1px;
          height: 60%;
          background: rgba(0, 245, 212, 0.3);
          margin: 0;
        }
        
        .wallet-section {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 0 0.4rem;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        
        .wallet-section:hover {
          background: rgba(0, 245, 212, 0.1);
        }
        
        /* Avatar - Consistent size */
        .avatar-mobile {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          max-width: 40px;
          max-height: 40px;
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

        /* Wallet connected state */
        .avatar-mobile.wallet-connected {
          border-color: rgba(0, 245, 212, 0.4);
          box-shadow: 0 0 10px rgba(0, 245, 212, 0.2);
        }
        
        /* Wallet button when not connected */
        .wallet-button-mobile {
          width: auto;
          min-width: 40px;
          height: 40px;
          padding: 0 10px;
          flex-shrink: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(0, 245, 212, 0.1), rgba(0, 187, 249, 0.1));
          border: 1.5px solid rgba(0, 245, 212, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: 'Orbitron', monospace;
          font-size: 9px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #00f5d4;
        }
        
        .wallet-button-mobile:hover {
          border-color: rgba(0, 245, 212, 0.6);
          background: linear-gradient(135deg, rgba(0, 245, 212, 0.2), rgba(0, 187, 249, 0.2));
          box-shadow: 0 0 15px rgba(0, 245, 212, 0.3);
          transform: scale(1.02);
        }
        
        .wallet-button-mobile:active {
          transform: scale(0.98);
        }
        
        .wallet-icon {
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* Wallet info display */
        .wallet-icon-mobile {
          width: 40px;
          height: 40px;
          min-width: 40px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.4);
          border: 1.5px solid rgba(0, 245, 212, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.3rem;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        
        .wallet-icon-mobile:hover {
          background: rgba(0, 245, 212, 0.1);
          border-color: rgba(0, 245, 212, 0.4);
          transform: scale(1.05);
          box-shadow: 0 0 10px rgba(0, 245, 212, 0.3);
        }
        
        /* Keep old styles for potential future use */
        .wallet-info-mobile {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 6px;
          height: 40px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.4);
          border: 1.5px solid rgba(0, 245, 212, 0.2);
          font-family: 'Orbitron', monospace;
          font-size: 9px;
          overflow: hidden;
          min-width: fit-content;
          transition: all 0.2s ease;
        }
        
        .wallet-info-mobile:hover {
          background: rgba(0, 245, 212, 0.1);
          border-color: rgba(0, 245, 212, 0.4);
          transform: scale(1.02);
        }
        
        .wallet-address {
          color: #00f5d4;
          font-weight: 600;
        }
        
        .wallet-balance {
          color: #ffee00;
          font-weight: bold;
          padding: 2px 4px;
          // background: rgba(255, 238, 0, 0.1);
          border-radius: 4px;
          border: 1px solid rgba(255, 238, 0, 0.2);
        }
        
        .wallet-divider {
          width: 1px;
          height: 14px;
          background: rgba(212, 175, 55, 0.2);
        }

        /* Style Clerk's UserButton when wrapped in avatar-mobile */
        .avatar-mobile :global(.cl-userButtonBox) {
          width: 100% !important;
          height: 100% !important;
          background: transparent !important;
          border: none !important;
        }

        .avatar-mobile :global(.cl-userButtonTrigger) {
          width: 100% !important;
          height: 100% !important;
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          border-radius: 10px !important;
        }
        
        .avatar-mobile :global(.cl-userButtonTrigger button) {
          border: none !important;
          background: transparent !important;
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

        /* Hamburger - Consistent with other buttons */
        .menu-button-mobile {
          position: relative;
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
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
          width: 26px;
          height: 4px;
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

        @keyframes menuHintPulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          70% {
            transform: scale(1.9);
            opacity: 0;
          }
          100% {
            transform: scale(1.9);
            opacity: 0;
          }
        }

        .menu-hint-ring {
          position: absolute;
          inset: -2px;
          border-radius: 10px;
          border: 3px solid ${is80sMode ? 'rgba(255, 0, 255, 0.9)' : 'rgba(212, 175, 55, 0.9)'};
          box-shadow: ${is80sMode
            ? '0 0 14px rgba(255, 0, 255, 0.7), inset 0 0 14px rgba(255, 0, 255, 0.3)'
            : '0 0 14px rgba(212, 175, 55, 0.7), inset 0 0 14px rgba(212, 175, 55, 0.3)'};
          animation: menuHintPulse 1.2s ease-out infinite;
          pointer-events: none;
          z-index: 1;
        }

        /* Compact BUY Button with RetroFuturistic hover effects */
        .buy-btn-compact {
          width: auto;
          min-width: 40px;
          height: 40px;
          padding: 0 12px;
          border-radius: 10px;
          background: rgba(212, 175, 55, 0.05);
          border: 1.5px solid rgba(212, 175, 55, 0.2);
          color: #00ff41;
          text-shadow: 0 0 8px #00ff41;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.5px;
          transition: all 0.3s ease, box-shadow 0.7s ease;
          box-shadow: 0 0 8px rgba(5, 234, 250, 0.3);
          white-space: nowrap;
        }

        .buy-btn-compact:hover {
          transform: scale(1.02);
          color: #c40a35;
          border-color: rgba(5, 234, 250, 0.5);
          background: rgba(5, 234, 250, 0.08);
          box-shadow: 0 0 20px 2px #05eafa, 0 0 30px rgba(5, 234, 250, 0.4);
        }

        .buy-btn-compact:active {
          transform: scale(0.98);
        }

        /* 80s mode styling for BUY button */
        .mode-80s .buy-btn-compact {
          background: rgba(255, 0, 255, 0.05);
          border-color: rgba(255, 0, 255, 0.3);
          color: #ff00ff;
          box-shadow: 0 0 8px rgba(255, 0, 255, 0.3);
        }

        .mode-80s .buy-btn-compact:hover {
          border-color: rgba(255, 0, 255, 0.6);
          background: rgba(255, 0, 255, 0.15);
          box-shadow: 0 0 20px 2px #ff00ff, 0 0 30px rgba(255, 0, 255, 0.4);
          color: #00ffff;
        }

        /* Mobile BUY Button - Below nav container */
        .buy-btn-mobile {
          display: flex;
          align-items: center;
          justify-content: center;
          width: auto;
          min-width: 60px;
          height: 36px;
          padding: 0 16px;
          margin-top: 8px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(0, 255, 65, 0.15), rgba(0, 200, 50, 0.1));
          border: 1.5px solid rgba(0, 255, 65, 0.4);
          color: #00ff41;
          text-shadow: 0 0 8px rgba(0, 255, 65, 0.6);
          cursor: pointer;
          font-family: 'Orbitron', monospace;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          box-shadow: 0 0 12px rgba(0, 255, 65, 0.2);
          pointer-events: auto;
        }

        .buy-btn-mobile:hover,
        .buy-btn-mobile:active {
          transform: scale(1.05);
          background: linear-gradient(135deg, rgba(0, 255, 65, 0.25), rgba(0, 200, 50, 0.2));
          border-color: rgba(0, 255, 65, 0.6);
          box-shadow: 0 0 20px rgba(0, 255, 65, 0.4);
        }

        /* 80s mode styling for mobile BUY button */
        .buy-btn-mobile.mode-80s {
          background: linear-gradient(135deg, rgba(255, 0, 255, 0.15), rgba(200, 0, 200, 0.1));
          border-color: rgba(255, 0, 255, 0.4);
          color: #ff00ff;
          text-shadow: 0 0 8px rgba(255, 0, 255, 0.6);
          box-shadow: 0 0 12px rgba(255, 0, 255, 0.2);
        }

        .buy-btn-mobile.mode-80s:hover,
        .buy-btn-mobile.mode-80s:active {
          background: linear-gradient(135deg, rgba(255, 0, 255, 0.25), rgba(200, 0, 200, 0.2));
          border-color: rgba(255, 0, 255, 0.6);
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.4);
          color: #00ffff;
        }

        /* Help Button - matches other nav buttons */
        .help-btn-nav {
          width: 40px;
          min-width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 10px;
          background: ${showHelpActive
            ? 'rgba(212, 175, 55, 0.1)'
            : 'rgba(212, 175, 55, 0.05)'};
          border: 1.5px solid ${showHelpActive
            ? 'rgba(212, 175, 55, 0.4)'
            : 'rgba(212, 175, 55, 0.2)'};
          color: #d4af37;
          font-size: 1.3rem;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .help-btn-nav:hover {
          border-color: rgba(212, 175, 55, 0.4);
          background: rgba(212, 175, 55, 0.1);
        }

        .help-btn-nav:active {
          transform: scale(0.95);
        }

        .mode-80s .help-btn-nav {
          background: ${showHelpActive
            ? 'rgba(255, 0, 255, 0.1)'
            : 'rgba(255, 0, 255, 0.05)'};
          border-color: ${showHelpActive
            ? 'rgba(255, 0, 255, 0.4)'
            : 'rgba(255, 0, 255, 0.2)'};
          color: #ff00ff;
        }

        .mode-80s .help-btn-nav:hover {
          border-color: rgba(255, 0, 255, 0.4);
          background: rgba(255, 0, 255, 0.1);
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div className={`nav-mobile-home ${is80sMode ? 'mode-80s' : ''}`}>
        {/* Help Button */}
        {onHelpClick && (
          <button
            className="help-btn-nav"
            onClick={onHelpClick}
            title="Show help annotations"
          >
            ?
          </button>
        )}
         {/* BUY Button - Desktop, or mobile when 80s button is hidden */}
        {(!isMobile || !show80sButton) && onBuyClick && (
          <button
            className="buy-btn-compact"
            onClick={onBuyClick}
            title="Buy RL80"
          >
            {t('navControls.buy')}
          </button>
        )}


        {/* 80s Mode Button */}
        {show80sButton && (
          <button
            className="eighties-btn-mobile"
            onClick={onToggle80sMode}
            title={is80sMode ? "Disable 80s Mode" : "Enable 80s Mode"}
          >
            <span className="eighties-btn-emoji">{is80sMode ? '🎸' : ''}</span>
            <span className="eighties-btn-text">
              {t('navControls.eighties')}
            </span>
            <span className="eighties-btn-text-small">
              {t('navControls.mode')}
            </span>
          </button>
        )}

       
        {/* Music - Splits when active (hidden on mobile when hideMusicOnMobile is true) */}
        {!(isMobile && hideMusicOnMobile) && (
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
        )}

        {/* Unified Account/Wallet Button */}
        <div className="unified-account-container">
          {isHydrated && clerkUser ? (
            <button 
              className="avatar-mobile"
              onClick={() => setShowUnifiedModal(true)}
              title="Account"
            >
              {clerkUser?.imageUrl ? (
                <img 
                  src={clerkUser.imageUrl} 
                  alt="Avatar" 
                  style={{ 
                    width: '40px', 
                    height: '40px',
                    minWidth: '40px',
                    minHeight: '40px',
                    maxWidth: '40px',
                    maxHeight: '40px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    display: 'block'
                  }}
                />
              ) : (
                <span style={{ fontSize: '2rem' }}>{emoji}</span>
              )}
              {isWalletConnected && (
                <div 
                  className="avatar-status-mobile" 
                  style={{ 
                    background: '#00f5d4',
                    boxShadow: '0 0 4px rgba(0, 245, 212, 0.6)'
                  }}
                />
              )}
            </button>
          ) : (
            <button
              className="avatar-mobile"
              style={{ cursor: 'pointer' }}
              onClick={() => clerk.openSignIn()}
            >
              <span style={{ fontSize: '2rem' }}>{emoji}</span>
              <div  />
            </button>
          )}
        </div>

        {/* Menu */}
        <button
          className={`menu-button-mobile ${isMenuOpen ? 'open' : ''}`}
          onClick={handleMenuClick}
        >
          {showMenuHint && (
            <span className="menu-hint-ring" />
          )}
          <span className="menu-line-mobile" />
          <span className="menu-line-mobile" />
          <span className="menu-line-mobile" />
        </button>
      </div>

      {/* Mobile BUY Button - Below nav container (only when 80s button is shown, otherwise it's inline) */}
        {isMobile && show80sButton && onBuyClick && (
          <button
            className={`buy-btn-mobile ${is80sMode ? 'mode-80s' : ''}`}
            onClick={onBuyClick}
            title="Buy RL80"
          >
            {t('navControls.buy')}
          </button>
        )}
      </div>

      {/* Unified Account Modal */}
      <UnifiedAccountModal 
        isOpen={showUnifiedModal} 
        onClose={() => setShowUnifiedModal(false)} 
      />
    </>
  );
}