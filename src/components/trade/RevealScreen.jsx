"use client";
import React, { useState } from "react";
import SitePalFeed from "@/components/trade/SitePalFeed";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";
import { coverageNote } from "@/components/GameOverlay";

// Reveal screen — outcome + Brier + the case truth + each consultant's
// vindication line + the decisive lens. Self-contained off the case data.
const OUT = {
  aligned: { label: "ALIGNED", color: "#4dffaa", sub: "you called it" },
  missed: { label: "MISSED", color: "#ff5454", sub: "wrong read" },
  abstained: { label: "ABSTAINED", color: "#ffd23a", sub: "you held back" },
};

// vindication values are sometimes {text,audio}, sometimes a bare string.
const vtext = (v) => (typeof v === "string" ? v : v?.text || "");

export default function RevealScreen({ caseData, verdict, confidence = 0.5, investigated = [], kitNote = null, speakerKey, speakerSceneId, onExit }) {
  const correct = caseData.correctVerdict;
  const outcome = verdict === "abstain" ? "abstained" : verdict === correct ? "aligned" : "missed";
  const o = OUT[outcome];
  const wasScam = correct === "doubt";
  const brier = Math.pow(confidence - (wasScam ? 1 : 0), 2);
  // Breadth nudge (shared with desktop) — encourages cross-checking multiple
  // consultants instead of reading the case through one character's lens.
  const { note: lensNote, tone: lensTone } = coverageNote(caseData, investigated);

  // Hero speaker — the last consultant the player sat with (chosen by the parent)
  // delivers their vindication line live via SitePal, reusing the channel's exact
  // plumbing. The rest of the council stays as text. Caption falls back to the raw
  // line until SitePal emits its audio-synced transcript (mirrors ChannelView).
  const [spkCaption, setSpkCaption] = useState("");
  const speaker = speakerKey ? caseData.stations[speakerKey] : null;
  const speakerMeta = speakerKey ? CHARACTER_META[speakerKey] : null;
  const speakerRaw = speaker?.vindication?.[outcome];
  const speakerText = vtext(speakerRaw);
  const speakerLine = speaker && speakerText
    ? {
        key: `${speakerKey}-${outcome}`,
        audio: (speakerRaw && typeof speakerRaw === "object" ? speakerRaw.audio : null) || null,
        text: speakerText,
        voice: speaker.voice,
      }
    : null;

  return (
    <div className="rv-root">
      <div className="rv-header"><span className="rv-title">CASE CLOSED · {caseData.ticker}</span></div>

      <div className="rv-body">
        <div className="rv-banner" style={{ "--c": o.color }}>
          <span className="rv-out">{o.label}</span>
          <span className="rv-sub">{o.sub}</span>
          <span className="rv-brier">BRIER {brier.toFixed(2)} <i>· 0 = perfect</i></span>
        </div>

        {speakerSceneId && speakerLine && (
          <div className="rv-feed">
            <div className="rv-feed-frame">
              <SitePalFeed sceneId={speakerSceneId} line={speakerLine} onCaption={setSpkCaption} />
              <span className="rv-feed-live" style={{ "--c": speakerMeta?.color || "#4dffaa" }}>◉ ON THE LINE</span>
            </div>
            <div className="rv-feed-name" style={{ color: speakerMeta?.color || "#4dffaa" }}>
              {speakerMeta?.sigil} {speakerMeta?.name}
            </div>
            <div className="rv-feed-cap">{spkCaption || speakerText}</div>
          </div>
        )}

        {caseData.reveal?.summary && <div className="rv-truth">{caseData.reveal.summary}</div>}
        {caseData.reveal?.voices?.[verdict] && <div className="rv-narr">{caseData.reveal.voices[verdict]}</div>}

        {lensNote && (
          <div
            className="rv-decisive"
            style={{ "--dc": lensTone === "affirm" ? "#4dffaa" : "#2fd6d6" }}
          >
            ✦ {lensNote}
          </div>
        )}

        {/* Kit callout (§3.4) — flavor, not score: what the cards contributed. */}
        {kitNote && (
          <div className="rv-decisive" style={{ "--dc": "#8ee9ff" }}>
            ⟡ {kitNote}
          </div>
        )}

        <div className="rv-vhead">THE COUNCIL WEIGHS IN</div>
        <div className="rv-vinds">
          {CHARACTER_ORDER.map((k) => {
            const v = caseData.stations[k]?.vindication?.[outcome];
            const meta = CHARACTER_META[k];
            const text = vtext(v);
            if (!text) return null;
            return (
              <div key={k} className="rv-vind" style={{ "--c": meta.color }}>
                <span className="rv-vname">
                  {meta.sigil} {meta.name}
                  {k === speakerKey && <span className="rv-vlive"> ◉ ON THE LINE</span>}
                </span>
                <span className="rv-vtext">{text}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button className="rv-exit" onClick={onExit}>◀ RETURN TO TERMINAL</button>

      <style>{`
        .rv-root { position: absolute; inset: 0; display: flex; flex-direction: column;
          background: radial-gradient(120% 80% at 50% 20%, rgba(10,40,38,0.4), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; overflow: hidden; user-select: none; }
        .rv-root::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 9;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 3px),
                      radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.55)); mix-blend-mode: multiply; }
        .rv-header { padding: 14px; font-size: 12px; letter-spacing: 0.06em; }
        .rv-title { color: #5ff2f2; font-weight: bold; }
        .rv-body { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 16px 14px; z-index: 6; }
        .rv-banner { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 16px;
          border: 1.5px solid var(--c); color: var(--c); margin-bottom: 16px;
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
          box-shadow: inset 0 0 26px color-mix(in srgb, var(--c) 16%, transparent); }
        .rv-out { font-size: 30px; font-weight: bold; letter-spacing: 0.08em; text-shadow: 0 0 14px var(--c); }
        .rv-sub { font-size: 11px; letter-spacing: 0.1em; opacity: 0.85; }
        .rv-brier { font-size: 13px; color: #eafff9; margin-top: 6px; }
        .rv-brier i { color: #2fd6d6; opacity: 0.7; font-style: normal; font-size: 10px; }
        .rv-truth { font-size: 13px; line-height: 1.55; color: #d6fff6; border-left: 2px solid #2fd6d6; padding: 4px 0 4px 12px; margin-bottom: 12px; }
        .rv-narr { font-size: 12.5px; line-height: 1.55; color: #bfeede; opacity: 0.92; margin-bottom: 14px; }
        .rv-decisive { font-size: 11.5px; letter-spacing: 0.06em; line-height: 1.5; color: var(--dc, #ffd23a); margin-bottom: 16px;
          border: 1px dashed color-mix(in srgb, var(--dc, #ffd23a) 50%, transparent); padding: 8px 10px; }
        .rv-vhead { font-size: 10.5px; letter-spacing: 0.14em; color: #2fd6d6; opacity: 0.8; margin-bottom: 9px; }
        .rv-vinds { display: flex; flex-direction: column; gap: 9px; }
        .rv-vind { border-left: 2px solid var(--c); padding: 5px 0 6px 11px; }
        .rv-vname { display: block; font-size: 12px; font-weight: bold; color: var(--c); letter-spacing: 0.03em; }
        .rv-vtext { display: block; font-size: 12.5px; line-height: 1.45; color: #eafff9; margin-top: 2px; }
        .rv-vlive { font-size: 9px; letter-spacing: 0.1em; color: #4dffaa; text-shadow: 0 0 6px rgba(77,255,170,0.6); }
        /* Live consultant feed — the hero speaker. */
        .rv-feed { margin-bottom: 16px; animation: rv-in 0.5s 0.15s both; }
        /* Fluid box: the SitePal embed fills its frame (its wrapper is absolutely
           positioned), so we give the frame a responsive aspect-ratio instead of a
           fixed pixel height — it scales to the card width on any screen. */
        .rv-feed-frame { position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border: 1px solid rgba(47,214,214,0.4);
          border-radius: 8px; background: #02100e; box-shadow: inset 0 0 30px rgba(0,0,0,0.5); }
        .rv-feed-live { position: absolute; top: 8px; left: 8px; z-index: 5; font-size: 9px; letter-spacing: 0.14em;
          color: var(--c); padding: 3px 7px; border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
          background: rgba(2,16,14,0.7); text-shadow: 0 0 6px var(--c); }
        .rv-feed-name { margin-top: 8px; font-size: 12px; font-weight: bold; letter-spacing: 0.04em; }
        .rv-feed-cap { margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: #eafff9; min-height: 1.2em; font-style: italic; }
        /* Staggered entrance so the reveal lands as beats, not a wall of text. */
        @keyframes rv-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rv-pop { 0% { opacity: 0; transform: scale(0.94); } 60% { transform: scale(1.02); } 100% { opacity: 1; transform: scale(1); } }
        .rv-banner { animation: rv-pop 0.5s both; }
        .rv-vind { animation: rv-in 0.45s both; }
        .rv-vinds .rv-vind:nth-child(1) { animation-delay: 0.05s; }
        .rv-vinds .rv-vind:nth-child(2) { animation-delay: 0.18s; }
        .rv-vinds .rv-vind:nth-child(3) { animation-delay: 0.31s; }
        .rv-vinds .rv-vind:nth-child(4) { animation-delay: 0.44s; }
        .rv-exit { margin: 8px 16px calc(env(safe-area-inset-bottom, 0px) + 16px); z-index: 6;
          background: none; border: 1px solid color-mix(in srgb, #2fd6d6 50%, transparent); color: #2fd6d6; font: inherit;
          font-size: 12px; letter-spacing: 0.06em; padding: 11px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px)); }
      `}</style>
    </div>
  );
}
