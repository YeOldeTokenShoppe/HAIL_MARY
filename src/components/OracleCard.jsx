"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ── The share card ── One exchange from /main, rendered as an image.
 *
 * WHAT GOES ON IT, AND WHY IT IS ONLY HER ANSWER BY DEFAULT:
 * the seeker's line is a CONFESSION. They typed it into a shrine, not into a
 * post. So the card carries HER words, and the question rides along only if
 * they tick the box — an explicit, per-card opt-in, never remembered, never
 * defaulted on. (It also makes the better artifact: her line alone reads as an
 * oracle; her line under someone's bad week reads as a screenshot of a stranger.)
 *
 * CAPTURE PIPELINE is html2canvas, the same one OilClaimCertificate and
 * PolaroidSnapshot use — dynamic import, scale 2, useCORS. Everything drawn here
 * obeys its limits, which is why the art is plainer than the page it comes from:
 *   • NO radial-gradient — html2canvas renders them unreliably. The apse is the
 *     linear ramp from /main's own background stack (#160a26 → #0c0716 → #05060a),
 *     which is the one layer that survives the trip.
 *   • NO backdrop-filter, NO filter: silently dropped, so anything relying on
 *     them looks fine on screen and wrong in the PNG.
 *   • Fonts must be LOADED, not merely requested, before capture — an unloaded
 *     face falls back to Times in the export while looking correct on the page.
 *     See waitForPaint().
 */

// DOM size. Captured at scale 2 → 1080×1350, which is the 4:5 that X and
// Instagram both show tall instead of cropping to a letterbox.
const CARD_W = 540;
const CARD_H = 675;

const GOLD = "#f4b53f";
const HANDLE = "@askRL80";
const LINK = "rl80.com/main";

export default function OracleCard({
  open,
  onClose,
  // Her line. The whole reason the card exists; without it there is nothing to share.
  line,
  // The seeker's own line. Rendered ONLY when they opt in — see the note above.
  question,
  // Whichever apparition is currently seated (CHARACTERS[activeCharIndex]).
  face,
  apparitionName,
}) {
  const cardRef = useRef(null);
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  // ── Fit, measured in JS on purpose ── The card must render at exactly
  // CARD_W×CARD_H or the export stops being 1080×1350, so it is scaled for
  // display with a transform. But a transform does NOT change layout size: the
  // 540px box still occupies 540px of a 375px phone, and the overlay's
  // overflow-y:auto makes overflow-x:auto too, which is the horizontal-pan bug
  // this codebase keeps rediscovering. So the transform goes on a WRAPPER that
  // is sized to the scaled result, and the layout agrees with the picture.
  // CSS can't express this (calc() can't divide a length by a length), hence JS.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    if (!open) return;
    const measure = () =>
      setFit(
        Math.max(
          0.35,
          Math.min(
            1,
            (window.innerWidth - 40) / CARD_W,
            // Reserve for the checkbox, the button row and the note beneath.
            (window.innerHeight - 200) / CARD_H,
          ),
        ),
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  // Opt-in is per card, never sticky: closing and sharing a different line must
  // not silently carry a previous decision to publish a confession.
  useEffect(() => {
    if (open) {
      setIncludeQuestion(false);
      setNote(null);
    }
  }, [open, line]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Fonts and the portrait must be RESOLVED, not requested — html2canvas paints
  // whatever is ready at the instant it runs, and silently substitutes anything
  // that isn't. Both failures are invisible until you look at the saved PNG.
  // EVERY wait in here is capped. Each one is a promise the browser is entitled
  // to never settle, and an un-capped await doesn't fail — it hangs, leaving the
  // buttons disabled forever with "saving…" on screen and nothing in the console.
  // The rAF below is the one that actually bites: a BACKGROUNDED TAB STOPS
  // FIRING requestAnimationFrame, and backgrounding is the normal path here, not
  // an edge case — shareOnX opens the X composer in another window, and on a
  // phone "tap save, switch apps" is what people do. Verified live with
  // document.hidden === true: rAF never fired and the capture never returned.
  const capped = (promise, ms) =>
    Promise.race([
      Promise.resolve(promise).catch(() => {}),
      new Promise((r) => setTimeout(r, ms)),
    ]);

  const waitForPaint = async () => {
    if (document.fonts) {
      await capped(
        Promise.all([
          document.fonts.load("700 15px 'Rajdhani'"),
          document.fonts.load("400 27px 'Rajdhani'"),
          document.fonts.load("400 34px 'UnifrakturMaguntia'"),
        ]),
        1500,
      );
      await capped(document.fonts.ready, 1500);
    }
    const img = cardRef.current?.querySelector("img");
    if (img && !img.complete) {
      await capped(
        new Promise((r) => {
          img.onload = r;
          img.onerror = r;
        }),
        2500,
      );
    }
    // One painted frame, so html2canvas clones the DOM the browser actually
    // drew — but never wait longer than a frame's worth for it.
    await capped(
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      250,
    );
  };

  const capture = async () => {
    await waitForPaint();
    const { default: html2canvas } = await import("html2canvas");
    // Capped for the same reason as the waits above, but this one REJECTS
    // rather than resolving: a capture that never finishes has to surface as
    // "try again" to the seeker, not as three buttons that stopped working.
    // (Not applied to the whole share flow — nativeShare legitimately sits open
    // for as long as the OS share sheet is up.)
    return Promise.race([
      html2canvas(cardRef.current, {
        // `scale` multiplies the element's RENDERED size, and html2canvas does
        // honour the card's own display transform — so a card drawn at fit=0.92
        // exported 996×1244 instead of 1080×1350 until this divided it back out.
        // Dividing by fit pins the export to exactly CARD_W×CARD_H×2 at every
        // window size, which is the whole point of a fixed-size share card.
        scale: 2 / fit,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("capture timed out")), 20000),
      ),
    ]);
  };

  const toBlob = async () => {
    const canvas = await capture();
    return new Promise((r) => canvas.toBlob(r, "image/png"));
  };

  const run = async (label, fn) => {
    if (busy) return;
    setBusy(true);
    setNote(label);
    try {
      await fn();
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("[OracleCard]", err);
        setNote("the image didn't take. try again?");
        setTimeout(() => setNote(null), 4000);
        setBusy(false);
        return;
      }
      setNote(null);
    }
    setBusy(false);
  };

  // X cannot accept an image from a web intent, so the image goes to the
  // clipboard and the composer opens with the text — the user pastes. Same
  // two-step OilClaimCertificate uses; the note tells them it's expected.
  const shareOnX = () =>
    run("preparing…", async () => {
      const blob = await toBlob();
      let copied = false;
      if (blob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          copied = true;
        } catch {
          /* clipboard blocked — the composer still opens, just without the paste */
        }
      }
      setNote(
        copied
          ? "image copied — press ⌘V in the tweet to paste it"
          : "opening X…",
      );
      const text = `i asked ${HANDLE}.\n\n${LINK}`;
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        "_blank",
        "width=550,height=420",
      );
      setTimeout(() => setNote(null), 6000);
    });

  const copyImage = () =>
    run("copying…", async () => {
      const blob = await toBlob();
      if (!blob || !navigator.clipboard || !window.ClipboardItem) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setNote("copied.");
      setTimeout(() => setNote(null), 3000);
    });

  const download = () =>
    run("saving…", async () => {
      const canvas = await capture();
      const a = document.createElement("a");
      a.download = "our-lady-of-perpetual-profit.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      setNote("saved.");
      setTimeout(() => setNote(null), 3000);
    });

  const nativeShare = () =>
    run("preparing…", async () => {
      const blob = await toBlob();
      if (!blob) throw new Error("no image");
      await navigator.share({
        title: "Our Lady of Perpetual Profit",
        text: `i asked ${HANDLE}. ${LINK}`,
        files: [new File([blob], "our-lady.png", { type: "image/png" })],
      });
      setNote(null);
    });

  const btn = (primary) => ({
    padding: "9px 15px",
    background: primary ? `${GOLD}1f` : "transparent",
    border: `1px solid ${primary ? GOLD : "rgba(255,255,255,0.18)"}`,
    borderRadius: 4,
    color: primary ? GOLD : "rgba(255,255,255,0.6)",
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.55 : 1,
    display: "flex",
    alignItems: "center",
    gap: 7,
  });

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        // Opaque wash rather than a blur: this sits over a live WebGL frame and
        // three SitePal players, and a backdrop-filter over that composite is
        // the one thing that reliably drops the page to single-digit fps.
        background: "rgba(2, 2, 6, 0.88)",
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // NOT justifyContent:center. Centring a flex child that overflows its
        // container makes the TOP of the child unreachable — you can't scroll
        // back to it — and the top of this child is the card. `margin: auto 0`
        // on the inner column centres when there is room and simply starts at
        // the top when there isn't, which is the behaviour we actually want.
        gap: 14,
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: "auto 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Sized to the SCALED card, so layout and picture agree — see `fit`. */}
        <div
          style={{
            width: CARD_W * fit,
            height: CARD_H * fit,
            flexShrink: 0,
          }}
        >
          {/* ── The card itself ── everything inside is capture-safe (see the
            html2canvas notes at the top of this file). */}
          <div
            ref={cardRef}
            style={{
              width: CARD_W,
              height: CARD_H,
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 46px",
              boxSizing: "border-box",
              // /main's apse, minus the radial layers html2canvas can't draw.
              background:
                "linear-gradient(180deg, #1b0d2e 0%, #0c0716 52%, #05060a 100%)",
              // Display-fit only. The node keeps its true CARD_W×CARD_H box, so
              // html2canvas still exports 1080×1350 no matter how small this is
              // drawn. transform-origin must be top-left to fill the wrapper above.
              transform: `scale(${fit})`,
              transformOrigin: "top left",
            }}
          >
            {/* Her portrait, in a gold ring. */}
            <div
              style={{
                width: 168,
                height: 168,
                borderRadius: "50%",
                overflow: "hidden",
                border: `2px solid ${GOLD}`,
                boxShadow: `0 0 26px ${GOLD}44`,
                flexShrink: 0,
                background: "#0b0714",
              }}
            >
              {face && (
                <img
                  src={face}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
            </div>

            {/* The seeker's own words — only on request. */}
            {includeQuestion && question && (
              <div
                style={{
                  marginTop: 24,
                  maxWidth: "100%",
                  textAlign: "center",
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  lineHeight: 1.4,
                  color: "rgba(255,255,255,0.42)",
                  fontStyle: "italic",
                }}
              >
                “{question}”
              </div>
            )}

            {/* Her line. The card is built around this and nothing else competes. */}
            <div
              style={{
                marginTop: includeQuestion && question ? 14 : 30,
                maxWidth: "100%",
                textAlign: "center",
                fontFamily: "'Rajdhani', sans-serif",
                // Long answers step down a size rather than overflowing the card:
                // she is capped at 220 chars upstream, so two sizes covers the range.
                fontSize: (line || "").length > 130 ? 23 : 27,
                fontWeight: 500,
                lineHeight: 1.45,
                color: "#f7f2e6",
                textShadow: `0 0 22px ${GOLD}2e`,
              }}
            >
              {line}
            </div>

            {/* Attribution, pinned to the foot. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 34,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'UnifrakturMaguntia', serif",
                  fontSize: 34,
                  lineHeight: 1,
                  color: "#ffffff",
                  textShadow: `0 0 18px ${GOLD}66`,
                }}
              >
                RL80
              </div>
              <div
                style={{
                  marginTop: 9,
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: `${GOLD}cc`,
                }}
              >
                Our Lady of Perpetual Profit
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.2em",
                  color: "rgba(255,255,255,0.36)",
                }}
              >
                {apparitionName ? `${apparitionName} · ` : ""}
                {HANDLE} · {LINK}
              </div>
            </div>
          </div>
        </div>

        {/* ── Controls ── outside the captured node, so none of this is in the PNG. */}
        {question && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              cursor: "pointer",
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 13,
              letterSpacing: "0.05em",
              color: "rgba(255,255,255,0.62)",
            }}
          >
            <input
              type="checkbox"
              checked={includeQuestion}
              onChange={(e) => setIncludeQuestion(e.target.checked)}
              style={{
                accentColor: GOLD,
                width: 15,
                height: 15,
                cursor: "pointer",
              }}
            />
            include what you asked
          </label>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button onClick={shareOnX} style={btn(true)} disabled={busy}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
          <button onClick={copyImage} style={btn(false)} disabled={busy}>
            Copy
          </button>
          <button onClick={download} style={btn(false)} disabled={busy}>
            Save
          </button>
          {typeof navigator !== "undefined" && navigator.share && (
            <button onClick={nativeShare} style={btn(false)} disabled={busy}>
              Share
            </button>
          )}
          <button onClick={onClose} style={btn(false)} disabled={busy}>
            Close
          </button>
        </div>

        <div
          style={{
            minHeight: 16,
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 12,
            letterSpacing: "0.05em",
            color: GOLD,
            textAlign: "center",
          }}
        >
          {note}
        </div>
      </div>
    </div>,
    document.body,
  );
}
