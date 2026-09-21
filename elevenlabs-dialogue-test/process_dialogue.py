#!/usr/bin/env python3

import argparse
import base64
import datetime
import json
import shutil
import subprocess
import sys
from pathlib import Path


SPEAKERS = {
    "john": "IcFWazAaBzXNwLWpySgF",
    "gr80": "Re5c3vCmpnygdZuSX2Wc",
}

ACTOR_NAMES = {
    "john": "Connor",
    "gr80": "Monk",
}

# WHERE ONE SPEAKER STOPS AND THE NEXT BEGINS.
#
# ElevenLabs reports a start and an end per line, and they TILE: line k's start
# IS line k-1's end, to the millisecond. That instant is not where the voice
# actually changes — the reported times are approximate, and a line's reported
# end has been seen over a second short of where the speech really stops. The
# guards below assumed it was accurate to about ten milliseconds, so a boundary
# that was off by a few hundred put the head of one speaker's line inside the
# other's stem, and clipped it off their own. Michelle heard it on 2026-09-21:
# "GR80 interjects with 'old nothing' instead of 'you sold nothing'."
#
# So the boundary is MEASURED, the same way section cuts are: silence in the
# master means neither voice is speaking, which is exactly the condition a
# boundary needs. The junction goes in the middle of the silence around the
# reported instant, and then no guard is needed — the cut is already in a gap.
#
# The guards remain for junctions where nothing was measured. That case means
# the two lines really do run together with no gap, and it is reported rather
# than hidden, because no boundary fixes it.
START_GUARD_SECONDS = 0.12
END_GUARD_SECONDS = 0.01
BOUNDARY_FADE_SECONDS = 0.02

# silencedetect settings for finding those gaps. The minimum is well under the
# 0.15s used for section cuts: a breath between two lines is shorter than a
# pause you can join two clips in, and here we only need to know where the gap
# is, not whether it is wide enough to cut a clip at.
SILENCE_DB = -40
SILENCE_MIN_SECONDS = 0.08

# How far from the reported instant a gap may be and still be believed to be
# that junction.
#
# THIS IS NOT THE SECTION CUTTER'S TOLERANCE, and copying that one (1.5s) here
# was a mistake that cost Michelle a round on 2026-09-21. A section cut that
# lands a second away is harmless: both characters' tracks are cut at the same
# instant, so nothing moves relative to anything else. A STEM boundary a second
# away is a disaster — it falls inside a line, and a whole clause of one
# character ends up in the other character's clip. She heard GR80's "...you
# cannot", the tail of his line, in Connor's first clip, because the junction
# snapped 1.2s backwards onto a breath in the middle of GR80's own sentence.
#
# A gap that SPANS the reported instant is taken at any distance, because it
# contains the boundary by definition. Anything else is a guess, and a guess
# further away than this is worse than the guarded fallback — which is only
# ever wrong by the reporting error, a syllable at most.
BOUNDARY_SEARCH_SECONDS = 0.5

# The least a line may be squeezed to. A window shorter than this is not a line
# at all, and the audio it should have held goes to whoever is next — which is
# how the wrong character came to lip-sync a line whose audio was perfectly
# correct in the master.
MIN_LINE_WINDOW_SECONDS = 0.05


def media_duration(path):
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def parse_silences(text):
    """The (start, end) windows ffmpeg's silencedetect reported.

    Pure, so it can be tested without ffmpeg. An unclosed window — silence that
    runs to the end of the file — is dropped: it has no end to take a midpoint
    of, and the closing line runs to the end of the master anyway.
    """
    windows = []
    start = None
    for line in text.splitlines():
        if "silence_start:" in line:
            try:
                start = float(line.rsplit("silence_start:", 1)[1].split()[0])
            except (IndexError, ValueError):
                start = None
        elif "silence_end:" in line and start is not None:
            try:
                end = float(line.rsplit("silence_end:", 1)[1].split()[0])
            except (IndexError, ValueError):
                continue
            if end > start:
                windows.append((start, end))
            start = None
    return windows


def detect_silences(master):
    """Where nobody is speaking, measured from the master itself."""
    command = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        str(master),
        "-af",
        f"silencedetect=noise={SILENCE_DB}dB:d={SILENCE_MIN_SECONDS}",
        "-f",
        "null",
        "-",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    return parse_silences(result.stderr)


