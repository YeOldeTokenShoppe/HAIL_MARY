// Start the app with npm run dev, then run:
// node scripts/lt-tv-reload.browser.mjs [http://localhost:3000]
// Exercises the real page/scene handoff: URL parsing alone cannot catch a
// preloader waiting for a model that this route never mounts.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push({ url: page.url(), stack: error.stack || error.message });
    console.error(error.stack || error.message);
  });
  // This regression concerns model readiness, not the external voice SDK.
  // Keep voices unavailable throughout, including its shared lobby embed,
  // so offscreen avatar renderers don't exhaust headless WebGL resources.
  await page.route("**/sitepal-portal.html?*", (route) => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Voice service unavailable</title>",
  }));
  await page.route("**://*.oddcast.com/**", (route) => route.abort());
  // Leave the SDK entry point callable but never signal avatar readiness.
  await page.addInitScript(() => { window.AC_Vhost_Embed = () => {}; });

  async function ready(studio) {
    // Require a mounted scene as well as an absent loader: a blank page
    // would otherwise falsely pass. Voices need not be available to enter.
    const deadline = Date.now() + 60000;
    let state;
    do {
      state = await page.evaluate(() => ({
        url: location.href,
        loader: [...document.querySelectorAll(".coin-loading-screen")]
          .some((loader) => getComputedStyle(loader).opacity !== "0"),
        studio: typeof window.__talkShowPlay === "function",
        // SitePal can insert its hidden canvas before the studio's canvas.
        visibleCanvas: [...document.querySelectorAll("canvas")]
          .some((canvas) => canvas.checkVisibility({ checkVisibilityCSS: true })),
      }));
      if (state.visibleCanvas && !state.loader && (!studio || state.studio)) return;
      // Poll from Node so the scene's own frame/timer queue can settle.
      await page.waitForTimeout(1000);
    } while (Date.now() < deadline);
    assert.fail(`Page did not become ready: ${JSON.stringify(state)}`);
  }

  await page.goto(`${origin}/trade?lttv=news-01`, { waitUntil: "domcontentloaded" });
  await ready(true);
  assert.equal(new URL(page.url()).searchParams.get("lttv"), "news-01");
  console.log("PASS: cold episode link reveals the studio");

  // An unavailable voice service must only disable Play, not hide the set.
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(true);
  assert.equal(new URL(page.url()).searchParams.get("lttv"), "news-01");
  console.log("PASS: reload clears the preloader even while voices are unavailable");

  await page.goto(`${origin}/trade?lttv=news`, { waitUntil: "domcontentloaded" });
  await ready(true);
  await page.getByRole("button", { name: "Enter studio" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("lttv"), "news");
  console.log("PASS: direct lineup link loads");

  await page.goto(`${origin}/trade`, { waitUntil: "domcontentloaded" });
  await ready(false);
  assert.equal(new URL(page.url()).searchParams.get("lttv"), null);
  console.log("PASS: ordinary /trade still loads");
  assert.deepEqual(errors, [], "No uncaught page errors");
} finally {
  await browser.close();
}
