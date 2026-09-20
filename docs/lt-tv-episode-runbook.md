# LT TV episode runbook

Producing an LT TV episode today means replacing the one on air: its SitePal clip
names, line timing and animation cues are module constants in
`src/components/trade/TalkShowScene.jsx`, so each new episode overwrites the last.
What follows is one pass from topic to playing on `/trade`, written against `main`
at commit `9da9a8d`.

For the deep ElevenLabs reference — the full per-character emotion tag list, the
reasoning behind the cleanup guards — see `docs/talk-show-production.md`. This
document is the end-to-end sequence; that one is the audio chapter in detail.

---

## What you are producing today

LT TV is a mode on `/trade`, not a route of its own. The **LT TV** tab on the
right-edge rail turns it on (`src/app/trade/page.js:4568`) and it opens on the
lineup, with the set off air, rather than on a show (`ltTvView`, `page.js:1352`).

The program guide advertises six episodes across three shows, but those entries
are metadata and nothing more. `EPISODES` and `SHOWS` in
`src/components/trade/LTTvBroadcastPanel.jsx:7` carry a number, title, runtime and
summary. Playback ignores all of it: the Start button calls
`window.__talkShowPlay()` with no arguments, and the scene loads one hardcoded pair
of SitePal clip names from `TALK_SHOW_AUDIO` (`src/components/trade/TalkShowScene.jsx:53`).
Choosing episode 04 plays whatever those two names point at.

So the honest name for this process is replacing the episode rather than adding
one. The two other shows, LT Weekly News Recap and Markets & Morality, have empty
episode lists and read as "Episodes coming soon" until something is wired for them.

The set seats exactly two. `CHARACTER_CLIPS` (`TalkShowScene.jsx:68`) registers
`Demon_Empty` and `Monk_Empty` and nothing else, so a third voice has nowhere to sit.

One character goes by a different name in almost every file you will touch, which
is the easiest way to paste a value into the wrong place:

| Character | Voice ID in `dialogue.json` | Key in `process_dialogue.py` | Actor in `TalkShowScene.jsx` | Node in the GLB |
| --- | --- | --- | --- | --- |
| Barron | `IcFWazAaBzXNwLWpySgF` | `john` | `Barron` | `Demon_Empty` |
| Saint GR80 | `fATgBRI8wg5KkDFg8vBd` | `gr80` | `Monk` | `Monk_Empty` |

The mapping between the first three columns lives at
`elevenlabs-dialogue-test/process_dialogue.py:11`. The older production doc,
`docs/talk-show-production.md`, calls Barron "Connor" throughout.

---

## Before you start

- `ffmpeg` and `ffprobe` on your PATH, plus Python 3. `process_dialogue.py` shells
  out to both.
- An ElevenLabs API key. `run_test.sh` asks for it at the start of every run and
  neither displays nor saves it, so there is nothing to put in a `.env`.
- Access to SitePal account `9308752` (`TalkShowScene.jsx:36`) and its Audio
  Manager. The upload is a browser step; nothing in this repo can do it for you.
- A local checkout and the dev server running, so you can watch the episode back on
  `/trade` before it goes anywhere.

An episode touches two places: `elevenlabs-dialogue-test/` (script in, audio out)
and `src/components/trade/TalkShowScene.jsx` (everything the set does with that
audio). A finished episode is a commit to both.

---

## Step 1 — Write the episode

Picking the topic is entirely human today. Nothing in the repo chooses one or
drafts a script. The comment at `TalkShowScene.jsx:123` was written in anticipation
of one — "Cues stay attached to line numbers so a future script generator can
replace this array" — but no generator exists, and the pieces that could feed one
(`src/app/api/ai/trending/route.js`, `src/lib/marketAtmosphere.js`,
`src/app/api/trade/director/route.js`) are not wired to LT TV.

The script itself is `elevenlabs-dialogue-test/dialogue.json`, which is literally
the ElevenLabs request body: an `inputs` array of `{ text, voice_id }` turns in
order, plus `model_id`, `language_code` and `seed`.

```json
{
  "text": "[dryly] That depends. Are you saving humanity, or opening a position against it?",
  "voice_id": "fATgBRI8wg5KkDFg8vBd"
}
```

Five things decide whether the recording comes back usable:

