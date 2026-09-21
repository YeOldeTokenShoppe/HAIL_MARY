#!/usr/bin/env node
// THE ONLY THINGS THE STUDIO PAGE IS ALLOWED TO RUN.
//
// The dashboard at /lt-tv has buttons that run real pipeline steps, which
// means a browser can ask this machine to execute something. The rule that
// makes that safe is here and nowhere else:
//
//   THE CLIENT NEVER SENDS A COMMAND. It sends an action name and an episode
//   id. This module turns those into a fixed argv array. Nothing the browser
//   sends is ever concatenated into a string a shell will read, and the
//   episode id is checked against the episodes that actually exist rather
//   than against a pattern.
//
// So the worst a malformed or malicious request can do is name an action that
// is not in this table, or an episode that is not on the slate, and be
// refused. There is no path from a request to an arbitrary command, because
// there is no place in this file where request text becomes part of one.
//
// The page itself is development-only — see src/lib/ltTv/devOnly.mjs — so
// none of this exists in a deployed build. That is the second lock, not the
// first; this table is written to be safe on its own.

import { isoWeek } from "./lt-news-brief.mjs";

/**
 * Actions, each one a function from a validated id to an argv array.
 *
 * Two kinds. An EPISODE action takes the id of an episode on the slate and is
 * offered by stage. A SHOW action (`scope: "show"`) takes no id at all, because
 * it is how a news episode comes to exist: the week is pulled and the script
 * written before there is anything on the slate to point at. Those are offered
 * under the show's heading instead, by `showActionsFor`.
 */
export const ACTIONS = {
  "pull-week": {
    label: "Pull the week",
    scope: "show",
    show: "news",
    // Public feeds and FRED. No key, no model, no audio.
    spends: null,
    needs: [],
    stages: [],
    argv: () => ["node", ["scripts/lt-news-brief.mjs"]],
    blurb:
      "Collects this week's market signal into a brief: the Fed, the curve, oil, crypto headlines, collectibles, prediction markets. Free. Read the Degraded line in the output; anything named there answered badly.",
  },
  "write-news": {
    label: "Write this week's news",
    scope: "show",
    show: "news",
    // Two Claude calls: the editorial pass, then the dialogue.
    spends: "an Anthropic call",
    needs: ["ANTHROPIC_API_KEY"],
    stages: [],
    // This week's brief, by the same ISO-week rule the pull uses to name it.
    // Fixed here rather than sent by the browser, like every other argument.
    argv: () => ["node", ["scripts/lt-news-script.mjs", "--brief", `content/lt-tv/briefs/news-${isoWeek()}.json`]],
    blurb:
      "Writes the rundown and the dialogue from this week's brief, verifying every number against its source, and puts the episode on the slate as Not recorded yet. Pull the week first. Two Claude calls.",
  },
  "write-roundtable": {
    label: "Write this episode",
    // Two Claude calls. The button says so and asks first.
    spends: "an Anthropic call",
    needs: ["ANTHROPIC_API_KEY"],
    stages: ["planned"],
    argv: (id) => ["node", ["scripts/lt-rt-script.mjs", "--topic", id]],
    blurb: "Writes the argument, then the dialogue. Keeps the title you gave it.",
  },
  "plan-roundtable": {
    label: "Draft the argument only",
    spends: "an Anthropic call",
    needs: ["ANTHROPIC_API_KEY"],
    stages: ["planned"],
    argv: (id) => ["node", ["scripts/lt-rt-script.mjs", "--topic", id, "--plan-only"]],
    // Deliberately not described as a first half: the plan it writes is not
    // read back by the full run, which starts its own argument pass. It is a
    // cheap look at whether the idea holds, and nothing more.
    blurb: "Writes only the argument, cheaply, so you can judge the idea. A look, not a saved first half — writing the episode after this starts a fresh argument.",
  },
  "apply-edits": {
    label: "Apply my edits",
    spends: null,
    needs: [],
    // There is nothing to apply until a screenplay has been written, and the
    // editor's refusal in that case names the staging record rather than the
    // episode, which reads like the episode is missing. So the page offers
    // this only once there is text to apply.
    needsScreenplay: true,
    stages: ["written", "recorded", "on-air"],
    argv: (id) => ["node", ["scripts/lt-tv-edit.mjs", id]],
    blurb: "Reads the screenplay back into the record. Free.",
  },
  "apply-edits-rerecord": {
    label: "Apply my edits and clear the audio",
    spends: null,
    needs: [],
    needsScreenplay: true,
    stages: ["recorded", "on-air"],
    argv: (id) => ["node", ["scripts/lt-tv-edit.mjs", id, "--rerecord"]],
    blurb: "For an episode already recorded. Returns it to Not recorded yet until you record it again.",
  },
  "rewrite-marked": {
    label: "Rewrite the lines I marked",
    // One small call: the marked lines and the script around them, not a
    // whole new episode.
    spends: "an Anthropic call",
    needs: ["ANTHROPIC_API_KEY"],
    stages: ["written", "recorded", "on-air"],
    needsScreenplay: true,
    argv: (id) => ["node", ["scripts/lt-tv-rewrite.mjs", id]],
    blurb: "Put a # note under a line saying what is wrong with it, then press this. Only the lines you marked change. Start the note #! to keep it as a rule for future episodes too.",
  },
  record: {
    label: "Record it",
    spends: "an ElevenLabs render",
    needs: ["ELEVENLABS_API_KEY"],
    // It renders the RECORD, not the screenplay, and refuses when the two
    // disagree. Saving the box first means that refusal is about what is on
    // screen rather than about a file nobody has looked at.
    needsScreenplay: true,
    stages: ["written"],
    argv: (id) => ["node", ["scripts/lt-tv-audio.mjs", `content/lt-tv/episodes/${id}.json`]],
    blurb: "Renders every line on its own, in its own voice, and lays the two character tracks out on one timeline. A line already recorded with the same words is reused free.",
  },
  rerecord: {
    label: "Record it again",
    spends: "an ElevenLabs render",
    needs: ["ELEVENLABS_API_KEY"],
    needsScreenplay: true,
    // The same run as `record`. It exists as its own button because some of
    // what the recording does is steered from the screenplay rather than from
    // the record — `# pause 1.5s` is silence laid into the tracks, so it can
    // only take effect by recording again. Without this the only route back
    // through the audio step was "Apply my edits and clear the audio", which
    // refuses outright when no WORDS changed, and re-renders the screenplay,
    // wiping the marks that were the whole reason for pressing it.
    stages: ["recorded", "on-air"],
    argv: (id) => ["node", ["scripts/lt-tv-audio.mjs", `content/lt-tv/episodes/${id}.json`]],
    blurb:
      "For after you add or change a `# pause 1.5s` mark. Every line already on disk with the same words is reused free, so this often costs nothing; the run says how many lines it is sending before it sends any. Split and upload again afterwards.",
  },
  split: {
    label: "Split it into the two tracks",
    spends: null,
    needs: [],
    // Only once there is a master to split. `recorded` is exactly that: the
    // audio step wrote the timing back, which it does after writing the WAV.
    stages: ["recorded", "on-air"],
    // It reads `# cut` marks out of the screenplay, so the box is saved first.
    needsScreenplay: true,
    argv: (id) => ["node", ["scripts/lt-tv-split.mjs", id]],
    blurb: "Cuts the two tracks into the clips you upload to SitePal, one per character per section. To move a join, put `# cut` on its own line in the screenplay where you want it and split again. Free.",
  },
  "split-report": {
    label: "Show me where the cuts went",
    spends: null,
    needs: [],
    needsScreenplay: true,
    // The same split, with the boundary table printed. It exists as its own
    // button because the table is 40 lines for a 40-line episode — too noisy
    // to print every time, and the only way to see it from here otherwise was
    // a terminal flag, which is not a thing Michelle is going to type.
    stages: ["recorded", "on-air"],
    argv: (id) => ["node", ["scripts/lt-tv-split.mjs", id, "--report"]],
    blurb:
      "Splits exactly as the button above does, and also prints every line: who says it, where it sits on the timeline, and the pause in front of it. Paste it to me when something sounds wrong. Free.",
  },
  slate: {
    label: "Put it on the guide",
    spends: null,
    needs: [],
    // Same stage as split: the audio step has written real timing into the
    // production record, and the slate record has not been told. Left off the
    // table, the studio stops one step short of a playable episode, and the
    // obvious-looking way to finish by hand is to re-run the generator, which
    // rebuilds the episode and discards the edits and the timing.
    stages: ["recorded", "on-air"],
    argv: (id) => ["node", ["scripts/lt-tv-slate-record.mjs", id]],
    blurb: "Carries the recorded timing into the slate record, so the guide plays the episode instead of listing it as not recorded. Do this after the two clips are uploaded. Free.",
  },
  check: {
    label: "Check the slate",
    spends: null,
    needs: [],
    stages: ["planned", "written", "recorded", "on-air"],
    argv: () => ["node", ["scripts/lt-tv-check.mjs"]],
    blurb: "Validates every record against what the set expects.",
  },
};

