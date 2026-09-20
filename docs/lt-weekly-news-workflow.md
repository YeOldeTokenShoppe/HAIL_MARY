# LT Weekly News Recap — the production workflow

How one episode of the weekly news show gets made, from "it is Friday" to
"it is on the site."

This document covers the **news** show. `docs/talk-show-production.md` remains
the reference for the audio mechanics (ElevenLabs tags, the balanced-WAV
cleanup, SitePal uploads); this one is the layer above it — what the show is,
where its topics come from, and what file holds an episode.

> **Status.** Steps 1 and 2 are built and runnable. Step 3 is designed here but
> not yet written. Step 4 changes files on the site and has not been done — it
> needs a decision first. Nothing in this workflow has modified an existing
> route or component.

---

## The idea in one paragraph

An episode is **one JSON file**. Everything about it — its title, its chiron
copy, every spoken line with its voice, its recording blocks, its animation
cues, the SitePal clip names, the sources it is built on — lives in that one
record. Today those things live in four hand-maintained arrays across two
components, joined by nothing, and producing an episode overwrites the previous
one. The record is what makes a *second* episode possible.

```
  a week of crypto signal
           │
           │  scripts/lt-news-brief.mjs          ← step 1, runs anywhere
           ▼
  content/lt-tv/briefs/news-2026-W38.json
           │                       ↖ content/lt-tv/rl80-spots.md (you edit this)
           │  scripts/lt-news-script.mjs         ← step 2, two Claude calls
           ▼
  content/lt-tv/episodes/news-2026-W38.json     ← THE EPISODE RECORD
  content/lt-tv/episodes/news-2026-W38.txt      ← the read-through, for review
           │
           │  audio build (step 3 — not built yet)
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
| Cold open | 95 words | Barron previews the three stories; GR80 undercuts the preview. |
| Lead story | 210 words | The week's biggest, from any beat. |
| Second story | 200 words | A different corner of the market from the lead. |
| The spot | 55 words | The RL80 ad break. Skipped when there is no copy. |
| Third story | 185 words | The absurd one — usually collectibles or a mania. |
| The board | 135 words | The numbers that moved, plus one prediction-market line. |
| Sign-off | 70 words | Recap, and "none of it was a recommendation." |

About 950 words, roughly **6:33** at the estimated speaking rate — the middle of
the 5–10 minute target, so one long segment does not push the episode out of
the window.

**The beat pattern inside a story** — Barron states the fact with its number,
GR80 reframes what the number is actually counting, Barron pushes back (usually
by defending his own profession), GR80 lands the button. Six to ten lines. GR80
does not get the last word in all three stories.

**The story slots are not assigned to beats.** The week decides which is the
lead. What the rundown is told is to *spread* them: if the lead is macro, the
second story should not be.

### The spot

The one hand-fed input in the whole pipeline. `content/lt-tv/rl80-spots.md` is
a plain markdown file of `-` bullets — one line per thing the show can plug.
The writer picks one and builds an ad read around it: Barron does the sponsor
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

One character has five names depending on which file you are in:

| `actor` | Display | ElevenLabs voice | Python key | GLB node | Also called |
|---|---|---|---|---|---|
| `Barron` | Barron | `IcFWazAaBzXNwLWpySgF` | `john` | `Demon_Empty` | Connor, H80Z, JB |
| `Monk` | Saint GR80 | `fATgBRI8wg5KkDFg8vBd` | `gr80` | `Monk_Empty` | GR |

`scripts/lt-tv-format.mjs` is the one place this mapping is written down, and
the pipeline uses `actor` and nothing else.

> Note: the LT TV survey in the project files lists GR80's voice as
> `JBFqnCBsd6RMkjVDRZzb`. That is wrong. The repo is internally consistent on
> `fATgBRI8wg5KkDFg8vBd` — `dialogue.json`, `process_dialogue.py`,
> `elevenlabs-dialogue-test/README.md` and `docs/talk-show-production.md` all
> agree.

---

## Step 1 — Pull the week

```bash
node scripts/lt-news-brief.mjs
# → content/lt-tv/briefs/news-2026-W38.json
```

Five families of source, all free and keyless except the last:

**Macro**
- **Federal Reserve** press releases (`press_monetary.xml`) — the authoritative
  source for an FOMC decision, ahead of anybody's coverage of it.
- **Treasury daily yield curve** — the three-month, two-year, ten-year and
  thirty-year, a week of them, with the ten-year's move and the 2s10s spread
  computed.
- **Economy and markets headlines** — CNBC economy, CNBC markets, Yahoo Finance.

**Markets**
- **Index levels** — S&P 500, Nasdaq 100, Dow, week over week, from Stooq's
  keyless daily CSV.
- **Commodities** — WTI crude and gold, same source.

**Crypto** — Reddit's weekly top from r/bitcoin, r/ethereum and
r/cryptocurrency; CryptoPanic RSS; CoinGecko trending; Fear & Greed across eight
days so the show can read the *arc* rather than today's number; and
CoinMarketCap if `CMC_PRO_API_KEY` is set.

**Collectibles** — r/PokemonTCG, r/sportscards and r/collectibles, weekly top.
There is no free price API for trading cards worth wiring, so the beat is
sourced the way a human notices it: a set launch or a frenzy pushes a post to
the top of the week, and the editorial pass confirms any actual number from a
real article.

**Predictions** — Polymarket and Kalshi, filtered to the show's beats (rates,
inflation, recession, the indices, oil, crypto, legislation) and normalised so
both quote a probability.

A source that fails lands in the brief's `degraded` array and the brief is
still written. A news show that cannot run because Stooq rate-limited is not a
sustainable news show.

### Checking the sources

Silent degradation is right on a Friday and wrong on the first run on a new
machine. To tell them apart:

```bash
node scripts/lt-news-brief.mjs --check-sources
```

It pings every upstream, reports which answered and with how many items, and
writes nothing.

**Why not just call `/api/ai/trending`?** That route hits three of the same
crypto upstreams, but it is tuned for the live `/trade` page: a six-hour cache,
Reddit's *hot* listing, titles truncated to 40 characters, and only the top
three topics kept. A weekly show needs the opposite of all four — and it needs
four families of source that route has never had. So this reads its own
upstreams and leaves the route untouched.

## Step 2 — Write the script

```bash
export ANTHROPIC_API_KEY=...
node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json
```

Two Claude calls (`claude-opus-5` by default; override with `LT_NEWS_MODEL`),
raw `fetch` against the Messages API — the same convention as every other Claude
call in this repo, so no SDK dependency is added.

1. **The rundown** — the editorial pass. Picks three stories in running order,
   the gauge beat, the chiron headline and the ticker items. It is told to
   reject price predictions, single-source social posts, and two stories that
   are the same story wearing different hats.

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

To see just the editorial decisions before spending a script call:

```bash
node scripts/lt-news-script.mjs --brief <brief> --rundown-only
```

### Everything numeric is computed locally

The model writes words. `assemble()` owns every number: global line numbering,
word counts, runtime estimate, recording blocks, and cue durations looked up
from the clip table. It also **validates**, and the warnings are the review
checklist:

- a cue naming a reaction its actor does not have (`prayCrosschest` is GR80's
  only — Barron would T-pose) — dropped, with the valid list printed
- a cue naming an actor who is not on this set — dropped
- a line opening with an event tag like `[sighs]`, which the 120 ms handoff trim
  in `process_dialogue.py` would eat — flagged, not dropped
- a story the editorial pass could not confirm from a real source
- a host given two turns in a row (the camera cuts on who speaks)
- a segment more than 25% off its word target
- an episode estimated outside 5–10 minutes
- a recording block over the character budget

### Reviewing and revising

Read `content/lt-tv/episodes/news-2026-W38.txt` — the read-through, one line per
turn with its cues. To fix a line, edit the draft and re-assemble without
spending another model call:

```bash
node scripts/lt-news-script.mjs --draft content/lt-tv/samples/news-2026-W38.draft.json
```

The draft format is the same `{ rundown, segments }` shape the model returns, so
a hand-edit and a generated script go through identical assembly and identical
validation.

`content/lt-tv/samples/` holds a worked example — the draft, the assembled
record and its read-through (`news-2026-W38.sample.txt`). **Its facts are
invented.** It exists to show the record format and the two voices, and it must
not be recorded or quoted.

---

## Step 3 — Build the audio *(designed, not yet built)*

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

**What the builder needs to do**, in order:

1. For each block in the record, emit an ElevenLabs `dialogue.json` from its
   lines and generate it. Keep the seed per episode for repeatability.
2. Concatenate the block masters in order (`ffmpeg concat`), recording each
   block's measured duration into `blocks[].durationSeconds` and its cumulative
   `offsetSeconds`.
3. Run the existing `process_dialogue.py` cleanup against the concatenated
   master and the offset-shifted `voice_segments`, producing the two balanced
   WAVs exactly as today.
4. Write `timing.lineStarts` / `lineEnds` / `durationSeconds` back into the
   record, and resolve each cue's absolute time from its line and offset.
5. Print the upload worklist: two files, two names.

Steps 3 and 4 of `docs/talk-show-production.md` — copying `line_starts` into
`TEST_LINE_STARTS` by hand, and re-stating the speaker mapping in
`DIRECT_ADDRESS_GAZES` — disappear at this point. The record already knows who
speaks each line, so gaze and camera derive from it instead of being
transcribed. (`TalkShowScene.jsx:123` anticipates exactly this: *"Cues stay
attached to line numbers so a future script generator can replace this array."*)

**Uploading stays manual.** Two files per episode into SitePal's Audio Manager.
That is the one step the spike proved cannot be automated from the site.

The names are **not** yours to invent — the record already states them, in
`cast.Barron.sitepalAudio` and `cast.Monk.sitepalAudio`:

```
lttv_news_ep01_barron
lttv_news_ep01_gr80
```

That is the LT TV convention, `lttv_<show>_ep<NN>_<character>`, following the
shape of the existing Terminal Traders clips (`case001_monk_q5`). It matters
that it is generated rather than chosen per episode for two reasons. The
account has **one** Audio Manager shared by every character, not one per
character, so a name like "episode 02 barron" is not safe against a second
show reaching for the same words. And `TalkShowScene` resolves clips by name,
so a name that does not match is a silent failure to speak — no error, just an
avatar that never opens its mouth.

The episode number comes from `--number`, defaulting to one past however many
news records already exist. A re-run of a week you have already produced needs
the number passed explicitly.

---

## Step 4 — Put it on the site *(not done — needs a decision)*

Nothing in this workflow has touched a route or a component yet. Wiring the
record into LT TV means these changes, and they should be made deliberately:

- `LTTvBroadcastPanel.jsx` — `EPISODES` and `SHOWS` become a read of the episode
  records instead of hardcoded arrays, so the news show stops being "Coming
  soon" and the slate stops advertising six episodes that are one recording.
  The hardcoded air date at `:196` comes from the record.
- `TalkShowScene.jsx` — `TALK_SHOW_AUDIO`, `TEST_LINE_STARTS`,
  `TALK_SHOW_CUE_DEFS` and `DIRECT_ADDRESS_GAZES` stop being module constants
  and become props derived from the selected episode. This is what lets two
  episodes both be playable.
- `LTTvChiron.jsx` — `TICKER_COPY` is still lorem ipsum with a comment saying
  the content is undecided. It becomes `graphics.ticker` from the record.

The honest note: until step 4 happens, picking any episode in the guide still
plays the same 58-second test recording, exactly as it does today.

---

## The weekly checklist

- [ ] `node scripts/lt-news-brief.mjs` — check `degraded` is empty or harmless
- [ ] `node scripts/lt-news-script.mjs --brief <brief>`
- [ ] Read the `.txt`. Does each story have a real number? Does GR80 lose one?
- [ ] Zero warnings, or each one understood and accepted
- [ ] Check `rundown.stories[].gaps` — anything non-empty is unsourced
- [ ] Spot-check every number in the script against `sources`
- [ ] Build the audio, listen to the master end to end
- [ ] Check each block join for a seam
- [ ] Upload two WAVs, put the names in the record
- [ ] Play it once through on `/trade`, then a second time for stale state

---

## Still open

- **Step 3 is not built.** The design above is sound but unproven — the sandbox
  this was written in had no `ffmpeg` and no ElevenLabs key, so the
  concatenation and the offset arithmetic have not been run against real audio.
- **The speaking rate is a guess.** `ESTIMATED_WPM = 145` produces the runtime
  in the slate. Recalibrate from the first real render: measured duration ÷
  measured word count.
- **Verification is not the same as editing.** The rundown now confirms each
  story against a real article, which removes the worst failure — a number
  invented wholesale. It does not remove the need for a human glance at the
  link on a story worth leading on.
- **The show has no way to mention its own world.** Nothing sources RL80,
  staking, the shrine or anything HAIL MARY ships. The nearest thing in the
  repo is `eliza/rl80-agent/src/talking-points.ts`, a hand-edited file used by
  the Telegram debate plugin. A project-news slot would need the same: a short
  file a human keeps current.
- **The roundtable show is a separate workflow.** It shares the record format
  and the audio build, but its topics do not come from a news feed and its
  segment skeleton is different.
- **`/api/cron/update-sentiment` already writes a weekly-ish sentiment document
  to Firestore** and nothing on the show side reads it. Folding it into the
  brief would replace two of the direct upstream calls with data the site is
  already paying to collect.
