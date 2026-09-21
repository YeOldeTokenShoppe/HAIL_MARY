#!/usr/bin/env node
// THE PITCH — what the episode is going to be, before it is written.
//
// Both generators already think in two passes. The news show decides what it
// covers and then writes the dialogue; the argument show decides what the
// argument IS and then writes the dialogue. Until now only the second pass
// left anything a person could read: the first was a JSON object that went
// straight into the second prompt, so the first time you saw the editorial
// judgment was as six minutes of finished script, and disagreeing with it
// meant throwing the script away.
//
// So the first pass is now a PITCH you read first. It is saved
// (content/lt-tv/plans/<id>.json), rendered as an outline beside it
// (<id>.txt), talked over in the writers' room, and then written FROM —
// the dialogue pass takes the pitch you approved rather than starting a fresh
// one. Michelle asked for this on 2026-09-21: "it might be better if the
// writer pitches the script ideas first, perhaps with an outline, especially
// on the news line-up."
//
// WHAT THE ROOM MAY CHANGE, AND WHAT IT MAY NOT. Angles, tension, the title,
// the summary, the chiron, the running order — the judgment. NOT a story's
// fact, its sources or the board: those were verified against a real article
// in the rundown pass, and a number reworded in conversation is a number
// nobody checked. Wanting a different fact means pitching again, which is one
// call and says so.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { SHOW_FORMATS } from "./lt-tv-format.mjs";

export const PLAN_DIR = "content/lt-tv/plans";

/** News pitches are named by their week; an argument pitch by its episode. */
export const planPath = (id, root = process.cwd()) => resolve(root, PLAN_DIR, `${id}.json`);
export const planTextPath = (id, root = process.cwd()) => resolve(root, PLAN_DIR, `${id}.txt`);

/**
 * Which kind of pitch a show makes. The news show picks stories; the argument
 * shows pick an argument. Markets & Morality is the roundtable's format under
 * its own banner, so both land here as "argument".
 */
export const pitchKind = (show) => (show === "news" ? "news" : "argument");

/** The pitch for an id, or null when there is not one yet. */
export async function readPlan(id, root = process.cwd()) {
  try {
    const data = JSON.parse(await readFile(planPath(id, root), "utf8"));
    // Written by this module; older ones written by the generators are the bare
    // plan, so a file with no envelope is read as one.
    return data.plan ? data : { id, show: null, week: null, plan: data };
  } catch {
    return null;
  }
}

/** Write the pitch and the outline beside it, and say where they went. */
export async function writePlan(id, { plan, show, week = null }, root = process.cwd()) {
  const json = planPath(id, root);
  const text = planTextPath(id, root);
  await mkdir(dirname(json), { recursive: true });
  await writeFile(json, `${JSON.stringify({ id, show, week, plan }, null, 2)}\n`);
  await writeFile(text, `${renderPitch(plan, { show, id, week })}\n`);
  return { json, text };
}

// ── The outline ───────────────────────────────────────────────────────────

const pad = (label) => `${label}:`.padEnd(18);

/**
 * The pitch as a page you can read.
 *
 * Deliberately not JSON and deliberately not a screenplay: it is the thing you
 * say yes or no to. Everything the show will be about is here, and the numbers
 * carry the outlet that confirmed them, because "where did that come from" is
 * the question this show has to be able to answer.
 */
