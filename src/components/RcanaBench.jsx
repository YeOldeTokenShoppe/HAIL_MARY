"use client";

import React, { useEffect, useMemo, useState } from "react";
import RcanaCard from "./RcanaCard";
import {
  RCANA_DEMO,
  RCANA_RARITIES,
  RARITY_ORDER,
  POINT_TYPES,
  RCANA_DEPTHS,
  FX_BLENDS,
  FX_CLIPS,
  toRcanaCard,
} from "../game/rcana/cardFace.js";

// The R-cana construction bench. Everything the face draws programmatically
// is editable here, so a slot can be proved against real text before any of
// the 88 are written — a long ability, a four-digit Hydro, a name that has to
// shrink to fit the banner.
export default function RcanaBench() {
  const [cardId, setCardId] = useState(RCANA_DEMO[0].id);
  const [scale, setScale] = useState(0.62);
  const [depth, setDepth] = useState(1);
  const [showSlots, setShowSlots] = useState(false);
  const [showFacets, setShowFacets] = useState(false);
  const [classFont, setClassFont] = useState("blackletter");

  // Device tilt. iOS hands out the orientation sensor only from inside a tap
  // (DeviceOrientationEvent.requestPermission), Android just fires events,
  // and a desktop has no sensor — so the control only appears where there is
  // one to ask for, and asks the first time it is switched on.
  const [gyro, setGyro] = useState(false);
  const [hasSensor, setHasSensor] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const touch = window.matchMedia("(hover: none)").matches;
    setHasSensor(touch && "DeviceOrientationEvent" in window);
  }, []);
  const toggleGyro = async () => {
    if (gyro) return setGyro(false);
    try {
      const ask = window.DeviceOrientationEvent?.requestPermission;
      if (typeof ask === "function") {
        const res = await ask();
        if (res !== "granted") return;
      }
      setGyro(true);
    } catch {
      /* denied or unsupported — stay off */
    }
  };
  const [hideFrame, setHideFrame] = useState(false);
  const [showFx, setShowFx] = useState(true);
  const [fxBlend, setFxBlend] = useState(null); // null = whatever the card wires
  const [fxOpacity, setFxOpacity] = useState(null);
  const [fxClip, setFxClip] = useState(null);
  // null means "follow the card file". Once a slider moves, the bench pins
  // the value and edits to cardFace.js stop showing — Reset hands control
  // back, so the two never silently fight.
  const [nudge, setNudge] = useState(null);
  const [inkOnTop, setInkOnTop] = useState(false);

  const source = RCANA_DEMO.find((c) => c.id === cardId) || RCANA_DEMO[0];
  const [rarity, setRarity] = useState(source.rarity);
  const [halo, setHalo] = useState(source.halo);
  const [hydro, setHydro] = useState(source.hydro);
  const [ability, setAbility] = useState(source.ability);
  const [flavor, setFlavor] = useState(source.flavor);
  // The edit fields belong to ONE card: switching cards reloads them from the
  // new card's face, or the bear would print the devil's lines.
  useEffect(() => {
    setRarity(source.rarity);
    setHalo(source.halo);
    setHydro(source.hydro);
    setAbility(source.ability);
    setFlavor(source.flavor);
  }, [source]);

  const card = useMemo(() => {
    const c = toRcanaCard(source, { rarity, halo, hydro, ability, flavor });
    // The bench overrides blend and opacity across every sheet at once; null
    // leaves each sheet on whatever the card itself wired.
    if (fxBlend || fxOpacity != null || fxClip) {
      c.fxLayers = c.fxLayers.map((l) => ({
        ...l,
        blend: fxBlend || l.blend,
        clip: fxClip || l.clip,
        opacity: fxOpacity != null ? fxOpacity : l.opacity,
      }));
    }
    if (nudge) {
      c.artLayers = c.artLayers.map((l) =>
        l.id === nudge.id ? { ...l, offset: { x: nudge.x, y: nudge.y } } : l
      );
    }
    return c;
  }, [source, rarity, halo, hydro, ability, flavor, fxBlend, fxOpacity, fxClip, nudge]);

  const fxShown = card.fxLayers || [];
  // Nudge whichever layer rides in front of the frame — the one whose
  // authored overhang has to meet the border exactly.
  const front = (card.artLayers || []).find((l) => l.z > RCANA_DEPTHS.plate);
  const nx = nudge?.x ?? front?.offset.x ?? 0;
  const ny = nudge?.y ?? front?.offset.y ?? 0;

  return (
    <div className="rb-shell">
      <aside className="rb-col">
        <p className="rb-title">Card</p>
        <div className="rb-list">
          {RCANA_DEMO.map((c) => (
            <button
              key={c.id}
              className={c.id === cardId ? "is-active" : ""}
              onClick={() => setCardId(c.id)}
            >
              <span className="rb-name">{c.name}</span>
              <span className="rb-meta">
                {c.number} · {c.cardClass}
              </span>
            </button>
          ))}
        </div>

        <p className="rb-title">Stack</p>
        <ul className="rb-layers">
          {[...fxShown].reverse().map((l) => (
            <li key={l.id} className="rb-layer--fx">
              <b>{l.id}</b>
              <code>{l.src || "—"}</code>
              <em>z +{l.z}</em>
            </li>
          ))}
          <li className="rb-layer--plate">
            <b>frame + ink</b>
            <code>{card.frameImage || "—"}</code>
            <em>z +{RCANA_DEPTHS.plate}</em>
          </li>
          {/* Listed near to far, the way the stack reads looking into the
              card, which is the reverse of the authoring order. */}
          {[...(card.artLayers || [])].reverse().map((l) => (
            <li key={l.id}>
              <b>{l.id}</b>
              <code>{l.src || "—"}</code>
              <em>z {l.z}</em>
            </li>
          ))}
          {card.combinedPlate && (
            <li>
              <b>art</b>
              <code>baked into the frame image</code>
            </li>
          )}
        </ul>
      </aside>

      <section className="rb-stage">
        <RcanaCard
          data={card}
          scale={scale}
          depth={depth}
          showSlots={showSlots}
          showFacets={showFacets}
          classFont={classFont}
          gyro={gyro}
          hideFrame={hideFrame}
          showFx={showFx}
          inkOnTop={inkOnTop}
          sway
        />
      </section>

      <aside className="rb-col">
        <p className="rb-title">Construction</p>

        <label className="rb-range">
          <span>
            Parallax depth <b>{depth.toFixed(2)}×</b>
          </span>
          <input
            type="range"
            min="0"
            max="2.5"
            step="0.05"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          />
        </label>

        <label className="rb-range">
          <span>
            Scale <b>{scale.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min="0.2"
            max="1.2"
            step="0.01"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </label>

        <div className="rb-checks">
          <label>
            <input
              type="checkbox"
              checked={showSlots}
              onChange={(e) => setShowSlots(e.target.checked)}
            />
            Slot outlines
          </label>
          <label title="Typeface for the class label in the tab">
            Class type
            <select value={classFont} onChange={(e) => setClassFont(e.target.value)}>
              <option value="blackletter">Blackletter (default)</option>
              <option value="bebas">Bebas (caps)</option>
              <option value="grenze">Grenze Gotisch</option>
              <option value="unifraktur">UnifrakturCook</option>
              <option value="maguntia">UnifrakturMaguntia</option>
              <option value="pirata">Pirata One</option>
            </select>
          </label>
          <label title="Where each FX sheet's light facets sit. Every ring should be on flame.">
            <input
              type="checkbox"
              checked={showFacets}
              onChange={(e) => setShowFacets(e.target.checked)}
            />
            FX facets
          </label>
          {hasSensor && (
            <label title="Tilt the card by tilting the device. The angle you hold it at when switching on is flat.">
              <input type="checkbox" checked={gyro} onChange={toggleGyro} />
              Tilt with device
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={hideFrame}
              onChange={(e) => setHideFrame(e.target.checked)}
            />
            Hide frame
          </label>
          <label>
            <input
              type="checkbox"
              checked={showFx}
              onChange={(e) => setShowFx(e.target.checked)}
            />
            FX
          </label>
          <label>
            <input
              type="checkbox"
              checked={inkOnTop}
              onChange={(e) => setInkOnTop(e.target.checked)}
            />
            Ink above FX
          </label>
        </div>

        {fxShown.length > 0 && showFx && (
          <>
            <p className="rb-title">FX clip</p>
            <div className="rb-seg">
              {FX_CLIPS.map((c) => (
                <button
                  key={c}
                  className={c === (fxClip || fxShown[0].clip) ? "is-active" : ""}
                  style={{ "--chip": "#ff9b4d" }}
                  onClick={() => setFxClip(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <p className="rb-title">FX blend</p>
            <div className="rb-seg">
              {FX_BLENDS.map((b) => (
                <button
                  key={b}
                  className={b === (fxBlend || fxShown[0].blend) ? "is-active" : ""}
                  style={{ "--chip": "#f2c230" }}
                  onClick={() => setFxBlend(b)}
                >
                  {b}
                </button>
              ))}
            </div>
            <label className="rb-range">
              <span>
                FX opacity <b>{(fxOpacity ?? fxShown[0].opacity).toFixed(2)}</b>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={fxOpacity ?? fxShown[0].opacity}
                onChange={(e) => setFxOpacity(Number(e.target.value))}
              />
            </label>
          </>
        )}

        {front && (
          <>
            <p className="rb-title">
              Nudge {front.id}{" "}
              <span className="rb-src">
                {nudge ? "slider" : "from card file"}
              </span>
              {nudge && (
                <button className="rb-reset" onClick={() => setNudge(null)}>
                  reset
                </button>
              )}
            </p>
            <label className="rb-range">
              <span>
                down <b>{ny.toFixed(2)}%</b>
              </span>
              <input
                type="range"
                min="-4"
                max="4"
                step="0.05"
                value={ny}
                onChange={(e) => setNudge({ id: front.id, x: nx, y: Number(e.target.value) })}
              />
            </label>
            <label className="rb-range">
              <span>
                right <b>{nx.toFixed(2)}%</b>
              </span>
              <input
                type="range"
                min="-4"
                max="4"
                step="0.05"
                value={nx}
                onChange={(e) => setNudge({ id: front.id, x: Number(e.target.value), y: ny })}
              />
            </label>
          </>
        )}

        <p className="rb-title">Points</p>
        <div className="rb-pair">
          <label>
            <span>{POINT_TYPES.halo.label}</span>
            <input
              type="number"
              value={halo ?? ""}
              onChange={(e) => setHalo(e.target.value === "" ? null : Number(e.target.value))}
            />
            <i>{POINT_TYPES.halo.rule}</i>
          </label>
          <label>
            <span>{POINT_TYPES.hydro.label}</span>
            <input
              type="number"
              value={hydro ?? ""}
              onChange={(e) => setHydro(e.target.value === "" ? null : Number(e.target.value))}
            />
            <i>{POINT_TYPES.hydro.rule}</i>
          </label>
        </div>

        <p className="rb-title">Rarity</p>
        <div className="rb-seg">
          {RARITY_ORDER.map((r) => (
            <button
              key={r}
              className={r === rarity ? "is-active" : ""}
              style={{ "--chip": RCANA_RARITIES[r].ink }}
              onClick={() => setRarity(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <p className="rb-title">Body</p>
        <textarea
          className="rb-text"
          rows={4}
          value={ability || ""}
          placeholder="Ability"
          onChange={(e) => setAbility(e.target.value)}
        />
        <textarea
          className="rb-text rb-text--flavor"
          rows={2}
          value={flavor || ""}
          placeholder="Flavour"
          onChange={(e) => setFlavor(e.target.value)}
        />
      </aside>

      <style>{BENCH_STYLES}</style>
    </div>
  );
}

const BENCH_STYLES = `
.rb-shell {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 270px;
  gap: 18px;
  align-items: start;
  padding: 18px 22px 48px;
}
.rb-col { display: flex; flex-direction: column; gap: 10px; }
.rb-src {
  font-family: ui-monospace, monospace; font-size: 9px; letter-spacing: 0;
  text-transform: none; color: #07ddf0; margin-left: 6px;
}
.rb-reset {
  margin-left: 6px; padding: 1px 6px; cursor: pointer;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14);
  border-radius: 999px; color: #b9c9d4; font: 500 9px/1.4 ui-monospace, monospace;
}
.rb-title {
  margin: 10px 0 0;
  font: 600 10px/1 ui-sans-serif, system-ui;
  letter-spacing: .2em; text-transform: uppercase;
  color: #6f8390;
}
.rb-stage {
  display: grid; place-items: center;
  min-height: 70vh;
  padding: 24px 0;
}
.rb-list { display: flex; flex-direction: column; gap: 4px; }
.rb-list button {
  display: flex; flex-direction: column; gap: 2px;
  text-align: left; padding: 8px 10px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 7px; color: #d6e2ea; cursor: pointer;
}
.rb-list button.is-active {
  background: rgba(7,221,240,.1);
  border-color: rgba(7,221,240,.45);
}
.rb-name { font: 600 13px/1.2 ui-sans-serif, system-ui; }
.rb-meta { font: 500 10px/1.2 ui-monospace, monospace; color: #7c8e9b; }

.rb-layers { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.rb-layers li {
  display: grid; gap: 2px;
  padding: 6px 8px;
  background: rgba(255,255,255,.02);
  border-radius: 6px;
}
.rb-layers li { position: relative; }
.rb-layers b { font: 600 10px/1 ui-sans-serif, system-ui; letter-spacing: .12em; text-transform: uppercase; color: #8fa3b0; }
.rb-layers em {
  position: absolute; top: 6px; right: 8px;
  font: 500 9px/1 ui-monospace, monospace; font-style: normal; color: #5f7180;
}
.rb-layer--plate { background: rgba(242,194,48,.07) !important; }
.rb-layer--plate b { color: #f2c230; }
.rb-layer--fx { background: rgba(255,122,40,.08) !important; }
.rb-layer--fx b { color: #ff9b4d; }
.rb-layers code { font: 400 10px/1.35 ui-monospace, monospace; color: #cfe0ea; word-break: break-all; }

.rb-range { display: grid; gap: 5px; }
.rb-range span { font: 500 11px/1 ui-sans-serif, system-ui; color: #9db0bd; }
.rb-range b { color: #07ddf0; }
.rb-range input { width: 100%; accent-color: #07ddf0; }

.rb-checks { display: flex; gap: 14px; flex-wrap: wrap; }
.rb-checks label { display: flex; align-items: center; gap: 6px; font: 500 11px/1 ui-sans-serif, system-ui; color: #9db0bd; cursor: pointer; }
.rb-checks input { accent-color: #07ddf0; }

.rb-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rb-pair label { display: grid; gap: 3px; }
.rb-pair span { font: 600 10px/1 ui-sans-serif, system-ui; letter-spacing: .1em; text-transform: uppercase; color: #9db0bd; }
.rb-pair i { font: 400 9px/1 ui-sans-serif, system-ui; font-style: normal; color: #6b7d8a; }
.rb-pair input {
  width: 100%; padding: 6px 8px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px; color: #e6f1f7;
  font: 600 14px/1 ui-sans-serif, system-ui;
}

.rb-seg { display: flex; flex-wrap: wrap; gap: 4px; }
.rb-seg button {
  padding: 5px 9px; border-radius: 999px; cursor: pointer;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  color: #b9c9d4;
  font: 600 10px/1 ui-sans-serif, system-ui; letter-spacing: .06em;
}
.rb-seg button.is-active {
  background: var(--chip); border-color: var(--chip); color: #06131a;
}

.rb-text {
  width: 100%; resize: vertical;
  padding: 8px 10px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 7px; color: #e6f1f7;
  font: 400 12px/1.45 ui-sans-serif, system-ui;
}
.rb-text--flavor { font-style: italic; color: #bccbd6; }

@media (max-width: 1100px) {
  .rb-shell { grid-template-columns: 1fr; }
  .rb-stage { min-height: 0; }
}
`;
