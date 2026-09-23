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
button — write it, record it, record it again after changing a pause, cut
the two tracks into the clips, apply your edits, rewrite a line you marked,
check the slate. There is also a box for the episode title, so renaming one
does not mean hunting through the script for its first line. The news show also has two buttons under its own heading,
**Pull the week** and **Write this week's news**, because a news episode has
to be made before there is one to open. The screenplay is editable in the page, with a Save button and
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

## Watching an episode — pause and skipping

On the set (`/trade`, and the LT TV screen on a phone) the controls are pause
and resume, skip back, skip forward, and a bar of blocks you can click.

**Pause is exact.** It holds the line where it is and picks it up on the same
syllable — SitePal's `freezeToggle` does that, and the picture (camera cuts,
head turns, reactions) is held on the same second so nothing drifts while you
are away. The old ■ button ENDED the episode, which is why pressing play again
started it from the top.

**Skipping lands on the start of a part, and cannot be finer than that.**
SitePal has no seek: its speech functions take a clip name and start it at the
beginning, and there is no call that sets a position. What there is instead:
an episode over 90 seconds is already several clips, because SitePal refuses
one longer than that, and starting a clip is what the set does at every join.
So those joins are the seek points — about every 75 to 90 seconds, six of them
in a seven-minute episode — and the bar is drawn as those blocks rather than as
a continuous line, so it promises exactly what it can do. Skip back inside the
first three seconds of a part goes to the part before; later it starts the part
you are in again.

If you want finer landing points on a particular episode, cut it into more
parts: a `# cut` mark in the screenplay puts a join on a line of your choosing
(see **Pauses**), and every join is a place a viewer can jump to.

Keyboard, while an episode is on: **space** (or **k**) pauses and resumes,
**←** and **→** skip a part.

The code: the transport calls live in `src/components/trade/TalkShowScene.jsx`
under "PAUSE, RESUME AND SKIPPING", the arithmetic is in
`src/lib/ltTv/episodeTimeline.mjs` and checked by
`node scripts/lt-tv-transport.test.mjs`, and the controls themselves are in
`LTTvBroadcastPanel.jsx` (desktop) and `MobileTalkShow.jsx` (phone).

---

## The live show — the Q&A desk

The characters take viewers' questions live: the show's reader reads the
question out, and the two characters answer it in character, spoken on the set
with lip-sync while the camera cuts to whoever is talking. Nothing is recorded
or uploaded.

**To run it:** open `/trade?live=desk`, go into the news set or the Markets &
Morality set, and use the LIVE DESK panel on the right.

1. **Go live.** Lights up, a LIVE bug top left, the camera on the two-shot.
2. **Add a question** — the viewer's name and their words, then Enter. It is
   written straight away, so it is usually ready by the time you get to it,
   and you can read the answer before it airs. **Rewrite** asks again.
3. **Air it.** The question shows as a lower third while it is answered.
   **Stop** cuts it off.

**Between questions they banter.** While the desk is live and nothing is in the
queue (nothing being written, nothing ready to air), the pair talk to each
other in character once the set has been quiet for the time set under
**Between questions** (20 seconds unless changed). One piece is always written
ahead, and shown on the desk, so it airs straight away. **Write another** throws
it away for a fresh one, **Banter now** airs it immediately, and **Banter: off**
keeps the set quiet. Pressing **Air next** on a question during banter cuts in
when the line being spoken ends. Nothing is written for banter while the desk
is not live, since each piece is a writer call plus live speech. Each piece
starts from a random angle (`BANTER_ANGLES` in `scripts/lt-tv-live.mjs`) so it
does not land on the same joke, and it knows what was said earlier that night.
Try it from a terminal: `node scripts/lt-tv-live.mjs --show morality --banter`.

On the deployed site the desk asks once for the admin password (the same one
as the lineup page). Locally it does not.

| Set | Reads the question | Answers |
| --- | --- | --- |
| News | Holly | Holly and Connor |
| Markets & Morality | Connor | Connor and GR80 |

**Why one browser.** The voices are SitePal's live speech (`sayText`, engine
14, the characters' own ElevenLabs voice ids), which is generated each time it
plays. Run in every viewer's page it would be generated, and paid for, once per
viewer. So the show is performed in the producer's browser and broadcast from
there.

**The rules for a live answer** are the shows' own character briefs plus a live
section in `scripts/lt-tv-live.mjs`: three to five lines, no advice, no figures
or news stated as fact (there is no rundown live), and a question that should
not go on air is declined in two lines rather than repeated. Try it from a
terminal without the set: `node scripts/lt-tv-live.mjs --show news --name Dana
"Is the Fed bluffing?"`. `LT_TV_LIVE_EFFORT=low` answers faster.

