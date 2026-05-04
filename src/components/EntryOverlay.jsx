import React, { useState } from "react";

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  RL80 ENTRY OVERLAY — Choose your modality                            ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║                                                                       ║
 * ║  Sits over the Traders Arcade scene. The arcade remains dimly        ║
 * ║  visible behind, signaling that all four offerings live inside the   ║
 * ║  same world.                                                          ║
 * ║                                                                       ║
 * ║  STRUCTURE:                                                           ║
 * ║    • Primary CTA: The Liminal Terminal (free game)                   ║
 * ║    • Three service tiles: Token Analysis, Audience, Indulgence       ║
 * ║    • Indulgence opens a sub-overlay with three character options:    ║
 * ║        Confession (St. GR80) / Roast (H80Z) / Blessing (Our Lady)    ║
 * ║                                                                       ║
 * ║  HANDOFF:                                                             ║
 * ║    Pass `onSelect(action)` — fires with one of:                      ║
 * ║      "game" | "analysis" | "audience"                                ║
 * ║      "confession" | "roast" | "blessing"                             ║
 * ║    Wire each to the appropriate route / wallet flow.                 ║
 * ║                                                                       ║
 * ║    Pricing values are placeholders. Drive from props or config.      ║
 * ║                                                                       ║
 * ║    The "Blessing unavailable" path is intentional design (Our Lady   ║
 * ║    held back as mystique, real cameo when production-ready).         ║
 * ║    Toggle with the `blessingAvailable` prop.                         ║
 * ║                                                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

export default function EntryOverlay({
  onSelect,
  onDismiss,
  blessingAvailable = false,  // Our Lady cameo gated until production-ready
}) {
  const [view, setView] = useState("main");  // "main" | "indulgence"

  function handleSelect(action) {
    if (onSelect) onSelect(action);
  }

  return (
    <div className="ro-root">
      <style>{STYLES}</style>
      <div className="ro-scrim" />
      <div className="ro-scanlines" aria-hidden />
      <div className="ro-noise" aria-hidden />
      <div className="ro-vignette" aria-hidden />

      {view === "main" ? (
        <MainView
          onSelect={handleSelect}
          onOpenIndulgence={() => setView("indulgence")}
          onDismiss={onDismiss}
        />
      ) : (
        <IndulgenceView
          blessingAvailable={blessingAvailable}
          onSelect={handleSelect}
          onBack={() => setView("main")}
        />
      )}
    </div>
  );
}

