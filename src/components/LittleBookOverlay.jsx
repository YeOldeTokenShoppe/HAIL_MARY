"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { defaultPages, defaultInsideFrontCover } from "./LittleBookPages";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* Candlestick-chart glyph — used on the front cover in place of the
   ornamental ❦. Stroke is currentColor so the cover palette drives its
   hue, and the size is governed by CSS on the parent ornament wrapper. */
const CandlestickOrnament = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 5v4" />
    <rect width="4" height="6" x="7" y="9" rx="1" />
    <path d="M9 15v2" />
    <path d="M17 3v2" />
    <rect width="4" height="8" x="15" y="5" rx="1" />
    <path d="M17 13v3" />
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
  </svg>
);

/**
 * Renders one face of a page based on its entry's `type`. Entry shapes
 * are documented in LittleBookPages.jsx. Receives the face's own page
 * number for the printed corner. Empty entries render a blank paper.
 */
function PageFace({ entry, pageNumber, zoomed = false }) {
  if (!entry) {
    return pageNumber ? (
      <div className="lbo-page__number">{pageNumber}</div>
    ) : null;
  }
  if (entry.type === "text") {
    /* Illuminated-manuscript mode: when the entry includes an `image`
       (and/or a `dropCap`), swap the centered flex layout for a block
       layout with a floated miniature on the left and the body text
       flowing around it. dropCap drops the first glyph of the body
       into a large initial that also floats left. Both features work
       independently or together. */
    const hasImage = !!entry.image;
    const hasVideo = !!entry.video;
    const hasIframe = !!entry.iframe;
    const wantsDropCap = !!entry.dropCap;
    const isIllum = hasImage || hasVideo || hasIframe || wantsDropCap;

    // Derive the drop-cap glyph — explicit string wins, otherwise peel
    // the first character off a string body. Non-string bodies skip it.
    let dropCapChar = null;
    let renderedBody = entry.body;
    if (wantsDropCap) {
      if (typeof entry.dropCap === "string") {
        dropCapChar = entry.dropCap;
      } else if (typeof entry.body === "string" && entry.body.length) {
        dropCapChar = entry.body[0];
        renderedBody = entry.body.slice(1);
      }
    }

    return (
      <div
        className={`lbo-face lbo-face--text${isIllum ? " lbo-face--illum" : ""}`}
      >
        {entry.title && <h3 className="lbo-face__title">{entry.title}</h3>}
        <div className="lbo-face__body">
          {hasIframe ? (
            /* Floated embed — for third-party players that provide an
               iframe URL (e.g. a SitePal / Oddcast avatar). The iframe
               handles its own playback + interaction; object-fit rules
               are ignored on iframes, so the fixed width/aspect-ratio
               on .lbo-face__illum-media defines the box. */
            <iframe
              className="lbo-face__illum-media lbo-face__illum-iframe"
              src={entry.iframe.src}
              title={entry.iframe.title || "Embedded content"}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              frameBorder="0"
            />
          ) : hasVideo ? (
            /* Floated video miniature. In the book view it autoplays
               muted (required for iOS autoplay) and loops silently. In
               zoom it renders with native controls + unmuted so the
               reader can hear it — autoplay with audio may be blocked
               by the browser, but the controls give a one-tap start. */
            <video
              className="lbo-face__illum-media"
              src={entry.video.src}
              poster={entry.video.poster}
              muted={!zoomed}
              loop
              playsInline
              autoPlay
              controls={zoomed}
              preload="metadata"
            />
          ) : hasImage ? (
            <img
              className="lbo-face__illum-media"
              src={entry.image.src}
              alt={entry.image.alt || ""}
            />
          ) : null}
          {dropCapChar && (
            <span className="lbo-face__dropcap">{dropCapChar}</span>
          )}
          {renderedBody}
        </div>
        {entry.footer && (
          <div className="lbo-face__footer">{entry.footer}</div>
        )}
        {pageNumber && (
          <div className="lbo-page__number">{pageNumber}</div>
        )}
      </div>
    );
  }
  if (entry.type === "image") {
    /* fit:'contain' shows the whole image with parchment padding
       around it (no cropping). Default is the usual page-filling cover. */
    const isContain = entry.fit === "contain";
    return (
      <div
        className={`lbo-face lbo-face--media${
          isContain ? " lbo-face--media-contain" : ""
        }`}
      >
        <img
          src={entry.src}
          alt={entry.alt || ""}
          className="lbo-face__media"
        />
        {entry.caption && (
          <div className="lbo-face__caption">{entry.caption}</div>
        )}
        {pageNumber && (
          <div
            className={`lbo-page__number${
              isContain ? "" : " lbo-page__number--light"
            }`}
          >
            {pageNumber}
          </div>
        )}
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
          muted={!zoomed}
          loop
          playsInline
          controls={zoomed}
          autoPlay={zoomed}
          preload="metadata"
        />
        {entry.caption && (
          <div className="lbo-face__caption">{entry.caption}</div>
        )}
        {pageNumber && (
          <div className="lbo-page__number lbo-page__number--light">
            {pageNumber}
          </div>
        )}
      </div>
    );
  }
  return null;
}

