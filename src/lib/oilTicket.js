// DAILY TICKET — the rules of the scratch ticket, shared by the server
// (oil-ticket-mint / oil-ticket-settle) and the client (the legend, and the
// local mint used in test mode). Pure and isomorphic: no crypto, no Firestore.
//
// A ticket is nine cells in a 3×3. Three of one symbol wins that symbol's
// prize. The outcome is drawn FIRST (top-down through TICKET_PRIZES by
// probability; what's left is a losing ticket, ≈57%), then the cells are laid
// to match it: a winner carries exactly three of the winning symbol and at
// most two of anything else; a loser at most two of everything. Fillers are
// random — no engineered near-misses. Scratching only uncovers it.
//
// Free entry, one ticket per UTC day, prizes paid in game terms (never
// dollars): a sweepstakes, not a wager.

export const TICKET_CELLS = 9;
export const TICKET_MATCH = 3;
export const TICKET_STREAK_GUARANTEE = 7; // every 7th ticket of an unbroken streak is at least the small win

export const TICKET_SYMBOLS = ["pickaxe", "derrick", "coin", "gusher", "barrel", "dry"];

// The prize table — the economy. Probabilities are per ticket, checked
// top-down. Prizes are progression, protection, access or cosmetics — never
// BTR or USDC (banked BTR converts to USDC at the buzzer; a free ticket that
// paid it would be a cash lottery, not a sweepstakes).
//   bonusDrills → oilDrills.bonusDrills (capped like every other bonus) + bonusFromTickets
//   claimJumps  → oilDrills.bonusClaimJumps (extra free rig moves)
//   supply      → oilDrills.supplies.{tonic}: a tonic makes the next strike drill two layers
//   coupon      → oilDrills.coupon: COUPON_PCT off one Pimp My Pump purchase, COUPON_DAYS to use it
export const COUPON_PCT = 25;
export const COUPON_DAYS = 7;
export const TICKET_PRIZES = [
  { sym: "gusher",  tier: "jackpot", p: 1 / 60, prize: "JACKPOT · 3 BONUS DRILLS + A CLAIM JUMP",    short: "JACKPOT",  bonusDrills: 3, claimJumps: 1 },
  { sym: "coin",    tier: "medium",  p: 1 / 24, prize: `STALL COUPON · ${COUPON_PCT}% OFF ONE UPGRADE`, short: "COUPON",   coupon: true },
  { sym: "derrick", tier: "medium",  p: 1 / 24, prize: "A TONIC · NEXT STRIKE DRILLS TWO LAYERS",      short: "TONIC",    supply: "tonic" },
  { sym: "pickaxe", tier: "small",   p: 1 / 3,  prize: "+1 BONUS DRILL",                               short: "+1 DRILL", bonusDrills: 1 },
];
export const TICKET_PRIZE_BY_SYM = Object.fromEntries(TICKET_PRIZES.map((p) => [p.sym, p]));
export const TICKET_WIN_RATE = TICKET_PRIZES.reduce((s, p) => s + p.p, 0);

// A coupon on the drill doc: { pct, expiresAt (ms), issuedDay }. Valid while unexpired.
export const couponValid = (c, now = Date.now()) => !!c && typeof c.expiresAt === "number" && c.expiresAt > now && (c.pct || 0) > 0;
export const couponDaysLeft = (c, now = Date.now()) => (couponValid(c, now) ? Math.max(1, Math.ceil((c.expiresAt - now) / 86400000)) : 0);

// Ticket ids: the daily ticket is its day key; admin test tickets are
// `${day}_t${n}` — they pay prizes (so QA can see them land) but never touch
// the streak or the ledger.
export const isTicketId = (s) => typeof s === "string" && /^\d{8}(_t\d{1,3})?$/.test(s);
export const isTestTicketId = (s) => typeof s === "string" && /_t\d{1,3}$/.test(s);

// ── days ──
// The ticket day is a UTC day, like the drill day.
export function ticketDayKey(date = new Date()) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}
export function isDayKey(s) { return typeof s === "string" && /^\d{8}$/.test(s); }
const dayKeyToUtcMs = (k) => Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
// Whole days from a to b (b - a); null if either is missing/invalid.
export function dayDiff(a, b) {
  if (!isDayKey(a) || !isDayKey(b)) return null;
  return Math.round((dayKeyToUtcMs(b) - dayKeyToUtcMs(a)) / 86400000);
}
export function msToNextTicketDay(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

// ── deterministic randomness ──
// FNV-1a over a string → 32-bit seed; mulberry32 for the draws. Good enough for
// a ticket whose seed is already a cryptographic HMAC on the server (the
// client's test mode hashes a label instead).
export const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const seedToInt = (hex) => parseInt(String(hex).slice(0, 8), 16) >>> 0;
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (arr, rng) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

// ── mint ──
// Draw the prize (or none), then lay the cells. `forced` (test mode only) is
// a prize symbol or "lose".
export function drawPrize(roll, guaranteeWin = false) {
  let acc = 0;
  for (const pz of TICKET_PRIZES) { acc += pz.p; if (roll < acc) return pz; }
  return guaranteeWin ? TICKET_PRIZES[TICKET_PRIZES.length - 1] : null;
}
export function mintTicketCells(seed32, { guaranteeWin = false, forced = null } = {}) {
  const rng = mulberry32(seed32 >>> 0);
  let win = drawPrize(rng(), guaranteeWin);
  if (forced) win = forced === "lose" ? null : (TICKET_PRIZE_BY_SYM[forced] || win);
  const cells = new Array(TICKET_CELLS).fill(null);
  const counts = {};
  if (win) {
    const idx = shuffle([...Array(TICKET_CELLS).keys()], rng);
    for (let i = 0; i < TICKET_MATCH; i++) cells[idx[i]] = win.sym;
    counts[win.sym] = TICKET_MATCH;
  }
  for (let i = 0; i < TICKET_CELLS; i++) {
    if (cells[i]) continue;
    const pool = TICKET_SYMBOLS.filter((s) => s !== win?.sym && (counts[s] || 0) < TICKET_MATCH - 1);
    const s = pool[Math.floor(rng() * pool.length)];
    cells[i] = s; counts[s] = (counts[s] || 0) + 1;
  }
  return { cells, win };
}

// ── evaluate ──
// The outcome from the cells alone — the server recomputes this at settle and
// never trusts a claimed result.
export function evaluateCells(cells) {
  const counts = {};
  for (const s of cells || []) counts[s] = (counts[s] || 0) + 1;
  const sym = Object.keys(counts).find((s) => counts[s] >= TICKET_MATCH && TICKET_PRIZE_BY_SYM[s]) || null;
  return { sym, win: sym ? TICKET_PRIZE_BY_SYM[sym] : null };
}
// A layout this module could have minted: nine known symbols, nothing over
// three, at most one symbol at three (and it must be a prize symbol).
export function isValidLayout(cells) {
  if (!Array.isArray(cells) || cells.length !== TICKET_CELLS) return false;
  if (!cells.every((s) => TICKET_SYMBOLS.includes(s))) return false;
  const counts = {};
  for (const s of cells) counts[s] = (counts[s] || 0) + 1;
  const triples = Object.keys(counts).filter((s) => counts[s] >= TICKET_MATCH);
  if (Object.values(counts).some((n) => n > TICKET_MATCH)) return false;
  if (triples.length > 1) return false;
  if (triples.length === 1 && !TICKET_PRIZE_BY_SYM[triples[0]]) return false;
  return true;
}
