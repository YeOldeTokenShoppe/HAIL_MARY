#!/usr/bin/env node
// Exports the live Artifact template as PNGs with transparent art windows.
// npm run rcana:artifact-templates -- --base http://localhost:3000 --width 1024
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const base = option("base", "http://localhost:3000");
const width = Number(option("width", 1024));
if (!Number.isFinite(width) || width < 256 || width > 4096) throw new Error("--width must be between 256 and 4096");
const output = path.join(root, "public", "TCG", "frames");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 800, height: 1200 },
    deviceScaleFactor: width / 744,
    reducedMotion: "reduce",
  });
  for (const subtype of ["remedy", "grace", "relic"]) {
    const url = new URL("/rcana-print", base);
    url.searchParams.set("template", "artifact");
    url.searchParams.set("subtype", subtype);
    await page.goto(url.href, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator(".rc-artifact-header").waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    await page.addStyleTag({ content: "html,body{background:transparent !important}" });
    const destination = path.join(output, `artifact-template-${subtype}.png`);
    await page.locator(".rc-stage").screenshot({ path: destination, omitBackground: true });
    // Preserve previously shared download links to the generic template.
    if (subtype === "relic") fs.copyFileSync(destination, path.join(output, "artifact-template-artifact.png"));
    console.log(`Exported ${path.relative(root, destination)}`);
  }
} finally {
  await browser.close();
}
