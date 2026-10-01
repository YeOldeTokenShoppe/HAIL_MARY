// Presentation-only helpers. Never infer an unrevealed layer from a zero.
export function surveyPalette(theme = {}) {
  const dark = ['#12161c', '#0c0717', '#0f141c'].includes(theme.bg);
  return {
    '--survey-bg': theme.bg || '#12161c',
    '--survey-text': theme.textStrong || theme.text || '#d4dce4',
    '--survey-secondary': theme.text || '#b0bcc8',
    '--survey-accent': theme.accent || '#d4a854',
    '--survey-border': theme.border || '#242c38',
    '--survey-empty': theme.mapEmpty || (dark ? '#252b38' : '#e2ddd4'),
    '--survey-dry': dark ? '#657381' : '#a1acb5',
    '--survey-oil': dark ? '#5ad6d0' : '#147c80',
    '--survey-danger': theme.red || '#e06060',
    '--survey-warn': theme.warn || '#cc7755',
    '--survey-wash': theme.inputBg || '#1a2028',
  };
}

export function surveyColor(value, max = 1) {
  // Keep a single, theme-aware resource scale. Selection never changes it.
  const strength = 45 + 55 * Math.min(1, Math.max(0, value / (max || 1)));
  return `color-mix(in srgb, var(--survey-oil) ${strength}%, var(--survey-bg))`;
}

export function surveyedLayer(plot, z, value, infernal, revealAll = false) {
  return revealAll || value > 0 || infernal || z < (plot?.drillDay || 0)
    || Object.prototype.hasOwnProperty.call(plot?.revealed || {}, z)
    || Object.prototype.hasOwnProperty.call(plot?.wildcatTaken || {}, z);
}

export function surveyTotals(claims = [], plots = {}) {
  return claims.reduce((t, c) => {
    const p = plots[`${c.x}_${c.y}`];
    const hell = Object.values(p?.hellLayers || {}).some(Boolean);
    const explored = (p?.drillDay || 0) > 0 || Object.keys(p?.revealed || {}).length > 0
      || Object.keys(p?.wildcatTaken || {}).length > 0 || c.total > 0 || hell;
    if (c.total > 0) t.found++;
    if (hell) t.hell++;
    if (p?.currentOwnerId != null) t.claimed++;
    if (!explored) t.unexplored++;
    else if (!(c.total > 0) && !hell) t.dry++;
    return t;
  }, {found: 0, hell: 0, claimed: 0, dry: 0, unexplored: 0});
}
