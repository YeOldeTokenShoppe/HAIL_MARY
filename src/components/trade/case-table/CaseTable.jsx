"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useOilApiFetch } from "@/lib/oilApiClient";
import ChannelView from "@/components/trade/ChannelView";
import TerminalMenu from "@/components/trade/TerminalMenu";
import RevealScreen from "@/components/trade/RevealScreen";
import CASE_001 from "@/components/game/cases/case-001";
import CASE_002 from "@/components/game/cases/case-002";
import CASE_003 from "@/components/game/cases/case-003";
import { CASE_SIGNALS } from "@/game/terminal-traders/caseSignals";
import { resolveKitPlay, KIT_CARDS, kitCardsFromCollection, dealKit, shuffleDocket } from "@/game/terminal-traders/caseKit";
import {
  YOU, BASE_ACTIONS, BOT_ROUNDS, bucket,
  createBotState, botRound, finalizeCalls, settleCase,
} from "@/game/terminal-traders/docketRun";
import { recordCaseResult } from "@/components/GameOverlay";
import { playUnicornBeat, stopUnicornBeat } from "@/lib/trade/playUnicornBeat";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";
import { useCardCollection } from "@/hooks/useCardCollection";
import { SEATS, STAKE, START_PF, DOCK_H } from "./constants";
import { KitHand } from "./KitCard";
import DealHand from "./DealHand";
import Lobby from "./Lobby";
import DeskGrid from "./DeskGrid";
import TableDock from "./TableDock";
import PunditCalls from "./PunditCalls";
import PositionTicket from "./PositionTicket";
import Ledger from "./Ledger";
import Standings from "./Standings";

// CASE TABLE — the fifth-seat docket game (CASE_TABLE.md §4, v4 ticket).
//
// This orchestrator owns the run: docket state, per-case investigation
// state, the ticket dials, and the kit/table state. The rules live in the
// engine modules (caseKit.js / docketRun.js); the screens under this
// directory are presentational. CaseTableDev.jsx mounts this with `dev` for
// /case-table-dev; MobileTerminalGame mounts it as the CASE FILES module.
//
// Props:
//   docket        — case files in docket order (defaults to cases 001-003)
//   initialSeed   — deterministic docket seed; in production this becomes
//                   the Daily Docket date (NEW DOCKET steps it for now)
//   dev           — show the lobby's dev controls (seed stepper, tips reset)
//   sitePalScenes — { stationKey: sceneId } to voice the channels; null
//                   keeps the table silent (the dev mock's mode)
//   onExit        — exit affordance in the lobby (back to the terminal hub)
//   recordScores  — fold each graded ledger into the GameOverlay session
//                   scorecard (recordCaseResult). Off by default so the dev
//                   sandbox doesn't pollute the player's calibration trail;
//                   the /trade mount turns it on.
const DEFAULT_DOCKET = [CASE_001, CASE_002, CASE_003];

