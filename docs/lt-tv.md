# LT TV — start here

The one page to open when you are making an episode. It carries the commands in
order and the traps that cost a re-record. Everything it does not explain is in
one of the two deeper docs, linked at each step.

- **Weekly news show** — `docs/lt-weekly-news-workflow.md` (where topics come
  from, how the script is written and checked)
- **Roundtable / talk show** — `docs/talk-show-production.md` (the audio
  mechanics, the emotion tags, the reaction cues)

---

## The studio page

The one to open if you would rather not remember any of this. **Double-click
`LT TV Studio`** in the repo folder — no terminal, no typing. It starts the
site and opens the studio for you, and it prints the address it actually used,
which is not always port 3000. Close its window when you are done. From a
terminal, `npm run lt:studio` does the same thing.

`Open LT TV Studio.command` does the same job and is kept as a fallback. Prefer
the app: Finder decides what to do with a `.command` by file association, and
an editor that has claimed `.command` will open it for reading instead of
running it.

Every episode of both shows, what stage each one is at, and the next step as a
button — write it, record it, split the master into the two tracks, apply your
edits, rewrite a line you marked, check the slate. The screenplay is editable in the page, with a Save button and
a separate Apply, so a half-finished edit is never live.

It runs **on your machine only.** What this pipeline produces is source code:
an episode reaches /trade because its record is committed under
`src/content/lt-tv/episodes/` and imported by `index.js` at build time. A
server that wrote that file into its own container would change nothing, since
the container is rebuilt from git and the write goes with it — and half the
working files under `content/lt-tv/` are gitignored, so they only ever exist
where they were made.

A hosted studio is therefore not this one behind a password. It is a different
system, one that commits episodes back to GitHub or keeps them in Firestore
instead of on disk. The page and its routes 404 outside `npm run dev`, which
means the answer to "what if someone finds it" is that there is nothing there.

## The lineup page — the half that is on the live site

`/admin/lt-tv` on the deployed site, behind the admin password. It lists every
episode of every show and whether it is on air or planned, which is useful from
a phone. It is **read only**: it cannot write, run or spend anything, because
the slate is all that ships with a build.

Its password is checked **on the server** (`src/lib/ltTv/lineupAuth.mjs`) and
what the browser gets is a signed, expiring, httpOnly cookie. The repo's older
`/admin` page compares `NEXT_PUBLIC_ADMIN_PASSWORD` in the browser and trusts a
`localStorage` flag, which is not protection — do not copy it.

Two things it is careful about. A button that spends money says so and asks
first; the free ones do not ask, because a confirm on a free action teaches you
to click through confirms. And it prints each step's real output rather than a
tick — the scripts say useful things, and swallowing them would send you back
to a terminal to find out what happened.

Every button runs the same command you would have typed, so the page cannot
drift from the tools, and nothing you do in it is anything you could not have
done by hand.

---

## Where is everything, from a terminal

```bash
npm run lt                        # every episode, both shows
npm run lt -- roundtable-02       # one, in detail
npm run lt -- --html              # a page to keep open in a tab
```

Producing an episode leaves files in four directories, so this reads all of
them and tells you, per episode, what stage it is at, which files exist for it
and **the one command to run next**.

Every command on this page has an `npm run` form, and that is the one to use:
`npm run` starts in the repo root wherever you happen to be, so none of them
care which directory you are in. `node scripts/…` works too, but only from the
root — the path is relative to you, not to the repo.

| | |
|---|---|
| double-click `LT TV Studio` | the studio page — all of the below, as buttons |
| `npm run lt:studio` | the same, from a terminal |
| `npm run lt` | where every episode is |
| `npm run lt:check` | validate the slate |
| `npm run lt:brief` | pull the week (news) |
| `npm run lt:news` | write a news episode |
| `npm run lt:roundtable` | write a roundtable episode |
| `npm run lt:edit` | apply your edits to a screenplay |
| `npm run lt:rewrite` | rewrite the lines you marked with a `#` note |
| `npm run lt:audio` | record an episode |
| `npm run lt:split` | split the master into the two SitePal tracks |
| `npm run lt:test` | run every check |

Arguments go after `--`, as in `npm run lt:roundtable -- --topic roundtable-02`.

The four stages are `planned` (named on the slate, unwritten), `written` (has a
script), `recorded` (audio built) and `on air` (playable in the guide). Each one
is decided by a file being there or not, never by a note a previous run left
behind — so it stays right when you do a step by hand.

The one thing it cannot see is **SitePal**. The Audio Manager lives outside the
repo, so a clip name it shows means the record asks for that name, not that the
upload exists.

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
#    The studio's "Split it into the two tracks" button runs exactly this.
npm run lt:split -- news-2026-W38

