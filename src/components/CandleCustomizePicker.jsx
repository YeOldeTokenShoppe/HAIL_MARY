"use client";

// Shared votive-candle customization picker — used by BOTH the landing page
// (src/app/page.js, placement="anchored") and the /main vigil panel
// (MainVigilPanel.jsx, placement="modal"). Extracted so the two pages can
// never drift. The picker BODY is identical; only the shell differs:
//   • anchored — bare card, positioned + styled by chart-shrine.css (loaded
//     on the landing page). No inlined <style>, so the landing page is
//     byte-identical to the pre-extraction inline JSX.
//   • modal — centered backdrop overlay + an inlined <style> that carries the
//     picker's styles, so it renders correctly on /main where
//     chart-shrine.css is NOT loaded.
//
// Cosmetics (image/tint) are gated on `canCustomize` (hold RL80); intentions
// are free. All persistence is the caller's job (via lib/candleRitual +
// lib/candlePrefs) — this component is presentational and calls back.

import React from "react";
import { createPortal } from "react-dom";
import { VOTIVE_IMAGE_PRESETS, VOTIVE_TINT_PRESETS } from "@/lib/candlePrefs";
import { INTENTION_PRESETS } from "@/lib/intentions";
// Styles for the modal placement (/main). Scoped so the landing page — which
// already loads these rules via chart-shrine.css — is unaffected; only the
// `.ccp-backdrop`/`.ccp-modal-card` shell rules are new. See the .css header.
import "./CandleCustomizePicker.css";

