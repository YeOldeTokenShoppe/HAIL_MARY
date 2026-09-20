# LT TV — start here

The one page to open when you are making an episode. It carries the commands in
order and the traps that cost a re-record. Everything it does not explain is in
one of the two deeper docs, linked at each step.

- **Weekly news show** — `docs/lt-weekly-news-workflow.md` (where topics come
  from, how the script is written and checked)
- **Roundtable / talk show** — `docs/talk-show-production.md` (the audio
  mechanics, the emotion tags, the reaction cues)

---

## What an episode is

One JSON file. Its title, its chiron copy, every spoken line and who speaks it,
the SitePal clip names, the timing, the camera and reaction cues — all of it
lives in that one record.

```
src/content/lt-tv/episodes/<id>.json   the episode, as the site reads it
src/content/lt-tv/index.js             the list; a record nobody imports never shows
```

`TalkShowScene.jsx` is the **set** — the rig, the clips, the camera. Producing
an episode never edits it. If you find yourself editing a component to release
an episode, something has gone wrong.

Two shows share the set and the pipeline. They differ only in where the script
comes from:

| | Weekly news | Roundtable |
|---|---|---|
| Script from | `scripts/lt-news-brief.mjs` → `lt-news-script.mjs` | you write `dialogue.json` by hand |
| Audio from | `scripts/lt-news-audio.mjs` (multi-block) | `elevenlabs-dialogue-test/run_test.sh` (single call) |
| Clip prefix | `lttv_news_ep<NN>_` | `lttv_rt_ep<NN>_` |
| Length | 5–10 min | under ~2,000 characters per generated section |

Both end the same way: two balanced WAVs uploaded to SitePal, a record on the
slate, and a lead-in tuned by ear.

---

## Making a news episode

Full detail: `docs/lt-weekly-news-workflow.md`.

```bash
# 1. Pull the week. Check `degraded` in the output is empty or harmless.
node scripts/lt-news-brief.mjs

# 2. Write the script. Two Claude calls; every number is computed locally.
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json
```

Now **read the `.txt` read-through** before spending any audio money. Does each
story carry a real number? Does GR80 get a line worth hearing? Is
`rundown.stories[].gaps` empty — anything in it is unsourced. Spot-check the
numbers against `sources`. Revise and re-run until it reads.

```bash
# 3. Confirm it landed on the slate cleanly (it will say "not recorded yet").
node scripts/lt-tv-check.mjs

# 4. Build the audio, then listen to the master end to end.
node scripts/lt-news-audio.mjs content/lt-tv/episodes/news-2026-W38.json

# 5. Split the master into the two balanced tracks. Needs ffmpeg.
python3 elevenlabs-dialogue-test/process_dialogue.py \
    --master content/lt-tv/audio/news-01/master-dialogue.wav \
    --segments content/lt-tv/audio/news-01/voice-segments.json \
    content/lt-tv/audio/news-01

# 6. Re-run the script step so the record picks up the real timing.
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json
node scripts/lt-tv-check.mjs          # should now report a runtime
```

Because a news episode is generated in blocks laid end to end, check **each
block join for a seam** and the **last block for drift** against the picture.
Drift looks exactly like a mistuned lead-in, so rule the audio out first.

Then upload and test — see the two sections below, which are the same for both
shows.

---

## Making a roundtable episode

Full detail: `docs/talk-show-production.md`.

```bash
# 1. Write the turns in elevenlabs-dialogue-test/dialogue.json.
#    Connor: IcFWazAaBzXNwLWpySgF   Saint GR80: fATgBRI8wg5KkDFg8vBd
#    Keep one request under ~2,000 characters; longer episodes generate as
#    contiguous sections, each its own production unit.

# 2. Generate and clean. Asks for the ElevenLabs key; never stores it.
cd elevenlabs-dialogue-test
./run_test.sh --episode-id roundtable-02 --title "The Wealth Effect"
```

