import { NextResponse } from "next/server";
import { verifyToken } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

const COLLECTION = "shrineTestimonials";
const RATE_LIMIT_COLLECTION = "testimonialRateLimits";
const MAX_LEN = 200;
const HANDLE_MAX = 40;
const MAX_PER_HOUR = 5;
const MAX_PER_DAY = 20;

const BAD_WORDS = [
  "nigger", "nigga", "faggot", "fag", "tranny", "retard", "retarded",
  "kike", "spic", "chink", "gook", "wetback", "cunt", "cock",
  "rape", "raping", "kys", "kill yourself",
];
const URL_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|co|link|app|finance|fun|lol|cash|gift|money|ai|gg|club|shop|to|me)\b/i;

function err(status, reason) {
  return NextResponse.json({ ok: false, reason }, { status });
}

async function authUser(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload = await verifyToken(match[1], {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload?.sub || null;
  } catch (e) {
    console.warn("[testimonials] token verify failed:", e.message);
    return null;
  }
}

function validateShape(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { ok: false, reason: "Speak something, faithful." };
  if (trimmed.length > MAX_LEN)
    return { ok: false, reason: `Max ${MAX_LEN} characters.` };
  if (URL_RE.test(trimmed))
    return { ok: false, reason: "Links are not welcome here." };
  const lower = trimmed.toLowerCase();
  for (const word of BAD_WORDS) {
    if (lower.includes(word))
      return { ok: false, reason: "Your words were struck down." };
  }
  return { ok: true, text: trimmed };
}

// OpenAI moderation. Hard-blocks on threat/minor categories and high hate
// scores. Intentionally permissive on sexual/violence/self-harm categorical
// booleans — the shrine's tone includes a lot of dark-humor confession
// ("my wife left me", "the crash almost killed me") that OpenAI flags at
// low thresholds. Tune here if you see too many false positives/negatives.
async function moderate(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[testimonials] OPENAI_API_KEY missing — moderation skipped");
    return { ok: true };
  }
  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: text,
    });
    const r = res?.results?.[0];
    if (!r) return { ok: true };
    const cats = r.categories || {};
    const scores = r.category_scores || {};

    const hardCategorical = [
      "sexual/minors",
      "hate/threatening",
      "harassment/threatening",
      "self-harm/instructions",
    ];
    for (const k of hardCategorical) {
      if (cats[k]) return { ok: false, reason: "Your words were struck down." };
    }
    if ((scores["hate"] ?? 0) >= 0.5)
      return { ok: false, reason: "Your words were struck down." };
    if (r.flagged) {
      const max = Math.max(...Object.values(scores).map((n) => Number(n) || 0));
      if (max >= 0.85)
        return { ok: false, reason: "Your words were struck down." };
    }
    return { ok: true };
  } catch (e) {
    // Fail-open on provider outages so the shrine stays usable; shape +
    // bad-word list still ran. Re-evaluate if abuse appears.
    console.warn("[testimonials] moderation call failed:", e.message);
    return { ok: true };
  }
}

async function checkAndRecordRate(db, userId) {
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(userId);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const hourAgo = now - 60 * 60 * 1000;
      const prev = snap.exists ? snap.data().posts || [] : [];
      const recent = prev.filter((t) => t > dayAgo);
      const inHour = recent.filter((t) => t > hourAgo).length;
      if (inHour >= MAX_PER_HOUR) throw new Error("RATE_HOUR");
      if (recent.length >= MAX_PER_DAY) throw new Error("RATE_DAY");
      recent.push(now);
      tx.set(ref, {
        posts: recent.slice(-MAX_PER_DAY),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    if (e.message === "RATE_HOUR")
      return { ok: false, reason: "Slow down — wait an hour before testifying again." };
    if (e.message === "RATE_DAY")
      return { ok: false, reason: "You've reached today's limit. Return tomorrow." };
    throw e;
  }
}

export async function POST(request) {
  const userId = await authUser(request);
  if (!userId) return err(401, "Sign in to speak.");

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Malformed request.");
  }
  const { text, displayName, avatarUrl, lit } = body || {};

  const v = validateShape(text);
  if (!v.ok) return err(400, v.reason);

  const handle = String(displayName ?? "").trim().slice(0, HANDLE_MAX);
  if (!handle) return err(400, "Name yourself, faithful.");

  const m = await moderate(v.text);
  if (!m.ok) return err(400, m.reason);

  const db = getAdminDb();
  if (!db) return err(500, "The shrine is unreachable.");

  const rate = await checkAndRecordRate(db, userId);
  if (!rate.ok) return err(429, rate.reason);

  try {
    const docRef = await db.collection(COLLECTION).add({
      userId,
      displayName: handle,
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
      text: v.text,
      lit: !!lit,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e) {
    console.error("[testimonials] create failed:", e);
    return err(500, "Your witness was lost in transit.");
  }
}

export async function PATCH(request) {
  const userId = await authUser(request);
  if (!userId) return err(401, "Sign in to speak.");

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Malformed request.");
  }
  const { id, text, displayName, avatarUrl } = body || {};
  if (!id || typeof id !== "string") return err(400, "Nothing to update.");

  const db = getAdminDb();
  if (!db) return err(500, "The shrine is unreachable.");

  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return err(404, "That witness has faded.");
  if (snap.data().userId !== userId)
    return err(403, "That witness is not yours to change.");

  const patch = {};
  if (typeof text === "string") {
    const v = validateShape(text);
    if (!v.ok) return err(400, v.reason);
    const m = await moderate(v.text);
    if (!m.ok) return err(400, m.reason);
    patch.text = v.text;
  }
  if (typeof displayName === "string") {
    const handle = displayName.trim().slice(0, HANDLE_MAX);
    if (!handle) return err(400, "Name yourself, faithful.");
    patch.displayName = handle;
  }
  if (typeof avatarUrl === "string" || avatarUrl === null) {
    patch.avatarUrl = avatarUrl;
  }
  if (!Object.keys(patch).length) return err(400, "Nothing to update.");

  try {
    await ref.update(patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[testimonials] update failed:", e);
    return err(500, "Your edit was struck down.");
  }
}

export async function DELETE(request) {
  const userId = await authUser(request);
  if (!userId) return err(401, "Sign in to speak.");

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Malformed request.");
  }
  const { id } = body || {};
  if (!id || typeof id !== "string") return err(400, "Nothing to delete.");

  const db = getAdminDb();
  if (!db) return err(500, "The shrine is unreachable.");

  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ ok: true });
  if (snap.data().userId !== userId)
    return err(403, "That witness is not yours to retract.");

  try {
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[testimonials] delete failed:", e);
    return err(500, "Could not retract your witness.");
  }
}