function CornerOrnaments() {
  return (
    <>
      <span className="ro-corner ro-corner-tl" aria-hidden />
      <span className="ro-corner ro-corner-tr" aria-hidden />
      <span className="ro-corner ro-corner-bl" aria-hidden />
      <span className="ro-corner ro-corner-br" aria-hidden />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// MAIN VIEW — primary CTA + three service tiles
// ────────────────────────────────────────────────────────────────────────

function MainView({ onSelect, onOpenIndulgence, onDismiss }) {
  return (
    <div className="ro-panel ro-panel-main">
      <CornerOrnaments />
      <div className="ro-marquee" aria-hidden>
        <div className="ro-marquee-track">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="ro-marquee-content">
              ◆ CHANNEL OPEN ◆ TERMINAL ONLINE ◆ BASE NETWORK · BLOCK SYNCED ◆ ORACLES LISTENING ◆ FOUR PATHS AVAILABLE ◆&nbsp;
            </span>
          ))}
        </div>
      </div>
      <header className="ro-header">
        {onDismiss && (
          <button
            className="ro-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            ✕ DISMISS
          </button>
        )}
        <div className="ro-stamp">// THE LIMINAL TERMINAL · BASE</div>
        <h1 className="ro-title">
          <span className="ro-title-orn" aria-hidden>✦</span>
          <span className="ro-title-text" style={{ fontFamily: "'Orbitron', serif" }}>CHOOSE UTIL80</span>
          <span className="ro-title-orn" aria-hidden>✦</span>
        </h1>
        <div className="ro-subtitle">Four ways to consult the terminal.</div>
      </header>

      {/* Primary CTA */}
      <button
        className="ro-primary"
        onClick={() => onSelect("game")}
      >
        <div className="ro-primary-meta">
          <div className="ro-primary-tag">
            <span className="ro-primary-tag-dot" aria-hidden />
            FREE · LEADERBOARD ENABLED
          </div>
          <div className="ro-primary-name">THE LIMINAL TERMINAL</div>
          <div className="ro-primary-desc">
            Crypto forensics training. Read cases. Render verdicts. Climb the board.
          </div>
        </div>
        <div className="ro-primary-cta">
          <div className="ro-primary-cta-text">JUDGE A CASE</div>
          <div className="ro-primary-cta-arrow">▸</div>
        </div>
      </button>

      <div className="ro-divider">
        <span className="ro-divider-line" />
        <span className="ro-divider-text">◆ OR PAY FOR PASSAGE ◆</span>
        <span className="ro-divider-line" />
      </div>

      {/* Service tiles */}
      <div className="ro-tiles">
        <ServiceTile
          numeral="I"
          tag="ANALYSIS"
          title="TOKEN REVIEW"
          desc="Request a team review of any token."
          sigil="✠"
          accent="cyan"
          onClick={() => onSelect("analysis")}
        />
        <ServiceTile
          numeral="II"
          tag="AUDIENCE"
          title="PRIVATE COUNSEL"
          desc="Text session with any of TLT crew."
          sigil="✦"
          accent="amber"
          onClick={() => onSelect("audience")}
        />
        <ServiceTile
          numeral="III"
          tag="INDULGENCE"
          title="ABSOLUTION · BLESSING · ROAST"
          desc="Pay for spiritual relief. One sin, one prayer, or one beating."
          sigil="❖"
          accent="magenta"
          onClick={onOpenIndulgence}
          hasSubmenu
        />
      </div>

      <footer className="ro-footer">
        All paid services run on Base via x402. Connect a wallet to begin.
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// INDULGENCE VIEW — character-tied sub-options
// ────────────────────────────────────────────────────────────────────────

function IndulgenceView({ blessingAvailable, onSelect, onBack }) {
  return (
    <div className="ro-panel ro-panel-indulgence">
      <CornerOrnaments />
      <header className="ro-header">
        <button className="ro-back" onClick={onBack}>
          ◂ BACK
        </button>
        <div className="ro-stamp ro-stamp-indulgence">// INDULGENCE · CHOOSE YOUR RITE</div>
        <h1 className="ro-title ro-title-magenta">
          <span className="ro-title-orn" aria-hidden>❖</span>
          <span className="ro-title-text">WHICH RELIEF DO YOU SEEK?</span>
          <span className="ro-title-orn" aria-hidden>❖</span>
        </h1>
        <div className="ro-subtitle">Each rite is performed by the character it suits.</div>
      </header>

      <div className="ro-rites">
        <RiteTile
          rite="CONFESSION"
          character="ST. GR80"
          characterRole="THE ANDROID MONK"
          sigil="✠"
          desc="Bring your worst trade. He files it without comment, without judgment, without comfort."
          quote="The chain has already absolved you. I am only here to log it."
          accent="phos"
          onClick={() => onSelect("confession")}
        />
        <RiteTile
          rite="ROAST"
          character="H80Z"
          characterRole="THE ADVERSARY"
          sigil="✦"
          desc="Submit your portfolio. He will be unkind. You will deserve it."
          quote="If I were running this scam against you, I would already be done."
          accent="red"
          onClick={() => onSelect("roast")}
        />
        <RiteTile
          rite="BLESSING"
          character="OUR LADY"
          characterRole="OF PERPETUAL PROFIT"
          sigil="✧"
          desc={
            blessingAvailable
              ? "She appears. She speaks. The blessing is granted, or it is not."
              : "She appears at her own discretion. Currently elsewhere."
          }
          quote={
            blessingAvailable
              ? "Some prayers are answered. Most are filed."
              : "— APPARITION PENDING —"
          }
          accent="magenta"
          onClick={blessingAvailable ? () => onSelect("blessing") : undefined}
          disabled={!blessingAvailable}
        />
      </div>

      <footer className="ro-footer">
        Indulgences are entertainment, not financial advice. The terminal does not refund.
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ────────────────────────────────────────────────────────────────────────

function ServiceTile({ numeral, tag, title, desc, sigil, accent = "phos", onClick, hasSubmenu }) {
  return (
    <button className={`ro-tile ro-tile-${accent}`} onClick={onClick}>
      {numeral && <div className="ro-tile-numeral" aria-hidden>{numeral}</div>}
      <div className="ro-tile-sigil-wrap">
        <div className="ro-tile-sigil">{sigil}</div>
      </div>
      <div className="ro-tile-tag">{tag}</div>
      <div className="ro-tile-title">{title}</div>
      <div className="ro-tile-desc">{desc}</div>
      {hasSubmenu && (
        <div className="ro-tile-submenu">▸ THREE OPTIONS</div>
      )}
    </button>
  );
}

function RiteTile({ rite, character, characterRole, sigil, desc, quote, accent, onClick, disabled }) {
  return (
    <button
      className={`ro-rite ro-rite-${accent} ${disabled ? "is-disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="ro-rite-head">
        <div className="ro-rite-sigil">{sigil}</div>
        <div className="ro-rite-name">{rite}</div>
      </div>
      <div className="ro-rite-char">{character}</div>
      <div className="ro-rite-char-role">{characterRole}</div>
      <div className="ro-rite-desc">{desc}</div>
      <div className="ro-rite-quote">"{quote}"</div>
      {disabled && <div className="ro-rite-disabled-tag">UNAVAILABLE</div>}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────────────

const STYLES = `
.ro-root {
  --ro-bg: #050a07;
  --ro-bg-2: #0a1410;
  --ro-frame: #0a3a26;
  --ro-frame-bright: #0e6b44;
  --ro-text: #c8ffe0;
  --ro-text-dim: #6db59a;
  --ro-text-faint: #3a6b54;
  --ro-phos: #4dffaa;
  --ro-phos-bright: #8effc4;
  --ro-amber: #ffb84d;
  --ro-red: #ff4d6d;
  --ro-magenta: #ff3ea0;
  --ro-magenta-bright: #ff7ac4;
  --ro-cyan: #4dd6ff;
  --ro-cyan-bright: #8ee9ff;

  --ro-mono: 'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  --ro-display: 'Cinzel Decorative', 'Cinzel', Didot, 'Bodoni 72', serif;

  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: var(--ro-mono);
  color: var(--ro-text);
  overflow: hidden;
}

.ro-scrim {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, rgba(5, 10, 7, 0.55) 0%, rgba(5, 10, 7, 0.92) 90%);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: -1;
}
.ro-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 2px,
    rgba(0, 0, 0, 0.16) 3px,
    rgba(0, 0, 0, 0.16) 4px
  );
  z-index: 5;
  mix-blend-mode: multiply;
}
.ro-noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  opacity: 0.04;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>");
}
.ro-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(77, 255, 170, 0.06), transparent 45%),
    radial-gradient(ellipse at 85% 90%, rgba(255, 62, 160, 0.05), transparent 45%);
}

