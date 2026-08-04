# The VC Game

*The game that ships on `/trade`. Rewritten 2026-07-29 as a spec: what the game
is, what the rules are, what's built. Every rejected idea, post-mortem and
"why" is in [VC_GAME_ARCHIVE.md](./VC_GAME_ARCHIVE.md) — cited as `[A§n]`.
[GENESIS.md](./GENESIS.md) governs the card set, which belongs to the separate 2D
TCG, not to this game.*

**500 lines is the ceiling, and the rule that keeps it there is: a rule lives
here, its argument lives in the archive.** The previous edition reached 1,006
because spec and journal were welded together.

**Before raising it, check whether the new lines are rules or reasons. If they are
reasons they belong in the archive, and the number stays** — see `[A§19]` for why
that rule exists and how often it has been tested.

**North star (author, 2026-07-28):** *"I am hoping for a nice little engagement
puzzle."* Not a social product, not a ladder, not a metagame. A fresh deal, four
minutes, a pattern you didn't have before. **Engaging and educational.**

**Status keys:** `SHIPPED` · `PARTIAL` · `DESIGNED` (agreed, not built).

---

## 1. The game

**One deal. One pitch. Three interruptions. Four analysts at the desk, and a cat.**

A pitch bot pitches you a deal on its client's behalf. **Every fact stated is
true.** What you judge is the inference sold on top of it. You interrupt **three
times**, then call it — long, short, or flat — and then you get the truth.

The teaching payload, in one line: **a good decision and a bad outcome are not
the same mistake.** You are graded on whether you read the claims right, never on
whether the venture succeeded — and since 2026-08-03 the game can actually
*produce* that case rather than only claim it (§4, fates).

```
OUR LADY        remote, unseen       decides which deal comes down.        DESIGNED
   ↓                                 You don't get to ask why this one.
THE CLIENT      a rolled identity    retains the bot. Never appears, and    DESIGNED
   ↓            name / ticker        the UI never remarks on it.
THE PITCH BOT   in the room,          pitches on commission. The one       PARTIAL
                projected            constant. UNLIMITED presses.
   ↓
THE ENGAGEMENT  the record           the bot is RETAINED there and its     SHIPPED
RECORD          in the briefing      client named. Paperwork, not a draw.
   ↓
THE PROJECTOR   centre of the desks  casts the bot. Its beam is the only    SHIPPED
                                     staging the pitcher gets.
   ↓
FOUR ANALYSTS   at the desk, yours   Barron CHART · Marisol CHAIN          SHIPPED
                one use each         GR80 RECORD · Eugene SOCIAL
   ↓
VIRGIL          on the desk          your guide. Cannot be sent anywhere.  PARTIAL
   ↓
YOU             the fifth seat       call it                              SHIPPED
```

**THE UI NEVER REMARKS ON THE CLIENT'S ABSENCE** `[A§20]`. A bot representing an
absent principal is ordinary business here: the record carries one face and one
name, and nothing says the client did not come. The commission does the damning.

**Our Lady is the randomiser, and she is canon** — `council-chat/route.js:16` has
her *"in the channel but NOT in the room"*; `Lobby.jsx:48` already calls the
player *"the fifth seat at Our Lady of Perpetual Profit's trading desk"*. She
costs no model and no portal. **Her line may never editorialise on the deal** —
the moment her tone tracks the outcome she is a leak wearing a habit. Never
"child": seeker or pilgrim.

### The pitch bot — one voice, many clients

*Chosen over a rotating cast of human pitchers on 2026-07-29. The full argument —
including why the "a rotating pitcher multiplies the content" claim was false — is
`[A§17]`. The rules it produced:*

1. **Founders employ pitch bots as agents.** A convention of the world, not a
   production shortcut, so the founder's absence needs no explaining and is itself
   faintly damning.
2. **The bot works on commission.** This is load-bearing, not colour: `POSITIONED`
   (*"the speaker benefits from you believing it"*) is live in all three
   archetypes, and a paid closer's interest is **structurally undeniable** where an
   owner's is deniable. It also earns the asides — a machine paid on close has a
   reason never to concede.
3. **The face shield is the display for `pressure()`, and may read nothing else.**
   Four bands → four textures. Because `pressure()` reads `run.outcomes` alone, the
   shield shows **what you found, not who you drew** — and a texture keyed to it is
   *auditable*, which makes invariant 9 provable where a rigged facial performance
   never could be.
4. **The founder is a rolled identity** — `{ name, portrait, bio }`, pooled on the
   `identities.js` pattern, shared across archetypes, **never authored per
   archetype**. Zero marginal prose; the bot says *"my client, ALDERMAN…"*.
   Inherits the name pool's rules: must not suggest a mechanism, must not suggest a
   team style, must be plausible for archetypes not yet written.
5. **Roll the founder independently of archetype AND outcome.** A founder who only
   appears on legit deals leaks the answer; a founder mapped to an archetype is the
   name-leak again — four appearances in four costumes.
