"use client";
// The talk-show set's frame screen (`Content_Screen`) as the LT TV channel
// display: on the lineup it cycles a card per show, with a burst of static
// between cards. Drawn into a canvas, so the lineup costs no downloads and a
// new show appears as soon as it's in SHOWS.
//
// ON THE NEWS SET IT IS THE STUDIO SCREEN, carrying a card per chapter of the
// episode — the running order in the cold open, the beat and the story's one
// concrete fact while that story runs, the numbers listed as a board when the
// hosts read the board. The deck is the same canvas and the same inks, so the
// accompanying graphics cost no art and no downloads either: a card is the
// copy the script already wrote, set in type. Which card is up is not this
// module's decision — the set owns the clock, and passes `indexRef`.
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
  body: "#efe7f7",
  note: "#ffc096",
};

function clampIndex(index, length) {
  return Math.min(Math.max(Math.trunc(index) || 0, 0), Math.max(length - 1, 0));
}

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

// Greedy word wrap at a fixed size, for body copy that may run to several
// lines. Unlike fitTitle this never shrinks the type — a studio screen read
// from a chair across the set has a floor below which copy is decoration.
function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  String(text).split(" ").forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  return lines;
}

// The body copy's type size, chosen so that ALL of it fits between the
// headline and the note.
//
// This shrinks rather than truncates, and that is the whole point of it. The
// board card is a list of the week's numbers, and the first version of this
// laid it out at a fixed size and stopped drawing when it ran out of room —
// which quietly dropped the last number off a card whose entire job is to
// show the numbers. A viewer cannot tell a dropped line from a line the show
// never had. Small type is a worse card; a missing number is a wrong one.
const BODY_MAX = 25;
const BODY_MIN = 16;

function fitBody(ctx, entries, maxWidth, maxHeight) {
  const clean = (entries || []).map((entry) => String(entry).trim()).filter(Boolean);
  let attempt = { size: BODY_MIN, lineHeight: 22, gap: 10, blocks: [] };
  for (let size = BODY_MAX; size >= BODY_MIN; size -= 1) {
    ctx.font = `500 ${size}px Orbitron, sans-serif`;
    const lineHeight = Math.round(size * 1.36);
    const gap = Math.round(size * 0.64);
    const blocks = clean.map((entry) => wrap(ctx, entry, maxWidth));
    const height =
      blocks.reduce((sum, block) => sum + block.length * lineHeight, 0) +
      gap * Math.max(blocks.length - 1, 0);
    attempt = { size, lineHeight, gap, blocks };
    if (height <= maxHeight) break;
  }
  return attempt;
}

// A chapter of the episode, as the studio screen behind the hosts shows it:
// the beat on a plate, that chapter's headline, and whatever the script
// already wrote down underneath — the running order in the cold open, the
// story's one concrete fact while a story runs, the board's numbers listed
// out when the hosts read the board.
//
// EVERYTHING HERE IS COPY THE EPISODE ALREADY CARRIES. Nothing is invented at
// draw time and nothing is fetched, which is what makes these graphics free:
// the same rule the show's own verification pass runs on applies to the thing
// on screen behind it.
function drawChapterCard(ctx, card) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, INK.bgTop);
  bg.addColorStop(1, INK.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.font = '700 28px Orbitron, "Arial Black", sans-serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "10px";
  ctx.fillStyle = INK.channel;
  ctx.shadowColor = INK.channelGlow;
  ctx.shadowBlur = 14;
  ctx.fillText("LT TV", W / 2 + 5, 74);
  ctx.restore();

  ctx.fillStyle = INK.rule;
  ctx.fillRect(W / 2 - 70, 106, 140, 3);

  // The beat plate, filled in the same hot ink as the chiron's, so the screen
  // and the lower third read as one package rather than two graphics.
  let y = 170;
  const kicker = String(card.kicker || "").trim();
  if (kicker) {
    ctx.save();
    ctx.font = '700 22px Orbitron, "Arial Black", sans-serif';
    if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
    const label = kicker.toUpperCase();
    const plateW = Math.min(W - 120, ctx.measureText(label).width + 48);
    ctx.fillStyle = INK.format;
    ctx.shadowColor = INK.format;
    ctx.shadowBlur = 12;
    ctx.fillRect(W / 2 - plateW / 2, y - 22, plateW, 44);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#12040f";
    ctx.fillText(label, W / 2 + 3, y + 1);
    ctx.restore();
    y += 76;
  }

  const { size, lines } = fitTitle(ctx, String(card.headline || "").toUpperCase(), W - 130, 4, 52);
  const lineHeight = size * 1.14;
  ctx.save();
  ctx.fillStyle = INK.title;
  ctx.shadowColor = INK.titleGlow;
  ctx.shadowBlur = 10;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, y + i * lineHeight));
  ctx.restore();
  y += (lines.length - 1) * lineHeight + size * 0.6 + 54;

  // The note is pinned to the bottom, so it is measured BEFORE the body: it is
  // what decides how much room the body has to fit in.
  const NOTE_LINE = 29;
  ctx.font = '500 21px Orbitron, sans-serif';
  const noteLines = card.note ? wrap(ctx, String(card.note), W - 130).slice(0, 3) : [];
  const noteTop = noteLines.length ? H - 76 - (noteLines.length - 1) * NOTE_LINE : H - 56;

  const body = fitBody(ctx, card.lines, W - 130, noteTop - 28 - y);
  ctx.save();
  ctx.font = `500 ${body.size}px Orbitron, sans-serif`;
  ctx.fillStyle = INK.body;
  // Each entry is its own paragraph — a board line and a story's fact are both
  // one sentence, and running them together would read as prose.
  for (const block of body.blocks) {
    for (const line of block) {
      if (y > noteTop - 28) {
        // Only reachable when even BODY_MIN could not fit the copy, which
        // means a card carrying far more than a card should. Say so on screen
        // rather than ending mid-thought.
        ctx.fillText("…", W / 2, y);
        y = Infinity;
        break;
      }
      ctx.fillText(line, W / 2, y);
      y += body.lineHeight;
    }
    if (!Number.isFinite(y)) break;
    y += body.gap;
  }
  ctx.restore();

  if (noteLines.length) {
    ctx.save();
    ctx.font = '500 21px Orbitron, sans-serif';
    ctx.fillStyle = INK.note;
    noteLines.forEach((line, i) => ctx.fillText(line, W / 2, noteTop + i * NOTE_LINE));
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let scan = 0; scan < H; scan += 4) ctx.fillRect(0, scan, W, 1);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/**
 * One deck, two kinds of card: the lineup's shows and an episode's chapters.
 * Exported as the single way to draw one, so a preview draws exactly what the
 * screen does rather than a second copy of the layout that drifts from it.
 */
