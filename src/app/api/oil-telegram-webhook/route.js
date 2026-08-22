import { NextResponse } from "next/server";
import { db, doc, setDoc, serverTimestamp } from "@/lib/firebaseServer";

export async function POST(req) {
  try {
    // Authenticate the caller as Telegram. Telegram echoes the `secret_token`
    // set at setWebhook time in this header on every delivery. Without this,
    // anyone could POST `/start <victimClerkId>` and bind a victim's account to
    // their own chat. Fails closed: if the secret isn't configured, reject.
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const provided = req.headers.get("x-telegram-bot-api-secret-token");
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const update = await req.json();
    const message = update.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true }); // ignore non-message updates
    }

    const chatId = message.chat.id;
    const username = message.from?.username || null;
    const text = message.text.trim();

    // Handle /start {clerkUserId}
    if (text.startsWith("/start ")) {
      const clerkUserId = text.replace("/start ", "").trim();
      if (!clerkUserId || !db) {
        return NextResponse.json({ ok: true });
      }

      // Save linking
      await setDoc(doc(db, "oilTelegram", clerkUserId), {
        chatId,
        username,
        linkedAt: serverTimestamp(),
      });

      // Send confirmation
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "✅ Telegram linked! You'll receive security alerts when rogues visit your camera-equipped plots.",
          }),
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Default reply for unrecognized commands
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Use the 'Link Telegram' button at Hail Mary Prospecting Co. (rl80.com/hailmary) to connect your account.",
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[oil-telegram-webhook] Error:", err);
    return NextResponse.json({ ok: true }); // always return 200 to Telegram
  }
}
