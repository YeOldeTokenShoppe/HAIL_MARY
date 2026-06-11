import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Player alert fan-out — ONE call reaches every channel the player linked:
//   · Telegram (oilTelegram/{userId}.chatId, HTML formatting)
//   · Web push  (oilPush/{userId}.tokens via FCM; data-only payloads, the
//     service worker renders them — see public/firebase-messaging-sw.js)
// Channels are independent and best-effort: a dead chat or expired token never
// throws into the caller (the strike loop must not break over a notification).
// Pass the admin db (getAdminDb()) — the admin app must already be initialized,
// which getAdminDb guarantees, so getMessaging() resolves the default app.

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export async function sendPlayerAlert(db, userId, {
  title,
  body,
  url = "/hailmary",
  tag = "hmpc-alert",
  telegramHtml = null,          // defaults to <b>title</b>\nbody
  channels = { telegram: true, push: true },
}) {
  const [, push] = await Promise.all([
    channels.telegram !== false ? sendTelegram(db, userId, telegramHtml || `<b>${title}</b>\n${body}`) : null,
    channels.push !== false ? sendPush(db, userId, { title, body, url, tag }) : null,
  ]);
  // Per-channel stats for diagnostics (the test-ping route surfaces these);
  // production callers can ignore the return value.
  return { push: push || { tokens: 0, sent: 0, failed: 0, errors: [] } };
}

async function sendTelegram(db, userId, html) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    const linkSnap = await db.collection("oilTelegram").doc(userId).get();
    const chatId = linkSnap.exists ? linkSnap.data().chatId : null;
    if (!chatId) return;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[oilAlerts] telegram send failed:", err.message);
  }
}

async function sendPush(db, userId, { title, body, url, tag }) {
  try {
    const snap = await db.collection("oilPush").doc(userId).get();
    const tokens = snap.exists ? snap.data().tokens || [] : [];
    if (!tokens.length) return { tokens: 0, sent: 0, failed: 0, errors: [] };

    const res = await getMessaging().sendEachForMulticast({
      tokens,
      // Data-only (every value must be a string): the SW shows the
      // notification, so there's no auto-display double-fire.
      data: { title: String(title), body: String(body), url: String(url), tag: String(tag) },
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    });

    const dead = [];
    const errors = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        errors.push(r.error?.code || "unknown");
        if (DEAD_TOKEN_CODES.has(r.error?.code)) dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      await db.collection("oilPush").doc(userId).set(
        { tokens: FieldValue.arrayRemove(...dead), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    if (errors.length) console.error("[oilAlerts] push errors:", errors.join(", "));
    return { tokens: tokens.length, sent: res.successCount, failed: res.failureCount, errors };
  } catch (err) {
    console.error("[oilAlerts] push send failed:", err.message);
    return { tokens: -1, sent: 0, failed: 0, errors: [err.message] };
  }
}
