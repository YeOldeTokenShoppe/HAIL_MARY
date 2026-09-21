# LT Weekly News Recap — the production workflow

How one episode of the weekly news show gets made, from "it is Friday" to
"it is on the site."

This document covers the **news** show in depth. If you just want the commands
in order, start at `docs/lt-tv.md` and come back here for the why.
`docs/talk-show-production.md` remains the reference for the audio mechanics
(ElevenLabs tags, the balanced-WAV cleanup, SitePal uploads); this one is the
layer above it — what the show is, where its topics come from, and what file
holds an episode.

> **Status.** All four steps are written: a week of signal becomes a script,
> the script becomes audio, and the episode lands on the LT TV guide. Step 3
> has never been run against a real ElevenLabs render — it was written without
> a key and without ffmpeg — so treat the first recording as its test. Until an
> episode is recorded it appears on the guide as "Not recorded yet". No
> existing route has been modified; the only component-adjacent file this
> touches is `src/content/lt-tv/index.js`, whose episode list it appends to.

---

## The idea in one paragraph

An episode is **one JSON file**. Everything about it — its title, its chiron
copy, every spoken line with its voice, its recording blocks, its animation
cues, the SitePal clip names, the sources it is built on — lives in that one
record. The site now agrees: `src/content/lt-tv/episodes/` holds one record per
episode, and the guide, the mobile screen and the set all read it. What this
pipeline adds is the front half — turning a week of market signal into that
record's contents rather than typing them.

```
  a week of market signal
           │
           │  scripts/lt-news-brief.mjs          ← step 1, runs anywhere
           ▼
  content/lt-tv/briefs/news-2026-W38.json
           │                       ↖ content/lt-tv/rl80-spots.md (you edit this)
           │  scripts/lt-news-script.mjs         ← step 2, two Claude calls
           ▼
  content/lt-tv/episodes/news-01.json     ← THE EPISODE RECORD (staging)
           ▲           └── .txt  ← you read and edit this
           └───────────────┘  scripts/lt-tv-edit.mjs, no API calls
  content/lt-tv/episodes/news-01.txt      ← the read-through, for review
           │
           │  scripts/lt-tv-slate-record.mjs    ← step 4, the join
           ▼
  src/content/lt-tv/episodes/news-01.json       ← on the LT TV guide
           │
           │  scripts/lt-tv-audio.mjs         ← step 3, the audio
           ▼
  one pair of balanced WAVs  →  SitePal Audio Manager
  timing + cues              →  back into the record
           │
           │  step 4 — the site reads the record
           ▼
  LT TV plays the episode
```

---

## The show

**It is not a crypto show.** It is a general investing and economics show that
happens to live on a crypto site. A typical week is the Fed and interest rates,
the ten-year Treasury, the price of oil, a bill moving through Congress, what
the indices did — and then crypto, and then whatever people have newly decided
is an asset. Crypto is one beat among several. Three crypto stories in one
episode means the rundown picked wrong.

Seven segments, in this order. The skeleton is the point: a fixed shape is what
turns "design an episode" into "fill an episode." Defined in
`scripts/lt-tv-format.mjs`.

| Segment | Target | What it is |
|---|---|---|
| Cold open | 95 words | Connor previews the three stories; GR80 undercuts the preview. |
| Lead story | 210 words | The week's biggest, from any beat. |
| Second story | 200 words | A different corner of the market from the lead. |
| The spot | 55 words | The RL80 ad break. Skipped when there is no copy. |
| Third story | 185 words | The absurd one — usually collectibles or a mania. |
| The board | 135 words | The numbers that moved, plus one prediction-market line. |
| Sign-off | 70 words | Recap, and "none of it was a recommendation." |

About 950 words, roughly **6:33** at the estimated speaking rate — the middle of
the 5–10 minute target, so one long segment does not push the episode out of
the window.

**The beat pattern inside a story** — Connor states the fact with its number,
GR80 reframes what the number is actually counting, Connor pushes back (usually
by defending his own profession), GR80 lands the button. Six to ten lines. GR80
does not get the last word in all three stories.

