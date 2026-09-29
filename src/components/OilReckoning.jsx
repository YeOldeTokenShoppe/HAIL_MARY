"use client";

// ── THE RECKONING — the player's season-end share card ───────────────────────
// (docs/oil-game.md → SEASON ONE → IN #3; decided 2026-09-28: the reckoning
// REPLACES the FINAL HAUL card as the season-end share — provisional, "a big
// HUD of totals", Michelle will modify once she sees it rendered.)
//
// Two parts:
//   1. THE CARD (captured to PNG by SHARE): a fixed dark palette — NOT theme
//      tokens — so the picture looks right whatever console theme the player
//      runs. Big banked number, the USDC line, four totals, and a 20-cell strip
//      of the column (what you kept, what neighbours took, what you never
//      reached). Every rig gets one, dry ones included.
//   2. THE FULL ACCOUNT below it, in theme chrome, behind a toggle: the
//      line-by-line breakdown that used to be the whole card.
//
// SHARE: PNG → native share sheet when the device has one (phones), else the
// clipboard + an X compose window with the referral link — the same path the
// FINAL HAUL card used. COPY REPORT keeps the plain-text version.
//
// Data: lib/oilLoopV2 buildReckoning(). The column total is only complete once
// the page hands the builder the revealed seed's column (post-gameEnded); until
// then the card says how many layers are still sealed rather than guessing.

import { useRef, useState } from "react";
import { reckoningText, reckoningShareText, reckoningStrip } from "@/lib/oilLoopV2";

const MONO = "'Share Tech Mono', monospace";
const DISPLAY = "'Orbitron', 'Share Tech Mono', monospace";
const btr = (n) => Math.round(n || 0).toLocaleString();
const usd = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Card palette (fixed — see header). Same family as the core cylinder's wall
// colours so the strip reads like the rack: kept = green, taken = amber,
// open = gold, hell = red, dry = earth, missed = dim, sealed = hatched grey.
const CARD = {
  bg: "linear-gradient(180deg, #1c1024, #120a18)", edge: "rgba(212,168,84,0.5)",
  gold: "#d4a854", text: "#e8dcc8", muted: "#b8a890", dim: "#6e6050",
  green: "#37f07a", amber: "#ffb84d", open: "#ffd75e", red: "#ff3f1f", dry: "#4a4036", missed: "#7a5a3a", sealed: "#3a3140",
};
const STRIP_COLOR = { extracted: CARD.green, taken: CARD.amber, open: CARD.open, dry: CARD.dry, hell: CARD.red, missed: CARD.missed, sealed: CARD.sealed };
const STRIP_WORD = { extracted: "kept", taken: "taken", open: "left open", dry: "dry", hell: "hell", missed: "never reached", sealed: "sealed" };

