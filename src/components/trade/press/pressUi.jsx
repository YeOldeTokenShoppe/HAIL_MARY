"use client";
import React from "react";
import { BACKING, SEATS } from "@/game/terminal-traders/press/questions";
import { DESK, EUGENE, laneOwner, laneSentence } from "@/game/terminal-traders/press/desk";
import TradingCard from "@/components/TradingCard";

/*
 * SHARED FLOOR UI — the reading column and the dock, authored once.
 *
 * WHY THIS EXISTS. PressSession (desktop, in-scene) and PressFlat (mobile /
 * ?flat=1, CRT) share a pure controller but had two hand-written copies of the
 * same floor. Every desktop bug in the four-seat migration came from porting a
 * MECHANIC without porting the STATE GATING that made it work on the other
 * surface:
 *
 *   • the deck + CTA row swallowed, so the briefing had nothing to press
 *   • claim and answer anchored at the same `bottom`, so they overlapped
 *   • the seat row left ungated, so once a claim was answered every real
 *     control greyed out and the one deliberately-unclickable tile (Eugene)
 *     became the brightest thing on screen
 *   • `canPress` defined on one surface and referenced on both
 *
 * Four bugs, one cause. What moved here is exactly what drifted: the gate, the
 * claim body, the answer body, the seat row, the meter and the nav.
 *
 * WHAT DELIBERATELY DID NOT MOVE. The two surfaces are not the same layout and
 * should not pretend to be — desktop is an absolutely-positioned reading column
 * over a live 3D room; mobile is one scroll region above a pinned dock, and it
 * has a deferred-reveal beat (`flash.revealed` + LOOK) that desktop has no need
 * for. Each surface keeps its own containers and positioning CSS and composes
 * these pieces inside. If you add a prop here that only one caller ever passes,
 * check first whether it belongs in that caller's container instead.
 *
 * Class names are `pu-*` and shared; PRESS_UI_CSS styles them once.
 */

/** The one definition of "is an interruption legal right now". */
export function canPress(run, claim) {
  return run.pressesLeft > 0 && !!claim && !run.outcomes[claim.id];
}

/** What actually landed, in one line. It names WHOSE board the receipt is
 *  sitting on, which is the whole point of having sent somebody. */
export function answerNote(flash) {
  if (!flash) return "";
  if (flash.nothingOnFile) {
    return `⊘ NOTHING ON FILE — ${DESK[flash.seat]?.name ?? "they"} looked. There is no record.`;
  }
  if (flash.backing === BACKING.VIBES) return "▚ HIS SCREEN STAYS BLACK.";
  if (flash.backing === BACKING.SOFT) return "◍ PARTIAL — some of it landed.";
  const whose = flash.board === SEATS.BARRON ? "his" : `${DESK[flash.board]?.name}'s`;
  return `◼ ON RECORD — on ${whose} screen, and it stays there.`;
}

/* ---------------------------------------------------------------------- */
/* the reading column                                                      */
/* ---------------------------------------------------------------------- */

/**
 * The claim: who's talking, the spin, the fact under it, whose lane it is, and
 * Eugene's free read. `count` is optional ("3 / 6") — mobile shows it because
 * there's no progress rail there.
 */
