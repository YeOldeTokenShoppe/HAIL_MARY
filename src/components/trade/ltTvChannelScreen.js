"use client";
// The talk-show set's frame screen (`Content_Screen`) as the LT TV channel
// display: on the lineup it cycles a card per show, with a burst of static
// between cards. Drawn into a canvas, so the lineup costs no downloads and a
// new show appears as soon as it's in SHOWS.
//
// The screen is a portrait quad (~0.69:1) whose UVs cover a centred sub-rect
// of 0–1, authored glTF-style (v = 0 at the image top). The texture is fitted
// to that sub-rect from the geometry itself, so a re-export can't stretch it.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const W = 552;
const H = 800;
const CARD_SECONDS = 6;
const STATIC_SECONDS = 1.1;
const NOISE_W = 92;
const NOISE_H = 133;
// Above 1 on purpose: the unlit screen renders brighter than white so the
// page's Bloom (threshold 0.3) catches the lit type the way it catches the neon
// frame. The card's dark ground stays under the threshold, so only type glows.
const GLOW = 1.08;
// Static peaks lower than the cards, or a full screen of it blooms into a flare.
const STATIC_PEAK = 170;

// Inks from the /trade palette (see the LT TV console and chiron).
const INK = {
  bgTop: "#140a26",
  bgBottom: "#06040d",
  channel: "#ffc096",
  channelGlow: "rgba(255,119,192,0.8)",
  rule: "#ef62dc",
  title: "#8feeff",
  titleGlow: "rgba(32,215,242,0.75)",
  format: "#ef62dc",
  latest: "#8effc4",
  soon: "#ffcb74",
};

function uvBounds(geometry) {
  const uv = geometry.attributes.uv;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < uv.count; i += 1) {
    u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i));
    v0 = Math.min(v0, uv.getY(i)); v1 = Math.max(v1, uv.getY(i));
  }
  return { u0, u1, v0, v1 };
}

// Greedy word wrap, shrinking the type until the title fits in `maxLines`.
function fitTitle(ctx, text, maxWidth, maxLines, maxSize = 68) {
  for (let size = maxSize; size >= 20; size -= 2) {
    ctx.font = `800 ${size}px Orbitron, "Arial Black", sans-serif`;
    const lines = [];
    let line = "";
    // "&" rides with the next word so it never sits alone on a line.
    text.replace(/ & /g, " &\u00a0").split(" ").forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) line = next;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { size, lines };
    }
  }
  return { size: 30, lines: [text] };
}

function drawCard(ctx, card) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, INK.bgTop);
  bg.addColorStop(1, INK.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.font = '700 40px Orbitron, "Arial Black", sans-serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "12px";
  ctx.fillStyle = INK.channel;
  ctx.shadowColor = INK.channelGlow;
  ctx.shadowBlur = 16;
  ctx.fillText("LT TV", W / 2 + 6, 96);
  ctx.restore();

  ctx.fillStyle = INK.rule;
  ctx.fillRect(W / 2 - 70, 138, 140, 3);

  // The neon frame's inner border overlaps the quad's edges (and the screen is
  // tilted), so titles keep ~75px clear on each side.
  const { size, lines } = fitTitle(ctx, card.title.toUpperCase(), W - 150, 3);
  const lineHeight = size * 1.12;
  const top = 340 - ((lines.length - 1) * lineHeight) / 2;
  ctx.save();
  ctx.fillStyle = INK.title;
  ctx.shadowColor = INK.titleGlow;
  ctx.shadowBlur = 10;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lineHeight));
  ctx.restore();

  ctx.save();
  ctx.font = '700 24px Orbitron, "Arial Black", sans-serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
  ctx.fillStyle = INK.format;
  ctx.fillText(card.format.toUpperCase(), W / 2 + 3, top + (lines.length - 1) * lineHeight + size * 0.5 + 52);
  ctx.restore();

  if (card.episodeTitle) {
    const episode = fitTitle(ctx, card.episodeTitle, W - 120, 2, 28);
    ctx.save();
    ctx.font = `600 ${episode.size}px Orbitron, sans-serif`;
    ctx.fillStyle = "#f7f4fa";
    episode.lines.forEach((line, i) => ctx.fillText(line, W / 2, 563 + i * 32));
    ctx.restore();
  }

  const soon = !card.latest;
  const tag = soon ? "COMING SOON" : card.latest;
  const ink = soon ? INK.soon : INK.latest;
  ctx.save();
  ctx.font = '700 24px Orbitron, "Arial Black", sans-serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "5px";
  const tagW = ctx.measureText(tag).width + 56;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.shadowColor = ink;
  ctx.shadowBlur = 10;
  ctx.strokeRect(W / 2 - tagW / 2, 640, tagW, 64);
  ctx.fillStyle = ink;
  ctx.fillText(tag, W / 2 + 2, 673);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawStatic(ctx, noise, noiseCtx, t) {
  const img = noiseCtx.createImageData(NOISE_W, NOISE_H);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * STATIC_PEAK;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  noiseCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  // A slow rolling bar and a faint magenta cast keep it from reading as grey.
  const barY = ((t * 0.9) % 1) * (H + 160) - 80;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, barY, W, 60);
  ctx.fillStyle = "rgba(239,98,220,0.10)";
  ctx.fillRect(0, 0, W, H);
}

