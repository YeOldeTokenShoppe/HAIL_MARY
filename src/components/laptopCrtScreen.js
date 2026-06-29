import * as THREE from "three";

// Lightweight CRT "Liminal Terminal" screen for the desk laptops in
// CyborgTempleScene (LaptopScreen1-4). One shared animated CanvasTexture —
// header + scrolling glyph code-feed + blinking cursor + footer + scanlines —
// applied to all four laptops (this page's GPU budget is tight, so a single
// shared texture beats four). Reads as a live working terminal, echoing the
// mobile hero's CRT aesthetic without the cost of a per-laptop 3D render.
//
// Returns { texture, dispose }. The texture self-animates via a setInterval;
// call dispose() on unmount to stop it and free the GPU texture.
const CRT_CHARS = '01<>/\\|=+*[]{}#%@xABCDEF0123456789:.░▒▓';

function randLine() {
  const n = 16 + Math.floor(Math.random() * 12);
  let s = '';
  for (let i = 0; i < n; i++) s += CRT_CHARS[Math.floor(Math.random() * CRT_CHARS.length)];
  return s;
}

export function createLaptopCrtScreen({ w = 512, h = 384, fps = 11 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  // The desk laptop screens face inward (toward the agents), so the orbiting
  // camera sees the back face — mirror the texture on X so the text reads the
  // right way round from the viewer's side.
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.y = -1;
  tex.offset.y = 1;

  const CY = '#2fd6d6';
  const CYbright = '#5ff2f2';
  const GOLD = '#ffd23a';
  const rows = 12;
  const top = 34;
  const bottom = h - 26;
  const lineH = Math.floor((bottom - top) / rows);
  const lines = [];
  for (let i = 0; i < rows; i++) lines.push(randLine());

  let frame = 0;
  function draw() {
    // background
    ctx.fillStyle = '#02100e';
    ctx.fillRect(0, 0, w, h);

    // header bar
    ctx.fillStyle = '#0c2a2a';
    ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = CYbright;
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('LIMINAL // RL80', 10, 14);
    const on = Math.floor(frame / 5) % 2 === 0;
    ctx.fillStyle = on ? '#ff4040' : 'rgba(255,64,64,0.25)';
    ctx.beginPath(); ctx.arc(w - 58, 13, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CY;
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillText('LIVE', w - 46, 14);

    // scrolling glyph code-feed
    if (frame % 3 === 0) { lines.push(randLine()); lines.shift(); }
    ctx.font = "15px 'Courier New', monospace";
    ctx.textBaseline = 'top';
    const goldRow = (frame >> 3) % rows;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === goldRow ? GOLD : CY;
      ctx.fillText(lines[i], 10, top + i * lineH);
    }

    // blinking cursor on the last line
    if (Math.floor(frame / 4) % 2 === 0) {
      ctx.fillStyle = CYbright;
      ctx.fillRect(10, top + (rows - 1) * lineH + 2, 10, lineH - 6);
    }

    // footer status
    ctx.fillStyle = '#0c2a2a';
    ctx.fillRect(0, h - 22, w, 22);
    ctx.fillStyle = CY;
    ctx.font = "12px 'Courier New', monospace";
    ctx.textBaseline = 'middle';
    ctx.fillText('SUBJECT: OUR LADY   ENC: AES-80   PKT ' + (1000 + frame % 9000), 10, h - 11);

    // CRT scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    tex.needsUpdate = true;
  }

  draw();
  const id = setInterval(() => { frame++; draw(); }, Math.round(1000 / fps));

  return {
    texture: tex,
    dispose() { clearInterval(id); tex.dispose(); },
  };
}
