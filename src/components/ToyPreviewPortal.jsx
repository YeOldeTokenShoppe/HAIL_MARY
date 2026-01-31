"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Toy configuration - defines each toy's preview content
export const TOY_PREVIEW_CONFIG = {
  BurningHeart: {
    name: "Sacred Flame",
    destination: "/illumin80",
    icon: "/images/sacreCoeur.webp",
    previewImage: "/images/sacreCoeur.webp",
    tagline: "Light a candle for prosperity",
    description: "Join the faithful in the ILLUMIN80 shrine",
    accentColor: "#ff6b35",
    glowColor: "rgba(255, 107, 53, 0.6)",
  },
  Coin: {
    name: "Sacred Token",
    destination: "/tokenomics",
    icon: "/images/COIN_TATTOO.webp",
    previewImage: "/images/COIN_TATTOO.webp",
    tagline: "Explore the sacred tokenomics",
    description: "Discover the divine economics of RL80",
    accentColor: "#ffd700",
    glowColor: "rgba(255, 215, 0, 0.6)",
  },
  TATTOO: {
    name: "Eternal Scripture",
    destination: "/philosophy",
    icon: "/images/ILLUMIN80_TATTOO.webp",
    previewImage: "/images/ILLUMIN80_TATTOO.webp",
    tagline: "Read the eternal whitepaper",
    description: "The sacred philosophy of Our Lady",
    accentColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.6)",
  },
  Painting: {
    name: "Time Portal",
    destination: "/portal",
    icon: "/images/timePortal.webp",
    previewImage: "/images/timePortal.webp",
    tagline: "Journey through time",
    description: "Witness Our Lady's great moments",
    accentColor: "#00ff9d",
    glowColor: "rgba(0, 255, 157, 0.6)",
  },
  Unicorn: {
    name: "Divine Steed",
    destination: "/ride",
    icon: "/images/ROSE_TATTOO.webp",
    previewImage: "/images/ROSE_TATTOO.webp",
    tagline: "Join the community ride",
    description: "Race with the faithful",
    accentColor: "#ff00ff",
    glowColor: "rgba(255, 0, 255, 0.6)",
  },
};

// Floating star particle component
function StarParticle({ delay, duration, startAngle, distance }) {
  return (
    <div
      style={{
        position: "absolute",
        width: "3px",
        height: "3px",
        background: "#fff",
        borderRadius: "50%",
        boxShadow: "0 0 6px 2px rgba(255, 255, 255, 0.8)",
        opacity: 0,
        animation: `starDrift ${duration}s ${delay}s ease-in infinite`,
        left: "50%",
        top: "50%",
        transform: `rotate(${startAngle}deg) translateX(${distance}px)`,
        transformOrigin: "0 0",
      }}
    />
  );
}

