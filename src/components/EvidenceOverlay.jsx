"use client";

import React, { useEffect, useState } from 'react';
import FlowGraph from './evidenceVisuals/FlowGraph';
import Pie from './evidenceVisuals/Pie';
import Timeline from './evidenceVisuals/Timeline';
import Comparison from './evidenceVisuals/Comparison';
import Checklist from './evidenceVisuals/Checklist';
import Image from './evidenceVisuals/Image';
import SignalStack from './evidenceVisuals/SignalStack';

// EvidenceOverlay — fullscreen "monitor view" of a single piece of evidence,
// reachable from the unified widget's ▸ VIEW ON SCREEN button or from
// tapping the in-scene workstation screen (mobile). Renders a registered
// visualization primitive for known (stationKey, entry.label) combos and
// falls back to a styled text card when no rich visual is registered yet.
//
// Architecture: each entry in EVIDENCE_VISUALS supplies a `component` and
// its `props`. To add a new evidence visual, register a new entry here and
// (optionally) define a new primitive in ./evidenceVisuals/.
//
// Threat color drives the accent throughout: red = confirmed, amber =
// elevated risk, green = normal. The footer verdict bar uses the same.

const THREAT_ACCENT = {
  red:   { color: '#ff4d6d', dim: 'rgba(255,77,109,0.16)', verdict: '⚠ CONFIRMED SIGNAL' },
  amber: { color: '#ffb84d', dim: 'rgba(255,184,77,0.16)', verdict: '⚠ ELEVATED RISK'    },
  green: { color: '#4dffaa', dim: 'rgba(77,255,170,0.16)', verdict: '✓ NORMAL'           },
};

// Mock wallet addresses for the wash-trading cluster. These don't have to
// resolve to anything real — they just need to look like authentic on-chain
// receipts so the player learns the *shape* of the artifact.
const WASH_TRADING_WALLETS = [
  { id: 'w1', label: '0x7a3f…92c1' },
  { id: 'w2', label: '0xbe11…4d8e' },
  { id: 'w3', label: '0x2cd4…f7a9' },
  { id: 'w4', label: '0x91e0…b8c3' },
  { id: 'w5', label: '0x4d28…1f5b' },
  { id: 'w6', label: '0xf6c2…3a17' },
  { id: 'w7', label: '0x18b9…ec40' },
  { id: 'w8', label: '0xa54d…789f' },
];

// Adjacent loop + a couple of crossings → "money chasing itself around the
// cluster." The exact edges matter less than the visual impression of a
// closed system passing volume between itself.
const WASH_TRADING_EDGES = [
  { from: 'w1', to: 'w2' },
  { from: 'w2', to: 'w3' },
  { from: 'w3', to: 'w4' },
  { from: 'w4', to: 'w5' },
  { from: 'w5', to: 'w6' },
  { from: 'w6', to: 'w7' },
  { from: 'w7', to: 'w8' },
  { from: 'w8', to: 'w1' },
  { from: 'w1', to: 'w5' },
  { from: 'w3', to: 'w7' },
  { from: 'w2', to: 'w6' },
];

// Funding trace for $PRPHT — linear flow: an external EOA funded the
// Tornado Cash mixer, money came out at a fresh address, that address
// deployed the contract. Classic mixer-hop pattern.
const FUNDING_TRACE_NODES = [
  { id: 'src',      label: '0xc1a2…7e0d', sublabel: 'EOA',         externalLabel: 'INPUT' },
  { id: 'tornado', label: 'Tornado Cash', sublabel: '2.1 ETH',     externalLabel: 'MIXER', highlight: true, badge: '✸' },
  { id: 'deployer', label: '0xab12…4f1c', sublabel: '+ 2.1 ETH',   externalLabel: 'DEPLOYER' },
  { id: 'contract', label: '$PRPHT',      sublabel: 'contract',    externalLabel: 'TARGET' },
];
const FUNDING_TRACE_EDGES = [
  { from: 'src',      to: 'tornado'  },
  { from: 'tornado', to: 'deployer' },
  { from: 'deployer', to: 'contract' },
];

