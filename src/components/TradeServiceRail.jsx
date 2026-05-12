import React, { useState } from "react";

const SERVICES = [
  {
    id: "game",
    eyebrow: "FREE",
    title: "Token Trainer",
    desc: "Read evidence. Render verdict. Climb the board.",
    accent: "phos",
    cta: "START",
  },
  {
    id: "analysis",
    eyebrow: "ANALYSIS",
    title: "Token Review",
    desc: "Request a team analysis of any token.",
    accent: "cyan",
    cta: "QUEUE",
  },
];

export default function TradeServiceRail({ onSelect }) {
  const [activeId, setActiveId] = useState("game");
  const activeService =
    SERVICES.find((service) => service.id === activeId) || SERVICES[0];

  const handleSelect = (service) => {
    if (service.id === "game") onSelect?.(service.id);
  };

  return (
    <div className="tsr-root" aria-label="Trade page services">
      <style>{STYLES}</style>
      <div className={`tsr-shell tsr-${activeService.accent}`}>
        <div className="tsr-status">
          <span className="tsr-pip" aria-hidden />
          SERVICES ONLINE
        </div>
        <div className="tsr-options">
          {SERVICES.map((service) => {
            const isActive = service.id === activeService.id;
            return (
              <button
                key={service.id}
                className={`tsr-card tsr-card-${service.accent}${isActive ? " is-active" : ""}${service.id !== "game" ? " is-inert" : ""}`}
                onMouseEnter={() => setActiveId(service.id)}
                onFocus={() => setActiveId(service.id)}
                onClick={() => handleSelect(service)}
                aria-disabled={service.id !== "game" || undefined}
              >
                <span className="tsr-card-eyebrow">{service.eyebrow}</span>
                <span className="tsr-card-title">{service.title}</span>
                <span className="tsr-card-desc">{service.desc}</span>
                <span className="tsr-card-cta">{service.cta}</span>
              </button>
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
    linear-gradient(180deg, rgba(4, 12, 8, 0.86), rgba(2, 5, 8, 0.74)),
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
  border-right: 1px solid rgba(142, 255, 196, 0.2);
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
  grid-template-columns: 1.05fr 1fr;
  gap: 7px;
}

.tsr-card {
  position: relative;
  min-height: 78px;
  padding: 11px 12px 10px;
  overflow: hidden;
  border: 1px solid rgba(110, 181, 154, 0.28);
  border-top-color: color-mix(in srgb, var(--card-accent) 58%, rgba(110, 181, 154, 0.28));
  background:
    linear-gradient(180deg, rgba(10, 58, 38, 0.22), rgba(2, 5, 8, 0.46));
  color: #c8ffe0;
  cursor: pointer;
  text-align: left;
  font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
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

.tsr-card:hover,
.tsr-card:focus-visible,
.tsr-card.is-active {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--card-accent) 72%, white 4%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-accent) 10%, rgba(10, 58, 38, 0.2)), rgba(2, 5, 8, 0.5));
  box-shadow: 0 0 18px color-mix(in srgb, var(--card-accent) 22%, transparent);
}

.tsr-card:hover::before,
.tsr-card:focus-visible::before,
.tsr-card.is-active::before {
  opacity: 1;
  transform: translateX(60%);
}

.tsr-card.is-inert {
  cursor: default;
}

.tsr-card.is-inert .tsr-card-cta {
  opacity: 0.46;
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
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.22em;
  line-height: 1;
  margin-bottom: 7px;
}

.tsr-card-title {
  color: #effff5;
  font-family: 'Cinzel Decorative', 'Cinzel', Georgia, serif;
  font-size: 14px;
  letter-spacing: 0.06em;
  line-height: 1.05;
  text-shadow: 0 0 12px color-mix(in srgb, var(--card-accent) 26%, transparent);
}

.tsr-card-desc {
  max-width: 21ch;
  margin-top: 6px;
  color: #78b89d;
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
  opacity: 0.72;
}

@keyframes tsr-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.72); }
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .tsr-shell {
    padding: 6px;
  }
  .tsr-status {
    font-size: 8px;
    letter-spacing: 0.16em;
  }
  .tsr-options {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scroll-snap-type: x mandatory;
  }
  .tsr-options::-webkit-scrollbar {
    display: none;
  }
  .tsr-card {
    flex: 0 0 180px;
    min-height: 78px;
    scroll-snap-align: center;
  }
}
`;