**The story slots are not assigned to beats.** The week decides which is the
lead. What the rundown is told is to *spread* them: if the lead is macro, the
second story should not be.

### The spot

The one hand-fed input in the whole pipeline. `content/lt-tv/rl80-spots.md` is
a plain markdown file of `-` bullets — one line per thing the show can plug.
The writer picks one and builds an ad read around it: Connor does the sponsor
voice, grand and overclaimed; GR80 reads the disclaimer as though it were
scripture, or refuses to.

RL80 is not newsworthy, so it never gets a news slot. It gets an ad break,
which is funnier and honest. The rules forbid the segment from becoming an
actual recommendation — no price, no yield, no return figure, and "not a
recommendation" is the punchline rather than a caption.

**An empty file means no ad break that week**, and the segment is dropped
without a warning. Bullets under `## Retired` are kept for reuse and stay out
of rotation.

### The cast, and the naming trap

The set has **exactly two seats**. `CHARACTER_CLIPS` in `TalkShowScene.jsx`
registers `Demon_Empty` and `Monk_Empty` and nothing else, so a third host is
not producible on this set without new rig work.

One character answers to a different string in almost every file:

| `actor` | Display | ElevenLabs voice | Python key | GLB node | Animation clips |
|---|---|---|---|---|---|
| `Connor` | Connor | `IcFWazAaBzXNwLWpySgF` | `john` | `Demon_Empty` | `barron_*` |
| `Monk` | Saint GR80 | `Re5c3vCmpnygdZuSX2Wc` | `gr80` | `Monk_Empty` | `monk_*` |

**The character is Connor**, and the runtime says so too: `CHARACTER_CLIPS` in
`TalkShowScene.jsx` and `ACTOR_NAMES` in `process_dialogue.py` both resolve him
to `"Connor"`. The other strings in that row are not old names — they are
plumbing. `Demon_Empty` and the `barron_*` clips are baked into
`talk_show3-textures.glb` and only change when the model is re-exported;
`john` is the processor's speaker key, which names the WAV it writes
(`john-sitepal-balanced.wav`). Leave all three alone.

`scripts/lt-tv-format.mjs` is the one place this mapping is written down, and
the pipeline uses `actor` and nothing else.

> Note: GR80 has had three voices. `JBFqnCBsd6RMkjVDRZzb` recorded the July
> 2026 test episode, `fATgBRI8wg5KkDFg8vBd` followed it, and the cast moved to
> `Re5c3vCmpnygdZuSX2Wc` on 2026-09-21. None of them is wrong; each is what some
> recording was made with. `process_dialogue.py`,
> `elevenlabs-dialogue-test/README.md` and `docs/talk-show-production.md` all
> agree.

---

## Step 1 — Pull the week

```bash
node scripts/lt-news-brief.mjs
# → content/lt-tv/briefs/news-2026-W38.json
```

Five families of source. Eleven of the thirteen are free and keyless; two are
switched off until someone sets a key.

**Macro**
- **Federal Reserve** press releases (`press_monetary.xml`) — the authoritative
  source for an FOMC decision, ahead of anybody's coverage of it.
- **The yield curve** — the three-month, two-year, ten-year and thirty-year, a
  week of them, with the ten-year's move and the 2s10s spread computed. Read
  from **FRED** (`DGS3MO`, `DGS2`, `DGS10`, `DGS30`), with Treasury's own
  monthly XML as the fallback.
- **Economy and markets headlines** — CNBC economy, CNBC markets, Yahoo Finance.

**Markets**
- **Index levels** — S&P 500, Nasdaq Composite, Dow, week over week, from FRED.
- **Commodities** — WTI crude from FRED; gold, best-effort, from Stooq. A week
  with no gold print is a missing line on the board, not a failed source.