// Deployer cluster for $PRPHT — radial: one central funding source, 14
// wallets sprayed out from it, all later converging into the deployer.
const DEPLOYER_CLUSTER_NODES = [
  { id: 'src', label: 'mixer-out', sublabel: '2.1 ETH', badge: '✸' },
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `c${i}`,
    label: `0x${(0xabcd1234 + i * 17).toString(16).slice(0, 4)}…${(0xfedc + i).toString(16)}`,
    sublabel: `${(0.04 + i * 0.012).toFixed(3)}E`,
  })),
];
const DEPLOYER_CLUSTER_EDGES = Array.from({ length: 14 }, (_, i) => ({
  from: 'src',
  to: `c${i}`,
}));

// Top-10 holder concentration for $PRPHT.
const TOP10_HOLDERS_SLICES = [
  { label: 'Top wallet',  value: 28, highlight: true },
  { label: 'Wallets 2–10', value: 43, color: 'rgba(255,77,109,0.55)' },
  { label: 'Float',        value: 29, color: 'rgba(109,181,154,0.30)' },
];

// Follower-age distribution for $PRPHT social — most followers are <2 weeks
// old (bot signature). The 81% wedge is the punchline.
const FOLLOWER_AGE_SLICES = [
  { label: '<14 days',  value: 81, highlight: true },
  { label: '14–30 days', value: 10, color: 'rgba(255,184,77,0.55)' },
  { label: '>30 days',   value:  9, color: 'rgba(109,181,154,0.40)' },
];

// Deployer wallet timeline — newborn wallet, three back-to-back deploys,
// two rugs already. The highlighted marker is the current case so the eye
// lands on "this is the third one in 6 days."
const DEPLOYER_WALLET_TIMELINE = [
  { position: 0.04, label: 'Wallet created', sublabel: 'd-6 · 09:14',  tone: 'amber' },
  { position: 0.18, label: '$ORACL3 deployed', sublabel: 'd-5',          tone: 'red' },
  { position: 0.30, label: '$ORACL3 rugged',   sublabel: 'd-5 +18h',     tone: 'red' },
  { position: 0.46, label: '$DIVINE deployed', sublabel: 'd-3',          tone: 'red' },
  { position: 0.58, label: '$DIVINE rugged',   sublabel: 'd-3 +12h',     tone: 'red' },
  { position: 0.74, label: '$AETHER deployed', sublabel: 'd-1',          tone: 'amber' },
  { position: 0.93, label: '$PRPHT deployed',  sublabel: 'today · 08:02', tone: 'red', highlight: true },
];

// FUD suppression — repeating "comment posted → deleted ~4min" pattern.
// The compression is the signal: this is moderated, not organic.
const FUD_SUPPRESSION_TIMELINE = [
  { position: 0.06, label: 'Negative comment',  sublabel: '14:02',          tone: 'red' },
  { position: 0.10, label: 'Deleted',           sublabel: '14:06 (+4m)',    tone: 'red' },
  { position: 0.28, label: 'Contract question', sublabel: '14:48',          tone: 'red' },
  { position: 0.32, label: 'Deleted',           sublabel: '14:52 (+4m)',    tone: 'red' },
  { position: 0.50, label: 'Rug history cited', sublabel: '15:30',          tone: 'red' },
  { position: 0.54, label: 'Deleted',           sublabel: '15:34 (+4m)',    tone: 'red' },
  { position: 0.72, label: 'Audit request',     sublabel: '16:02',          tone: 'red' },
  { position: 0.76, label: 'Deleted',           sublabel: '16:06 (+4m)',    tone: 'red' },
  { position: 0.94, label: 'User banned',       sublabel: '16:11',          tone: 'red', highlight: true },
];

// Roadmap — vague-to-impossible milestones. AGI alignment at week 12 is
// the showpiece, but every step has a credibility tone.
const ROADMAP_TIMELINE = [
  { position: 0.05, label: 'Mainnet',         sublabel: 'wk 2',  tone: 'amber' },
  { position: 0.25, label: 'AI agents v1',    sublabel: 'wk 4',  tone: 'amber' },
  { position: 0.45, label: 'Cross-chain',     sublabel: 'wk 6',  tone: 'red'   },
  { position: 0.65, label: 'DAO governance',  sublabel: 'wk 9',  tone: 'red'   },
  { position: 0.92, label: 'AGI alignment',   sublabel: 'wk 12', tone: 'red', highlight: true },
];

