"use client";

import { useState, useEffect, useRef } from "react";
import { fetchLatestBlockNumber } from "@/lib/fetchBlockHash";

// ── Anchor-as-event ──────────────────────────────────────────────────────────
// Turns the provable-fairness anchor into public theater. Three states, driven
// entirely by the public oilGame/settings fields (no secrets touched):
//
//   1. No commitment yet        → "THE MAP DOES NOT EXIST YET" (the trust line)
//   2. Committed, hash pending  → live countdown to the anchor block (Base ≈2s
//                                 blocks; polls the real block height every 30s
//                                 through the CDP RPC lane, ticks locally
//                                 between polls)
//   3. Anchored                 → "THE BLOCK HAS SPOKEN" + basescan link
//
// `compact` renders a single-line variant for the field's pre-season panel;
// the default is the full lobby section.

const BASE_BLOCK_SECONDS = 2;
const POLL_MS = 30000;

function formatEta(seconds) {
  if (seconds <= 0) return "any moment now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `~${d}d ${h}h`;
  if (h > 0) return `~${h}h ${m}m`;
  if (m > 0) return `~${m}m ${String(s).padStart(2, "0")}s`;
  return `~${s}s`;
}

const truncHash = (h) => (h && h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

// Live ETA to the anchor block. Returns null until the first poll resolves;
// returns {blocksLeft, etaSeconds} after (blocksLeft <= 0 ⇒ mined, hash pending).
function useAnchorEta(anchorBlock, active) {
  const [eta, setEta] = useState(null);
  const baseRef = useRef(null); // { block, atMs } from the last successful poll

  useEffect(() => {
    if (!active || anchorBlock == null) { setEta(null); baseRef.current = null; return; }
    let cancelled = false;

    const compute = () => {
      const b = baseRef.current;
      if (!b) return;
      const elapsed = (Date.now() - b.atMs) / 1000;
      const estCurrent = b.block + elapsed / BASE_BLOCK_SECONDS;
      const blocksLeft = Math.ceil(anchorBlock - estCurrent);
      setEta({ blocksLeft, etaSeconds: Math.max(0, blocksLeft * BASE_BLOCK_SECONDS) });
    };

    const poll = async () => {
      try {
        const latest = await fetchLatestBlockNumber();
        if (cancelled) return;
        baseRef.current = { block: latest, atMs: Date.now() };
        compute();
      } catch {
        /* RPC hiccup — keep estimating from the last base */
      }
    };

    poll();
    const pollId = setInterval(poll, POLL_MS);
    const tickId = setInterval(compute, 1000);
    return () => { cancelled = true; clearInterval(pollId); clearInterval(tickId); };
  }, [anchorBlock, active]);

  return eta;
}

export default function OilAnchorEvent({
  seedCommitment,
  anchorBlock,
  anchorBlockHash,
  theme,
  compact = false,
  isMobile = false,
}) {
  const committed = !!seedCommitment && anchorBlock != null;
  const anchored = !!anchorBlockHash;
  const counting = committed && !anchored;
  const eta = useAnchorEta(anchorBlock, counting);
  const mined = counting && eta != null && eta.blocksLeft <= 0;

  const mono = "'Share Tech Mono', monospace";
  const gold = theme?.gold || "#d4a854";
  const muted = theme?.muted || "#b8a890";
  const text = theme?.text || "#e8dcc8";
  const green = theme?.green || "#5a8a3a";

  // ── Compact (field pre-season panel) ───────────────────────────────────────
  if (compact) {
    return (
      <div style={{ fontSize: 9, letterSpacing: "0.06em", color: muted, textAlign: "center", maxWidth: 250, lineHeight: 1.5, fontFamily: mono }}>
        {anchored ? (
          <>map locked by Base block #{anchorBlock} — nobody could predict it, anyone can verify it</>
        ) : counting ? (
          mined ? (
            <>block #{anchorBlock} is mined — the map locks when the season opens</>
          ) : (
            <>the map doesn&apos;t exist yet — Base block <span style={{ color: gold }}>#{anchorBlock}</span> writes it {eta ? <span style={{ color: gold }}>{formatEta(eta.etaSeconds)}</span> : "soon"}</>
          )
        ) : (
          <>the map doesn&apos;t exist yet — it locks to a future Base block before drilling starts. Nobody knows where the Lyquid80 is. Not even us.</>
        )}
      </div>
    );
  }

  // ── Full section (registration lobby) ──────────────────────────────────────
  return (
    <div style={{
      marginBottom: 24,
      padding: isMobile ? 16 : 20,
      border: `1px solid ${anchored ? `${green}55` : `${gold}44`}`,
      borderRadius: 4,
      background: "rgba(20, 12, 28, 0.72)",
      backdropFilter: "blur(24px) saturate(1.2)",
      WebkitBackdropFilter: "blur(24px) saturate(1.2)",
      color: text,
      textAlign: "center",
      fontFamily: mono,
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.2em", color: muted, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${theme?.border || "rgba(212,168,84,0.25)"}` }}>
        PROVABLY FAIR
      </div>

      {anchored ? (
        <>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, letterSpacing: "0.1em", color: green }}>
            THE BLOCK HAS SPOKEN
          </div>
          <div style={{ fontSize: 11, color: text, marginTop: 8, lineHeight: 1.6 }}>
            The map was written by Base block <span style={{ color: gold, fontWeight: 700 }}>#{anchorBlock}</span> — a block nobody could predict, not even us.
            First-come claims are closed; the field is set.
          </div>
          <a
            href={`https://basescan.org/block/${anchorBlock}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: 10, fontSize: 10, color: gold, letterSpacing: "0.08em" }}
          >
            {truncHash(anchorBlockHash)} — verify on BaseScan →
          </a>
        </>
      ) : counting ? (
        <>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, letterSpacing: "0.08em", color: gold }}>
            THE MAP DOES NOT EXIST YET
          </div>
          <div style={{ fontSize: 11, color: text, marginTop: 8, lineHeight: 1.6, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            Nobody knows where the Lyquid80 is buried. <em>Not even us.</em> The map
            is written by Base block <span style={{ color: gold, fontWeight: 700 }}>#{anchorBlock}</span> the
            moment it&apos;s mined — pick your plot before the chain decides what&apos;s under it.
          </div>
          <div style={{ marginTop: 12, fontSize: isMobile ? 20 : 26, fontWeight: 700, letterSpacing: "0.08em", color: gold }}>
            {mined ? "BLOCK MINED" : eta ? formatEta(eta.etaSeconds) : "…"}
          </div>
          <div style={{ fontSize: 9, color: muted, marginTop: 2, letterSpacing: "0.1em" }}>
            {mined
              ? "the chain has decided — the map locks when the season opens"
              : eta
                ? `${Math.max(0, eta.blocksLeft).toLocaleString()} blocks until the map is locked on-chain`
                : "reading Base block height…"}
          </div>
          {seedCommitment && (
            <div style={{ fontSize: 9, color: muted, marginTop: 10, letterSpacing: "0.05em" }}>
              our half is already sealed — commitment SHA-256 <span style={{ color: text }}>{truncHash(seedCommitment)}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, letterSpacing: "0.08em", color: gold }}>
            THE MAP DOES NOT EXIST YET
          </div>
          <div style={{ fontSize: 11, color: text, marginTop: 8, lineHeight: 1.6, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            Nobody knows where the Lyquid80 is buried. <em>Not even us.</em> Before
            drilling starts, the map gets locked to a <span style={{ color: gold }}>future Base block</span> that
            doesn&apos;t exist yet — no one can rig what no one can predict, and anyone
            can verify it after the season.
          </div>
        </>
      )}
    </div>
  );
}
