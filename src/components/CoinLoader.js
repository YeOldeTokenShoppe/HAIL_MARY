"use client";

import { useEffect, useState } from 'react';

const CoinLoader = ({ loading = true, onComplete }) => {
  const [isVisible, setIsVisible] = useState(loading);
  const [showInscription, setShowInscription] = useState(false);

  useEffect(() => {
    if (!loading) {
      // Add a small delay before hiding to complete the animation
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onComplete) onComplete();
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [loading, onComplete]);

  // Show inscription after a brief delay to prevent FOUC
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setShowInscription(true);
      }, 150); // Small delay to let CSS load
      
      return () => clearTimeout(timer);
    } else {
      setShowInscription(false);
    }
  }, [loading]);

  if (!isVisible) return null;

  return (
    <div className="coin-loading-screen">
      <div className="pl">
        <div className="pl__coin">
          <div className="pl__coin-flare"></div>
          <div className="pl__coin-flare"></div>
          <div className="pl__coin-flare"></div>
          <div className="pl__coin-flare"></div>
          <div className="pl__coin-layers">
            <div className="pl__coin-layer">
              <div className="pl__coin-inscription">{showInscription ? 'RL80' : ''}</div>
            </div>
            <div className="pl__coin-layer"></div>
            <div className="pl__coin-layer"></div>
            <div className="pl__coin-layer"></div>
            <div className="pl__coin-layer">
              <div className="pl__coin-inscription">{showInscription ? 'RL80' : ''}</div>
            </div>
          </div>
        </div>
        <div className="pl__shadow"></div>
      </div>

      <style jsx>{`

        .coin-loading-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgb(0, 0, 0);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10001;
          opacity: ${loading ? '1' : '0'};
          transition: opacity 0.5s ease-out;
          will-change: opacity;
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
          contain: layout style paint;
          isolation: isolate;
        }

        .pl {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          width: 9.1em;
          height: 9.1em;
          will-change: transform;
          transform: translateZ(0);
        }

        .pl__coin,
        .pl__coin-flare,
        .pl__coin-inscription,
        .pl__coin-layers,
        .pl__shadow {
          animation-duration: 2s;
          animation-timing-function: cubic-bezier(0.37, 0, 0.63, 1);
          animation-iteration-count: infinite;
          animation-delay: 0.1s;
          animation-fill-mode: both;
          will-change: transform;
        }

        .pl__coin {
          animation-name: bounce;
          position: relative;
          transform: translate3d(0, 0.5em, 0);
          z-index: 1;
          will-change: transform;
          backface-visibility: hidden;
        }

        .pl__coin-flare,
        .pl__coin-inscription,
        .pl__coin-layer {
          position: absolute;
        }

        .pl__coin-flare {
          animation-name: flare1;
          background-color: hsl(0, 0%, 100%);
          clip-path: polygon(
            50% 0,
            67% 33%,
            100% 50%,
            67% 67%,
            50% 100%,
            33% 67%,
            0 50%,
            33% 33%
          );
          top: 0;
          left: -0.5em;
          width: 1em;
          height: 1em;
          transform: scale(0);
          z-index: 1;
        }

        .pl__coin-flare:nth-child(2) {
          animation-name: flare2;
          top: -0.5em;
          left: 0;
        }

        .pl__coin-flare:nth-child(3) {
          animation-name: flare3;
          left: 3em;
        }

        .pl__coin-flare:nth-child(4) {
          animation-name: flare4;
          top: -0.5em;
          left: 3.5em;
        }

        .pl__coin-inscription {
          animation-name: inscription-front;
          background-color: #d4af37;
          box-shadow: 0.1875em 0 0 #b8941f inset;
          top: 50%;
          left: 50%;
          width: 3em;
          height: 3em;
          transform: translate(-50%, -50%) rotateZ(30deg);
          font-size: 1em;
          color: #b8941f;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
          font-weight: bold;
        }

        .pl__coin-layer {
          // background-color: #f4e4c1;
                    background-color: #b8941f;
          backface-visibility: hidden;
          border-radius: 50%;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .pl__coin-layer:first-child {
          transform: translate3d(0, 0, 0.5em);
        }

        .pl__coin-layer:nth-child(2) {
          transform: translate3d(0, 0, 0.49em) rotateY(180deg);
        }

        .pl__coin-layer:nth-child(3) {
          backface-visibility: visible;
          border-radius: 0;
          left: 50%;
          width: 0.98em;
          transform: translateX(-50%) rotateY(90deg);
        }

        .pl__coin-layer:nth-child(4) {
          transform: translate3d(0, 0, -0.49em);
        }

        .pl__coin-layer:last-child {
          transform: translate3d(0, 0, -0.5em) rotateY(180deg);
        }

        .pl__coin-layer:nth-child(n + 2):nth-last-child(n + 2) {
          background-color: #d4af37;
          box-shadow: none;
        }

        .pl__coin-layer:last-child .pl__coin-inscription {
          animation-name: inscription-back;
          transform: translate(-50%, -50%) rotateZ(-30deg);
        }

        .pl__coin-layers {
          animation-name: roll;
          position: relative;
          width: 4em;
          height: 4em;
          transform: rotateY(-15deg) rotateZ(-30deg);
          transform-style: preserve-3d;
        }

        .pl__shadow {
          animation-name: shadow;
          background-color: rgba(0, 0, 0, 0.3);
          border-radius: 50%;
          width: 4em;
          height: 0.5em;
        }

        @keyframes bounce {
          from,
          50%,
          to {
            animation-timing-function: cubic-bezier(0.33, 0, 0.67, 0);
            transform: translate3d(0, 0.5em, 0);
          }
          25%,
          75% {
            animation-timing-function: cubic-bezier(0.33, 1, 0.67, 1);
            transform: translate3d(0, 5.1em, 0);
          }
        }

        @keyframes flare1 {
          from,
          75%,
          to {
            animation-timing-function: cubic-bezier(0.33, 0, 0.67, 0);
            transform: scale(0);
          }
          87.5% {
            animation-timing-function: cubic-bezier(0.33, 1, 0.67, 1);
            transform: scale(1);
          }
        }

        @keyframes flare2 {
          from,
          to {
            animation-timing-function: cubic-bezier(0.33, 1, 0.67, 1);
            transform: scale(1);
          }
          12.5%,
          87.5% {
            animation-timing-function: cubic-bezier(0.33, 0, 0.67, 0);
            transform: scale(0);
          }
        }

        @keyframes flare3 {
          from,
          25%,
          50%,
          to {
            animation-timing-function: cubic-bezier(0.33, 0, 0.67, 0);
            transform: scale(0);
          }
          37.5% {
            animation-timing-function: cubic-bezier(0.33, 1, 0.67, 1);
            transform: scale(1);
          }
        }

        @keyframes flare4 {
          from,
          37.5%,
          62.5%,
          to {
            animation-timing-function: cubic-bezier(0.33, 0, 0.67, 0);
            transform: scale(0);
          }
          50% {
            animation-timing-function: cubic-bezier(0.33, 1, 0.67, 1);
            transform: scale(1);
          }
        }

        @keyframes inscription-front {
          from,
          75% {
            animation-timing-function: cubic-bezier(0.12, 0, 0.39, 0);
            box-shadow: 0.1875em 0 0 #b8941f inset;
          }
          87.49% {
            animation-timing-function: steps(1);
            box-shadow: 0.875em -0.75em 0 #b8941f inset;
          }
          87.5% {
            animation-timing-function: cubic-bezier(0.61, 1, 0.88, 1);
            box-shadow: -0.875em 0.75em 0 #b8941f inset;
          }
          to {
            box-shadow: 0.1875em 0 #b8941f inset;
          }
        }

        @keyframes inscription-back {
          from,
          75% {
            box-shadow: -1em -0.875em 0 #b8941f inset;
          }
          to {
            box-shadow: 1.125em 1em 0 #b8941f inset;
          }
        }

        @keyframes roll {
          from,
          75% {
            transform: rotateY(-15deg) rotateZ(-30deg) rotateY(0);
          }
          to {
            transform: rotateY(-15deg) rotateZ(-30deg) rotateY(-1turn);
          }
        }

        @keyframes shadow {
          from,
          50%,
          to {
            animation-timing-function: cubic-bezier(0.33, 0, 0.67, 0);
            background-color: rgba(0, 0, 0, 0.3);
            transform: scale(0.6);
          }
          25%,
          75% {
            animation-timing-function: cubic-bezier(0.33, 1, 0.67, 1);
            background-color: rgba(0, 0, 0, 0.5);
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default CoinLoader;