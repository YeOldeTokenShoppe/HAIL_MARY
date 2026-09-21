"use client";

import React, { useEffect, useRef, useState } from "react";
import LTTvChiron from "@/components/trade/LTTvChiron";
import useNewEpisodes from "@/components/trade/useNewEpisodes";
import { SHOWS } from "@/content/lt-tv";

// THE SLATE IS DATA. Both the shows and their episodes come from
// src/content/lt-tv — one JSON record per episode, the same record the set
// plays — so the guide and the performance can't disagree about what an
// episode is. Re-exported here because the mobile LT TV screen and the /trade
// page already import them from this module.
export { EPISODES, SHOWS } from "@/content/lt-tv";

// `view` is 'lineup' (the LT TV landing — the set off air, channel on the
// frame's screen) or 'set' (a show on). On the lineup the primary action tunes
// in; on a show it runs the show.
export default function LTTvBroadcastPanel({
  view = "set",
  onTuneIn,
  showId = SHOWS[0].id,
  episodeIndex = 0,
  onSelectEpisode,
  onLeaveSet,
  audioReady,
  playing,
  voiceStatus,
  onPlay,
  onStop,
  onRetry,
}) {
  // Open on arrival; playback collapses the console to clear the set.
  const [collapsed, setCollapsed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(SHOWS[0].id);
  const { isNew, showHasNew } = useNewEpisodes();
  const somethingIsNew = SHOWS.some(showHasNew);
  const guideButtonRef = useRef(null);
  const guideRef = useRef(null);
  const episodesButtonRef = useRef(null);
  const expandButtonRef = useRef(null);
  const primaryButtonRef = useRef(null);
  const show = SHOWS.find((s) => s.id === showId) || SHOWS[0];
  const hasEpisode = show.episodes.length > 0;
  const selected = show.episodes[episodeIndex] || show.episodes[0] || {
    number: "—", title: "News studio preview",
    summary: "Take a look around the news set. Episodes are coming soon.",
  };
  // `playable` comes off the record: a slate entry with no recording yet says
  // so instead of quietly replaying whichever episode the set had loaded.
  const canPlay = hasEpisode && selected.playable !== false;
  const loading = !audioReady && voiceStatus !== "failed";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && guideOpen) {
        setGuideOpen(false);
        guideButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guideOpen]);

  useEffect(() => {
    if (!guideOpen) return;
    const dismissOutside = (event) => {
      if (guideRef.current?.contains(event.target) || guideButtonRef.current?.contains(event.target) || episodesButtonRef.current?.contains(event.target)) return;
      setGuideOpen(false);
    };
    // Capture also catches interactions with the 3D canvas that stop bubbling.
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [guideOpen]);

  // Playback collapses the console to clear the set; the end of the show puts
  // it back, because what a viewer wants the moment the credits stop is the
  // guide — not a collapsed tab to find first. Only on the TRANSITION out of
  // playing, so a console the viewer collapsed by hand while nothing was on
  // stays collapsed.
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (playing) {
      setGuideOpen(false);
      setCollapsed(true);
    } else if (wasPlayingRef.current) {
      setCollapsed(false);
      // The expand tab is what had focus while the show ran, and it is about
      // to unmount — hand focus to the control that replaces it rather than
      // dropping it on the body.
      requestAnimationFrame(() => primaryButtonRef.current?.focus());
    }
    wasPlayingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (collapsed && playing) expandButtonRef.current?.focus();
  }, [collapsed, playing]);

  const toggleGuide = () => {
    // Open on the show that's on now.
    if (!guideOpen) setExpandedId(showId);
    setGuideOpen((open) => !open);
  };

  const selectEpisode = (id, index) => {
    if (playing) onStop?.();
    onSelectEpisode?.(id, index);
    setGuideOpen(false);
    // Preview the selection before the explicit studio-entry action.
    guideButtonRef.current?.focus();
  };

  const handlePrimaryAction = () => {
    setGuideOpen(false);
    if (!hasEpisode) return;
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
  const chiron = view === "set" && hasEpisode ? <LTTvChiron episode={selected} mode={chironMode} status="Replay" /> : null;

  if (collapsed) {
    return (
      <>
      {chiron}
      <aside className="ltv-collapsed" aria-label="LT TV broadcast controls">
        <button ref={expandButtonRef} type="button" onClick={() => { setCollapsed(false); requestAnimationFrame(() => primaryButtonRef.current?.focus()); }} aria-label="Expand LT TV controls">
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
      {/* Channel identity and one explicit program-guide entry point. */}
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

        <button
          ref={guideButtonRef}
          type="button"
          className={`ltv-guide-toggle${guideOpen ? " is-open" : ""}`}
          aria-label={somethingIsNew ? "Browse programs — new episode" : undefined}
          onClick={toggleGuide}
          aria-expanded={guideOpen}
          aria-controls="ltv-guide"
        >
          Browse programs
          {/* The whole point of the badge is to be visible WITHOUT opening the
              guide, so the entry point carries a dot when anything inside it
              is new. The label says so for a screen reader, which cannot see
              a dot. */}
          {somethingIsNew && <i className="ltv-new-dot" aria-hidden="true" />}
        </button>
      </div>

      <section className="ltv-production">
        <h2>{show.title}</h2>
        <div className="ltv-format">
          <span>{show.format}</span>
          {hasEpisode && <><span>{show.episodes.length} episodes</span><span className="ltv-replay">Replay</span></>}
        </div>

        <div className="ltv-current" aria-live="polite">
          <div className="ltv-eyebrow">{!hasEpisode ? "Studio preview"
            : `Episode ${selected.number} · ${selected.runtime || "Not recorded yet"}`}</div>
          <h3>{selected.title}</h3>
          <p>{selected.summary}</p>

        </div>

        <div className="ltv-actions">
        {view === "lineup" ? (
          <button ref={primaryButtonRef} type="button" className="ltv-start" onClick={() => { setGuideOpen(false); onTuneIn?.(); }}>
            <span aria-hidden="true">▶</span>
            Enter studio
          </button>
        ) : (
          <button
            ref={primaryButtonRef}
            type="button"
            className={`ltv-start ${playing ? "is-live" : ""}`}
            disabled={loading || !canPlay}
            onClick={handlePrimaryAction}
          >
            <span aria-hidden="true">
              {playing ? "■" : voiceStatus === "failed" ? "↻" : "▶"}
            </span>
            {!hasEpisode ? "Episodes coming soon" : !canPlay ? "Not recorded yet" : loading
              ? "Preparing studio…"
              : playing
                ? "Stop episode"
                : voiceStatus === "failed"
                  ? "Retry signal"
                  : "Play episode"}
          </button>
        )}
        {hasEpisode && <button ref={episodesButtonRef} type="button" className="ltv-episodes"
          onClick={toggleGuide} aria-expanded={guideOpen} aria-controls="ltv-guide">
          Episodes <span aria-hidden="true">⌄</span>
        </button>}
        </div>
        {view === "lineup" && <p className="ltv-entry-note">Explore the set, then start the show.</p>}
      </section>

      {guideOpen && (
        <section ref={guideRef} id="ltv-guide" className="ltv-guide" aria-label="Program guide">
          <h3>Program guide</h3>
          <div className="ltv-guide-list">
          {SHOWS.map((s) => {
            const latest = s.episodes[s.episodes.length - 1];
            if (!latest && s.id === "news") {
              return (
                <button key={s.id} type="button" className="ltv-guide-show"
                  onClick={() => { selectEpisode(s.id, 0); onTuneIn?.(); }}>
                  <span className="ltv-guide-name"><b>{s.title}</b><small>Episodes coming soon</small></span>
                  <span className="ltv-guide-tag">Preview studio</span>
                </button>
              );
            }
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
                  <span className="ltv-guide-name">
                    <b>{s.title}{showHasNew(s) && <em className="ltv-new">New</em>}</b>
                    <small>{s.format}</small>
                  </span>
                  <span className="ltv-guide-tag">EP {latest.number}</span>
                </button>
                {open && (
                  <div role="group" aria-label={`${s.title} episodes`}>
                    {s.episodes.map((episode, index) => {
                      const active = s.id === showId && index === episodeIndex;
                      return (
                        <button
                          key={episode.number}
                          type="button"
                          aria-pressed={active}
                          className={active ? "is-selected" : ""}
                          onClick={() => selectEpisode(s.id, index)}
                        >
                          <span className="ltv-ep-number">{episode.number}</span>
                          <span className="ltv-ep-copy">
                            <b>{episode.title}{isNew(episode) && <em className="ltv-new">New</em>}</b>
                            <small>{episode.runtime || "Not recorded yet"}</small>
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
    --cyan: #20d7f2; --magenta: #ef62dc;
    position: fixed; inset: 0; z-index: 10040; color: #f7f4fa;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: none;
  }
  .ltv-dashboard *, .ltv-dashboard *::before { box-sizing: border-box; }
  .ltv-vignette {
    position: fixed; z-index: 10030; inset: 0 auto 64px 0;
    width: min(590px, 48vw); pointer-events: none;
    background: linear-gradient(90deg, rgba(0,0,4,.95), rgba(0,0,4,.78) 54%, rgba(0,0,4,.24) 80%, transparent);
  }
  .ltv-masthead, .ltv-production, .ltv-guide { pointer-events: auto; }
  .ltv-masthead {
    position: fixed; top: 28px; left: 32px; width: 340px;
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
  }
  .ltv-network-row { display: flex; align-items: center; height: 36px; }
  .ltv-network-row > span, .ltv-network-row > .ltv-home {
    color: #ffc096; font: 500 17px "Orbitron", sans-serif; letter-spacing: .19em;
    white-space: nowrap; text-shadow: 0 0 12px rgba(239,98,220,.35);
  }
  .ltv-network-row button { border: 0; background: transparent; cursor: pointer; }
  .ltv-network-row > .ltv-home { padding: 0; }
  .ltv-network-row > button:last-child { color: #a8a5af; font-size: 24px; padding: 0 10px; margin-left: 8px; }
  .ltv-guide-toggle {
    min-height: 36px; padding: 0 10px; border: 1px solid rgba(255,255,255,.18);
    border-radius: 5px; background: rgba(255,255,255,.04); color: #dad8e0;
    font: 500 12px "Inter", sans-serif; cursor: pointer; white-space: nowrap;
    display: inline-flex; align-items: center; gap: 7px;
  }
  .ltv-guide-toggle:hover, .ltv-guide-toggle.is-open { color: #fff; border-color: var(--cyan); }
  .ltv-new-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--magenta); box-shadow: 0 0 7px rgba(239,98,220,.8); }
  /* The badge rides inside the title so it wraps with it rather than pushing
     the row's layout around. */
  .ltv-new {
    display: inline-block; margin-left: 8px; padding: 2px 6px; border-radius: 3px;
    background: var(--magenta); color: #1b0716; vertical-align: 2px;
    font: 700 9px/1.4 "Inter", sans-serif; font-style: normal; letter-spacing: .09em; text-transform: uppercase;
  }
  .ltv-production { position: fixed; top: 112px; left: 32px; width: 340px; max-height: calc(100dvh - 210px); overflow-y: auto; }
  .ltv-production h2 { margin: 0; color: var(--cyan); font: 700 30px/1.22 "Orbitron", sans-serif; letter-spacing: -.035em; text-wrap: balance; }
  .ltv-format { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 10px; margin: 16px 0 28px; color: #b9b6c2; font-size: 12px; line-height: 1.5; }
  .ltv-format > span + span::before { content: "·"; color: #6e687b; margin-right: 10px; }
  .ltv-format .ltv-replay { color: var(--magenta); }
  .ltv-eyebrow { color: #a9a5b2; font-size: 12px; margin-bottom: 7px; }
  .ltv-current h3 { margin: 0 0 10px; font: 650 21px/1.3 "Inter", sans-serif; text-align: left; letter-spacing: -.02em; }
  .ltv-current p { margin: 0; color: #c9c6d0; font-size: 14px; line-height: 1.65; text-align: left; }
  .ltv-actions { display: flex; gap: 10px; margin-top: 23px; align-items: stretch; }
  .ltv-start, .ltv-episodes { min-height: 44px; border-radius: 5px; border: 0; padding: 11px 16px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; font: 650 14px/1.3 "Inter", sans-serif; cursor: pointer; }
  .ltv-start { flex: 1; background: #f7f4fa; color: #131019; }
  .ltv-start > span { font-size: 12px; }
  .ltv-start:hover:not(:disabled) { background: #dfdce5; }
  .ltv-start:disabled { opacity: .5; cursor: default; }
  .ltv-start.is-live { background: #f3d6e0; color: #651e35; }
  .ltv-episodes { background: rgba(255,255,255,.13); color: #f7f4fa; }
  .ltv-episodes:hover, .ltv-episodes[aria-expanded="true"] { background: rgba(255,255,255,.23); }
  .ltv-entry-note { margin: 12px 0 0; color: #96919f; font-size: 12px; line-height: 1.5; }
  .ltv-guide { position: fixed; top: 100px; left: 396px; width: 340px; padding: 20px 16px 14px; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; background: rgba(13,12,19,.97); box-shadow: 0 18px 60px rgba(0,0,0,.55); }
  .ltv-guide > h3 { margin: 0 8px 16px; color: #fff; font-size: 18px; font-weight: 650; }
  .ltv-guide-list { max-height: calc(100dvh - 230px); overflow-y: auto; overscroll-behavior: contain; }
  .ltv-guide-show { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 8px; border: 0; border-top: 1px solid rgba(255,255,255,.1); background: transparent; color: #f7f4fa; text-align: left; cursor: pointer; }
  button.ltv-guide-show:hover { background: rgba(255,255,255,.06); }
  .ltv-guide-show.is-open .ltv-guide-name b { color: var(--cyan); }
  .ltv-guide-show.is-soon { cursor: default; opacity: .5; }
  .ltv-guide-name { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .ltv-guide-name b { font: 600 14px/1.35 "Inter", sans-serif; }
  .ltv-guide-name small, .ltv-guide-tag { color: #aba6b7; font: 400 11px/1.4 "Inter", sans-serif; }
  .ltv-guide-tag { flex: none; max-width: 82px; text-align: right; }
  .ltv-guide [role="group"] { display: grid; gap: 3px; padding: 2px 0 12px; }
  .ltv-guide [aria-pressed] { width: 100%; min-height: 51px; display: grid; grid-template-columns: 28px 1fr 14px; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: #ccc7d6; text-align: left; cursor: pointer; }
  .ltv-guide [aria-pressed]:hover { background: rgba(255,255,255,.07); }
  .ltv-guide [aria-pressed].is-selected { border-left-color: var(--magenta); background: rgba(239,98,220,.1); }
  .ltv-ep-number { color: #a29aaf; font-size: 12px; }
  .ltv-ep-copy { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .ltv-ep-copy b { color: #f7f4fa; font: 500 13px/1.3 "Inter", sans-serif; }
  .ltv-ep-copy small { color: #a29aaf; font-size: 11px; }
  .ltv-row-play { color: var(--magenta); font-size: 10px; }
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
  .ltv-collapsed small { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; }
  .ltv-collapsed i { font-size: 20px; font-style: normal; }


  button:focus-visible { outline: 2px solid #8feeff; outline-offset: 3px; }
  @media (max-width: 1100px) {
    .ltv-masthead, .ltv-production { left: 24px; width: 310px; }
    .ltv-production h2 { font-size: 27px; }
    .ltv-guide { left: 354px; width: 310px; }
  }
  @media (max-width: 900px) {
    .ltv-guide { left: 24px; top: 78px; width: min(340px, calc(100vw - 48px)); }
    .ltv-vignette { width: 380px; max-width: 80vw; }
  }
  @media (max-width: 380px) {
    .ltv-masthead, .ltv-production { left: 16px; width: calc(100vw - 32px); }
  }
  @media (max-height: 690px) {
    .ltv-masthead { top: 16px; }
    .ltv-production { top: 82px; max-height: calc(100dvh - 170px); }
    .ltv-format { margin-bottom: 18px; }
    .ltv-guide { top: 74px; }
  }
`;
