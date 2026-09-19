"use client";

import React, { useEffect, useState } from "react";
import LTTvChiron from "@/components/trade/LTTvChiron";

// Exported so the mobile LT TV screen (MobileTalkShow) shows the same slate
// rather than keeping a second copy that drifts from this one.
export const EPISODES = [
  {
    number: "01",
    title: "The Halo Effect",
    runtime: "03:42",
    summary: "How perception shapes markets, and why narratives become reality.",
  },
  {
    number: "02",
    title: "The Wealth Effect",
    runtime: "03:15",
    summary: "Paper gains, real confidence, and the stories a rising chart tells.",
  },
  {
    number: "03",
    title: "Meme Season",
    runtime: "03:28",
    summary: "When attention becomes an asset, the joke may be the honest part.",
  },
  {
    number: "04",
    title: "Why We Chase Tops",
    runtime: "03:05",
    summary: "FOMO, belonging, and the comfort of arriving with everyone else.",
  },
  {
    number: "05",
    title: "Bull Markets",
    runtime: "03:37",
    summary: "What optimism reveals when every chart seems to point upward.",
  },
  {
    number: "06",
    title: "Fear & Greed",
    runtime: "03:11",
    summary: "The two oldest signals in finance—and why neither stays quiet.",
  },
];

// The LT TV lineup. A show with no episodes yet is listed in the guide as
// Coming soon. `graphics: "news"` gives a show the full chiron (headline bar,
// ticker, quote); every other show — and the lineup — wears only the logo cube.
export const SHOWS = [
  { id: "roundtable", title: "The Liminal Terminal", format: "Weekly roundtable", episodes: EPISODES },
  { id: "news", title: "LT Weekly News Recap", format: "News", graphics: "news", episodes: [] },
  { id: "morality", title: "Markets & Morality", format: "Moral philosophy", episodes: [] },
];

