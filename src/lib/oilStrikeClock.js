// Pure timing math for the fill-the-season strike clock (docs/oil-game.md →
// "TIMING FRAMEWORK"). No Firebase / IO deps so it's unit-testable in isolation
// and reusable by both the server strike loop and the client display.
//
//   • Season  — fixed-length round; everyone ends together at the buzzer.
//   • Depth   — depthCap = min(PASSIVE_DRILLS + bonusDrills, MAX_DEPTH); bonus
//               buys deeper layers AND a shorter interval (more strikes).
//   • Cadence — avg interval = remaining-season ÷ remaining-layers (recomputed
//               per strike, so mid-season bonus / late joins self-re-pace), with
//               the strike placed at a random, unguessable moment in its window.

export const PASSIVE_DRILLS = 10; // base depth every rig reaches by season end
export const MAX_DEPTH = 20;      // hard ceiling (base + bonus)

// Per-rig reachable depth. `depthZ` is the field's actual depth (clamps the cap
// if the field is shallower than MAX_DEPTH).
export function depthCapFor(drill, depthZ = MAX_DEPTH) {
  const bonus = (drill && drill.bonusDrills) || 0;
  return Math.min(PASSIVE_DRILLS + bonus, MAX_DEPTH, depthZ);
}

// Season clock from settings. Returns null (→ legacy once-per-day cadence) unless
// BOTH gameStartDate and a positive seasonLengthDays are configured.
export function seasonClock(settings) {
  const startDate = settings && settings.gameStartDate;
  const lengthDays = Number(settings && settings.seasonLengthDays);
  if (!startDate || !lengthDays || lengthDays <= 0) return null;
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(startMs)) return null;
  return { startMs, endMs: startMs + lengthDays * 86400000, lengthDays };
}

// Deterministic fraction in [0,1) placing the strike at a random, unguessable
// moment WITHIN its interval window. Keyed on (rig, window index) so it's stable
// across ticks (idempotent) yet unpredictable — the engagement engine.
export function strikeFraction(userId, windowIndex) {
  const s = `${userId}#${windowIndex}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return (Math.abs(h) % 100000) / 100000;
}

// Next strike's target time. `lastStrikeMs` is the rig's last strike (ms) or null
// for its first strike (→ window opens at season start). interval = remaining
// season ÷ remaining layers; target = windowStart + frac·interval.
export function strikeTargetMs(season, lastStrikeMs, currentDepth, depthCap, userId) {
  const windowStartMs = lastStrikeMs == null ? season.startMs : lastStrikeMs;
  const remainingLayers = depthCap - currentDepth;
  if (remainingLayers <= 0) return { windowStartMs, intervalMs: 0, targetMs: Infinity };
  const remainingMs = Math.max(season.endMs - windowStartMs, 0);
  const intervalMs = remainingMs / remainingLayers;
  const targetMs = windowStartMs + strikeFraction(userId, currentDepth) * intervalMs;
  return { windowStartMs, intervalMs, targetMs };
}
