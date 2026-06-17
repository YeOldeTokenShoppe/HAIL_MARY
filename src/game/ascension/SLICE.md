# The Ascension — Vertical Slice Spec

> Working title: **The Ascension** (a.k.a. *Gospel of the Green Candle* / *Holy Rollers*).
> A solo, **play-money** push-your-faith race. Four trading philosophies climb a price
> chart toward THE MOON; **Our Lady of Perpetual Profit** is the divine guide who
> intervenes. This doc specs ONLY the first prototype — the 20-second loop that proves
> the two things everything else depends on: **(1) the run/fall animation feels good to
> watch, and (2) the divine-intervention hook lands.**

A separate game mode from the existing Pokémon-style card game in `src/game/terminal-traders/`.
Shared universe, separate code.

---

## 1. Goal of the slice

Prove this loop is satisfying:

> Two racers stand on a candlestick staircase. Cards flip. On a **pump**, a racer runs
> up to the next candle. The **Demon eats a rug**, stumbles, and falls back. The player
> spends **Grace** on Our Lady's **Resurrection** prayer — she animates above the track,
> the Demon rises and is restored. First to the top plays a victory pose. Done.

If that 20 seconds is fun to watch, the game works. If it isn't, no economy or lore saves it.

## 2. In scope / out of scope

**In:**
- 2 racers — **Android Monk** (slot: `discipline`) and **Demon of Wall Street** (slot: `greed`).
- A short single-lane track: **8 candle steps** to the moon.
- A tiny deck: `pump`, `rug` only (no swerve yet).
- Minimal Grace: player starts with a fixed Grace pool; **one** prayer — `resurrection`.
- Animation states: `idle`, `running`, `falling`, `down`, `rising`, `celebrating`.
- A pure, testable engine separated from the R3F presentation layer.

**Out (deferred to later phases — list so nothing reads as "covered"):**
- Betting + Brier scoring (pre-race odds UI).
- Full 4-racer field, the Unicorn/Detective archetype slots, character swapping.
- Lanes + swerve/turn cards (narrative rotation).
- Hubris/Wrath meter + the full prayer menu (Blessing, Revelation, Smite, Stay of Execution).
- `Providence` (autonomous divine) cards.
- RL80 tithe → Grace conversion UI (slice just seeds Grace directly).
- Sound, mobile layout polish, persistence.

## 3. Architecture: pure engine + event-driven presentation

Mirror the existing `terminal-traders` split — a pure engine the UI consumes. The engine
never touches the DOM or three.js; it returns **state + an events array** that the R3F
layer turns into animations. This keeps the engine unit-testable and the "feel" tunable.

```
src/game/ascension/
  config.js     — TRACK_LENGTH, racer slots, GRACE_START, turn timing
  cards.js      — SLICE_DECK (pump/rug), PRAYERS (resurrection)
  engine.js     — createRace, resolveTurn, pray, getWinner  (PURE)
  SLICE.md      — this file

src/components/ascension/
  AscensionRace.jsx   — mode container: holds race state, turn loop, UI, mounts the canvas
  RaceTrack3D.jsx     — R3F scene: candle staircase + lighting, maps state→world
  Racer3D.jsx         — one GLB + useAnimations; crossfades clip on state change, tweens position
  OurLadyGuide.jsx    — divine-guide presence; plays an intervention FX when a prayer resolves
  GracePanel.jsx      — Grace count + the Resurrection prayer button (enabled only when prayable)
```

## 4. Data model

```js
// config.js
export const TRACK_LENGTH = 8;        // candle steps to the moon
export const GRACE_START  = 3;        // seed; later this comes from tithing RL80
export const TURN_MS      = 2200;     // auto-flip cadence
export const PRAYER_WINDOW_MS = 4000; // how long the player has to pray after a fall

export const RACER_SLOTS = [
  { id: 'monk',  slot: 'discipline', name: 'Android Monk',        model: '/models/monk.glb',  lane: 0 },
  { id: 'demon', slot: 'greed',      name: 'Demon of Wall Street', model: '/models/demon.glb', lane: 0 },
];
```

```js
// race state shape (returned by createRace / resolveTurn / pray)
{
  status: 'idle' | 'running' | 'won',
  turn: 0,
  grace: 3,
  racers: {
    monk:  { id, slot, name, model, step: 0, state: 'idle', downTurns: 0 },
    demon: { id, slot, name, model, step: 0, state: 'idle', downTurns: 0 },
  },
  pendingPrayer: null | { prayerId: 'resurrection', targetId: 'demon', expiresTurn },
  winner: null | 'monk' | 'demon',
  events: [ /* see below */ ],   // consumed by the presentation layer each tick
}
```

