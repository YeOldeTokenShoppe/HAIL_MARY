// FROM AN EPISODE RECORD TO A PERFORMANCE.
//
// An LT TV record (src/content/lt-tv/episodes/*.json) holds only what a
// producer actually decides: when each line starts, who holds it, which lines
// are played to the room, and the reaction beats. Everything the set needs
// beyond that — the listener turns, the camera shots, absolute cue times — is
// derived here, once, so the same fact is never typed twice.
//
// That direction is deliberate. The scene used to hand-author the LISTENER of
// each line and infer the speaker back out of it, which meant the speaker list
// (the thing the ElevenLabs pipeline already knows) was the one thing nobody
// wrote down. Records name the speaker; the turns fall out of it.
//
// Pure and side-effect free: give it a record, get a timeline. No THREE, no
// React, so it can be unit-tested and reused by a future script generator.

// A listener turns a beat INTO the line they're being addressed on and lets go
// shortly before it ends, so the exchange doesn't look mechanical.
const GAZE_LEAD_IN = 0.22;
const GAZE_RELEASE = 0.18;

// The set has ONE camera, so a "cut" is a physical pan — the director commits
// to a shot per line rather than chasing every exchange. Singles on the
// speaker, pulling back to the two-shot for lines played to the room and
// whenever the exchange has sat on singles too long. `subject: null` = wide.
const SHOT_MAX_SINGLES = 3;
// An operator reacts to a line instead of anticipating it, and won't whip off
// a shot they only just landed — short lines play out as reaction shots on
// whoever the camera is already holding.
const SHOT_REACTION_DELAY = 0.3;
const SHOT_MIN_HOLD = 2.6;

const DEFAULT_REACTION_DURATION = 1.5;
const DEFAULT_LEAD_IN = 2.5;

// SitePal will not play a clip longer than 90 seconds — its own limit, not a
// plan one — so an episode of any real length goes up as several clips per
// character and the set plays them in order. A record says where each one
// begins on the episode's own timeline; everything else (line starts, cues,
// shots) is unchanged, because a section is a cut in the audio and not a cut
// in the show.
//
// An episode short enough to be one clip has no `sections` at all, and reads
// here as a single section starting at zero. That is not a special case in the
// set: it plays a list of one.
export const SITEPAL_MAX_CLIP_SECONDS = 90;