Listen to all three output files before uploading: the master has the
performances you want, each balanced WAV has only its own character, no blips at
the handoffs, no clipped final syllables, both WAVs the same duration. A defect
present in `master-dialogue.mp3` cannot be fixed by the processor — regenerate.

```bash
# 3. Finish output/episode-record.json: summary, audio clip names,
#    audienceLines, cues, leadIn. Do NOT hand-edit lineStarts, speakers
#    or dialogueEnd — the set derives everything from them.

# 4. Move it to src/content/lt-tv/episodes/<id>.json, add the import and the
#    EPISODE_RECORDS entry in src/content/lt-tv/index.js, then:
node scripts/lt-tv-check.mjs roundtable-02
```

---

## Uploading the clips (both shows)

Upload the two balanced WAVs to the SitePal Audio Manager and copy the names
into the record's `audio` block, exactly.

**There is one Audio Manager for the whole account** (`9308752`), not one per
character. Every clip for every character and every show sits in the same list,
so the name has to carry its own namespace:

```
lttv_<show>_ep<NN>_<character>
```

`<show>` is `rt`, `news` or `mm`. `<NN>` is zero-padded. `<character>` is
`connor` or `gr80`. A split section appends `_s2`. Lowercase and underscores —
these get retyped by hand into JSON, and renaming later is manual Audio Manager
work.

Do not trim the leading silence or shift either file independently. The set
starts both full-length tracks together, and that shared timeline is what keeps
the voices and faces in sync.

---

## Tuning the lead-in (both shows) — the trap worth knowing

`leadIn` is the seconds of dead air at the head of the uploaded tracks. The
**whole visual timeline hangs off it** — camera cuts, head turns — and most of
what it absorbs is how long SitePal takes to start serving a file.

So: **re-check it whenever you replace a clip that is already on air**, not only
for a new episode. Roundtable 01 needed 2.5 → 3 after GR80's track was
re-rendered, with the audio inside unchanged. New episodes default to 2.5, which
is a placeholder to tune by ear, not a measured value.

Tune it live in the browser console on `/trade`, which reads it fresh every
frame, then write the value you land on into the record:

```js
window.__tsTiming.leadIn = 3
```

The symptom of a wrong lead-in is the picture drifting against the dialogue —
the camera cutting to someone before they speak, or holding after they stop. It
reads as the two characters talking over each other. **It is not an audio
fault.** Check this before you go back and re-render anything.

---

## Testing (both shows)

1. Open `/trade`, enter **LT TV**, pick the episode.
2. Wait for **Play episode** rather than **Preparing studio…**.
3. Play it all the way through once without stopping. Watch handoffs, final
   syllables, face sync, reaction timing, gaze, and the return to idle.
4. Play it a second time — stale state should reset cleanly.
5. Switch to another episode and back. It should not return to
   **Preparing studio…**.

When `talk_show.glb` is re-exported, bump the query version in `MODEL_URL` so
the browser does not keep the old animation library.

---

## Announcing an episode before it exists

A record with no `audio` block is a slate entry: the guide lists it and labels
it *Not recorded yet* rather than playing something else in its place. That is
how next week's show goes up early.

---

## The checklist

```
[ ] Script read through; every number spot-checked against its source
[ ] Master performance approved; no blips, no clipped syllables
[ ] Both balanced WAVs the same duration
[ ] Clips named lttv_<show>_ep<NN>_<character>, uploaded
[ ] Record's `audio` matches the upload names exactly
[ ] summary reads well in the guide
[ ] audienceLines covers every line played to the room
[ ] Reaction cues use valid names and sensible durations
[ ] Record in src/content/lt-tv/episodes/ and imported in index.js
[ ] node scripts/lt-tv-check.mjs passes, and reports a runtime
[ ] leadIn tuned by ear on /trade and written back into the record
[ ] First and second playback clean; episode switching clean
```
