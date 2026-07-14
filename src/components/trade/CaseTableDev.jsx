"use client";
import React, { useRef, useState } from "react";
import ChannelView from "./ChannelView";
import TerminalMenu from "./TerminalMenu";
import RevealScreen from "./RevealScreen";
import CASE_001 from "@/components/game/cases/case-001";
import CASE_002 from "@/components/game/cases/case-002";
import CASE_003 from "@/components/game/cases/case-003";
import { CASE_SIGNALS } from "@/game/terminal-traders/caseSignals";
import { seatBelief, casePnl, mulberry32, SEAT_MODELS, TABLE_RULES } from "@/game/terminal-traders/caseTable";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";

// CASE TABLE — playable mock v4 (CASE_TABLE.md §4, post-pivot).
//
// v3 implements the fifth-seat design: YOU are the analyst-prophet running a
// book the Terminal allocated you, playing against the market — never against
// the council. The four partners are your stations, your pundits, and your
// patron pool. Investigation is turn-based (v2 lesson): an action = a
// question or a card, and the partners visibly work the case alongside you.
// Before you commit they state LEANS ONLY (anti copy-trading); their exact
// calls and benchmark books unseal at the Ledger. Standings = your book vs.
// the council's four.
//
// v4 replaces the single confidence dial with a three-dial POSITION TICKET:
// P(SCAM) (calibration), STAKE 0-50 (sizing; council benchmarks flat 25),
// HORIZON (timing side pot, opt-in). Rule: no unscored dials — each gets a
// named line in the Ledger. Sizing math stays hidden until the debrief
// ("felt, not computed"); the side pot's TERMS are public at commit.
// Mock omissions: Cred costs, crowd odds, voices, persistence.

const DOCKET = [CASE_001, CASE_002, CASE_003];
const TRADER_BY_STATION = { monk: "gr80", demon: "john-barron", marisol: "marisol", eugene: "eugene" };
const YOU = "you";
const SEATS = [YOU, ...CHARACTER_ORDER];
const STAKE = TABLE_RULES.stake; // the council's flat benchmark stake
const START_PF = TABLE_RULES.startPortfolio;
const BASE_ACTIONS = 3;
const BOT_ROUNDS = 3;
const DOCK_H = 240; // tall enough for the card-shaped kit hand

const bucket = (p) => (p < 0.4 ? "believe" : p > 0.6 ? "doubt" : "abstain");
const VLABEL = { believe: "TRUST", doubt: "DOUBT", abstain: "ABSTAIN" };
const VCOLOR = { believe: "#4dffaa", doubt: "#ff5454", abstain: "#ffd23a" };

// ---- The three-dial position ticket (v4) ----
// Every dial gets its own named line in the Ledger — no unscored controls.
const MAX_STAKE = 50;
// Sizing debrief: conviction |p-0.5|/0.5 linearly justifies 0..MAX_STAKE.
// Not shown at commit (felt, not computed) — named at the Ledger.
const justifiedStake = (p) => Math.round((Math.abs(p - 0.5) / 0.5) * MAX_STAKE);
const SIZING_TOLERANCE = 8;
// Horizon side pot: a timing bet conditional on your rug thesis.
// Terms are public at commit (a bet's terms aren't machinery): hit +10, miss −4.
const HORIZON = [
  { key: "none", label: "NO CALL", sub: "sit out the side pot" },
  { key: "days", label: "DAYS", sub: "unravels inside a week", test: (d) => d <= 7 },
  { key: "weeks", label: "WEEKS", sub: "unravels inside a month", test: (d) => d > 7 && d <= 30 },
  { key: "months", label: "MONTHS", sub: "unravels inside a quarter", test: (d) => d > 30 && d <= 90 },
];
const HORIZON_HIT = 10;
const HORIZON_MISS = -4;

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
// `effect` is the player-facing consequence line — every event states what it
// did to the books, including "nothing", so the banner is never ambiguous.
const EVENTS = [
  { id: "crash", p: 0.3, label: "DEAD CHAIN HOUR", text: "Liquidity evaporates.", effect: "ALL BOOKS −10 · APPLIED ABOVE", portfolioAll: -10 },
  { id: "boost", p: 0.2, label: "BULL RUN", text: "The tide lifts.", effect: "NEXT CASE PAYS ×1.25", payoutMult: 1.25 },
  { id: "calm", p: 0.5, label: "STABLECOIN WEATHER", text: "Nothing moves. The desk breathes.", effect: "NO EFFECT ON ANY BOOK" },
];

function rollEvent(rand) {
  let roll = rand();
  for (const event of EVENTS) {
    roll -= event.p;
    if (roll <= 0) return event;
  }
  return EVENTS[EVENTS.length - 1];
}