// Prior outcomes — 4 mini price-charts. Three rugs and one bleeding token.
// Points are stylized (not real OHLC) — just shaped to read as "pump → cliff".
const PRIOR_OUTCOMES_PANELS = [
  {
    title: '$ORACL3',
    subtitle: 'rugged d-5',
    tone: 'red',
    sparkline: { points: [10, 14, 22, 35, 52, 78, 95, 28, 8, 3, 1.5, 1], fill: true },
    lines: [{ text: '−98%  ·  $410K extracted', color: '#ff4d6d' }],
  },
  {
    title: '$DIVINE',
    subtitle: 'rugged d-3',
    tone: 'red',
    sparkline: { points: [10, 18, 32, 48, 60, 12, 4, 2, 1], fill: true },
    lines: [{ text: '−96%  ·  $290K extracted', color: '#ff4d6d' }],
  },
  {
    title: '$AETHER',
    subtitle: 'bleeding',
    tone: 'amber',
    sparkline: { points: [10, 18, 28, 36, 32, 26, 21, 17, 14, 12], fill: true },
    lines: [{ text: '−66%  ·  still listed', color: '#ffb84d' }],
  },
  {
    title: '$PRPHT',
    subtitle: 'TODAY',
    tone: 'red',
    sparkline: { points: [10, 16, 28, 42], fill: true },
    lines: [
      { text: '+342%  ·  d-0', color: '#c8ffe0' },
      { text: '?', color: '#ff4d6d', serif: true },
    ],
  },
];

// Contract diff — two panels side by side. Both show the same telltale
// functions; the right panel is the live $PRPHT contract, the left is the
// known rug template "rug-12" that the deployer has used 4× before.
const CONTRACT_DIFF_PANELS = [
  {
    title: 'rug-12 template',
    subtitle: 'known pattern',
    tone: 'amber',
    lines: [
      { text: '// open mint, no access control' },
      { text: 'function mint(address to,', color: '#8effc4' },
      { text: '  uint256 amount) external {', color: '#8effc4' },
      { text: '  _mint(to, amount);  // ←', color: '#8effc4' },
      { text: '}', color: '#8effc4' },
      { text: '' },
      { text: '// sell tax — buy free, exit 40%' },
      { text: 'uint256 sellTax = 40;', color: '#8effc4' },
      { text: '' },
      { text: '// LP unlock', color: '#6db59a' },
      { text: 'bool lpLocked = false;', color: '#8effc4' },
    ],
  },
  {
    title: '$PRPHT contract',
    subtitle: '85% match',
    tone: 'red',
    lines: [
      { text: '// open mint, no access control' },
      { text: 'function mint(address to,', color: '#ff8da0' },
      { text: '  uint256 amount) external {', color: '#ff8da0' },
      { text: '  _mint(to, amount);  // ←', color: '#ff8da0' },
      { text: '}', color: '#ff8da0' },
      { text: '' },
      { text: '// sell tax — identical' },
      { text: 'uint256 sellTax = 40;', color: '#ff8da0' },
      { text: '' },
      { text: '// LP unlock — identical' },
      { text: 'bool lpLocked = false;', color: '#ff8da0' },
    ],
  },
];

// Pitch pattern — five landing-page hero blurbs, stacked vertically. The
// repetition is the punchline; the player sees the same template, slightly
// rephrased, across four prior rugs and the current token.
const PITCH_PATTERN_PANELS = [
  {
    title: '$ORACL3',
    subtitle: 'rugged',
    tone: 'red',
    lines: [{ text: '"AI-powered prophecy engine. Predict the next 100x."', italic: true, color: '#c8ffe0' }],
  },
  {
    title: '$DIVINE',
    subtitle: 'rugged',
    tone: 'red',
    lines: [{ text: '"Prophecy-grade AI. Trade tomorrow today."', italic: true, color: '#c8ffe0' }],
  },
  {
    title: '$AETHER',
    subtitle: 'bleeding',
    tone: 'red',
    lines: [{ text: '"AI prophet for the on-chain age. Your next 100x is written."', italic: true, color: '#c8ffe0' }],
  },
  {
    title: '$FORESEE',
    subtitle: 'rugged',
    tone: 'red',
    lines: [{ text: '"Foresee tomorrow. AI prophecy, on-chain."', italic: true, color: '#c8ffe0' }],
  },
  {
    title: '$PRPHT',
    subtitle: 'TODAY',
    tone: 'red',
    lines: [{ text: '"The AI prophecy engine. The next 100x is already written."', italic: true, color: '#ff8da0' }],
  },
];