export const ACTION_NAMES = Object.keys(ACTIONS);

/**
 * Turn a request into something safe to execute, or explain the refusal.
 *
 * `knownIds` is the list of episodes that actually exist, read from disk by
 * the caller. Checking against it rather than against a regular expression is
 * the point: a pattern says what an id looks like, and this says which ones
 * there are.
 *
 * @returns {{ ok: true, command: string, args: string[] }
 *          |{ ok: false, status: number, error: string }}
 */
export function resolveAction(action, id, knownIds) {
  if (typeof action !== "string" || !Object.hasOwn(ACTIONS, action)) {
    return { ok: false, status: 400, error: `Not an action: ${String(action).slice(0, 40)}` };
  }
  const spec = ACTIONS[action];

  // `check` is about the whole slate and the show actions are about a show
  // that may have nothing on it yet, so those take no id.
  if (spec.argv.length === 0) {
    const [command, args] = spec.argv();
    return { ok: true, command, args };
  }

  if (typeof id !== "string" || !knownIds.includes(id)) {
    return { ok: false, status: 400, error: `Not an episode on the slate: ${String(id).slice(0, 40)}` };
  }

  const [command, args] = spec.argv(id);
  return { ok: true, command, args };
}

/** Which actions make sense for an episode at this stage, in offer order. */
export function actionsFor(stage) {
  return ACTION_NAMES.filter((name) => ACTIONS[name].stages.includes(stage)).map((name) => ({
    name,
    ...ACTIONS[name],
    argv: undefined,
  }));
}

/** The actions offered under a show's heading, which need no episode. */
export function showActionsFor(showId) {
  return ACTION_NAMES.filter(
    (name) => ACTIONS[name].scope === "show" && ACTIONS[name].show === showId,
  ).map((name) => ({ name, ...ACTIONS[name], argv: undefined }));
}