**Crypto** — CoinDesk, Decrypt, Cointelegraph and The Block RSS; CoinGecko
trending; Fear & Greed across eight days so the show can read the *arc* rather
than today's number; Reddit's weekly top from r/bitcoin, r/ethereum and
r/cryptocurrency if Reddit credentials are set; and CoinMarketCap if
`COINMARKETCAP_API_KEY` is set (the same key the site's price routes use).

**Collectibles** — Google News queries for the card and collectibles beats,
plus the collector subreddits when Reddit is switched on. There is no free
price API for trading cards worth wiring, so the beat is sourced the way a
human notices it — a set launch or a frenzy makes the news — and the editorial
pass confirms any actual number from a real article.

**Predictions** — Polymarket and Kalshi, filtered to the show's beats (rates,
inflation, recession, the indices, oil, crypto, legislation) and normalised so
both quote a probability.

A source that fails lands in the brief's `degraded` array and the brief is
still written. A news show that cannot run because one upstream rate-limited is
not a sustainable news show.

### Reddit needs credentials

Reddit returns 403 to unauthenticated API calls now. It is not broken and it is
not worth spoofing a browser over: create a **script** app at
<https://www.reddit.com/prefs/apps> and set

```
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT="node:lt-tv-newsroom:1.0 (by /u/yourname)"
```

Without them the two Reddit-backed sources report `skipped`, not `failed`, and
everything else runs. Collectibles no longer depends on Reddit at all.

### Checking the sources

Silent degradation is right on a Friday and wrong on the first run on a new
machine. To tell them apart:

```bash
node scripts/lt-news-brief.mjs --check-sources
```

It pings every upstream, writes nothing, and marks each one three ways: `✓`
answered, `–` switched off for want of a key, `✗` failed with the reason. Only
a `✗` is a problem.

**Why not just call `/api/ai/trending`?** That route hits three of the same
crypto upstreams, but it is tuned for the live `/trade` page: a six-hour cache,
Reddit's *hot* listing, titles truncated to 40 characters, and only the top
three topics kept. A weekly show needs the opposite of all four — and it needs
four families of source that route has never had. So this reads its own
upstreams and leaves the route untouched.

## Step 2 — Pitch the week, then write it

```bash
export ANTHROPIC_API_KEY=...

# 2a. The pitch: the editorial pass on its own. It stops here.
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json --rundown-only

# 2b. Read content/lt-tv/plans/news-2026-W38.txt, argue with it in the
#     writers' room at /lt-tv, then write the dialogue from it.
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json \
                               --rundown content/lt-tv/plans/news-2026-W38.json
```

Splitting it this way is the point: pass 1 is the editorial judgment and pass 2
is six minutes of dialogue built on top of it, so a disagreement about which
three stories the show covers is far cheaper before the second one runs.
`--rundown <file>` uses the pitch exactly as it stands — the editorial pass does
NOT run again, so what you approved is what gets written. Without either flag
both passes run back to back, which is the old behaviour and still right for a
week you do not want to think about:

```bash
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json
```

Two Claude calls (`claude-opus-5` by default; override with `LT_NEWS_MODEL`),
raw `fetch` against the Messages API — the same convention as every other Claude
call in this repo, so no SDK dependency is added.

1. **The rundown** — the editorial pass. Picks three stories in running order,
   the gauge beat, the chiron headline, the ticker items and the **sidebar**.
   It is told to reject price predictions, single-source social posts, and two
   stories that are the same story wearing different hats.

   The sidebar is the near-misses: four to six headlines from the brief that
   made the week but did not make a three-story show. They crawl along the
   ticker under the episode, which is what makes a ticker read like a real
   newscast instead of a repeat of the segment you are watching. It is the
   only copy on screen that no segment reads aloud and no verification pass
   confirmed, so `assemble()` holds it to the brief and warns about any item
   it cannot trace back to something the brief nominated — confirm those or
   cut them before recording.

   Crucially, it then **verifies**. The brief is headlines; a headline is
   enough to nominate a story and nowhere near enough to read a number out
   loud on air. So the pass has web search over a short allowlist of reputable
   outlets (`NEWS_SOURCE_DOMAINS`) and must confirm each story — the number,
   the date, a real article — before writing it, citing what it actually read.
   A story it cannot confirm is replaced, stripped of its number, or dropped;
   it is never kept with the number intact. Each story carries a `verified`
   flag, and an unverified one becomes a warning on the record.

   Run with `--no-search` to skip verification — cheaper, faster and only
   appropriate when you are going to check the facts yourself.

   The web-search tool needs Opus 4.6+ or Sonnet 4.6+; a cheaper model set via
   `LT_NEWS_MODEL` may reject it, in which case use `--no-search`.
