"use client";

import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import OilSurfaceMap from "./OilSurfaceMap";
import OilCrossSection from "./OilCrossSection";
import { surveyPalette, surveyColor, surveyTotals } from "@/lib/oilSurvey";
import s from "./OilSurvey.module.css";

export default function OilSurveyPanel({
  theme, surfaceProps, undergroundProps, open, onOpen, onClose,
  view = 'surface', onViewChange, onOwnPlot, onInspect, onCancelJump, onStartJump,
}) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const palette = surveyPalette(theme);
  const {claimTotals = [], allPlotsMap = {}, currentUserId, selectedClaimIndex, gridX = 10, gridY = 10, maxClaimTotal = 1, claimJumpMode, verified} = surfaceProps;
  const claims = [...claimTotals].sort((a,b) => b.y-a.y || a.x-b.x);
  const own = claims.find(c => currentUserId && allPlotsMap[`${c.x}_${c.y}`]?.currentOwnerId === currentUserId);
  const selected = claims.find(c => c.index === selectedClaimIndex);
  const preview = selected || own;
  const tally = surveyTotals(claims,allPlotsMap);
  const ownPreview = preview && own?.index === preview.index;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const available = Array.from(dialog.current?.querySelectorAll('button:not(:disabled), [href], input, select, textarea, summary, [tabindex="0"]') || [])
        .filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0);
      const first = available[0], last = available[available.length-1];
      if (e.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown',onKey,true);
    return () => {
      document.removeEventListener('keydown',onKey,true);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  },[open]);

  const modal = open && typeof document !== 'undefined' ? createPortal(
    <div className={s.overlay} style={palette} onClick={e => {if(e.target===e.currentTarget) onClose();}}>
      <section ref={dialog} className={s.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={s.dialogHead}>
          <div className={s.heading}>
            <div><h2 id={titleId}>Field survey</h2><div className={s.secondary}>{claimJumpMode ? 'Choose your next plot' : 'Discoveries across the field'}</div></div>
            <button ref={closeButton} className={s.button} type="button" onClick={onClose} aria-label="Close field survey">Close ×</button>
          </div>
          <div className={s.tabs} role="group" aria-label="Survey view">
            <button className={s.button} type="button" aria-pressed={view==='surface'} onClick={() => onViewChange('surface')}>Surface</button>
            <button className={s.button} type="button" aria-pressed={view==='underground'} onClick={() => onViewChange('underground')}>Underground</button>
            {own && <button className={`${s.button} ${s.homeButton}`} type="button" onClick={onOwnPlot}>My rig ({own.x+1}, {own.y+1})</button>}
          </div>
        </header>
        <div className={s.dialogBody}>
          {view==='surface' ? <OilSurfaceMap {...surfaceProps} theme={theme} /> : <OilCrossSection {...undergroundProps} theme={theme} />}
        </div>
        <footer className={s.dialogFoot}>
          <span className={s.secondary}>{verified ? 'Seed verified' : 'Field sealed'}{undergroundProps.revealAll ? ' · full field preview' : ' · revealed finds only'}</span>
          {claimJumpMode ? <button className={s.button} type="button" onClick={onCancelJump}>Cancel claim jump</button>
            : selected && <button className={s.button} type="button" onClick={() => {onClose(); onInspect?.(selected);}}>View plot ({selected.x+1}, {selected.y+1})</button>}
        </footer>
      </section>
    </div>,document.body) : null;

  return <>
    <section className={`${s.survey} ${s.compact}`} style={palette} id="survey-map" aria-label="Field overview">
      <header className={s.heading}>
        <div><h3>Field survey</h3><div className={s.secondary}>{tally.found} {tally.found === 1 ? 'plot' : 'plots'} with BTR</div></div>
        <button className={s.button} type="button" onClick={() => onOpen('surface')} aria-expanded={open}>Expand map</button>
      </header>
      <div className={s.previewRow}>
        <button className={s.preview} type="button" onClick={() => onOpen('surface')} aria-label="Expand the field survey map">
          <span className={s.miniGrid} style={{gridTemplateColumns:`repeat(${gridX},1fr)`,aspectRatio:`${gridX} / ${gridY}`}} aria-hidden="true">
            {claims.map(c => <span key={`${c.x}_${c.y}`} className={`${s.miniCell} ${preview?.index===c.index ? s.miniMine : ''}`}
              style={{background:c.total > 0 ? surveyColor(c.total,maxClaimTotal) : (allPlotsMap[`${c.x}_${c.y}`]?.drillDay || 0)>0 ? 'var(--survey-dry)' : undefined}}>{own?.index===c.index && <i className={s.miniDot} />}</span>)}
          </span>
          <span className={s.previewLabel}>Open field map</span>
        </button>
        <div className={s.compactReadout}>
          <strong>{preview ? `${ownPreview ? 'Your rig' : 'Plot'} (${preview.x+1}, ${preview.y+1})` : 'Explore the field'}</strong>
          <p>{preview?.total > 0 ? `${Math.round(preview.total).toLocaleString()} BTR revealed` : preview ? 'No BTR revealed on this plot.' : 'Select a plot to inspect its discoveries.'}</p>
          <button className={s.button} type="button" onClick={() => onOpen('underground')}>View underground</button>
        </div>
      </div>
      {onStartJump && <button className={s.button} type="button" onClick={onStartJump} style={{marginTop:12,width:"100%"}}>Claim jump{surfaceProps.claimJumpNote ? ` · ${surfaceProps.claimJumpNote}` : ""}</button>}
      <div className={s.footer}><span>{undergroundProps.revealAll ? 'Full field preview' : `${tally.unexplored} plots unexplored`}</span><span>{verified ? 'Seed verified' : 'Field sealed'}</span></div>
    </section>
    {modal}
  </>;
}
