"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Carousel from "@/components/Carousel";
import Footer from "@/components/Footer";
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
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 1.5,
      color: Math.random() > 0.7 ? '#d4af37' : Math.random() > 0.5 ? '#fff' : '#e6c87a',
    }));
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

  return (
    <>
      <StarryBackground />

      {/* Nav Controls - Top Right */}
      <div
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 9999,
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
            minHeight: "100vh",
            overflow: "hidden",
            position: "relative",
            zIndex: 1,
            background: "transparent",
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
              marginBottom: "1rem",
              transform: "scale(.8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
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
                top: "-6rem",
                left: "50%",
                transform: "translateX(-50%) scale(0.5)",
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
              <img
                src="/carouselSign.png"
                alt=""
                translate="no" 
                style={{
                  width: "auto",
                  maxWidth: "none",
                  maxHeight: "none",
                }}
                onLoad={() => console.log("Carousel sign loaded")}
              />
            </div>
          </div>


          {!isRiding && (
            <div style={{ marginTop: "3rem", zIndex: "100" }}>
              <Footer />
            </div>
          )}
        </div>
      )}
    </>
  );
}