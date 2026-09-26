"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useCyberConfirm from "./useCyberConfirm";

/**
 * RadialNavMenu — a button that blooms into a dark disk with four
 * destinations round the rim (adapted from a CodePen expanding
 * circle menu). Used on /fountain instead of MobileBottomNav so the scene
 * keeps its whole bottom edge, and on /hailmary off the header brand mark.
 *
 * Differences from the original pen:
 *  - a mouse opens it on hover like the pen, but touch/pen/keyboard get a
 *    tap toggle (:hover is sticky on touch — the first tap would open it
 *    and nothing would ever close it);
 *  - Escape and a tap anywhere outside close it;
 *  - inline SVG icons instead of Font Awesome (not a dependency here);
 *  - destinations go through useCyberConfirm, like every other nav dock;
 *  - a telescope instead of a "+" ("+" reads as add/create, not navigate);
 *  - discoverability: the disk opens once on a first visit to show what
 *    the button does (remembered in localStorage).
 *
 * Two ways to mount it:
 *  - corner mode (default): its own fixed telescope button.
 *    corner: "bottom-left" (desktop) | "top-right" (phones, where the thumb
 *    and the eye both go to the top-right for a menu).
 *  - anchored mode (`trigger` given): wraps an existing element (e.g. a
 *    header logo) as the button, and the disk blooms out of it below. The
 *    disk is portalled to <body> — headers here use backdrop-filter, which
 *    would otherwise become the containing block for its position:fixed.
 *
 * actions: extra non-navigation items ({ key, label, icon, onSelect }) that
 * join the ring after the destinations and run directly, no confirm —
 * /hailmary puts How to play + Account here once its header had no room.
 *
 * Controlled mode (`open` given, no trigger): another component owns
 * the button (e.g. MobileBottomNav's MORE slot on /home), so the page passes
 * that element plus `open` / `onRequestClose` and only the disk renders.
 *
 * current: the key of the page it's mounted on — that slot becomes Home,
 * since a menu that links to where you already are is a wasted quarter.
 * demoKey: localStorage flag for the one-time first-visit demo, per page.
 */

// Sizes: ITEM and HUB clear the 44px minimum touch target.
const DISK = 168;
const ITEM = 44;
const INSET = 6; // item gap from the disk rim
const HUB = 48;
const EDGE = 8; // min gap between the open disk and the viewport edge
const RING = DISK / 2 - INSET - ITEM / 2; // item-centre radius

// Items spaced evenly round the rim, clockwise from 12 o'clock — four land
// on the compass points like the pen; six still clear 44px each.
function ringPosition(i, n) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return {
    left: DISK / 2 + RING * Math.cos(a) - ITEM / 2,
    top: DISK / 2 + RING * Math.sin(a) - ITEM / 2,
  };
}

function readFlag(key) {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function writeFlag(key) {
  try { localStorage.setItem(key, "1"); } catch {}
}

const ACCENT = { accent: "hsl(189, 84%, 55%)", shadow: "hsl(189, 70%, 38%)" };

const DESTINATIONS = [
  {
    key: "main",
    label: "Our Lady",
    href: "/main",
    body: "Step before the mirror. Our Lady hears every question the faithful bring her.",
    icon: (
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    ),
  },
  {
    key: "trade",
    label: "The Liminal Terminal",
    href: "/trade",
    body: "Read the tape. Four consultants, one verdict — the market confesses to those who listen.",
    icon: (
      <>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" x2="20" y1="19" y2="19" />
      </>
    ),
  },
  {
    key: "exlibris",
    label: "Ex Libris",
    href: "/exlibris",
    body: "The perpetual ledger. Every flame, every name, inscribed for those who came to pray.",
    icon: (
      <>
        <path d="M15 12h-5" />
        <path d="M15 8h-5" />
        <path d="M19 17V5a2 2 0 0 0-2-2H4" />
        <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
      </>
    ),
  },
  {
    key: "hailmary",
    label: "Hail Mary Prospecting Co",
    href: "/hailmary",
    body: "Find your fortune in the digital frontier. Our Lady's prospectors never rest.",
    icon: (
      <>
        <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
        <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
        <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
        <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
      </>
    ),
  },
  {
    key: "fountain",
    label: "Coin Fountain",
    href: "/fountain",
    body: "Toss a coin, whisper a wish. Our Lady keeps every offering the faithful let fall.",
    icon: (
      <>
        <path d="M12 10L12 2" />
        <path d="M16 6L12 10L8 6" />
        <path d="M2 15C2.6 15.5 3.2 16 4.5 16C7 16 7 14 9.5 14C12.1 14 11.9 16 14.5 16C17 16 17 14 19.5 14C20.8 14 21.4 14.5 22 15" />
        <path d="M2 21C2.6 21.5 3.2 22 4.5 22C7 22 7 20 9.5 20C12.1 20 11.9 22 14.5 22C17 22 17 20 19.5 20C20.8 20 21.4 20.5 22 21" />
      </>
    ),
  },
];

const TELESCOPE_PATHS = (
  <>
    <path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" />
    <path d="m13.56 11.747 4.332-.924" />
    <path d="m16 21-3.105-6.21" />
    <path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" />
    <path d="m6.158 8.633 1.114 4.456" />
    <path d="m8 21 3.105-6.21" />
    <circle cx="12" cy="13" r="2" />
  </>
);

/** The menu's own glyph, for pages that mount it anchored on their own button. */
export function TelescopeIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TELESCOPE_PATHS}
    </svg>
  );
}

