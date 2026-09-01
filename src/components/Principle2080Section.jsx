"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import Image from "next/image";
import dynamic from "next/dynamic";
import { RL80_ADDRESS } from "@/lib/contracts";
import DropInTitle from "@/components/DropInTitle";
import "./principle2080.css";

const BlueNeonFrame = dynamic(() => import("@/components/BlueNeonFrame"), { ssr: false });

/* ============================================================================
   LIQUID80 — The 20/80 Mechanism permanent liquidity program. DESIGN DRAFT.

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
  accruedEth: 0, // no reserve is currently designated toward the first addition
  milestoneNeedEth: 7,

  // Milestone one
  first: {
    treasuryCommit: 8_000_000_000,
    before: { rl80: 64_000_000_000, eth: 1 },
    after: { rl80: 72_000_000_000, eth: 8 },
  },

  // Long horizon
  goalEth: 80,
  ladder: [1, 8, 80],
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

const TRANSPARENCY_LINKS = [
  {
    label: "View live pool",
    href: "https://dexscreener.com/base/0x40d827acdbefd8ef46953e2b1ac87b8697b82203",
  },
  {
    label: "View RL80 on BaseScan",
    href: `https://basescan.org/token/${RL80_ADDRESS}`,
  },
];

const STEPS = [
  { n: "01", title: "Swap" },
  { n: "02", title: "Combine" },
  { n: "03", title: "Add" },
  { n: "04", title: "Burn" },
];

/* Only the two effects that aren't restatements of the BEFORE/AFTER numbers
   sitting directly above them. A "20% -> 10% treasury" tile used to live here
   and was cut on purpose: that 20% is a share of SUPPLY, and a second unrelated
   20% in a section called The 20/80 Mechanism reads as the same number. */
const EFFECTS = [
  { value: "8×", label: "Permanent ETH liquidity" },
  { value: "90%", label: "Of total supply in permanent liquidity" },
];

const FLYWHEEL = [
  { label: "RL80 products & experiences", accent: "#d92db0" },
  { label: "Project revenue", accent: "#d92db0" },
  { label: "LIQUID80 — 20% of qualifying revenue", accent: "#d4af37" },
  { label: "Permanent RL80 liquidity", accent: "#2ad6ee" },
  { label: "A deeper, more resilient RL80 market", accent: "#2ad6ee" },
];

