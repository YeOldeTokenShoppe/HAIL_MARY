"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

// ─── Math helpers ────────────────────────────────────────────────────
const round = (v: number, p = 3) => parseFloat(v.toFixed(p));
const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const adjust = (v: number, fMin: number, fMax: number, tMin: number, tMax: number) =>
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

// ─── Spring physics ──────────────────────────────────────────────────
interface SpringConfig { stiffness: number; damping: number }
interface SpringState { value: number; velocity: number; target: number }

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

  if (Object.keys(springs.current).length === 0) {
    for (const k of keys) {
      springs.current[k] = { value: initial[k], velocity: 0, target: initial[k] };
    }
  }

  const tick = useCallback(() => {
    let settled = true;
    const next: Record<string, number> = {};
    for (const k of keys) {
      const updated = stepSpring(springs.current[k], config.current);
      springs.current[k] = updated;
      next[k] = updated.value;
      if (Math.abs(updated.velocity) > 0.001 || Math.abs(updated.target - updated.value) > 0.01) {
        settled = false;
      }
    }
    setValues(next);
    if (!settled) raf.current = requestAnimationFrame(tick);
  }, [keys]);

  const set = useCallback(
    (targets: Record<string, number>, cfg?: SpringConfig) => {
      if (cfg) config.current = cfg;
      for (const k of keys) {
        if (targets[k] !== undefined) springs.current[k].target = targets[k];
      }
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(tick);
    },
    [keys, tick]
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { values, set };
}

// ─── Luminance-to-alpha mask converter ───────────────────────────────
function useAlphaMask(src: string) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = Math.round(lum);
      }
      ctx.putImageData(imageData, 0, 0);
      setDataUrl(canvas.toDataURL("image/png"));
    };
    img.src = src;
  }, [src]);

  return dataUrl;
}

// ─── Configuration ───────────────────────────────────────────────────

/* Card artwork — the character image placed in the art window */
const ART_IMAGE = "/images/mainImage.png";

/* Optional glitter texture */
const GLITTER_IMAGE = "/images/glitter.png";

/* Optional mask image (white = holo, black = hidden) */
const MASK_IMAGE = "/images/mask.png";

/* Glow colors */
const CARD_GLOW = "hsl(9, 95%, 55%)";
const CARD_EDGE = "hsl(40, 100%, 70%)";

/* Card border / frame color */
const CARD_FRAME = "hsl(47, 85%, 65%)";

/* Energy type icon — replace with your own icon or emoji */
const ENERGY_ICON = "\u{1F525}"; /* fire emoji as placeholder */

