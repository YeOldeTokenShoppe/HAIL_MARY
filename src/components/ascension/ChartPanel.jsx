"use client";
// The big upright price-chart panel behind the track. ONE shared chart with all
// racers' lines overlaid (X = turn/time, Y = step toward the moon). Each line is
// the racer's identity color; the turn's active racer renders vivid (bright +
// glow + head label), the rest muted. Event flavor stays readable via markers:
// a red ring on a rug (down) candle, an amber diamond on a Resurrection
// (miracle). This is a *readout* of the race, not the terrain.
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { TRACK_LENGTH } from "@/game/ascension/config";

const CW = 1024;
const CH = 512;

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function drawChart(ctx, race) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = "#05080c";
  ctx.fillRect(0, 0, CW, CH);

  const x0 = 64;
  const y0 = 46;
  const w = CW - x0 - 30;
  const h = CH - y0 - 46;
  const plotTop = y0;
  const plotBot = y0 + h;

  // Stable X span so lines fill in left→right without rescaling each turn.
  const xMax = Math.max(race.deck.length + 1, 2);
  const tToX = (t) => x0 + (t / xMax) * w;
  const stepToY = (s) => plotBot - (s / TRACK_LENGTH) * h;

  // frame + step gridlines
  ctx.strokeStyle = "rgba(120,140,150,0.18)";
  ctx.lineWidth = 1;
  for (let s = 0; s <= TRACK_LENGTH; s += 2) {
    const y = stepToY(s);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + w, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(160,176,186,0.5)";
    ctx.font = "13px monospace";
    ctx.fillText(String(s), x0 - 26, y + 4);
  }

  // MOON target line
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "rgba(223,243,255,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, stepToY(TRACK_LENGTH));
  ctx.lineTo(x0 + w, stepToY(TRACK_LENGTH));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(223,243,255,0.8)";
  ctx.font = "bold 14px monospace";
  ctx.fillText("🌙 MOON", x0 + w - 96, stepToY(TRACK_LENGTH) - 8);

  // title
  ctx.fillStyle = "#8effc4";
  ctx.font = "bold 16px monospace";
  ctx.fillText("PRICE — RACE TO THE MOON", x0, 28);

  // Draw muted racers first, active one last (on top).
  const racers = Object.values(race.racers);
  const ordered = [
    ...racers.filter((r) => r.id !== race.activeId),
    ...racers.filter((r) => r.id === race.activeId),
  ];

  ordered.forEach((r) => {
    const active = r.id === race.activeId;
    const a = active ? 1 : 0.32;
    const color = r.color || "#8a8f98";

    // line
    ctx.strokeStyle = withAlpha(color, a);
    ctx.lineWidth = active ? 4 : 2;
    if (active) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    r.history.forEach((p, i) => {
      const x = tToX(p.t);
      const y = stepToY(p.step);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // event markers
    r.history.forEach((p) => {
      const x = tToX(p.t);
      const y = stepToY(p.step);
      if (p.kind === "down") {
        ctx.strokeStyle = withAlpha("#ff5a6a", a);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "miracle") {
        ctx.fillStyle = withAlpha("#ffcb74", a);
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x - 6, y);
        ctx.closePath();
        ctx.fill();
      }
    });

    // head dot + label
    const last = r.history[r.history.length - 1];
    const hx = tToX(last.t);
    const hy = stepToY(last.step);
    ctx.fillStyle = withAlpha(color, a);
    ctx.beginPath();
    ctx.arc(hx, hy, active ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = active ? "bold 15px monospace" : "13px monospace";
    ctx.fillStyle = withAlpha(active ? "#eafff5" : color, a);
    ctx.fillText(r.name + (active ? "  ● LIVE" : ""), hx + 10, hy - 8);
  });
}

export default function ChartPanel({ race, position = [0, 0, 0], width = 12, height = 6 }) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = CW;
    c.height = CH;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    drawChart(ctx, race);
    texture.needsUpdate = true;
  }, [race, canvas, texture]);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  );
}