// `view` is 'lineup' (the LT TV landing — the set off air, channel on the
// frame's screen) or 'set' (a show on). On the lineup the primary action tunes
// in; on a show it runs the show.
export default function LTTvBroadcastPanel({
  view = "set",
  onTuneIn,
  onLeaveSet,
  audioReady,
  playing,
  voiceStatus,
  onPlay,
  onStop,
  onRetry,
}) {
  const [showId, setShowId] = useState(SHOWS[0].id);
  const [episodeIndex, setEpisodeIndex] = useState(0);
  // Open on arrival: this panel only mounts once the LT TV set is up, and the
  // production controls ARE the point of switching to it — collapsing first
  // made you click twice to reach them. Still collapsible to clear the set.
  // (The program guide opens from the show and episode titles.)
  const [collapsed, setCollapsed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(SHOWS[0].id);
  const show = SHOWS.find((s) => s.id === showId);
  const selected = show.episodes[episodeIndex];
  const loading = !audioReady && voiceStatus !== "failed";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && guideOpen) setGuideOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guideOpen]);

  const toggleGuide = () => {
    // Open on the show that's on now.
    if (!guideOpen) setExpandedId(showId);
    setGuideOpen((open) => !open);
  };

  const selectEpisode = (id, index) => {
    if (playing) onStop?.();
    setShowId(id);
    setEpisodeIndex(index);
    setGuideOpen(false);
    // Picking from the guide on the lineup is picking what to watch.
    if (view === "lineup") onTuneIn?.();
  };

  const handlePrimaryAction = () => {
    if (voiceStatus === "failed") {
      onRetry?.();
      return;
    }
    if (playing) {
      onStop?.();
      return;
    }
    onPlay?.();
  };

  // On-air graphics. Stays up when the console collapses — that's the clean
  // "watching TV" view. The full lower third is a news convention, so only a
  // news show gets it; otherwise it's just the channel's logo cube.
  const chironMode = view === "set" && show.graphics === "news" ? "news" : "logo";
  const chiron = <LTTvChiron episode={selected} mode={chironMode} />;
  const chevron = <i aria-hidden="true">{guideOpen ? "⌃" : "⌄"}</i>;

  if (collapsed) {
    return (
      <>
      {chiron}
      <aside className="ltv-collapsed" aria-label="LT TV broadcast controls">
        <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand LT TV controls">
          <span className={playing ? "is-live" : ""} />
          <b>LT TV</b>
          <small>EP {selected.number}</small>
          <i aria-hidden="true">›</i>
        </button>
        <style jsx>{styles}</style>
      </aside>
      </>
    );
  }

  return (
    <>
    {chiron}
    {/* Outside the console's stacking context so it can sit under the chiron
        (the logo cube's perspective rises past the chiron's top edge). */}
    <div className="ltv-vignette" aria-hidden="true" />
    <aside className="ltv-dashboard" aria-label="LT TV episode selection">
      {/* The channel is the masthead here; "The Liminal Terminal" umbrella
          brand belongs to the /trade page, not this tab. */}
      <div className="ltv-masthead">
        <div className="ltv-network-row">
          {view === "set" ? (
            <button type="button" className="ltv-home" onClick={onLeaveSet} aria-label="Back to the LT TV lineup">
              LT TV
            </button>
          ) : (
            <span>LT TV</span>
          )}
          <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse LT TV controls">
            ‹
          </button>
        </div>
        {/* The labelled way in — the title chevrons alone didn't read as
            controls. */}
        <button
          type="button"
          className={`ltv-guide-toggle${guideOpen ? " is-open" : ""}`}
          onClick={toggleGuide}
          aria-expanded={guideOpen}
          aria-controls="ltv-guide"
        >
          Guide
        </button>
      </div>

      {/* One heading per level — show, then episode — and each heading is
          also the way into the guide. */}
      <section className="ltv-production">
        <h2>
          <button type="button" onClick={toggleGuide} aria-expanded={guideOpen} aria-controls="ltv-guide">
            {show.title}
            {chevron}
          </button>
        </h2>
        <div className="ltv-format">{show.format}</div>

        <div className="ltv-current" aria-live="polite">
          <div className="ltv-eyebrow">EP {selected.number}</div>
          <h3>
            <button type="button" onClick={toggleGuide} aria-expanded={guideOpen} aria-controls="ltv-guide">
              {selected.title}
              {chevron}
            </button>
          </h3>
          <p>{selected.summary}</p>
          <div className="ltv-facts">
            <span><i aria-hidden="true">◷</i>{selected.runtime}</span>
            <span><i aria-hidden="true">▣</i>July 31, 2026</span>
            <span className="recorded"><i aria-hidden="true" />Recorded</span>
          </div>
        </div>

        {view === "lineup" ? (
          <button type="button" className="ltv-start" onClick={onTuneIn}>
            <span aria-hidden="true">▶</span>
            Tune in
          </button>
        ) : (
          <button
            type="button"
            className={`ltv-start ${playing ? "is-live" : ""}`}
            disabled={loading}
            onClick={handlePrimaryAction}
          >
            <span aria-hidden="true">
              {playing ? "■" : voiceStatus === "failed" ? "↻" : "▶"}
            </span>
            {loading
              ? "Loading voices…"
              : playing
                ? "Stop show"
                : voiceStatus === "failed"
                  ? "Retry signal"
                  : "Start show"}
          </button>
        )}
      </section>

      {guideOpen && (
        <section id="ltv-guide" className="ltv-guide" aria-label="Program guide">
          <h3>Program guide</h3>
          <div className="ltv-guide-list">
          {SHOWS.map((s) => {
            const latest = s.episodes[s.episodes.length - 1];
            if (!latest) {
              return (
                <div key={s.id} className="ltv-guide-show is-soon">
                  <span className="ltv-guide-name"><b>{s.title}</b><small>{s.format}</small></span>
                  <span className="ltv-guide-tag">Coming soon</span>
                </div>
              );
            }
            const open = expandedId === s.id;
            return (
              <div key={s.id}>
                <button
                  type="button"
                  className={`ltv-guide-show${open ? " is-open" : ""}`}
                  aria-expanded={open}
                  onClick={() => setExpandedId(open ? null : s.id)}
                >
                  <span className="ltv-guide-name"><b>{s.title}</b><small>{s.format}</small></span>
                  <span className="ltv-guide-tag">EP {latest.number}</span>
                </button>
                {open && (
                  <div role="listbox" aria-label={`${s.title} episodes`}>
                    {s.episodes.map((episode, index) => {
                      const active = s.id === showId && index === episodeIndex;
                      return (
                        <button
                          key={episode.number}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={active ? "is-selected" : ""}
                          onClick={() => selectEpisode(s.id, index)}
                        >
                          <span className="ltv-ep-number">{episode.number}</span>
                          <span className="ltv-ep-copy">
                            <b>{episode.title}</b>
                            <small>{episode.runtime}</small>
                          </span>
                          {active && <span className="ltv-row-play" aria-hidden="true">▶</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </section>
      )}

      <style jsx>{styles}</style>
    </aside>
    </>
  );
}

const styles = `
  .ltv-dashboard {
    --cyan: #20d7f2;
    --cyan-soft: #8feeff;
    --magenta: #ef62dc;
    --magenta-hot: #ff83eb;
    --green: #33f28a;
    --red: #ff405b;
    --ink: rgba(4, 4, 10, 0.92);
    position: fixed;
    inset: 0;
    z-index: 10040;
    color: #f7f4fa;
    font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
    pointer-events: none;
  }

  .ltv-vignette {
    position: fixed;
    z-index: 10030;
    inset: 0 auto 64px 0;
    width: min(610px, 49vw);
    pointer-events: none;
    background:
      linear-gradient(90deg, rgba(0,0,4,0.93) 0%, rgba(1,1,7,0.8) 57%, rgba(1,1,7,0.22) 84%, transparent 100%),
      linear-gradient(180deg, rgba(0,0,0,0.46), transparent 25%, transparent 77%, rgba(0,0,0,0.34));
  }

  .ltv-masthead,
  .ltv-production,
  .ltv-guide {
    pointer-events: auto;
    animation: ltv-enter 420ms cubic-bezier(.2,.72,.2,1) both;
  }

  .ltv-masthead {
    position: fixed;
    top: 28px;
    left: 32px;
    width: 270px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ltv-guide-toggle {
    height: 38px;
    padding: 0 16px;
    border: 1px solid rgba(32,215,242,.55);
    border-radius: 7px;
    background: rgba(4,14,22,.6);
    box-shadow: 0 0 12px rgba(32,215,242,.18);
    color: var(--cyan);
    font: 700 11px "Orbitron", "IBM Plex Mono", monospace;
    letter-spacing: .18em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .ltv-guide-toggle:hover,
  .ltv-guide-toggle.is-open {
    background: rgba(32,215,242,.14);
    box-shadow: 0 0 16px rgba(32,215,242,.35);
  }

  .ltv-network-row {
    display: flex;
    align-items: stretch;
    height: 38px;
    border: 1px solid var(--magenta);
    border-radius: 7px;
    background: rgba(39, 8, 44, .54);
    box-shadow: 0 0 14px rgba(239, 98, 220, .46), inset 0 0 12px rgba(239, 98, 220, .12);
    overflow: hidden;
  }

  .ltv-network-row > span,
  .ltv-network-row > .ltv-home {
    display: grid;
    place-items: center;
    min-width: 104px;
    padding-left: 5px;
    color: #ffc096;
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 18px;
    letter-spacing: .22em;
    text-shadow: 0 0 10px rgba(255, 119, 192, .7);
  }

  .ltv-network-row button {
    width: 30px;
    padding: 0;
    border: 0;
    border-left: 1px solid rgba(239,98,220,.38);
    background: rgba(0,0,0,.2);
    color: rgba(255,255,255,.65);
    font-size: 21px;
    cursor: pointer;
  }

  /* On a show, the channel name is the way back to the lineup. */
  .ltv-network-row > .ltv-home {
    width: auto;
    border: 0;
    background: none;
    font-size: 18px;
    cursor: pointer;
  }

  .ltv-network-row > .ltv-home:hover {
    color: #ffd9bd;
    text-shadow: 0 0 14px rgba(255, 119, 192, .95);
  }

  .ltv-production {
    position: fixed;
    top: 100px;
    left: 32px;
    width: 270px;
  }

  .ltv-eyebrow,
  .ltv-format {
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .ltv-eyebrow {
    color: rgba(247,244,250,.66);
    margin-bottom: 7px;
  }

  .ltv-production h2 {
    margin: 0;
    color: var(--cyan);
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 22px;
    line-height: 1.1;
    text-shadow: 0 0 15px rgba(32,215,242,.56);
  }

  /* The show and episode titles are the guide's triggers — headings that
     click, with only a chevron to say so. */
  .ltv-production h2 button,
  .ltv-current h3 button {
    display: inline;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    text-shadow: inherit;
    cursor: pointer;
  }

  .ltv-production h2 i,
  .ltv-current h3 i {
    margin-left: .35em;
    color: var(--cyan);
    font-size: .7em;
    font-style: normal;
    opacity: .75;
  }

  .ltv-production h2 button:hover i,
  .ltv-current h3 button:hover i {
    opacity: 1;
  }

  .ltv-format {
    margin: 10px 0 26px;
    color: var(--magenta);
  }

  .ltv-current h3 {
    margin: 0 0 8px;
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 18px;
    line-height: 1.15;
    text-align: left;
  }

  .ltv-current p {
    min-height: 42px;
    margin: 0;
    color: rgba(247,244,250,.63);
    font-size: 10px;
    line-height: 1.65;
    text-align: left;
  }

  .ltv-facts {
    display: flex;
    align-items: center;
    gap: 13px;
    margin: 11px 0 15px;
    color: rgba(247,244,250,.57);
    font-size: 7px;
    white-space: nowrap;
  }

  .ltv-facts span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .ltv-facts i {
    color: rgba(247,244,250,.66);
    font-style: normal;
    font-size: 11px;
  }

  .ltv-facts .recorded {
    color: rgba(108,247,167,.62);
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .ltv-facts .recorded i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 7px rgba(51,242,138,.65);
  }

  .ltv-start {
    width: 100%;
    height: 47px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border: 1px solid var(--magenta-hot);
    border-radius: 9px;
    background: linear-gradient(180deg, rgba(80,17,84,.8), rgba(11,5,19,.9));
    box-shadow: 0 0 17px rgba(239,98,220,.43), inset 0 0 16px rgba(239,98,220,.13);
    color: #fff8ff;
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .13em;
    text-transform: uppercase;
    text-shadow: 0 0 9px rgba(255,255,255,.52);
    cursor: pointer;
  }

  .ltv-start:hover:not(:disabled) {
    filter: brightness(1.15);
    box-shadow: 0 0 25px rgba(239,98,220,.58), inset 0 0 16px rgba(239,98,220,.18);
  }

  .ltv-start:disabled {
    opacity: .52;
    cursor: wait;
  }

  .ltv-start.is-live {
    border-color: var(--red);
    background: linear-gradient(180deg, rgba(101,14,37,.86), rgba(22,4,12,.92));
    box-shadow: 0 0 20px rgba(255,64,91,.38);
  }

  .ltv-guide {
    position: fixed;
    top: 100px;
    left: 320px;
    width: 254px;
    padding: 16px 14px 13px;
    border: 1px solid rgba(123,155,186,.25);
    border-radius: 5px;
    background: linear-gradient(180deg, rgba(7,7,18,.93), rgba(3,3,10,.88));
    box-shadow: 0 20px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .ltv-guide::before,
  .ltv-guide::after {
    content: "";
    position: absolute;
    width: 12px;
    height: 12px;
    border-top: 1px solid rgba(123,155,186,.25);
    border-right: 1px solid rgba(123,155,186,.25);
    background: rgba(7,7,18,.93);
  }

  .ltv-guide::before { top: 5px; right: -7px; }
  .ltv-guide::after { bottom: 5px; left: -7px; transform: rotate(180deg); }

  .ltv-guide > h3 {
    margin: 0 5px 12px;
    color: var(--cyan);
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  /* Scrolls inside the frame (not the frame itself, which would clip its
     corner tabs) once the lineup outgrows the space above the chiron. */
  .ltv-guide-list {
    max-height: calc(100vh - 340px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .ltv-guide-show {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 8px 8px 9px;
    border: 0;
    border-left: 2px solid transparent;
    border-top: 1px solid rgba(123,155,186,.14);
    background: transparent;
    color: #f8f5fa;
    text-align: left;
    cursor: pointer;
  }

  button.ltv-guide-show:hover {
    background: rgba(32,215,242,.06);
  }

  .ltv-guide-show.is-open {
    border-left-color: var(--cyan);
    background: rgba(32,215,242,.07);
  }

  .ltv-guide-show.is-soon {
    cursor: default;
    opacity: .55;
  }

  .ltv-guide-name {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ltv-guide-name b {
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 9px;
    font-weight: 700;
  }

  .ltv-guide-show.is-open .ltv-guide-name b {
    color: var(--cyan);
  }

  .ltv-guide-name small {
    color: rgba(247,244,250,.5);
    font-size: 7px;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .ltv-guide-tag {
    flex: none;
    color: rgba(247,244,250,.6);
    font-family: "Orbitron", monospace;
    font-size: 8px;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .ltv-guide [role="listbox"] {
    display: grid;
    gap: 2px;
    padding: 4px 0 8px 10px;
  }

  .ltv-guide [role="option"] {
    width: 100%;
    min-height: 43px;
    display: grid;
    grid-template-columns: 31px 1fr 14px;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: rgba(247,244,250,.76);
    text-align: left;
    cursor: pointer;
  }

  .ltv-guide [role="option"]:hover {
    background: rgba(32,215,242,.06);
  }

  .ltv-guide [role="option"].is-selected {
    border-color: rgba(239,98,220,.72);
    background: linear-gradient(90deg, rgba(63,12,68,.72), rgba(19,7,29,.82));
    box-shadow: 0 0 12px rgba(239,98,220,.25), inset 0 0 10px rgba(239,98,220,.08);
  }

  .ltv-ep-number {
    color: var(--cyan);
    font-family: "Orbitron", monospace;
    font-size: 11px;
  }

  .ltv-ep-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ltv-ep-copy b {
    overflow: hidden;
    color: #f8f5fa;
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 8px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ltv-ep-copy small {
    color: rgba(247,244,250,.45);
    font-size: 7px;
  }

  .ltv-row-play {
    color: #fff;
    font-size: 9px;
    filter: drop-shadow(0 0 5px rgba(239,98,220,.7));
  }

  .ltv-collapsed {
    --cyan: #20d7f2;
    position: fixed;
    z-index: 10040;
    top: 50%;
    left: 13px;
    transform: translateY(-50%);
  }

  .ltv-collapsed button {
    width: 42px;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 13px 8px;
    border: 1px solid rgba(32,215,242,.37);
    border-left: 2px solid var(--cyan);
    border-radius: 0 6px 6px 0;
    background: rgba(4,6,12,.88);
    box-shadow: 0 0 17px rgba(32,215,242,.13);
    color: var(--cyan);
    cursor: pointer;
    backdrop-filter: blur(12px);
  }

  .ltv-collapsed button > span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #33f28a;
    box-shadow: 0 0 7px rgba(51,242,138,.65);
  }

  .ltv-collapsed button > span.is-live { background: #ff405b; }
  .ltv-collapsed b { writing-mode: vertical-rl; transform: rotate(180deg); font: 800 9px "Orbitron", monospace; letter-spacing: .2em; }
  .ltv-collapsed small { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 7px; }
  .ltv-collapsed i { font-size: 20px; font-style: normal; }

  button:focus-visible {
    outline: 2px solid #b8f7ff;
    outline-offset: 2px;
  }

  @keyframes ltv-enter {
    from { opacity: 0; translate: -10px 0; }
    to { opacity: 1; translate: 0 0; }
  }

  @media (max-width: 1100px) {
    .ltv-vignette { width: 540px; }
    .ltv-masthead { left: 20px; width: 240px; }
    .ltv-production { left: 20px; width: 240px; }
    .ltv-guide { left: 276px; width: 224px; }
  }

  /* No room beside the column — the guide opens over it instead. */
  @media (max-width: 900px) {
    .ltv-masthead { width: 270px; }
    .ltv-guide { left: 20px; width: 270px; }
    .ltv-guide::before,
    .ltv-guide::after { display: none; }
    .ltv-vignette { width: 340px; }
    .ltv-production { width: 270px; }
  }

  @media (max-height: 690px) {
    .ltv-masthead { top: 14px; transform: scale(.9); transform-origin: top left; }
    .ltv-production { top: 84px; transform: scale(.9); transform-origin: top left; }
    .ltv-guide { top: 84px; transform: scale(.9); transform-origin: top left; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ltv-masthead,
    .ltv-production,
    .ltv-guide {
      animation: none;
    }
  }
`;
