"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  postTestimonial,
  subscribeUserTestimonials,
  updateTestimonial,
  deleteTestimonial,
} from "@/lib/testimonials";
import "./testimonials.css";

const MAX_LEN = 200;
const HANDLE_MAX = 40;
const HANDLE_STORAGE_KEY = "rl80.shrineHandle";

// Preferred default when the modal first opens for a user: the one they
// explicitly saved, then Clerk's username/firstName — NOT fullName, since
// most users won't want their legal name on the ledger.
function defaultHandle(user) {
  if (!user) return "";
  try {
    const stored = localStorage.getItem(`${HANDLE_STORAGE_KEY}:${user.id}`);
    if (stored) return stored;
  } catch {}
  return user.username || user.firstName || "";
}

function relativeTime(ms) {
  if (!ms) return "";
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function InscribeModal({ isOpen, onClose, candleLit }) {
  const { user, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const [text, setText] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // If set, submit will UPDATE this testimonial id instead of creating.
  const [editingId, setEditingId] = useState(null);
  const [userItems, setUserItems] = useState([]);
  const taRef = useRef(null);
  // Portal so the modal escapes .shrine-page.neon's forced `position:
  // relative` rule, same reason as TestimonialToasts.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Reset on open.
  useEffect(() => {
    if (!isOpen) return;
    setText("");
    setError(null);
    setBusy(false);
    setEditingId(null);
    setHandle(defaultHandle(user));
    const t = setTimeout(() => taRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen, user]);

  // Escape closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Subscribe to the current user's testimonies while the modal is open so
  // edits/deletes reflect immediately.
  useEffect(() => {
    if (!isOpen || !user?.id) {
      setUserItems([]);
      return;
    }
    const unsub = subscribeUserTestimonials(user.id, setUserItems);
    return unsub;
  }, [isOpen, user?.id]);

  if (!isOpen || !mounted) return null;

  const canPost = isSignedIn && candleLit;
  const trimmedHandle = handle.trim();
  const trimmedText = text.trim();
  // Valid if both handle and text have content. Edit mode doesn't require
  // the text to have changed; a handle-only update is fine.
  const canSubmit = canPost && trimmedHandle && trimmedText && !busy;

  const persistHandle = (h) => {
    if (!user?.id) return;
    try {
      localStorage.setItem(`${HANDLE_STORAGE_KEY}:${user.id}`, h);
    } catch {}
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    persistHandle(trimmedHandle);
    const res = editingId
      ? await updateTestimonial(editingId, {
          text: trimmedText,
          displayName: trimmedHandle,
        })
      : await postTestimonial({
          userId: user?.id,
          displayName: trimmedHandle,
          avatarUrl: user?.imageUrl ?? null,
          text: trimmedText,
          lit: !!candleLit,
        });
    setBusy(false);
    if (res.ok) {
      setText("");
      setEditingId(null);
      // Keep the modal open so users see their post in the list —
      // but close on first post so the toast stack can surface it.
      if (!editingId) onClose();
    } else {
      setError(res.reason || "Something went wrong.");
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setText(item.text ?? "");
    setHandle(item.displayName ?? trimmedHandle);
    setError(null);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setText("");
    setError(null);
  };

  const handleDelete = async (item) => {
    if (busy) return;
    const ok = window.confirm("Retract this witness?");
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await deleteTestimonial(item.id);
    setBusy(false);
    if (!res.ok) setError(res.reason || "Could not retract.");
    // If we were editing the one we just deleted, clear the form.
    if (editingId === item.id) {
      setEditingId(null);
      setText("");
    }
  };

  return createPortal(
    <div className="tst-modal-backdrop" onClick={onClose}>
      <div
        className="tst-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="tst-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="tst-modal-eyebrow">Liber Testium</div>
        <h2 className="tst-modal-title">
          {editingId ? "Revise Your Witness" : "Speak Your Witness"}
        </h2>

        {canPost ? (
          <>
            <div className="tst-modal-subhead">
              <span className="tst-candle-dot" />
              <span>Your candle burns</span>
            </div>

            <label className="tst-field-label" htmlFor="tst-handle-input">
              Signed as
            </label>
            <div className="tst-handle-row">
              <div className="tst-handle-avatar">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt="" />
                ) : (
                  (trimmedHandle[0] || "?").toUpperCase()
                )}
              </div>
              <input
                id="tst-handle-input"
                className="tst-handle-input"
                type="text"
                maxLength={HANDLE_MAX}
                placeholder="Brother / Sister ___"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={busy}
              />
            </div>

            <textarea
              ref={taRef}
              className="tst-modal-textarea"
              maxLength={MAX_LEN}
              placeholder="Confess a miracle. Praise the Lady. Warn the unfaithful…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
            {error && <div className="tst-modal-error">{error}</div>}
            <div className="tst-modal-footer">
              <span className="tst-modal-count">
                {text.length} / {MAX_LEN}
              </span>
              <div className="tst-modal-actions">
                {editingId && (
                  <button
                    type="button"
                    className="tst-modal-btn tst-ghost"
                    onClick={handleCancelEdit}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className="tst-modal-btn"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {busy
                    ? editingId
                      ? "Revising…"
                      : "Inscribing…"
                    : editingId
                    ? "Save"
                    : "Inscribe"}
                </button>
              </div>
            </div>

            {userItems.length > 0 && (
              <div className="tst-mine">
                <div className="tst-mine-head">Your Witness</div>
                <ul className="tst-mine-list">
                  {userItems.map((item) => (
                    <li
                      key={item.id}
                      className={`tst-mine-item ${
                        editingId === item.id ? "editing" : ""
                      }`}
                    >
                      <p className="tst-mine-text">{item.text}</p>
                      <div className="tst-mine-meta">
                        <span className="tst-mine-time">
                          {relativeTime(item.createdAtMs)}
                        </span>
                        <div className="tst-mine-buttons">
                          <button
                            type="button"
                            className="tst-mine-btn"
                            onClick={() => handleEdit(item)}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="tst-mine-btn tst-mine-btn-danger"
                            onClick={() => handleDelete(item)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : !isSignedIn ? (
          <div className="tst-modal-gate">
            <p>Sign in to inscribe your witness to the shrine ledger.</p>
            <button
              type="button"
              className="tst-modal-btn"
              onClick={() => {
                openSignIn();
                onClose();
              }}
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="tst-modal-gate">
            <p>Light a candle to speak.</p>
            <button type="button" className="tst-modal-btn" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
