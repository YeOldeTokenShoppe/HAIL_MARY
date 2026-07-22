"use client";
import React, { useMemo, useState } from "react";
import { KIT_RULES, KIND_LABEL, isKitLegal } from "@/game/terminal-traders/caseKit";
import { RARITY_COLOR } from "./constants";
import Shell from "./Shell";
import { KitCard, KC_CSS } from "./KitCard";

// KIT SELECT (CASE_TABLE.md §3.1) — assemble up to 5 action cards from the
// owned pool before the case opens. One tap "RUN BASIC KIT" auto-picks and
// skips the screen; a previously-confirmed kit re-runs with one tap ("RUN IT
// BACK") — never force deckbuilding on someone who came for the mystery.
//
// Legality (the whale guard): max 5 cards, max 2 rare-or-better, max 1 foil.
// Over-cap card count is blocked at tap time; rare/foil violations tint
// their counter red and hold the confirm CTA until resolved.
//
// NOTE: §3.5's implementation map predates the case-table componentization —
// this screen lives with its siblings in case-table/, not trade/.
const RARE_OR_BETTER = new Set(["rare", "terminal-foil"]);
const ROLE_SECTIONS = [
  { label: "LENS KEYS", kinds: ["lensKey"] },
  { label: "DEEP SCANS", kinds: ["deepScan"] },
  { label: "CROSS-REFERENCES", kinds: ["crossref"] },
  { label: "SPECIALISTS", kinds: ["trace", "peek", "shield", "stoploss", "wildcard"] },
];

export default function KitSelect({ pool, initial, ticker, caseIndex, docketLength, onConfirm, onBasic, onBack }) {
  // Seed from the previous confirm, dropping anything no longer in the pool
  // (sign-out mid-docket, collection changes).
  const [selected, setSelected] = useState(() =>
    (initial || []).map((c) => c.id).filter((id) => pool.some((p) => p.id === id))
  );
  const byId = useMemo(() => Object.fromEntries(pool.map((c) => [c.id, c])), [pool]);
  const kit = selected.map((id) => byId[id]).filter(Boolean);
  const rare = kit.filter((c) => RARE_OR_BETTER.has(c.rarity)).length;
  const foil = kit.filter((c) => c.rarity === "terminal-foil").length;
  const legal = kit.length > 0 && isKitLegal(kit);
  const unchanged = Boolean(initial?.length) && initial.length === kit.length &&
    initial.every((c) => selected.includes(c.id));

  const toggle = (card) => setSelected((s) => {
    if (s.includes(card.id)) return s.filter((id) => id !== card.id);
    return s.length >= KIT_RULES.maxCards ? s : [...s, card.id];
  });

  return (
    <Shell>
      <div className="ct-talk">
        <div className="ct-lobby-top">
          <div className="ct-eyebrow">▸ ASSEMBLE YOUR KIT — CASE {caseIndex + 1}/{docketLength} · {ticker}</div>
          <button className="ct-dev" onClick={onBack}>◀ BRIEFING</button>
        </div>
        <div className="ct-title">Up to {KIT_RULES.maxCards} cards ride this case.</div>
        <div className="ct-sub">
          Playing a card costs an action, same as a question — and cards are never
          consumed. The desk's legality rule: at most {KIT_RULES.maxRareOrBetter} rare-or-better,
          at most {KIT_RULES.maxFoil} foil. Wallet buys breadth, not a bigger firehose.
        </div>

        <div className="ks-counters">
          <span className={kit.length >= KIT_RULES.maxCards ? "ks-full" : ""}>KIT {kit.length}/{KIT_RULES.maxCards}</span>
          <span className={rare > KIT_RULES.maxRareOrBetter ? "ks-bad" : ""}>RARE+ {rare}/{KIT_RULES.maxRareOrBetter}</span>
          <span className={foil > KIT_RULES.maxFoil ? "ks-bad" : ""}>FOIL {foil}/{KIT_RULES.maxFoil}</span>
        </div>

        {ROLE_SECTIONS.map(({ label, kinds }) => {
          const cards = pool.filter((c) => kinds.includes(c.kind));
          if (!cards.length) return null;
          return (
            <div key={label}>
              <div className="ct-eyebrow" style={{ marginBottom: 8 }}>{label}</div>
              <div className="ks-row">
                {cards.map((card) => {
                  const inKit = selected.includes(card.id);
                  return (
                    <KitCard
                      key={card.id}
                      color={RARITY_COLOR[card.rarity]}
                      name={card.name}
                      kind={`${card.rarity.toUpperCase()} · ${KIND_LABEL[card.kind]}`}
                      text={card.text}
                      state={inKit ? "armed" : "idle"}
                      footer={inKit ? "IN KIT ✓ — TAP TO DROP" : "ADD TO KIT ▸"}
                      onClick={() => toggle(card)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <button className="ct-cta" disabled={!legal} onClick={() => legal && onConfirm(kit)}>
          {unchanged ? "RUN IT BACK ▸"
            : legal ? "RUN THIS KIT ▸"
            : kit.length === 0 ? "PICK CARDS — OR RUN BASIC BELOW"
            : "KIT ILLEGAL — CHECK THE COUNTERS"}
        </button>
        <button className="ct-ghost" onClick={onBasic}>⟡ RUN BASIC KIT — AUTO-PICK &amp; GO ▸</button>
      </div>
      <style>{KC_CSS}</style>
      <style>{`
        .ks-counters { display: flex; gap: 14px; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; color: #ffd23a; }
        .ks-counters .ks-full { color: #4dffaa; }
        .ks-counters .ks-bad { color: #ff5454; text-shadow: 0 0 8px rgba(255,84,84,0.6); }
        .ks-row { display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 8px; }
        .ct-cta:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
      `}</style>
    </Shell>
  );
}