/** "MM:SS" for a guide listing. */
export function formatRuntime(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return `${String(minutes).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * WHO THIS EPISODE CASTS — which is not the same as who the set can seat.
 *
 * The record's `audio` block names one clip per character who speaks, so its
 * keys ARE the cast: an episode that rotates a character out, or sits a guest
 * down for one week, simply names a different set. Everything that counts
 * characters has to count these and not the set's registered seats, because a
 * seat with nothing to play never loads, never starts and never ends — and a
 * tally that expects it waits for a report that cannot come.
 *
 * Takes a record or a built timeline; both carry `audio`.
 */
export function episodeCast(recordOrTimeline) {
  return Object.keys(recordOrTimeline?.audio ?? {});
}

/**
 * Can this record actually go to air? It needs a clip name per character and a
 * line start per line. A record without them is a slate entry — listed in the
 * guide, not playable — rather than something that plays another episode.
 */
export function episodeIsPlayable(record) {
  return Boolean(
    record &&
      record.audio &&
      Object.keys(record.audio).length > 0 &&
      Array.isArray(record.lineStarts) &&
      record.lineStarts.length > 0,
  );
}

// HOW LONG AN EPISODE IS "NEW" FOR. Both shows are weekly, so a week is the
// honest window: the badge means "since you last had a reason to look", and
// anything longer would leave last week's episode wearing it beside this
// week's. Change this one number to change the whole guide.
export const NEW_EPISODE_DAYS = 7;

/**
 * Is this episode new enough to badge in the guide?
 *
 * Only a playable record qualifies — a slate entry that has been named but not
 * recorded already says "Not recorded yet", and badging it New would promise
 * something to watch that isn't there.
 *
 * `airDate` is a plain YYYY-MM-DD, read as UTC midnight. A date in the FUTURE
 * counts as new rather than as not-yet-new: `assemble()` stamps the date from
 * the machine that wrote the episode, so an episode written on a Pacific
 * evening is stamped tomorrow, and an episode that fails to be new on the day
 * it goes up is worse than one that is new a few hours early.
 *
 * `now` is passed in rather than read here so the caller decides when it is
 * read — a component that resolves it during render bakes the server's date
 * into the HTML and disagrees with the browser on hydration.
 */
export function isNewEpisode(record, now) {
  if (!episodeIsPlayable(record) || typeof record.airDate !== "string") return false;
  const aired = Date.parse(`${record.airDate}T00:00:00Z`);
  if (!Number.isFinite(aired) || !Number.isFinite(now)) return false;
  return now - aired < NEW_EPISODE_DAYS * 24 * 60 * 60 * 1000;
}

// A WAY TO SEE THE BADGE WHEN NOTHING QUALIFIES FOR ONE.
//
// The badge is only ever on when a recent episode is on the slate, which makes
// it the one piece of the guide you cannot check by looking. `?preview=new` on
// /trade turns it on for every listed episode so the placement and the styling
// can be looked at; it is display-only, and without it in the URL nothing here
// changes. It is not a way to publish a badge: nobody reaches the page with
// that query string unless they typed it.
export function isBadgePreview(search) {
  if (typeof search !== "string") return false;
  try {
    return new URLSearchParams(search).get("preview") === "new";
  } catch {
    return false;
  }
}

/**
 * Where each clip begins on the episode timeline, and what to play there.
 *
 * `record.audio` is always the first section, so a record written before
 * sections existed — and the cast lookup everything else does through
 * `record.audio` — keeps working untouched.
 */
export function episodeSections(record) {
  const first = { startsAt: 0, audio: record.audio };
  if (!Array.isArray(record.sections) || record.sections.length === 0) return [first];
  return [
    first,
    ...record.sections.slice(1).map((section) => ({
      startsAt: Number(section.startsAt) || 0,
      audio: section.audio,
    })),
  ];
}

// ── SEEKING ───────────────────────────────────────────────────────────────
//
// WHAT SITEPAL CAN AND CANNOT DO, because it decides the shape of all of this.
// The player has no "play from 3:20": its speech functions take a clip name
// and start it at the beginning (docs/sitepal.md, Speech Functions), and the
// only position it reports is `vh_audioProgress` as a percentage. So there is
// no seeking INSIDE a clip, at any cost, and no amount of work on this page
// changes that.
//
// What there is instead: an episode of any real length is already several
// clips, because SitePal refuses one over 90 seconds. Starting a section is
// something the set does at every join anyway, so the section boundaries are
// real, free seek points — roughly a minute and a half apart. That is the
// granularity, and these helpers are the arithmetic for it.
//
// Pausing is a separate mechanism and does not go through here: `freezeToggle`
// holds speech where it is and resumes from that point, which is exact.

// Pressing "back" in the first few seconds of a section means the section
// before; later on it means "start this one again", the way every other
// player behaves. Without the grace period, back is unusable — a section is
// ~90 seconds, so anyone reaching for it a minute in gets thrown a minute and
// a half further back than they meant.
export const SECTION_RESTART_SECONDS = 3;

/** Which section holds `seconds`. Before the first one, the first one. */
export function sectionIndexAt(sections, seconds) {
  if (!Array.isArray(sections) || sections.length === 0) return 0;
  const at = Number.isFinite(seconds) ? seconds : 0;
  let index = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if ((sections[i].startsAt ?? 0) <= at) index = i;
    else break;
  }
  return index;
}

/**
 * How many reaction cues are already behind `seconds`.
 *
 * The frame loop walks the cue list forward and never looks back, which is
 * right for a performance that only ever moves forward — and wrong the moment
 * it can jump. Landing at 4:00 with the index still at zero fires every
 * reaction of the first four minutes in one frame; landing at 0:30 with the
 * index at the end plays the rest of the episode with nobody reacting. Both
 * are silent failures, so the seat is computed rather than nudged.
 */
export function cueIndexAt(cues, seconds) {
  if (!Array.isArray(cues)) return 0;
  const at = Number.isFinite(seconds) ? seconds : 0;
  let index = 0;
  while (index < cues.length && cues[index].at <= at) index += 1;
  return index;
}

/**
 * Where skip-back / skip-forward land from `elapsed`.
 *
 * `step` is -1 or +1. Returns a section index, or null for "off the end of
 * the episode" — which the caller ends the show on rather than clamping,
 * because a skip past the last section means the viewer is done.
 */
export function stepSection(sections, elapsed, step) {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  const here = sectionIndexAt(sections, elapsed);
  if (step > 0) return here + 1 < sections.length ? here + 1 : null;
  const startsAt = sections[here]?.startsAt ?? 0;
  const at = Number.isFinite(elapsed) ? elapsed : 0;
  if (here === 0 || at - startsAt > SECTION_RESTART_SECONDS) return here;
  return here - 1;
}

/**
 * The episode as a row of seekable blocks: where each section starts, where it
 * ends, and how long it runs. The scrub bar draws these, and a click on it
 * lands on the `startsAt` of whichever one was hit.
 */
export function sectionBounds(timeline) {
  const sections = timeline?.sections || [];
  const end = timeline?.dialogueEnd ?? 0;
  return sections.map((section, index) => {
    const startsAt = section.startsAt ?? 0;
    const endsAt = sections[index + 1]?.startsAt ?? end;
    return { index, startsAt, endsAt, seconds: Math.max(0, endsAt - startsAt) };
  });
}

/**
 * Problems a producer should hear about before the set does. Returned rather
 * than thrown so one malformed record can't take the /trade page down; the
 * scene logs them in development.
 */
export function validateEpisode(record) {
  const problems = [];
  if (!episodeIsPlayable(record)) return problems;
  const lines = record.lineStarts.length;
  const speakers = record.speakers || [];
  if (speakers.length !== lines) {
    problems.push(
      `speakers has ${speakers.length} entries for ${lines} lines`,
    );
  }
  if (!Number.isFinite(record.dialogueEnd)) {
    problems.push("dialogueEnd is missing — runtime and the last line's gaze need it");
  } else if (record.dialogueEnd < record.lineStarts[lines - 1]) {
    problems.push("dialogueEnd lands before the last line starts");
  }
  record.lineStarts.forEach((start, i) => {
    if (i > 0 && start < record.lineStarts[i - 1]) {
      problems.push(`lineStarts[${i}] goes backwards`);
    }
  });
  (record.cues || []).forEach((cue, i) => {
    if (cue.line >= lines || cue.line < 0) {
      problems.push(`cues[${i}] points at line ${cue.line}, which doesn't exist`);
    }
  });

  // A chapter off the end of the script is silent about it: the chiron simply
  // stops changing partway through the show, which reads as a design choice.
  (record.graphics?.chapters || []).forEach((chapter, i) => {
    if (!(chapter.line >= 0 && chapter.line < lines)) {
      problems.push(
        `graphics.chapters[${i}] starts on line ${chapter.line}, which doesn't exist — ` +
          "re-stage the episode from its production record",
      );
    }
  });

  // A section that is wrong is silent about it: the set plays a clip SitePal
  // refuses, or resumes at the wrong second, and neither looks like a record
  // problem when you are watching it.
  const sections = episodeSections(record);
  const cast = episodeCast(record);
  sections.forEach((section, i) => {
    if (i > 0 && section.startsAt <= sections[i - 1].startsAt) {
      problems.push(`sections[${i}] starts at or before the one before it`);
    }
    if (section.startsAt > record.dialogueEnd) {
      problems.push(`sections[${i}] starts after the dialogue ends`);
    }
    const names = section.audio ? Object.keys(section.audio) : [];
    if (names.length !== cast.length || cast.some((who) => !section.audio?.[who])) {
      problems.push(`sections[${i}] does not name a clip for every character`);
    }
    const ends = sections[i + 1]?.startsAt ?? record.dialogueEnd;
    if (ends - section.startsAt > SITEPAL_MAX_CLIP_SECONDS) {
      problems.push(
        `sections[${i}] is ${Math.round(ends - section.startsAt)}s, over SitePal's ` +
          `${SITEPAL_MAX_CLIP_SECONDS}s limit — it will not play`,
      );
    }
  });
  const clips = sections.flatMap((s) => Object.values(s.audio ?? {}));
  if (new Set(clips).size !== clips.length) {
    problems.push("two sections ask SitePal for the same clip name");
  }
  return problems;
}

