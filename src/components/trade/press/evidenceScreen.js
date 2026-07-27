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

const CY = "#2fd6d6";
const CY_DIM = "rgba(47,214,214,0.30)";
const GOLD = "#ffd23a";
const WHITE = "#eafff9";
const CRT_CHARS = "01<>/\\|=+*[]{}#%@xABCDEF0123456789:.░▒▓";

function randLine(n = 24) {
  let s = "";
  for (let i = 0; i < n; i++) s += CRT_CHARS[Math.floor(Math.random() * CRT_CHARS.length)];
  return s;
}

export function createEvidenceScreen({ station = "demon", header = "EVIDENCE", fps = 11 } = {}) {
  const target = SCREEN_TARGETS[station];
  let receipt = null;
  let carrier = Array.from({ length: 7 }, () => randLine());
  let tick = 0;
  let live = true;

  const getCanvas = () => (typeof window === "undefined" ? null : window[target.canvas] || null);
  const getTexture = () => (typeof window === "undefined" ? null : window[target.texture] || null);

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
    ctx.fillStyle = receipt ? GOLD : CY_DIM;
    ctx.fillText(receipt ? "ON RECORD" : "NO RECORD", w - 14, 22);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(47,214,214,0.25)";
    ctx.fillRect(14, 28, w - 28, 1);

    // Idle carrier — dim, so a stamped receipt dominates. Its job is to prove
    // the machine is alive, which is what makes an empty board read as a fact
    // about Barron rather than a bug in the game.
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillStyle = CY_DIM;
    carrier.forEach((l, i) => ctx.fillText(l, 14, 48 + i * 18));

    if (receipt) {
      const rows = receipt.rows || [];
      const x = 12, y = 44, bw = w - 24, bh = 34 + rows.length * 22 + 8;
      ctx.fillStyle = "rgba(2,16,14,0.94)";
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
    } else if (tick % 2 === 0) {
      ctx.fillStyle = CY;
      ctx.fillRect(14, h - 26, 8, 13);
    }

    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let sy = 0; sy < h; sy += 3) ctx.fillRect(0, sy, w, 1);

    // Take the screen (ambient painters check this flag and yield) and push.
    if (canvas.dataset) canvas.dataset.evidenceActive = "true";
    const tex = getTexture();
    if (tex) tex.needsUpdate = true;
    return true;
  }

  const timer = setInterval(() => {
    tick++;
    carrier.shift();
    carrier.push(randLine());
    draw();
  }, Math.round(1000 / fps));
  draw(); // VideoScreens may mount after us; the interval retries until it lands.

  return {
    stamp(next) { receipt = next || null; draw(); },
    stayBlack() { receipt = null; draw(); },
    setHeader(t) { header = t; draw(); },
    hasReceipt() { return !!receipt; },
    /** Hand the monitor back to the ambient painters. */
    release() {
      const canvas = getCanvas();
      if (canvas?.dataset) canvas.dataset.evidenceActive = "";
    },
    dispose() {
      live = false;
      clearInterval(timer);
      this.release();
    },
  };
}
