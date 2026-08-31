"use client";

// ── StrataVoxels — playable prototype (?strata=1) ────────────────────────────
// The earth block as live game-state voxels, now with a PLAYABLE accelerated
// season: a mock v2 loop (threshold players on the real seeded field) runs in
// ~90 seconds so the reveal → pending → resolve → poach rhythm can be watched
// instead of imagined. One voxel per (col,row,layer) cell — the game's own
// resolution, not Minecraft terrain.
//
// The three viewing modes answer "what does a player actually see":
//  · default    — the cube face as PUBLIC MURAL (perimeter rows legible)
//  · MY CLAIM   — an interior claim's decision view: your column + 4 orthogonal
//                 neighbours isolated as a standing core-sample cluster; orbit
//                 freely, no privileged side
//  · X-RAY      — dirt hidden, shafts + pockets as the field-wide drill chart
//
// Cell lifecycle: dirt → PENDING (gold pulse: revealed, countdown running) →
// resolves dark (extracted) / green (passed, open) / red (hell) → green may
// later flip amber (taken by a neighbour's lateral, tunnel bar punches in).
//
// COMPANY RING: the outer ring of columns is unclaimable company land — no
// rig, no reveals, no discards. Border claims wildcat-drill into their private
// adjacent ring column blind (amber = struck, grey stub = dry hole, red = woke
// a demon), only at depths their own bore has reached. Every claim therefore
// has exactly 4 adjacent columns; interior trades contested salvage against
// the border's private frontier.
//
// Prototype only: mock data, no server, no game state touched.

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

const SEASON_DAYS = 8;
const REVEAL_DT = 3;    // demo-seconds between a column's reveals
const PENDING_DT = 2;   // demo-seconds a reveal stays undecided ("7h", accelerated)
const POP_T = 0.45;     // seconds of scale-pop when a cell changes

// States
const DIRT = 0, DISTURBED = 1, BORE = 2, GOO = 3, LATERAL_POCKET = 4, HELL = 5, PENDING = 6, RING_DRY = 7,
  SIPHONED = 8, POOL_DRAINED = 9; // rule-of-capture husks: pocket drunk dry / ring pool drained

// husk is deliberately warm/amber-leaning: a drained cell HELD oil (someone
// captured it) — distinct at diorama distance from the cold grey-brown of a
// dry wildcat hole that never held anything.
const SWATCH = { bore: "#2a1d10", goo: "#37f07a", lateral: "#ffb84d", hell: "#ff3f1f", pending: "#ffd75e", company: "#938a74", dry: "#4a4036", husk: "#a1793f" };

// Rule-of-capture demo pacing (demo-seconds)
const SIPHON_CHANCE = 0.55;  // open pocket adjacent to a bore gets drunk
const SIPHON_DELAY = 1;      // after the pocket opens
const SIPHON_DUR_MIN = 6;    // slow enough that a lateral can race it
const POOL_STEP = 1.5;       // ring pool cells fall to the wildcatter one by one

