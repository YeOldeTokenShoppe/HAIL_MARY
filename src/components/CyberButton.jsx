"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import "./CyberButton.css";

/* ── Small inline CyberBtn (reused for trigger + modal actions) ── */
function CyberBtn({ label, shortcut, shortcutIcon, icon, onClick, className = "", autoFocus, ...rest }) {
  const letters = label.split("");
  return (
    <button
      className={`cyber-btn ${className}`}
      onClick={onClick}
      aria-label={label}
      data-action={label}
      autoFocus={autoFocus}
      {...rest}
    >
      <span className="cyber-backdrop" />
      <span className="cyber-corner" />
      {shortcut && <kbd>{shortcut}</kbd>}
      {icon && <span className="cyber-btn-icon">{icon}</span>}
      {shortcutIcon && (
        <kbd>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            <path d="m9 10-5 5 5 5" />
          </svg>
        </kbd>
      )}
      <span>{label}</span>
      <div className="cyber-glitch" aria-hidden="true">
        <span className="cyber-backdrop" />
        <span className="cyber-corner" />
        {shortcut && <kbd>{shortcut}</kbd>}
        {icon && <span className="cyber-btn-icon" style={{ opacity: 0 }}>{icon}</span>}
        {shortcutIcon && <kbd style={{ opacity: 0 }} />}
        <span className="cyber-letters">
          {letters.map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </span>
      </div>
    </button>
  );
}

/**
 * CyberButton — cyberpunk button + animated modal flyout.
 *
 * Props:
 *  - label:        trigger button text
 *  - shortcut:     keyboard badge on trigger
 *  - modalTitle:   heading inside the modal
 *  - modalBody:    paragraph(s) inside the modal (string or ReactNode)
 *  - onProceed:    called when user clicks Proceed
 *  - onCancel:     called when user clicks Cancel
 *  - accent / shadow: CSS color overrides
 *  - externalOpen:    if provided, controls modal visibility externally
 *  - onExternalClose: called when modal closes (use with externalOpen)
 *  - hideTrigger:     if true, no trigger button is rendered (use with externalOpen)
 */
export default function CyberButton({
  label = "Upgrade",
  shortcut,
  icon,
  modalTitle = "Craft of UI – Pro upgrade",
  modalBody,
  onProceed,
  onCancel,
  accent,
  shadow,
  style = {},
  externalOpen,
  onExternalClose,
  hideTrigger = false,
}) {
  const isControlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled
    ? (v) => { if (!v && onExternalClose) onExternalClose(); }
    : setInternalOpen;
  const [closing, setClosing] = useState(false);
  const [closingAction, setClosingAction] = useState(null);
  const [glitchActive, setGlitchActive] = useState(false);
  const glitchTimer = useRef(null);
  const modalRef = useRef(null);
  const audioRef = useRef(null);

  // Lazily create Audio objects (can't create during SSR)
  if (typeof window !== "undefined" && !audioRef.current) {
    audioRef.current = {
      slide: new Audio("https://cdn.freesound.org/previews/367/367997_6512973-lq.mp3"),
      accept: new Audio("https://cdn.freesound.org/previews/220/220166_4100837-lq.mp3"),
      reject: new Audio("https://cdn.freesound.org/previews/657/657950_6142149-lq.mp3"),
    };
  }

  const playSound = (name) => {
    const snd = audioRef.current?.[name];
    if (snd) {
      snd.currentTime = 0;
      snd.play().catch(() => {});
    }
  };

  const cssVars = {};
  if (accent) cssVars["--accent"] = accent;
  if (shadow) cssVars["--shadow"] = shadow;

  /* Glitch loop on the modal body text */
  const kickOffGlitch = useCallback(() => {
    glitchTimer.current = setTimeout(() => {
      setGlitchActive(true);
      setTimeout(() => {
        setGlitchActive(false);
        kickOffGlitch();
      }, 2000);
    }, Math.random() * 8000 + 2000);
  }, []);

  const handleOpen = () => {
    if (!isControlled) setOpen(true);
    setClosing(false);
    setClosingAction(null);
    setTimeout(() => playSound("slide"), 200);
  };

  const handleClose = (action) => {
    setClosingAction(action);
    setClosing(true);
    playSound(action === "Proceed" ? "accept" : "reject");
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
    setTimeout(() => {
      if (!isControlled) setInternalOpen(false);
      if (onExternalClose) onExternalClose();
      setClosing(false);
      setClosingAction(null);
      if (action === "Proceed" && onProceed) onProceed();
      if (action === "Cancel" && onCancel) onCancel();
    }, 600);
  };

  useEffect(() => {
    if (open && !closing) {
      kickOffGlitch();
    }
    return () => {
      if (glitchTimer.current) clearTimeout(glitchTimer.current);
    };
  }, [open, closing, kickOffGlitch]);

  /* Play slide sound when externally opened */
  useEffect(() => {
    if (isControlled && externalOpen && !closing) {
      setClosing(false);
      setClosingAction(null);
      setTimeout(() => playSound("slide"), 200);
    }
  }, [externalOpen]);

  /* Keyboard: Escape → cancel, Enter → proceed */
  useEffect(() => {
    if (!open || closing) return;
    const handler = (e) => {
      if (e.key === "Escape") handleClose("Cancel");
      if (e.key === "Enter") handleClose("Proceed");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closing]);

  const defaultBody = (
    <>
      <p>
        You are one step away from unlocking Pro features and content.
        Your subscription will be updated in the next billing cycle.
        You will not be charged for this cycle.
      </p>
      <p>Do you want to proceed?</p>
    </>
  );

  return (
    <div className="cyber-popover-root" style={{ ...cssVars, ...style }}>
      {/* Trigger button (hidden when controlled externally) */}
      {!hideTrigger && <CyberBtn label={label} shortcut={shortcut} icon={icon} onClick={handleOpen} />}

      {/* Modal overlay — portaled to body so parent positioning can't constrain it */}
      {open && createPortal(
        <div
          className={`cyber-popover-root cyber-modal-overlay ${closing ? "cyber-modal--closing" : "cyber-modal--open"}`}
          style={cssVars}
          data-action={closingAction}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose("Cancel"); }}
        >
          <div className="cyber-modal" ref={modalRef} data-action={closingAction}>
            {/* Left sidebar bars */}
            <div className="cyber-modal__bar cyber-modal__bar--bg" />
            <div className="cyber-modal__bar cyber-modal__bar--fg" />

            {/* Body */}
            <section className="cyber-modal__body">
              <div className="cyber-modal__body-backdrop">
                <div className="cyber-backdrop">
                  <div className="cyber-modal__version">v001.e1349837856</div>
                </div>
                <div className="cyber-corner" />
              </div>
              <div className="cyber-modal__body-content">
                <h2>
                  <span>{modalTitle}</span>
                </h2>
                <div className="cyber-modal__text">
                  {modalBody || defaultBody}
                </div>
                {/* Glitch overlay on content */}
                <div
                  className={`cyber-modal__content-glitch ${glitchActive ? "cyber-modal__content-glitch--active" : ""}`}
                  aria-hidden="true"
                >
                  <h2><span>{modalTitle}</span></h2>
                  <div className="cyber-modal__text">
                    {modalBody || defaultBody}
                  </div>
                </div>
              </div>
            </section>

            {/* Action buttons */}
            <div className="cyber-modal__actions">
              <CyberBtn
                label="Cancel"
                shortcut="esc"
                onClick={() => handleClose("Cancel")}
              />
              <CyberBtn
                label="Proceed"
                shortcutIcon
                onClick={() => handleClose("Proceed")}
                autoFocus
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
