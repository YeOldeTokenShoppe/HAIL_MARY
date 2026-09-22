// THE CAMERA OPERATOR.
//
// LT TV had one camera pose: a fixed wide, parked where the set was composed,
// holding the same picture for seven minutes. This is the other half — the
// shot list in `episodeTimeline.mjs` says WHICH shot is live at a given
// second, and this file says where the lens goes for it.
//
// Pure arithmetic, no THREE and no React, so the framing can be unit-tested
// and reasoned about without a browser. The scene supplies the two head
// positions and which way the set faces; everything else is derived.
//
// TWO THINGS SHAPE EVERY NUMBER IN HERE.
//
//   • THE FACES ARE PICTURES, NOT GEOMETRY. Each character's face is a crop of
//     SitePal's own render — about 150 x 200 source pixels — painted onto a
//     flat mesh. So there are two hard limits a normal 3D set doesn't have:
//     push in far enough and the face is being upscaled past its source
//     (`faceScreenPixels` below is the honest readout for that), and swing far
//     enough off-axis and you are looking at a frontal photograph edge-on.
//     Both are why the angles here are modest and why the tuner shows the
//     pixel count while you drag.
//
//   • FRAMING IS SOLVED, NOT TYPED. A shot is authored as what it should
//     CONTAIN — "2.5 metres of desk across the frame", "the head fills 13% of
//     frame height" — and the distance falls out of the lens and the window's
//     aspect. Typing a camera position instead is what made the old shot
//     correct at exactly one window size.

// The height of a head as it reads on screen, crown to chin, in metres. Used
// to turn "the head should fill this much of the frame" into a distance.
// Measured off the rig rather than guessed: see docs/lt-tv.md.
export const HEAD_HEIGHT = 0.3;

// How much of that height the SitePal projection itself covers, and how many
// source pixels tall the crop is. Together they say when a push-in starts
// upscaling the face rather than revealing it.
export const FACE_SHARE_OF_HEAD = 0.66;
export const FACE_SOURCE_PIXELS = 195;

/**
 * The shots the director can call, and how each one is framed.
 *
 * Mutated in place by the tuning board (`/trade?tune=shots`) and read fresh
 * every frame, so a drag changes the picture with the show still running.
 *
 * Per shot:
 *   coverage   metres of set across the frame (wides — the subject is the
 *              midpoint between the two heads)
 *   headShare  fraction of frame HEIGHT the head fills (singles — the subject
 *              is that character's head)
 *   fov        vertical field of view. Lower is a longer lens: less
 *              perspective on a face, which is why the singles are tighter
 *              lenses and not just closer.
 *   azimuth    degrees around the subject, off the set's front. On the wides
 *              this is absolute, positive toward screen right. On the singles
 *              it is ALWAYS toward the other chair, so one number gives a
 *              matched pair of cross-shots.
 *   height     metres the lens sits above the subject.
 *   lookLift   metres the aim sits above the subject. Negative puts the head
 *              higher in frame, which is where TV puts eyes.
 */
export const SHOT_FRAMING = {
  enabled: true,
  // Hard cuts between shots, the way a gallery cuts between cameras. False
  // eases instead, which reads as one operator swinging a tripod.
  cut: true,
  // Per-second easing rate when `cut` is off, and when handing the camera back.
  easeLambda: 2.6,
  // A shot that never moves reads as a freeze-frame. Each one creeps in by
  // this fraction of its distance per second, capped, and resets on the cut.
  drift: 0.012,
  driftMax: 0.08,
  // Seconds after the viewer lets go of the camera before the director takes
  // it back. Dragging the set around mid-episode should not be a fight.
  handBackAfter: 5,
  // Never dolly closer than this, whatever the arithmetic says — inside it the
  // near plane starts clipping the desk.
  minDistance: 0.85,
  maxDistance: 6,
  // 'auto' follows the shot list. Any shot name holds that shot, so each one
  // can be fitted without sitting through an episode. Written by the board.
  hold: "auto",
  // Read-only, written every frame: which shot is live, for the board's readout.
  current: null,
  shots: {
    establish: { coverage: 5.2, fov: 42, azimuth: -13, height: 0.85, lookLift: -0.55 },
    two: { coverage: 3.2, fov: 34, azimuth: 5, height: 0.3, lookLift: -0.22 },
    // Straight down the lens — a line read to the viewer. `directToCamera`
    // squares the shot up: the azimuth (which the singles use to angle across
    // the desk) is dropped so the host faces the audience, the way an anchor
    // does. Kept a touch wider than the angled single so it doesn't read as an
    // accidental jump.
    direct: { headShare: 0.2, fov: 30, azimuth: 0, height: 0.06, lookLift: -0.03, directToCamera: true },
    single: { headShare: 0.21, fov: 30, azimuth: 15, height: 0.1, lookLift: -0.05 },
    close: { headShare: 0.28, fov: 26, azimuth: 11, height: 0.07, lookLift: -0.02 },
  },
};

