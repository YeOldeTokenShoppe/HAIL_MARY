// THE FACE ART — pure canvas drawing for the pitch-bot display panel.
//
// DELIBERATELY FREE OF three AND OF adviserMouth. Everything here is 2D canvas
// and numbers, which is what makes the face tunable: the art can be opened in a
// bare HTML page, swept across every expression and every amplitude, and judged
// without a rig, a glb export, or an ElevenLabs call in the loop. The binding to
// an actual mesh lives next door in pitchBotFacePanel.
//
// WHY IT LOOKS LIKE THIS. The first pass was two almond eyes and a mouth on a
// black field — evenly spaced, bilaterally symmetric, three convex blobs. That is
// precisely the jack-o'-lantern composition, and no amount of tuning the blobs
// escapes it. Character needed three things that face had none of:
//
//   INTERNAL STRUCTURE   an eye is now an aperture — ring, iris, pupil — so there
//                        is a bright thing inside a dim thing that can LOOK
//                        somewhere. A shape that can look is read as a mind; a
//                        solid blob is read as decoration.
//   HARD MECHANICAL PARTS  brow BARS, not curved eyebrows. A machined rectangle
//                        above an aperture stops the face reading as organic, and
//                        the bar's angle carries more emotion than any eye shape.
//   EVIDENCE OF THE MACHINE  a live cursor and a drifting iris. Both are motion
//                        with no informational content, which is exactly what
//                        makes a panel read as POWERED rather than as drawn.
//
// NO FAKE TELEMETRY. Decorative numeric readouts were considered for the bezel and
// rejected: on this surface UI numbers have to be real, so a panel showing invented
// figures would be a lie in the furniture. The chrome here is all non-numeric.

import { FACE_SHAPES as S, MOUTH_MORPH as MM } from "./pitchBotFaceShapes";

/* ── PALETTE ───────────────────────────────────────────────────────────────── */

const BODY = "rgba(5,7,13,0.96)";
const CORE = "#9dfcff";   // hot centre; clips to white on purpose
const HALO = "#ff2eaf";   // never drawn directly — it is the shadow, i.e. the falloff
const RIM  = "rgba(48,120,150,0.55)";
const IRIS = "rgba(157,252,255,0.55)";
const RING = "rgba(120,220,240,0.26)";

/* ── EXPRESSIONS ───────────────────────────────────────────────────────────── */

/**
 * THE FACE IS A SET OF NUMBERS.
 *
 *   eyeOpen    0..1    shutter lid; 0 is a blink, not an absence
 *   eyeTilt   -1..1    brow/lid angle: inner corner up (pleading) .. down (hard)
 *   browLift  -1..1    brow bar height. The loudest single channel on this face.
 *   pupil      0..1    pupil size. Small reads intense, large reads soft.
 *   eyeSkew   -1..1    ASYMMETRY, applied to the left brow only
 *   mouthCurve -1..1   frown .. smile, the bow of the resting trace
 *   mouthWidth 0..1.2  how much of the panel the mouth spans
 *   mouthOpen  0..1    mouth opening when no audio is driving it
 *   glitch     0..1    how often the panel drops a scanline band
 *
 * gazeX / gazeY are NOT here. They are micro-motion written by the panel every
 * frame, never eased between expressions, and never derived from game state — see
 * the note on gaze in pitchBotFacePanel.
 */
export const PITCH_BOT_FACE_NEUTRAL = {
  eyeOpen: 1, eyeTilt: 0, browLift: 0, pupil: 0.5, eyeSkew: 0,
  mouthCurve: 0, mouthWidth: 1, mouthOpen: 0, glitch: 0.04,
  gazeX: 0, gazeY: 0,
};

const N = PITCH_BOT_FACE_NEUTRAL;

