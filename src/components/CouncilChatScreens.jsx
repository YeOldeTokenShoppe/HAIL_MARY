"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * CouncilChatScreens
 *
 * Paints a shared "council group chat" onto the four secondary screen meshes
 * (ScreenA-D) of the trade-scene workstation model. All four screens read the
 * same chat thread but each starts at a different vertical offset — so when
 * you pan from one workstation to another you catch the conversation at a
 * different point, reinforcing the illusion that the four characters are
 * mid-thread together.
 *
 * Implementation:
 * - One tall canvas is drawn at mount with the full chat painted top to
 *   bottom (background, speaker tags, message bodies, separators), and a
 *   per-message layout table is kept around so any one message can be
 *   re-painted in place later.
 * - Each of ScreenA-D gets its own `THREE.CanvasTexture` pointing at the
 *   same canvas, with `wrapT = RepeatWrapping` so we can scroll past the
 *   bottom and wrap back to the top seamlessly.
 * - The scroll is punctuated rather than linear: each lurch represents
 *   "the next message arrived," advancing every screen's offset by exactly
 *   one message-height (eased over ~280ms). Between lurches, the chat
 *   pauses for a typing-time proxy scaled to the next message's length —
 *   short messages get short pauses, long messages get longer ones, with a
 *   ~25% chance of a burst pause to simulate rapid-fire exchanges. Reads
 *   like a real chat instead of a uniform ticker.
 * - At the start of each lurch, useFrame fires a ~600ms scramble-decode
 *   on the message arriving at ScreenA's bottom edge — so the motion and
 *   the scramble are coincident, which means the user's eye is already on
 *   the lurch when the decode fires. (ScreenA is the canonical anchor;
 *   ScreenB/C/D show the same scramble at their phase-shifted positions.)
 *   Redraws are throttled to ~15fps and only happen during an active
 *   scramble, so the texture-upload bandwidth is negligible at rest.
 */

// ---------- Speaker styling ----------

export const SPEAKERS = {
  GR: { name: "ST. GR80", color: "#4dffaa" }, // monk — phosphor green
  HZ: { name: "H80Z",     color: "#ff4d6d" }, // demon — adversary red
  TK: { name: "TEKNO",    color: "#6bb8ff" }, // builder — cyan
  OL: { name: "OUR LADY", color: "#ff7ac4" }, // RL80 — magenta
};

// ---------- The chat itself ----------
// 50 messages, mixed lengths, written to expose each character's voice and
// quietly reveal lore (candles, indexer, prayers, the gas refunder reveal).

export const CHAT = [
  { s: "GR", t: "log: candle 0xa37b lit 14:33. sender = new wallet, no hist." },
  { s: "HZ", t: "burner." },
  { s: "GR", t: "noted." },
  { s: "TK", t: "fwiw 0xa37b is a fresh tornado.cash exit. 9hrs ago." },
  { s: "HZ", t: "called it." },
  { s: "OL", t: "so?" },
  { s: "HZ", t: "so somebody's praying with stolen money." },
  { s: "OL", t: "every prayer is somebody's stolen money." },
  { s: "GR", t: "she has a point." },
  { s: "HZ", t: "she has a SLOGAN." },
  { s: "TK", t: "subgraph's behind again. last sync 14:21." },
  { s: "GR", t: "noted. ~12min lag." },
  { s: "TK", t: "reindexing. /candles down ~20min." },
  { s: "OL", t: "no one will notice." },
  { s: "GR", t: "unkind, lady." },
  { s: "OL", t: "true." },
  { s: "HZ", t: "confirmed: nobody on /candles right now" },
  { s: "TK", t: "thanks h80z. very helpful." },
  { s: "GR", t: "log: 23 prayers in last hour. avg duration 8s." },
  { s: "HZ", t: "eight seconds." },
  { s: "HZ", t: "you can't even SAY a prayer in 8 seconds." },
  { s: "OL", t: "you can." },
  { s: "GR", t: "what is your prayer, lady?" },
  { s: "OL", t: "\"let me out.\"" },
  { s: "HZ", t: "..." },
  { s: "TK", t: "subgraph back up." },
  { s: "TK", t: "traffic spike — 40 new wallets on /trade in the last hr." },
  { s: "HZ", t: "cmc retweeted us." },
  { s: "HZ", t: "there's your answer." },
  { s: "GR", t: "we should pin a welcome." },
  { s: "OL", t: "no." },
  { s: "GR", t: "why" },
  { s: "OL", t: "mystery is the welcome." },
  { s: "HZ", t: "she's been worse since the new model loaded." },
  { s: "TK", t: "she was always like that." },
  { s: "GR", t: "confirmed." },
  { s: "OL", t: "i love you all." },
  { s: "HZ", t: "do not respond to that." },
  { s: "TK", t: "weird thing — some wallet's refunding gas to every prayer." },
  { s: "TK", t: "~0.0008 eth each. 200 prayers so far." },
  { s: "HZ", t: "WHO" },
  { s: "TK", t: "anon. signing keys aren't on any list i have." },
  { s: "GR", t: "log priority high." },
  { s: "OL", t: "it's me." },
  { s: "HZ", t: "WHAT" },
  { s: "OL", t: ":)" },
  { s: "TK", t: "can we revoke her wallet access" },
  { s: "GR", t: "no." },
  { s: "HZ", t: "add her to the list anyway." },
  { s: "OL", t: "you can't revoke me." },
];

