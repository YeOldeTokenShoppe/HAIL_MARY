// Boardwalk postcards for the phone's BOARDWALK tab — one still per stall,
// rendered headlessly from the DESKTOP strip so the phone never loads the
// strip GLB. Re-run after a strip re-export or a vendor re-pose:
//   node scripts/render-postcards.mjs            (dev server on :3000)
//   POSTCARD_TOD=17.5 POSTCARD_BASE=http://localhost:3000 node scripts/render-postcards.mjs
// Output: public/boardwalk/<vendorId>.webp (600×800) + a contact sheet in the scratch dir.
// Playwright is not a project dependency; point PLAYWRIGHT_PATH at an install
// (e.g. the npx cache) — WebKit renders WebGL headlessly, Chromium may not be installed there.
const PW = process.env.PLAYWRIGHT_PATH || "playwright";
const { webkit } = await import(PW);
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.POSTCARD_BASE || "http://localhost:3000";
const TOD = process.env.POSTCARD_TOD || "17.5";
const OUT = path.resolve("public/boardwalk");
const W = 600, H = 800;             // postcard pixels (3:4 portrait)
const VIEW = { width: 1400, height: 900 };
// Medium shot: pull back from the face close-up so the stall reads.
const SHOT_DIST_MULT = 3.6;
const LIFT_MULT = 0.06;             // raise the look-at a touch above the eyes

fs.mkdirSync(OUT, { recursive: true });
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
// No SitePal in a headless render (external embed; the face projection is not part of a postcard).
await page.route((u) => !u.href.startsWith(BASE) && /sitepal|oddcast/i.test(u.href), (r) => r.abort());
await page.goto(`${BASE}/hailmary?tod=${TOD}&sitepal=lazy`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("canvas") != null, null, { timeout: 90000 });
// Wait for every stall to register (the strip GLB + vendor GLBs loaded).
const ids = await page.evaluate(async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const reg = window.__hmVendorSpots || {};
    const keys = Object.keys(reg);
    if (keys.length >= 9 && keys.every((k) => reg[k].approach)) return keys;
    await new Promise((r) => setTimeout(r, 250));
  }
  return Object.keys(window.__hmVendorSpots || {});
});
console.log("stalls:", ids.join(", "));
// Clear the panels so the canvas is the whole viewport.
const hide = page.getByRole("button", { name: /HIDE PANELS/i });
if (await hide.count()) { await hide.first().click(); await page.waitForTimeout(600); }
await page.waitForFunction(() => typeof window.__hmFocusObject === "function", null, { timeout: 30000 });
// --plates: a second still per stall with the stall's OWN dressing hidden (the
// windows come from scripts/stall-windows.json, written by extract-stalls.mjs)
// — the phone portal's backdrop behind the 3D stall.
const PLATES = process.argv.includes("--plates");
const WINDOWS = PLATES ? JSON.parse(fs.readFileSync("scripts/stall-windows.json", "utf8")) : null;
const sheet = [];
for (const id of ids) {
  const ok = await page.evaluate(([id, dm, lm]) => {
    const v = window.__hmVendorSpots[id]; if (!v) return false;
    const fu = v.framingUnit || 1;
    // Look a touch above the eyes (the stall's awning stays in frame), level approach.
    // Character-less stalls (the souvenir tent) have no eye height: frame from the deck up.
    const point = { x: v.x, y: (v.eyeY ?? ((v.rootY ?? 0) + 0.45 * fu)) + lm * fu, z: v.z };
    const n = { x: v.approach.x, y: 0, z: v.approach.z };
    window.__hmFocusObject(point, n, v.faceDist * fu * dm);
    return true;
  }, [id, SHOT_DIST_MULT, LIFT_MULT]);
  if (!ok) { console.log(" skip", id); continue; }
  await page.waitForTimeout(4200);
  if (PLATES) {
    const win = WINDOWS.windows[id];
    const hid = await page.evaluate(([w, maxX, ex, id]) => {
      window.__hmVendorSpots?.[id]?.hide?.(true);      // the character is not a strip node
      if (!w) return 0;                                 // no window (no stall extracted): plate = the plain shot
      return window.__hmStripHide({ z: w, maxX, exclude: ex });
    }, [win, WINDOWS.maxX, WINDOWS.exclude, id]);
    await page.waitForTimeout(250);
    console.log(`  plate: hid ${hid} props`);
  }
  const canvas = await page.$("canvas");
  const box = await canvas.boundingBox();
  // Centre crop at 3:4 of the canvas height.
  const ch = Math.min(box.height, 840), cw = Math.round(ch * 0.75);
  const clip = { x: Math.round(box.x + box.width / 2 - cw / 2), y: Math.round(box.y + (box.height - ch) / 2), width: cw, height: Math.round(ch) };
  const png = await page.screenshot({ clip, type: "png" });
  const out = path.join(OUT, PLATES ? `${id}-plate.webp` : `${id}.webp`);
  await sharp(png).resize(W, H, { fit: "cover" }).webp({ quality: 82 }).toFile(out);
  sheet.push({ id, out, bytes: fs.statSync(out).size });
  console.log(` ${id}: ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  if (PLATES) await page.evaluate((id) => { window.__hmStripShowAll?.(); window.__hmVendorSpots?.[id]?.hide?.(false); }, id);
  // fly back out before the next stall so the next fly-in starts from the overview
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("hm-vendor-exit")));
  await page.waitForTimeout(400);
}
await browser.close();
// contact sheet for a quick look
const tiles = await Promise.all(sheet.map((s) => sharp(s.out).resize(200, 267).toBuffer()));
const cols = 5, rows = Math.ceil(tiles.length / cols);
const sheetPath = process.env.POSTCARD_SHEET || path.join(OUT, PLATES ? "_contact-sheet-plates.png" : "_contact-sheet.png");
await sharp({ create: { width: cols * 200, height: rows * 267, channels: 3, background: "#222" } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 200, top: Math.floor(i / cols) * 267 })))
  .png().toFile(sheetPath);
console.log("contact sheet:", sheetPath);
