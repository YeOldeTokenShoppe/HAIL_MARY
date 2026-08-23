"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelSection, PanelTitle, PANEL_ICONS } from "./HailMaryPanel";
import ScratchReveal from "./ScratchReveal";
import {
  TICKET_CELLS as CELLS, TICKET_MATCH as MATCH, TICKET_STREAK_GUARANTEE as STREAK_GUARANTEE,
  TICKET_PRIZES as PRIZES, hashStr, mintTicketCells, evaluateCells, ticketDayKey, msToNextTicketDay,
} from "@/lib/oilTicket";

// DAILY TICKET — a HAIL MARY PROSPECTING CO. scratch ticket. Nine silver
// circles in a 3×3; match three of one symbol and win the prize on the legend
// — a win settles the moment the third one shows, a loss only once every disc
// is scratched. No pick, no external event: a pure instant-win, free entry,
// prizes paid in game terms (never dollars), so it's a sweepstakes, not a
// wager. The rules (cells, prizes, odds, mint, evaluate) live in
// src/lib/oilTicket.js, shared with the server.
//
// Two modes.
//   live (the game): the ticket is minted and settled by the server —
//     /api/oil-ticket-mint (one per UTC day, seeded from the season's committed
//     secret) and /api/oil-ticket-settle (recomputes the outcome from the
//     stored cells and applies the prize to the drill doc). The client only
//     ever reports "scratched".
//   test (?mode=test): minted locally from (date, claim, serial), with NEW
//     TICKET and FORCE NEXT controls; prizes land via onSettle.
//
// Fanfare scales with the tier: every win pops the hit discs, flashes the
// band, shows a headline and fires canvas-confetti from the ticket (a bigger
// burst as the tier rises); the jackpot also rings the church bell and fires
// the page's fireworks for a timed run (onJackpot). A loss gets a NO MATCH
// stamp thudding onto the grid and the discs dim — kind, not mocking.
// Everything is still under prefers-reduced-motion; sound follows the page's
// effects toggle (soundOn).

const MONO = "'Share Tech Mono', monospace";
const DISPLAY = "'Bebas Neue', 'Share Tech Mono', sans-serif";

