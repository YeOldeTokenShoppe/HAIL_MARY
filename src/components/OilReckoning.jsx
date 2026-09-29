"use client";

// ── THE RECKONING — the player's season-end share card ───────────────────────
// (docs/oil-game.md → SEASON ONE → IN #3; decided 2026-09-28: the reckoning
// REPLACES the FINAL HAUL card as the season-end share — provisional.)
//
// 2026-09-29: rebuilt in the /space telemetry-panel language (Michelle: "the
// displays from /space still look better") on the shared HmHud kit — dark
// glass, gold brackets, Orbitron title, the four mono voices, two big stats,
// the clipped-corner button. Same skeleton as the SOUL MODULE panel:
//   meta · title · subtitle · tabs · divider · story · strip · typed body ·
//   divider · caption · stats · button · hint
// Fixed palette by design: identical in every console theme and PNG-safe.
//
// SHARE captures the panel: native share sheet with the PNG on phones, else
// clipboard + X compose with the referral link. The hint under the button
// copies the plain-text report. The line-by-line account is the second tab.
//
// Data: lib/oilLoopV2 buildReckoning(). The column total is only complete once
// the page hands the builder the revealed seed's column (post-gameEnded); until
// then the card says how many layers are still sealed rather than guessing.

import { useRef, useState } from "react";
import { reckoningText, reckoningStory, reckoningShareText, reckoningStrip } from "@/lib/oilLoopV2";
import { HUD, HUD_MONO, HudPanel, HudMeta, HudTitle, HudTabs, HudDivider, HudLine, HudCaption, HudStats, HudButton, HudHint } from "@/components/HmHud";

