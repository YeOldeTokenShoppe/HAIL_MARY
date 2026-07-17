// Docket closed: final books ranked, average Brier per seat, the run's
// verdict line (beat the council / partial / liquidated) — and the house's
// payout when the Daily Docket was won (Phase 1 reward rail).
import React, { useState } from "react";
import { CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";
import { YOU } from "@/game/terminal-traders/docketRun";
import { getCardById } from "@/game/terminal-traders/cards";
import PackReveal from "@/components/tcg/PackReveal";
import { RARITY_COLOR, SEATS, seatMeta } from "./constants";
import Shell from "./Shell";

// The docket payout banner (Genesis is earned entirely through play —
// GENESIS.md §6). Finishing alive earns the day's dossier coin; beating the
// council stacks a sealed pack. `reward.status`: checking | granted |
// already | signin | offDocket | error (null = liquidated, nothing owed).
// The granted card list is the placeholder pack-reveal — the real reveal
// moment is an open design question (GENESIS.md roadmap).
function RewardBanner({ reward }) {
  // The reveal is theater over already-granted contents (Chain of Custody,
  // PackReveal.jsx): granted → OPEN CTA → envelope/flip ceremony → the
  // banner then shows the chips as the filed record.
  const [revealing, setRevealing] = useState(false);
  const [opened, setOpened] = useState(false);
  if (!reward) return null;
  const line = {
    checking: "The house counts the take…",
    already: "Today's payout is already in your binder.",
    signin: reward.won
      ? "The house owes you a pack and the day's dossier coin — sign in to collect."
      : "The day's dossier coin awaits — sign in to collect it.",
    offDocket: "Off-docket table — the house only pays the Daily Docket.",
    error: "The vault is jammed — your payout is safe, try again later.",
  }[reward.status];
  const label = reward.won
    ? "◈ THE HOUSE PAYS — SEALED PACK + DOSSIER COIN"
    : "◈ CASE CLOSED — THE DAY'S DOSSIER COIN";
  const coinCard = reward.coin ? getCardById(reward.coin) : null;
  if (reward.status === "granted" && !opened) {
    return (
      <div className="ct-event" style={{ borderStyle: "solid" }}>
        <div className="ct-event-label">{label}</div>
        <div className="ct-event-text">
          {reward.pack?.length
            ? "A sealed evidence envelope, chain of custody: the house → you."
            : "The day's dossier is ready for the stamp."}
        </div>
        <button className="ct-reward-open" onClick={() => setRevealing(true)}>
          {reward.pack?.length ? "OPEN THE EVIDENCE ENVELOPE ▸" : "STAMP IT CASE CLOSED ▸"}
        </button>
        {revealing && (
          <PackReveal
            pack={reward.pack || []}
            coin={reward.coin}
            onClose={() => { setRevealing(false); setOpened(true); }}
          />
        )}
        <style>{`
          .ct-reward-open { display: inline-block; margin-top: 9px; background: rgba(255,210,58,0.1);
            border: 1.5px solid #ffd23a; color: #ffd23a; font: inherit; font-family: 'Courier New', monospace;
            font-size: 11px; font-weight: bold; letter-spacing: 0.1em; padding: 9px 14px; cursor: pointer;
            clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
            box-shadow: 0 0 12px rgba(255,210,58,0.25); }
        `}</style>
      </div>
    );
  }
  return (
    <div className="ct-event" style={{ borderStyle: "solid" }}>
      <div className="ct-event-label">{label}</div>
      {reward.status === "granted" ? (
        <div className="ct-reward-cards">
          {coinCard && (
            <span className="ct-reward-card ct-reward-coin" style={{ "--cc": RARITY_COLOR[coinCard.rarity] || "#bfeede" }}>
              {coinCard.name}
              <i>DOSSIER COIN · {(coinCard.rarity || "").toUpperCase()}</i>
            </span>
          )}
          {(reward.pack || []).map((id, i) => {
            const card = getCardById(id);
            const color = RARITY_COLOR[card?.rarity] || "#bfeede";
            return (
              <span key={`${id}-${i}`} className="ct-reward-card" style={{ "--cc": color }}>
                {card?.name || id}
                <i>{(card?.rarity || "").toUpperCase()}</i>
              </span>
            );
          })}
        </div>
      ) : (
        <div className="ct-event-text">{line}</div>
      )}
      {(reward.status === "granted" || reward.status === "already") && (
        <a className="ct-reward-binder" href="/binder">VIEW BINDER ▸</a>
      )}
      <style>{`
        .ct-reward-cards { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
        .ct-reward-binder { display: inline-block; margin-top: 9px; color: #2fd6d6; font-size: 10.5px;
          font-weight: bold; letter-spacing: 0.1em; text-decoration: none;
          border: 1px solid rgba(47,214,214,0.45); padding: 6px 11px; }
        .ct-reward-card { display: inline-flex; flex-direction: column; gap: 2px; padding: 7px 10px;
          border: 1px solid color-mix(in srgb, var(--cc) 60%, transparent);
          background: color-mix(in srgb, var(--cc) 9%, transparent);
          color: #f4fffb; font-size: 11.5px; font-weight: bold;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
        .ct-reward-card i { font-style: normal; font-weight: normal; font-size: 8px;
          letter-spacing: 0.12em; color: var(--cc); }
        .ct-reward-coin { border-width: 2px; box-shadow: 0 0 12px color-mix(in srgb, var(--cc) 35%, transparent); }
      `}</style>
    </div>
  );
}

export default function Standings({ books, busted, briers, reward, onNewDocket, newDocketLabel = "NEW DOCKET ▸" }) {
  const ranked = [...SEATS].sort((a, b) => (books[b] ?? 0) - (books[a] ?? 0));
  const yourRank = ranked.indexOf(YOU) + 1;
  const beaten = CHARACTER_ORDER.filter((k) => (books[YOU] ?? 0) > (books[k] ?? 0)).length;
  return (
    <Shell>
      <div className="ct-lobby">
        <div className="ct-eyebrow">▸ DOCKET CLOSED</div>
        <div className="ct-title" style={{ color: busted[YOU] ? "#ff5454" : yourRank === 1 ? "#4dffaa" : "#f4fffb" }}>
          {busted[YOU]
            ? "THE ORDER WITHDRAWS ITS BLESSING"
            : yourRank === 1
              ? "YOU BEAT THE COUNCIL"
              : `YOU BEAT ${beaten} OF 4 PARTNERS`}
        </div>
        <RewardBanner reward={reward} />
        {ranked.map((k, i) => {
          const meta = seatMeta(k);
          const bs = briers[k] || [];
          const avgB = bs.length ? (bs.reduce((x, y) => x + y, 0) / bs.length) : null;
          return (
            <div key={k} className="ct-lean" style={{ "--cc": meta.color }}>
              {meta.portrait ? <img src={meta.portrait} alt={meta.name} /> : <div className="ct-you-badge">◈</div>}
              <div className="ct-ledger-row">
                <div className="ct-lean-name">#{i + 1} {k === YOU ? "YOU" : meta.name}</div>
                <div className="ct-ledger-nums">
                  {busted[k] ? <span className="ct-rug">{k === YOU ? "OFF THE DESK" : "BOOK GONE"}</span> : <span>{Math.round(books[k])}</span>}
                  {avgB !== null && <span className="ct-dim"> · brier {avgB.toFixed(2)}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <button className="ct-cta" onClick={onNewDocket}>{newDocketLabel}</button>
      </div>
    </Shell>
  );
}
