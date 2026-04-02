"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

// ─── Math helpers (from pokemon-cards-css) ───────────────────────────
const round = (v: number, p = 3) => parseFloat(v.toFixed(p));
const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const adjust = (v: number, fMin: number, fMax: number, tMin: number, tMax: number) =>
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

// ─── Spring physics ──────────────────────────────────────────────────
interface SpringConfig {
  stiffness: number;
  damping: number;
}

interface SpringState {
  value: number;
  velocity: number;
  target: number;
}

const INTERACT: SpringConfig = { stiffness: 0.066, damping: 0.25 };
const SNAP_BACK: SpringConfig = { stiffness: 0.01, damping: 0.06 };

function stepSpring(s: SpringState, cfg: SpringConfig): SpringState {
  const delta = s.target - s.value;
  const acceleration = delta * cfg.stiffness;
  const newVelocity = (s.velocity + acceleration) * (1 - cfg.damping);
  return { ...s, value: s.value + newVelocity, velocity: newVelocity };
}

function useSpring(keys: string[], initial: Record<string, number>) {
  const springs = useRef<Record<string, SpringState>>({});
  const config = useRef<SpringConfig>(INTERACT);
  const raf = useRef<number>(0);
  const [values, setValues] = useState(initial);

  // initialise once
  if (Object.keys(springs.current).length === 0) {
    for (const k of keys) {
      springs.current[k] = { value: initial[k], velocity: 0, target: initial[k] };
    }
  }

  const tick = useCallback(() => {
    let settled = true;
    const next: Record<string, number> = {};
    for (const k of keys) {
      const s = springs.current[k];
      const updated = stepSpring(s, config.current);
      springs.current[k] = updated;
      next[k] = updated.value;
      if (Math.abs(updated.velocity) > 0.001 || Math.abs(updated.target - updated.value) > 0.01) {
        settled = false;
      }
    }
    setValues(next);
    if (!settled) {
      raf.current = requestAnimationFrame(tick);
    }
  }, [keys]);

  const set = useCallback(
    (targets: Record<string, number>, cfg?: SpringConfig) => {
      if (cfg) config.current = cfg;
      for (const k of keys) {
        if (targets[k] !== undefined) {
          springs.current[k].target = targets[k];
        }
      }
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(tick);
    },
    [keys, tick]
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return { values, set };
}

// ─── Component ───────────────────────────────────────────────────────

/*
 * REPLACE THIS with your own card artwork URL.
 * Ideal dimensions: 660 × 921 px (or any image with ~0.718 aspect ratio).
 */
const CARD_IMAGE = "https://images.pokemontcg.io/swsh12pt5/16_hires.png";

/*
 * REPLACE THIS with a path to a glitter/noise texture, or set to "" to skip.
 * A small tileable sparkle PNG works best (the original used /img/glitter.png).
 */
const GLITTER_IMAGE = "";

/*
 * Card glow color — change to complement your artwork.
 * The original project maps this per Pokémon type (water → cyan, fire → red, etc.)
 */
const CARD_GLOW = "hsl(175, 100%, 90%)";
const CARD_EDGE = "hsl(47, 100%, 78%)";

export default function RadiantHoloPage() {
  const cardRef = useRef<HTMLDivElement>(null);

  const SPRING_KEYS = ["rx", "ry", "gx", "gy", "go", "bx", "by"];
  const INITIAL = { rx: 0, ry: 0, gx: 50, gy: 50, go: 0, bx: 50, by: 50 };
  const { values: s, set } = useSpring(SPRING_KEYS, INITIAL);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const absX = e.clientX - rect.left;
      const absY = e.clientY - rect.top;
      const pctX = clamp(round((100 / rect.width) * absX));
      const pctY = clamp(round((100 / rect.height) * absY));
      const centerX = pctX - 50;
      const centerY = pctY - 50;

      set(
        {
          bx: adjust(pctX, 0, 100, 37, 63),
          by: adjust(pctY, 0, 100, 33, 67),
          rx: round(-(centerX / 3.5)),
          ry: round(centerY / 2),
          gx: round(pctX),
          gy: round(pctY),
          go: 1,
        },
        INTERACT
      );
    },
    [set]
  );

  const onPointerLeave = useCallback(() => {
    set({ rx: 0, ry: 0, gx: 50, gy: 50, go: 0, bx: 50, by: 50 }, SNAP_BACK);
  }, [set]);

  const cssVars = {
    "--pointer-x": `${s.gx}%`,
    "--pointer-y": `${s.gy}%`,
    "--rotate-x": `${s.rx}deg`,
    "--rotate-y": `${s.ry}deg`,
    "--background-x": `${s.bx}%`,
    "--background-y": `${s.by}%`,
    "--card-opacity": s.go,
    "--card-glow": CARD_GLOW,
    "--card-edge": CARD_EDGE,
    "--glitter": GLITTER_IMAGE ? `url(${GLITTER_IMAGE})` : "none",
  } as React.CSSProperties;

  return (
    <main className={styles.scene}>
      <div className={styles.card} ref={cardRef} style={cssVars}>
        <div className={styles.translater}>
          <button
            className={styles.rotator}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
          >
            <img
              className={styles.cardImage}
              src={CARD_IMAGE}
              alt="Holographic card artwork"
              draggable={false}
              width={660}
              height={921}
            />
            <div className={styles.shine} />
            <div className={styles.glare} />
          </button>
        </div>
      </div>

      <p className={styles.hint}>Move your cursor over the card</p>
    </main>
  );
}
