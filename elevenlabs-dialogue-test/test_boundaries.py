#!/usr/bin/env python3
"""Where one speaker's line stops and the next begins.

    python3 elevenlabs-dialogue-test/test_boundaries.py

No ffmpeg and no audio: silencedetect output is text, and the boundary choice
is arithmetic over it, so both are checked here directly. What is NOT checked
here is the ffmpeg run itself — that needs a machine with ffmpeg and a master.

The case that matters is the one Michelle heard on 2026-09-21: "GR80 interjects
with 'old nothing' instead of 'you sold nothing'". ElevenLabs said Connor's
line ended, and GR80's began, at one instant. The real recording changed voice
almost half a second earlier, so the tail of Connor's window held the head of
GR80's line, and GR80's own window started after he had begun speaking.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from process_dialogue import (  # noqa: E402
    parse_silences,
    find_gap,
    plan_windows,
    boundary_report,
    START_GUARD_SECONDS,
    END_GUARD_SECONDS,
)

failures = 0


def check(label, actual, expected):
    global failures
    if actual == expected:
        print(f"  ok  {label}")
    else:
        print(f"  XX  {label}\n        expected {expected!r}\n        got      {actual!r}")
        failures += 1


def ok(label, condition):
    check(label, bool(condition), True)


print("\nReading silencedetect:")
SAMPLE = """
[silencedetect @ 0x7f8] silence_start: 9.61
[silencedetect @ 0x7f8] silence_end: 10.02 | silence_duration: 0.41
[silencedetect @ 0x7f8] silence_start: 12.4
[silencedetect @ 0x7f8] silence_end: 12.71 | silence_duration: 0.31
[silencedetect @ 0x7f8] silence_start: 40.9
"""
check("the closed windows come back", parse_silences(SAMPLE), [(9.61, 10.02), (12.4, 12.71)])
ok("a window with no end is dropped", all(w[1] for w in parse_silences(SAMPLE)))
check("nothing measured reads as nothing", parse_silences(""), [])

print("\nFinding the gap at a junction:")
SIL = [(9.61, 10.02), (12.4, 12.71), (30.0, 30.5)]
check("an instant inside a gap takes that gap", find_gap(9.8, SIL), (9.61, 10.02))
check("an instant just after one takes it", find_gap(10.3, SIL), (9.61, 10.02))
check("an instant just before one takes it", find_gap(12.1, SIL), (12.4, 12.71))
check("an instant far from any takes none", find_gap(20.0, SIL), None)

print("\nThe symptom: the reported boundary is late:")
# Connor speaks 0 - 9.61, then silence, then GR80 from 10.02.
# ElevenLabs reports the junction at 10.4 — 0.38s AFTER GR80 has begun.
segments = [
    {"start_time_seconds": 0.0, "end_time_seconds": 10.4, "voice_id": "connor"},
    {"start_time_seconds": 10.4, "end_time_seconds": 12.55, "voice_id": "gr80"},
    {"start_time_seconds": 12.55, "end_time_seconds": 30.2, "voice_id": "connor"},
]
planned = plan_windows(segments, SIL, 31.0)

# What the old guards did, for comparison.
old_connor_end = 10.4 - END_GUARD_SECONDS      # 10.39 — past where GR80 started
old_gr80_start = 10.4 + START_GUARD_SECONDS    # 10.52 — past where GR80 started
ok("the old end really did reach into GR80's line", old_connor_end > 10.02)
ok("and the old start really did miss its head", old_gr80_start > 10.02)

ok("Connor's line now ends in the gap, before GR80 speaks",
   9.61 <= planned[0]["end"] <= 10.02)
ok("GR80's line now starts in the gap, before he speaks",
   9.61 <= planned[1]["start"] <= 10.02)
check("they share the one boundary, so no audio is lost",
      planned[0]["end"], planned[1]["start"])
ok("every window was measured", all(w["measured"] for w in planned))
ok("the first line still starts at the top of the master", planned[0]["start"] == 0.0)
ok("the last line still runs to the end of it", planned[-1]["end"] >= 31.0)

print("\nJunctions cover the whole master, once each:")
ok("each line begins where the one before it ended",
   all(planned[i]["start"] == planned[i - 1]["end"] for i in range(1, len(planned))))
ok("no window is inverted", all(w["end"] > w["start"] for w in planned))

print("\nA short line between two junctions that want the same gap:")
# Michelle, 2026-09-21: "the correct voices say their own lines in the
# master-dialogue.wav but in the animation, the wrong characters lip synch some
# of the lines." The audio was right and the WINDOWS were wrong. "You sold
# nothing." is about a second and a half long, and the only measurable gap is
# the one in front of it — so the junction before it and the junction after it
# both snapped to that one gap, its window collapsed to a millisecond, and its
# audio fell inside the next speaker's window. That speaker's avatar then
# lip-synced a line it was never given.
short = [
    {"start_time_seconds": 0.0, "end_time_seconds": 10.0, "voice_id": "connor"},
    {"start_time_seconds": 10.0, "end_time_seconds": 11.4, "voice_id": "gr80"},
    {"start_time_seconds": 11.4, "end_time_seconds": 25.0, "voice_id": "connor"},
]
squeezed = plan_windows(short, [(9.6, 10.0), (24.0, 24.4)], 26.0)

ok("the short line keeps a window of its own",
   squeezed[1]["end"] - squeezed[1]["start"] > 1.0)
ok("which actually covers where it is spoken",
   squeezed[1]["start"] <= 10.0 and squeezed[1]["end"] >= 11.3)
ok("and the next speaker does not start before it has finished",
   squeezed[2]["start"] >= 11.4)
ok("no two junctions take the same gap",
   squeezed[0]["end"] != squeezed[1]["end"])
ok("every window is a real length", all(w["end"] - w["start"] > 0.05 for w in squeezed))
ok("the junction that could not be measured says so", not squeezed[1]["end_measured"])

# The same must hold when there is no measurable gap anywhere near a run of
# short lines — the windows must still tile forwards, never backwards.
rapid = [
    {"start_time_seconds": 0.0, "end_time_seconds": 2.0, "voice_id": "connor"},
    {"start_time_seconds": 2.0, "end_time_seconds": 3.0, "voice_id": "gr80"},
    {"start_time_seconds": 3.0, "end_time_seconds": 4.0, "voice_id": "connor"},
    {"start_time_seconds": 4.0, "end_time_seconds": 5.0, "voice_id": "gr80"},
]
fast = plan_windows(rapid, [(1.9, 2.1)], 6.0)
ok("a volley of short lines still moves forwards only",
   all(fast[i]["start"] >= fast[i - 1]["start"] for i in range(1, len(fast))))
ok("and none of them is squeezed out",
   all(w["end"] > w["start"] for w in fast))

print("\nA breath in the middle of a long line is not a junction:")
# Michelle, 2026-09-21: "i hear gr80 interject in the first connor recording
# when it says 'You cannot'." That is the END of GR80's line 3 — "...who is
# standing inside the promises you cannot." His line is long and breathes in
# the middle, and the junction snapped 1.2s BACKWARDS onto that breath, so the
# last clause of his line sat inside Connor's window.
#
# The cause was the search radius: 1.5s, copied from the section cutter, where
# being a second out is harmless because both tracks cut identically. For a
# stem boundary it is a whole clause in the wrong mouth.
long_line = [
    {"start_time_seconds": 20.0, "end_time_seconds": 40.2, "voice_id": "gr80"},
    {"start_time_seconds": 40.2, "end_time_seconds": 48.0, "voice_id": "connor"},
]
breath = (38.9, 39.1)
real = (40.0, 40.6)

both = plan_windows(long_line, [breath, real], 50.0)
ok("the real gap between the lines is used when it was measured",
   real[0] <= both[0]["end"] <= real[1])
ok("so nothing of GR80 is left in Connor's window", both[1]["start"] >= 40.0)

only_breath = plan_windows(long_line, [breath], 50.0)
ok("a breath 1.2s away is NOT mistaken for the junction",
   only_breath[0]["end"] > 39.5)
ok("it falls back to the reported instant instead",
   abs(only_breath[0]["end"] - 40.2) < 0.2)
ok("and says it could not measure that one", not only_breath[0]["end_measured"])
# The fallback is wrong by the reporting error — a syllable — where the breath
# would have been wrong by a clause. That is the whole trade.
ok("the fallback is far closer to the truth than the breath was",
   abs(only_breath[1]["start"] - 40.3) < abs(39.0 - 40.3))

print("\nWhen the lines really do run together:")
# No gap anywhere near the junction at 10.4.
bare = plan_windows(segments, [(30.0, 30.5)], 31.0)
ok("the junction falls back to the guarded instant",
   abs(bare[0]["end"] - (10.4 - END_GUARD_SECONDS)) < 1e-9)
ok("and the next line to the guarded start",
   abs(bare[1]["start"] - (10.4 + START_GUARD_SECONDS)) < 1e-9)
ok("it is marked unmeasured rather than trusted", not bare[0]["measured"])
rows, unmeasured = boundary_report(bare, {"connor": "Connor", "gr80": "Monk"})
check("the report names one line per bad junction, not per line", unmeasured, [1, 2])
ok("line 0 is never counted, having nothing in front of it", 0 not in unmeasured)
ok("naming the speaker, not the voice id", "Connor" in rows[0] and "gr80" not in rows[0])

print("\nWith nothing measured at all, nothing is worse than before:")
none_planned = plan_windows(segments, [], 31.0)
ok("every junction falls back", not any(w["measured"] for w in none_planned[:-1]))
check("and an empty episode plans nothing", plan_windows([], SIL, 10.0), [])


print("\nWhy the per-character alignment cannot place a boundary:")
# A whole fix was built on `alignment` on 2026-09-21 and had to be reverted.
# This checks the reason against the archived response rather than trusting a
# comment, because the next person to read those docs will have the same idea.
import json  # noqa: E402

_response = Path(__file__).parent / "response.json"
if not _response.exists():
    print("  -- skipped, no archived response here")
else:
    _payload = json.loads(_response.read_text(encoding="utf-8"))
    _a = _payload.get("alignment") or {}
    _segs = _payload.get("voice_segments") or []
    _starts = _a.get("character_start_times_seconds") or []
    _ends = _a.get("character_end_times_seconds") or []

    ok("the response really does carry an alignment", bool(_starts and _ends))
    # 1. The alignment is continuous: no character is ever followed by a gap.
    _breaks = sum(
        1 for i in range(len(_starts) - 1) if abs(_ends[i] - _starts[i + 1]) > 1e-9
    )
    check("no gap anywhere between one character and the next", _breaks, 0)
    # 2. Lines are adjacent in that character stream.
    _apart = sum(
        1
        for i in range(len(_segs) - 1)
        if int(_segs[i]["character_end_index"]) != int(_segs[i + 1]["character_start_index"])
    )
    check("and consecutive lines share a character index", _apart, 0)
    # 1 + 2 => a line's last character ends exactly when the next line's first
    # one begins. The "exact" boundary IS the reported boundary, always.
    _same = all(
        abs(_ends[int(_segs[i]["character_end_index"]) - 1]
            - float(_segs[i + 1]["start_time_seconds"])) < 1e-3
        for i in range(len(_segs) - 1)
    )
    ok("so every junction lands on the reported instant, with nothing to measure", _same)
    # And the tell that the edges are synthetic: real speech does not stop in 1ms.
    _instant = sum(
        1
        for s in _segs
        if abs(_ends[int(s["character_end_index"]) - 1]
               - _starts[int(s["character_end_index"]) - 1]) < 0.002
    )
    ok("with some line endings given an impossible 1ms final character", _instant > 0)

print("" if failures else "\nAll checks passed.\n")
if failures:
    print(f"\n{failures} check(s) failed.\n")
sys.exit(1 if failures else 0)