// Whitepaper page audit — all 6 pages are tokenomics restated five different
// ways. There's no architecture page, no audit page. The absence is the tell.
const WHITEPAPER_PAGES = [
  { status: 'fail', label: 'Page 1', value: 'Tokenomics' },
  { status: 'fail', label: 'Page 2', value: 'Tokenomics' },
  { status: 'fail', label: 'Page 3', value: 'Tokenomics (cont.)' },
  { status: 'fail', label: 'Page 4', value: 'Distribution' },
  { status: 'fail', label: 'Page 5', value: 'Vesting (none)' },
  { status: 'fail', label: 'Page 6', value: 'Roadmap (vague)' },
  { status: 'missing', label: 'System architecture', value: '—' },
  { status: 'missing', label: 'Math / equations',    value: '—' },
  { status: 'missing', label: 'Audit',               value: '—' },
];

// AI claims — every verification checkbox is empty.
const AI_CLAIMS_CHECKLIST = [
  { status: 'fail', label: 'Public GitHub repository', value: 'NONE' },
  { status: 'fail', label: 'Model card / weights',     value: 'NONE' },
  { status: 'fail', label: 'Working demo',             value: 'NONE' },
  { status: 'fail', label: 'Independent benchmark',    value: 'NONE' },
  { status: 'fail', label: 'Whitepaper math',          value: 'NONE' },
];

// LP / vesting — the exit-readiness checklist. Every safeguard a real
// project would carry is missing.
const LP_VESTING_CHECKLIST = [
  { status: 'fail', label: 'LP locked?',            value: 'NO',  sublabel: 'team can pull liquidity at any time' },
  { status: 'fail', label: 'Team vesting?',         value: '0%',  sublabel: 'all team tokens tradeable on day one' },
  { status: 'fail', label: 'Ownership renounced?',  value: 'NO',  sublabel: 'deployer can mint and tax at will' },
  { status: 'fail', label: 'Time-locked treasury?', value: 'NO',  sublabel: 'no contractual restraint on outflows' },
];

// KOL promoters — paid shills, two with rug histories.
const KOL_CHECKLIST = [
  {
    status: 'fail',
    label: '@CrptoKing420',
    value: '147K',
    sublabel: 'prior rugs: $MOON, $LAMBO, $ALPHA',
  },
  {
    status: 'fail',
    label: '@AlphaSeeker',
    value: '89K',
    sublabel: 'prior rug: $ORACL3 (same deployer)',
  },
  {
    status: 'warn',
    label: '@Trenches_AI',
    value: '34K',
    sublabel: 'no rug history — yet',
  },
];

// Telegram phrase frequency — same phrases repeating across 12+ accounts.
// One real-sounding question, deleted within 4 minutes.
const TELEGRAM_PHRASES = [
  { status: 'fail', label: '"To the moon! 🚀🚀🚀"',            value: '× 12', sublabel: 'across 12 unique handles' },
  { status: 'fail', label: '"Don\'t sleep on this fam"',         value: '× 8' },
  { status: 'fail', label: '"WAGMI 🙌"',                         value: '× 7' },
  { status: 'fail', label: '"This is THE one"',                  value: '× 6' },
  { status: 'fail', label: '"$1 EOY 100%"',                     value: '× 5' },
  { status: 'warn', label: '"How does the AI actually work?"',   value: '× 1', sublabel: 'deleted within 4 min · user banned' },
];

