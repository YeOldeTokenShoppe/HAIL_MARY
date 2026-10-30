"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import css from "styled-jsx/css";

// LT TV on-air graphics: the cable-news lower third (spinning globe mark,
// headline bar, scrolling ticker with a quote box) laid over the talk-show
// set. Structure after Jon Kantner's "Fox News TV Display" pen (MIT,
// codepen.io/jkantner/pen/mPzpEa), rebranded — no network marks ship here.
//
// The headline bar and the ticker read the episode's own graphics when the
// record carries them (`graphics.headline`, `graphics.ticker` — the news
// pipeline writes both) and the quote box is the live RL80 price (hidden
// rather than faked when it fails to load).
//
// `chapter` is the part of the show that is on air now, passed down from the
// set (which owns the clock). A newscast's lower third changes with the
// running order, so the bar carries a beat plate and that chapter's headline
// and wipes to the next one as the show moves on. A record with no chapters —
// anything staged before they existed — sits on `graphics.headline` for the
// whole episode, which is what the bar did before.
//
// `mode`: "news" is the full package; "logo" keeps only the spinning globe, like
// a channel's corner logo, for non-news shows and the lineup. The globe holds
// its place in both, so news slides its bar and ticker in beside it.

const TICKER_PX_PER_SEC = 80;
const QUOTE_REFRESH_MS = 60_000;

// What scrolls when the record carries no ticker items: the episode's own
// summary, so an older or hand-made record still reads as this show rather
// than as filler. Items are joined with a wide dot, as a cable ticker does.
const TICKER_SEPARATOR = "   \u2022   ";
function tickerCopy(episode) {
  const items = Array.isArray(episode?.graphics?.ticker)
    ? episode.graphics.ticker.map((t) => String(t).trim()).filter(Boolean)
    : [];
  if (items.length) return items.join(TICKER_SEPARATOR) + TICKER_SEPARATOR;
  const fallback = episode?.summary || episode?.title || "";
  return fallback ? fallback + TICKER_SEPARATOR : "";
}

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

// The network mark: a globe wrapped in a ribbon, the news-channel cliché. The
// ribbon is a ring of flat segments, one letter each, stood up around the
// globe in CSS 3D; the globe itself is a still disc at the ring's centre
// with the land cut out of it (an equirectangular Natural Earth land layer
// used as a mask) and the night-side city lights laid over the holes. A disc at z=0 hides exactly the half of the ring that a sphere of
// the same silhouette would, so no front/back split is needed. Blank
// segments space the words; the count must match --ltc-ring-n in the CSS.
const RIBBON = ["L", "T", "T", "V", "", "", "L", "T", "T", "V", "", "", "L", "T", "T", "V", "", ""];

