"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db, doc, getDoc } from "@/lib/firebaseClient";
import { intentionText } from "@/lib/intentions";

// Below-the-fold wall of the community's currently-burning votives, fed
// by the same live shrineCandles subscription that powers the VigilTicker.
// Pure DOM + CSS on purpose: the hero scene already owns this page's GPU
// budget, and iOS Safari kills tabs that stack WebGL contexts. CSS flames
// read plenty alive at card size.
//
// Each card personalizes from the holder's shrineCandlePrefs doc (saint
// image + wax tint). Custom-upload images are stored as data: URLs up to
// ~900KB, so only preset PATHS are used here — a wall of two dozen cards
// must not pull megabytes of strangers' selfies. Uploads fall back to
// the default saint.

const MAX_CARDS = 24;
const DEFAULT_SAINT = "/images/nuestraSenora.webp";
// The votive GLB's authored wax is a saturated green — used when the
// holder hasn't picked a tint.
const DEFAULT_WAX = "#1fae5a";

function timeAgoShort(ms, now) {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "just lit";
  const m = Math.floor(s / 60);
  if (m < 60) return `burning ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `burning ${h}h`;
  return `burning ${Math.floor(h / 24)}d`;
}

export default function VigilWall({ candles = [] }) {
  const shown = useMemo(() => candles.slice(0, MAX_CARDS), [candles]);

  // Slow clock for the "burning Xh" labels.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Per-holder customization, fetched once per id and cached for the
  // session. `undefined` = not yet fetched, `null` = fetched, no prefs.
  // The missing-ids guard makes the effect self-terminating even though
  // it writes the state it depends on.
  const [prefsById, setPrefsById] = useState({});
  useEffect(() => {
    if (!db) return undefined;
    const missing = shown.filter((c) => prefsById[c.id] === undefined);
    if (missing.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (c) => {
          try {
            const snap = await getDoc(doc(db, "shrineCandlePrefs", c.id));
            return [c.id, snap.exists() ? snap.data() : null];
          } catch {
            return [c.id, null];
          }
        }),
      );
      if (!cancelled) {
        setPrefsById((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shown, prefsById]);

  if (shown.length === 0) return null;

  return (
    <section className="vigil-wall" aria-label="Burning community candles">
      <header className="vigil-wall-header">
        <h2 className="vigil-wall-title">The Vigil</h2>
        <p className="vigil-wall-sub">
          {candles.length} flame{candles.length === 1 ? "" : "s"} burning ·{" "}
          <Link href="/illumin80" className="vigil-wall-link">
            enter the shrine →
          </Link>
        </p>
      </header>
      <div className="vigil-wall-grid">
        {shown.map((c, i) => {
          const prefs = prefsById[c.id];
          const image =
            prefs?.votiveImage && prefs.votiveImage.startsWith("/")
              ? prefs.votiveImage
              : DEFAULT_SAINT;
          const wax = prefs?.votiveTint || DEFAULT_WAX;
          const dedication = intentionText(c.intention);
          return (
            <figure
              className="vigil-card"
              key={c.id}
              style={{ "--i": i, "--wax": wax }}
            >
              <div className="vigil-card-flame" aria-hidden="true" />
              <div className="vigil-card-glass">
                <img src={image} alt="" loading="lazy" />
                <div className="vigil-card-wax" aria-hidden="true" />
              </div>
              <figcaption className="vigil-card-caption">
                <span className="vigil-card-name">
                  {c.displayName || "a pilgrim"}
                </span>
                {dedication && (
                  <span className="vigil-card-intention">{dedication}</span>
                )}
                <span className="vigil-card-time">
                  {timeAgoShort(c.litAtMs, now)}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
      <style>{`
        .vigil-wall {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 3rem 1.25rem 2rem;
        }
        .vigil-wall-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .vigil-wall-title {
          margin: 0 0 6px;
          color: #f1d77a;
          font-family: "Cinzel", serif;
          font-size: 1.6rem;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          text-shadow: 0 0 22px rgba(241, 215, 122, 0.25);
        }
        .vigil-wall-sub {
          margin: 0;
          color: #a39a82;
          font-family: 'Courier New', monospace;
          font-size: 0.8rem;
          letter-spacing: 0.1em;
        }
        .vigil-wall-link {
          color: #2ad6ee;
          text-decoration: none;
        }
        .vigil-wall-link:hover {
          text-decoration: underline;
        }
        .vigil-wall-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
          gap: 22px 16px;
          align-items: end;
        }
        .vigil-card {
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        /* Flame — teardrop with layered radial fire colors. Negative,
           per-card animation-delay desynchronizes the flicker so the
           wall doesn't pulse in lockstep. */
        .vigil-card-flame {
          width: 13px;
          height: 20px;
          margin-bottom: -3px;
          z-index: 1;
          background: radial-gradient(
            circle at 50% 78%,
            #fff7d6 0%,
            #ffd27a 38%,
            #ff9a3c 68%,
            rgba(255, 80, 0, 0) 100%
          );
          border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
          filter: drop-shadow(0 0 7px rgba(255, 180, 80, 0.85));
          transform-origin: 50% 100%;
          animation: vigilCardFlicker 1.9s ease-in-out infinite;
          animation-delay: calc(var(--i) * -0.37s);
        }
        .vigil-card-glass {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 4;
          border-radius: 10px 10px 6px 6px;
          border: 1px solid rgba(241, 215, 122, 0.28);
          background: rgba(14, 10, 22, 0.85);
          overflow: hidden;
          /* Flame light spilling down into the glass + tinted ember
             glow rising from the wax line. */
          box-shadow:
            inset 0 14px 22px -12px rgba(255, 190, 110, 0.5),
            inset 0 -16px 20px -14px var(--wax),
            0 6px 22px rgba(0, 0, 0, 0.45);
        }
        .vigil-card-glass img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0.88;
          filter: saturate(1.05);
        }
        .vigil-card-wax {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 13%;
          background: var(--wax);
          opacity: 0.85;
          border-top: 1px solid rgba(255, 255, 255, 0.18);
        }
        .vigil-card-caption {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          text-align: center;
        }
        .vigil-card-name {
          color: rgba(42, 214, 238, 0.85);
          font-family: 'Courier New', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.08em;
        }
        .vigil-card-intention {
          color: #d4a854;
          font-family: "Inter", system-ui, sans-serif;
          font-size: 0.68rem;
          font-style: italic;
        }
        .vigil-card-time {
          color: #7d7464;
          font-family: 'Courier New', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.08em;
        }
        @keyframes vigilCardFlicker {
          0%, 100% { transform: scaleY(1) rotate(-1.5deg); opacity: 0.95; }
          25% { transform: scaleY(1.14) rotate(1deg); opacity: 1; }
          50% { transform: scaleY(0.9) rotate(-1deg); opacity: 0.84; }
          75% { transform: scaleY(1.07) rotate(1.8deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vigil-card-flame {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