def find_gap(instant, silences, lower=None, upper=None, used=()):
    """The measured gap at this reported junction, or None.

    Preferred: a window the instant falls inside. Otherwise the nearest one
    within BOUNDARY_SEARCH_SECONDS, because the reported instant can sit a
    little before or after the real gap.

    `lower`, `upper` and `used` keep two junctions from claiming the SAME gap.
    Without them a short line — "You sold nothing." — could have the junction
    before it and the junction after it both snap to the one measurable gap in
    front of it. Its window then collapsed to nothing and the line fell inside
    the NEXT speaker's window, so the wrong character lip-synced it. Michelle
    heard exactly that on 2026-09-21: the master was correct and the animation
    was not.
    """

    def allowed(window):
        if window in used:
            return False
        middle = (window[0] + window[1]) / 2
        if lower is not None and middle <= lower:
            return False
        if upper is not None and middle >= upper:
            return False
        return True

    for window in silences:
        if window[0] <= instant <= window[1] and allowed(window):
            return window
    nearest = None
    best = BOUNDARY_SEARCH_SECONDS
    for window in silences:
        if not allowed(window):
            continue
        start, end = window
        away = start - instant if start > instant else instant - end if end < instant else 0
        if away <= best:
            best = away
            nearest = window
    return nearest


def plan_windows(segments, silences, total_duration):
    """The span of the master each line owns, per segment, in order.

    Returns one dict per segment: the window to cut, whether its edges were
    measured, and what was reported, so the run can show its working.

    Every junction is shared — one line ends exactly where the next begins —
    so no audio is lost and nothing is counted twice. The first line starts at
    the top of the master and the last runs to the end of it.

    The junctions are measured out of the master's own silence. ElevenLabs'
    per-character alignment was tried instead and cannot work: it puts every
    boundary at the same instant it reports — see the note in lt-tv-audio.mjs.
    """
    if not segments:
        return []

    # EVERY LINE MUST KEEP A WINDOW OF ITS OWN. Junctions are chosen in order,
    # each one after the last, each one inside the pair of lines it separates,
    # and no gap is used twice — otherwise a short line between two junctions
    # that both snap to the same gap is squeezed to nothing, and its audio ends
    # up inside the next speaker's window.
    junctions = []
    used = []
    previous = 0.0
    for index in range(1, len(segments)):
        reported = float(segments[index]["start_time_seconds"])
        # It may not move back past the junction before it, nor forward past
        # where the NEXT junction is reported to be — that one needs room too.
        lower = previous + MIN_LINE_WINDOW_SECONDS
        upper = (
            float(segments[index + 1]["start_time_seconds"]) - MIN_LINE_WINDOW_SECONDS
            if index + 1 < len(segments)
            else total_duration
        )
        gap = find_gap(reported, silences, lower=lower, upper=upper, used=used) if upper > lower else None
        if gap:
            at = (gap[0] + gap[1]) / 2
            used.append(gap)
            junctions.append({"at": at, "measured": True, "reported": reported})
            previous = at
        else:
            # Nothing usable measured: fall back to the old guarded instant. The
            # two lines are treated as running straight into each other, which
            # is what the absence of a gap means.
            junctions.append({"at": None, "measured": False, "reported": reported})
            previous = max(previous, reported)

    return _windows(segments, junctions, total_duration)


def _windows(segments, junctions, total_duration):
    """Junctions to one window per line. Shared by both paths above."""
    planned = []
    for index, segment in enumerate(segments):
        before = junctions[index - 1] if index > 0 else None
        after = junctions[index] if index < len(junctions) else None

        if before is None:
            start = 0.0
            start_measured = True
        elif before["measured"]:
            start = before["at"]
            start_measured = True
        else:
            start = before["reported"] + START_GUARD_SECONDS
            start_measured = False

        if after is None:
            end = max(float(segment["end_time_seconds"]), total_duration)
            end_measured = True
        elif after["measured"]:
            end = after["at"]
            end_measured = True
        else:
            end = after["reported"] - END_GUARD_SECONDS
            end_measured = False

        planned.append(
            {
                "start": start,
                "end": max(start + 0.001, end),
                "measured": start_measured and end_measured,
                "start_measured": start_measured,
                "end_measured": end_measured,
                "reported_start": float(segment["start_time_seconds"]),
                "reported_end": float(segment["end_time_seconds"]),
                "voice_id": segment.get("voice_id"),
            }
        )
    return planned


