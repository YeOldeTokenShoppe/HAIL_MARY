"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMusic } from '@/components/MusicContext';
import MusicButton from '@/components/MusicButton';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import NavControlsHome from '@/components/NavControlsHome';
import MobileBottomNav from '@/components/MobileBottomNav';
import FountainDonationModal from '@/components/FountainDonationModal';
import BuyModal from '@/components/BuyModal';
import PolaroidSnapshot from '@/components/PolaroidSnapshot';
import globalAudioManager from '@/lib/globalAudio';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';

// Dynamic import for the FountainFrame component
const FountainFrame = dynamic(() => import('@/components/FountainFrame'), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />
});

// The fountain page restricts music to exactly these tracks (resolved by path
// against the full catalog `allTracks`, regardless of era bucket).
// Paths must match the entries in MusicContext; normalized for leading-slash differences.
const FOUNTAIN_TRACK_PATHS = [
  // "/audio/HeartOfGlass.mp3",          // Heart Of Glass - Blondie
  // "/audio/LoveIsAStranger.m4a",               // Love Is A Stranger - Eurythmics
  // "/audio/Wishing.m4a",           // Wishing (If I Had a Photograph of You) - A Flock of Seagulls
  // "/audio/Eyes Without A Face.mp3",           // Eyes Without A Face - Billy Idol
  // "/audio/Cat People (Putting Out Fire).mp3", // Cat People (Putting Out Fire) - David Bowie
  // "audio/like-a-prayer-madonna.m4a",          // Like A Prayer - Madonna
  // "audio/99RedBalloons.mp3",        // 99 Luftballoons - Nena
  "audio/PersonalJesus.m4a",        // Personal Jesus - Depeche Mode
  // "audio/TwilightZone.m4a",         // Twilight Zone - Golden Earring
  "/audio/EveryLittleThing.mp3",
"audio/Cities.mp3",          
"/audio/WishingWell.m4a",          // Wishing Well - Sananda Maitraya
  // "audio/AhLeah.m4a",              // Ah Leah! Donnie Iris
  "audio/LoveMyWay.m4a",           // Love My Way - Psychedelic Furs
  // "audio/Heroes.m4a",              // Heroes - Janelle Monae
  // "audio/RocketsTail.m4a",     // Rocket's Tail - Kate Bush
  // "audio/IfYouAllGetToHeaven.m4a",       // If You Leave - Orchestral Manoeuvres in the D
  "audio/for-those-about-to-rock-ac-dc.m4a",
  "/audio/GoldDustWoman.m4a",          // Gold
  // "audio/AhLeah.m4a",
  "/audio/like-a-prayer-madonna.m4a",          // Like A Prayer - Madonna
  // "audio/ChurchOfThePoisonMind.mp3",          // Church of the Poison Mind - Culture Club
// Amor Amor - Arno Elias
"/audio/SinInMyHeart.mp3",          // Sin In My Heart - Siouxsie & The Banshees
].map((p) => p.replace(/^\//, ""));

export default function FountainPage() {
  // Get user from Clerk
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  
  const { play, pause, isPlaying: contextIsPlaying, nextTrack, setPagePlaylistOverride, allTracks, musicEra } = useMusic();
  const [isLoading, setIsLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [preselectedCharity, setPreselectedCharity] = useState(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  // The Coin Guide panel lives inside the fountain iframe; these social icons live
  // here on the parent page. A z-index inside the iframe can't stack above them, so
  // the iframe posts {type:'infoHubVisibility'} and we hide the social-stack while
  // the panel is open — that's what lets the panel visually "cover" the icons.
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const iframeRef = useRef(null);
  // Snapshot: the scene lives in the iframe, so we ask it to grab its canvas, draw the
  // returned image onto a hidden parent canvas, then hand that to <PolaroidSnapshot>.
  const [snapshotTrigger, setSnapshotTrigger] = useState(false);
  const [snapshotPending, setSnapshotPending] = useState(false);
  const snapCanvasRef = useRef(null);
  const loadingTimeoutRef = useRef(null);

  
  // Restrict the playlist to the curated fountain tracks while on this page.
  // This governs which track is chosen next (first play, skip, auto-advance) —
  // a song already playing on arrival keeps playing untouched until it ends.
  // The curated set is all 80s; in MIX (modern) era we release the override so
  // the era toggle on the music button actually changes the music here.
  useEffect(() => {
    if (musicEra === "modern") {
      setPagePlaylistOverride(null);
      return () => setPagePlaylistOverride(null);
    }
    const wanted = new Set(FOUNTAIN_TRACK_PATHS);
    const override = (allTracks || []).filter((t) =>
      wanted.has((t.path || "").replace(/^\//, ""))
    );
    setPagePlaylistOverride(override.length ? override : null);
    return () => setPagePlaylistOverride(null);
  }, [allTracks, musicEra, setPagePlaylistOverride]);

  // Check if mobile - run immediately on mount
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
    };
    // Run immediately
    if (typeof window !== 'undefined') {
      checkMobile();
    }
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Hide the social-stack while the in-iframe Coin Guide panel is open (it can't
  // win a z-index across the iframe boundary, so the iframe signals open/close).
  useEffect(() => {
    const onFrameMessage = (event) => {
      if (event.data?.type === 'infoHubVisibility') {
        setInfoPanelOpen(!!event.data.open);
      }
      // The iframe returns a snapshot of its WebGL canvas. Draw it onto our hidden
      // canvas (a data URL isn't tainted), then trigger the Polaroid which reads it.
      else if (event.data?.type === 'fountainSnapshot') {
        setSnapshotPending(false);
        if (event.data.error || !event.data.dataUrl) {
          console.error('[Fountain] snapshot failed:', event.data.error);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const c = snapCanvasRef.current;
          if (!c) return;
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0);
          setSnapshotTrigger(false);            // reset so the trigger edge re-fires
          requestAnimationFrame(() => setSnapshotTrigger(true));
        };
        img.onerror = () => console.error('[Fountain] snapshot image decode failed');
        img.src = event.data.dataUrl;
      }
    };
    window.addEventListener('message', onFrameMessage);
    return () => window.removeEventListener('message', onFrameMessage);
  }, []);

  // Ask the iframe to capture the current scene (the actual grab + reply happens there).
  const requestSnapshot = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    setSnapshotPending(true);
    win.postMessage({ type: 'captureFountain' }, '*');
    // Safety: clear the pending state if the iframe never answers.
    setTimeout(() => setSnapshotPending(false), 4000);
  }, []);

  const handleSnapshotComplete = useCallback(() => {
    setTimeout(() => setSnapshotTrigger(false), 100);
  }, []);

  // Tell the iframe whether music is playing so it can run the window light show.
  // Re-sent when the fountain finishes loading (isLoading flips) so the initial
  // state syncs even if the iframe wasn't listening yet at mount.
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: 'musicPlaying', playing: !!contextIsPlaying }, '*');
  }, [contextIsPlaying, isLoading]);

  // --- Desktop audio-reactive window light show -------------------------------
  // Tap the shared music element with an AnalyserNode and stream per-band energies
  // to the iframe each frame so the windows pulse in sync with the song. Desktop
  // only: createMediaElementSource is silent on iOS Safari, so mobile keeps the
  // simulated beat (the iframe auto-falls-back when no levels arrive). The context
  // + source are created ONCE and stashed on the audio manager — re-creating
  // createMediaElementSource throws, and the element must stay routed to
  // destination or music goes silent app-wide.
  const ensureAnalyser = useCallback(() => {
    const mgr = globalAudioManager;
    if (!mgr || typeof window === 'undefined') return null;
    if (mgr.__fountainAnalyser) return mgr.__fountainAnalyser;
    const audio = mgr.getAudio?.();
    if (!audio) return null;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = mgr.__fountainAudioCtx || new Ctx();
      mgr.__fountainAudioCtx = ctx;
      const source = mgr.__fountainSource || ctx.createMediaElementSource(audio);
      mgr.__fountainSource = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination); // keep the music audible through the graph
      mgr.__fountainAnalyser = analyser;
      return analyser;
    } catch (e) {
      console.error('[Fountain] audio analyser setup failed:', e);
      return null;
    }
  }, []);

  useEffect(() => {
    if (isMobileView) return;        // mobile/iOS → iframe uses the simulated beat
    if (!contextIsPlaying) return;
    const analyser = ensureAnalyser();
    if (!analyser) return;
    const ctx = globalAudioManager?.__fountainAudioCtx;
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const BANDS = 6;
    let raf;
    const tick = () => {
      analyser.getByteFrequencyData(bins);
      const len = bins.length;
      let overall = 0;
      for (let i = 0; i < len; i++) overall += bins[i];
      overall = overall / (len * 255);
      // Quadratic band edges: more resolution in the bass/mid where music lives.
      const bands = new Array(BANDS);
      for (let b = 0; b < BANDS; b++) {
        const lo = Math.floor(1 + (len - 1) * Math.pow(b / BANDS, 2));
        const hi = Math.max(lo + 1, Math.floor(1 + (len - 1) * Math.pow((b + 1) / BANDS, 2)));
        let sum = 0, cnt = 0;
        for (let i = lo; i < hi && i < len; i++) { sum += bins[i]; cnt++; }
        bands[b] = cnt ? (sum / cnt) / 255 : 0;
      }
      iframeRef.current?.contentWindow?.postMessage({ type: 'musicLevels', bands, overall }, '*');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [contextIsPlaying, isMobileView, ensureAnalyser]);

  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        setFontLoaded(true);
        // Add fonts-loaded class to html to show the logo
        document.documentElement.classList.add('fonts-loaded');
      } catch (e) {
        setTimeout(() => {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        }, 100);
      }
    };
    checkFont();
  }, []);


  // Handle fountain ready signal from iframe
  const handleFountainReady = useCallback(() => {

    setIsLoading(false);
    // Clear the fallback timeout if it exists
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // Loading timeout fallback (increased to 10 seconds for model loading)
  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 10000);
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);


  return (
    <div style={{
      backgroundColor: "#000000",
      height: "100vh",
      width: "100vw",
      margin: 0,
      padding: 0,
      position: "fixed",
      left: 0,
      top: 0,
      overflow: "hidden",
    }}>
      <style jsx global>{`
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;
        }

        /* Home-link cue on the RL80 wordmark. In CSS rather than JS handlers
           so a re-render can't wipe it, and so :focus-visible can give the
           keyboard its own ring without flashing one on every mouse click. */
        #text {
          transition: text-shadow 0.3s ease;
        }
        #text:hover,
        #text:focus-visible {
          text-shadow: 0 0 12px rgba(212, 175, 55, 0.9),
                       0 0 24px rgba(212, 175, 55, 0.45);
        }
        /* !important is load-bearing: globals.css has a site-wide
           *:focus / *:active rule forcing outline:none !important, which
           would otherwise strip the keyboard ring off this link. */
        #text:focus-visible {
          outline: 2px solid rgba(212, 175, 55, 0.9) !important;
          outline-offset: 6px;
          border-radius: 6px;
        }
        /* text-shadow inherits — keep the glow on the face copy instead of
           multiplying it across all 100 blurred echo layers. */
        .text__copy {
          text-shadow: none !important;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Loader */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CoinLoader loading={isLoading} />
        </div>
      )}

      {/* The Fountain iframe */}
      <FountainFrame
        ref={iframeRef}
        onFullyLoaded={handleFountainReady}
        onDonateClick={(charity) => {
          setPreselectedCharity(charity);
          setShowDonationModal(true);
        }}
      />

      {/* UI Overlay - Our Lady of Perpetual Profit Logo (Desktop) / RL80 (Mobile) */}
      {/* {fontLoaded && !isMobileView && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          minHeight: '100vh',
          zIndex: 10001,
          pointerEvents: 'none',
          opacity: fontLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            // paddingTop: '2rem',
            minHeight: '100vh',
            pointerEvents: 'none',
          }}>
            
            <h1 className='custom-title'
                id="main-title"
                style={{
                position: "relative",
                // Don't let the flex column stretch the title full-width — that gave
                // it an invisible clickable band across the whole top of the screen
                // (over the statue), so taps meant for the canvas navigated home.
                // Constrain the hit box to just the text.
                alignSelf: 'flex-start',
                width: 'fit-content',
                left: "2rem",
                // top: "-2rem",
                color: is80sMode ? "#ffffff" : "#f6f5f1ff",
                fontFamily: 'UnifrakturCook, serif',
                textShadow: is80sMode 
                  ? `
                    0 0 20px rgba(201, 55, 255, 0.9),
                    0 0 40px rgba(201, 55, 255, 0.8),
                    0 0 60px rgba(201, 55, 255, 0.7),
                    4px 4px 12px rgba(201, 55, 255, 1),
                    -2px -2px 8px rgba(255, 0, 255, 0.8),
                    0 0 100px rgba(201, 55, 255, 0.5)
                  `
                  : `
                    0 0 10px rgba(212, 175, 55, 0.8),
                    0 0 20px rgba(212, 175, 55, 0.6),
                    0 0 30px rgba(212, 175, 55, 0.8),
                    6px 6px 16px rgba(0, 0, 0, 1),
                    -2px -2px 8px rgba(255, 192, 203, 0.7),
                    0 0 100px rgba(212, 175, 55, 0.1)
                  `,
                fontSize: "3.5rem",
                fontWeight: 900,
                lineHeight: 0.8,
                transform: "rotate(-8deg) skew(-15deg)",
                zIndex: 1000,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                marginTop: '1rem',
                pointerEvents: 'auto',
              }}
              onClick={() => router.push('/')}
            >
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>
                <span style={{ fontSize: "2rem" }}>of    </span>
                Perpetual
              </span>
              <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
            </h1>

          </div>
        </div>
      )} */}
      
      {/* RL80 wordmark — the way back to the candelarium (the root page; the
          shrine is /illumin80). On this page it's the ONLY exit on phones (the
          social stack and music button are both desktop-only), so it's a real
          <Link>, not a div+onClick: reachable by keyboard, cmd/middle-clickable,
          and announced to screen readers. The glow on hover/focus is what tells
          you it's a door at all — a corner wordmark over a 3D scene otherwise
          reads as pure branding. */}
        <div style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          opacity: fontLoaded ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
          zIndex: 10001,
        }}>
          <Link
            href="/"
            id="text"
            title="ex Machina"
            aria-label="Return to home"
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: "3rem",
              color: "#ffffff",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            RL80
            {Array.from({ length: 100 }).map((_, i) => {
              const index = i + 1;
              return (
                <div
                  key={index}
                  className="text__copy"
                  /* Decorative echo — without this the link announces as
                     "RL80" a hundred times over. */
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: -1,
                    top: 0,
                    left: 0,
                    color: `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
                    filter: "blur(0.1rem)",
                    transform: `translate(${index * 0.1}rem, ${index * 0.1}rem) scale(${1 + index * 0.01})`,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </Link>
        </div>

      {/* Top-right controls: brand-mark home link + shared music toggle */}
      <div
        style={{
          position: "fixed",
          top: "calc(1rem + env(safe-area-inset-top))",
          right: "1rem",
          zIndex: 30000,
          display: "flex",
          alignItems: "center",
          gap: 6,
          pointerEvents: "auto",
        }}
      >
        {/* <Link
          href="/"
          title="Home"
          aria-label="Home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(0, 182, 255, 0.06)",
            border: "1.5px solid rgba(0, 182, 255, 0.25)",
          }}
        >
          <img
            src="/brand-mark-cyan.svg"
            alt="Home"
            width="24"
            height="24"
            style={{ display: "block" }}
          />
        </Link> */}
        {/* Music control is desktop-only — removed on mobile. */}
        {!isMobileView && (
          <MusicButton
            accent="#d4a854"
            icon="/synthwave-sun-80s.svg"
            modernIcon="/virginRecords.jpg"
            showModeToggle
            size={62}
          />
        )}
      </div>

      {/* Nav Controls - Top Right (desktop only) */}
      {/* {!isMobileDevice && (
        <div style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 30000,
        }}>
          <NavControlsHome
            isPlaying={contextIsPlaying}
            onPlayMusic={() => play()}
            onStopMusic={() => pause()}
            onSkipTrack={() => nextTrack()}
            onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
            onUserClick={() => {}}
            isUserSignedIn={!!user}
            isMenuOpen={isMenuOpen}
            is80sMode={is80sMode}
            onToggle80sMode={() => setContext80sMode(!is80sMode)}
            userImage={user?.imageUrl}
            onBuyClick={() => setShowBuyModal(true)}
          />
        </div>
      )} */}

      {/* Mobile: 80s button top-right + bottom nav */}
      {/* {isMobileDevice && (
        <>
          <button
            onClick={() => setContext80sMode(!is80sMode)}
            title={is80sMode ? "Disable 80s Mode" : "Enable 80s Mode"}
            style={{
              position: "absolute",
              top: "calc(1rem + env(safe-area-inset-top))",
              right: "1rem",
              zIndex: 30000,
              width: "auto",
              height: 40,
              minWidth: 40,
              minHeight: 40,
              padding: "0 8px",
              borderRadius: 10,
              background: is80sMode
                ? "rgba(255, 0, 255, 0.1)"
                : "rgba(212, 175, 55, 0.05)",
              border: `1.5px solid ${is80sMode ? "rgba(255, 0, 255, 0.4)" : "rgba(212, 175, 55, 0.2)"}`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: is80sMode
                ? "0 0 15px rgba(255, 0, 255, 0.3)"
                : "none",
            }}
          >
            <span style={{
              fontSize: 12,
              fontWeight: "bold",
              color: is80sMode ? "#00ff41" : "#67e8f9",
              textShadow: is80sMode ? "0 0 10px #00ff41" : "none",
              fontFamily: "'Orbitron', monospace",
              lineHeight: 0.9,
            }}>80s</span>
            <span style={{
              fontSize: "0.5rem",
              fontWeight: "bold",
              color: is80sMode ? "#00ff41" : "#67e8f9",
              textShadow: is80sMode ? "0 0 10px #00ff41" : "none",
              fontFamily: "'Orbitron', monospace",
            }}>MODE</span>
          </button>

          <MobileBottomNav
            isPlaying={contextIsPlaying}
            onPlayMusic={() => play()}
            onStopMusic={() => pause()}
            onSkipTrack={() => nextTrack()}
            onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
            onUserClick={() => {}}
            isUserSignedIn={!!user}
            isMenuOpen={isMenuOpen}
            is80sMode={is80sMode}
            userImage={user?.imageUrl}
            onBuyClick={() => setShowBuyModal(true)}
            isMobile
            show80sButton={false}
          />
        </>
      )} */}
      
      {/* CyberNav Menu Panel */}
      {/* <CyberNav
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      /> */}

      {/* Buy Modal */}
      <BuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      {/* Donation Modal */}
      <FountainDonationModal
        isOpen={showDonationModal}
        onClose={() => {
          setShowDonationModal(false);
          setPreselectedCharity(null);
        }}
        preselectedCharity={preselectedCharity}
        onDonationComplete={(donation) => {
          // Optionally notify the iframe about the successful donation
          if (iframeRef.current) {
            try {
              iframeRef.current.contentWindow.postMessage(
                { type: 'donationComplete', donation },
                '*'
              );
            } catch (e) {
            }
          }
        }}
      />

      {/* Buy Token FAB */}
      {/* <div onClick={() => setShowCandleModal(true)}>
        <BuyTokenFAB is80sMode={is80sMode} />
      </div> */}

      {/* Candle Modal */}
      {/* <CompactCandleModal
        isOpen={showCandleModal}
        onClose={() => setShowCandleModal(false)}
        onCandleCreated={(candle) => {
          console.log('New candle created:', candle);
        }}
      /> */}

      {/* Social links (X / Telegram / Farcaster) — desktop only, mirrors the
          root page's social-stack (bottom-right, gold-bordered round buttons). */}
      {!isMobileView && (
        <div
          className="social-stack"
          style={{
            position: "fixed",
            bottom: "5rem",
            right: "2rem",
            left: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            zIndex: 1001,
            // Yield to the Coin Guide panel while it's open (it lives in the iframe
            // and can't out-z-index these parent-page icons).
            opacity: infoPanelOpen ? 0 : 1,
            pointerEvents: infoPanelOpen ? "none" : "auto",
            transition: "opacity 0.25s ease",
          }}
        >
          {[
            { href: "https://x.com/rl80token", label: "X (Twitter)", icon: "/x_logo_white.webp", size: 18 },
            { href: "https://t.me/rl80token", label: "Telegram", icon: "/telegram_logo_white.webp", size: 20 },
            { href: "https://farcaster.xyz/rl80", label: "Farcaster", icon: "/farcaster_logo.webp", size: 20 },
          ].map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                border: "2px solid rgba(212, 175, 55, 0.65)",
                background: "rgba(0, 0, 0, 0.5)",
                transition: "all 0.3s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.15)";
                e.currentTarget.style.boxShadow = "0 0 15px rgba(212, 175, 55, 0.5)";
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.filter = "brightness(1.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.filter = "none";
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "block",
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  backgroundColor: "#d4a854",
                  WebkitMaskImage: `url(${s.icon})`,
                  maskImage: `url(${s.icon})`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                }}
              />
            </a>
          ))}
        </div>
      )}

      {/* Snapshot button — grab a photo of the scene (find the hidden monk!) and
          share it. Works on desktop + mobile; hidden while the Coin Guide is open. */}
      <button
        type="button"
        onClick={requestSnapshot}
        disabled={snapshotPending}
        aria-label="Take a snapshot"
        title="Take a snapshot"
        style={{
          position: "fixed",
          // Mobile: the music button is gone, so the camera takes the now-vacated
          // top-right corner. Desktop: still tucked under the music button
          // (62px tall, anchored at top:1rem) with an 8px gap.
          top: isMobileView
            ? "calc(1rem + env(safe-area-inset-top))"
            : "calc(1rem + 70px)",
          right: "1rem",
          width: isMobileView ? "44px" : "48px",
          height: isMobileView ? "44px" : "48px",
          borderRadius: "10px",
          border: "1.5px solid rgba(212, 175, 55, 0.2)",
          background: "rgba(212, 175, 55, 0.05)",
          color: "#d4a854",
          fontSize: "22px",
          lineHeight: 1,
          cursor: snapshotPending ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 30000,
          opacity: infoPanelOpen ? 0 : (snapshotPending ? 0.6 : 1),
          pointerEvents: infoPanelOpen ? "none" : "auto",
          transition: "opacity 0.25s ease, transform 0.3s ease, box-shadow 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.15)";
          e.currentTarget.style.boxShadow = "0 0 15px rgba(212, 175, 55, 0.5)";
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.05)";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {snapshotPending ? (
            "…"
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          )}
        </span>
      </button>

      {/* Hidden canvas: the iframe's captured frame is drawn here, then PolaroidSnapshot
          reads it by id. Off-screen rather than display:none so the canvas still rasterizes. */}
      <canvas
        id="fountainSnapCanvas"
        ref={snapCanvasRef}
        style={{ position: "fixed", left: "-99999px", top: 0, width: "1px", height: "1px", pointerEvents: "none" }}
      />

      <PolaroidSnapshot
        trigger={snapshotTrigger}
        captureElementId="fountainSnapCanvas"
        label="Add your caption here!"
        watermark={false}
        shareCaption=""
        shareLink=""
        onComplete={handleSnapshotComplete}
      />
    </div>
  );
}