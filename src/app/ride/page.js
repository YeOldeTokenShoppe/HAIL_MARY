"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Carousel from "@/components/Carousel";
import CoinLoader from "@/components/CoinLoader";
import { useUser } from "@clerk/nextjs";
import { useMusic } from "@/components/MusicContext";
import CyberNav from "@/components/CyberNav";

const NavControlsHome = dynamic(() => import("@/components/NavControlsHome"), {
  ssr: false,
  loading: () => null,
});

// Twinkling stars background component
const StarryBackground = () => {
  const [stars, setStars] = useState([]);

  // Generate stars only on client to avoid hydration mismatch
  useEffect(() => {
    setStars(Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 1.5,
      color: Math.random() > 0.7 ? '#d4af37' : Math.random() > 0.5 ? '#fff' : '#e6c87a',
    })));
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(180deg, #0d0a14 0%, #1b1724 50%, #2a1f3d 100%)",
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .star {
          position: absolute;
          border-radius: 50%;
          animation: twinkle ease-in-out infinite;
        }
      `}</style>
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: star.color,
            boxShadow: `0 0 ${star.size * 2}px ${star.color}`,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
      </div>
  );
};

export default function CommunionPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [carouselLoaded, setCarouselLoaded] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [contentOpacity, setContentOpacity] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRiding, setIsRiding] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [deviceDetected, setDeviceDetected] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
    const [isTabletPortrait, setIsTabletPortrait] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 480 && window.innerWidth <= 1024 && window.innerHeight > window.innerWidth : false)


  const { user } = useUser();
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    is80sMode,
    setIs80sMode,
  } = useMusic();

  // Handle transition from loading to content
  useEffect(() => {
    if (carouselLoaded) {
      setShowContent(true);
      setTimeout(() => {
        setIsLoading(false);
        setTimeout(() => {
          setContentOpacity(1);
        }, 300);
      }, 300);
    }
  }, [carouselLoaded]);

  // Force loader to hide after timeout
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setShowContent(true);
        setTimeout(() => setContentOpacity(1), 100);
      }
    }, 10000); // 10 second max wait

    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  // Make body transparent for starry background
  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = "#1b1724";
      document.documentElement.style.background = "#1b1724";
    };
  }, []);

  // Handle resize events for responsive behavior (device detection)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPortrait = height > width;

      // Detect if it's likely an iPad (including iPad Mini)
      const isIPad = /iPad/.test(navigator.userAgent) ||
                     (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

      // Phone breakpoint - only true phones, not tablets even in portrait
      const isPhone = width < 480 && !isIPad;

      setIsMobileDevice(isPhone);
      setDeviceDetected(true);
    };

    if (typeof window !== 'undefined') {
      handleResize();
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        await document.fonts.load("1em 'UnifrakturCook'");
        setFontLoaded(true);
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

  return (
    <>
      <StarryBackground />

      {/* Font Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'UnifrakturCook';
          src: url('/fonts/UnifrakturCook-Bold.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;
        }
      `}} />

      {/* RL80 Logo - Mobile Only */}
      {deviceDetected && isMobileDevice && (
        <div style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          zIndex: 999,
        }}>
          <div
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: "3rem",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <Link href="/#final" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </Link>
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
              return (
                <div
                  key={index}
                  className="text__copy"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: -1,
                    top: 0,
                    left: 0,
                    color: is80sMode
                      ? `rgba(${201 - index * 2}, ${55 - index * 3}, ${256 - index * 2})`
                      : `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
                    filter: "blur(0.1rem)",
                    transform: `translate(${index * 0.1}rem, ${index * 0.1}rem) scale(${1 + index * 0.01})`,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Our Lady of Perpetual Profit Logo - Non-Mobile */}
      {deviceDetected && !isMobileDevice && (
        <h1 className='custom-title'
          style={{
                position: 'absolute',
                top: '2rem',
                left: '1.5rem',
                pointerEvents: 'auto',
                color: is80sMode ? "#ffffff" : "#d4af37",
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
                    rgba(83, 61, 74, 0.9) 1px 1px,
                    rgba(83, 61, 74, 0.9) 2px 2px,
                    rgba(83, 61, 74, 0.8) 3px 3px,
                    rgba(83, 61, 74, 0.8) 4px 4px,
                    rgba(83, 61, 74, 0.7) 5px 5px,
                    rgba(83, 61, 74, 0.7) 6px 6px,
                    rgba(83, 61, 74, 0.6) 7px 7px,
                    rgba(83, 61, 74, 0.6) 8px 8px,
                    rgba(255, 192, 203, 0.4) -1px -1px 5px,
                    rgba(0, 0, 0, 0.8) 10px 10px 15px
                  `,
                fontSize: isTabletPortrait ? "2rem" : "2.5rem",
                fontWeight: 900,
                lineHeight: 0.8,
                transform: "rotate(-8deg) skew(-15deg)",
                cursor: 'pointer',
                margin: 0,
                zIndex: 50
              }}
        >
          <Link href="/#final" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>
              <span style={{ fontSize: "2rem" }}>of    </span>
              Perpetual
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
          </Link>
        </h1>
      )}

      {/* Nav Controls - Top Right */}
      <div
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 9,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
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
          onToggle80sMode={() => setIs80sMode(!is80sMode)}
          userImage={user?.imageUrl}
          show80sButton={false}
        />
      </div>

      {/* CyberNav Menu Panel */}
      <CyberNav
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />

      {/* Loader */}
      {isLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#1b1724",
            zIndex: 50,
            transition: "opacity 0.5s ease-out",
            opacity: 1,
            pointerEvents: "all"
          }}
        >
          <CoinLoader isLoading={isLoading} />
        </div>
      )}

      {/* Main Content */}
      {showContent && (
        <div
          style={{
            opacity: contentOpacity,
            transition: "opacity 0.8s ease-in",
            width: "100vw",
            height: "100vh",
            overflow: "visible",
            position: "relative",
            zIndex: 1,
            background: "transparent",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: '12vh',
            paddingBottom: '0',
            boxSizing: 'border-box',
          }}
        >
          {/* Title and Intro */}
          {/* <div
            style={{
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              marginTop: "5rem",
              marginBottom: "-2rem",
            }}
          >
            <h2
              style={{
                fontFamily: "Oleo Script, cursive",
                fontSize: "1.8rem",
                color: "#d4af37",
                textShadow: "0 0 10px rgba(212, 175, 55, 0.4)",
                margin: 0,
              }}
            >
              Ride or Die
            </h2>
            <p
              style={{
                fontFamily: "Roboto, sans-serif",
                fontSize: "0.85rem",
                color: "rgba(255, 255, 255, 0.7)",
                margin: "0.25rem 0 0 0",
              }}
            >
              Click a beast to ride &amp; chat live for 10 minutes
            </p>
          </div> */}

          <div
            style={{
              position: "relative",
              marginBottom: "0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              width: "100%",
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Container wrapping the Carousel and the sign */}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 2,
              }}
            >
              <Carousel
                setCarouselLoaded={setCarouselLoaded}
                onRidingChange={setIsRiding}
                images={[
                  { src: "/seaMonster.png", title: "Sea Monster" },
                  { src: "/bull.png", title: "Bull" },
                  { src: "/bear.png", title: "Bear" },
                  { src: "/gator.png", title: "G8r" },
                  { src: "/chupa.png", title: "Chupacabra" },
                  { src: "/snowman.png", title: "Yeti" },
                  { src: "/unicorn.png", title: "Unicorn" },
                  { src: "/jackalope.png", title: "Jackalope" },
                  { src: "/liger.png", title: "Liger" },
                  { src: "/dire.png", title: "Dire Wolf" },
                  { src: "/warthog.png", title: "Warthog" },
                  { src: "/mothmanRide.png", title: "Mothman" },
                ]}
              />
            </div>

            {/* Carousel sign with improved positioning and z-index */}
            <div
              style={{
                position: "absolute",
                top: "-4rem",
                left: "50%",
                transform: "translateX(-50%) scale(0.35)",
                width: "auto",
                maxWidth: "none",
                maxHeight: "none",
                zIndex: 9999,
                pointerEvents: "none",
                willChange: "transform",
                isolation: "isolate",
                translate: "no",
              }}
            >
              {/* <img
                src="/images/CIRCUS_SIGN2.webp"
                alt=""
                translate="no" 
                style={{
                  width: "auto",
                  maxWidth: "none",
                  maxHeight: "none",
                }}
                onLoad={() => console.log("Carousel sign loaded")}
              /> */}
            </div>
          </div>


        </div>
      )}
    </>
  );
}