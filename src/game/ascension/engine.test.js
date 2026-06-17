// The Ascension — engine unit tests. Pure logic, no graphics.
// Run with Node's built-in runner (no framework needed):
//   node --test src/game/ascension/
import test from "node:test";
import assert from "node:assert/strict";

import { createRace, resolveTurn, pray, canPray, getWinner } from "./engine.js";
import { TRACK_LENGTH, GRACE_START } from "./config.js";

// Helper: advance through the scripted deck up to (and including) the rug at index 3.
function throughTheRug() {
  let s = createRace();
  for (let i = 0; i < 4; i++) s = resolveTurn(s);
  return s;
}

test("createRace seeds two racers at step 0 with starting grace", () => {
  const s = createRace();
  assert.equal(s.status, "racing");
  assert.equal(s.grace, GRACE_START);
  assert.equal(s.racers.monk.step, 0);
  assert.equal(s.racers.demon.step, 0);
  assert.equal(s.racers.monk.state, "idle");
});

test("pump advances the targeted racer and emits a move event", () => {
  let s = createRace();
  s = resolveTurn(s); // deck[0]: pump monk
  assert.equal(s.racers.monk.step, 1);
  assert.equal(s.racers.monk.state, "running");
  const move = s.events.find((e) => e.type === "move");
  assert.ok(move);
  assert.equal(move.racerId, "monk");
  assert.equal(move.to, 1);
});

test("discipline +1 vs greed +2 is character-driven", () => {
  let s = createRace();
  s = resolveTurn(s); // pump monk  → +1
  s = resolveTurn(s); // pump demon → +2
  assert.equal(s.racers.monk.step, 1);
  assert.equal(s.racers.demon.step, 2);
});

test("rug knocks the demon back, downs him, and offers a prayer", () => {
  const s = throughTheRug();
  assert.equal(s.racers.demon.state, "falling");
  assert.ok(s.racers.demon.downTurns > 0);
  assert.equal(s.racers.demon.step, 0); // was 2, knockback 3, clamped at 0
  assert.ok(s.pendingPrayer);
  assert.equal(s.pendingPrayer.targetId, "demon");
  assert.ok(s.events.some((e) => e.type === "fall" && e.racerId === "demon"));
  assert.ok(s.events.some((e) => e.type === "prayerOffer"));
});

test("resurrection spends grace, raises the demon, emits intervene + rise", () => {
  let s = throughTheRug();
  const before = s.grace;
  assert.ok(canPray(s, "resurrection", "demon"));
  s = pray(s, "resurrection", "demon");
  assert.equal(s.grace, before - 1);
  assert.equal(s.racers.demon.downTurns, 0);
  assert.equal(s.racers.demon.state, "rising");
  assert.equal(s.racers.demon.step, 2); // 0 + restore(2)
  assert.equal(s.pendingPrayer, null);
  assert.ok(s.events.some((e) => e.type === "intervene"));
  assert.ok(s.events.some((e) => e.type === "rise"));
});

test("cannot pray with no pending prayer or insufficient grace", () => {
  const fresh = createRace();
  assert.equal(canPray(fresh, "resurrection", "demon"), false); // nothing pending yet

  let broke = createRace();
  broke = { ...broke, grace: 0 };
  for (let i = 0; i < 4; i++) broke = resolveTurn(broke); // rug fires, but grace 0
  assert.ok(broke.pendingPrayer);
  assert.equal(canPray(broke, "resurrection", "demon"), false);
  const after = pray(broke, "resurrection", "demon"); // no-op
  assert.equal(after.racers.demon.step, broke.racers.demon.step);
});

test("not praying wastes the demon's next pump (recover, no move)", () => {
  let s = throughTheRug(); // demon down, not prayed
  s = resolveTurn(s); // deck[4]: pump demon → should be wasted on recovery
  assert.ok(s.events.some((e) => e.type === "recover" && e.racerId === "demon"));
  assert.equal(s.racers.demon.step, 0); // still stuck at the bottom
});

test("first racer to the moon ends the race with a winner", () => {
  let s = createRace();
  let guard = 0;
  while (s.status !== "won" && guard++ < 200) s = resolveTurn(s);
  assert.equal(s.status, "won");
  const w = getWinner(s);
  assert.ok(w);
  assert.ok(s.racers[w].step >= TRACK_LENGTH);
  assert.equal(s.racers[w].state, "celebrating");
  assert.ok(s.events.some((e) => e.type === "win"));
});

test("state is not mutated in place (returns fresh objects)", () => {
  const s0 = createRace();
  const s1 = resolveTurn(s0);
  assert.equal(s0.racers.monk.step, 0); // original untouched
  assert.equal(s1.racers.monk.step, 1);
  assert.notEqual(s0.racers, s1.racers);
});

// ── Chart feed: history + active marker ──────────────────────────────────────

test("each racer starts with a single 'start' candle and no active chart", () => {
  const s = createRace();
  assert.equal(s.activeId, null);
  assert.equal(s.racers.monk.history.length, 1);
  assert.equal(s.racers.monk.history[0].kind, "start");
});

test("a turn appends one candle to the ACTIVE racer only, and marks it active", () => {
  let s = createRace();
  s = resolveTurn(s); // deck[0]: pump monk
  assert.equal(s.activeId, "monk");
  assert.equal(s.racers.monk.history.length, 2);
  assert.equal(s.racers.monk.history.at(-1).kind, "up");
  assert.equal(s.racers.demon.history.length, 1); // untouched this turn
});

test("rug prints a 'down' candle; resurrection prints a 'miracle' candle", () => {
  let s = createRace();
  for (let i = 0; i < 4; i++) s = resolveTurn(s); // through the rug
  assert.equal(s.racers.demon.history.at(-1).kind, "down");
  s = pray(s, "resurrection", "demon");
  assert.equal(s.activeId, "demon");
  assert.equal(s.racers.demon.history.at(-1).kind, "miracle");
});

test("history is not mutated in place across turns", () => {
  const s0 = createRace();
  const len0 = s0.racers.monk.history.length;
  resolveTurn(s0); // discard result
  assert.equal(s0.racers.monk.history.length, len0); // original array untouched
});
