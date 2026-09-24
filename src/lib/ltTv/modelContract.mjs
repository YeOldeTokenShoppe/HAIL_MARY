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
    headBone: "mixamorig:Head",
    base: "connor_sit_pose2",
    reactions: {
      headnod: { clip: "connor_headnod_pose2", duration: 4.33 },
      headnodSubtle: { clip: "connor_headnod_subtle_pose2", duration: 4.33 },
      headshakeDisappointment: { clip: "connor_headshake_disappointment_pose2", duration: 4.33 },
      lookAround: { clip: "connor_look_around_pose2", duration: 7.6 },
      shrug: { clip: "connor_shrug_pose2", duration: 4.33 },
      mockCrying: { clip: "connor_mockcrying_pose2", duration: 4.83 },
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
      // MOVED WITH HIS CHAIR 2026-09-23. Michelle's set re-export slid the
      // left desk chair about 14cm forward and turned it ~18° toward the
      // camera; this is his old seat carried through exactly that motion, so he
      // is still in it. Kip took the news seat that day and Connor keeps this
      // one only for news episodes already recorded with him (Warsh Means It).
      news: {
        position: [-0.40006, 0.42248, 0.15376],
        quaternion: [0, 0.10119, 0, 0.99487],
        scale: 1.125,
      },
    },
  },
  Monk: {
    file: "public/models/LTTV_GR80.glb",
    empty: "Monk_Empty",
    rig: "Armature001",
    headBone: "mixamorig:Head",
    base: "monk_sit_pose2",
    reactions: {
      headnod: { clip: "monk_headnod_pose2", duration: 4.33 },
      headnodSubtle: { clip: "monk_headnod_subtle_pose2", duration: 4.33 },
      headshake: { clip: "monk_headshake_pose2", duration: 4.33 },
      headshakeDisappointment: { clip: "monk_headshake_disappointment_pose2", duration: 4.33 },
      lookAround: { clip: "monk_look_around_pose2", duration: 7.6 },
      shrug: { clip: "monk_shrug_pose2", duration: 4.33 },
      prayCrosschest: { clip: "monk_pray_crosschest_pose2", duration: 3.87 },
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
      // Carried with the right desk chair's 2026-09-23 move, as Connor's is.
      news: {
        position: [0.47845, 0.39882, 0.11092],
        quaternion: [0, -0.00636, 0, 0.99998],
        scale: 1.081,
      },
    },
  },
  /*
   * THE NEWS CO-ANCHOR, added 2026-09-22. Every name and number below was read
   * off her export with `npm run lt:models -- public/models/LTTV_HoloGirl.glb`
   * rather than assumed, and three of them would have been wrong if assumed.
   *
   * SHE IS HOLLY JONES, Michelle's name for her (2026-09-22), and `Holly` is
   * the actor key: what a record's cast says, what a screenplay's speaker cue
   * says, and what the writers are told to write. `HoloGirl` was the
   * placeholder for the hour between her model landing and her being named,
   * and it was renamed the moment there was a real name — no record casts her
   * yet, so it cost nothing then and would not have stayed cheap. This repo
   * has twice paid for an identifier that outlived the name it came from
   * (`barron_*`, `john`), and there is already a different HoloGirl in it: the
   * commercial strip's vendor, `Vendor_HoloGirl.glb`.
   *
   * What does NOT change is anything inside the model: `Hologirl_Empty`,
   * `hologirl_*` and the filename are strings in her GLB, and renaming them in
   * code just breaks the lookup. Same arrangement as Connor, whose empty is
   * still `Demon_Empty`.
   */
  Holly: {
    file: "public/models/LTTV_HoloGirl.glb",
    // Lowercase "g", while the FILE has a capital one. Both exactly as exported.
    empty: "Hologirl_Empty",
    // Not "Armature" — her rig is a different one throughout.
    rig: "Root",
    // AND A DIFFERENT SKELETON. Connor and GR80 are Mixamo rigs
    // (`mixamorig:Head`); she is an Unreal-style one — `Pelvis`, `spine_01`,
    // `head`. The gaze and the camera framing both need the head bone, and the
    // pattern that finds theirs finds nothing here, which is why the head bone
    // is named per character rather than matched.
    headBone: "head",
    // ⚠ AS EXPORTED 2026-09-22 THIS CLIP CANNOT SEAT HER. It carries three
    // channels — `Hologirl_Empty`'s own translation, rotation and scale — and
    // no bone animation at all, where her three other clips animate 168
    // channels each. Her rest pose is not a seated pose (36 of her 56 bones sit
    // elsewhere in the gesture clips), so this plays as her A-pose. Michelle
    // was told to re-export the action off the ARMATURE; `npm run lt:models`
    // fails until she does, rather than letting it reach an episode.
    base: "hologirl_sitting",
    // She has two gestures where the others have six or seven, so she is
    // offered two cues and the writers' prompt lists what each actor can
    // actually do. A cue naming a clip she has not got no-ops with a warning.
    reactions: {
      headnod: { clip: "hologirl_agreement", duration: 3.0 },
      headshake: { clip: "hologirl_disagreement", duration: 3.0 },
    },
    // HER COFFEE BREAK IS THE INTERMISSION, Michelle 2026-09-23, replacing
    // `hologirl_news_intermission`, which her re-export no longer carries. Of
    // her three coffee clips this is the one that suits sitting it out beside
    // Kip; `hologirl_coffee_long` and `hologirl_coffee_short` are the others.
    outro: "hologirl_coffee_long_conversation",
    // As exported it ends 10.79° from its first frame at the right shoulder,
    // so it snapped once a loop; eased home over its last 45 frames on load,
    // as Kip's intermission is (2026-09-24). See clipShaping.mjs.
    shapes: {
      hologirl_coffee_long_conversation: { fps: 30, closeLoopFrames: 45 },
    },
    /* THE CUP RIDES HER HAND. The set carries `Hologirl_Sip_Cup` on the desk
     * (under `Sip_Cup_Socket`) and her rig carries `Coffee_Cup_Control`, a
     * bone that holds still on the desk in every clip but the coffee ones,
     * where it goes up to her mouth and back. The scene moves the cup's origin
     * ONTO the bone once her idle has posed it, keeping the cup's own tilt, and
     * re-parents it there, so from then on it follows her sip.
     *
     * ON the bone, not near it. The socket is NOT where the cup belongs: as
     * exported 2026-09-23 it sits 7cm from the bone and 3.1cm above the
     * countertop. Riding with that offset left her fingers 9.1cm from the
     * cup's axis mid-sip, 4.6cm clear of a cup 4.5cm in radius, which is the
     * gap Michelle saw during the intermission. With the origin on the bone her
     * grip lands 4.4cm from the axis, on the cup's surface, all through both
     * coffee clips, and at idle the cup's base is at 0.972 against a
     * countertop at 0.974. That is the relationship Blender has, and the
     * socket never enters into it. */
    props: [{ node: "Hologirl_Sip_Cup", bone: "Coffee_Cup_Control" }],
    /* SHE HAS THREE FACE LAYERS AND TWO EYE PLANES, and the same character is
     * already configured elsewhere in this repo — she is the promotions
     * hologram at the prize wheel in `src/lib/vendorSitePal.js`, on the same
     * ElevenLabs voice. That config is fitted and working, and it says:
     *
     *     projFace: "Face2", regularFaces: ["Face1", "Face3", "Eye_L", "Eye_R"]
     *
     * Michelle first said Face3 for the talk show, then confirmed Face2 on
     * 2026-09-22 once the vendor config was pointed out. SETTLED, not a guess.
     *
     * Worth keeping for the next character: whichever layer the projection
     * lands on, the other two have to be HIDDEN or she wears two faces at
     * once. "Face1 is the one on screen before the projection arrives" is
     * true and is not the whole list.
     */
    // Her 2026-09-23 re-export folded the two eye planes into Face3 (it now
    // carries the eye materials), so Face3 is the only thing left to hide.
    faces: { face1: "Face1", face2: "Face2", hide: ["Face3"] },
    /*
     * NEWS ONLY, which is the cast split: GR80 does Markets & Morality and she
     * does the news. A character with no seat on a set is not on that set —
     * see the visibility effect in TalkShowScene.jsx — so this is also what
     * keeps her out of the lounge, where there is no third chair for her.
     *
     * Taken from her own export, not copied from GR80's news seat: she is a
     * different body, sits at 0.846 rather than 1.081, and is turned about 41°
     * toward the middle where he is turned 3°. Those are hers.
     */
    seat: {
      // FROM HER 2026-09-23 EXPORT, which was made on the re-exported set with
      // the chairs in their new places — her seated pelvis lands over the
      // moved right chair. That re-export also changed her rig's own
      // transforms (smaller empty, the armature re-rooted), so the old seat
      // numbers would not have carried across even for the old chair.
      news: {
        position: [0.76251, 0.66461, 0.19016],
        quaternion: [0, -0.29694, 0, 0.9549],
        scale: 0.73529,
      },
    },
  },
  /*
   * KIP O'BRIEN, THE NEWS ANCHOR, added 2026-09-23. He takes Connor's seat on
   * the news and ONLY the news: Connor stays on Markets & Morality (Michelle,
   * 2026-09-23). Every name below was read off his export with
   * `npm run lt:models -- public/models/LTTV_NewsAnchor.glb`.
   *
   * Same Unreal-style skeleton as Holly (`Root`, `Pelvis`, `head`), so they
   * share 48 bone names — fine, every lookup is scoped to the empty.
   *
   * HIS FACES ARE HOLLY'S ARRANGEMENT, from his second export the same day
   * (his first was one skinned mesh with no face layer at all): Face1 is the
   * static face until SitePal arrives, Face2 is what it paints onto (its own
   * material, lambert14.001), and Face3 is hidden with the swap so nothing
   * floats over the projection.
   */
  Kip: {
    file: "public/models/LTTV_NewsAnchor.glb",
    empty: "NewsGuy_Empty",
    rig: "Root",
    headBone: "head",
    base: "newsAnchor_idle_sit",
    reactions: {
      headnod: { clip: "anchorGuy_agreement", duration: 3.0 },
      headshake: { clip: "anchorGuy_disagreement", duration: 3.0 },
    },
    // The news set's resting state between episodes. Michelle's own
    // `anchorGuy_intermission2` (2026-09-24, 31.77s) replaces the 46.70s
    // `anchorGuy_intermission`, which is still in the file and unused. It is
    // RESHAPED on load — see `shapes` below.
    outro: "anchorGuy_intermission2",
    /* THE INTERMISSION TURNS HIM TO HOLLY, Michelle 2026-09-24: "rotate
     * towards Holly, but then rotate torso back to laptop during the laptop
     * typing section around keyframes ~850 to ~961. I also need the animation
     * to loop back to position of frame 1." Done here rather than in Blender
     * (src/lib/ltTv/clipShaping.mjs), so a re-export of the same action keeps it.
     *
     * `keys` are BLENDER FRAMES (30fps, frame 1 is the first) against how much
     * of the turn is on: 0 is the clip as animated, 1 the full turn. He turns
     * to her over the first 40 frames and is back on the laptop by 850, where
     * his hands come up to type (measured off the export: they reach the
     * keyboard by frame 860 and stay there to the clip's last frame, 953).
     * `degrees` is the turn each bone adds about world up, positive toward
     * Holly (she sits at +X of him): 30° of torso over the three spine bones,
     * and 45° more of neck and head, about 75° of the ~86° she is off his
     * front. A first fit, not watched on the set — change the numbers.
     *
     * `closeLoopFrames` eases the last 30 frames of every channel onto frame
     * 1. As exported the clip ends with his hands on the keyboard and frame 1
     * has them resting, 79° apart at the right forearm, so the last second is
     * him taking his hands off the keys. */
    shapes: {
      anchorGuy_intermission2: {
        fps: 30,
        closeLoopFrames: 30,
        turn: {
          degrees: { spine_01: 8, spine_02: 10, spine_03: 12, neck_01: 18, head: 27 },
          keys: [[1, 0], [40, 1], [815, 1], [850, 0]],
        },
      },
    },
    faces: { face1: "Face1", face2: "Face2", hide: ["Face3"] },
    seat: {
      // From his own export, made on the 2026-09-23 set with the left chair
      // in its new place; his seated pelvis lands over it.
      news: {
        position: [-0.42587, 1.31709, 0.10489],
        quaternion: [0, 0.01121, 0, 0.99994],
        scale: 0.84526,
      },
    },
  },
};

