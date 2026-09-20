#!/usr/bin/env node
// THE HOUSE NOTES — what the writer is told to remember between episodes.
//
// Deleting a bad line fixes one episode. The writer starts the next one
// knowing nothing about it and writes the same line again. This is the file
// that stops that: a rule written here is added to the writer's instructions
// on every future episode of both shows.
//
//   docs/lt-tv-style-notes.md
//
// Only the bullets under "## Rules" are sent. Everything else in the file —
// the explanation at the top, examples, anything struck through in prose — is
// for the person reading it, which means the file can explain itself without
// the explanation leaking into the prompt.
//
// A missing or empty file is the normal state, not an error: it simply adds
// nothing, and every generator behaves exactly as it did before.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const STYLE_NOTES_PATH = "docs/lt-tv-style-notes.md";

const RULES_HEADING = /^##\s+Rules\s*$/i;
const ANY_HEADING = /^##\s+/;
const BULLET = /^-\s+(.*\S)\s*$/;

/**
 * The rules in a notes file, in order.
 *
 * Scoped to the "## Rules" section so the prose above it stays prose. A fenced
 * example elsewhere in the file cannot become a rule by starting with a dash,
 * which is the mistake a whole-file bullet scan would make.
 */
export function parseStyleNotes(text) {
  const rules = [];
  let inRules = false;
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (RULES_HEADING.test(line)) { inRules = true; continue; }
    if (inRules && ANY_HEADING.test(line)) { inRules = false; continue; }
    if (!inRules) continue;
    const m = line.match(BULLET);
    if (m) rules.push(m[1]);
  }
  return rules;
}

/** The rules as written, or an empty list when there is no file yet. */
export async function readStyleNotes(root = process.cwd()) {
  try {
    return parseStyleNotes(await readFile(resolve(root, STYLE_NOTES_PATH), "utf8"));
  } catch {
    return [];
  }
}

/**
 * A system prompt with the house notes appended.
 *
 * They go last, after the show's own instructions, because they are
 * corrections to it: a note exists because something the prompt allowed turned
 * out to be wrong on air.
 */
export function withStyleNotes(system, rules) {
  if (!rules || rules.length === 0) return system;
  return [
    system,
    "",
    "HOUSE NOTES",
    "Standing corrections from the producer, written after watching episodes",
    "go out. They override anything above that disagrees with them, and they",
    "apply to every line you write.",
    "",
    ...rules.map((r) => `- ${r}`),
  ].join("\n");
}

/**
 * Add a rule to the notes file, and say whether it was new.
 *
 * Appending under the heading rather than at the end of the file keeps the
 * rules together however much prose accumulates below them. A duplicate is a
 * no-op, so marking the same fault in three episodes does not write it three
 * times.
 */
export async function rememberStyleNote(note, root = process.cwd()) {
  const rule = String(note).trim().replace(/\s+/g, " ");
  if (!rule) return { added: false, reason: "empty" };

  const path = resolve(root, STYLE_NOTES_PATH);
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return { added: false, reason: "no notes file" };
  }

  if (parseStyleNotes(text).some((r) => r.toLowerCase() === rule.toLowerCase())) {
    return { added: false, reason: "already there" };
  }

  const lines = text.split("\n");
  const at = lines.findIndex((l) => RULES_HEADING.test(l.trim()));
  if (at === -1) return { added: false, reason: "no Rules heading" };

  // After the heading and the blank line under it, and after any rules already
  // there, so the newest sits at the bottom of the list rather than the top.
  let insert = at + 1;
  while (insert < lines.length && !ANY_HEADING.test(lines[insert].trim())) {
    if (BULLET.test(lines[insert].trim())) insert += 1;
    else if (lines[insert].trim() === "") insert += 1;
    else break;
  }
  while (insert > at + 1 && lines[insert - 1].trim() === "") insert -= 1;

  lines.splice(insert, 0, `- ${rule}`);
  await writeFile(path, lines.join("\n"));
  return { added: true, rule };
}