6. **The RIG is rolled on the same terms, and for the same reason** *(2026-08-02)*.
   There are several pitch-bot meshes now (`PITCH_BOT_ROSTER`); which one the beam
   casts is drawn in `press/pitchers.js` from a roster and a seed, and **nothing
   about the deal is passed in** — so the roll cannot see the archetype or the
   branch even by accident. With three or four rigs against three archetypes, a
   bot keyed to the case pattern would not be a partial leak but close to a lookup
   table, read before a word is spoken and looking for all the world like art
   direction. It is rolled at temple load, *before the deal exists*, which makes
   the independence structural rather than a promise.
   **One character, several shells:** the rigs are bodies for one role — one voice
   bank, one set of asides, one commission rule, **no per-rig prose**. §1's "one
   voice, many clients" is intact, and `[A§17]`'s objection to a rotating cast does
   not apply: that argument was about authored content multiplying, and swapping a
   mesh multiplies nothing. A shell may carry its own vocal timbre (`voice` on the
   variant); it must never carry its own script, because a script is where a tell
   would hide.

**The record is the arrival; the projector is the pitcher** `[A§17]`, `[A§20]`.
Our Lady decides *which* deal, the engagement record names the client who retained
the bot, and the projector casts the bot into the room for the pitch. **The monitors host
neither** — they are the evidence boards, and a receipt landing on a seat's own
screen is the payoff of the whole four-seat design.