const CYAN = "#2ad6ee";
const GOLD = "#d4af37";
const MAGENTA = "#d92db0";
const fmtEth = (n) => Number(n).toFixed(2);
const pctOf = (v, max) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%`;

/* Segmented gauge. The fill paints at its true width immediately — see the
   note on .p2080-meter-fill in principle2080.css for why it is not animated. */
function Meter({ value, max, segments, label }) {
  const pct = pctOf(value, max);
  return (
    <div className="p2080-meter">
      <div
        className="p2080-meter-track"
        style={{ "--tick": `${100 / segments}%` }}
        role="progressbar"
        aria-label={label}
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

function LiquidityLedger({ draft }) {
  return (
    <div className="p2080-overview-data p2080-overview-data--expanded">
      <div className="p2080-rule" style={{ "--accent": GOLD }}>
        <span>On-Chain Ledger</span>
      </div>

      <div className="p2080-ledger">
        <Plaque
          accent={CYAN}
          label="Current Pool"
          value={`${fmtEth(P2080.pool.eth)} ETH`}
          sub={
            draft
              ? `Permanent liquidity today. Deployment goal: ${P2080.goalEth} ETH.`
              : `Permanent liquidity. Deployment goal: ${P2080.goalEth} ETH.`
          }
        >
          <Meter
            value={P2080.pool.eth}
            max={P2080.goalEth}
            segments={40}
            label={`${P2080.pool.eth} of the ${P2080.goalEth} ETH cumulative deployment goal`}
          />
        </Plaque>

        <Plaque
          accent={GOLD}
          label="First Target"
          value={
            draft
              ? `${P2080.first.after.eth} ETH Pool`
              : `${fmtEth(P2080.accruedEth)} ETH Reserved`
          }
          sub={
            draft
              ? `${P2080.pool.eth} ETH is already permanent. The additional ${P2080.milestoneNeedEth} ETH is expected primarily from qualifying website commerce.`
              : `Reserved for the next addition; not yet in the pool.`
          }
        >
          {draft ? (
            <div className="p2080-funding-status">Commerce-funded · no public raise underway</div>
          ) : (
            <Meter
              value={P2080.accruedEth}
              max={P2080.milestoneNeedEth}
              segments={28}
              label={`${P2080.accruedEth} of ${P2080.milestoneNeedEth} ETH reserved for the first liquidity addition`}
            />
          )}
        </Plaque>
      </div>

      <div className="p2080-transparency-links" aria-label="On-chain transparency links">
        {TRANSPARENCY_LINKS.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
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
      aria-label="Liquid80 — The 20/80 Rule"
    >
      <div className="p2080-overview">
        <div className="p2080-liquidity-visual">
          <BlueNeonFrame active={inView} />

          <div className="p2080-angel" aria-hidden="true">
            <div className="p2080-angel-wing-stage p2080-angel-wing-stage--left">
              <Image
                className="p2080-angel-wing p2080-angel-wing--left"
                src="/shoulder-layers/angel/HydrationAngelLeftWing.webp"
                alt=""
                width={600}
                height={687}
                sizes="(max-width: 900px) min(82vw, 430px), 420px"
              />
            </div>

            <div className="p2080-angel-wing-stage p2080-angel-wing-stage--right">
              <Image
                className="p2080-angel-wing p2080-angel-wing--right"
                src="/shoulder-layers/angel/HydrationAngelRightWing.webp"
                alt=""
                width={600}
                height={687}
                sizes="(max-width: 900px) min(82vw, 430px), 420px"
              />
            </div>

            <Image
              className="p2080-angel-body"
              src="/shoulder-layers/angel/HydrationAngelNoWings.webp"
              alt=""
              width={600}
              height={650}
              sizes="(max-width: 900px) min(82vw, 430px), 420px"
            />

            <span className="p2080-angel-water-shimmer" />
          </div>

          <div
            className="p2080-reservoir"
            role="img"
            aria-label={`${P2080.pool.eth} ETH of the ${P2080.first.after.eth} ETH first pool milestone is currently in permanent liquidity`}
          >
            <div className="p2080-reservoir-goal">
              <span>First pool</span>
              <strong>{P2080.first.after.eth} ETH</strong>
            </div>
            <div className="p2080-reservoir-tube">
              <div className="p2080-reservoir-ticks" aria-hidden="true" />
              <div
                className="p2080-reservoir-water"
                style={{ "--level": `${(P2080.pool.eth / P2080.first.after.eth) * 100}%` }}
              >
                <span aria-hidden="true" />
              </div>
            </div>
            <div className="p2080-reservoir-readout">
              <span><strong>{fmtEth(P2080.pool.eth)} ETH</strong> in the pool</span>
              <span><strong>{P2080.milestoneNeedEth} ETH</strong> to go</span>
            </div>
          </div>
        </div>

        <div className="p2080-head">
          <div className="p2080-title">
            <DropInTitle
              lines={["OUR", "LADY", "GIVE ETH!"]}
              colors={[CYAN, "#f4e4c1", GOLD]}
              fontSize={{ mobile: "2.7rem", desktop: "3.4rem" }}
              isMobile={typeof window !== "undefined" && window.innerWidth <= 900}
              triggerAnimation={inView}
              instanceId="liquid80-heading"
            />
            <div className="p2080-heading-subtitle">The 20/80 Liquid80 Protocol</div>
          </div>

          <div className="p2080-kicker">Permanent Liquidity Program</div>

          {/* {draft ? <div className="p2080-status">Proposal — not yet in effect</div> : null} */}

          <div className="p2080-thesis">
            <div className="p2080-formula">
              <span className="p2080-formula-share">{pct}%</span>
              <span className="p2080-formula-arrow" aria-hidden="true">
                →
              </span>
              <span className="p2080-formula-goal">{P2080.goalEth} ETH</span>
            </div>

            <p className="p2080-thesis-body">
              <strong>{pct}% of qualifying RL80 commerce revenue</strong> funds balanced liquidity
              additions, toward cumulatively deploying <strong>{P2080.goalEth} ETH</strong> into
              permanently locked liquidity.
            </p>
          </div>

          <button
            type="button"
            ref={moreRef}
            className="p2080-more"
            onClick={toggle}
            aria-expanded={expanded}
            aria-controls="p2080-mechanism"
          >
            <span>{expanded ? "Close" : "Learn more"}</span>
            <span className="p2080-more-caret" aria-hidden="true">
              ▼
            </span>
          </button>
        </div>

      </div>

      {/* ── the full policy, on request ──────────────────────────────── */}
      {expanded ? (
        <div id="p2080-mechanism" className="p2080-mechanism-panel">
          <LiquidityLedger draft={draft} />

          <div className="p2080-policy-grid">
            <section className="p2080-policy-block" style={{ "--accent": MAGENTA }}>
              <div className="p2080-rule" style={{ "--accent": MAGENTA }}>
                <span>Qualifying Revenue</span>
              </div>

              <ul className="p2080-chips">
                {REVENUE.map((r) => (
                  <li key={r} className="p2080-chip">{r}</li>
                ))}
              </ul>

              <div className="p2080-plaque p2080-split">
                <div className="p2080-plaque-label">Revenue Split</div>
                <div className="p2080-split-bar">
                  <div className="p2080-split-share" style={{ "--fill": `${pct}%` }}>{pct}%</div>
                  <div className="p2080-split-rest">{rest}% · Operations and growth</div>
                </div>
                <p className="p2080-purpose">{pct}% builds permanent RL80 liquidity.</p>
              </div>

              <p className="p2080-caveat">
                <strong>Price appreciation is not the program&rsquo;s purpose or promise.</strong>{" "}
                The objective is deeper permanent liquidity.
              </p>
            </section>

            <section className="p2080-policy-block" style={{ "--accent": CYAN }}>
              <div className="p2080-rule" style={{ "--accent": CYAN }}>
                <span>First Addition &mdash; 8 ETH</span>
              </div>

              <p className="p2080-body" style={{ "--accent": CYAN }}>
                Build the first <strong>{P2080.first.after.eth} ETH pool</strong> from the current{" "}
                {P2080.pool.eth} ETH, commerce-funded ETH, and up to <strong>8B treasury RL80</strong>.
                Part of the ETH may acquire RL80 from circulation before balanced liquidity is added
                and its LP tokens are burned.
              </p>

              <ol className="p2080-process" aria-label="Liquidity addition sequence">
                {STEPS.map((s) => (
                  <li key={s.n}>
                    <span className="p2080-step-n">{s.n}</span>
                    <span className="p2080-step-title">{s.title}</span>
                  </li>
                ))}
              </ol>

              <ul className="p2080-effects">
                {EFFECTS.map((e) => (
                  <li key={e.label} className="p2080-plaque">
                    <span className="p2080-effect-value">{e.value}</span>
                    <span className="p2080-effect-label">{e.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="p2080-policy-block" style={{ "--accent": GOLD }}>
              <div className="p2080-rule" style={{ "--accent": GOLD }}>
                <span>Long-Term Deployment Goal &mdash; 80 ETH</span>
              </div>

              <p className="p2080-body" style={{ "--accent": GOLD }}>
                Future rounds can use part of each commerce allocation to acquire RL80 from
                circulation, pair it with the remaining ETH, add balanced liquidity, and burn the
                LP tokens&mdash;without requiring new treasury tokens.
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
                      {i > 0 ? <span className="p2080-rung-arrow" aria-hidden="true">→</span> : null}
                      <span className="p2080-rung-mark">{m}</span>
                    </li>
                  );
                })}
              </ol>

              <p className="p2080-ladder-key">
                Cumulative ETH deployed. Burned LP cannot be withdrawn; pool reserves remain
                tradable.
              </p>
            </section>

            <section className="p2080-policy-block" style={{ "--accent": MAGENTA }}>
              <div className="p2080-rule" style={{ "--accent": MAGENTA }}>
                <span>Economic Model</span>
              </div>

              <ol className="p2080-flywheel">
                {FLYWHEEL.map((f, i) => (
                  <React.Fragment key={f.label}>
                    <li style={{ "--accent": f.accent }}>{f.label}</li>
                    {i < FLYWHEEL.length - 1 ? (
                      <li className="p2080-flywheel-arrow" aria-hidden="true">↓</li>
                    ) : null}
                  </React.Fragment>
                ))}
              </ol>

              <p className="p2080-body" style={{ "--accent": CYAN }}>
                Customers need not hold RL80. The project keeps {rest}% to operate and commits{" "}
                {pct}% to permanent market infrastructure.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
