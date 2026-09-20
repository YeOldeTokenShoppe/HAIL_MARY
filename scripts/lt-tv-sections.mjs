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
//
// A JOIN IS ALWAYS A PAUSE, which is the thing this file exists to place well.
// No audio is lost at a boundary — one section ends where the next begins — but
// SitePal has to stop one clip and start another, and that takes real time the
// recording knows nothing about. So the cut has to land where a pause belongs.
// Michelle played the first sectioned episode on 2026-09-20 and the joins fell
// in the middle of sentences: cutting at the MIDPOINT of the reported gap is
// only in silence if there is a gap, and in real dialogue there often is not.
// A boundary is now chosen for the silence around it, and a join that could not
// find any is reported rather than shipped quietly.

import { sitepalClipName } from "./lt-tv-format.mjs";

export const SITEPAL_MAX_CLIP_SECONDS = 90;
export const TARGET_SECTION_SECONDS = 85;

/**
 * The least silence a join is willing to land in.
 *
 * Below this the stop-and-start is heard inside a word rather than between two
 * of them. It is deliberately small: the aim is to rule out the gaps that are
 * effectively zero, not to hold out for a dramatic pause.
 */
export const MIN_JOIN_SILENCE = 0.25;

/**
 * How much of the target a section must still fill after backing off to a
 * better pause. Without a floor, hunting for the widest silence could cut a
 * section in half and add a join, and every join is a risk — which is the
 * whole reason the target is 85 and not 60.
 */
const LENGTH_FLOOR = 0.75;

/**
 * Cut points for one episode, from the times its lines actually landed.
 *
 * Forward-only, and greedy about length: take lines until one more would push
 * the section past the target. Where exactly to cut is then chosen among the
 * lines near that limit, by the silence in front of each — the LAST line that
 * fits is rarely the best place to stop, and it was the only place this used to
 * consider.
 *
 * @param lineStarts  seconds, one per line, ascending
 * @param lineEnds    seconds, one per line
 * @param dialogueEnd seconds; where the last section ends
 * @param max         longest a section may be
 * @param minSilence  the least silence a join will land in
 * @param cuts        line numbers to cut in front of, whatever the times say
 * @returns [{ startsAt, endsAt, firstLine, lastLine, silenceAfter, forcedJoin,
 *          manual }], always at least one. `silenceAfter` is the pause the cut
 *          at the END of this section sits in, and is null on the last one.
 */
export function planSections(
  lineStarts,
  lineEnds,
  dialogueEnd,
  max = TARGET_SECTION_SECONDS,
  { minSilence = MIN_JOIN_SILENCE, cuts = [] } = {},
) {
  if (!Array.isArray(lineStarts) || lineStarts.length === 0) {
    throw new Error("planSections needs the line starts from a recorded episode.");
  }
  // Without an end per start every gap is NaN, which reads as "does not fit"
  // and silently cuts at every line. Said plainly rather than discovered on air.
  if (!Array.isArray(lineEnds) || lineEnds.length !== lineStarts.length) {
    throw new Error(
      `planSections needs a line end for every line start (${lineStarts.length} starts, ` +
        `${Array.isArray(lineEnds) ? lineEnds.length : "no"} ends). Re-record the episode.`,
    );
  }
  const end = Number.isFinite(dialogueEnd) ? dialogueEnd : lineEnds[lineEnds.length - 1];

  /** The reported silence in front of line k. Negative when lines overlap. */
  const silenceBefore = (k) => lineStarts[k] - lineEnds[k - 1];

  /**
   * Where a cut in front of line k goes: the middle of the pause, so neither
   * side eats the other's breath. With no pause to halve — the lines abut, or
   * overlap, or the timings are noisy — it goes at the start of line k.
   */
  const cutBefore = (k) => {
    const from = lineEnds[k - 1];
    const to = lineStarts[k];
    return round(to > from ? (from + to) / 2 : to);
  };

  // Where the screenplay asked for a boundary. A person who has heard the
  // episode knows better than the timings do, so these are not negotiated
  // with: the only ones dropped are the ones that are not lines.
  const asked = new Set(
    cuts.filter((n) => Number.isInteger(n) && n > 0 && n < lineStarts.length),
  );

  const sections = [];
  let startsAt = 0;
  let firstLine = 0;

  for (let i = 1; i < lineStarts.length; i += 1) {
    const askedHere = asked.has(i);
    // Would this line still be inside the section? Measured to where the line
    // ENDS, because a section has to contain the whole of what it carries.
    if (!askedHere && lineEnds[i] - startsAt <= max) continue;

    // Either the screenplay asked to cut here, or line i does not fit and this
    // section ends at or before it. In the second case every line back to the
    // start of the section is a candidate: take the one with the most silence
    // in front of it, as long as the section it leaves is still most of a
    // section. Later wins a tie, because a longer section is fewer joins.
    let chosen = askedHere ? i : null;
    let widest = -Infinity;
    if (!askedHere) {
      for (let k = firstLine + 1; k <= i; k += 1) {
        const silence = silenceBefore(k);
        if (silence < minSilence) continue;
        if (cutBefore(k) - startsAt < max * LENGTH_FLOOR) continue;
        if (silence >= widest) {
          widest = silence;
          chosen = k;
        }
      }
    }

    // Nowhere in range has a real pause. Take the last line that fits, which is
    // what this always did, and mark the join so the split step can say the
    // sentence it is about to cut through was not a choice.
    const forcedJoin = chosen === null;
    if (forcedJoin) chosen = i;

    const boundary = cutBefore(chosen);
    sections.push({
      startsAt,
      endsAt: boundary,
      firstLine,
      lastLine: chosen - 1,
      silenceAfter: round(Math.max(0, silenceBefore(chosen))),
      forcedJoin,
      manual: askedHere,
    });
    startsAt = boundary;
    firstLine = chosen;

    // Backing off to a better pause can leave lines that were inside the old
    // section, so carry on from the new one rather than from line i.
    i = chosen;
  }

  sections.push({
    startsAt,
    endsAt: round(end),
    firstLine,
    lastLine: lineStarts.length - 1,
    silenceAfter: null,
    forcedJoin: false,
    manual: false,
  });
  return sections;
}

/**
 * The joins that had no pause to land in, in words.
 *
 * Not fatal — the episode plays, and no audio is missing — so this is separate
 * from `sectionProblems`. It is audible, though, and it is the difference
 * between a join that sounds like a breath and one that sounds like a fault.
 */
export function forcedJoins(sections, minSilence = MIN_JOIN_SILENCE) {
  return sections
    .filter((s) => s.forcedJoin)
    .map(
      (s) =>
        `The cut after line ${s.lastLine} has ${s.silenceAfter.toFixed(2)}s of silence to land ` +
        `in, and a join needs about ${minSilence}s, so it will be heard inside a sentence.`,
    );
}

/**
 * What the pauses in this episode look like overall.
 *
 * The one measurement that says whether cutting anywhere can work: if most
 * gaps are near zero then no choice of boundary is a good one, and the answer
 * is in how the audio was recorded rather than in where it is cut.
 */
export function gapSummary(lineStarts, lineEnds, minSilence = MIN_JOIN_SILENCE) {
  const gaps = lineStarts.slice(1).map((start, i) => round(start - lineEnds[i]));
  if (!gaps.length) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const middle = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
  return {
    count: gaps.length,
    median: middle,
    smallest: sorted[0],
    largest: sorted[sorted.length - 1],
    tooSmall: gaps.filter((g) => g < minSilence).length,
  };
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