.ro-panel {
  position: relative;
  z-index: 10;
  width: min(820px, 100%);
  min-height: 82dvh;
  max-height: 92dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 44px 36px 32px;
  background: linear-gradient(to bottom, rgba(13, 80, 50, 0.16), rgba(5, 10, 7, 0.96));
  border: 1px solid var(--ro-frame-bright);
  box-shadow:
    0 0 100px rgba(13, 80, 50, 0.5),
    inset 0 0 80px rgba(0, 255, 130, 0.04);
  animation: ro-rise 0.45s ease-out;
  scrollbar-color: var(--ro-frame) var(--ro-bg);
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
}
.ro-panel-main { gap: 4px; }
.ro-panel > * { flex-shrink: 0; }
.ro-panel::-webkit-scrollbar { width: 6px; }
.ro-panel::-webkit-scrollbar-thumb { background: var(--ro-frame); }

/* Decorative corner brackets — gothic-cyber */
.ro-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  pointer-events: none;
  z-index: 12;
}
.ro-corner-tl { top: 8px; left: 8px; border-top: 2px solid var(--ro-phos); border-left: 2px solid var(--ro-phos); box-shadow: -1px -1px 8px rgba(77, 255, 170, 0.4); }
.ro-corner-tr { top: 8px; right: 8px; border-top: 2px solid var(--ro-phos); border-right: 2px solid var(--ro-phos); box-shadow:  1px -1px 8px rgba(77, 255, 170, 0.4); }
.ro-corner-bl { bottom: 8px; left: 8px; border-bottom: 2px solid var(--ro-phos); border-left: 2px solid var(--ro-phos); box-shadow: -1px  1px 8px rgba(77, 255, 170, 0.4); }
.ro-corner-br { bottom: 8px; right: 8px; border-bottom: 2px solid var(--ro-phos); border-right: 2px solid var(--ro-phos); box-shadow:  1px  1px 8px rgba(77, 255, 170, 0.4); }
.ro-panel-indulgence .ro-corner-tl,
.ro-panel-indulgence .ro-corner-tr,
.ro-panel-indulgence .ro-corner-bl,
.ro-panel-indulgence .ro-corner-br {
  border-color: var(--ro-magenta);
  box-shadow: 0 0 8px rgba(255, 62, 160, 0.4);
}