2. **The script** — writes all six segments as dialogue, with delivery tags,
   direct-address flags and animation cues.

`--rundown-only` writes both `content/lt-tv/plans/news-<week>.json` and an
outline beside it as `.txt`, which is what the studio page shows and what the
writers' room reads. `--out <path>` writes the bare JSON somewhere else
instead, for a one-off. What the room may and may not change about a pitch —
angles yes, facts and sources never — is in `docs/lt-tv.md` under **The
pitch**.

### Everything numeric is computed locally

The model writes words. `assemble()` owns every number: global line numbering,
word counts, runtime estimate, recording blocks, and cue durations looked up
from the clip table. It also **validates**, and the warnings are the review
checklist:

- a cue naming a reaction its actor does not have (`prayCrosschest` is GR80's
  only — Connor would T-pose) — dropped, with the valid list printed
- a cue naming an actor who is not on this set — dropped
- a line opening with an event tag like `[sighs]`, which the 120 ms handoff trim
  in `process_dialogue.py` would eat — flagged, not dropped
- a story the editorial pass could not confirm from a real source
- a ticker sidebar item that traces to nothing in the brief, or that restates a
  story the episode is covering (that one is dropped, not just flagged)
- a host given two turns in a row (the camera cuts on who speaks)
- a segment more than 25% off its word target
- an episode estimated outside 5–10 minutes
- a recording block over the character budget

### Reviewing and revising

Step 2 writes two files side by side: the record, which is JSON and which
everything downstream reads, and `news-01.txt`, the screenplay. **Read
and edit the screenplay.** It is the source, not a printout — change the words
in it and apply them back with:

```bash
node scripts/lt-tv-edit.mjs news-01
```

Reword lines, add them, delete them, reorder them. They renumber themselves and
every derived number is recomputed. This costs nothing: no model call, no
ElevenLabs call. Review happens two steps before anything is spent, so a script
should be read and fixed here rather than after it is recorded.

Three things in the file are more than decoration:

- **The `>` before a speaker** means the line is aimed at the other host, who
  turns to face them. Without it the line plays to the room and the camera pulls
  back to the two-shot. It is on the page because it cannot be recovered from
  anything else, and because who a line is aimed at is a real editorial choice.
- **Bracketed words like `[dryly]`** are delivery directions ElevenLabs performs.
  They are part of the line and count toward the block budget.
- **An indented `(Monk headshake @ +0.4s)`** is an animation beat on the line
  above it. A reaction a character does not have is refused by name, with the
  valid list printed.

Anything the parser cannot read is an **error naming the line in the file**,
never a line quietly dropped — a missing line still builds, still records, and
is noticed only on air. Lines starting with `#` are ignored, so a note to
yourself is safe to leave in.

Editing an episode that has **already been recorded** is refused, because the
audio would still be saying the old words. `--rerecord` overrides it, clears the
timing and returns the episode to "Not recorded yet" until step 3 runs again.
An episode already on the slate has its slate record refreshed in the same run.

The older path still works and is what `--draft` is for: the same
`{ rundown, segments }` shape the model returns, re-assembled without a model
call.

```bash
node scripts/lt-news-script.mjs --draft content/lt-tv/samples/news-2026-W38.draft.json
```

A hand-edit, an edited screenplay and a generated script all go through the
identical `assemble()` and the identical validation.