/**
 * The episode's chapters, resolved onto the clock.
 *
 * A chapter says which LINE it begins on, never which second — line numbers
 * survive a re-record and absolute times do not (see scripts/lt-tv-chapters.mjs
 * for why that matters). Turning one into the other is this function's whole
 * job, and it is the same trick the reaction cues use.
 *
 * A chapter pointing at a line the record does not have is dropped rather than
 * resolved to NaN: a graphics fault should cost the graphic, not the episode.
 */
export function episodeChapters(record) {
  const lineStarts = record?.lineStarts || [];
  return (record?.graphics?.chapters || [])
    .filter((chapter) => Number.isFinite(lineStarts[chapter.line]))
    .map((chapter) => ({ ...chapter, at: lineStarts[chapter.line] }))
    .sort((a, b) => a.at - b.at);
}

/**
 * The played form of an episode.
 *
 * @param record        an episode record from src/content/lt-tv/episodes
 * @param reactionDurations  the rig's authored clip lengths, by actor and
 *                      reaction, used when a cue doesn't cut its own short.
 *                      Lives with the character clips in the scene, not here.
 * @returns null for a record that isn't playable.
 */
export function buildEpisodeTimeline(record, { reactionDurations = {} } = {}) {
  if (!episodeIsPlayable(record)) return null;

  const lineStarts = record.lineStarts;
  const dialogueEnd =
    record.dialogueEnd ?? lineStarts[lineStarts.length - 1];
  const speakers = record.speakers || [];
  const audienceLines = new Set(record.audienceLines || []);
  const cast = episodeCast(record);
  // With two in the room the listener is simply the other chair, so a record
  // need not say. WITH THREE IT HAS TO: `opposite` would pick whichever of the
  // other two comes first in the cast, and everyone would turn the same way all
  // night. A record names `listeners` per line and that wins here — so a
  // three-hander is a record that carries it, not a change to this file.
  const opposite = {};
  cast.forEach((actor) => {
    opposite[actor] = cast.find((other) => other !== actor) || null;
  });

  // Who turns to face whom. A line played to the room turns nobody.
  const gazes = [];
  speakers.forEach((speaker, line) => {
    if (!speaker || audienceLines.has(line)) return;
    const listener = record.listeners?.[line] ?? opposite[speaker];
    if (!listener) return;
    gazes.push({
      line,
      listener,
      startAt: lineStarts[line] + GAZE_LEAD_IN,
      endAt: (lineStarts[line + 1] ?? dialogueEnd) - GAZE_RELEASE,
    });
  });

  // Reaction beats, resolved to absolute seconds and played in order.
  const cues = (record.cues || [])
    .filter((cue) => cue.line >= 0 && cue.line < lineStarts.length)
    .map((cue) => ({
      ...cue,
      duration:
        cue.duration ??
        reactionDurations[cue.actor]?.[cue.reaction] ??
        DEFAULT_REACTION_DURATION,
      at: lineStarts[cue.line] + cue.offset,
    }))
    .sort((a, b) => a.at - b.at);

  const shots = buildShots(lineStarts, speakers, audienceLines);

  return {
    id: record.id,
    audio: record.audio,
    sections: episodeSections(record),
    leadIn: record.leadIn ?? DEFAULT_LEAD_IN,
    lineStarts,
    dialogueEnd,
    speakers,
    gazes,
    cues,
    shots,
    chapters: episodeChapters(record),
  };
}

