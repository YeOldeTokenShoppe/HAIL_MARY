"use client";

import React, { useEffect, useState } from "react";

const EPISODES = [
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

export default function LTTvBroadcastPanel({
  audioReady,
  playing,
  voiceStatus,
  onPlay,
  onStop,
  onRetry,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Let the studio set make the first impression. The production controls
  // expand on demand, and the episode rack opens separately from its selector.
  const [collapsed, setCollapsed] = useState(true);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const selected = EPISODES[selectedIndex];
  const loading = !audioReady && voiceStatus !== "failed";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && episodesOpen) setEpisodesOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [episodesOpen]);

  const selectEpisode = (index) => {
    if (playing) onStop?.();
    setSelectedIndex(index);
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

  if (collapsed) {
    return (
      <aside className="ltv-collapsed" aria-label="LT TV broadcast controls">
        <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand LT TV controls">
          <span className={playing ? "is-live" : ""} />
          <b>LT TV</b>
          <small>EP {selected.number}</small>
          <i aria-hidden="true">›</i>
        </button>
        <style jsx>{styles}</style>
      </aside>
    );
  }

  return (
    <aside className="ltv-dashboard" aria-label="LT TV episode selection">
      <div className="ltv-vignette" aria-hidden="true" />

      <div
        className="ltv-masthead"
        style={{ top: 26, left: 46, width: "auto" }}
      >
        <div className="ltv-showmark" aria-label="The Liminal Terminal">
                <span className="title-line" style={{ display: '', position: 'relative', marginLeft: "-1.0rem" }}>The</span>
          <strong>Liminal</strong>
          <strong>Terminal</strong>
        </div>
        <div className="ltv-network-lockup">
          <div className="ltv-network-row">
            <span>LT TV</span>
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse LT TV controls">
              ‹
            </button>
          </div>
          <p>{selected.title}</p>
        </div>
      </div>

      <section className="ltv-production">
        <div className="ltv-eyebrow">Current production</div>
        <h2>The Liminal Terminal</h2>
        <div className="ltv-format">Weekly roundtable</div>

        <label>Episode</label>
        <button
          type="button"
          className="ltv-select"
          onClick={() => setEpisodesOpen((open) => !open)}
          aria-expanded={episodesOpen}
          aria-controls="ltv-episode-rack"
        >
          <span>Episode {selected.number}</span>
          <i aria-hidden="true">{episodesOpen ? "⌃" : "⌄"}</i>
        </button>

        <div className="ltv-current" aria-live="polite">
          <h3>{selected.title}</h3>
          <p>{selected.summary}</p>
          <div className="ltv-facts">
            <span><i aria-hidden="true">◷</i>{selected.runtime}</span>
            <span><i aria-hidden="true">▣</i>July 31, 2026</span>
            <span className="recorded"><i aria-hidden="true" />Recorded</span>
          </div>
        </div>

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

        <div className={`ltv-ready ${playing ? "is-live" : ""}`}>
          <span aria-hidden="true">{playing ? "●" : "≋"}</span>
          {playing
            ? "Broadcasting now"
            : voiceStatus === "failed"
              ? "Signal interrupted"
              : audioReady
                ? "Ready to broadcast"
                : "Preparing broadcast"}
        </div>
      </section>

      {episodesOpen && (
        <section id="ltv-episode-rack" className="ltv-episode-rack" aria-label="Episodes">
          <h3>Episodes</h3>
          <div role="listbox" aria-label="Episode archive">
            {EPISODES.map((episode, index) => {
              const active = selectedIndex === index;
              return (
                <button
                  key={episode.number}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? "is-selected" : ""}
                  onClick={() => selectEpisode(index)}
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
          <button type="button" className="ltv-archive" onClick={() => setEpisodesOpen(false)}>
            <span aria-hidden="true">▣</span>
            Browse archive
          </button>
        </section>
      )}

      <div className="ltv-live-badge" aria-label={`Live, episode ${selected.number}, season 1`}>
        <strong><span /> Live</strong>
        <small>EP {selected.number} / S01</small>
      </div>

      <section className="ltv-broadcast-status" aria-label="Broadcast status">
        <header>
          <span>Broadcast status</span>
          <span className="ltv-rec"><i /> Rec</span>
        </header>
        <dl>
          <div><dt>Studio</dt><dd>LT talk set</dd></div>
          <div><dt>Camera</dt><dd>Cam 01</dd></div>
          <div><dt>Audio</dt><dd>Live mix</dd></div>
          <div><dt>Status</dt><dd className={playing ? "on-air" : ""}>{playing ? "On air" : "Ready"}</dd></div>
        </dl>
      </section>

      <style jsx>{styles}</style>
    </aside>
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
    inset: 0 auto 64px 0;
    width: min(610px, 49vw);
    pointer-events: none;
    background:
      linear-gradient(90deg, rgba(0,0,4,0.93) 0%, rgba(1,1,7,0.8) 57%, rgba(1,1,7,0.22) 84%, transparent 100%),
      linear-gradient(180deg, rgba(0,0,0,0.46), transparent 25%, transparent 77%, rgba(0,0,0,0.34));
  }

  .ltv-masthead,
  .ltv-production,
  .ltv-episode-rack,
  .ltv-broadcast-status,
  .ltv-live-badge {
    pointer-events: auto;
    animation: ltv-enter 420ms cubic-bezier(.2,.72,.2,1) both;
  }

  .ltv-masthead {
    position: fixed;
    top: 30px;
    left: 52px;
    display: flex;
    align-items: center;
    gap: 34px;
  }

  .ltv-showmark {
    position: relative;
    width: 158px;
    color: #fff9dc;
    filter: drop-shadow(0 0 10px rgba(255,222,123,.62));
    font-family: "UnifrakturCook", "UnifrakturMaguntia", Georgia, serif;
    line-height: .73;
    transform: rotate(-4deg);
  }

  .ltv-showmark span {
    position: absolute;
    top: -5px;
    left: 10px;
    font-size: 14px;
  }

  .ltv-showmark strong {
    display: block;
    font-size: 35px;
    font-weight: 900;
  }

  .ltv-showmark strong:last-child {
    margin-left: 23px;
  }

  .ltv-network-lockup {
    padding-top: 2px;
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

  .ltv-network-row > span {
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

  .ltv-network-lockup p {
    margin: 10px 0 0;
    color: rgba(244,235,248,.58);
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .15em;
    text-transform: uppercase;
  }

  .ltv-production {
    position: fixed;
    top: 144px;
    left: 32px;
    width: 270px;
  }

  .ltv-eyebrow,
  .ltv-production > label,
  .ltv-format {
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .ltv-eyebrow {
    color: rgba(247,244,250,.66);
    margin-bottom: 15px;
  }

  .ltv-production h2 {
    margin: 0;
    color: var(--cyan);
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 22px;
    line-height: 1.1;
    text-shadow: 0 0 15px rgba(32,215,242,.56);
  }

  .ltv-format {
    margin: 10px 0 26px;
    color: var(--magenta);
  }

  .ltv-production > label {
    display: block;
    margin-bottom: 8px;
    color: rgba(247,244,250,.7);
  }

  .ltv-select {
    width: 100%;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 13px;
    border: 1px solid rgba(32,215,242,.45);
    border-radius: 6px;
    background: linear-gradient(90deg, rgba(6,11,20,.92), rgba(7,7,15,.8));
    box-shadow: 0 0 13px rgba(32,215,242,.09), inset 0 0 9px rgba(32,215,242,.04);
    color: #f9f5fb;
    font: 700 11px "IBM Plex Mono", monospace;
    cursor: pointer;
  }

  .ltv-select i {
    color: var(--cyan);
    font-style: normal;
    font-size: 18px;
    line-height: 1;
  }

  .ltv-current h3 {
    margin: 17px 0 8px;
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

  .ltv-ready {
    margin-top: 10px;
    color: var(--green);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .1em;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(51,242,138,.3);
  }

  .ltv-ready span {
    margin-right: 6px;
  }

  .ltv-ready.is-live {
    color: #ff6d82;
  }

  .ltv-episode-rack {
    position: fixed;
    top: 167px;
    left: 320px;
    width: 254px;
    min-height: 372px;
    padding: 16px 14px 13px;
    border: 1px solid rgba(123,155,186,.25);
    border-radius: 5px;
    background: linear-gradient(180deg, rgba(7,7,18,.93), rgba(3,3,10,.88));
    box-shadow: 0 20px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .ltv-episode-rack::before,
  .ltv-episode-rack::after {
    content: "";
    position: absolute;
    width: 12px;
    height: 12px;
    border-top: 1px solid rgba(123,155,186,.25);
    border-right: 1px solid rgba(123,155,186,.25);
    background: rgba(7,7,18,.93);
  }

  .ltv-episode-rack::before { top: 5px; right: -7px; }
  .ltv-episode-rack::after { bottom: 5px; left: -7px; transform: rotate(180deg); }

  .ltv-episode-rack > h3 {
    margin: 0 5px 12px;
    color: var(--cyan);
    font-family: "Orbitron", "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .ltv-episode-rack [role="listbox"] {
    display: grid;
    gap: 2px;
  }

  .ltv-episode-rack [role="option"] {
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

  .ltv-episode-rack [role="option"]:hover {
    background: rgba(32,215,242,.06);
  }

  .ltv-episode-rack [role="option"].is-selected {
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

  .ltv-archive {
    width: 100%;
    height: 36px;
    margin-top: 10px;
    border: 1px solid rgba(32,215,242,.28);
    border-radius: 5px;
    background: rgba(4,10,18,.65);
    color: rgba(32,215,242,.78);
    font: 800 8px "Orbitron", "IBM Plex Mono", monospace;
    letter-spacing: .11em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .ltv-archive span { margin-right: 7px; }

  .ltv-live-badge {
    position: fixed;
    top: 34px;
    right: 68px;
    min-width: 114px;
    padding: 8px 12px;
    border: 1px solid rgba(239,98,220,.74);
    border-radius: 6px;
    background: rgba(9,6,16,.74);
    box-shadow: 0 0 14px rgba(239,98,220,.33), inset 0 0 10px rgba(239,98,220,.06);
    text-align: center;
    backdrop-filter: blur(8px);
  }

  .ltv-live-badge strong,
  .ltv-live-badge small {
    display: block;
    font-family: "Orbitron", monospace;
    text-transform: uppercase;
  }

  .ltv-live-badge strong {
    color: #ffbd9a;
    font-size: 11px;
    letter-spacing: .14em;
  }

  .ltv-live-badge strong span {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin: 0 7px 1px 0;
    border-radius: 50%;
    background: var(--red);
    box-shadow: 0 0 7px rgba(255,64,91,.8);
    animation: ltv-pulse 1.5s ease-in-out infinite;
  }

  .ltv-live-badge small {
    margin-top: 5px;
    color: var(--cyan-soft);
    font-size: 8px;
    letter-spacing: .1em;
  }

  .ltv-broadcast-status {
    position: fixed;
    left: 26px;
    bottom: 73px;
    width: 300px;
    padding: 11px 13px 12px;
    border: 1px solid rgba(32,215,242,.19);
    border-radius: 5px;
    background: rgba(3,4,10,.85);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
    backdrop-filter: blur(10px);
  }

  .ltv-broadcast-status header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    color: rgba(32,215,242,.77);
    font: 800 8px "Orbitron", monospace;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .ltv-rec {
    color: rgba(255,77,110,.72);
  }

  .ltv-rec i {
    display: inline-block;
    width: 5px;
    height: 5px;
    margin-right: 4px;
    border-radius: 50%;
    background: var(--red);
    box-shadow: 0 0 5px var(--red);
  }

  .ltv-broadcast-status dl {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr .8fr;
    gap: 10px;
    margin: 0;
  }

  .ltv-broadcast-status dt,
  .ltv-broadcast-status dd {
    margin: 0;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .ltv-broadcast-status dt {
    color: rgba(247,244,250,.43);
    font-size: 7px;
    letter-spacing: .1em;
  }

  .ltv-broadcast-status dd {
    margin-top: 3px;
    color: rgba(247,244,250,.72);
    font-size: 8px;
  }

  .ltv-broadcast-status dl > div:last-child dd {
    color: var(--green);
  }

  .ltv-broadcast-status dd.on-air {
    color: #ff6d82;
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

  @keyframes ltv-pulse {
    0%,100% { opacity:.55; }
    50% { opacity:1; }
  }

  @media (max-width: 1100px) {
    .ltv-vignette { width: 540px; }
    .ltv-masthead { left: 40px; }
    .ltv-production { left: 20px; width: 240px; }
    .ltv-episode-rack { left: 276px; width: 224px; }
    .ltv-broadcast-status { left: 20px; }
  }

  @media (max-width: 900px) {
    .ltv-episode-rack { display: none; }
    .ltv-vignette { width: 340px; }
    .ltv-production { width: 270px; }
    .ltv-live-badge { right: 58px; }
  }

  @media (max-height: 690px) {
    .ltv-masthead { top: 14px; transform: scale(.9); transform-origin: top left; }
    .ltv-production { top: 122px; transform: scale(.9); transform-origin: top left; }
    .ltv-episode-rack { top: 142px; transform: scale(.9); transform-origin: top left; }
    .ltv-broadcast-status { transform: scale(.9); transform-origin: bottom left; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ltv-masthead,
    .ltv-production,
    .ltv-episode-rack,
    .ltv-broadcast-status,
    .ltv-live-badge,
    .ltv-live-badge strong span {
      animation: none;
    }
  }
`;
