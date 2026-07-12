"use client";
import React, { useRef, useState } from "react";
import CommsGrid from "./CommsGrid";
import ChannelView from "./ChannelView";
import TerminalMenu from "./TerminalMenu";
import VerdictScreen from "./VerdictScreen";
import RevealScreen from "./RevealScreen";
import CASE_001 from "@/components/game/cases/case-001";
import CASE_002 from "@/components/game/cases/case-002";
import CASE_003 from "@/components/game/cases/case-003";
import { CASE_SIGNALS } from "@/game/terminal-traders/caseSignals";
import { seatBelief, casePnl, mulberry32, SEAT_MODELS, TABLE_RULES } from "@/game/terminal-traders/caseTable";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";

// CASE TABLE — playable mock v3 (CASE_TABLE.md §4, post-pivot).
//
// v3 implements the fifth-seat design: YOU are the analyst-prophet running a
// book the Terminal allocated you, playing against the market — never against
// the council. The four partners are your stations, your pundits, and your
// patron pool. Investigation is turn-based (v2 lesson): an action = a
// question or a card, and the partners visibly work the case alongside you.
// Before you commit they state LEANS ONLY (anti copy-trading); their exact
// calls and benchmark books unseal at the Ledger. Standings = your book vs.
// the council's four.
// Mock omissions: Cred costs, crowd odds, voices, persistence.

const DOCKET = [CASE_001, CASE_002, CASE_003];
const TRADER_BY_STATION = { monk: "gr80", demon: "john-barron", marisol: "marisol", eugene: "eugene" };
const YOU = "you";
const SEATS = [YOU, ...CHARACTER_ORDER];
const STAKE = TABLE_RULES.stake;
const START_PF = TABLE_RULES.startPortfolio;
const BASE_ACTIONS = 3;
const BOT_ROUNDS = 3;
const DOCK_H = 118;

const bucket = (p) => (p < 0.4 ? "believe" : p > 0.6 ? "doubt" : "abstain");
const VLABEL = { believe: "TRUST", doubt: "DOUBT", abstain: "ABSTAIN" };

// Patron perks (§4.1) — the partner who sponsors your run.
const PATRONS = {
  monk: { perk: "Blessed Cold Storage", desc: "One crash shield per docket — the first bad market flip bounces off your book." },
  demon: { perk: "Devil's Leverage", desc: "Bold calls (80%+ conviction either way) pay ×1.25 — wins AND losses. He would." },
  marisol: { perk: "Standing Warrant", desc: "Your first question to Marisol each case is free — it costs no action." },
  eugene: { perk: "Déjà Vu", desc: "Once per docket, Eugene mutters where the crack lives — the case's decisive lenses." },
};

// In-character pundit leans — vague direction only; exact calls stay sealed
// until the Ledger (§4.2.3: leans are theater, anti copy-trading).
const LEAN_LINES = {
  monk: {
    believe: "The ledger reads clean. Cautiously, mind you.",
    abstain: "I will not swear on this one. Not yet.",
    doubt: "The house of the Lord does not chase this.",
  },
  demon: {
    believe: "I've seen worse get standing ovations. I'm in.",
    abstain: "Coin flip. And I hate flipping fair coins.",
    doubt: "Even I can smell the exit from here.",
  },
  marisol: {
    believe: "The chain checks out. That's all you get.",
    abstain: "No chain data, no conviction. I need more.",
    doubt: "Follow the wallets. They're already leaving.",
  },
  eugene: {
    believe: "The pattern rhymes with the good ones.",
    abstain: "The pattern's blurry. Something's off — or nothing is.",
    doubt: "I've seen this chart before. It ended badly.",
  },
};

// Docket events (simplified MARKET_CARDS stand-ins — same odds as the sim).
const EVENTS = [
  { id: "crash", p: 0.3, label: "DEAD CHAIN HOUR", text: "Liquidity evaporates. Every book takes −10.", portfolioAll: -10 },
  { id: "boost", p: 0.2, label: "BULL RUN", text: "The tide lifts. Next case pays ×1.25.", payoutMult: 1.25 },
  { id: "calm", p: 0.5, label: "STABLECOIN WEATHER", text: "Nothing moves. The desk breathes." },
];

function rollEvent(rand) {
  let roll = rand();
  for (const event of EVENTS) {
    roll -= event.p;
    if (roll <= 0) return event;
  }
  return EVENTS[EVENTS.length - 1];
}

