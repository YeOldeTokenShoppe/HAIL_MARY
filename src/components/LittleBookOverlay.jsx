"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { defaultPages } from "./LittleBookPages";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Renders one face of a page based on its entry's `type`. Entry shapes
 * are documented in LittleBookPages.jsx. Receives the face's own page
 * number for the printed corner. Empty entries render a blank paper.
 */
function PageFace({ entry, pageNumber }) {
  if (!entry) {
    return <div className="lbo-page__number">{pageNumber}</div>;
  }
  if (entry.type === "text") {
    return (
      <div className="lbo-face lbo-face--text">
        {entry.title && <h3 className="lbo-face__title">{entry.title}</h3>}
        <div className="lbo-face__body">{entry.body}</div>
        {entry.footer && (
          <div className="lbo-face__footer">{entry.footer}</div>
        )}
        <div className="lbo-page__number">{pageNumber}</div>
      </div>
    );
  }
  if (entry.type === "image") {
    return (
      <div className="lbo-face lbo-face--media">
        <img
          src={entry.src}
          alt={entry.alt || ""}
          className="lbo-face__media"
        />
        {entry.caption && (
          <div className="lbo-face__caption">{entry.caption}</div>
        )}
        <div className="lbo-page__number lbo-page__number--light">
          {pageNumber}
        </div>
      </div>
    );
  }
  if (entry.type === "video") {
    return (
      <div className="lbo-face lbo-face--media">
        {/* muted + playsInline are required for iOS autoplay. Don't set
            the autoPlay attribute — the overlay's ScrollTrigger starts
            playback only when the sheet enters its active range. */}
        <video
          src={entry.src}
          poster={entry.poster}
          className="lbo-face__media"
          muted
          loop
          playsInline
          preload="metadata"
        />
        {entry.caption && (
          <div className="lbo-face__caption">{entry.caption}</div>
        )}
        <div className="lbo-page__number lbo-page__number--light">
          {pageNumber}
        </div>
      </div>
    );
  }
  return null;
}

