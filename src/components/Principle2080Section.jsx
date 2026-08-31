"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import "./principle2080.css";

/* ============================================================================
   THE 20/80 PRINCIPLE — permanent liquidity program.  MOCKUP / DESIGN DRAFT.

   Every number in P2080 is placeholder copy for review; nothing here reads
   chain state yet. To make the readouts live, replace this object with a hook:
     pool.rl80 / pool.eth  ->  V2 pair getReserves()
     treasury              ->  balanceOf(treasuryAddress)
     accruedEth            ->  balanceOf(commitmentAddress)
   Pass `draft={false}` once the program is actually committed to — that drops
   the "proposal" badge and nothing else.

   The name is used two ways on purpose, and the layout leans on both:
     20% of revenue / 80% to operations   (the split bar)
     20% of revenue -> 80 ETH             (the formula)

   STRUCTURE: the default view is the claim — formula, the two readouts that
   actually move, what "qualifying revenue" means, and the price caveat. The
   mechanism that makes it credible (swap/combine/add/burn, before/after, the
   ladder, the flywheel) sits behind "How it works". Anyone who wants to audit
   the plan clicks; anyone who doesn't was never going to reach it five screens
   down. Keep the mechanism intact behind the button — it is the part that
   distinguishes this from a promise.
   ========================================================================= */

const P2080 = {
  totalSupply: 80_000_000_000,

  // Current position
  pool: { rl80: 64_000_000_000, eth: 1.0 },
  treasury: 16_000_000_000,

  // The commitment
  pct: 20,
  accruedEth: 2.14, // placeholder — progress toward the 7 ETH needed
  milestoneNeedEth: 7,

  // Milestone one
  first: {
    treasuryCommit: 8_000_000_000,
    before: { rl80: 64_000_000_000, eth: 1 },
    after: { rl80: 72_000_000_000, eth: 8 },
  },

  // Long horizon
  goalEth: 80,
  ladder: [1, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80],
};

const REVENUE = [
  "Premium site features",
  "Hail Mary Prospecting",
  "Digital experiences",
  "Permanent candles",
  "Monuments",
  "Merchandise",
  "Sponsorships",
];

const STEPS = [
  {
    n: "01",
    title: "Swap",
    body: "A calculated portion of the 7 ETH is swapped for RL80 through the existing pool.",
  },
  {
    n: "02",
    title: "Combine",
    body: "The acquired RL80 is combined with the treasury's 8B RL80 contribution.",
  },
  {
    n: "03",
    title: "Add",
    body: "Acquired RL80, treasury RL80, and remaining ETH are added back to the existing V2 pool at the correct reserve ratio.",
  },
  {
    n: "04",
    title: "Burn",
    body: "The newly created LP tokens are permanently burned.",
  },
];

/* Only the two effects that aren't restatements of the BEFORE/AFTER numbers
   sitting directly above them. A "20% -> 10% treasury" tile used to live here
   and was cut on purpose: that 20% is a share of SUPPLY, and a second unrelated
   20% in a section called The 20/80 Principle reads as the same number. */
const EFFECTS = [
  { value: "8×", label: "Permanent ETH liquidity" },
  { value: "90%", label: "Of total supply in permanent liquidity" },
];

const FLYWHEEL = [
  { label: "RL80 products & experiences", accent: "#d92db0" },
  { label: "Project revenue", accent: "#d92db0" },
  { label: "The 20/80 Principle — 20% of qualifying revenue", accent: "#d4af37" },
  { label: "Permanent RL80 liquidity", accent: "#2ad6ee" },
  { label: "A deeper, more resilient RL80 market", accent: "#2ad6ee" },
];

const CYAN = "#2ad6ee";
const GOLD = "#d4af37";
const MAGENTA = "#d92db0";