// Your kit — real Genesis cards in their §3.2a roles. Playing a card IS an
// investigation action (§4.2). Once each per case.
const KIT_CARDS = [
  { id: "audit-flare", name: "Audit Flare", rarity: "common", kind: "lensKey", station: "monk", text: "GR80 slides you his 2 strongest evidence cards." },
  { id: "forked-rumor", name: "Forked Rumor", rarity: "common", kind: "lensKey", station: "demon", text: "Barron slides you his 2 strongest evidence cards." },
  { id: "wallet-seance", name: "Wallet Séance", rarity: "common", kind: "lensKey", station: "marisol", text: "Marisol slides you her 2 strongest evidence cards." },
  { id: "mempool-prophecy", name: "Mempool Prophecy", rarity: "common", kind: "lensKey", station: "eugene", text: "Eugene slides you his 2 strongest evidence cards." },
  { id: "oracle-crosscheck", name: "Oracle Crosscheck", rarity: "rare", kind: "crossref", text: "Pull the strongest evidence card from every station you haven't visited." },
  { id: "cold-wallet", name: "Cold Wallet", rarity: "uncommon", kind: "shield", text: "Shield: absorb one negative market flip this docket." },
  { id: "insider-ping", name: "Insider Ping", rarity: "uncommon", kind: "peek", text: "At pundit calls, wiretap one partner and see their exact sealed number." },
  { id: "terminal-foil-moment", name: "Terminal Foil Moment", rarity: "terminal-foil", kind: "wildcard", text: "The desk stops — take two extra actions this case." },
];
const RARITY_COLOR = { common: "#bfeede", uncommon: "#4dffaa", rare: "#8ee9ff", "terminal-foil": "#ffd23a" };

// Each partner's signature play (round 3, ~70%) — readable tells.
const BOT_SIG = {
  monk: { card: "COLD WALLET", line: "GR80 plays COLD WALLET — his book goes to cold storage.", mod: { botShield: true } },
  demon: { card: "MARKET SERMON", line: "Barron plays MARKET SERMON — he's talking himself into it.", mod: { overconf: 1.5 } },
  marisol: { card: "WALLET SÉANCE", line: "Marisol plays WALLET SÉANCE — the chain speaks to her.", mod: { lensMult: 1.9 } },
  eugene: { card: "MEMPOOL PROPHECY", line: "Eugene plays MEMPOOL PROPHECY — the pattern sharpens.", mod: { noise: 0.45 } },
};

