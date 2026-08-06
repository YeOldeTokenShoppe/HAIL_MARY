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
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillStyle = CY;
    ctx.fillText(`LIMINAL // ${header}`, 14, 22);
    ctx.textAlign = "right";
    ctx.fillStyle = receipt ? GOLD : empty ? "#ff9b6f" : CY_DIM;
    ctx.fillText(receipt ? "ON RECORD" : empty ? "SEARCHED" : "NO RECORD", w - 14, 22);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(47,214,214,0.25)";
    ctx.fillRect(14, 28, w - 28, 1);

    // NOTHING FILLS THE BODY WHEN THERE IS NOTHING ON THE BOARD — see the note
    // where the carrier used to be built. The panels below still paint opaque:
    // that stays correct on its own terms (a receipt is a document, not a
    // transparency), and it is no longer load-bearing against a bleed.
    if (receipt) {
      const rows = receipt.rows || [];
      const x = 12, y = 44, bw = w - 24, bh = 34 + rows.length * 22 + 8;
      // FULLY OPAQUE. At 0.94 the live carrier behind it showed through and
      // animated under the receipt — see the carrier note above.
      ctx.fillStyle = "#02100e";
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = receipt.partial ? "rgba(191,238,222,0.8)" : GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);

      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.fillStyle = receipt.partial ? "#bfeede" : GOLD;
      ctx.fillText(`${receipt.partial ? "◍" : "◼"} ${String(receipt.title || "RECEIPT").toUpperCase()}`, x + 12, y + 22);

      ctx.font = "12px 'Courier New', monospace";
      rows.forEach(([label, value], i) => {
        const ry = y + 44 + i * 22;
        ctx.fillStyle = "rgba(234,255,249,0.6)";
        ctx.fillText(String(label).toUpperCase(), x + 12, ry);
        ctx.fillStyle = WHITE;
        ctx.textAlign = "right";
        ctx.fillText(String(value), x + bw - 12, ry);
        ctx.textAlign = "left";
      });
    } else if (empty) {
      // Same footprint as a receipt so the eye reads "a result arrived", but
      // dashed, cold, and struck through — a query that returned zero rows,
      // not a gold fact. The rule under it is what makes the absence mean
      // something: he did not decline to answer, there is nothing to answer with.
      const x = 12, y = 44, bw = w - 24, bh = 104;
      ctx.fillStyle = "#02100e";   // opaque, same reason as the receipt panel
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = "#ff9b6f";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      ctx.setLineDash([]);

      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillStyle = "#ff9b6f";
      ctx.fillText("\u2298 NOTHING ON FILE", x + 12, y + 26);

      ctx.font = "12px 'Courier New', monospace";
      ctx.fillStyle = "rgba(234,255,249,0.62)";
      ctx.fillText("SEARCHED", x + 12, y + 52);
      ctx.fillStyle = WHITE;
      ctx.textAlign = "right";
      ctx.fillText(String(empty.query || "\u2014").toUpperCase(), x + bw - 12, y + 52);
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,155,111,0.35)";
      ctx.fillRect(x + 12, y + 68, bw - 24, 1);
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,155,111,0.9)";
      ctx.fillText("0 RESULTS \u00b7 NOT REDACTED \u2014 ABSENT", x + 12, y + 88);
    } else if (tick % 2 === 0) {
      // THE WAITING CARET, and now the only moving thing on an idle board. It
      // sat at the bottom-left under seven rows of carrier; with the body empty
      // it is the board's one mark, so it moves up to where a prompt actually
      // is — the first line under the rule.
      ctx.fillStyle = CY;
      ctx.fillRect(14, 40, 8, 13);
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