def boundary_report(planned, names_by_voice):
    """What moved and what did not, as lines to print.

    The second return names the lines whose boundary IN FRONT of them could not
    be measured — one entry per bad junction, rather than one per line touching
    one, which would name almost every line in a bad episode and say nothing
    about where to look.
    """
    rows = []
    unmeasured = []
    for index, window in enumerate(planned):
        who = names_by_voice.get(window["voice_id"], "?")
        moved = window["start"] - window["reported_start"]
        rows.append(
            f"  {index:>3}  {who:<7} reported {window['reported_start']:7.2f}s  "
            f"cut at {window['start']:7.2f}s  {moved:+.2f}s"
            + ("" if window["start_measured"] else "   NO GAP MEASURED")
        )
        # Line 0 has no junction in front of it, so it is never counted.
        if index > 0 and not window["start_measured"]:
            unmeasured.append(index)
    return rows, unmeasured


def media_sample_rate(path, fallback=44100):
    """The master's own sample rate. Episodes are recorded at whatever
    LT_TV_PCM_RATE says, so this is not always 44100."""
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=sample_rate",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        return int(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError):
        return fallback


def create_stem(master, destination, segments, keep_voice, total_duration,
                planned=None, sample_rate=44100):
    kept = [
        (window, segment)
        for window, segment in zip(planned, segments)
        if segment.get("voice_id") == keep_voice
    ] if planned else []
    kept_segments = [
        segment for segment in segments if segment.get("voice_id") == keep_voice
    ]
    if not kept_segments:
        present = sorted({s.get("voice_id") for s in segments if s.get("voice_id")})
        # Suggest the id nobody in the current cast claims — that is the one
        # this speaker's voice was changed away from.
        unclaimed = [v for v in present if v not in SPEAKERS.values()]
        name = next((n for n, v in SPEAKERS.items() if v == keep_voice), "<name>")
        raise SystemExit(
            f"No dialogue segments were found for voice {keep_voice}.\n"
            f"  This response was recorded with: {', '.join(present)}\n"
            "  A saved response keeps the voice ids it was generated with, so a\n"
            "  voice the cast has changed since will not match. To reprocess it,\n"
            "  name the voice it actually used, e.g.\n"
            f"    --voice {name}={unclaimed[0] if unclaimed else '<id from above>'}"
        )

    # THE CLOSING LINE KEEPS ITS TAIL. END_GUARD_SECONDS exists to stop one
    # speaker bleeding into the next line — and the last line of the dialogue
    # has no next line. ElevenLabs' final end_time_seconds can also fall well
    # short of where the master actually stops (1.1s short on the 2026-07-31
    # test episode), so trimming the closing line to it drops the end of the
    # performance and leaves silence in its place. Nothing follows it, so it
    # runs to the end of the master.
    closing_segment = segments[-1] if segments else None

    # The silence bed must be the master's own rate. It was hardcoded to 44100
    # while episodes are recorded at whatever LT_TV_PCM_RATE says — 24000 on a
    # plan below Pro — which left ffmpeg resampling a bed that had no reason to
    # differ.
    filters = [
        (
            f"anullsrc=r={sample_rate}:cl=mono,"
            f"atrim=duration={total_duration:.6f},"
            "asetpts=PTS-STARTPTS[silence]"
        )
    ]
    mix_inputs = ["[silence]"]

    windows = (
        [window for window, _ in kept]
        if kept
        else [None] * len(kept_segments)
    )

    for index, segment in enumerate(kept_segments):
        window = windows[index]
        if window is not None:
            start = window["start"]
            end = window["end"]
        else:
            # No plan (nothing measured at all): the original guarded instants.
            reported_start = float(segment["start_time_seconds"])
            reported_end = float(segment["end_time_seconds"])
            start = reported_start + START_GUARD_SECONDS
            end = reported_end - END_GUARD_SECONDS
            if reported_start == 0:
                start = 0
            if segment is closing_segment:
                end = max(end, total_duration)
        duration = max(0.001, end - start)
        fade = min(BOUNDARY_FADE_SECONDS, duration / 4)
        fade_out_start = max(0, duration - fade)
        delay_ms = max(0, round(start * 1000))
        label = f"speech{index}"
        filters.append(
            (
                f"[0:a]atrim=start={start:.6f}:end={end:.6f},"
                "asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d={fade:.6f},"
                f"afade=t=out:st={fade_out_start:.6f}:d={fade:.6f},"
                f"adelay={delay_ms}:all=1[{label}]"
            )
        )
        mix_inputs.append(f"[{label}]")

    filters.append(
        (
            "".join(mix_inputs)
            + f"amix=inputs={len(mix_inputs)}:"
            "duration=first:dropout_transition=0:normalize=0[out]"
        )
    )

    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(master),
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-codec:a",
        "pcm_s16le",
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        str(destination),
    ]
    subprocess.run(command, check=True)