**THERE IS NO PITCH SURFACE IN 3D — a live gap** `[A§17]`. Claims live only in the
reading column, and the pitcher has no board of its own (it aliases Barron's).
`HologramCard.jsx` is the built, unused shader for exactly that job.

**The pitcher is only in the room while there is a pitch** — visibility gated on
`pressMode`, the mirror of the neon rule. The sign owns centre stage when nothing
is happening; the agent owns it when something is.

---

## 2. The loop — `SHIPPED`

| Beat | What happens |
|---|---|
| **THE ARRIVAL** | An inbound file, sealed. `REVIEW THIS DEAL ▸` — the engagement record is signed: the bot's shield wakes, its client's name goes onto the line, `MEETING SET` lands, and the dossier writes itself in. |
| **THE DEAL** | The deal sheet: a terminal dossier. Name, ticker, chain, surface stats. |
| **THE OPENING** | `HEAR THE PITCH ▸` — the bot takes the frame and introduces itself before it sells anything: who it is here for, **that it is paid only if you fund this**, and how many points are coming. Skippable. The commission line is where the player learns the rule §1 states — nothing it says is false — so the session reads as an offer, not a lie hunt. |
| **THE FLOOR** | Six claims, one at a time. Each carries `FACT` (always true) + `SPIN` (the inference), a **lane band** naming who goes deepest, and **Virgil's read**. |
| **THE PRESS** | Three interruptions. Ask anyone about anything — the lane decides how deep they get, not whether they answer. The analyst reports, then **you choose**: `SEE WHAT LANDED` (their screen) or `HEAR ITS RESPONSE` (the seller's spin). Neither is compulsory. |
| **THE CALL** | One slider, `SHORT ← FLAT → LONG`. Plain-English readout including what you lose if wrong. |
| **RESOLUTION** | Truth: what the claims turned out to be, then what became of the venture (§4, fates). On desktop the four stand up and play their real reactions; the summary is a lower third so it never covers them. When a good call had a bad outcome, one further line says so. |
| **POST-DEAL ANALYSIS** | READ (did you press where the answer could have changed your mind) + BOOK (P&L), every chip flipped, **and the pattern named**. |

| Press outcome | You hear | The board |
|---|---|---|
| **HARD** | number, source, and the caveat they hadn't volunteered | a receipt **stamps**, and stays |
| **SOFT** | a range and an honest hedge | grey half-receipt |
| **VIBES** | louder, faster, still no number | **stays black** |

`VIBES` means nobody can produce anything, specialist or not — a property of the
**claim**, and the honest home for "nobody can settle this" now that every lane
has an owner.

The absence is something **you go and look at**, on both surfaces: the reporter
stops, the board changes silently, and the verdict lands only when you arrive —
a pane swap on mobile (the `ITS SCREEN` tab pulses *cyan*; gold is the receipt
colour and pulsing gold would announce a receipt before you'd seen one), a camera
hold on desktop. Not looking is allowed — the same forfeiting choice as not
pressing `[A§18]`, and so is never hearing the reply.

**Nothing may name the outcome before the reveal.** Verdict copy, border colour
and tab badge are all derivable the instant you press, so each leaks by default
and each is explicitly gated.

---

## 3. The desk — `SHIPPED`

| Seat | Lane | Subject | Budget |
|---|---|---|---|
| **Connor** | `CHART` | THE CHART — price, windows, momentum | one use |
| **Detective Marisol** | `CHAIN` | THE MONEY — money movement, wallet ages, unlocks | one use, all session |
| **Saint GR80** | `RECORD` | REPUTATION — what the documents actually say | one use |
| **Eugene** | `SOCIAL` | THE STORY — narrative, reputation, who vouches for whom | one use |
| **Virgil** | — | THE CAT · YOUR GUIDE | not a seat |

**Expertise is a gradient, not a gate** `[A§10]`. Anyone can be asked about
anything; the lane decides **depth** — in lane you get the claim's `sharp` block
(the specialist finding, with the caveat the speaker hadn't volunteered), off
lane the `generic` block (true, shallow, settles little, and they say so out
loud). So the decision is **"is this claim worth my one specialist, or will a
shallow look do"** — which the UI cannot answer for you.

Asking costs **both** an interruption and that colleague. A spent specialist
doesn't close a claim, it **caps** it, and every surface must say so.

**A shallow look can never prove a negative.** `NOTHING ON FILE` requires both
that you asked someone who isn't the pitcher *and* that it was their area — an
independent party having looked and found an absence, strictly stronger than a
board staying dark. The wrong specialist finding nothing is a fact about your
choice, not about the deal.

**Every lane survives the cut.** Six of seven slots play, so a single-slot lane
is pinned by `mustKeep` in `instanceDeal`. Without it, 95 of 200 yield-mirage
seeds left a specialist with no deep target all session — sendable, so nothing
looks broken, but silently decorative.

**The row header is `ASK A FOLLOW-UP`** `[A§11]`. Nobody leaves their desk; on a
press it's the **camera** that crosses the room. A press never opens a new
subject — it interrogates the claim just made from a sharper angle. And it must
not demand an answer: holding is frequently correct. You **press** the person
selling you the deal; you **ask** a neutral colleague.

### Virgil — `PARTIAL`

**No lane, cannot be sent anywhere, never touches the resolver.** `virgil.js`
reads run state and returns two strings; nothing in `pressRun` imports it. The
game must be fully playable and scoreable with him muted — which is exactly why
muting him is offered `[A§9]`. He says two things, returned **separately**, never
concatenated into one italic sentence:

- **THE AGENDA — always on.** *"Last money question you'll get. Deep look now, or
  never."* Nobody else supplies this, and it converts the core decision from a
  coin flip into a decision. Leak-free by construction: `laneOutlook` counts
  lanes only — never backing, never `discriminates`, never the branch.
- **THE TIP — off switch, and that is the point.** What *kind* of weak argument
  this is, never whether the claim is true. *"Virgil stops chiming in"* is a
  difficulty setting in a way "turn off Eugene" never could be.

**Not built:** he is a portrait and two lines of text. `VIRGIL.model` points at
`/models/fluffyCat.glb` (580KB — **not** the 15MB `FR80Cat.glb`) and nothing
loads it. Cheapest character on the floor: no lane, no lip-sync, no reaction clip
that could leak an outcome.

### They react to being caught

`pressure(run)` scores what the room has done to the pitcher — **NOTHING ON FILE
+2**, **black board +1**, **partial +1**, **a real receipt −1** (you checked and
it held up; it gets to enjoy that). Bands `COOL · BACKED · RATTLED · CORNERED`
drive an aside before the next claim, a badge, the panel border, **and the bot's
face shield** (§1).

**It cannot leak.** `pressure()` reads `run.outcomes` and nothing else — your own
evidence summarised back at you. It still *correlates* with truth, because an
honest deal yields fewer catches; that correlation is information you earned.

The 14 asides are archetype-agnostic and live in `desk.js`. They never apologise
and never concede. No aside may name a fact, a lane or an outcome — "records" and
"paperwork" are forbidden words there, being a lane and a role label.

**Content debt from the bot:** the asides are rewritten (*"My client has shipped
something"*), but two `POSITIONED` slots still claim a personal stake —
`backdoorFork` *"I'm in this myself"*, `yieldMirage` *"My own money's in the
vault"*. A commissioned agent has no money in the vault: move the interest from
ownership to the close. `anonButReal`'s is about the client's funding and is fine,
and **`badTokenomics`'s `commission` slot is the worked example** — the bot's
interest is the close, the honest answer is identical in both branches, and that
is exactly why it cannot help you.

---

## 4. Archetypes — why nothing is memorisable — `SHIPPED`

An archetype owns seven claim slots and all the prose. **The seed rolls the
outcome; the outcome only changes what can be PRODUCED when pressed.** Same six
questions, different answers. Each instance plays 6 of 7 slots.

| id | label | bad rate | hides |
|---|---|---|---|
| `backdoor-fork` | THE DOOR NOBODY AUDITED | 74% | a *mechanism* — an unaudited upgrade path |
| `yield-mirage` | PAID OUT OF THE INFLOWS | 68% | an *accounting identity* — yield paid from inflows |
| `anon-but-real` | NO NAMES, BUT RECEIPTS | **30%** | nothing — anonymity is not the tell |
| `bad-tokenomics` | THE SUPPLY THAT HASN'T LANDED YET | **25%** | a *schedule* — published, unread, and pure arithmetic |

Deliberately different silhouettes: learning one doesn't give you the others.

### What the binary means — decided 2026-08-03

**"Was funding this the right call ON WHAT WAS CHECKABLE AT THE TABLE."** Not "did
the project survive" — that was never the axis, only how the first three happened
to narrate it — and not "did it make money", which no seat can investigate and
which needs power-law payoffs that end properness (invariant 2). `[A§21]`.

**The admission test for any bad branch is one question: could a specialist at
that desk have found it before you called?** A vesting cliff, a lock date, an LP
concentration and a fee line all pass — `bad-tokenomics` is built on them, and its
bad branch leaves the project *running*. A played-out premise fails: `[A§16]` says
nobody at that desk can tell you whether the market will show up, and §7 item 7
already files "market never showed" as **legit-branch narration, still a correct
FUND call**.

The branch keys stay `rug` / `legit` because the engine reads those two strings.
Nothing is rugged in `bad-tokenomics`. **That gap between the key and the meaning
is the point.**

### Fates — a good call with a bad outcome — `SHIPPED`

`legit` used to mean *succeeded*, so the only way to lose money was to be cheated
— which made §1's headline (*"a good decision and a bad outcome are not the same
mistake"*) describe something the game could not produce. `press/fates.js` fixes
it, and the rules are short:

1. **A fate is NARRATION. It never reaches `casePnl`.** A legit deal that folds
   **still pays the FUND call**, because the player was asked whether the claims
   held. If a fate ever touches the score, properness is gone (invariant 2).
2. **The archetype's legit line says only that the CLAIMS held.** What became of
   the venture comes from the shared pool. *Never* put "is still running" back
   into a `RESOLUTION` — that is exactly how `legit` came to mean succeeded, and
   an assertion now blocks it.
3. **A failure belongs in a fate if, and only if, it fails §4's admission test** —
   the same question, read the other way. If a specialist could have found it, it
   is a claim; if nobody could, it is a fate. This is the *only* place a
   played-out premise is allowed to exist.
4. **~30% of legit deals fail; surviving stays the common case.** Roughly one deal
   in seven overall. **Do not make 1/10 the real rate** — real VC survives its hit
   rate through asymmetric payoffs, and power-law payoffs end properness.
5. **The fate reports; `settlementNote()` draws the lesson.** A fate may not
   mention the call, the score, the claims or the desk. The note fires *only* on
   the one combination where the payout disagrees with the story, and it answers
   all three calls — including the hard one, where the player FUD-ded a deal that
   did fail and still lost, because they answered a wider question than the one
   asked.
6. **Archetype-agnostic, like `desk.js`.** An archetype authors no word of it, so
   archetypes 5–13 cost nothing here.

**The exception rate is load-bearing, not flavour.** A backdoor-fork-shaped token
is *usually* a rug and *sometimes* genuinely fine — which is why a perfect read
still shouldn't go to 100%, and therefore why the slider has a middle. Make an
archetype deterministic and correct play collapses to a binary, taking the
scoring kernel with it.

### The number that justifies a new archetype

**Not the hit rate. The edge from recognition** — expected P&L per deal, 8000
seeds. **`scripts/sim-press-edge.mjs` computes this**; it reproduces every row
below off the production `instanceDeal`, so the table is re-derivable rather than
remembered. It had no harness until 2026-08-03, which is the same as no gate.

| | base rate | blind | knows the archetype | **edge** |
|---|---|---|---|---|
| 2 archetypes | 71.5% bad | +4.61 | +4.71 | **+0.10** |
| 3 archetypes | 57.3% bad | +0.54 | +4.62 | **+4.08** |
| **4 archetypes** | **49.2% bad** | **+0.01** | **+5.12** | **+5.12** |
| *perfect read* | | | **+24.99** | |

At two archetypes, recognition was worth a tenth of a point — **a game whose stated
skill did not pay.** `anon-but-real` inverts the base rate, which is what took it
to +4.08 *and* made blind play worse (a lopsided world is easy to score in once you
know it's lopsided). **Harder for the uninformed and more rewarding for the
informed, at once — that is the test a fourth has to pass.** `bad-tokenomics`
passes on both halves: blind falls to a rounding error, informed play rises.

**THE GATE HAS A CLOSED FORM, AND IT DISQUALIFIES THE MIDDLE.** With a uniform
archetype roll and base rates `r_i`, the whole table collapses to

> **edge = 4 · STAKE · VAR(r_i)** — recognition is worth *only the spread of the
> priors.* Prose, mechanism, lane design and how cleverly a tell is hidden move
> this number by exactly zero.

So a fifth archetype **anywhere between 35% and 79% makes the game worse**: it adds
a near-zero deviation and dilutes the ones carrying the spread. `--sweep` prints
the whole range. The gate pulls toward the extremes and the exception rate above
pushes back (*"make an archetype deterministic and correct play collapses to a
binary"*), and **the design lives in that gap** — roughly 20–30% or 80–85%. Pick
the base rate by measurement, then write to it; the intuitive version of
`bad-tokenomics`, where a thin book usually kills you, would have **failed**.

**Never measure hit rate.** `casePnl` is Brier-affine, so always-short-with-
conviction earns **−16.83** per deal — the worst strategy available, not an
exploit. Being directionally right most of the time is worth almost nothing if
you can't say how confident to be.

### Authoring rules — read before writing archetype #4

*Every one is a mistake already made once. Reasoning: `[A§8]`.*

1. **`backing` is SLOT-LEVEL, never per-branch.** A claim either has a receipt to
   be had or it doesn't. Authored per branch it *was* the leak that made the
   entire four-seat desk decorative.
2. **`generic` is hoisted to the slot**, so the pitcher's shallow answer cannot
   differ by branch. **Only the `loadBearing` slot may keep a per-branch
   `generic`**, because invariant 1 requires the decisive claim stay reachable on
   a free press, which means it must discriminate.
3. **A null `sharp` receipt in ONE branch only is legitimate and wanted** — it is
   what produces `NOTHING ON FILE`. An assertion once forbade it and silently
   killed the feature.
4. **Every lane a spendable seat owns needs ≥1 slot, and one needs ≥2.**
5. **Nothing visible may correlate with archetype or outcome.** Names, **claimed
   prior roles and auditors** all come from the shared pools in `identities.js` —
   never per archetype. Each must not suggest a mechanism, must not suggest a team
   style, and must be plausible for archetypes not yet written. *`PRIORS` was
   still per-archetype until 2026-08-03 and yield-mirage's list was disjoint from
   the other two's, so a trading-desk prior named the archetype outright — the
   2026-07-28 identity fix had never been carried through to the other visible
   pool. Check every pool an archetype can print, not just the one that broke.*
6. **`miss` blocks are dead.** Delete on sight. *(All 10 removed 2026-07-30; no
   archetype carries one.)*
7. **Every archetype needs a DELIBERATE ZERO** — one impressive-sounding slot
   with identical receipts in both branches at both depths, so that pressing it
   settles nothing. `funding` does it in backdoor-fork and anon-but-real,
   `commission` in bad-tokenomics. Scoring coverage of the *discriminating* claims
   is what teaches that a salesman disguises materiality on purpose.

---

## 5. Invariants — do not break these

1. **Truth is never for sale.** Every deal is solvable with zero help — the
   `loadBearing` claim must be `HARD`, reachable on a free press. Linted per
   instance.
2. **Payout stays a proper scoring rule.** `casePnl(p, truth, STAKE)` is
   Brier-affine, so honest reporting maximises expected P&L. **Fixed stake, single
   slider.** A conviction-coupled stake is provably improper (peaks at `-4d/3`
   where honest is `-d`); a loss floor breaks it the same way; so does anything
   that adds luck to the score.
3. **`PRESSES = 3` is frozen.** Nothing ownable may read or write it.
4. **One door to the collection.** `resolvePress` and the settle path take no
   collection and no loadout parameter, ever.
5. **No surface stat leaks the outcome.** Listing stats are asserted uncorrelated
   with truth, or the optimal play is "skim the stats, skip the analysts".
6. **Plain language.** Every player-facing term must parse with no finance
   literacy. "Brier", "diligence" and "the tape" all failed. *A term can fail this
   years after shipping, and the person who notices is the one who didn't write
   it* `[A§18]`.
7. **Nothing names the deal before it exists** — headline, top bar and body copy
   included, until the deal sheet lands.
8. **The floor never issues an instruction the controller would reject.** The lane
   band and the agenda both take `run.advisersSpent`; they shipped without it and
   named a spent adviser as the way through.
9. **Animation reinforces, never informs.** No outcome readable from body
   language, no reaction clip before the reveal. This is what keeps new animation
   cheap: a clip can always be added, never made load-bearing.

> **The discipline rule.** An idea ships only if the session resolver can score
> the session without reading the collection. If it needs the collection passed
> in, it's a content request wearing a mechanic's costume, and the correct build
> is another deal.

It rejects eleven of the twelve subsystems that killed the previous design and
permits unlimited new archetypes at zero code.

---

## 6. Architecture

**The controller is pure and renders nothing.** Two presentations sit over the
same run. **A rule in a presentation is a bug.**

`game/terminal-traders/press/` is the controller — `pressRun.js` (turn queue,
budget, pressure, resolution, settle), `instanceDeal.js` (seed → archetype,
outcome, identity, surface numbers), `questions.js`, `desk.js`, `virgil.js`,
`identities.js`, `archetypes/`. `components/trade/press/` is presentation —
`pressUi.jsx` (the shared floor), `PressSession.jsx` (desktop),
`PressFlat.jsx` (mobile), `PressFigure.jsx`, `evidenceScreen.js`,
`arrival.jsx`. Verified by `scripts/verify-press-run.mjs` — **143 assertions, green.** The
edge gate in §4 is `scripts/sim-press-edge.mjs`.

*A file tree is not listed here on purpose: the previous edition's went stale and
omitted a shipped archetype for two commits. `ls` is authoritative. What follows
is only what `ls` can't tell you.*

- **`pressRun.js` must never import `virgil.js`.** The cat reads run state and
  returns strings; the resolver must not know he exists.
- **Nothing under `press/` may import `cards.js`** (`questions.js:6`).
  `instanceDeal.js:15` still does, for `deal.exemplar` — the last tie, §7 item 4.
- **`lib/trade/pitchBotScene.js` + `pitchBotHolo.js`** own the bot in the 3D room.
  `CyborgTempleScene.jsx` holds only a `mountPitchBot()` call, a camera pose, an
  animState branch and two visibility clauses. **Not derived from
  `HolographicStatue3`** — that is live on the root page and its raw ShaderMaterial
  has no skinning chunks, which on this SkinnedMesh renders a frozen bind pose.

**`desk.js` and `virgil.js` are why the character layer is cheap.** Between them:
the lane band, 14 pressure asides, 15 adviser result lines (3 × dispatch / found
/ partial / nothing / shallow), 18 shape tips and the agenda phrasings. An
archetype authors claims and **never** a word for Virgil or an adviser's
dispatch, so archetypes 4–13 cost nothing on this axis.

**The shared floor.** Two hand-written copies of the same floor is how the
surfaces drifted: every desktop bug in the seat migration came from porting a
*mechanic* without the *state gating* that made it work. Four bugs, one cause.
Gate, claim body, answer body, seat row, meter and nav live in `pressUi.jsx`,
styled once; **each surface supplies only positioning.** A prop only one caller
passes probably belongs in that caller's container.

**Desktop** plays over the live temple with **zero edits to
`CyborgTempleScene.jsx`** — the receipt paints into the seat's existing shared
canvas (`window.__screen2Canvas`) via the `evidenceActive` handshake. Those
monitors are owned; binding a new texture to `Screen2` is invisible.

**Mobile** opens the laptop zoom inside the CRT. No 3D. `?flat=1` exposes it at
any width. **Height contract — one scroller, three pinned rows:** tabs, feed and
dock are fixed furniture; `.pf-read` is the only child that may grow. A new row
goes inside it or gets a height budget. 839px of rows in a 700px box once clipped
`LET HIM GO ON` and `CALL IT` — **the pitch had no exit.**

**The contract is CSS, and CSS can go missing without erroring** *(2026-08-02)*.
Every rule for the floor — `.pf-floor`, `.pf-tabs`, `.pf-stage`, `.pf-read`, the
agenda rail and the board strip — was deleted in one commit on 2026-07-29 and
nothing had styled the floor since: `.pf-floor` computed `display:block`, the
four rows collapsed to 147px inside a 698px wrap, the figure rendered 2px tall
and `.pf-read` had no `overflow`, which quietly reinstated the exact clipping
above. **A missing stylesheet fails silently and looks like a layout bug**, so
when this surface looks wrong, check the rules exist before debugging the markup.

**THE PITCHER IS THE REAL RIG HERE TOO** *(`PressBotStage`, 2026-08-02)*. This
surface loads the staged glb — one at a time, 560–925KB Draco — and drives its
own LED viseme plates from the audio, so the mouth is the authored one rather
than a bar drawn over a still. That breaks the no-WebGL premise on purpose: a
still with a painted mouth reads as weak, and **SitePal can never speak for this
character**, because `sayAudio` resolves *names in the account, never URLs* and
the bot's lines name the deal it is pitching. There is no clip to upload. Its own
rig is the only mouth it can ever have.

*One at a time is a constraint, not a preference* — `pitchBotExpressions` keeps
its plate maps in a module singleton, so a second live rig silently steals the
first one's face. The stage stays **mounted and hidden** while the camera is on
an analyst (unmounting would re-parse ~900KB and re-align 19 plates on every
press); its loop idles because `display:none` takes `offsetParent` to null, which
is the gate it checks. `press/pitchers` carries a `stage` flag so the flat path
can ask what a rig can do without importing three, and the stage itself is
`dynamic`-split so the renderer only arrives when a rig that uses it is cast.

**v1 is not staged yet** — its face is a texture, not plates, so a 3D v1 would
move its body and hold a painted smile. It keeps the flat panel and a drawn LED
mouth until its texture-swap face exists; flip `stage` in `press/pitchers` then.

**Around the rig, the panel is still a feed**: the border carries the pressure
band exactly as the LED face does on desktop (`§1 rule 3`; nothing else about the
pitch may reach it), a level meter reads the same amplitude, and it **cuts to
whoever is speaking** — an analyst who went and looked now appears while they
report, which is the flat equivalent of desktop's "the camera follows the voice,
not the press". Everything per-frame outside the canvas is `opacity`/`transform`:
a `filter` mutated beside an animated subtree computes and never paints on iOS.

**The analysts are the SitePal slot, deliberately unfilled.** Their press lines
are a fixed bank of twenty (`ADVISER_LINES`), which is exactly what SitePal *can*
lip-sync, and three of them already have scenes — Monk `2774449` (speaks any text
via TTS), Demon `2774900` and Detective `2774916` (banked clips only). Eugene has
none; an equine head needed a custom build. `SitePalFeed` is already the
one-character-at-a-time 2D feed that slot wants, so the remaining work is an
upload pass — generate the twenty lines in each seat's own ElevenLabs voice, name
them in the Audio Manager — not code.

---

## 7. Build order

**`SHIPPED`:** four archetypes · seeded instancing, a fresh deal per sitting ·
the engagement record and the client's name · four SYMMETRIC seats, one lane and one
use each · the pitch bot as an outside pitcher, projected into the room with its
own voice · Virgil's two reads and the tip switch · `NOTHING ON FILE` · pressure
bands · the shared floor · desktop in-room play · mobile CRT with voice, the
pitcher's projection panel and per-rig faces · **three rigs, rolled blind to the
deal, with their own throats on both surfaces** · all seven
ElevenLabs voices wired, seat-then-pitcher on both surfaces ·
lower-third reveal · post-deal analysis with the pattern named · fates, so a good call can have a bad outcome · 143 assertions ·
`The VC Game` tile on the `/trade` rail (default). Case Table behind `?classic=1`.

**Open on the bot specifically:** the face shield's four pressure textures are not
wired, and `LET HIM GO ON ▸` still says "him" (`pressUi.jsx:379`). The camera pose
is done — derived from the face plate at focus time by `getPitchBotFocusSettings`.

1. **Run the subjective acceptance test.** Same seed, three presses on the pitcher
   vs. three across the desk. *If run B doesn't feel like a different and better
   decision, the direction is wrong.* Free, unrun, and three subsystems have been
   built on top of it. **Do this first.**
2. **The pitch bot and the client pool** — rules in §1.
   - **The bot.** The model, the `PITCHER` rename and Barron's seat all landed.
     Left: point `claim.speaker` (`instanceDeal.js:146`, still hardcoded
     `"demon"`, read by nothing) at the bot, and key four shield textures to
     `pressure(run)`.
   - **The founder pool.** A sibling of `identities.js`, rolled per deal.
   - **A pitch surface.** OPEN. The easel that briefly filled this role was cut
     from the glb on 2026-07-29 (§1), so the pitcher has no way to show the thing
     it is selling and no board for its own receipts.
   - **The machine, for THE ARRIVAL only.** The rig exists and is switched off:
     `CyborgTempleScene.jsx:158` `SHOW_HOLOGRAM_CARD = false`, `projectorRef`
     auto-detected at `:4269`, `BeaconBeam` already rising from it, and
     `HologramCard.jsx` a complete projection shader (holo tint, scanlines, glitch,
     halo, sway, billboard-on-yaw, three states) — off because its payload was a
     trading card. Wiring it to render the deal — and to take the pitcher's
     receipts, which currently alias Barron's screen — is the open half of §1's
     "no pitch surface in 3D".

   **Asset facts, `/models/pitch-bot.glb` (566KB):** Draco **and**
   `EXT_texture_webp` are `extensionsRequired`, so a loader needs the `DRACOLoader`
   block from `CyborgTempleScene.jsx:2853-2862` (WebP needs nothing). Clips:
   `idle` 8.37s, `talking` 14.17s, 51 nodes each. **The face plate
   (`SM_Chr_Kid_Robot_Face_01`, material `lambert2.003`) is not skinned and no clip
   touches it** — expression swaps are mixer-independent. It is fully emissive
   (`emissiveFactor [1,1,1]`), so it self-lights into the existing Bloom; base
   colour and emissive share one image, so **set `map` and `emissiveMap` together**
   or the halves disagree. Both clips animate `head`, so any look-at must use this
   repo's one shared head-aim formulation applied *after* the mixer — a bespoke
   version has been the bug before.

   **An alternate rig, `/models/pitchbot2.glb` (896KB), added 2026-08-02.** Not a
   replacement: both live in `PITCH_BOT_VARIANTS` and v1 is still the default.
   Stage the other one with `?pitchbot=v2` — no rebuild, no edit to
   `CyborgTempleScene`. Draco only (no WebP). Clips `Stand_Idle` 13.97s, `Talking`
   10.30s, `Formal_Bow` 2.77s, 65 nodes each; they are registered under **canonical
   aliases** (`idle`/`talking`/`bow`) as well as their own names, because the speech
   effect at `CyborgTempleScene.jsx` reads `actions.idle`/`actions.talking`
   literally and a bare registration stages a bot that never moves without erroring.
   **Its face is eight meshes, not a texture:** `Adult_Male_Face_<Happy|Neutral|Sad|
   Angry|Confuse|Impatience|Usual|Frustrated>`, bone-parented to `mixamorig:Head`,
   all sharing the emissive `Expression_LED_MAT` (cyan, `emissiveStrength` 4 — it
   self-lights into the existing Bloom, whose threshold is 0.3, and it is held out
   of the holographic wash so it keeps reading as a screen). glTF has no visibility
   channel, so **all eight arrive visible and coincident** and `pitchBotExpressions`
   has to switch seven off before the rig is looked at; no clip touches them, so
   expression swaps stay mixer-independent exactly as on v1. Sized by
   `fitHeight`, not by a scale — see that field for why the two rigs are
   deliberately *not* staged at the same height.

   **The bill is mostly paid.** The one voice bank, Barron's specialist `sharp`
   findings and his one-use lane all landed on 2026-07-29; what's left is the two
   stake slots in §3. **Archetype #4 costs +35 lines, not +210.** Solvability
   survives: `loadBearing` claims are `HARD`, answerable by pressing the bot
   directly.
3. **More archetypes.** Ten of thirteen `CASE_PATTERNS` reads are unbuilt. Pure
   content, no code. `serial-deployer` and `celeb-shill` are the next
   highest-contrast pair — each must pass the §4 edge test, not a vibe check.
4. **Trophies — the collectible is the ARCHETYPE, not a coin.** Read a deal well →
   the **pattern** enters your collection, stamped with your call. Gives the
   thirteen a visible shape (*3 of 13*), answers "why come back on day two", never
   touches the resolver, and kills the last `cards.js` tie: `deal.exemplar` exists
   only for the old coin-trophy plan and nothing renders it, so dropping it stops
   `instanceDeal.js:15` importing `getCardById`, which `questions.js:6` forbids.
5. **Persist the collection and your own book** as a personal curve. Not a ranking.
6. **Let Virgil be wrong.** The tips are an oracle today, which makes them a hint
   system with a face on it. A pattern-matcher who misreads at the archetype's own
   exception rate is a character — leak-safe while his confidence tracks the base
   rate and never the branch. **The agenda must stay exact**; make him wrong there
   and the seat decision has nothing to rest on.
7. ~~Split `legit` into outcomes~~ — **`SHIPPED` 2026-08-03**, `press/fates.js`.
   See §4's fate rules; the reasoning is `[A§22]`.

**Smaller, open:** desktop end-to-end unverified past the copy paths (receipt on
the adviser's in-room monitor, `NOTHING ON FILE` in-scene, the curtain call) ·
`STARTER_SET` grants 21 cards free per userId (`collection.js:10`) —
harmless for trophies, fatal if trading ships · a stray canvas click on desktop
can unfocus the camera and it won't re-focus.

---

## 8. Rejected — do not re-propose

*One line each; the argument is in the archive. Listed rather than deleted
because the record shows the same idea returning in a new costume — sometimes
three times in one day.*

| Rejected | Because |
|---|---|
| **Daily leaderboard** `[A§14]` | Ranks one realization, not an expectation — pays you to overstate. Invariant 2 through a side door. The rail is built; not wiring it is a choice. |
| **Daily deal** `[A§14]` | Three of four justifications died with the leaderboard; the survivor needs a share hook nobody has built. |
| **Live / moving market price** `[A§15]` | Correlated it leaks; uncorrelated it's noise that out-competes the argument. Touching P&L ends properness. |
| **Conviction-coupled stake · loss floor** | Provably improper. |
| **Cards, in every form** `[A§12]` | Mechanic cut 2026-07-27, visual vocabulary 2026-07-28. Four card faces read as a cast list, not four buttons. Cards go to the 2D TCG. |
| **Real 3D dice · numbered RPG dice** `[A§13]` | Second renderer over the live temple and second physics engine; and a d20 arrives with meaning pre-attached — a nat 1 would read as a tell. |
| **A rotating cast of human pitchers** `[A§17]` | ~630 lines of prose and a 210-line tax on every future archetype, to vary a draw the spec *requires* to carry no information — so it trains face-reading as a skill when faces are noise. Replaced by one pitch bot with many clients (§1). |
| **The exemplar coin as trophy** | Reintroduces a Genesis card pointing at the other game. You collect what you've learned to recognise. |
| **A played-out premise as a BAD branch** `[A§16]`, `[A§21]` | The one failure mode no seat can investigate. §7 item 7 already files "market never showed" as legit-branch narration — still a correct FUND call. Pricing it needs power-law payoffs, which end properness. |
| **A high-bad-rate illiquidity archetype** `[A§21]` | The intuitive version — a thin book usually kills you — lands at ~74% and FAILS the §4 gate: edge = 4·STAKE·VAR, so a fifth prior near the pack shrinks the spread it was meant to widen. |
| **4th press · backers · holdings · precedent · docket events · horizon dial · research overage · crowd odds** | All fail the discipline rule. |

**Worth building, unscheduled: a FACE-DOWN CLAIM.** One claim per session whose
lane is hidden until you spend an interruption on it — you gamble a specialist
blind. No resolver change. Honest cost: it fights the deliberate rule that lanes
are public from second zero, which exists so the skill is timing rather than a
memorised lane map. A real trade, not a freebie.
