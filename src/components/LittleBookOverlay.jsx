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
  // Face index currently zoomed, or null when the book is in spread view.
  const [zoomedFaceIdx, setZoomedFaceIdx] = useState(null);
  /* Ref (not state) so the click handler can read the latest scroll
     unit without the component having to re-render on every scroll tick. */
  const scrollUnitRef = useRef(0);

  /* One paper sheet holds two faces (front + back). Round up so an odd
     page count still gets a sheet — its back face renders blank. Floor
     at 1 so the book always has at least one interior sheet. */
  const sheetCount = Math.max(1, Math.ceil(pages.length / 2));

  /* Given the current scroll unit, derive which page faces are showing
     on the left and right. Rounds to the nearest resting spread so a
     tap mid-flip still snaps to the nearest readable pair.
     At scroll unit N (>= 2), left=2N-5, right=2N-4. Returns null if the
     cover is showing or we're past the last content page. */
  const getCurrentSpread = () => {
    const rounded = Math.round(scrollUnitRef.current);
    if (rounded < 2 || rounded > sheetCount + 1) return null;
    const left = 2 * rounded - 5;
    const right = 2 * rounded - 4;
    return {
      left: left >= 0 && left < pages.length ? left : null,
      right: right >= 0 && right < pages.length ? right : null,
    };
  };

  /* Tap on the book: figure out the current spread, use x-position to
     pick left vs right face, open the zoom. stopPropagation so the
     overlay's own "tap to close" doesn't fire. Taps that don't land on
     a readable face (cover view, empty side) bubble up and close. */
  const handleBookTap = (e) => {
    const spread = getCurrentSpread();
    if (!spread) return;
    const spineX = window.innerWidth / 2;
    const face = e.clientX < spineX ? spread.left : spread.right;
    if (face === null) return;
    e.stopPropagation();
    setZoomedFaceIdx(face);
  };

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
      scrollUnitRef.current =
        scroller.scrollTop / (window.innerHeight * 0.25);
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

  // Escape closes zoom first (if open), then the whole book. Also lock
  // page scroll behind the overlay while it's open.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoomedFaceIdx !== null) setZoomedFaceIdx(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, zoomedFaceIdx]);

  // Drop any stale zoom when the book closes.
  useEffect(() => {
    if (!isOpen) setZoomedFaceIdx(null);
  }, [isOpen]);

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

        /* ---------- BOOK GLOW ---------- */
        .lbo-book-glow {
          position: fixed;
          top: 50%;
          left: 50%;
          width: 90vmin;
          height: 70vmin;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            ellipse at center,
            rgba(241, 215, 122, 0.38) 0%,
            rgba(217, 45, 176, 0.22) 30%,
            rgba(42, 214, 238, 0.12) 55%,
            transparent 80%
          );
          filter: blur(24px);
          pointer-events: none;
          /* Book itself has z-index:1, so 0 keeps the glow behind it. */
          z-index: 0;
          animation: lboGlowPulse 4.5s ease-in-out infinite;
        }
        @keyframes lboGlowPulse {
          0%, 100% {
            opacity: 0.85;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.06);
          }
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
          /* Neon edge glow — warm core with a fuchsia halo and a wide
             cyan bloom. Applies to covers and interior sheets alike so
             whatever page is on top reads lit against the backdrop. */
          box-shadow:
            0 0 12px rgba(241, 215, 122, 0.35),
            0 0 28px rgba(217, 45, 176, 0.2),
            0 0 56px rgba(42, 214, 238, 0.1);
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

        /* Give the book a tap affordance on pointer devices without
           breaking scroll-to-flip on touch. */
        .lbo-book { cursor: zoom-in; }

        /* ---------- ZOOM OVERLAY ---------- */
        .lbo-zoom {
          position: fixed;
          inset: 0;
          z-index: 10060;
          background: radial-gradient(
            ellipse at center,
            rgba(10, 6, 20, 0.88) 0%,
            rgba(2, 3, 8, 0.97) 100%
          );
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          cursor: zoom-out;
          animation: lboZoomIn 0.22s ease-out;
        }
        @keyframes lboZoomIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        /* Lock to the same aspect as a book page (~38:52 portrait) so
           assets designed for the book look identical when zoomed — no
           letterboxing, no cropping delta between the two views. The
           browser preserves the ratio while honoring the max-width and
           max-height caps, shrinking whichever dimension hits first. */
        .lbo-zoom__panel {
          position: relative;
          aspect-ratio: 38 / 52;
          max-width: min(92vw, 560px);
          max-height: 85vh;
          width: 100%;
          height: auto;
          background: #f2ecdb;
          border-radius: 8px;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.6),
            0 0 40px rgba(42, 214, 238, 0.2);
          overflow: hidden;
        }
        /* Bump type sizes inside the zoom — book-scale vmin values are
           tiny on phones. Override with absolute units for readability. */
        .lbo-zoom__panel .lbo-face { overflow-y: auto; }
        .lbo-zoom__panel .lbo-face--text { padding: 8% 7%; }
        .lbo-zoom__panel .lbo-face__title {
          font-size: clamp(1.6rem, 5vw, 2.4rem);
          letter-spacing: 3px;
        }
        .lbo-zoom__panel .lbo-face__body {
          font-size: clamp(1rem, 3.5vw, 1.3rem);
          line-height: 1.6;
        }
        .lbo-zoom__panel .lbo-face__footer {
          font-size: clamp(0.85rem, 2.8vw, 1rem);
          margin-top: 0.6em;
        }
        .lbo-zoom__panel .lbo-face__caption {
          font-size: clamp(0.85rem, 2.5vw, 1rem);
          bottom: 1.5rem;
        }
        .lbo-zoom__panel .lbo-page__number { font-size: 0.9rem; }
        /* Panel matches the page aspect, so keep object-fit: cover (the
           base rule) in both views — media crops identically in each. */
        .lbo-zoom__hint {
          position: absolute;
          bottom: 2.5vh;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(214, 250, 255, 0.7);
          font-family: 'Pirata One', serif;
          font-size: 0.9rem;
          letter-spacing: 3px;
          text-transform: uppercase;
          pointer-events: none;
          text-shadow: 0 0 8px rgba(42, 214, 238, 0.4);
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
            {/* Static backlight centered at viewport center. Both the
                closed book (container centered) and the open spread
                (spine at viewport center) share this center point, so a
                single fixed glow reads correctly in both states without
                needing to track the book's GSAP shift. */}
            <div className="lbo-book-glow" aria-hidden="true" />
            <div className="lbo-book" onClick={handleBookTap}>
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

        {zoomedFaceIdx !== null && (
          <div
            className="lbo-zoom"
            onClick={(e) => {
              /* Stop propagation so tapping the zoom doesn't also hit
                 the book overlay's close handler. Tap anywhere on the
                 zoom (backdrop OR panel) closes the zoom only. */
              e.stopPropagation();
              setZoomedFaceIdx(null);
            }}
            role="dialog"
            aria-modal="true"
          >
            <div className="lbo-zoom__panel">
              <PageFace
                entry={pages[zoomedFaceIdx]}
                pageNumber={zoomedFaceIdx + 1}
              />
            </div>
            <div className="lbo-zoom__hint">Tap to return</div>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
