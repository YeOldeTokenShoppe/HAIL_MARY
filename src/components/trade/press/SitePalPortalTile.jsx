"use client";
import React, { useEffect, useRef, useState } from "react";

// A LIVE SITEPAL CHARACTER, CROPPED INTO A SQUARE FEED TILE.
//
// This is THE SITEPAL SLOT that PressFigure's closing note describes, built for
// Virgil: his portrait is a still, and a still cannot lip-sync, so the image is
// replaced by the player itself.
//
// ── WHY AN IFRAME AND NOT <SitePalFeed> ──────────────────────────────────────
//
// SitePalFeed is a PAGE-LEVEL embed: it installs global `window.vh_*` callbacks
// and a fixed DOM id, and it is safe exactly where it is used today — the CRT
// path (MobileTerminalGame), which has no temple running.
//
// THE PRESS FLOOR IS NOT THAT PLACE, on either surface. `?flat=1` portals
// PressFlat over the LIVE temple (opaque background, but the temple's own SitePal
// host is still in the document), and desktop obviously so. Both would be fighting
// CyborgTempleScene for `window.sayText`, `window.vh_sceneLoaded` and the
// `_html5Player` DOM id — and the loser is silent, not broken, which is the worst
// kind. PressFigure's own note flags this as the first of the two traps.
//
// public/sitepal-portal.html exists precisely to dissolve that: one character
// alone in its own document, with its own globals and its own uniquely-named
// player div. It is the architecture /main's council runs on, and the reason that
// file's header spends a paragraph on multi-embed collapse.
//
// ── THE RULES THIS FILE IS OBEYING ───────────────────────────────────────────
//
// ON-SCREEN, ALWAYS. A subframe with an empty window clip rect is throttled by
// WebKit to ~0.1fps, and the symptom is deceptive: audio is untouched, so the
// character SPEAKS WITH A FROZEN FACE and never lip-syncs — which is the exact
// bug this component is being built to fix, so shipping it hidden off-screen
// would be a circle. The tile is visible by construction; the only way to break
// it is to hide the PANEL by moving it, so hide by opacity if that day comes.
// See [[sitepal-iframe-offscreen-throttle]] — it has already come back twice,
// once via `left:-10000px` and once via an overflow-clipped second portal.
//
// 600x800 INTO A SQUARE, BY TRANSFORM. The portal document is a fixed 600x800
// stage. Scaling it with CSS `transform` keeps a non-empty clip rect (an
// intersection is all the throttle rule needs) where `width:0` or `clip-path`
// would not.
//
// NO loadSceneByID. One tile, one character, for the life of the mount. Swapping
// scenes in a live player can leave the new one's audio subsystem null
// ("setAudioElementMode of null") and it then plays nothing at all.

/**
 * THE PLAYER'S OWN PIXEL SIZE — measured in the running portal on 2026-08-03,
 * not taken from the 600x800 in the AC_VHost_Embed call. Those two arguments
 * size the STAGE the embed reserves; the canvas SitePal actually creates is
 * 600x450. Framing the 800 letterboxes the character in the portal document's
 * beige, which is what the tile showed on its first build.
 */
const PLAYER_W = 600;
const PLAYER_H = 450;

/**
 * @param sitepal   VIRGIL.sitepal — { account, sceneId, hash }
 * @param id        DOM id of the WRAPPER, which is what counselSpeech's
 *                  portalWindow(containerId) looks up before reaching for the
 *                  iframe inside it. Whatever speaks to this tile must use the
 *                  same string.
 * @param still     portrait shown until the player reports ready, and kept
 *                  forever if it never does.
 * @param zoom      how far to push past a plain fit, where 1 means "the player's
 *                  full height exactly fills the tile" (its 4:3 width then
 *                  overflows a square tile and crops at the sides, which is what
 *                  a talking head wants). Above 1 pushes in toward the face.
 *                  IT IS NOT A RAW SCALE — the fit against the tile is measured
 *                  and this rides on top of it. Treated as a raw scale on the
 *                  first build, 1.2 rendered a 720px-wide cat in a 150px tile,
 *                  i.e. a close-up of his chin.
 * @param originY   vertical anchor for the crop. 50% shows the player as
 *                  composed; lower values push his head up the tile.
 * @param onReady   (bool) => void, fired when the player reports in (or gives up)
 */