const btr = (n) => Math.round(n || 0).toLocaleString();
const usd = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Strip colours: kept = green, taken = violet (a rival's mark), open = gold,
// hell = red, dry = earth, missed = dim, sealed = hatched.
const STRIP_COLOR = { extracted: HUD.green, taken: HUD.violet, open: HUD.gold, dry: "#4a4036", hell: HUD.red, missed: "#7a5a3a", sealed: "#3a3140" };
const STRIP_WORD = { extracted: "kept", taken: "taken", open: "left open", dry: "dry", hell: "hell", missed: "never reached", sealed: "sealed" };

export default function OilReckoning({ theme, reckoning: r, col, row, refCode = null, shareUrl = "rl80.com/hailmary" }) {
  const cardRef = useRef(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("card");
  if (!r) return null;

  const flash = (s, ms = 2500) => { setNote(s); setTimeout(() => setNote(""), ms); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(reckoningText(r, { col, row })); flash("✔ report copied"); }
    catch { flash("✗ clipboard blocked"); }
  };
  const share = async () => {
    if (busy) return;
    setBusy(true);
    const text = reckoningShareText(r, { refCode, url: shareUrl, col, row });
    try {
      setNote("Capturing…");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: HUD.panelSolid, useCORS: true });
      const png = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (png && typeof navigator !== "undefined" && navigator.share) {
        const file = new File([png], "hail-mary-reckoning.png", { type: "image/png" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text }); setNote(""); setBusy(false); return; }
          catch (e) { if (e && e.name === "AbortError") { setNote(""); setBusy(false); return; } }
        }
      }
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
  const where = col != null ? `PLOT (${col + 1},${row + 1})` : "YOUR PLOT";
  const paid = r.banked > 0;

  // The warn line is the one thing the season will be remembered for.
  const warn = r.takenByRivals > 0 ? `!! NEIGHBOURS TOOK ${btr(r.takenByRivals)} BTR !!`
    : !sealed && r.stranded > 0 ? `!! ${btr(r.stranded)} BTR LEFT IN THE GROUND !!`
    : sealed ? `!! ${plural(r.unknownLayers, "LAYER").toUpperCase()} STILL SEALED !!`
    : paid ? "!! CLEAN COLUMN — NOTHING LEFT BEHIND !!" : "!! DRY SEASON !!";

  const stripBlock = (
    <div style={{ margin: "0.7rem 0 0.75rem" }}>
      <div style={{ display: "flex", gap: 2 }}>
        {strip.map((c) => (
          <div key={c.layer} title={`L${c.layer + 1} · ${STRIP_WORD[c.state]}${c.oil ? ` · ${btr(c.oil)} BTR` : ""}`} style={{
            flex: 1, height: 12, background: STRIP_COLOR[c.state],
            opacity: c.state === "dry" || c.state === "sealed" ? 0.7 : 1,
            boxShadow: c.state === "extracted" ? `0 0 6px ${HUD.green}55` : c.state === "taken" ? `0 0 6px ${HUD.violet}55` : "none",
            backgroundImage: c.state === "sealed" ? "repeating-linear-gradient(135deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 5px)" : "none",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: HUD_MONO, fontSize: "0.48rem", letterSpacing: "0.2em", color: HUD.goldDim, textTransform: "uppercase", marginTop: 4 }}>
        <span>surface</span>
        <span>{r.depthZ} layers · bore reached L{r.reached}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 4, fontFamily: HUD_MONO, fontSize: "0.48rem", letterSpacing: "0.12em", color: HUD.muted, textTransform: "uppercase" }}>
        {["extracted", "taken", "open", "hell", "missed", "sealed"].filter((k) => strip.some((c) => c.state === k)).map((k) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 7, height: 7, background: STRIP_COLOR[k], display: "inline-block" }} />{STRIP_WORD[k]}
          </span>
        ))}
      </div>
    </div>
  );

  const cardBody = (
    <>
      <HudLine type="plain" text={reckoningStory(r, { col, row })} />
      {stripBlock}
      <HudLine type="label" label="BANKED" text={`${btr(r.banked)} BTR`} />
      <HudLine type="label" label="PAID" text={paid ? `${usd(r.payoutUsd)} USDC — to your wallet on Base` : "nothing"} />
      <HudLine type="label" label="COLUMN" text={sealed ? `${btr(r.columnTotal)} BTR known · ${plural(r.unknownLayers, "layer")} sealed` : `${btr(r.columnTotal)} BTR${r.hellLayers ? ` · ${plural(r.hellLayers, "hell pocket")}` : ""}`} />
      <HudLine type="blank" />
      <HudLine type="data" label="Kept" text={`${btr(r.extractedOwn)} BTR${r.captureRate != null ? ` — ${pctText} of the column` : ""}`} />
      <HudLine type="data" label="Passed" text={`${btr(r.passedTotal)} BTR${r.passedTotal > 0 ? ` — ${btr(r.takenByRivals)} taken, ${btr(r.leftOpen)} left` : ""}`} />
      <HudLine type="data" label="Next door" text={`+${btr(r.salvagedIn)} BTR · ${plural(r.salvageCount, "lateral")}`} />
      <HudLine type="data" label="Wildcats" text={`+${btr(r.wildcatIn)} BTR · ${r.wildcatCount} dug${r.wildcatDry ? `, ${r.wildcatDry} dry` : ""}${r.wildcatHell ? `, ${r.wildcatHell} hell` : ""}`} />
      <HudLine type="blank" />
      <HudLine type="warn" text={warn} />
    </>
  );

  const accountBody = (
    <>
      <HudLine type="label" label="UNDER YOU" text={`${btr(r.columnTotal)} BTR${sealed ? ` known · ${plural(r.unknownLayers, "layer")} sealed` : ""}${r.hellLayers ? ` · ${plural(r.hellLayers, "hell pocket")}${r.hellCapped ? ` (${r.hellCapped} capped)` : ""}` : ""}`} />
      <HudLine type="label" label="REACHED" text={`L${r.reached} of ${r.depthZ}${r.neverReachedLayers ? ` · ${plural(r.neverReachedLayers, "layer")} never reached${r.neverReachedOil > 0 ? ` holding ${btr(r.neverReachedOil)} BTR` : ""}` : ""}`} />
      <HudLine type="blank" />
      <HudLine type="data" label="Extracted" text={`${btr(r.extractedOwn)} BTR${r.captureRate != null ? ` (${pctText})` : ""}`} />
      <HudLine type="data" label="Passed" text={`${btr(r.passedTotal)} BTR`} />
      {r.passedTotal > 0 && <HudLine type="data" label="· taken" text={`${btr(r.takenByRivals)} BTR by neighbours`} />}
      {r.passedTotal > 0 && <HudLine type="data" label="· left" text={`${btr(r.leftOpen)} BTR stayed in the ground`} />}
      {r.stranded > 0 && <HudLine type="data" label="Stranded" text={`${btr(r.stranded)} BTR never banked`} />}
      <HudLine type="blank" />
      <HudLine type="data" label="Salvaged" text={`+${btr(r.salvagedIn)} BTR · ${plural(r.salvageCount, "lateral")}`} />
      <HudLine type="data" label="Wildcats" text={`+${btr(r.wildcatIn)} BTR · ${r.wildcatCount} dug${r.wildcatDry ? `, ${r.wildcatDry} dry` : ""}${r.wildcatHell ? `, ${r.wildcatHell} hell` : ""}`} />
      <HudLine type="data" label="Charges" text={`${r.chargesSpent}/${r.chargesCap} spent${r.chargesUnspent ? ` · ${r.chargesUnspent} unused` : ""}`} />
      {r.usdRate > 0 && <HudLine type="data" label="Rate" text={`$${r.usdRate.toLocaleString(undefined, { maximumSignificantDigits: 3 })} per BTR · fixed for the season`} />}
      <HudLine type="blank" />
      {r.pendingUnresolved && <HudLine type="note" text="A core was still on the table at the buzzer — the crew settles it by your standing order." />}
      {sealed && <HudLine type="note" text="Sealed layers fill in when the season's seed is published. See VERIFY THE MAP." />}
      <HudLine type="note" text="Pass is final. What you left, neighbours could take; what nobody took is still down there." />
    </>
  );

  return (
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme?.border || "transparent"}` }}>
      <style>{`@keyframes gooCursorBlink { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
      <HudPanel innerRef={cardRef}>
        <HudMeta index="20/20" label="Season-end account" status="CLOSED" lamp={HUD.gold} blink={false} />
        <HudTitle subtitle="The Reckoning" />
        <HudTabs tabs={[{ id: "card", label: "Reckoning" }, { id: "account", label: "Full account" }]} active={tab} onSelect={setTab} />
        <HudDivider />
        <div style={{ minHeight: 140 }}>{tab === "card" ? cardBody : accountBody}</div>
        <HudDivider margin="0.6rem 0 0.5rem" />
        <HudCaption>RIG ID: {where} — HAIL MARY FIELD</HudCaption>
        <HudStats stats={[
          { value: `${btr(r.banked)} BTR`, label: "banked", color: HUD.cyan },
          { value: paid ? usd(r.payoutUsd) : "DRY", label: paid ? "USDC paid" : "season", color: paid ? HUD.orange : HUD.muted },
        ]} />
        <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "center" }}>
          <HudButton onClick={share} disabled={busy}>{busy ? (note || "…") : "Share the Reckoning?"}</HudButton>
        </div>
        <HudHint onClick={busy ? undefined : copy}>{!busy && note ? note : "[ copy the report as text ]"}</HudHint>
      </HudPanel>
    </div>
  );
}