Where: `src/components/trade/LTTvLiveDesk.jsx` (the panel),
`src/app/api/lt-tv/live/route.js`, `src/lib/ltTv/liveDesk.mjs` (who sits where,
what survives from the writer), `TALKSHOW_LIVE` in `TalkShowScene.jsx` (how the
camera and the listener's head follow a live speaker). Tests:
`node scripts/lt-tv-live.test.mjs`.

---

## Ratings and comments

Every episode carries a five-star rating and a comment thread, the way a video
does. **Reading them is open to anyone; rating or commenting needs a sign-in**
through the site's existing Clerk sign-in, which opens as a modal so the 3D set
does not get torn down and reloaded just to say "good episode".

On the desktop console the rating sits under the episode summary — a row of
stars and the average, which opens the comments as a sheet beside the program
guide. On a phone they are stacked under the episode list, because that screen
scrolls and needs no sheet.

Clicking the star you already gave takes your rating back.

**Signing in does not cost you your place.** Clerk redirects back to `/trade`
after a sign-in, and a fresh `/trade` used to mean the trade landing with the
episode, the open comments and the half-typed comment all gone. Three things
survive it now:

- **Where you were watching**, in one query parameter — `/trade?lttv=news-01`
  for an episode, `/trade?lttv=news` for a show's lineup. It is written with
  `history.replaceState`, so nothing navigates to keep it up to date, and it is
  read back once on arrival. A value naming an episode that is no longer on the
  slate is ignored rather than followed, and the parameter is dropped when LT
  TV closes. It is an ordinary link too: that address is how you send somebody
  straight to an episode.
- **The comment you were writing**, and the star you had just clicked, in
  `sessionStorage` for half an hour. The comments reopen on the way back with
  your words still in the box. The star lands by itself; the comment does not
  send itself, because words that go public get a last look.
- Which means **you can write the comment before you sign in**. The box is
  there either way and the button reads "Sign in and comment" when you are
  signed out, rather than making you do the errand first and then remember what
  you were going to say.

`src/lib/ltTv/watchUrl.mjs` holds that, checked by `node
scripts/lt-tv-watch-url.test.mjs`; `/trade`'s page reads and writes it. The
phone screen keeps the draft but not the position — mobile LT TV lives inside
the terminal's own screen stack rather than in a URL.

**Where it is kept.** Firestore, under the episode's own id:

    ltTvEpisodes/{episodeId}                  the tally: count, sum, average, commentCount
    ltTvEpisodes/{episodeId}/ratings/{userId} one doc per viewer
    ltTvEpisodes/{episodeId}/comments/{id}    the comments

Subcollections rather than one flat collection, so that "this episode's
comments, newest first" needs only Firestore's automatic index. **Nothing has
to be set up in the Firebase console, and no security rules have to be
deployed, for this to work.**

**The browser never touches Firestore here — not to write, and not to read.**
Everything goes through `/api/lt-tv/ratings` and `/api/lt-tv/comments`, which
verify the Clerk session token where one is needed and then use the admin SDK,
which security rules do not apply to.

Writes had to work that way: viewers sign in with Clerk, not with Firebase
Auth, so `request.auth` in a rule is null for them and a rule could only ever
have said "anybody may write". Reads *could* have been direct, and would then
have been live — a second viewer's comment appearing as it was typed. They are
not, because direct reads need a rule granting public read, and a rule only
takes effect when somebody runs a deploy for it. The comments would have looked
broken on the site until that command was run. The cost of the choice is that a
new comment appears on the next refresh, which is how comments under a video
behave anyway; posting, editing, deleting or rating refreshes the thread on the
spot.

It is the same shape as `/api/testimonials`, and deliberately not the shape of
the old `/admin` page, which checks a password in the browser.

Those two routes are **public**, unlike the other routes in
`src/app/api/lt-tv/` — the studio ones (`run`, `script`, `pitch`, `room`,
`status`) 404 outside development. If you add a route to that folder, decide
which of the two kinds it is.

A comment is limited to 600 characters, no links, and five an hour or thirty a
day per viewer. It runs through the same OpenAI moderation call the shrine
testimonials use; with no `OPENAI_API_KEY` set, moderation is skipped and the
word and link guards still apply. You can edit or delete your own comment and
nobody else's — checked on the server against the id on the verified token.

An episode id is checked against the episodes that **exist**, not against a
pattern, so nothing can leave a rating on an episode that is not on the slate.

The code: `src/lib/ltTv/reactions.mjs` (the rules, pure and tested by
`node scripts/lt-tv-reactions.test.mjs`), `src/lib/ltTv/reactionsServer.js` and
the two routes, `src/lib/ltTvReactions.js` (the browser half), and
`src/components/trade/LTTvReactions.jsx`, which is the one panel both screens
use. `firestore.rules` denies the browser all three collections outright and
says why.

---

## The lighting board

The set's lights have two states: full while an episode is running, and down
between episodes, so the studio comes up when a show starts and goes dark when
it ends. Two things make that cue, and they move together:

- the **room** — one flat light over the whole canvas, which is most of what
  you see (`HOUSE_AMBIENT` in `TalkShowScene.jsx`)
- the **rig** — the four fixtures on the overhead bar, their beams and their
  lens glare (`STUDIO_LIGHTS`, same file)

Dimming the rig on its own is invisible. It adds a lot of light to a small part
of the set and the room lights everything, so if the cue ever stops reading,
that is the first thing to check.

**To dial it in, open `/trade?tune=lights` and go to an LT TV set.** A board
appears on the right with:

- **Off air / On air / Follow the show.** The first two hold the set in one
  state so you can judge both without sitting through an episode. The third
  hands it back to real playback. This is only for tuning; it resets on reload.
- **Levels** — the room on air and off air, how far the rig drops off air, and
  how fast the fade is.
- **Fixture 1–4**, one at a time, with its swing, tilt, brightness, beam and
  colour. Swing and tilt are degrees off the aim that was modelled in Blender,
  so 0 is always the original and **Re-centre aim** is the way back.
- **Faces** — the two characters' faces on air and off air. They need their own
  pair because **no light on this set reaches them**: what is on a face is a
  crop of SitePal's own render, already lit where it was drawn, so it is
  painted on an unlit material that ignores every lamp in the scene. Those two
  numbers multiply it by hand. They only do anything once both characters are
  actually speaking, since until then you are looking at the static faces,
  which are lit normally.
- **Beam, all four** — spread, softness, falloff, throw and the shaft.

Everything applies as you drag and is remembered in your browser, so a reload
does not lose an evening. Nothing is written to the repo: press **Copy values**
and paste the block into the project thread, and the numbers become the
defaults.

Shaft thickness and length (`coneLength`, `radiusTop`) are baked into the beam
geometry when the set loads, so they are not on the board — change them in
`STUDIO_LIGHTS` and reload.

---

## The camera work — a camera operator for the set

While an episode plays, the camera you watch through is not locked off. It cuts
between five shots the way an operator would, following the same shot list the
record already implies — who is speaking, who a line is aimed at, and where the
chapters start. Nothing new has to be authored per episode; the shots fall out
of the script.

The five cameras:

- **Establish** — the whole set. Top of the show, and every new story (a
  chapter start).
- **Two-shot** — the pair at the desk. The breather between runs of singles,
  and the only shot that shows one host *reacting* to the other, which is why
  the grammar keeps coming back to it (see "Reaction coverage" below).
- **Single** — the speaker, angled across the desk toward the other chair, for
  a line aimed at the other host. The listener is turned toward them, so the
  angle has something to be about.
- **Close** — the same single punched in, when an exchange has sat on singles
  long enough to be heating up.
- **Direct** — a clean single straight down the lens, for a line read to the
  room (an `audienceLines` line). This is the piece of news grammar worth
  naming: the set used to go *wide* when a host addressed the viewer, which is
  exactly the moment television punches in.

### Reaction coverage, and the tripod

Two things about the two-shot were fixed on 2026-09-22, both off Michelle's
notes from watching an episode.

**It was cut too rarely, and the news show had it worst** — 5 of its 47 shots,
against 8 of 43 on Markets & Morality. The cause was in the grammar rather than
the framing: a line read to camera used to *reset* the run of tight shots that
triggers the pull-back to the pair, and the news show reads to camera often
enough that the pull-back almost never came round. A to-camera line now counts
toward that run (it is just as tight a shot as a cross single, so it earns the
breather the same way) while still being framed as `direct`. Separately, a
long speech held in close-up now pulls out to the pair halfway through instead
of back to a looser single, because halfway through a speech the interesting
thing on the set is the other host's face. Together: the pair is on screen for
about 28% of Markets & Morality and 19% of the news show, up from 18% and 14%,
and Markets & Morality's worst single held shot drops from 27 s to 14 s.
`scripts/lt-tv-shots.test.mjs` pins a floor of 12% of shots so this can't
quietly regress again.

**The tripod camera prop stood in the middle of the two-shot.** Measured off
the GLB, with the news set's seats pinned the way the scene pins them: the prop
sits at `x = 0.00, z = 1.92`, and the old two-shot's lens landed only 0.12 m
off its axis with the prop between it and the desk — inside the frame at every
window size, so the prop was in the picture every time the shot was cut.
Swinging the shot the other way (azimuth `+5` → `-12`) puts the lens 0.45 m to
the side and roughly level with the prop, which clears it.

**It clears at a normal window, not at every window.** The two-shot is
authored as a width of desk, so a *narrower* window makes the lens retreat to
hold that width — 2.16 m at 2560×1270, 2.45 m at 16:9, 3.11 m at 1280×915 —
while the prop stays put. Past about 16:9 the lens is behind the prop again and
it creeps back toward frame centre. No fixed angle fixes that, because the
distance moves and the prop doesn't. If the prop ever reappears in the
two-shot, a tall narrow browser window is the reason. The robust fix, if it
becomes worth it, is to strike the rig nodes (`MONITOR_HIDDEN_NODES`) for the
shots where the prop is geometrically between the lens and the desk and leave
it standing for the rest — it is deliberately visible on set, so hiding it
outright would be wrong.

**When each shot is live is decided in `src/lib/ltTv/episodeTimeline.mjs`**
(the shot list, next to the listener turns), because it is a question about the
script. **Where the lens goes for a shot is solved in
`src/lib/ltTv/shotFraming.mjs`** from the live head positions and the window's
aspect — a shot is authored as what it should *contain* ("3 m of desk across",
"the head fills 43% of frame height"), so it stays composed at any window size
rather than being a camera position that was right once. The cost of that is
in the tripod note above: a shot that holds its framing at every window size
is a shot whose lens *moves* with the window.

**To dial it in, open `/trade?tune=shots` and go to an LT TV set.** A board
appears on the left (the lighting board is on the right, so both can be open):

- **Follow the show**, then a button per shot. The show mode cuts through the
  list as the episode plays; a shot button **holds** that one shot so you can
  fit it with the episode paused or stopped. Tuning only; it resets on reload.
- **On air / Face** readout — which shot is live, and how many screen pixels
  tall the face is landing at, with a ratio. The SitePal face is a crop about
  195 source pixels tall, so **past 1.0× the face is being enlarged beyond its
  source and softens** while everything around it stays sharp. That number is
  the honest limit on how far a shot can push in.
- **Shot** — the selected shot's size (set width for the wides, head share for
  the singles), lens (FOV), angle off front, lens height and aim height.
- **Motion, all shots** — the operator on/off, hard cuts vs. a swing between
  shots, the swing speed, the slow creep-in that keeps a held shot from reading
  as a freeze-frame, and how long the operator yields after a drag.

Everything applies as you drag and is remembered in your browser — except the
operator on/off, which comes back on after a reload so a switched-off camera
can never be mistaken for a broken one. Press **Copy values** and paste the
block into the project thread, and the numbers become the defaults in
`SHOT_FRAMING`.

### You can still grab the camera

The orbit keeps working during an episode. The director listens for
camera-controls' own `controlstart` / `controlend`, and while a hand is on the
camera — drag or scroll-wheel — it touches nothing at all, so the drag is not
fought. `SHOT_FRAMING.handBackAfter` seconds after you let go it eases (never
snaps) back out of your pose into whatever shot the show is on by then. This is
the same handshake the tripod prop's own lens already used.

It also yields completely between episodes, while the board holds a shot, and
if `enabled` is turned off — which gives back the single fixed shot the set had
before any of this. Mobile keeps its own framing; all of this is the desktop
set.