// Relative luminance of a theme token (#rrggbb or rgb[a]()), for picking the
// text colour that contrasts most with a band — white on dark bands, near-
// black on gold/green ones — rather than trusting any one paper tone.
const lumOf = (c) => {
  let r, g, b;
  if (c.startsWith("#") && c.length >= 7) [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  else { const m = c.match(/[\d.]+/g); if (!m || m.length < 3) return 0.5; [r, g, b] = m.slice(0, 3).map(Number); }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const onColor = (bg) => (lumOf(bg) > 0.18 ? "#120e06" : "#ffffff");
// Ticket palette — drawn from the active theme so the ticket sits in every
// console: paper from the theme's input/bar tones, the header and instruction
// bands on the theme's gold (dark consoles) or accent (light ones), ink and
// labels from the text tokens, win/lose from green/red, a gold frame.
function ticketPalette(t, dark) {
  const band = dark ? t.gold : t.accent;
  return {
    frame: t.goldBorder,
    ground: t.inputBg,
    field: dark ? t.barBg : "rgba(255,255,255,0.55)",
    headBg: band, headText: onColor(band),
    band, bandText: onColor(band),
    win: t.green, onWin: onColor(t.green), lose: t.red,
    // Dark papers are darker than the panel the muted token was tuned for; the
    // 8px legend needs the body-text token there (parabolum: 3.8:1 → 8:1).
    ink: t.textStrong, label: dark ? t.text : t.muted, rule: t.border,
  };
}

// ── Symbols (24-grid line icons, game vocabulary; ids match oilTicket.js) ──
const SYMBOLS = {
  pickaxe: { name: "PICKAXE", icon: <><path d="M14.531 12.469 6.619 20.38a1 1 0 1 1-3-3l7.912-7.912" /><path d="M15.686 4.314A12.5 12.5 0 0 0 5.461 2.958 1 1 0 0 0 5.58 4.71a22 22 0 0 1 6.318 3.393" /><path d="M17.7 3.7a1 1 0 0 0-1.4 0l-4.6 4.6a1 1 0 0 0 0 1.4l2.6 2.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z" /><path d="M19.686 8.314a12.501 12.501 0 0 1 1.356 10.225 1 1 0 0 1-1.751.119 22 22 0 0 0-3.393-6.319" /></> },
  derrick: { name: "DERRICK", icon: <><path d="M8 22 11 3h2l3 19" /><path d="M5 22h14" /><path d="M9.4 10h5.2" /><path d="M8.6 16h6.8" /><path d="M12 3V1" /></> },
  coin:    { name: "RL80 COIN", icon: <><circle cx="12" cy="12" r="9" /><path d="M9 8h4a2 2 0 0 1 0 4H9" /><path d="M9 8v8" /><path d="m13 12 3 4" /></> },
  gusher:  { name: "GUSHER", icon: <><path d="M12 22a6 6 0 0 0 6-6c0-2-1-3.5-2-5l-4-6-4 6c-1 1.5-2 3-2 5a6 6 0 0 0 6 6z" /><path d="m4 5 2 2" /><path d="m20 5-2 2" /><path d="M12 2v1" /></> },
  barrel:  { name: "BARREL", icon: <><rect x="6" y="3" width="12" height="18" rx="3" /><path d="M6 9h12" /><path d="M6 15h12" /></> },
  dry:     { name: "DRY HOLE", icon: <><path d="M5 20h14" /><path d="M8 20V9" /><path d="M16 20V9" /><path d="M7 9h10" /><path d="M12 9v4" /></> },
};
const FRESH = Object.freeze(new Array(CELLS).fill(false));

// ── Fanfare ──
const SFX = { small: "/audio/match.mp3", medium: "/audio/sparkle.mp3", jackpot: "/audio/churchBell.mp3", lose: "/audio/record_stamp.mp3" };
const CONFETTI = ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"];
const CONFETTI_DELAY_MS = 1000; // after the reveal, so the result reads first
// Confetti — canvas-confetti (loaded on demand; it draws on its own
// full-page canvas), ejected upward from the bottom edge of the ticket with
// big pieces. Every win gets the base burst; medium adds a wider second
// burst; the jackpot adds a 2.5s cannonade from the ticket's bottom corners.
// `rect` is the ticket's bounding rect; origins are viewport fractions.
function fireConfetti(tier, rect) {
  import("canvas-confetti").then(({ default: confetti }) => {
    const W = window.innerWidth || 1, H = window.innerHeight || 1;
    const bottom = { x: (rect.left + rect.width / 2) / W, y: Math.min(0.98, rect.bottom / H) };
    // Narrow cone, high launch: a fountain up the ticket rather than a fan.
    const base = { origin: bottom, colors: CONFETTI, zIndex: 10000, disableForReducedMotion: true, scalar: 1.8, startVelocity: 72, gravity: 1, ticks: 280 };
    confetti({ ...base, particleCount: 150, spread: 45 });
    if (tier === "medium") setTimeout(() => confetti({ ...base, particleCount: 120, spread: 60, scalar: 2.1 }), 250);
    if (tier === "jackpot") {
      confetti({ ...base, particleCount: 220, spread: 70, startVelocity: 82, scalar: 2.2 });
      const left = { x: rect.left / W, y: bottom.y }, right = { x: rect.right / W, y: bottom.y };
      const end = Date.now() + 2500;
      const frame = () => {
        confetti({ ...base, particleCount: 7, angle: 75, spread: 40, origin: left });
        confetti({ ...base, particleCount: 7, angle: 105, spread: 40, origin: right });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }).catch(() => { /* no confetti module — the rest of the fanfare still runs */ });
}
const FX_CSS = `
@keyframes hmTicketPop { 0% { transform: scale(1) } 35% { transform: scale(1.3) } 70% { transform: scale(0.94) } 100% { transform: scale(1) } }
@keyframes hmTicketBand { 0% { filter: brightness(1.9) } 100% { filter: brightness(1) } }
@keyframes hmTicketHeadline { 0% { opacity: 0; transform: scale(0.5) } 14% { opacity: 1; transform: scale(1.14) } 24% { transform: scale(1) } 72% { opacity: 1 } 100% { opacity: 0; transform: scale(1.06) } }
@keyframes hmTicketStamp { 0% { opacity: 0; transform: rotate(-8deg) scale(1.6) } 60% { opacity: 1; transform: rotate(-8deg) scale(0.94) } 80% { transform: rotate(-8deg) scale(1.04) } 100% { opacity: 1; transform: rotate(-8deg) scale(1) } }
@keyframes hmTicketChip { 0% { transform: scale(1) } 40% { transform: scale(1.22) } 100% { transform: scale(1) } }
@keyframes hmTicketGlimmer { 0% { background-position: 120% 0 } 100% { background-position: -120% 0 } }
`;

// Test-mode mint: the shared rules over a label hash. `forced` is a prize
// symbol or "lose".
function mintLocal(seedStr, guaranteeWin, forced = null) {
  const seed = hashStr(seedStr);
  const { cells, win } = mintTicketCells(seed, { guaranteeWin, forced });
  return { cells, win, seedHex: seed.toString(16).padStart(8, "0"), forced: !!forced };
}

const fmtCountdown = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); const h = Math.floor(m / 60); return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`; };

function Icon({ path, size = 32, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {path}
    </svg>
  );
}

export default function DailyTicketPanel({
  theme, isMobile = false, darkMode = true, selectedX = null, selectedY = null, devControls = false,
  live = false, apiFetch,   // live: mint/settle through the server with the page's authenticated fetch
  mintKey = null,           // live: anything that should make the panel ask the server again (the season commitment)
  soundOn = true, onJackpot,
  onSettle, // ({ ticketNo, win, sym, symName, tier, prize }) — test mode: the page records the prize and posts the feed line
}) {
  const t = theme;
  const K = useMemo(() => ticketPalette(t, darkMode), [t, darkMode]);
  const reduceMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const hasPlot = selectedX !== null && selectedY !== null;
  const plotKey = hasPlot ? `${selectedX + 1}.${selectedY + 1}` : "field";
  const day = ticketDayKey();

  // ── the ticket ──
  const [serial, setSerial] = useState(1);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState([]); // settled tickets, newest first: { id, no, sym, tier }
  // Test mode can force the next ticket's outcome — a 1-in-60 jackpot is not
  // something QA should wait for. { serial, outcome } applies to exactly one ticket.
  const [forced, setForced] = useState(null);
  // Live: the server's ticket for today, or why there isn't one.
  const [remote, setRemote] = useState(null);
  const [remoteError, setRemoteError] = useState(null);
  const [countedId, setCountedId] = useState(null);

  const ticketId = live ? `live-${remote?.id || day}` : `${day}-${plotKey}-${serial}`;
  const forcedOutcome = !live && forced && forced.serial === serial ? forced.outcome : null;
  const ticket = useMemo(() => {
    if (live) {
      if (!remote) return null;
      // The cells carry the outcome; the server confirms it at settle.
      return { cells: remote.cells, win: evaluateCells(remote.cells).win, seedHex: String(remote.seedHash || "").slice(0, 8), forced: !!remote.test, test: !!remote.test };
    }
    // The guarantee is fixed at mint (every Nth ticket in test mode), never
    // re-derived from the live streak — a ticket must not re-mint itself.
    return mintLocal(ticketId, serial % STREAK_GUARANTEE === 0, forcedOutcome);
  }, [live, remote, ticketId, serial, forcedOutcome]);
  const ticketNo = `${day.slice(4)}-${String(live ? 1 : serial).padStart(2, "0")}`;

  // Scratch state is keyed to the ticket, so a fresh ticket is unscratched in
  // the same render it appears.
  const [scratch, setScratch] = useState({ id: ticketId, cells: FRESH });
  const revealed = scratch.id === ticketId ? scratch.cells : FRESH;
  const markRevealed = (i) => setScratch((s) => { const cells = s.id === ticketId ? s.cells : FRESH; return cells[i] ? s : { id: ticketId, cells: cells.map((v, k) => (k === i ? true : v)) }; });
  const revealAll = () => setScratch({ id: ticketId, cells: new Array(CELLS).fill(true) });
  const newTicket = () => setSerial((s) => s + 1);
  const forceTicket = (outcome) => { setForced({ serial: serial + 1, outcome }); setSerial((s) => s + 1); };

  // Live: mint (or fetch) today's ticket on mount — and again whenever the
  // season commitment changes (a fresh COMMIT in the admin panel turns "not
  // committed yet" into a ticket without a reload) or the player taps the
  // error bar to retry. A ticket already settled today comes back scratched,
  // with no fanfare — it's a replay.
  const [mintAttempt, setMintAttempt] = useState(0);
  const retryMint = () => { setRemoteError(null); setMintAttempt((n) => n + 1); };
  const liveSettled = live && remote?.status === "settled";
  useEffect(() => {
    if (!live || !apiFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/oil-ticket-mint", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setRemoteError(json.error || `ticket unavailable (${res.status})`); return; }
        const id = `live-${json.id || json.day}`;
        setRemote(json);
        setStreak(json.streak || 0);
        setHistory((json.recent || []).map((r) => ({ id: `live-${r.day}`, no: `${String(r.day).slice(4)}-01`, sym: r.sym || null, tier: r.tier || null })));
        if (json.status === "settled") { setCountedId(id); setScratch({ id, cells: new Array(CELLS).fill(true) }); }
      } catch (e) {
        if (!cancelled) setRemoteError("couldn't reach the ticket booth");
      }
    })();
    return () => { cancelled = true; };
  }, [live, apiFetch, mintKey, mintAttempt]);

  const count = revealed.filter(Boolean).length;
  const complete = count === CELLS;
  const winSym = ticket?.win?.sym || null;
  // A win settles the moment the third matching symbol shows; a losing ticket
  // is only known once every disc is scratched.
  const won = !!ticket && !!winSym && ticket.cells.filter((s, i) => revealed[i] && s === winSym).length >= MATCH;
  const lost = !!ticket && complete && !won;
  const settled = !!ticket && (won || complete);

  // ── settle: streak, ledger, server, fanfare, sound, fireworks ──
  const [fx, setFx] = useState(null); // { id, kind: "small" | "medium" | "jackpot" | "lose" }
  const ticketRef = useRef(null);
  const confettiTimer = useRef(null);
  useEffect(() => {
    if (!settled || countedId === ticketId) return;
    setCountedId(ticketId);
    setStreak((s) => s + 1);
    const kind = won ? ticket.win.tier : "lose";
    setFx({ id: ticketId, kind });
    setHistory((h) => [{ id: ticketId, no: ticketNo, sym: won ? winSym : null, tier: won ? ticket.win.tier : null }, ...h.filter((x) => x.id !== ticketId)].slice(0, 30));
    onSettle?.({ ticketNo, win: won, sym: won ? winSym : null, symName: won ? SYMBOLS[winSym].name : null, tier: won ? ticket.win.tier : null, prize: won ? ticket.win.prize : null });
    if (live && apiFetch) {
      // The server recomputes the outcome from the stored cells and applies
      // the prize; the streak it returns is the one that counts.
      apiFetch("/api/oil-ticket-settle", { method: "POST", body: JSON.stringify({ id: remote?.id || day }) })
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) => { if (ok && typeof j.streak === "number") setStreak(j.streak); else if (!ok) console.warn("[daily ticket] settle:", j.error); })
        .catch((e) => console.warn("[daily ticket] settle failed:", e.message));
    }
    if (soundOn) { try { const a = new Audio(SFX[kind]); a.volume = kind === "lose" ? 0.5 : 0.65; a.play().catch(() => {}); } catch { /* no audio */ } }
    if (kind !== "lose") {
      // The headline and the pop land first; the confetti follows a beat
      // after the reveal, measured from wherever the ticket is by then.
      clearTimeout(confettiTimer.current);
      confettiTimer.current = setTimeout(() => {
        const r = ticketRef.current?.getBoundingClientRect();
        fireConfetti(kind, r || { left: 0, right: window.innerWidth, width: window.innerWidth, bottom: window.innerHeight * 0.9 });
      }, CONFETTI_DELAY_MS);
    }
    if (kind === "jackpot") onJackpot?.();
  }, [settled, countedId, ticketId, ticketNo, day, won, winSym, ticket, live, apiFetch, remote?.id, soundOn, onJackpot, onSettle]);
  useEffect(() => () => clearTimeout(confettiTimer.current), []);
  const fxLive = fx && fx.id === ticketId ? fx : null;

  // ── chrome ──
  // Collapsed by default: the title row (with a short STREAK chip) and, under
  // it, a full-width ticket bar that does the inviting — gold with a glimmer
  // while today's ticket is unscratched, the result and the countdown to the
  // next ticket once it has settled. Nothing shares the title's line, so it
  // never wraps or gets overlapped. The ticket itself only renders while open.
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open && liveSettled) retryMint(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const nextIn = fmtCountdown(msToNextTicketDay(now));
  const muted = t.muted, gold = t.gold;
  const link = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: muted, textDecoration: "underline" };
  const chip = (
    <span key={streak} style={{
      display: "inline-block", fontSize: 9, letterSpacing: "0.14em", padding: "2px 7px", borderRadius: 2, border: `1px solid ${streak > 0 ? gold : t.border}`, color: streak > 0 ? gold : muted, fontFamily: MONO, textTransform: "uppercase", whiteSpace: "nowrap",
      animation: streak > 0 && !reduceMotion ? "hmTicketChip 0.6s ease-out" : "none",
    }}>
      STREAK {streak}
    </span>
  );
  const onGold = onColor(gold);
  const barBase = { display: "flex", alignItems: "center", width: "100%", minHeight: 28, borderRadius: 3, fontFamily: MONO, textTransform: "uppercase", padding: "0 9px", gap: 8 };
  const ticketBar = !ticket
    ? (
      <button onClick={remoteError ? retryMint : undefined} style={{ ...barBase, justifyContent: "center", gap: 10, cursor: remoteError ? "pointer" : "default", border: `1px solid ${t.border}`, background: t.btnBg, color: remoteError ? K.lose : muted, fontSize: 9, letterSpacing: "0.12em", textAlign: "center" }}>
        <span>{remoteError ? remoteError : "Minting today's ticket…"}</span>
        {remoteError && <span style={{ color: muted, textDecoration: "underline", whiteSpace: "nowrap" }}>retry</span>}
      </button>
    )
    : !settled
      ? (
        <button onClick={() => setOpen(true)} style={{
          ...barBase, justifyContent: "center", minHeight: 30, cursor: "pointer",
          border: `1px solid ${t.goldBorder}`, color: onGold, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
          background: `linear-gradient(110deg, ${gold} 0%, ${gold} 38%, #fff3c4 50%, ${gold} 62%, ${gold} 100%)`, backgroundSize: "260% 100%",
          boxShadow: `0 0 10px ${gold}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
          animation: reduceMotion ? "none" : "hmTicketGlimmer 2.6s ease-in-out infinite",
        }}>
          <span>✦</span><span>Scratch today&apos;s ticket</span><span>▸</span>
        </button>
      )
      : (
        <button onClick={() => setOpen(true)} style={{ ...barBase, justifyContent: "space-between", cursor: "pointer", border: `1px solid ${t.border}`, background: t.btnBg, color: muted, fontSize: 9, letterSpacing: "0.12em" }}>
          <span style={{ color: won ? K.win : muted, fontWeight: 700, whiteSpace: "nowrap" }}>{won ? `✓ ${ticket.win.short}` : "— No match"}</span>
          <span style={{ whiteSpace: "nowrap" }}>Next ticket in {nextIn}</span>
        </button>
      );
  const band = (text, kind) => (
    <div style={{
      background: kind === "win" ? K.win : K.band, color: kind === "win" ? K.onWin : K.bandText,
      fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textAlign: "center", padding: "4px 6px", borderRadius: 2, margin: "8px 0", textTransform: "uppercase",
      animation: kind === "win" && fxLive && !reduceMotion ? "hmTicketBand 0.9s ease-out" : "none",
    }}>
      ★ {text} ★
    </div>
  );
  const resultColor = won ? K.win : lost ? K.lose : K.ink;
  const headline = fxLive && fxLive.kind !== "lose" && !reduceMotion
    ? (fxLive.kind === "jackpot" ? "JACKPOT!" : "MATCH 3!") : null;
  // Tickets until the guaranteed one: from the streak at mint in live mode,
  // from the serial in test mode.
  const until = live
    ? (STREAK_GUARANTEE - ((remote?.streakAtMint || 0) + 1) % STREAK_GUARANTEE) % STREAK_GUARANTEE
    : (STREAK_GUARANTEE - (serial % STREAK_GUARANTEE)) % STREAK_GUARANTEE;

  return (
    <PanelSection theme={t} isMobile={isMobile}>
      <style>{FX_CSS}</style>
      <PanelTitle theme={t} isMobile={isMobile} icon={PANEL_ICONS.call} right={chip} onToggle={() => setOpen((o) => !o)} open={open}>DAILY TICKET</PanelTitle>

      {!open && <div style={{ marginTop: 8 }}>{ticketBar}</div>}
      {open && !ticket && <div style={{ marginTop: 8 }}>{ticketBar}</div>}
      {open && ticket && (<>
      <div ref={ticketRef} style={{ position: "relative", border: `2px solid ${K.frame}`, borderRadius: 6, background: K.ground, overflow: "hidden", boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.45)" : "inset 0 0 0 1px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.2)" }}>
        {/* header — one line, in the theme's band colour */}
        <div title="Luck is a strategy." style={{ background: K.headBg, color: K.headText, borderBottom: `2px solid ${K.frame}`, padding: "5px 10px 4px", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, textAlign: "center" }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 22, lineHeight: 1, letterSpacing: "0.08em" }}>HAIL MARY</span>
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase" }}>Prospecting Co.</span>
        </div>

        <div style={{ padding: "8px 10px 10px" }}>
          {/* TICKET NO. field — the number is the receipt; the seed and claim
              live in the dev footer (and, later, the fairness explainer) */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <span style={{ background: K.band, color: K.bandText, fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.16em", padding: "3px 7px", borderRadius: "2px 0 0 2px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>TICKET NO.</span>
            <span style={{ flex: 1, minWidth: 0, background: K.field, color: K.ink, fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", padding: "2px 8px", borderWidth: "1px 1px 1px 0", borderStyle: "solid", borderColor: K.band, borderRadius: "0 2px 2px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span style={{ whiteSpace: "nowrap" }}>{ticketNo}</span>
              {ticket.forced && <span style={{ fontSize: 8, color: K.lose, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{ticket.test ? "TEST TICKET" : "FORCED (TEST)"}</span>}
            </span>
          </div>

          {band(won
            ? `Match ${MATCH} — ${ticket.win.prize}`
            : complete ? "No match — scratch again tomorrow" : `Scratch all ${CELLS} · match ${MATCH} & win`, won ? "win" : undefined)}

          {/* the 3×3 (60px discs) — with the headline and the NO MATCH stamp layered over it */}
          <div style={{ position: "relative", maxWidth: 196, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {ticket.cells.map((sym, i) => {
                const hit = won && winSym === sym && revealed[i];
                return (
                  <ScratchReveal
                    key={`${ticketId}-${i}`}
                    theme={t}
                    variant="silver"
                    shape="circle"
                    threshold={0.4}
                    brush={12}
                    coinSize={26}
                    label=""
                    minHeight={0}
                    revealed={revealed[i]}
                    onRevealed={() => markRevealed(i)}
                    style={{
                      aspectRatio: "1 / 1", borderRadius: "50%", border: `1px solid ${hit ? K.win : K.rule}`, background: K.field,
                      boxShadow: hit ? `0 0 0 2px ${K.win}55, 0 0 12px ${K.win}66` : "none",
                      animation: hit && fxLive && !reduceMotion ? `hmTicketPop 0.7s ease-out ${(i % 3) * 0.08}s` : "none",
                      transition: "opacity 0.5s",
                      opacity: lost ? 0.55 : 1,
                    }}
                  >
                    <div title={SYMBOLS[sym].name} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: hit ? K.win : K.ink }}>
                      <Icon path={SYMBOLS[sym].icon} size={30} />
                    </div>
                  </ScratchReveal>
                );
              })}
            </div>
            {headline && (
              <div key={fxLive.id} aria-hidden="true" style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
                fontFamily: DISPLAY, fontSize: fxLive.kind === "jackpot" ? 54 : 48, letterSpacing: "0.06em", color: K.win,
                textShadow: `0 0 2px ${K.ground}, 0 0 2px ${K.ground}, 0 2px 0 ${K.ground}, 0 0 18px ${K.win}aa`,
                animation: "hmTicketHeadline 2.2s ease-out forwards",
              }}>{headline}</div>
            )}
            {lost && (
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{
                  fontFamily: DISPLAY, fontSize: 34, lineHeight: 1, letterSpacing: "0.14em", color: K.lose,
                  border: `3px solid ${K.lose}`, borderRadius: 4, padding: "4px 10px 2px 14px", background: `${K.ground}`,
                  transform: "rotate(-8deg)", opacity: 0.92,
                  animation: reduceMotion ? "none" : "hmTicketStamp 0.5s cubic-bezier(0.2, 1.2, 0.4, 1) forwards",
                }}>NO MATCH</div>
              </div>
            )}
          </div>

          {/* result line */}
          <div style={{ marginTop: 8, minHeight: 14, fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: resultColor, textAlign: "center", textTransform: "uppercase", fontWeight: settled ? 700 : 400 }}>
            {won
              ? `Three ${SYMBOLS[winSym].name}s — ${ticket.win.prize}${complete ? "" : ` · ${CELLS - count} left to scratch`}`
              : complete ? `Nothing matched · streak ${streak}` : `${count} / ${CELLS} scratched`}
          </div>

          {/* legend (one row) + the ledger: the last seven tickets as stubs, and the guarantee countdown */}
          {(() => {
            const recent = history.slice(0, STREAK_GUARANTEE).reverse();
            const stubs = [...Array(STREAK_GUARANTEE - recent.length).fill(null), ...recent];
            return (
              <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px dotted ${K.rule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                  {PRIZES.map((pz) => (
                    <span key={pz.sym} title={`Three ${SYMBOLS[pz.sym].name}s — ${pz.prize}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: MONO, fontSize: 7, letterSpacing: "0.06em", color: K.label, textTransform: "uppercase", whiteSpace: "nowrap", minWidth: 0 }}>
                      <Icon path={SYMBOLS[pz.sym].icon} size={12} color={K.ink} />
                      <span style={{ color: K.ink }}>×3</span>
                      <span>{pz.short}</span>
                    </span>
                  ))}
                </div>
                <div title={`Last ${STREAK_GUARANTEE} tickets`} style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {stubs.map((h, i) => (
                    <div key={h ? h.id : `empty-${i}`} title={h ? (h.sym ? `${h.no} · three ${SYMBOLS[h.sym].name}s` : `${h.no} · no match`) : "not yet scratched"} style={{
                      width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      border: `1px solid ${h ? (h.sym ? K.win : K.rule) : K.rule}`, borderStyle: h ? "solid" : "dashed",
                      background: h ? (h.sym ? `${K.win}22` : K.field) : "transparent", color: h?.sym ? K.win : K.label,
                    }}>
                      {h ? (h.sym ? <Icon path={SYMBOLS[h.sym].icon} size={12} /> : <span style={{ fontFamily: MONO, fontSize: 9 }}>—</span>) : <span style={{ fontFamily: MONO, fontSize: 9, opacity: 0.6 }}>·</span>}
                    </div>
                  ))}
                  <span style={{ marginLeft: "auto", alignSelf: "center", fontFamily: MONO, fontSize: 7, letterSpacing: "0.1em", color: until === 0 ? K.win : K.label, textTransform: "uppercase", fontWeight: until === 0 ? 700 : 400, textAlign: "right", lineHeight: 1.2 }}>
                    {until === 0 ? `${STREAK_GUARANTEE}th ticket · guaranteed win` : `${until} more to a guaranteed win`}
                  </span>
                </div>
              </div>
            );
          })()}
          <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 7, letterSpacing: "0.14em", color: K.label, textAlign: "center", textTransform: "uppercase" }}>
            No purchase necessary · one free ticket a day · prizes paid in-game
          </div>
        </div>
      </div>

      {/* ── state line + dev controls ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: muted, flexWrap: "wrap" }}>
        <span>{settled ? <span style={{ color: gold }}>TICKET {ticketNo} SETTLED · NEXT IN {nextIn.toUpperCase()}</span> : "1 FREE TICKET TODAY · EXTRA TICKETS ARE EARNED IN THE FIELD"}</span>
        <span style={{ display: "flex", gap: 10 }}>
          {!complete && <button style={link} onClick={revealAll}>REVEAL ALL</button>}
          {devControls && <button style={{ ...link, color: gold }} onClick={newTicket}>NEW TICKET (TEST) ▸</button>}
        </span>
      </div>
      {devControls && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", color: muted, flexWrap: "wrap" }}>
            <span>FORCE NEXT (TEST):</span>
            {[["pickaxe", "SMALL"], ["derrick", "TONIC"], ["coin", "COUPON"], ["gusher", "JACKPOT"], ["lose", "LOSE"]].map(([o, label]) => (
              <button key={o} style={{ ...link, fontSize: 8 }} onClick={() => forceTicket(o)}>{label}</button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 8, letterSpacing: "0.14em", color: muted, fontFamily: MONO, textTransform: "uppercase" }}>
            Prototype · test mode only · {hasPlot ? `claim ${plotKey}` : "field"} · seed {ticket.seedHex}{ticket.forced ? " (forced)" : ""} · wins post to field activity &amp; your rig
          </div>
        </>
      )}
      </>)}
    </PanelSection>
  );
}
