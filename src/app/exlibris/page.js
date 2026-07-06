"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useMusic } from '@/components/MusicContext';
import MusicButton from '@/components/MusicButton';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import CompactCandleModal from '@/components/CompactCandleModal';
import MobileBottomNav from '@/components/MobileBottomNav';
import BuyModal from '@/components/BuyModal';
import useCyberConfirm from '@/components/useCyberConfirm';

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
  const [moreConfirmModal, moreConfirm] = useCyberConfirm();
  const [showLittleBook, setShowLittleBook] = useState(false);
  const [isBookHovered, setIsBookHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const is80sMode = context80sMode;

  // Music control is desktop-only — hide the MusicButton on mobile.
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
      />

      {/* Music control is desktop-only — removed on mobile. */}
      {!isMobileView && (
        <MusicButton
          accent="#d4a854"
          icon="/synthwave-sun-80s.svg"
          modernIcon="/virginRecords.jpg"
          showModeToggle
          size={62}
          style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 9999 }}
        />
      )}

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
        /* Reduced to 3 slots: LOGIN (account) | CANDLE (center FAB) | BUY
           (menu slot). Music and Wallet slots are suppressed. */
        hideWallet
        accountOnLeft
        /* Repurpose the center FAB as the candle light toggle. */
        // onBuyClick={toggleCandle}
        // centerLabel={
        //   candleLit ? (
        //     userId ? (
        //       /* Signed-in + lit: the FAB's job pivots from "extinguish"
        //          (rare) to "change your candle" (the more valuable
        //          action for the faithful). Lucide settings-2 glyph —
        //          two sliders — reads as "adjust". Extinguish lives
        //          inside the picker as a secondary action. */
        //       <svg
        //         viewBox="0 0 24 24"
        //         fill="none"
        //         stroke="currentColor"
        //         strokeWidth="2"
        //         strokeLinecap="round"
        //         strokeLinejoin="round"
        //         style={{
        //           width: 28,
        //           height: 28,
        //           display: "block",
        //           color: "#f1d77a",
        //         }}
        //         aria-hidden="true"
        //       >
        //         <path d="M14 17H5" />
        //         <path d="M19 7h-9" />
        //         <circle cx="17" cy="17" r="3" />
        //         <circle cx="7" cy="7" r="3" />
        //       </svg>
        //     ) : (
        //       "LIT"
        //     )
        //   ) : (
        //     <img
        //       src="/images/flame.svg"
        //       alt="Light"
        //       style={{ width: 34, height: 34, display: "block" }}
        //     />
        //   )
        // }
        // centerSubLabel={
        //   candleLit && litAt ? (
        //     <span
        //       style={{
        //         display: "inline-flex",
        //         flexDirection: "column",
        //         alignItems: "center",
        //         gap: 2,
        //       }}
        //     >
        //       <span>CANDLE</span>
        //       <span
        //         style={{
        //           fontSize: 9,
        //           letterSpacing: "1.2px",
        //           color: "#f1d77a",
        //           fontVariantNumeric: "tabular-nums",
        //         }}
        //       >
        //         {formatRemaining(litAt, meltDuration)}
        //       </span>
        //     </span>
        //   ) : (
        //     "LIGHT CANDLE"
        //   )
        // }
        // centerTitle={
        //   candleLit
        //     ? userId
        //       ? "Change candle"
        //       : "Extinguish candle"
        //     : "Light candle"
        // }
        /* Filling gold arc around the FAB — 0 when just lit, 1 at
           burnout. Only rendered while a candle is actually lit. */
        // centerProgress={candleLit ? meltProgress : null}
        /* Menu slot (right) is now a MORE popover (holds Terminal). Home moved
           to the dock's dedicated left slot; the 3D Book mesh opens the overlay. */
        onMenuClick={() => setShowMoreMenu((v) => !v)}
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
        extraLeft={[
          {
            key: 'home',
            label: 'Home',
            title: 'Return to the shrine',
            onClick: () => { router.push('/'); },
            // Same brand mark this slot used before, now in the Terminal spot.
            iconSrc: '/brand-mark.svg',
          },
        ]}
        extraRight={[
          {
            key: 'lode',
            label: 'Hail Mary',
            title: 'Hail Mary Prospecting Co — coming soon',
            onClick: () => { router.push('/hailmary'); },
            comingSoon: false,
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f1d77a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 24, height: 24, display: 'block', filter: 'drop-shadow(0 0 4px rgba(241, 215, 122, 0.6))' }}
                aria-hidden="true"
              >
                <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
                <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
                <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
                <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
              </svg>
            ),
          },
        ]}
      />

      {/* MORE popover — anchored above the far-right dock slot. Holds the
          Terminal (and any future secondary destinations). */}
      {showMoreMenu && (
        <>
          <div
            onClick={() => setShowMoreMenu(false)}
            style={{ position: "fixed", inset: 0, zIndex: 10001, background: "transparent" }}
          />
          <div
            role="menu"
            aria-label="More"
            style={{
              position: "fixed",
              right: "10px",
              bottom: "calc(74px + env(safe-area-inset-bottom, 0px))",
              zIndex: 10002,
              display: "flex",
              flexDirection: "column",
              minWidth: "184px",
              padding: "6px",
              borderRadius: "14px",
              background: "rgba(15, 0, 30, 0.97)",
              border: "1px solid rgba(255, 0, 255, 0.3)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 -2px 24px rgba(255, 0, 255, 0.18), 0 8px 32px rgba(0, 0, 0, 0.5)",
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            {[
              {
                label: "Coin Fountain",
                stroke: "#2ad6ee",
                onSelect: () => moreConfirm({
                  title: "Coin Fountain",
                  body: "Toss a coin, whisper a wish. Our Lady keeps every offering the faithful let fall.",
                  accent: "hsl(189, 84%, 55%)",
                  shadow: "hsl(189, 70%, 38%)",
                  onProceed: () => { router.push('/fountain'); },
                }),
                icon: (
                  <>
                    <path d="M12 10L12 2" />
                    <path d="M16 6L12 10L8 6" />
                    <path d="M2 15C2.6 15.5 3.2 16 4.5 16C7 16 7 14 9.5 14C12.1 14 11.9 16 14.5 16C17 16 17 14 19.5 14C20.8 14 21.4 14.5 22 15" />
                    <path d="M2 21C2.6 21.5 3.2 22 4.5 22C7 22 7 20 9.5 20C12.1 20 11.9 22 14.5 22C17 22 17 20 19.5 20C20.8 20 21.4 20.5 22 21" />
                  </>
                ),
              },
              {
                label: "Terminal",
                stroke: "#39ff14",
                onSelect: () => moreConfirm({
                  title: "The Liminal Terminal",
                  body: "Read the tape. Four consultants, one verdict — the market confesses to those who listen.",
                  accent: "hsl(189, 84%, 55%)",
                  shadow: "hsl(189, 70%, 38%)",
                  onProceed: () => { router.push('/trade'); },
                }),
                icon: (
                  <>
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </>
                ),
              },
            ].map((link) => (
              <button
                key={link.label}
                role="menuitem"
                onClick={() => { setShowMoreMenu(false); link.onSelect(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 0, 255, 0.12)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={link.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, flexShrink: 0, display: "block", filter: `drop-shadow(0 0 4px ${link.stroke}66)` }} aria-hidden="true">
                  {link.icon}
                </svg>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#ffffff" }}>
                  {link.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Cyber confirm modal for the MORE-popover destinations. */}
      {moreConfirmModal}

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