export const PITCH_BOT_FACE_EXPRESSIONS = {
  Neutral:    { ...N },
  Usual:      { ...N, browLift: 0.20, pupil: 0.45, mouthCurve: 0.12 },
  Happy:      { ...N, browLift: 0.70, eyeTilt: 0.15, pupil: 0.40, eyeOpen: 0.88, mouthCurve: 0.80, mouthWidth: 1.05 },
  Sad:        { ...N, browLift: 0.15, eyeTilt: 0.65, pupil: 0.85, eyeOpen: 0.80, mouthCurve: -0.70, mouthWidth: 0.90 },
  // Constricted pupil under a hard low brow. Small pupils read as intent; a big
  // pupil under an angry brow reads as frightened, which is a different bot.
  Angry:      { ...N, browLift: -0.90, eyeTilt: -0.90, pupil: 0.22, eyeOpen: 0.74, mouthCurve: -0.45, mouthWidth: 0.95, glitch: 0.14 },
  // ASYMMETRIC BY DESIGN. One brow out of register is the entire read of
  // "confused", and it is the only uneven face in the set — which is what keeps
  // the unevenness legible as an expression rather than as sloppy drawing.
  Confuse:    { ...N, browLift: 0.25, eyeTilt: 0.30, eyeSkew: -0.95, pupil: 0.60, mouthCurve: -0.15, mouthWidth: 0.80 },
  Frustrated: { ...N, browLift: -0.55, eyeTilt: -0.60, pupil: 0.32, eyeOpen: 0.72, mouthCurve: -0.55, mouthWidth: 0.85, glitch: 0.18 },
  Impatience: { ...N, browLift: -0.25, eyeTilt: -0.32, pupil: 0.40, eyeOpen: 0.58, mouthCurve: -0.25, mouthWidth: 0.90, glitch: 0.10 },
};

export const PITCH_BOT_FACE_DEFAULT = "Neutral";

/**
 * How pronounced the mouth's standing wave is, 0..1. THE DIAL TO TURN if the mouth
 * reads too busy or too plain: 0 is a plain lens, and past ~0.4 the side lobes
 * start competing with the centre opening, which reads as a cloud.
 */
/**
 * How much the mouth widens at full opening, to cancel the purse described in the
 * mouth block. 0 keeps the drawn poses exactly; ~0.25 reads as an open "ah".
 */
export const MOUTH_WIDEN = 0.24;

/* ── LAYOUT ────────────────────────────────────────────────────────────────── */

// Every value is a FRACTION of panel size, so the whole face holds at any canvas
// resolution. These are the numbers to move for spacing and scale.
const L = {
  // y as a fraction of HEIGHT, x and every size as a fraction of `u` (the narrow
  // axis). The plate is portrait — 7.6 x 11cm — because the skull falls away ~8x
  // faster sideways than down, so height is nearly free and width is not.
  eyeY: 0.325, eyeX: 0.215, eyeR: 0.150,
  browY: 0.205, browW: 0.200, browH: 0.032,
  mouthY: 0.725, mouthHalf: 0.265, mouthOpen: 0.072,
};

/* ── SURFACE ───────────────────────────────────────────────────────────────── */

/**
 * A panel is TWO canvases. The visible one is repainted from scratch every frame;
 * the second holds only the glyphs and is faded rather than cleared, which is what
 * produces the phosphor trail. Compositing the second onto the first with
 * `lighter` is the whole persistence effect.
 */
export function createFaceSurface(w, h, make) {
  const H = h == null ? w : h;                       // square if only one given
  const mk = make || (() => document.createElement("canvas"));
  const canvas = mk(); canvas.width = w; canvas.height = H;
  const trail = mk();  trail.width  = w; trail.height  = H;
  return {
    w, h: H,
    // EVERY FEATURE SIZE IS IN UNITS OF `u`, THE NARROWER AXIS. Positions are
    // fractions of their own axis, but a radius expressed as a fraction of height
    // on a portrait plate would draw ellipses where circles belong.
    u: Math.min(w, H),
    canvas, ctx: canvas.getContext("2d"),
    trail, trailCtx: trail.getContext("2d"),
  };
}

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/* ── GLYPHS ────────────────────────────────────────────────────────────────── */

/**
 * Stroke one traced shape.
 *
 * NEON LINE ART, NOT FILLED SILHOUETTES. The drawings are rendered in pencil, but
 * a filled realistic lip at 60px is an unreadable blob. Stroking the contour keeps
 * the FORM legible at panel scale, and it is what the room already does — /trade's
 * own hero face is a neon line drawing.
 *
 * @param cx,cy  centre, in pixels
 * @param width  target width in pixels; height follows from the traced aspect
 * @param opt    { rot, flip, scaleY, close, fill }
 */
