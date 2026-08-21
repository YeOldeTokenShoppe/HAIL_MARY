"use client";

import { useState, useMemo } from "react";
import { SPECIMENS, RELICS } from "@/lib/artifactDistribution";

// THE CONCRETION — artifact reveal modal (docs/artifact-expansion.md → "Reveal
// experience"). The drill surfaces an ENCASEMENT, not an item: the player chips /
// unwraps / pries it open with taps. The silhouette telegraphs the vein, never
// the item. Cursed relics glitch on the final tap. Art rule: excavated, never
// loot-box — dirt crust, oxide, wrong-colored under the violet field light.

const mono = "'Share Tech Mono', monospace";
const TAPS = 4; // taps to open

// Per-vein skin: silhouette, verb, crust palette, reveal flourish color.
const SKINS = {
  amber: { verb: "CHIP", noun: "MINERAL CONCRETION", crust: "#4a4038", inner: "#ffb84d", glow: "#ffb84d" },
  relic: { verb: "UNWRAP", noun: "BURIAL BUNDLE", crust: "#3a3644", inner: "#c79bff", glow: "#c79bff" },
  map:   { verb: "PRY", noun: "RUSTED TIN", crust: "#4c3f33", inner: "#ffe9a8", glow: "#ffd27f" },
  cache: { verb: "UNLOCK", noun: "IRON STRONGBOX", crust: "#2e3340", inner: "#ffd700", glow: "#ffd700" },
};

function labelFor(a) {
  if (a.type === "amber") {
    const s = SPECIMENS.find((x) => x.id === a.specimenId);
    return { name: `AMBER SHARD — ${s?.label || (a.specimenId || "").toUpperCase()}`, sub: `FRAGMENT ${(a.fragmentIndex ?? 0) + 1}/6` };
  }
  if (a.type === "map") return { name: `MAP FRAGMENT №${(a.pieceIndex ?? 0) + 1}`, sub: "SOMEONE OUT THERE HOLDS THE REST" };
  if (a.type === "cache") return { name: "THE OUTLAW CACHE", sub: "YOU FOUND IT" };
  const r = RELICS.find((x) => x.id === a.relicId);
  return { name: r?.label || (a.relicId || "RELIC").toUpperCase(), sub: a.cursed ? "THE GROUND HERE WAS A GRAVE" : "RECOVERED FOR THE MUSEUM" };
}

// Encasement silhouette per vein — deliberately crude, dirt-first shapes.
function Encasement({ type, skin, taps, cursedFlash }) {
  const opened = taps >= TAPS;
  const cracks = Math.min(taps, TAPS - 1);
  // Crust shards fall away as taps land; the inner glow bleeds through cracks.
  const glowOpacity = opened ? 0.9 : 0.12 + taps * 0.18;
  return (
    <svg width="180" height="150" viewBox="0 0 180 150" style={{
      display: "block", margin: "0 auto",
      filter: cursedFlash ? "invert(1) hue-rotate(90deg)" : "none",
      transition: "filter 80ms",
    }}>
      <defs>
        <radialGradient id="conc-glow">
          <stop offset="0%" stopColor={skin.inner} stopOpacity={glowOpacity} />
          <stop offset="70%" stopColor={skin.inner} stopOpacity={glowOpacity * 0.25} />
          <stop offset="100%" stopColor={skin.inner} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="90" cy="75" r="70" fill="url(#conc-glow)" />
      {!opened ? (
        <g style={{ transformOrigin: "90px 75px" }}>
          {/* Body silhouette per vein */}
          {type === "relic" ? (
            // burial bundle: wrapped ellipse + ties
            <>
              <ellipse cx="90" cy="78" rx="52" ry="34" fill={skin.crust} />
              <path d="M50 68 Q90 56 130 68 M48 84 Q90 96 132 84" stroke="#241f2e" strokeWidth="4" fill="none" />
              <line x1="70" y1="50" x2="74" y2="106" stroke="#241f2e" strokeWidth="3" />
              <line x1="110" y1="50" x2="106" y2="106" stroke="#241f2e" strokeWidth="3" />
            </>
          ) : type === "map" ? (
            // rusted tin
            <>
              <rect x="46" y="56" width="88" height="44" rx="6" fill={skin.crust} />
              <rect x="46" y="52" width="88" height="12" rx="6" fill="#5c4c3d" />
              <circle cx="90" cy="78" r="4" fill="#2c241c" />
            </>
          ) : type === "cache" ? (
            // iron strongbox
            <>
              <rect x="42" y="62" width="96" height="46" rx="4" fill={skin.crust} />
              <path d="M42 66 Q90 38 138 66 L138 74 L42 74 Z" fill="#3a4152" />
              <rect x="82" y="76" width="16" height="20" rx="2" fill="#1c202a" />
              <circle cx="90" cy="84" r="3" fill={skin.inner} opacity={glowOpacity} />
            </>
          ) : (
            // amber concretion: lumpy nodule
            <path d="M90 34 C120 30 142 52 138 78 C136 102 116 118 88 116 C60 114 40 98 42 74 C44 50 62 38 90 34 Z" fill={skin.crust} />
          )}
          {/* Cracks appear per tap; inner color bleeds through */}
          {Array.from({ length: cracks }).map((_, i) => (
            <path key={i}
              d={[
                "M70 60 L86 78 L78 96",
                "M112 54 L100 76 L114 92",
                "M56 82 L74 86 L66 104",
              ][i] || ""}
              stroke={skin.inner} strokeWidth="2.5" fill="none" opacity="0.85"
              style={{ filter: `drop-shadow(0 0 4px ${skin.glow})` }} />
          ))}
          {/* Dirt crumbs shaken loose */}
          {Array.from({ length: taps * 3 }).map((_, i) => (
            <circle key={`d${i}`} cx={50 + ((i * 37) % 80)} cy={118 + ((i * 13) % 14)} r={1.5 + (i % 2)}
              fill={skin.crust} opacity="0.7" />
          ))}
        </g>
      ) : (
        // Opened: the item, resolved
        <g>
          <polygon points="90,45 118,75 90,105 62,75" fill={skin.inner}
            style={{ filter: `drop-shadow(0 0 14px ${skin.glow})` }} />
          <polygon points="90,55 108,75 90,95 72,75" fill="rgba(255,255,255,0.35)" />
        </g>
      )}
    </svg>
  );
}

