#!/usr/bin/env python3

import argparse
import base64
import datetime
import json
import subprocess
import sys
from pathlib import Path


SPEAKERS = {
    "john": "IcFWazAaBzXNwLWpySgF",
    "gr80": "fATgBRI8wg5KkDFg8vBd",
}

ACTOR_NAMES = {
    "john": "Connor",
    "gr80": "Monk",
}

START_GUARD_SECONDS = 0.12
END_GUARD_SECONDS = 0.01
BOUNDARY_FADE_SECONDS = 0.02


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


def create_stem(master, destination, segments, keep_voice, total_duration):
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

    filters = [
        (
            f"anullsrc=r=44100:cl=mono,"
            f"atrim=duration={total_duration:.6f},"
            "asetpts=PTS-STARTPTS[silence]"
        )
    ]
    mix_inputs = ["[silence]"]

    for index, segment in enumerate(kept_segments):
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
        "44100",
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
        help="Episode id for the starter record, e.g. roundtable-02 "
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
    for name, voice_id in speakers.items():
        destination = args.output_dir / f"{name}-sitepal-balanced.wav"
        create_stem(master, destination, segments, voice_id, total_duration)

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
    print(
        "\nNext: upload both WAVs to SitePal, put their clip names in the "
        "record's `audio`, add your reaction cues, then move it to "
        "src/content/lt-tv/episodes/ and run `node scripts/lt-tv-check.mjs`."
    )


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"Audio processing failed: {exc}", file=sys.stderr)
        raise SystemExit(exc.returncode) from exc