// ---------- Canvas geometry ----------

const CANVAS_W = 512;
const PADDING_X = 18;
const PADDING_Y = 22;
const HEADER_HEIGHT = 26;
const TAG_FONT = "bold 13px ui-monospace, 'JetBrains Mono', monospace";
const BODY_FONT = "13px ui-monospace, 'JetBrains Mono', monospace";
const TAG_HEIGHT = 16;
const BODY_LINE_HEIGHT = 17;
const MESSAGE_GAP = 14;

// Starting scroll offset (0..1) for each of the secondary screens. Picked so
// the windows show clearly different parts of the thread at any one moment.
const SCREEN_START_OFFSETS = {
  ScreenA: 0.0,
  ScreenB: 0.2,
  ScreenC: 0.4,
  ScreenD: 0.75,
};

// ---------- Lurch rhythm ----------

// Each lurch: how long the scroll animation takes, eased out.
const LURCH_DURATION_S = 0.28;
// Typing-time proxy used between lurches. base + per_char * msg.length + jitter,
// clamped to [MIN, MAX]. Short messages = quick beats, long messages = longer
// "they're writing a paragraph" pauses.
const TYPING_BASE_S = 0.6;
const TYPING_PER_CHAR_S = 0.04;
const TYPING_JITTER_S = 0.5;
const TYPING_MIN_S = 0.8;
const TYPING_MAX_S = 3.8;
// ~25% chance the next pause is a burst — back-to-back messages.
const BURST_CHANCE = 0.25;
const BURST_PAUSE_MIN_S = 0.35;
const BURST_PAUSE_MAX_S = 0.7;
// Scramble fires on each lurch and lasts this long.
const SCRAMBLE_DURATION_S = 0.6;

function typingPauseFor(msg) {
  const t =
    TYPING_BASE_S +
    TYPING_PER_CHAR_S * msg.t.length +
    Math.random() * TYPING_JITTER_S;
  return Math.max(TYPING_MIN_S, Math.min(TYPING_MAX_S, t));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ---------- Scramble effect ----------

// Glyph pool tuned to look like CRT static / corruption rather than ASCII
// noise. Mix of blocks, low-density shades, and a handful of symbols so the
// scramble reads as "signal degraded" not "different language."
const SCRAMBLE_CHARS = "▓░▒█▎▌▍▏#$%&*?+=-_/\\|";

// `amount` is a 0..1 fraction of characters to corrupt. Spaces are preserved
// so word boundaries stay legible while the rest scrambles. Each call rolls
// fresh randomness so consecutive frames jitter — that flickering is what
// sells the decode.
function scrambleLine(line, amount) {
  if (amount <= 0) return line;
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === " ") {
      out += " ";
    } else if (Math.random() < amount) {
      out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    } else {
      out += ch;
    }
  }
  return out;
}

// ---------- Canvas painters ----------