function buildShots(lineStarts, speakers, audienceLines) {
  const shots = [{ at: 0, subject: null }];
  let singles = 0;
  lineStarts.forEach((start, line) => {
    const speaker = speakers[line];
    const wide =
      !speaker || audienceLines.has(line) || singles >= SHOT_MAX_SINGLES;
    const subject = wide ? null : speaker;
    singles = wide ? 0 : singles + 1;
    const at = start + SHOT_REACTION_DELAY;
    const prev = shots[shots.length - 1];
    if (prev.subject === subject || at - prev.at < SHOT_MIN_HOLD) return;
    shots.push({ at, subject });
  });
  return shots;
}

/**
 * Who holds the floor at `elapsed`. Before the first line lands — and whenever
 * playback isn't running — whoever opens the show holds it.
 */
export function speakerAt(timeline, elapsed, running) {
  if (!timeline) return null;
  const { lineStarts, speakers } = timeline;
  if (running) {
    for (let i = lineStarts.length - 1; i >= 0; i -= 1) {
      if (lineStarts[i] <= elapsed && speakers[i]) return speakers[i];
    }
  }
  return speakers.find(Boolean) ?? null;
}

/** Which shot is live at `cue` seconds. `null` subject = the two-shot. */
export function shotSubjectAt(timeline, cue) {
  if (!timeline) return null;
  const { shots } = timeline;
  for (let i = shots.length - 1; i >= 0; i -= 1) {
    if (shots[i].at <= cue) return shots[i].subject;
  }
  return null;
}

/**
 * Which chapter is on screen at `elapsed` — an index into `timeline.chapters`,
 * or -1 for an episode with no chapters at all.
 *
 * Before the first line lands, and whenever playback is stopped, the show sits
 * on its opening chapter: the chiron and the screen read as the top of the
 * episode rather than as whatever was up when it was stopped.
 */
export function chapterIndexAt(timeline, elapsed, running) {
  const chapters = timeline?.chapters || [];
  if (!chapters.length) return -1;
  if (!running) return 0;
  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    if (chapters[i].at <= elapsed) return i;
  }
  return 0;
}