`content/lt-tv/samples/` holds a worked example — the draft, the assembled
record and its read-through (`news-2026-W38.sample.txt`). **Its facts are
invented.** It exists to show the record format and the two voices, and it must
not be recorded or quoted.

---

## Step 3 — Build the audio *(built; unproven against a real render)*

> **Changed on 2026-09-21.** The audio step now renders **every line on its
> own, in its own voice**, and lays both character tracks out by bytes; the
> block-based text-to-dialogue design described below is the older path and
> is kept for reprocessing archived recordings only. What survives from it:
> raw PCM, byte-exact placement, one upload pair per episode, and the block
> packing in the record (which now only groups lines). The reasons and the
> trade are in *How the audio is made* in `docs/lt-tv.md`.

This is the part that makes a 5–10 minute episode possible at all, and it is
worth stating plainly because it is not obvious.

**The constraint.** ElevenLabs Text-to-Dialogue is reliable up to roughly 2,000
characters per request — about 90 seconds of this show. A six-minute episode is
therefore **four or five requests, not one**. But `TalkShowScene` plays exactly
one audio track per character, started together, and SitePal cannot play a URL
(`sayAudio` resolves names inside the account — verified by the spike at
`src/app/trade/spike-sayaudio/page.js`), so every track must be uploaded by
hand. Five blocks must not mean ten uploads.

**The resolution.** Generate each block separately — in context, never line by
line, because the conversational timing is the entire reason the performance
works — then concatenate the masters **locally** into one pair of full-length
balanced WAVs. One upload pair per episode. The runtime playback model does not
change at all; only the constants it reads do.

The line timing then composes: a line's global start is its in-block start plus
the summed duration of every block before it.

```
global_start(line) = Σ duration(blocks before its block) + local_start(line)
```

Blocks are packed per episode by `packBlocks()` rather than being a fixed
grouping, because segment lengths drift week to week and a fixed grouping that
fits in September quietly breaks the ceiling in October — where the failure
shows up as a truncated generation rather than an error.

A block boundary is always a segment boundary, so the join lands on a beat that
was already there.

**PCM, not mp3 — this matters.** The blocks are requested as PCM (`pcm_44100`
by default, or whatever `LT_TV_PCM_RATE` says — see the note on plan tiers in
`docs/lt-tv.md`) rather than the `mp3_44100_128` the single-block test script
uses, because mp3
frames carry encoder delay and padding. Concatenating them inserts a few
milliseconds of silence at *every join* that the timestamps know nothing
about, and since each block's offset is the sum of the ones before it, that
error accumulates: the first block stays in sync and the last one drifts. The
symptom is the picture running against the dialogue, which looks exactly like
a mistuned lead-in and is much harder to trace. Raw PCM concatenates by
appending bytes, so a join is exact to the sample and a block's duration is a
byte count rather than a measurement. It also means this step needs no ffmpeg.

```bash
node scripts/lt-tv-audio.mjs content/lt-tv/episodes/news-01.json
```

That generates each block, cross-checks the decoded length against the
timestamps ElevenLabs returned for it (a wrong format assumption fails on
block one rather than silently at minute four), lays the blocks end to end,
writes `master-dialogue.wav` and the merged `voice-segments.json` under
`content/lt-tv/audio/<episode>/`, and writes the real `lineStarts`,
`lineEnds` and `durationSeconds` back into the production record. Finished
blocks are cached, so a run that dies on block four resumes at block four
rather than paying for the first three again.

Then the existing cleanup splits that master into the two balanced tracks.
**This half needs ffmpeg:**

```bash
python3 elevenlabs-dialogue-test/process_dialogue.py \
    --master content/lt-tv/audio/news-01/master-dialogue.wav \
    --segments content/lt-tv/audio/news-01/voice-segments.json \
    content/lt-tv/audio/news-01
```

`--master`/`--segments` are new: the processor previously only accepted a
response JSON it decoded itself, which a concatenated master is not. Its
actual stem-splitting is untouched.

Finally refresh the slate record, so it picks up the timing and the episode
becomes playable rather than a slate entry:

