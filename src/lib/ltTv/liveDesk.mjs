// THE LIVE Q&A DESK, the part both halves agree on.
//
// A live show on LT TV is the set's own characters taking a viewer's question
// and answering it in character, on the set, within seconds. Nothing is
// recorded and nothing is uploaded: the words come from Claude and the voice
// and the lip-sync come from SitePal's live speech (`sayText`, engine 14 —
// ElevenLabs through SitePal, the same call the card game's seats already
// speak with in their own voices; see docs/sitepal.md, Speech Functions).
//
// This file is the RULES, with no model and no browser in it, so the route
// that writes an answer and the desk that performs it cannot disagree about
// who is on which set, how long a question may be, or what a usable answer
// looks like. Tested by scripts/lt-tv-live.test.mjs.
//
// WHY ONE BROWSER. Live speech is generated per playback, and every viewer's
// browser is a playback — so a show spoken inside every viewer's page costs
// once per viewer. The live show is performed in ONE browser (the producer's)
// and broadcast from there, which is Michelle's plan: "i could run it from my
// computer for the live show." So this desk is a producer's tool and never a
// viewer's.

/**
 * Who sits at which desk, and who reads the question out.
 *
 * The reader is whoever holds that show's running order: Holly on the news
 * ("it is her desk and his show"), Connor as host of Markets & Morality.
 * Actor keys are the rig keys (`Monk` is Saint GR80), because those are what
 * the set's portals are keyed by.
 */
export const LIVE_SHOWS = {
  news: { title: "LT Weekly News Recap", actors: ["Holly", "Connor"], reader: "Holly" },
  morality: { title: "Markets & Morality", actors: ["Connor", "Monk"], reader: "Connor" },
};

export const liveShowFor = (show) => (LIVE_SHOWS[show] ? show : null);

// What a viewer meets, for the desk's own labels.
export const LIVE_NAMES = { Connor: "Connor", Monk: "GR80", Holly: "Holly" };

// SitePal's live speech arguments. Language 1 is English; engine 14 is
// ElevenLabs, and the voice argument is then the ElevenLabs voice id itself —
// the same ids the recorded episodes use (CAST in scripts/lt-tv-format.mjs).
export const LIVE_TTS = { lang: 1, engine: 14 };

export const MAX_NAME_CHARS = 32;
export const MAX_QUESTION_CHARS = 280;
export const MAX_LINES = 6;
// A line is spoken in one sayText call. SitePal counts a string over 900
// characters as two streams, and a character talking for half a minute
// without the other one speaking is not a conversation anyway.
export const MAX_LINE_CHARS = 450;

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/** One line of plain text, trimmed and capped. Never throws. */
function tidy(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** A viewer's question as the desk and the model will see it, or "". */
export function cleanQuestion(text) {
  // Angle brackets go so a question cannot close the tags the writer is told
  // mark out the viewer's words. Nobody reads one aloud anyway.
  return tidy(typeof text === "string" ? text.replace(/[<>]/g, " ") : "", MAX_QUESTION_CHARS);
}

/** Who asked, as it will be read out. Falls back to "a viewer". */
export function cleanName(text) {
  // Handles arrive as @name, u/name and the like; the characters read names
  // aloud, so the sigils go.
  const name = tidy(text, MAX_NAME_CHARS).replace(/^[@#/]+|^u\//i, "").trim();
  return name || "a viewer";
}

/**
 * Makes a line safe to hand to SitePal's live speech.
 *
 * Bracketed delivery tags ("[smug]") are how the recorded episodes steer
 * ElevenLabs v3, and SitePal's engine-14 proxy REJECTS them (noted in
 * src/app/vigil/page.js, July 2026), so they are stripped rather than risked.
 * Markdown and speaker labels are stripped because they would be read out.
 */
export function speakable(text, speakerNames = []) {
  let out = tidy(text, MAX_LINE_CHARS * 2)
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[*_`#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const name of speakerNames) {
    const label = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i");
    out = out.replace(label, "");
  }
  return out.slice(0, MAX_LINE_CHARS).trim();
}

/**
 * The model's reply, checked and reduced to lines the set can speak.
 *
 * Returns `{ lines: [{ speaker, text }] }` or `{ error }`. Never throws: the
 * producer sees the error on the question's card and can ask again.
 *
 * A speaker the set does not seat is DROPPED, not reassigned — a line given to
 * the wrong mouth reads as a cast decision nobody made. An answer that ends up
 * with no lines at all is an error.
 */
export function readExchange(parsed, show) {
  const cfg = LIVE_SHOWS[show];
  if (!cfg) return { error: `Not a live show: ${String(show).slice(0, 20)}` };
  const raw = Array.isArray(parsed?.lines) ? parsed.lines : null;
  if (!raw) return { error: "The writer did not return any lines." };

  const byName = new Map();
  for (const actor of cfg.actors) {
    byName.set(actor.toLowerCase(), actor);
    byName.set(LIVE_NAMES[actor].toLowerCase(), actor);
  }
  byName.set("saint gr80", "Monk");
  byName.set("holly jones", "Holly");
  const labels = [...new Set([...cfg.actors, ...cfg.actors.map((a) => LIVE_NAMES[a]), "Saint GR80", "Holly Jones"])];

  const lines = [];
  for (const entry of raw) {
    if (lines.length >= MAX_LINES) break;
    const speaker = byName.get(String(entry?.speaker ?? "").trim().toLowerCase());
    if (!speaker || !cfg.actors.includes(speaker)) continue;
    const text = speakable(entry?.text, labels);
    if (!text) continue;
    lines.push({ speaker, text });
  }
  if (!lines.length) return { error: "The writer's answer had no lines for anyone on this set." };
  return { lines };
}

// 145 words a minute is what the episode pipeline plans runtime with
// (ESTIMATED_WPM in scripts/lt-tv-format.mjs).
const WORDS_PER_SECOND = 145 / 60;

/** Roughly how long a line takes to say, in seconds. */
export function spokenSeconds(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean).length;
  return words / WORDS_PER_SECOND;
}

/**
 * How long the desk waits for a line to be heard to end before moving on.
 *
 * SitePal reports the end of speech (`vh_talkEnded`), and the desk goes on
 * that. This is only the failsafe for a portal that never reports: generous,
 * because cutting a character off mid-sentence is worse than a pause, and
 * because live speech has to be generated before it starts.
 */
export function lineTimeoutMs(text) {
  return Math.round((spokenSeconds(text) * 1.8 + 12) * 1000);
}