1. Keep the whole request under roughly 2,000 characters. A longer episode is split
   into contiguous sections, each produced as its own unit. The episode on air now
   is 12 turns over 58 seconds, which is a useful sense of scale.
2. Put a delivery tag in square brackets at the front of the turn it controls:
   `[confidently]`, `[dryly]`, `[suspiciously]`, `[patiently]`. These usually shape
   the reading rather than adding a sound.
3. Event tags — `[sighs]`, `[chuckles]`, `[clears throat]` — do make a sound, so
   never put one at the very first instant of a new speaker's turn. The cleanup
   trims the first 120 ms after each handoff and will eat it. Place it a few words in.
4. A written reaction (`Heh.`) is more repeatable than `[chuckles]` when you want
   exact syllables.
5. Keep a `seed` that worked. It improves repeatability across revisions, though
   ElevenLabs does not promise identical output.

---

## Step 2 — Generate and clean the audio

```bash
cd elevenlabs-dialogue-test
./run_test.sh
```

One request generates the whole conversation in context. Never generate lines
separately: the conversational timing is exactly what you lose.
`process_dialogue.py` then reads the `voice_segments` ElevenLabs returned and
writes five files into `output/`.

| File | What it is |
| --- | --- |
| `master-dialogue.mp3` | The unedited conversation, for review |
| `john-sitepal-balanced.wav` | Barron, with digital silence under every GR80 line |
| `gr80-sitepal-balanced.wav` | GR80, with digital silence under every Barron line |
| `voice-segments.json` | ElevenLabs' full turn-timing response |
| `talk-show-timing.json` | `line_starts`, `line_ends`, `speakers` and total duration |

The two balanced WAVs are the same length and both start at zero, at 44.1 kHz
16-bit mono. Playing them together reconstructs the conversation while each avatar
lip-syncs only its own lines. That shared timeline is the whole sync mechanism, so
never trim or shift one of them on its own.

One trap in the checked-in `output/` folder: it holds `john-sitepal.wav`,
`gr80-sitepal.wav` and `gr80-sitepal-clean.wav` from an older run, and no
`talk-show-timing.json` at all. The script is current; those committed files are
not. Trust what your run writes, not what was already sitting there.

### Listen before anything leaves your machine

Play all three audio files end to end and confirm:

1. The master has the performances you want, with complete words.
2. Each balanced WAV contains only its own character.
3. No blip at any speaker handoff.
4. No truncated last syllable.
5. Both balanced WAVs report the same duration.

Three constants at `process_dialogue.py:21` are the only knobs, and they move
0.01 s at a time:

- `START_GUARD_SECONDS` (0.12) — raise it if a handoff still clicks, lower it if a
  first consonant is clipped.
- `END_GUARD_SECONDS` (0.01) — lower it if a final syllable is cut. Never raise it.
- `BOUNDARY_FADE_SECONDS` (0.02) — normally leave it alone.

If the defect is audible in `master-dialogue.mp3`, regenerate instead. The cleanup
cannot repair a word ElevenLabs itself cut short.

---

## Step 3 — Get the audio into SitePal

This is the step that cannot be automated away, and it helps to know why before
resenting it. SitePal's `sayAudio` resolves a clip *name* inside the account and
never accepts a URL. That was tested directly here: the spike page is
`src/app/trade/spike-sayaudio/page.js` and the finding is written down at
`src/app/api/trade/director/route.js:7`. So an episode's audio has to be sitting in
the account's Audio Manager before the site can play a second of it.

The Audio Manager is that account's shared clip library: the list of uploaded audio
files `sayAudio` looks names up in. There is one for account `9308752`, not one per
character, so every clip for every character and every show sits in the same list.
It has nothing to do with the ElevenLabs voice each SitePal character is configured
with — the talk show never uses SitePal's own text-to-speech, only these
pre-rendered uploads.

### Naming clips

One shared list means the name has to carry its own namespace. The Terminal Traders
clips already in there look like `case001_monk_q5`, so LT TV follows the same shape:

```
lttv_<show>_ep<NN>_<character>
```

- `<show>` is `rt` (The Liminal Terminal), `news` (LT Weekly News Recap) or `mm`
  (Markets & Morality)
- `<NN>` is the episode number, zero-padded: `02`, never `2`
- `<character>` is `barron` or `gr80`

