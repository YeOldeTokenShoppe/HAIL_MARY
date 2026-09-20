// Fixture test for the brief's parsing, run with:
//
//   node scripts/lt-news-brief.test.mjs
//
// Every upstream the brief reads is replaced with a recorded response, so this
// exercises the CSV and feed parsing, the week-over-week arithmetic, and the
// difference between a source that failed and one that is switched off —
// without touching the network.
//
// WHAT THIS DOES NOT TELL YOU: whether the endpoints are still there. The
// fixtures were written from the documented response shapes, not captured from
// live calls. `node scripts/lt-news-brief.mjs --check-sources` is the only
// thing that answers that question, and it needs a real connection.

import { resolve } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── fixtures ──────────────────────────────────────────────────────────────

// FRED publishes a market holiday as "." rather than an empty cell, which is
// the one thing a naive Number() gets wrong. Row two is that case.
const FRED_RATES = `observation_date,DGS3MO,DGS2,DGS10,DGS30
2026-09-14,4.05,3.62,4.12,4.75
2026-09-15,.,.,.,.
2026-09-16,4.06,3.60,4.15,4.78
2026-09-17,4.04,3.58,4.18,4.80
`;

const FRED_INDEX = `observation_date,SP500,NASDAQCOM,DJIA
2026-09-14,6412.11,21980.44,45011.2
2026-09-15,.,.,.
2026-09-17,6455.02,22140.10,45220.7
`;

const FRED_OIL = `observation_date,DCOILWTICO
2026-09-14,70.11
2026-09-17,71.44
`;

// Stooq answers a rate limit with prose and HTTP 200, not an error status.
const STOOQ_RATE_LIMITED = "Exceeded the daily hits limit";

const rss = (tag) => `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[${tag} headline one]]></title><link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>${tag} headline two</title><link>https://example.com/2</link><pubDate>${new Date().toUTCString()}</pubDate></item>
</channel></rss>`;

const called = [];

function install() {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    called.push(`${opts.method || "GET"} ${u.split("?")[0]}`);
    const ok = (body, json) => ({
      ok: true,
      status: 200,
      text: async () => body,
      json: async () => json ?? JSON.parse(body),
    });

    if (u.includes("fredgraph.csv")) {
      if (u.includes("DGS10")) return ok(FRED_RATES);
      if (u.includes("SP500")) return ok(FRED_INDEX);
      if (u.includes("DCOILWTICO")) return ok(FRED_OIL);
    }
    if (u.includes("stooq.com")) return ok(STOOQ_RATE_LIMITED);
    if (u.includes("federalreserve.gov")) return ok(rss("fed"));
    if (u.includes("cnbc.com") || u.includes("yahoo")) return ok(rss("macro"));
    if (/coindesk|decrypt|cointelegraph|theblock/.test(u)) return ok(rss("crypto"));
    if (u.includes("news.google.com")) return ok(rss("collectibles"));
    if (u.includes("coingecko")) {
      return ok("", { coins: [{ item: { name: "Foo", symbol: "foo", market_cap_rank: 9 } }] });
    }
    if (u.includes("alternative.me")) {
      return ok("", { data: [{ value: "54", value_classification: "Neutral", timestamp: "1789000000" }] });
    }
    if (u.includes("reddit.com/api/v1/access_token")) return ok("", { access_token: "tok" });
    if (u.includes("oauth.reddit.com")) {
      return ok("", {
        data: {
          children: [
            { data: { title: "a post", permalink: "/r/x/1", score: 900, num_comments: 40, created_utc: Date.now() / 1000 } },
          ],
        },
      });
    }
    if (u.includes("polymarket")) return ok("", []);
    if (u.includes("kalshi")) return ok("", { markets: [] });
    return { ok: false, status: 404, text: async () => "", json: async () => ({}) };
  };
}

// ── harness ───────────────────────────────────────────────────────────────

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
    failures += 1;
  }
}

async function runBrief(env) {
  const dir = await mkdtemp(join(tmpdir(), "lt-news-"));
  const out = join(dir, "brief.json");
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  const script = resolve(import.meta.dirname, "lt-news-brief.mjs");
  const argv = process.argv;
  process.argv = [argv[0], script, "--out", out, "--week", "2026-W38"];
  // A fresh query string gives each run its own module instance, so the cached
  // Reddit token from one run cannot leak into the next. It also stops the
  // script's run-when-invoked-directly guard from firing main() a second time.
  const mod = await import(`${script}?run=${Date.now()}`);
  await mod.main();
  process.argv = argv;

  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const brief = JSON.parse(await readFile(out, "utf8"));
  await rm(dir, { recursive: true, force: true });
  return brief;
}

// ── the tests ─────────────────────────────────────────────────────────────

install();

console.log("\nNo credentials set:");
const bare = await runBrief({
  REDDIT_CLIENT_ID: undefined,
  REDDIT_CLIENT_SECRET: undefined,
  CMC_PRO_API_KEY: undefined,
});

const t = bare.signals.macro.treasuryYields;
check("the yield curve comes from FRED", t.via, "fred.stlouisfed.org");
check("the market-holiday row is dropped", t.series.map((r) => r.at), [
  "2026-09-14",
  "2026-09-16",
  "2026-09-17",
]);
check("the ten-year's move is the week's, not the day's", t.tenYearDelta, 0.06);
check("2s10s is the spread at the close", t.spread2s10s, 0.6);

const idx = bare.signals.markets.indices;
check("three indices", idx.map((i) => i.symbol), ["SP500", "NASDAQCOM", "DJIA"]);
check("the week's move is a percentage", idx[0].weekChangePct, 0.67);

check(
  "oil survives gold's rate limit",
  bare.signals.markets.commodities.map((c) => c.label),
  ["WTI crude"],
);

check("four crypto desks, two items each", bare.signals.crypto.news.length, 8);
check("collectibles do not need Reddit", bare.signals.collectibles.chatter.length, 6);
check("Reddit reports itself switched off, not broken", bare.signals.crypto.reddit, null);
check(
  "and says why, in degraded",
  bare.degraded.find((d) => d.source === "crypto/reddit"),
  { source: "crypto/reddit", skipped: true, error: "no REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET" },
);
check("nothing actually failed", bare.degraded.filter((d) => !d.skipped), []);

console.log("\nReddit credentials set:");
called.length = 0;
const withReddit = await runBrief({
  REDDIT_CLIENT_ID: "id",
  REDDIT_CLIENT_SECRET: "secret",
  CMC_PRO_API_KEY: undefined,
});

check(
  "the three crypto subreddits are read",
  withReddit.signals.crypto.reddit.map((p) => p.outlet),
  ["r/bitcoin", "r/ethereum", "r/cryptocurrency"],
);
check(
  "through the OAuth host, never www",
  called.some((c) => c.includes("oauth.reddit.com")) && !called.some((c) => c.includes("www.reddit.com/r/")),
  true,
);
check(
  "one token for the whole run",
  called.filter((c) => c.includes("access_token")).length,
  1,
);
check(
  "and the collectibles beat picks up the subreddits too",
  withReddit.signals.collectibles.chatter.length,
  9,
);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
