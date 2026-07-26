# Liminal Terminal talk-show production

This is the repeatable workflow for producing a Saint GR80 and John Barron
episode with expressive ElevenLabs dialogue, clean SitePal audio tracks, and
scripted body animation.

The working files live in `elevenlabs-dialogue-test/`. The runtime director is
`src/components/trade/TalkShowScene.jsx`.

## What the pipeline produces

One ElevenLabs request generates the whole conversation in context. The local
processor then creates:

- `master-dialogue.mp3` — the unedited conversation, useful for review.
- `john-sitepal-balanced.wav` — Barron plus silence during every GR80 line.
- `gr80-sitepal-balanced.wav` — GR80 plus silence during every Barron line.
- `voice-segments.json` — ElevenLabs' complete turn timing response.
- `talk-show-timing.json` — compact line starts, ends, speakers, and total
  duration for the animation director.

The two balanced WAV files have identical duration and begin at time zero.
Starting both SitePal audios together reconstructs the conversation while each
avatar lip-syncs only its own lines.

## 1. Write the dialogue

Edit `elevenlabs-dialogue-test/dialogue.json`. Each item is one spoken turn:

```json
{
  "inputs": [
    {
      "text": "[confidently] Good evening. Tonight, humanity is on the bid.",
      "voice_id": "IcFWazAaBzXNwLWpySgF"
    },
    {
      "text": "[dryly] Your opening monologue is already overleveraged.",
      "voice_id": "JBFqnCBsd6RMkjVDRZzb"
    }
  ],
  "model_id": "eleven_v3",
  "language_code": "en",
  "seed": 48127
}
```

Current voices:

- John Barron: `IcFWazAaBzXNwLWpySgF`
- Saint GR80: `JBFqnCBsd6RMkjVDRZzb`

Keep the total request under roughly 2,000 characters for reliable Text to
Dialogue generation. For longer episodes, generate contiguous sections and
treat each section as its own production unit.

### Emotion and delivery brackets

Eleven v3 accepts natural-language audio tags in square brackets. Put a
delivery tag at the beginning of the turn it controls:

```json
{ "text": "[reluctantly] Fine. Save humanity.", "voice_id": "..." }
```

Tags that have worked well for these characters include:

- Barron: `[confidently]`, `[slightly offended]`, `[suspiciously]`,
  `[horrified]`, `[reluctantly]`, `[matter-of-factly]`
- GR80: `[dryly]`, `[patiently]`, `[amused]`, `[calmly]`,
  `[with quiet disapproval]`

Use one clear direction per turn by default. Tags are suggestions interpreted
through the selected voice, so regenerate when a reading feels forced.
Punctuation also directs performance: an ellipsis adds weight, a dash can
create an interruption, and capitalization adds emphasis.

### Chuckles, sighs, and other vocal reactions

Eleven v3 can also perform short human reactions. Useful examples include:

- `[chuckles]`, `[laughs softly]`, `[starts laughing]`
- `[sighs]`, `[exhales]`, `[groans]`
- `[clears throat]`, `[snorts]`, `[gulps]`
- `[whispers]`, `[muttering]`

Place a bracketed event exactly where it should occur:

```json
{
  "text": "You call that risk management? [chuckles] Adorable.",
  "voice_id": "IcFWazAaBzXNwLWpySgF"
}
```

You can instead write a reaction as dialogue when you want precise syllables:

```json
{
  "text": "Heh. Your confidence remains impressively unfunded.",
  "voice_id": "JBFqnCBsd6RMkjVDRZzb"
}
```

`[chuckles]` asks the model to generate a nonverbal performance; `Heh.` is
spoken text and is usually more repeatable. Try `Heh…`, `Heh heh.`, or
`Hah!` to alter rhythm and intensity. Keep reactions sparse so they land as
character beats rather than becoming vocal clutter.

Delivery tags such as `[dryly]` usually do not create a separate sound.
Event tags such as `[sighs]`, `[laughs]`, or `[clears throat]` can. Do not put
an important event at the first instant of a new speaker's turn: the cleanup
pipeline removes the first 120 ms of most handoffs to eliminate transition
artifacts. Put the event after a few words, or audition and adjust the guard
for that episode.

Keep a successful `seed` when revising timing or cues. The seed improves
repeatability, although ElevenLabs does not guarantee identical output.

## 2. Generate and clean the tracks

Requirements:

- `ffmpeg` and `ffprobe`
- Python 3
- an ElevenLabs API key

From the project folder:

```bash
cd elevenlabs-dialogue-test
./run_test.sh
```

The script asks for the API key without displaying or saving it. Outputs are
written to `elevenlabs-dialogue-test/output/`.

### Why the balanced WAV files stay clean

Do not split the conversation into separately generated lines. Text to Dialogue
generates the performance as one continuous piece, preserving conversational
timing. `process_dialogue.py` uses ElevenLabs' reported `voice_segments` to
construct one full-length track per character:

