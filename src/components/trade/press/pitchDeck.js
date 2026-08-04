// THE PITCH DECK — the bot's own surface, and the last thing in §1 that had none.
//
// VC_GAME.md §1 has carried "THERE IS NO PITCH SURFACE IN 3D — a live gap" since
// the easel was cut from the glb, and §7 item 2 lists it open: "the pitcher has
// no way to show the thing it is selling and no board for its own receipts."
// The pitcher's board has been aliasing an analyst's evidence terminal instead,
// which is the one screen in the room that should NOT look like evidence.
//
// THE SLIDE DRAWS THE SHAPE, and that is the whole design.
//
// Every claim already carries `shape` — one of the six in questions.js, the
// game's own taxonomy of how a TRUE thing gets arranged to mislead. So the deck
// does not need to be authored: it renders the rhetorical device the claim is
// already built on. SELECTIVE_WINDOW gets a chart with a chosen window and a
// truncated axis. SURVIVORSHIP gets bars that only count what survived.
// UNSOURCED gets a number the size of the screen with nothing under it saying
// who says so. The device IS the picture.
//
// This is what makes §1's headline visible instead of merely stated — "every
// fact stated is true; what you judge is the inference sold on top of it." A
// chart is the canonical way to draw a true number dishonestly, and the player
// is looking at one while the bot talks over it.
//
// IT CANNOT LEAK, ON THE SAME TERMS AS THE PRESSURE SHIELD (§1 rule 3).
// It reads exactly two things:
//   • `claim.shape` / `claim.subject` / `claim.lane` — SLOT-level fields, authored
//     once per slot and identical in both branches, which is the same property
//     `backing` has and the reason authoring rule 1 exists. They are already
//     public from second zero: the agenda rail prints every subject and its lane
//     dot before the bot has said a word.
//   • `deal.surface` — asserted uncorrelated with truth by invariant 5, or the
//     optimal play would be "skim the stats, skip the analysts".
// It never sees run.outcomes, the branch, `backing`, or the resolver. A deck
// keyed to any of those would be a lookup table you read before anyone speaks —
// exactly the objection §1 rule 6 makes about the rig roll, and the reason the
// rig is drawn before the deal exists.
//
// ZERO MARGINAL COST PER ARCHETYPE, which is the discipline rule (§5) applied to
// art instead of prose: archetypes 5-13 author no slide, the same way they
// author no aside, no adviser line and no fate.
//
// DETERMINISTIC, because it is redrawn on a timer. The series comes from a hash
// of the ticker and the claim id, so a claim's chart is the same chart every
// time it is looked at. A shape that reshuffled at 11fps would be noise with a
// chart's authority — and worse, an animated chart would be reading as
// information, which invariant 9 forbids.

// THE SELLER'S PALETTE, NOT THE DESK'S. Evidence screens are cyan-on-black
// terminals; this is the thing being sold TO you, so it takes the pink the game
// already assigns the pitcher everywhere else — the claim border, its reply in
// the answer panel, the HEAR ITS RESPONSE half of the choice. Two visual
// languages, and which one you are looking at is legible before a word is read.
const PINK = "#ff5f9e";
const PINK_DIM = "rgba(255,95,158,0.30)";
const GOLD = "#ffd23a";
const WHITE = "#eafff9";
const INK = "rgba(234,255,249,0.55)";
const BG = "#12060d";

/** Stable per-claim pseudo-randomness. Same claim, same chart, forever. */
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function lcg(seed) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A rising series with texture — the shape every one of these slides wants,
 *  because a deck never shows you a line going the other way. */