/**
 * Does a node name in a loaded or exported file stand for the name authored
 * here? Exactly, or with the numeric suffix Blender adds when two objects in
 * ONE .blend share a name — "Face1.001" as exported, "Face1001" once
 * GLTFLoader has stripped the dot. Kip's faces came out that way on
 * 2026-09-24 because Holly's Face1–3 are in the same Blender file now, and
 * renaming them back there would only move the clash onto hers. Every lookup
 * that uses this is scoped to one character's empty, so the suffix cannot
 * reach another character's mesh.
 */
export function matchesAuthoredName(authored, name) {
  if (!authored || !name) return false;
  if (name === authored) return true;
  return name.startsWith(authored) && /^\.?\d{3,}$/.test(name.slice(authored.length));
}

/** The reshaping declared for one of a character's clips, or null. */
export function clipShape(character, clipName) {
  return character?.shapes?.[clipName] || null;
}

/** The clip name for one reaction key, or undefined. */
export function reactionClip(character, key) {
  return character.reactions?.[key]?.clip;
}

/** key → clip name, for the action bank. */
export function reactionClips(character) {
  return Object.fromEntries(
    Object.entries(character.reactions || {}).map(([key, r]) => [key, r.clip]),
  );
}

/**
 * key → authored length in seconds.
 *
 * THE ONE COPY OF THIS. It used to live three times — `REACTION_DURATIONS` in
 * TalkShowScene.jsx, `REACTIONS` in scripts/lt-tv-format.mjs (what the writers
 * are offered) and a third list in scripts/lt-tv-check.mjs — each with a
 * comment asking the next person to keep it in step by hand. Three copies of a
 * fact is how Connor ended up in a T-pose, and a third character was about to
 * be added to all three.
 */
export function reactionDurations(character) {
  return Object.fromEntries(
    Object.entries(character.reactions || {}).map(([key, r]) => [key, r.duration]),
  );
}

/** Every clip name a character's file has to carry, base first. */
export function requiredClips(character) {
  return [character.base, ...Object.values(reactionClips(character))];
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
 * `public/`. Versioned so a re-export is never served from a stale cache —
 * both drei's, which keys on the URL string, and the browser's.
 *
 * BUMP THIS WHENEVER A MODEL IS RE-EXPORTED. It is hand-maintained and it has
 * already been missed: `LTTV_HoloGirl.glb` was re-exported three times on
 * 2026-09-22 and three of them shipped under `split-1`, so anyone who had
 * loaded the set that day could keep being served the first one. That failure is
 * invisible — the character just goes on doing what the old file said, which
 * reads as the fix not working.
 */
export const MODEL_VERSION = "split-5";
export function modelUrl(file) {
  return `${String(file).replace(/^public/, "")}?v=${MODEL_VERSION}`;
}