// Registry: keyed `${caseId}:${stationKey}:${entry.label}` → renderer
// config. The `caseId` prefix is required — without it, two cases that
// happen to share a station/label string (e.g. both have a `marisol:TOP 10
// HOLDERS` entry) would render the same visual, leaking one case's
// evidence into another. The per-case `entry.visual` override on case
// files is the preferred place to put new visuals; this global registry
// remains for the case-001 set already built here.
// Add a new entry: prefix the key with the case id (e.g.
// `'case-003:monk:NEW LABEL'`).
const EVIDENCE_VISUALS = {
  // ─── Marisol · LOGOS · ONCHAIN ───────────────────────────────────────
  'case-001:marisol:WASH TRADING': {
    component: FlowGraph,
    props: {
      layout: 'circular',
      nodes: WASH_TRADING_WALLETS,
      edges: WASH_TRADING_EDGES,
      radius: 140,
    },
    caption:
      'Eight wallets, one closed loop. Volume bounces between them ' +
      'continuously — inflating the chart while no real demand exists.',
    metric: { label: 'WASH %', value: '63%' },
  },
  'case-001:marisol:TOP 10 HOLDERS': {
    component: Pie,
    props: {
      slices: TOP10_HOLDERS_SLICES,
      centerLabel: 'TOP 10',
      centerMetric: '71%',
      radius: 110,
      innerRadius: 56,
    },
    caption:
      'Ten wallets hold nearly three-quarters of supply. The float is theirs ' +
      'to dump whenever they decide the inflows have peaked.',
    metric: { label: 'CONCENTRATION', value: 'CRITICAL' },
  },
  'case-001:marisol:DEPLOYER CLUSTER': {
    component: FlowGraph,
    props: {
      layout: 'radial',
      centerNode: 'src',
      nodes: DEPLOYER_CLUSTER_NODES,
      edges: DEPLOYER_CLUSTER_EDGES,
      radius: 130,
    },
    caption:
      'Fourteen "different" wallets, all funded from the same mixer output. ' +
      'This is one person wearing fourteen hats.',
    metric: { label: 'CONNECTED', value: '14' },
  },

  // ─── Saint GR80 · ETHOS · CREDIBILITY ────────────────────────────────
  'case-001:monk:FUNDING SOURCE': {
    component: FlowGraph,
    props: {
      layout: 'linear',
      nodes: FUNDING_TRACE_NODES,
      edges: FUNDING_TRACE_EDGES,
      radius: 180,
    },
    caption:
      'Funds enter Tornado Cash from one address, exit at another, then ' +
      'fund the deployer. The mixer hop is the only reason to do this.',
    metric: { label: 'HOPS', value: '3' },
  },
  'case-001:monk:DEPLOYER WALLET AGE': {
    component: Timeline,
    props: {
      events: DEPLOYER_WALLET_TIMELINE,
      startLabel: '6d ago',
      endLabel: 'now',
    },
    caption:
      'This wallet is six days old and has already deployed four tokens. ' +
      'Two are confirmed rugs. The third is bleeding. The fourth is $PRPHT.',
    metric: { label: 'AGE', value: '6 DAYS' },
  },

  // ─── John Barron · PATHOS · SENTIMENT ────────────────────────────────
  'case-001:demon:TWITTER FOLLOWERS': {
    component: Pie,
    props: {
      slices: FOLLOWER_AGE_SLICES,
      centerLabel: 'BOTTED',
      centerMetric: '81%',
      radius: 110,
      innerRadius: 56,
    },
    caption:
      'Four out of five followers were created in the last two weeks. ' +
      'This audience was bought, not earned.',
    metric: { label: '<14 DAYS', value: '81%' },
  },
  'case-001:demon:FUD SUPPRESSION': {
    component: Timeline,
    props: {
      events: FUD_SUPPRESSION_TIMELINE,
      startLabel: '14:00',
      endLabel: '16:30',
    },
    caption:
      'Every critical comment is deleted within four minutes — almost ' +
      'metronomic. This community is moderated to project a vibe, not to talk.',
    metric: { label: 'AVG DELETE', value: '4 MIN' },
  },

  // ─── Eugene · MYTHOS · NARRATIVE ─────────────────────────────────────
  'case-001:eugene:ROADMAP REALISM': {
    component: Timeline,
    props: {
      events: ROADMAP_TIMELINE,
      startLabel: 'launch',
      endLabel: 'wk 12',
    },
    caption:
      '"AGI alignment by week 12." Three Nobel labs couldn\'t ship this; ' +
      'a six-page whitepaper with no architecture certainly won\'t.',
    metric: { label: 'CREDIBILITY', value: '0%' },
  },
  'case-001:eugene:WHITEPAPER': {
    component: Checklist,
    props: { items: WHITEPAPER_PAGES, title: 'PAGE-BY-PAGE AUDIT' },
    caption:
      'Six pages of tokenomics restated five different ways. No architecture, ' +
      'no math, no audit. The whitepaper is a marketing deck wearing a costume.',
    metric: { label: 'PAGES', value: '6/6 TKN' },
  },
  'case-001:eugene:AI CLAIMS': {
    component: Checklist,
    props: { items: AI_CLAIMS_CHECKLIST, title: 'AI VERIFICATION' },
    caption:
      'Every verification a real AI project would publish is missing. The "AI" ' +
      'is invisible because there is no AI.',
    metric: { label: 'VERIFIED', value: '0/5' },
  },
  'case-001:eugene:PITCH PATTERN': {
    component: Comparison,
    props: { panels: PITCH_PATTERN_PANELS, direction: 'column' },
    caption:
      'Four prior rugs and this one all sell the same "AI prophecy engine" ' +
      'story. Same template, slightly rephrased, run on a tighter schedule each time.',
    metric: { label: 'PRIOR MATCHES', value: '4×' },
  },

  // ─── Continued — Saint GR80 ─────────────────────────────────────────
  'case-001:monk:PRIOR OUTCOMES': {
    component: Comparison,
    props: { panels: PRIOR_OUTCOMES_PANELS, direction: 'row' },
    caption:
      'Three prior tokens from this deployer: two cliff-rugged, one bleeding. ' +
      'The fourth is currently pumping. Pattern recognition is not optional here.',
    metric: { label: 'PRIOR RUGS', value: '3/3' },
  },
  'case-001:monk:CONTRACT ORIGINALITY': {
    component: Comparison,
    props: { panels: CONTRACT_DIFF_PANELS, direction: 'row' },
    caption:
      'Open mint. 40% sell tax. Unlocked LP. The contract is 85% identical to a ' +
      'known rug template — and this deployer has used the same template four times before.',
    metric: { label: 'MATCH', value: '85%' },
  },

  // ─── Continued — John Barron ────────────────────────────────────────
  'case-001:demon:TELEGRAM ACTIVITY': {
    component: Checklist,
    props: { items: TELEGRAM_PHRASES, title: 'PHRASE FREQUENCY' },
    caption:
      'The same five phrases account for 88% of the messages, across a dozen ' +
      'different handles. One real question slipped through. It was deleted in four minutes.',
    metric: { label: 'REPETITION', value: '88%' },
  },
  'case-001:demon:KOL PROMOTERS': {
    component: Checklist,
    props: { items: KOL_CHECKLIST, title: 'PAID PROMOTERS' },
    caption:
      'Three paid shills. Two are repeat offenders — one promoted this same ' +
      'deployer\'s last rug. They aren\'t hiding the pattern.',
    metric: { label: 'PRIOR RUGS', value: '2/3' },
  },

  // ─── Continued — Marisol ────────────────────────────────────────────
  'case-001:marisol:LP / VESTING': {
    component: Checklist,
    props: { items: LP_VESTING_CHECKLIST, title: 'EXIT-READINESS CHECK' },
    caption:
      'Every safeguard a legitimate project would carry is missing. LP unlocked, ' +
      'zero vesting, owner not renounced. They are pre-staged to leave.',
    metric: { label: 'GUARDS', value: '0/4' },
  },
};

