// THE EVIDENCE SCREEN — the character's own monitor, used as the game board.
//
// REWRITTEN 2026-07-26 after the first attempt bound its own CanvasTexture to
// the Screen2 mesh and was invisible. The reason is worth recording: the desk
// monitors are ALREADY owned. `VideoScreens.jsx` (mounted on /trade with
// previewMode) creates the mesh material and a 512x320 canvas per seat and
// publishes them as globals; a family of "ambient painters" (CRTScreen,
// DetectiveScreen, MobiusScreen) draw into those canvases; and
// `EvidenceScreens.jsx` established the handshake for temporarily taking a
// screen over — set `canvas.dataset.evidenceActive = 'true'` and every ambient
// painter yields until it's cleared.
//
// So this module owns NO texture and NO material. It borrows the seat's canvas,
// paints, and hands it back. That deletes the CyborgTempleScene patch entirely
// and — the point — puts the receipt on a mesh the camera can actually see.
//
//   stamp(receipt) -> a bordered block of checkable facts appears and STAYS
//   stayBlack()    -> the board is conspicuously, deliberately empty
//   release()      -> give the screen back to the ambient painters

// Same map EvidenceScreens.jsx uses — one canvas + texture global per seat.
export const SCREEN_TARGETS = {
  monk: { canvas: "__screen1Canvas", texture: "__screen1Texture" },
  demon: { canvas: "__screen2Canvas", texture: "__screen2Texture" },
  marisol: { canvas: "__screen3Canvas", texture: "__screen3Texture" },
  eugene: { canvas: "__screen4Canvas", texture: "__screen4Texture" },
};

/**
 * STATION -> the camera pose that FRAMES that monitor.
 *
 * Screen1..4 are authored in CyborgTempleScene's AGENT_CAMERA_SETTINGS and were
 * already there for the in-scene click path — the desks' primary monitors have
 * been clickable since long before this game. SEE WHAT LANDED needs exactly that
 * shot, so this is a lookup rather than four new poses.
 *
 * KEPT NEXT TO SCREEN_TARGETS on purpose: both answer "where is this station's
 * screen", one in canvas terms and one in camera terms, and a station added to
 * one and not the other is a board that stamps evidence nobody can go and read.
 */
export const SCREEN_AGENTS = {
  monk: "Screen1",
  demon: "Screen2",
  marisol: "Screen3",
  eugene: "Screen4",
};

const CY = "#2fd6d6";
const CY_DIM = "rgba(47,214,214,0.30)";
const GOLD = "#ffd23a";
const WHITE = "#eafff9";

/* A VALUE THE ROW ALREADY STATES AS A PERCENTAGE. Only a bare percent — "62%",
   "0%" — is a scale this board is allowed to draw, because only a percent
   carries its own denominator. "3", "2 FUNDS", "4Y 2M" and "TRAILING 30D" are
   all real values with no axis to put them on, and inventing one for them is
   the difference between rendering data and decorating it. */
const PCT = /^(\d{1,3}(?:\.\d+)?)%$/;

/* GRATICULE — chrome, and deliberately the only thing on this board that fills
   space without meaning anything. It is what makes an instrument read as an
   instrument, and it is safe exactly where the carrier was not: nobody reads a
   measurement grid as a measurement, whereas seven rows of hex read as output.
   Kept under 6% alpha so it never competes with a row. */
function graticule(ctx, x, y, w, h, step = 32) {
  ctx.strokeStyle = "rgba(47,214,214,0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = x + step; gx < x + w; gx += step) {
    ctx.moveTo(gx + 0.5, y); ctx.lineTo(gx + 0.5, y + h);
  }
  for (let gy = y + step; gy < y + h; gy += step) {
    ctx.moveTo(x, gy + 0.5); ctx.lineTo(x + w, gy + 0.5);
  }
  ctx.stroke();
}

/* Crop ticks — the corner marks of a framed readout. Four 9px elbows instead of
   a continuous inner border, so the panel reads as registered rather than as a
   second box inside the first. */