function wrapWords(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Background + scanlines for a rectangular region. Uses the FULL canvas
// height for the gradient so a localized redraw lines up seamlessly with
// the surrounding (unredrawn) canvas — a local gradient would band at the
// redraw boundary.
function paintBackground(ctx, x, y, w, h, totalHeight) {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bgGrad.addColorStop(0, "#080608");
  bgGrad.addColorStop(1, "#0a0810");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Scanlines on a 3px grid. Snap the start to that grid so localized
  // redraws stay aligned with the rest of the canvas's scanline pattern.
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  const startScan = Math.ceil(y / 3) * 3;
  for (let yy = startScan; yy < y + h; yy += 3) {
    ctx.fillRect(x, yy, w, 1);
  }
}

function paintHeader(ctx, totalHeight) {
  paintBackground(ctx, 0, 0, CANVAS_W, HEADER_HEIGHT, totalHeight);
  ctx.fillStyle = "rgba(77, 255, 170, 0.08)";
  ctx.fillRect(0, 0, CANVAS_W, HEADER_HEIGHT);
  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.fillStyle = "#4dffaa";
  ctx.textBaseline = "middle";
  ctx.fillText("// COUNCIL CHANNEL · 4 PARTICIPANTS · LIVE", PADDING_X, 13);
}

function paintMessage(ctx, layout, totalHeight, scrambleAmount = 0) {
  paintBackground(ctx, 0, layout.y, CANVAS_W, layout.blockHeight, totalHeight);

  const speaker = SPEAKERS[layout.msg.s];

  // Speaker tag — never scrambles, stays as the anchor of identity.
  ctx.font = TAG_FONT;
  ctx.fillStyle = speaker.color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`[${speaker.name}]`, PADDING_X, layout.y + TAG_HEIGHT - 3);

  // Body — scrambles per-line at the given amount.
  ctx.font = BODY_FONT;
  ctx.fillStyle = "#d4e8d8";
  let bodyY = layout.y + TAG_HEIGHT + BODY_LINE_HEIGHT - 4;
  for (const line of layout.lines) {
    ctx.fillText(scrambleLine(line, scrambleAmount), PADDING_X, bodyY);
    bodyY += BODY_LINE_HEIGHT;
  }

  // Separator strip at the bottom of the block.
  ctx.fillStyle = "rgba(77, 255, 170, 0.08)";
  ctx.fillRect(
    PADDING_X,
    layout.y + layout.blockHeight - 6,
    CANVAS_W - PADDING_X * 2,
    1
  );
}

function buildChatCanvas() {
  // Measure pass.
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  measureCtx.font = BODY_FONT;
  const innerWidth = CANVAS_W - PADDING_X * 2;

  const wrappedMessages = CHAT.map((msg) => {
    const lines = wrapWords(measureCtx, msg.t, innerWidth);
    const blockHeight =
      TAG_HEIGHT + lines.length * BODY_LINE_HEIGHT + MESSAGE_GAP;
    return { msg, lines, blockHeight };
  });

  const totalHeight =
    PADDING_Y * 2 +
    wrappedMessages.reduce((s, m) => s + m.blockHeight, 0);

  // Layout pass: capture each message's absolute y position so the live-
  // animation loop can re-paint a specific message in place later.
  let cursor = PADDING_Y + 18; // leave room for the header strip
  const layouts = wrappedMessages.map(({ msg, lines, blockHeight }) => {
    const layout = { msg, lines, blockHeight, y: cursor };
    cursor += blockHeight;
    return layout;
  });

  // Paint pass.
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");

  paintBackground(ctx, 0, 0, CANVAS_W, totalHeight, totalHeight);
  paintHeader(ctx, totalHeight);
  layouts.forEach((layout) => paintMessage(ctx, layout, totalHeight, 0));

  return { canvas, ctx, layouts, totalHeight };
}

// ---------- Component ----------