Episode 02 of the roundtable uploads as `lttv_rt_ep02_barron` and
`lttv_rt_ep02_gr80`. An episode split into sections because it ran past the
2,000-character limit appends the section number: `lttv_rt_ep07_barron_s2`.

Lowercase and underscores throughout. SitePal accepts spaces — the two clips on air
are `talk show test for jb` and `talk show test GR80` — but these names get retyped
by hand into a JavaScript object, and a space is a typo waiting to happen.

### Uploading

1. Upload `output/john-sitepal-balanced.wav` under the Barron name.
2. Upload `output/gr80-sitepal-balanced.wav` under the GR80 name.
3. Wait for SitePal to finish processing both.
4. Copy those two names, character for character, into `TALK_SHOW_AUDIO` at
   `TalkShowScene.jsx:53`.

```js
const TALK_SHOW_AUDIO = {
  Barron: "lttv_rt_ep02_barron",
  Monk: "lttv_rt_ep02_gr80",
};
```

A name that does not match is a silent avatar, not an error: `sayAudio` has no
text-to-speech fallback, so a typo simply plays nothing. `scripts/wire-audio.mjs`
carries the same warning for the Terminal Traders clips, which use this mechanism too.

---

## Step 4 — Direct the performance

Four more constants, all in the first 200 lines of `TalkShowScene.jsx`. Two you
copy, two you author.

**Copy the timing** out of `output/talk-show-timing.json`:

- `line_starts` goes into `TEST_LINE_STARTS` (`:126`). Zero-based, in the same order
  as `inputs` in `dialogue.json`.
- The total duration goes into `TEST_DIALOGUE_END` (`:146`).
- `speakers` is not copied anywhere. Read it as a check that every voice ID mapped
  to the character you meant.

**Set the lead-in.** `TALK_SHOW_TIMING.leadIn` (`:137`, currently `2.5`) declares
the dead air at the head of the uploaded tracks. The performance clock starts when
`sayAudio()` is called and SitePal reports the track as started within about
150 ms, so the gap before the first word is real and nothing else on the timeline
is right until it is declared. Camera shots, reaction cues and gaze all read
through it. Tune it by ear in the browser console through `window.__tsTiming.leadIn`
while the show plays, then write the value that worked back into the file.

**Author the gaze.** `DIRECT_ADDRESS_GAZES` (`:151`) is a list of
`{ line, listener }`. Add a line only when the speaker is addressing the other
character; omit the ones delivered to the audience. This array does double duty —
the camera direction is derived from it (`TALK_SHOW_SHOTS`, `:250`) — so omitting a
line changes the shot as well as the head turn.

**Author the reactions.** `TALK_SHOW_CUE_DEFS` (`:170`) takes one entry per gesture:

```js
{ line: 4, offset: 0.3, actor: "Barron", reaction: "shrug", duration: 3.3 }
```

`line` is the zero-based turn, `offset` is seconds after that turn begins, and
`actor` is `"Barron"` or `"Monk"`. `duration` is optional: leaving it out plays the
clip's full authored length from `REACTION_DURATIONS` (`:103`), and a shorter value
is usually better, because the pose-2 clips finish their expressive gesture well
before their trailing idle.

The reaction names registered in `CHARACTER_CLIPS` (`:68`) are the only valid ones:

- Both: `headnod`, `headnodSubtle`, `headshakeDisappointment`, `lookAround`, `shrug`
- GR80 only: `headshake`, `prayCrosschest`
- Barron only: `mockCrying`

Use `headnodSubtle` for ordinary agreement and save `headnod` for an emphatic beat.
Do not overlap two reactions on the same character unless the interruption is the
point; reactions on different characters may overlap freely.

---

## Step 5 — Put it on air and watch it back

1. Start the dev server and open `/trade`.
2. Click the **LT TV** tab on the right-edge rail. You land on the lineup, set off
   air, channel cards cycling on the frame screen.
3. Press **Enter studio**.
4. Wait for the button to stop reading **Preparing studio…**. Once both SitePal
   portals report ready it becomes **Play replay**.
5. Play the whole episode once without stopping. Watch the handoffs, the final
   syllables, face sync, reaction timing, gaze, the crossfades back, and the return
   to idle at the end.
6. Play it a second time. Stale actions should reset cleanly, and this is where a
   bad `duration` or an overlapping cue shows itself.
