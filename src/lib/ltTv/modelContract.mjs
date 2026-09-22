// WHAT THE CODE NEEDS OUT OF BLENDER, named once.
//
// The set and the characters ship as separate exports, and the code finds
// everything inside them BY NAME: a character's empty, the armature under it,
// the two face meshes the SitePal projection swaps, and every animation clip by
// its authored name. None of that is checked by anything at load time — a
// renamed node or a clip left behind in the wrong file produces a character who
// loads, stands in its bind pose and never moves, with no error anywhere. That
// is the failure this file exists to make checkable.
//
// `scripts/lt-tv-models.mjs` (npm run lt:models) checks a real export against
// what is written here and says what is missing. THREE-free and React-free on
// purpose, so a plain node script can read it.
//
// Clip names are the authored Blender action names and cannot be changed
// without a re-export, so the `barron_*` prefix stays on Connor's original
// family even though the character is called Connor now. Anything added later
// uses the current name, which is why his intermission is `connor_*`.

/**
 * The set: furniture, desk, camera, lights. No characters, no animations.
 *
 * TWO CANDIDATES, because the split happens in one push and the checker has to
 * give a straight answer on either side of it. `LTTV_Set.glb` is the 2026-09-22
 * re-export: the whole set, characters taken out. `talk_show3-textures.glb` is
 * the single file that carried the set AND both characters before the split,
 * and is what the scene still loads until the per-character loading is wired.
 *
 * Whichever candidate actually looks like a set (by carrying `requires`) is the
 * one checked, so running this before the new export lands reports on the old
 * file rather than raising a false alarm about a set that has not arrived yet.
 *
 * `newsDesk.glb` is deliberately NOT a candidate. It is the old desk-props-only
 * export, it is still in the repo, and the set was briefly given that name
 * before being renamed to LTTV_Set.glb — so listing it would imply the props
 * file might be the set. It would fail the content check anyway.
 */
const SET_FILE = "public/models/LTTV_Set.glb";
const PRE_SPLIT_SET_FILE = "public/models/talk_show3-textures.glb";

export const SET_MODEL = {
  // What the scene loads. One name, so the browser and the checker can never
  // disagree about which file is the set.
  file: SET_FILE,
  // What the CHECKER will accept, newest first. The pre-split file is still in
  // the repo and still a valid set (it just has the characters inside it too),
  // so a check run against an older commit reports on that rather than
  // claiming the set is missing.
  candidates: [SET_FILE, PRE_SPLIT_SET_FILE],
  // Props the code reaches for by name. A missing one is a visible hole in the
  // set rather than a silent failure, but it is cheaper to catch here.
  requires: [
    "Studio_Set",
    "NewsDesk",
    "DeskChair",
    "Camera",
    "Camera_Screen",
    "Tripod",
    "Content_Screen",
  ],
  // Once the characters ship as their own files they must not ALSO be in the
  // set: they would be drawn twice and their clips would load twice.
  forbids: ["Demon_Empty", "Monk_Empty"],
  // Every clip belongs to a character, so the set should carry none. A set
  // still holding `barron_*`/`monk_*` means the actions did not travel with the
  // character they belong to — and the character file is then inert.
  expectsNoAnimations: true,
};

/**
 * One entry per character, keyed by the actor name the pipeline uses.
 *
 * `rig` is the armature name PREFERRED, not required: it is the one name that
 * depends on how the file was exported rather than what is in it (GR80's is
 * "Armature.001" only because Connor's "Armature" collides with it in a shared
 * Blender file). `findRig` in TalkShowScene.jsx falls back to whatever armature
 * sits under the empty, so either name works.
 *
 * `seat` records where the character was authored on each set, for the checker
 * to compare an export against. It is a reference point, not a rule — a seat
 * that has legitimately moved should be updated here, and a character exported
 * at the origin is almost always a transform that got applied by accident.
 */
