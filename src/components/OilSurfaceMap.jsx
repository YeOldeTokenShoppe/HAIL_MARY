"use client";

import { useRef } from "react";
import { INFERNAL } from "@/lib/oilVocab";
import { surveyPalette, surveyColor, surveyTotals } from "@/lib/oilSurvey";
import s from "./OilSurvey.module.css";

export default function OilSurfaceMap({
  claimTotals = [], maxClaimTotal = 1, selectedClaimIndex, onSelectClaim,
  theme, blockade = null, gridX = 10, gridY = 10, allPlotsMap = {},
  claimJumpMode = false, claimJumpNote = null, onClaimJump, currentUserId, numberOfDeposits = null,
  numberOfHellPockets = null, gusherEvents = [], plotsWithMessages = {}, verified = false, revealAll = false,
}) {
  const cells = useRef({});
  const claims = [...claimTotals].sort((a, b) => b.y - a.y || a.x - b.x);
  const tally = surveyTotals(claims, allPlotsMap);
  const selected = claims.find(c => c.index === selectedClaimIndex);
  const pd = selected && allPlotsMap[`${selected.x}_${selected.y}`];
  const mine = !!currentUserId && pd?.currentOwnerId === currentUserId;
  const owned = pd?.currentOwnerId != null;
  const gushers = new Map(gusherEvents.map(g => [`${g.col}_${g.row}`, g]));
  const hellLayers = Object.keys(pd?.hellLayers || {}).filter(z => pd.hellLayers[z]).map(z => +z + 1);
  const rowTotals = Array.from({length:gridY}, (_, y) => claims.filter(c => c.y === y).reduce((n,c) => n + (c.total || 0),0));
  const colTotals = Array.from({length:gridX}, (_, x) => claims.filter(c => c.x === x).reduce((n,c) => n + (c.total || 0),0));
  const strike = pd?.lastStrikeAt;
  const strikeMs = typeof strike?.toMillis === 'function' ? strike.toMillis() : typeof strike?.seconds === 'number' ? strike.seconds * 1000 : strike instanceof Date ? strike.getTime() : typeof strike === 'number' ? strike : null;
  const hoursSinceStrike = strikeMs == null ? null : Math.max(0,Math.floor((Date.now()-strikeMs)/3600000));
  const select = (c) => {
    if (claimJumpMode && allPlotsMap[`${c.x}_${c.y}`]?.currentOwnerId == null && onClaimJump) onClaimJump(c.x, c.y);
    else onSelectClaim?.(c);
  };
  const move = (e, c) => {
    const offset = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,1], ArrowDown: [0,-1] }[e.key];
    if (!offset) return;
    e.preventDefault();
    const next = claims.find(n => n.x === c.x + offset[0] && n.y === c.y + offset[1]);
    if (next) cells.current[`${next.x}_${next.y}`]?.focus();
  };
  const selectedExplored = selected && (tally.unexplored < claims.length) && (
    (pd?.drillDay || 0) > 0 || Object.keys(pd?.revealed || {}).length > 0
    || Object.keys(pd?.wildcatTaken || {}).length > 0 || selected.total > 0 || hellLayers.length > 0
  );

  return (
    <div className={s.survey} style={surveyPalette(theme)}>
      {blockade && <div className={`${s.notice} ${s.dangerNotice}`} role="status">All rigs halted — demon loose at ({blockade.col + 1}, {blockade.row + 1}).</div>}
      {claimJumpMode && <div className={s.notice}>Choose an open plot to jump. Dashed borders mark available plots.{claimJumpNote && <strong style={{display:"block",marginTop:4,fontWeight:500}}>{claimJumpNote}</strong>}</div>}
      <div className={s.tallies}>
        <span><b>{tally.found}</b> {tally.found === 1 ? "plot" : "plots"} with BTR</span>
        <span>{revealAll ? "Full field preview" : <><b>{tally.unexplored}</b> unexplored</>}</span>
        <span><b>{tally.claimed} / {claims.length}</b> claimed</span>
      </div>
      <div className={s.mapLayout}>
        <div className={s.surface}>
          <div className={s.xAxis} style={{gridTemplateColumns: `repeat(${gridX}, minmax(0,1fr))`}} aria-hidden="true">
            {Array.from({length: gridX}, (_, x) => <span key={x}>{x + 1}</span>)}
          </div>
          <div className={s.gridRow}>
            <div className={s.yAxis} style={{gridTemplateRows: `repeat(${gridY},1fr)`}} aria-hidden="true">
              {Array.from({length: gridY}, (_, i) => <span key={i}>{gridY - i}</span>)}
            </div>
            <div className={s.grid} role="group" aria-label="Survey plots. Use arrow keys to move and Enter to select."
              style={{gridTemplateColumns: `repeat(${gridX}, minmax(0,1fr))`, aspectRatio: `${gridX} / ${gridY}`}}>
              {claims.map(c => {
                const key = `${c.x}_${c.y}`, plot = allPlotsMap[key];
                const isMine = !!currentUserId && plot?.currentOwnerId === currentUserId;
                const isOwned = plot?.currentOwnerId != null;
                const hell = Object.values(plot?.hellLayers || {}).some(Boolean);
                const capped = Object.values(plot?.hellCapped || {}).some(Boolean);
                const explored = (plot?.drillDay || 0) > 0 || Object.keys(plot?.revealed || {}).length > 0 || Object.keys(plot?.wildcatTaken || {}).length > 0;
                const dry = (revealAll || explored) && !(c.total > 0) && !hell;
                const jump = claimJumpMode && !isOwned;
                const state = c.total > 0 ? `${Math.round(c.total).toLocaleString()} BTR revealed` : hell ? INFERNAL.singular : dry ? (revealAll ? 'no BTR' : 'drilled dry') : 'unexplored';
                const label = `Plot (${c.x + 1}, ${c.y + 1}), ${isMine ? 'your rig' : isOwned ? 'claimed' : 'open'}, ${state}${gushers.has(key) ? ', active gusher' : ''}${hell ? `, ${INFERNAL.singular}${capped ? ' capped' : ''}` : ''}${plotsWithMessages[key] ? ', messages' : ''}`;
                return <button key={key} type="button" ref={el => { cells.current[key] = el; }}
                  className={`${s.cell} ${jump ? s.jumpTarget : ''}`} title={label} aria-label={label}
                  aria-pressed={c.index === selectedClaimIndex}
                  tabIndex={c.index === selectedClaimIndex || (selected == null && c === claims[0]) ? 0 : -1}
                  onClick={() => select(c)} onKeyDown={e => move(e,c)}
                  style={{background: c.total > 0 ? surveyColor(c.total,maxClaimTotal) : dry ? 'var(--survey-dry)' : undefined}}>
                  {isMine ? <span className={s.ownerDot} aria-hidden="true" /> : isOwned ? <span className={s.claimedMark} aria-hidden="true" /> : dry ? <span className={s.dryMark} aria-hidden="true" /> : null}
                  {hell && <span className={s.dangerMark} aria-hidden="true" />}
                  {capped && <span className={s.cappedMark} aria-hidden="true" />}
                  {gushers.has(key) && <span className={s.gusherMark} aria-hidden="true">▲</span>}
                  {plotsWithMessages[key] && <span className={s.messageMark} aria-hidden="true">✉</span>}
                </button>;
              })}
            </div>
          </div>
        </div>
        <div className={s.readout} aria-live="polite" aria-atomic="true">
          {selected ? <>
            <h3>Plot ({selected.x + 1}, {selected.y + 1})</h3>
            <p>{mine ? 'Your rig' : owned ? 'Claimed' : 'Open plot'}</p>
            <dl>
              <div><dt>Survey result</dt><dd>{selected.total > 0 ? `${Math.round(selected.total).toLocaleString()} BTR revealed` : !selectedExplored && !revealAll ? 'Unexplored' : hellLayers.length ? INFERNAL.singular : revealAll ? 'No BTR' : 'Drilled dry'}</dd></div>
              <div><dt>Drilled depth</dt><dd>{pd?.drillDay || 0} / 20</dd></div>
              {hoursSinceStrike != null && <div><dt>Last strike</dt><dd>{hoursSinceStrike < 1 ? 'Within the past hour' : hoursSinceStrike < 48 ? `${hoursSinceStrike} hours ago` : `${Math.floor(hoursSinceStrike/24)} days ago`}</dd></div>}
              {hellLayers.length > 0 && <div><dt>{INFERNAL.plural}</dt><dd>Layer {hellLayers.join(', ')}{Object.values(pd?.hellCapped || {}).some(Boolean) ? ' · capped layers present' : ''}</dd></div>}
              {gushers.has(`${selected.x}_${selected.y}`) && <div><dt>Activity</dt><dd>Active gusher</dd></div>}
              {Object.keys(pd?.revealedArtifacts || {}).length > 0 && <div><dt>Artifacts found</dt><dd>{Object.keys(pd.revealedArtifacts).length}</dd></div>}
              {plotsWithMessages[`${selected.x}_${selected.y}`] && <div><dt>Plot chat</dt><dd>New messages</dd></div>}
            </dl>
          </> : <><h3>Select a plot</h3><p className={s.secondary}>Inspect its discoveries, ownership and depth.</p></>}
        </div>
      </div>
      <div className={s.legend} aria-label="Map key">
        <span><i className={`${s.swatch} ${s.oilSwatch}`} />BTR found</span>
        <span><i className={`${s.swatch} ${s.drySwatch}`} />{revealAll ? "No BTR" : "Drilled dry"}</span>
        <span><i className={s.swatch} />Unexplored</span>
        <span><i className={s.ownerDot} />Your rig</span>
      </div>
      <details className={s.details}>
        <summary>Map key &amp; field details</summary>
        <div className={s.legend}>
          <span><i className={`${s.swatch} ${s.selectedSwatch}`} />Selected plot</span>
          <span><i className={s.claimedMark} />Claimed</span>
          <span>◢ {INFERNAL.plural}</span><span>▲ Gusher</span><span>✉ Messages</span>
        </div>
        <p>{tally.dry} explored plots without BTR · {tally.hell} plots with {INFERNAL.pluralLower}</p>
        <p>Seed totals: {numberOfDeposits ?? '—'} deposits · {numberOfHellPockets ?? '—'} infernal pockets. A deposit can extend across several plots.</p>
        <p>Brighter teal means more revealed BTR. An unexplored plot is unknown, not dry. Coordinates match the 3D field.</p>
        <table className={s.detailTable}>
          <caption style={{textAlign:'left',paddingTop:12}}>Revealed BTR by row and column</caption>
          <thead><tr><th scope="col">Coordinate</th><th scope="col">Row BTR</th><th scope="col">Column BTR</th></tr></thead>
          <tbody>{Array.from({length:Math.max(gridX,gridY)},(_,i) => <tr key={i}><th scope="row">{i+1}</th><td>{rowTotals[i] == null ? '—' : Math.round(rowTotals[i]).toLocaleString()}</td><td>{colTotals[i] == null ? '—' : Math.round(colTotals[i]).toLocaleString()}</td></tr>)}</tbody>
        </table>
        <p>{verified ? 'The field seed is revealed and available for verification.' : 'The field is sealed until the season ends.'}</p>
      </details>
    </div>
  );
}