def resolve_speakers(overrides):
    """SPEAKERS, with any --voice NAME=ID applied. Validated up front so a typo
    stops the run instead of silently producing a stem of pure silence."""
    speakers = dict(SPEAKERS)
    for item in overrides:
        name, sep, voice = item.partition("=")
        if not sep or not voice.strip():
            raise SystemExit(f"--voice wants NAME=ID, got: {item}")
        if name not in SPEAKERS:
            raise SystemExit(
                f"--voice names an unknown speaker {name!r}; "
                f"this set has {', '.join(SPEAKERS)}."
            )
        speakers[name] = voice.strip()
    return speakers


def write_episode_record(args, show_timing):
    """A starter src/content/lt-tv episode record.

    Everything the pipeline already knows is filled in: the line starts, who
    holds each line, and where the dialogue ends. What a producer still decides
    — the SitePal clip names (which only exist after the upload), which lines
    are played to the room, and the reaction beats — is left blank rather than
    guessed. Nothing here is copied by hand any more.
    """
    episode_id = args.episode_id or f"{args.show}-XX"
    record = {
        "id": episode_id,
        "showId": args.show,
        "number": episode_id.rsplit("-", 1)[-1],
        "title": args.title or "Untitled episode",
        "summary": "",
        "airDate": datetime.date.today().isoformat(),
        "status": "published",
        # Fill these in from SitePal's Audio Manager after uploading the two
        # balanced WAVs. The names must match exactly.
        "audio": {"Connor": "", "Monk": ""},
        "leadIn": 2.5,
        "lineStarts": show_timing["line_starts"],
        "dialogueEnd": show_timing["duration_seconds"],
        "speakers": show_timing["speakers"],
        # Lines played to the room rather than to the other character: no
        # listener turn, and the camera pulls back to the two-shot.
        "audienceLines": [],
        # Reaction beats. See docs/talk-show-production.md for the clip names.
        "cues": [],
    }
    record_path = args.output_dir / "episode-record.json"
    record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return record_path


def require_ffmpeg():
    """Say what is missing, rather than raising FileNotFoundError on 'ffprobe'.

    Splitting the master is the one step in this pipeline that shells out, and
    a machine without ffmpeg fails here with a traceback that names a binary
    and nothing else — which reads like a broken script.
    """
    missing = [tool for tool in ("ffmpeg", "ffprobe") if shutil.which(tool) is None]
    if not missing:
        return
    raise SystemExit(
        f"This step needs {' and '.join(missing)}, which {'are' if len(missing) > 1 else 'is'} "
        "not installed.\n"
        "On a Mac:  brew install ffmpeg\n"
        "Everything up to here is finished and kept, so install it and run this again."
    )


