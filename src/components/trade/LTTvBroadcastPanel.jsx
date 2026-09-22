"use client";

import React, { useEffect, useRef, useState } from "react";
import LTTvChiron from "@/components/trade/LTTvChiron";
import useNewEpisodes from "@/components/trade/useNewEpisodes";
import useTalkShowTransport, { clockTime } from "@/components/trade/useTalkShowTransport";
import LTTvReactions, { useEpisodeReactions } from "@/components/trade/LTTvReactions";
import { peekSignInReturn } from "@/lib/ltTvReactions";
import { ratingSummary } from "@/lib/ltTv/reactions.mjs";
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
  // Which part of the show is on air, from the set — it owns the clock. Null
  // until an episode with chapters is playing; the chiron falls back to the
  // episode's own headline.
  chapter = null,
}) {
  // Open on arrival; playback collapses the console to clear the set.
  const [collapsed, setCollapsed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // The second sheet: what viewers made of the episode. Only one sheet is open
  // at a time — they come out of the same corner and would sit on top of each
  // other otherwise.
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(SHOWS[0].id);
  const { isNew, showHasNew } = useNewEpisodes();
  const somethingIsNew = SHOWS.some(showHasNew);
  const guideButtonRef = useRef(null);
  const guideRef = useRef(null);
  const episodesButtonRef = useRef(null);
  const reactionsRef = useRef(null);
  const reactionsButtonRef = useRef(null);
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
  // Fetched here rather than inside the panel, so the button can say what the
  // crowd thinks before anyone opens it — and so the panel, when it does open,
  // uses the same numbers instead of asking for them again.
  const reactions = useEpisodeReactions(selected.id);
  const tallySummary = ratingSummary(reactions.stats);
  const loading = !audioReady && voiceStatus !== "failed";

  // WHAT THE TRANSPORT CAN AND CANNOT OFFER, because the viewer should not be
  // shown a control the player does not have. SitePal pauses exactly
  // (freezeToggle holds speech and resumes from that point) but cannot start a
  // clip anywhere but its beginning — and an episode over 90 seconds is
  // already several clips, because SitePal refuses one longer than that. So
  // the bar below is drawn as the parts it really is, and a click lands on the
  // start of one. See the note in TalkShowScene where the calls are made.
  const onAir = view === "set" && playing;
  const { status, toggle, step, seek } = useTalkShowTransport(onAir);
  const paused = status.paused;
  const starts = status.sectionStarts?.length ? status.sectionStarts : [0];
  const parts = starts.map((startsAt, index) => {
    const endsAt = starts[index + 1] ?? Math.max(startsAt, status.duration);
    return { index, startsAt, endsAt, seconds: Math.max(1, endsAt - startsAt) };
  });
  const partFill = (part) => {
    if (status.elapsed >= part.endsAt) return 100;
    if (status.elapsed <= part.startsAt) return 0;
    return ((status.elapsed - part.startsAt) / (part.endsAt - part.startsAt)) * 100;
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && reactionsOpen) {
        setReactionsOpen(false);
        reactionsButtonRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && guideOpen) {
        setGuideOpen(false);
        guideButtonRef.current?.focus();
        return;
      }
      // The keys a viewer reaches for without being told. Never while typing,
      // and never with a modifier held — those belong to the browser.
      if (!onAir || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const tag = (target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      // Space on a focused button is that button's own click. Handling it here
      // as well would pause and resume in the same keystroke.
      if ((event.key === " " || event.key === "k") && tag !== "button") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guideOpen, reactionsOpen, onAir, toggle, step]);

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

  useEffect(() => {
    if (!reactionsOpen) return;
    const dismissOutside = (event) => {
      if (reactionsRef.current?.contains(event.target) || reactionsButtonRef.current?.contains(event.target)) return;
      // A Clerk sign-in modal renders outside this tree; closing the sheet
      // under it would throw away the comment they signed in to leave.
      if (event.target?.closest?.(".cl-modalBackdrop, .cl-rootBox, [data-clerk-modal]")) return;
      setReactionsOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [reactionsOpen]);

  // Playback collapses the console to clear the set; the end of the show puts
  // it back, because what a viewer wants the moment the credits stop is the
  // guide — not a collapsed tab to find first. Only on the TRANSITION out of
  // playing, so a console the viewer collapsed by hand while nothing was on
  // stays collapsed.
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (playing) {
      setGuideOpen(false);
      setReactionsOpen(false);
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
    setReactionsOpen(false);
    setGuideOpen((open) => !open);
  };

  // A viewer who signed in to leave a comment comes back to the comments open,
  // not to a console they have to find their way through again. The draft they
  // had is restored inside the panel; the address brought them to the episode.
  const reopenedAfterSignIn = useRef(false);
  useEffect(() => {
    if (reopenedAfterSignIn.current || !selected.id) return;
    const returning = peekSignInReturn();
    if (returning?.episodeId !== selected.id) return;
    reopenedAfterSignIn.current = true;
    setGuideOpen(false);
    setReactionsOpen(true);
  }, [selected.id]);

  const toggleReactions = () => {
    setGuideOpen(false);
    setReactionsOpen((open) => !open);
  };

  const selectEpisode = (id, index) => {
    if (playing) onStop?.();
    onSelectEpisode?.(id, index);
    setGuideOpen(false);
    setReactionsOpen(false);
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
    // PAUSE, NOT STOP. This control used to end the episode, and the next
    // press started it again from the top — which is not what a ■ beside a
    // playing show means to anyone. Stopping is its own button below.
    if (playing) {
      toggle();
      return;
    }
    onPlay?.();
  };

  // On-air graphics. Stays up when the console collapses — that's the clean
  // "watching TV" view. The full lower third is a news convention, so only a
  // news show gets it; otherwise it's just the channel's logo cube.
  const chironMode = view === "set" && show.graphics === "news" ? "news" : "logo";
  const chiron = view === "set" && hasEpisode ? <LTTvChiron episode={selected} mode={chironMode} status="Replay" chapter={chapter} /> : null;

  // The three keys of any transport, as their own row so the collapsed strip
  // and the open console show the same controls in the same order.
  const skipBack = (
    <button type="button" className="ltv-key" onClick={() => step(-1)}
      aria-label="Back to the start of this part">
      <span aria-hidden="true">⏮</span>
    </button>
  );
  const playPause = (
    <button type="button" className="ltv-key is-primary" onClick={toggle}
      aria-label={paused ? "Resume episode" : "Pause episode"}>
      <span aria-hidden="true">{paused ? "▶" : "❚❚"}</span>
    </button>
  );
  const skipOn = (
    <button type="button" className="ltv-key" onClick={() => step(1)}
      aria-label="Skip to the next part">
      <span aria-hidden="true">⏭</span>
    </button>
  );

  if (collapsed) {
    return (
      <>
      {chiron}
      <aside className="ltv-collapsed" aria-label="LT TV broadcast controls">
        <button ref={expandButtonRef} type="button" className="ltv-tab" onClick={() => { setCollapsed(false); requestAnimationFrame(() => primaryButtonRef.current?.focus()); }} aria-label="Expand LT TV controls">
          <span className={playing ? "is-live" : ""} />
          <b>LT TV</b>
          <small>EP {selected.number}</small>
          <i aria-hidden="true">›</i>
        </button>
        {/* Pausing is the one thing you want without reopening the console:
            the console collapses itself when an episode starts, so this is
            where a viewer actually is while the show is on. */}
        {onAir && (
          <div className="ltv-keys" role="group" aria-label="Playback">
            {skipBack}{playPause}{skipOn}
          </div>
        )}
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

          {/* The rating lives where the episode is described, the way it does
              under a video — not behind the program guide, which is for
              choosing what to watch rather than for saying what you thought. */}
          {hasEpisode && selected.id && (
            <button
              ref={reactionsButtonRef}
              type="button"
              className={`ltv-reactions-toggle${reactionsOpen ? " is-open" : ""}`}
              onClick={toggleReactions}
              aria-expanded={reactionsOpen}
              aria-controls="ltv-reactions"
              aria-label={`Ratings and comments — ${tallySummary.label}`}
            >
              <span className="ltv-stars" aria-hidden="true">
                {"★★★★★".slice(0, Math.round(tallySummary.average))}
                <i>{"★★★★★".slice(0, 5 - Math.round(tallySummary.average))}</i>
              </span>
              <span>{tallySummary.count ? `${tallySummary.display} (${tallySummary.count})` : "Rate this episode"}</span>
              <span className="ltv-comment-count">{reactions.stats.commentCount || 0} 💬</span>
            </button>
          )}
        </div>

        {/* THE EPISODE AS ITS PARTS, which is what it really is. SitePal will
            not play a clip over 90 seconds, so anything longer goes up as
            several — and since a clip can only be started at its beginning,
            those joins are the only places a skip can land. Drawing the parts
            rather than a continuous line means the bar promises exactly what
            it can do. */}
        {onAir && (
          <div className="ltv-transport">
            <div className="ltv-scrub" role="group" aria-label="Episode parts">
              {parts.map((part) => (
                <button
                  key={part.index}
                  type="button"
                  className={`ltv-part${part.index === status.section ? " is-on" : ""}`}
                  style={{ flexGrow: part.seconds }}
                  aria-label={`Play part ${part.index + 1} of ${parts.length}, from ${clockTime(part.startsAt)}`}
                  aria-current={part.index === status.section ? "true" : undefined}
                  onClick={() => seek(part.startsAt)}
                >
                  <i style={{ width: `${partFill(part)}%` }} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="ltv-keys" role="group" aria-label="Playback">
              {skipBack}{playPause}{skipOn}
              <span className="ltv-clock" aria-live="off">
                {clockTime(status.elapsed)} / {clockTime(status.duration)}
              </span>
              <button type="button" className="ltv-key is-stop" onClick={() => onStop?.()}>
                <span aria-hidden="true">■</span> Stop
              </button>
            </div>
            {!status.exactPause && (
              <p className="ltv-transport-note">
                This player has no mid-line pause, so resuming starts this part again.
              </p>
            )}
          </div>
        )}

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
              {playing ? (paused ? "▶" : "❚❚") : voiceStatus === "failed" ? "↻" : "▶"}
            </span>
            {!hasEpisode ? "Episodes coming soon" : !canPlay ? "Not recorded yet" : loading
              ? "Preparing studio…"
              : playing
                ? paused ? "Resume episode" : "Pause episode"
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

      {reactionsOpen && hasEpisode && selected.id && (
        <section ref={reactionsRef} id="ltv-reactions" className="ltv-reactions" aria-label="Ratings and comments">
          <h3>Ratings &amp; comments</h3>
          <div className="ltv-reactions-body">
            <LTTvReactions episodeId={selected.id} episodeTitle={selected.title} reactions={reactions} />
          </div>
        </section>
      )}

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
  .ltv-masthead, .ltv-production, .ltv-guide, .ltv-reactions { pointer-events: auto; }
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
  .ltv-reactions-toggle { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 12px; padding: 8px 10px; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; background: rgba(255,255,255,.04); color: #ccc7d6; font: 600 12px/1.3 "Inter", sans-serif; cursor: pointer; }
  .ltv-reactions-toggle:hover, .ltv-reactions-toggle.is-open { color: #fff; border-color: var(--cyan); }
  .ltv-stars { color: #ffc93c; letter-spacing: 1px; }
  .ltv-stars i { color: rgba(247,244,250,.25); font-style: normal; }
  .ltv-comment-count { margin-left: auto; color: #aba6b7; }
  .ltv-reactions { position: fixed; top: 100px; left: 396px; width: 360px; padding: 20px 16px 14px; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; background: rgba(13,12,19,.97); box-shadow: 0 18px 60px rgba(0,0,0,.55); }
  .ltv-reactions > h3 { margin: 0 0 16px; color: #fff; font-size: 18px; font-weight: 650; }
  .ltv-reactions-body { max-height: calc(100dvh - 230px); overflow-y: auto; overscroll-behavior: contain; padding-right: 4px; }
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
    --cyan: #20d7f2; --magenta: #ef62dc;
    position: fixed;
    z-index: 10040;
    top: 50%;
    left: 13px;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .ltv-collapsed .ltv-tab {
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

  .ltv-collapsed .ltv-tab > span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #33f28a;
    box-shadow: 0 0 7px rgba(51,242,138,.65);
  }

  .ltv-collapsed .ltv-tab > span.is-live { background: #ff405b; }
  .ltv-collapsed b { writing-mode: vertical-rl; transform: rotate(180deg); font: 800 9px "Orbitron", monospace; letter-spacing: .2em; }
  .ltv-collapsed small { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; }
  .ltv-collapsed i { font-size: 20px; font-style: normal; }


  /* ── TRANSPORT ─────────────────────────────────────────────────────
     The same three keys in both places: a row under the open console, a
     column beside the collapsed strip. */
  .ltv-transport { pointer-events: auto; display: flex; flex-direction: column; gap: 11px; margin-top: 22px; }
  .ltv-scrub { display: flex; align-items: stretch; gap: 3px; }
  .ltv-part {
    flex: 1 1 0; min-width: 10px; height: 16px; position: relative;
    border: 0; padding: 0; background: transparent; cursor: pointer;
  }
  .ltv-part::before {
    content: ""; position: absolute; inset: 5px 0; border-radius: 2px;
    background: rgba(255,255,255,.17);
  }
  .ltv-part:hover::before { background: rgba(255,255,255,.34); }
  .ltv-part.is-on::before { background: rgba(32,215,242,.26); }
  .ltv-part > i {
    position: absolute; left: 0; top: 5px; bottom: 5px; border-radius: 2px;
    background: var(--magenta); box-shadow: 0 0 8px rgba(239,98,220,.5);
  }
  .ltv-keys { display: flex; align-items: center; gap: 7px; pointer-events: auto; }
  .ltv-key {
    min-width: 34px; min-height: 34px; display: inline-flex; align-items: center;
    justify-content: center; gap: 7px; padding: 0 9px; border-radius: 5px;
    border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.05);
    color: #e6e3ec; font: 500 12px "Inter", sans-serif; cursor: pointer;
  }
  .ltv-key:hover { background: rgba(255,255,255,.15); color: #fff; }
  .ltv-key > span { font-size: 11px; line-height: 1; }
  .ltv-key.is-primary { border-color: rgba(32,215,242,.6); color: var(--cyan); }
  .ltv-key.is-stop { color: #d8b2c4; }
  .ltv-clock { margin-left: auto; color: #b9b6c2; font: 500 12px/1 "IBM Plex Mono", monospace; }
  .ltv-transport-note { margin: 0; color: #96919f; font-size: 11px; line-height: 1.5; }
  /* Beside the collapsed strip the keys stack, matching its width. */
  .ltv-collapsed .ltv-keys {
    flex-direction: column; gap: 0; width: 42px; padding: 4px 0;
    border: 1px solid rgba(32,215,242,.37); border-left: 2px solid var(--cyan);
    border-radius: 0 6px 6px 0; background: rgba(4,6,12,.88);
    box-shadow: 0 0 17px rgba(32,215,242,.13); backdrop-filter: blur(12px);
  }
  .ltv-collapsed .ltv-key { width: 38px; min-height: 36px; border: 0; background: transparent; color: var(--cyan); }
  .ltv-collapsed .ltv-key:hover { background: rgba(32,215,242,.16); }

  button:focus-visible { outline: 2px solid #8feeff; outline-offset: 3px; }
  @media (max-width: 1100px) {
    .ltv-masthead, .ltv-production { left: 24px; width: 310px; }
    .ltv-production h2 { font-size: 27px; }
    .ltv-guide { left: 354px; width: 310px; }
    .ltv-reactions { left: 354px; width: 330px; }
  }
  @media (max-width: 900px) {
    .ltv-guide { left: 24px; top: 78px; width: min(340px, calc(100vw - 48px)); }
    .ltv-reactions { left: 24px; top: 78px; width: min(360px, calc(100vw - 48px)); }
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
    .ltv-reactions { top: 74px; }
  }
`;
