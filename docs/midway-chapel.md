# The Midway Chapel — confession, candles, indulgences

Written 2026-09-04 after Michelle chose the chapel over the land office, the
bookie and the doodlebugger for the taco-truck slot ("fun, ironic, sacred,
profane, and might entice some micropayments"). Status: **step 1 built
(placeholder stall + card, both surfaces), steps 2–7 not started.** Build order
and the asset split are at the bottom.

### Built so far (step 1; asset source updated 2026-09-05)

**Source of truth is now Michelle's `public/models/Tent_Revival.glb`** — the
whole revival (church stage, big tent + four wall panels, three chairs, cross
podium, candle rack) and the preacher (`SK_Chr_Priest_Male_01`, one `preaching`
clip, no face plates yet), authored at the origin facing +Z.
`scripts/split-tent-revival.mjs` re-seats it into the strip frame (yaw −90°,
shift to the taco window) and writes the two files the vendor pipeline wants:
`public/models/stalls/stall_chapel.glb` (props + deck slab) and
`public/models/Vendor_Chaplain_Character.glb` (preacher + clip). Re-run it
after any re-export. Adding the props to the strip .blend is deferred until the
layout is final; the preacher stays a separate GLB like every vendor. The
Synty-pack placeholder below is superseded but its script is kept.

**The congregation (2026-09-05, second export):** a seated robot
(`SK_Character_Robot_01`, clip `Robot_Sit`) and biker (`SK_Character_Biker`,
clip `Biker_Sit`) stay in the STALL GLB with their clips; `StallProps` (phone)
and `StallModelMount` (desktop) now loop every clip a stall carries. That is
three armatures for one stall — the strip's old 4–5 armature budget is a
thing to watch on the iPad. A stray meshless armature (`Root.002`) in that
export is dropped by the split. She exports to `~/Documents/Blender/
Tent_Revival.glb`; copy it to `public/models/` before splitting.

#### The first placeholder (2026-09-04)

- `public/models/stalls/stall_chapel.glb` (1.5 MB, 9.3k tris, four 1k JPEG
  atlases) assembled by `scripts/build-chapel-stall.py` — run it with
  `/Applications/Blender.app/Contents/MacOS/Blender --background --python
  scripts/build-chapel-stall.py`. It opens a NEW scene; no strip .blend is
  touched. Layout in the strip frame: tent ×1.35 opening toward the player,
  its front centre pole cut (it stood dead on the card's axis), two pews,
  lectern, altar, votive rack along the inside wall, bell post at the front
  corner, jail wagon ×0.9 with its caged door end toward the player.
- `VENDOR_CATALOG` entry `chapel` (CommercialStrip.jsx): `stallModel` mounts
  the GLB on the desktop strip, `hideWindow: [0.6, 8]` hides the strip's taco
  dressing under it; the alien's `tacos` entry is `retired` and
  `ACTIVE_VENDORS` is the line-up. `StallModelMount` is the generic mount.
- Phone: `BOARDWALK_ORDER` swaps tacos → chapel, `STAGE_TUNE.chapel` (rest
  ×1.15, back view drops the tent and comes forward 0.12), postcard rendered
  with `POSTCARD_ONLY=chapel node scripts/render-postcards.mjs`, backplate
  copied from the taco window's plate (same neighbours and sky).
- The chaplain is a **stand-in body**: the snake-oil salesman's GLB offset to
  the lectern. No `sitepal` yet, so he is silent. `window.__hmStallHide(re)`
  is a new dev hook on the phone stage for hiding stall meshes by name.


## 1. Premise

HAIL MARY already has a sacred layer. The root shrine page has Our Lady's
oracle, a Confessional, a vigil of candles, burnt offerings of RL80, and a
fountain of donations. Her system prompt is explicit about what she is not:

> You are NOT a confessor: you assign no penances and grant no absolutions —
> that office belongs to another collar entirely.

The Midway chaplain is that other collar. Our Lady consoles and blesses on the
shrine page; the chaplain hears the *field's* sins on the Midway, assigns
penance, and absolves. He has no goddess behind him, only a tent, a ledger and
a bell. He is a company-town preacher: sincere, tired, a little venal (the
indulgence table is right there), and funny in the same deadpan register as
Our Lady, never mocking the player's faith, always mocking the field.

Next door is the casino. Sacred and profane share a wall. The casino is not in
this document beyond the adjacency: it is where the Daily Ticket booth and the
still-pending stall wheel move to when the wheel lands. Michelle already has
`~/Desktop/casinoSection.fbx` (11 Aug) with the PolygonCasino textures, so the
casino stall is an asset she has, not one she needs.

## 2. Where it sits

| | |
|---|---|
| Vendor id | `chapel` (replaces `tacos` in `VENDOR_CATALOG` and `BOARDWALK_ORDER`) |
| Midway name | `BOARDWALK_NAMES.chapel = "CHAPEL"` (tab card title) |
| Strip window | the taco truck's stretch of deck, `stall-windows.json` → `tacos: [0.6, 8]` |
| Neighbour | the souvenirs slot (never had a prop) becomes the casino later |
| Alien | out of the Midway. He was the bookie's body; the bookie waits for a crowd |

## 3. The rite: confession → penance → absolution

Everything the chaplain says about the player is read from the record. **No
invented sins.** The ledger route below assembles them from the drill doc and
the public collections.

### 3.1 The ledger (what he knows)

| Sin | Source | He says |
|---|---|---|
| Breached hell | `oilPlots.<x_y>.hellLayers` count on plots the player has owned this season | "Three times you drilled into the infernal strata, and three times you acted surprised." |
| Summoned a demon | `demonBounty` docs where `summonerId == uid` | "One demon loosed on your neighbours. They remember." |
| Coveted | `oilDrills.<uid>.claimJumpsUsed` and the `oilClaimLog` entries for the player | "You jumped a claim. Whose? It does not matter to you, I see." |
| Greed | `tankOil` un-banked vs `totalCollected` | "Four hundred barrels sitting in the tank, tempting hell." |
| Gambling | Daily Ticket plays this season (`tickets` by uid) | "Nine scratch tickets. Nine." |
| Violence | `hunters.<uid>.vials` and arena kills from the bounty docs | "You threw blessed water at a demon. The water was blessed by me. You're welcome." |
| Vanity | premium unlocks count (`unlocked.*`) | "Chrome on a pump. Chrome." |

He reads it aloud through SitePal — `sayText` speaks arbitrary text in the
character's ElevenLabs voice, so the numbers come out of his mouth. That is the
feature: **he says your actual record.** If the ledger is empty (a new hunter)
he has a line for that too: "Nothing yet. Give it a day."

### 3.2 Confess

The CONFESS button in the cart. Server route `POST /api/oil-chapel` with
`{ action: "confess" }`:

1. Assemble the ledger (server-side, from the session user only).
2. Write `chapelBook/<autoId>`: `{ userId, username, sins: {breaches, summons,
   jumps, unbanked, tickets, vials}, penance, at }`. The book is **public and
   read-only for clients** (the fountain-donation pattern). Other players can
   read that someone confessed to a claim jump on their row.
3. Post a feed event `confessed` ("X confessed. Three breaches, one demon.").
4. Set `oilDrills.<uid>.chapel = { confessedAt, penance, absolvedUntil: null }`.
5. Assign a penance, deterministic from the ledger (below).

One confession per 24 h. Confessing again inside the window returns 409 and he
says "You were here yesterday. Did you sin *again*?"

### 3.3 Penance (server-checkable, one of)

| If the ledger says | Penance | Checked by |
|---|---|---|
| un-banked tank ≥ 100 | "Bank what you carry." | `tankOil` dropped below 25% of the confessed amount |
| an uncapped hell layer on your plot | "Cap the mouth of hell." | `hellCapped` set on that layer (tonic) |
| ≥ 1 demon summoned | "Light a candle for the neighbour you loosed it on." | a shrine candle lit after `confessedAt` (`shrineCandlePrefs.litAt`) |
| otherwise | "Say nothing unkind in plot chat for a day." | trivially true after 24 h (his joke; he can't check it and says so) |

Penance is checked lazily: the next time the player opens the chapel, the
route re-evaluates. Done → absolution.

### 3.4 Absolution (real effects, no money involved)

- `chapel.absolvedUntil = now + 24 h`.
- **A halo on the rig** for those 24 h: a small emissive ring add-on above the
  pump, visible to the whole field. Cosmetic, free, temporary. It is the only
  way to get it.
- **The tithe of mercy.** If a demon is summoned by the player's own hell
  breach while absolved, the bounty is still funded by their un-banked tank,
  but when the demon is banished the chapel returns **10 %** of that tank
  portion to them. Implemented in the banish transaction in
  `oil-demon-bounty/route.js`: read `summoner.chapel.absolvedUntil` at summon
  time, stamp `tithe: true` on the bounty doc, credit on banish. Ten percent
  is small enough not to change whether hell is worth risking, large enough to
  be a reason to confess.
- A feed line: "X was absolved."

Absolution never touches odds, the seed, the arena, or anyone else's plot.

## 4. Candles

Do **not** build a second candle system. The shrine's candle pipeline exists:
`candleRitual.js` writes `shrineCandlePrefs.<uid>.litAt`, the VigilRail and
CommunityCandles read it, and the burn-offering route credits RL80 burns to a
candle. The chapel's LIGHT A CANDLE button calls the same ritual (it is free
now and stays free), with one addition: while the candle is lit (inside the
shrine's own 8 h window) a **votive appears on the rig** — a candle add-on in
the add-on catalogue, rendered like the gravestone, not purchasable, shown by
`litAt`. Lighting a candle at the Midway therefore also lights it on the
shrine page, and vice versa. One flame, two altars.

The chapel's candle stand is the votive rack on the tent's left; the number of
candles burning on it is the number of players with a live `litAt` (real,
capped at the rack's 12 slots, sorted newest first, same as the VigilRail's
join).

## 5. Indulgences and burnt offerings (the micropayments)

Two rails, both already in the codebase, both **ritual and visibility, never
odds**. This keeps the commit-reveal fairness story intact and keeps the
casino next door out of real-money gambling.

### 5.1 Indulgence — USDC via x402 (the `oil-purchase` pattern)

An indulgence is a certificate for sins **not yet committed**. Price
`PREMIUM_PRICES.indulgence = { usdc: 2 }` (placeholder; Michelle sets it).
It unlocks `unlocked.indulgence_<seasonId>` on the user doc, exactly like a
theme or fence unlock, so the existing verify/settle path and receipt records
carry it. What the player gets:

- A certificate card in the cart, their name inscribed, "GOOD FOR ONE (1)
  HELL POCKET · VOID WHERE PROHIBITED · WHICH IS EVERYWHERE".
- A gilded frame on their rig nameplate for the season.
- A feed line: "X bought an indulgence. Hell has been notified."
- The chaplain's line changes: he greets them as "my benefactor".

Fine print in the cart, in the same voice: *"This indulgence has no effect on
the infernal strata, the seed, the demon, or your odds. The Company's
lawyers insisted we say so. The Company's chaplain insists it helps."* That
sentence is the joke and the compliance line in one.

### 5.2 Burnt offering — RL80 burn (the `burn-offering` route)

The root shrine already lets a wallet burn RL80 to the dead address and
credits the burn to their candle, verified from the receipt. The chapel shows
the same credit on its candle stand and in the book ("X burnt 40,000 RL80 for
their sins"). No new route; the chapel just reads it. This is the profane
rail: nothing flows to anyone, the token simply ceases to exist, which is the
most sincere form of contrition available on-chain.

### 5.3 What is deliberately not for sale

Absolution, penance skips, halo, the tithe, holy water (that is the salesman's,
paid in oil). If any of these ever take money, the chapel becomes pay-to-win
and the joke dies.

## 6. The chaplain's clue

Each Midway vendor carries a piece of the puzzle. His is **the unquiet
ground**: he hears every confession, so he knows where hell has been opened
and not capped.

- On step-up he reads, from the revealed `hellMap` and `hellCapped`, the
  **bearing and distance from the player's plot to the nearest uncapped
  infernal layer** and says it as a preacher would: "Two plots to the
  north-east the ground is open and nobody has closed it. I would not drill
  deep there. I would not drill there at all."
- He also states the field's **unconfessed breaches**: hell layers revealed
  this season minus confessions in the book. "Seven mouths of hell open on
  this field. Four confessed. Three of you are lying to yourselves."

Both numbers are real and both are useful: an uncapped hell layer next to an
open plot is the single most important thing a claim-jumper can know.

## 7. The book (public record)

`chapelBook` collection, read-only for clients, written only by the chapel
route. The cart's BOOK tab lists the last 20 entries: name, sins as pips
(🔥 breaches, 👹 summons, ⛏ jumps), the penance, done/undone, any indulgence
or burn credit. It is a leaderboard of sin, which is a leaderboard, which
players like.

## 8. Rails and rules

- Confession, penance, absolution, candle: free.
- Indulgence: USDC via x402, cosmetic. Burnt offering: RL80 burn, cosmetic.
- Real money never changes odds, seed, arena, demon, or another player's plot.
- Every number he speaks is read from the record (the "UI numbers must be
  real" rule applies to speech too).
- The chapel never contradicts Our Lady: she blesses, he absolves. If a
  player holds a standing blessing (`rl80:grace` is device-local, so the
  chapel cannot read it) he does not mention it. If the grace ledger ever
  moves to Firestore, he can.

## 9. Assets — what exists, what Michelle makes, what I make

**No church building is needed, and none should be used.** The strip is
wagons and tents; a mini chapel building would sit off-register and cost a
Blender search. A **tent-revival chapel** assembles from packs already on
this machine:

| Piece | Model | Pack (on disk) |
|---|---|---|
| The tent | `SM_Bld_Tent_02` (open front) | Western Frontier, already in the strip |
| Pews ×2 | `SM_Prop_Pew_01` | `~/Dark Fantasy/…/PolygonDarkFantasy/Models` |
| Pulpit | `SM_Prop_Church_Lectern_01` | `~/Fantasy Kingdom/…/PolygonFantasyKingdom/Models` |
| Altar (behind him) | `SM_Prop_Altar_01` | `~/DarkFORTRESS/…/PolygonDarkFortress/Models` |
| Votive rack | `SM_Prop_Candle_Rack_01` + `SM_Prop_Candle_0x` | Dark Fantasy |
| Bell on a post | `SM_Prop_Bell_Small_01` | Fantasy Kingdom |
| **Confessional** | `SM_Veh_Wagon_Jail_01` — a jail wagon, barred window as the grille | Western Frontier |
| Sign | `SM_SignFolding_01` (in the strip) with a "CONFESSIONS · CANDLES · INDULGENCES" decal | strip |
| Bell sound | `~/Downloads/churchBell.mp3` (74 KB) on step-up | hers |

The jail wagon as confessional is the pick: sin goes in, the bars are the
screen, and it is the same wagon family as the fortune teller's so the card's
back view has an interior to look into. The alternative gag is the outhouse
(`SM_Bld_Outhouse_01`), funnier for one second and worse for the rear view.
(The Culture Club track in Downloads is not usable; it is copyrighted.)

**Michelle makes** (her pipeline, `~/Documents/Blender/Vendor_*.blend`):
- The chaplain: a Synty body wearing `SM_Chr_Attach_Priest_Hat_01` (Dark
  Fantasy or Fantasy Kingdom, both on disk; Dark Fantasy also has the veil),
  exported as `Vendor_Chaplain_Character.glb` with `idle` and `talking` clips
  and `Face1`–`Face3` for the SitePal projection, in the strip frame like the
  others. Optional second pose `preaching` for the open card.
- A SitePal scene for him (sceneId) and an ElevenLabs voice through the
  SitePal account; I fill `vendorSitePal.js`.
- Final placement in the strip `.blend` and the re-export, once the placeholder
  reads right.

**I make** (no Blender file of hers touched):
- A placeholder `stall_chapel.glb` assembled headlessly from the FBX pieces
  above via the Blender bridge into a **new** file, in the strip's frame and
  the taco window, so the phone card and the desktop stall can be built and
  tuned before her final placement. Her strip stays the source of truth; when
  she places the real chapel, `extract-stalls.mjs` regenerates the stall.
- Everything in code: catalogue entry, Midway card + staging tune, cart tabs
  (CONFESS · CANDLE · INDULGENCE · BOOK), `oil-chapel` route with ledger /
  confess / penance check / absolve, the tithe in the banish transaction, the
  halo and votive add-ons, feed events, the book, the indulgence price entry,
  SitePal greetings and the ledger speech, the bell.

## 10. Build order

1. Catalogue + placeholder stall + card (phone and desktop), alien retired.
   Verify headless.
2. `oil-chapel` route: ledger + confess + book + feed. He reads the ledger
   aloud. Verify with `?mockfield=1` and a signed-in dev account.
3. Penance check + absolution + halo add-on + tithe in banish.
4. Candle button → shrine ritual + rig votive add-on.
5. Indulgence: price entry, x402 unlock, certificate card, nameplate frame.
6. Burn credit shown on the stand and in the book.
7. Her character and SitePal scene land; swap the placeholder body.

## 11. Open questions for Michelle

- Indulgence price (2 USDC placeholder) and whether it is per season or forever.
- Tithe size (10 % proposed).
- Name on the sign: "CHAPEL", "MISSION", or "THE COMPANY CHAPEL".
- His name. Working name: **Brother Deacon** (a deacon is not a priest, which
  he'd rather you didn't look up).