export default function HyperHoloPage() {
  const SPRING_KEYS = ["rx", "ry", "gx", "gy", "go", "bx", "by"];
  const INITIAL = { rx: 0, ry: 0, gx: 50, gy: 50, go: 0, bx: 50, by: 50 };
  const { values: s, set } = useSpring(SPRING_KEYS, INITIAL);

  const alphaMask = useAlphaMask(MASK_IMAGE);
  const masked = !!alphaMask;

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pctX = clamp(round((100 / rect.width) * (e.clientX - rect.left)));
      const pctY = clamp(round((100 / rect.height) * (e.clientY - rect.top)));
      const centerX = pctX - 50;
      const centerY = pctY - 50;

      set({
        bx: adjust(pctX, 0, 100, 37, 63),
        by: adjust(pctY, 0, 100, 33, 67),
        rx: round(-(centerX / 3.5)),
        ry: round(centerY / 2),
        gx: round(pctX),
        gy: round(pctY),
        go: 1,
      }, INTERACT);
    },
    [set]
  );

  const onPointerLeave = useCallback(() => {
    set({ rx: 0, ry: 0, gx: 50, gy: 50, go: 0, bx: 50, by: 50 }, SNAP_BACK);
  }, [set]);

  const pointerFromCenter = clamp(
    Math.sqrt((s.gy - 50) ** 2 + (s.gx - 50) ** 2) / 50, 0, 1
  );

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
    "--card-frame": CARD_FRAME,
    "--pointer-from-center": pointerFromCenter,
    "--pointer-from-left": s.gx / 100,
    "--pointer-from-top": s.gy / 100,
    "--glitter": GLITTER_IMAGE ? `url(${GLITTER_IMAGE})` : "none",
    "--mask": masked ? `url(${alphaMask})` : "none",
  } as React.CSSProperties;

  return (
    <main className={styles.scene}>
      <div className={`${styles.card} ${masked ? styles.masked : ""}`} style={cssVars}>
        <div className={styles.translater}>
          <div
            className={styles.rotator}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
          >
            {/* ── Card face (HTML layout) ─────────────────────── */}
            <div className={styles.cardFace}>

              {/* TOP: stage badge + name + HP + type */}
              <div className={styles.topBar}>
                <span className={styles.stage}>BASIC</span>
                <span className={styles.cardName}>Card Name</span>
                <span className={styles.hp}>
                  <span className={styles.hpLabel}>HP</span>
                  <span className={styles.hpValue}>160</span>
                  <span className={styles.typeIcon}>{ENERGY_ICON}</span>
                </span>
              </div>

              {/* ART WINDOW */}
              <div className={styles.artWindow}>
                <img
                  className={styles.artImage}
                  src={ART_IMAGE}
                  alt="Card artwork"
                  draggable={false}
                />
              </div>

              {/* RULE BOX (e.g. "Radiant Pokemon Rule") */}
              <div className={styles.ruleBox}>
                <span className={styles.ruleLabel}>Radiant Rule</span>
                <p className={styles.ruleText}>
                  You can&apos;t have more than 1 Radiant card in your deck.
                </p>
              </div>

              {/* ABILITY */}
              <div className={styles.abilitySection}>
                <div className={styles.abilityHeader}>
                  <span className={styles.abilityBadge}>Ability</span>
                  <span className={styles.abilityName}>Ability Name</span>
                </div>
                <p className={styles.abilityText}>
                  Ability description goes here. Replace with your own text.
                </p>
              </div>

              {/* ATTACK */}
              <div className={styles.attackSection}>
                <div className={styles.attackHeader}>
                  <span className={styles.energyCost}>
                    <span className={styles.energyOrb} />
                    <span className={styles.energyOrb} />
                    <span className={styles.energyOrb} />
                  </span>
                  <span className={styles.attackName}>Attack Name</span>
                  <span className={styles.attackDamage}>250</span>
                </div>
                <p className={styles.attackText}>
                  Attack description goes here. Replace with your own text.
                </p>
              </div>

              {/* BOTTOM STATS: weakness / resistance / retreat */}
              <div className={styles.statsBar}>
                <div className={styles.statBlock}>
                  <span className={styles.statLabel}>weakness</span>
                  <span className={styles.statValue}>
                    <span className={styles.energyOrb} /> x2
                  </span>
                </div>
                <div className={styles.statBlock}>
                  <span className={styles.statLabel}>resistance</span>
                  <span className={styles.statValue}>&mdash;</span>
                </div>
                <div className={styles.statBlock}>
                  <span className={styles.statLabel}>retreat</span>
                  <span className={styles.statValue}>
                    <span className={styles.energyOrb} />
                    <span className={styles.energyOrb} />
                  </span>
                </div>
              </div>

              {/* FOOTER: illus / set info / flavor text */}
              <div className={styles.footer}>
                <div className={styles.footerLeft}>
                  <span className={styles.illustrator}>Illus. Artist Name</span>
                  <span className={styles.setInfo}>001/100</span>
                </div>
                <p className={styles.flavorText}>
                  Flavor text goes here. A short description of the creature.
                </p>
              </div>
            </div>

            {/* ── Holo effect layers ──────────────────────────── */}
            <div className={styles.shine} />
            <div className={styles.rainbowFlood} />
            <div className={styles.glare} />
          </div>
        </div>
      </div>

      <p className={styles.hint}>Move your cursor over the card</p>
    </main>
  );
}