/* Marquee data ticker */
.ro-marquee {
  position: relative;
  margin: -12px -36px 18px;
  padding: 6px 0;
  border-top: 1px solid var(--ro-frame);
  border-bottom: 1px solid var(--ro-frame);
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
  font-size: 9px;
  letter-spacing: 4px;
  color: var(--ro-phos);
  text-shadow: 0 0 6px rgba(77, 255, 170, 0.4);
}
.ro-marquee::before,
.ro-marquee::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  z-index: 2;
  pointer-events: none;
}
.ro-marquee::before { left: 0; background: linear-gradient(to right, var(--ro-bg), transparent); }
.ro-marquee::after  { right: 0; background: linear-gradient(to left, var(--ro-bg), transparent); }
.ro-marquee-track {
  display: inline-flex;
  white-space: nowrap;
  animation: ro-marquee 38s linear infinite;
  will-change: transform;
}
.ro-marquee-content { padding-right: 1em; }
@keyframes ro-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* ─────────── HEADER ─────────── */
.ro-header {
  position: relative;
  margin-bottom: 22px;
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--ro-frame);
}
.ro-stamp {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--ro-phos);
  margin-bottom: 8px;
  padding-right: 96px;
}
.ro-stamp-indulgence { color: var(--ro-magenta); }
.ro-title {
  font-family: var(--ro-display);
  font-size: 32px;
  font-weight: 700;
  color: var(--ro-phos-bright);
  letter-spacing: 2px;
  margin: 0;
  text-shadow: 0 0 24px rgba(77, 255, 170, 0.45);
  line-height: 1.1;
  display: flex;
  align-items: center;
  gap: 14px;
}
.ro-title-orn {
  font-size: 18px;
  color: var(--ro-phos);
  text-shadow: 0 0 10px var(--ro-phos);
  animation: ro-pulse 2.6s ease-in-out infinite;
}
.ro-title-text {
  background: linear-gradient(180deg, var(--ro-phos-bright) 0%, var(--ro-phos) 60%, var(--ro-frame-bright) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.ro-title-magenta .ro-title-orn { color: var(--ro-magenta); text-shadow: 0 0 10px var(--ro-magenta); }
.ro-title-magenta .ro-title-text {
  background: linear-gradient(180deg, var(--ro-magenta-bright) 0%, var(--ro-magenta) 60%, #6b0e3a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
@keyframes ro-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.15); }
}
.ro-subtitle {
  font-style: italic;
  color: var(--ro-text-dim);
  font-size: 13px;
  margin-top: 6px;
  letter-spacing: 0.4px;
}
.ro-back {
  position: absolute;
  top: 0;
  right: 0;
  background: transparent;
  border: 1px solid var(--ro-frame);
  color: var(--ro-text-dim);
  padding: 6px 14px;
  font-family: var(--ro-mono);
  font-size: 10px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.18s;
}
.ro-back:hover {
  border-color: var(--ro-phos);
  color: var(--ro-phos);
}
.ro-dismiss {
  position: absolute;
  top: -8px;
  right: 0;
  background: transparent;
  border: 1px solid var(--ro-frame);
  color: var(--ro-text-dim);
  padding: 6px 14px;
  font-family: var(--ro-mono);
  font-size: 10px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.18s;
}
.ro-dismiss:hover {
  border-color: var(--ro-phos);
  color: var(--ro-phos);
}

/* ─────────── PRIMARY CTA ─────────── */
.ro-primary {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  width: 100%;
  padding: 22px 28px;
  background: linear-gradient(135deg, rgba(77, 255, 170, 0.08), rgba(13, 80, 50, 0.18));
  border: 1px solid var(--ro-phos);
  cursor: pointer;
  text-align: left;
  font-family: var(--ro-mono);
  color: var(--ro-text);
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
}
.ro-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(77, 255, 170, 0.15), transparent);
  transition: left 0.6s;
}
.ro-primary:hover {
  background: linear-gradient(135deg, rgba(77, 255, 170, 0.12), rgba(13, 80, 50, 0.22));
  box-shadow: 0 0 36px rgba(77, 255, 170, 0.35);
}
.ro-primary:hover::before { left: 100%; }
.ro-primary-meta { flex: 1; }
.ro-primary-tag {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--ro-phos);
  margin-bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.ro-primary-tag-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ro-phos);
  box-shadow: 0 0 8px var(--ro-phos);
  animation: ro-blink 1.4s ease-in-out infinite;
}
@keyframes ro-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.25; }
}
.ro-primary-name {
  font-family: var(--ro-display);
  font-size: 24px;
  letter-spacing: 1.5px;
  color: var(--ro-phos-bright);
  text-shadow: 0 0 18px rgba(77, 255, 170, 0.4);
  margin-bottom: 6px;
}
.ro-primary-desc {
  font-size: 12px;
  color: var(--ro-text-dim);
  max-width: 480px;
  line-height: 1.5;
}
.ro-primary-cta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding-left: 20px;
  border-left: 1px solid rgba(77, 255, 170, 0.25);
}
.ro-primary-cta-text {
  font-family: var(--ro-display);
  font-size: 14px;
  letter-spacing: 3px;
  color: var(--ro-phos-bright);
}
.ro-primary-cta-arrow {
  font-size: 28px;
  color: var(--ro-phos);
  margin-top: 4px;
  text-shadow: 0 0 12px var(--ro-phos);
  animation: ro-arrow-pulse 1.6s ease-in-out infinite;
}
@keyframes ro-arrow-pulse {
  0%, 100% { transform: translateX(0);   text-shadow: 0 0 12px var(--ro-phos); }
  50%      { transform: translateX(4px); text-shadow: 0 0 22px var(--ro-phos), 0 0 34px rgba(77, 255, 170, 0.5); }
}