export default function LittleBookOverlay({
  isOpen,
  onClose,
  pages = defaultPages,
}) {
  const scrollerRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  /* One paper sheet holds two faces (front + back). Round up so an odd
     page count still gets a sheet — its back face renders blank. Floor
     at 1 so the book always has at least one interior sheet. */
  const sheetCount = Math.max(1, Math.ceil(pages.length / 2));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wire ScrollTrigger to the overlay's own scroll container so the book
  // flips in response to scrolling inside the overlay (the underlying page
  // is scroll-locked while the overlay is open).
  useEffect(() => {
    if (!isOpen || !scrollerRef.current) return;

    const scroller = scrollerRef.current;
    scroller.scrollTop = 0;
    setHintVisible(true);

    const onScroll = () => {
      if (scroller.scrollTop > 5) setHintVisible(false);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });

    const triggers = [];
    const add = (tween) => {
      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
    };

    add(
      gsap.to(".lbo-book", {
        scrollTrigger: {
          scroller,
          scrub: 1,
          start: () => 0,
          end: () => window.innerHeight * 0.25,
        },
        scale: 1,
      }),
    );

    /* Shift the book right as the first page opens so the spine ends up
       at viewport center — keeps the closed book centered, but reveals
       both pages once they start flipping. xPercent goes from -50 (from
       the base translate(-50%, …)) to 0, a rightward shift of half the
       book's own width. */
    add(
      gsap.to(".lbo-book", {
        scrollTrigger: {
          scroller,
          scrub: 1,
          start: () => 1 * (window.innerHeight * 0.25),
          end: () => 2 * (window.innerHeight * 0.25),
        },
        xPercent: 0,
      }),
    );

    const pageEls = scroller.querySelectorAll(".lbo-book__page");
    pageEls.forEach((page, index) => {
      gsap.set(page, { z: index === 0 ? 13 : -index * 1 });
      if (index === pageEls.length - 1) return;

      add(
        gsap.to(page, {
          rotateY: `-=${180 - index / 2}`,
          scrollTrigger: {
            scroller,
            scrub: 1,
            start: () => (index + 1) * (window.innerHeight * 0.25),
            end: () => (index + 2) * (window.innerHeight * 0.25),
          },
        }),
      );

      add(
        gsap.to(page, {
          z: index === 0 ? -13 : index,
          scrollTrigger: {
            scroller,
            scrub: 1,
            start: () => (index + 1) * (window.innerHeight * 0.25),
            end: () => (index + 1.5) * (window.innerHeight * 0.25),
          },
        }),
      );
    });

    /* Autoplay each video only while its sheet's flip is near the active
       scroll range. Keeps all other videos paused so the browser isn't
       decoding N streams at once. The range is ±1 flip unit around the
       sheet's own flip, so the video is already playing as its page
       starts to turn and stops a unit after it settles. */
    scroller.querySelectorAll("video").forEach((video) => {
      const faceEl = video.closest("[data-lbo-face]");
      if (!faceEl) return;
      const faceIdx = parseInt(faceEl.dataset.lboFace, 10);
      const sheetIdx = Math.floor(faceIdx / 2);
      const trigger = ScrollTrigger.create({
        scroller,
        start: () =>
          Math.max(0, sheetIdx * window.innerHeight * 0.25),
        end: () => (sheetIdx + 3) * window.innerHeight * 0.25,
        onToggle: (self) => {
          if (self.isActive) video.play().catch(() => {});
          else video.pause();
        },
      });
      // onToggle fires only on transitions, so kick off playback for any
      // video that is already in range at mount time.
      if (trigger.isActive) video.play().catch(() => {});
      triggers.push(trigger);
    });

    ScrollTrigger.refresh();

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      triggers.forEach((t) => t?.kill());
    };
  }, [isOpen, pages]);

  // Escape to close + lock page scroll behind the overlay.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const interior = [];
  for (let s = 0; s < sheetCount; s++) {
    const frontIdx = s * 2;
    const backIdx = s * 2 + 1;
    interior.push(
      <div
        key={s}
        className="lbo-book__page"
        style={{ "--page-index": s + 2 }}
      >
        <div
          className="lbo-page__half lbo-page__half--front"
          data-lbo-face={frontIdx}
        >
          <PageFace entry={pages[frontIdx]} pageNumber={frontIdx + 1} />
        </div>
        <div
          className="lbo-page__half lbo-page__half--back"
          data-lbo-face={backIdx}
        >
          <PageFace entry={pages[backIdx]} pageNumber={backIdx + 1} />
        </div>
      </div>,
    );
  }

  return createPortal(
    <>
      <style>{`
        .lbo-overlay {
          position: fixed;
          inset: 0;
          z-index: 10050;
          background: radial-gradient(
            ellipse at center,
            rgba(10, 6, 20, 0.55) 0%,
            rgba(2, 3, 8, 0.85) 100%
          );
          font-family: 'Pirata One', 'IBM Plex Serif', serif;
        }

        /* The scroll-driver. Covers the viewport and drives ScrollTrigger. */
        .lbo-scroller {
          position: absolute;
          inset: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .lbo-scroller::-webkit-scrollbar { display: none; }

        /* Invisible spacer gives the scroller a range proportional to the
           page count, matching the original's body height trick. */
        .lbo-spacer {
          width: 100%;
          height: calc(${sheetCount + 2} * 25vh);
          position: relative;
        }

        .lbo-hint {
          position: fixed;
          bottom: calc(22% + env(safe-area-inset-bottom, 0px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
          color: rgba(214, 250, 255, 0.8);
          font-family: 'Pirata One', serif;
          font-size: 1rem;
          text-align: center;
          // letter-spacing: 3px;
          text-transform: uppercase;
          pointer-events: none;
          text-shadow:
            0 0 10px rgba(42, 214, 238, 0.5),
            0 0 22px rgba(217, 45, 176, 0.25);
          animation: lboHintPulse 2.2s ease-in-out infinite;
        }
        @keyframes lboHintPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .lbo-hint--hidden {
          animation: none;
          opacity: 0;
          transition: opacity 0.6s ease;
        }

        /* ---------- BOOK ---------- */
        .lbo-book {
          height: 52vmin;
          width: 38vmin;
          min-width: 220px;
          min-height: 300px;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.8);
          transform-style: preserve-3d;
          perspective: 1400px;
          z-index: 1;
        }

        .lbo-book__spine {
          height: 100%;
          left: 0;
          top: 0;
          position: absolute;
          background: #1a0a10;
          transform-origin: 0 50%;
          width: 12px;
          transform: translate3d(0, 0, -13px);
          box-shadow: 0 0 18px rgba(0, 0, 0, 0.7);
        }

        .lbo-book__page {
          position: absolute;
          left: 2%;
          top: 50%;
          border-radius: 0 5% 5% 0;
          transform: translate(0, -50%);
          height: 94%;
          width: 94%;
          z-index: calc((${sheetCount + 2} - var(--page-index)) * 2);
          transform-origin: 0% 50%;
          transform-style: preserve-3d;
        }

        .lbo-book__cover {
          border-radius: 0 5% 5% 0;
          height: 100%;
          width: 100%;
          position: absolute;
          top: 50%;
          left: 0;
          background: linear-gradient(145deg, #5a2e38, #2a121c);
          transform-origin: 0 50%;
        }
        .lbo-book__cover--front .lbo-page__half--back {
          border-right: 1rem solid #1a0a10;
        }
        .lbo-book__cover--back { transform-origin: 0% 50%; }
        .lbo-book__cover--back .lbo-page__half--front {
          border-left: 1rem solid #1a0a10;
        }
        .lbo-book__cover--back .lbo-book__insert {
          left: 0;
          border-radius: 0 5% 5% 0;
        }

        .lbo-book__insert {
          position: absolute;
          height: 94%;
          width: 94%;
          background: #ebe2cd;
          top: 50%;
          right: -1rem;
          transform: translate(0, -50%);
          border-radius: 5% 0 0 5%;
        }

        .lbo-page__half {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          transform: rotateY(calc(var(--rotation, 0) * 1deg))
            translate3d(0, 0, calc((0.5 * var(--coefficient, 0)) * 1px));
          clip-path: inset(0 0.5% 0 0.5%);
          -webkit-clip-path: inset(0 0.5% 0 0.5%);
        }
        .lbo-page__half--front {
          --rotation: 0;
          --coefficient: 0;
          backface-visibility: hidden;
          border-radius: 0 5% 5% 0;
        }
        .lbo-page__half--back {
          --rotation: 180;
          --coefficient: 2;
          border-radius: 5% 0 0 5%;
        }
        .lbo-book__page:not(.lbo-book__cover) .lbo-page__half {
          background: #f2ecdb;
        }

        .lbo-page__number {
          position: absolute;
          color: rgba(80, 60, 40, 0.55);
          bottom: 1rem;
          font-size: 1.4vmin;
          font-family: 'Pirata One', serif;
          letter-spacing: 1px;
        }
        .lbo-page__half--front .lbo-page__number { right: 1rem; }
        .lbo-page__half--back .lbo-page__number { left: 1rem; }
        /* Light variant reads against dark image/video backgrounds. */
        .lbo-page__number--light {
          color: rgba(241, 215, 122, 0.85);
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }

        /* ---------- PAGE FACES ---------- */
        .lbo-face {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          position: relative;
          font-family: 'Pirata One', 'IBM Plex Serif', serif;
          color: rgba(60, 40, 30, 0.82);
          overflow: hidden;
        }
        .lbo-face--text {
          padding: 10% 10%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 0.7em;
          text-align: center;
        }
        .lbo-face__title {
          margin: 0;
          font-size: 2.6vmin;
          font-weight: 400;
          letter-spacing: 2px;
          color: #5a2530;
          text-transform: uppercase;
        }
        .lbo-face__body {
          font-size: 1.9vmin;
          line-height: 1.55;
          color: rgba(60, 40, 30, 0.82);
          max-width: 100%;
        }
        .lbo-face__footer {
          font-size: 1.5vmin;
          font-style: italic;
          color: rgba(100, 70, 50, 0.6);
          margin-top: 0.4em;
        }
        .lbo-face--media {
          padding: 0;
          background: #0a0610;
        }
        .lbo-face__media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .lbo-face__caption {
          position: absolute;
          bottom: 1.2rem;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 1.5vmin;
          letter-spacing: 1.5px;
          color: #f1d77a;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
          padding: 0 1rem;
        }

        /* ---------- COVER FACE ---------- */
        .lbo-cover-content {
          text-align: center;
          padding: 8%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 1.2em;
          height: 100%;
          width: 100%;
        }
        .lbo-cover-eyebrow {
          font-family: 'Pirata One', serif;
          font-size: 2vmin;
          letter-spacing: 5px;
          text-transform: uppercase;
          color: rgba(42, 214, 238, 0.85);
          text-shadow: 0 0 10px rgba(42, 214, 238, 0.55);
        }
        .lbo-cover-title {
          margin: 0;
          font-family: 'Pirata One', 'IBM Plex Serif', serif;
          font-size: 5vmin;
          font-weight: 400;
          letter-spacing: 2px;
          line-height: 1.1;
          color: #f1d77a;
          text-shadow:
            0 0 14px rgba(241, 215, 122, 0.55),
            0 0 32px rgba(217, 45, 176, 0.35);
        }
        .lbo-cover-ornament {
          font-size: 4.5vmin;
          color: rgba(217, 45, 176, 0.85);
          text-shadow: 0 0 12px rgba(217, 45, 176, 0.55);
        }

        .lbo-book__colophon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: 'Pirata One', serif;
          font-size: 2vmin;
          color: rgba(80, 60, 40, 0.55);
          letter-spacing: 4px;
          text-transform: uppercase;
        }
      `}</style>

      {/* Browsers suppress the click event after a meaningful touch scroll,
          so tapping anywhere fires onClose while scrolling to flip pages
          does not. Escape still closes for keyboard users. */}
      <div className="lbo-overlay" onClick={onClose}>
        <div className={`lbo-hint ${hintVisible ? "" : "lbo-hint--hidden"}`}>
          Scroll to turn the pages · tap to close
        </div>

        <div className="lbo-scroller" ref={scrollerRef}>
          <div className="lbo-spacer">
            <div className="lbo-book">
              <div className="lbo-book__spine" />

              {/* Front cover */}
              <div
                className="lbo-book__page lbo-book__cover lbo-book__cover--front"
                style={{ "--page-index": 1 }}
              >
                <div className="lbo-page__half lbo-page__half--front">
                  <div className="lbo-cover-content">
                    <div className="lbo-cover-eyebrow">Liber Parvus</div>
                    <h2 className="lbo-cover-title">
                      The Little Book
                      <br />
                      of RL80
                    </h2>
                    <div className="lbo-cover-ornament">❦</div>
                  </div>
                </div>
                <div className="lbo-page__half lbo-page__half--back">
                  <div className="lbo-book__insert" />
                </div>
              </div>

              {interior}

              {/* Back cover */}
              <div
                className="lbo-book__page lbo-book__cover lbo-book__cover--back"
                style={{ "--page-index": sheetCount + 2 }}
              >
                <div className="lbo-page__half lbo-page__half--front" />
                <div className="lbo-page__half lbo-page__half--back">
                  <div className="lbo-book__insert">
                    <div className="lbo-book__colophon">Finis.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