/* Fullscreen zoom of a single face. Paging is decoupled from the book's
   flip animation (cheap on mobile): left/right chevrons, arrow keys, and
   horizontal swipe advance the face; closing snaps the book scroller to
   the matching spread so the underlying book is coherent on exit. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.5;
const DOUBLE_TAP_MS = 300;
const SWIPE_PX = 40;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Max offset at a given scale so content can't be panned outside the
   panel. Scaled content extends (s-1)/2 of each dimension beyond the
   panel edges, which is the hard pan limit. */
const clampOffset = (off, scale, panel) => {
  if (!panel || scale <= 1) return { x: 0, y: 0 };
  const rect = panel.getBoundingClientRect();
  const maxX = ((scale - 1) * rect.width) / 2;
  const maxY = ((scale - 1) * rect.height) / 2;
  return {
    x: clamp(off.x, -maxX, maxX),
    y: clamp(off.y, -maxY, maxY),
  };
};

function ZoomLayer({
  zoomedFaceIdx,
  pages,
  insideFrontCover,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
}) {
  const panelRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const lastTapRef = useRef(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);

  /* Reset zoom state whenever the face changes so each new page starts
     at 1x. Also fires on open because zoomedFaceIdx goes null → value. */
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pointersRef.current.clear();
    gestureRef.current = null;
    setGesturing(false);
  }, [zoomedFaceIdx]);

  /* Wheel-to-zoom on desktop. Native listener with passive:false so we
     can preventDefault and suppress page-scroll / browser-zoom. */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setScale((prev) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const next = clamp(prev * factor, ZOOM_MIN, ZOOM_MAX);
        const ratio = next / prev;
        /* Zoom toward the cursor: keep the point under the cursor fixed
           as the scaler grows. */
        setOffset((off) =>
          clampOffset(
            {
              x: cx - ratio * (cx - off.x),
              y: cy - ratio * (cy - off.y),
            },
            next,
            panel,
          ),
        );
        if (next <= 1.001) {
          setOffset({ x: 0, y: 0 });
          return 1;
        }
        return next;
      });
    };
    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e) => {
    panelRef.current?.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const count = pointersRef.current.size;
    if (count === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      gestureRef.current = {
        type: "pinch",
        startDist: dist,
        startScale: scale,
        startOffset: offset,
        startCx: cx,
        startCy: cy,
      };
      setGesturing(true);
    } else if (count === 1) {
      gestureRef.current = {
        type: "drag",
        startX: e.clientX,
        startY: e.clientY,
        startOffset: offset,
        startScale: scale,
      };
      setGesturing(true);
    }
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;
    if (g.type === "pinch" && pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const next = clamp(
        g.startScale * (dist / g.startDist),
        ZOOM_MIN,
        ZOOM_MAX,
      );
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      /* Two-finger pan: translate by the midpoint drift so the content
         tracks the fingers' center while scaling. */
      const panDx = cx - g.startCx;
      const panDy = cy - g.startCy;
      const ratio = next / g.startScale;
      setScale(next);
      setOffset(
        clampOffset(
          {
            x: g.startOffset.x * ratio + panDx,
            y: g.startOffset.y * ratio + panDy,
          },
          next,
          panelRef.current,
        ),
      );
    } else if (g.type === "drag" && pointersRef.current.size === 1) {
      if (g.startScale > 1) {
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        setOffset(
          clampOffset(
            { x: g.startOffset.x + dx, y: g.startOffset.y + dy },
            g.startScale,
            panelRef.current,
          ),
        );
      }
    }
  };

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (pointersRef.current.size === 0) {
      /* Single-finger drag that ended at scale 1: treat as swipe paging
         if it was dominantly horizontal past the threshold. */
      if (g?.type === "drag" && g.startScale <= 1) {
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.3) {
          if (dx < 0) onNext();
          else onPrev();
        } else if (
          e.pointerType === "touch" &&
          Math.abs(dx) < 8 &&
          Math.abs(dy) < 8
        ) {
          /* Tap (not a drag) — manual double-tap. Only for touch; mouse
             dbl-click goes through onDoubleClickMouse. */
          const now = performance.now();
          if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            if (scale > 1) {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            } else {
              const rect = panelRef.current.getBoundingClientRect();
              const cx = e.clientX - rect.left - rect.width / 2;
              const cy = e.clientY - rect.top - rect.height / 2;
              setScale(2);
              setOffset({ x: -cx, y: -cy });
            }
          } else {
            lastTapRef.current = now;
          }
        }
      }
      gestureRef.current = null;
      setGesturing(false);
      /* Snap back to centered if scale fell to 1 via pinch-out. */
      if (scale <= 1.001) {
        setOffset({ x: 0, y: 0 });
      }
    } else if (pointersRef.current.size === 1 && g?.type === "pinch") {
      /* Pinch released to one finger — continue as pan-drag. */
      const [remaining] = pointersRef.current.values();
      gestureRef.current = {
        type: "drag",
        startX: remaining.x,
        startY: remaining.y,
        startOffset: offset,
        startScale: scale,
      };
    }
  };

  const onDoubleClickMouse = (e) => {
    e.stopPropagation();
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      const rect = panelRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setScale(2);
      setOffset({ x: -cx, y: -cy });
    }
  };

  let content;
  if (zoomedFaceIdx === -1) {
    content = (
      <div className="lbo-cover-content">
        <div className="lbo-cover-eyebrow">Liber Parvus</div>
        <h2 className="lbo-cover-title">
          The Book
          <br />
          of RL80
        </h2>
        <div className="lbo-cover-ornament">
          <CandlestickOrnament />
        </div>
      </div>
    );
  } else if (zoomedFaceIdx === -2) {
    content = <PageFace entry={insideFrontCover} zoomed />;
  } else {
    content = (
      <PageFace
        entry={pages[zoomedFaceIdx]}
        pageNumber={zoomedFaceIdx + 1}
        zoomed
      />
    );
  }

  return (
    <div
      className="lbo-zoom"
      onClick={(e) => {
        /* Backdrop-only close: tapping the panel or a nav button does
           nothing here because those children stopPropagation. */
        if (e.target !== e.currentTarget) return;
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      {hasPrev && (
        <button
          type="button"
          className="lbo-zoom__nav lbo-zoom__nav--prev"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous page"
        >
          ‹
        </button>
      )}
      <div
        ref={panelRef}
        className={`lbo-zoom__panel${
          zoomedFaceIdx === -1 ? " lbo-zoom__panel--cover" : ""
        }${scale > 1 ? " lbo-zoom__panel--scaled" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClickMouse}
      >
        <div
          className="lbo-zoom__scaler"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: gesturing ? "none" : "transform 0.22s ease-out",
          }}
        >
          {content}
        </div>
      </div>
      {hasNext && (
        <button
          type="button"
          className="lbo-zoom__nav lbo-zoom__nav--next"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next page"
        >
          ›
        </button>
      )}
      <button
        type="button"
        className="lbo-zoom__close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close zoom"
      >
        ×
      </button>
      <div className="lbo-zoom__hint">
        {scale > 1
          ? "Drag to pan · double-tap to reset"
          : "Pinch / double-tap to zoom · ← → to page"}
      </div>
    </div>
  );
}

export default function LittleBookOverlay({
  isOpen,
  onClose,
  pages = defaultPages,
  /* Entry rendered on the inside of the front cover — the left-hand
     page the reader sees the moment the cover flips open. Uses the
     same entry schema as `pages`. Pass null to leave it blank (the
     default parchment insert). */
  insideFrontCover = defaultInsideFrontCover,
}) {
  const scrollerRef = useRef(null);
  const bookRef = useRef(null);
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

  /* Zoom paging order: -1 (cover) → -2 (inside cover, if any) → 0 → 1 → …
     → pages.length-1. Returns the neighbor or null at the edges, which
     hides the corresponding nav affordance. */
  const nextZoomIdx = (cur) => {
    if (cur === -1) return insideFrontCover ? -2 : pages.length ? 0 : null;
    if (cur === -2) return pages.length ? 0 : null;
    if (cur >= 0 && cur < pages.length - 1) return cur + 1;
    return null;
  };
  const prevZoomIdx = (cur) => {
    if (cur === -1) return null;
    if (cur === -2) return -1;
    if (cur === 0) return insideFrontCover ? -2 : -1;
    if (cur > 0) return cur - 1;
    return null;
  };

  /* Spread the book should be parked on when zoom closes, so exiting
     zoom snaps the underlying page-turn state to match the face the
     reader was last looking at. Mirrors the inverse of getCurrentSpread. */
  const zoomIdxToScrollUnit = (idx) => {
    if (idx === -1) return 0; // cover, book closed
    if (idx === -2) return 2; // inside cover | pages[0]
    if (idx >= 0) return Math.floor((idx + 1) / 2) + 2;
    return null;
  };

  const closeZoom = () => {
    setZoomedFaceIdx((cur) => {
      if (cur === null) return null;
      const scroller = scrollerRef.current;
      const unit = zoomIdxToScrollUnit(cur);
      if (scroller && unit !== null) {
        const target = unit * window.innerHeight * 0.25;
        scroller.scrollTop = target;
        scrollUnitRef.current = unit;
      }
      return null;
    });
  };

  const pageZoom = (dir) => {
    setZoomedFaceIdx((cur) => {
      if (cur === null) return cur;
      const nxt = dir > 0 ? nextZoomIdx(cur) : prevZoomIdx(cur);
      return nxt === null ? cur : nxt;
    });
  };

  /* Given the current scroll unit, derive which page faces are showing
     on the left and right. Rounds to the nearest resting spread so a
     tap mid-flip still snaps to the nearest readable pair.
     At scroll unit N (>= 2), left=2N-5, right=2N-4. Returns null if the
     cover is showing or we're past the last content page. */
  const getCurrentSpread = () => {
    const rounded = Math.round(scrollUnitRef.current);
    if (rounded < 2 || rounded > sheetCount + 2) return null;
    const left = 2 * rounded - 5;
    const right = 2 * rounded - 4;
    return {
      left: left >= 0 && left < pages.length ? left : null,
      right: right >= 0 && right < pages.length ? right : null,
    };
  };

  /* Tap on the book:
     - In cover view (scroll unit < 2): zoom the front cover itself,
       using -1 as a sentinel so the zoom render knows to paint the
       cover instead of a PageFace.
     - In a readable spread: pick left vs right face by x-position and
       zoom that face.
     - Otherwise (past the last content page): let the tap bubble up
       to the overlay and close the book, consistent with "tap empty
       space to dismiss".
     stopPropagation for the zoom cases so the overlay's own
     "tap to close" doesn't also fire. */
  const handleBookTap = (e) => {
    const rounded = Math.round(scrollUnitRef.current);
    if (rounded < 2) {
      e.stopPropagation();
      setZoomedFaceIdx(-1);
      return;
    }
    const spread = getCurrentSpread();
    if (!spread) return;
    const spineX = window.innerWidth / 2;
    /* On the first spread, the left page IS the inside of the front
       cover — route taps there to the insideFrontCover zoom instead of
       the non-existent "face -1" that the spread math would yield. */
    if (rounded === 2 && e.clientX < spineX && insideFrontCover) {
      e.stopPropagation();
      setZoomedFaceIdx(-2);
      return;
    }
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
      // onToggle fires only on transitions, so reconcile the initial
      // state manually: play in-range videos, and pause any that the
      // `autoPlay` attribute may have kicked off while out of range.
      if (trigger.isActive) video.play().catch(() => {});
      else video.pause();
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
      if (e.key === "Escape") {
        if (zoomedFaceIdx !== null) closeZoom();
        else onClose();
        return;
      }
      if (zoomedFaceIdx === null) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        pageZoom(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        pageZoom(-1);
      }
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

  /* Forward wheel + touch drags on the book itself into the scroller.
     Native propagation from a position:fixed descendant to an ancestor
     scroll container is unreliable (especially iOS Safari), so this
     makes "scroll anywhere, even on the book, to turn pages" actually
     work. `passive:false` is required so `preventDefault` can suppress
     the browser's default handling while we drive the scroll ourselves. */
  useEffect(() => {
    if (!isOpen) return;
    const book = bookRef.current;
    const scroller = scrollerRef.current;
    if (!book || !scroller) return;

    let lastTouchY = null;

    const onWheel = (e) => {
      e.preventDefault();
      scroller.scrollTop += e.deltaY;
    };
    const onTouchStart = (e) => {
      lastTouchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (lastTouchY == null) return;
      const y = e.touches[0].clientY;
      scroller.scrollTop += lastTouchY - y;
      lastTouchY = y;
      e.preventDefault();
    };
    const onTouchEnd = () => {
      lastTouchY = null;
    };

    book.addEventListener("wheel", onWheel, { passive: false });
    book.addEventListener("touchstart", onTouchStart, { passive: true });
    book.addEventListener("touchmove", onTouchMove, { passive: false });
    book.addEventListener("touchend", onTouchEnd);
    book.addEventListener("touchcancel", onTouchEnd);

    return () => {
      book.removeEventListener("wheel", onWheel);
      book.removeEventListener("touchstart", onTouchStart);
      book.removeEventListener("touchmove", onTouchMove);
      book.removeEventListener("touchend", onTouchEnd);
      book.removeEventListener("touchcancel", onTouchEnd);
    };
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
          height: calc(${sheetCount + 6} * 25vh);
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
        /* When the insert carries a rendered PageFace (inside front
           cover), clip overflow so long bodies don't bleed outside the
           parchment shape, and match the interior parchment tone. */
        .lbo-book__insert--page {
          overflow: hidden;
          background: #f2ecdb;
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

        /* ---------- ILLUMINATED MANUSCRIPT MODE ---------- */
        /* Opt out of the centered flex layout so floats flow inside the
           body block. Title stays centered above; body is justified to
           mimic a manuscript column. */
        .lbo-face--illum {
          display: block;
          padding: 9% 8%;
          text-align: left;
        }
        .lbo-face--illum .lbo-face__title {
          text-align: center;
          margin-bottom: 0.6em;
        }
        .lbo-face--illum .lbo-face__body {
          text-align: justify;
          hyphens: auto;
          -webkit-hyphens: auto;
        }
        /* Self-clearing body so the floats don't bleed past the footer. */
        .lbo-face--illum .lbo-face__body::after {
          content: "";
          display: block;
          clear: both;
        }
        .lbo-face__illum-media {
          float: left;
          width: 46%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          margin: 0.15em 0.9em 0.4em 0;
          border-radius: 3px;
          border: 1.5px solid rgba(160, 120, 60, 0.55);
          box-shadow:
            0 2px 6px rgba(60, 40, 20, 0.35),
            0 0 0 3px rgba(241, 215, 122, 0.15);
          /* Let the justified text nestle closer to the illumination. */
          shape-outside: inset(0);
          display: block;
          background: #0a0610;
        }
        /* iframes ignore object-fit and come with a UA border in some
           browsers; make the box behave like the img/video siblings. */
        .lbo-face__illum-iframe {
          background: transparent;
        }
        /* Drop cap — large crimson initial in the manuscript tradition.
           Floats alongside the illumination when both are present; when
           the image is alone the cap is simply skipped. */
        .lbo-face__dropcap {
          float: left;
          font-family: 'Pirata One', 'IBM Plex Serif', serif;
          font-size: 3.4em;
          line-height: 0.82;
          padding: 0.05em 0.08em 0 0;
          margin: 0;
          color: #8b2626;
          text-shadow:
            0 0 6px rgba(241, 215, 122, 0.35),
            1px 1px 0 rgba(0, 0, 0, 0.08);
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
        /* fit:contain variant — show the whole image inside a parchment
           frame with a soft margin. No cropping; letterboxed areas pick
           up the same paper tone as interior sheets. */
        .lbo-face--media-contain {
          background: #f2ecdb;
          padding: 8%;
          box-sizing: border-box;
        }
        .lbo-face--media-contain .lbo-face__media {
          object-fit: contain;
          width: 100%;
          height: 100%;
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
           breaking scroll-to-flip on touch. touch-action: pan-y lets
           the browser natively forward vertical drag gestures on the
           book up to the scroller; the JS forwarder in the component
           is a belt-and-suspenders backup for when native propagation
           fails (iOS position:fixed inside -webkit-overflow-scrolling). */
        .lbo-book {
          cursor: zoom-in;
          touch-action: pan-y;
        }

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
          cursor: default;
          /* Suppress native pinch/pan so our pointer-event handlers own
             the gesture — iOS would otherwise eat two-finger touches for
             browser-level zoom. */
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
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

        /* Transform target for pinch/wheel zoom. Wraps the face content
           so scaling doesn't fight the panel's aspect-ratio sizing.
           No will-change: on iOS permanent layer promotion at high
           scale triggers large composite-layer textures that can OOM
           the tab — let Safari composite on demand instead. */
        .lbo-zoom__scaler {
          width: 100%;
          height: 100%;
          transform-origin: 50% 50%;
        }
        .lbo-zoom__panel--scaled { cursor: grab; }
        .lbo-zoom__panel--scaled:active { cursor: grabbing; }

        /* Cover-zoom variant: match the book's leather gradient instead
           of the parchment, and scale the ornamental type up so the
           title reads at arm's length. */
        .lbo-zoom__panel--cover {
          background: linear-gradient(145deg, #5a2e38, #2a121c);
        }
        .lbo-zoom__panel--cover .lbo-cover-eyebrow {
          font-size: clamp(1rem, 3vw, 1.4rem);
        }
        .lbo-zoom__panel--cover .lbo-cover-title {
          font-size: clamp(2rem, 7vw, 3.2rem);
        }
        .lbo-zoom__panel--cover .lbo-cover-ornament svg {
          width: clamp(2.4rem, 6vw, 3.2rem);
          height: clamp(2.4rem, 6vw, 3.2rem);
          min-width: 0;
          min-height: 0;
        }
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

        /* Chevron paging buttons flanking the panel. Positioned relative
           to the viewport so they sit at the screen edges on mobile
           (overlapping the panel margins) and just outside the panel on
           desktop. Large hit targets for thumbs. */
        .lbo-zoom__nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 3rem;
          height: 3rem;
          border: 1px solid rgba(214, 250, 255, 0.2);
          border-radius: 50%;
          background: rgba(10, 6, 20, 0.8);
          color: rgba(214, 250, 255, 0.85);
          font-family: 'Pirata One', serif;
          font-size: 2rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          padding: 0;
          transition: background 0.2s ease, color 0.2s ease,
            transform 0.2s ease;
        }
        .lbo-zoom__nav:hover {
          background: rgba(42, 214, 238, 0.2);
          color: #fff;
          transform: translateY(-50%) scale(1.05);
        }
        .lbo-zoom__nav--prev { left: max(2vw, 0.5rem); }
        .lbo-zoom__nav--next { right: max(2vw, 0.5rem); }

        .lbo-zoom__close {
          position: absolute;
          top: max(2vh, 0.75rem);
          right: max(2vw, 0.75rem);
          width: 2.5rem;
          height: 2.5rem;
          border: 1px solid rgba(214, 250, 255, 0.2);
          border-radius: 50%;
          background: rgba(10, 6, 20, 0.8);
          color: rgba(214, 250, 255, 0.85);
          font-family: 'Pirata One', serif;
          font-size: 1.6rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          padding: 0;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .lbo-zoom__close:hover {
          background: rgba(242, 100, 100, 0.25);
          color: #fff;
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
          color: rgba(217, 45, 176, 0.85);
          /* drop-shadow follows the SVG's alpha, so the glow traces the
             candlestick glyph's strokes instead of a rectangular halo. */
          filter: drop-shadow(0 0 12px rgba(217, 45, 176, 0.55));
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .lbo-cover-ornament svg {
          width: 5.2vmin;
          height: 5.2vmin;
          min-width: 28px;
          min-height: 28px;
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
            <div
              className="lbo-book"
              ref={bookRef}
              onClick={handleBookTap}
              style={{
                /* Hide the book while zoom is active. It's fully
                   obscured by the zoom backdrop anyway, and collapsing
                   its composite layers here frees GPU texture memory
                   so the zoomed scaler has room to breathe on iOS. */
                visibility: zoomedFaceIdx !== null ? "hidden" : "visible",
              }}
            >
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
                      The Book
                      <br />
                      of RL80
                    </h2>
                    <div className="lbo-cover-ornament">
                    <CandlestickOrnament />
                  </div>
                  </div>
                </div>
                <div
                  className="lbo-page__half lbo-page__half--back"
                  data-lbo-face="inside-front"
                >
                  <div className="lbo-book__insert lbo-book__insert--page">
                    {insideFrontCover ? (
                      <PageFace entry={insideFrontCover} />
                    ) : null}
                  </div>
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
          <ZoomLayer
            zoomedFaceIdx={zoomedFaceIdx}
            pages={pages}
            insideFrontCover={insideFrontCover}
            hasPrev={prevZoomIdx(zoomedFaceIdx) !== null}
            hasNext={nextZoomIdx(zoomedFaceIdx) !== null}
            onClose={closeZoom}
            onPrev={() => pageZoom(-1)}
            onNext={() => pageZoom(1)}
          />
        )}
      </div>
    </>,
    document.body,
  );
}
