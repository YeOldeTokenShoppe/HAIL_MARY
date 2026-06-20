// The Ascension — slice config. Tunable constants for the vertical slice.
// See ./SLICE.md for the full design.

export const TRACK_LENGTH = 8; // candle steps to THE MOON

export const GRACE_START = 3; // seeded directly for the slice; later: tithed from RL80

// Turn cadence + how long the player has to answer a fall with a prayer.
// Consumed by the presentation layer (AscensionRace), not the engine.
export const TURN_MS = 2200;
export const PRAYER_WINDOW_MS = 4000;

// The four racers are archetype SLOTS so swappable characters (Unicorn,
// Detective) are just re-skins. The slice ships only the first two.
// `advance` is the character's pump step — the Monk/Demon contrast (disciplined
// +1 vs greedy +2) is the morality-play thesis made mechanical.
export const RACER_SLOTS = [
  {
    id: "monk",
    slot: "discipline",
    name: "Android Monk",
    model: "/models/monk.glb",
    lane: 0,
    advance: 1,
    color: "#8ee9ff", // cyan — identity color for its chart line
  },
  {
    id: "demon",
    slot: "greed",
    name: "Demon of Wall Street",
    model: "/models/demon.glb",
    lane: 1,
    advance: 2,
    color: "#ff7ac4", // magenta
  },
];

// ── Track layout ────────────────────────────────────────────────────────────
// The track is FLAT: racers run forward (+X) in fixed lanes (Z). Volatility
// lives in the projected price charts behind the track, not the ground. One
// helper owns the step→world mapping so the track and the runners agree.
export const LANE_COUNT = RACER_SLOTS.length; // slice: 2
export const STEP_RUN = 1.15; // world X gained per forward step
export const LANE_GAP = 0.95; // world Z between adjacent lanes
export const STEP_RISE = 0.55; // (chart-only) vertical scale for the price panel

// World position of `step` in `lane` on the flat track (racers stand here).
export function stepWorld(step, lane = 0, laneCount = LANE_COUNT) {
  const x = step * STEP_RUN;
  const z = (lane - (laneCount - 1) / 2) * LANE_GAP;
  return [x, 0, z];
}

// ── Racer visuals ────────────────────────────────────────────────────────────
// Presentation config for the 3D racers (kept OUT of the engine, which stays
// pure). Per-racer model + clip-map: race `state` → animation clip name. The
// themed cast drops in by editing this map once their rigs have locomotion.
// NOTE: scale / facing / yOffset are first-guess values — tune against a
// screenshot (GLB authoring scale & forward axis vary per model).
export const DRACO_PATH = "/draco/"; // local Draco decoder (matches main scene)

export const RACER_VISUALS = {
  monk: {
    model: "/models/Monk_WinningStreak.glb",
    scale: 1, // tune against a screenshot
    facing: Math.PI / 2, // tune to face +X (down the track)
    yOffset: 0,
    clips: {
      idle: "Praying", // the monk's idle is prayer
      running: "Walking", // StartWalking is a lead-in we can layer later
      falling: "Tripping",
      down: "Tripping",
      rising: "GetUp",
      celebrating: "Cheer",
    },
  },
  demon: {
    model: "/models/John_Barron.glb",
    scale: 1,
    facing: Math.PI / 2,
    yOffset: 0,
    clips: {
      idle: "Idle",
      running: "Walking",
      falling: "Tripping",
      down: "Defeated",
      rising: "StandingUp",
      celebrating: "Rallying",
    },
  },
};
