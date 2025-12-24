import React, { useRef, useEffect, useState } from 'react';
import CoinLoader from '@/components/CoinLoader';

const BuyTokenFAB = ({ is80sMode = false }) => {
  const coinRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sparkle effect from your Hero component
  useEffect(() => {
    if (typeof window !== "undefined" && !coinRef.current) {
      return;
    }

    const sparkle = coinRef.current;

    const MAX_STARS = 30; // Reduced for performance on mobile
    const STAR_INTERVAL = 32;

    const MAX_STAR_LIFE = 2;
    const MIN_STAR_LIFE = 0.5;

    const MAX_STAR_SIZE = 20;
    const MIN_STAR_SIZE = 10;

    const MIN_STAR_TRAVEL_X = 50;
    const MIN_STAR_TRAVEL_Y = 50;

    const randomLimitedColor = () => {
      const randomHue = (() => {
        if (is80sMode) {
          // 80s mode: neon pink/purple/cyan
          const ranges = [
            { min: 280, max: 320 }, // Magentas/Pinks
            { min: 180, max: 200 }, // Cyans
            { min: 120, max: 140 }, // Greens
          ];
          const range = ranges[Math.floor(Math.random() * ranges.length)];
          return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        } else {
          // Normal mode: blues/violets/yellows
          const ranges = [
            { min: 120, max: 150 }, // Blues
            { min: 270, max: 290 }, // Violets/Purples
            { min: 45, max: 60 }, // Yellows and Golds
          ];
          const range = ranges[Math.floor(Math.random() * ranges.length)];
          return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        }
      })();

      return `hsla(${randomHue}, 100%, 50%, 1)`;
    };

    const Star = class {
      constructor() {
        this.size = this.random(MAX_STAR_SIZE, MIN_STAR_SIZE);

        this.x = this.random(
          sparkle.offsetWidth * 0.75,
          sparkle.offsetWidth * 0.25
        );
        this.y = sparkle.offsetHeight / 2 - this.size / 2;

        this.x_dir = this.randomMinus();
        this.y_dir = this.randomMinus();

        this.x_max_travel =
          this.x_dir === -1 ? this.x : sparkle.offsetWidth - this.x - this.size;
        this.y_max_travel = sparkle.offsetHeight / 2 - this.size;

        this.x_travel_dist = this.random(this.x_max_travel, MIN_STAR_TRAVEL_X);
        this.y_travel_dist = this.random(this.y_max_travel, MIN_STAR_TRAVEL_Y);

        this.x_end = this.x + this.x_travel_dist * this.x_dir;
        this.y_end = this.y + this.y_travel_dist * this.y_dir;

        this.life = this.random(MAX_STAR_LIFE, MIN_STAR_LIFE);

        this.star = document.createElement("div");
        this.star.classList.add("star");

        this.star.style.setProperty("--start-left", this.x + "px");
        this.star.style.setProperty("--start-top", this.y + "px");

        this.star.style.setProperty("--end-left", this.x_end + "px");
        this.star.style.setProperty("--end-top", this.y_end + "px");

        this.star.style.setProperty("--star-life", this.life + "s");
        this.star.style.setProperty("--star-life-num", this.life);

        this.star.style.setProperty("--star-size", this.size + "px");
        this.star.style.setProperty("--star-color", randomLimitedColor());
      }

      draw() {
        sparkle.appendChild(this.star);
      }

      pop() {
        sparkle.removeChild(this.star);
      }

      random(max, min) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      randomMinus() {
        return Math.random() > 0.5 ? 1 : -1;
      }
    };

    let current_star_count = 0;
    const intervalId = setInterval(() => {
      if (current_star_count >= MAX_STARS || !isHovered) {
        return;
      }

      current_star_count++;

      const newStar = new Star();
      newStar.draw();

      setTimeout(() => {
        current_star_count--;
        newStar.pop();
      }, newStar.life * 1000);
    }, STAR_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [isHovered, is80sMode]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? "6rem" : "8rem",
        left: isMobile ? "50%" : "auto",
        right: isMobile ? "auto" : "rem",
        transform: isMobile ? "translateX(-50%)" : "none",
        zIndex: 1200
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            // padding: "8px 16px 8px 8px",
            backgroundColor: isHovered ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(20px)",
            borderRadius: "50px",
            border: "2px solid",
            borderColor: is80sMode ? (isHovered ? "#D946EF" : "rgba(217, 70, 239, 0.5)") : (isHovered ? "#f6f841" : "rgba(246, 248, 65, 0.5)"),
            cursor: "pointer",
            transition: "all 0.3s ease",
            transform: isHovered ? "scale(1.05)" : "scale(1)",
            boxShadow: isHovered ? (is80sMode ? "0 0 20px rgba(217, 70, 239, 0.5)" : "0 0 20px rgba(246, 248, 65, 0.5)") : "none"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ 
              width: "5rem", 
              height: "5rem", 
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              overflow: "hidden",
              backgroundColor: "rgba(0, 0, 0, 0.3)"
            }}>
              <div className="flame-container">
                <div className="red flame"></div>
                <div className="orange flame"></div>
                <div className="yellow flame"></div>
                <div className="white flame"></div>
                <div className="blue circle"></div>
                <div className="black circle"></div>
              </div>
            </div>
            
            <div
              style={{
                color: is80sMode ? "#67e8f9" : "#ffffff",
                fontSize: isMobile ? "12px" : "14px",
                marginLeft: isMobile ? "-1.5rem" : "-1.5rem",
                fontWeight: "700",
                textAlign: "center",
                fontFamily: "'Rajdhani', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "1px",
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translateX(0)" : "translateX(-10px)",
                transition: "all 0.3s ease",
                display: isHovered ? "block" : "none"
              }}
            >
              Light <br/>Candle
            </div>
          </div>
        </div>

      {/* Pulse animation for attention */}
      {/* {!isHovered && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "100%",
            borderRadius: "50px",
            border: "2px solid",
            borderColor: is80sMode ? "#D946EF" : "#f6f841",
            opacity: "0",
            animation: "pulse 2s infinite",
            pointerEvents: "none"
          }}
        />
      )} */}

      {/* Sparkle container */}
      <div 
        ref={coinRef} 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "visible"
        }}
      />

      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.7;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0;
          }
        }
        
        .star {
          position: absolute;
          animation: star-animation var(--star-life) linear;
          pointer-events: none;
          width: var(--star-size);
          height: var(--star-size);
          background: var(--star-color);
          clip-path: polygon(
            50% 0%, 
            61% 35%, 
            98% 35%, 
            68% 57%, 
            79% 91%, 
            50% 70%, 
            21% 91%, 
            32% 57%, 
            2% 35%, 
            39% 35%
          );
        }
        
        @keyframes star-animation {
          0% {
            left: var(--start-left);
            top: var(--start-top);
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          10% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
          90% {
            opacity: 1;
            transform: scale(1) rotate(540deg);
          }
          100% {
            left: var(--end-left);
            top: var(--end-top);
            opacity: 0;
            transform: scale(0) rotate(720deg);
          }
        }

        .flame-container {
          width: 30px;
          height: 30px;
          position: relative;
          transform-origin: center bottom;
          animation-name: flicker;
          animation-duration: 3ms;
          animation-delay: 200ms;
          animation-timing-function: ease-in;
          animation-iteration-count: infinite;
          animation-direction: alternate;
          transform: scale(0.7) translateY(-5px);
        }

        .flame {
          bottom: 0;
          position: absolute;
          border-bottom-right-radius: 50%;
          border-bottom-left-radius: 50%;
          border-top-left-radius: 50%;
          transform: rotate(-45deg) scale(1.5, 1.5);
        }

        .yellow {
          left: 7px;
          width: 15px;
          height: 15px;
          background: gold;
          box-shadow: 0px 0px 9px 4px gold;
        }

        .orange {
          left: 5px;
          width: 20px;
          height: 20px;
          background: orange;
          box-shadow: 0px 0px 9px 4px orange;
        }

        .red {
          left: 2px;
          width: 25px;
          height: 25px;
          background: OrangeRed;
          box-shadow: 0px 0px 5px 4px OrangeRed;
        }

        .white {
          left: 7px;
          bottom: -2px;
          width: 15px;
          height: 15px;
          background: white;
          box-shadow: 0px 0px 9px 4px white;
        }

        .circle {
          border-radius: 50%;
          position: absolute;
        }

        .blue {
          width: 5px;
          height: 5px;
          left: 12px;
          bottom: -12px;
          background: SlateBlue;
          box-shadow: 0px 0px 15px 10px SlateBlue;
        }

        .black {
          width: 20px;
          height: 20px;
          left: 5px;
          bottom: -30px;
          background: black;
          box-shadow: 0px 0px 15px 10px black;
        }

        @keyframes flicker {
          0% { transform: rotate(-1deg) scale(0.8); }
          20% { transform: rotate(1deg) scale(0.8); }
          40% { transform: rotate(-1deg) scale(0.8); }
          60% { transform: rotate(1deg) scaleY(0.83) scaleX(0.8); }
          80% { transform: rotate(-2deg) scaleY(0.74) scaleX(0.8); }
          100% { transform: rotate(1deg) scale(0.8); }
        }
      `}</style>
    </div>
  );
};

export default BuyTokenFAB;