export function drawScreenCard(ctx, card) {
  if (card?.kind === "chapter") drawChapterCard(ctx, card);
  else drawCard(ctx, card);
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
 * (as the set ships) when `cards` is null.
 *
 * Two decks, told apart by the cards themselves: the lineup's shows
 * ({ title, format, latest }) and an episode's chapters
 * ({ kind: "chapter", kicker, headline, lines, note }).
 *
 * `indexRef` is how the set drives the deck. Given one, the screen shows
 * whatever card that ref points at and cuts to the next through the same burst
 * of static; without one it cycles on a timer, which is what the lineup wants.
 * A REF AND NOT A PROP ON PURPOSE: the index changes from inside the frame
 * loop as the episode moves from chapter to chapter, and routing that through
 * React state would re-render the whole set several times an episode to change
 * a texture this hook owns anyway.
 */
export function useChannelScreen(root, cards, { indexRef = null } = {}) {
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

    const start = clampIndex(indexRef?.current ?? 0, cards.length);
    const state = { ctx, noise, noiseCtx, texture, cards, indexRef, index: start, phase: "card", phaseStart: 0, frame: 0 };
    stateRef.current = state;
    drawScreenCard(ctx, cards[start]);
    texture.needsUpdate = true;

    // Canvas text falls back until Orbitron is ready; repaint the card once it is.
    let alive = true;
    document.fonts?.load('800 64px Orbitron').then(() => {
      if (!alive || state.phase !== "card") return;
      drawScreenCard(ctx, cards[state.index]);
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
  }, [root, cards, indexRef]);

  useFrame(({ clock }) => {
    const s = stateRef.current;
    if (!s) return;
    const t = clock.elapsedTime;
    if (!s.phaseStart) s.phaseStart = t;
    const age = t - s.phaseStart;
    // A driven deck cuts when the set says so; an undriven one cuts on a timer
    // and a single card never cuts at all.
    const driven = Boolean(s.indexRef);
    const wanted = driven ? clampIndex(s.indexRef.current ?? 0, s.cards.length) : -1;

    if (s.phase === "card") {
      const due = driven ? wanted !== s.index : s.cards.length > 1 && age >= CARD_SECONDS;
      if (!due) return;
      s.phase = "static";
      s.phaseStart = t;
      return;
    }

    if (age >= STATIC_SECONDS) {
      s.phase = "card";
      s.phaseStart = t;
      // Read the wanted card on the way OUT of the burst, not on the way in:
      // a chapter that turns over during the static (a very short segment)
      // lands on the one that is actually on air rather than the one that was.
      s.index = driven ? clampIndex(s.indexRef.current ?? 0, s.cards.length) : (s.index + 1) % s.cards.length;
      drawScreenCard(s.ctx, s.cards[s.index]);
      s.texture.needsUpdate = true;
      return;
    }
    // Static repaints every other frame; a card is drawn once per phase.
    s.frame = (s.frame + 1) % 2;
    if (s.frame === 0) {
      drawStatic(s.ctx, s.noise, s.noiseCtx, age);
      s.texture.needsUpdate = true;
    }
  });
}