**Events** (the contract between engine and R3F):
```js
{ type: 'move',        racerId, from, to }     // run clip + position tween
{ type: 'fall',        racerId, from, to }     // stumble→fall clip, knocked back
{ type: 'rise',        racerId, to }           // get-up clip, restored
{ type: 'prayerOffer', prayerId, targetId }    // surface the prayer button
{ type: 'intervene',   prayerId, targetId }    // Our Lady FX fires
{ type: 'win',         racerId }               // victory pose
```

## 5. Engine behavior (slice rules)

```js
createRace(config) -> state            // racers at step 0, state 'idle', grace = GRACE_START

resolveTurn(state) -> state'           // draw one card, apply, emit events
  // SLICE deck distribution is SCRIPTED for a reliable demo, not random:
  //   turns 1..n: a pump for whoever is behind/targeted, then a guaranteed RUG on the Demon
  //   so the prototype always shows: run → run → Demon falls → (prayer window)
  // pump  -> target.step += magnitude (monk: +1 steady; demon: +2 greedy), state 'running'
  // rug   -> demon.step = max(0, step - 2), state 'falling', downTurns = 1,
  //          set pendingPrayer { resurrection, demon }, emit 'prayerOffer'
  // if any racer.step >= TRACK_LENGTH -> status 'won', winner set, emit 'win'

pray(state, prayerId, targetId) -> state'
  // guard: state.grace >= PRAYER_COST && pendingPrayer matches
  // resurrection: target.step restored (e.g. +2 back / to pre-fall step), state 'rising',
  //               grace -= cost, clear pendingPrayer, emit 'intervene' + 'rise'

getWinner(state) -> racerId | null
```

Character flavor already visible in the slice: **Monk advances +1 (disciplined, steady);
Demon advances +2 (greedy) but is the one who eats the rug.** That contrast is the whole
morality-play thesis in miniature.

## 6. Presentation layer (R3F)

- Reuse the existing GLB loading convention (drei `useGLTF`, DRACO/Meshopt already wired
  in the project). Mount the race in its **own `<Canvas>`** (or a copy of `CleanCanvas`) so
  it never entangles the hub scene in `CyborgTempleScene.jsx`.
- **`Racer3D`** uses drei `useAnimations`. It holds the current `state` string; on change it
  **crossfades** to the matching clip (`idle`/`run`/`fall`/`getup`/`cheer`) and tweens world
  position to `step` (candle height). One-shot clips (`fall`, `getup`, `cheer`) clamp on the
  last frame; loops (`idle`, `run`) repeat.
- **Mixamo clips needed** (one shared set, retargeted to each humanoid rig):
  `idle`, `run`, `stumble-to-fall`, `get-up`, `cheer`. Placeholder clips are fine for the slice.
- **Track:** N box-geometry candles in an ascending stair (green = up step). The rug spot can
  flip a candle red on the `fall` event. Racer Y = candle top at `step`.
- **`OurLadyGuide`:** a presence above the track (start with a simple lit billboard/figure +
  a particle/light burst). On `intervene`, fire the FX and a one-line caption
  ("Our Lady raises the fallen.").
- **Turn loop:** `AscensionRace` runs a `setInterval`/timeout at `TURN_MS`, calling
  `resolveTurn`, pushing events to the racers. On a `fall`, it **pauses the auto-loop**, opens
  the `PRAYER_WINDOW_MS`, and shows the Resurrection button; on press → `pray()`; on timeout →
  Demon stays down one turn (`downTurns`) then auto-resumes.

## 7. Acceptance criteria (definition of done for the slice)

1. Two characters stand idle on the candle staircase; a **Start** control begins the race.
2. On a pump, the targeted racer plays **run** and moves up to the next candle (clip + tween,
   not a teleport).
3. The scripted **rug** hits the Demon: **stumble→fall** clip, he drops back, a red candle flashes.
4. The **"Our Lady · Resurrection — cost N Grace"** button appears and is enabled only while
   Grace ≥ cost and the prayer window is open. Pressing it: spends Grace, **Our Lady's
   intervention FX fires**, the Demon plays **get-up** and is restored, race resumes.
5. First racer to the top plays **cheer**; a result line shows the winner.
6. Subjective gate: the ~20s loop is **fun to watch**. (This is the real test.)

## 8. Build order

1. `config.js` + `cards.js` + `engine.js` with the scripted slice deck — **unit-test the
   engine first** (turn sequence produces the expected events: pump, pump, fall, then
   resurrection on `pray`). No graphics yet.
2. `RaceTrack3D` + `Racer3D` with placeholder capsules and the position tween (no clips) —
   prove movement reads correctly off engine events.
3. Swap capsules for the real GLBs + Mixamo clips; wire the crossfade state machine.
4. `OurLadyGuide` FX + `GracePanel` prayer button + the pause/prayer-window loop.
5. Playtest the subjective gate; tune `TURN_MS`, magnitudes, and clip blend times.

---

**Note:** Everything here is play-money. `grace` is seeded directly; no RL80 settlement,
no real wagering. The tithe (RL80 → Grace) and Brier-scored betting are a later, separately
scoped phase.
