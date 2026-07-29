import React, { useEffect, useRef, useState } from "react";

const SERVICES = [
  //   {
  //   id: "quiz",
  //   eyebrow: "QUIZ",
  //   title: "WHAT KIND OF INVESTOR ARE YOU?",
  //   desc: "Find your investor type — and its blind spot.",
  //   accent: "amber",
  //   disabled: true,
  //   cta: "COMING SOON",
  // },
  // Classic single-case flow, parked per CASE_TABLE.md §4.8 — the Case
  // Table absorbed the case game. Reachable via ?classic=1 only (the
  // `classic` prop), so the rail never offers two case games at once.
  // {
  //   id: "game",
  //   eyebrow: "LEARN",
  //   title: "Crypto Forensic Files",
  //   desc: "Three questions. One verdict.",
  //   accent: "phos",
  //   classicOnly: true,
  // },

  // THE HEADLINE GAME (2026-07-26). Played in the room itself — no overlay,
  // the desk stays live. One deal a day, seeded the same for everyone.
  {
    id: "vc-game",
    eyebrow: "PLAY",
    title: "VC PARTNERS",
    desc: "One deal. One pitch. Three interruptions.",
    accent: "magenta",
  },

  // PARKED 2026-07-26: shipping ONE game to start (author's call). Two "PLAY"
  // tiles is the split-attention failure CASE_TABLE.md §4.8 warns about — "do
  // not maintain two reward-bearing games". The Case Table is intact on disk
  // and reachable via ?classic=1 alongside the forensic files; nothing was
  // deleted, so it can come back as a second mode whenever the VC Game earns it.
  {
    id: "terminal-traders",
    eyebrow: "PLAY",
    title: "The Trading Card Game",
    desc: "The Daily Deal Flow — research it, then trade it.",
    accent: "magenta",
    classicOnly: true,
  },
];