export const SHOT_NAMES = ["establish", "two", "direct", "single", "close"];

/** Does this shot frame one character, or the pair? */
export function isSingleShot(framing) {
  return framing === "single" || framing === "close" || framing === "direct";
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Where the lens goes for one shot.
 *
 * @param framing  a key of SHOT_FRAMING.shots
 * @param subject  which character the shot is on (ignored by the wides)
 * @param heads    { Connor: {x,y,z}, Monk: {x,y,z} } in world space
 * @param front    unit horizontal vector from the set toward the audience
 * @param aspect   viewport width / height
 * @param config   defaults to SHOT_FRAMING; passed in so it can be tested
 * @returns { eye, aim, fov, distance, headShare } or null if it can't be solved
 */
export function solveShot({ framing, subject, heads, front, aspect, config = SHOT_FRAMING }) {
  const shot = config.shots[framing];
  if (!shot) return null;
  const cast = Object.keys(heads || {});
  if (cast.length === 0) return null;

  // The set's own axes. `right` is screen right for a camera sitting on
  // `front`, and everything angular is expressed in this pair rather than in
  // world X/Z, so the framing survives the set being rotated or moved.
  const f = normalize(front);
  const right = normalize({ x: -f.z, y: 0, z: f.x });

  const mid = centre(heads);
  const single = isSingleShot(framing);
  const head = single ? heads[subject] : null;
  // A single with nobody to be on falls back to the pair, rather than
  // returning null and leaving the camera wherever it happened to be.
  const point = head || mid;

  const tanV = Math.tan(rad(shot.fov) / 2);
  const safeAspect = Number.isFinite(aspect) && aspect > 0.2 ? aspect : 1.6;
  let distance;
  if (single) {
    const share = clamp(shot.headShare ?? 0.13, 0.01, 0.9);
    distance = HEAD_HEIGHT / (2 * tanV * share);
  } else {
    const tanH = safeAspect * tanV;
    distance = (shot.coverage ?? 2.6) / (2 * tanH);
  }
  distance = clamp(distance, config.minDistance, config.maxDistance);

  // Singles always swing toward the OTHER chair, so the character is seen
  // across the desk they're talking to and has looking room on the right side
  // of frame. `side` is -1 when the subject sits screen right.
  let azimuth = shot.azimuth ?? 0;
  if (single && head) {
    const offset = dot(sub(head, mid), right);
    // Dead centre (a one-hander, or heads that haven't posed yet) keeps the
    // authored sign rather than picking a side at random.
    if (offset > 1e-4) azimuth = -azimuth;
  }

  const dir = add(scale(f, Math.cos(rad(azimuth))), scale(right, Math.sin(rad(azimuth))));
  const eye = add(add(point, scale(dir, distance)), { x: 0, y: shot.height ?? 0, z: 0 });
  const aim = add(point, { x: 0, y: shot.lookLift ?? 0, z: 0 });

  return {
    eye,
    aim,
    fov: shot.fov,
    distance,
    // What fraction of frame height the head ends up at, whichever way the
    // distance was arrived at. This is what the face-resolution readout reads.
    headShare: HEAD_HEIGHT / (2 * distance * tanV),
  };
}

/**
 * How many screen pixels tall the projected face ends up, and whether that is
 * past what SitePal gives us to work with.
 *
 * This is the whole answer to "how close can the camera push". Past 1.0 the
 * face is being enlarged beyond its source and softens; the picture doesn't
 * break, it just stops getting sharper while everything around it does.
 */
export function faceScreenPixels(headShare, viewportHeightPx) {
  const pixels = headShare * FACE_SHARE_OF_HEAD * (viewportHeightPx || 0);
  return { pixels, ratio: pixels / FACE_SOURCE_PIXELS };
}

// ── small vector helpers, so this file needs no THREE ──────────────────────
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function normalize(v) {
  const source = v || { x: 0, y: 0, z: 1 };
  const length = Math.hypot(source.x || 0, 0, source.z || 0);
  if (!(length > 1e-6)) return { x: 0, y: 0, z: 1 };
  return { x: source.x / length, y: 0, z: source.z / length };
}

function centre(heads) {
  const values = Object.values(heads);
  const total = values.reduce((acc, h) => add(acc, h), { x: 0, y: 0, z: 0 });
  return scale(total, 1 / values.length);
}
