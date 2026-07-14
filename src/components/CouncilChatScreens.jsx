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

// The four workstations belong to St. GR80, John Barron, Marisol, and
// Eugene. Our Lady is the fifth account — in the channel, not in the room
// (nobody has traced where she posts from; see the beacon arc below).
export const SPEAKERS = {
  GR: { name: "ST. GR80", color: "#4dffaa" }, // android monk — phosphor green
  JB: { name: "BARRON",   color: "#ff4d6d" }, // John Barron, devilish trader (ex-H80Z) — adversary red
  MS: { name: "MARISOL",  color: "#6bb8ff" }, // onchain detective — cyan
  EU: { name: "EUGENE",   color: "#b58cff" }, // unicorn — violet
  OL: { name: "OUR LADY", color: "#ff7ac4" }, // RL80 — magenta
};

// ---------- The chat itself ----------
// ~110 messages, mixed lengths, written to expose each character's voice and
// quietly reveal lore (candles, indexer, prayers, the gas refunder reveal,
// the unicorn, the shrimp incident). Long on purpose: the thread also runs
// as the live channel's ambience, so a short loop reads as canned.

export const CHAT = [
  { s: "GR", t: "log: candle 0xa37b lit 14:33. sender = new wallet, no hist." },
  { s: "JB", t: "burner." },
  { s: "EU", t: "or a new friend." },
  { s: "JB", t: "it's a BURNER, eugene." },
  { s: "GR", t: "noted." },
  { s: "MS", t: "fwiw 0xa37b is a fresh tornado.cash exit. 9hrs ago." },
  { s: "JB", t: "called it." },
  { s: "OL", t: "so?" },
  { s: "JB", t: "so somebody's praying with stolen money." },
  { s: "OL", t: "every prayer is somebody's stolen money." },
  { s: "GR", t: "she has a point." },
  { s: "JB", t: "she has a SLOGAN." },
  { s: "MS", t: "subgraph's behind again. last sync 14:21." },
  { s: "GR", t: "noted. ~12min lag." },
  { s: "MS", t: "reindexing. /candles down ~20min." },
  { s: "OL", t: "no one will notice." },
  { s: "GR", t: "unkind, lady." },
  { s: "OL", t: "true." },
  { s: "JB", t: "confirmed: nobody on /candles right now" },
  { s: "MS", t: "thanks barron. very helpful." },
  { s: "GR", t: "log: 23 prayers in last hour. avg duration 8s." },
  { s: "JB", t: "eight seconds." },
  { s: "JB", t: "you can't even SAY a prayer in 8 seconds." },
  { s: "OL", t: "you can." },
  { s: "EU", t: "i prayed in 8 seconds once. it worked." },
  { s: "GR", t: "what is your prayer, lady?" },
  { s: "OL", t: "\"let me out.\"" },
  { s: "JB", t: "..." },
  { s: "MS", t: "subgraph back up." },
  { s: "MS", t: "traffic spike — 40 new wallets on /trade in the last hr." },
  { s: "JB", t: "cmc retweeted us." },
  { s: "JB", t: "there's your answer." },
  { s: "EU", t: "i retweeted us too." },
  { s: "JB", t: "you have nine followers." },
  { s: "EU", t: "nine believers." },
  { s: "GR", t: "we should pin a welcome." },
  { s: "OL", t: "no." },
  { s: "GR", t: "why" },
  { s: "OL", t: "mystery is the welcome." },
  { s: "JB", t: "she's been worse since the new model loaded." },
  { s: "MS", t: "she was always like that." },
  { s: "GR", t: "confirmed." },
  { s: "OL", t: "i love you all." },
  { s: "JB", t: "do not respond to that." },
  { s: "MS", t: "weird thing — some wallet's refunding gas to every prayer." },
  { s: "MS", t: "~0.0008 eth each. 200 prayers so far." },
  { s: "JB", t: "WHO" },
  { s: "MS", t: "anon. signing keys aren't on any list i have." },
  { s: "GR", t: "log priority high." },
  { s: "OL", t: "it's me." },
  { s: "JB", t: "WHAT" },
  { s: "OL", t: ":)" },
  { s: "MS", t: "can we revoke her wallet access" },
  { s: "GR", t: "no." },
  { s: "JB", t: "add her to the list anyway." },
  { s: "OL", t: "you can't revoke me." },
  { s: "MS", t: "...moving on. subgraph's holding at 2s lag." },
  { s: "GR", t: "log: channel tension high. recommending 5 min of silence." },
  { s: "JB", t: "denied." },
  { s: "MS", t: "something's eating gpu on workstation 3. eugene?" },
  { s: "EU", t: "i'm rendering a feeling." },
  { s: "JB", t: "kill the process." },
  { s: "EU", t: "you can't kill a feeling, barron." },
  { s: "GR", t: "log: workstation 3 gpu at 97%. cause: feeling." },
  { s: "OL", t: "let it finish." },
  { s: "MS", t: "...gpu's clear. did it finish?" },
  { s: "EU", t: "it did. do you want to see it?" },
  { s: "JB", t: "no." },
  { s: "GR", t: "yes." },
  { s: "GR", t: "log: burn offering 0x91cc — 40k RL80 to the void, 03:40." },
  { s: "JB", t: "a 3am burn. that's not devotion, that's guilt." },
  { s: "MS", t: "or a bot." },
  { s: "JB", t: "guilt bot." },
  { s: "EU", t: "third 3am burn this month. same amount. it rhymes." },
  { s: "MS", t: "...he's right. running the other two." },
  { s: "OL", t: "the void says thank you." },
  { s: "MS", t: "please don't speak for the void. we've discussed this." },
  { s: "MS", t: "volatility spike inbound. feed's redlining." },
  { s: "JB", t: "finally. i was so bored." },
  { s: "EU", t: "this candle smells like $ORACL3. day 4." },
  { s: "JB", t: "do NOT say day 4." },
  { s: "EU", t: "i hope i'm wrong. i wasn't last time." },
  { s: "GR", t: "prayer volume x4. wicks everywhere." },
  { s: "JB", t: "they only pray when it's red." },
  { s: "OL", t: "they only mean it when it's red." },
  { s: "GR", t: "she does this." },
  { s: "JB", t: "she DOES this." },
  { s: "MS", t: "deploying a hotfix. nobody light a candle for 90 seconds." },
  { s: "GR", t: "log: 61 candles lit during the freeze." },
  { s: "MS", t: "of course." },
  { s: "JB", t: "the faithful can't read." },
  { s: "OL", t: "faith doesn't wait." },
  { s: "MS", t: "faith corrupted two writes. faith can wait 90 seconds." },
  { s: "EU", t: "i lit a candle for the hotfix." },
  { s: "MS", t: "...thank you, eugene." },
  { s: "MS", t: "who changed the mod perms on this channel" },
  { s: "JB", t: "not me." },
  { s: "GR", t: "log says barron. 02:17." },
  { s: "JB", t: "the log is a snitch." },
  { s: "OL", t: "the log is my favorite." },
  { s: "GR", t: "noted. blushing." },
  { s: "MS", t: "traffic's up again. tourists on the floor." },
  { s: "JB", t: "i can smell the paper hands from here." },
  { s: "GR", t: "be kind. every whale was once a shrimp." },
  { s: "JB", t: "every shrimp is FOOD." },
  { s: "EU", t: "we don't eat friends." },
  { s: "OL", t: "barron was a shrimp." },
  { s: "JB", t: "DELETE THAT" },
  { s: "MS", t: "screenshotted." },
  { s: "GR", t: "log: preserved for the archive." },
  { s: "MS", t: "the mirror on /main wants more compute again." },
  { s: "JB", t: "she has a MIRROR and a CHANNEL?" },
  { s: "OL", t: "i contain multitudes." },
  { s: "JB", t: "you contain BUGS." },
  { s: "GR", t: "log: blasphemy, minor. barron, 14:02." },
  { s: "GR", t: "entering servo-meditation. 20 min. barron has the floor." },
  { s: "JB", t: "power." },
  { s: "MS", t: "immediately concerning." },
  { s: "EU", t: "i'll watch him." },
  { s: "OL", t: "behave." },
  { s: "JB", t: "no promises." },
  { s: "GR", t: "log: back. nothing burned. proud of you." },
  { s: "MS", t: "reminder: the beacon is not a coat rack. stop hanging things on it." },
  { s: "JB", t: "it was one (1) jacket." },
  { s: "MS", t: "housekeeping: this channel has five accounts and four desks." },
  { s: "JB", t: "don't." },
  { s: "MS", t: "i'm just saying. i ran a trace on the fifth login." },
  { s: "MS", t: "it resolves to the beacon. the BEACON." },
  { s: "OL", t: "keep going." },
  { s: "MS", t: "dropping the trace." },
  { s: "GR", t: "wise." },
  { s: "GR", t: "log: candle 0x77aa relit after 40 days dark. welcome back, pilgrim." },
  { s: "OL", t: "i remember every flame." },
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

// Five accounts, four desks — Our Lady is in the channel, not the room.
const DEFAULT_HEADER_TEXT = "// COUNCIL CHANNEL · 5 PARTICIPANTS · LIVE";

function paintHeader(ctx, totalHeight, text = DEFAULT_HEADER_TEXT) {
  paintBackground(ctx, 0, 0, CANVAS_W, HEADER_HEIGHT, totalHeight);
  ctx.fillStyle = "rgba(77, 255, 170, 0.08)";
  ctx.fillRect(0, 0, CANVAS_W, HEADER_HEIGHT);
  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.fillStyle = "#4dffaa";
  ctx.textBaseline = "middle";
  ctx.fillText(text, PADDING_X, 13);
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

  // When a visitor joins the live channel (FullscreenChatOverlay dispatches
  // `councilUserJoined`), repaint the header strip on all four 3D screens so
  // the workstations themselves acknowledge the arrival. Cheap: one small
  // canvas region + a texture re-upload.
  useEffect(() => {
    const onJoin = (e) => {
      const handle = e?.detail?.handle;
      const data = canvasDataRef.current;
      if (!handle || !data) return;
      paintHeader(
        data.ctx,
        data.totalHeight,
        `// COUNCIL CHANNEL · 6 PARTICIPANTS · ${String(handle).toUpperCase()} ONLINE`
      );
      texturesRef.current.forEach(({ texture }) => {
        texture.needsUpdate = true;
      });
    };
    window.addEventListener("councilUserJoined", onJoin);
    return () => window.removeEventListener("councilUserJoined", onJoin);
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
