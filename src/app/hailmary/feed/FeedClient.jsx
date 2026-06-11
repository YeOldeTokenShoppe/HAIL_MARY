"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Field Dispatch — public gallery of admin-approved polaroids from the field.
// Reads the same `/api/oil-feed` the in-game accordion uses (admin SDK,
// approved-only, newest-first). Every card links to its /snapshot/{id} page,
// which carries per-image OG tags — so cards re-shared from here unfurl
// properly on X/Telegram.

const mono = "'Share Tech Mono', monospace";
const C = {
  bg: "#140b1c",
  panel: "#1c1024",
  gold: "#d4a854",
  text: "#e8dcc8",
  muted: "#b8a890",
  border: "rgba(212, 168, 84, 0.25)",
  red: "#b8402c",
  frame: "#f4f0e6",
  ink: "#3a3326",
};

const TAGS = {
  hell: { label: "🔥 HELL POCKET", color: "#ff5a3c" },
  gusher: { label: "💥 GUSHER", color: "#3ad6c4" },
  showcase: { label: "📸 SHOWCASE", color: "#9a8db8" },
};

function relTime(ms) {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function FeedClient() {
  const [items, setItems] = useState(null); // null = loading

  useEffect(() => {
    fetch("/api/oil-feed")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]));
  }, []);

  const cta = (
    <Link
      href="/hailmary"
      style={{
        display: "inline-block",
        padding: "13px 30px",
        background: `linear-gradient(180deg, ${C.gold}, #b8922e)`,
        border: `1px solid ${C.gold}`,
        borderRadius: 3,
        color: "#fff",
        fontFamily: mono,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.15em",
        textDecoration: "none",
      }}
    >
      ⛏ STAKE A CLAIM →
    </Link>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 16px 64px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.35em", color: C.muted, fontFamily: mono }}>
            HAIL MARY PROSPECTING CO.
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.12em", color: C.gold, fontFamily: mono, margin: "10px 0 6px" }}>
            FIELD DISPATCHES
          </h1>
          <div style={{ fontSize: 12, color: C.text, fontFamily: mono, letterSpacing: "0.06em", marginBottom: 18 }}>
            live from the Lyquid80 fields — real USDC, a provably-fair map, rigs that drill 24/7
          </div>
          {cta}
        </header>

        {/* Grid */}
        {items === null ? (
          <div style={{ textAlign: "center", color: C.muted, fontFamily: mono, fontSize: 12, padding: 60 }}>
            developing film…
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, fontFamily: mono, fontSize: 12, padding: 60, lineHeight: 1.8 }}>
            No dispatches published yet.<br />
            The first gusher of the season will land here.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 22,
              alignItems: "start",
            }}
          >
            {items.map((it, i) => {
              const tag = TAGS[it.eventType];
              const href = it.snapshotId ? `/snapshot/${it.snapshotId}` : it.storageUrl;
              const rot = ((i % 5) - 2) * 1.1; // deterministic polaroid scatter
              return (
                <a
                  key={it.id}
                  href={href}
                  target={it.snapshotId ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    transform: `rotate(${rot}deg)`,
                    transition: "transform 0.15s ease",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) scale(1.03)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${rot}deg)`; }}
                >
                  {/* The uploaded PNG IS the polaroid (PolaroidSnapshot bakes
                      the frame + handwritten caption into the image) — render
                      it bare; no second frame, no duplicate caption. */}
                  <img
                    src={it.storageUrl}
                    alt={it.caption || "field dispatch"}
                    loading="lazy"
                    style={{ width: "100%", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.5))" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "7px 4px 0", fontSize: 9, color: C.muted, fontFamily: mono }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tag && <span style={{ color: tag.color, letterSpacing: "0.1em", marginRight: 6 }}>{tag.label}</span>}
                      {it.username}
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>{relTime(it.createdAtMs)}</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Footer CTA */}
        {items && items.length > 0 && (
          <footer style={{ textAlign: "center", marginTop: 40 }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, letterSpacing: "0.08em", marginBottom: 14 }}>
              Every dispatch is a real strike by a real prospector. The next one could be yours.
            </div>
            {cta}
          </footer>
        )}
      </div>
    </div>
  );
}