// Main portal component
export default function ToyPreviewPortal({ toyName, isOpen, onClose }) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const config = toyName ? TOY_PREVIEW_CONFIG[toyName] : null;

  // Handle open/close state changes
  useEffect(() => {
    if (isOpen && toyName) {
      // Opening - show everything immediately
      setIsVisible(true);
      setIsClosing(false);
      setShowContent(true);
    } else if (!isOpen && isVisible) {
      // Closing
      setIsClosing(true);
      setShowContent(false);
      const closeTimer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 500);
      return () => clearTimeout(closeTimer);
    }
  }, [isOpen, toyName, isVisible]);

  const handleNavigate = useCallback(() => {
    if (config?.destination) {
      router.push(config.destination);
    }
  }, [config, router]);

  const handleDismiss = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!isVisible || !config) return null;

  return (
    <>
      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes portalOpen {
          0% {
            transform: scale(0) rotate(180deg);
            opacity: 0;
          }
          60% {
            transform: scale(1.1) rotate(-10deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes portalClose {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
        }

        @keyframes ringRotate1 {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes ringRotate2 {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }

        @keyframes ringRotate3 {
          from { transform: translate(-50%, -50%) rotate(45deg); }
          to { transform: translate(-50%, -50%) rotate(405deg); }
        }

        @keyframes starDrift {
          0% {
            opacity: 0;
            transform: rotate(var(--angle)) translateX(var(--distance));
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: rotate(var(--angle)) translateX(20px);
          }
        }

        @keyframes contentFadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        @keyframes floatIcon {
          0%, 100% { transform: translateY(0px) rotate(-5deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 1000,
          opacity: isClosing ? 0 : 1,
          transition: "opacity 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          padding: "20px",
        }}
      >
        {/* Portal Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "min(85vw, 320px)",
            height: "min(85vw, 320px)",
            animation: isClosing
              ? "portalClose 0.5s ease-in forwards"
              : "portalOpen 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          {/* Outer glow */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              left: "-20%",
              width: "140%",
              height: "140%",
              background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
              filter: "blur(30px)",
              animation: "pulse 3s ease-in-out infinite",
            }}
          />

          {/* Vortex Ring 1 - Outer */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: `3px solid transparent`,
              borderTopColor: config.accentColor,
              borderRightColor: `${config.accentColor}66`,
              boxShadow: `0 0 30px ${config.glowColor}, inset 0 0 30px ${config.glowColor}`,
              animation: "ringRotate1 8s linear infinite",
            }}
          />

          {/* Vortex Ring 2 - Middle */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "80%",
              height: "80%",
              borderRadius: "50%",
              border: `2px dashed ${config.accentColor}88`,
              boxShadow: `0 0 20px ${config.glowColor}`,
              animation: "ringRotate2 6s linear infinite",
            }}
          />

          {/* Vortex Ring 3 - Inner */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "60%",
              height: "60%",
              borderRadius: "50%",
              border: `2px solid ${config.accentColor}44`,
              boxShadow: `0 0 15px ${config.glowColor}`,
              animation: "ringRotate3 4s linear infinite",
            }}
          />

          {/* Star particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: "4px",
                height: "4px",
                background: "#fff",
                borderRadius: "50%",
                boxShadow: `0 0 8px 2px ${config.accentColor}`,
                left: "50%",
                top: "50%",
                opacity: 0,
                animation: `starDrift ${3 + (i % 3)}s ${i * 0.3}s ease-in infinite`,
                "--angle": `${i * 30}deg`,
                "--distance": `${120 + (i % 4) * 20}px`,
                transform: `rotate(${i * 30}deg) translateX(${120 + (i % 4) * 20}px)`,
              }}
            />
          ))}

          {/* Center portal void */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "55%",
              height: "55%",
              borderRadius: "50%",
              background: `radial-gradient(circle,
                rgba(0, 0, 0, 0.9) 0%,
                rgba(0, 0, 0, 0.95) 50%,
                ${config.accentColor}22 100%
              )`,
              boxShadow: `inset 0 0 40px ${config.glowColor}`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Preview image inside portal */}
            {showContent && (
              <div
                style={{
                  width: "80%",
                  height: "80%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  animation: "contentFadeIn 0.5s ease-out forwards",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={config.previewImage}
                  alt={config.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: `drop-shadow(0 0 10px ${config.glowColor})`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Content below portal */}
        {showContent && (
          <div
            style={{
              marginTop: "2rem",
              textAlign: "center",
              animation: "contentFadeIn 0.5s 0.2s ease-out both",
              maxWidth: "300px",
            }}
          >
            {/* Toy icon floating */}
            <div
              style={{
                width: "50px",
                height: "50px",
                margin: "0 auto 1rem",
                animation: "floatIcon 3s ease-in-out infinite",
              }}
            >
              <img
                src={config.icon}
                alt={config.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: `drop-shadow(0 0 10px ${config.glowColor})`,
                }}
              />
            </div>

            {/* Title */}
            <h2
              style={{
                fontFamily: "'UnifrakturMaguntia', serif",
                fontSize: "1.8rem",
                color: config.accentColor,
                textShadow: `0 0 20px ${config.glowColor}`,
                margin: "0 0 0.5rem",
              }}
            >
              {config.name}
            </h2>

            {/* Tagline */}
            <p
              style={{
                fontFamily: "'Georgia', serif",
                fontSize: "1.1rem",
                color: "rgba(255, 255, 255, 0.9)",
                fontStyle: "italic",
                margin: "0 0 0.5rem",
              }}
            >
              "{config.tagline}"
            </p>

            {/* Description */}
            <p
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.9rem",
                color: "rgba(255, 255, 255, 0.6)",
                margin: "0 0 1.5rem",
              }}
            >
              {config.description}
            </p>

            {/* Navigate button */}
            <button
              onClick={handleNavigate}
              style={{
                background: `linear-gradient(135deg, ${config.accentColor}, ${config.accentColor}88)`,
                border: "none",
                borderRadius: "30px",
                padding: "12px 32px",
                color: "#000",
                fontFamily: "'Orbitron', monospace",
                fontSize: "0.9rem",
                fontWeight: "bold",
                letterSpacing: "1px",
                cursor: "pointer",
                boxShadow: `0 0 20px ${config.glowColor}`,
                transition: "all 0.3s ease",
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = `0 0 30px ${config.glowColor}`;
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = `0 0 20px ${config.glowColor}`;
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = `0 0 30px ${config.glowColor}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = `0 0 20px ${config.glowColor}`;
              }}
            >
              ENTER PORTAL
            </button>

            {/* Dismiss hint */}
            <p
              style={{
                marginTop: "1.5rem",
                fontSize: "0.75rem",
                color: "rgba(255, 255, 255, 0.4)",
                letterSpacing: "2px",
              }}
            >
              TAP OUTSIDE TO DISMISS
            </p>
          </div>
        )}
      </div>
    </>
  );
}