export function renderPitch(plan, { show, id, week = null } = {}) {
  const banner = (SHOW_FORMATS[show]?.title ?? "LT TV").toUpperCase();
  const head = [
    `${banner} — PITCH${week ? ` FOR ${week}` : id ? ` FOR ${id}` : ""}`,
    plan?.title ? `"${plan.title}"` : "(untitled)",
    plan?.summary ? plan.summary : "",
    "",
    "# This is the idea, not the script. Talk it over in the writers' room, then",
    "# press Write it from this pitch and the dialogue is written from THIS.",
    "# Facts, sources and the board are not editable here — they were checked",
    "# against a real article. Wanting a different one means pitching again.",
    "",
  ];

  return [...head, ...(pitchKind(show) === "news" ? newsBody(plan) : argumentBody(plan))]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function newsBody(plan) {
  const out = [];
  if (plan?.headline) out.push(`CHIRON: ${plan.headline}`, "");

  const stories = Array.isArray(plan?.stories) ? plan.stories : [];
  stories.forEach((story, i) => {
    out.push(`${i + 1}.  ${String(story.beat ?? "").toUpperCase().padEnd(12)}${story.headline ?? ""}`);
    out.push(`    ${pad("Fact")}${story.fact ?? ""}`);
    out.push(`    ${pad("They differ on")}${story.tension ?? ""}`);
    out.push(`    ${pad("Connor")}${story.connorAngle ?? ""}`);
    out.push(`    ${pad("GR80")}${story.gr80Angle ?? ""}`);
    for (const source of story.sources || []) {
      out.push(`    ${pad("Source")}${source.outlet ?? "?"} — ${source.title ?? source.url ?? ""}`);
    }
    // A story the search could not confirm is the one thing here that must not
    // be skimmed past, so it is the last line of its own block.
    if (story.verified === false) out.push(`    ${pad("NOT CONFIRMED")}${story.gaps || "no source found"}`);
    else if (story.gaps) out.push(`    ${pad("Gap")}${story.gaps}`);
    out.push("");
  });

  const board = plan?.board;
  if (board) {
    out.push("THE BOARD");
    for (const line of board.lines || []) out.push(`    ${line}`);
    if (board.market) out.push(`    ${board.market}`);
    out.push("");
  }

  if (plan?.ticker?.length) {
    out.push("TICKER, tonight's stories");
    for (const item of plan.ticker) out.push(`    ${item}`);
    out.push("");
  }
  if (plan?.sidebar?.length) {
    out.push("TICKER, everything else this week");
    for (const item of plan.sidebar) out.push(`    ${item.text ?? item}`);
    out.push("");
  }
  return out;
}

function argumentBody(plan) {
  const who = plan?.concession?.who;
  return [
    `${pad("THE QUESTION")}${plan?.question ?? ""}`,
    "",
    `${pad("WHAT IS WRONG")}${plan?.flaw ?? ""}`,
    `${pad("WITH IT")}`,
    "",
    `${pad("CONNOR'S CASE")}${plan?.connorCase ?? ""}`,
    "",
    `${pad("GR80'S REFRAME")}${plan?.gr80Reframe ?? ""}`,
    "",
    `${pad("THE HARD CASE")}${plan?.hardCase ?? ""}`,
    "",
    `${pad("WHO CONCEDES")}${who === "Monk" ? "Saint GR80" : who ?? "?"} — ${plan?.concession?.what ?? ""}`,
    "",
    `${pad("LANDS ON")}${plan?.landing ?? ""}`,
    "",
  ];
}

// ── What may be changed ───────────────────────────────────────────────────

// The judgment, not the evidence. Everything here is a sentence somebody
// wrote; everything left out is either a fact that was checked or a piece of
// structure the skeleton depends on.
const EDITABLE = {
  news: ["title", "summary", "headline"],
  argument: ["title", "summary", "question", "flaw", "connorCase", "gr80Reframe", "hardCase", "landing"],
};
const EDITABLE_PER_STORY = ["headline", "tension", "connorAngle", "gr80Angle"];

/** Every field name the room may set, for this pitch as it stands. */
export function editableFields(plan, kind) {
  const fields = [...EDITABLE[kind]];
  if (kind === "argument") fields.push("concession.who", "concession.what");
  if (kind === "news") {
    for (const story of plan?.stories || []) {
      for (const field of EDITABLE_PER_STORY) fields.push(`${story.slot}.${field}`);
    }
  }
  return fields;
}

const CONCEDERS = { connor: "Connor", "saint gr80": "Monk", gr80: "Monk", monk: "Monk" };

/**
 * Turn what the room proposed into changes that can be applied, or refuse.
 *
 * The refusal is the point as much as the change is: a field that is not in
 * the table is one the room is not allowed to touch, and "fact" is the one it
 * will reach for — so the error says why rather than just no.
 */
export function validatePitchChanges(raw, plan, kind) {
  const allowed = new Set(editableFields(plan, kind));
  const slots = (plan?.stories || []).map((s) => s.slot);
  const clean = [];

  for (const change of Array.isArray(raw) ? raw : []) {
    const op = String(change?.op ?? "");
    const why = typeof change?.why === "string" ? change.why.trim().slice(0, 160) : "";

    if (op === "set") {
      const field = String(change?.field ?? "");
      if (!allowed.has(field)) {
        const leaf = field.split(".").pop();
        if (["fact", "sources", "verified", "gaps", "board"].includes(leaf)) {
          throw new Error(
            `"${field}" is a checked fact, not an angle — the room cannot change it. Pitch again for a different one.`,
          );
        }
        throw new Error(`"${field}" is not something the pitch lets you set. It has: ${[...allowed].join(", ")}.`);
      }
      const text = typeof change?.text === "string" ? change.text.trim() : "";
      if (!text) throw new Error(`The new ${field} came back empty.`);
      if (field === "concession.who") {
        const who = CONCEDERS[text.toLowerCase()];
        if (!who) throw new Error(`"${text}" is not one of the two hosts.`);
        clean.push({ op, field, text: who, why, was: plan?.concession?.who });
        continue;
      }
      clean.push({ op, field, text, why, was: readField(plan, field) });
      continue;
    }

    if (op === "order") {
      const wanted = Array.isArray(change?.slots) ? change.slots.map(String) : [];
      if (wanted.length !== slots.length || wanted.some((s) => !slots.includes(s)) || new Set(wanted).size !== wanted.length) {
        throw new Error(`A running order has to be every story once: ${slots.join(", ")}.`);
      }
      clean.push({ op, slots: wanted, why, was: slots });
      continue;
    }

    throw new Error(`The writer asked for "${op}", which is not something a pitch can do.`);
  }
  return clean;
}

function readField(plan, field) {
  const [head, tail] = field.split(".");
  if (!tail) return plan?.[head];
  if (head === "concession") return plan?.concession?.[tail];
  return (plan?.stories || []).find((s) => s.slot === head)?.[tail];
}

/**
 * Apply the changes to a pitch, returning a new one.
 *
 * Copied rather than mutated, because the caller still holds the pitch the
 * room was looking at and a half-applied plan written over it would be a plan
 * nobody agreed to.
 */
export function applyPitchChanges(plan, changes) {
  const next = structuredClone(plan);
  const applied = [];

  for (const change of changes) {
    if (change.op === "order") {
      const by = new Map((next.stories || []).map((s) => [s.slot, s]));
      // The SLOT is the segment a story is written into, and the skeleton
      // always plays story-1, then story-2, then story-3. So reordering moves
      // the stories BETWEEN the slots; leaving them with the slots they came
      // with would reorder the list and change nothing on air.
      const canonical = [...by.keys()].sort();
      next.stories = change.slots.map((slot, i) => ({ ...by.get(slot), slot: canonical[i] }));
      applied.push(change);
      continue;
    }

    const [head, tail] = change.field.split(".");
    if (!tail) next[head] = change.text;
    else if (head === "concession") next.concession = { ...(next.concession || {}), [tail]: change.text };
    else {
      next.stories = (next.stories || []).map((s) => (s.slot === head ? { ...s, [tail]: change.text } : s));
    }
    applied.push(change);
  }

  return { plan: next, applied };
}

/** One applied change, for a person reading what happened. */
export function summarisePitch(applied) {
  if (!applied.length) return "nothing";
  return applied
    .map((c) => (c.op === "order" ? `running order: ${c.slots.join(", ")}` : `${c.field} rewritten`))
    .join(", ");
}