function series(rand, n, { drift = 1, noise = 0.35 } = {}) {
  const out = [];
  let v = 0.18 + rand() * 0.12;
  for (let i = 0; i < n; i++) {
    v += (drift * (0.62 / n)) * (0.55 + rand() * 0.9);
    out.push(Math.max(0.04, Math.min(0.98, v + (rand() - 0.5) * noise * 0.22)));
  }
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wrap to a pixel width. Canvas has no text layout, and the subject lines run
 *  long enough ("THE SUPPLY THAT HASN'T LANDED YET") to need it. */
function wrap(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/* ------------------------------------------------------------------ */
/* the six slides — one per SHAPE                                       */
/* ------------------------------------------------------------------ */

/** SELECTIVE_WINDOW — "true inside a window chosen because it's flattering."
 *  So: draw the window, name it, and truncate the axis. The lie is the frame,
 *  and the frame is the only thing on the slide that is drawn honestly. */
function slideWindow(ctx, g, rand, surface) {
  const pts = series(rand, 22, { drift: 1.1 });
  const { x, y, w, h } = g;
  // THE TRUNCATED BASELINE, LABELLED. Starting the axis near the series' own
  // floor is what turns a modest rise into a wall, and printing the floor is
  // what makes it technically disclosed. Both halves are the point.
  const floor = Math.min(...pts) * 0.94;
  const span = Math.max(...pts) - floor || 1;
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const px = x + (i / (pts.length - 1)) * w;
    const py = y + h - ((p - floor) / span) * h;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, "rgba(255,95,158,0.30)");
  grad.addColorStop(1, "rgba(255,95,158,0)");
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = INK;
  ctx.fillText(`WINDOW: LAST ${14 + Math.floor(rand() * 20)} DAYS`, x, y + h + 14);
  ctx.textAlign = "right";
  ctx.fillText(`AXIS FROM ${(floor * 100).toFixed(0)}`, x + w, y + h + 14);
  ctx.textAlign = "left";
  return surface?.change24h ? `${surface.change24h} TODAY` : null;
}

/** SURVIVORSHIP — "the sample quietly excludes its failures." Bars that only
 *  count what is still here, with the exclusion printed in the small type
 *  where a real deck would put it. */
function slideSurvivors(ctx, g, rand, surface) {
  const n = 9;
  const pts = series(rand, n, { drift: 1.0, noise: 0.5 });
  const { x, y, w, h } = g;
  const bw = (w / n) * 0.62;
  pts.forEach((p, i) => {
    const bx = x + (i / n) * w + ((w / n) - bw) / 2;
    const bh = Math.max(3, p * h);
    ctx.fillStyle = i === n - 1 ? GOLD : PINK;
    ctx.globalAlpha = i === n - 1 ? 1 : 0.55 + (i / n) * 0.4;
    ctx.fillRect(bx, y + h - bh, bw, bh);
  });
  ctx.globalAlpha = 1;
  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = INK;
  ctx.fillText("ACTIVE WALLETS ONLY", x, y + h + 14);
  return surface?.holders ? `${surface.holders} HOLDERS` : null;
}

/** POSITIONED — "the speaker benefits from you believing it." A donut is how
 *  an allocation gets shown when the point is that it looks tidy. */
function slidePositioned(ctx, g, rand, surface) {
  const { x, y, w, h } = g;
  const cx = x + w * 0.30;
  const cy = y + h / 2;
  const r = Math.min(h / 2, w * 0.26);
  const parts = [0.42 + rand() * 0.1, 0.24, 0.18, 0.16];
  const total = parts.reduce((a, b) => a + b, 0);
  const cols = [PINK, GOLD, "rgba(255,95,158,0.45)", "rgba(234,255,249,0.28)"];
  const labels = ["COMMUNITY", "TREASURY", "TEAM", "LIQUIDITY"];
  let a0 = -Math.PI / 2;
  parts.forEach((p, i) => {
    const a1 = a0 + (p / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = cols[i];
    ctx.fill();
    a0 = a1;
  });
  // THE HOLE IS FILLED, NOT PUNCHED. destination-out erases pixels rather than
  // covering them, so it took the deck's background and its scanlines out with
  // the wedges and left a grey disc that read as a drop shadow. The slide is
  // drawn onto an opaque background, so painting the hole in that background's
  // own colour is both simpler and the only version that composites correctly.
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "9px 'Courier New', monospace";
  labels.forEach((l, i) => {
    const ly = y + 10 + i * 15;
    ctx.fillStyle = cols[i];
    ctx.fillRect(x + w * 0.60, ly - 7, 8, 8);
    ctx.fillStyle = INK;
    ctx.fillText(`${l}  ${Math.round((parts[i] / total) * 100)}%`, x + w * 0.60 + 13, ly);
  });
  return null;
}

/** UNSOURCED — "an assertion with no traceable origin." The number the size of
 *  the room, and deliberately nothing under it. The empty strip where a source
 *  line belongs is the slide. */
function slideUnsourced(ctx, g, rand, surface) {
  const { x, y, w, h } = g;
  /* WHICH NUMBER, CHOSEN BY THE CLAIM. Every UNSOURCED slot used to print
     surface.mcap, so a deck with two of them showed the same $8.0M twice and
     read as a broken component rather than as a seller with two assertions.
     `rand` is already seeded from the claim id, so the pick is stable per claim
     and different across them — and every candidate is a listing stat, which
     invariant 5 asserts is uncorrelated with the branch. */
  const picks = [
    [surface?.mcap, "AND RISING"],
    [surface?.holders, "HOLDERS, AND CLIMBING"],
    [surface?.social, "SENTIMENT, OUT OF 10"],
    [surface?.change24h, "IN THE LAST DAY"],
  ].filter(([v]) => v != null && v !== "");
  const [big, under] = picks.length
    ? picks[Math.floor(rand() * picks.length) % picks.length]
    : ["—", "AND RISING"];
  ctx.textAlign = "center";
  ctx.font = `bold ${String(big).length > 6 ? 38 : 50}px 'Courier New', monospace`;
  ctx.fillStyle = WHITE;
  ctx.fillText(String(big), x + w / 2, y + h * 0.54);
  ctx.font = "10px 'Courier New', monospace";
  ctx.fillStyle = PINK;
  ctx.fillText(under, x + w / 2, y + h * 0.54 + 20);
  ctx.textAlign = "left";
  // where the citation would go
  ctx.strokeStyle = "rgba(234,255,249,0.13)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + h + 6);
  ctx.lineTo(x + w * 0.5, y + h + 6);
  ctx.stroke();
  ctx.setLineDash([]);
  return null;
}

/** BORROWED_CREDIBILITY — "leaning on someone else's authority, past the edge
 *  of what that authority actually examined." A seal, and a scope line small
 *  enough to be true. */
function slideSeal(ctx, g, rand) {
  const { x, y, w, h } = g;
  const cx = x + w / 2;
  const cy = y + h * 0.40;
  const r = Math.min(h * 0.30, 42);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  // ONE WORD INSIDE THE RING. "NO CRITICAL FINDINGS" was in there too and is
  // ~100px of 9px monospace against an 84px circle, so it crossed the stroke on
  // both sides and got clipped by the slide's own edge on a phone. The seal
  // carries the word; the claim goes under it, where a real one prints it.
  ctx.font = "bold 12px 'Courier New', monospace";
  ctx.fillStyle = GOLD;
  ctx.fillText("REVIEWED", cx, cy + 4);
  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.fillStyle = WHITE;
  ctx.fillText("NO CRITICAL FINDINGS", cx, cy + r + 22);
  // THE SCOPE LINE IS THE WHOLE SHAPE — borrowed credibility is an authority
  // quoted past the edge of what it examined, so the edge is printed, small,
  // exactly where a deck would put the thing it hopes you skim.
  ctx.font = "8px 'Courier New', monospace";
  ctx.fillStyle = INK;
  ctx.fillText("SCOPE: CONTRACTS AS SUBMITTED", cx, y + h + 12);
  ctx.textAlign = "left";
  return null;
}

/** UNFALSIFIABLE — "shaped so no evidence could dent it."
 *
 *  A CHART WITH NOTHING ON IT. The first version set the claim as a line of
 *  keynote text, which was both weaker and broken: it took (ctx, g, spinish)
 *  while every sibling takes (ctx, g, rand, surface), so the dispatcher handed
 *  it the seeded RNG and the slide rendered the source of a function.
 *
 *  The picture is better than the sentence anyway. This is the same rising
 *  curve as SELECTIVE_WINDOW with every measurable stripped — no window, no
 *  axis floor, no units, no number — so the two slides sit in one deck as the
 *  difference the game is teaching: one shows you a frame you could argue with,
 *  and one gives you nothing to argue with at all. Smooth, too: the noise is
 *  gone, because a line that never wavers is the giveaway that nothing is being
 *  measured. */
function slideUnfalsifiable(ctx, g, rand) {
  const { x, y, w, h } = g;
  const n = 40;
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const py = y + h - Math.pow(t, 1.7) * h * 0.88 - h * 0.05;
    const px = x + t * w;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, "rgba(255,95,158,0.26)");
  grad.addColorStop(1, "rgba(255,95,158,0)");
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = INK;
  ctx.fillText("TRAJECTORY", x, y + h + 14);
  return null;
}

/* EVERY SLIDE TAKES (ctx, geometry, rand, surface) — no exceptions, and the one
   exception is what put a function's source on screen. If a slide needs
   something else, widen all six rather than giving one a private signature. */
const SLIDES = {
  SELECTIVE_WINDOW: slideWindow,
  SURVIVORSHIP: slideSurvivors,
  POSITIONED: slidePositioned,
  UNSOURCED: slideUnsourced,
  BORROWED_CREDIBILITY: slideSeal,
  UNFALSIFIABLE: slideUnfalsifiable,
};

/**
 * Same contract as createFlatEvidenceScreen so it drops into the board
 * machinery unchanged: a caller-supplied 512x320 canvas, a repaint timer, and
 * a dispose. What differs is only what gets painted.
 *
 *   setClaim(claim, surface)  the slide for the point being made now
 *   stamp(receipt)            you pressed the bot and it produced a number —
 *                             it goes on the slide, because a deck is where a
 *                             seller puts a figure it wants believed
 *   stayBlack()               VIBES. It has nothing to put up for this one, and
 *                             a dark deck says that better than a dark terminal:
 *                             the bot has slides, just not for your question.
 */
export function createPitchDeck(canvas, { ticker = "", fps = 8 } = {}) {
  let claim = null;
  let surface = null;
  let receipt = null;
  let black = false;
  let live = true;

  function draw() {
    if (!canvas || !live) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // the deck's chrome: a slide number and whose deck it is
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = PINK;
    ctx.fillText(ticker ? `${ticker}  //  THE OPPORTUNITY` : "THE OPPORTUNITY", 16, 22);
    ctx.fillStyle = PINK_DIM;
    ctx.fillRect(16, 30, w - 32, 1);

    if (black || !claim) {
      // NOTHING TO PUT UP. Deliberately not an error state and not a receipt
      // terminal's dark screen — a deck sitting on its holding slide.
      ctx.textAlign = "center";
      ctx.font = "10px 'Courier New', monospace";
      ctx.fillStyle = "rgba(234,255,249,0.30)";
      ctx.fillText(black ? "NO SLIDE FOR THAT" : "STANDING BY", w / 2, h / 2);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      for (let sy = 0; sy < h; sy += 3) ctx.fillRect(0, sy, w, 1);
      return true;
    }

    // the slide's title is the claim's own subject — the same string the agenda
    // rail is already printing, so the deck and the running order agree
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillStyle = WHITE;
    const title = wrap(ctx, claim.subject, w - 32).slice(0, 2);
    title.forEach((l, i) => ctx.fillText(l, 16, 54 + i * 18));

    const top = 54 + title.length * 18 + 10;
    const g = { x: 22, y: top, w: w - 44, h: h - top - 42 };
    const rand = lcg(seedFrom(`${ticker}:${claim.id}:${claim.shape}`));
    const slide = SLIDES[claim.shape] || slideUnfalsifiable;
    const foot = slide(ctx, g, rand, surface);

    if (foot) {
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.fillStyle = GOLD;
      ctx.fillText(foot, 22, h - 14);
    }

    // THE RECEIPT ON THE SLIDE. You pressed the bot directly and it produced
    // something; a seller puts that figure on the deck rather than on a
    // terminal across the room. Gold, because gold is the receipt colour
    // everywhere else on this surface and that consistency is worth more than
    // the deck owning its own accent for this one element.
    if (receipt) {
      const rows = receipt.rows || [];
      const bh = 26 + rows.length * 17;
      const by = h - 14 - bh - 10;
      ctx.fillStyle = "rgba(4,2,6,0.93)";
      roundRect(ctx, 22, by, w - 44, bh, 3);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.fillStyle = GOLD;
      ctx.fillText(String(receipt.title || "RECEIPT").toUpperCase(), 32, by + 16);
      ctx.font = "10px 'Courier New', monospace";
      rows.forEach(([label, value], i) => {
        const ry = by + 32 + i * 17;
        ctx.fillStyle = INK;
        ctx.fillText(String(label).toUpperCase(), 32, ry);
        ctx.fillStyle = WHITE;
        ctx.textAlign = "right";
        ctx.fillText(String(value), w - 32, ry);
        ctx.textAlign = "left";
      });
    }

    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let sy = 0; sy < h; sy += 3) ctx.fillRect(0, sy, w, 1);
    return true;
  }

  // Slower than the evidence screens' 11fps on purpose: nothing here animates,
  // and the timer exists only so the canvas survives a late mount the same way
  // theirs does. A projected slide that shimmered would be reading as live.
  const timer = setInterval(draw, Math.round(1000 / fps));
  draw();

  return {
    setClaim(next, nextSurface) {
      claim = next || null;
      if (nextSurface) surface = nextSurface;
      black = false;
      receipt = null;
      draw();
    },
    stamp(next) { receipt = next || null; black = false; draw(); },
    stampNothing() { receipt = null; black = true; draw(); },
    stayBlack() { receipt = null; black = true; draw(); },
    hasReceipt() { return !!receipt; },
    hasSearched() { return black; },
    setHeader() {},
    release() {},
    dispose() { live = false; clearInterval(timer); },
  };
}