function cropTicks(ctx, x, y, w, h, colour, len = 9) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const p = 5;
  [[x + p, y + p, 1, 1], [x + w - p, y + p, -1, 1],
   [x + p, y + h - p, 1, -1], [x + w - p, y + h - p, -1, -1]].forEach(([cx, cy, sx, sy]) => {
    ctx.moveTo(cx + sx * len, cy + 0.5); ctx.lineTo(cx, cy + 0.5);
    ctx.moveTo(cx + 0.5, cy); ctx.lineTo(cx + 0.5, cy + sy * len);
  });
  ctx.stroke();
}

/* THE IDLE CARRIER IS GONE (author, 2026-08-05: "it's really just a placeholder
   screen - it has no actual functionality other than to look active" / "we don't
   want to use it in this game"). It was CRT_CHARS + randLine(): seven rows of
   random hex and box-drawing glyphs, reshuffled on every tick.

   IT WAS BORROWED VOCABULARY. The animated-code look belongs to the ambient
   painters that own these same monitors OUTSIDE the game (CRTScreen,
   DetectiveScreen, MobiusScreen — see the header note), and this board's whole
   premise is that it TAKES the screen from them. Wearing their idle animation
   while doing so is the one thing that made a game board look like set dressing.

   ITS STATED JOB IS ALREADY DONE BY SOMETHING HONEST. The old note argued the
   carrier proved "the machine is alive", which is what keeps an empty board
   reading as a fact about the analyst rather than a bug — but the blinking caret
   below has been carrying that on its own the whole time, and a caret is a
   terminal waiting, not a terminal pretending to compute. An empty board says
   NO RECORD in the status line; nothing needs to scroll for that to be true.

   It also removes a class of bug rather than just a look: the carrier animated
   UNDER the receipt at 6% alpha until earlier today, and the fix for that was
   opaque panels plus a panelBottom row-skip — both of which exist only to
   contain this, and both of which go with it. */

/**
 * FLAT variant — paints into a caller-supplied <canvas> instead of borrowing a
 * seat's shared texture canvas. Same drawing code, same beats; the difference
 * is only where the pixels land.
 *
 * This is what makes the mobile view work without WebGL: on desktop the
 * "monitor" is a texture on a mesh across the room, here it's a canvas in a
 * div. The product moment — you press, and the board conspicuously stays
 * empty — is identical either way, because it was never about the 3D.
 */
export function createFlatEvidenceScreen(canvas, { header = "EVIDENCE", fps = 2 } = {}) {
  return makeScreen({
    header, fps,
    getCanvas: () => canvas || null,
    getTexture: () => null,          // nothing to flag needsUpdate on
    claim: () => {},                 // no ambient painter to yield here
    release: () => {},
  });
}

export function createEvidenceScreen({ station = "demon", header = "EVIDENCE", fps = 2 } = {}) {
  const target = SCREEN_TARGETS[station];
  return makeScreen({
    header, fps,
    getCanvas: () => (typeof window === "undefined" ? null : window[target.canvas] || null),
    getTexture: () => (typeof window === "undefined" ? null : window[target.texture] || null),
    // Take the screen — every ambient painter checks this flag and yields.
    claim: (c) => { if (c?.dataset) c.dataset.evidenceActive = "true"; },
    release: (c) => { if (c?.dataset) c.dataset.evidenceActive = ""; },
  });
}

