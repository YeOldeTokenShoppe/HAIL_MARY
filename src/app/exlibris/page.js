"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useMusic } from '@/components/MusicContext';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import CompactCandleModal from '@/components/CompactCandleModal';
import MobileBottomNav from '@/components/MobileBottomNav';
import BuyModal from '@/components/BuyModal';

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
  const [showLittleBook, setShowLittleBook] = useState(false);
  const [isBookHovered, setIsBookHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const is80sMode = context80sMode;

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
        /* Repurpose the menu slot as the Buy button. */
        onMenuClick={() => setShowBuyModal(true)}
        menuIcon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: "#d4a854" }}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
        menuLabel="BUY"
        isUserSignedIn={isSignedIn}
        userImage={user?.imageUrl}
        show80sButton={false}
        isMobile
        neonMode
        /* Book slot is repurposed on /exlibris as a "return home"
           affordance — the 3D Book mesh already opens the overlay, so
           this icon routes back to the root page instead. */
        onBookClick={() => router.push('/')}
        bookLabel="HOME"
        bookIcon={
          <svg
            className="btm-book-icon-svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 9h4" />
            <path d="M12 7v5" />
            <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
            <path d="m18 9 3.52 2.147a1 1 0 0 1 .48.854V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.999a1 1 0 0 1 .48-.854L6 9" />
            <path d="M6 21V7a1 1 0 0 1 .376-.782l5-3.999a1 1 0 0 1 1.249.001l5 4A1 1 0 0 1 18 7v14" />
          </svg>
        }
        extraLeft={[
          {
            key: 'tcg',
            label: 'TCG',
            iconSrc: '/tcg.svg',
            comingSoon: true,
          },
        ]}
        extraRight={[
          {
            key: 'lode',
            label: 'LODE',
            title: 'Lode — coming soon',
            comingSoon: true,
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2ad6ee"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 24, height: 24, display: 'block' }}
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