/**
 * Drives `Content_Screen` under `root` while `cards` is non-null; hides it
 * (as the set ships) when `cards` is null. Cards: { title, format, latest }.
 */
export function useChannelScreen(root, cards) {
  const stateRef = useRef(null);

  useEffect(() => {
    const screen = root?.getObjectByName("Content_Screen");
    if (!screen?.isMesh || !cards?.length) return undefined;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const noise = document.createElement("canvas");
    noise.width = NOISE_W;
    noise.height = NOISE_H;
    const noiseCtx = noise.getContext("2d");

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    const { u0, u1, v0, v1 } = uvBounds(screen.geometry);
    texture.repeat.set(1 / (u1 - u0), 1 / (v1 - v0));
    texture.offset.set(-u0 / (u1 - u0), -v0 / (v1 - v0));

    const original = screen.material;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    material.color.setScalar(GLOW);
    screen.material = material;
    screen.visible = true;

    const state = { ctx, noise, noiseCtx, texture, cards, index: 0, phase: "card", phaseStart: 0, frame: 0 };
    stateRef.current = state;
    drawCard(ctx, cards[0]);
    texture.needsUpdate = true;

    // Canvas text falls back until Orbitron is ready; repaint the card once it is.
    let alive = true;
    document.fonts?.load('800 64px Orbitron').then(() => {
      if (!alive || state.phase !== "card") return;
      drawCard(ctx, cards[state.index]);
      texture.needsUpdate = true;
    }).catch(() => {});

    return () => {
      alive = false;
      stateRef.current = null;
      screen.material = original;
      screen.visible = false;
      material.dispose();
      texture.dispose();
    };
  }, [root, cards]);

  useFrame(({ clock }) => {
    const s = stateRef.current;
    if (!s || s.cards.length < 2) return;
    const t = clock.elapsedTime;
    if (!s.phaseStart) s.phaseStart = t;
    const age = t - s.phaseStart;
    if (s.phase === "card" && age >= CARD_SECONDS) {
      s.phase = "static";
      s.phaseStart = t;
    } else if (s.phase === "static" && age >= STATIC_SECONDS) {
      s.phase = "card";
      s.phaseStart = t;
      s.index = (s.index + 1) % s.cards.length;
      drawCard(s.ctx, s.cards[s.index]);
      s.texture.needsUpdate = true;
      return;
    }
    // Static repaints every other frame; a card is drawn once per phase.
    if (s.phase === "static") {
      s.frame = (s.frame + 1) % 2;
      if (s.frame === 0) {
        drawStatic(s.ctx, s.noise, s.noiseCtx, age);
        s.texture.needsUpdate = true;
      }
    }
  });
}