export default function CandleCustomizePicker({
  open,
  placement = "anchored", // "anchored" (landing) | "modal" (/main)
  onClose,
  title = "Your candle",
  canCustomize = false,
  candleLit = false,
  timerText = null, // e.g. formatRemaining(litAt, meltDuration); shown when lit
  votiveImage = null,
  votiveTint = null,
  intentions = [],
  votiveUploadError = null,
  onToggleIntention,
  onPickImage, // (src|null)
  onUploadImage, // (File)
  onPickTint, // (hex|null)
  onExtinguish, // optional — parent composes close + extinguish
  onDisconnect, // optional — parent composes close + disconnect
  onBuyRL80, // optional — lock-panel CTA
  burnOfferingSlot = null, // optional node (landing passes <BurnOfferingPanel/>)
}) {
  if (!open) return null;

  const isModal = placement === "modal";

  const card = (
    <div
      className={`flame-nudge candle-picker-popup${isModal ? " ccp-modal-card" : ""}${
        canCustomize ? "" : " is-locked"
      }`}
      role="dialog"
      aria-label={title}
      onClick={isModal ? (e) => e.stopPropagation() : undefined}
    >
      <p className="flame-nudge-title">{title}</p>
      {candleLit && timerText && (
        <div className="candle-picker-timer">{timerText}</div>
      )}
      {!canCustomize && (
        <div className="candle-picker-lock">
          <p className="candle-picker-lock-text">
            Hold any RL80 to customize your candle.
          </p>
          {onBuyRL80 && (
            <button
              type="button"
              className="shrine-btn primary candle-picker-lock-cta"
              onClick={onBuyRL80}
            >
              Buy RL80
            </button>
          )}
        </div>
      )}

      {/* Intentions — free (not gated by canCustomize). Tapping the active
          chip clears it. */}
      {candleLit && (
        <div className="votive-customize">
          <p className="votive-customize-heading">Intentions</p>
          <div className="dedication-chips">
            {INTENTION_PRESETS.map((preset) => {
              const isActive = intentions.includes(preset.key);
              return (
                <button
                  key={preset.key}
                  type="button"
                  className={`dedication-chip${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => onToggleIntention?.(preset.key)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {candleLit && canCustomize && burnOfferingSlot}

      {/* Image + wax color. Handlers early-return when !canCustomize, and the
          section is greyed via the wrapper's is-locked class. */}
      <div className="votive-customize">
        <p className="votive-customize-heading">Image</p>
        <div className="votive-image-presets">
          {VOTIVE_IMAGE_PRESETS.map((preset) => {
            const isActive =
              (preset.src == null && !votiveImage) ||
              (preset.src != null && votiveImage === preset.src);
            return (
              <button
                key={preset.key}
                type="button"
                className={`votive-image-tile${isActive ? " is-active" : ""}`}
                onClick={() => onPickImage?.(preset.src)}
                title={preset.label}
                aria-label={preset.label}
              >
                {preset.thumbnail || preset.src ? (
                  <img src={preset.thumbnail ?? preset.src} alt="" />
                ) : (
                  <span className="votive-image-tile-default">✨</span>
                )}
                <span className="votive-image-tile-label">{preset.label}</span>
              </button>
            );
          })}
          {(() => {
            const hasCustomUpload =
              votiveImage &&
              !VOTIVE_IMAGE_PRESETS.some((p) => p.src === votiveImage);
            return (
              <label
                className={`votive-image-tile votive-image-upload${
                  hasCustomUpload ? " is-active" : ""
                }`}
                title="Upload your own"
              >
                {hasCustomUpload ? (
                  <img src={votiveImage} alt="" />
                ) : (
                  <span className="votive-image-tile-default">+</span>
                )}
                <span className="votive-image-tile-label">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadImage?.(file);
                    // Reset so re-selecting the same file fires change again.
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
                {hasCustomUpload && (
                  <button
                    type="button"
                    className="votive-image-clear"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPickImage?.(null);
                    }}
                    aria-label="Clear uploaded image"
                    title="Clear uploaded image"
                  >
                    ×
                  </button>
                )}
              </label>
            );
          })()}
        </div>
        <p className="votive-upload-hint">
          Uploads are resized and saved only on this device.
        </p>
        {votiveUploadError && (
          <p className="votive-upload-error">{votiveUploadError}</p>
        )}

        <p className="votive-customize-heading">Wax color</p>
        <div className="votive-tint-swatches">
          {VOTIVE_TINT_PRESETS.map((preset) => {
            const isActive =
              (preset.hex == null && !votiveTint) ||
              (preset.hex != null &&
                votiveTint?.toLowerCase() === preset.hex.toLowerCase());
            return (
              <button
                key={preset.key}
                type="button"
                className={`votive-tint-swatch${
                  preset.hex == null ? " votive-tint-swatch--natural" : ""
                }${isActive ? " is-active" : ""}`}
                onClick={() => onPickTint?.(preset.hex)}
                title={preset.label}
                aria-label={preset.label}
                style={preset.hex ? { background: preset.hex } : undefined}
              >
                {preset.hex == null && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ width: 14, height: 14 }}
                  >
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                )}
              </button>
            );
          })}
          <label className="votive-tint-swatch votive-tint-custom" title="Custom color">
            <input
              type="color"
              value={votiveTint ?? "#ffffff"}
              onChange={(e) => onPickTint?.(e.target.value)}
            />
          </label>
        </div>
      </div>

      {candleLit && onExtinguish && (
        <button
          type="button"
          className="candle-picker-secondary"
          onClick={onExtinguish}
        >
          Extinguish candle
        </button>
      )}
      {onDisconnect && (
        <button
          type="button"
          className="candle-picker-secondary"
          onClick={onDisconnect}
        >
          Disconnect wallet
        </button>
      )}
      <button
        type="button"
        className="flame-nudge-dismiss"
        onClick={onClose}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );

  if (!isModal) return card;

  // Portal to <body> so the fixed-position backdrop escapes any ancestor that
  // establishes a containing block for fixed descendants (e.g. the /main vigil
  // panel's `backdrop-filter`), which would otherwise trap + shrink the modal
  // inside the narrow side panel instead of centering it over the viewport.
  const overlay = (
    <div className="ccp-backdrop" onClick={onClose}>
      {card}
    </div>
  );
  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.body);
}
