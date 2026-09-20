# Liminal Terminal talk-show production

This is the repeatable workflow for producing a Saint GR80 and Connor
episode with expressive ElevenLabs dialogue, clean SitePal audio tracks, and
scripted body animation. If you just want the commands in order, start at
`docs/lt-tv.md` and come back here for the detail.

The working files live in `elevenlabs-dialogue-test/`. The finished episode is
one JSON record in `src/content/lt-tv/episodes/`, and that record is the whole
episode: what the guide lists and what the set performs. `TalkShowScene.jsx`
is the SET — the rig, the clips, the camera — and producing an episode never
edits it.

## What the pipeline produces

One ElevenLabs request generates the whole conversation in context. The local
processor then creates:

- `master-dialogue.mp3` — the unedited conversation, useful for review.
- `john-sitepal-balanced.wav` — Connor plus silence during every GR80 line.
- `gr80-sitepal-balanced.wav` — GR80 plus silence during every Connor line.
- `voice-segments.json` — ElevenLabs' complete turn timing response.
- `talk-show-timing.json` — compact line starts, ends, speakers, and total
  duration for the animation director.
- `episode-record.json` — a starter LT TV episode record with that timing
  already in it. Finish it in step 4 and it becomes the episode.

The two balanced WAV files have identical duration and begin at time zero.
Starting both SitePal audios together reconstructs the conversation while each
avatar lip-syncs only its own lines.

## 1. Write the dialogue

There are two ways in. **Generate the episode** with `scripts/lt-rt-script.mjs`,
which is the path for an episode of the show; or **write the turns by hand**
into `dialogue.json`, which is the path for a one-off that does not belong on
the slate. The rest of this document — the tags, the cleanup, the upload, the
lead-in — is the same either way.

### Generating one

```bash
node scripts/lt-rt-script.mjs --list                 # what is waiting
node scripts/lt-rt-script.mjs --topic roundtable-02  # write it
node scripts/lt-tv-edit.mjs roundtable-02            # revise it, free
```

It runs two Claude calls. The first writes **the argument**, not the dialogue:
the question, Connor's honest case, GR80's reframe, a hard case, and who
concedes what. The second writes the lines from that plan. Splitting it is
deliberate — an argument that does not work is much cheaper to spot as five
fields than as six minutes of dialogue, and `--plan-only` stops after the first
call so you can read it.

**The thing to judge, and the only one that matters:** both of them have to be
right about something. Connor's case should be the one a thoughtful opponent
would concede is fair, GR80's reframe should name a cost the case really does
carry, and the hard case should be uncomfortable for both. A plan where GR80
simply corrects Connor produces a sermon. Reject it and re-run rather than
fixing it in the dialogue — the flaw is upstream.

**This show states no statistics.** The prompt forbids inventing numbers,
studies, dates and quotes outright, because the roundtable argues from
reasoning and example rather than evidence. That is why there is no sourcing
pass here and why the news show has one: a wrong number spoken in a
character's voice is expensive to undo, and the cheapest guarantee is having
no numbers to get wrong. If a generated line states a figure as fact, cut it
in the editor.

An episode already on the slate keeps the title and summary it was given. The
generator writes the argument; it does not rename the running order.

`content/lt-tv/samples/roundtable-02.draft.json` is a worked example, written by
hand. **Its argument is invented** and it is not a scheduled episode.

