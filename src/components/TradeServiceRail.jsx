import React, { useEffect, useRef, useState } from "react";

const SERVICES = [
  {
    id: "game",
    eyebrow: "LEARN",
    title: "Token Task Force",
    desc: "Three questions. One verdict.",
    accent: "phos",
  },
  {
    id: "analysis",
    eyebrow: "ANALYSIS",
    title: "Token Review",
    desc: "Request a team analysis of any token.",
    accent: "cyan",
  },
  {
    id: "terminal-traders",
    eyebrow: "PLAY",
    title: "Terminal Traders",
    desc: "The Trading Card Game.",
    accent: "magenta",
    disabled: true,
    cta: "COMING SOON",
  },
];

export default function TradeServiceRail({ selectedId = "game", onSelect } = {}) {
  const activeService = SERVICES.find((s) => s.id === selectedId) ?? SERVICES[0];
  const shellAccent = activeService.accent;

  // Mobile collapses the rail into a single pill (active service + chevron)
  // by default; tapping the pill expands a popover above it with the full
  // chooser. Desktop ignores this state — CSS hides the pill at >520px and
  // shows the options inline.
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);

  // Dismiss popover on outside-tap / Escape so the user isn't stranded
  // with the options floating over the canvas.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setExpanded(false);
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
      className={`tsr-root${expanded ? ' is-expanded' : ''}`}
      aria-label="Trade page services"
    >
      <style>{STYLES}</style>
      <div className={`tsr-shell tsr-${shellAccent}`}>
        {/* Mobile-only collapsed pill. Hidden by CSS on desktop. */}
        <button
          type="button"
          className={`tsr-pill tsr-card-${activeService.accent}`}
          onClick={() => setExpanded((v) => !v)}
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
          SERVICES ONLINE
        </div>
        <div className="tsr-options" role="radiogroup" aria-label="Available services">
          {SERVICES.map((service) => {
            const isSelected = service.id === activeService.id;
            const isDisabled = !!service.disabled;
            const handleClick = !isSelected && !isDisabled && onSelect
              ? () => {
                  onSelect(service.id);
                  // Auto-collapse mobile popover after a choice is made.
                  setExpanded(false);
                }
              : undefined;
            const className = [
              'tsr-card',
              `tsr-card-${service.accent}`,
              isDisabled ? 'is-disabled' : isSelected ? 'is-active' : 'is-interactive',
            ].filter(Boolean).join(' ');
            return (
              <div
                key={service.id}
                role="radio"
                tabIndex={isDisabled ? -1 : 0}
                aria-checked={isSelected}
                aria-disabled={isDisabled}
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
                <span className="tsr-card-eyebrow">{service.eyebrow}</span>
                <span className="tsr-card-title">{service.title}</span>
                <span className="tsr-card-desc">{service.desc}</span>
                <span className="tsr-card-cta">{service.cta || (isSelected ? 'SELECTED' : 'SELECT')}</span>
              </div>
            );
          })}
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
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
  gap: 10px;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--tsr-accent) 62%, transparent);
  background:
    linear-gradient(180deg, rgba(6, 8, 14, 0.88), rgba(2, 3, 6, 0.78)),
    radial-gradient(circle at 18% 50%, var(--tsr-accent-faint), transparent 56%);
  box-shadow:
    0 0 28px var(--tsr-accent-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
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
  grid-template-columns: 1.05fr 1fr 1fr;
  gap: 7px;
}

.tsr-card {
  position: relative;
  min-height: 78px;
  padding: 11px 12px 10px 20px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--card-accent) 48%, rgba(140, 150, 170, 0.2));
  border-top-color: color-mix(in srgb, var(--card-accent) 78%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-accent) 14%, rgba(8, 10, 16, 0.55)), color-mix(in srgb, var(--card-accent) 4%, rgba(2, 3, 6, 0.5)));
  color: #e4ecf2;
  cursor: default;
  text-align: left;
  font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

/* Left-edge accent strip — gives each card a quick read of its color
   even when not selected. Sits inside the padding so it doesn't shift
   the text. */
.tsr-card::after {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 5px;
  border-radius: 0 3px 3px 0;
  background: var(--card-accent);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--card-accent) 75%, transparent),
    0 0 24px color-mix(in srgb, var(--card-accent) 35%, transparent);
  opacity: 0.85;
  transition: opacity 180ms ease, box-shadow 180ms ease;
}

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
  border-color: color-mix(in srgb, var(--card-accent) 90%, white 8%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-accent) 28%, rgba(8, 10, 16, 0.45)), color-mix(in srgb, var(--card-accent) 8%, rgba(2, 3, 6, 0.55)));
  box-shadow:
    0 0 28px color-mix(in srgb, var(--card-accent) 45%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--card-accent) 55%, transparent);
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
  margin-bottom: 7px;
  text-shadow: 0 0 10px color-mix(in srgb, var(--card-accent) 60%, transparent);
}

.tsr-card-title {
  color: #f3f6fa;
  font-family: 'Cinzel Decorative', 'Cinzel', Georgia, serif;
  font-size: 14px;
  letter-spacing: 0.06em;
  line-height: 1.05;
  text-shadow: 0 0 12px color-mix(in srgb, var(--card-accent) 32%, transparent);
}

.tsr-card-desc {
  max-width: 21ch;
  margin-top: 6px;
  color: rgba(200, 210, 222, 0.62);
  font-size: 10px;
  line-height: 1.35;
}

.tsr-card-cta {
  position: absolute;
  right: 10px;
  bottom: 8px;
  color: var(--card-accent);
  font-family: 'Orbitron', 'IBM Plex Mono', monospace;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.18em;
  opacity: 0.85;
  text-shadow: 0 0 8px color-mix(in srgb, var(--card-accent) 55%, transparent);
}

/* Collapsed-pill view of the rail — hidden on desktop, becomes the
   default visible state on narrow viewports (≤520px). The full chooser
   slides up over it as a popover when expanded. */
.tsr-pill {
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    font-family: 'Cinzel Decorative', 'Cinzel', Georgia, serif;
    font-size: 13px;
    letter-spacing: 0.05em;
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
`;