```bash
node scripts/lt-tv-slate-record.mjs news-01
```

**Not** by re-running `scripts/lt-news-script.mjs`. That is what this step used
to say, and it is the one instruction here that can cost you the afternoon: the
generator rebuilds the episode from scratch, so it spends two model calls,
overwrites the screenplay you edited, and clears the timing you have just paid
to record. The join above only walks the production record into the slate's
shape, which is all this step needs.

Hand-copying `line_starts` into a constant and re-stating the speaker mapping
for the gazes are gone from `docs/talk-show-production.md` at this point — the
episode-records change removed those constants from `TalkShowScene.jsx`
outright. The record already knows who speaks each line, so gaze and camera
derive from it rather than being transcribed.

**Uploading stays manual.** Two files per episode into SitePal's Audio Manager.
That is the one step the spike proved cannot be automated from the site.

The names are **not** yours to invent — the record already states them, in
`cast.Connor.sitepalAudio` and `cast.Monk.sitepalAudio`:

```
lttv_news_ep01_connor
lttv_news_ep01_gr80
```

That is the LT TV convention, `lttv_<show>_ep<NN>_<character>`, following the
shape of the existing Terminal Traders clips (`case001_monk_q5`). It matters
that it is generated rather than chosen per episode for two reasons. The
account has **one** Audio Manager shared by every character, not one per
character, so a name like "episode 02 connor" is not safe against a second
show reaching for the same words. And `TalkShowScene` resolves clips by name,
so a name that does not match is a silent failure to speak — no error, just an
avatar that never opens its mouth.

The episode number comes from `--number`, defaulting to one past however many
news records already exist. A re-run of a week you have already produced needs
the number passed explicitly.

---

## Step 4 — Put it on the site *(joined; the audio is what is left)*

The slate under `src/content/lt-tv/` is the site's episode list: one JSON
record per episode under `episodes/`, decorated by `index.js`, read by
`LTTvBroadcastPanel`, the mobile screen and `TalkShowScene`.

**The pipeline now writes into it.** `scripts/lt-tv-slate-record.mjs` is the
join: it takes the production record and emits the slate's flat shape, writes
it to `src/content/lt-tv/episodes/news-<NN>.json`, and adds the import and the
`EPISODE_RECORDS` entry to `index.js` — a record nobody imports is a record the
site never shows, and bundlers cannot glob a directory at build time.

```bash
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json
# → content/lt-tv/episodes/news-01.json   the production record
# → src/content/lt-tv/episodes/news-01.json     the slate record, on the guide
node scripts/lt-tv-check.mjs
```

A **draft run does not touch the slate.** `--draft` exists to look at the
format and hear the two voices, and the worked sample is synthetic, so it must
not be one flag away from being listed as an episode of the show. Pass
`--slate` to add it anyway when you are testing this path, or `--no-slate` to
suppress it always.

### What the record can and cannot know

Three fields come from real audio and nothing else: `audio` (the SitePal clip
names), `lineStarts`, and `dialogueEnd`. Until the audio build (step 3) runs,
the record omits all three, `episodeIsPlayable` returns false, and **the guide
lists the episode as "Not recorded yet"** — which is exactly right for an
episode that has been written but not recorded. Everything else is known the
moment the script exists and is written now:

| Slate field | Comes from |
|---|---|
| `speakers` | who holds each line — the listener turns and camera shots derive from it |
| `audienceLines` | the lines **not** marked `directAddress` (see below) |
| `cues` | each line's reaction beats, with their offsets and clip lengths |
| `leadIn`, `graphics`, `sources`, `week` | the production record |

**`audienceLines` is an inversion, and it reads like a typo.** The pipeline's
`directAddress: true` means the speaker is talking *at* the other host, so the
listener turns to face them. The slate's `audienceLines` means the opposite —
played to the room, nobody turns, the camera pulls back to the two-shot.
`buildEpisodeTimeline` skips the gaze for precisely those lines. Mapping one
straight onto the other sends most of the episode wide; there is a test
asserting the two partition the episode.

