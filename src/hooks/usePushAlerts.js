"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { app } from "@/lib/firebaseClient";
import { useOilApiFetch } from "@/lib/oilApiClient";

// Web-push enrollment for strike alerts (FCM). One tap on the device in hand —
// no account linking, which makes it the lowest-friction alert channel.
//
// Platform notes:
//  · Desktop + Android: works straight from the tab.
//  · iOS: Safari only exposes the Push API to sites INSTALLED via Add to Home
//    Screen — `needsInstall` flags that state so the UI can show instructions.
//
// State: `enabled` means this device successfully registered a token this
// session (or a prior session, re-validated silently on mount). The server
// keeps up to 10 tokens per user (one per device) in oilPush/{userId}.

const FLAG = "oil_push_enabled_v1";

function swUrl() {
  const p = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  });
  return `/firebase-messaging-sw.js?${p.toString()}`;
}

export default function usePushAlerts({ active = true } = {}) {
  const oilApiFetch = useOilApiFetch();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [env, setEnv] = useState({ supported: false, needsInstall: false });
  const refreshedRef = useRef(false);

  // Platform detection (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS lies
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches
      || window.navigator.standalone === true;
    const pushCapable = "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
    setEnv({
      supported: pushCapable,
      needsInstall: isIOS && !standalone && !pushCapable,
    });
  }, []);

  const foregroundBoundRef = useRef(false);
  const register = useCallback(async () => {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) throw new Error("push not configured");
    if (!app) throw new Error("firebase unavailable");
    const { getMessaging, getToken, onMessage, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) throw new Error("push unsupported in this browser");

    const reg = await navigator.serviceWorker.register(swUrl());
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });
    if (!token) throw new Error("no token (permission denied?)");

    // Foreground messages bypass the SW's onBackgroundMessage — without this
    // handler a push that arrives while the tab is FOCUSED shows nothing
    // (exactly the case when someone clicks "send test ping" and waits).
    if (!foregroundBoundRef.current) {
      foregroundBoundRef.current = true;
      onMessage(messaging, (payload) => {
        const d = payload.data || {};
        reg.showNotification(d.title || "⛏ Hail Mary Prospecting Co.", {
          body: d.body || "",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: d.tag || "hmpc-alert",
          data: { url: d.url || "/hailmary" },
        });
      });
    }

    const res = await oilApiFetch("/api/oil-push-subscribe", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error("subscribe failed");
    try { localStorage.setItem(FLAG, "1"); } catch { /* private mode */ }
    setEnabled(true);
  }, [oilApiFetch]);

  // Silent re-validation on mount: permission already granted + previously
  // enrolled → refresh the token (FCM rotates them) without prompting.
  useEffect(() => {
    if (!active || refreshedRef.current || !env.supported) return;
    let flagged = false;
    try { flagged = localStorage.getItem(FLAG) === "1"; } catch { /* private mode */ }
    if (!flagged || Notification.permission !== "granted") return;
    refreshedRef.current = true;
    setEnabled(true); // optimistic — the refresh below corrects on failure
    register().catch(() => setEnabled(false));
  }, [active, env.supported, register]);

  // The user-facing enable action (triggers the permission prompt).
  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await register();
    } catch (err) {
      setError(
        typeof Notification !== "undefined" && Notification.permission === "denied"
          ? "Notifications are blocked for this site — enable them in browser settings."
          : err.message || "failed",
      );
    } finally {
      setBusy(false);
    }
  }, [register]);

  // Opt this device back out: remove the token server-side, invalidate it with
  // FCM, clear the local flag. Best-effort throughout — even if the network
  // calls fail, the local state flips off and the token dies on FCM's side
  // the next time a send hits it (dead-token pruning in oilAlerts).
  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { getMessaging, getToken, deleteToken } = await import("firebase/messaging");
      const messaging = getMessaging(app);
      const reg = await navigator.serviceWorker.register(swUrl());
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg,
      }).catch(() => null);
      if (token) {
        await oilApiFetch("/api/oil-push-subscribe", {
          method: "DELETE",
          body: JSON.stringify({ token }),
        }).catch(() => {});
        await deleteToken(messaging).catch(() => {});
      }
    } catch { /* best-effort */ }
    try { localStorage.removeItem(FLAG); } catch { /* private mode */ }
    refreshedRef.current = true; // don't silently re-enroll this session
    setEnabled(false);
    setBusy(false);
  }, [oilApiFetch]);

  // Fire a self-test push to this user's devices (verifies the full pipeline).
  const [testState, setTestState] = useState(null); // null | "sending" | "sent" | "failed"
  const [testDetail, setTestDetail] = useState(null); // FCM outcome ("1 device" / error code)
  const sendTest = useCallback(async () => {
    setTestState("sending");
    setTestDetail(null);
    try {
      const res = await oilApiFetch("/api/oil-push-test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setTestState("sent");
        setTestDetail(`${data.sent} device${data.sent === 1 ? "" : "s"}`);
      } else {
        setTestState("failed");
        setTestDetail(
          data.tokens === 0
            ? "no device registered — re-enable push"
            : data.errors?.length
              ? data.errors[0]
              : data.error || "send failed",
        );
      }
    } catch {
      setTestState("failed");
      setTestDetail("network error");
    }
    setTimeout(() => { setTestState(null); setTestDetail(null); }, 8000);
  }, [oilApiFetch]);

  return { ...env, enabled, busy, error, enable, disable, sendTest, testState, testDetail };
}