export function ClaimBody({ claim, eugeneLine, eugeneCard = null, spent = [], count = null,
                           pressure = null, aside = "" }) {
  if (!claim) return null;
  const owner = laneOwner(claim);
  const stale = !!owner && spent.includes(owner.id);
  const band = pressure?.band || "cool";
  return (
    <div className="pu-claim" data-mood={band}>
      <div className="pu-who">
        {DESK[SEATS.BARRON].name.toUpperCase()} <span className="pu-dim">— his deal</span>
        {band !== "cool" && (
          <span className={`pu-mood ${band}`}>
            {band === "cornered" ? "CORNERED" : band === "rattled" ? "RATTLED" : "UNBOTHERED"}
          </span>
        )}
        {count && <span className="pu-count">{count}</span>}
      </div>

      {/* HE REACTS BEFORE HE CONTINUES. The aside is posture, never fact — it
          is derived from outcomes you have already seen, so it can't tell you
          anything you didn't earn. It's what gives the session an arc: the
          sixth claim should not be delivered like the first. */}
      {aside && <div className="pu-aside">“{aside}”</div>}

      <div className="pu-spin">“{claim.spin}”</div>
      <div className="pu-fact"><span className="pu-tag">FACT</span> {claim.fact}</div>

      {/* THE LANE, STATED. The seat row enforces it, but enforcement without
          explanation reads as a broken button — the first playtest note was
          "can't tell why only GR80 is available". It's a sentence, not a label,
          because "RECORD QUESTION" parsed as either a noun or a verb. And it
          reads the run, so it can never name somebody you've already spent. */}
      <div className="pu-lane" data-lane={stale ? "SPENT" : claim.lane}>
        {laneSentence(claim, { spent })}
      </div>

      {/* EUGENE LIVES HERE, NOT IN THE DOCK. He names the SHAPE and points at a
          lane — never whether the claim is true — and he has no board, so he
          can't carry an answer and can't be sent. Parked among the seat buttons
          he was the brightest thing in a row of controls and did nothing when
          clicked ("i don't understand his purpose" — author, 2026-07-27). Next
          to the line he actually delivers, he needs no explanation at all. */}
      <div className="pu-eugene">
        {eugeneCard && (
          <span className="pu-eu-card" aria-hidden="true">
            <TradingCard data={eugeneCard} scale={0.062} interactive={false} templateStyle="terminal" />
          </span>
        )}
        <span className="pu-eu-text">
          <span className="pu-eu-who">{EUGENE.name.toUpperCase()} <em>· {EUGENE.role}, free</em></span>
          <span className="pu-eu-line">{eugeneLine}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The answer. TWO VOICES: the adviser went and looked, so the finding is
 * theirs; Barron then reacts to being checked. Rendering only the reaction
 * under the adviser's name is what made this read as a jumble.
 *
 * `flash.revealed === false` means he is still mid-sentence — the verdict and
 * the panel's colour are both derivable right now, so they're withheld until he
 * stops. Undefined means revealed (desktop doesn't defer).
 *
 * `children`, when present, replaces the verdict line — mobile puts its LOOK
 * button in that slot, which is where the verdict itself will land.
 */
export function AnswerBody({ flash, children }) {
  if (!flash) return null;
  const held = flash.revealed === false;
  const tone = held ? "" : flash.nothingOnFile ? "nil" : flash.backing === BACKING.VIBES ? "vibes" : "";
  return (
    <div className={`pu-answer ${tone}`}>
      <div className="pu-asked">YOU SENT — {flash.asked}</div>

      {flash.adviserSays && (
        <div className="pu-said">
          <span className="pu-said-who">{DESK[flash.seat]?.name}</span>
          <span className="pu-said-line">“{flash.adviserSays}”</span>
        </div>
      )}
      {flash.line && (
        <div className="pu-said barron">
          <span className="pu-said-who">{DESK[SEATS.BARRON].name}</span>
          <span className="pu-said-line">“{flash.line}”</span>
        </div>
      )}

      {held ? (
        <div className="pu-note waiting">▚ HE'S STILL TALKING…</div>
      ) : children ? children : (
        <div className="pu-note">{answerNote(flash)}</div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* the dock                                                                */
/* ---------------------------------------------------------------------- */

/**
 * Who you can send, or why you can't send anyone.
 *
 * GATED ON `live`. When the claim is settled every real control is dead, and a
 * dead row containing one bright unclickable tile inverts the whole
 * affordance — so the row goes away entirely rather than greying out. On mobile
 * it also reclaims ~195px of pinned dock, which is what was shoving the one
 * live control off the bottom of the screen.
 */
export function SeatRow({ live, pressed, options, deskCards, onPress, scale = 0.1 }) {
  if (!live) {
    return (
      <div className="pu-spent">
        {pressed ? "◼ YOU'VE HAD YOUR ANSWER ON THIS ONE."
          : "▚ NO INTERRUPTIONS LEFT — THE REST IS ON FAITH."}
      </div>
    );
  }
  return (
    <div className="pu-seats">
      {options.map((o) => {
        const meta = DESK[o.seat];
        const card = deskCards.find((d) => d.m.id === o.seat);
        const boss = o.seat === SEATS.BARRON;
        return (
          <button key={o.seat}
                  className={`pu-seat ${boss ? "boss" : ""} ${o.enabled ? "" : "off"}`}
                  disabled={!o.enabled}
                  onClick={() => onPress(o.seat)}>
            {card && <TradingCard data={card.data} scale={scale} interactive={false} templateStyle="terminal" />}
            <span className="pu-seat-name">{boss ? "PRESS HIM" : meta.role}</span>
            <span className="pu-seat-sub">
              {boss ? "put a number on it"
                : o.reason === "spent" ? "already used"
                  : o.reason === "off-lane" ? "not their lane"
                    : "send them"}
            </span>
          </button>
        );
      })}
      {/* NO EUGENE HERE — this row is controls only. He sits beside his read in
          ClaimBody, because a row of buttons is a promise that everything in it
          is pressable, and he never is. */}
    </div>
  );
}

/** Interruptions left. `children` is an extra badge slot — mobile counts the
 *  advisers there too, since it has no agenda rail to show them. */
export function Meter({ run, presses, children }) {
  return (
    <div className="pu-meter" aria-label={`${run.pressesLeft} interruptions left`}>
      {Array.from({ length: presses }).map((_, i) => (
        <span key={i} className={i < run.pressesLeft ? "on" : ""} />
      ))}
      <em>INTERRUPTIONS LEFT</em>
      {children}
    </div>
  );
}

/**
 * On the last claim `advance` and `callIt` are the SAME transition
 * (pressRun.advance: next >= claims.length -> ALLOCATION), so two buttons there
 * would be two labels for one door.
 */
export function Nav({ lastClaim, pressed, onAdvance, onCallIt }) {
  return (
    <div className="pu-nav">
      {lastClaim ? (
        <button className="pu-btn primary" onClick={onCallIt}>THAT'S THE PITCH — CALL IT ▸</button>
      ) : (
        <>
          <button className={`pu-btn${pressed ? " primary" : ""}`} onClick={onAdvance}>LET HIM GO ON ▸</button>
          <button className="pu-btn amber" onClick={onCallIt}>CALL IT</button>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* styled once — callers position their own containers around these        */
/* ---------------------------------------------------------------------- */

export const PRESS_UI_CSS = `
.pu-dim { color:rgba(234,255,249,0.5); font-weight:normal; }

/* HIS BORDER IS THE MOOD RING. Cool pink while he's comfortable, cooling to
   cyan when you check him and he holds up, heating to amber then red as the
   room turns. Cheapest possible read of "how is this going for him". */
.pu-claim { border-left:2px solid #ff5f9e; padding:10px 14px;
  transition:border-left-color .35s ease; }
.pu-claim[data-mood="backed"]   { border-left-color:#2fd6d6; }
.pu-claim[data-mood="rattled"]  { border-left-color:#ffd23a; }
.pu-claim[data-mood="cornered"] { border-left-color:#ff2d2d; border-left-width:3px; }
.pu-who { display:flex; align-items:baseline; gap:6px;
  font:bold 9.5px/1.4 'Courier New',monospace; letter-spacing:0.13em; color:#ff5f9e; }
.pu-mood { font-size:8.5px; letter-spacing:0.16em; padding:1px 5px; }
.pu-mood.backed   { color:#02100e; background:#2fd6d6; }
.pu-mood.rattled  { color:#02100e; background:#ffd23a; }
.pu-mood.cornered { color:#fff; background:#ff2d2d; }
.pu-aside { font-size:12.5px; line-height:1.4; font-style:italic; margin:7px 0 2px;
  padding-left:9px; border-left:2px solid rgba(255,255,255,0.18);
  color:rgba(234,255,249,0.62); }
.pu-count { margin-left:auto; color:rgba(234,255,249,0.45); letter-spacing:0.1em; }
.pu-spin { font-size:14px; line-height:1.42; margin:6px 0 8px; }
.pu-fact { font-size:11.5px; line-height:1.4; color:rgba(234,255,249,0.85); }
.pu-tag { font:bold 8.5px/1 'Courier New',monospace; letter-spacing:0.13em;
  background:#2fd6d6; color:#02100e; padding:2px 4px; margin-right:5px; }

.pu-lane { margin-top:9px; padding:7px 9px; font:bold 10px/1.4 'Courier New',monospace;
  letter-spacing:0.06em; border-left:3px solid rgba(234,255,249,0.3);
  background:rgba(234,255,249,0.04); color:rgba(234,255,249,0.75); }
.pu-lane[data-lane="CHAIN"]  { border-left-color:#2fd6d6; color:#8ff0f0; background:rgba(47,214,214,0.08); }
.pu-lane[data-lane="RECORD"] { border-left-color:#ffd23a; color:#ffe487; background:rgba(255,210,58,0.08); }
/* the lane's owner is spent — this claim is now nobody's, and it should not
   look like a live instruction */
.pu-lane[data-lane="SPENT"]  { border-left-color:#ff9b6f; color:#ffb493; background:rgba(255,155,111,0.07); }

.pu-eugene { display:flex; gap:9px; align-items:flex-start; margin-top:9px; padding-top:8px;
  border-top:1px dashed rgba(191,238,222,0.22); }
.pu-eu-card { flex:none; line-height:0; opacity:0.92; pointer-events:none; }
.pu-eu-text { display:flex; flex-direction:column; gap:3px; min-width:0; }
.pu-eu-who { font:bold 10px/1.45 'Courier New',monospace; letter-spacing:0.11em; color:#bfeede; }
.pu-eu-who em { font-style:normal; font-weight:normal; letter-spacing:0.06em;
  color:rgba(191,238,222,0.55); }
.pu-eu-line { font-size:12.5px; line-height:1.45; color:rgba(191,238,222,0.85); font-style:italic; }

.pu-answer { padding:10px 12px; background:rgba(4,20,15,0.97); border:1.5px solid #ffd23a; }
.pu-answer.vibes { border-color:#7a8b86; }
.pu-answer.nil { border-color:#ff9b6f; }
.pu-asked { font:bold 8.5px/1.4 'Courier New',monospace; letter-spacing:0.11em;
  color:rgba(234,255,249,0.5); margin-bottom:7px; }
.pu-said { margin-bottom:7px; }
.pu-said-who { display:block; font:bold 9px/1.4 'Courier New',monospace;
  letter-spacing:0.12em; color:#2fd6d6; }
.pu-said.barron .pu-said-who { color:#ff5f9e; }
.pu-said-line { display:block; font-size:12.5px; line-height:1.45; font-style:italic; margin-top:2px; }
.pu-note { font:bold 9.5px/1.45 'Courier New',monospace; letter-spacing:0.09em; color:#ffd23a; }
.pu-answer.vibes .pu-note { color:#bfeede; }
.pu-answer.nil .pu-note { color:#ff9b6f; }
.pu-note.waiting { color:rgba(234,255,249,0.35); font-weight:normal; }

.pu-seats { display:flex; gap:6px; justify-content:flex-end; }
.pu-seat { background:rgba(2,16,14,0.9); border:1px solid rgba(47,214,214,0.35); color:#eafff9;
  cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:3px;
  padding:8px 9px 7px; font:inherit; transition:transform .12s ease, border-color .12s ease; }
.pu-seat:hover:not(:disabled):not(.fixture) { transform:translateY(-3px); border-color:#2fd6d6; }
.pu-seat.boss { border-color:rgba(255,45,111,0.6); background:rgba(60,6,28,0.55); }
.pu-seat.boss:hover:not(:disabled) { border-color:#ff2d6f; }
.pu-seat.fixture { cursor:default; border-style:dashed; border-color:rgba(191,238,222,0.4);
  background:rgba(2,16,14,0.6); }
.pu-seat.fixture .pu-seat-name { color:#bfeede; }
.pu-seat.fixture .pu-seat-sub { color:rgba(191,238,222,0.7); }
.pu-seat.off, .pu-seat:disabled { cursor:default; opacity:0.55; filter:grayscale(0.85);
  border-color:rgba(234,255,249,0.14); background:rgba(2,16,14,0.55); }
.pu-seat-name { font:bold 11px/1.25 'Courier New',monospace; letter-spacing:0.09em; }
.pu-seat.boss .pu-seat-name { color:#ff5f9e; }
.pu-seat-sub { font-size:9.5px; color:rgba(234,255,249,0.62); }
.pu-seat.off .pu-seat-sub, .pu-seat:disabled .pu-seat-sub { color:rgba(255,155,111,0.9); }

.pu-spent { font:bold 9.5px/1.5 'Courier New',monospace; letter-spacing:0.1em;
  color:rgba(191,238,222,0.7); padding:12px 4px; text-align:center;
  border:1px dashed rgba(191,238,222,0.28); }

.pu-meter { display:flex; align-items:center; gap:5px; }
.pu-meter > span { width:10px; height:10px; border-radius:50%; border:1.5px solid rgba(255,45,111,0.6); }
.pu-meter > span.on { background:#ff2d6f; box-shadow:0 0 8px rgba(255,45,111,0.8); }
.pu-meter em { font-style:normal; font:bold 9.5px/1 'Courier New',monospace;
  letter-spacing:0.11em; color:rgba(234,255,249,0.5); margin-left:5px; }

.pu-nav { display:flex; gap:8px; }
.pu-nav > * { flex:1; }
.pu-btn { background:rgba(2,16,14,0.9); border:1px solid rgba(47,214,214,0.5); color:#2fd6d6;
  font:inherit; font-size:11.5px; letter-spacing:0.09em; padding:12px 14px; cursor:pointer;
  text-align:center; }
.pu-btn.amber { border-color:rgba(255,210,58,0.55); color:#ffd23a; }
.pu-btn.primary { border-color:#2fd6d6; background:rgba(47,214,214,0.14); color:#eafff9; font-weight:bold; }
.pu-btn:hover { background:rgba(47,214,214,0.12); }
`;