// Your kit — THE FIRST TWELVE (CASE_TABLE.md §3.2b): the art-scope subset.
// Every kit role, every tier, and every ticket dial has a card that serves
// it. Playing a card IS an investigation action (§4.2). Once each per case.
const KIT_CARDS = [
  { id: "audit-flare", name: "Audit Flare", rarity: "common", kind: "lensKey", station: "monk", text: "GR80 slides you his 2 strongest evidence cards." },
  { id: "forked-rumor", name: "Forked Rumor", rarity: "common", kind: "lensKey", station: "demon", text: "Barron slides you his 2 strongest evidence cards." },
  { id: "wallet-seance", name: "Wallet Séance", rarity: "common", kind: "lensKey", station: "marisol", text: "Marisol slides you her 2 strongest evidence cards." },
  { id: "mempool-prophecy", name: "Mempool Prophecy", rarity: "common", kind: "lensKey", station: "eugene", text: "Eugene slides you his 2 strongest evidence cards." },
  { id: "cold-wallet", name: "Cold Wallet", rarity: "uncommon", kind: "deepScan", station: "monk", text: "Deep scan — GR80 opens the cold archive: everything he still holds." },
  { id: "chart-exorcism", name: "Chart Exorcism", rarity: "uncommon", kind: "deepScan", station: "marisol", text: "Deep scan — Marisol drags out everything the chain still hides." },
  { id: "oracle-crosscheck", name: "Oracle Crosscheck", rarity: "rare", kind: "crossref", text: "Pull the strongest evidence card from every station you haven't visited." },
  { id: "rug-warning", name: "Rug Warning", rarity: "rare", kind: "trace", text: "Sweep for a fast-exit fingerprint. Finds it only if the rug is days away." },
  { id: "candle-vigil", name: "Candle Vigil", rarity: "common", kind: "shield", text: "Shield: absorb one negative market flip this docket." },
  { id: "neon-stop-loss", name: "Neon Stop Loss", rarity: "uncommon", kind: "stoploss", text: "This case's ticket can't lose more than 25, whatever you staked." },
  { id: "insider-ping", name: "Insider Ping", rarity: "uncommon", kind: "peek", text: "At pundit calls, wiretap one partner and see their exact sealed number." },
  { id: "terminal-foil-moment", name: "Terminal Foil Moment", rarity: "terminal-foil", kind: "wildcard", text: "The desk stops — take two extra actions this case." },
];
const RARITY_COLOR = { common: "#bfeede", uncommon: "#4dffaa", rare: "#8ee9ff", "terminal-foil": "#ffd23a" };
const KIND_LABEL = {
  lensKey: "LENS KEY", deepScan: "DEEP SCAN", crossref: "CROSS-REF", trace: "EXIT TRACE",
  shield: "SHIELD", stoploss: "STOP LOSS", peek: "WIRETAP", wildcard: "WILDCARD",
};
const STOP_LOSS_FLOOR = -25;

// Each partner's signature play (round 3, ~70%) — readable tells.
const BOT_SIG = {
  monk: { card: "COLD WALLET", line: "GR80 plays COLD WALLET — his book goes to cold storage.", mod: { botShield: true } },
  demon: { card: "MARKET SERMON", line: "Barron plays MARKET SERMON — he's talking himself into it.", mod: { overconf: 1.5 } },
  marisol: { card: "WALLET SÉANCE", line: "Marisol plays WALLET SÉANCE — the chain speaks to her.", mod: { lensMult: 1.9 } },
  eugene: { card: "MEMPOOL PROPHECY", line: "Eugene plays MEMPOOL PROPHECY — the pattern sharpens.", mod: { noise: 0.45 } },
};

