'use client';

import { useState, useEffect, useCallback } from 'react';

// Survives a same-tab page reload (OAuth roundtrip for embedded-wallet
// social sign-in, mobile wallet deep-link return). Doesn't leak across
// tabs or browser sessions, and is bounded by TTL so stale state doesn't
// cause a modal to surprise-reopen on unrelated navigation hours later.
const STORAGE_KEY = 'rl80_buyModalOpen';
const STORAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes — covers any OAuth roundtrip with margin

/**
 * Drop-in replacement for `useState(false)` that backs BuyModal's open
 * state with sessionStorage. After the modal opens, an OAuth roundtrip or
 * mobile wallet deep-link can reload the page; on remount this hook
 * restores the open state so the user lands back inside the modal where
 * they left off, instead of having to reopen it manually.
 *
 * Usage:
 *   const [showBuyModal, setShowBuyModal] = useBuyModal();
 *   ...
 *   <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
 */
export function useBuyModal() {
  const [isOpen, setIsOpen] = useState(false);

  // Restore on mount (client-only — sessionStorage doesn't exist on the server)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const ts = parseInt(raw, 10);
      if (!Number.isFinite(ts) || Date.now() - ts > STORAGE_TTL_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      setIsOpen(true);
    } catch {
      // sessionStorage may be blocked (Safari private mode, etc.) — silent fail
    }
  }, []);

  // Mirror state into sessionStorage so it survives a reload in the same tab
  useEffect(() => {
    try {
      if (isOpen) sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [isOpen]);

  // Stable setter so consumers can pass it as a callback without churn
  const setStable = useCallback((next) => {
    setIsOpen((prev) =>
      typeof next === 'function' ? next(prev) : next
    );
  }, []);

  return [isOpen, setStable];
}
