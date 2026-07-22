"use client";

import React, { useEffect, useState } from "react";
import TradingCard from "@/components/TradingCard";
import { getCardById, GENESIS_SET, CARD_TYPES } from "@/game/terminal-traders/cards";
import { toTemplateCard, CARD_ART } from "@/game/terminal-traders/templateCard";
import {
  FRAMES, FRAME_ID_BY_RARITY, FX_OVERLAYS, FX_BLEND_MODES, MAX_FX,
  FX_BLEND_DEFAULT, FX_OPACITY_DEFAULT,
} from "@/game/terminal-traders/cardFrames";
import { ROGUES } from "@/game/terminal-traders/rogues";

// Every card renders straight from the engine through the game's own converter,
// so the preview matches what the table shows (art comes from CARD_ART, keyed
// by card id). `meta` is the small line under the name — each card prints its
// rarity, so the picker reads the same as the card face.
const pickerItems = (ids) =>
  ids.map((id) => {
    const card = toTemplateCard(getCardById(id));
    return { id, card, meta: card.rarity };
  });

// The framed no-art variant, for checking layout without artwork.
const NO_ART = {
  ...toTemplateCard(getCardById("eugene")),
  backgroundImage: null,
  edition: "demo",
};

// Card types in picker/binder order. Shared by the selection list and the
// collection grid so both stay in the same order.
const TYPE_ORDER = [
  { type: CARD_TYPES.TRADER, title: "Traders" },
  { type: CARD_TYPES.ACTION, title: "Actions" },
  { type: CARD_TYPES.COIN, title: "Coins" },
  { type: CARD_TYPES.MARKET, title: "Markets" },
];

// The picker lists every Genesis card, grouped by type, so any of the 80 can
// be opened in the template — art-less cards preview frame-only. Art coverage
// is tracked separately by the collection grid, not by what the picker shows.
const CARD_GROUPS = [
  ...TYPE_ORDER.map(({ type, title }) => ({
    title,
    items: pickerItems(GENESIS_SET.filter((card) => card.type === type).map((card) => card.id)),
  })),
  {
    title: "Blank",
    items: [{ id: "noart", card: NO_ART, name: "No artwork", meta: "frame only" }],
  },
];

// Every Genesis card is selectable, not just the ones in the picker — the
// collection grid can open any of the 80. CARD_GROUPS adds only the synthetic
// "noart" entry now that the traders come from the engine.
const CARD_BY_ID = {
  ...Object.fromEntries(GENESIS_SET.map((card) => [card.id, toTemplateCard(card)])),
  ...Object.fromEntries(
    CARD_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.card]))
  ),
};

// ── Collection grid ────────────────────────────────────────────────────────
// The whole Genesis 80 as a binder page: art where it exists, an empty slot
// outline where it doesn't, so art-run coverage reads at a glance. Uses the
// same TYPE_ORDER as the picker so the two stay in step.
const COLLECTION = TYPE_ORDER.map(({ type, title }) => {
  const cards = GENESIS_SET.filter((card) => card.type === type).map((card) => ({
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    art: CARD_ART[card.id] || null,
    // Filled slots render the real TradingCard, so a thumbnail shows the
    // finished card — frame, stats, ability, foil — not just the art crop.
    template: CARD_BY_ID[card.id],
  }));
  return { title, cards, wired: cards.filter((c) => c.art).length };
});

// 744 x 1038 * 0.2 = 149 x 208 per thumbnail.
const THUMB_SCALE = 0.2;

const TOTAL_WIRED = COLLECTION.reduce((n, g) => n + g.wired, 0);

// ── Rogues gallery ─────────────────────────────────────────────────────────
// A cross-cutting index by character, never a fifth card type: every rogue's
// card already lives in a type group above, so this section double-lists but
// never double-counts — TOTAL_WIRED stays pure type math. A debuted rogue's
// slot shows their debut card; a pending rogue's slot is a silhouette
// (dark shape, signature-color glow, "???") waiting for its reveal.
const ROGUE_ENTRIES = ROGUES.map((rogue) => {
  const debutCard = rogue.debutCardId ? getCardById(rogue.debutCardId) : null;
  return { ...rogue, debutCard, template: debutCard ? CARD_BY_ID[rogue.debutCardId] : null };
});

