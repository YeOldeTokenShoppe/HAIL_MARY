import { NextResponse } from "next/server";
import { db, doc, getDoc } from "@/lib/firebaseServer";

export async function POST(req) {
  try {
    const { userId, downloadUrl, eventId, eventType, col, row } = await req.json();

    if (!userId || !downloadUrl) {
      return NextResponse.json({ ok: false, error: "Missing userId or downloadUrl" }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || !db) {
      return NextResponse.json({ ok: false, error: "Telegram not configured" }, { status: 503 });
    }

    const tgDoc = await getDoc(doc(db, "oilTelegram", userId));
    if (!tgDoc.exists()) {
      return NextResponse.json({ ok: false, error: "No Telegram link" }, { status: 404 });
    }

    const { chatId } = tgDoc.data();
    if (!chatId) {
      return NextResponse.json({ ok: false, error: "No chatId" }, { status: 404 });
    }

    const label = eventType === "gusher" ? "GUSHER" : "ROGUE INTRUSION";
    const caption = `📹 CCTV FOOTAGE — Plot (${Number(col) + 1}, ${Number(row) + 1})\n${label} recorded.\nEvent: ${eventId || "unknown"}`;

    const videoRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        video: downloadUrl,
        caption,
        supports_streaming: true,
      }),
    });

    const videoData = await videoRes.json();

    if (videoData.ok) {
      return NextResponse.json({ ok: true, method: "sendVideo" });
    }

    // Fallback: sendDocument for formats Telegram can't inline-play
    const docRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        document: downloadUrl,
        caption,
      }),
    });

    const docData = await docRes.json();

    if (docData.ok) {
      return NextResponse.json({ ok: true, method: "sendDocument" });
    }

    // Last resort: send as a text link
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${caption}\n\n🎥 Watch: ${downloadUrl}`,
      }),
    });

    return NextResponse.json({ ok: true, method: "sendMessage" });
  } catch (err) {
    console.error("[oil-telegram-cctv] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