// Leading icon per service — rendered inside the circular accent chip.
// Inline SVG (not an icon font) so it needs no extra deps; the stroke
// inherits the chip's currentColor (the service accent).
const svgIcon = (paths) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);
const SERVICE_ICONS = {
  // Investor personality test → brain (lucide "brain")
  quiz: svgIcon(<><path d="M12 18V5" /><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" /><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" /><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" /><path d="M18 18a4 4 0 0 0 2-7.464" /><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" /><path d="M6 18a4 4 0 0 1-2-7.464" /><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" /></>),
  // Forensics → magnifier
  game: svgIcon(<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  // Analysis → bar chart
  analysis: svgIcon(<><line x1="3" y1="20" x2="21" y2="20" /><line x1="6.5" y1="20" x2="6.5" y2="12" /><line x1="12" y1="20" x2="12" y2="5" /><line x1="17.5" y1="20" x2="17.5" y2="9" /></>),
  // Trading card game → card stack
  'terminal-traders': svgIcon(<><rect x="8" y="4" width="12" height="16" rx="2" /><path d="M4 8v10a2 2 0 0 0 2 2h7" /></>),
  // The VC Game → a raised hand, interrupting (lucide "hand")
  'vc-game': svgIcon(<><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></>),
};

export default function TradeServiceRail({ selectedId = "vc-game", onSelect, onLaunch, open, onOpenChange, sheet = false, showHandle = true, classic = false } = {}) {
  // The offered roster: classicOnly entries (the parked single-case flow)
  // only surface when the host passes classic (the ?classic=1 escape hatch).
  const roster = SERVICES.filter((s) => classic || !s.classicOnly);
  const activeService = roster.find((s) => s.id === selectedId) ?? roster.find((s) => !s.disabled) ?? roster[0];
  const shellAccent = activeService.accent;

  // Split the live service(s) from the not-yet-shipped ones. Live services
  // render as full cards; locked ones collapse into slim teaser rows so the
  // one actionable path dominates the rail instead of competing with two
  // greyed-out equals.
  const liveServices = roster.filter((s) => !s.disabled);
  const lockedServices = roster.filter((s) => s.disabled);

  // Mobile collapses the rail into a single pill (active service + chevron)
  // by default; tapping the pill expands a popover above it with the full
  // chooser. Desktop ignores this state — CSS hides the pill at >520px and
  // shows the options inline.
  // The drawer's open state can be controlled by the parent (the lobby lifts
  // it so the center "START" button can reveal the menu) or managed
  // internally (uncontrolled fallback). When controlled, the parent owns
  // persistence; uncontrolled mode remembers the choice in localStorage.
  const isControlled = open !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = isControlled ? open : internalExpanded;
  const rootRef = useRef(null);

  // Persist the desktop drawer's open/closed choice across visits. Skipped
  // on mobile (≤520px), where the rail is a tap-to-open pill rather than a
  // remembered drawer — so a saved "open" never auto-pops the mobile popover.
  const persistExpanded = (next) => {
    if (isControlled) return;
    try {
      if (typeof window !== 'undefined' && window.innerWidth > 520) {
        window.localStorage.setItem('tsrRailExpanded', next ? '1' : '0');
      }
    } catch (e) {}
  };
  const applyExpanded = (next) => {
    persistExpanded(next);
    if (isControlled) onOpenChange?.(next);
    else setInternalExpanded(next);
  };
  const openRail = () => applyExpanded(true);
  const closeRail = () => applyExpanded(false);

  // Restore the last desktop drawer state on mount (uncontrolled only).
  // Mobile always boots collapsed (the pill); only wider viewports honor it.
  useEffect(() => {
    if (isControlled) return;
    if (typeof window === 'undefined' || window.innerWidth <= 520) return;
    try {
      if (window.localStorage.getItem('tsrRailExpanded') === '1') setInternalExpanded(true);
    } catch (e) {}
  }, [isControlled]);

  // Dismiss popover on outside-tap / Escape so the user isn't stranded
  // with the options floating over the canvas.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        closeRail();
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeRail();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);

  return (
    <div
      ref={rootRef}
      className={`tsr-root tsr-${shellAccent}${expanded ? ' is-expanded' : ''}${sheet ? ' is-sheet' : ''}`}
      aria-label="Trade page services"
      onClick={sheet ? (e) => { if (e.target === e.currentTarget) closeRail(); } : undefined}
    >
      <style>{STYLES}</style>
      {/* Desktop-only collapsed edge handle. Hidden by CSS on mobile (the
          pill takes over) and when the drawer is expanded. Clicking it
          slides the shell in from the right. Suppressed via showHandle={false}
          when a host page provides its own SERVICES entry (e.g. /trade's
          unified feature rail). */}
      {showHandle && (
        <button
          type="button"
          className="tsr-handle"
          onClick={openRail}
          aria-expanded={expanded}
          aria-label="Open services panel"
        >
          <span className="tsr-pip" aria-hidden />
          <span className="tsr-handle-label">SERVICES</span>
          <span className="tsr-handle-chevron" aria-hidden>‹</span>
        </button>
      )}
      <div className={`tsr-shell tsr-${shellAccent}`}>
        {/* Desktop-only collapse control — retracts the drawer back to the
            edge handle. Hidden on mobile (the pill chevron does this job). */}
        <button
          type="button"
          className="tsr-collapse"
          onClick={closeRail}
          aria-label="Collapse services panel"
        >›</button>
        {/* Mobile-only collapsed pill. Hidden by CSS on desktop. */}
        <button
          type="button"
          className={`tsr-pill tsr-card-${activeService.accent}`}
          onClick={() => (expanded ? closeRail() : openRail())}
          aria-expanded={expanded}
          aria-label={`Active service: ${activeService.title}. Tap to ${expanded ? 'close' : 'change'}.`}
        >
          <span className="tsr-pip" aria-hidden />
          <span className="tsr-pill-eyebrow">{activeService.eyebrow}</span>
          <span className="tsr-pill-sep" aria-hidden>·</span>
          <span className="tsr-pill-title">{activeService.title}</span>
          <span className="tsr-pill-chevron" aria-hidden>▾</span>
        </button>
        <div className="tsr-status">
          <span className="tsr-pip" aria-hidden />
          THE LOBBY
        </div>
        <div className="tsr-options" role="radiogroup" aria-label="Available services">
          {liveServices.map((service) => {
            const isSelected = service.id === activeService.id;
            // Live cards launch their service directly — the drawer is the
            // menu, each card its own START. (The center bottom button just
            // opens this menu.) Falls back to select + collapse if no onLaunch.
            const handleClick = () => {
              onSelect?.(service.id);
              if (onLaunch) onLaunch(service.id);
              else closeRail();
            };
            const className = [
              'tsr-card',
              `tsr-card-${service.accent}`,
              'is-interactive',
              isSelected ? 'is-active' : null,
            ].filter(Boolean).join(' ');
            return (
              <div
                key={service.id}
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                onClick={handleClick}
                onKeyDown={
                  handleClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleClick();
                        }
                      }
                    : undefined
                }
                className={className}
              >
                <span className="tsr-card-chip" aria-hidden>{SERVICE_ICONS[service.id]}</span>
                <span className="tsr-card-body">
                  <span className="tsr-card-eyebrow">{service.eyebrow}</span>
                  <span className="tsr-card-title">{service.title}</span>
                  <span className="tsr-card-desc">{service.desc}</span>
                </span>
                {/* Each live card is its own launch button now — the center
                    bottom button only opens this menu, so the card carries
                    the START action. */}
                <span className="tsr-card-cta">START ▸</span>
              </div>
            );
          })}
          {lockedServices.length > 0 && (
            <div className="tsr-teasers">
              {lockedServices.map((service) => (
                <div
                  key={service.id}
                  role="radio"
                  tabIndex={-1}
                  aria-checked={false}
                  aria-disabled
                  className={`tsr-teaser tsr-card-${service.accent}`}
                >
                  <span className="tsr-teaser-chip" aria-hidden>{SERVICE_ICONS[service.id]}</span>
                  <span className="tsr-teaser-body">
                    <span className="tsr-teaser-eyebrow">{service.eyebrow}</span>
                    <span className="tsr-teaser-title">{service.title}</span>
                  </span>
                  <span className="tsr-teaser-cta">
                    <span className="tsr-teaser-lock" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, display: 'block' }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    SOON
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STYLES = `
.tsr-root {
  position: fixed;
  left: 50%;
  bottom: calc(82px + env(safe-area-inset-bottom));
  z-index: 1100;
  width: min(980px, calc(100vw - 28px));
  transform: translateX(-50%);
  pointer-events: none;
}

.tsr-shell {
  --tsr-accent: #8effc4;
  --tsr-accent-soft: rgba(77, 255, 170, 0.22);
  --tsr-accent-faint: rgba(77, 255, 170, 0.08);
  position: relative;
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
  gap: 10px;
  padding: 10px 8px 8px;
  border: 1px solid color-mix(in srgb, var(--tsr-accent) 40%, rgba(140, 150, 170, 0.2));
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(6, 8, 14, 0.92), rgba(2, 3, 6, 0.84));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Bridge hairline — magenta (the nav FAB) → green (this panel). Makes the
   FAB→drawer handoff read as intentional. Inset past the corner radius so it
   sits along the top edge without overflow:hidden (which would clip the
   mobile popover). */
.tsr-shell::before {
  content: "";
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: linear-gradient(90deg, #c54bd6, var(--tsr-accent));
  opacity: 0.9;
}

.tsr-phos {
  --tsr-accent: #8effc4;
  --tsr-accent-soft: rgba(77, 255, 170, 0.22);
  --tsr-accent-faint: rgba(77, 255, 170, 0.08);
}
.tsr-cyan {
  --tsr-accent: #8ee9ff;
  --tsr-accent-soft: rgba(77, 214, 255, 0.22);
  --tsr-accent-faint: rgba(77, 214, 255, 0.08);
}
.tsr-amber {
  --tsr-accent: #ffcb74;
  --tsr-accent-soft: rgba(255, 184, 77, 0.22);
  --tsr-accent-faint: rgba(255, 184, 77, 0.08);
}
.tsr-magenta {
  --tsr-accent: #ff7ac4;
  --tsr-accent-soft: rgba(255, 62, 160, 0.24);
  --tsr-accent-faint: rgba(255, 62, 160, 0.08);
}

.tsr-status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 132px;
  padding: 0 14px;
  border-right: 1px solid rgba(180, 180, 200, 0.18);
  color: var(--tsr-accent);
  font-family: 'Orbitron', 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.2em;
  line-height: 1.35;
  text-shadow: 0 0 10px var(--tsr-accent-soft);
}

.tsr-pip {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--tsr-accent);
  box-shadow: 0 0 12px var(--tsr-accent);
  animation: tsr-pulse 1.8s ease-in-out infinite;
}

.tsr-options {
  display: grid;
  /* Live card hugs a sensible content width rather than stretching the full
     rail; the teaser stack sits at the right edge, with intentional negative
     space distributed between them. */
  grid-template-columns: minmax(264px, 392px) clamp(168px, 26%, 212px);
  justify-content: space-between;
  align-items: stretch;
  gap: 12px;
}

/* Stack of slim "coming soon" rows. Recedes next to the live card so the
   actionable path reads first. */
.tsr-teasers {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.tsr-teaser {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  overflow: hidden;
  border: 1px solid rgba(140, 150, 170, 0.16);
  border-radius: 9px;
  background: rgba(8, 11, 16, 0.5);
  color: #c3ccd6;
  opacity: 0.66;
  cursor: not-allowed;
  font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
}

/* Dimmer sibling of the live-card chip. */
.tsr-teaser-chip {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-accent) 30%, transparent);
}
.tsr-teaser-chip svg { width: 17px; height: 17px; display: block; }

/* Faint accent strip — keeps each teaser's color identity at low intensity. */
.tsr-teaser::after { content: none; }

.tsr-teaser-lock {
  flex: 0 0 auto;
  display: flex;
  opacity: 0.8;
}

.tsr-teaser-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.tsr-teaser-eyebrow {
  color: var(--card-accent);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.2em;
  line-height: 1;
  opacity: 0.85;
}

.tsr-teaser-title {
  color: rgba(220, 228, 238, 0.82);
  font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tsr-teaser-cta {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 5px;
  color: color-mix(in srgb, var(--card-accent) 70%, #9fb0bb);
  font-family: 'Orbitron', 'IBM Plex Mono', monospace;
  font-size: 7.5px;
  font-weight: 900;
  letter-spacing: 0.16em;
  opacity: 0.85;
}

.tsr-card {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 11px;
  min-height: 62px;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--card-accent) 30%, rgba(140, 150, 170, 0.18));
  border-radius: 9px;
  background: color-mix(in srgb, var(--card-accent) 7%, rgba(8, 11, 16, 0.55));
  color: #e4ecf2;
  cursor: default;
  text-align: left;
  font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  transition:
    border-color 180ms ease,
    background 180ms ease;
}

/* Circular accent icon chip (the B-direction motif). */
.tsr-card-chip {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-accent) 50%, transparent);
}
.tsr-card-chip svg { width: 20px; height: 20px; display: block; }

.tsr-card-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Left-edge accent strip — gives each card a quick read of its color
   even when not selected. Sits inside the padding so it doesn't shift
   the text. */
/* Left accent strip retired — the circular chip carries the accent now. */
.tsr-card::after { content: none; }

.tsr-card::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0;
  background: linear-gradient(120deg, transparent, color-mix(in srgb, var(--card-accent) 16%, transparent), transparent);
  transform: translateX(-60%);
  transition: opacity 180ms ease, transform 520ms ease;
}

.tsr-card.is-active {
  border-color: color-mix(in srgb, var(--card-accent) 72%, transparent);
  background: color-mix(in srgb, var(--card-accent) 13%, rgba(8, 11, 16, 0.5));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--card-accent) 30%, transparent);
}

.tsr-card.is-active::after {
  opacity: 1;
  box-shadow: 0 0 14px color-mix(in srgb, var(--card-accent) 80%, transparent);
}

.tsr-card.is-active::before {
  opacity: 1;
  transform: translateX(60%);
}

.tsr-card.is-inert {
  opacity: 0.72;
}

.tsr-card.is-inert .tsr-card-cta {
  opacity: 0.5;
}

.tsr-card.is-interactive {
  cursor: pointer;
}

.tsr-card.is-interactive:hover,
.tsr-card.is-interactive:focus-visible {
  border-color: color-mix(in srgb, var(--card-accent) 80%, white 6%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-accent) 16%, rgba(8, 10, 16, 0.5)), rgba(2, 3, 6, 0.55));
  box-shadow:
    0 0 22px color-mix(in srgb, var(--card-accent) 32%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--card-accent) 42%, transparent);
  outline: none;
}

.tsr-card.is-interactive:hover::after,
.tsr-card.is-interactive:focus-visible::after {
  opacity: 0.9;
  box-shadow: 0 0 12px color-mix(in srgb, var(--card-accent) 70%, transparent);
}

.tsr-card.is-interactive .tsr-card-cta {
  opacity: 1;
}

.tsr-card.is-disabled {
  opacity: 0.58;
  cursor: not-allowed;
  filter: grayscale(0.18);
}

.tsr-card.is-disabled .tsr-card-cta {
  opacity: 1;
  color: var(--card-accent);
}

.tsr-card-phos { --card-accent: #8effc4; }
.tsr-card-cyan { --card-accent: #8ee9ff; }
.tsr-card-amber { --card-accent: #ffcb74; }
.tsr-card-magenta { --card-accent: #ff7ac4; }

.tsr-card-eyebrow,
.tsr-card-title,
.tsr-card-desc,
.tsr-card-cta {
  position: relative;
  z-index: 1;
  display: block;
}

.tsr-card-eyebrow {
  color: var(--card-accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.22em;
  line-height: 1;
  margin-bottom: 4px;
  text-shadow: 0 0 10px color-mix(in srgb, var(--card-accent) 60%, transparent);
}

.tsr-card-title {
  color: #f3f6fa;
  font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1.12;
}

.tsr-card-desc {
  max-width: 21ch;
  margin-top: 6px;
  color: rgba(200, 210, 222, 0.62);
  font-size: 10px;
  line-height: 1.35;
}

.tsr-card-cta {
  flex: 0 0 auto;
  align-self: center;
  color: var(--card-accent);
  font-family: 'Orbitron', 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

/* Collapsed-pill view of the rail — hidden on desktop, becomes the
   default visible state on narrow viewports (≤520px). The full chooser
   slides up over it as a popover when expanded. */
.tsr-pill {
  display: none;
}

/* Desktop drawer chrome — off by default; the min-width rule below turns
   it on for wider viewports. Keeps mobile (the pill) untouched. */
.tsr-handle,
.tsr-collapse {
  display: none;
}

@keyframes tsr-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.72); }
}

@keyframes tsr-popover-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 900px) {
  .tsr-root {
    bottom: calc(82px + env(safe-area-inset-bottom));
    width: min(620px, calc(100vw - 20px));
  }
  .tsr-shell {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .tsr-status {
    min-width: 0;
    padding: 2px 4px 0;
    border-right: 0;
    justify-content: center;
  }
  .tsr-options {
    grid-template-columns: minmax(0, 1fr) clamp(150px, 38%, 200px);
  }
  .tsr-card {
    min-height: 72px;
  }
}

@media (max-width: 520px) {
  .tsr-root {
    bottom: calc(78px + env(safe-area-inset-bottom));
    width: calc(100vw - 14px);
  }
  /* Shell becomes a single-row pill container. The status block hides
     (the pill embeds its own pip), the cards hide unless expanded. */
  .tsr-shell {
    position: relative;
    grid-template-columns: 1fr;
    padding: 4px;
    gap: 0;
  }
  .tsr-status {
    display: none;
  }

  /* Pill — the always-visible mobile chrome. Shows the active service so
     the user knows what's selected without expanding. */
  .tsr-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    background: transparent;
    border: none;
    color: var(--tsr-accent);
    cursor: pointer;
    font-family: 'Orbitron', 'IBM Plex Mono', monospace;
    text-align: left;
    /* The button's own outline ring isn't needed — the surrounding shell
       already reads as a focusable surface. Keep keyboard outline though. */
    outline: none;
  }
  .tsr-pill:focus-visible {
    outline: 2px solid var(--tsr-accent);
    outline-offset: -2px;
  }
  .tsr-pill-eyebrow {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--card-accent);
    text-shadow: 0 0 8px color-mix(in srgb, var(--card-accent) 30%, transparent);
  }
  .tsr-pill-sep {
    opacity: 0.45;
    color: rgba(200, 210, 222, 0.7);
    font-size: 11px;
  }
  .tsr-pill-title {
    flex: 1;
    min-width: 0;
    font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #effff5;
    text-shadow: 0 0 10px color-mix(in srgb, var(--card-accent) 24%, transparent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tsr-pill-chevron {
    margin-left: auto;
    font-size: 14px;
    color: var(--tsr-accent);
    transition: transform 220ms ease;
  }
  .tsr-root.is-expanded .tsr-pill-chevron {
    transform: rotate(180deg);
  }

  /* Collapsed: hide the chooser entirely. */
  .tsr-root:not(.is-expanded) .tsr-options {
    display: none;
  }

  /* Expanded: chooser becomes an absolute popover above the shell.
     Anchored to .tsr-root (the nearest positioned ancestor). */
  .tsr-root.is-expanded .tsr-options {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid color-mix(in srgb, var(--tsr-accent) 62%, transparent);
    background:
      linear-gradient(180deg, rgba(6, 8, 14, 0.94), rgba(2, 3, 6, 0.9)),
      radial-gradient(circle at 18% 50%, var(--tsr-accent-faint), transparent 56%);
    box-shadow:
      0 0 28px var(--tsr-accent-soft),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    overflow: visible;
    /* Override the horizontal-scroll mask from the desktop-mobile rule. */
    -webkit-mask-image: none;
            mask-image: none;
    animation: tsr-popover-in 200ms ease-out;
  }
  .tsr-root.is-expanded .tsr-card {
    flex: 1 1 auto;
    width: 100%;
    min-height: 64px;
    scroll-snap-align: none;
  }
}

/* === Desktop / tablet horizontal side-dock ============================
   Additive: docks the rail to the right edge and slides it in/out along
   the X axis. Default = collapsed to a slim edge handle so the diorama
   stays clear; expanding slides the chooser in from the right. Scoped to
   >520px so the ≤520px pill behaviour above is untouched. The root is a
   fixed, click-through clipping viewport (overflow:hidden) — the off-screen
   collapsed shell is clipped rather than spilling a horizontal scrollbar. */
@media (min-width: 521px) {
  .tsr-root {
    left: auto;
    right: 0;
    bottom: calc(86px + env(safe-area-inset-bottom));
    width: min(940px, calc(100vw - 8px));
    transform: none;
    pointer-events: none;
    overflow: hidden;
    padding: 28px 0 28px 28px;
  }

  /* The chooser. A fixed-width vertical panel docked right; slides on X. */
  .tsr-shell {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 9px;
    width: 296px;
    max-width: 100%;
    margin-left: auto;
    transform: translateX(0);
    transition:
      transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1),
      opacity 220ms ease;
  }
  /* Status becomes a top header row instead of a left rail. */
  .tsr-shell .tsr-status {
    min-width: 0;
    padding: 2px 4px 8px;
    border-right: none;
    border-bottom: 1px solid rgba(180, 180, 200, 0.12);
    justify-content: flex-start;
  }
  /* Services stack vertically (live card, then the locked teasers). */
  .tsr-shell .tsr-options {
    grid-template-columns: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Collapsed: shell slides off the right edge (clipped by the root). */
  .tsr-root:not(.is-expanded) .tsr-shell {
    transform: translateX(calc(100% + 44px));
    opacity: 0;
    pointer-events: none;
  }

  /* Edge handle — the always-present collapsed affordance. */
  .tsr-handle {
    position: absolute;
    right: 0;
    bottom: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px 9px;
    pointer-events: auto;
    border: 1px solid color-mix(in srgb, var(--tsr-accent) 55%, transparent);
    border-right: none;
    border-radius: 8px 0 0 8px;
    background: linear-gradient(180deg, rgba(6, 8, 14, 0.9), rgba(2, 3, 6, 0.82));
    box-shadow:
      0 0 22px var(--tsr-accent-soft),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--tsr-accent);
    cursor: pointer;
    transition:
      box-shadow 180ms ease,
      transform 200ms ease,
      opacity 200ms ease;
  }
  .tsr-handle:hover,
  .tsr-handle:focus-visible {
    transform: translateX(-3px);
    box-shadow: 0 0 30px color-mix(in srgb, var(--tsr-accent) 40%, transparent);
    outline: none;
  }
  .tsr-handle-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    font-family: 'Orbitron', 'IBM Plex Mono', monospace;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.3em;
    text-shadow: 0 0 10px var(--tsr-accent-soft);
  }
  .tsr-handle-chevron {
    font-size: 16px;
    line-height: 1;
    font-weight: 700;
  }

  /* Expanded: fade the handle out so it doesn't collide with the shell. */
  .tsr-root.is-expanded .tsr-handle {
    opacity: 0;
    pointer-events: none;
    transform: translateX(16px);
  }

  /* Retract control — mirrors the handle, lives in the shell's top-right. */
  .tsr-collapse {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    pointer-events: auto;
    border: 1px solid rgba(180, 190, 210, 0.22);
    border-radius: 5px;
    background: rgba(8, 10, 16, 0.65);
    color: var(--tsr-accent);
    cursor: pointer;
    font-family: 'Orbitron', monospace;
    font-size: 14px;
    line-height: 1;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .tsr-collapse:hover,
  .tsr-collapse:focus-visible {
    border-color: var(--tsr-accent);
    box-shadow: 0 0 12px var(--tsr-accent-soft);
    outline: none;
  }

  /* Respect reduced-motion: snap instead of slide. */
  @media (prefers-reduced-motion: reduce) {
    .tsr-shell,
    .tsr-handle { transition: none; }
  }
}

/* === Mobile bottom sheet =============================================
   When sheet mode is set (the mobile lobby), the rail is NOT a persistent bar —
   it only mounts when opened (via the START FAB) and presents as a full-screen
   scrim with a slide-up sheet, so nothing covers the scene at rest. Overrides
   both the ≤520 pill and the desktop dock via specificity. */
.tsr-root.is-sheet {
  position: fixed;
  inset: 0;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  max-width: none;
  transform: none;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: auto;
  overflow: visible;
  padding: 0;
  background: rgba(2, 4, 8, 0.55);
  animation: tsr-fade-in 180ms ease-out;
}
.tsr-root.is-sheet .tsr-handle,
.tsr-root.is-sheet .tsr-pill { display: none; }
.tsr-root.is-sheet .tsr-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 100%;
  max-width: 560px;
  margin: 0;
  border-radius: 16px 16px 0 0;
  padding: 18px 14px calc(16px + env(safe-area-inset-bottom));
  transform: none;
  animation: tsr-sheet-up 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
/* Grab handle — signals the sheet is dismissible. */
.tsr-root.is-sheet .tsr-shell::after {
  content: "";
  position: absolute;
  top: 7px;
  left: 50%;
  transform: translateX(-50%);
  width: 38px;
  height: 4px;
  border-radius: 2px;
  background: rgba(200, 210, 222, 0.3);
}
.tsr-root.is-sheet .tsr-status {
  display: flex;
  min-width: 0;
  padding: 4px 4px 9px;
  border-right: none;
  border-bottom: 1px solid rgba(180, 180, 200, 0.12);
  justify-content: flex-start;
}
.tsr-root.is-sheet .tsr-options {
  grid-template-columns: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
@keyframes tsr-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes tsr-sheet-up { from { transform: translateY(101%); } to { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .tsr-root.is-sheet,
  .tsr-root.is-sheet .tsr-shell { animation: none; }
}
`;