const fmtEth = (n) => Number(n).toFixed(2);
const fmtB = (n) => `${(n / 1e9) % 1 === 0 ? n / 1e9 : (n / 1e9).toFixed(1)}B`;
const pctOf = (v, max) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%`;

/* Segmented gauge. The fill paints at its true width immediately — see the
   note on .p2080-meter-fill in principle2080.css for why it is not animated. */
function Meter({ value, max, segments }) {
  const pct = pctOf(value, max);
  return (
    <div className="p2080-meter">
      <div
        className="p2080-meter-track"
        style={{ "--tick": `${100 / segments}%` }}
        role="progressbar"
        aria-valuenow={Number(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="p2080-meter-fill" style={{ "--fill": pct }} />
      </div>
      <div className="p2080-meter-pct">{pct}</div>
    </div>
  );
}

function Plaque({ accent, label, value, sub, children }) {
  return (
    <div className="p2080-plaque" style={{ "--accent": accent }}>
      <div className="p2080-plaque-label">{label}</div>
      <div className="p2080-plaque-value">{value}</div>
      {sub ? <p className="p2080-plaque-sub">{sub}</p> : null}
      {children}
    </div>
  );
}

function Pool({ tag, rl80, eth, accent, after }) {
  return (
    <div
      className={`p2080-plaque p2080-pool${after ? " p2080-pool--after" : ""}`}
      style={{ "--accent": accent }}
    >
      <div className="p2080-pool-tag">{tag}</div>
      <div className="p2080-pool-amount">~{fmtB(rl80)}</div>
      <div className="p2080-pool-unit">RL80</div>
      <div className="p2080-pool-amount p2080-pool-amount--eth">{eth} ETH</div>
    </div>
  );
}

export default function Principle2080Section({ draft = true }) {
  const ref = useRef(null);
  const moreRef = useRef(null);
  const recenterRef = useRef(false);
  const inView = useInView(ref, { amount: 0.01, margin: "200px 0px" });
  const [expanded, setExpanded] = useState(false);
  const pct = P2080.pct;
  const rest = 100 - pct;

  const toggle = () => {
    // Collapsing from deep inside the mechanism would leave the viewport
    // parked well past the section, on whatever follows it. Flag the intent
    // here and do the correction in the effect below — a rAF scheduled from
    // this handler runs BEFORE React removes the mechanism, so it measures a
    // stale layout and lands ~1000px short.
    if (expanded) recenterRef.current = true;
    setExpanded((v) => !v);
  };

  useEffect(() => {
    if (expanded || !recenterRef.current) return;
    recenterRef.current = false;
    const btn = moreRef.current;
    if (btn && btn.getBoundingClientRect().top < 0) {
      btn.scrollIntoView({ block: "center" });
    }
  }, [expanded]);

  return (
    <section
      ref={ref}
      className={`p2080${inView ? " is-revealed" : ""}`}
      aria-label="The 20/80 Principle — permanent liquidity program"
    >
      {/* ── head ─────────────────────────────────────────────────────── */}
      <div className="p2080-head">
        <div className="p2080-kicker">Permanent Liquidity Program</div>

        <h2 className="p2080-heading">The 20/80 Principle</h2>

        {draft ? <div className="p2080-status">Proposal — not yet in effect</div> : null}

        {/* The entire program in one block, for readers who never scroll. */}
        <div className="p2080-thesis">
          <div className="p2080-formula">
            <span className="p2080-formula-share">{pct}%</span>
            <span className="p2080-formula-arrow" aria-hidden="true">
              →
            </span>
            <span className="p2080-formula-goal">{P2080.goalEth} ETH</span>
          </div>

          <p className="p2080-thesis-body">
            <strong>{pct}% of qualifying RL80 revenue</strong> is committed to building permanent
            liquidity, toward a long-term target of <strong>{P2080.goalEth} ETH</strong>.
          </p>

          <div className="p2080-milestone">
            <div className="p2080-milestone-label">
              First Milestone: {P2080.first.after.eth} ETH
            </div>
            <p className="p2080-thesis-body" style={{ marginTop: 0 }}>
              At that milestone, the RL80 treasury commits an additional{" "}
              <strong>8 billion RL80</strong> to permanent liquidity. The {pct}% commitment continues
              until permanent liquidity reaches <strong>{P2080.goalEth} ETH</strong>.
            </p>
          </div>

          <p className="p2080-thesis-closer">As RL80 grows, its liquidity grows with it.</p>
        </div>
      </div>

      {/* ── public transparency — only the two figures that actually move ── */}
      <div className="p2080-rule" style={{ "--accent": GOLD }}>
        <span>Public Transparency</span>
      </div>

      <div className="p2080-ledger">
        <Plaque
          accent={CYAN}
          label="Permanent Liquidity"
          value={`${fmtEth(P2080.pool.eth)} / ${P2080.goalEth} ETH`}
          sub="The long-term objective. LP tokens burned on every addition."
        >
          <Meter value={P2080.pool.eth} max={P2080.goalEth} segments={40} />
        </Plaque>

        <Plaque
          accent={GOLD}
          label="Next Milestone"
          value={`${fmtEth(P2080.accruedEth)} / ${P2080.milestoneNeedEth} ETH`}
          sub={`Accrued toward the ${P2080.first.after.eth} ETH pool milestone.`}
        >
          <Meter value={P2080.accruedEth} max={P2080.milestoneNeedEth} segments={28} />
        </Plaque>
      </div>

      <p className="p2080-ledger-note">
        All liquidity additions and LP burns are publicly verifiable on-chain.
      </p>

      {/* ── qualifying revenue ───────────────────────────────────────── */}
      <div className="p2080-rule" style={{ "--accent": MAGENTA }}>
        <span>Qualifying Revenue</span>
      </div>

      <p className="p2080-body" style={{ "--accent": MAGENTA, textAlign: "center" }}>
        Revenue comes from across the RL80 ecosystem:
      </p>

      <ul className="p2080-chips">
        {REVENUE.map((r) => (
          <li key={r} className="p2080-chip">
            {r}
          </li>
        ))}
      </ul>

      <div className="p2080-plaque p2080-split">
        <div className="p2080-plaque-label">Qualifying Revenue Split</div>
        <div className="p2080-split-bar">
          <div className="p2080-split-share" style={{ "--fill": `${pct}%` }}>
            {pct}%
          </div>
          <div className="p2080-split-rest">
            {rest}% · Operations · Development · Taxes · Reinvestment · Profit
          </div>
        </div>
        <p className="p2080-purpose">
          The {pct}% has one purpose: build permanent RL80 liquidity
        </p>
      </div>

      <p className="p2080-caveat">
        Deeper liquidity would change the AMM price substantially, but{" "}
        <strong>price appreciation is not the purpose or promise of the program.</strong> The stated
        objective is deeper, stronger, permanent liquidity.
      </p>

      {/* ── the mechanism, on request ────────────────────────────────── */}
      <button
        type="button"
        ref={moreRef}
        className="p2080-more"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls="p2080-mechanism"
      >
        <span>{expanded ? "Hide the mechanism" : "How it works"}</span>
        <span className="p2080-more-caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {expanded ? (
        <div id="p2080-mechanism">
          {/* ── first milestone ──────────────────────────────────────── */}
          <div className="p2080-rule" style={{ "--accent": CYAN }}>
            <span>First Milestone &mdash; 8 ETH</span>
          </div>

          <p className="p2080-body" style={{ "--accent": CYAN }}>
            The existing pool contains approximately <strong>1 ETH</strong>, so the first objective is
            to accumulate an additional <strong>7 ETH</strong>. When permanent liquidity reaches that
            point, the treasury contributes <strong>8 billion RL80</strong> &mdash; 10% of the entire
            token supply. Because a V2 pool must receive assets at the appropriate reserve ratio, the
            transaction would be executed approximately as follows:
          </p>

          <ol className="p2080-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="p2080-plaque p2080-step">
                <span className="p2080-step-n">{s.n}</span>
                <span>
                  <span className="p2080-step-title">{s.title}</span>
                  <span className="p2080-step-body">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="p2080-pools">
            <Pool
              tag="Before"
              rl80={P2080.first.before.rl80}
              eth={P2080.first.before.eth}
              accent="#8a8fa3"
            />
            <div className="p2080-pools-arrow" aria-hidden="true">
              ▶
            </div>
            <Pool
              tag="After"
              rl80={P2080.first.after.rl80}
              eth={P2080.first.after.eth}
              accent={CYAN}
              after
            />
          </div>

          <ul className="p2080-effects">
            {EFFECTS.map((e) => (
              <li key={e.label} className="p2080-plaque">
                <span className="p2080-effect-value">{e.value}</span>
                <span className="p2080-effect-label">{e.label}</span>
              </li>
            ))}
          </ul>

          {/* ── long-term goal ───────────────────────────────────────── */}
          <div className="p2080-rule" style={{ "--accent": CYAN }}>
            <span>Long-Term Goal &mdash; 80 ETH</span>
          </div>

          <p className="p2080-body" style={{ "--accent": GOLD }}>
            Reaching 8 ETH is the first major milestone, not the end of the program. The commitment
            continues through successive liquidity additions until permanent liquidity reaches{" "}
            <strong>{P2080.goalEth} ETH</strong>. Future additions would not necessarily require
            further treasury contributions &mdash; a portion of accumulated ETH can be swapped for
            RL80 as needed to establish the correct ratio before adding both sides back. The
            remaining <strong>8B RL80 treasury reserve</strong> therefore stays available for future
            strategic purposes.
          </p>

          <ol className="p2080-ladder">
            {P2080.ladder.map((m, i) => {
              const done = m <= P2080.pool.eth;
              const next = m === P2080.first.after.eth;
              return (
                <li
                  key={m}
                  className={`p2080-rung${done ? " p2080-rung--done" : ""}${
                    next ? " p2080-rung--next" : ""
                  }`}
                >
                  {i > 0 ? (
                    <span className="p2080-rung-arrow" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                  <span className="p2080-rung-mark">{m}</span>
                </li>
              );
            })}
          </ol>

          <p className="p2080-ladder-key">
            ETH in permanent liquidity · <i className="k-now">■</i> current ·{" "}
            <i className="k-next">■</i> next milestone
          </p>

          {/* ── the economic model ───────────────────────────────────── */}
          <div className="p2080-rule" style={{ "--accent": MAGENTA }}>
            <span>The Economic Model</span>
          </div>

          <ol className="p2080-flywheel">
            {FLYWHEEL.map((f, i) => (
              <React.Fragment key={f.label}>
                <li style={{ "--accent": f.accent }}>{f.label}</li>
                {i < FLYWHEEL.length - 1 ? (
                  <li className="p2080-flywheel-arrow" aria-hidden="true">
                    ↓
                  </li>
                ) : null}
              </React.Fragment>
            ))}
          </ol>

          <p className="p2080-body" style={{ "--accent": CYAN }}>
            This lets RL80 operate as a sustainable project rather than directing all revenue toward
            the token. Customers can buy products, memberships, experiences, or merchandise normally
            &mdash; <strong>they do not need to buy RL80, or interact with crypto at all.</strong>{" "}
            RL80 earns ordinary revenue, keeps {rest}% to operate the project, and voluntarily
            commits the remaining {pct}% to strengthening the token&rsquo;s permanent market
            infrastructure.
          </p>
        </div>
      ) : null}
    </section>
  );
}
