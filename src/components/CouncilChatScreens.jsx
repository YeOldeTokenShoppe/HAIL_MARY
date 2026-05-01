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
 * - One tall canvas is drawn ONCE at mount with the full chat painted top to
 *   bottom (background, speaker tags, message bodies, separators).
 * - Each of ScreenA-D gets its own `THREE.CanvasTexture` pointing at the same
 *   canvas, with `wrapT = RepeatWrapping` so we can scroll past the bottom and
 *   wrap back to the top seamlessly.
 * - useFrame nudges each texture's `offset.y` every tick, with each screen
 *   getting a different starting offset. Speed is slow — about one screen-
 *   height per ~30s — so the scene reads as ambient, not as a ticker.
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
const TAG_FONT = "bold 13px ui-monospace, 'JetBrains Mono', monospace";
const BODY_FONT = "13px ui-monospace, 'JetBrains Mono', monospace";
const TAG_HEIGHT = 16;
const BODY_LINE_HEIGHT = 17;
const MESSAGE_GAP = 14;

// Starting scroll offset (0..1) for each of the four screens. Picked so the
// four windows show clearly different parts of the thread at any one moment.
const SCREEN_START_OFFSETS = {
  ScreenA: 0.0,
  ScreenB: 0.27,
  ScreenC: 0.53,
  ScreenD: 0.78,
};

// One full canvas-height per N seconds.
const SCROLL_PERIOD_SECONDS = 60;

// ---------- Canvas builder ----------

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

function buildChatCanvas() {
  // First pass: measure to figure out canvas height.
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  measureCtx.font = BODY_FONT;
  const innerWidth = CANVAS_W - PADDING_X * 2;

  const wrappedMessages = CHAT.map((msg) => {
    const lines = wrapWords(measureCtx, msg.t, innerWidth);
    const blockHeight =
      TAG_HEIGHT + lines.length * BODY_LINE_HEIGHT + MESSAGE_GAP;
    return { ...msg, lines, blockHeight };
  });

  const totalHeight =
    PADDING_Y * 2 +
    wrappedMessages.reduce((s, m) => s + m.blockHeight, 0);

  // Second pass: actually paint.
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");

  // Background — near-black with a faint magenta wash like a CRT in low light.
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bgGrad.addColorStop(0, "#080608");
  bgGrad.addColorStop(1, "#0a0810");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_W, totalHeight);

  // Subtle scanlines.
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let y = 0; y < totalHeight; y += 3) {
    ctx.fillRect(0, y, CANVAS_W, 1);
  }

  // Header strip at top.
  ctx.fillStyle = "rgba(77, 255, 170, 0.08)";
  ctx.fillRect(0, 0, CANVAS_W, 26);
  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.fillStyle = "#4dffaa";
  ctx.textBaseline = "middle";
  ctx.fillText("// COUNCIL CHANNEL · 4 PARTICIPANTS · LIVE", PADDING_X, 13);

  // Messages.
  let y = PADDING_Y + 18; // leave room for the header strip
  ctx.textBaseline = "alphabetic";

  wrappedMessages.forEach((msg) => {
    const speaker = SPEAKERS[msg.s];

    // Speaker tag.
    ctx.font = TAG_FONT;
    ctx.fillStyle = speaker.color;
    ctx.fillText(`[${speaker.name}]`, PADDING_X, y + TAG_HEIGHT - 3);

    // Message body.
    ctx.font = BODY_FONT;
    ctx.fillStyle = "#d4e8d8";
    let bodyY = y + TAG_HEIGHT + BODY_LINE_HEIGHT - 4;
    for (const line of msg.lines) {
      ctx.fillText(line, PADDING_X, bodyY);
      bodyY += BODY_LINE_HEIGHT;
    }

    // Faint separator under each message.
    ctx.fillStyle = "rgba(77, 255, 170, 0.08)";
    ctx.fillRect(PADDING_X, y + msg.blockHeight - 6, CANVAS_W - PADDING_X * 2, 1);

    y += msg.blockHeight;
  });

  return canvas;
}

// ---------- Component ----------

export default function CouncilChatScreens() {
  const { scene } = useThree();
  const texturesRef = useRef([]); // [{ name, texture }]
  const canvasRef = useRef(null);
  const initializedRef = useRef(false);

  // Build the canvas once on mount.
  useEffect(() => {
    canvasRef.current = buildChatCanvas();
    return () => {
      texturesRef.current.forEach(({ texture }) => texture.dispose());
      texturesRef.current = [];
      canvasRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  // Poll the scene each frame until all four ScreenA-D meshes are present,
  // then attach textures (the GLB loads asynchronously inside CyborgTempleScene
  // so a one-shot useEffect can race the model loader).
  useFrame((_, delta) => {
    if (!initializedRef.current && scene && canvasRef.current) {
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
        console.log("[CouncilChat] screen-like meshes in scene:", seenScreenLikeNames);
        console.log("[CouncilChat] looking for:", screenNames);
      }

      if (found.length > 0) {
        for (const mesh of found) {
          if (texturesRef.current.find((t) => t.name === mesh.name)) continue;

          const tex = new THREE.CanvasTexture(canvasRef.current);
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

        // Mark initialized once we've found at least one screen and all four
        // are accounted for. If a screen isn't in the GLB it'll never appear,
        // so settle after we've made one full pass with the meshes present.
        if (texturesRef.current.length === screenNames.length) {
          initializedRef.current = true;
        } else if (texturesRef.current.length > 0) {
          // Found some but not all — give it a few more frames in case the
          // remaining meshes are still being parsed; otherwise stop trying.
          // We piggyback on the same flag and retry naturally next frame.
        }
      }
    }

    // Slow scroll — same speed across screens, distinct starting offsets keep
    // them phase-shifted so the four screens never show the same line.
    const step = delta / SCROLL_PERIOD_SECONDS;
    for (const { texture } of texturesRef.current) {
      texture.offset.y = (texture.offset.y + step) % 1;
    }
  });

  return null;
}