export const CHARACTERS = {
  Connor: {
    file: "public/models/LTTV_Connor.glb",
    empty: "Demon_Empty",
    rig: "Armature",
    // RENAMED IN THE 2026-09-22 EXPORT, from barron_* to connor_*. The old
    // names were the last identifiers still carrying the character's previous
    // name, and the note on them said only a Blender re-export could change
    // them — this is that re-export. Durations are unchanged, so they are the
    // same actions under the current name.
    base: "connor_sit_pose2",
    reactions: {
      headnod: "connor_headnod_pose2",
      headnodSubtle: "connor_headnod_subtle_pose2",
      headshakeDisappointment: "connor_headshake_disappointment_pose2",
      lookAround: "connor_look_around_pose2",
      shrug: "connor_shrug_pose2",
      mockCrying: "connor_mockcrying_pose2",
    },
    // The news set's RESTING STATE once the show has finished, in place of the
    // seated idle: Connor turns away from the camera and sits out the
    // intermission. 46.70s and it loops, Michelle's call 2026-09-22 — and it
    // loops cleanly, measured off this file: every one of the 126 channels
    // ends where it started (rotation drift 0.00000, translation 0.00001), so
    // there is no snap at the join. Optional: a file without it still plays
    // every episode and simply holds the idle instead.
    outro: "connor_news_intermission_head_turn",
    faces: { face1: "FaceDemon1", face2: "FaceDemon2", hide: ["Demon_Brows"] },
    // HE WAS EXPORTED AT THE NEWS DESK, so his own file no longer carries the
    // lounge seat — it is 55cm from where he belongs on the roundtable set.
    // Both seats are therefore pinned from here rather than taken from the
    // model: once a character ships as its own file, exported from whichever
    // set happened to be open, the authored transform stops being a reliable
    // statement about where they sit.
    seat: {
      lounge: {
        position: [-0.80307, 0.2098, -0.30198],
        quaternion: [0, 0.25504, 0, 0.96693],
        scale: 1.12482,
      },
      news: {
        position: [-0.44472, 0.42248, 0.018999],
        quaternion: [0, 0.255, 0, 0.967],
        scale: 1.125,
      },
    },
  },
  Monk: {
    file: "public/models/LTTV_GR80.glb",
    empty: "Monk_Empty",
    rig: "Armature001",
    base: "monk_sit_pose2",
    reactions: {
      headnod: "monk_headnod_pose2",
      headnodSubtle: "monk_headnod_subtle_pose2",
      headshake: "monk_headshake_pose2",
      headshakeDisappointment: "monk_headshake_disappointment_pose2",
      lookAround: "monk_look_around_pose2",
      shrug: "monk_shrug_pose2",
      prayCrosschest: "monk_pray_crosschest_pose2",
    },
    faces: { face1: "Face1", face2: "Face2", hide: ["Brows"] },
    // His export DOES sit at the lounge seat, to five decimal places. Pinned
    // anyway, for the same reason as Connor's: the code should not depend on
    // which set was open in Blender.
    seat: {
      lounge: {
        position: [0.95011, 0.24002, -0.36088],
        quaternion: [0, -0.02971, 0, 0.99956],
        scale: 1.08099,
      },
      news: {
        position: [0.53267, 0.39882, -0.049794],
        quaternion: [0, -0.03, 0, 1],
        scale: 1.081,
      },
    },
  },
};

/** Every clip name a character's file has to carry, base first. */
export function requiredClips(character) {
  return [character.base, ...Object.values(character.reactions || {})];
}

/** Clips that may be there and are used when they are. */
export function optionalClips(character) {
  return character.outro ? [character.outro] : [];
}

/**
 * The URL the browser fetches a model from.
 *
 * `file` is the repo path, which is what a node script checking the export
 * needs; the scene needs the served path, which is the same thing without
 * `public/`. Versioned so a re-export is never served from drei's cache.
 */
export const MODEL_VERSION = "split-1";
export function modelUrl(file) {
  return `${String(file).replace(/^public/, "")}?v=${MODEL_VERSION}`;
}