// String-keyed registry so case .js files can reference visualization
// components without importing React (they stay pure data). Per-case
// overrides set `entry.visual.component` to one of these names.
const COMPONENT_REGISTRY = { FlowGraph, Pie, Timeline, Comparison, Checklist, Image, SignalStack };

// Resolve a visual config for an entry. Lookup order:
//   1. `entry.visual` on the case file (per-case override — wins)
//   2. Global `EVIDENCE_VISUALS[caseId:stationKey:label]`
// Returns null if nothing is registered. The returned shape matches
// EVIDENCE_VISUALS entries: { component, props, caption, metric }.
function resolveEntryVisual(caseId, stationKey, entry) {
  if (!stationKey || !entry) return null;
  if (entry.visual) {
    const ref = entry.visual.component;
    const Comp = typeof ref === 'string' ? COMPONENT_REGISTRY[ref] : ref;
    if (!Comp) return null;
    return {
      component: Comp,
      props: entry.visual.props || {},
      caption: entry.visual.caption,
      metric: entry.visual.metric,
    };
  }
  if (!caseId) return null;
  return EVIDENCE_VISUALS[`${caseId}:${stationKey}:${entry.label}`] || null;
}

function hasRichVisual(caseId, stationKey, entry) {
  return Boolean(resolveEntryVisual(caseId, stationKey, entry));
}

// Export the predicate so the parent route can decide whether to mount
// EvidenceOverlay vs. the legacy text-typewriter (FullscreenCRTOverlay).
// resolveEntryVisual is also exported so EvidenceScreens can mirror the
// same visualization onto the in-scene workstation screen canvases.
export { hasRichVisual, resolveEntryVisual, THREAT_ACCENT };