def main():
    parser = argparse.ArgumentParser(
        description="Decode ElevenLabs dialogue and make one SitePal track per speaker."
    )
    parser.add_argument(
        "response",
        type=Path,
        nargs="?",
        help="ElevenLabs response JSON (omit when using --master/--segments)",
    )
    parser.add_argument("output_dir", type=Path, help="Folder for generated audio")
    parser.add_argument(
        "--master",
        type=Path,
        help="An audio file to split instead of decoding one from a response. "
        "This is how a multi-block episode is finished: scripts/lt-tv-audio.mjs "
        "generates each block separately, concatenates them into one master and "
        "writes the merged, offset-shifted segments, then hands both here.",
    )
    parser.add_argument(
        "--segments",
        type=Path,
        help="Voice segments for --master, as voice-segments.json.",
    )
    parser.add_argument(
        "--episode-id",
        default="",
        help="Episode id for the starter record, e.g. roundtable-03 "
        "(default: derived from --show)",
    )
    parser.add_argument(
        "--voice",
        action="append",
        default=[],
        metavar="NAME=ID",
        help="Override one speaker's ElevenLabs voice id for this run "
        "(NAME is " + " or ".join(SPEAKERS) + "). Use when reprocessing an "
        "older response.json that was recorded before the cast changed a voice; "
        "it does not change the voice future episodes are generated with.",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Print where each line's boundary was placed, and how far that moved it "
             "from the time ElevenLabs reported.",
    )
    parser.add_argument("--show", default="roundtable", help="Show id the episode belongs to")
    parser.add_argument("--title", default="", help="Episode title for the starter record")

    args = parser.parse_args()
    speakers = resolve_speakers(args.voice)

    if bool(args.master) != bool(args.segments):
        raise SystemExit("--master and --segments go together; pass both or neither.")
    if args.master and args.response:
        raise SystemExit("Pass a response JSON or --master, not both.")
    if not args.master and not args.response:
        raise SystemExit("Pass a response JSON, or --master with --segments.")

    require_ffmpeg()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    if args.master:
        # An already-assembled master: one block's audio, or several blocks
        # concatenated. Its segments were merged and offset-shifted upstream,
        # so they are already on this file's timeline.
        if not args.master.exists():
            raise SystemExit(f"No such master: {args.master}")
        try:
            segments = json.loads(args.segments.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"Could not read segments: {exc}") from exc
        if not segments:
            raise SystemExit(f"{args.segments} holds no voice segments.")
        master = args.master
    else:
        try:
            payload = json.loads(args.response.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"Could not read response JSON: {exc}") from exc

        if "audio_base64" not in payload:
            detail = payload.get("detail", payload)
            raise SystemExit(f"ElevenLabs did not return audio: {detail}")

        segments = payload.get("voice_segments", [])
        if not segments:
            raise SystemExit("ElevenLabs returned audio but no voice segment timestamps.")

        master = args.output_dir / "master-dialogue.mp3"
        try:
            master.write_bytes(base64.b64decode(payload["audio_base64"], validate=True))
        except (ValueError, OSError) as exc:
            raise SystemExit(f"Could not decode the returned audio: {exc}") from exc

    total_duration = media_duration(master)

    # WHERE THE VOICE ACTUALLY CHANGES, measured rather than taken from the
    # reported instants. See the note by START_GUARD_SECONDS.
    silences = detect_silences(master)
    planned = plan_windows(segments, silences, total_duration)
    rate = media_sample_rate(master)

    names_by_voice = {voice_id: name for name, voice_id in speakers.items()}
    rows, unmeasured = boundary_report(planned, names_by_voice)
    print(f"\n{len(silences)} gaps measured in the master.")
    if args.report:
        print("\nline  speaker  where the cut goes:")
        for row in rows:
            print(row)
    elif unmeasured:
        # Shown without being asked for, because these are the boundaries that
        # can still be heard — the rest have been placed in real silence.
        print("\nThe boundaries that could not be measured:")
        for index in unmeasured:
            print(rows[index])
    if unmeasured:
        print(
            f"\n{len(unmeasured)} boundary(s) had no measurable gap, so they fall back to the\n"
            "time ElevenLabs reported. Those two lines run straight into each other in\n"
            "the recording, so no boundary is clean there. If one is audible, the fix is\n"
            "in the writing rather than the cutting."
        )

    for name, voice_id in speakers.items():
        destination = args.output_dir / f"{name}-sitepal-balanced.wav"
        create_stem(
            master,
            destination,
            segments,
            voice_id,
            total_duration,
            planned=planned,
            sample_rate=rate,
        )

    timing_path = args.output_dir / "voice-segments.json"
    timing_path.write_text(
        json.dumps(segments, indent=2) + "\n",
        encoding="utf-8",
    )

    actor_for_voice = {
        voice_id: ACTOR_NAMES[name] for name, voice_id in speakers.items()
    }
    show_timing = {
        "duration_seconds": round(total_duration, 3),
        "line_starts": [
            round(float(segment["start_time_seconds"]), 3)
            for segment in segments
        ],
        "line_ends": [
            round(float(segment["end_time_seconds"]), 3)
            for segment in segments
        ],
        "speakers": [
            actor_for_voice.get(segment.get("voice_id"), segment.get("voice_id"))
            for segment in segments
        ],
    }
    show_timing_path = args.output_dir / "talk-show-timing.json"
    show_timing_path.write_text(
        json.dumps(show_timing, indent=2) + "\n",
        encoding="utf-8",
    )

    record_path = write_episode_record(args, show_timing)

    print(f"Created a {total_duration:.1f}-second dialogue:")
    print(f"  Master: {master}")
    for name in speakers:
        print(f"  {name.upper()}: {args.output_dir / f'{name}-sitepal-balanced.wav'}")
    print(f"  Timings: {timing_path}")
    print(f"  Show cues: {show_timing_path}")
    print(f"  Episode record: {record_path}")
    # Deliberately says nothing about what comes next. This runs as the first
    # half of `npm run lt:split`, which cuts these tracks into the sections
    # SitePal will accept and then prints what to upload and what to run. The
    # advice that used to be here predated all of that: it described moving the
    # record by hand and named neither the sections nor the slate join, and it
    # printed immediately above the instructions that supersede it.
    print(f"\n{len(speakers)} balanced tracks written, one per character.")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"Audio processing failed: {exc}", file=sys.stderr)
        raise SystemExit(exc.returncode) from exc
    except FileNotFoundError as exc:
        print(f"Audio processing failed — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
