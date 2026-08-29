// Server-side v2 resolution writer, shared by the strike tick (auto-resolve by
// threshold) and the oil-layer-decide route (manual EXTRACT/PASS) so the two
// paths can never drift. All writes go through the caller's transaction.
//
// Extraction = banking (v2 removes the BANK verb): oil lands on totalCollected
// AND the community total in the same txn. A pass writes the pocket onto the
// public plot doc — `oilPlots.passed` is what laterals (phase 3) and the strata
// wall read. Inclusions follow §Multi-element core: flagged at reveal
// (identity hidden), granted to inventory only on EXTRACT; on PASS the flag
// stays on the plot for whoever takes the pocket.

// Flat inventory key (mirrors the strike tick's v1 key; kept here so v2 paths
// share one definition). Underscores, not dots — Firestore path rule.
export function inclusionItemKey(a) {
  if (a.type === "amber") return `amber_${a.specimenId}_${a.fragmentIndex}`;
  if (a.type === "relic") return `relic_${a.relicId}`;
  if (a.type === "map") return `map_${a.pieceIndex}`;
  return "cache";
}

const stripCoords = (a) => { const { x, y, z, ...payload } = a; return payload; };

/**
 * Apply an extract/pass decision for `pending` inside an open transaction.
 * Returns a summary for alerts/feed. Caller has already validated the decision
 * (charges for an extract, pending exists) and provides `inclusionArtifact`
 * (the generator's artifact at that cell, or null).
 */
export function applyV2Resolution(t, {
  FieldValue, drillRef, plotRef, communityRef,
  drillNow, col, row, pending, decision, inclusionArtifact,
}) {
  const layer = pending.layer;
  const oil = pending.oil || 0;

  if (decision === "extract") {
    const drillUpdate = {
      chargesSpent: (drillNow.chargesSpent || 0) + 1,
      totalCollected: (drillNow.totalCollected || 0) + oil,
      layersExtracted: { [layer]: oil },
      tankOil: 0, // the buffer drains down the pipeline
      pending: null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (pending.hasInclusion && inclusionArtifact) {
      drillUpdate.artifacts = { [inclusionItemKey(inclusionArtifact)]: FieldValue.increment(1) };
      drillUpdate.artifactFinds = FieldValue.increment(1);
    }
    t.set(drillRef, drillUpdate, { merge: true });
    if (oil > 0) {
      t.set(communityRef, {
        totalOil: FieldValue.increment(oil),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    // Public extraction mirror (build-order phase 3): the wall and the field's
    // social layer read per-plot layer history — extraction is field-visible
    // by design (the parimutuel field's story). Identity also reveals on
    // extraction (flag-at-reveal, §Multi-element core).
    const plotUpdate = { extracted: { [layer]: oil } };
    if (pending.hasInclusion && inclusionArtifact) {
      plotUpdate.revealedArtifacts = { [layer]: stripCoords(inclusionArtifact) };
    }
    t.set(plotRef, plotUpdate, { merge: true });
    return { decision, layer, oil, inclusion: pending.hasInclusion ? inclusionArtifact?.type ?? true : null };
  }

  // PASS — final. A wet pocket opens on the public plot doc; a flagged
  // inclusion stays in the ground with it.
  t.set(drillRef, {
    layersPassed: { [layer]: oil },
    tankOil: 0, // vented back into the ground
    pending: null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const plotUpdate = { col, row };
  if (oil > 0) plotUpdate.passed = { [layer]: oil };
  if (pending.hasInclusion) plotUpdate.passedInclusions = { [layer]: true };
  if (oil > 0 || pending.hasInclusion) t.set(plotRef, plotUpdate, { merge: true });
  return { decision, layer, oil, inclusion: null };
}