function cellNoise(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export default function StrataVoxels({
  oilGrid, hellPockets = [],
  gridX, gridY, depthZ, cellSize, depthCellSize,
  worldW, worldD,
  palette, blockHash = "0x0",
  onGroundClick,
  // LIVE MODE (build-order phase 3): pass the real oilPlots map and the wall
  // renders the actual field's history from Firestore — extracted/passed/
  // lateralTaken/hell per plot doc — instead of the mock season. Playback,
  // PLAY AS, and capture theatrics are mock-only and hide themselves.
  livePlots = null,
}) {
  const live = !!livePlots;
  const dirtRef = useRef();
  const featRef = useRef();

  // The outer ring is COMPANY LAND: unclaimable, never played, but border
  // claims can wildcat-drill into it (blind — no reveals out there).
  const isRingCol = useCallback((x, y) => x === 0 || y === 0 || x === gridX - 1 || y === gridY - 1, [gridX, gridY]);

  // Two demo claims picked FROM THE SEED so the player actually gets dealt
  // decisions: the wet-richest interior column (salvage trader), and the
  // border column with the best own+ring prospects (wildcatter).
  const demoClaims = useMemo(() => {
    const fallback = { int: { x: 4, y: 4 }, border: { x: 1, y: 4, ring: [0, 4] } };
    if (!oilGrid) return fallback;
    const ring = (x, y) => x === 0 || y === 0 || x === gridX - 1 || y === gridY - 1;
    const wet = (x, y) => { let n = 0; for (let z = 0; z < depthZ; z++) if (oilGrid[x][y][z] > 0) n++; return n; };
    let best = null, bestN = -1, bestB = null, bestBN = -1;
    for (let x = 1; x < gridX - 1; x++) {
      for (let y = 1; y < gridY - 1; y++) {
        const n = wet(x, y);
        if (n > bestN) { bestN = n; best = { x, y }; }
        const rn = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => ring(nx, ny));
        if (rn.length) {
          rn.sort((a, b) => wet(b[0], b[1]) - wet(a[0], a[1]));
          const score = n + wet(rn[0][0], rn[0][1]);
          if (score > bestBN) { bestBN = score; bestB = { x, y, ring: rn[0] }; }
        }
      }
    }
    return { int: best ?? fallback.int, border: bestB ?? fallback.border };
  }, [oilGrid, gridX, gridY, depthZ]);
  const demoClaimsRef = useRef(demoClaims);
  demoClaimsRef.current = demoClaims;

  const FOCI = useMemo(() => [null,
    { ...demoClaims.int, label: `INT X${demoClaims.int.x + 1}·Y${demoClaims.int.y + 1}` },
    { ...demoClaims.border, label: `BORDER X${demoClaims.border.x + 1}·Y${demoClaims.border.y + 1}` },
  ], [demoClaims]);
  const [focusMode, setFocusMode] = useState(0);
  const claim = FOCI[focusMode];
  const cluster = useMemo(() => {
    if (!claim) return null;
    const s = new Set([`${claim.x}_${claim.y}`]);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => s.add(`${claim.x + dx}_${claim.y + dy}`));
    return s;
  }, [claim]);

  // PLAY AS: the chosen claim becomes interactive — the season PAUSES at its
  // decision points and deals the real choice (strike assay → EXTRACT/PASS,
  // salvage alert → TAKE/IGNORE, wildcat offer in border mode), with a charge
  // budget of 8 so triage is felt, not described.
  const [playAs, setPlayAs] = useState(0);           // index into FOCI
  const playAsRef = useRef(0);
  const chargesRef = useRef(8);
  const [charges, setCharges] = useState(8);
  const [decision, setDecision] = useState(null);    // { kind, x, y, z, oil, ... } | null
  const decisionRef = useRef(null);
  // Player ledger: what you took, what you left, and what happened to it.
  const scoreRef = useRef({ banked: 0, salvaged: 0, passed: 0, missed: 0, taken: 0, drunk: 0 });
  const [score, setScore] = useState(scoreRef.current);
  const playerPassedRef = useRef(new Map());         // cellIdx → oil (your discards, for attribution)
  const seasonDoneRef = useRef(false);
  const tallyScore = (k, v) => { scoreRef.current = { ...scoreRef.current, [k]: scoreRef.current[k] + v }; setScore(scoreRef.current); };

  // UI state (playback internals live in refs — no re-render per frame)
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [xray, setXray] = useState(false);
  const [sliceRow, setSliceRow] = useState(0);
  const [day, setDay] = useState(0);
  const [ticker, setTicker] = useState([]);

  // ── The season timeline: every event precomputed from the seed ─────────────
  const timeline = useMemo(() => {
    if (!oilGrid) return null;
    const seed = parseInt(String(blockHash).slice(2, 10), 16) || 1;
    const rng = mulberry32(seed);
    const hellSet = new Set(hellPockets.map((h) => `${h.x}_${h.y}_${h.z}`));

    const wet = [];
    for (let x = 0; x < gridX; x++)
      for (let y = 0; y < gridY; y++)
        for (let z = 0; z < depthZ; z++)
          if (oilGrid[x][y][z] > 0) wet.push(oilGrid[x][y][z]);
    wet.sort((a, b) => a - b);
    const thresh = wet.length ? wet[Math.floor(wet.length * 0.35)] : Infinity;

    const ring = (x, y) => x === 0 || y === 0 || x === gridX - 1 || y === gridY - 1;
    const events = [];
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        if (ring(x, y)) continue; // company land: no rig, no reveals, no passes
        const ringNbrs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => [x + dx, y + dy])
          .filter(([nx, ny]) => ring(nx, ny));
        const off = cellNoise(x * 37 + y * 101) * REVEAL_DT; // rigs out of phase
        for (let z = 0; z < depthZ; z++) {
          const tR = off + z * REVEAL_DT;
          const oil = oilGrid[x][y][z];
          const outcome = hellSet.has(`${x}_${y}_${z}`) ? HELL
            : oil >= thresh ? BORE : oil > 0 ? GOO : DISTURBED;
          events.push({ t: tR, type: "reveal", x, y, z });
          events.push({ t: tR + PENDING_DT, type: "resolve", x, y, z, outcome, oil });
          // Salvage laterals: only fellow claimants can take a discard.
          const claimantDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) =>
            !ring(x + dx, y + dy) &&
            x + dx >= 0 && x + dx < gridX && y + dy >= 0 && y + dy < gridY);
          if (outcome === GOO && rng() < 0.35 && claimantDirs.length) {
            const [dx, dy] = claimantDirs[Math.floor(rng() * claimantDirs.length)];
            events.push({ t: tR + PENDING_DT + 2 + rng() * 10, type: "lateral", x, y, z, fx: x + dx, fy: y + dy });
          }
          // Rule of capture, interior terrain: an adjacent bore starts DRINKING
          // the open pocket — free, slow, interruptible (a lateral can still
          // snap up the remainder mid-drink). Mock uses plain adjacency; the
          // real rule adds same-deposit connectivity.
          if (outcome === GOO && rng() < SIPHON_CHANCE && claimantDirs.length) {
            const [dx, dy] = claimantDirs[Math.floor(rng() * claimantDirs.length)];
            const sStart = tR + PENDING_DT + SIPHON_DELAY + rng() * 3;
            events.push({ t: sStart, type: "siphonStart", x, y, z, fx: x + dx, fy: y + dy, end: sStart + SIPHON_DUR_MIN + rng() * 5 });
          }
          // Wildcats: a border claim drills blind into its private ring column,
          // only at depths its own bore has reached (depth prerequisite).
          if (ringNbrs.length && rng() < 0.22) {
            const [rx, ry] = ringNbrs[Math.floor(rng() * ringNbrs.length)];
            events.push({ t: tR + PENDING_DT + 0.8 + rng() * 2, type: "wildcat", x: rx, y: ry, z, fx: x, fy: y });
          }
        }
      }
    }
    events.sort((a, b) => a.t - b.t);
    // + slack so siphons/pool drains scheduled off the last reveals still finish
    const duration = (events[events.length - 1]?.t ?? 60) + 14;
    return { events, duration, hellSet, thresh };
  }, [oilGrid, hellPockets, gridX, gridY, depthZ, blockHash]);

  // ── Playback state (refs) ──────────────────────────────────────────────────
  const clockRef = useRef({ now: 0, idx: 0, lastUi: 0 });
  const stateRef = useRef(null);          // Uint8Array per cell
  const revealDepthRef = useRef(null);    // per column, layers revealed so far
  const lateralsRef = useRef([]);         // { fx, fy, x, y, z, at, kind }
  const recentRef = useRef([]);           // { x, y, z, at } for scale-pops
  const siphonRef = useRef(new Map());    // cellIdx → { start, end, fx, fy } — active drinks
  const drainQueueRef = useRef([]);       // { t, x, y, z, fx, fy } — ring pool cells falling
  const tickerRef = useRef([]);
  const dirtyRef = useRef(true);
  const idx3 = useCallback((x, y, z) => (x * gridY + y) * depthZ + z, [gridY, depthZ]);

  // ── LIVE MODE: derive every cell's state from the public plot docs ─────────
  // The whole render pipeline (instancing, slice, x-ray, shafts) is reused —
  // only the event source changes: Firestore snapshots instead of the mock
  // timeline. PENDING is publicly derivable: the newest revealed layer with no
  // recorded outcome is, by definition, an undecided core on somebody's table.
  useEffect(() => {
    if (!live) return;
    if (!stateRef.current) { // effect order vs resetSeason is not guaranteed
      stateRef.current = new Uint8Array(gridX * gridY * depthZ);
      revealDepthRef.current = new Uint16Array(gridX * gridY);
    }
    const st = stateRef.current; st.fill(DIRT);
    const rd = revealDepthRef.current; rd.fill(0);
    lateralsRef.current = [];
    siphonRef.current = new Map();
    drainQueueRef.current = [];
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        const p = livePlots[`${x}_${y}`];
        if (!p) continue;
        const dd = p.drillDay || 0;
        rd[x * gridY + y] = dd;
        for (let z = 0; z < depthZ; z++) {
          const i = idx3(x, y, z);
          if (p.hellLayers?.[z]) st[i] = HELL;
          else if (p.extracted?.[z] !== undefined) st[i] = BORE;
          else if (p.lateralTaken?.[z] !== undefined) st[i] = LATERAL_POCKET;
          else if (p.wildcatTaken?.[z] !== undefined) {
            // Frontier scars: warm amber = the wildcat struck; cold grey = dry hole.
            st[i] = (p.revealed?.[z] ?? 0) > 0 ? LATERAL_POCKET : RING_DRY;
          }
          else if (p.passed?.[z] !== undefined) {
            st[i] = ((p.passed[z] ?? 0) > 0 || p.passedInclusions?.[z]) ? GOO : DISTURBED;
          }
          else if (z === dd - 1 && p.revealed?.[z] !== undefined) st[i] = PENDING;
          else if (z < dd) st[i] = DISTURBED;
        }
      }
    }
    dirtyRef.current = true;
  }, [live, livePlots, gridX, gridY, depthZ, idx3]);

  const resetSeason = useCallback(() => {
    stateRef.current = new Uint8Array(gridX * gridY * depthZ);
    revealDepthRef.current = new Uint16Array(gridX * gridY);
    lateralsRef.current = [];
    recentRef.current = [];
    siphonRef.current = new Map();
    drainQueueRef.current = [];
    tickerRef.current = [];
    clockRef.current = { now: 0, idx: 0, lastUi: 0 };
    // Strip events injected by player decisions in the previous run — the
    // timeline memo survives RESTART, so injected events must not.
    if (timeline) timeline.events = timeline.events.filter((e) => !e.injected);
    chargesRef.current = 8; setCharges(8);
    decisionRef.current = null; setDecision(null);
    scoreRef.current = { banked: 0, salvaged: 0, passed: 0, missed: 0, taken: 0, drunk: 0 };
    setScore(scoreRef.current);
    playerPassedRef.current = new Map();
    seasonDoneRef.current = false;
    setDay(0); setTicker([]);
    dirtyRef.current = true;
  }, [gridX, gridY, depthZ, timeline]);
  useEffect(() => { resetSeason(); }, [resetSeason, timeline]);

  // Splice a runtime-generated event (a consequence of a player choice) into
  // the sorted timeline at its time — the normal handlers then run it.
  const injectEvent = useCallback((e) => {
    if (!timeline) return;
    e.injected = true;
    const ev = timeline.events;
    let i = clockRef.current.idx;
    while (i < ev.length && ev[i].t <= e.t) i++;
    ev.splice(i, 0, e);
  }, [timeline]);

  const colName = (x, y) => `X${x + 1}·Y${y + 1}`;

  // Apply all events up to demo-time `now`
  const advanceTo = useCallback((now) => {
    if (!timeline || !stateRef.current) return;
    const st = stateRef.current, ev = timeline.events, c = clockRef.current;
    let applied = false;
    while (c.idx < ev.length && ev[c.idx].t <= now) {
      const e = ev[c.idx++];
      applied = true;
      if (e.type === "reveal") {
        st[idx3(e.x, e.y, e.z)] = PENDING;
        revealDepthRef.current[e.x * gridY + e.y] = e.z + 1;
        recentRef.current.push({ x: e.x, y: e.y, z: e.z, at: e.t });
      } else if (e.type === "resolve") {
        const pc = playAsRef.current
          ? demoClaimsRef.current[playAsRef.current === 1 ? "int" : "border"] : null;
        if (pc && e.x === pc.x && e.y === pc.y) {
          // ── The player's own column: the sim doesn't decide, you do ────────
          const layersLeft = depthZ - e.z; // this layer included
          if (e.outcome === HELL) {
            st[idx3(e.x, e.y, e.z)] = HELL;
            recentRef.current.push({ x: e.x, y: e.y, z: e.z, at: e.t });
            decisionRef.current = { kind: "hell", x: e.x, y: e.y, z: e.z };
            setDecision(decisionRef.current); setPlaying(false);
            break;
          } else if ((e.oil ?? 0) <= 0) {
            st[idx3(e.x, e.y, e.z)] = DISTURBED;
            tickerRef.current.unshift(`your L${e.z + 1}: dry — passed (free)`);
          } else if (chargesRef.current >= layersLeft) {
            // Endgame rule: charges cover everything left — autopilot extracts.
            st[idx3(e.x, e.y, e.z)] = BORE;
            chargesRef.current -= 1; setCharges(chargesRef.current);
            tallyScore("banked", e.oil ?? 0);
            recentRef.current.push({ x: e.x, y: e.y, z: e.z, at: e.t });
            tickerRef.current.unshift(`AUTOPILOT: charges ≥ layers left — your L${e.z + 1} extracted (${(e.oil ?? 0).toFixed(1)} BTR)`);
          } else if (chargesRef.current <= 0) {
            st[idx3(e.x, e.y, e.z)] = GOO;
            tallyScore("missed", e.oil ?? 0);
            playerPassedRef.current.set(idx3(e.x, e.y, e.z), e.oil ?? 0);
            recentRef.current.push({ x: e.x, y: e.y, z: e.z, at: e.t });
            tickerRef.current.unshift(`no charges — your L${e.z + 1} passed (${(e.oil ?? 0).toFixed(1)} BTR, open)`);
            injectEvent({ t: e.t + 2 + 6 * cellNoise(e.z * 7 + 1), type: "lateral", x: e.x, y: e.y, z: e.z, fx: e.x + 1 < gridX - 1 ? e.x + 1 : e.x - 1, fy: e.y });
          } else {
            // A real decision: leave the core on the table, deal the card.
            decisionRef.current = { kind: "strike", x: e.x, y: e.y, z: e.z, oil: e.oil ?? 0, layersLeft };
            setDecision(decisionRef.current); setPlaying(false);
            break;
          }
        } else {
          st[idx3(e.x, e.y, e.z)] = e.outcome;
          if (e.outcome !== DISTURBED) {
            recentRef.current.push({ x: e.x, y: e.y, z: e.z, at: e.t });
            if (e.outcome === BORE) tickerRef.current.unshift(`${colName(e.x, e.y)} L${e.z + 1} → EXTRACTED`);
            else if (e.outcome === GOO) tickerRef.current.unshift(`${colName(e.x, e.y)} L${e.z + 1} passed — open`);
            else if (e.outcome === HELL) tickerRef.current.unshift(`${colName(e.x, e.y)} L${e.z + 1} — HELL POCKET`);
          }
          // Salvage alert: a discard opened next door to the player's claim.
          if (e.outcome === GOO && pc && chargesRef.current > 0 &&
              Math.abs(e.x - pc.x) + Math.abs(e.y - pc.y) === 1) {
            decisionRef.current = { kind: "salvage", x: e.x, y: e.y, z: e.z, oil: e.oil ?? 0 };
            setDecision(decisionRef.current); setPlaying(false);
            break;
          }
        }
      } else if (e.type === "lateral") {
        const i = idx3(e.x, e.y, e.z);
        if (st[i] === GOO) { // still open?
          st[i] = LATERAL_POCKET;
          const raced = siphonRef.current.delete(i); // snap up the remainder mid-drink
          lateralsRef.current.push({ fx: e.fx, fy: e.fy, x: e.x, y: e.y, z: e.z, at: e.t, kind: "hit" });
          recentRef.current.push({ x: e.x, y: e.y, z: e.z, at: e.t });
          const yours = playerPassedRef.current.get(i);
          if (yours !== undefined) tallyScore("taken", yours);
          tickerRef.current.unshift(yours !== undefined
            ? `${colName(e.fx, e.fy)} took YOUR discarded L${e.z + 1} (${yours.toFixed(1)} BTR)`
            : `${colName(e.fx, e.fy)} LATERAL took ${colName(e.x, e.y)} L${e.z + 1}${raced ? " — beat the siphon" : ""}`);
        }
      } else if (e.type === "siphonStart") {
        const i = idx3(e.x, e.y, e.z);
        if (st[i] === GOO && !siphonRef.current.has(i)) { // pocket still open, undrunk
          siphonRef.current.set(i, { start: e.t, end: e.end, fx: e.fx, fy: e.fy, x: e.x, y: e.y, z: e.z });
          tickerRef.current.unshift(`${colName(e.fx, e.fy)} bore is DRINKING ${colName(e.x, e.y)} L${e.z + 1}`);
        }
      } else if (e.type === "wildcat") {
        const i = idx3(e.x, e.y, e.z);
        if (st[i] === POOL_DRAINED) {
          tickerRef.current.unshift(`${colName(e.fx, e.fy)} WILDCAT ${colName(e.x, e.y)} L${e.z + 1} — drained husk, too late`);
        } else if (st[i] === DIRT) { // ring cell still unvisited?
          const oil = oilGrid?.[e.x]?.[e.y]?.[e.z] ?? 0;
          const hell = timeline.hellSet?.has(`${e.x}_${e.y}_${e.z}`);
          st[i] = hell ? HELL : oil > 0 ? LATERAL_POCKET : RING_DRY;
          lateralsRef.current.push({ fx: e.fx, fy: e.fy, x: e.x, y: e.y, z: e.z, at: e.t, kind: hell || oil > 0 ? "hit" : "dry" });
          recentRef.current.push({ x: e.x, y: e.y, z: e.z, at: e.t });
          tickerRef.current.unshift(hell
            ? `${colName(e.fx, e.fy)} WILDCAT ${colName(e.x, e.y)} L${e.z + 1} — WOKE A DEMON`
            : oil > 0
              ? `${colName(e.fx, e.fy)} WILDCAT ${colName(e.x, e.y)} L${e.z + 1} — STRUCK`
              : `${colName(e.fx, e.fy)} WILDCAT ${colName(e.x, e.y)} L${e.z + 1} — dry hole`);
          // Rule of capture, ring terrain: a strike starts draining its
          // connected pool — BFS through oily ring cells (mock connectivity;
          // the real rule follows blob membership), hell cells excluded. They
          // fall to the wildcatter one by one; a rival wildcat mid-drain
          // captures only what's left.
          if (!hell && oil > 0) {
            const pool = [];
            const seen = new Set([`${e.x}_${e.y}_${e.z}`]);
            const queue = [[e.x, e.y, e.z]];
            while (queue.length && pool.length < 8) {
              const [cx, cy, cz] = queue.shift();
              for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
                const nx = cx + dx, ny = cy + dy, nz = cz + dz;
                const key = `${nx}_${ny}_${nz}`;
                if (seen.has(key)) continue;
                seen.add(key);
                if (nx < 0 || nx >= gridX || ny < 0 || ny >= gridY || nz < 0 || nz >= depthZ) continue;
                if (!(nx === 0 || ny === 0 || nx === gridX - 1 || ny === gridY - 1)) continue; // pool stays in the ring
                if ((oilGrid?.[nx]?.[ny]?.[nz] ?? 0) <= 0) continue;
                if (timeline.hellSet?.has(key)) continue;
                pool.push([nx, ny, nz]);
                queue.push([nx, ny, nz]);
              }
            }
            pool.forEach(([px, py, pz], k) =>
              drainQueueRef.current.push({ t: e.t + (k + 1) * POOL_STEP, x: px, y: py, z: pz, fx: e.fx, fy: e.fy }));
            if (pool.length) tickerRef.current.unshift(`${colName(e.fx, e.fy)} pool drain begins — ${pool.length} connected cells`);
          }
        }
      }
    }
    if (applied) {
      tickerRef.current.length = Math.min(tickerRef.current.length, 3);
      dirtyRef.current = true;
    }
  }, [timeline, idx3, gridY, oilGrid, injectEvent, depthZ]);

  // ── Player decision handlers ─────────────────────────────────────────────
  const closeDecision = useCallback(() => {
    decisionRef.current = null; setDecision(null); setPlaying(true);
    dirtyRef.current = true;
  }, []);

  const decideStrike = useCallback((extract) => {
    const d = decisionRef.current;
    if (!d || d.kind !== "strike") return;
    const st = stateRef.current, i = idx3(d.x, d.y, d.z), t = clockRef.current.now;
    if (extract) {
      st[i] = BORE;
      chargesRef.current -= 1; setCharges(chargesRef.current);
      tallyScore("banked", d.oil);
      tickerRef.current.unshift(`YOU extracted L${d.z + 1} — ${d.oil.toFixed(1)} BTR banked`);
    } else {
      st[i] = GOO;
      tallyScore("passed", d.oil);
      playerPassedRef.current.set(i, d.oil);
      tickerRef.current.unshift(`YOU passed L${d.z + 1} — ${d.oil.toFixed(1)} BTR open to neighbours`);
      // Your discard enters the capture economy like anyone's.
      const nfx = d.x + 1 < gridX - 1 ? d.x + 1 : d.x - 1;
      const nfy = d.y + 1 < gridY - 1 ? d.y + 1 : d.y - 1;
      if (cellNoise(d.z * 13 + 5) < 0.5)
        injectEvent({ t: t + 2 + 6 * cellNoise(d.z * 17 + 3), type: "lateral", x: d.x, y: d.y, z: d.z, fx: nfx, fy: d.y });
      if (cellNoise(d.z * 29 + 11) < 0.55)
        injectEvent({ t: t + SIPHON_DELAY + 2, type: "siphonStart", x: d.x, y: d.y, z: d.z, fx: d.x, fy: nfy, end: t + SIPHON_DELAY + 2 + SIPHON_DUR_MIN + 4 });
    }
    recentRef.current.push({ x: d.x, y: d.y, z: d.z, at: t });
    tickerRef.current.length = Math.min(tickerRef.current.length, 3);
    closeDecision();
  }, [idx3, injectEvent, closeDecision, gridX, gridY]);

  const decideSalvage = useCallback((take) => {
    const d = decisionRef.current;
    if (!d || d.kind !== "salvage") return;
    const st = stateRef.current, i = idx3(d.x, d.y, d.z), t = clockRef.current.now;
    const pc = demoClaimsRef.current[playAsRef.current === 1 ? "int" : "border"];
    if (take && st[i] === GOO) {
      st[i] = LATERAL_POCKET;
      siphonRef.current.delete(i);
      chargesRef.current -= 1; setCharges(chargesRef.current);
      tallyScore("salvaged", d.oil);
      lateralsRef.current.push({ fx: pc.x, fy: pc.y, x: d.x, y: d.y, z: d.z, at: t, kind: "hit" });
      recentRef.current.push({ x: d.x, y: d.y, z: d.z, at: t });
      tickerRef.current.unshift(`YOU lateralled ${colName(d.x, d.y)} L${d.z + 1} — ${d.oil.toFixed(1)} BTR salvaged`);
      tickerRef.current.length = Math.min(tickerRef.current.length, 3);
    }
    closeDecision();
  }, [idx3, closeDecision]);

  const decideWildcat = useCallback(() => {
    const d = decisionRef.current;
    if (!d || d.kind !== "strike" || playAsRef.current !== 2) return;
    const bc = demoClaimsRef.current.border;
    const [rx, ry] = bc.ring;
    const st = stateRef.current, t = clockRef.current.now;
    if (st[idx3(rx, ry, d.z)] !== DIRT || chargesRef.current <= 1) return; // keep 1 for the strike itself
    chargesRef.current -= 1; setCharges(chargesRef.current);
    injectEvent({ t: t + 0.05, type: "wildcat", x: rx, y: ry, z: d.z, fx: bc.x, fy: bc.y });
    decisionRef.current = { ...d, wildcatted: true }; setDecision(decisionRef.current);
  }, [idx3, injectEvent]);

  // ── Colors ─────────────────────────────────────────────────────────────────
  const colors = useMemo(() => ({
    top: new THREE.Color(palette?.top ?? "#8b7355"),
    bottom: new THREE.Color(palette?.bottom ?? "#5a4030"),
    bore: new THREE.Color(SWATCH.bore),
    shaft: new THREE.Color("#1c130a"),
    goo: new THREE.Color(SWATCH.goo),
    gooReach: new THREE.Color("#8dffb8"), // brighter: reachable by YOU (focus mode)
    lateral: new THREE.Color(SWATCH.lateral),
    hell: new THREE.Color(SWATCH.hell),
    pendA: new THREE.Color("#efe0a8"),
    pendB: new THREE.Color(SWATCH.pending),
    company: new THREE.Color(SWATCH.company),
    dry: new THREE.Color(SWATCH.dry),
    husk: new THREE.Color(SWATCH.husk),
  }), [palette]);

  // ── Per-frame: advance clock, rebuild instances when dirty/animating ───────
  const CELLS = gridX * gridY * depthZ;
  const FEAT_MAX = CELLS + gridX * gridY + 800;

  useFrame((_, delta) => {
    const c = clockRef.current;
    if (!timeline || !stateRef.current) return;
    if (!live && playing && c.now < timeline.duration) {
      c.now += delta * speed;
      advanceTo(c.now);
    }
    // Rule-of-capture runtime: ring pool cells falling to their wildcatter,
    // and siphons finishing their drink. (Mock-only — live capture lands in
    // build-order phase 5.)
    const stq = stateRef.current;
    if (live) {
      // Live wall: state comes from Firestore (the effect above); only the
      // rebuild machinery below runs.
      if (!dirtyRef.current && recentRef.current.length === 0) return;
    } else {
    if (drainQueueRef.current.length) {
      const rest = [];
      for (const d of drainQueueRef.current) {
        if (d.t > c.now) { rest.push(d); continue; }
        const i = idx3(d.x, d.y, d.z);
        if (stq[i] === DIRT) {
          stq[i] = POOL_DRAINED;
          recentRef.current.push({ x: d.x, y: d.y, z: d.z, at: d.t });
          dirtyRef.current = true;
        }
      }
      drainQueueRef.current = rest;
    }
    for (const [i, s] of siphonRef.current) {
      if (s.end <= c.now) {
        siphonRef.current.delete(i);
        if (stq[i] === GOO) {
          stq[i] = SIPHONED;
          recentRef.current.push({ x: s.x, y: s.y, z: s.z, at: s.end });
          const yours = playerPassedRef.current.get(i);
          if (yours !== undefined) tallyScore("drunk", yours);
          tickerRef.current.unshift(yours !== undefined
            ? `${colName(s.fx, s.fy)} drank YOUR discarded L${s.z + 1} dry (${yours.toFixed(1)} BTR)`
            : `${colName(s.fx, s.fy)} drank ${colName(s.x, s.y)} L${s.z + 1} dry`);
          tickerRef.current.length = Math.min(tickerRef.current.length, 3);
          dirtyRef.current = true;
        }
      }
    }
    // Season over: deal the reckoning card once.
    if (playAsRef.current && !seasonDoneRef.current && timeline && c.now >= timeline.duration && !decisionRef.current) {
      seasonDoneRef.current = true;
      const pcS = demoClaimsRef.current[playAsRef.current === 1 ? "int" : "border"];
      let columnTotal = 0;
      for (let z = 0; z < depthZ; z++) columnTotal += Math.max(0, oilGrid?.[pcS.x]?.[pcS.y]?.[z] ?? 0);
      decisionRef.current = { kind: "summary", columnTotal };
      setDecision(decisionRef.current); setPlaying(false);
    }
    // Throttled UI mirrors (day readout, ticker)
    if (c.now - c.lastUi > 0.4) {
      c.lastUi = c.now;
      const d = Math.min(SEASON_DAYS, (c.now / timeline.duration) * SEASON_DAYS);
      setDay(Math.round(d * 10) / 10);
      setTicker([...tickerRef.current]);
    }
    // Prune finished pops
    const before = recentRef.current.length;
    recentRef.current = recentRef.current.filter((r) => c.now - r.at < POP_T);
    if (recentRef.current.length !== before) dirtyRef.current = true;
    } // end mock-only runtime

    const animating = recentRef.current.length > 0;
    const hasPending = !live && playing && c.now < timeline.duration; // gold pulse needs per-frame color
    if (!dirtyRef.current && !animating && !hasPending) return;
    dirtyRef.current = false;

    const dirt = dirtRef.current, feat = featRef.current;
    if (!dirt || !feat) return;
    const st = stateRef.current;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const cellY = (z) => -(z + 0.5) * depthCellSize;
    const cellX = (x) => -worldW / 2 + (x + 0.5) * cellSize;
    const cellZ = (y) => worldD / 2 - (y + 0.5) * cellSize;
    const popScale = (x, y, z) => {
      for (const r of recentRef.current)
        if (r.x === x && r.y === y && r.z === z)
          return easeOutBack(Math.min(1, (c.now - r.at) / POP_T));
      return 1;
    };
    const inCluster = (x, y) => !!cluster?.has(`${x}_${y}`);
    const isNeighborCol = (x, y) => inCluster(x, y) && !(claim && x === claim.x && y === claim.y);
    let di = 0, fi = 0;

    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        if (focusMode && !inCluster(x, y)) continue;
        if (!focusMode && y < sliceRow) continue;
        for (let z = 0; z < depthZ; z++) {
          const s = st[idx3(x, y, z)];
          const px = cellX(x), py = cellY(z), pz = cellZ(y);
          if (s === DIRT || s === DISTURBED) {
            if (xray) continue;
            m.compose(new THREE.Vector3(px, py, pz), q,
              new THREE.Vector3(cellSize * 0.96, depthCellSize * 0.92, cellSize * 0.96));
            dirt.setMatrixAt(di, m);
            const band = Math.floor(z / 2) / Math.ceil(depthZ / 2 - 1);
            col.copy(colors.top).lerp(colors.bottom, band);
            // Company-ring tint is mock-only until phase 4 ships the real ring.
            if (!live && isRingCol(x, y)) col.lerp(colors.company, 0.5);
            const j = 0.92 + cellNoise(idx3(x, y, z)) * 0.12;
            col.multiplyScalar(s === DISTURBED ? j * 0.8 : j);
            dirt.setColorAt(di, col);
            di++;
          } else {
            const pop = popScale(x, y, z);
            let sc = s === BORE ? 0.88 : s === RING_DRY ? 0.5
              : (s === SIPHONED || s === POOL_DRAINED) ? 0.55 : 0.92;
            if (s === GOO) {
              // Fixed parcel, variable fill: an actively-drunk pocket deflates.
              const sip = siphonRef.current.get(idx3(x, y, z));
              if (sip) {
                const f = 1 - Math.min(1, Math.max(0, (c.now - sip.start) / (sip.end - sip.start)));
                sc = 0.35 + 0.57 * f;
              }
            }
            m.compose(new THREE.Vector3(px, py, pz), q,
              new THREE.Vector3(cellSize * sc * pop, depthCellSize * (s === BORE ? 0.84 : 0.9) * pop, cellSize * sc * pop));
            feat.setMatrixAt(fi, m);
            if (s === PENDING) {
              const pulse = 0.5 + 0.5 * Math.sin(c.now * 6 + idx3(x, y, z));
              col.copy(colors.pendA).lerp(colors.pendB, pulse);
              feat.setColorAt(fi, col);
            } else if (s === GOO) {
              feat.setColorAt(fi, focusMode && isNeighborCol(x, y) ? colors.gooReach : colors.goo);
            } else {
              feat.setColorAt(fi, s === BORE ? colors.bore : s === HELL ? colors.hell
                : s === RING_DRY ? colors.dry
                : (s === SIPHONED || s === POOL_DRAINED) ? colors.husk : colors.lateral);
            }
            fi++;
          }
        }
      }
    }
    // Drill shafts (per column, down to its own reveal depth)
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        if (focusMode && !inCluster(x, y)) continue;
        if (!focusMode && y < sliceRow) continue;
        const rev = revealDepthRef.current[x * gridY + y];
        if (!rev) continue;
        const len = rev * depthCellSize;
        m.compose(new THREE.Vector3(cellX(x), -len / 2, cellZ(y)), q,
          new THREE.Vector3(cellSize * 0.1, len, cellSize * 0.1));
        feat.setMatrixAt(fi, m);
        feat.setColorAt(fi, colors.shaft);
        fi++;
      }
    }
    // Lateral tunnel bars (grow in from the taker's side)
    for (const L of lateralsRef.current) {
      if (focusMode && !inCluster(L.x, L.y) && !inCluster(L.fx, L.fy)) continue;
      if (!focusMode && (L.y < sliceRow || L.fy < sliceRow)) continue;
      const grow = Math.min(1, (c.now - L.at) / POP_T);
      const x0 = cellX(L.fx), z0 = cellZ(L.fy), x1 = cellX(L.x), z1 = cellZ(L.y);
      m.compose(
        new THREE.Vector3(x0 + (x1 - x0) * 0.5 * grow, cellY(L.z), z0 + (z1 - z0) * 0.5 * grow), q,
        new THREE.Vector3(
          Math.max(Math.abs(x1 - x0) * grow, cellSize * 0.24), depthCellSize * 0.28,
          Math.max(Math.abs(z1 - z0) * grow, cellSize * 0.24)));
      feat.setMatrixAt(fi, m);
      feat.setColorAt(fi, L.kind === "dry" ? colors.dry : colors.lateral);
      fi++;
      if (fi >= FEAT_MAX) break;
    }
    // Player-claim beacon + CORE RACK: a bobbing gold marker over the demo
    // claim, and the claim's whole column raised as a floating totem — one
    // thin slab per layer, shallow at top, colored by state. Your decisions
    // land on it instantly even though the column itself is buried interior.
    if (playAsRef.current) {
      const pcB = demoClaimsRef.current[playAsRef.current === 1 ? "int" : "border"];
      const bob = 0.06 * Math.sin(c.now * 3);
      const rackBase = 0.55, slabH = depthCellSize * 0.22;
      m.compose(new THREE.Vector3(cellX(pcB.x), rackBase + depthZ * slabH + 0.3 + bob, cellZ(pcB.y)),
        q, new THREE.Vector3(cellSize * 0.22, depthCellSize * 0.6, cellSize * 0.22));
      feat.setMatrixAt(fi, m);
      feat.setColorAt(fi, colors.pendB);
      fi++;
      for (let z = 0; z < depthZ; z++) {
        const s = stq[idx3(pcB.x, pcB.y, z)];
        const y = rackBase + (depthZ - 1 - z) * slabH; // shallow layer on top
        const wide = s === GOO || s === LATERAL_POCKET ? 0.4 : 0.3;
        m.compose(new THREE.Vector3(cellX(pcB.x), y, cellZ(pcB.y)), q,
          new THREE.Vector3(cellSize * wide, slabH * 0.8, cellSize * wide));
        feat.setMatrixAt(fi, m);
        if (s === PENDING) {
          const pulse = 0.5 + 0.5 * Math.sin(c.now * 6 + z);
          col.copy(colors.pendA).lerp(colors.pendB, pulse);
          feat.setColorAt(fi, col);
        } else {
          feat.setColorAt(fi,
            s === BORE ? colors.bore : s === GOO ? colors.goo
            : s === LATERAL_POCKET ? colors.lateral : s === HELL ? colors.hell
            : s === SIPHONED ? colors.husk : s === DISTURBED ? colors.dry : colors.company);
        }
        fi++;
      }
    }
    // Salvage-target marker: while a salvage card is open, a green beacon bobs
    // over the neighbour column holding the open pocket.
    if (decisionRef.current?.kind === "salvage") {
      const d = decisionRef.current;
      m.compose(new THREE.Vector3(cellX(d.x), 0.5 + 0.06 * Math.sin(c.now * 4), cellZ(d.y)),
        q, new THREE.Vector3(cellSize * 0.22, depthCellSize * 0.6, cellSize * 0.22));
      feat.setMatrixAt(fi, m);
      feat.setColorAt(fi, colors.gooReach);
      fi++;
    }

    dirt.count = di; feat.count = fi;
    dirt.instanceMatrix.needsUpdate = true;
    feat.instanceMatrix.needsUpdate = true;
    if (dirt.instanceColor) dirt.instanceColor.needsUpdate = true;
    if (feat.instanceColor) feat.instanceColor.needsUpdate = true;
  });

  const jumpDay = useCallback(() => {
    if (!timeline || decisionRef.current) return; // a decision is on the table
    const c = clockRef.current;
    c.now = Math.min(timeline.duration, c.now + timeline.duration / SEASON_DAYS);
    advanceTo(c.now);
  }, [timeline, advanceTo]);

  // ── Panel ──────────────────────────────────────────────────────────────────
  const btn = (active) => ({
    font: "inherit", color: "#e8e0c8",
    background: active ? "rgba(95,233,255,0.25)" : "rgba(232,224,200,0.12)",
    border: "1px solid rgba(232,224,200,0.4)", borderRadius: 3,
    padding: "1px 7px", margin: "0 2px", cursor: "pointer", pointerEvents: "auto",
  });
  const swatch = (color, dashed) => ({
    display: "inline-block", width: 9, height: 9,
    background: dashed ? "transparent" : color,
    border: dashed ? `1.5px solid ${color}` : "1px solid rgba(0,0,0,0.4)",
    marginRight: 4, verticalAlign: "-1px",
  });

  return (
    <group>
      <instancedMesh
        ref={dirtRef}
        args={[undefined, undefined, CELLS]}
        frustumCulled={false}
        onClick={(e) => {
          // Only the TOP surface navigates. The wall faces are content, not a
          // destination — clicking them dollied the camera into the cube's
          // side. (Instances only translate/scale, so the local face normal
          // is world-aligned: top faces have normal.y ≈ 1.)
          if (e.face?.normal?.y > 0.5) onGroundClick?.(e);
          else e.stopPropagation();
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0.03} />
      </instancedMesh>
      <instancedMesh ref={featRef} args={[undefined, undefined, FEAT_MAX]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      {/* Screen-space panel pinned top-left — NOT world-anchored (a 3D anchor
          projects it across the middle of the view at some zooms). */}
      <Html calculatePosition={() => [14, 14]} style={{ pointerEvents: "none" }} zIndexRange={[40, 30]}>
        <div style={{
          font: "10px/1.8 monospace", color: "#e8e0c8", background: "rgba(20,18,12,0.85)",
          border: "1px solid rgba(232,224,200,0.35)", borderRadius: 4, padding: "7px 10px",
          whiteSpace: "normal", width: 330, letterSpacing: "0.05em",
        }}>
          {live
            ? <span>STRATA · <span style={{ color: "#8dffb8" }}>LIVE FIELD</span> <span style={{ opacity: 0.75 }}>— real plots, updating with every strike & decision</span></span>
            : <span>STRATA DEMO · <span style={{ opacity: 0.75 }}>MOCK SEASON, ACCELERATED (~90s) — not live data</span></span>}<br />
          {!live && (<>
            DAY {day.toFixed(1)}/{SEASON_DAYS}
            &nbsp;<button style={btn(false)} onClick={() => { resetSeason(); setPlaying(true); }}>⏮ RESTART</button>
            <button style={btn(playing)} onClick={() => setPlaying((p) => !p)}>{playing ? "⏸ PAUSE" : "⏵ PLAY"}</button>
            <button style={btn(false)} onClick={jumpDay}>+1 DAY</button>
            <button style={btn(speed === 3)} onClick={() => setSpeed((s) => (s === 1 ? 3 : 1))}>3×</button><br />
            <button style={btn(playAs > 0)} onClick={() => {
              const next = (playAs + 1) % 3;
              setPlayAs(next); playAsRef.current = next;
              chargesRef.current = 8; setCharges(8);
              decisionRef.current = null; setDecision(null); setPlaying(true);
            }}>PLAY AS: {playAs ? FOCI[playAs].label : "OFF"}</button>
            {playAs > 0 && <span> CHARGES {charges}/8 </span>}
          </>)}
          {!live && <button style={btn(focusMode > 0)} onClick={() => setFocusMode((v) => (v + 1) % 3)}>
            VIEW: {claim ? claim.label : "FIELD"}</button>}
          <button style={btn(xray)} onClick={() => setXray((v) => !v)}>X-RAY</button>
          {!focusMode && (<span>
            &nbsp;SLICE <button style={btn(false)} onClick={() => setSliceRow((s) => Math.max(0, s - 1))}>−</button>
            Y{sliceRow}
            <button style={btn(false)} onClick={() => setSliceRow((s) => Math.min(gridY - 1, s + 1))}>+</button>
          </span>)}<br />
          {!live && <><span style={swatch(SWATCH.company)} />company ring&nbsp;</>}
          <span style={swatch(SWATCH.pending)} />pending
          &nbsp;<span style={swatch(SWATCH.bore)} />extracted
          &nbsp;<span style={swatch(SWATCH.goo)} />passed — open
          {!live && <>&nbsp;<span style={swatch("#8dffb8")} />reachable (yours)</>}
          &nbsp;<span style={swatch(SWATCH.lateral)} />taken
          &nbsp;<span style={swatch(SWATCH.dry)} />dry wildcat
          {!live && <>&nbsp;<span style={swatch(SWATCH.husk)} />drained (capture)</>}
          &nbsp;<span style={swatch(SWATCH.hell)} />hell<br />
          {live
            ? <span style={{ opacity: 0.7 }}>the real field's ledger: gold = a core on someone's table · green = open to laterals (take them from your CORE SAMPLE card) · amber = salvaged</span>
            : <span style={{ opacity: 0.7 }}>rule of capture: bores DRINK adjacent open pockets (deflating green — a lateral can still beat the straw) · wildcat strikes drain connected ring pools · PLAY AS deals you the real decisions</span>}
          {playAs > 0 && (
            <span style={{ display: "block", color: "#c8f7d4", marginTop: 4 }}>
              BANKED {score.banked.toFixed(1)} · SALVAGED {score.salvaged.toFixed(1)} ·
              LEFT BEHIND {(score.passed + score.missed).toFixed(1)}
              {(score.taken + score.drunk) > 0 && <> (rivals got {(score.taken + score.drunk).toFixed(1)})</>}
            </span>
          )}
          {playAs > 0 && !decision && (
            <span style={{ display: "block", color: "#ffd75e", marginTop: 4 }}>
              ⛏ YOUR DEMO CLAIM: {FOCI[playAs].label} — gold beacon + floating
              core rack show your column (shallow at top). Cards deal on WET
              reveals; dry layers pass free. Separate from your real rig panels.
            </span>
          )}
          {ticker.map((t, i) => (
            <span key={i} style={{ display: "block", opacity: 0.85 - i * 0.25, lineHeight: 1.5 }}>▸ {t}</span>
          ))}
          {decision && (
            <div style={{
              marginTop: 6, padding: "8px 10px", border: "1.5px solid #ffd75e",
              borderRadius: 4, background: "rgba(60,48,10,0.55)", whiteSpace: "normal", maxWidth: 340,
            }}>
              {decision.kind === "strike" && (<>
                <span style={{ color: "#ffd75e" }}>⛏ STRIKE — YOUR L{decision.z + 1} · CORE ASSAY: {decision.oil.toFixed(1)} BTR</span><br />
                EXTRACT banks the full {decision.oil.toFixed(1)} for 1 charge ·
                PASS is free but final (neighbours can take it)<br />
                charges {charges}/8 · {decision.layersLeft} layers still below ·
                if you walk away the crew follows your standing order
                ("extract ≥ {timeline?.thresh?.toFixed(0)}") → would {decision.oil >= (timeline?.thresh ?? 0) ? "EXTRACT" : "PASS"}<br />
                <button style={btn(false)} onClick={() => decideStrike(true)}>EXTRACT −1⚡ (bank it)</button>
                <button style={btn(false)} onClick={() => decideStrike(false)}>PASS (vent — open to neighbours)</button>
                {playAs === 2 && !decision.wildcatted && (
                  <button style={btn(false)} onClick={decideWildcat}>+ WILDCAT RING L{decision.z + 1} −1⚡ (blind)</button>
                )}
                {decision.wildcatted && <span style={{ opacity: 0.8 }}> wildcat away…</span>}
              </>)}
              {decision.kind === "salvage" && (<>
                <span style={{ color: "#8dffb8" }}>🛢 SALVAGE — {`X${decision.x + 1}·Y${decision.y + 1}`} passed L{decision.z + 1}: {decision.oil.toFixed(1)} BTR sits open next door</span><br />
                first lateral wins · a rival bore may start drinking it<br />
                <button style={btn(false)} onClick={() => decideSalvage(true)}>TAKE −1⚡ (lateral now)</button>
                <button style={btn(false)} onClick={() => decideSalvage(false)}>IGNORE (watch the race)</button>
              </>)}
              {decision.kind === "hell" && (<>
                <span style={{ color: "#ff6f5f" }}>☠ HELL POCKET — YOUR L{decision.z + 1}. Tonic consumed; the breach is capped.</span><br />
                <button style={btn(false)} onClick={closeDecision}>CONTINUE</button>
              </>)}
              {decision.kind === "summary" && (<>
                <span style={{ color: "#ffd75e" }}>◼ SEASON OVER — THE RECKONING</span><br />
                your column held {decision.columnTotal.toFixed(1)} BTR ·
                you banked {score.banked.toFixed(1)} ({decision.columnTotal > 0 ? Math.round((score.banked / decision.columnTotal) * 100) : 0}%)
                + {score.salvaged.toFixed(1)} salvaged from neighbours<br />
                left behind {(score.passed + score.missed).toFixed(1)}
                — rivals captured {(score.taken + score.drunk).toFixed(1)} of it
                ({score.taken.toFixed(1)} lateralled · {score.drunk.toFixed(1)} drunk)
                · {charges} charge{charges === 1 ? "" : "s"} unspent (wasted at the buzzer)<br />
                <button style={btn(false)} onClick={closeDecision}>CONTINUE (watch the field)</button>
              </>)}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