### The episode number is load-bearing

It names the slate record (`news-03.json`) **and** both SitePal uploads
(`lttv_news_ep03_connor`). So it is read from the slate rather than counted
from the staging directory, and a week already on the slate keeps the number it
was given — a re-run of the same week updates that episode instead of becoming
a second one. `--number` overrides it.

### Still hand-wired

`LTTvChiron.jsx`'s `TICKER_COPY` is lorem ipsum with a comment saying the
content is undecided. The record already carries the copy at `graphics.ticker`;
pointing the component at it is a one-line change nobody has made yet.

---

## The weekly checklist

- [ ] `node scripts/lt-news-brief.mjs` — check `degraded` is empty or harmless
- [ ] `node scripts/lt-news-script.mjs --brief <brief>`
- [ ] Read the `.txt`. Does each story have a real number? Does GR80 lose one?
- [ ] Fix what you found in the `.txt`, then `node scripts/lt-tv-edit.mjs <id>`
- [ ] Zero warnings, or each one understood and accepted
- [ ] Check `rundown.stories[].gaps` — anything non-empty is unsourced
- [ ] Spot-check every number in the script against `sources`
- [ ] `node scripts/lt-tv-check.mjs` — the new record is on the slate and consistent
- [ ] `node scripts/lt-tv-audio.mjs <record>` — every line rendered on its own; then listen to the master end to end
- [ ] Listen for the gap between lines (`LT_TV_LINE_GAP`) and for replies whose energy needs a `[tag]`
- [ ] `node scripts/lt-tv-split.mjs <id>` — cuts the two tracks into the SitePal clips
- [ ] Upload the WAVs under the names the split prints
- [ ] `node scripts/lt-tv-check.mjs` again — it should now report a runtime, not "not recorded yet"
- [ ] Tune `leadIn` by ear — 2.5 is a placeholder, and it is a property of the
      upload, not the script (`docs/talk-show-production.md`)
- [ ] Play it once through on `/trade`, then a second time for stale state

---

## Still open

- **Step 3 has never met real audio.** It was written without an ElevenLabs key
  and without ffmpeg. The offset arithmetic, the PCM handling and the WAV
  header are covered by `scripts/lt-tv-audio.test.mjs` against synthetic
  buffers of known length, and the processor's new `--master` path was
  exercised to the point where it calls `ffprobe`. What is unverified is
  everything past that line: that `pcm_44100` really is 44.1kHz mono 16-bit
  (the run cross-checks this and fails loudly if not), and that the stems come
  out clean from a concatenated master. The first real render is the test.
- **The replacement upstreams have not been run against the real internet.**
  FRED, the four crypto RSS desks, the Google News queries and Reddit's OAuth
  handshake were all written in a sandbox with no outbound network, and
  verified against recorded fixtures rather than live responses. `--check-sources`
  is how you find out; the fixtures cover the parsing, not the endpoints.
- **The speaking rate is a guess.** `ESTIMATED_WPM = 145` produces the runtime
  in the slate. Recalibrate from the first real render: measured duration ÷
  measured word count.
- **Verification is not the same as editing.** The rundown now confirms each
  story against a real article, which removes the worst failure — a number
  invented wholesale. It does not remove the need for a human glance at the
  link on a story worth leading on.
- **RL80 has no news slot, deliberately.** Nothing sources RL80, staking, the
  shrine or anything HAIL MARY ships into the rundown, because the show would
  be reporting on itself. Michelle's call: RL80 appears as the ad break, which
  is `content/lt-tv/rl80-spots.md` and hand-fed. Revisit only when there is
  project news a stranger would find newsworthy.
- **The roundtable show is a separate workflow.** It shares the record format
  and the audio build, but its topics do not come from a news feed and its
  segment skeleton is different.
- **`/api/cron/update-sentiment` already writes a weekly-ish sentiment document
  to Firestore** and nothing on the show side reads it. Folding it into the
  brief would replace two of the direct upstream calls with data the site is
  already paying to collect.
