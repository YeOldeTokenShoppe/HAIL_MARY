"use client";
import React, { useEffect, useMemo, useState } from "react";
import { KIT_RULES, isKitLegal } from "@/game/terminal-traders/caseKit";
import { getCardById } from "@/game/terminal-traders/cards";
import { toTemplateCard } from "@/game/terminal-traders/templateCard";
import TradingCard from "@/components/TradingCard";
import Shell from "./Shell";

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

// Whole cards, fully visible — the real TradingCard render, same as the
// /card-template binder. 744×1038 × 0.27 ≈ 201×280 per thumbnail.
const KS_THUMB = 0.27;

export default function KitSelect({ pool, initial, ticker, caseIndex, docketLength, onConfirm, onBasic, onBack }) {
  // Seed from the previous confirm, dropping anything no longer in the pool
  // (sign-out mid-docket, collection changes).
  const [selected, setSelected] = useState(() =>
    (initial || []).map((c) => c.id).filter((id) => pool.some((p) => p.id === id))
  );
  const byId = useMemo(() => Object.fromEntries(pool.map((c) => [c.id, c])), [pool]);
  // Full template renders (art, frame, foil, kit text) for every pool card —
  // art-less cards show the framed no-art variant, so nothing gates on art.
  const templates = useMemo(
    () => Object.fromEntries(pool.map((c) => [c.id, toTemplateCard(getCardById(c.id))])),
    [pool]
  );
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

  // Inspect: the full holofoil TradingCard, scaled to the viewport.
  const [inspectId, setInspectId] = useState(null);
  const [inspectScale, setInspectScale] = useState(0.5);
  useEffect(() => {
    if (!inspectId) return;
    const fit = () => setInspectScale(Math.min(
      (window.innerWidth - 48) / 744,
      (window.innerHeight - 150) / 1038,
      0.62
    ));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [inspectId]);

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
                    <div className="ks-slot" key={card.id}>
                      <button
                        className={`ks-thumb${inKit ? " is-in" : ""}`}
                        onClick={() => setInspectId(card.id)}
                        title={`${card.name} — tap to enlarge`}
                      >
                        <TradingCard
                          data={templates[card.id]}
                          scale={KS_THUMB}
                          interactive={false}
                          templateStyle="terminal"
                        />
                      </button>
                      <button className={`ks-add${inKit ? " is-in" : ""}`} onClick={() => toggle(card)}>
                        {inKit ? "IN KIT ✓ — TAP TO DROP" : "ADD TO KIT ▸"}
                      </button>
                    </div>
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

      {/* Full holofoil inspect — the real TradingCard, same render as the
          binder. Tap anywhere outside the card to close. */}
      {inspectId && (
        <div className="ks-overlay" onClick={() => setInspectId(null)}>
          <div className="ks-overlay-card" onClick={(e) => e.stopPropagation()}>
            <TradingCard
              data={toTemplateCard(getCardById(inspectId))}
              scale={inspectScale}
              templateStyle="terminal"
            />
          </div>
          <button className="ct-ghost" onClick={() => setInspectId(null)}>✕ CLOSE</button>
        </div>
      )}

      <style>{`
        .ks-counters { display: flex; gap: 14px; font-size: 12px; font-weight: bold; letter-spacing: 0.08em; color: #ffd23a; }
        .ks-counters .ks-full { color: #4dffaa; }
        .ks-counters .ks-bad { color: #ff5454; text-shadow: 0 0 8px rgba(255,84,84,0.6); }
        .ks-row { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 10px; }
        .ks-slot { display: flex; flex-direction: column; gap: 7px; flex: 0 0 auto; }
        /* The whole card is the tap target for enlarge; the kit state rides
           a gold halo so the card face stays unobstructed. */
        .ks-thumb { position: relative; background: none; border: 1.5px solid transparent;
          border-radius: 12px; padding: 3px; cursor: zoom-in; transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .ks-thumb:hover { transform: translateY(-3px); }
        .ks-thumb.is-in { border-color: #ffd23a; box-shadow: 0 0 18px rgba(255,210,58,0.35); }
        .ks-add { background: rgba(47,214,214,0.08); border: 1px solid rgba(47,214,214,0.5); color: #2fd6d6;
          font: inherit; font-size: 10px; font-weight: bold; letter-spacing: 0.12em; padding: 9px 6px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
        .ks-add:hover { background: rgba(47,214,214,0.16); }
        .ks-add.is-in { border-color: #ffd23a; color: #ffd23a; background: rgba(255,210,58,0.1); }
        .ks-overlay { position: fixed; inset: 0; z-index: 10060; display: flex; flex-direction: column;
          gap: 14px; align-items: center; justify-content: center;
          background: rgba(2,10,9,0.88); backdrop-filter: blur(4px); }
        .ct-cta:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
      `}</style>
    </Shell>
  );
}