export default function CaseTable({ docket = DEFAULT_DOCKET, initialSeed = 1337, dev = false, sitePalScenes = null, onExit, recordScores = false }) {
  const [seed, setSeed] = useState(initialSeed);

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
  // `kit` is the confirmed KitSelect pick — it persists across cases and
  // dockets ("RUN IT BACK"); everything else here resets per case.
  const [kit, setKit] = useState(null);
  const [unlockedQuestions, setUnlockedQuestions] = useState({}); // { stationKey: true }
  const [deepReveals, setDeepReveals] = useState(0);              // Tier-2 count → scorecard
  const [kitLog, setKitLog] = useState([]);                       // structured plays → Ledger/Reveal callouts
  const [kitPlayed, setKitPlayed] = useState([]);
  const [shields, setShields] = useState(0);
  const [shieldSpent, setShieldSpent] = useState(false);
  const [stopLossArmed, setStopLossArmed] = useState(false); // Neon Stop Loss — this case only
  const [peekArmed, setPeekArmed] = useState(false);
  const [peekChoice, setPeekChoice] = useState(null);
  const [marisolFreeUsed, setMarisolFreeUsed] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [tableLog, setTableLog] = useState([]);
  const [overageSpent, setOverageSpent] = useState(0); // per-case research tab
  // The play-result banner: card effects resolve at OTHER stations and the
  // table feed is easy to miss, so every play announces itself prominently
  // ("nothing happens when I use the cards" — playtest 2026-07-22).
  const [playFlash, setPlayFlash] = useState(null);
  const [punditFinal, setPunditFinal] = useState({}); // { stationKey: { p, scanned } }

  const botRef = useRef(createBotState());

  // Docket-win reward (Phase 1, CASE_TABLE.md §6): beating the council on
  // the Daily Docket claims one sealed pack from /api/tcg-docket-reward.
  // Only the real mount claims (recordScores); the claim is once per seed.
  const { isSignedIn } = useUser();
  const apiFetch = useOilApiFetch();
  const [reward, setReward] = useState(null);
  const rewardSeedRef = useRef(null);

  // The owned action pool (signed-out / still-loading falls back to the
  // First Twelve), and this prospect's DEALT hand — seeded, legal by
  // construction, different every case. The collection is the deck.
  const { cards: ownedCards } = useCardCollection();
  const kitPool = React.useMemo(() => kitCardsFromCollection(ownedCards) || KIT_CARDS, [ownedCards]);
  const dealtHand = React.useMemo(() => dealKit(kitPool, seed, caseIndex), [kitPool, seed, caseIndex]);

  // Seeded flow (interim replayability patch): today's shuffle decides the
  // prospect spread. The player PLACES their active deal from the remaining
  // spread each round (§10.1 — the Pokémon active-slot move); the shuffled
  // order is only the fallback when nothing has been placed.
  const flow = React.useMemo(() => shuffleDocket(docket, seed), [docket, seed]);
  const [playedIds, setPlayedIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const remaining = React.useMemo(() => flow.filter((c) => !playedIds.includes(c.id)), [flow, playedIds]);
  const caseData = remaining.find((c) => c.id === activeId) || remaining[0] || flow[flow.length - 1];
  const signals = CASE_SIGNALS[caseData.id];
  const actionsMax = BASE_ACTIONS + bonusActions;
  const actionsLeft = Math.max(0, actionsMax - actionsUsed);
  // RESEARCH OVERAGE (playtest 2026-07-22: "let the user play as many cards
  // and question as many traders as they want"): the cap is a PRICE, not a
  // wall — §10's research-costs principle in interim form. The first
  // actionsMax actions are free; beyond that each action bills the book at
  // an escalating rate (−2, −3, −4...), floored so research can't bust you.
  // Sweeping everything is legal and usually worse than selectivity — the
  // ledger shows the tab.
  const overageNext = actionsUsed >= actionsMax ? actionsUsed - actionsMax + 2 : 0;
  const canAffordOverage = overageNext === 0 || (books[YOU] ?? 0) - overageNext >= 5;
  // The calls are always open — trading anytime is the skip path's promise.
  const callsOpen = true;

  const log = (line) => setTableLog((l) => [...l, line]);
  const shortName = (k) => CHARACTER_META[k].name.split(" ").pop();

  useEffect(() => {
    if (!playFlash) return;
    const t = setTimeout(() => setPlayFlash(null), 5500);
    return () => clearTimeout(t);
  }, [playFlash]);

  // Eugene's voice at the table (2026-07-22): MYTHOS has no SitePal scene —
  // he speaks through his own ElevenLabs pipeline (playUnicornBeat handles
  // speechify, the shared iOS AudioContext, and self-interruption). Voiced
  // mounts only: sitePalScenes null (the dev sandbox) stays silent.
  const speakEugene = useCallback((line) => { playUnicornBeat({ line }); }, []);
  useEffect(() => {
    if (screen !== "channel" || activeStation !== "eugene") stopUnicornBeat();
    return () => stopUnicornBeat();
  }, [screen, activeStation]);

  // Claim the docket reward when the standings open: finishing alive earns
  // the day's dossier coin, and beating the council (rank 1) stacks a sealed
  // pack on top (Genesis is earned entirely through play — GENESIS.md §6).
  // The server validates the seed against the Daily Docket calendar and
  // enforces one claim per user per seed; a replayed or seed-stepped table
  // comes back "not-a-live-docket" and pays nothing. Liquidated books get
  // nothing — the Order withdraws its blessing.
  useEffect(() => {
    if (screen !== "standings" || !recordScores) return;
    if (busted[YOU]) { setReward(null); return; }
    const ranked = [...SEATS].sort((a, b) => (books[b] ?? 0) - (books[a] ?? 0));
    const won = ranked[0] === YOU;
    if (!isSignedIn) { setReward({ status: "signin", won }); return; }
    if (rewardSeedRef.current === seed) return;
    rewardSeedRef.current = seed;
    setReward({ status: "checking", won });
    const bs = briers[YOU] || [];
    const avgBrier = bs.length ? bs.reduce((x, y) => x + y, 0) / bs.length : null;
    apiFetch("/api/tcg-docket-reward", {
      method: "POST",
      body: JSON.stringify({ seed, won, finalBook: books[YOU], avgBrier, patron }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.coin) setReward({ status: "granted", won: !!data.won, coin: data.coin, pack: Array.isArray(data.pack) ? data.pack : null });
        else if (res.status === 409) setReward({ status: "already", won });
        else if (data.error === "not-a-live-docket") setReward({ status: "offDocket", won });
        else setReward({ status: "error", won });
      })
      .catch(() => setReward({ status: "error", won }));
  }, [screen, recordScores, isSignedIn, books, busted, briers, seed, patron, apiFetch]);

  // ---------- turn engine (docketRun.js) ----------
  const runBotRound = () => {
    botRound(botRef.current, { seed, caseIndex, order: CHARACTER_ORDER, meta: CHARACTER_META }).forEach(log);
  };

  const enterCalls = () => {
    const { final, logs } = finalizeCalls(botRef.current, { seed, caseIndex, signals, order: CHARACTER_ORDER, meta: CHARACTER_META });
    logs.forEach(log);
    setPunditFinal(final);
    setScreen("calls");
  };

  const openChannel = (key) => {
    setActiveStation(key);
    setScreen("channel");
    setVisited((v) => (v.includes(key) ? v : [...v, key]));
  };

  // Charge the overage for one more action beyond the free budget. Returns
  // false (and logs) when the house won't fund it. No-op inside the budget.
  const billOverage = () => {
    if (overageNext === 0) return true;
    if (!canAffordOverage) {
      log("⟡ The house won't fund more research — your book is too thin.");
      return false;
    }
    setBooks((b) => ({ ...b, [YOU]: (b[YOU] ?? 0) - overageNext }));
    setOverageSpent((s) => s + overageNext);
    log(`⟡ Research overage — the desk bills your book −${overageNext}.`);
    return true;
  };

  const ask = (qIndex) => {
    const key = activeStation;
    const free = patron === "marisol" && key === "marisol" && !marisolFreeUsed;
    if ((asked[key] || []).includes(qIndex)) return;
    // "locked" = the station's sealed 4th question (§3.3) — askable only
    // after a deep scan unseals it, and it costs a scan like any other.
    if (qIndex === "locked" && !unlockedQuestions[key]) return;
    // Bill LAST, after every no-op check — a duplicate tap must never charge.
    if (!free && !billOverage()) return;
    const q = qIndex === "locked"
      ? caseData.stations[key]?.lockedQuestion
      : caseData.stations[key]?.questions[qIndex];
    const reveal = q?.reveals;
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
    runBotRound();
    if (actionsUsed + 1 === actionsMax) log("▸ Free actions spent — more research bills your book. The calls are open.");
  };

  // ---------- kit (caseKit.js) ----------
  const playKitCard = (card) => {
    if (kitPlayed.includes(card.id)) return;
    const play = resolveKitPlay(card, {
      signals, caseData, revealed, unlocked: unlockedQuestions,
      visited, order: CHARACTER_ORDER, shortName,
    });
    log(play.log);
    if (!play.ok) {
      // whiff — the card (and the action) isn't consumed, and never billed
      setPlayFlash({ tone: "whiff", name: card.name, text: play.log.replace(/^⟡\s*/, ""), stations: [] });
      return;
    }
    if (!billOverage()) return; // beyond the free budget and the book's too thin
    // Tier-1 and Tier-2 labels share one revealed map (labels are unique per
    // station by authoring rule); ChannelView resolves the tier per label.
    const merged = {};
    [play.reveals, play.deepReveals].forEach((set) => {
      Object.entries(set || {}).forEach(([k, labels]) => { merged[k] = [...(merged[k] || []), ...labels]; });
    });
    if (Object.keys(merged).length) setRevealed((r) => {
      const next = { ...r };
      Object.entries(merged).forEach(([k, labels]) => {
        next[k] = [...(next[k] || []), ...labels.filter((l) => !(next[k] || []).includes(l))];
      });
      return next;
    });
    if (play.unlocks) setUnlockedQuestions((u) => ({ ...u, ...play.unlocks }));
    const count = (set) => Object.values(set || {}).reduce((n, labels) => n + labels.length, 0);
    const deepCount = count(play.deepReveals) + (play.connection ? 1 : 0);
    if (deepCount) setDeepReveals((n) => n + deepCount);
    setKitLog((l) => [...l, {
      id: card.id, name: card.name, kind: card.kind, station: card.station || null,
      tier1: count(play.reveals) - (play.connection ? play.connection.lenses.length : 0),
      deep: count(play.deepReveals),
      unlockedStation: play.unlocks ? Object.keys(play.unlocks)[0] : null,
      connectionLabel: play.connection?.label || null,
      lenses: play.connection?.lenses || null,
    }]);
    if (play.grants?.shields) setShields((s) => s + play.grants.shields);
    if (play.grants?.stopLoss) setStopLossArmed(true);
    if (play.grants?.peek) setPeekArmed(true);
    if (play.grants?.bonusActions) setBonusActions((b) => b + play.grants.bonusActions);
    setPlayFlash({
      tone: "ok",
      name: card.name,
      text: play.log.replace(new RegExp(`^⟡\\s*(You play\\s+${card.name}\\s*—\\s*)?`), ""),
      stations: Object.keys(merged),
    });
    setKitPlayed((p) => [...p, card.id]);
    setActionsUsed((a) => a + 1);
    runBotRound();
    // wildcard grants +2 actions, so recompute against the post-play max
    const maxAfter = card.kind === "wildcard" ? actionsMax + 2 : actionsMax;
    if (actionsUsed + 1 === maxAfter) log("▸ Free actions spent — more research bills your book. The calls are open.");
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
    setReward(null);
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
    setPlayedIds([]);
    setActiveId(null);
    resetInvestigation();
    // The shuffle leads (playtest 2026-07-22): deal the hand FIRST, then
    // the prospect briefing — cards in hand before you meet the deal.
    setScreen("kit");
  };

  const resetInvestigation = () => {
    setActiveStation(null); setActionsUsed(0); setBonusActions(0);
    setAsked({}); setRevealed({}); setVisited([]);
    setPlayerP(null); setPlayerVerdict(null);
    setTicketP(50); setTicketStake(STAKE); setTicketHorizon(0);
    setKitPlayed([]); setShieldSpent(false); setStopLossArmed(false);
    setPeekArmed(false); setPeekChoice(null); setMarisolFreeUsed(false);
    setTableLog([]); setPunditFinal({});
    // per-case Tier-2 state (the confirmed `kit` itself persists)
    setUnlockedQuestions({}); setDeepReveals(0); setKitLog([]);
    setOverageSpent(0);
    botRef.current = createBotState();
  };

  const settle = (pHuman, stakeYou, horizonIdx) => {
    const result = settleCase({
      signals, order: CHARACTER_ORDER, books, busted, briers, punditFinal,
      botState: botRef.current, pHuman, stakeYou, horizonIdx, patron,
      payoutMult, shields, stopLossArmed,
      youScanned: Object.keys(asked).filter((s) => (asked[s]?.length || 0) > 0),
      caseIndex, docketLength: flow.length, seed,
    });
    setBooks(result.books);
    setBusted(result.busted);
    setBriers(result.briers);
    setPendingEvent(result.event);
    setPayoutMult(result.payoutMult);
    if (result.shieldSpent) { setShields((s) => s - 1); setShieldSpent(true); }
    setLedger(result.rows);

    // Fold the graded result into the running session scorecard — the same
    // trail the desktop reveal writes (GameOverlay SESSION_KEY), so docket
    // play and 3D-scene play share one calibration history. `correct` is
    // null on an abstain (mid-band read): it breaks the streak without
    // counting as a wrong call. Ungraded cases (no truth) never record.
    if (recordScores && signals?.truth != null) {
      const v = bucket(pHuman);
      const correct = v === "abstain" ? null : (v === "doubt") === (signals.truth === 1);
      try { recordCaseResult({ brier: (pHuman - signals.truth) ** 2, correct, deepReveals }); } catch {}
    }
  };

  const advance = () => {
    if (busted[YOU] || caseIndex >= flow.length - 1) {
      setScreen("standings");
      return;
    }
    setPlayedIds((p) => [...p, caseData.id]);
    setActiveId(null);
    setCaseIndex((i) => i + 1);
    resetInvestigation();
    setScreen("kit");
  };

  // The kit hand, both sizes — the desk row and the channel dock render the
  // same state through the same two-tap flow. The hand is the confirmed kit;
  // the First Twelve fallback only shows if the kit screen was somehow skipped.
  const kitHand = (small) => (
    <KitHand
      cards={kit || KIT_CARDS}
      small={small}
      kitPlayed={kitPlayed}
      noActions={overageNext > 0 && !canAffordOverage}
      overageCost={canAffordOverage ? overageNext : 0}
      onPlay={playKitCard}
      showHint={patron === "eugene" && !hintUsed}
      onHint={useHint}
    />
  );

  // ---------- screens ----------
  if (screen === "lobby") {
    return (
      <Lobby
        docketLength={flow.length}
        onStart={startDocket}
        onExit={onExit}
        dev={dev}
        seed={seed}
        onSeedStep={() => setSeed((s) => s + 1)}
        onResetTips={resetTips}
      />
    );
  }

  if (screen === "kit") {
    return (
      <DealHand
        hand={dealtHand}
        poolSize={kitPool.length}
        prospects={remaining}
        activeId={activeId}
        onPickProspect={setActiveId}
        caseIndex={caseIndex}
        docketLength={flow.length}
        onConfirm={(cards) => { setKit(cards); setScreen("menu"); }}
        onBack={() => setScreen("lobby")}
      />
    );
  }

  if (screen === "calls") {
    return (
      <PunditCalls
        ticker={caseData.ticker} caseIndex={caseIndex} docketLength={flow.length}
        books={books} busted={busted} ledger={ledger} patron={patron}
        punditFinal={punditFinal} mods={botRef.current.mods}
        peekArmed={peekArmed} peekChoice={peekChoice}
        onPeek={(k) => { setPeekChoice(k); setPeekArmed(false); }}
        tipSeen={tipsSeen.calls} onDismissTip={() => dismissTip("calls")}
        onCommit={() => setScreen("verdict")}
        onBack={() => setScreen("grid")}
      />
    );
  }

  if (screen === "verdict") {
    return (
      <PositionTicket
        ticker={caseData.ticker} caseIndex={caseIndex} docketLength={flow.length}
        books={books} busted={busted} ledger={ledger} patron={patron}
        ticketP={ticketP} onTicketP={setTicketP}
        ticketStake={ticketStake} onTicketStake={setTicketStake}
        ticketHorizon={ticketHorizon} onTicketHorizon={setTicketHorizon}
        payoutMult={payoutMult}
        tipSeen={tipsSeen.ticket} onDismissTip={() => dismissTip("ticket")}
        onLock={({ p, v }) => {
          setPlayerVerdict(v); setPlayerP(p);
          settle(p, ticketStake, ticketHorizon);
          setScreen("reveal");
        }}
        onBack={() => setScreen("calls")}
      />
    );
  }

  if (screen === "ledger") {
    return (
      <Ledger
        ticker={caseData.ticker} truth={signals.truth}
        caseIndex={caseIndex} docketLength={flow.length}
        books={books} busted={busted} patron={patron} rows={ledger}
        kitPlays={kitLog} overageSpent={overageSpent}
        pendingEvent={pendingEvent} shieldSpent={shieldSpent}
        monkShieldHeld={!!botRef.current.shield.monk && !busted.monk}
        onAdvance={advance}
      />
    );
  }

  if (screen === "standings") {
    return (
      <Standings
        books={books} busted={busted} briers={briers}
        reward={reward}
        onNewDocket={() => { setSeed((s) => s + 1); setScreen("lobby"); setPatron(null); setLedger(null); setPendingEvent(null); setReward(null); }}
      />
    );
  }

  // reused screens — investigation sits above the table dock
  const revealSpeaker = sitePalScenes
    ? ([...visited].reverse().find((k) => sitePalScenes[k]) || "monk")
    : ([...visited].reverse()[0] || "monk");

  // §3.4's flavor callout — a connection beats a deep count; never scored.
  const kitConn = kitLog.find((k) => k.connectionLabel);
  const kitNote = kitConn
    ? `Your ${kitConn.name} connected the dots — ${kitConn.connectionLabel}.`
    : deepReveals > 0
      ? `${deepReveals} CLASSIFIED entr${deepReveals === 1 ? "y" : "ies"} from your kit informed this call.`
      : null;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10050, background: "#02100e" }}>
      {/* Play-result banner — what the card just did, and where the intel
          landed. Tap to dismiss; auto-clears. */}
      {playFlash && (screen === "grid" || screen === "channel") && (
        <button className="ct-playflash" data-tone={playFlash.tone} onClick={() => setPlayFlash(null)}>
          <span className="ct-pf-name">⟡ {playFlash.name.toUpperCase()}{playFlash.tone === "whiff" ? " — NO EFFECT (NOT SPENT)" : ""}</span>
          <span className="ct-pf-text">{playFlash.text}</span>
          {playFlash.stations.length > 0 && (
            <span className="ct-pf-where">
              NEW INTEL → {playFlash.stations.map((k) => shortName(k).toUpperCase()).join(" · ")}
              {playFlash.stations.some((k) => k !== activeStation) ? " — OPEN THEIR CHANNEL TO READ IT" : ""}
            </span>
          )}
        </button>
      )}
      <style>{`
        .ct-playflash { position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
          z-index: 10056; width: min(660px, calc(100% - 28px));
          display: flex; flex-direction: column; gap: 5px; text-align: left;
          background: rgba(4,20,15,0.96); border: 1.5px solid #ffd23a; color: #eafff9;
          font-family: 'Courier New', monospace; padding: 11px 14px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: 0 0 26px rgba(255,210,58,0.4), 0 8px 24px rgba(0,0,0,0.6);
          animation: ctpf-in 0.25s ease both; }
        .ct-playflash[data-tone="whiff"] { border-color: #bfeede; box-shadow: 0 0 18px rgba(191,238,222,0.25); }
        .ct-pf-name { font-size: 12px; font-weight: bold; letter-spacing: 0.1em; color: #ffd23a; }
        .ct-playflash[data-tone="whiff"] .ct-pf-name { color: #bfeede; }
        .ct-pf-text { font-size: 12.5px; line-height: 1.45; }
        .ct-pf-where { font-size: 10.5px; font-weight: bold; letter-spacing: 0.1em; color: #4dffaa; }
        @keyframes ctpf-in { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
      {screen === "menu" ? (
        <TerminalMenu caseData={caseData} caseIndex={caseIndex} docketLength={flow.length} onBegin={() => setScreen("grid")} onSkip={enterCalls} onExit={() => setScreen("lobby")} exitLabel="◀ LOBBY" />
      ) : screen === "reveal" ? (
        <RevealScreen
          caseData={caseData}
          verdict={playerVerdict}
          confidence={playerP}
          investigated={Object.keys(asked).filter((k) => (asked[k]?.length || 0) > 0)}
          pnl={ledger?.find((r) => r.seat === YOU)?.pnl ?? null}
          kitNote={kitNote}
          speakerKey={revealSpeaker}
          speakerSceneId={sitePalScenes?.[revealSpeaker]}
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
              connections={caseData.connections || []}
              lockedUnlocked={!!unlockedQuestions[activeStation]}
              overageCost={overageNext === 0 ? 0 : canAffordOverage ? overageNext : null}
              speakLine={sitePalScenes && activeStation === "eugene" ? speakEugene : undefined}
              onAsk={ask}
              onBack={() => setScreen("grid")}
              onVerdict={callsOpen ? enterCalls : undefined}
              useSitePal={!!sitePalScenes?.[activeStation]}
              sitePalSceneId={sitePalScenes?.[activeStation]}
              compact
            />
          </div>
          <TableDock
            tableLog={tableLog}
            actionsUsed={actionsUsed}
            actionsMax={actionsMax}
            book={books[YOU]}
            kitHand={kitHand(true)}
          />
        </>
      ) : (
        <DeskGrid
          caseData={caseData} caseIndex={caseIndex} docketLength={flow.length}
          visited={visited} revealed={revealed} tableLog={tableLog}
          tipSeen={tipsSeen.desk} onDismissTip={() => dismissTip("desk")}
          actionsLeft={actionsLeft} actionsMax={actionsMax} book={books[YOU]}
          callsOpen={callsOpen}
          onOpenChannel={openChannel}
          onEnterCalls={enterCalls}
          kitHand={kitHand(false)}
        />
      )}
    </div>
  );
}