const HOME = {
  key: "home",
  label: "ex Machina",
  href: "/home",
  body: "Back to where it all begins. The candles are still burning.",
  icon: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
};

export default function RadialNavMenu({
  hidden = false,
  ready = true,
  corner = "bottom-left",
  current = null,
  demoKey = "fountain_nav_demo_seen",
  trigger = null,
  triggerLabel = "Site navigation",
  triggerStyle = null,
  triggerClassName = "",
  // Theme hooks, all optional (fallbacks are /fountain's gold on black):
  // { disk, hub, icon, accent, ring, glyph } — any CSS colour.
  colors = null,
  actions = [],
  anchorEl = null,
  open: openProp,
  onRequestClose,
}) {
  const controlled = openProp !== undefined && trigger == null;
  const anchored = trigger != null || controlled;
  const colorVars = {};
  if (colors) for (const [k, v] of Object.entries(colors)) if (v) colorVars[`--frm-${k}`] = v;
  const items = [
    ...DESTINATIONS.map((d) => (d.key === current ? HOME : d)),
    ...actions,
  ];
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Anchored mode: where the disk lands — measured on each open.
  const [layer, setLayer] = useState({ left: 0, top: 0 });
  const rootRef = useRef(null);
  const layerRef = useRef(null);
  const leaveTimer = useRef(null);
  const lastPointer = useRef(null);
  const [confirmModal, confirm] = useCyberConfirm();

  useEffect(() => setMounted(true), []);

  // Controlled mode follows the page's open prop (the page's own button
  // toggles it; our closes report back through onRequestClose).
  useEffect(() => {
    if (!controlled) return;
    if (openProp) openMenu();
    else setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, openProp]);

  const close = () => {
    setOpen(false);
    onRequestClose?.();
  };

  const openMenu = () => {
    const anchor = controlled ? anchorEl : rootRef.current;
    if (anchored && anchor) {
      const r = anchor.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Centred on the trigger like /fountain's corner button (the hub x
      // lands over it), then nudged in until the whole disk is on screen.
      const clamp = (v, max) => Math.min(Math.max(v, EDGE), max - DISK - EDGE);
      setLayer({
        left: clamp(cx - DISK / 2, window.innerWidth),
        top: clamp(cy - DISK / 2, window.innerHeight),
      });
    }
    setOpen(true);
  };

  // Close on Escape / outside tap. pointerdown (not click) so the tap that
  // closes the menu is the same one that starts an orbit drag on the scene.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || layerRef.current?.contains(e.target)) return;
      if (controlled && anchorEl?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    // The anchored disk was placed against the trigger's old rect.
    const onResize = () => close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Fold away when something else (the Coin Guide) takes the stage.
  useEffect(() => { if (hidden) close(); }, [hidden]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  // First-visit demo: once the loader has cleared, bloom the disk open for
  // a beat and fold it back. Skipped if the visitor already beat us to it.
  useEffect(() => {
    if (controlled || !ready || hidden || readFlag(demoKey)) return;
    let openT, closeT;
    // A backgrounded tab would play the demo to nobody and burn the flag,
    // so hold it until the page is actually on screen.
    const start = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", start);
      openT = setTimeout(() => {
        writeFlag(demoKey);
        openMenu();
        closeT = setTimeout(() => close(), 1400);
      }, 900);
    };
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      document.removeEventListener("visibilitychange", start);
      clearTimeout(openT);
      clearTimeout(closeT);
    };
    // openMenu only reads refs + window; no need to re-arm on its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hidden, demoKey]);

  // Mouse hover opens/closes. The root box itself is pointer-events:none,
  // so enter/leave only fire over the button or the open disk — the empty
  // corners of the 136px square don't count as hovering. The short grace on
  // leave keeps a slight overshoot off the disk edge (or, anchored, the hop
  // from trigger down to disk) from snapping it shut.
  const onPointerEnter = (e) => {
    if (e.pointerType !== "mouse" || hidden) return;
    clearTimeout(leaveTimer.current);
    if (!open) openMenu();
  };
  const onPointerLeave = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => close(), 150);
  };

  const onToggleDown = (e) => { lastPointer.current = e.pointerType; };
  const onToggleClick = () => {
    // Hover already opened it for a mouse; a click there shouldn't close
    // it out from under the cursor. Touch and keyboard toggle.
    const wasMouse = lastPointer.current === "mouse";
    lastPointer.current = null;
    if (wasMouse || !open) openMenu();
    else close();
  };
  const hoverProps = controlled ? {} : { onPointerEnter, onPointerLeave };

  const disk = (
        <nav id="frm-disk" className="frm-disk" aria-label="Site navigation" aria-hidden={!open}>
          {items.map((d, i) => (
            <button
              key={d.key}
              type="button"
              className="frm-item"
              style={ringPosition(i, items.length)}
              aria-label={d.label}
              title={d.label}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                close();
                if (d.onSelect) { d.onSelect(); return; }
                confirm({
                  title: d.label,
                  body: d.body,
                  ...ACCENT,
                  onProceed: () => { window.location.href = d.href; },
                });
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {d.icon}
              </svg>
            </button>
          ))}
        </nav>
  );

  return (
    <>
      {anchored ? (
        <>
          {!controlled && <button
            ref={rootRef}
            type="button"
            className={`frm-trigger${open ? " is-open" : ""}${triggerClassName ? ` ${triggerClassName}` : ""}`}
            style={triggerStyle}
            title={triggerLabel}
            aria-label={open ? "Close navigation" : triggerLabel}
            aria-expanded={open}
            aria-controls="frm-disk"
            onPointerDown={onToggleDown}
            onClick={onToggleClick}
            {...hoverProps}
          >
            {trigger}
          </button>}
          {mounted && createPortal(
            <div
              ref={layerRef}
              className={`frm-layer${open ? " is-open" : ""}`}
              style={{ left: layer.left, top: layer.top, ...colorVars }}
              {...hoverProps}
            >
              {disk}
              {/* Hub "x" — the pen's centre button, here purely a close. */}
              <button
                type="button"
                className="frm-toggle"
                aria-label="Close navigation"
                tabIndex={open ? 0 : -1}
                onClick={() => close()}
              />
            </div>,
            document.body,
          )}
        </>
      ) : (
      <div
        ref={rootRef}
        {...hoverProps}
        style={colorVars}
        className={`frm-root frm-${corner}${open ? " is-open" : ""}${hidden ? " is-hidden" : ""}`}
      >
        {disk}

        <button
          type="button"
          className="frm-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="frm-disk"
          onPointerDown={onToggleDown}
          onClick={onToggleClick}
        >
          <svg
            className="frm-glyph"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {TELESCOPE_PATHS}
          </svg>
        </button>
      </div>
      )}

      {confirmModal}

      <style jsx>{`
        /* The disk is built once (the disk const) and mounted in either wrapper,
           and styled-jsx doesn't scope JSX that lives outside the returned
           tree — so its selectors are :global(), kept unique by the frm-
           prefix.

           Colours come in as CSS variables (see the colors prop) so a page
           can match its own theme; the fallbacks are /fountain's gold. */

        /* DISK-sized box, button centred in it. The disk is the full box;
           collapsed it sits small behind the button as a dark halo, like
           the pen. */
        .frm-root {
          position: fixed;
          width: ${DISK}px;
          height: ${DISK}px;
          z-index: 30000;
          pointer-events: none;
          transition: opacity 0.25s ease, transform 0.3s ease;
        }
        .frm-bottom-left {
          left: calc(12px + env(safe-area-inset-left, 0px));
          bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        }
        /* Top-right: the button lands where the camera used to be (1rem in,
           44px square → its centre sits 38px from both edges). */
        .frm-top-right {
          right: calc(${38 - DISK / 2}px + env(safe-area-inset-right, 0px));
          top: calc(${38 - DISK / 2}px + env(safe-area-inset-top, 0px));
        }
        /* Tucked that tight, the open disk would hang off two edges — so the
           whole rig slides in as it blooms, landing EDGE px clear. */
        .frm-top-right.is-open {
          transform: translate(${-(DISK / 2 + EDGE - 38)}px, ${DISK / 2 + EDGE - 38}px);
        }
        .frm-root.is-hidden {
          opacity: 0;
        }
        .frm-root.is-hidden .frm-toggle {
          pointer-events: none;
        }

        :global(.frm-disk) {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--frm-disk, rgba(0, 0, 0, 0.6));
          border: 1px solid color-mix(in srgb, var(--frm-ring, #d4af37) 45%, transparent);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          overflow: hidden;
          transform: scale(0.4) rotate(270deg);
          transition: transform 0.3s ease, opacity 0.2s ease, box-shadow 0.3s ease;
          pointer-events: none;
        }
        .is-open :global(.frm-disk) {
          transform: scale(1) rotate(0deg);
          box-shadow: 0 0 18px color-mix(in srgb, var(--frm-accent, #d4af37) 35%, transparent);
          pointer-events: auto;
        }

        :global(.frm-item) {
          position: absolute;
          width: ${ITEM}px;
          height: ${ITEM}px;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: var(--frm-icon, #f6f5f1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.3s ease, color 0.2s ease, filter 0.2s ease, background 0.2s ease;
        }
        .is-open :global(.frm-item) {
          opacity: 1;
        }
        :global(.frm-item:hover),
        :global(.frm-item:focus-visible) {
          color: var(--frm-accent, #f3d36b);
          background: color-mix(in srgb, var(--frm-accent, #d4af37) 12%, transparent);
          filter: drop-shadow(0 0 6px color-mix(in srgb, var(--frm-accent, #d4af37) 80%, transparent));
        }

        /* The centre button: the resting glyph (corner mode) spins out as an
           "x" of two pseudo-element bars spins in. */
        .frm-toggle {
          position: absolute;
          left: ${(DISK - HUB) / 2}px;
          top: ${(DISK - HUB) / 2}px;
          width: ${HUB}px;
          height: ${HUB}px;
          padding: 0;
          border-radius: 50%;
          border: 2px solid color-mix(in srgb, var(--frm-ring, #d4af37) 65%, transparent);
          background: var(--frm-hub, rgba(0, 0, 0, 0.55));
          color: var(--frm-glyph, #d4a854);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
          z-index: 1;
          transition: box-shadow 0.3s ease, background 0.3s ease;
        }
        .frm-glyph {
          transition: transform 0.3s ease, opacity 0.2s ease;
        }
        .is-open .frm-glyph {
          transform: rotate(135deg) scale(0.6);
          opacity: 0;
        }
        .frm-toggle::before,
        .frm-toggle::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          background: var(--frm-accent, #f3d36b);
          border-radius: 1px;
          opacity: 0;
          transition: transform 0.3s ease, opacity 0.2s ease;
        }
        .frm-toggle::before {
          width: 2px;
          height: 20px;
          transform: translate(-50%, -50%) rotate(-90deg);
        }
        .frm-toggle::after {
          width: 20px;
          height: 2px;
          transform: translate(-50%, -50%) rotate(-90deg);
        }
        .is-open .frm-toggle::before,
        .is-open .frm-toggle::after {
          opacity: 1;
          transform: translate(-50%, -50%) rotate(45deg);
        }
        .frm-toggle:hover {
          box-shadow: 0 0 15px color-mix(in srgb, var(--frm-accent, #d4af37) 50%, transparent);
        }
        .is-open .frm-toggle {
          background: color-mix(in srgb, var(--frm-accent, #d4af37) 15%, var(--frm-hub, rgba(0, 0, 0, 0.55)));
        }

        /* ── Anchored mode ─────────────────────────────────────────── */
        .frm-trigger {
          padding: 0;
          background: transparent;
          cursor: pointer;
          font: inherit;
          color: inherit;
          transition: box-shadow 0.3s ease, filter 0.3s ease, opacity 0.2s ease;
        }
        .frm-trigger:hover {
          box-shadow: 0 0 12px color-mix(in srgb, var(--frm-accent, #d4af37) 55%, transparent);
          filter: brightness(1.15);
        }
        /* The disk opens over the trigger (hub x where it was, as near as
           the screen edge allows) — the trigger bows out so it doesn't
           ghost through the disk, like /fountain's button turning into
           the x. */
        .frm-trigger.is-open {
          opacity: 0;
        }
        .frm-layer {
          position: fixed;
          width: ${DISK}px;
          height: ${DISK}px;
          z-index: 30000;
          pointer-events: none;
        }
        /* No resting halo here — the trigger is the resting state. Same
           spin as corner mode, plus a fade since there's no halo to grow
           from. */
        .frm-layer :global(.frm-disk) {
          opacity: 0;
        }
        .frm-layer.is-open :global(.frm-disk) {
          opacity: 1;
        }
        .frm-layer .frm-toggle {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, box-shadow 0.3s ease, background 0.3s ease;
        }
        .frm-layer.is-open .frm-toggle {
          opacity: 1;
          pointer-events: auto;
        }

        /* globals.css strips outlines with !important — give keyboards a ring. */
        .frm-toggle:focus-visible,
        .frm-trigger:focus-visible,
        :global(.frm-item:focus-visible) {
          outline: 2px solid var(--frm-accent, #d4af37) !important;
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.frm-disk),
          .frm-toggle,
          .frm-toggle::before,
          .frm-toggle::after,
          .frm-glyph,
          .frm-trigger,
          :global(.frm-item) {
            transition-duration: 0.01s;
          }
        }
      `}</style>
    </>
  );
}
