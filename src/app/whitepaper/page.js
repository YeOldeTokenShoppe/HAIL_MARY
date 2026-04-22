"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useMusic } from "@/components/MusicContext";
import CoinLoader from "@/components/CoinLoader";
import CyberNav from "@/components/CyberNav";
import NavControlsHome from "@/components/NavControlsHome";
import BuyModal from "@/components/BuyModal";
import { useLanguage } from "@/components/LanguageProvider";

export default function WhitepaperPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isTabletPortrait, setIsTabletPortrait] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const { user } = useUser();
  const { t } = useLanguage();
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    is80sMode,
    setIs80sMode,
  } = useMusic();

  // Device detection
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isIPad =
        /iPad/.test(navigator.userAgent) ||
        (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      const isPhone = width < 480 && !isIPad;
      setIsMobileDevice(isPhone);
      setIsTabletPortrait(width > 480 && width <= 1024 && height > width);
    };

    if (typeof window !== "undefined") handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Iframe loaded
  const handleIframeLoad = () => {
    setTimeout(() => setIsLoading(false), 500);
  };

  // Fallback timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) setIsLoading(false);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, #0d0a14 0%, #1b1724 50%, #2a1f3d 100%)",
      }}
    >
      {/* Font Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
      `,
        }}
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
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#0d0a14",
            zIndex: 50,
          }}
        >
          <CoinLoader loading={isLoading} />
        </div>
      )}

      {/* RL80 Logo - Mobile Only */}
      {isMobileDevice && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "0.5rem",
            borderRadius: "8px",
            padding: "10px",
            pointerEvents: "auto",
            zIndex: 100,
          }}
        >
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
            <Link
              href="/#final"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "inline-block",
              }}
            >
              RL80
            </Link>
            {Array.from({ length: 100 }).map((_, i) => {
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
      {!isMobileDevice && (
        <h1
          style={{
            position: "fixed",
            top: "2rem",
            left: "1.5rem",
            pointerEvents: "auto",
            color: is80sMode ? "#ffffff" : "#d4af37",
            fontFamily: "UnifrakturCook, serif",
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
            cursor: "pointer",
            margin: 0,
            zIndex: 100,
          }}
        >
          <Link
            href="/#final"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span style={{ display: "block", position: "relative" }}>
              Our Lady
            </span>
            <span style={{ display: "block", position: "relative" }}>
              <span style={{ fontSize: "2rem" }}>of&nbsp;&nbsp;&nbsp;&nbsp;</span>
              Perpetual
            </span>
            <span
              style={{
                display: "block",
                marginLeft: "4rem",
                position: "relative",
              }}
            >
              Profit
            </span>
          </Link>
        </h1>
      )}

      {/* Nav Controls - Top Right */}
      <div
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 10000,
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
          onBuyClick={() => setShowBuyModal(true)}
          isMobile={isMobileDevice}
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

      {/* Thirdweb Buy Modal */}
      <BuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      {/* Whitepaper Scroll iframe */}
      <iframe
        src="/scroll5.html"
        onLoad={handleIframeLoad}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "none",
          zIndex: 1,
        }}
        title="The Techno-Mythic Whitepaper"
      />
    </div>
  );
}