function shape(ctx, def, cx, cy, width, opt = {}) {
  const { rot = 0, flip = false, scaleY = 1, close = true, fill = false, bow = 0 } = opt;
  const wpx = width, hpx = width / def.aspect;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.scale(flip ? -1 : 1, scaleY);
  ctx.beginPath();
  const pts = def.path;
  for (let i = 0; i < pts.length; i++) {
    // traced coords are 0..1 inside the part's own box; recentre on its middle
    const x = (pts[i][0] - 0.5) * wpx;
    // BOW bends a fixed outline along its own length, which is how a traced lip can
    // still smile: the ends stay put and the middle drops (canvas y grows down).
    const y = (pts[i][1] - 0.5) * hpx + bow * Math.sin(Math.PI * pts[i][0]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  if (close) ctx.closePath();
  if (fill) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

function drawGlyphs(ctx, W, H, U, p, mouthLevel, t) {
  ctx.shadowColor = HALO;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = CORE;
  ctx.fillStyle = CORE;

  const eyeY = H * L.eyeY;

  for (const side of [-1, 1]) {
    const cx = W * 0.5 + side * U * L.eyeX;
    const tilt = side * p.eyeTilt * 0.44 + (side < 0 ? p.eyeSkew * 0.40 : 0);

    /* ── brow ── */
    const lift = p.browLift * U * 0.045 + (side < 0 ? p.eyeSkew * U * 0.030 : 0);
    ctx.shadowBlur = U * 0.05;
    ctx.lineWidth = Math.max(1.4, U * 0.016);
    shape(ctx, S.brow, cx, H * L.browY - lift, U * L.browW * 1.25,
          { rot: tilt, flip: side > 0 });

    /* ── eye housing ── */
    // eyeOpen squashes the whole eye toward its centre line. With line art that IS
    // the blink: at 0 the housing collapses to a lid seam, which is exactly what a
    // closed mechanical eye looks like.
    const open = Math.max(0.06, p.eyeOpen);
    const eyeW = U * L.eyeR * 2.15;
    ctx.shadowBlur = U * 0.055;
    ctx.lineWidth = Math.max(1.4, U * 0.015);
    shape(ctx, S.eye_housing, cx, eyeY, eyeW, { rot: tilt * 0.5, flip: side > 0, scaleY: open });

    /* ── iris + pupil, clipped to the housing so they never spill ── */
    ctx.save();
    ctx.translate(cx, eyeY);
    ctx.rotate(tilt * 0.5);
    ctx.scale(side > 0 ? -1 : 1, open);
    ctx.beginPath();
    const hp = S.eye_housing.path, hh = eyeW / S.eye_housing.aspect;
    for (let i = 0; i < hp.length; i++) {
      const x = (hp[i][0] - 0.5) * eyeW, y = (hp[i][1] - 0.5) * hh;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.clip();
    // undo the squash for the iris itself: a blinking eye covers the iris, it does
    // not flatten it
    ctx.scale(1, 1 / open);
    const gx = (side > 0 ? -1 : 1) * p.gazeX * U * 0.040;
    const gy = p.gazeY * U * 0.032;
    const irisW = eyeW * 0.42;
    ctx.shadowBlur = U * 0.05;
    ctx.lineWidth = Math.max(1.2, U * 0.013);
    shape(ctx, S.iris, gx, gy, irisW, {});
    shape(ctx, S.pupil, gx, gy, irisW * (0.34 + p.pupil * 0.30), { fill: true });
    ctx.restore();
  }

  /* ── mouth: a MORPH between the two drawn poses ── */
  //
  // The outer silhouette lerps between the drawn closed and open mouths, so
  // amplitude drives a real deformation rather than two rigid shapes sliding
  // apart. Continuous by construction — interpolation between two extremes, not
  // the viseme quantisation this face started with.
  const level = Math.max(0, Math.min(1, mouthLevel));
  const mouthW = U * L.mouthHalf * 2 * p.mouthWidth;
  const seamY = H * L.mouthY;
  const bow = p.mouthCurve * U * 0.050;

  const place = (q, i) => {
    const bx = q[i][0], by = q[i][1];
    return [W * 0.5 + bx * mouthW, seamY + by * mouthW + bow * Math.cos(Math.PI * bx)];
  };

  ctx.shadowBlur = U * 0.055;
  ctx.lineWidth = Math.max(1.4, U * 0.015);

  const lip = MM.closed.map((c, i) => [
    c[0] + (MM.open[i][0] - c[0]) * level,
    c[1] + (MM.open[i][1] - c[1]) * level,
  ]);
  ctx.beginPath();
  for (let i = 0; i < lip.length; i++) {
    const [x, y] = place(lip, i);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // THE OPENING — AND, AT REST, THE LIP LINE. Never gated on level: scaled by 0
  // the cavity collapses onto the seam and strokes as a single line, which is what
  // a closed mouth needs. Without it the silhouette is a lens, and a lens with
  // nothing in it reads as a hole rather than as closed lips.
  {
    const cav = MM.cavity.map((c) => [c[0], c[1] * level]);
    ctx.beginPath();
    for (let i = 0; i < cav.length; i++) {
      const [x, y] = place(cav, i);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = BODY;
    ctx.fill();
    ctx.restore();
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
}

/* ── PANEL ─────────────────────────────────────────────────────────────────── */

const visorPath = (ctx, W, H, U) => {
  ctx.beginPath();
  ctx.roundRect(W * 0.05, H * 0.05, W * 0.90, H * 0.90, U * 0.15);
};

/**
 * Paint one frame.
 * @param surface     from createFaceSurface
 * @param p           the parameter set above, plus gazeX/gazeY
 * @param mouthLevel  0..1 mouth opening for THIS frame — the smoothed speech
 *                    level, or p.mouthOpen when nothing is speaking. No history:
 *                    the mouth is a standing wave, so the past is not drawn.
 * @param t           seconds, for the iris drift and the cursor. Monotonic.
 * @param rand        injectable RNG so a preview can be deterministic
 */
export function drawPitchBotFace(surface, p, mouthLevel = 0, t = 0, rand = Math.random) {
  const { ctx, trailCtx, canvas, trail, w: W, h: H, u: U } = surface;

  /* ── phosphor: fade the previous glyph frame instead of clearing it ──────── */
  trailCtx.globalCompositeOperation = "destination-out";
  trailCtx.fillStyle = "rgba(0,0,0,0.34)";
  trailCtx.fillRect(0, 0, W, H);
  trailCtx.globalCompositeOperation = "source-over";
  drawGlyphs(trailCtx, W, H, U, p, mouthLevel, t);

  /* ── panel ───────────────────────────────────────────────────────────────── */
  ctx.clearRect(0, 0, W, H);
  ctx.save();

  // THE SILHOUETTE IS GEOMETRY NOW. The faceplate is a flat rounded-rect mesh, so
  // this clip only has to agree with it — it is no longer what defines the visor
  // shape. Kept because the alpha edge is what keeps the rim from aliasing against
  // the bezel behind it.
  visorPath(ctx, W, H, U);
  ctx.clip();

  ctx.fillStyle = BODY;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(trail, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  /* ── scanlines ───────────────────────────────────────────────────────────── */
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

  /* ── cursor — the one mark that says this terminal is live ───────────────── */
  if (Math.floor(t * 1.6) % 2 === 0) {
    ctx.fillStyle = "rgba(157,252,255,0.70)";
    ctx.fillRect(W * 0.80, H * 0.905, U * 0.045, U * 0.024);
  }

  /* ── dropped band: the tell that this is a display under load ────────────── */
  if (p.glitch > 0.001 && rand() < p.glitch * 0.35) {
    const by = rand() * H;
    const bh = 2 + rand() * 6;
    const dx = (rand() - 0.5) * U * 0.05 * p.glitch;
    ctx.drawImage(canvas, 0, by, W, bh, dx, by, W, bh);
  }

  ctx.restore();

  /* ── rim: recessed glass, drawn last so the scanlines do not cross it ────── */
  ctx.strokeStyle = RIM;
  ctx.lineWidth = Math.max(1, U * 0.006);
  visorPath(ctx, W, H, U);
  ctx.stroke();
}