export default function EvidenceOverlay({
  isActive,
  caseId,
  stationKey,
  station,
  entry,
  onClose,
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => setIsVisible(true), 30);
      return () => clearTimeout(t);
    }
    setIsVisible(false);
  }, [isActive]);

  if (!isActive || !station || !entry) return null;

  const config = resolveEntryVisual(caseId, stationKey, entry);
  const accent = THREAT_ACCENT[entry.threat] || THREAT_ACCENT.green;

  const Visualization = config?.component || null;
  const visualizationProps = config
    ? { ...config.props, threat: entry.threat }
    : null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(ellipse at center, rgba(2,5,7,0.92) 0%, rgba(2,5,7,0.98) 100%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.18s ease',
        cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 48px)',
          background: 'linear-gradient(180deg, rgba(13,80,50,0.10), rgba(5,10,7,0.96))',
          border: `1px solid ${accent.color}`,
          borderRadius: 10,
          boxShadow: `0 0 60px ${accent.dim}, inset 0 0 60px rgba(0,255,130,0.04)`,
          fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
          color: '#c8ffe0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: 'default',
        }}
      >
        {/* Header band — like a CRT title bar. Close button on the right
            because on mobile the inner card fills the viewport, leaving
            almost no backdrop margin to tap; "tap anywhere to close" alone
            is not enough of a target. */}
        <div
          style={{
            background: accent.color,
            color: '#050a07',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}
        >
          <span>▸ {station.character?.toUpperCase()} — {(station.role || '').toUpperCase()}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ opacity: 0.65 }}>// EVIDENCE</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close evidence"
              style={{
                background: 'rgba(5,10,7,0.18)',
                border: '1px solid rgba(5,10,7,0.55)',
                color: '#050a07',
                width: 28,
                height: 28,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                lineHeight: 1,
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Reveal label band */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(77,255,170,0.18)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#6db59a' }}>
            // {entry.label}
          </div>
          {config?.metric && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.22em', color: '#6db59a' }}>
                {config.metric.label}
              </div>
              <div
                style={{
                  fontFamily: "'Cinzel Decorative','Cinzel',serif",
                  fontSize: 22,
                  color: accent.color,
                  textShadow: `0 0 8px ${accent.color}`,
                }}
              >
                {config.metric.value}
              </div>
            </div>
          )}
        </div>

        {/* Visualization */}
        <div
          style={{
            flex: 1,
            minHeight: 320,
            padding: '16px 12px',
            position: 'relative',
            background:
              'radial-gradient(ellipse at center, rgba(13,80,50,0.18) 0%, transparent 70%)',
            overflow: 'hidden',
          }}
        >
          {Visualization ? (
            <Visualization {...visualizationProps} />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                gap: 12,
                padding: '24px',
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#6db59a' }}>
                RAW VALUE
              </div>
              <div
                style={{
                  fontFamily: "'Cinzel Decorative','Cinzel',serif",
                  fontSize: 22,
                  color: '#c8ffe0',
                  lineHeight: 1.4,
                  maxWidth: 460,
                }}
              >
                {entry.value}
              </div>
              <div style={{ fontSize: 10, color: '#3a6b54', fontStyle: 'italic', marginTop: 8 }}>
                Rich visualization pending for this evidence type.
              </div>
            </div>
          )}
        </div>

        {/* Caption (visual-specific commentary) */}
        {config?.caption && (
          <div
            style={{
              padding: '10px 16px',
              fontSize: 11,
              color: '#c8ffe0',
              fontStyle: 'italic',
              lineHeight: 1.45,
              borderTop: '1px solid rgba(77,255,170,0.18)',
            }}
          >
            {config.caption}
          </div>
        )}

        {/* Verdict bar — also a close target. The inner card stops click
            propagation so the backdrop-close doesn't fire from inside the
            card; explicit onClick here makes the bottom hint behave the
            way it reads. */}
        <div
          onClick={onClose}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClose?.();
            }
          }}
          style={{
            background: accent.color,
            color: '#050a07',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.22em',
            cursor: 'pointer',
          }}
        >
          <span>{accent.verdict}</span>
          <span style={{ opacity: 0.85, fontWeight: 600 }}>tap to close ✕</span>
        </div>

        {/* Scanlines overlay — sells the CRT illusion */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
            mixBlendMode: 'multiply',
          }}
        />
      </div>
    </div>
  );
}
