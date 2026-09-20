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
| Starts from | a week of market signal | one idea |
| Script from | `lt-news-brief.mjs` → `lt-news-script.mjs` | `lt-rt-script.mjs` |
| Topics from | the feeds, verified against real articles | the slate's own running order, or `--theme` |
| Segments | 7, built around three stories | 6, built around one argument |
| Chiron | yes | no |
| Clip prefix | `lttv_news_ep<NN>_` | `lttv_rt_ep<NN>_` |
| Length | 5–10 min | 4–9 min |

Everything after the script is the same for both: `lt-tv-edit.mjs` to revise,
`lt-tv-audio.mjs` to record, `lt-tv-check.mjs` to verify. One `assemble()`
builds both records, so a validation either show gains, both gain.

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

Now **read the `.txt` screenplay** before spending any audio money. Does each
story carry a real number? Does GR80 get a line worth hearing? Is
`rundown.stories[].gaps` empty — anything in it is unsourced. Spot-check the
numbers against `sources`.

The `.txt` is the thing you edit, not a printout of the record. Reword lines,
add them, delete them, change who a line is aimed at, then apply what you
wrote. No model call and no audio call, so revise here until it reads.

```bash
node scripts/lt-tv-edit.mjs news-2026-W38
```

The format explains itself at the top of the file; `docs/lt-weekly-news-workflow.md`
has the detail.

```bash
# 3. Confirm it landed on the slate cleanly (it will say "not recorded yet").
node scripts/lt-tv-check.mjs

# 4. Build the audio, then listen to the master end to end.
node scripts/lt-tv-audio.mjs content/lt-tv/episodes/news-2026-W38.json

# 5. Split the master into the two balanced tracks. Needs ffmpeg.
python3 elevenlabs-dialogue-test/process_dialogue.py \
    --master content/lt-tv/audio/news-01/master-dialogue.wav \
    --segments content/lt-tv/audio/news-01/voice-segments.json \
    content/lt-tv/audio/news-01

# 6. Refresh the slate record so the guide plays it rather than listing it.
node scripts/lt-tv-slate-record.mjs news-2026-W38
node scripts/lt-tv-check.mjs          # should now report a runtime
```

Step 6 is a join, not a rebuild, and that distinction is worth a sentence
because getting it wrong is expensive. **Never re-run the generator to refresh
a recorded episode.** `lt-news-script.mjs` and `lt-rt-script.mjs` write an
episode from scratch every time, so re-running one spends two model calls,
overwrites the screenplay you edited, and clears the timing you just paid to
record — leaving the guide saying *Not recorded yet* over perfectly good
audio.

Because a news episode is generated in blocks laid end to end, check **each
block join for a seam** and the **last block for drift** against the picture.
Drift looks exactly like a mistuned lead-in, so rule the audio out first.

Then upload and test — see the two sections below, which are the same for both
shows.

---

## Making a roundtable episode

Full detail: `docs/talk-show-production.md`.

The roundtable does not start from anything that happened. It is one argument
about one idea, so there is no brief step — the topics are the episodes already
named on the slate.

```bash
# 1. See what is waiting. Five episodes were titled long before there was any
#    way to write one; these are the queue.
node scripts/lt-rt-script.mjs --list

# 2. Write one. Two Claude calls: the argument, then the dialogue.
node scripts/lt-rt-script.mjs --topic roundtable-02
```

An episode already on the slate **keeps the title and summary it was given** —
the generator writes the argument, not the running order. Pass `--retitle` if
you want the model's title instead, or `--theme "..."` to write an episode that
is not on the slate yet.

Then read and revise exactly as you would a news episode:

```bash
node scripts/lt-tv-edit.mjs roundtable-02
```

What to look for is specific to this show: **both of them have to be right
about something.** Connor's case should be one a thoughtful person would make,
not greed wearing a hat, and the hard case should cost them both. If GR80 wins
every exchange you have a sermon, and the fix is in the script, not the audio.

```bash
# 3. Record it — the same audio build the news show uses.
node scripts/lt-tv-audio.mjs content/lt-tv/episodes/roundtable-02.json
```

From here it is the same tail as the news show — steps 5 and 6 above, then the
shared sections below:

```bash
# Split the master into the two balanced tracks. Needs ffmpeg.
python3 elevenlabs-dialogue-test/process_dialogue.py \
    --master content/lt-tv/audio/roundtable-02/master-dialogue.wav \
    --segments content/lt-tv/audio/roundtable-02/voice-segments.json \
    content/lt-tv/audio/roundtable-02

# Refresh the slate record.
node scripts/lt-tv-slate-record.mjs roundtable-02
node scripts/lt-tv-check.mjs roundtable-02
```

Then upload, tune the lead-in and test.

`content/lt-tv/samples/roundtable-02.draft.json` is a worked example, written by
hand to show the format and the two voices. **Its argument is invented** and it
is not a scheduled episode.

### The older hand-written path

`elevenlabs-dialogue-test/run_test.sh` still works and is how roundtable 01 was
made: write the turns into `dialogue.json` by hand, generate in one call, and
finish `output/episode-record.json` yourself. It is the right tool for a one-off
that does not belong on the slate. For an episode of the show, prefer the
generator — it numbers the lines, packs the blocks, validates the cues and puts
the record on the guide, all of which that path leaves to you.

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

## Fixing a line after it's recorded

Editing the screenplay of an episode that already has audio is refused — the
clips would still be saying the old words. To go ahead anyway:

```bash
node scripts/lt-tv-edit.mjs news-2026-W38 --rerecord
```

That clears the timing and returns the episode to *Not recorded yet* on the
guide until you build the audio again. So the rest of the sequence is: steps 4
to 6 of the news run above, then re-upload **under the same clip names** the
record already carries.

Then **re-tune the lead-in.** `--rerecord` keeps the old value, and a value
tuned against the previous upload is not reliable for the new one — see the
section above. This is the exact case that bit roundtable 01.

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
[ ] node scripts/lt-tv-slate-record.mjs <id> run after the audio build
[ ] node scripts/lt-tv-check.mjs passes, and reports a runtime
[ ] leadIn tuned by ear on /trade and written back into the record
[ ] First and second playback clean; episode switching clean
```
