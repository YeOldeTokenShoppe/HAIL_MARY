"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useMusic } from '@/components/MusicContext';
import ModernMusicPlayer from '@/components/ModernMusicPlayer';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import CompactCandleModal from '@/components/CompactCandleModal';
import MobileBottomNav from '@/components/MobileBottomNav';
import BuyModal from '@/components/BuyModal';
import RadialNavMenu from '@/components/RadialNavMenu';

const Philosophy = dynamic(() => import('@/components/Philosophy'), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />
});

const LittleBookOverlay = dynamic(() => import('@/components/LittleBookOverlay'), {
  ssr: false,
});

export default function ModelViewerPage() {
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    is80sMode: context80sMode,
    setIs80sMode: setContext80sMode
  } = useMusic();
  const [showCandleModal, setShowCandleModal] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState(null);
  // Center FAB: step through the five scrolls. While one is open it opens
  // the NEXT (wrapping 5 → 1), so if the reader tapped scroll 3 on the desk
  // the button goes on to 4. Once put away (the viewer's x, or the Book) it
  // reopens the one they were reading; scroll 1 before anything's opened.
  // Philosophy reports back when a scroll actually opens / closes.
  const [lastScroll, setLastScroll] = useState(null);
  const [scrollOpen, setScrollOpen] = useState(false);
  const [scrollRequest, setScrollRequest] = useState(null);
  const nextScroll = !lastScroll ? 1 : scrollOpen ? (lastScroll % 5) + 1 : lastScroll;
  const openScroll = () => setScrollRequest({ n: nextScroll, id: Date.now() });
  const [showLittleBook, setShowLittleBook] = useState(false);
  const [isBookHovered, setIsBookHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const is80sMode = context80sMode;

  // Music player buttons are desktop-only — hidden on mobile.
  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Track the cursor only while the Book is hovered, so the tooltip follows it.
  useEffect(() => {
    if (!isBookHovered) return;
    const onMove = (e) => setTooltipPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [isBookHovered]);

  // Prevent scroll on this page
  // useEffect(() => {
  //   document.body.style.overflow = "hidden";
  //   document.documentElement.style.overflow = "hidden";
  //   return () => {
  //     document.body.style.overflow = "";
  //     document.documentElement.style.overflow = "";
  //   };
  // }, []);


  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
      <Philosophy
        modelPath="/models/saint_robot3.glb"
        onLoadingChange={setIsPageLoading}
        is80sMode={is80sMode}
        onBookClick={() => setShowLittleBook(true)}
        onBookHoverChange={setIsBookHovered}
        scrollRequest={scrollRequest}
        onScrollOpen={(n) => { setLastScroll(n); setScrollOpen(true); }}
        onScrollClose={() => setScrollOpen(false)}
      />

      {/* Music player — always mounted so the page stays on the modern
          non80sTracks bucket; the buttons are desktop-only (removed on mobile).
          Ring matches the "Open the Book" tooltip (and the root page). */}
      <ModernMusicPlayer
        visible={!isMobileView}
        border="1px solid rgba(212, 175, 55, 0.35)"
        style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 9999 }}
      />

      {isBookHovered && !showLittleBook && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 16,
            top: tooltipPos.y + 16,
            zIndex: 10001,
            pointerEvents: 'none',
            padding: '6px 12px',
            borderRadius: 6,
            background: 'rgba(10, 6, 20, 0.85)',
            border: '1px solid rgba(241, 215, 122, 0.35)',
            color: '#f1d77a',
            fontFamily: "'Pirata One', 'IBM Plex Serif', serif",
            fontSize: 14,
            letterSpacing: 2,
            textTransform: 'uppercase',
            textShadow: '0 0 8px rgba(241, 215, 122, 0.45)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          Open the Book
        </div>
      )}

      <LittleBookOverlay
        isOpen={showLittleBook}
        onClose={() => setShowLittleBook(false)}
      />
      
      {/* Nav Controls */}
      {!isPageLoading && (
        <>
          <MobileBottomNav
        /* 3 slots: BUY (book slot) | SCROLL (center FAB) | MORE. Home and
           Hail Mary live in the radial menu MORE opens. Music and Wallet
           slots are suppressed. */
        hideWallet
        accountOnLeft
        /* Center FAB: opens scroll 1, then each tap moves on to the next;
           reopens the last one after it's put away (see openScroll). */
        onBuyClick={openScroll}
        centerLabel={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 30, height: 30, display: "block" }} aria-hidden="true">
            <path d="M15 12h-5" />
            <path d="M15 8h-5" />
            <path d="M19 17V5a2 2 0 0 0-2-2H4" />
            <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
          </svg>
        }
        centerSubLabel={scrollOpen ? "NEXT SCROLL" : "SCROLL"}
        centerTitle={`${scrollOpen ? "Next: scroll" : "Open scroll"} ${nextScroll} of 5`}
        /* Menu slot (right) is MORE → the site's radial menu (Home, Hail
           Mary and the rest). The 3D Book mesh opens the overlay. */
        onMenuClick={() => {
          // The dock doesn't hand us its button, so find it to anchor the
          // radial menu on.
          setMoreAnchor(document.querySelector(".btm-nav-menu"));
          setShowMoreMenu((v) => !v);
        }}
        menuIcon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2ad6ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24, color: "#2ad6ee" }} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M17 12h.01" />
            <path d="M12 12h.01" />
            <path d="M7 12h.01" />
          </svg>
        }
        menuLabel="MORE"
        isUserSignedIn={isSignedIn}
        userImage={user?.imageUrl}
        show80sButton={false}
        isMobile
        is80sMode
        /* Book slot (left) is the BUY button — kept in the same position
           as the root page so the BUY affordance is consistent across
           the app. */
        onBookClick={() => setShowBuyModal(true)}
        bookLabel="BUY"
        bookTitle="Buy RL80"
        bookIcon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: "#39ff14", filter: "drop-shadow(0 0 4px rgba(57, 255, 20, 0.6))" }}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
      />

      {/* MORE → the site's radial menu (same disk as /home, /fountain,
          /hailmary, /trade), spinning open over the MORE slot. Its own
          confirm modal replaces the old popover's. */}
      <RadialNavMenu
        current="exlibris"
        anchorEl={moreAnchor}
        open={showMoreMenu}
        onRequestClose={() => setShowMoreMenu(false)}
        colors={{
          disk: "rgba(15, 0, 30, 0.9)",
          hub: "rgba(15, 0, 30, 0.9)",
          icon: "#efe2ff",
          accent: "#2ad6ee",
          ring: "#ff00ff",
          glyph: "#2ad6ee",
        }}
      />

          {/* CyberNav Menu Panel */}
          <CyberNav
            is80sMode={is80sMode}
            position="fixed"
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            showButton={false}
          />

          {/* Buy Modal */}
          <BuyModal
            isOpen={showBuyModal}
            onClose={() => setShowBuyModal(false)}
          />
        </>
      )}

      {/* Buy Token FAB (optional - uncomment if needed) */}
      {/* <div onClick={() => setShowCandleModal(true)}>
        <BuyTokenFAB is80sMode={is80sMode} />
      </div> */}

      {/* Candle Modal - Hidden while loading */}
      {!isPageLoading && showCandleModal && (
        <CompactCandleModal
          isOpen={showCandleModal}
          onClose={() => setShowCandleModal(false)}
        />
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}