# 6. Re-run the script step so the record picks up the real timing.
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json
node scripts/lt-tv-check.mjs          # should now report a runtime
```

Because a news episode is generated in blocks laid end to end, check **each
block join for a seam** and the **last block for drift** against the picture.
Drift looks exactly like a mistuned lead-in, so rule the audio out first.

**If ElevenLabs refuses the format** — `Output format 'pcm_44100' is only
available on the Pro tier` — that is the plan, not a fault. 44.1kHz PCM is the
only part of this that needs Pro. Every lower rate is allowed on every plan and
the pipeline works identically at one, because the joins are exact at any rate
and a block's length is still a byte count. Put this in `.env.local` and
restart:

```
LT_TV_PCM_RATE=24000
```

24kHz carries 12kHz of bandwidth, which is more than a speaking voice uses, and
SitePal re-encodes the upload anyway. Blocks already recorded at another rate
are re-recorded rather than reused, because reusing them would place every
later line wrong — so change the rate before starting an episode, not part way
through.

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

From here it is the shared path below: split, upload, tune the lead-in, check.

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

It asks for `mp3_44100_128`, which every plan allows, and `process_dialogue.py`
decodes it to WAV with ffmpeg. That is why it never hit the tier limit above.
It gets away with mp3 because it makes one call — with nothing to join, there
are no joins to be wrong.

---

## Uploading the clips (both shows)

Upload the two balanced WAVs to the SitePal Audio Manager and copy the names
into the record's `audio` block, exactly.

**You do not have to work the names out.** `npm run lt:split` writes each file
under the name it will have in SitePal, so the name to type is the filename
without `.wav`. It also prints the list, and the studio shows it under
**SitePal clip names** in the episode's panel.

**An episode over 90 seconds is several clips per character.** SitePal will not
play a clip longer than that — its own limit, on every plan — so the split step
cuts each track into sections of about 85 seconds and names them
`lttv_rt_ep02_connor`, `..._s2`, `..._s3`. Upload all of them. The set plays
each character's sections in order; a missing one stops the episode where it
should have carried on. The Halo Effect is 59 seconds and needed only one,
which is why this never came up until an episode ran to four minutes.

Cuts land in the pause between two lines, never inside one, and both characters
are cut at the same instants — so a join sounds like a beat someone took, and
the two tracks stay locked to each other. If a single line is ever longer than
the limit there is no pause to cut in, and the split step says so rather than
producing a clip that silently will not play.

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

## A line you don't like (both shows)

Three things you can do with a bad line, in rising order of effort.

**Rewrite it yourself.** Open the screenplay, change the words, then
**Apply my edits**. Nothing is spent and nothing else in the episode moves.

**Ask for a new one.** Put a note under the line saying what is wrong with it,
starting with `#`, then press **Rewrite the lines I marked** — or
`node scripts/lt-tv-rewrite.mjs roundtable-02`:

```
 41    SAINT GR80 A rising number does not make you wealthy. It makes you willing.
 # too on-the-nose, and he would never explain his own point twice
```

The whole episode is sent for context and only the marked lines come back
different, so the replacement picks up the line before it and sets up the line
after it. The note disappears with the edit. Mark several lines at once, or
put two notes under one line. Pressing it with nothing marked costs nothing
and says so.

A long line is often wrong in one sentence of several, so you can break it
where the trouble is and put the note there. The two halves are read as the
one line they were, both notes count, and the rewrite comes back as a single
line again:

```
  0    CONNOR     Welcome back to the Liminal Terminal, where the lights are holy.
 # that first bit makes no sense
Here is tonight, and it is a Tuesday problem.
 # and neither does this — no cheesy lines
```

**You do not have to press Save first.** A step that reads the screenplay
saves the box for you, so what runs is what you can see.

It writes the `.txt` only, so a rewrite you dislike is thrown away by not
applying it — and a line the model left alone stays marked, which is how you
see what it skipped.

**Stop getting that line.** Start the note `#!` instead of `#`:

```
 #! GR80 never explains his own point twice
```

That fixes this line *and* adds the note to `docs/lt-tv-style-notes.md`, which
is read into the writer's instructions at the top of every future episode of
both shows. One sentence, a rule rather than a complaint — "nobody says at the
end of the day", not "that ETF bit was flat". You can also just type rules into
that file; only the bullets under **Rules** are sent, so the rest of the page
explains itself without the explanation reaching the model.

A script run prints `House notes: 3 in force.` when it is using them.

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
[ ] Clips named lttv_<show>_ep<NN>_<character>, uploaded — every section
[ ] Record's `audio` matches the upload names exactly
[ ] summary reads well in the guide
[ ] audienceLines covers every line played to the room
[ ] Reaction cues use valid names and sensible durations
[ ] Record in src/content/lt-tv/episodes/ and imported in index.js
[ ] node scripts/lt-tv-check.mjs passes, and reports a runtime
[ ] Every section under 90s and starting where the last one ended (the check
    says so)
[ ] Each section join watched once — the picture should not jump at one
[ ] leadIn tuned by ear on /trade and written back into the record
[ ] First and second playback clean; episode switching clean
```