/* ─────────── DIVIDER ─────────── */
.ro-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 24px 0 18px;
}
.ro-divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--ro-frame), transparent);
}
.ro-divider-text {
  font-size: 10px;
  letter-spacing: 4px;
  color: var(--ro-text-faint);
}

/* ─────────── TILES ─────────── */
.ro-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.ro-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 18px 18px 16px;
  background:
    linear-gradient(180deg, rgba(10, 58, 38, 0.32), rgba(5, 10, 7, 0.28));
  border: 1px solid var(--ro-frame);
  border-top: 2px solid var(--ro-frame-bright);
  cursor: pointer;
  text-align: left;
  font-family: var(--ro-mono);
  color: var(--ro-text);
  transition: all 0.2s;
  min-height: 160px;
  overflow: hidden;
}
.ro-tile::before {
  /* sweep on hover */
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
  transition: left 0.7s ease;
  pointer-events: none;
}
.ro-tile:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5); }
.ro-tile:hover::before { left: 130%; }
/* Accent variants */
.ro-tile-phos { border-top-color: var(--ro-phos); }
.ro-tile-phos:hover { border-color: var(--ro-phos); box-shadow: 0 8px 28px rgba(77, 255, 170, 0.22); }
.ro-tile-cyan { border-top-color: var(--ro-cyan); }
.ro-tile-cyan:hover { border-color: var(--ro-cyan); box-shadow: 0 8px 28px rgba(77, 214, 255, 0.25); }
.ro-tile-amber { border-top-color: var(--ro-amber); }
.ro-tile-amber:hover { border-color: var(--ro-amber); box-shadow: 0 8px 28px rgba(255, 184, 77, 0.22); }
.ro-tile-magenta { border-top-color: var(--ro-magenta); }
.ro-tile-magenta:hover { border-color: var(--ro-magenta); box-shadow: 0 8px 28px rgba(255, 62, 160, 0.25); }

