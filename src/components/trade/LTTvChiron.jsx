"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import css from "styled-jsx/css";

// LT TV on-air graphics: the cable-news lower third (spinning logo cube,
// headline bar, scrolling ticker with a quote box) laid over the talk-show
// set. Structure after Jon Kantner's "Fox News TV Display" pen (MIT,
// codepen.io/jkantner/pen/mPzpEa), rebranded — no network marks ship here.
//
// The headline is the selected episode, the quote box is the live RL80 price
// (hidden rather than faked when it fails to load), and the cube's clock face
// is the viewer's local time. The ticker copy is a placeholder.
//
// `mode`: "news" is the full package; "logo" keeps only the spinning cube, like
// a channel's corner logo, for non-news shows and the lineup. The cube holds
// its place in both, so news slides its bar and ticker in beside it.

const TICKER_PX_PER_SEC = 80;
const QUOTE_REFRESH_MS = 60_000;

// Placeholder — the source pen's copy — until the ticker's content is decided.
const TICKER_COPY =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

// Scientific notation below a cent — RL80 trades around 1e-8, where the
// fixed-point form is mostly leading zeros. Plain dollars above.
function Price({ value }) {
  if (value > 0 && value < 0.01) {
    const [mantissa, exponent] = value.toExponential(2).split("e");
    return (
      <>
        {"$" + mantissa}×10<sup>{exponent.replace("-", "−")}</sup>
      </>
    );
  }
  return "$" + value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 4 : 2 });
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Tick on the minute boundary — the face only shows h:mm.
    let interval;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000) + 50);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  const h = now.getHours();
  return { hm: `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM" };
}

function useRl80Price(enabled) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/rl80-price");
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setData(json);
      } catch (e) {
        // Keep the last good value.
      }
    };
    load();
    const id = setInterval(load, QUOTE_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled]);
  return data;
}

// The network mark, printed on all four faces of the glass cube like the
// source's logo.
const LOGO_FACE = (
  <div className="ltc-net">
    <span>LT</span>
    <span>TV</span>
  </div>
);

export default function LTTvChiron({ episode, mode = "news" }) {
  const news = mode === "news";
  const trackRef = useRef(null);
  const [navHeight, setNavHeight] = useState(64);
  const [tickerSeconds, setTickerSeconds] = useState(60);
  const clock = useClock();
  const rl80 = useRl80Price(news);
  const rl80Price = Number.isFinite(rl80?.price) ? rl80.price : null;
  // The source's box is always green; keep that, but don't show green on a
  // day RL80 is actually down.
  const rl80Down = Number.isFinite(rl80?.priceChange24h) && rl80.priceChange24h < -0.005;

  // Sit on top of the bottom nav, whatever height it renders at.
  useEffect(() => {
    let observer;
    let retry;
    const attach = () => {
      const bar = document.querySelector(".btm-nav-bar");
      if (!bar) {
        retry = setTimeout(attach, 500);
        return;
      }
      observer = new ResizeObserver(() => setNavHeight(Math.round(bar.getBoundingClientRect().height)));
      observer.observe(bar);
    };
    attach();
    return () => {
      clearTimeout(retry);
      observer?.disconnect();
    };
  }, []);

  // Constant crawl speed: the track holds the copy twice and slides one copy's
  // width, so the duration follows the content (and the webfont swap).
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const measure = () => {
      const runWidth = track.scrollWidth / 2;
      if (runWidth > 0) setTickerSeconds(Math.max(20, runWidth / TICKER_PX_PER_SEC));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`ltc${news ? "" : " is-logo"}`}
      style={{ bottom: navHeight }}
      role="region"
      aria-label={news ? `LT TV now showing: ${episode.title}` : "LT TV"}
    >
      <div className="ltc-main">
        <div className="ltc-logo" aria-hidden="true">
          <div className="ltc-box-top">
            <div className="ltc-cube">
              <div className="ltc-face ltc-f-front">{LOGO_FACE}</div>
              <div className="ltc-face ltc-f-right">{LOGO_FACE}</div>
              <div className="ltc-face ltc-f-back">{LOGO_FACE}</div>
              <div className="ltc-face ltc-f-left">{LOGO_FACE}</div>
            </div>
          </div>
          {/* Same face pattern as the source's channel / LIVE / channel / clock.
              Text sits in a span so the face itself keeps the cube's font-size —
              the translateZ is in em. */}
          <div className="ltc-box-bttm">
            <div className="ltc-cube">
              <div className="ltc-face ltc-f-front"><span>EP {episode.number}</span></div>
              <div className="ltc-face ltc-f-right"><span>Live</span></div>
              <div className="ltc-face ltc-f-back"><span>EP {episode.number}</span></div>
              <div className="ltc-face ltc-f-left">
                <span>
                  {clock.hm}
                  <small>{clock.ampm}</small>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ltc-event" aria-hidden={!news || undefined}>
          <div className="ltc-hilite" />
          <div className="ltc-glow" />
          <div className="ltc-rule" />
          <p key={episode.number}>{episode.title}</p>
        </div>
      </div>

      <div className="ltc-ticker" aria-hidden={!news || undefined}>
        <div
          ref={trackRef}
          className="ltc-track"
          style={{ animationDuration: `${tickerSeconds}s` }}
        >
          <span className="ltc-run">{TICKER_COPY}</span>
          <span className="ltc-run" aria-hidden="true">{TICKER_COPY}</span>
        </div>
        {rl80Price != null && (
          <div className={`ltc-quote${rl80Down ? " is-down" : ""}`}>
            <div className="ltc-sym"><span>RL80</span></div>
            <span className="ltc-px"><Price value={rl80Price} /></span>
          </div>
        )}
      </div>

      <div className="ltc-base" />

      <style jsx>{styles}</style>
    </div>
  );
}

// css.global (not a bare string): styled-jsx dedupes style tags by hash, and a
// plain string has none — two bare-string components on one page collide and
// only the first one's CSS is injected. The .ltc- prefix keeps global safe.
const styles = css.global`
  .ltc {
    /* The source's broadcast roles in the set's inks: its red bar is fuchsia,
       its blue glass is cyan, its green quote is the console's phosphor.
       Kept dark enough for white type — cube glass composites to ~#0d6d86
       (~6:1 behind the mark), the bar is ~11:1 under the headline, and the
       phosphor is ~3.4:1 under the price (the source's #0a0 is ~3.1:1). */
    --ltc-cube: rgba(16, 130, 160, 0.6);
    --ltc-cube-edge: #8feeff;
    --ltc-bar: #6e0f5a;
    --ltc-bar-deep: #2a0626;
    --ltc-bar-hot: #b8168f;
    --ltc-bar-rule: #ffa8ec;
    --ltc-up: #12a05c;
    --ltc-down: #b3123a;
    /* A var keeps "7.6em" as text and resolves it on the element that uses
       it — only use it where font-size is still the .ltc base. */
    --ltc-cube-w: 7.6em;

    position: fixed;
    left: 0;
    right: 0;
    z-index: 10035;
    font-size: 10px;
    color: #fff;
    font-family: Arial, "Helvetica Neue", sans-serif;
    text-transform: uppercase;
    pointer-events: none;
    animation: ltc-rise 520ms cubic-bezier(.2,.72,.2,1) both;
  }

  .ltc p { margin: 0; }

  .ltc-main {
    display: flex;
    align-items: flex-end;
    width: 100%;
  }

  /* ── Logo cube ─────────────────────────────────────────────────────
     Proportions are the source's scaled from its 110px cube to 7.6em:
     80px top box → 5.5em, 30px bottom → 2.1em, 1200px perspective → 83em,
     perspective origin 100px down → 6.9em. */
  .ltc-logo {
    flex: 0 0 auto;
    width: max(15%, 11em);
    height: 7.6em;
  }

  .ltc-box-top,
  .ltc-box-bttm {
    width: var(--ltc-cube-w);
    margin-left: auto;
    margin-right: 1.8em;
    perspective: 83em;
    perspective-origin: 50% 6.9em;
  }

  .ltc-box-top {
    height: 5.5em;
  }

  .ltc-box-bttm {
    height: 2.1em;
    transform: scale(1, 0.85);
    transform-origin: top;
  }

  .ltc-cube {
    position: relative;
    width: var(--ltc-cube-w);
    height: 100%;
    transform-style: preserve-3d;
  }

  .ltc-face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .ltc-f-front { transform: translateZ(calc(var(--ltc-cube-w) / 2)); }
  .ltc-f-right { transform: rotateY(90deg) translateZ(calc(var(--ltc-cube-w) / 2)); }
  .ltc-f-back  { transform: rotateY(180deg) translateZ(calc(var(--ltc-cube-w) / 2)); }
  .ltc-f-left  { transform: rotateY(-90deg) translateZ(calc(var(--ltc-cube-w) / 2)); }

  .ltc-box-top .ltc-cube {
    animation: ltc-spin 60s linear infinite;
  }

  .ltc-box-top .ltc-face {
    background: var(--ltc-cube);
    border: max(1px, 0.15em) solid var(--ltc-cube-edge);
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Heavy white mark filling the face, stretched wide like the source's
     logo (the pen scales its type the same way). */
  .ltc-net {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: "Arial Black", "Helvetica Neue", Arial, sans-serif;
    font-size: 2.55em;
    font-weight: 900;
    line-height: 0.8;
    letter-spacing: -0.01em;
    transform: scaleX(1.3);
  }

  .ltc-box-bttm .ltc-cube {
    animation: ltc-spin 15s cubic-bezier(0.25, 1, 0.45, 1) infinite;
    text-shadow: 0 0 4px #000;
  }

  .ltc-box-bttm .ltc-face {
    background: radial-gradient(var(--ltc-bar), var(--ltc-bar-deep));
  }

  .ltc-box-bttm .ltc-face > span {
    font-size: 1.6em;
    font-weight: 700;
    white-space: nowrap;
  }

  .ltc-box-bttm small {
    margin-left: 0.15em;
    font-size: 0.67em;
  }

  /* ── Headline bar ──────────────────────────────────────────────────── */
  .ltc-event {
    position: relative;
    flex: 1 1 auto;
    height: 7.6em;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: linear-gradient(90deg, transparent, var(--ltc-bar) 5%);
  }

  .ltc-hilite,
  .ltc-glow,
  .ltc-rule {
    position: absolute;
    right: 0;
  }

  .ltc-hilite {
    top: 0;
    width: 95%;
    height: 0.8em;
    background: radial-gradient(#fff, transparent 60%);
  }

  .ltc-glow {
    bottom: 0;
    width: 90%;
    height: 2.4em;
    background: linear-gradient(90deg, transparent 30%, var(--ltc-bar-hot));
    box-shadow: 0 0.8em 0.8em var(--ltc-bar) inset;
  }

  .ltc-rule {
    bottom: 0;
    width: 90%;
    height: 0.4em;
    background: linear-gradient(90deg, transparent, var(--ltc-bar-rule));
    box-shadow: 0 0 2px var(--ltc-bar) inset;
  }

  .ltc-event p {
    position: relative;
    padding: 0 1em;
    font-family: "Bebas Neue", "Helvetica Neue", Arial, sans-serif;
    font-size: 4.6em;
    line-height: 1;
    letter-spacing: 0.02em;
    text-align: center;
    white-space: nowrap;
    text-shadow: 0 2px 4px #000;
    animation: ltc-wipe 480ms cubic-bezier(.2,.72,.2,1) both;
  }

  /* ── Ticker ────────────────────────────────────────────────────────── */
  .ltc-ticker {
    position: relative;
    height: 2.6em;
    overflow: hidden;
    background: #000;
    white-space: nowrap;
  }

  .ltc-track {
    display: flex;
    width: max-content;
    height: 100%;
    align-items: center;
    animation: ltc-crawl linear infinite;
  }

  /* Source: Arial 16pt on a 30px bar, 1px tracking. The gap before the
     repeat stands in for the source's restart from the right edge. */
  .ltc-run {
    padding-right: 8em;
    font-size: 1.8em;
    letter-spacing: 0.05em;
  }

  /* The source's .stock-info, scaled to our bar (30px → 2.6em): black to
     green by 80% with a hard black tail, a slanted grey symbol plate with a
     white rule, and the price stretched 10% tall. */
  .ltc-quote {
    --ltc-q: var(--ltc-up);
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1.5em;
    padding-right: 4.3em;
    background: linear-gradient(90deg, #000, #000 25%, var(--ltc-q) calc(100% - 4em), #000 calc(100% - 4em), #000);
    box-shadow: -1.4em 0 1.7em #000;
  }

  .ltc-quote.is-down { --ltc-q: var(--ltc-down); }

  .ltc-sym {
    box-sizing: border-box;
    align-self: stretch;
    width: 6.5em;
    padding-right: 0.9em;
    display: grid;
    place-items: center;
    border: 2px solid #fff;
    background: linear-gradient(#666, #000);
    clip-path: polygon(0 0, 100% 0, 80% 100%, 0 100%);
  }

  .ltc-sym span {
    font-size: 1.8em;
    font-weight: 700;
    line-height: 1;
    transform: scale(0.8, 1.1);
  }

  .ltc-px {
    font-size: 1.8em;
    line-height: 1;
    text-shadow: 0 2px 4px #000;
    transform: scale(1, 1.1);
  }

  .ltc-px sup {
    margin-left: 0.05em;
    font-size: 0.6em;
    line-height: 0;
    vertical-align: 0.7em;
  }

  .ltc-base {
    height: 0.8em;
    background: linear-gradient(90deg, var(--ltc-bar-deep), var(--ltc-bar), var(--ltc-bar-deep));
    box-shadow: 0 0.5em 0.5em var(--ltc-bar-deep) inset;
  }

  /* Logo mode: the cube stays put; the bar tucks behind it and the ticker and
     base strip drop away, ready to come back when a news show is on. */
  .ltc-event,
  .ltc-ticker,
  .ltc-base {
    transition: transform 460ms cubic-bezier(.2,.72,.2,1), opacity 320ms ease;
  }

  .ltc.is-logo .ltc-event {
    transform: translateX(-6%);
    opacity: 0;
  }

  .ltc.is-logo .ltc-ticker,
  .ltc.is-logo .ltc-base {
    transform: translateY(100%);
    opacity: 0;
  }

  .ltc.is-logo .ltc-track {
    animation-play-state: paused;
  }

  @keyframes ltc-spin {
    0% { transform: rotateY(0deg); }
    25% { transform: rotateY(90deg); }
    50% { transform: rotateY(180deg); }
    75% { transform: rotateY(270deg); }
    100% { transform: rotateY(360deg); }
  }

  @keyframes ltc-crawl {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  @keyframes ltc-rise {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: none; opacity: 1; }
  }

  @keyframes ltc-wipe {
    from { clip-path: inset(0 100% 0 0); }
    to { clip-path: inset(0 0 0 0); }
  }

  @media (max-width: 1100px), (max-height: 690px) {
    .ltc { font-size: 8.5px; }
  }

  @media (min-width: 1700px) and (min-height: 950px) {
    .ltc { font-size: 12px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ltc,
    .ltc-cube,
    .ltc-event p,
    .ltc-track {
      animation: none !important;
    }
  }
`;