const ROGUES_DEBUTED = ROGUE_ENTRIES.filter((r) => r.status === "debuted").length;

export default function CardTemplatePage() {
  const [scale, setScale] = useState(0.75);
  const [active, setActive] = useState("eugene");
  const [artFocusY, setArtFocusY] = useState(28);
  const [artZoom, setArtZoom] = useState(1.25);
  const [foilStyle, setFoilStyle] = useState("hero");
  const [view, setView] = useState("single");
  // null = follow the card's rarity; a frame id pins an override for preview.
  const [frameOverride, setFrameOverride] = useState(null);
  const [fxPicks, setFxPicks] = useState([]);
  const [fxBlend, setFxBlend] = useState(FX_BLEND_DEFAULT);
  const [fxOpacity, setFxOpacity] = useState(FX_OPACITY_DEFAULT);

  const toggleFx = (src) =>
    setFxPicks((picks) =>
      picks.includes(src)
        ? picks.filter((p) => p !== src)
        // Oldest pick drops out once the third slot is taken, so clicking
        // through the list keeps working instead of silently doing nothing.
        : [...picks, src].slice(-MAX_FX)
    );
  const base = CARD_BY_ID[active] || NO_ART;
  const hasArt = Boolean(base.backgroundImage);

  // toTemplateCard prints display labels ("Terminal Foil"), while the frame
  // map is keyed by card-data ids ("terminal-foil") — normalise before lookup.
  const autoFrameId = FRAME_ID_BY_RARITY[String(base.rarity || "").toLowerCase().replace(/\s+/g, "-")];
  const autoFrame = FRAMES.find((f) => f.id === autoFrameId) || null;

  // Seed the framing sliders AND the foil from the card's own values on every
  // switch, so the preview opens on exactly what the game renders. Without
  // this the controls held their last position and every card looked like it
  // was framed — and foiled — as whatever the previous card was set to. Foil
  // matters most on terminal-foil-moment, the one card that ships `radiant`.
  useEffect(() => {
    const focus = String(base.artFocus || "").match(/(\d+(?:\.\d+)?)%/);
    setArtFocusY(focus ? parseFloat(focus[1]) : 28);
    setArtZoom(base.artZoom || 1.2);
    if (base.foilStyle) setFoilStyle(base.foilStyle);
    // Same reason as foil: the FX picker opens on whatever the card has
    // wired in CARD_ART, so the preview matches the printed card and the
    // chips show which overlays are already permanent.
    setFxPicks(base.fxOverlays || []);
    setFxBlend(base.fxBlend || FX_BLEND_DEFAULT);
    setFxOpacity(base.fxOpacity ?? FX_OPACITY_DEFAULT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const card = {
    ...base,
    artFocus: hasArt ? `center ${artFocusY}%` : null,
    artZoom: hasArt ? artZoom : 1,
    foilStyle,
    frameImage:
      frameOverride === "none" ? null
      : frameOverride ? FRAMES.find((f) => f.id === frameOverride)?.src
      : base.frameImage || autoFrame?.src || null,
    // Overriding the frame must carry its divider-slot offset too, or the
    // meta line lands on a bar (the frames don't share a slot height).
    frameMetaTop:
      frameOverride && frameOverride !== "none"
        ? FRAMES.find((f) => f.id === frameOverride)?.metaTop
        : base.frameMetaTop || autoFrame?.metaTop,
    fxOverlays: fxPicks,
    fxBlend,
    fxOpacity,
  };

  useEffect(() => {
    const adjust = () => {
      const w = window.innerWidth;
      if (w < 820) setScale(Math.max(0.36, (w - 60) / 744));
      else if (w < 1200) setScale(0.65);
      else setScale(0.4);
    };
    adjust();
    window.addEventListener("resize", adjust);
    return () => window.removeEventListener("resize", adjust);
  }, []);

  return (
    <main className="ct-shell">
      <style>{PAGE_STYLES}</style>
      <div className="ct-grid" aria-hidden />

      <header className="ct-top">
        <div>
          <p className="ct-kicker">Terminal Traders // Card Template</p>
          <h1>{view === "single" ? "Trading Card Overlay" : "The Genesis 80"}</h1>
          <p className="ct-sub">
            {view === "single" ? (
              <>
                Move your mouse over the card to tilt it. Same dimensions (744 ×
                1038) for every card type; swap <code>backgroundImage</code> per card.
              </>
            ) : (
              <>
                Every card in the set. Filled slots show the art at its wired{" "}
                <code>artFocus</code> crop; outlined slots are still to come.
                Click any slot to open it in the template.
              </>
            )}
          </p>
        </div>

        <div className="ct-view-toggle" role="radiogroup" aria-label="View">
          {[
            { id: "single", label: "Single" },
            { id: "collection", label: `Collection ${TOTAL_WIRED}/${GENESIS_SET.length}` },
          ].map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={view === v.id}
              className={view === v.id ? "is-active" : ""}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {view === "collection" && (
        <section className="ct-collection">
          {COLLECTION.map((group) => (
            <div className="ct-binder-group" key={group.title}>
              <p className="ct-binder-title">
                {group.title}
                <span>{group.wired}/{group.cards.length}</span>
              </p>
              <div className="ct-binder">
                {group.cards.map((slot) => (
                  <button
                    key={slot.id}
                    className={`ct-slot ct-slot--${slot.rarity}${slot.art ? "" : " is-empty"}`}
                    onClick={() => { setActive(slot.id); setView("single"); }}
                    title={slot.art ? `${slot.name} — open in template` : `${slot.name} — art pending`}
                  >
                    <span className="ct-slot-art">
                      {slot.art ? (
                        <TradingCard
                          data={slot.template}
                          scale={THUMB_SCALE}
                          interactive={false}
                          templateStyle="terminal"
                        />
                      ) : (
                        <span className="ct-slot-pending" aria-hidden>+</span>
                      )}
                    </span>
                    <span className="ct-slot-name">{slot.name}</span>
                    <span className="ct-slot-rarity">{slot.rarity}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="ct-binder-group">
            <p className="ct-binder-title">
              Rogues Gallery
              <span>{ROGUES_DEBUTED}/{ROGUE_ENTRIES.length}</span>
            </p>
            <div className="ct-binder">
              {ROGUE_ENTRIES.map((rogue) =>
                rogue.status === "debuted" ? (
                  <button
                    key={rogue.id}
                    className="ct-slot"
                    style={{ "--slot-accent": rogue.signatureColor }}
                    onClick={() => { setActive(rogue.debutCardId); setView("single"); }}
                    title={`${rogue.name} — debuts in ${rogue.debutCard.name}`}
                  >
                    <span className="ct-slot-art">
                      <TradingCard
                        data={rogue.template}
                        scale={THUMB_SCALE}
                        interactive={false}
                        templateStyle="terminal"
                      />
                    </span>
                    <span className="ct-slot-name">{rogue.name}</span>
                    <span className="ct-slot-rarity">{rogue.debutCard.name}</span>
                  </button>
                ) : (
                  <div
                    key={rogue.id}
                    className="ct-slot ct-slot--rogue-pending"
                    style={{ "--rogue-glow": rogue.signatureColor }}
                    title={`${rogue.name} — not yet debuted`}
                  >
                    <span className="ct-slot-art">
                      <span className="ct-rogue-shape" aria-hidden />
                      <span className="ct-rogue-mystery" aria-hidden>???</span>
                    </span>
                    <span className="ct-slot-name">???</span>
                    <span className="ct-slot-rarity">pending</span>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      )}

      <div className="ct-workspace" hidden={view !== "single"}>
        <aside className="ct-column ct-picker">
          <p className="ct-column-title">Cards</p>
          {CARD_GROUPS.map((group) => (
            <React.Fragment key={group.title}>
              {/* Rogues sit below the type groups, above the Blank utility —
                  pure navigation into cards the groups above already list. */}
              {group.title === "Blank" && (
                <div className="ct-group">
                  <p className="ct-group-title">Rogues</p>
                  <div className="ct-card-list">
                    {ROGUE_ENTRIES.map((rogue) => (
                      <button
                        key={rogue.id}
                        className={`ct-card-btn${rogue.debutCardId && active === rogue.debutCardId ? " is-active" : ""}`}
                        aria-pressed={Boolean(rogue.debutCardId) && active === rogue.debutCardId}
                        disabled={!rogue.debutCardId}
                        onClick={() => rogue.debutCardId && setActive(rogue.debutCardId)}
                        title={
                          rogue.debutCardId
                            ? `${rogue.name} — open ${rogue.debutCard.name}`
                            : `${rogue.name} — no debut card in the set yet`
                        }
                      >
                        <span className="ct-card-name" style={{ color: rogue.signatureColor }}>
                          {rogue.name}
                        </span>
                        <span className="ct-card-meta">
                          {rogue.status === "debuted"
                            ? `debuts in ${rogue.debutCard.name}`
                            : rogue.debutCard
                              ? `pending · ${rogue.debutCard.name}`
                              : "pending"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="ct-group">
                <p className="ct-group-title">{group.title}</p>
                <div className="ct-card-list">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={`ct-card-btn${active === item.id ? " is-active" : ""}`}
                      aria-pressed={active === item.id}
                      onClick={() => setActive(item.id)}
                    >
                      <span className="ct-card-name">{item.name || item.card.name}</span>
                      <span className="ct-card-meta">{item.meta}</span>
                    </button>
                  ))}
                </div>
              </div>
            </React.Fragment>
          ))}
        </aside>

        <section className="ct-stage">
          <TradingCard data={card} scale={scale} templateStyle="terminal" />
        </section>

        <aside className="ct-column ct-effects">
          <p className="ct-column-title">Effects</p>

          <div className="ct-group">
            <p className="ct-group-title">Foil</p>
            <div className="ct-seg" role="radiogroup" aria-label="Foil style">
              {[
                { id: "hero", label: "Holo" },
                { id: "v", label: "V" },
                { id: "radiant", label: "Radiant" },
                { id: "subtle", label: "Subtle" },
              ].map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={foilStyle === f.id}
                  className={foilStyle === f.id ? "is-active" : ""}
                  onClick={() => setFoilStyle(f.id)}
                  title={`Foil: ${f.label}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ct-group">
            <p className="ct-group-title">
              Frame{autoFrame ? ` · rarity → ${autoFrame.label}` : ""}
            </p>
            <div className="ct-seg ct-seg--3" role="radiogroup" aria-label="Frame">
              <button
                role="radio"
                aria-checked={frameOverride === null}
                className={frameOverride === null ? "is-active" : ""}
                onClick={() => setFrameOverride(null)}
                title="Follow the card's rarity"
              >
                Auto
              </button>
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={frameOverride === f.id}
                  className={frameOverride === f.id ? "is-active" : ""}
                  onClick={() => setFrameOverride(f.id)}
                  title={
                    f.id === "rainbow"
                      ? "Rainbow is reserved for the three terminal foils"
                      : `Frame: ${f.label}`
                  }
                >
                  {f.label}
                </button>
              ))}
              <button
                role="radio"
                aria-checked={frameOverride === "none"}
                className={frameOverride === "none" ? "is-active" : ""}
                onClick={() => setFrameOverride("none")}
              >
                None
              </button>
            </div>
          </div>

          <div className="ct-group">
            <p className="ct-group-title">
              FX overlays <span className="ct-count">{fxPicks.length}/{MAX_FX}</span>
            </p>
            <div className="ct-fx-list">
              {FX_OVERLAYS.map((f) => {
                const i = fxPicks.indexOf(f.src);
                return (
                  <button
                    key={f.id}
                    className={`ct-fx-chip${i > -1 ? " is-active" : ""}`}
                    aria-pressed={i > -1}
                    onClick={() => toggleFx(f.src)}
                    title={f.label}
                  >
                    {i > -1 && <span className="ct-fx-order">{i + 1}</span>}
                    {f.label}
                  </button>
                );
              })}
            </div>
            {fxPicks.length > 0 && (
              <>
                <div className="ct-seg ct-seg--3">
                  {FX_BLEND_MODES.map((m) => (
                    <button
                      key={m}
                      className={fxBlend === m ? "is-active" : ""}
                      onClick={() => setFxBlend(m)}
                      title={`Blend: ${m}`}
                    >
                      {m === "plus-lighter" ? "plus" : m}
                    </button>
                  ))}
                </div>
                <label>
                  Opacity
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={fxOpacity}
                    onChange={(e) => setFxOpacity(parseFloat(e.target.value))}
                  />
                  <span>{Math.round(fxOpacity * 100)}%</span>
                </label>
                <button className="ct-toggle" onClick={() => setFxPicks([])}>
                  Clear FX
                </button>
              </>
            )}
          </div>

          <div className={`ct-group${hasArt ? "" : " is-disabled"}`}>
            <p className="ct-group-title">
              Art framing{hasArt ? "" : " · no art"}
            </p>
            <label>
              Art Y
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={artFocusY}
                disabled={!hasArt}
                onChange={(e) => setArtFocusY(parseInt(e.target.value, 10))}
              />
              <span>{artFocusY}%</span>
            </label>
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="2.6"
                step="0.05"
                value={artZoom}
                disabled={!hasArt}
                onChange={(e) => setArtZoom(parseFloat(e.target.value))}
              />
              <span>{artZoom.toFixed(2)}×</span>
            </label>
          </div>

          <div className="ct-group">
            <p className="ct-group-title">View</p>
            <label>
              Scale
              <input
                type="range"
                min="0.4"
                max="1"
                step="0.01"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
              />
              <span>{scale.toFixed(2)}×</span>
            </label>
          </div>
        </aside>
      </div>

      <aside className="ct-notes">
        <div>
          <strong>744 × 1038</strong>
          <span>standard print</span>
        </div>
        <div>
          <strong>1488 × 2076</strong>
          <span>retina export</span>
        </div>
        <div>
          <strong>JSON-driven</strong>
          <span>swap <code>cardType</code>, <code>rarity</code>, art</span>
        </div>
        <div>
          <strong>Holo foil</strong>
          <span>scales with cursor lift</span>
        </div>
      </aside>
    </main>
  );
}

const PAGE_STYLES = `
  .ct-shell {
    min-height: 100vh;
    padding: 32px 32px 80px;
    background:
      radial-gradient(circle at 14% 20%, rgba(255,94,196,.14), transparent 32%),
      radial-gradient(circle at 84% 24%, rgba(83,255,214,.12), transparent 30%),
      linear-gradient(135deg, #04060a 0%, #0a0d12 50%, #04060a 100%);
    color: #effff9;
    font-family: "IBM Plex Sans", "Inter", system-ui, sans-serif;
    position: relative;
    overflow-x: hidden;
  }

  .ct-grid {
    position: fixed;
    inset: 0;
    z-index: 0;
    opacity: .18;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(83,255,214,.22) 1px, transparent 1px),
      linear-gradient(90deg, rgba(83,255,214,.22) 1px, transparent 1px);
    background-size: 60px 60px;
    transform: perspective(700px) rotateX(58deg) translateY(-200px) scale(2);
    transform-origin: top center;
  }

  .ct-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 28px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }

  .ct-kicker {
    margin: 0;
    color: #53ffd6;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    letter-spacing: .3em;
    text-transform: uppercase;
  }

  .ct-top h1 {
    margin: 6px 0 6px;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: clamp(38px, 5vw, 64px);
    line-height: .9;
    color: #fff7ce;
    letter-spacing: .02em;
  }

  .ct-sub {
    margin: 0;
    max-width: 540px;
    color: rgba(239,255,249,.72);
    line-height: 1.45;
    font-size: 14px;
  }

  .ct-sub code {
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    color: #ffd166;
    padding: 1px 6px;
    background: rgba(255,209,102,.08);
    border-radius: 4px;
  }

  .ct-view-toggle {
    display: flex;
    gap: 6px;
    padding: 6px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px;
    background: rgba(0,0,0,.42);
  }

  .ct-view-toggle button {
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.04);
    color: #effff9;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: .14em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 160ms ease;
  }

  .ct-view-toggle button:hover { border-color: #53ffd6; }

  .ct-view-toggle button.is-active {
    border-color: #ffd166;
    color: #ffd166;
    background: rgba(255,209,102,.1);
    box-shadow: 0 0 18px rgba(255,209,102,.25);
  }

  /* ── Collection binder ──────────────────────────────────────────────── */
  .ct-collection {
    position: relative;
    z-index: 1;
    max-width: 1600px;
    margin: 0 auto 60px;
    display: flex;
    flex-direction: column;
    gap: 34px;
  }

  .ct-binder-title {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 0 0 12px;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 24px;
    letter-spacing: .12em;
    color: #fff7ce;
  }

  .ct-binder-title span {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: .2em;
    color: rgba(83,255,214,.8);
  }

  .ct-binder {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
  }

  /* Slot = one binder pocket, held at card aspect so filled and empty
     slots line up on the same grid. */
  .ct-slot {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 0 8px;
    border: 0;
    background: none;
    color: #effff9;
    font-family: "IBM Plex Mono", monospace;
    text-align: left;
    cursor: pointer;
  }

  /* Filled slots hold a real TradingCard at THUMB_SCALE, so the pocket is
     sized by the card itself; empty slots need the aspect ratio to match. */
  .ct-slot-art {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 744 / 1038;
    border-radius: 9px;
    transition: transform 160ms ease, filter 160ms ease;
  }

  .ct-slot-art > .tc-stage {
    border-radius: 9px;
    overflow: hidden;
  }

  .ct-slot:hover .ct-slot-art {
    transform: translateY(-5px);
    filter: drop-shadow(0 12px 22px rgba(0,0,0,.55))
            drop-shadow(0 0 14px var(--slot-accent, rgba(83,255,214,.4)));
  }

  .ct-slot:focus-visible .ct-slot-art {
    outline: 2px solid #53ffd6;
    outline-offset: 4px;
  }

  /* Empty slot: dashed pocket at card aspect, dimmed label. */
  .ct-slot.is-empty .ct-slot-art {
    border: 1px dashed rgba(255,255,255,.2);
    background:
      repeating-linear-gradient(
        45deg,
        rgba(255,255,255,.02) 0 8px,
        transparent 8px 16px
      );
  }

  .ct-slot-pending {
    font-size: 22px;
    line-height: 1;
    color: rgba(255,255,255,.22);
  }

  .ct-slot.is-empty .ct-slot-name { color: rgba(239,255,249,.42); }

  .ct-slot-name {
    font-size: 11px;
    letter-spacing: .04em;
    line-height: 1.25;
  }

  .ct-slot-rarity {
    font-size: 9px;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--slot-accent, rgba(239,255,249,.5));
    opacity: .85;
  }

  .ct-slot.is-empty .ct-slot-rarity { opacity: .4; }

  /* Pending rogue: unfilled-Pokédex slot — dark shape, signature glow, ???.
     Not a button; the reveal is flipping status in rogues.js, not clicking. */
  .ct-slot--rogue-pending { cursor: default; }

  .ct-slot--rogue-pending .ct-slot-art {
    border: 1px solid color-mix(in srgb, var(--rogue-glow) 38%, transparent);
    background:
      radial-gradient(ellipse 70% 52% at 50% 40%,
        color-mix(in srgb, var(--rogue-glow) 26%, transparent), transparent 70%),
      linear-gradient(160deg, #0a0d14, #05070b);
    box-shadow:
      inset 0 0 36px rgba(0,0,0,.72),
      0 0 16px color-mix(in srgb, var(--rogue-glow) 18%, transparent);
  }

  .ct-slot--rogue-pending:hover .ct-slot-art {
    transform: none;
    filter: drop-shadow(0 0 16px color-mix(in srgb, var(--rogue-glow) 40%, transparent));
  }

  /* The shadowed figure the glow backlights. */
  .ct-rogue-shape {
    position: absolute;
    left: 24%;
    right: 24%;
    top: 20%;
    bottom: 30%;
    background:
      radial-gradient(circle at 50% 16%, #04060a 0 17%, transparent 18%),
      radial-gradient(ellipse 50% 34% at 50% 72%, #04060a 0 98%, transparent 100%);
  }

  .ct-rogue-mystery {
    position: relative;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 30px;
    letter-spacing: .12em;
    color: var(--rogue-glow);
    opacity: .8;
    text-shadow: 0 0 16px var(--rogue-glow);
  }

  .ct-slot--rogue-pending .ct-slot-name { color: rgba(239,255,249,.42); }
  .ct-slot--rogue-pending .ct-slot-rarity { --slot-accent: var(--rogue-glow); opacity: .55; }

  /* Rarity accents match TradingCard's RARITY_ACCENT map. */
  .ct-slot--common { --slot-accent: #9cfce9; }
  .ct-slot--uncommon { --slot-accent: #53ffd6; }
  .ct-slot--rare { --slot-accent: #67c7ff; }
  .ct-slot--mythic { --slot-accent: #ff5ec4; }
  .ct-slot--terminal-foil { --slot-accent: #ffe27a; }

  /* Cards on the left, stage in the middle, effects on the right. Below
     1100px the columns stack and the stage leads. */
  .ct-workspace {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr) 240px;
    align-items: start;
    gap: 24px;
    max-width: 1600px;
    margin: 0 auto 40px;
  }

  .ct-column {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 16px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 14px;
    background: rgba(0,0,0,.42);
    backdrop-filter: blur(10px);
    position: sticky;
    top: 24px;
  }

  .ct-column-title {
    margin: 0;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 20px;
    letter-spacing: .12em;
    color: #fff7ce;
  }

  .ct-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ct-group.is-disabled {
    opacity: .42;
  }

  .ct-group-title {
    margin: 0;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .24em;
    text-transform: uppercase;
    color: rgba(83,255,214,.75);
  }

  .ct-card-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    /* Coins (28) and Actions (33) make a long list — cap each group so the
       picker stays compact and every category header stays reachable. */
    max-height: 320px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .ct-column button {
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.04);
    color: #effff9;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: .12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 160ms ease;
  }

  .ct-column button:hover {
    border-color: #53ffd6;
    background: rgba(83,255,214,.08);
  }

  .ct-column button.is-active {
    border-color: #ffd166;
    color: #ffd166;
    background: rgba(255,209,102,.1);
    box-shadow: 0 0 18px rgba(255,209,102,.25);
  }

  .ct-card-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 9px 11px;
    text-align: left;
  }

  .ct-card-name {
    font-size: 12px;
    letter-spacing: .08em;
  }

  .ct-card-meta {
    font-size: 9px;
    letter-spacing: .2em;
    color: rgba(239,255,249,.5);
  }

  .ct-card-btn.is-active .ct-card-meta {
    color: rgba(255,209,102,.7);
  }

  /* Rogues with no debut card in the set yet (Deploydra, Emissio). */
  .ct-card-btn:disabled {
    opacity: .38;
    cursor: default;
  }

  .ct-card-btn:disabled:hover {
    border-color: rgba(255,255,255,.16);
    background: rgba(255,255,255,.04);
  }

  .ct-seg {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .ct-seg--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

  .ct-seg button,
  .ct-toggle {
    padding: 9px 8px;
  }

  .ct-count {
    float: right;
    color: rgba(255,209,102,.85);
  }

  .ct-fx-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
    max-height: 210px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .ct-fx-chip {
    position: relative;
    padding: 7px 6px;
    font-size: 10px;
    letter-spacing: .06em;
  }

  .ct-fx-order {
    display: inline-block;
    min-width: 13px;
    margin-right: 4px;
    border-radius: 3px;
    background: #ffd166;
    color: #150e00;
    font-size: 9px;
    font-weight: 700;
  }

  .ct-toggle {
    width: 100%;
  }

  .ct-column label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(0,0,0,.4);
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: rgba(239,255,249,.7);
  }

  .ct-column input {
    flex: 1;
    min-width: 0;
    accent-color: #53ffd6;
  }

  .ct-column input:disabled {
    cursor: not-allowed;
  }

  .ct-column label span {
    color: #fff7ce;
    min-width: 40px;
    text-align: right;
  }

  .ct-stage {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: 10px 0 30px;
  }

  @media (max-width: 1100px) {
    .ct-workspace {
      grid-template-columns: minmax(0, 1fr);
    }

    .ct-column {
      position: static;
    }

    .ct-picker { order: 2; }
    .ct-stage { order: 1; }
    .ct-effects { order: 3; }

    .ct-card-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
  }

  .ct-notes {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    max-width: 880px;
    margin: 0 auto;
  }

  .ct-notes > div {
    padding: 14px 16px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    background: rgba(0,0,0,.34);
    backdrop-filter: blur(10px);
  }

  .ct-notes strong {
    display: block;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 22px;
    color: #fff7ce;
    letter-spacing: .04em;
  }

  .ct-notes span {
    display: block;
    margin-top: 4px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: rgba(239,255,249,.55);
  }

  .ct-notes code {
    font-size: 10px;
    color: #ffd166;
  }
`;