export default function CaseTableDev() {
  const [seed, setSeed] = useState(1337);
  const [patron, setPatron] = useState(null); // station key of sponsoring partner
  const [screen, setScreen] = useState("lobby");
  const [caseIndex, setCaseIndex] = useState(0);
  const [books, setBooks] = useState({});       // { you|stationKey: number }
  const [busted, setBusted] = useState({});
  const [briers, setBriers] = useState({});
  const [payoutMult, setPayoutMult] = useState(1);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [ledger, setLedger] = useState(null);

  // per-case investigation state
  const [activeStation, setActiveStation] = useState(null);
  const [actionsUsed, setActionsUsed] = useState(0);
  const [bonusActions, setBonusActions] = useState(0);
  const [asked, setAsked] = useState({});
  const [revealed, setRevealed] = useState({});
  const [visited, setVisited] = useState([]);
  const [playerP, setPlayerP] = useState(null);
  const [playerVerdict, setPlayerVerdict] = useState(null);

  // kit + patron + table state
  const [kitPlayed, setKitPlayed] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [shields, setShields] = useState(0);
  const [shieldSpent, setShieldSpent] = useState(false);
  const [peekArmed, setPeekArmed] = useState(false);
  const [peekChoice, setPeekChoice] = useState(null);
  const [marisolFreeUsed, setMarisolFreeUsed] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [tableLog, setTableLog] = useState([]);
  const [punditFinal, setPunditFinal] = useState({}); // { stationKey: { p, scanned } }

  const botRef = useRef({ roundsDone: 0, scanned: {}, mods: {}, shield: {} });

  const caseData = DOCKET[caseIndex];
  const signals = CASE_SIGNALS[caseData.id];
  const actionsMax = BASE_ACTIONS + bonusActions;

  const log = (line) => setTableLog((l) => [...l, line]);
  const shortName = (k) => CHARACTER_META[k].name.split(" ").pop();

  // ---------- turn engine ----------
  const botRound = () => {
    const bt = botRef.current;
    if (bt.roundsDone >= BOT_ROUNDS) return;
    const round = bt.roundsDone + 1;
    CHARACTER_ORDER.forEach((k, i) => {
      const rand = mulberry32(seed * 61 + caseIndex * 101 + round * 13 + i * 7);
      const scanned = (bt.scanned[k] ||= []);
      if (round === 1) {
        scanned.push(k);
        log(`R${round} · ${shortName(k)} works ${CHARACTER_META[k].role}`);
      } else if (round === 2) {
        const rest = CHARACTER_ORDER.filter((s) => !scanned.includes(s));
        const pick = rest[Math.floor(rand() * rest.length)];
        scanned.push(pick);
        log(`R${round} · ${shortName(k)} cross-reads ${CHARACTER_META[pick].role}`);
      } else if (rand() < 0.7) {
        const sig = BOT_SIG[k];
        bt.mods[k] = { ...(bt.mods[k] || {}), ...sig.mod };
        if (sig.mod.botShield) bt.shield[k] = true;
        log(`R${round} · ${sig.line}`);
      } else {
        log(`R${round} · ${shortName(k)} sits back and watches you work.`);
      }
    });
    bt.roundsDone = round;
  };

  const enterCalls = () => {
    const bt = botRef.current;
    while (bt.roundsDone < BOT_ROUNDS) botRound();
    const final = {};
    CHARACTER_ORDER.forEach((k, i) => {
      const { botShield, ...beliefMods } = bt.mods[k] || {};
      const model = { ...SEAT_MODELS[TRADER_BY_STATION[k]], ...beliefMods };
      const rand = mulberry32(seed * 31 + caseIndex * 101 + i * 7 + 1);
      final[k] = { p: seatBelief(signals, model, bt.scanned[k] || [k], rand), scanned: bt.scanned[k] || [k] };
    });
    setPunditFinal(final);
    setScreen("calls");
  };

  const ask = (qIndex) => {
    const key = activeStation;
    const free = patron === "marisol" && key === "marisol" && !marisolFreeUsed;
    if (!free && actionsUsed >= actionsMax) return;
    if ((asked[key] || []).includes(qIndex)) return;
    const reveal = caseData.stations[key]?.questions[qIndex]?.reveals;
    setAsked((a) => ({ ...a, [key]: [...(a[key] || []), qIndex] }));
    if (reveal) setRevealed((r) => ({
      ...r,
      [key]: (r[key] || []).includes(reveal) ? r[key] : [...(r[key] || []), reveal],
    }));
    if (free) {
      setMarisolFreeUsed(true);
      log("⟡ Standing Warrant — Marisol answers on the house.");
      return; // free action: the table doesn't advance
    }
    setActionsUsed((a) => a + 1);
    log(`R${Math.min(actionsUsed + 1, BOT_ROUNDS)} · You press ${shortName(key)} (${CHARACTER_META[key].role})`);
    botRound();
  };

  // ---------- kit ----------
  const strongestUnrevealed = (stationKey, current, count) => {
    const already = new Set(current[stationKey] || []);
    return [...signals.stations[stationKey]]
      .filter((e) => !already.has(e.label))
      .sort((a, b) => b.w - a.w)
      .slice(0, count)
      .map((e) => e.label);
  };

  const playKitCard = (card) => {
    if (kitPlayed.includes(card.id) || actionsUsed >= actionsMax) return;
    if (card.kind === "lensKey") {
      const labels = strongestUnrevealed(card.station, revealed, 2);
      if (!labels.length) { log(`⟡ ${card.name}: ${shortName(card.station)} has nothing left to show you.`); return; }
      setRevealed((r) => ({ ...r, [card.station]: [...(r[card.station] || []), ...labels] }));
      log(`⟡ You play ${card.name} — ${shortName(card.station)} slides you: ${labels.join(" · ")}`);
    } else if (card.kind === "crossref") {
      const targets = CHARACTER_ORDER.filter((k) => !visited.includes(k));
      if (!targets.length) { log("⟡ Oracle Crosscheck: you've already visited every station."); return; }
      const next = { ...revealed };
      const got = [];
      targets.forEach((k) => {
        const [label] = strongestUnrevealed(k, next, 1);
        if (label) { next[k] = [...(next[k] || []), label]; got.push(`${label} (${shortName(k)})`); }
      });
      setRevealed(next);
      log(`⟡ You play ${card.name} — crosscheck pulls: ${got.join(" · ") || "nothing new"}`);
    } else if (card.kind === "shield") {
      setShields((s) => s + 1);
      log("⟡ You play Cold Wallet — the next bad market flip bounces off your book.");
    } else if (card.kind === "peek") {
      setPeekArmed(true);
      log("⟡ You play Insider Ping — wiretap live. Pick a partner at pundit calls.");
    } else if (card.kind === "wildcard") {
      setBonusActions((b) => b + 2);
      log("⟡ You play TERMINAL FOIL MOMENT — the desk stops. Two extra actions.");
    }
    setKitPlayed((p) => [...p, card.id]);
    setSelectedCard(null);
    setActionsUsed((a) => a + 1);
    botRound();
  };

  const useHint = () => {
    if (patron !== "eugene" || hintUsed) return;
    setHintUsed(true);
    const lenses = (caseData.decisiveLenses || []).map((k) => CHARACTER_META[k]?.name || k);
    log(lenses.length
      ? `⟡ Déjà Vu — Eugene mutters: "the crack, if there is one, lives with ${lenses.join(" and ")}."`
      : "⟡ Déjà Vu — Eugene squints: \"no single crack. Read the whole room.\"");
  };

  // ---------- docket flow ----------
  const startDocket = (patronKey) => {
    setPatron(patronKey);
    const pf = {};
    SEATS.forEach((k) => { pf[k] = START_PF; });
    setBooks(pf);
    setBusted({});
    setBriers({});
    setPayoutMult(1);
    setCaseIndex(0);
    setShields(patronKey === "monk" ? 1 : 0);
    setMarisolFreeUsed(false);
    setHintUsed(false);
    resetInvestigation();
    setScreen("menu");
  };

  const resetInvestigation = () => {
    setActiveStation(null); setActionsUsed(0); setBonusActions(0);
    setAsked({}); setRevealed({}); setVisited([]);
    setPlayerP(null); setPlayerVerdict(null);
    setKitPlayed([]); setSelectedCard(null); setShieldSpent(false);
    setPeekArmed(false); setPeekChoice(null); setMarisolFreeUsed(false);
    setTableLog([]); setPunditFinal({});
    botRef.current = { roundsDone: 0, scanned: {}, mods: {}, shield: {} };
  };

  const settleCase = (pHuman) => {
    const truth = signals.truth;
    const rows = [];
    const nextBooks = { ...books };
    const nextBusted = { ...busted };
    const nextBriers = { ...briers };

    SEATS.forEach((k) => {
      if (busted[k]) { rows.push({ seat: k, out: true }); return; }
      const isYou = k === YOU;
      const p = isYou ? pHuman : punditFinal[k].p;
      let pnl = casePnl(p, truth, STAKE) * payoutMult;
      let bold = false;
      if (isYou && patron === "demon" && Math.abs(p - 0.5) >= 0.3) {
        pnl *= 1.25; bold = true; // Devil's Leverage — both ways
      }
      const brier = (p - truth) ** 2;
      nextBooks[k] = Math.max(0, nextBooks[k] + pnl);
      nextBriers[k] = [...(nextBriers[k] || []), brier];
      if (nextBooks[k] <= 0) nextBusted[k] = true;
      rows.push({
        seat: k, p, pnl, brier, bold,
        book: nextBooks[k],
        justBusted: nextBooks[k] <= 0,
        scanned: isYou
          ? Object.keys(asked).filter((s) => (asked[s]?.length || 0) > 0)
          : punditFinal[k].scanned,
      });
    });

    let event = null;
    let nextMult = 1;
    if (caseIndex < DOCKET.length - 1) {
      event = rollEvent(mulberry32(seed * 131 + caseIndex * 17 + 5));
      if (event.portfolioAll) {
        SEATS.forEach((k) => {
          if (nextBusted[k]) return;
          if (event.portfolioAll < 0) {
            if (k === YOU && shields > 0) { setShields((s) => s - 1); setShieldSpent(true); return; }
            if (k !== YOU && botRef.current.shield[k]) return; // GR80's own cold storage
          }
          nextBooks[k] = Math.max(0, nextBooks[k] + event.portfolioAll);
          if (nextBooks[k] <= 0) nextBusted[k] = true;
        });
      }
      if (event.payoutMult) nextMult = event.payoutMult;
    }

    setBooks(nextBooks);
    setBusted(nextBusted);
    setBriers(nextBriers);
    setPendingEvent(event);
    setPayoutMult(nextMult);
    setLedger(rows);
  };

  const advance = () => {
    if (busted[YOU] || caseIndex >= DOCKET.length - 1) {
      setScreen("standings");
      return;
    }
    setCaseIndex((i) => i + 1);
    resetInvestigation();
    setScreen("menu");
  };

  // ---------- shared UI ----------
  const seatMeta = (k) => (k === YOU
    ? { name: "YOU", color: "#2fd6d6", portrait: null, sigil: "◈" }
    : CHARACTER_META[k]);

  const SeatStrip = ({ showPnl }) => (
    <div className="ct-strip">
      {SEATS.map((k) => {
        const meta = seatMeta(k);
        const row = ledger?.find((r) => r.seat === k);
        return (
          <div key={k} className={`ct-seat ${k === YOU ? "you" : ""} ${busted[k] ? "liq" : ""}`} style={{ "--cc": meta.color }}>
            {meta.portrait
              ? <img src={meta.portrait} alt={meta.name} />
              : <div className="ct-seat-you">◈{patron ? <img className="ct-patron-chip" src={CHARACTER_META[patron].portrait} alt="patron" title="your patron" /> : null}</div>}
            <div className="ct-seat-name">{k === YOU ? "YOUR BOOK" : meta.name.split(" ").pop().toUpperCase()}</div>
            <div className="ct-seat-pf">
              {busted[k] && !row?.justBusted ? "OFF DESK" : Math.round(books[k] ?? START_PF)}
              {showPnl && row && !row.out && (
                <span className="ct-pnl" style={{ color: row.pnl >= 0 ? "#4dffaa" : "#ff5454" }}>
                  {" "}{row.pnl >= 0 ? "+" : ""}{Math.round(row.pnl)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // The table dock: live desk feed + your hand (+ Eugene's hint when unspent).
  const tableDock = (
    <div className="td-root">
      <div className="td-feed">
        {tableLog.length === 0
          ? <div className="td-line td-dim">▸ Round 1 of {BOT_ROUNDS}. An action = a question or a card. The desk moves when you do.</div>
          : tableLog.slice(-2).map((line, i) => <div key={tableLog.length + "-" + i} className="td-line">{line}</div>)}
      </div>
      <div className="td-handrow">
        <span className="td-actions">{Math.max(0, actionsMax - actionsUsed)} ACT</span>
        {patron === "eugene" && !hintUsed && (
          <button className="td-card td-hint" style={{ "--rc": "#4dffaa" }} onClick={useHint}>⟁ DÉJÀ VU</button>
        )}
        <div className="td-hand">
          {KIT_CARDS.map((card) => {
            const played = kitPlayed.includes(card.id);
            return (
              <button
                key={card.id}
                className={`td-card ${played ? "played" : ""} ${selectedCard === card.id ? "sel" : ""}`}
                style={{ "--rc": RARITY_COLOR[card.rarity] }}
                onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}
              >
                {card.name}
              </button>
            );
          })}
        </div>
      </div>
      {selectedCard && (() => {
        const card = KIT_CARDS.find((c) => c.id === selectedCard);
        const played = kitPlayed.includes(card.id);
        const noActions = actionsUsed >= actionsMax;
        return (
          <div className="td-pop" style={{ "--rc": RARITY_COLOR[card.rarity] }}>
            <div className="td-pop-name">{card.name} <span className="td-pop-type">{card.rarity.toUpperCase()}{card.station ? ` · ${CHARACTER_META[card.station].role}` : ""}</span></div>
            <div className="td-pop-text">{card.text}</div>
            <div className="td-pop-row">
              <button className="td-pop-play" disabled={played || noActions} onClick={() => playKitCard(card)}>
                {played ? "ALREADY PLAYED" : noActions ? "NO ACTIONS LEFT" : "PLAY — COSTS 1 ACTION ▸"}
              </button>
              <button className="td-pop-close" onClick={() => setSelectedCard(null)}>✕</button>
            </div>
          </div>
        );
      })()}
      <style>{`
        .td-root { position: absolute; left: 0; right: 0; bottom: 0; height: ${DOCK_H}px; z-index: 10070;
          background: #030f0c; border-top: 1px solid rgba(255,210,58,0.45);
          font-family: 'Courier New', monospace; display: flex; flex-direction: column; padding: 6px 10px calc(env(safe-area-inset-bottom, 0px) + 6px); }
        .td-feed { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
        .td-line { font-size: 10.5px; color: #eafff9; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .td-dim { color: #bfeede; opacity: 0.7; }
        .td-handrow { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
        .td-actions { font-size: 10px; font-weight: bold; color: #ffd23a; letter-spacing: 0.06em; flex-shrink: 0; }
        .td-hand { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
        .td-hand::-webkit-scrollbar { display: none; }
        .td-card { flex-shrink: 0; background: color-mix(in srgb, var(--rc) 9%, #04140f); border: 1px solid var(--rc);
          color: #f4fffb; font-family: inherit; font-size: 10px; font-weight: bold; letter-spacing: 0.03em;
          padding: 7px 9px; cursor: pointer; white-space: nowrap;
          clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px)); }
        .td-card.played { opacity: 0.32; }
        .td-card.sel { box-shadow: 0 0 10px var(--rc); }
        .td-hint { box-shadow: 0 0 8px rgba(77,255,170,0.4); }
        .td-pop { position: absolute; left: 10px; right: 10px; bottom: ${DOCK_H - 8}px; z-index: 10075;
          background: #04140f; border: 1.5px solid var(--rc); padding: 12px;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: 0 -4px 24px rgba(0,0,0,0.6), 0 0 14px color-mix(in srgb, var(--rc) 30%, transparent); }
        .td-pop-name { color: #f4fffb; font-weight: bold; font-size: 13px; }
        .td-pop-type { color: var(--rc); font-size: 9.5px; letter-spacing: 0.1em; font-weight: normal; margin-left: 6px; }
        .td-pop-text { color: #bfeede; font-size: 11.5px; line-height: 1.5; margin: 6px 0 10px; }
        .td-pop-row { display: flex; gap: 8px; }
        .td-pop-play { flex: 1; background: color-mix(in srgb, var(--rc) 16%, transparent); border: 1px solid var(--rc);
          color: #f4fffb; font-family: inherit; font-size: 11px; font-weight: bold; letter-spacing: 0.05em; padding: 9px; cursor: pointer; }
        .td-pop-play:disabled { opacity: 0.5; cursor: default; }
        .td-pop-close { background: none; border: 1px solid rgba(47,214,214,0.5); color: #2fd6d6; font-family: inherit; padding: 0 12px; cursor: pointer; }
      `}</style>
    </div>
  );

  // ---------- screens ----------
  if (screen === "lobby") {
    return (
      <Shell>
        <div className="ct-lobby">
          <div className="ct-eyebrow">▸ THE CASE TABLE — DEV MOCK v3</div>
          <div className="ct-title">The Terminal has allocated you a book.<br />Don't lose the house's money.</div>
          <div className="ct-sub">
            You are the fifth seat at Our Lady of Perpetual Profit's trading desk. Three cases,
            {" "}{BASE_ACTIONS} actions each — a question or a card, same cost. The four partners work every case
            beside you, call their leans, and run their own books; beat the council and don't go bust.
            Stake {STAKE} per case on a book of {START_PF}. A perfect call pays +{STAKE};
            a max-conviction miss costs {STAKE * 3}.
          </div>
          <div className="ct-eyebrow" style={{ marginTop: 6 }}>▸ CHOOSE YOUR PATRON</div>
          <div className="ct-picks">
            {CHARACTER_ORDER.map((k) => {
              const meta = CHARACTER_META[k];
              return (
                <button key={k} className="ct-pick" style={{ "--cc": meta.color }} onClick={() => startDocket(k)}>
                  <img src={meta.portrait} alt={meta.name} />
                  <div className="ct-pick-name">{meta.name}</div>
                  <div className="ct-pick-perk">{PATRONS[k].perk}</div>
                  <div className="ct-pick-role">{PATRONS[k].desc}</div>
                </button>
              );
            })}
          </div>
          <button className="ct-ghost" onClick={() => setSeed((s) => s + 1)}>DOCKET SEED {seed} — REROLL</button>
        </div>
      </Shell>
    );
  }

  if (screen === "calls") {
    return (
      <Shell>
        <div className="ct-talk">
          <SeatStrip />
          <div className="ct-eyebrow">▸ PUNDIT CALLS — CASE {caseIndex + 1}/{DOCKET.length} · {caseData.ticker}</div>
          <div className="ct-talk-note">The partners call their leans. Exact numbers stay sealed until the Ledger — read the room, don't copy it.</div>
          {CHARACTER_ORDER.map((k) => {
            const meta = CHARACTER_META[k];
            const report = punditFinal[k];
            if (!report) return null;
            const lean = bucket(report.p);
            const tapped = peekChoice === k;
            const tappable = peekArmed && !peekChoice;
            return (
              <div
                key={k}
                className={`ct-lean ${tappable ? "tappable" : ""}`}
                style={{ "--cc": meta.color }}
                onClick={() => { if (tappable) { setPeekChoice(k); setPeekArmed(false); } }}
              >
                <img src={meta.portrait} alt={meta.name} />
                <div>
                  <div className="ct-lean-name">{meta.name}{patron === k ? " ⟡" : ""} <span className="ct-lean-scan">read {report.scanned.map((s) => CHARACTER_META[s].role).join(" + ")}{botRef.current.mods[k] ? ` · played ${BOT_SIG[k].card}` : ""}{busted[k] ? " · book gone — calls anyway" : ""}</span></div>
                  <div className="ct-lean-line">“{LEAN_LINES[k][lean]}”</div>
                  {tapped && (
                    <div className="ct-wiretap">⟡ WIRETAP: {VLABEL[bucket(report.p)]} @ {Math.round(report.p * 100)}% scam</div>
                  )}
                </div>
              </div>
            );
          })}
          {peekArmed && !peekChoice && <div className="ct-talk-note" style={{ color: "#ffd23a" }}>⟡ Insider Ping live — tap a partner to unseal their number.</div>}
          <button className="ct-cta" onClick={() => setScreen("verdict")}>COMMIT YOUR POSITION ▸</button>
          <button className="ct-ghost" onClick={() => setScreen("grid")}>◀ BACK TO THE DESK</button>
        </div>
      </Shell>
    );
  }

  if (screen === "ledger") {
    const truth = signals.truth;
    return (
      <Shell>
        <div className="ct-talk">
          <SeatStrip showPnl />
          <div className="ct-eyebrow">▸ THE LEDGER — CASE {caseIndex + 1}/{DOCKET.length}</div>
          <div className="ct-truth" style={{ color: truth ? "#ff5454" : "#4dffaa" }}>
            {caseData.ticker} WAS {truth ? "A RUG" : "LEGIT"}
          </div>
          {ledger?.map((row) => {
            if (row.out) return null;
            const meta = seatMeta(row.seat);
            const v = bucket(row.p);
            return (
              <div key={row.seat} className="ct-lean" style={{ "--cc": meta.color }}>
                {meta.portrait ? <img src={meta.portrait} alt={meta.name} /> : <div className="ct-you-badge">◈</div>}
                <div className="ct-ledger-row">
                  <div className="ct-lean-name">{row.seat === YOU ? "YOU" : meta.name}
                    <span className="ct-lean-scan"> {VLABEL[v]} @ {Math.round(row.p * 100)}% scam{row.bold ? " · DEVIL'S LEVERAGE ×1.25" : ""}</span></div>
                  <div className="ct-ledger-nums">
                    <span style={{ color: row.pnl >= 0 ? "#4dffaa" : "#ff5454" }}>{row.pnl >= 0 ? "+" : ""}{Math.round(row.pnl)}</span>
                    <span className="ct-dim"> → {Math.round(row.book)}</span>
                    {row.justBusted && <span className="ct-rug"> {row.seat === YOU ? "OFF THE DESK" : "BOOK GONE"}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {pendingEvent && (
            <div className="ct-event">
              <div className="ct-event-label">◈ MARKET FLIPS: {pendingEvent.label}</div>
              <div className="ct-event-text">{pendingEvent.text}</div>
              {shieldSpent && pendingEvent.portfolioAll < 0 && (
                <div className="ct-event-text" style={{ color: "#4dffaa" }}>Your shield absorbs the hit.</div>
              )}
              {pendingEvent.portfolioAll < 0 && botRef.current.shield.monk && !busted.monk && (
                <div className="ct-event-text" style={{ color: "#daa520" }}>GR80's cold storage holds — he takes nothing.</div>
              )}
            </div>
          )}
          <button className="ct-cta" onClick={advance}>
            {busted[YOU] ? "OFF THE DESK — SEE STANDINGS ▸" : caseIndex >= DOCKET.length - 1 ? "FINAL STANDINGS ▸" : "NEXT CASE ▸"}
          </button>
        </div>
      </Shell>
    );
  }

  if (screen === "standings") {
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
          <button className="ct-cta" onClick={() => { setSeed((s) => s + 1); setScreen("lobby"); setPatron(null); setLedger(null); setPendingEvent(null); }}>
            NEW DOCKET ▸
          </button>
        </div>
      </Shell>
    );
  }

  // reused screens — investigation sits above the table dock
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10050, background: "#02100e" }}>
      {screen === "menu" ? (
        <TerminalMenu caseData={caseData} onBegin={() => setScreen("grid")} onExit={() => setScreen("lobby")} exitLabel="◀ LOBBY" />
      ) : screen === "verdict" ? (
        <VerdictScreen
          caseData={caseData}
          onBack={() => setScreen("calls")}
          onCommit={({ verdict, confidence }) => {
            setPlayerVerdict(verdict); setPlayerP(confidence);
            settleCase(confidence);
            setScreen("reveal");
          }}
        />
      ) : screen === "reveal" ? (
        <RevealScreen
          caseData={caseData}
          verdict={playerVerdict}
          confidence={playerP}
          investigated={Object.keys(asked).filter((k) => (asked[k]?.length || 0) > 0)}
          speakerKey={[...visited].reverse()[0] || "monk"}
          onExit={() => setScreen("ledger")}
        />
      ) : (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: DOCK_H }}>
            {screen === "channel" && caseData.stations[activeStation] ? (
              <ChannelView
                stationKey={activeStation}
                station={caseData.stations[activeStation]}
                caseId={caseData.id}
                scansUsed={actionsUsed}
                scansMax={actionsMax}
                asked={asked[activeStation] || []}
                revealed={revealed[activeStation] || []}
                onAsk={ask}
                onBack={() => setScreen("grid")}
                onVerdict={enterCalls}
                useSitePal={false}
              />
            ) : (
              <CommsGrid
                caseInfo={{ project: caseData.projectName, ticker: caseData.ticker, chain: caseData.chain }}
                scansUsed={actionsUsed}
                scansMax={actionsMax}
                visited={visited}
                onSelectChannel={(key) => {
                  setActiveStation(key);
                  setScreen("channel");
                  setVisited((v) => (v.includes(key) ? v : [...v, key]));
                }}
                onExit={enterCalls}
                exitLabel="PUNDIT CALLS ▸"
              />
            )}
          </div>
          {tableDock}
        </>
      )}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="ct-root">
      {children}
      <style>{`
        .ct-root { position: absolute; inset: 0; z-index: 10050; overflow-y: auto;
          background: radial-gradient(120% 80% at 50% 20%, rgba(10,40,38,0.5), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; }
        .ct-lobby, .ct-talk { display: flex; flex-direction: column; gap: 12px; padding: 22px 18px calc(env(safe-area-inset-bottom, 0px) + 24px); max-width: 560px; margin: 0 auto; }
        .ct-eyebrow { font-size: 11px; letter-spacing: 0.14em; color: #ffd23a; }
        .ct-title { font-size: 21px; line-height: 1.35; color: #f4fffb; font-weight: bold; }
        .ct-sub, .ct-talk-note { font-size: 12px; line-height: 1.55; color: #bfeede; opacity: 0.85; }
        .ct-picks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
        .ct-pick { background: color-mix(in srgb, var(--cc) 8%, #04140f); border: 1px solid color-mix(in srgb, var(--cc) 55%, transparent);
          color: #f4fffb; font: inherit; padding: 12px 10px; cursor: pointer; text-align: center;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
        .ct-pick img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--cc); }
        .ct-pick-name { font-size: 13px; font-weight: bold; margin-top: 7px; color: var(--cc); }
        .ct-pick-perk { font-size: 10.5px; font-weight: bold; letter-spacing: 0.06em; color: #ffd23a; margin-top: 4px; }
        .ct-pick-role { font-size: 10px; line-height: 1.45; color: #bfeede; opacity: 0.8; margin-top: 3px; }
        .ct-strip { display: flex; gap: 6px; justify-content: space-between; margin-bottom: 6px; }
        .ct-seat { flex: 1; text-align: center; padding: 7px 3px; background: rgba(4,20,15,0.7);
          border: 1px solid color-mix(in srgb, var(--cc) 35%, transparent); }
        .ct-seat.you { border-color: var(--cc); box-shadow: 0 0 10px color-mix(in srgb, var(--cc) 30%, transparent); }
        .ct-seat.liq { opacity: 0.4; filter: grayscale(0.8); }
        .ct-seat img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
        .ct-seat-you { position: relative; width: 30px; height: 30px; margin: 0 auto; border-radius: 50%;
          border: 1.5px solid #2fd6d6; color: #2fd6d6; font-size: 15px; line-height: 27px; }
        .ct-patron-chip { position: absolute; right: -6px; bottom: -4px; width: 15px; height: 15px; border-radius: 50%;
          object-fit: cover; border: 1px solid #ffd23a; }
        .ct-seat-name { font-size: 8.5px; letter-spacing: 0.06em; color: var(--cc); margin-top: 4px; }
        .ct-seat-pf { font-size: 12.5px; color: #f4fffb; font-weight: bold; }
        .ct-pnl { font-size: 10.5px; }
        .ct-lean { display: flex; gap: 12px; align-items: center; padding: 10px 12px; background: rgba(4,20,15,0.7);
          border-left: 3px solid var(--cc); }
        .ct-lean img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid var(--cc); flex-shrink: 0; }
        .ct-you-badge { width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid #2fd6d6; color: #2fd6d6;
          font-size: 20px; text-align: center; line-height: 41px; flex-shrink: 0; }
        .ct-lean-name { font-size: 12.5px; font-weight: bold; color: var(--cc); }
        .ct-lean-scan { font-weight: normal; font-size: 10.5px; color: #bfeede; opacity: 0.75; letter-spacing: 0.04em; }
        .ct-lean-line { font-size: 12.5px; color: #eafff9; margin-top: 3px; line-height: 1.4; }
        .ct-lean.tappable { cursor: pointer; box-shadow: 0 0 12px color-mix(in srgb, var(--cc) 35%, transparent); }
        .ct-wiretap { font-size: 11.5px; color: #ffd23a; margin-top: 5px; letter-spacing: 0.04em; }
        .ct-ledger-row { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .ct-ledger-nums { font-size: 13px; font-weight: bold; }
        .ct-dim { color: #bfeede; opacity: 0.7; font-weight: normal; font-size: 11.5px; }
        .ct-rug { color: #ff5454; letter-spacing: 0.08em; font-size: 11px; }
        .ct-truth { font-size: 22px; font-weight: bold; letter-spacing: 0.05em; text-shadow: 0 0 14px currentColor; margin: 2px 0 6px; }
        .ct-event { border: 1px dashed rgba(255,210,58,0.55); padding: 12px; margin-top: 4px; }
        .ct-event-label { color: #ffd23a; font-size: 12px; letter-spacing: 0.1em; font-weight: bold; }
        .ct-event-text { font-size: 12px; color: #eafff9; margin-top: 4px; }
        .ct-cta { margin-top: 10px; background: rgba(47,214,214,0.12); border: 1.5px solid #2fd6d6; color: #f4fffb; font: inherit;
          font-weight: bold; letter-spacing: 0.08em; font-size: 14px; padding: 13px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: 0 0 14px rgba(47,214,214,0.25); }
        .ct-ghost { background: none; border: 1px solid rgba(47,214,214,0.4); color: #2fd6d6; font: inherit; font-size: 11.5px;
          letter-spacing: 0.06em; padding: 9px 14px; cursor: pointer; }
      `}</style>
    </div>
  );
}