export default function OilReckoning({ theme, reckoning: r, col, row, refCode = null, shareUrl = "rl80.com/hailmary" }) {
  const cardRef = useRef(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  if (!r) return null;

  const flash = (s, ms = 2500) => { setNote(s); setTimeout(() => setNote(""), ms); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(reckoningText(r, { col, row })); flash("✔ report copied"); }
    catch { flash("✗ clipboard blocked"); }
  };
  const share = async () => {
    if (busy) return;
    setBusy(true);
    const text = reckoningShareText(r, { refCode, url: shareUrl });
    try {
      setNote("Capturing…");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: "#120a18", useCORS: true });
      const png = await new Promise((res) => canvas.toBlob(res, "image/png"));
      // Phones: the native sheet takes the picture and the text together.
      if (png && typeof navigator !== "undefined" && navigator.share) {
        const file = new File([png], "hail-mary-reckoning.png", { type: "image/png" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text }); setNote(""); setBusy(false); return; }
          catch (e) { if (e && e.name === "AbortError") { setNote(""); setBusy(false); return; } }
        }
      }
      // Desktop: picture to the clipboard, text to an X compose window.
      let copied = false;
      if (png && navigator.clipboard && window.ClipboardItem) {
        try { await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); copied = true; } catch { /* text share still works */ }
      }
      setNote(copied ? "✔ card copied — paste it into your post" : "");
      if (copied) await new Promise((res) => setTimeout(res, 1200));
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=550,height=420");
      setTimeout(() => setNote(""), 4000);
    } catch (err) {
      console.error("reckoning share failed:", err);
      try { await navigator.clipboard.writeText(text); flash("✔ text copied (picture failed)"); } catch { flash("✗ share failed"); }
    } finally {
      setBusy(false);
    }
  };

  const sealed = r.unknownLayers > 0;
  const pctText = r.captureRate != null ? `${Math.round(r.captureRate * 100)}%` : "—";
  const strip = reckoningStrip(r);
  const takenInText = r.salvagedIn + r.wildcatIn;

  // ── card typography (fixed palette) ──
  const cMeta = { fontFamily: MONO, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: CARD.muted, lineHeight: 1.4 };
  const cLine = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", color: CARD.text, lineHeight: 1.6 };
  const total = (value, label, color) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: color || CARD.text, lineHeight: 1.15, letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div style={cMeta}>{label}</div>
    </div>
  );

  // ── account typography (theme chrome) ──
  const line = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", lineHeight: 1.7, color: theme.text };
  const muted = { ...line, color: theme.muted };
  const row2 = (label, value, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={muted}>{label}</span>
      <span style={{ ...line, color: color || theme.text, textAlign: "right", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
  const btn = (text, onClick, filled) => (
    <button onClick={onClick} disabled={busy} style={{
      flex: filled ? 2 : 1, fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "9px 10px",
      borderRadius: 2, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontWeight: filled ? 700 : 400,
      background: filled ? `${theme.gold}22` : "transparent", color: theme.gold, border: `1px solid ${theme.gold}`,
    }}>{text}</button>
  );

  return (
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border || theme.muted}`, background: theme.tintBg }}>
      {/* ── THE CARD (captured) ── */}
      <div ref={cardRef} style={{ padding: "16px 18px 14px", border: `1px solid ${CARD.edge}`, borderRadius: 8, background: CARD.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={cMeta}>Hail Mary Prospecting Co.</span>
          {col != null && <span style={cMeta}>plot ({col + 1},{row + 1})</span>}
        </div>
        <div style={{ ...cMeta, color: CARD.gold, fontSize: 11, letterSpacing: "0.26em", marginTop: 6 }}>The Reckoning · season closed</div>

        <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 700, color: CARD.gold, lineHeight: 1.05, marginTop: 10, letterSpacing: "0.02em", textShadow: "0 0 18px rgba(212,168,84,0.28)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {btr(r.banked)}
        </div>
        <div style={{ ...cLine, letterSpacing: "0.2em", marginTop: 2 }}>
          BTR BANKED <span style={{ color: CARD.gold }}>≈ {usd(r.payoutUsd)} USDC</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginTop: 14 }}>
          {total(pctText, sealed ? `of the column found so far` : `of your column kept`, CARD.green)}
          {total(`${btr(r.takenByRivals)}`, "taken from your passes", r.takenByRivals > 0 ? CARD.amber : CARD.text)}
          {total(`+${btr(takenInText)}`, `from next door · ${plural(r.salvageCount + r.wildcatCount, "move")}`, takenInText > 0 ? CARD.green : CARD.text)}
          {total(sealed ? `${r.unknownLayers} sealed` : `${btr(r.stranded)}`, sealed ? "layers still to be revealed" : "stranded in the ground", !sealed && r.stranded > 0 ? CARD.amber : CARD.text)}
        </div>

        {/* column strip: top of the column on the left, the bottom on the right */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {strip.map((c) => (
              <div key={c.layer} title={`L${c.layer + 1} · ${STRIP_WORD[c.state]}${c.oil ? ` · ${btr(c.oil)} BTR` : ""}`} style={{
                flex: 1, height: 14, borderRadius: 1, background: STRIP_COLOR[c.state],
                opacity: c.state === "dry" || c.state === "sealed" ? 0.7 : 1,
                backgroundImage: c.state === "sealed" ? "repeating-linear-gradient(135deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 5px)" : "none",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={cMeta}>surface</span>
            <span style={cMeta}>{r.depthZ} layers · reached L{r.reached}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 4 }}>
            {["extracted", "taken", "open", "hell", "missed"].filter((k) => strip.some((c) => c.state === k)).map((k) => (
              <span key={k} style={{ ...cMeta, letterSpacing: "0.1em", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 1, background: STRIP_COLOR[k], display: "inline-block" }} />{STRIP_WORD[k]}
              </span>
            ))}
            {sealed && <span style={{ ...cMeta, letterSpacing: "0.1em" }}>▨ sealed until the seed is published</span>}
          </div>
        </div>

        <div style={{ ...cMeta, letterSpacing: "0.1em", textTransform: "none", marginTop: 12, color: CARD.dim }}>
          real USDC, paid to your wallet on Base · {shareUrl}
        </div>
      </div>

      {/* ── actions ── */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {btn(busy ? (note || "…") : "📸 SHARE THE RECKONING", share, true)}
        {btn("COPY REPORT", copy, false)}
      </div>
      {!busy && note && <div style={{ ...muted, color: theme.gold, marginTop: 4 }}>{note}</div>}

      {/* ── THE FULL ACCOUNT ── */}
      <button onClick={() => setOpenAccount((o) => !o)} style={{ ...muted, letterSpacing: "0.14em", background: "transparent", border: "none", padding: "8px 0 0", cursor: "pointer", textAlign: "left" }}>
        {openAccount ? "▾" : "▸"} THE FULL ACCOUNT
      </button>
      {openAccount && (
        <div style={{ marginTop: 4, borderTop: `1px solid ${theme.border || theme.muted}`, paddingTop: 6 }}>
          <div style={{ ...muted, letterSpacing: "0.12em" }}>YOUR COLUMN</div>
          {row2(sealed ? `under your column (${plural(r.unknownLayers, "layer")} still sealed)` : "under your column",
            `${btr(r.columnTotal)} BTR${r.hellLayers ? ` · ${plural(r.hellLayers, "hell pocket")}${r.hellCapped ? ` (${r.hellCapped} capped)` : ""}` : ""}`)}
          {row2("you extracted", `${btr(r.extractedOwn)} BTR${r.captureRate != null ? ` (${pctText})` : ""}`, theme.green)}
          {row2("you passed", `${btr(r.passedTotal)} BTR`)}
          {r.passedTotal > 0 && row2("· neighbours took", `${btr(r.takenByRivals)} BTR`, r.takenByRivals > 0 ? theme.red : undefined)}
          {r.passedTotal > 0 && row2("· stayed in the ground", `${btr(r.leftOpen)} BTR`)}
          {row2("never reached", `${plural(r.neverReachedLayers, "layer")}${r.neverReachedOil > 0 ? ` · ${btr(r.neverReachedOil)} BTR` : sealed && r.neverReachedLayers > 0 ? " · sealed" : ""}`)}
          {r.stranded > 0 && row2("stranded — never banked", `${btr(r.stranded)} BTR`, theme.red)}

          <div style={{ ...muted, letterSpacing: "0.12em", marginTop: 8 }}>BEYOND YOUR FENCE</div>
          {row2("salvaged next door", `+${btr(r.salvagedIn)} BTR · ${plural(r.salvageCount, "lateral")}`, r.salvagedIn > 0 ? theme.green : undefined)}
          {row2("wildcats", `+${btr(r.wildcatIn)} BTR · ${r.wildcatCount} dug${r.wildcatDry ? `, ${r.wildcatDry} dry` : ""}${r.wildcatHell ? `, ${r.wildcatHell} hell` : ""}`, r.wildcatIn > 0 ? theme.green : undefined)}

          <div style={{ marginTop: 8 }}>
            {row2("charges", `${r.chargesSpent}/${r.chargesCap} spent${r.chargesUnspent ? ` · ${r.chargesUnspent} wasted` : ""}`, r.chargesUnspent ? theme.red : undefined)}
            {r.usdRate > 0 && row2("payout rate", `$${r.usdRate.toLocaleString(undefined, { maximumSignificantDigits: 3 })} per BTR · fixed for the season`)}
            {r.pendingUnresolved && <div style={{ ...muted, color: theme.red }}>a core was still on the table at the buzzer — the crew settles it by your standing order.</div>}
            {sealed && <div style={muted}>The sealed layers fill in when the season&apos;s seed is published — check VERIFY THE MAP.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