### Writing the turns by hand

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
      "voice_id": "fATgBRI8wg5KkDFg8vBd"
    }
  ],
  "model_id": "eleven_v3",
  "language_code": "en",
  "seed": 48127
}
```

Current voices:

- Connor: `IcFWazAaBzXNwLWpySgF`
- Saint GR80: `fATgBRI8wg5KkDFg8vBd`

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

- Connor: `[confidently]`, `[slightly offended]`, `[suspiciously]`,
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
  "voice_id": "fATgBRI8wg5KkDFg8vBd"
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

That is one ElevenLabs call per episode, no matter how many people watch it.
Recording once and uploading is what keeps the cost flat; having SitePal speak
the lines live through `sayText` would spend a call on every playback. It is the
reason this pipeline exists in the shape it does, and a reason not to replace it
with live speech later.

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

**The closing line is a special case.** ElevenLabs' `end_time_seconds` for the
last turn can fall short of where the master actually stops — on the 2026-07-31
test episode the master runs 59.04s while the last turn is reported to end at
57.92s, a 1.1-second gap. The end guard exists to stop one speaker bleeding
into the next line, and the last line has no next line, so it now runs to the
end of the master instead of to its reported end. If the close of an older
episode sounds cut off, that is why: re-run the processor over the saved
`response.json` (no ElevenLabs call, no API key, just ffmpeg) and re-upload the
stem of whoever speaks last.

A saved `response.json` keeps the voice ids it was generated with. If a
character's ElevenLabs voice has been changed since, reprocessing that response
fails with *No dialogue segments were found for voice …* — the script names the
ids the response actually carries, and `--voice <name>=<id>` reprocesses it
without changing the voice future episodes use. The committed test episode is
exactly this case: it was recorded with GR80 on `JBFqnCBsd6RMkjVDRZzb`, and the
cast moved to `fATgBRI8wg5KkDFg8vBd` afterwards.

```bash
python3 process_dialogue.py response.json output --voice gr80=JBFqnCBsd6RMkjVDRZzb
```

## 3. Upload to SitePal

Upload:

- `john-sitepal-balanced.wav` to Connor's SitePal Audio Manager.
- `gr80-sitepal-balanced.wav` to GR80's SitePal Audio Manager.

Give each upload a name that follows the convention below. After SitePal
finishes processing, copy the names exactly into the record's `audio` block
(step 4).

### Naming clips

The Audio Manager is the SitePal account's shared clip library: the list of
uploaded audio files `sayAudio` looks names up in. There is one for account
`9308752`, not one per character, so every clip for every character and every
show sits in the same list. It has nothing to do with the ElevenLabs voice each
SitePal character is configured with — the talk show never uses SitePal's own
text-to-speech, only these pre-rendered uploads.

One shared list means the name has to carry its own namespace. The Terminal
Traders clips already in there look like `case001_monk_q5`, so LT TV follows the
same shape:

```
lttv_<show>_ep<NN>_<character>
```

- `<show>` is `rt` (The Liminal Terminal), `news` (LT Weekly News Recap) or `mm`
  (Markets & Morality)
- `<NN>` is the episode number, zero-padded: `02`, never `2`
- `<character>` is `connor` or `gr80`

Episode 02 of the roundtable uploads as `lttv_rt_ep02_connor` and
`lttv_rt_ep02_gr80`. An episode split into sections because it ran past the
2,000-character limit appends the section number: `lttv_rt_ep07_connor_s2`.

Lowercase and underscores throughout. SitePal accepts spaces — the clips on air
are `talk show test for jb` and `talk show test GR80` — but these names get
retyped by hand into a JSON record, and a space is a typo waiting to happen.
Renaming a clip later means going back into the Audio Manager by hand, so it is
worth getting right the first time.

Do not remove the leading silence or independently shift either file. The live
show starts both full-length tracks together; their shared timeline is what
keeps the voices and faces synchronized. The master MP3 is for review and
editing reference, not live playback.

## 4. Finish the episode record

`run_test.sh` already wrote `output/episode-record.json`, with the line starts,
the speakers and the dialogue length filled in from the generation. Name the
episode while you generate it and the record arrives named too:

```bash
./run_test.sh --episode-id roundtable-02 --title "The Wealth Effect"
```

What is left to fill in is what only you know:

```json
{
  "title": "The Wealth Effect",
  "summary": "Paper gains, real confidence, and the stories a rising chart tells.",
  "audio": { "Connor": "episode 02 barron", "Monk": "episode 02 gr80" },
  "audienceLines": [0, 5],
  "cues": [
    { "line": 4, "offset": 0.3, "actor": "Connor", "reaction": "shrug", "duration": 3.3,
      "note": "I closed the position at a substantial profit." }
  ]
}
```

- **`audio`** — the two SitePal clip names from step 3, exactly.
- **`summary`** — one line, shown in the program guide.
- **`audienceLines`** — the zero-based lines played to the room rather than to
  the other character. Those lines turn no one's head, and the camera pulls
  back to the two-shot for them. Everything else is a direct address: the
  listener turns to the speaker automatically, because the record already says
  who is speaking.
- **`cues`** — the reaction beats, below.
- **`leadIn`** — seconds of dead air at the head of the uploaded tracks, before
  the first word. 2.5 to 3 is the usual range. Trim it by ear during step 6 with
  `window.__tsTiming.leadIn` and write the value you land on back here.

  Re-check it whenever you REPLACE a clip that is already on air, not just for
  a new episode. Most of what this number absorbs is how long SitePal takes to
  start a file, so a value tuned against the previous upload can be wrong for
  the new one even when the audio inside is identical. Roundtable 01 needed
  2.5 -> 3 after its GR80 track was re-rendered. The symptom is the picture
  drifting against the dialogue — the camera cutting to someone before they
  speak, or holding on them after they stop — which reads as the two
  characters talking over each other even though the tracks never overlap.
- **`note`** on a cue is a comment for the next person; nothing reads it.

Do not hand-edit `lineStarts`, `speakers` or `dialogueEnd` — they come from the
generation, and the listener turns, the camera shots and the guide's runtime
are all derived from them.

### Reaction cues

The available clips are registered in `CHARACTER_CLIPS` in `TalkShowScene.jsx`;
their full authored lengths are in `REACTION_DURATIONS`. The cue names are:

- Both: `headnod`, `headnodSubtle`, `headshakeDisappointment`, `lookAround`,
  `shrug`
- Monk only: `headshake`, `prayCrosschest`
- Connor only: `mockCrying`

Use `headnodSubtle` for ordinary agreement. Reserve `headnod` for an emphatic
beat.

- `line` — zero-based dialogue turn.
- `offset` — seconds after that turn begins.
- `actor` — `"Connor"` or `"Monk"`.
- `reaction` — one of the registered cue names.
- `duration` — how long to play before returning to the breathing idle.

`duration` is optional; omitting it uses the clip's full registered length.
A shorter value is often better for pose-2 clips whose expressive gesture
finishes before their trailing idle. Reaction clips hold their final pose until
the return crossfade finishes, preventing T-pose flashes.

Avoid overlapping two reactions on the same character unless the interruption
is intentional. Reactions on different characters may overlap.

## 5. Put it on the slate

1. Move the finished record to `src/content/lt-tv/episodes/<id>.json`. The
   filename must match its `id`.
2. Add it to `EPISODE_RECORDS` in `src/content/lt-tv/index.js` — one import
   line and one array entry. That is the only code a new episode touches.
3. Check it:

```bash
node scripts/lt-tv-check.mjs                # the whole slate
node scripts/lt-tv-check.mjs roundtable-02  # one episode, line by line
```

The checker reads every record, reports anything the set would choke on (a
cue pointing at a line that doesn't exist, a reaction the rig can't play, a
speaker list that doesn't match the line count, a record nobody imported), and
prints the performance the record resolves to: the camera shots, the listener
turns and which reaction lands on which line. It exits non-zero when something
is wrong, so it can gate a deploy.

A record with no `audio` is a slate entry: the guide lists it and labels it
*Not recorded yet* rather than playing another episode in its place. That is
how to announce next week's show before it exists.

## 6. Test the episode

1. Open `/trade` and enter **LT TV**.
2. Pick the episode in the program guide.
3. Wait for **Play episode** rather than **Preparing studio…**.
4. Play the entire episode once without stopping.
5. Check voice handoffs, final syllables, face sync, reaction timing, gaze,
   crossfades, and the final return to idle.
6. Test a second playback; stale actions should reset cleanly.
7. Switch to another episode and back. The set takes itself off air and swaps
   the loaded clips; it should not go back to **Preparing studio…**.

When `talk_show.glb` is re-exported, bump the query version in `MODEL_URL` so
the browser does not retain the previous animation library.

## Per-episode checklist

- [ ] Dialogue turns and voice IDs are correct.
- [ ] Emotion tags fit the character and are not overused.
- [ ] Master performance is approved.
- [ ] No blips or clipped syllables in either balanced WAV.
- [ ] Both balanced WAV files have equal duration.
- [ ] Clips named to the convention: `lttv_<show>_ep<NN>_<character>`.
- [ ] SitePal upload names exactly match the record's `audio`.
- [ ] `summary` reads well in the guide.
- [ ] `audienceLines` covers every line played to the room.
- [ ] Reaction cues use valid names and appropriate durations.
- [ ] The record is in `src/content/lt-tv/episodes/` and imported in `index.js`.
- [ ] `node scripts/lt-tv-check.mjs` passes.
- [ ] Full first and second playback pass cleanly.
- [ ] Switching episodes and back works without a reload.