Worth knowing: while the viewer holds the camera it gets the orbit's normal
polar limits back (so it can't be dragged under the floor), and while the
director holds it those limits are opened right up, because the singles sit
almost level with the guests and the normal ceiling would tip them upward.

---

## Where is everything, from a terminal

```bash
npm run lt                        # every episode, both shows
npm run lt -- morality-02       # one, in detail
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
| `npm run lt:room` | the writers' room: talk an episode or a pitch over |
| `npm run lt:audio` | record an episode |
| `npm run lt:split` | cut the two tracks into the SitePal clips |
| `npm run lt:slate` | put a recorded episode on the guide |
| `npm run lt:rename` | move a staged episode to another show or number |
| `npm run lt:remove` | take an episode off the guide, or delete it |
| `npm run lt:test` | run every check |

Arguments go after `--`, as in `npm run lt:roundtable -- --topic morality-02`.

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

Two shows share the set and the pipeline. They differ only in where the
script comes from:

| | LT Weekly News Recap | Markets & Morality |
|---|---|---|
| Starts from | a week of market signal | one idea |
| Script from | `lt-news-brief.mjs` → `lt-news-script.mjs` | `lt-rt-script.mjs` |
| Topics from | the feeds, verified against real articles | the slate's own running order, or `--theme` |
| Segments | 7, built around three stories | 6, built around one argument |
| Chiron | yes | no |
| Clip prefix | `lttv_news_ep<NN>_` | `lttv_mm_ep<NN>_` |
| Length | 5–10 min | 4–9 min |

**Seeing the "New episode" badge.** An episode is badged in the guide for a
week after its air date, which means the badge is invisible whenever nothing
recent is on the slate — and it is the one part of the guide you cannot check
by looking. Add `?preview=new` to the /trade URL to turn it on for every listed
episode. It is display-only, and nobody sees it without typing it.

**Why the code still says "roundtable".** The roundtable is the FORMAT — two
seats, six segments, one argument — and Markets & Morality is that format
under its own banner. A third channel, The Liminal Terminal, carried the same
format until Michelle took it off the guide on 2026-09-21; its episodes moved
across to Markets & Morality. So `SHOW_FORMATS.roundtable` and
`scripts/lt-rt-script.mjs` keep the name of the shape, while `shows.json`
carries the two channels a viewer sees. Write an episode with `npm run
lt:roundtable -- --topic morality-01`; the show comes from the episode's own
id, and `--theme`, which has no id to read, defaults to Markets & Morality.

Everything after the script is the same for both: `lt-tv-edit.mjs` to revise,
`lt-tv-audio.mjs` to record, `lt-tv-check.mjs` to verify. One `assemble()`
builds every record, so a validation one show gains, both gain.

They all end the same way: two balanced WAVs uploaded to SitePal, a record on
the slate, and a lead-in tuned by ear.

**Moving an episode to another show, or renumbering it.** An episode's id is
`<show>-<NN>` and it is not a label, it is the path: the working record is
`content/lt-tv/episodes/<id>.json`, the screenplay is `<id>.txt`, and every WAV
the audio build writes lands in `content/lt-tv/audio/<id>/`. Move one by hand
and you will move some of them, which fails silently: the next Record or Split
writes a SECOND episode under the old id, beside the one you meant to move. So:

```
npm run lt:rename -- roundtable-02 morality-01 --dry-run   # show what would move
npm run lt:rename -- roundtable-02 morality-01
```

It moves everything or nothing, and refuses if anything already sits under the
new id rather than merging the two. It does **not** rewrite the SitePal clip
names in the record, which is deliberate: a record names whichever clips EXIST
in the account library, and those were uploaded under the old id. The naming
convention is for a new upload. The Wealth Effect is on air right now as
`morality-01` playing `lttv_rt_ep02_*`, and that is correct.

It also does not touch `src/content/lt-tv/` — the committed slate. That half is
a git rename plus an edit to `index.js`, and it belongs in a commit.

**The same episode showing up twice.** That is what the half-done move looks
like: the guide has it under the new id and a working copy is still sitting
there under the old one, with the same title on it. The studio says so on the
stray row and offers **Move it to `<id>`**, which is the rename above. It only
offers it when exactly one episode on the guide can be meant — two candidates,
or none, and it says nothing rather than moving a recording to the wrong name.

**Taking an episode down.** Two strengths, because they are two decisions:

```
npm run lt:remove -- morality-01 --from-guide    # unlist it, keep the files
npm run lt:remove -- morality-01 --everything    # and delete them
npm run lt:remove -- morality-01 --everything --dry-run
```

`--from-guide` removes the record the guide reads and its import from
`index.js`, and leaves the script, the recording and the pitch alone — so
**Put it on the guide** puts it back. That is the one to use while you
re-record an episode. `--everything` is that, and then the working record, the
screenplay, the recorded audio, the pitch and the writers'-room conversation;
none of it is in git, so it cannot be undone by a checkout. Both are in the
studio at the bottom of an open episode, under **Taking it down**, and both ask
first.

Neither touches SitePal — the clips stay in the Audio Manager — and neither
touches `shows.json`: removing a CHANNEL is a different act from removing an
episode. `--from-guide` and `--everything` both change files git tracks, so the
run says which, and that checkout then differs from `main` until the same
removal is made there.

**Re-recording an episode** needs none of this. Open it and press **Record it
again**; every line already on disk with the same words is reused, so it often
costs nothing. Take it off the guide first only if you do not want it playing
on /trade while you work.

---

## Making a news episode

Full detail: `docs/lt-weekly-news-workflow.md`.

On the studio page the week runs left to right under the show's heading:
**Pull the week**, then **Pitch this week**, then **Write it from this pitch**.
The pitch is the step worth having — it is the editorial judgment on its own,
before there is a script to throw away. From there the episode appears on the
slate and every later step is a button on it, exactly as for the roundtable.
From a terminal:

```bash
# 1. Pull the week. Check `degraded` in the output is empty or harmless.
npm run lt:brief

# 2. Pitch it. One Claude call: it picks the three stories and confirms every
#    number against a real article, then stops. Read what comes out.
npm run lt:news -- --brief content/lt-tv/briefs/news-2026-W38.json --rundown-only

# 3. Write the dialogue from the pitch you approved. It is used as it stands;
#    the editorial pass does not run again.
npm run lt:news -- --brief content/lt-tv/briefs/news-2026-W38.json \
                   --rundown content/lt-tv/plans/news-2026-W38.json
```

There is still a **Write it in one go, without pitching** button, and
`npm run lt:news -- --brief <f>` with no other flag is still that run — both
passes, straight to a first draft. Use it for a week you do not want to think
about. See **The pitch** below for what the outline holds and how to argue
with it.

Now **read the `.txt` screenplay** before spending any audio money. Does each
story carry a real number? Does GR80 get a line worth hearing? Is
`rundown.stories[].gaps` empty — anything in it is unsourced. Spot-check the
numbers against `sources`.

The `.txt` is the thing you edit, not a printout of the record. Reword lines,
add them, delete them, change who a line is aimed at, then apply what you
wrote. No model call and no audio call, so revise here until it reads.

```bash
npm run lt:edit -- news-01
```

The format explains itself at the top of the file; `docs/lt-weekly-news-workflow.md`
has the detail.

```bash
# 3. Confirm it landed on the slate cleanly (it will say "not recorded yet").
npm run lt:check

# 4. Build the audio: every line rendered on its own, in its own voice, and
#    both character tracks laid out on one timeline. Then listen to
#    master-dialogue.wav, which is the two tracks played together.
npm run lt:audio -- content/lt-tv/episodes/news-01.json

# 5. Cut the two tracks into the clips SitePal will accept (it stops at 90s).
#    The studio's "Split it into the two tracks" button runs exactly this.
npm run lt:split -- news-01

# 6. Put it on the guide. Run this AFTER the split, which is what works out
#    the section boundaries the guide needs.
npm run lt:slate -- news-01
npm run lt:check   # should now report a runtime
```

Step 6 is a join, not a rebuild, and that distinction is worth a sentence
because getting it wrong is expensive. **Never re-run the generator to refresh
a recorded episode.** `lt-news-script.mjs` and `lt-rt-script.mjs` write an
episode from scratch every time, so re-running one spends two model calls,
overwrites the screenplay you edited, and clears the timing you just paid to
record — leaving the guide saying *Not recorded yet* over perfectly good
audio. It would also throw away the section cuts step 5 just worked out.

Every line is a separate render, so what to listen for is the **gap between
lines** — the recording places it, and `LT_TV_LINE_GAP` in `.env.local` tunes
it — and whether a reply lands with the right energy, which now comes from the
`[tags]` on the line rather than from the model having heard the line before.
See *How the audio is made* below.

**If ElevenLabs refuses the format** — `Output format 'pcm_44100' is only
available on the Pro tier` — that is the plan, not a fault. 44.1kHz PCM is the
only part of this that needs Pro. Every lower rate is allowed on every plan and
the pipeline works identically at one, because the layout is exact at any rate
and a line's length is still a byte count. Put this in `.env.local` and
restart:

```
LT_TV_PCM_RATE=24000
```

24kHz carries 12kHz of bandwidth, which is more than a speaking voice uses, and
SitePal re-encodes the upload anyway. Lines already recorded at another rate
are re-recorded rather than reused, because reusing them would place every
later line wrong — so change the rate before starting an episode, not part way
through.

Then upload and test — see the two sections below, which are the same for both
shows.

---

## What is on screen during a news episode

The news show has a full cable-news package over the set, and none of it is
typed by hand: every word of it is copy the script pass already wrote.

**The lower third** — the headline bar next to the spinning logo cube. It
follows the running order. In the cold open it carries the episode's own
headline; when the lead story starts it cuts to a plate naming the beat
(`MACRO`, `CRYPTO`, `COLLECTIBLES`) and that story's headline; on the board it
reads *The week in numbers*; on the sign-off it goes back to the episode
headline.

**The ticker** — the crawl underneath. It carries a few items about tonight's
stories and then **the sidebar: headlines from the week's brief that the
episode is not covering**, which is what makes it read like a real newscast
rather than a repeat of the segment you are watching. It always ends with
*Nothing on this ticker is a recommendation*, appended by the pipeline rather
than written by the model, so it can never go missing.

**The screen behind the hosts** — a card per chapter, drawn in type: the
running order in the cold open, the beat and the story's one concrete fact
while a story runs, the board's numbers listed out when the hosts read them.

### Where the copy comes from, and how to change it

| On screen | Comes from | Change it by |
|---|---|---|
| Episode headline | `rundown.headline` | `CHIRON:` in the screenplay, then `npm run lt:edit` |
| A story's plate and headline | that story's `beat` and `headline` | editing the record, then re-staging |
| The screen's story card | that story's `fact` | as above |
| The board card | `rundown.board.lines` and `.market` | as above |
| The ticker | `rundown.ticker` + `rundown.sidebar` | as above |

The chapters that drive all of it are **derived at staging time** by
`npm run lt:slate` from the production record's segments and rundown. They are
anchored on a **line number**, never on a second, which is the point: every
absolute time in an episode is rewritten when it is re-recorded, so a chapter
holding a timestamp would silently drift out of step with the show it labels —
and that reads on screen as a mistuned lead-in rather than as a graphics fault.

### An episode recorded before any of this existed

It picks the graphics up by being **re-staged**. That is step 6 on its own,
and it is free — no model calls, no rendering, nothing overwritten:

```
npm run lt:slate -- news-01
npm run lt:check
```

Its ticker will not gain the sidebar items, because nobody asked for them when
the script was written. Everything else — the chapters, the screen cards, the
plates — comes from segments and a rundown the record already has.

If the check reports `graphics.chapters[n] starts on line N, which doesn't
exist`, the slate record is older than the script it was made from: re-stage it.

---

## Making a roundtable episode

Full detail: `docs/talk-show-production.md`.

The roundtable does not start from anything that happened. It is one argument
about one idea, so there is no brief step — the topics are the episodes already
named on the slate.

```bash
# 1. See what is waiting. Five episodes were titled long before there was any
#    way to write one; these are the queue.
npm run lt:roundtable -- --list

# 2. Pitch the argument. One Claude call, and it stops: the question, both
#    cases, the hard case, who concedes. This is the part worth arguing with.
npm run lt:roundtable -- --topic morality-02 --plan-only

# 3. Write the dialogue from the argument you approved.
npm run lt:roundtable -- --topic morality-02 --plan content/lt-tv/plans/morality-02.json
```

`npm run lt:roundtable -- --topic morality-02` on its own still does both
passes in one run, which is the **Write it in one go** button on the page.

An episode already on the slate **keeps the title and summary it was given** —
the generator writes the argument, not the running order. Pass `--retitle` if
you want the model's title instead, or `--theme "..."` to write an episode that
is not on the slate yet.

Then read and revise exactly as you would a news episode:

```bash
npm run lt:edit -- morality-02
```

What to look for is specific to this show: **both of them have to be right
about something.** Connor's case should be one a thoughtful person would make,
not greed wearing a hat, and the hard case should cost them both. If GR80 wins
every exchange you have a sermon, and the fix is in the script, not the audio.

```bash
# 3. Record it — the same audio build the news show uses.
npm run lt:audio -- content/lt-tv/episodes/morality-02.json
```

From here it is the same tail as the news show — steps 5 and 6 above, then the
shared sections below:

```bash
# Cut the two tracks into the SitePal clips.
# It ends by printing which file to upload under which clip name.
npm run lt:split -- morality-02

# Then, once they are uploaded, put it on the guide. After the split, so the
# section boundaries come with it.
npm run lt:slate -- morality-02
npm run lt:check -- morality-02
```

Then upload, tune the lead-in and test.

`content/lt-tv/samples/morality-01.draft.json` is a worked example, written by
hand to show the format and the two voices. **Its argument is invented** and it
is not a scheduled episode.

### The older hand-written path

`elevenlabs-dialogue-test/run_test.sh` still works and is how roundtable 01 was
made: write the turns into `dialogue.json` by hand, generate in one call, and
finish `output/episode-record.json` yourself. It is the right tool for a one-off
that does not belong on the slate. For an episode of the show, prefer the
generator — it numbers the lines, validates the cues and puts the record on the
guide, all of which that path leaves to you.

It renders both voices in ONE call, with text-to-dialogue, and then cuts the
result apart by character with `process_dialogue.py`, which needs ffmpeg. That
cut is placed from ElevenLabs' reported line times, and on The Wealth Effect
those were a phrase out, which is why the show no longer records this way — see
*How the audio is made* below. It is still the only way to reprocess an
archived response, and `npm run lt:split` still runs it for a folder that holds
a two-voice master and no `render.json`.

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

Both characters are cut at the same instants, so the two tracks stay locked to
each other, and a cut is placed for the SILENCE around it rather than wherever
the arithmetic runs out. That matters more than it sounds: a join is always a
pause, because SitePal has to stop one clip and start the next, so a boundary
inside a sentence is heard as a fault.

**The pauses are the ones the recording placed.** Every line is rendered on
its own and the gap in front of it is silence this pipeline put there, so the
cutter knows exactly where every pause is without measuring anything, and a
join always lands in the middle of one:

```
  section 1  0:00 – 1:15  (76s, lines 0–13)  cut in 0.70s of silence
  section 2  1:15 – 2:39  (83s, lines 14–29)  cut in 0.45s of silence
  section 3  2:39 – 3:52  (74s, lines 30–43)

  Pauses in the audio: 43 found, median 0.45s, shortest 0.45s, longest 1.50s.
  43 are wide enough to cut in (0.25s or more).
```

The cut itself is byte arithmetic on the WAV, the same instant for both
characters. Nothing here needs ffmpeg.

**To put a join somewhere else, write `# cut` on its own line in the
screenplay** where you want it, and split again. The line numbers in the report
above are the screenplay's own, so a join that sounded wrong can be moved
without working out which line 2:46 falls in. A mark is not an edit — it
changes no words — so it does not need applying and works on an episode that is
already recorded. Applying edits re-renders the screenplay and clears the
marks, so mark cuts after the words are settled.

If a single line is ever longer than the limit there is no pause to cut in at
all, and the split step says so rather than producing a clip that silently will
not play.

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

## Pauses (both shows)

**Write `# pause 1.5s` on its own line in the screenplay, just above the line
it should come before, then record.** That is exact silence, the same length
every run. Anything from `0` to `10s`.

ElevenLabs cannot do this for us: its `<break>` tag does not work on
`eleven_v3`, the model that performs the `[tags]`. It does not need to. Every
line is rendered on its own, so every gap between lines is silence this
pipeline lays in, and a `# pause` simply sets the length of one of them. It
can go in front of **any line**, it has no three-second ceiling, and it cannot
change how a line is read.

Without a mark, the gap in front of a line is `LT_TV_LINE_GAP` (default
`0.45s`) inside an act and `LT_TV_ACT_BEAT` (default `0.7s`) between acts.
Both are settings in `.env.local`, and the line gap is the one to tune by ear:
shorter reads as interruption, longer as a beat. Changing either is free — no
line is re-rendered for it.

For a beat that just needs to *sound* like a beat, v3 has its own tags —
`[pause]`, `[short pause]`, `[long pause]` — and an ellipsis inside a line adds
weight. Those are part of the performance and are not a measured length. Use
them for reading; use `# pause` when the silence itself is the joke.

**On an episode that is already recorded, add the mark and press "Record it
again".** A pause is silence laid into the tracks, so it only exists once the
episode has been through the recording step — which reuses every line already
on disk, so it costs nothing. Split, upload and put it on the guide again
afterwards, as usual. ("Apply my edits and clear the audio" is the wrong button
here — it refuses when no words changed, and it rewrites the screenplay, which
wipes the marks.)

### What that actually costs

**"Record it again" always warns that it spends an ElevenLabs render, because
the button cannot know whether it will.** What gets sent depends on which lines
are already on disk with the same words in the same voice. The run's first
line of output says how many it is sending and how many are already on disk,
before anything is sent.

To see that line by line without running anything,
`npm run lt:audio -- content/lt-tv/episodes/<id>.json --dry-run` prints what
would be reused, what would be sent and how many characters that is. It
contacts nothing, needs no API key and ends with "Nothing has been spent".

What does and does not cost a render:

| | |
|---|---|
| changing or adding a pause | free — silence is laid in, never rendered |
| `# take 2` on a line | that one line |
| changing `LT_TV_LINE_GAP` or `LT_TV_ACT_BEAT` | free |
| rewording a line | that one line |
| deleting or reordering lines | free — a recording is filed by its words, not its number |
| adding a line | that one line |
| changing a character's voice | every line that character speaks |
| changing `LT_TV_PCM_RATE` | everything, at the new rate |

ElevenLabs bills by the character, so an episode costs the same whether it is
sent as forty lines or four blocks; what changes is that a fix costs a line.


Like `# cut`, a pause mark changes no words: it needs no applying and works on
an episode that is already written. Applying edits re-renders the screenplay
and clears both kinds of mark, so mark them once the words are settled. A mark
the recording cannot place — a line number that isn't in the episode, or one in
front of the very first line — is named in the output rather than ignored.

---

## How the audio is made (both shows)

**Every line is rendered on its own, in its own voice, and the two character
tracks are laid out by arithmetic.** `lt-tv-audio.mjs` sends one
text-to-speech request per line (`eleven_v3`, so the `[tags]` still perform),
trims the silence ElevenLabs pads each render with, and places the lines end to
end with the gaps described under *Pauses*. Each character's track is silence
the length of the episode with that character's lines copied in; the master is
both tracks summed. No ffmpeg, no silence detection, nothing measured.

**Why.** Each SitePal avatar lip-syncs whatever is in its own clip, so a track
must hold one voice and nothing else. Until 2026-09-21 the episodes were
rendered as blocks of conversation with both voices in one file, using
text-to-dialogue, and then cut apart by character at the line times ElevenLabs
reports. Those times are a division of the text, not a measurement of the
audio — they tile, and the per-character *alignment* the response also carries
tiles the same way and lands on the same instants. On The Halo Effect they
happened to be right to a tenth of a second. On The Wealth Effect they were a
phrase out at the ends of Saint GR80's lines, five different ways of searching
around them all failed, and every one put a fragment of his voice in Connor's
mouth. A line rendered alone can only ever be in one track, so the class of
bug is gone rather than patched.

**What it costs.** The model no longer hears the other character's line while
performing a reply, so an exchange leans more on the `[tags]` in the script —
put one on most replies, not a few. Each line is sent cold: ElevenLabs has
context fields for the neighbouring lines, but refuses them for the v3 model
("not yet supported"), and v3 is the model that performs the tags. Michelle
chose this trade on 2026-09-21.

**What it gives.** A pause anywhere, exact. Section cuts that always land in a
gap. Re-recording an edited line costs that line. And the whole recording step
is arithmetic that `scripts/lt-tv-audio.test.mjs` checks byte by byte — the
tracks never overlap and always sum to the master, by construction.

**Show me where the cuts went** in the studio prints every line with who says
it, where it sits, and the pause in front of it.

The kept renders live in `content/lt-tv/audio/<id>/lines/`, one `.pcm` and one
`.json` per line, filed by a fingerprint of the voice, the words, the model and
the rate. `render.json` beside the tracks records the layout; it is what tells
the split step there is nothing to cut apart.

### The older two-voice path

`elevenlabs-dialogue-test/process_dialogue.py` still exists for archived
recordings made the old way: it splits a two-voice master by measuring the
silence around each reported line time, and `npm run lt:split` runs it for a
folder that holds a master and no `render.json`. It needs ffmpeg. Its boundary
arithmetic is covered by `elevenlabs-dialogue-test/test_boundaries.py`, which
also pins down, against the archived July response, why the alignment cannot
help — so that idea does not come back.

---

## Adding a character, rotating the cast, or a guest (both shows)

**Short answer to the model question: a separate GLB, one file per character —
not inside `newsDesk.glb`, and not baked into the set. Done as of 2026-09-22:
the set is `LTTV_Set.glb`, Connor is `LTTV_Connor.glb`, GR80 is
`LTTV_GR80.glb`, and the scene attaches the characters into the set at load.**

`public/models/newsDesk.glb` is props only: the desk body, two neon strips, and
two each of coffee cup, microphone and laptop. No armature, no animation, and
**nothing in the code loads it**. The desk on air is the `NewsDesk` node inside
`public/models/talk_show3-textures.glb`, which is the one model the set loads. A
character added to `newsDesk.glb` would never appear.

So the real choice is *re-export the set model* or *ship the character on its
own*. Ship it on its own:

- **The set model is reached into by name, everywhere.** `Demon_Empty`,
  `Monk_Empty`, `Armature`, `Armature001`, `Face1`/`Face2`,
  `FaceDemon1`/`FaceDemon2`, `Brows`, `Demon_Brows`, all 31 baked clip names,
  `NewsDesk`, `Camera`, `Tripod`, `Camera_Screen`, `Content_Screen`, the
  spotlight bar, `Chair1_Color_1_0`, `Frame_Color_1_0`, `Floor`. Every
  re-export of that file puts all of it at risk for a change that has nothing
  to do with any of it.
- **It is 4.5 MB and everyone downloads it.** A character baked into the set
  is fetched on /trade whether this week's episode uses them or not.
- **A guest is then one file, not a new version of the set.** Ship it, cast
  them, and the set model never moves.

**How the scene does it.** `TalkShowScene.jsx` loads the set, loads each
character file, and adds the cloned character scenes into the cloned set. Each
character file contains exactly one root — their empty — under an identity
scene group, so attaching it puts them in the same place, under the same names,
as when the two shipped in one file. Every lookup by name in that file therefore
works unchanged, and a new cast member is an entry in `modelContract.mjs`
rather than an edit to the scene.

The one thing that *is* per-character is the clips: each mixer resolves its
actions against its own file's `animations` array. That is what stops a clip
being found in the wrong file, which is exactly how Connor went T-pose on
2026-09-22 — his actions were renamed `barron_*` to `connor_*` in his own export
while the scene was still loading the combined file, which only ever had
`barron_*`. Every lookup missed, no action was created, and a rig with no action
is a rig in its bind pose.

**Not yet: loading only this week's cast.** Every registered character is
fetched, not just the ones in the episode. `useGLTF` suspends on its argument,
so the list has to be stable, and a character who appears mid-episode would
otherwise pop in as a T-pose while their file downloads. What the split already
buys is that the set no longer carries anybody, so adding a fourth character
costs one file rather than a new version of the studio.

**Where they sit is code, not model.** Both seats are numbers in
`modelContract.mjs`, applied by the `newsMode` effect in `TalkShowScene.jsx`.
A third seat is a third entry there. What is NOT code is the furniture: the set has exactly two `DeskChair` nodes and the desk is
two wide. A third chair, mic, cup and laptop can be another separate prop GLB
placed the same way, or a re-export of the desk — but the desk is the only part
of this that genuinely needs Blender.

### Exporting the split: what goes in which file

**Take all three characters out of the set, and export each one at the position
they already sit in.** The set file becomes furniture only.

You have to re-export the set either way, because GR80 has to come *out* of it —
he cannot live in both the set file and his own, or he is drawn twice and his
clips load twice. Since that re-export is already paid for, do it once
completely: leaving Connor in means another set re-export the first time you
want an episode without him, or a different anchor, and it leaves the code with
a special case for Connor plus a general case for everyone else, which is where
the bug would be.

It costs nothing in duplicated textures. The characters share no materials with
the set or with each other — Connor's are `PolygonOffice_Charaters.*`,
`barron_hair`, `barron_eyes*`; GR80's are `MAT_01A.*`, `lambert1.001`; the set's
are none of those. And the win is real: of the 4.3 MB combined file, **1.9 MB
was animation data** (Connor's clips 571 KB, GR80's 1,296 KB) plus 340 KB of
GR80's textures. GR80 was the single heaviest thing in it and he is not in the
news show at all.

**What the split actually weighed, measured 2026-09-22.** Set 1.58 MB + Connor
1.53 MB + GR80 2.42 MB = 5.53 MB, against 4.31 MB for the one combined file.
So the news show (set + Connor = 3.11 MB) is a real win and Markets & Morality
is worse, for two reasons that are both in the export settings rather than in
the split: GR80's textures came out **PNG** (1.16 MB) where they had been WebP
(0.34 MB), and both files carry 16 clips where the show plays 8 (~0.7 MB each of
dead weight). Neither is urgent; both are a re-export away.

**Do not apply or clear a character's transform — but do not rely on it
either.** Exported at the origin a character sinks through the floor at the
middle of the set, so never zero it. But the transform in a character's own file
is only ever "wherever they were standing on whichever set was open in
Blender", which is not a statement about where they sit. The first split export
proved it: GR80 came out of the roundtable and landed exactly on his lounge
seat, and Connor came out of the news desk and was **55 cm** from his lounge
chair — the same export convention, one of them in mid-air.

So **both seats are pinned in `modelContract.mjs`** and a re-export cannot move
them. What is on air:

| | position | yaw | scale |
|---|---|---|---|
| `Demon_Empty` (Connor), lounge | −0.803, 0.210, −0.302 | ~29.5° | 1.125 |
| `Demon_Empty` (Connor), news | −0.445, 0.422, +0.019 | ~29.5° | 1.125 |
| `Monk_Empty` (GR80), lounge | 0.950, 0.240, −0.361 | ~−3.4° | 1.081 |
| `Monk_Empty` (GR80), news | 0.533, 0.399, −0.050 | ~−3.4° | 1.081 |

Moving a seat for real is an edit there, and it needs no Blender.

**Two seats is not two models.** Connor sits in the lounge chair on Markets &
Morality and at the news desk on the news show, and that is one exported file
placed twice — a seat is a transform, not geometry. Checked against the set:
the two poses are the same facing and the same size (rotation agrees to about
0.03°, scale to one part in six thousand) and differ only in **where** he is
put. On the news set he slides in toward the middle and up onto the taller desk
chair: x −0.80 → −0.44, y 0.21 → 0.42, z −0.30 → +0.02.

`seat` in `modelContract.mjs` holds one entry per set per character, and
`SEAT_POSES` in `TalkShowScene.jsx` is built from it. The lounge used to be
deliberately unpinned, so a chair art-directed in Blender carried straight
through; that stopped being safe the moment each character became their own
file, for the reason above.

**The clips must travel with the character.** The set should have no animations
at all, and each character file must carry its own — `connor_*` with Connor,
`monk_*` with GR80. If the actions get left behind, the character loads, stands
in its bind pose and never moves, with no error. `npm run lt:models` is the
check.

**Connor's actions are `connor_*` as of 2026-09-22**, renamed in Blender from
`barron_*` — the last identifiers still carrying his old name. The note that
only a re-export could change them was right; this was that re-export. Durations
are unchanged, so they are the same actions under the current name.

**The news intermission.** `connor_news_intermission_head_turn` (46.70 s) is
the news set's resting state once an episode finishes, in place of the seated
idle: Connor turns away from the camera and sits it out, so the desk reads as a
studio between shows rather than as two people frozen mid-breath. **It loops**,
and it loops cleanly — measured off the file, all 126 channels end where they
started (rotation drift 0.00000, translation 0.00001), so there is no snap at
the join. Nothing has to end it; pressing play does, through `resetReactions`.

Declared as `outro` in the contract and **optional**: an export without one just
holds the idle, which is what every episode did before. Only the news show has
one, and it does not play on Stop or at a section join. Adding one for another
character is a single `outro` entry — and if a future clip does *not* end where
it starts, it wants `LoopOnce` instead, which is one line in the action-bank
effect.

**Check the export before you upload anything:**

```bash
npm run lt:models
```

It reads each GLB and says whether it carries what the code needs — the
character's empty, an armature under it, every clip, the two face meshes — and
whether the seat is where it was authored or got flattened to the origin. It
also lists any clip the file carries that the code does not use yet, with its
length, which is how a new animation gets picked up. The point is that none of
this is checked at load time: a renamed node or an action left behind in the set
gives you a character who loads, stands in its bind pose and never moves, with
nothing in the console. The names below are what it checks.

`src/lib/ltTv/modelContract.mjs` is the contract it checks against (the set is
`LTTV_Set.glb`; `newsDesk.glb` is the older desk-props-only export and is not
the set), and it is the file to edit when a character gains a clip or a seat
moves. **It is the only place a clip name or a model path is written** — the
scene derives both from it, and `scripts/lt-tv-models.test.mjs` fails if a
second copy appears, because two copies of a clip name is precisely what put
Connor in a T-pose.

**Keep these names.** The face projection finds what to hide and what to paint
by name:

- Connor: `Demon_Empty`, `FaceDemon1`, `FaceDemon2`, `Demon_Brows`
- GR80: `Monk_Empty`, `Face1`, `Face2`, `Brows`

**The armature name no longer matters.** GR80's is `Armature.001` *only* because
Connor's `Armature` is in the same Blender file and Blender disambiguates the
collision; exported alone it would come out as `Armature`, and the code used to
look for `Armature001` and find nothing — costing the mixer and the head bone,
so he would load in his bind pose, never move and never get looked at, with no
error. `findRig` in `TalkShowScene.jsx` now falls back to whatever armature is
actually under the empty and logs what it used, so either name works. This is
the one thing in the old contract you can stop worrying about.

### Adding one, as it actually went

**Holly Jones**, the news co-anchor, was added on 2026-09-22 and is the worked
example. Her actor key is `Holly`; her model's own names are `Hologirl_Empty`
and `hologirl_*`, which is the same arrangement as Connor's `Demon_Empty` —
those are strings inside a GLB and renaming them in code only breaks the
lookup. `HoloGirl` was her placeholder key for the hour between her model
landing and her being named, and was renamed the moment she had a name, while
no record cast her and it was still free. (There is also a *different* HoloGirl
in this repo: `Vendor_HoloGirl.glb`, the commercial strip's vendor.)

**Every
name and number in her entry was read off the export, and three of them would
have been wrong if assumed:**

| Assumed | Actually |
|---|---|
| `HoloGirl_Empty`, matching the filename | `Hologirl_Empty` — lowercase g, while the FILE has a capital one |
| `Armature`, like the other two | `Root` |
| `mixamorig:Head` | `head` — her skeleton is an Unreal-style one throughout (`Pelvis`, `spine_01`) |

So the first step is always:

```bash
npm run lt:models -- public/models/LTTV_Whoever.glb
```

which prints the single scene root with its transform, the armature under it
**under the name GLTFLoader will give it** (`Armature.001` → `Armature001`),
every clip with its duration, the face meshes, and what it collides with.

**The head bone is named per character, not matched.** It used to be found by
testing every bone against `/^mixamorighead\d*$/`, which worked while every
character was a Mixamo rig. A missing head bone is quiet and costs two things
at once: the character never turns to whoever is speaking, and the camera has
no head position to frame them by, so the shot solver falls back on the desk.

**Her seat came from her own export, not from GR80's numbers.** She is a
different body — 0.846 scale against his 1.081, and turned about 41° toward the
middle where he is turned 3°. Copying his seat would have been a wrong answer
that looked like a right one.

**`hologirl_sitting` arrived with no bone animation**, three channels on her
empty and nothing else, where her gesture clips carry 168 each. As a base idle
that plays as the rig's **rest pose for the whole episode** — the same silent
bind-pose failure as a missing clip, reached from the other direction. It is
also worse than it sounds: the mixer is rooted at the armature and the empty is
the armature's *parent*, so those three tracks cannot even resolve, and nothing
is logged. `npm run lt:models` now fails on a base clip that animates no bones,
and warns on one under a second, which holds a pose rather than breathing.

### Holly's register, and where it came from

**She was already written.** She is the promotions hologram at the prize wheel
on the boardwalk (`promos` in `src/lib/vendorSitePal.js`) — **the same
character on the same ElevenLabs voice**, so her existing lines are the
reference for how she talks, and the news writer quotes four of them for
register rather than for content.

What came out of reading them, beyond "droll":

- **She uses no contractions.** "I do not", "it is", "you have" — never the
  short forms. It is in every line she has, and it is what makes her read as a
  machine speaking carefully rather than as a person being stiff.
- She delivers a joke exactly as she delivers a number: flat, unhurried, with
  no signal that one is coming. Usually a plain statement and then a drier
  second sentence.
- She is matter-of-fact and funny about being a projection rather than a
  person, and honest about her own motives, which is where most of the humour
  is.
- **She is not the conscience of the show.** That is GR80's job on the other
  programme. She states the part Connor left out and does not argue.

Her crop and filter were copied from her fitted vendor values rather than
seeded from GR80's, which carried two things over that would have taken a while
to find by eye: her crop box is much tighter (cropH 154 against ~205), and she
gets **no sepia**, because she is a projection and a warm cast reads as grime
on a screen that should look backlit.

**Which face layer the projection lands on was settled the same way.** She has
three (`Face1`, `Face2`, `Face3`) plus two eye planes, and the working vendor
config projects onto **Face2** and hides the rest. `Face3` is the same mesh in
both files — 132 vertices in each, where Face1 and Face2 differ slightly
between exports — so what is true of it there is true of it here. And whichever
layer is the target, the other two have to be hidden, or she wears two faces at
once.

### Each show casts its own two people

The cast split lives in the **writers' prompts** as much as in the set, and a
prompt is the part with no type checking. What a writer emits is an actor
*name*, which lands in a record and is what the set looks up a seat, a rig and
a voice by — so a name left behind in one string produces lines for a character
who is not on that set, and reads as a cast decision nobody made.

GR80 was named all through the news writer until 2026-09-22, in the character
list, the beat pattern, the delivery tags, the cue list, the ad break and the
JSON schema. He is now out of it and Holly is in, **and she opens each story**,
because she has the running order and Connor does not. `NEWS_ACTORS` and
`MORALITY_ACTORS` are exported from the two writers and pinned by
`lt-rt-script.test.mjs`, which is also where the two shows' seam is tested.

### Who is on which set, and who is seen

**A character with no seat on a set is not on that set.** That is the cast split
expressed as geometry rather than as a rule someone has to remember: GR80 has no
business in a news episode and the co-anchor has none in the roundtable, where
there is no third chair for her anyway.

On top of that, **a character is only seen if the episode casts them.** The
audio, the readiness and the section tallies already worked this way; now the
bodies do too. Three conditions, in order of how firmly they say no:

1. the lineup wants empty chairs, so nobody is in them;
2. a character with no seat on this set has nowhere to be on it;
3. otherwise it is the episode's cast — no lines, not in the episode.

An episode with no audio yet names nobody, and then everyone with a chair here
sits in it, which is what you want while dressing a set.

This is why GR80 still has a news seat: `news-01` is on air and casts him. It
is the cast that takes a character off a set, not the seat.

### One copy of the reaction table

`reactions` in `modelContract.mjs` carries each cue's clip name **and its
authored length**, and everything else derives from it: `REACTION_DURATIONS` in
`TalkShowScene.jsx`, `REACTIONS` in `lt-tv-format.mjs` (what the writers are
offered) and the cue list in `lt-tv-check.mjs`. Those were three hand-maintained
copies, each with a comment asking the next person to keep them in step — and a
third character was about to be added to all three. A list that disagrees with
the rig is a cue that does nothing on screen.

It matters immediately: Holly has **two** gestures (`headnod` →
`hologirl_agreement`, `headshake` → `hologirl_disagreement`) where the other two
have six and seven, so the writers' prompt has to be built from this rather than
from prose about what a character can do.

### What a character is, as a list of entries

| Where | What |
|---|---|
| `CAST`, `scripts/lt-tv-format.mjs` | actor, display name, ElevenLabs voice id, processor key, clip key, role |
| `REACTIONS`, same file | which reaction clips the rig actually has — a cue naming one it doesn't T-poses |
| `DELIVERY_TAGS`, same file | the bracketed tags that read well in that voice |
| `CHARACTERS`, `src/lib/ltTv/modelContract.mjs` | the GLB path, the empty's name, its armature, the base idle, the reaction clip names, an optional play-out, and both seats. `CHARACTER_CLIPS`, `EMPTY_FOR_ACTOR` and `SEAT_POSES` in `TalkShowScene.jsx` are all built from this |
| `REACTION_DURATIONS`, `LISTENER_GAZE_YAW`, `TalkShowScene.jsx` | one entry each |
| `TALKSHOW_PROJECTION_CONFIG`, `TalkShowScene.jsx` | the SitePal scene id, an embed `hash` if the scene has one, the static/projection mesh names, a crop and a filter. **Fit live at `/trade?tune=sitepal`** — the panel builds its tabs from this registry, so a new character gets one for free. The crop will be wrong until it is fitted: the meshes have their own UVs, so seeded values do not transfer |
| `LISTENER_GAZE_DEGREES`, `TalkShowScene.jsx` | how far they turn toward whoever is addressing them. Live from `window.__tsGaze`, because it is a number about a picture — the existing values are an empirical fit per rig and their signs do not even agree, since the head bones do not share a local basis |
| SitePal account | **a scene of their own.** The two we have reuse the temple's Monk and Demon scenes; a third character needs a third scene. Account work, not code. |
| `SPEAKERS`, `process_dialogue.py` | only if you ever use the older two-voice path |
| The writers' prompts | see below — this is the part that is writing, not configuration |

### Rotating the regulars

**Nothing to configure per episode: an episode casts whoever has lines.** Leave
every character in `CAST`, write an episode that only two of them speak in, and
the record names those two. The set counts the record's cast, plays two clips a
section, and the third character's portal sits idle.

That is true as of 2026-09-21 and it was not true before, in a way that would
have looked like a hang rather than a bug: every tally on the set counted the
*registered seats*, so a character in the cast list with nothing to say left
the arm, the audio-started and the talk-ended counts one report short — and
`finishSection()` never ran. The episode would have sat on section one until
someone pressed Stop. The record's `cast` block was the whole roster too, so
rotating someone out would have rendered a silent track, asked for an upload
that should not exist, and put a clip name in the record the set then waited on.
Both now come off who actually spoke (`episodeCast` in
`src/lib/ltTv/episodeTimeline.mjs`; `scripts/lt-rt-script.test.mjs` pins it).

One residual cost: a character who is in `CAST` but not in this episode still
gets a SitePal portal built at set load, which costs a renderer and its share of
the one-off "Loading voices…". Making the portals follow the episode's cast
instead would save that, and would cost an ~18s portal rebuild on every episode
swap — which is why the portals currently outlive an episode change. Not worth
it for a cast of three; worth revisiting at five.

### A guest, or a new anchor

**A new anchor replacing Connor is much cheaper than a third seat.** Same two
chairs, same two poses, same desk: a `CAST` entry, a SitePal scene, and a
character GLB or a re-skin of an existing one. No Blender work on the set at
all.

**A guest for one episode** is the same list, and the face is what carries
identity — the face is a SitePal scene projected onto a mesh, not a sculpt. So
the cheapest producible guest is an existing body with a new SitePal scene on
it.

### The three things a third seat still needs

1. **Who turns to whom.** With two in the room the listener is simply the other
   chair, and `LISTENER_GAZE_YAW` is one fixed angle per character. With three
   the angle depends on *which* of the other two, so that table becomes
   per pair. The record format is already ready for it:
   `buildEpisodeTimeline` honours a `listeners` entry per line when the record
   carries one, and only falls back to "the other chair" when it doesn't. The
   writers don't emit `listeners` yet.
2. **The writers' prompts.** `scripts/lt-news-script.mjs` and
   `scripts/lt-rt-script.mjs` say "two characters" in prose, carry one
   personality paragraph each for Connor and GR80, and set a beat pattern that
   is a two-way volley (*Connor states the number → GR80 reframes it → Connor
   pushes back → GR80 lands the button*). A third voice needs a paragraph of
   their own and a beat pattern that gives them something to do, or they will
   be written as decoration. This is the real cost of a third character and it
   is writing, not plumbing. The paragraphs belong in `CAST` as data so a
   character is one entry rather than an edit in two files — deliberately not
   done yet, because moving them changes the prompt the approved voice came out
   of.
3. **The phone, which is untested.** Two SitePal renderers plus two per-frame
   canvas crops is the load that crashed iOS Safari on this page before, which
   is why mobile paints one face per frame (`SOLO_LISTENER_EVERY_NTH`). A third
   renderer is a real risk and there is no way to know from a desktop. The
   hidden portal row's width is now counted from the cast rather than written
   down as 1200px, so a third portal is at least inside the viewport — a portal
   outside it is what WebKit throttles to ~0.1fps, which reads as a frozen face
   over playing audio.

The camera needs nothing: it aims at whoever's head the shot names, and the
shot list is built per speaker. Only the two-shot's framing (`wideFov` 50, fitted
to hold two guests and the neon frame) wants a pass with three in it.

**Recording cost** is per line, not per episode, so a third character costs only
their own lines. Uploads are one clip per character per section: three
characters over a six-minute news episode is 18 clips instead of 12.

---

## Changing a character's voice (both shows)

This is which ElevenLabs voice speaks. For how the character is *written* —
personality and tone — see [How a character talks](#how-a-character-talks--personality-and-tone-both-shows)
further down.

`CAST` in `scripts/lt-tv-format.mjs` is what gets rendered. (`SPEAKERS` in
`elevenlabs-dialogue-test/process_dialogue.py` only matters for the older
two-voice path, and must agree with it there.)

An episode's record also carries a copy of the voice id on every line, frozen
when the episode was written. **The recording step ignores that copy and uses
the cast's current voice**, then corrects the record to match — a voice belongs
to the show, not to one episode. It says so when it does:

```
Saint GR80 has a different voice now, so the record's fATgBRI8wg5KkDFg8vBd is being
recorded as bZ2WrEjNzHgFHfLLaFKQ. Anything already recorded in the old voice is redone.
```

That re-renders every line that character speaks, which is unavoidable: half
an episode in each voice is worse. The other character's lines are reused.

**Tracks recorded before the change cannot be cut afterwards.** The split step
says so and names "Record it again". If you instead want to keep an old
two-voice recording exactly as it is — an archived response from months ago —
process it with the voice it was actually made with:

```bash
python3 process_dialogue.py response.json output --voice gr80=<the old id>
```

No id in this history is wrong. Each is what some recording was actually made
with.

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

**Never test the set with the browser cache off.** DevTools' "Disable cache"
box (Network tab) and private windows defeat SitePal's preload by design: each
player fetches its clip again the moment it is told to speak, and the two
fetches race, so the characters start a section seconds apart and talk over
each other. That is what the roundtable 02 "overlap" was on the night of
2026-09-20: every file was correct, and it played perfectly the moment the
cache was on. If you have DevTools open, make sure that box is unticked. A
real visitor never has it ticked.

A hold of two or three seconds at each section change is normal. It is
SitePal's own start-up time for a clip that is already loaded, and both
characters wait for it together.

If you want numbers, after a section has played paste this in the console:

```js
JSON.stringify(window.__tsPlayed)
```

`spread` is how far apart the two voices began, in milliseconds. Under 100 is
good; hundreds means something is refetching.

When `talk_show.glb` is re-exported, bump the query version in `MODEL_URL` so
the browser does not keep the old animation library.

---

## How a character talks — personality and tone (both shows)

Two places set how Connor and GR80 sound, and they do different jobs.

**The character descriptions — who they are.** Each show carries its own
paragraph per character, in the writer's instructions:

- News: `scripts/lt-news-script.mjs`, under `THE TWO HOSTS` (the `CONNOR` and
  `SAINT GR80` paragraphs).
- Roundtable: `scripts/lt-rt-script.mjs`, under the same heading.

They are deliberately not shared, because the two shows want different men:
the news Connor treats the story as content, the roundtable Connor has to make
an argument a clever opponent would concede. Edit the paragraph for the show
you mean; the other one does not change. It is plain prose in a long string —
rewrite the sentences, keep the quotes and backticks around the block intact,
and it takes effect on the next script you write. Nothing needs rebuilding.

The same two files also hold the beat pattern (who speaks when, who gets the
last word), which is as much of the tone as the adjectives are.

**The house notes — standing corrections.** `docs/lt-tv-style-notes.md`. A
bullet under **Rules** is added to the writer's instructions on both shows and
both passes of each. Use this for a fault you keep seeing rather than a change
of character: "nobody says at the end of the day". See
[A line you don't like](#a-line-you-dont-like-both-shows) below.

Rule of thumb: if it is who the character is, it goes in the show's paragraph.
If it is a habit you want stopped, it goes in the house notes.

**The delivery tags** each character is allowed to use — `[dryly]`,
`[horrified]` and the rest — are a list in `scripts/lt-tv-format.mjs`
(`DELIVERY_TAGS`), shared by both shows. Adding one there makes it available
to the writer; ElevenLabs decides what it does with it, so a new tag is worth
one test line before it goes in an episode.

---

## The episode title (both shows)

The writer names the episode, and the first generated news episode came back
called **Hike Barrel Charizard** — one noun from each of its three stories in a
row. That is what a model does when the only instruction is a word count, so
the instruction is now the job: name ONE thing, the lead story or the mood of
the week, the way a channel guide would print it. Two to six words, title case,
no colon, and it has to read as English out loud. The rule lives in
`TITLE_RULES` in `scripts/lt-tv-format.mjs` and both shows are written against
it, so a title you dislike is a rule to change in one place.

**To name an episode yourself**, open it in the studio and type in the
**Episode title** box above the screenplay, then **Save** and **Apply my
edits**. The box is the screenplay's first line — the same line you could edit
by hand — so there is only ever one copy of the title, and applying is what
puts it on the guide. Emptying the box keeps the title the episode already had,
because a blank line there is a title half-retyped, not a nameless episode.

The roundtable works the same way, except that its titles were written by you
on the slate long before anything could generate one, so the generator keeps
them; `--retitle` is what lets it write its own.

## Acronyms — say what the letters stand for (both shows)

Nobody is reading the show. The first news episode said **FRED** four times and
never once said it is the Federal Reserve Economic Data database, which on air
is just a name nobody can look up. So an acronym is expanded the first time it
is spoken and used short after that, in the character's own voice and inside
the line rather than as an aside.

Both writers are told this, and because a prompt is a request rather than a
guarantee, the build checks it: an acronym spoken before anything expands it
becomes a warning naming the line, on writing and on every apply. The list of
acronyms, and the short list taken as read because expanding them sounds like a
lecture (the Fed, SEC, IRS, AI, FOMO), is `SPOKEN_ACRONYMS` and
`ACRONYMS_TAKEN_AS_READ` in `scripts/lt-tv-format.mjs`. Add to either as the
show runs into new ones.

## A line you don't like (both shows)

Four things you can do with a bad line, in rising order of effort. The fourth,
the writers' room, is the one for when you cannot name the line yet.

**Have it read again.** When the words are right and the reading is not (a
stray syllable at the head of a line, a flat delivery), write `# take 2` on
its own line just above it and press **Record it again**. That one line is
rendered afresh and kept as take 2; everything else is reused. Not happy with
take 2 either, `# take 3`. Remove the mark and the first take comes back. It
is a mark like `# pause`, so it needs no applying, and applying edits wipes
it. **Split** then compares every clip with the one it overwrote and says
which changed, so after one take you upload those and not all twelve.

**Rewrite it yourself.** Open the screenplay, change the words, then
**Apply my edits**. Nothing is spent and nothing else in the episode moves.

A recorded line is kept so a failed run resumes instead of paying twice, and
it is kept **by its words**, not by its number. Line numbers are positions —
they shift whenever a line is added or removed above them — so a recording is
filed under a fingerprint of the voice and the words, and a re-record after an
edit sends exactly the lines whose words changed, and says so as it starts.

Saving is not applying. **Save** writes the screenplay file; **Apply my edits**
is what reads it back into the episode, and recording renders the EPISODE. An
edit that is saved but never applied used to be recorded as the old words,
paid for, and mentioned nowhere — you found out by listening. **Record it** now
refuses to start while the screenplay is ahead of the record, and says which
button to press, so the worst case costs a click instead of a render.

**Ask for a new one.** Put a note under the line saying what is wrong with it,
starting with `#`, then press **Rewrite the lines I marked** — or
`node scripts/lt-tv-rewrite.mjs morality-02`:

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

## The pitch (both shows)

Both shows are written in two passes. The first decides what the episode IS —
which three stories and what the hosts disagree about, or what the argument is
and who concedes — and the second writes the dialogue from it. Until recently
only the second pass left anything a person could read, so the first time you
saw the editorial judgment was as six minutes of finished script, and
disagreeing with it meant throwing the script away.

The first pass is now a **pitch** you read first:

```
LT WEEKLY NEWS RECAP — PITCH FOR 2026-W39
"Patience, Clarity and Cardboard"

CHIRON: FED HOLDS — AND CALLS IT PATIENCE

1.  MACRO       FOMC holds, statement leans hawkish
    Fact:             The committee held rates steady for a second meeting…
    They differ on:   Whether a second hold is patience or uncertainty.
    Connor:           Nobody trades the decision, they trade the adjective.
    GR80:             Patience is a virtue the committee does not have to fund.
    Source:           Federal Reserve — FOMC statement, 17 September
```

It lands in `content/lt-tv/plans/` as JSON and as that outline, and the studio
page shows the outline: under the show's heading for the news week, in the
episode's own drawer for Markets & Morality. **Write it from this pitch** then
writes the dialogue from exactly what you read.

**A pitch is read-only on the page, and that is deliberate.** Every number in
it was confirmed against a real article in the pass that produced it, and the
article is named beside it. A text box would let a fact be reworded by hand,
and a fact reworded by hand is a number nobody checked being spoken in a
character's voice — which is the one failure this show cannot afford. So the
pitch is changed by talking to the writers' room under it, which is allowed to
move the judgment and refuses the evidence:

| it may change | it will refuse |
|---|---|
| the title, the summary, the chiron | a story's fact |
| what the hosts disagree about | its sources, or whether it is verified |
| either host's angle on a story | the board |
| the running order of the three stories | |
| any part of an argument: the question, both cases, the hard case, who concedes | |

Wanting a different story or a different number is not an edit, it is a
different pitch — which is one call, and the room says so rather than quietly
obliging.

A pitch that has already been written into an episode is locked: the
screenplay is the live thing from then on, and the pitch stays as the record
of what was agreed. It is listed in the episode's files at every stage, so an
episode on air can still answer "why did we cover that".

---

## The writers' room (both shows)

Everything above needs you to know which line is wrong before you can say
anything. Often you don't — the middle of story two drags, GR80 concedes too
early, the ending is soft. That is a conversation, so have one: open the
episode at `/lt-tv` and there is a **writers' room** under the screenplay.

The same room sits under a **pitch**, before a line has been written, and that
is the cheaper place to disagree. What it may change there is the table in
**The pitch** above; everything below is about an episode that has a
screenplay.

```
you     the middle of story two drags and I can't see why
writer  It's the third beat — Connor makes the same point twice, once with
        the number and once without it. Cut line 19 and let GR80 land on 18.
        Want me to?
you     yes, and give Connor the last word in that segment
```

The writer has the whole screenplay in front of it, numbered exactly as you
see it, and it is the same writer: the character notes and the show's rules
come from the generator that wrote this show (`SCRIPT_BIBLE`, shared out of
`scripts/lt-news-script.mjs` and `scripts/lt-rt-script.mjs`), plus the house
notes in `docs/lt-tv-style-notes.md`. It cannot describe Connor differently
from the writer that wrote him, because it is reading the same paragraph.

**Nothing is written until you say so.** When the two of you agree on
something, it offers the changes — each new line next to the line it replaces
— and **Put it in the script** writes them. **Leave it** turns them down and
the writer is told you did, so it stops offering the same three lines. What it
can offer:

| | |
|---|---|
| reword a line | the new words, with the old ones struck through under them |
| add a line | who says it, and whether they say it at the other host |
| cut a line | the line goes, and its animation beats with it |
| `# pause 1.5s` | a measured beat before a line; 0 takes one out |
| `# cut` | a section boundary, where SitePal can be skipped to |
| the title | what the channel guide prints |
| a house note | a standing rule for every future episode of both shows |

The last two rows are the point of the marks being here rather than replaced:
the room speaks the screenplay's own language, so a beat you talk your way to
is the same `# pause 1.5s` you would have typed, read by the recording in the
same way. A house note is for when you are telling it about the characters
rather than about this line — "Connor never explains his own joke" — and it
goes into `docs/lt-tv-style-notes.md` beside the ones you wrote with `#!`.

**It writes the `.txt` only.** The record is rebuilt by **Apply my edits**, the
same explicit step as any other change, so a conversation that went nowhere is
thrown away by not applying it. A change that would make the screenplay
unreadable is refused when it arrives rather than when you apply it, and if the
file will not parse afterwards the room says so immediately.

The conversation is kept in `content/lt-tv/rooms/<id>.json`, so closing the
tab does not lose it. That directory is gitignored, so it is yours and it is
not committed. The same room from a terminal — it opens on the screenplay if
there is one, and on the pitch if there is not:

```
npm run lt:room -- morality-02
```

Each message is one Anthropic call, and a turn that only talks costs the same
as one that changes something — so it is cheap next to writing an episode and
not free.

---

## Fixing a line after it's recorded

Editing the screenplay of an episode that already has audio is refused — the
clips would still be saying the old words. To go ahead anyway:

```bash
npm run lt:edit -- news-01 --rerecord
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
[ ] npm run lt:slate -- <id> run after the split, so the guide gets the sections
[ ] npm run lt:check passes, and reports a runtime
[ ] Every section under 90s and starting where the last one ended (the check
    says so)
[ ] Each section join watched once — the picture should not jump at one
[ ] leadIn tuned by ear on /trade and written back into the record
[ ] First and second playback clean; episode switching clean
```
