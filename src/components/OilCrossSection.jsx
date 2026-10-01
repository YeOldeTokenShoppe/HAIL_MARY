"use client";

import { useRef } from "react";
import { INFERNAL } from "@/lib/oilVocab";
import { surveyPalette, surveyColor, surveyedLayer } from "@/lib/oilSurvey";
import s from "./OilSurvey.module.css";

const DEPTH = 20;
export default function OilCrossSection({
  grid3D = [], maxCellValue = 1, sliceY = 0, selectedX = null, drillDepth = 0,
  onSelectX, theme, gridX = 10, gridY = 10, allPlotsMap = {}, hellMap = {},
  gusherEvents = [], onSelectRow, capDepth = null, ownCapDepth = null,
  currentUserId = null, revealAll = false,
}) {
  const buttons = useRef([]);
  const plots = Array.from({length:gridX}, (_,x) => allPlotsMap[`${x}_${sliceY}`]);
  const column = x => Array.from({length:DEPTH}, (_,z) => {
    const value = grid3D[x]?.[sliceY]?.[z] || 0;
    const hell = !!hellMap[`${x}_${sliceY}_${z}`] || !!plots[x]?.hellLayers?.[z];
    return { value, hell, known: surveyedLayer(plots[x],z,value,hell,revealAll), capped: !!plots[x]?.hellCapped?.[z] };
  });
  const columns = Array.from({length:gridX}, (_,x) => column(x));
  const plot = selectedX != null ? plots[selectedX] : null;
  const selected = selectedX != null ? columns[selectedX] : null;
  // The selected plot's own history is authoritative. The local scrubber is
  // used only in seed-visible admin/test views, never for another player's rig.
  const depthFor = x => revealAll && x === selectedX ? drillDepth : plots[x]?.drillDay || 0;
  const mine = !!currentUserId && plot?.currentOwnerId === currentUserId;
  const total = selected?.reduce((n,c) => n + c.value,0) || 0;
  const noData = !columns.some(c => c.some(layer => layer.known));
  const changeRow = step => onSelectRow?.((sliceY + step + gridY) % gridY);

  return <div className={s.survey} style={surveyPalette(theme)}>
    <div className={s.rowPicker}>
      <div>
        {onSelectRow && <button className={s.button} type="button" aria-label="Previous row" onClick={() => changeRow(-1)}>←</button>}
        <span>Row {sliceY + 1}</span>
        {onSelectRow && <button className={s.button} type="button" aria-label="Next row" onClick={() => changeRow(1)}>→</button>}
      </div>
      <span className={s.secondary}>Surface at top · 20 layers deep</span>
    </div>
    {noData && <div className={s.notice}>Row {sliceY + 1} is unexplored. Layers appear as rigs drill.</div>}
    <div className={s.mapLayout}>
      <div className={s.depthPlot}>
        <div className={s.depthLabels} aria-hidden="true">{Array.from({length:DEPTH},(_,z) => <span key={z}>{[0,4,9,14,19].includes(z) ? `D${z+1}` : ''}</span>)}</div>
        <div className={s.columns} role="group" aria-label={`Underground survey of row ${sliceY+1}`} style={{gridTemplateColumns:`repeat(${gridX},minmax(0,1fr))`}}>
          {columns.map((layers,x) => {
            const isMine = !!currentUserId && plots[x]?.currentOwnerId === currentUserId;
            const rigDepth = depthFor(x);
            const cap = isMine && ownCapDepth != null ? ownCapDepth : capDepth;
            const gusher = gusherEvents.some(g => g.col === x && g.row === sliceY);
            return <button className={s.depthColumn} type="button" key={x} ref={el => {buttons.current[x]=el;}}
              aria-pressed={selectedX === x} aria-label={`Plot (${x+1}, ${sliceY+1})${isMine ? ', your rig' : ''}, drilled to depth ${rigDepth}${gusher ? ', active gusher' : ''}`}
              onClick={() => onSelectX?.(x)} onKeyDown={e => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault(); buttons.current[Math.max(0,Math.min(gridX-1,x+(e.key==='ArrowLeft'?-1:1)))]?.focus();
              }}>
              <span className={s.columnLabel}>{x+1}{isMine && <i className={s.ownerDot} />}{gusher && <span aria-hidden="true">▲</span>}</span>
              <span className={s.layers}>
                {layers.map((layer,z) => <span key={z} className={s.layer}
                  title={`Layer ${z+1}: ${!layer.known ? 'unexplored' : layer.hell ? `${INFERNAL.singular}${layer.capped ? ', capped' : ''}` : layer.value > 0 ? `${Math.round(layer.value).toLocaleString()} BTR` : revealAll ? 'no BTR' : 'drilled dry'}`}
                  style={{background: !layer.known ? 'var(--survey-empty)' : layer.hell ? 'var(--survey-danger)' : layer.value > 0 ? surveyColor(layer.value,maxCellValue) : 'var(--survey-dry)'}}>
                  {cap != null && z === cap && <i className={s.cap} aria-hidden="true" />}
                  {rigDepth > 0 && z === rigDepth-1 && <i className={s.bit} aria-hidden="true" />}
                  {layer.capped && <i className={s.cappedMark} aria-hidden="true" />}
                </span>)}
              </span>
            </button>;
          })}
        </div>
      </div>
      <div className={s.readout} aria-live="polite" aria-atomic="true">
        {selected ? <>
          <h3>Plot ({selectedX+1}, {sliceY+1})</h3>
          <p>{mine ? 'Your rig' : plot?.currentOwnerId != null ? 'Claimed' : 'Open plot'}</p>
          <dl>
            <div><dt>Drilled depth</dt><dd>{depthFor(selectedX)} / {DEPTH}</dd></div>
            <div><dt>Revealed BTR</dt><dd>{Math.round(total).toLocaleString()}</dd></div>
            <div><dt>Unexplored layers</dt><dd>{selected.filter(l => !l.known).length}</dd></div>
          </dl>
        </> : <><h3>Select a column</h3><p className={s.secondary}>Compare discoveries and drilling depth across this row.</p></>}
      </div>
    </div>
    <div className={s.legend}>
      <span><i className={`${s.swatch} ${s.oilSwatch}`} />BTR found</span>
      <span><i className={`${s.swatch} ${s.drySwatch}`} />{revealAll ? "No BTR" : "Drilled dry"}</span>
      <span><i className={s.swatch} />Unexplored</span>
    </div>
    <details className={s.details}>
      <summary>Layer details &amp; map key</summary>
      <p>Outline = selected column · dot = your rig · solid marker = drilled depth · dashed line = depth cap{capDepth != null ? ` (D${capDepth}${mine && ownCapDepth != null && ownCapDepth !== capDepth ? `, yours D${ownCapDepth}` : ''})` : ''}.</p>
      <p>Red layers mark {INFERNAL.pluralLower}; a white bar marks a capped layer. Unexplored layers are unknown, not dry.</p>
      {selected && <div className={s.layerList} aria-label="Selected plot layers">{selected.map((l,z) => <div key={z} style={{display:'contents'}}><span>Layer {z+1}</span><span>{!l.known ? 'Unexplored' : l.hell ? `${INFERNAL.singular}${l.capped ? ' (capped)' : ''}` : l.value > 0 ? `${Math.round(l.value).toLocaleString()} BTR` : revealAll ? 'No BTR' : 'Drilled dry'}</span></div>)}</div>}
    </details>
  </div>;
}