7. Check the phone layout as well. `MobileTalkShow.jsx` shares the same
   `TalkShowScene` and the same `SHOWS` list but has its own controls, labelled
   **Play replay** and **Stop replay**.

If the button reads **Retry signal**, a SitePal portal came up without building its
player. The scene reloads a stuck iframe by itself — 18 s to the first timeout, two
attempts (`PORTAL_READY_TIMEOUT_MS` and `PORTAL_MAX_ATTEMPTS`,
`TalkShowScene.jsx:48`) — so the button appears after roughly 45 s. Pressing it
retries; a page reload is not needed.

If you re-exported the GLB, bump the query string in `MODEL_URL`
(`TalkShowScene.jsx:33`, currently `/models/talk_show3-textures.glb?v=news-desk-hierarchy-1`).
Otherwise the browser keeps the old animation library and cue names quietly stop
matching.

### Then update the guide

Add or edit the entry in `EPISODES` (`LTTvBroadcastPanel.jsx:7`) with its `number`,
`title`, `runtime` and `summary`. It has no effect on playback, but it is what the
console, the program guide and the mobile episode rack all display, and
`MobileTalkShow.jsx` imports the same array so desktop and phone stay in step. A
new show added to `SHOWS` needs nothing else to appear on the set's channel screen:
`ltTvChannelScreen.js` paints those cards straight from the array, with no artwork
to make.

---

## Per-episode checklist

- [ ] Dialogue turns and voice IDs are right, and the whole request is under about 2,000 characters
- [ ] Emotion tags suit the character, and no event tag sits at the first instant of a turn
- [ ] Master performance approved, with complete words
- [ ] No blips at handoffs and no clipped final syllables in either balanced WAV
- [ ] Both balanced WAVs report the same duration
- [ ] Both WAVs uploaded and finished processing in SitePal
- [ ] Clips named to the convention: `lttv_<show>_ep<NN>_<character>`
- [ ] `TALK_SHOW_AUDIO` matches the SitePal names character for character
- [ ] `TEST_LINE_STARTS` and `TEST_DIALOGUE_END` copied from `talk-show-timing.json`
- [ ] The `speakers` array in that file matches the characters you intended
- [ ] `TALK_SHOW_TIMING.leadIn` checked by ear against the new tracks
- [ ] `DIRECT_ADDRESS_GAZES` is deliberate, with audience lines left out
- [ ] Reaction cues use names valid for that actor, with durations that end before the trailing idle
- [ ] First and second playback both clean on desktop
- [ ] Phone layout checked
- [ ] `EPISODES` entry added or updated
- [ ] Both changed files committed: `elevenlabs-dialogue-test/dialogue.json` and `src/components/trade/TalkShowScene.jsx`

---

## What is still done by hand

One of the six passes is a script. The rest are you.

| Pass | How it runs today | What would change it |
| --- | --- | --- |
| Pick the topic | By hand, no tooling at all | A sourcing step; `src/app/api/ai/trending/route.js` and `src/lib/marketAtmosphere.js` already gather the material |
| Write the dialogue | By hand in `dialogue.json` | A script generator; the character voices already exist in `src/app/api/trade/director/route.js` and `src/app/api/council-chat/route.js` |
| Generate and clean | `./run_test.sh` | Already automated |
| Listen and approve | By ear | Nothing, and it should stay that way |
| Upload to SitePal | Browser, by hand | Only a SitePal upload API, if the account has one |
| Copy names and timing into the component | Copy-paste | A script in the shape of `scripts/wire-audio.mjs`, which already does this for the Terminal Traders clips |
| Author cues and gaze | By hand | Partly: `voice-segments.json` already records who holds each line, so the gaze array is re-stating data the pipeline has |

## Open questions

These are the places where this document records what the code implies rather than
what actually happens at the desk.

- [ ] **Anything between generating and uploading?** Trimming in a DAW, normalising,
      format conversion — anything done to the WAVs that is not in `process_dialogue.py`.
- [ ] **The lead-in.** Is `TALK_SHOW_TIMING.leadIn` re-checked per episode, or was
      `2.5` set once and left alone?
- [ ] **Anything missing.** Thumbnails, episode copy written elsewhere, a place
      topic ideas are kept, a step done out of habit that is not written down here.