.ro-tile-numeral {
  position: absolute;
  top: 8px;
  right: 12px;
  font-family: var(--ro-display);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--ro-text);
  opacity: 0.16;
  pointer-events: none;
}
.ro-tile-sigil-wrap {
  margin-bottom: 10px;
}
.ro-tile-sigil {
  font-family: var(--ro-display);
  font-size: 28px;
  line-height: 1;
}
.ro-tile-phos    .ro-tile-sigil { color: var(--ro-phos);    text-shadow: 0 0 14px rgba(77, 255, 170, 0.65); }
.ro-tile-cyan    .ro-tile-sigil { color: var(--ro-cyan);    text-shadow: 0 0 14px rgba(77, 214, 255, 0.65); }
.ro-tile-amber   .ro-tile-sigil { color: var(--ro-amber);   text-shadow: 0 0 14px rgba(255, 184, 77, 0.6); }
.ro-tile-magenta .ro-tile-sigil { color: var(--ro-magenta); text-shadow: 0 0 14px rgba(255, 62, 160, 0.6); }
.ro-tile-tag {
  font-size: 9px;
  letter-spacing: 2.5px;
  color: var(--ro-text-dim);
  margin-bottom: 4px;
}
.ro-tile-phos    .ro-tile-tag { color: var(--ro-phos); }
.ro-tile-cyan    .ro-tile-tag { color: var(--ro-cyan); }
.ro-tile-amber   .ro-tile-tag { color: var(--ro-amber); }
.ro-tile-magenta .ro-tile-tag { color: var(--ro-magenta); }
.ro-tile-spacer { flex: 1; }
.ro-tile-price {
  font-family: var(--ro-display);
  font-size: 14px;
  color: var(--ro-phos);
  font-weight: 600;
}
.ro-tile-title {
  font-family: var(--ro-display);
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--ro-phos-bright);
  margin-bottom: 6px;
  line-height: 1.2;
}
.ro-tile-desc {
  font-size: 11px;
  color: var(--ro-text-dim);
  line-height: 1.5;
  flex: 1;
}
.ro-tile-submenu {
  margin-top: 8px;
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--ro-magenta);
}