export default function LTTvChiron({ episode, mode = "news", chapter = null }) {
  const news = mode === "news";
  const trackRef = useRef(null);
  const headlineRef = useRef(null);
  const [navHeight, setNavHeight] = useState(64);
  const [tickerSeconds, setTickerSeconds] = useState(60);
  const rl80 = useRl80Price(news);
  const rl80Price = Number.isFinite(rl80?.price) ? rl80.price : null;
  const headline = chapter?.headline || episode?.graphics?.headline || episode.title;
  const kicker = chapter?.kicker || "";
  // Re-runs the wipe whenever the bar's copy changes, and only then — keyed on
  // the copy itself rather than on a chapter index, so an episode with no
  // chapters wipes once on arrival exactly as it used to.
  const wipeKey = `${episode.id ?? episode.number}:${kicker}:${headline}`;
  const ticker = tickerCopy(episode);
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

  // Keep the headline inside the bar. It was one fixed string per episode when
  // the size was chosen; it is now a different story every chapter, and a beat
  // plate sits in front of it, so a long one would run under the clipped edge
  // and simply lose its last few words with nothing to show it had. Shrink to
  // fit instead, down to a floor — past that the bar is the wrong shape for
  // the copy and a producer should shorten the headline.
  useLayoutEffect(() => {
    const line = headlineRef.current;
    const bar = line?.parentElement;
    if (!line || !bar) return undefined;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      line.style.fontSize = "";
      const available = bar.clientWidth;
      const needed = line.scrollWidth;
      if (!available || needed <= available) return;
      const base = parseFloat(getComputedStyle(line).fontSize);
      if (!base) return;
      line.style.fontSize = `${Math.max(base * 0.55, (base * available) / needed)}px`;
    };
    fit();
    // Bebas Neue swaps in after first paint and is much narrower than the
    // fallback, so a measurement taken before it lands shrinks copy that would
    // have fitted.
    document.fonts?.ready.then(fit).catch(() => {});
    const observer = new ResizeObserver(fit);
    observer.observe(bar);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [wipeKey]);

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
            <div className="ltc-globe-rig">
              <div className="ltc-globe-glow" />
              <div className="ltc-globe-land" />
              <div className="ltc-globe" />
              <div className="ltc-globe-lights" />
              <div className="ltc-ring">
                <div className="ltc-ring-spin">
                  {RIBBON.map((ch, i) => (
                    <span key={i} className="ltc-seg" style={{ "--i": i }}><b>{ch}</b></span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ltc-event" aria-hidden={!news || undefined}>
          <div className="ltc-hilite" />
          <div className="ltc-glow" />
          <div className="ltc-rule" />
          <p ref={headlineRef} key={wipeKey}>
            {kicker && <b className="ltc-kicker">{kicker}</b>}
            {headline}
          </p>
        </div>
      </div>

      <div className="ltc-ticker" aria-hidden={!news || undefined}>
        <div
          ref={trackRef}
          className="ltc-track"
          style={{ animationDuration: `${tickerSeconds}s` }}
        >
          <span className="ltc-run">{ticker}</span>
          <span className="ltc-run" aria-hidden="true">{ticker}</span>
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
       its blue glass is the globe's cyan sea, its green quote is the
       console's phosphor. Kept dark enough for white type — the bar is ~11:1
       under the headline, and the phosphor is ~3.4:1 under the price (the
       source's #0a0 is ~3.1:1). */
    --ltc-sea: #0e6f8e;
    --ltc-sea-lit: #3fbde0;
    --ltc-sea-deep: #052a3a;
    /* Land colour, seen through the cut-out continents. */
    --ltc-land-lit: #3b2366;
    --ltc-land: #170b2c;
    --ltc-bar: #6e0f5a;
    --ltc-bar-deep: #2a0626;
    --ltc-bar-hot: #b8168f;
    --ltc-bar-rule: #ffa8ec;
    --ltc-up: #12a05c;
    --ltc-down: #b3123a;
    /* A var keeps its em as text and resolves it on the element that uses
       it — only use these where font-size is still the .ltc base. */
    --ltc-logo-w: 9em;
    --ltc-globe-d: 7.6em;
    /* Lifted off the box's centre so the mark rides up over the bar's top
       edge like a corner logo. */
    --ltc-globe-y: -1em;
    /* The globe's axis leans like a desk globe's. */
    --ltc-globe-lean: -18deg;
    /* A touch taller than wide, stretched in screen space (after the
       lean) so the long axis stands upright. Shared by the globe, its
       lights and its glow. */
    --ltc-globe-sy: 1.07;
    --ltc-ring-r: 4.45em;
    --ltc-ring-n: 18;
    --ltc-ring-t: 24s;
    /* One turn of the globe. The land mask and the lights scroll together,
       leftward — against the ring, whose near side runs right. */
    --ltc-globe-t: 120s;
    /* Segment pitch around the ring: 2·r·tan(180°/n). The letters have no
       band behind them, so they need not tile edge to edge. */
    --ltc-seg-w: 1.57em;
    --ltc-seg-h: 2.6em;

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

  /* ── Logo globe ─────────────────────────────────────────────────────
     The column the source gave its logo cube (7.6em tall) now holds the
     globe mark alone, which fills it and rides up past its top edge. */
  .ltc-logo {
    flex: 0 0 auto;
    width: max(15%, 11em);
    height: 7.6em;
  }

  .ltc-box-top {
    width: var(--ltc-logo-w);
    height: 100%;
    margin-left: auto;
    margin-right: 1.4em;
    /* A fairly close eye centred on the globe, so the ribbon's near side
       reads a touch larger than its far side. */
    perspective: 40em;
    perspective-origin: 50% 50%;
  }

  .ltc-globe-rig {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
  }

  /* An outer glow behind the globe. Its own layer, since the globe's mask
     clips anything outside the disc; hollow inside the rim so the cut-out
     land still opens onto the set and not onto the glow. Sized 2.4× the
     disc and the gradient ray is closest-side (half the width — the default
     farthest-corner ray is 1.41× longer and put the glow's inner edge well
     inside the globe, a dark orb across the continents), so the rim falls
     at 50/2.4 ≈ 41.7%; the light starts just outside it and falls off over
     the rest. */
  .ltc-globe-glow {
    position: absolute;
    left: 50%;
    top: 50%;
    width: calc(var(--ltc-globe-d) * 2.4);
    height: calc(var(--ltc-globe-d) * 2.4);
    margin: calc(var(--ltc-globe-d) * -1.2 + var(--ltc-globe-y)) 0 0 calc(var(--ltc-globe-d) * -1.2);
    border-radius: 50%;
    transform: scaleY(var(--ltc-globe-sy));
    background: radial-gradient(
      circle closest-side,
      rgba(63, 189, 224, 0) 41%,
      rgba(90, 205, 235, 0.45) 42.5%,
      rgba(63, 189, 224, 0.26) 50%,
      rgba(63, 189, 224, 0.12) 62%,
      rgba(63, 189, 224, 0.04) 76%,
      rgba(63, 189, 224, 0) 92%
    );
  }

  /* A coloured disc under the globe: the land is cut out of the globe, so
     this is what shows through the continents. Same geometry as the globe
     (size, lift, lean, stretch); lit from the same corner. */
  .ltc-globe-land {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--ltc-globe-d);
    height: var(--ltc-globe-d);
    margin: calc(var(--ltc-globe-d) / -2 + var(--ltc-globe-y)) 0 0 calc(var(--ltc-globe-d) / -2);
    border-radius: 50%;
    transform: scaleY(var(--ltc-globe-sy)) rotate(var(--ltc-globe-lean));
    background: radial-gradient(circle at 32% 30%, var(--ltc-land-lit), var(--ltc-land) 70%);
  }

  /* The globe: ocean in the set's cyan, lit from the upper left, with a
     specular highlight and a shadowed limb. The land is cut out of it — the
     land PNG is a mask subtracted from the full disc, so the continents are
     holes onto the set behind. The 2:1 map is sized 240% × 120% of the disc
     (aspect kept) and pinned to the top, so the disc shows roughly 90°N
     down to 60°S and Antarctica, the band along the map's foot, stays below
     the rim. The x offset centres the mid-Atlantic (~45°W), so the Americas
     sit on the near side with Europe and Africa at the right limb. The
     mask clips to the box, so no outer drop shadow here. */
  .ltc-globe {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--ltc-globe-d);
    height: var(--ltc-globe-d);
    margin: calc(var(--ltc-globe-d) / -2 + var(--ltc-globe-y)) 0 0 calc(var(--ltc-globe-d) / -2);
    border-radius: 50%;
    transform: scaleY(var(--ltc-globe-sy)) rotate(var(--ltc-globe-lean));
    background-image:
      radial-gradient(circle at 30% 26%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 38%),
      radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 58%, rgba(2, 20, 30, 0.75) 100%),
      radial-gradient(circle at 32% 30%, var(--ltc-sea-lit), var(--ltc-sea) 48%, var(--ltc-sea-deep) 100%);
    box-shadow: inset -0.5em -0.45em 0.9em rgba(0, 10, 20, 0.55);
    -webkit-mask-image: linear-gradient(#000, #000), url("/images/lttv-globe-land-px.png");
    -webkit-mask-size: 100% 100%, 240% 120%;
    -webkit-mask-repeat: no-repeat, repeat-x;
    -webkit-mask-position: 0 0, calc(var(--ltc-globe-d) * -0.42) 0;
    -webkit-mask-composite: xor;
    mask-image: linear-gradient(#000, #000), url("/images/lttv-globe-land-px.png");
    mask-size: 100% 100%, 240% 120%;
    mask-repeat: no-repeat, repeat-x;
    mask-position: 0 0, calc(var(--ltc-globe-d) * -0.42) 0;
    mask-composite: exclude;
    animation: ltc-globe-turn var(--ltc-globe-t) linear infinite;
  }

  /* City lights over the cut-out land: NASA's night-side lights lifted out
     of their map and resampled into the land mask's frame (see
     public/images/lttv-globe-lights-px.png's provenance in memory), drawn on a
     disc that sits exactly on the globe with the same map sizing, offset
     and lean, so each light lands on its continent. */
  .ltc-globe-lights {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--ltc-globe-d);
    height: var(--ltc-globe-d);
    margin: calc(var(--ltc-globe-d) / -2 + var(--ltc-globe-y)) 0 0 calc(var(--ltc-globe-d) / -2);
    border-radius: 50%;
    transform: scaleY(var(--ltc-globe-sy)) rotate(var(--ltc-globe-lean));
    background-image: url("/images/lttv-globe-lights-px.png");
    background-size: 240% 120%;
    background-repeat: repeat-x;
    background-position: calc(var(--ltc-globe-d) * -0.42) 0;
    filter: drop-shadow(0 0 1px rgba(255, 220, 140, 0.9));
    animation: ltc-lights-turn var(--ltc-globe-t) linear infinite;
  }

  /* The ribbon: letters only, circling the globe's middle on a ring that is
     nearly level with a slight dip toward the viewer, then spun. Each
     segment stands at its angle, face out, at the ring's radius. */
  .ltc-ring {
    position: absolute;
    left: 50%;
    top: calc(50% + var(--ltc-globe-y));
    width: 0;
    height: 0;
    transform-style: preserve-3d;
    transform: rotateZ(-5deg) rotateX(-9deg);
  }

  .ltc-ring-spin {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    transform-style: preserve-3d;
    animation: ltc-ring-turn var(--ltc-ring-t) linear infinite;
  }

  .ltc-seg {
    position: absolute;
    left: calc(var(--ltc-seg-w) / -2);
    top: calc(var(--ltc-seg-h) / -2);
    width: var(--ltc-seg-w);
    height: var(--ltc-seg-h);
    display: grid;
    place-items: center;
    transform: rotateY(calc(var(--i) * (360deg / var(--ltc-ring-n)))) translateZ(var(--ltc-ring-r));
    /* A letter is drawn only from its front: once it swings past side-on it
       is culled, so nothing shows through the cut-out land from behind. */
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }

  /* The letter is sized on a child: the segment's own em must stay the
     .ltc base, or the em-valued ring radius and pitch scale with it. */
  .ltc-seg b {
    color: #fff;
    font-family: "Bebas Neue", "Helvetica Neue", Arial, sans-serif;
    font-size: 2.7em;
    font-weight: 400;
    line-height: 1;
    text-shadow: 0 0.06em 0.1em rgba(0, 0, 0, 0.7), 0 0 0.3em rgba(0, 0, 0, 0.5);
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

  /* The beat plate, in the bar's hot ink — the "MACRO" / "CRYPTO" tag a
     newscast puts in front of the story it is on. Baseline-aligned rather than
     vertically centred, so it sits on the headline's line rather than floating
     against the bar's much taller cap height. */
  .ltc-kicker {
    display: inline-block;
    margin-right: 0.5em;
    padding: 0.14em 0.42em 0.06em;
    background: var(--ltc-bar-hot);
    box-shadow: 0 0 0.6em var(--ltc-bar-hot);
    font-family: Arial, "Helvetica Neue", sans-serif;
    font-size: 0.42em;
    font-weight: 700;
    letter-spacing: 0.1em;
    vertical-align: 0.42em;
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

  @keyframes ltc-ring-turn {
    from { transform: rotateY(0deg); }
    to { transform: rotateY(360deg); }
  }

  /* A full turn is one map width (240% of the disc = 2.4d) of scroll,
     leftward from the resting offset. Only the land layer (second) moves;
     the full-disc layer holds at 0. */
  @keyframes ltc-globe-turn {
    from {
      -webkit-mask-position: 0 0, calc(var(--ltc-globe-d) * -0.42) 0;
      mask-position: 0 0, calc(var(--ltc-globe-d) * -0.42) 0;
    }
    to {
      -webkit-mask-position: 0 0, calc(var(--ltc-globe-d) * -2.82) 0;
      mask-position: 0 0, calc(var(--ltc-globe-d) * -2.82) 0;
    }
  }

  @keyframes ltc-lights-turn {
    from { background-position: calc(var(--ltc-globe-d) * -0.42) 0; }
    to { background-position: calc(var(--ltc-globe-d) * -2.82) 0; }
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
    .ltc-ring-spin,
    .ltc-globe,
    .ltc-globe-lights,
    .ltc-event p,
    .ltc-track {
      animation: none !important;
    }
  }
`;