export default function CaseTableDev() {
  const [seed, setSeed] = useState(1337);

  // First-run scaffolds (trade-interaction-primitives.md: mechanic tutorials
  // show once, ~10s, then never again — un-scored). Seen-flags persist.
  const [tipsSeen, setTipsSeen] = useState(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("ct_tips_v1") || "{}"); } catch { return {}; }
  });
  const dismissTip = (id) => setTipsSeen((t) => {
    const next = { ...t, [id]: true };
    try { localStorage.setItem("ct_tips_v1", JSON.stringify(next)); } catch {}
    return next;
  });
  const resetTips = () => {
    try { localStorage.removeItem("ct_tips_v1"); } catch {}
    setTipsSeen({});
  };
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

  // position ticket dials (v4) — percent 0-100, stake 0-MAX_STAKE, horizon index into HORIZON
  const [ticketP, setTicketP] = useState(50);
  const [ticketStake, setTicketStake] = useState(STAKE);
  const [ticketHorizon, setTicketHorizon] = useState(0);

  // kit + patron + table state
  const [kitPlayed, setKitPlayed] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [shields, setShields] = useState(0);
  const [shieldSpent, setShieldSpent] = useState(false);
  const [stopLossArmed, setStopLossArmed] = useState(false); // Neon Stop Loss — this case only
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
  // Pundit calls open only after the investigation is spent (§4.2 flow order).
  // Actions don't bank between cases, so an early call is strictly a loss.
  const actionsLeft = Math.max(0, actionsMax - actionsUsed);
  const callsOpen = actionsLeft === 0;

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
    if (actionsUsed + 1 >= actionsMax) log("▸ Out of actions — the table is waiting. PUNDIT CALLS ▸");
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
    } else if (card.kind === "deepScan") {
      const labels = strongestUnrevealed(card.station, revealed, 99);
      if (!labels.length) { log(`⟡ ${card.name}: ${shortName(card.station)} has nothing left to show you.`); return; }
      setRevealed((r) => ({ ...r, [card.station]: [...(r[card.station] || []), ...labels] }));
      log(`⟡ You play ${card.name} — deep scan: ${shortName(card.station)} opens everything (${labels.length} more entr${labels.length === 1 ? "y" : "ies"})`);
    } else if (card.kind === "trace") {
      // Fast-exit fingerprints only: a slow rug and a legit token both read
      // "no fingerprint" — the trace informs HORIZON, never the verdict.
      const day = signals.collapseDay;
      log(day != null && day <= 7
        ? "⟡ Rug Warning — FAST-EXIT FINGERPRINT FOUND. If this thing blows, it blows in DAYS."
        : "⟡ Rug Warning — no fast-exit fingerprint. If it dies, it dies slow. Or not at all.");
    } else if (card.kind === "stoploss") {
      setStopLossArmed(true);
      log(`⟡ You play Neon Stop Loss — this case's ticket can't lose more than ${-STOP_LOSS_FLOOR}.`);
    } else if (card.kind === "shield") {
      setShields((s) => s + 1);
      log(`⟡ You play ${card.name} — the next bad market flip bounces off your book.`);
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
    // wildcard grants +2 actions, so recompute against the post-play max
    const maxAfter = card.kind === "wildcard" ? actionsMax + 2 : actionsMax;
    if (actionsUsed + 1 >= maxAfter) log("▸ Out of actions — the table is waiting. PUNDIT CALLS ▸");
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
    setTicketP(50); setTicketStake(STAKE); setTicketHorizon(0);
    setKitPlayed([]); setSelectedCard(null); setShieldSpent(false); setStopLossArmed(false);
    setPeekArmed(false); setPeekChoice(null); setMarisolFreeUsed(false);
    setTableLog([]); setPunditFinal({});
    botRef.current = { roundsDone: 0, scanned: {}, mods: {}, shield: {} };
  };

  const settleCase = (pHuman, stakeYou, horizonIdx) => {
    const truth = signals.truth;
    const rows = [];
    const nextBooks = { ...books };
    const nextBusted = { ...busted };
    const nextBriers = { ...briers };

    SEATS.forEach((k) => {
      if (busted[k]) { rows.push({ seat: k, out: true }); return; }
      const isYou = k === YOU;
      const p = isYou ? pHuman : punditFinal[k].p;
      const stake = isYou ? stakeYou : STAKE; // the council benchmarks at a flat 25
      let pnl = casePnl(p, truth, stake) * payoutMult;
      let bold = false;
      if (isYou && patron === "demon" && Math.abs(p - 0.5) >= 0.3) {
        pnl *= 1.25; bold = true; // Devil's Leverage — both ways
      }

      // Dial 3 — horizon side pot (you only, opt-in): pays only if the token
      // rugs inside your window. A call on a token that holds always loses.
      let horizon = null;
      if (isYou && horizonIdx > 0) {
        const day = signals.collapseDay;
        const hit = truth === 1 && day != null && !!HORIZON[horizonIdx].test?.(day);
        const delta = hit ? HORIZON_HIT : HORIZON_MISS;
        pnl += delta;
        horizon = { idx: horizonIdx, hit, delta, day };
      }

      // Neon Stop Loss — floors the whole ticket (stake P&L + side pot).
      let stopLoss = null;
      if (isYou && stopLossArmed && pnl < STOP_LOSS_FLOOR) {
        stopLoss = { from: Math.round(pnl) };
        pnl = STOP_LOSS_FLOOR;
      }

      // Dial 2 — sizing debrief (you only): stake vs conviction-justified.
      let sizing = null;
      if (isYou) {
        const justified = justifiedStake(pHuman);
        sizing = {
          justified,
          verdict: justified === 0
            ? "centered"
            : stake > justified + SIZING_TOLERANCE
              ? "oversized"
              : stake < justified - SIZING_TOLERANCE
                ? "undersized"
                : "sized",
        };
      }

      const brier = (p - truth) ** 2;
      nextBooks[k] = Math.max(0, nextBooks[k] + pnl);
      nextBriers[k] = [...(nextBriers[k] || []), brier];
      if (nextBooks[k] <= 0) nextBusted[k] = true;
      rows.push({
        seat: k, p, pnl, brier, bold, stake, horizon, sizing, stopLoss,
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
        <span className={`td-actions${actionsMax - actionsUsed === 1 ? " low" : ""}`} title="An action = one question or one card">
          <span className="td-actions-label">ACTIONS</span>
          <span className="td-actions-num">{Math.max(0, actionsMax - actionsUsed)}<i className="td-actions-max">/{actionsMax}</i></span>
          <span className="td-actions-pips">
            {Array.from({ length: actionsMax }, (_, i) => (
              <i key={i} className={`td-apip${i < actionsMax - actionsUsed ? " on" : ""}`} />
            ))}
          </span>
          <span className="td-book" title="Your allocated book — the ticket stakes come out of this">
            ◈ BOOK {Math.round(books[YOU] ?? START_PF)}
          </span>
        </span>
        <div className="td-hand">
          {patron === "eugene" && !hintUsed && (
            <KitCard
              small
              color="#4dffaa"
              name="⟁ Déjà Vu"
              kind="PATRON · FREE"
              text="Eugene mutters where the crack lives."
              footer="WHISPER ▸"
              state="armed"
              onClick={useHint}
            />
          )}
          {KIT_CARDS.map((card) => {
            const played = kitPlayed.includes(card.id);
            const sel = selectedCard === card.id;
            const noActions = actionsUsed >= actionsMax;
            return (
              <KitCard
                key={card.id}
                small
                color={RARITY_COLOR[card.rarity]}
                name={card.name}
                kind={`${card.rarity.toUpperCase()} · ${KIND_LABEL[card.kind]}`}
                text={card.text}
                state={played ? "played" : sel ? "armed" : "idle"}
                footer={played ? "PLAYED" : !sel ? "TAP TO ARM" : noActions ? "NO ACTIONS LEFT" : "TAP AGAIN — 1 ACT ▸"}
                onClick={() => {
                  if (played) return;
                  if (!sel) { setSelectedCard(card.id); return; }
                  if (!noActions) playKitCard(card);
                }}
              />
            );
          })}
        </div>
      </div>
      <style>{`
        .td-root { position: absolute; left: 0; right: 0; bottom: 0; height: ${DOCK_H}px; z-index: 10070;
          background: #030f0c; border-top: 1px solid rgba(255,210,58,0.45);
          font-family: 'Courier New', monospace; display: flex; flex-direction: column; padding: 6px 10px calc(env(safe-area-inset-bottom, 0px) + 6px); }
        .td-feed { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
        .td-line { font-size: 10.5px; color: #eafff9; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .td-dim { color: #bfeede; opacity: 0.7; }
        .td-handrow { display: flex; align-items: center; gap: 10px; margin-top: 5px; min-height: 0; }
        .td-actions { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; padding: 0 4px; }
        .td-actions-label { font-size: 9.5px; font-weight: bold; color: #ffd23a; letter-spacing: 0.14em; }
        .td-actions-num { font-size: 24px; font-weight: bold; color: #f4fffb; line-height: 1;
          text-shadow: 0 0 12px rgba(255,210,58,0.55); }
        .td-actions-max { font-size: 12px; font-style: normal; font-weight: normal; color: #bfeede; opacity: 0.6; }
        .td-actions-pips { display: flex; gap: 5px; }
        .td-apip { width: 13px; height: 13px; border: 1.5px solid #ffd23a; opacity: 0.28;
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px)); }
        .td-apip.on { background: #ffd23a; opacity: 1; box-shadow: 0 0 8px rgba(255,210,58,0.7); }
        .td-actions.low .td-apip.on { animation: dgpulse 0.9s ease-in-out infinite; }
        @keyframes dgpulse { 50% { opacity: 0.45; box-shadow: 0 0 4px rgba(255,210,58,0.3); } }
        .td-book { font-size: 10px; font-weight: bold; letter-spacing: 0.08em; color: #2fd6d6;
          margin-top: 3px; text-shadow: 0 0 8px rgba(47,214,214,0.45); white-space: nowrap; }
        .td-hand { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 0; }
        .td-hand::-webkit-scrollbar { display: none; }
        ${KC_CSS}
      `}</style>
    </div>
  );

  // The desk (grid screen): four card-sized channel tiles + the kit as
  // same-sized, card-shaped cards. Two-tap card flow: arm, then play.
  const deskGrid = (
    <div className="dg-root">
      <div className="dg-inner">
        <div className="dg-header">
          <span className="dg-title">LIMINAL // COUNCIL</span>
          <span className="dg-case">{caseData.ticker} · {caseData.chain} — CASE {caseIndex + 1}/{DOCKET.length}</span>
          <span className="dg-live"><i className="dg-dot" />4 CHANNELS</span>
        </div>

        {!tipsSeen.desk && (
          <Tip title="THE DESK — FIRST TIME" onDismiss={() => dismissTip("desk")}>
            You get {BASE_ACTIONS} ACTIONS a case. Opening a channel and asking a question costs one;
            playing a kit card costs one. The partners work the case every time you spend one — watch
            the desk feed. Out of actions, you call the table.
          </Tip>
        )}

        <div className="dg-eyebrow">▸ THE COUNCIL — OPEN A CHANNEL</div>
        <div className="dg-row">
          {CHARACTER_ORDER.map((key, i) => {
            const c = CHARACTER_META[key];
            const isVisited = visited.includes(key);
            return (
              <button
                key={key}
                className="dg-card dg-agent"
                style={{ "--cc": c.color }}
                onClick={() => {
                  setActiveStation(key);
                  setScreen("channel");
                  setVisited((v) => (v.includes(key) ? v : [...v, key]));
                }}
              >
                <span className="dg-feed">
                  <img src={c.portrait} alt={c.name} draggable={false} />
                  <span className="dg-tint" />
                  <span className="dg-scanlines" />
                </span>
                <span className="dg-ch">CH-{i + 1}</span>
                <span className="dg-status"><i className={`dg-pip ${isVisited ? "seen" : ""}`} />{isVisited ? "CONSULTED" : "ONLINE"}</span>
                <span className="dg-plate">
                  <span className="dg-name">{c.name}</span>
                  <span className="dg-role">{c.role} · {c.roleSub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="dg-feedstrip">
          {tableLog.length === 0
            ? <div className="dg-line dg-dim">▸ Round 1 of {BOT_ROUNDS}. An action = a question or a card. The desk moves when you do.</div>
            : tableLog.slice(-3).map((line, i) => <div key={tableLog.length + "-" + i} className="dg-line">{line}</div>)}
        </div>

        <div className="dg-eyebrow">▸ YOUR KIT — A CARD COSTS AN ACTION</div>
        <div className="dg-row">
          {patron === "eugene" && !hintUsed && (
            <KitCard
              color="#4dffaa"
              name="⟁ Déjà Vu"
              kind="PATRON · FREE"
              text="Eugene mutters where the crack lives — the case's decisive lenses. Costs nothing."
              footer="WHISPER ▸"
              state="armed"
              onClick={useHint}
            />
          )}
          {KIT_CARDS.map((card) => {
            const played = kitPlayed.includes(card.id);
            const sel = selectedCard === card.id;
            const noActions = actionsUsed >= actionsMax;
            return (
              <KitCard
                key={card.id}
                color={RARITY_COLOR[card.rarity]}
                name={card.name}
                kind={`${card.rarity.toUpperCase()} · ${KIND_LABEL[card.kind]}`}
                text={card.text}
                state={played ? "played" : sel ? "armed" : "idle"}
                footer={played ? "PLAYED" : !sel ? "TAP TO ARM" : noActions ? "NO ACTIONS LEFT" : "TAP AGAIN — 1 ACTION ▸"}
                onClick={() => {
                  if (played) return;
                  if (!sel) { setSelectedCard(card.id); return; }
                  if (!noActions) playKitCard(card);
                }}
              />
            );
          })}
        </div>

        <div className="dg-footer">
          <div className={`dg-actions${actionsLeft === 1 ? " low" : ""}`} title="An action = one question or one card">
            <span className="dg-actions-label">ACTIONS</span>
            <span className="dg-actions-pips">
              {Array.from({ length: actionsMax }, (_, i) => (
                <i key={i} className={`dg-apip${i < actionsLeft ? " on" : ""}`} />
              ))}
            </span>
            <span className="dg-actions-num">{actionsLeft}<span className="dg-actions-max">/{actionsMax}</span></span>
          </div>
          <div className="dg-book" title="Your allocated book — the ticket stakes come out of this">
            <span className="dg-book-label">◈ YOUR BOOK</span>
            <span className="dg-book-num">{Math.round(books[YOU] ?? START_PF)}</span>
          </div>
          {callsOpen
            ? <button className="dg-cta" onClick={enterCalls}>PUNDIT CALLS ▸</button>
            : <span className="dg-wait">THE TABLE CALLS WHEN YOUR ACTIONS ARE SPENT</span>}
        </div>
      </div>
      <style>{`
        .dg-root { position: absolute; inset: 0; overflow-y: auto;
          background: radial-gradient(120% 80% at 50% 30%, rgba(10,40,38,0.4), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; user-select: none; }
        .dg-root::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 5;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px); }
        .dg-inner { max-width: 1000px; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column;
          gap: 11px; padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px); }
        .dg-header { display: flex; align-items: center; justify-content: space-between; font-size: 13px; letter-spacing: 0.04em; }
        .dg-title { color: #5ff2f2; font-weight: bold; }
        .dg-case { color: #ffd23a; opacity: 0.9; }
        .dg-live { display: inline-flex; align-items: center; gap: 6px; }
        .dg-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4040; box-shadow: 0 0 6px #ff4040;
          animation: dgblink 1.1s steps(1) infinite; }
        @keyframes dgblink { 50% { opacity: 0.25; } }
        .dg-eyebrow { font-size: 10.5px; letter-spacing: 0.14em; color: #ffd23a; }
        .dg-row { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: thin; padding-bottom: 3px; }
        .dg-card { position: relative; flex: 0 0 auto; width: 168px; aspect-ratio: 3 / 4; cursor: pointer;
          border: 1.5px solid color-mix(in srgb, var(--cc) 65%, transparent); background: #061a18;
          color: inherit; font: inherit; text-align: left; padding: 0;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: inset 0 0 18px color-mix(in srgb, var(--cc) 16%, transparent);
          transition: box-shadow 0.15s ease, transform 0.1s ease; }
        .dg-card:hover { box-shadow: inset 0 0 24px color-mix(in srgb, var(--cc) 28%, transparent),
          0 0 12px color-mix(in srgb, var(--cc) 40%, transparent); }
        .dg-card:active { transform: scale(0.98); }
        .dg-feed { position: absolute; inset: 0; overflow: hidden; }
        .dg-feed img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%;
          filter: grayscale(0.4) contrast(1.1) brightness(0.85); }
        .dg-tint { position: absolute; inset: 0; mix-blend-mode: color; opacity: 0.45;
          background: linear-gradient(180deg, transparent 40%, rgba(2,16,14,0.95) 100%), var(--cc); }
        .dg-scanlines { position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.26) 0 1px, transparent 1px 3px); }
        .dg-ch { position: absolute; top: 7px; left: 9px; z-index: 2; font-size: 10px; letter-spacing: 0.08em;
          color: var(--cc); text-shadow: 0 0 6px color-mix(in srgb, var(--cc) 60%, transparent); }
        .dg-status { position: absolute; top: 7px; right: 8px; z-index: 2; display: inline-flex; align-items: center;
          gap: 4px; font-size: 8.5px; letter-spacing: 0.06em; color: #bfeede; }
        .dg-pip { width: 5px; height: 5px; border-radius: 50%; background: #4dffaa; box-shadow: 0 0 5px #4dffaa; }
        .dg-pip.seen { background: #ffd23a; box-shadow: 0 0 5px #ffd23a; }
        .dg-plate { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; display: flex; flex-direction: column;
          gap: 1px; padding: 20px 9px 8px; background: linear-gradient(180deg, transparent, rgba(2,16,14,0.9) 45%); }
        .dg-name { font-size: 12.5px; font-weight: bold; color: #f4fffb;
          text-shadow: 0 0 8px color-mix(in srgb, var(--cc) 65%, transparent); }
        .dg-role { font-size: 8.5px; letter-spacing: 0.12em; color: var(--cc); }
        ${KC_CSS}
        .dg-feedstrip { border: 1px solid rgba(255,210,58,0.28); background: rgba(4,20,15,0.6);
          padding: 7px 10px; min-height: 42px; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
        .dg-line { font-size: 10.5px; color: #eafff9; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dg-dim { opacity: 0.65; }
        .dg-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
        .dg-actions { display: flex; align-items: center; gap: 12px; }
        .dg-actions-label { font-size: 12px; font-weight: bold; letter-spacing: 0.16em; color: #ffd23a; }
        .dg-actions-pips { display: flex; gap: 7px; }
        .dg-apip { width: 20px; height: 20px; border: 2px solid #ffd23a; opacity: 0.28;
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); }
        .dg-apip.on { background: #ffd23a; opacity: 1; box-shadow: 0 0 12px rgba(255,210,58,0.7); }
        .dg-actions.low .dg-apip.on { animation: dgpulse 0.9s ease-in-out infinite; }
        @keyframes dgpulse { 50% { opacity: 0.45; box-shadow: 0 0 4px rgba(255,210,58,0.3); } }
        .dg-actions-num { font-size: 27px; font-weight: bold; color: #f4fffb; line-height: 1;
          text-shadow: 0 0 14px rgba(255,210,58,0.55); }
        .dg-actions-max { font-size: 14px; font-weight: normal; color: #bfeede; opacity: 0.6; }
        .dg-book { display: flex; align-items: baseline; gap: 9px; }
        .dg-book-label { font-size: 10.5px; font-weight: bold; letter-spacing: 0.16em; color: #2fd6d6; opacity: 0.85; }
        .dg-book-num { font-size: 27px; font-weight: bold; color: #f4fffb; line-height: 1;
          text-shadow: 0 0 14px rgba(47,214,214,0.55); }
        .dg-wait { font-size: 10.5px; letter-spacing: 0.08em; color: #bfeede; opacity: 0.6; text-align: right; }
        .dg-cta { background: rgba(47,214,214,0.12); border: 1.5px solid #2fd6d6; color: #f4fffb; font: inherit;
          font-weight: bold; letter-spacing: 0.08em; font-size: 13px; padding: 11px 20px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
          box-shadow: 0 0 12px rgba(47,214,214,0.25); }
      `}</style>
    </div>
  );

  // ---------- screens ----------
  if (screen === "lobby") {
    return (
      <Shell>
        <div className="ct-lobby">
          <div className="ct-lobby-top">
            <div className="ct-eyebrow">▸ THE CASE TABLE — DEV MOCK v4</div>
            <div className="ct-devrow">
              <button className="ct-dev" title="Deterministic docket seed — dev only. Same seed replays the same table. In production this becomes the Daily Docket date."
                onClick={() => setSeed((s) => s + 1)}>DEV · SEED {seed} ↻</button>
              <button className="ct-dev" title="Show the first-run tips again" onClick={resetTips}>TIPS ↺</button>
            </div>
          </div>
          <div className="ct-title">The Terminal has allocated you a book.<br />Don't lose the house's money.</div>
          <div className="ct-sub">
            You are the fifth seat at Our Lady of Perpetual Profit's trading desk — a book
            of {START_PF}, a docket of {DOCKET.length} cases, four partners running their own books beside you.
          </div>
          <div className="ct-steps">
            <div className="ct-step"><span className="ct-step-n">01</span>
              <div><b>WORK THE CASE</b> — {BASE_ACTIONS} actions per case. Ask a consultant a question, or play a card from your kit. Same cost.</div></div>
            <div className="ct-step"><span className="ct-step-n">02</span>
              <div><b>READ THE ROOM</b> — the partners call vague leans before you commit. Their exact numbers stay sealed until the Ledger.</div></div>
            <div className="ct-step"><span className="ct-step-n">03</span>
              <div><b>LOCK THE TICKET</b> — three dials: your read, your stake (up to {MAX_STAKE}; the council benchmarks a flat {STAKE}), your timing. A max-conviction miss at full stake costs {MAX_STAKE * 3}. That's more than your book. Barron would do it anyway.</div></div>
          </div>
          <div className="ct-eyebrow" style={{ marginTop: 6 }}>▸ CHOOSE YOUR PATRON — their perk rides the whole docket</div>
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
          {!tipsSeen.calls && (
            <Tip title="PUNDIT CALLS — FIRST TIME" onDismiss={() => dismissTip("calls")}>
              Leans are color, not answers. Each partner only read part of the case, and each has a bias —
              their exact numbers unseal at the Ledger next to yours. Copying the loudest voice at the table is how books die.
            </Tip>
          )}
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

  if (screen === "verdict") {
    const p = ticketP / 100;
    const v = bucket(p);
    const boldNow = patron === "demon" && Math.abs(p - 0.5) >= 0.3;
    const mult = payoutMult * (boldNow ? 1.25 : 1);
    const rightBrier = (p - (p >= 0.5 ? 1 : 0)) ** 2;
    const wrongBrier = (p - (p >= 0.5 ? 0 : 1)) ** 2;
    const ifRight = Math.round(ticketStake * (1 - 4 * rightBrier) * mult);
    const ifWrong = Math.round(ticketStake * (1 - 4 * wrongBrier) * mult);
    const h = HORIZON[ticketHorizon];
    return (
      <Shell>
        <div className="ct-talk">
          <SeatStrip />
          <div className="ct-eyebrow">▸ POSITION TICKET — CASE {caseIndex + 1}/{DOCKET.length} · {caseData.ticker}</div>
          <div className="ct-talk-note">Three dials, three skills. Every dial gets its own line in the Ledger.</div>
          {!tipsSeen.ticket && (
            <Tip title="THE TICKET — FIRST TIME" onDismiss={() => dismissTip("ticket")}>
              Bold and right pays best; bold and wrong costs about triple. Dead center risks nothing and wins nothing.
              Unsure of your read? Say so with the stake — sizing honestly is scored too. The timing call is a side
              bet: skip it unless the evidence told you when.
            </Tip>
          )}

          <div className="ct-dial" style={{ "--dc": VCOLOR[v] }}>
            <div className="ct-dial-head">
              <span className="ct-dial-name">01 · P(SCAM) — YOUR READ</span>
              <span className="ct-dial-val">{ticketP}% · {VLABEL[v]}</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={ticketP}
              onChange={(e) => setTicketP(+e.target.value)} aria-label="Probability this token is a scam" />
            <div className="ct-dial-sub">Dead center is Abstain — it pays nothing and costs nothing.</div>
          </div>

          <div className="ct-dial" style={{ "--dc": "#2fd6d6" }}>
            <div className="ct-dial-head">
              <span className="ct-dial-name">02 · STAKE — YOUR SIZE</span>
              <span className="ct-dial-val">{ticketStake} / {MAX_STAKE}</span>
            </div>
            <input type="range" min={0} max={MAX_STAKE} step={1} value={ticketStake}
              onChange={(e) => setTicketStake(+e.target.value)} aria-label="Stake for this case" />
            <div className="ct-dial-sub">
              The council benchmarks a flat {STAKE}. This ticket: right{" "}
              <span style={{ color: "#4dffaa" }}>{ifRight >= 0 ? "+" : ""}{ifRight}</span> · wrong{" "}
              <span style={{ color: "#ff5454" }}>{ifWrong}</span>
              {boldNow ? " · ⟡ DEVIL'S LEVERAGE ×1.25 armed" : ""}
              {payoutMult > 1 ? " · BULL RUN ×1.25" : ""}
            </div>
          </div>

          <div className="ct-dial" style={{ "--dc": "#ffd23a" }}>
            <div className="ct-dial-head">
              <span className="ct-dial-name">03 · HORIZON — YOUR TIMING</span>
              <span className="ct-dial-val">{h.label}</span>
            </div>
            <input type="range" min={0} max={HORIZON.length - 1} step={1} value={ticketHorizon}
              onChange={(e) => setTicketHorizon(+e.target.value)} aria-label="When does it unravel" />
            <div className="ct-dial-sub">
              {h.sub}. Side pot: a rug landing in your window pays +{HORIZON_HIT}; anything else {HORIZON_MISS} — including a token that holds.
            </div>
          </div>

          <button className="ct-cta" onClick={() => {
            setPlayerVerdict(v); setPlayerP(p);
            settleCase(p, ticketStake, ticketHorizon);
            setScreen("reveal");
          }}>LOCK THE TICKET ▸</button>
          <button className="ct-ghost" onClick={() => setScreen("calls")}>◀ BACK TO PUNDIT CALLS</button>
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
                    <span className="ct-lean-scan"> {VLABEL[v]} @ {Math.round(row.p * 100)}% scam · stake {row.stake}{row.bold ? " · DEVIL'S LEVERAGE ×1.25" : ""}</span></div>
                  <div className="ct-ledger-nums">
                    <span style={{ color: row.pnl >= 0 ? "#4dffaa" : "#ff5454" }}>{row.pnl >= 0 ? "+" : ""}{Math.round(row.pnl)}</span>
                    <span className="ct-dim"> → {Math.round(row.book)}</span>
                    {row.justBusted && <span className="ct-rug"> {row.seat === YOU ? "OFF THE DESK" : "BOOK GONE"}</span>}
                  </div>
                  {row.seat === YOU && row.sizing && (
                    <div className="ct-debrief">
                      ◈ SIZING — {row.sizing.verdict === "centered"
                        ? "a dead-center call: the stake never mattered"
                        : row.sizing.verdict === "sized"
                          ? `sized to your conviction (${Math.round(row.p * 100)}% justifies ~${row.sizing.justified})`
                          : row.sizing.verdict === "oversized"
                            ? `oversized — ${Math.round(row.p * 100)}% conviction justifies ~${row.sizing.justified}, you staked ${row.stake}`
                            : `timid — ${Math.round(row.p * 100)}% conviction justifies ~${row.sizing.justified}, you staked ${row.stake}`}
                    </div>
                  )}
                  {row.seat === YOU && row.horizon && (
                    <div className="ct-debrief" style={{ color: row.horizon.hit ? "#4dffaa" : "#ff5454" }}>
                      ⌛ HORIZON {HORIZON[row.horizon.idx].label} — {row.horizon.hit
                        ? `hit: it unraveled day ${row.horizon.day} (+${HORIZON_HIT})`
                        : truth === 1
                          ? `missed: it unraveled day ${row.horizon.day} (${HORIZON_MISS})`
                          : `it never rugged (${HORIZON_MISS})`}
                    </div>
                  )}
                  {row.seat === YOU && row.stopLoss && (
                    <div className="ct-debrief" style={{ color: "#4dffaa" }}>
                      ⟡ NEON STOP LOSS — a {row.stopLoss.from} ticket capped at {STOP_LOSS_FLOOR}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {pendingEvent && (
            <div className={`ct-event${pendingEvent.id === "calm" ? " ct-event--calm" : ""}`}>
              <div className="ct-event-label">◈ MARKET FLIPS BETWEEN CASES — {pendingEvent.label}</div>
              <div className="ct-event-text">{pendingEvent.text}</div>
              <div className="ct-event-effect">EFFECT · {pendingEvent.effect}</div>
              {shieldSpent && pendingEvent.portfolioAll < 0 && (
                <div className="ct-event-text" style={{ color: "#4dffaa" }}>Your shield absorbs the hit — your book takes nothing.</div>
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
      ) : screen === "reveal" ? (
        <RevealScreen
          caseData={caseData}
          verdict={playerVerdict}
          confidence={playerP}
          investigated={Object.keys(asked).filter((k) => (asked[k]?.length || 0) > 0)}
          speakerKey={[...visited].reverse()[0] || "monk"}
          onExit={() => setScreen("ledger")}
        />
      ) : screen === "channel" && caseData.stations[activeStation] ? (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: DOCK_H }}>
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
              onVerdict={callsOpen ? enterCalls : undefined}
              useSitePal={false}
              compact
            />
          </div>
          {tableDock}
        </>
      ) : (
        deskGrid
      )}
    </div>
  );
}

// Card-shaped kit card, shared by the desk row and the channel dock (the
// kc- styles live in both surfaces' style blocks). Two-tap flow: arm → play.
function KitCard({ color, name, kind, text, footer, state = "idle", small, onClick }) {
  return (
    <button
      className={`kc-card ${state}${small ? " kc-small" : ""}`}
      style={{ "--cc": color }}
      onClick={onClick}
    >
      <span className="kc-name">{name}</span>
      <span className="kc-kind">{kind}</span>
      <span className="kc-text">{text}</span>
      <span className="kc-play">{footer}</span>
    </button>
  );
}

// Shared kc- rules, embedded by both the desk and the dock style blocks.
const KC_CSS = `
  .kc-card { position: relative; flex: 0 0 auto; width: 168px; aspect-ratio: 3 / 4; cursor: pointer;
    display: flex; flex-direction: column; gap: 6px; padding: 10px 10px 9px; text-align: left;
    border: 1.5px solid color-mix(in srgb, var(--cc) 65%, transparent);
    background: color-mix(in srgb, var(--cc) 7%, #04140f); color: #f4fffb; font-family: 'Courier New', monospace;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
    box-shadow: inset 0 0 18px color-mix(in srgb, var(--cc) 14%, transparent);
    transition: box-shadow 0.15s ease, transform 0.1s ease; }
  .kc-card:hover { box-shadow: inset 0 0 24px color-mix(in srgb, var(--cc) 26%, transparent),
    0 0 12px color-mix(in srgb, var(--cc) 40%, transparent); }
  .kc-card:active { transform: scale(0.98); }
  .kc-card.kc-small { width: 136px; padding: 8px 8px 7px; gap: 5px; }
  .kc-name { font-size: 12.5px; font-weight: bold; line-height: 1.25; }
  .kc-small .kc-name { font-size: 10.5px; }
  .kc-kind { font-size: 8px; letter-spacing: 0.12em; color: var(--cc); }
  .kc-text { font-size: 10.5px; line-height: 1.45; color: #bfeede; opacity: 0.85; flex: 1; overflow: hidden; }
  .kc-small .kc-text { font-size: 9.5px; line-height: 1.4; }
  .kc-play { font-size: 9.5px; font-weight: bold; letter-spacing: 0.06em; color: var(--cc); text-align: center;
    border: 1px solid color-mix(in srgb, var(--cc) 55%, transparent); padding: 6px 4px; opacity: 0.7; }
  .kc-small .kc-play { font-size: 8px; padding: 5px 3px; }
  .kc-card.armed { border-color: var(--cc); box-shadow: 0 0 14px color-mix(in srgb, var(--cc) 45%, transparent); }
  .kc-card.armed .kc-play { background: color-mix(in srgb, var(--cc) 18%, transparent); opacity: 1; }
  .kc-card.played { opacity: 0.35; cursor: default; }
`;

// One-time mechanic scaffold. Self-styled so it works on Shell screens and
// on the dock screens alike (style tags here are global, not scoped).
function Tip({ title, children, onDismiss, float }) {
  return (
    <div className={`ct-tip ${float ? "ct-tip-float" : ""}`}>
      <div className="ct-tip-title">◈ {title}</div>
      <div className="ct-tip-body">{children}</div>
      <button className="ct-tip-btn" onClick={onDismiss}>GOT IT ▸</button>
      <style>{`
        .ct-tip { border: 1px dashed rgba(255,210,58,0.55); background: rgba(16,13,2,0.92); padding: 11px 12px;
          display: flex; flex-direction: column; gap: 6px; font-family: 'Courier New', monospace; }
        .ct-tip-title { color: #ffd23a; font-size: 10.5px; letter-spacing: 0.12em; font-weight: bold; }
        .ct-tip-body { color: #eafff9; font-size: 11.5px; line-height: 1.55; }
        .ct-tip-btn { align-self: flex-end; background: rgba(255,210,58,0.12); border: 1px solid #ffd23a; color: #ffd23a;
          font-family: inherit; font-size: 10.5px; font-weight: bold; letter-spacing: 0.08em; padding: 6px 12px; cursor: pointer; }
        .ct-tip-float { position: absolute; left: 12px; right: 12px; bottom: ${DOCK_H + 12}px; z-index: 10080;
          box-shadow: 0 6px 24px rgba(0,0,0,0.6); }
      `}</style>
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
        .ct-lobby-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ct-devrow { display: flex; gap: 6px; }
        .ct-dev { background: none; border: 1px dashed rgba(191,238,222,0.35); color: #bfeede; opacity: 0.6;
          font: inherit; font-size: 9.5px; letter-spacing: 0.08em; padding: 4px 8px; cursor: pointer; }
        .ct-dev:hover { opacity: 1; }
        .ct-steps { display: flex; flex-direction: column; gap: 9px; }
        .ct-step { display: flex; gap: 10px; align-items: baseline; font-size: 12px; line-height: 1.55; color: #bfeede; }
        .ct-step b { color: #f4fffb; letter-spacing: 0.04em; }
        .ct-step-n { color: #ffd23a; font-size: 11px; flex-shrink: 0; font-weight: bold; }
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
        .ct-debrief { font-size: 11px; color: #bfeede; line-height: 1.45; letter-spacing: 0.03em; }
        .ct-dial { background: rgba(4,20,15,0.7); border-left: 3px solid var(--dc); padding: 11px 13px;
          display: flex; flex-direction: column; gap: 7px; }
        .ct-dial-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .ct-dial-name { font-size: 10.5px; letter-spacing: 0.12em; color: #bfeede; opacity: 0.85; }
        .ct-dial-val { font-size: 14px; font-weight: bold; color: var(--dc); text-shadow: 0 0 10px color-mix(in srgb, var(--dc) 50%, transparent); }
        .ct-dial input[type="range"] { width: 100%; accent-color: var(--dc); cursor: pointer; height: 22px; }
        .ct-dial-sub { font-size: 10.5px; line-height: 1.5; color: #bfeede; opacity: 0.75; }
        .ct-truth { font-size: 22px; font-weight: bold; letter-spacing: 0.05em; text-shadow: 0 0 14px currentColor; margin: 2px 0 6px; }
        .ct-event { border: 1px dashed rgba(255,210,58,0.55); padding: 12px; margin-top: 4px; }
        .ct-event-label { color: #ffd23a; font-size: 12px; letter-spacing: 0.1em; font-weight: bold; }
        .ct-event-text { font-size: 12px; color: #eafff9; margin-top: 4px; }
        .ct-event-effect { font-size: 10px; letter-spacing: 0.12em; font-weight: bold; color: #ffd23a; margin-top: 6px; }
        .ct-event--calm { opacity: 0.55; border-style: dotted; }
        .ct-event--calm .ct-event-effect { color: #bfeede; }
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
