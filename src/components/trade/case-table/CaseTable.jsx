"use client";
import React, { useCallback, useEffect } from "react";
import ChannelView from "@/components/trade/ChannelView";
import TerminalMenu from "@/components/trade/TerminalMenu";
import RevealScreen, { revealOutcome } from "@/components/trade/RevealScreen";
import { KIT_CARDS } from "@/game/terminal-traders/caseKit";
import { YOU } from "@/game/terminal-traders/docketRun";
import { playUnicornBeat, stopUnicornBeat } from "@/lib/trade/playUnicornBeat";
import { DOCK_H } from "./constants";
import { useDocketRun } from "./useDocketRun";
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
// The CRT PRESENTATION of a docket run. All run state and rules live in
// useDocketRun (the controller — Phase 1 split, §4.8 applied-notes); this
// component maps that state onto the terminal screens under this directory,
// and owns the presentation-only concerns: Eugene's ElevenLabs voice,
// SitePal scene routing, and the reveal's flavor copy. Phase 2 renders the
// SAME controller through the /trade temple scene instead.
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
//   templeStage   — the host mounts this over the live temple scene and can
//                   stage the REAL curtain call (desktop /trade). On the
//                   reveal, backgrounds go transparent and the outcome is
//                   reported up via onRevealChange so the page drives
//                   revealMode; onRevealChange(null) fires on the way out.
export default function CaseTable({ docket, initialSeed = 1337, dev = false, sitePalScenes = null, onExit, recordScores = false, templeStage = false, onRevealChange = null }) {
  const run = useDocketRun({ docket, initialSeed, recordScores });
  const {
    seed, stepSeed, screen, go, caseIndex, flow, remaining, caseData, signals,
    activeId, pickProspect, dealtHand, kitPool,
    books, busted, briers, payoutMult, pendingEvent, ledger, reward, apiFetch,
    activeStation, actionsUsed, actionsMax, actionsLeft, asked, revealed, visited,
    overageNext, canAffordOverage, callsOpen, overageSpent, tableLog, punditFinal,
    ticketP, setTicketP, ticketStake, setTicketStake, ticketHorizon, setTicketHorizon,
    playerP, playerVerdict,
    patron, kit, kitPlayed, kitLog, deepReveals, unlockedQuestions,
    shieldSpent, peekArmed, peekChoice, hintUsed,
    playFlash, dismissFlash, botMods, monkShieldHeld,
    tipsSeen, dismissTip, resetTips,
    startDocket, confirmKit, enterCalls, openChannel, ask, playKitCard, useHint,
    lockTicket, advance, newDocket, revealPeek,
    shortName,
  } = run;

  // Eugene's voice at the table (2026-07-22): MYTHOS has no SitePal scene —
  // he speaks through his own ElevenLabs pipeline (playUnicornBeat handles
  // speechify, the shared iOS AudioContext, and self-interruption). Voiced
  // mounts only: sitePalScenes null (the dev sandbox) stays silent. This is
  // presentation, not run state — the temple mount voices him in-scene.
  const speakEugene = useCallback((line) => { playUnicornBeat({ line }); }, []);
  useEffect(() => {
    if (screen !== "channel" || activeStation !== "eugene") stopUnicornBeat();
    return () => stopUnicornBeat();
  }, [screen, activeStation]);

  // Temple curtain call (Phase 2): while the reveal is up on a templeStage
  // mount, hand the outcome to the host — page.js maps it onto the scene's
  // revealMode (lineup + reactions + Stage camera) and un-idles the canvas.
  // Cleared on any screen change and on unmount, so an exit mid-reveal can't
  // strand the temple in reveal mode.
  const liveReveal = templeStage && screen === "reveal";
  useEffect(() => {
    if (!onRevealChange) return;
    onRevealChange(liveReveal ? revealOutcome(caseData, playerVerdict) : null);
    return () => onRevealChange(null);
  }, [liveReveal, caseData, playerVerdict, onRevealChange]);

  // The kit hand, both sizes — the desk row and the channel dock render the
  // same state through the same tap-for-close-up flow. The hand is the
  // confirmed kit; the First Twelve fallback only shows if the kit screen
  // was somehow skipped.
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
        onSeedStep={stepSeed}
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
        onPickProspect={pickProspect}
        caseIndex={caseIndex}
        docketLength={flow.length}
        onConfirm={confirmKit}
        onBack={() => go("lobby")}
      />
    );
  }

  if (screen === "calls") {
    return (
      <PunditCalls
        ticker={caseData.ticker} caseIndex={caseIndex} docketLength={flow.length}
        books={books} busted={busted} ledger={ledger} patron={patron}
        punditFinal={punditFinal} mods={botMods}
        peekArmed={peekArmed} peekChoice={peekChoice}
        onPeek={revealPeek}
        tipSeen={tipsSeen.calls} onDismissTip={() => dismissTip("calls")}
        onCommit={() => go("verdict")}
        onBack={() => go("grid")}
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
        onLock={lockTicket}
        onBack={() => go("calls")}
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
        monkShieldHeld={monkShieldHeld}
        onAdvance={advance}
      />
    );
  }

  if (screen === "standings") {
    return (
      <Standings
        books={books} busted={busted} briers={briers}
        reward={reward}
        seed={seed} apiFetch={apiFetch} liveBoard={recordScores}
        onNewDocket={newDocket}
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
    <div style={{ position: "absolute", inset: 0, zIndex: 10050, background: liveReveal ? "transparent" : "#02100e" }}>
      {/* Play-result banner — what the card just did, and where the intel
          landed. Tap to dismiss; auto-clears. */}
      {playFlash && (screen === "grid" || screen === "channel") && (
        <button className="ct-playflash" data-tone={playFlash.tone} onClick={dismissFlash}>
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
        <TerminalMenu caseData={caseData} caseIndex={caseIndex} docketLength={flow.length} onBegin={() => go("grid")} onSkip={enterCalls} onExit={() => go("lobby")} exitLabel="◀ LOBBY" />
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
          liveStage={templeStage}
          onExit={() => go("ledger")}
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
              onBack={() => go("grid")}
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