/* ─────────── INDULGENCE RITES ─────────── */
.ro-rites {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.ro-rite {
  display: flex;
  flex-direction: column;
  padding: 18px 18px 16px;
  background: rgba(10, 58, 38, 0.18);
  border: 1px solid var(--ro-frame);
  cursor: pointer;
  text-align: left;
  font-family: var(--ro-mono);
  color: var(--ro-text);
  transition: all 0.25s;
  position: relative;
  min-height: 280px;
}
.ro-rite:hover:not(:disabled) {
  background: rgba(13, 80, 50, 0.28);
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
}
.ro-rite-phos { border-top: 3px solid var(--ro-phos); }
.ro-rite-phos:hover:not(:disabled) {
  border-color: var(--ro-phos);
  box-shadow: 0 8px 28px rgba(77, 255, 170, 0.25);
}
.ro-rite-red { border-top: 3px solid var(--ro-red); }
.ro-rite-red:hover:not(:disabled) {
  border-color: var(--ro-red);
  box-shadow: 0 8px 28px rgba(255, 77, 109, 0.25);
}
.ro-rite-magenta { border-top: 3px solid var(--ro-magenta); }
.ro-rite-magenta:hover:not(:disabled) {
  border-color: var(--ro-magenta);
  box-shadow: 0 8px 28px rgba(255, 62, 160, 0.3);
}
.ro-rite.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ro-rite-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.ro-rite-sigil {
  font-family: var(--ro-display);
  font-size: 22px;
}
.ro-rite-phos .ro-rite-sigil { color: var(--ro-phos); text-shadow: 0 0 10px var(--ro-phos); }
.ro-rite-red .ro-rite-sigil { color: var(--ro-red); text-shadow: 0 0 10px var(--ro-red); }
.ro-rite-magenta .ro-rite-sigil { color: var(--ro-magenta); text-shadow: 0 0 10px var(--ro-magenta); }

.ro-rite-name {
  font-family: var(--ro-display);
  font-size: 18px;
  letter-spacing: 2px;
  color: var(--ro-phos-bright);
  flex: 1;
}
.ro-rite-red .ro-rite-name { color: var(--ro-red); }
.ro-rite-magenta .ro-rite-name { color: var(--ro-magenta-bright); }

.ro-rite-price {
  font-family: var(--ro-display);
  font-size: 14px;
  color: var(--ro-phos);
}
.ro-rite-char {
  font-family: var(--ro-display);
  font-size: 13px;
  letter-spacing: 1.5px;
  color: var(--ro-text);
  margin-top: 4px;
}
.ro-rite-char-role {
  font-size: 9px;
  letter-spacing: 2.5px;
  color: var(--ro-text-faint);
  margin-bottom: 12px;
}
.ro-rite-desc {
  font-size: 12px;
  color: var(--ro-text-dim);
  line-height: 1.55;
  margin-bottom: 14px;
  flex: 1;
}
.ro-rite-quote {
  font-style: italic;
  font-size: 11px;
  color: var(--ro-text);
  padding: 10px 12px;
  border-left: 2px solid;
  background: rgba(0, 0, 0, 0.25);
  line-height: 1.5;
}
.ro-rite-phos .ro-rite-quote { border-left-color: var(--ro-phos); }
.ro-rite-red .ro-rite-quote { border-left-color: var(--ro-red); }
.ro-rite-magenta .ro-rite-quote {
  border-left-color: var(--ro-magenta);
  color: var(--ro-magenta-bright);
}
.ro-rite-disabled-tag {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 9px;
  letter-spacing: 2.5px;
  color: var(--ro-text-faint);
  padding: 3px 8px;
  border: 1px solid var(--ro-frame);
}

/* ─────────── FOOTER ─────────── */
.ro-footer {
  margin-top: 22px;
  padding-top: 14px;
  border-top: 1px dashed var(--ro-frame);
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--ro-text-faint);
  text-align: center;
  font-style: italic;
}

/* ─────────── ANIMATIONS ─────────── */
@keyframes ro-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─────────── RESPONSIVE ─────────── */
@media (max-width: 720px) {
  .ro-root {
    align-items: flex-start;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  }
  .ro-tiles { grid-template-columns: 1fr; }
  .ro-rites { grid-template-columns: 1fr; }
  .ro-rite { min-height: auto; }
  .ro-primary { flex-direction: column; gap: 16px; }
  .ro-primary-cta { flex-direction: row; justify-content: space-between; padding-left: 0; padding-top: 12px; border-left: none; border-top: 1px solid rgba(77, 255, 170, 0.25); }
  .ro-title { font-size: 24px; }
  .ro-panel {
    min-height: 0;
    max-height: calc(100dvh - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom)));
    padding: 22px 20px;
  }
  .ro-dismiss {
    top: 0;
    width: 32px;
    height: 28px;
    padding: 0;
    font-size: 0;
    letter-spacing: 0;
  }
  .ro-dismiss::before {
    content: '✕';
    font-size: 14px;
    color: inherit;
  }
  .ro-stamp { padding-right: 44px; }
  .ro-marquee { margin: -8px -20px 14px; }
  .ro-title { font-size: 22px; gap: 10px; }
  .ro-title-orn { font-size: 14px; }
  .ro-tile-numeral { font-size: 24px; }
  .ro-tile { min-height: auto; }
  .ro-corner { width: 16px; height: 16px; }
}
`;