export default function ConcretionModal({ artifact, onDone, darkMode = true }) {
  const [taps, setTaps] = useState(0);
  const [cursedFlash, setCursedFlash] = useState(false);
  const skin = SKINS[artifact?.type] || SKINS.relic;
  const label = useMemo(() => (artifact ? labelFor(artifact) : null), [artifact]);
  if (!artifact) return null;

  const opened = taps >= TAPS;
  const cursed = artifact.type === "relic" && artifact.cursed;

  const tap = () => {
    if (opened) return;
    const next = taps + 1;
    // The cursed glitch lands ON the final fold — it looked normal until now.
    if (next >= TAPS && cursed) {
      setCursedFlash(true);
      setTimeout(() => setCursedFlash(false), 160);
    }
    setTaps(next);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 4000,
      background: "rgba(8,6,14,0.88)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "min(calc(92vw / var(--hm-ui-scale, 1)), 340px)", zoom: "var(--hm-ui-scale, 1)", padding: "22px 18px 18px",
        background: darkMode ? "#12101c" : "#f4f0e6",
        border: `1px solid ${opened ? skin.glow : "rgba(199,155,255,0.25)"}`,
        borderRadius: 4, textAlign: "center", fontFamily: mono,
        boxShadow: opened ? `0 0 40px ${skin.glow}33` : "0 0 30px rgba(0,0,0,0.6)",
        animation: cursedFlash ? "conc-shake 0.15s" : "none",
      }}>
        <div style={{ fontSize: 9, letterSpacing: "0.25em", color: "#7e94a6", marginBottom: 4 }}>
          THE DRILL SURFACED SOMETHING
        </div>
        <div style={{ fontSize: 12, letterSpacing: "0.15em", color: opened ? skin.glow : "#c8d2dc", marginBottom: 8 }}>
          {opened ? label.name : skin.noun}
        </div>

        <div onClick={tap} style={{ cursor: opened ? "default" : "pointer", userSelect: "none" }}>
          <Encasement type={artifact.type} skin={skin} taps={taps} cursedFlash={cursedFlash} />
        </div>

        {!opened ? (
          <>
            <div style={{ fontSize: 10, color: "#7e94a6", letterSpacing: "0.1em", margin: "6px 0 10px" }}>
              tap to {skin.verb.toLowerCase()} · {TAPS - taps} left
            </div>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {Array.from({ length: TAPS }).map((_, i) => (
                <span key={i} style={{
                  width: 18, height: 3, background: i < taps ? skin.glow : "rgba(255,255,255,0.12)",
                }} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 9, letterSpacing: "0.2em", margin: "4px 0 12px",
              color: cursed ? "#ff5a3c" : "#7e94a6",
            }}>
              {cursed ? "⚰ " : ""}{label.sub}
            </div>
            <button onClick={onDone} style={{
              fontFamily: mono, fontSize: 11, letterSpacing: "0.2em",
              padding: "9px 22px", cursor: "pointer",
              background: `${skin.glow}1e`, color: skin.glow,
              border: `1px solid ${skin.glow}66`, borderRadius: 2,
            }}>
              {cursed ? "CLOSE IT BACK UP" : "TO THE COLLECTION →"}
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes conc-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-5px) } 75% { transform: translateX(5px) } }`}</style>
    </div>
  );
}