export default function SitePalPortalTile({
  sitepal, id, still = null, zoom = 1, originY = "50%",
  active = true, onReady = null, timeoutMs = 20000,
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  /* FIT THE PLAYER TO THE TILE, MEASURED.
   *
   * The player is a fixed 600x450 document; the tile is whatever the surface
   * gives it (132px on desktop, a square on the flat feed). `zoom` alone cannot
   * express that relationship — the first build applied it as a raw scale and
   * rendered a 720px-wide cat inside a 150px box, which crops to a close-up of
   * one nostril. The scale that matters is tile-height over player-height, and
   * `zoom` rides on top of it as the artistic push past a plain fit.
   *
   * HEIGHT, NOT WIDTH: the tiles are square or near it and the player is 4:3, so
   * fitting the width would letterbox with the portal's beige showing through.
   * Filling the height crops the sides, which is what a talking head wants.
   *
   * A ResizeObserver rather than container-query units, because this has to be
   * right on the first paint — a tile that fits itself one frame late is a
   * visible jump every time he starts talking. */
  const wrapRef = useRef(null);
  const [fit, setFit] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) setFit(h / PLAYER_H);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* bg=transparent, because the SCENE is authored transparent and the portal
     document's default beige is a backdrop for the surfaces that MIRROR its
     pixels onto something (see the note in sitepal-portal.html). This tile shows
     the frame itself, so that backdrop is just a block of parchment behind a
     cutout cat; transparent lets .spt-wrap's own dark ground show through and he
     sits in the panel instead of on a swatch. */
  const src = sitepal
    ? `/sitepal-portal.html?acc=${encodeURIComponent(sitepal.account)}` +
      `&scene=${encodeURIComponent(sitepal.sceneId)}` +
      `&embed=${encodeURIComponent(sitepal.hash)}` +
      `&bg=transparent`
    : null;

  /* THE PORTAL ANNOUNCES ITSELF BY postMessage, not by onLoad: the iframe's
     `load` event fires when the DOCUMENT is parsed, which is several seconds
     before SitePal has a player — handing it a line at that point is the
     "frame has no sayText yet" branch in speakInPortal.

     ORIGIN-CHECKED, and `e.source` is NOT checked here on purpose: this tile
     mounts one portal and the temple's host is a page embed that never posts
     these messages, so the message type is unambiguous. If a second tile is ever
     mounted in one document, add the source check — two Virgils would otherwise
     mark each other ready. */
  useEffect(() => {
    if (!src) return;
    let settled = false;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "sitepal-portal-ready") return;
      settled = true;
      clearTimeout(timer);
      setReady(true);
      onReadyRef.current?.(true);
    };
    window.addEventListener("message", onMessage);
    /* GIVE UP OUT LOUD. Every failure in this chain is silent from the outside —
       an unlicensed URL host renders a page embed but hangs an iframe portal on
       an empty stage, with no error anywhere — so a tile that never came up must
       say so once rather than leaving a still portrait that looks intentional.
       See [[sitepal-domain-licensing-lan-ip]]: check the URL host FIRST. */
    const timer = setTimeout(() => {
      if (settled) return;
      console.warn(
        `[SitePalPortalTile] scene ${sitepal?.sceneId} never reported ready in ` +
        `${timeoutMs}ms — staying on the still. If the page embed renders but ` +
        `portals hang, check that "${window.location.host}" is a licensed SitePal domain.`,
      );
      setFailed(true);
      onReadyRef.current?.(false);
    }, timeoutMs);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [src, timeoutMs, sitepal?.sceneId]);

  if (!src) return null;

  /* HIDDEN AT 0.01, NEVER AT 0 AND NEVER BY display — the literal prescription in
     [[sitepal-iframe-offscreen-throttle]]. The frame has to keep a non-empty clip
     rect and keep painting, or WebKit throttles it to ~0.1fps and he returns to
     camera mid-blink and lip-syncs nothing. A hair of opacity is the cheapest
     thing that is unambiguously still being composited; `opacity:0` is the kind
     of thing an engine is entitled to optimise away. zIndex drops it behind the
     panel's other layers so the invisible sliver cannot tint them. */
  const hidden = { opacity: 0.01, zIndex: -1, pointerEvents: "none" };

  return (
    <div className="spt-wrap" id={id} ref={wrapRef} style={active ? undefined : hidden}>
      <style>{CSS}</style>
      {/* THE STILL STAYS MOUNTED UNDERNEATH rather than being swapped out. The
          player fades in over it, so a portal that is slow (or never arrives, or
          is throttled into a frozen frame) degrades to the face the panel showed
          before this component existed instead of to a hole. */}
      {still && (
        <img className="spt-still" src={still} alt="" aria-hidden="true"
             style={{ opacity: ready ? 0 : 1 }} />
      )}
      <div className="spt-stage" style={{
        transform: `translate(-50%, -50%) scale(${fit * zoom})`,
        top: originY,
        // Nothing to show until the tile has been measured — at scale 0 the
        // player is present and painting (so it is never throttled) but has no
        // wrong-sized first frame to flash.
        opacity: ready && fit > 0 ? 1 : 0,
      }}>
        <iframe
          title=""
          aria-hidden="true"
          className="spt-frame"
          src={src}
          scrolling="no"
          /* The portal needs autoplay to speak at all; it is same-origin and
             ships in this repo, so nothing else is granted. */
          allow="autoplay"
        />
      </div>
      {failed && <span className="spt-flag">STILL</span>}
    </div>
  );
}

const CSS = `
.spt-wrap { position:absolute; inset:0; overflow:hidden; background:#02100e; }
.spt-still { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  transition:opacity .35s ease; }
/* The 600x800 portal stage, anchored by its own centre so the scale above can
   push the head into frame without the box drifting. Horizontal position is
   fixed at 50% and only the vertical anchor is tunable — a talking head is never
   off-centre horizontally, and one axis of freedom is one fewer to get wrong.
   (No backticks in here: this block is a template literal.) */
/* 600x450 — the size of the PLAYER, measured, not the 600x800 the portal
   document reserves for its stage div. Framing the larger box letterboxes the
   character inside a beige band and makes the crop numbers meaningless.
   These two must stay in step with PLAYER_W / PLAYER_H in this file, which is
   what the fit is solved against. */
.spt-stage { position:absolute; left:50%; width:600px; height:450px;
  transform-origin:50% 50%; transition:opacity .45s ease; pointer-events:none; }
.spt-frame { width:600px; height:450px; border:0; display:block; background:transparent; }
/* Named, not silent. A tile that fell back to the still looks identical to one
   that was authored as a still. */
.spt-flag { position:absolute; left:9px; top:7px; z-index:6;
  font:bold 8.5px/1 'Courier New',monospace; letter-spacing:0.12em;
  color:rgba(234,255,249,0.35); }
@media (prefers-reduced-motion:reduce) {
  .spt-still, .spt-stage { transition:none; }
}
`;
