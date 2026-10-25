#!/usr/bin/env node
// rcana-render-faces — screenshot every printed face to
// public/TCG/rcana/<id>/face.webp, for the Playtest 2 table and anything
// else that shows a card as a picture.
//
//   npm run dev                      # in another terminal
//   npm run rcana:faces              # all faces
//   npm run rcana:faces -- el-diablito other-id
//   npm run rcana:faces -- --base http://localhost:3001 --width 1024
//
// Then `npm run pt2:build` so the table picks the new images up.
//
// Needs Playwright (not a project dependency — a 150MB browser download is
// not something to force on every install):
//   npm i -D playwright && npx playwright install chromium
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = opt("base", "http://localhost:3000");
const WIDTH = +opt("width", 1024); // output width in px; the face is 1027 wide at source
const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--base" && args[i - 1] !== "--width");

let chromium;
try { ({ chromium } = await import("playwright")); } catch {
  console.error("playwright is not installed. Run:\n  npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}
let sharp = null;
try { sharp = (await import("sharp")).default; } catch { /* fall back to png */ }

const { RCANA_SET } = await import(path.join(root, "src/game/rcana/cardFace.js"));
const targets = ids.length ? RCANA_SET.filter((c) => ids.includes(c.id)) : RCANA_SET;
if (!targets.length) { console.error("no matching faces:", ids.join(", ")); process.exit(1); }

// Render at 744 CSS px and scale the device so the capture lands at WIDTH.
const dpr = WIDTH / 744;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1200 }, deviceScaleFactor: dpr });

// On failure, say what the page actually was rather than just "timed out".
const explain = async (url) => {
  const title = await page.title().catch(() => "?");
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
  const shot = path.join(root, "public/TCG/rcana/_last-failure.png");
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  console.error(`\nCould not find the card at ${url}\n  title: ${title}\n  body:  ${text || "(empty)"}\n  screenshot: ${path.relative(root, shot)}\n` +
    `  Is \`npm run dev\` running on ${BASE}? (pass --base for another port)`);
};

try {
  // Warm-up: next dev compiles a route's client bundle on its first request,
  // which in this app can take a minute. Pay that once, with a long timeout,
  // before the per-card loop runs on a short one.
  const first = `${BASE}/rcana-print?id=${encodeURIComponent(targets[0].id)}`;
  await page.goto(first, { waitUntil: "domcontentloaded", timeout: 180000 });
  try {
    await page.locator(".rc-stage").first().waitFor({ state: "visible", timeout: 180000 });
  } catch (e) {
    await explain(first);
    throw e;
  }

  for (const c of targets) {
    const url = `${BASE}/rcana-print?id=${encodeURIComponent(c.id)}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const stage = page.locator(".rc-stage").first();
    try {
      await stage.waitFor({ state: "visible", timeout: 30000 });
    } catch (e) {
      await explain(url);
      throw e;
    }
    // Fonts and the frame image settle after networkidle; give them a beat.
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(400);
    const dir = path.join(root, "public/TCG/rcana", c.id);
    fs.mkdirSync(dir, { recursive: true });
    const png = await stage.screenshot({ omitBackground: true, type: "png" });
    if (sharp) {
      await sharp(png).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(dir, "face.webp"));
      console.log(`✓ ${c.id} → public/TCG/rcana/${c.id}/face.webp`);
    } else {
      fs.writeFileSync(path.join(dir, "face.png"), png);
      console.log(`✓ ${c.id} → face.png (sharp unavailable; pt2-build looks for face.webp)`);
    }
  }
} finally {
  await browser.close();
}
console.log(`\n${targets.length} face(s) rendered. Now: npm run pt2:build`);