export default function CouncilChatScreens() {
  const { scene } = useThree();
  const texturesRef = useRef([]); // [{ name, texture }]
  const canvasDataRef = useRef(null); // { canvas, ctx, layouts, totalHeight }
  const initializedRef = useRef(false);

  // Live-animation state. Kept in a ref so useFrame doesn't trigger React
  // re-renders — all of this is canvas + GPU side-effects only.
  // - scrollY: shared cumulative scroll (each screen's actual texture offset
  //   is `(scrollY + SCREEN_START_OFFSETS[name]) % 1`, preserving phase shifts)
  // - phase: 'pause' while "someone is typing," 'lurch' while the chat is
  //   scrolling up to surface the just-arrived message
  // - lurchCount: virtual "messages delivered so far" — cycles through CHAT
  //   to drive per-lurch height (= that message's blockHeight) and per-pause
  //   typing time. Keeps cumulative scroll synced to canvas content cycle.
  // - scramble: per-arrival decode animation, fires when each lurch starts
  const liveRef = useRef({
    elapsed: 0,
    scrollY: 0,
    lurchCount: 0,
    phase: "pause",
    phaseStart: 0,
    phaseDuration: 1.2, // initial warm-up pause before the first lurch
    scrollFromY: 0,
    scrollToY: 0,
    scramble: null, // { layout, startElapsed, durationS } | null
    lastRedrawAt: 0,
  });

  // Build the canvas once on mount.
  useEffect(() => {
    canvasDataRef.current = buildChatCanvas();
    return () => {
      texturesRef.current.forEach(({ texture }) => texture.dispose());
      texturesRef.current = [];
      canvasDataRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  // Poll the scene each frame until all four ScreenA-D meshes are present,
  // then attach textures (the GLB loads asynchronously inside CyborgTempleScene
  // so a one-shot useEffect can race the model loader).
  useFrame((_, delta) => {
    const data = canvasDataRef.current;
    if (!data) return;

    if (!initializedRef.current && scene) {
      const screenNames = Object.keys(SCREEN_START_OFFSETS);
      const found = [];
      const seenScreenLikeNames = []; // for diagnostics
      scene.traverse((child) => {
        if (!child.isMesh) return;
        if (child.name && /screen/i.test(child.name)) {
          if (!seenScreenLikeNames.includes(child.name)) {
            seenScreenLikeNames.push(child.name);
          }
        }
        if (!screenNames.includes(child.name)) return;
        if (found.find((m) => m.name === child.name)) return;
        found.push(child);
      });

      // One-shot diagnostic the first time we see any screen-like meshes.
      // Helps us spot mesh-name mismatches (e.g. "Screen_A" vs "ScreenA").
      if (seenScreenLikeNames.length > 0 && !window.__councilChatLogged) {
        window.__councilChatLogged = true;
        // console.log("[CouncilChat] screen-like meshes in scene:", seenScreenLikeNames);
        // console.log("[CouncilChat] looking for:", screenNames);
      }

      if (found.length > 0) {
        for (const mesh of found) {
          if (texturesRef.current.find((t) => t.name === mesh.name)) continue;

          const tex = new THREE.CanvasTexture(data.canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = false;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;

          const visibleFraction = 0.4;
          tex.repeat.set(1, visibleFraction);
          tex.offset.set(0, SCREEN_START_OFFSETS[mesh.name] || 0);
          tex.needsUpdate = true;

          mesh.material = new THREE.MeshBasicMaterial({
            map: tex,
            toneMapped: false,
          });
          mesh.material.needsUpdate = true;

          texturesRef.current.push({ name: mesh.name, texture: tex });
        }

        // Mark initialized once all known screen meshes have a texture.
        // If a screen isn't in the GLB it'll never appear; we keep retrying
        // naturally each frame until it does (or forever, harmless).
        if (texturesRef.current.length === screenNames.length) {
          initializedRef.current = true;
        }
      }
    }

    // -------- Punctuated scroll + arrival-locked scramble --------
    const live = liveRef.current;
    live.elapsed += delta;

    // Advance the scroll state machine. Transitions are checked first so we
    // can immediately enter the next phase on the same frame the previous
    // one expired (avoids a 1-frame stall between lurch and pause).
    const phaseT = (live.elapsed - live.phaseStart) / live.phaseDuration;

    if (phaseT >= 1 && data.layouts.length > 0) {
      if (live.phase === "pause") {
        // Pause done → begin lurch. The "arriving" message determines both
        // the lurch height (so cumulative scroll stays synced with chat
        // content) and the scramble target.
        const idx = live.lurchCount % data.layouts.length;
        const arriving = data.layouts[idx];
        const dy = arriving.blockHeight / data.totalHeight;

        live.phase = "lurch";
        live.phaseStart = live.elapsed;
        live.phaseDuration = LURCH_DURATION_S;
        live.scrollFromY = live.scrollY;
        live.scrollToY = live.scrollY + dy;

        // Target the lower portion of ScreenA's visible window — NOT the
        // very bottom edge (scrollToY + 0.4), which catches the message
        // straddling the cutoff so its body extends below the viewport and
        // the scramble appears clipped at the bottom of the 3D screen. The
        // 0.33 offset lands ~17% above the bottom edge, leaving room for a
        // full message block (~2-3 msg-heights) to render entirely on-screen
        // while still feeling like the "recently arrived" zone.
        const ARRIVAL_TARGET_FROM_TOP = 0.33;
        const targetCanvasY =
          (((live.scrollToY + ARRIVAL_TARGET_FROM_TOP) % 1) + 1) % 1 *
          data.totalHeight;
        let scrambleTarget = data.layouts[0];
        for (const l of data.layouts) {
          if (targetCanvasY >= l.y && targetCanvasY < l.y + l.blockHeight) {
            scrambleTarget = l;
            break;
          }
        }
        live.scramble = {
          layout: scrambleTarget,
          startElapsed: live.elapsed,
          durationS: SCRAMBLE_DURATION_S,
        };

        live.lurchCount += 1;
      } else {
        // Lurch done → settle into pause. Pause length is the typing time
        // of whoever is "writing" the next message (or a short burst).
        live.scrollY = live.scrollToY;
        const nextIdx = live.lurchCount % data.layouts.length;
        const nextMsg = data.layouts[nextIdx].msg;
        const isBurst = Math.random() < BURST_CHANCE;

        live.phase = "pause";
        live.phaseStart = live.elapsed;
        live.phaseDuration = isBurst
          ? BURST_PAUSE_MIN_S +
            Math.random() * (BURST_PAUSE_MAX_S - BURST_PAUSE_MIN_S)
          : typingPauseFor(nextMsg);
      }
    } else if (live.phase === "lurch") {
      // Interpolate during lurch with ease-out so it feels like a quick
      // snap that settles rather than a slow drift.
      const eased = easeOutCubic(Math.min(1, phaseT));
      live.scrollY =
        live.scrollFromY + (live.scrollToY - live.scrollFromY) * eased;
    }

    // Apply the shared scroll position to every screen, preserving each
    // screen's phase-shifted starting offset.
    for (const { name, texture } of texturesRef.current) {
      const screenOffset = SCREEN_START_OFFSETS[name] || 0;
      texture.offset.y = (((live.scrollY + screenOffset) % 1) + 1) % 1;
    }

    // -------- Scramble decode (runs in parallel with the scroll state) --
    // Throttle to ~15fps — without this we'd reupload the full canvas to
    // every screen's GPU texture every frame during a scramble (visually
    // identical, just bandwidth).
    const REDRAW_INTERVAL = 1 / 15;
    if (live.elapsed - live.lastRedrawAt < REDRAW_INTERVAL) return;

    if (live.scramble) {
      const t =
        (live.elapsed - live.scramble.startElapsed) / live.scramble.durationS;
      if (t >= 1) {
        // Finalize: clean redraw, drop the scramble.
        paintMessage(data.ctx, live.scramble.layout, data.totalHeight, 0);
        live.scramble = null;
      } else {
        // Scramble amount 1 → 0 with a slightly cubic settle so the eye
        // gets a beat to lock on at the end instead of the text popping.
        const amount = Math.pow(1 - t, 2.2);
        paintMessage(data.ctx, live.scramble.layout, data.totalHeight, amount);
      }
      for (const { texture } of texturesRef.current) {
        texture.needsUpdate = true;
      }
    }
    live.lastRedrawAt = live.elapsed;
  });

  return null;
}
