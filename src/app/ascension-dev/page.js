"use client";
// Dev harness for The Ascension vertical slice. Click "Next turn" to flip the
// scripted deck and watch the chart print + the capsules climb; when the Demon
// is rugged, "Our Lady · Resurrection" appears. Not linked anywhere in the app
// — open /ascension-dev directly. Pure scaffolding for build-order step 2.
import dynamic from "next/dynamic";
import { useState } from "react";
import { createRace, resolveTurn, pray, canPray, getWinner } from "@/game/ascension/engine";

// R3F must be client-only.
const AscensionStage = dynamic(() => import("@/components/ascension/AscensionStage"), {
  ssr: false,
});

const PHOS = "#8effc4";

function Btn({ onClick, disabled, children, accent = PHOS }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        background: disabled ? "rgba(20,24,30,0.6)" : "rgba(10,31,23,0.85)",
        border: `1px solid ${disabled ? "rgba(120,130,140,0.3)" : accent}`,
        color: disabled ? "rgba(160,170,180,0.5)" : accent,
        fontFamily: "'Orbitron','IBM Plex Mono',monospace",
        fontSize: 12,
        letterSpacing: "0.12em",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function AscensionDevPage() {
  const [race, setRace] = useState(() => createRace());

  const winner = getWinner(race);
  const deckLeft = race.deck.length - race.turn;
  const target = race.pendingPrayer?.targetId;
  const prayable = canPray(race, "resurrection", target);

  const next = () => setRace((r) => resolveTurn(r));
  const doPray = () => setRace((r) => pray(r, "resurrection", r.pendingPrayer?.targetId));
  const reset = () => setRace(createRace());

  return (
    <div style={{ position: "fixed", inset: 0, background: "#04060a", overflow: "hidden" }}>
      <AscensionStage race={race} />

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          fontFamily: "'IBM Plex Mono',monospace",
          color: "#cfe6ea",
          fontSize: 13,
          lineHeight: 1.6,
          background: "rgba(2,3,6,0.6)",
          border: "1px solid rgba(142,255,196,0.25)",
          borderRadius: 8,
          padding: "12px 14px",
          minWidth: 230,
        }}
      >
        <div style={{ color: PHOS, letterSpacing: "0.15em", marginBottom: 6 }}>
          THE ASCENSION · DEV
        </div>
        <div>turn: {race.turn} &nbsp; grace: {race.grace} &nbsp; deck left: {deckLeft}</div>
        {Object.values(race.racers).map((r) => (
          <div key={r.id}>
            {r.name}: step {r.step} · <span style={{ opacity: 0.8 }}>{r.state}</span>
          </div>
        ))}
        {winner && (
          <div style={{ color: "#ffe28a", marginTop: 6 }}>
            🌙 {race.racers[winner].name} reached THE MOON
          </div>
        )}
        {race.events.length > 0 && (
          <div style={{ opacity: 0.6, marginTop: 6, fontSize: 11 }}>
            last: {race.events.map((e) => e.type).join(", ")}
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Btn onClick={next} disabled={!!winner || deckLeft <= 0}>
          NEXT TURN ▸
        </Btn>
        {prayable && (
          <Btn onClick={doPray} accent="#ffcb74">
            ✦ OUR LADY · RESURRECTION (1)
          </Btn>
        )}
        <Btn onClick={reset} accent="#ff7ac4">
          RESET
        </Btn>
      </div>
    </div>
  );
}