function makeScreen({ header: header0, fps, getCanvas, getTexture, claim, release }) {
  let header = header0;
  let receipt = null;
  // An ACTIVE negative: somebody was sent, searched, and came back with an
  // absence. Deliberately not the same state as `receipt === null`, which is
  // just a board nobody has put anything on. Proving a negative is the only
  // thing an adviser can do that Barron structurally cannot, so it needs its
  // own picture.
  let empty = null;   // { title, query }
  let tick = 0;
  let live = true;

  function draw() {
    const canvas = getCanvas();
    if (!canvas || !live) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const w = canvas.width, h = canvas.height; // 512 x 320 as created by VideoScreens

    ctx.fillStyle = "#02100e";
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = "left";
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillStyle = CY;
    ctx.fillText(`LIMINAL // ${header}`, 14, 22);
    ctx.textAlign = "right";
    ctx.fillStyle = receipt ? GOLD : empty ? "#ff9b6f" : CY_DIM;
    ctx.fillText(receipt ? "ON RECORD" : empty ? "SEARCHED" : "NO RECORD", w - 14, 22);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(47,214,214,0.25)";
    ctx.fillRect(14, 28, w - 28, 1);

    /* THE BOARD IS AN INSTRUMENT READOUT, NOT A LABEL LIST (author, 2026-08-06:
       "the evidence screens presented are very small and plain ... make them
       look more like data showing on a screen").

       WHAT WAS ACTUALLY WRONG WAS THE SIZE, AND IT WAS STRUCTURAL. The panel's
       height was `34 + rows * 22 + 8`, so a three-row receipt drew a 108px card
       inside a 320px board and two thirds of the screen stayed black. Shrink-
       wrapping is right for a card on a page and wrong for a readout on a
       monitor — a terminal fills its screen. The panel spans header to footer at
       EVERY row count now and the rows are distributed down it, which is also
       what buys each row a track.

       IT MAY NOT INVENT DATA. The carrier was deleted for precisely that, and
       this must not reintroduce it in better clothes. Every mark added here is
       either CHROME nobody could mistake for content — the graticule, the crop
       ticks, the leader dots — or it is DERIVED FROM A VALUE ALREADY PRINTED ON
       ITS OWN ROW: a bar renders the percentage the row states, and the footer
       counts the fields the panel lists.

       AND IT MAY NOT GRADE THE EVIDENCE. Colouring NONE / UNKNOWN / NOBODY red
       and CONFIRMED / NAMED green is the obvious next move and is the one thing
       this board must never do. Weighing what the desk found is the player's
       whole job (VC_GAME §1 — the facts are true, the inference sold on top of
       them is what you judge), and a board that scores its own rows hands them
       the verdict from the furniture. Values are ONE colour. The only thing
       coloured is the RECORD STATE — found / partial / nothing — because that is
       the desk reporting on its own search, not on the deal. */
    const PANEL_TOP = 38, PANEL_BOT = h - 34;
    const px = 12, pw = w - 24, ph = PANEL_BOT - PANEL_TOP;

    if (receipt) {
      const rows = receipt.rows || [];
      const x = px, y = PANEL_TOP, bw = pw, bh = ph;
      // FULLY OPAQUE, still — a receipt is a document, not a transparency, and
      // the graticule belongs INSIDE it rather than showing through it.
      ctx.fillStyle = "#02100e";
      ctx.fillRect(x, y, bw, bh);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, bw, bh); ctx.clip();
      graticule(ctx, x, y, bw, bh);
      ctx.restore();
      ctx.strokeStyle = receipt.partial ? "rgba(191,238,222,0.8)" : GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      cropTicks(ctx, x, y, bw, bh, "rgba(255,210,58,0.5)");

      // A FILLED TITLE STRIP, so the panel has a head rather than a first line
      // of text. The glyph pair (◼ found / ◍ partial) is unchanged.
      ctx.fillStyle = receipt.partial ? "rgba(191,238,222,0.10)" : "rgba(255,210,58,0.10)";
      ctx.fillRect(x + 2, y + 2, bw - 4, 30);
      ctx.fillStyle = receipt.partial ? "rgba(191,238,222,0.3)" : "rgba(255,210,58,0.3)";
      ctx.fillRect(x + 2, y + 32, bw - 4, 1);

      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillStyle = receipt.partial ? "#bfeede" : GOLD;
      ctx.fillText(`${receipt.partial ? "◍" : "◼"} ${String(receipt.title || "RECEIPT").toUpperCase()}`, x + 12, y + 22);

      const top = y + 44, avail = y + bh - 14 - top;
      const rowH = rows.length ? avail / rows.length : avail;
      rows.forEach(([label, value], i) => {
        const ry = top + i * rowH;
        const base = ry + 17;
        const L = String(label).toUpperCase(), V = String(value);

        // Index gutter — derived from position, states nothing new, and is what
        // makes a list read as a numbered readout instead of a caption pair.
        ctx.font = "11px 'Courier New', monospace";
        ctx.fillStyle = "rgba(47,214,214,0.45)";
        ctx.fillText(String(i + 1).padStart(2, "0"), x + 12, base);

        ctx.font = "14px 'Courier New', monospace";
        ctx.fillStyle = "rgba(234,255,249,0.62)";
        ctx.fillText(L, x + 34, base);
        const lw = ctx.measureText(L).width;

        ctx.font = "bold 16px 'Courier New', monospace";
        ctx.fillStyle = WHITE;
        const vw = ctx.measureText(V).width;
        ctx.textAlign = "right";
        ctx.fillText(V, x + bw - 12, base);
        ctx.textAlign = "left";

        // Leader dots — the oldest trick in tabular print, and what makes a
        // label and a value at opposite edges read as ONE row.
        const dotFrom = x + 34 + lw + 8, dotTo = x + bw - 12 - vw - 8;
        ctx.fillStyle = "rgba(47,214,214,0.22)";
        for (let dx = dotFrom; dx < dotTo; dx += 5) ctx.fillRect(dx, base - 4, 1, 1);

        // THE TRACK ONLY EXISTS WHERE THERE IS A SCALE. A dim rail under every
        // row would read as an empty gauge — i.e. as ZERO — on the categorical
        // rows, and zero is a number this board was never given. So a percentage
        // gets a track and a fill; everything else gets a hairline that is
        // plainly a separator (1px at 8%, not 5px at 16%).
        const m = PCT.exec(V);
        const ty = ry + 26;
        if (m) {
          const frac = Math.max(0, Math.min(1, parseFloat(m[1]) / 100));
          ctx.fillStyle = "rgba(47,214,214,0.16)";
          ctx.fillRect(x + 34, ty, bw - 46, 5);
          ctx.fillStyle = receipt.partial ? "#bfeede" : GOLD;
          ctx.fillRect(x + 34, ty, (bw - 46) * frac, 5);
        } else if (i < rows.length - 1) {
          ctx.fillStyle = "rgba(234,255,249,0.08)";
          ctx.fillRect(x + 34, ty + 2, bw - 46, 1);
        }
      });
    } else if (empty) {
      // Same footprint as a receipt so the eye reads "a result arrived", but
      // dashed, cold, and struck through — a query that returned zero rows,
      // not a gold fact. The rule under it is what makes the absence mean
      // something: he did not decline to answer, there is nothing to answer with.
      // FULL HEIGHT, like the receipt \u2014 the absence is a RESULT and gets the
      // same footprint, or the eye reads it as a smaller, lesser answer rather
      // than as the equal-and-opposite one it is.
      const x = px, y = PANEL_TOP, bw = pw, bh = ph;
      ctx.fillStyle = "#02100e";   // opaque, same reason as the receipt panel
      ctx.fillRect(x, y, bw, bh);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, bw, bh); ctx.clip();
      graticule(ctx, x, y, bw, bh);
      ctx.restore();
      ctx.strokeStyle = "#ff9b6f";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      ctx.setLineDash([]);
      cropTicks(ctx, x, y, bw, bh, "rgba(255,155,111,0.5)");

      ctx.fillStyle = "rgba(255,155,111,0.10)";
      ctx.fillRect(x + 2, y + 2, bw - 4, 30);
      ctx.fillStyle = "rgba(255,155,111,0.3)";
      ctx.fillRect(x + 2, y + 32, bw - 4, 1);
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.fillStyle = "#ff9b6f";
      ctx.fillText("\u2298 NOTHING ON FILE", x + 12, y + 22);

      /* CENTRED IN THE PANEL, not stacked under the title. A receipt fills its
         panel because it has three or four rows to spread; an absence has one
         line and a verdict, and top-aligning them left ~200px of grid hanging
         under the answer — which reads as a panel still loading the rest. Three
         lines centred in the box read as the whole of the result, which is
         exactly what they are. */
      const mid = y + 33 + (bh - 33) / 2;
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = "rgba(234,255,249,0.62)";
      ctx.fillText("SEARCHED", x + 12, mid - 18);
      ctx.fillStyle = WHITE;
      ctx.textAlign = "right";
      ctx.fillText(String(empty.query || "\u2014").toUpperCase(), x + bw - 12, mid - 18);
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,155,111,0.35)";
      ctx.fillRect(x + 12, mid - 2, bw - 24, 1);
      ctx.font = "13px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,155,111,0.9)";
      ctx.fillText("0 RESULTS \u00b7 NOT REDACTED \u2014 ABSENT", x + 12, mid + 22);
    } else {
      // IDLE — the graticule and the caret. Between them they say "this screen
      // is on and has nothing on it", which is the whole of what an unstamped
      // board is entitled to say. The grid is what stops that reading as a dead
      // panel now the carrier is gone, WITHOUT saying anything.
      graticule(ctx, px, PANEL_TOP, pw, ph);
      if (tick % 2 === 0) {
        ctx.fillStyle = CY;
        ctx.fillRect(14, PANEL_TOP + 2, 8, 13);
      }
    }

    // FOOTER — counts what is already on the panel, and spells out in a word the
    // one fact the border currently carries by hue alone.
    ctx.fillStyle = "rgba(47,214,214,0.18)";
    ctx.fillRect(14, h - 26, w - 28, 1);
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = "rgba(47,214,214,0.62)";
    ctx.fillText(
      receipt ? `${(receipt.rows || []).length} FIELDS` : empty ? "0 RESULTS" : "AWAITING",
      14, h - 10);
    if (receipt && receipt.partial) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(191,238,222,0.75)";
      ctx.fillText("PARTIAL", w - 14, h - 10);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let sy = 0; sy < h; sy += 3) ctx.fillRect(0, sy, w, 1);

    claim(canvas);
    const tex = getTexture();
    if (tex) tex.needsUpdate = true;
    return true;
  }

  /* 2Hz, NOT 11 — and `fps` is now a blink rate, not a frame rate. The old 11
     existed to reshuffle the carrier fast enough to read as noise; with the
     carrier gone the only thing this loop animates is the caret, and at 11fps
     that blinked ~5 times a second, which is a stutter rather than a cursor.
     Two ticks a second gives the 1Hz blink a caret should have.
     THE LOOP MAY NOT STOP ALTOGETHER, for two reasons that outlive the caret:
     desktop's getCanvas() reads a global VideoScreens may not have published
     yet, so draw() returning false has to be retried (the note below), and
     claim() re-asserts dataset.evidenceActive every pass, which is what keeps
     the ambient painters yielding this monitor for as long as we hold it. */
  const timer = setInterval(() => { tick++; draw(); }, Math.round(1000 / fps));
  draw(); // VideoScreens may mount after us; the interval retries until it lands.

  return {
    stamp(next) { receipt = next || null; empty = null; draw(); },
    /** An adviser looked and found nothing. Not the same as a blank board. */
    stampNothing(query) { receipt = null; empty = { query: query || "" }; draw(); },
    stayBlack() { receipt = null; empty = null; draw(); },
    setHeader(t) { header = t; draw(); },
    hasReceipt() { return !!receipt; },
    hasSearched() { return !!empty; },
    /** Hand the monitor back to the ambient painters (no-op when flat). */
    release() { release(getCanvas()); },
    dispose() {
      live = false;
      clearInterval(timer);
      this.release();
    },
  };
}