- complete digital silence under the other character;
- a 120 ms start guard after speaker handoffs, where the short blips occurred;
- only a 10 ms end guard, preserving final syllables;
- 20 ms fades at every admitted boundary, preventing clicks;
- uncompressed 44.1 kHz, 16-bit mono WAV output for SitePal.

The first turn begins at zero and is not start-trimmed.

### Quality check

Listen to all three files before uploading:

1. The master should have the preferred performances and complete words.
2. Each balanced WAV should contain only that character.
3. Check every handoff for a blip.
4. Check every last syllable for truncation.
5. Confirm both balanced WAVs have the same duration.

If a handoff artifact remains, increase `START_GUARD_SECONDS` in
`process_dialogue.py` in small 0.01-second increments. If a first consonant is
clipped, reduce it in the same increments. If a final syllable is clipped,
reduce `END_GUARD_SECONDS`; do not increase the end trim. Keep
`BOUNDARY_FADE_SECONDS` short—normally 0.02 seconds.

Regenerate the dialogue when the defect exists in `master-dialogue.mp3`.
Boundary processing cannot repair a word ElevenLabs itself cut short.

## 3. Upload to SitePal

Upload:

- `john-sitepal-balanced.wav` to Barron's SitePal Audio Manager.
- `gr80-sitepal-balanced.wav` to GR80's SitePal Audio Manager.

Give each upload a short, unique episode name. After SitePal finishes
processing, copy the names exactly into `TALK_SHOW_AUDIO` near the top of
`TalkShowScene.jsx`:

```js
const TALK_SHOW_AUDIO = {
  Barron: "episode 02 barron",
  Monk: "episode 02 gr80",
};
```

Do not remove the leading silence or independently shift either file. The live
show starts both full-length tracks together; their shared timeline is what
keeps the voices and faces synchronized. The master MP3 is for review and
editing reference, not live playback.

## 4. Transfer the line timing

Open the generated `output/talk-show-timing.json`. Copy its `line_starts` array
into `TEST_LINE_STARTS` in `TalkShowScene.jsx`.

The line number is zero-based and matches the order of `inputs` in
`dialogue.json`:

```js
const TEST_LINE_STARTS = [0, 8.4, 13.92, 20.64];
```

The generated `speakers` array is a quick check that every voice ID was mapped
to the intended character.

## 5. Add animation cues

The available clips are registered in `CHARACTER_CLIPS`; their full authored
lengths are in `REACTION_DURATIONS`. The current cue names are:

- Both: `headnod`, `headnodSubtle`, `headshakeDisappointment`, `lookAround`,
  `shrug`
- Monk only: `headshake`, `prayCrosschest`
- Barron only: `mockCrying`

Use `headnodSubtle` for ordinary agreement. Reserve `headnod` for an emphatic
beat.

Add direction to `TALK_SHOW_CUE_DEFS`:

```js
{
  line: 4,
  offset: 0.3,
  actor: "Barron",
  reaction: "shrug",
  duration: 3.3,
}
```

- `line` — zero-based dialogue turn.
- `offset` — seconds after that turn begins.
- `actor` — `"Barron"` or `"Monk"`.
- `reaction` — one of the registered cue names.
- `duration` — how long to play before returning to the breathing idle.

`duration` is optional; omitting it uses the clip's full registered length.
A shorter value is often better for pose-2 clips whose expressive gesture
finishes before their trailing idle. Reaction clips hold their final pose until
the return crossfade finishes, preventing T-pose flashes.

Avoid overlapping two reactions on the same character unless the interruption
is intentional. Reactions on different characters may overlap.

## 6. Direct listener gaze

Head turns are explicit, not automatic. Add a line to
`DIRECT_ADDRESS_GAZES` only when the speaker is directly addressing the other
character:

```js
{ line: 6, listener: "Monk" }
```

Omit broad statements delivered to the audience. Barron's intro uses the
camera-facing Demon head calibration; GR80's opening `lookAround` surveys the
audience. Listener turns currently use approximately 30 degrees for Barron and
23 degrees for GR80.

## 7. Test the episode

1. Open `/trade` and enter **THE SHOW**.
2. Wait for **START TEST** rather than **LOADING VOICES**.
3. Play the entire episode once without stopping.
4. Check voice handoffs, final syllables, face sync, reaction timing, gaze,
   crossfades, and the final return to idle.
5. Test a second playback; stale actions should reset cleanly.

When `talk_show.glb` is re-exported, bump the query version in `MODEL_URL` so
the browser does not retain the previous animation library.

## Per-episode checklist

- [ ] Dialogue turns and voice IDs are correct.
- [ ] Emotion tags fit the character and are not overused.
- [ ] Master performance is approved.
- [ ] No blips or clipped syllables in either balanced WAV.
- [ ] Both balanced WAV files have equal duration.
- [ ] SitePal upload names exactly match `TALK_SHOW_AUDIO`.
- [ ] `TEST_LINE_STARTS` matches `talk-show-timing.json`.
- [ ] Reaction cues use valid names and appropriate durations.
- [ ] Direct-address gaze cues are intentional.
- [ ] Full first and second playback pass cleanly.
