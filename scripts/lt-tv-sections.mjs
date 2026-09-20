#!/usr/bin/env node
// WHERE TO CUT AN EPISODE SO SITEPAL WILL PLAY IT.
//
// SitePal will not play a clip longer than 90 seconds. That is its own limit,
// not a plan one, and it applies to every account — so an episode of any real
// length cannot go up as one clip per character. It goes up as several, and
// the set plays them in order.
//
// The Halo Effect is 59 seconds and fit under the ceiling by accident, which
// is why nothing in this pipeline knew about it until an episode ran to four
// and a half minutes.
//
// WHERE A CUT GOES. Never inside a line. A section boundary lands in the
// silence between two lines, at its midpoint, so each section opens and closes
// on a breath: the join sounds like a pause someone took rather than a tape
// splice. It also means the two characters' sections are cut at the same
// instants, which is what keeps them together — they are the same timeline
// twice, not two things to line up.
//
// WHY 85 AND NOT 90. Every join is a risk, so fewer is better and the target
// is as close to the ceiling as is safe. The five seconds are for the
// arithmetic being about the WORDS: a section's audio runs a little past its
// last line's end, and a measured file that came back a second longer than the
// timings said would be refused by SitePal rather than clipped. Michelle chose
// 85 over SitePal's recommended 60 on 2026-09-20, to keep the number of joins
// down.

import { sitepalClipName } from "./lt-tv-format.mjs";

export const SITEPAL_MAX_CLIP_SECONDS = 90;
export const TARGET_SECTION_SECONDS = 85;

/**
 * Cut points for one episode, from the times its lines actually landed.
 *
 * Greedy and forward-only: take lines until one more would push the section
 * past the target, then cut. Greedy is right here because the only thing being
 * optimised is the NUMBER of joins, and taking as much as fits each time
 * cannot produce more sections than any other rule would.
 *
 * @param lineStarts  seconds, one per line, ascending
 * @param lineEnds    seconds, one per line
 * @param dialogueEnd seconds; where the last section ends
 * @param max         longest a section may be
 * @returns [{ startsAt, endsAt, firstLine, lastLine }], always at least one
 */
export function planSections(lineStarts, lineEnds, dialogueEnd, max = TARGET_SECTION_SECONDS) {
  if (!Array.isArray(lineStarts) || lineStarts.length === 0) {
    throw new Error("planSections needs the line starts from a recorded episode.");
  }
  const end = Number.isFinite(dialogueEnd) ? dialogueEnd : lineEnds[lineEnds.length - 1];

  const sections = [];
  let startsAt = 0;
  let firstLine = 0;

  for (let i = 1; i < lineStarts.length; i += 1) {
    // Would this line still be inside the section? Measured to where the line
    // ENDS, because a section has to contain the whole of what it carries.
    if (lineEnds[i] - startsAt <= max) continue;

    // It would not. Cut in the gap before it — halfway, so neither side eats
    // the other's breath. A line that starts before the previous one ended
    // (they overlap, or the timings are noisy) cuts at the start.
    const gapFrom = lineEnds[i - 1];
    const gapTo = lineStarts[i];
    const boundary = gapTo > gapFrom ? (gapFrom + gapTo) / 2 : gapTo;

    sections.push({ startsAt, endsAt: round(boundary), firstLine, lastLine: i - 1 });
    startsAt = round(boundary);
    firstLine = i;
  }

  sections.push({ startsAt, endsAt: round(end), firstLine, lastLine: lineStarts.length - 1 });
  return sections;
}

/**
 * Whatever about this plan SitePal would refuse, or nothing.
 *
 * The one case the greedy walk cannot fix is a single line longer than the
 * ceiling: there is no gap to cut in. It has never happened — a line is a
 * sentence — but it would produce a section that silently fails to play, so it
 * is named rather than assumed away.
 */
export function sectionProblems(sections, max = SITEPAL_MAX_CLIP_SECONDS) {
  return sections
    .filter((s) => s.endsAt - s.startsAt > max)
    .map(
      (s) =>
        `Lines ${s.firstLine}–${s.lastLine} are ${Math.round(s.endsAt - s.startsAt)}s with no ` +
        `pause to cut in, and SitePal's limit is ${max}s. Shorten or split a line and re-record.`,
    );
}

const round = (n) => Number(n.toFixed(3));

/**
 * The clip names a record should carry, section by section.
 *
 * Generated from the show and episode number rather than read back from the
 * files on disk, so what the record asks SitePal for and what was uploaded
 * come from one rule. Section 1 takes no suffix, which is why an episode short
 * enough to be one clip is named exactly as it was before sections existed.
 */
export function sectionsForRecord(episode, sections) {
  return sections.map((section, i) => ({
    startsAt: section.startsAt,
    audio: Object.fromEntries(
      Object.keys(episode.cast ?? {}).map((actor) => [
        actor,
        sitepalClipName(episode.show, episode.number, actor, i + 1),
      ]),
    ),
  }));
}
