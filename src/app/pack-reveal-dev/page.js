"use client";
import React, { useMemo, useState } from "react";
import PackReveal from "@/components/tcg/PackReveal";
import { openPacks, docketCoin } from "@/game/terminal-traders/packs";
import { dateSeed } from "@/game/terminal-traders/docketRun";

// Dev sandbox for the Chain of Custody pack reveal (PackReveal.jsx).
// Deterministic demo packs via openPacks seed strings — step the seed to
// browse pulls. "reveal-demo-2" is the reference god-pull pack (two GR80
// mythics: exercises THE DESK STOPS and the duplicate tag on one run).
export default function PackRevealDevPage() {
  const [seedN, setSeedN] = useState(2);
  const [mode, setMode] = useState("pack"); // 'pack' | 'coin'
  const [run, setRun] = useState(1); // remount key
  const pack = useMemo(() => openPacks(`reveal-demo-${seedN}`, 1).packs[0], [seedN]);
  const coin = docketCoin(dateSeed());

  return (
    <div style={{ position: "fixed", inset: 0, background: "#02100e", color: "#2fd6d6", fontFamily: "'Courier New', monospace" }}>
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10200, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={devBtn} onClick={() => { setSeedN((s) => s + 1); setRun((r) => r + 1); }}>DEV · PACK SEED {seedN} ↻</button>
        <button style={devBtn} onClick={() => { setMode((m) => (m === "pack" ? "coin" : "pack")); setRun((r) => r + 1); }}>
          MODE: {mode === "pack" ? "PACK + COIN" : "COIN ONLY"} ⇄
        </button>
        <button style={devBtn} onClick={() => setRun((r) => r + 1)}>REPLAY ↺</button>
      </div>
      <PackReveal
        key={`${run}-${mode}-${seedN}`}
        pack={mode === "pack" ? pack : []}
        coin={coin}
        onClose={() => setRun((r) => r + 1)}
      />
    </div>
  );
}

const devBtn = {
  background: "none", border: "1px dashed rgba(191,238,222,0.4)", color: "#bfeede",
  font: "inherit", fontSize: 10, letterSpacing: "0.08em", padding: "5px 9px", cursor: "pointer", opacity: 0.8,
};
