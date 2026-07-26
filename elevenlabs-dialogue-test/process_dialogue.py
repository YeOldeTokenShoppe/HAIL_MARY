#!/usr/bin/env python3

import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path


SPEAKERS = {
    "john": "IcFWazAaBzXNwLWpySgF",
    "gr80": "JBFqnCBsd6RMkjVDRZzb",
}

ACTOR_NAMES = {
    "john": "Barron",
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
        raise SystemExit(f"No dialogue segments were found for voice {keep_voice}.")

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


def main():
    parser = argparse.ArgumentParser(
        description="Decode ElevenLabs dialogue and make one SitePal track per speaker."
    )
    parser.add_argument("response", type=Path, help="ElevenLabs response JSON")
    parser.add_argument("output_dir", type=Path, help="Folder for generated audio")
    args = parser.parse_args()

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

    args.output_dir.mkdir(parents=True, exist_ok=True)
    master = args.output_dir / "master-dialogue.mp3"

    try:
        master.write_bytes(base64.b64decode(payload["audio_base64"], validate=True))
    except (ValueError, OSError) as exc:
        raise SystemExit(f"Could not decode the returned audio: {exc}") from exc

    total_duration = media_duration(master)
    for name, voice_id in SPEAKERS.items():
        destination = args.output_dir / f"{name}-sitepal-balanced.wav"
        create_stem(master, destination, segments, voice_id, total_duration)

    timing_path = args.output_dir / "voice-segments.json"
    timing_path.write_text(
        json.dumps(segments, indent=2) + "\n",
        encoding="utf-8",
    )

    actor_for_voice = {
        voice_id: ACTOR_NAMES[name] for name, voice_id in SPEAKERS.items()
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

    print(f"Created a {total_duration:.1f}-second dialogue:")
    print(f"  Master: {master}")
    for name in SPEAKERS:
        print(f"  {name.upper()}: {args.output_dir / f'{name}-sitepal-balanced.wav'}")
    print(f"  Timings: {timing_path}")
    print(f"  Show cues: {show_timing_path}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"Audio processing failed: {exc}", file=sys.stderr)
        raise SystemExit(exc.returncode) from exc
