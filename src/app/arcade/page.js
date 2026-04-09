"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMusic } from "@/components/MusicContext";
import CoinLoader from "@/components/CoinLoader";
import CyberNav from "@/components/CyberNav";
import NavControlsHome from "@/components/NavControlsHome";
import MobileBottomNav from "@/components/MobileBottomNav";
import MainMobileNav from "@/components/MainMobileNav";
import BuyModal from "@/components/BuyModal";
import { useUser } from "@clerk/nextjs";

const ArcadeScene = dynamic(() => import("@/components/ArcadeScene"), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />,
});

export default function ArcadePage() {
  const router = useRouter();
  const { user } = useUser();
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    is80sMode: context80sMode,
    setIs80sMode: setContext80sMode,
  } = useMusic();

  const [isLoading, setIsLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [screenTransition, setScreenTransition] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [activeScreen, setActiveScreen] = useState(null);
  const is80sMode = context80sMode;

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
    };
    if (typeof window !== "undefined") checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Font loading
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        setFontLoaded(true);
        document.documentElement.classList.add("fonts-loaded");
      } catch (e) {
        setTimeout(() => {
          setFontLoaded(true);
          document.documentElement.classList.add("fonts-loaded");
        }, 100);
      }
    };
    checkFont();
  }, []);

  // Loading timeout fallback
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 12000);
    return () => clearTimeout(timeout);
  }, []);

  const handleSceneReady = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleZoomReady = useCallback((screenName) => {
    setActiveScreen(screenName);
    setShowConfirm(true);
  }, []);

  const handleConfirmEnter = useCallback(() => {
    setShowConfirm(false);
    setConfirmAction("enter");
  }, []);

  const handleCancelEnter = useCallback(() => {
    setShowConfirm(false);
    setConfirmAction("back");
    // Reset so the action can be triggered again on next click
    setTimeout(() => setConfirmAction(null), 200);
  }, []);

  const handleEnterScreen = useCallback((screenName) => {
    setScreenTransition(true);
    const destination = screenName === "Screen2" ? "/race" : "/oil";
    // Navigate after the white flash fills the screen
    setTimeout(() => {
      router.push(destination);
    }, 600);
  }, [router]);

  return (
    <div
      style={{
        backgroundColor: "#000000",
        height: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        position: "fixed",
        left: 0,
        top: 0,
        overflow: "hidden",
      }}
    >
      <style jsx global>{`
        @font-face {
          font-family: "UnifrakturMaguntia";
          src: url("/fonts/UnifrakturMaguntia-Regular.ttf") format("truetype");
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }

        #text,
        .text__copy {
          font-family: "UnifrakturMaguntia", serif !important;
        }

        @keyframes torchFlicker {
          0%,
          100% {
            opacity: 0.85;
            text-shadow: 0 0 10px rgba(212, 175, 55, 0.8),
              0 0 20px rgba(212, 175, 55, 0.6),
              0 0 30px rgba(212, 175, 55, 0.8),
              6px 6px 16px rgba(0, 0, 0, 1),
              -2px -2px 8px rgba(255, 192, 203, 0.7),
              0 0 100px rgba(212, 175, 55, 0.1);
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 15px rgba(212, 175, 55, 1),
              0 0 30px rgba(212, 175, 55, 0.8),
              0 0 45px rgba(212, 175, 55, 0.9),
              6px 6px 16px rgba(0, 0, 0, 1),
              -2px -2px 8px rgba(255, 192, 203, 0.9),
              0 0 120px rgba(212, 175, 55, 0.3);
          }
        }

        @keyframes neonPulse {
          0%,
          100% {
            opacity: 0.9;
            text-shadow: 0 0 20px rgba(201, 55, 255, 0.9),
              0 0 40px rgba(201, 55, 255, 0.8),
              0 0 60px rgba(201, 55, 255, 0.7),
              4px 4px 12px rgba(201, 55, 255, 1),
              -2px -2px 8px rgba(255, 0, 255, 0.8),
              0 0 100px rgba(201, 55, 255, 0.5);
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 30px rgba(201, 55, 255, 1),
              0 0 60px rgba(201, 55, 255, 1),
              0 0 80px rgba(201, 55, 255, 0.9),
              4px 4px 12px rgba(201, 55, 255, 1),
              -2px -2px 12px rgba(255, 0, 255, 1),
              0 0 140px rgba(201, 55, 255, 0.7);
          }
        }
      `}</style>

      {/* Loader */}
      {isLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "#000",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CoinLoader loading={isLoading} />
        </div>
      )}

      {/* 3D Arcade Scene */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      >
        <ArcadeScene is80sMode={is80sMode} onLoaded={handleSceneReady} onEnterScreen={handleEnterScreen} onZoomReady={handleZoomReady} confirmAction={confirmAction} />
      </div>

      {/* Title — Desktop */}
      {fontLoaded && !isMobileView && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            minHeight: "100vh",
            zIndex: 10001,
            pointerEvents: "none",
            opacity: fontLoaded ? 1 : 0,
            transition: "opacity 0.5s ease-in-out",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              width: "100%",
              minHeight: "100vh",
              pointerEvents: "none",
            }}
          >
     
             <h1
              className="custom-title"
              style={{
                position: "relative",
                left: "2rem",
                top: "-1.5rem",
                color: is80sMode ? "#ffffff" : "#f6f5f1ff",
                fontFamily: "UnifrakturCook, serif",
                animation: is80sMode
                  ? "neonPulse 2s ease-in-out infinite"
                  : "torchFlicker 3s ease-in-out infinite",
                fontSize: "3rem",
                fontWeight: 900,
                lineHeight: 0.85,
                transform: "rotate(-8deg) skew(-15deg)",
                zIndex: 1000,
                whiteSpace: "nowrap",
                cursor: "pointer",
                marginTop: "0rem",
                pointerEvents: "auto",
              }}
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
      )}

      {/* RL80 Logo — Mobile */}
      {fontLoaded && isMobileView && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "20px",
            borderRadius: "8px",
            padding: "10px",
            pointerEvents: "auto",
            opacity: fontLoaded ? 1 : 0,
            transition: "opacity 0.3s ease-in-out",
            zIndex: 10001,
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
              href="/about"
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

      {/* Nav Controls — Desktop (hidden, using MainMobileNav instead) */}
      {/* {!isMobileDevice && (
        <div
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            zIndex: 30000,
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
            onToggle80sMode={() => setContext80sMode(!is80sMode)}
            userImage={user?.imageUrl}
            onBuyClick={() => setShowBuyModal(true)}
          />
        </div>
      )} */}

      {/* Mobile: 80s button (hidden, using MainMobileNav instead) */}

      {/* Bottom nav — all screen sizes */}
      <MainMobileNav
        onBuyClick={() => setShowBuyModal(true)}
        onCommsClick={() => {}}
        overrideSlots={{
          leftCenter: {
            icon: (
              <svg className="mn-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d="M12 18h.01" />
                <path d="M7 14a5 5 0 0 1 10 0" />
                <path d="M4 10a9 9 0 0 1 16 0" />
                <rect x="5" y="18" width="14" height="4" rx="1" />
              </svg>
            ),
            label: "COMMS",
            onClick: () => {},
            colorClass: "mn-comms",
            disabled: true,
          },
          right: {
            icon: (
              <svg className="mn-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            ),
            label: "BASE",
            onClick: () => router.push('/'),
            colorClass: "mn-lounge",
          },
        }}
      />

      {/* CyberNav Menu */}
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

      {/* Confirm popup — shown when zoomed into Screen1 */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 90000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              background: is80sMode
                ? "linear-gradient(135deg, rgba(20, 0, 40, 0.95), rgba(40, 0, 60, 0.9))"
                : "linear-gradient(135deg, rgba(10, 8, 5, 0.95), rgba(30, 25, 15, 0.9))",
              border: is80sMode
                ? "1px solid rgba(201, 55, 255, 0.6)"
                : "1px solid rgba(212, 175, 55, 0.4)",
              borderRadius: 12,
              padding: "2rem 2.5rem",
              textAlign: "center",
              maxWidth: 340,
              boxShadow: is80sMode
                ? "0 0 40px rgba(201, 55, 255, 0.3), inset 0 0 20px rgba(201, 55, 255, 0.05)"
                : "0 0 40px rgba(212, 175, 55, 0.2), inset 0 0 20px rgba(212, 175, 55, 0.03)",
              animation: "confirmFadeIn 0.3s ease-out",
            }}
          >
            <p
              style={{
                color: is80sMode ? "#e0b0ff" : "#f6f5f1",
                fontFamily: "'UnifrakturMaguntia', serif",
                fontSize: "1.4rem",
                margin: "0 0 0.5rem 0",
                textShadow: is80sMode
                  ? "0 0 10px rgba(201, 55, 255, 0.5)"
                  : "0 0 10px rgba(212, 175, 55, 0.3)",
              }}
            >
              {activeScreen === "Screen2" ? "Enter the Rally?" : "Enter the Oil Fields?"}
            </p>
            <p
              style={{
                color: is80sMode ? "rgba(200, 180, 255, 0.6)" : "rgba(246, 245, 241, 0.5)",
                fontSize: "0.8rem",
                margin: "0 0 1.5rem 0",
                fontFamily: "monospace",
              }}
            >
              You will be redirected to {activeScreen === "Screen2" ? "/race" : "/oil"}
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button
                onClick={handleCancelEnter}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: 8,
                  border: is80sMode
                    ? "1px solid rgba(201, 55, 255, 0.3)"
                    : "1px solid rgba(212, 175, 55, 0.2)",
                  background: "transparent",
                  color: is80sMode ? "#c080ff" : "#d4af37",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = is80sMode
                    ? "rgba(201, 55, 255, 0.1)"
                    : "rgba(212, 175, 55, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                }}
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmEnter}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: 8,
                  border: "none",
                  background: is80sMode
                    ? "linear-gradient(135deg, rgba(201, 55, 255, 0.8), rgba(150, 0, 200, 0.8))"
                    : "linear-gradient(135deg, rgba(212, 175, 55, 0.8), rgba(180, 140, 30, 0.8))",
                  color: "#fff",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: is80sMode
                    ? "0 0 15px rgba(201, 55, 255, 0.3)"
                    : "0 0 15px rgba(212, 175, 55, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "scale(1)";
                }}
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen enter transition — white flash that fills the viewport */}
      {screenTransition && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 100000,
            pointerEvents: "all",
            backgroundColor: "#ffffff",
            animation: "screenEnter 0.6s ease-in forwards",
          }}
        />
      )}
      <style jsx>{`
        @keyframes confirmFadeIn {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes screenEnter {
          0% {
            opacity: 0;
          }
          40% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
