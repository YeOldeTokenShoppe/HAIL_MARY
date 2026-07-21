# Genesis First Twelve — Art Direction Briefs (v2)

*Companion to GENESIS.md §5 (card art pipeline). These are the twelve actions
live at the case table (`FIRST_TWELVE`, caseKit.js) — every character, every
kit role, every rarity tier including the set's showpiece foil.*

*v2 (2026-07-18): style redirect after the first Audit Flare take. v1's
"neon-noir" language generated dark, photoreal, horror-adjacent output. The
set's true anchors are the existing Pump Signal / MoonPony cards and the
low-poly /trade scene: bright, saturated, cel-shaded, toy-like FUN —
Pokémon-card energy in the RL80 universe. Sacred + terminal, but
Saturday-morning, not Blade Runner.*

---

## Style bible (applies to every card)

**Format.** Raw artwork only: portrait, 1488×2076 (retina), **no frames, no
text, no logos** — `TradingCard.jsx` supplies frame, name, stats, ability box,
and foil. Compose for the template: the art window favors the **upper 40%**
(artFocus lands ~center 28–35%), so the focal subject lives in the upper
third-to-half. Keep the **bottom 45% simpler and slightly less busy** — the
ability box and flavor text sit over it (simpler ≠ black; a clean color
gradient or desk surface is perfect). Nothing critical in the outer 6%.

**World.** The Liminal Terminal: a candy-neon trading floor — synthwave
grids, glowing tickers, votive candles next to mechanical keyboards, halos
and tiny wings. Sacred + terminal, played with a wink. This is the RL80 /
Our Lady of Perpetual Profit universe — mythology artifacts, not generic
crypto art, and not grimdark.

**Rendering — the big v2 correction.** Cel-shaded / anime-influenced TCG
illustration: bold clean linework, flat-to-soft shading with 2–3 tone steps,
glossy toy-like highlights, chunky rounded shape language (kin to the
low-poly /trade characters and the Pump Signal card). Expressive and
energetic — objects can be cute, hands are friendly and chunky, never
skeletal or photoreal. Think modern Pokémon TCG item/supporter cards:
readable at thumbnail, joyful at full size.

**Light & color.** BRIGHT. Saturated station color dominates (~60% of the
light), supported by complementary pops and pastel fills — never more than
~25% of the frame in true dark. Backgrounds are colorful and populated
(props, glows, pattern wallpaper of the station's world), not voids.
Light sources are diegetic and cheerful: screens, candles, flares, halos.

**Palette anchors.** Station colors carry identity: GR80/ETHOS mint-cyan
`#53ffd6` on deep-teal grounds · Barron/PATHOS red-orange `#ff5b45` + fire
golds on plum grounds · Marisol/LOGOS gold `#f6d365` on indigo grounds ·
Eugene/MYTHOS pink `#ff7ad9` on violet grounds. Accents: cream `#fff7ce`,
amber `#ffd166`, beam cyan `#35e8ff`. Grounds are *colored*, not black.

**Recurring motifs (use, don't exhaust):** candlestick charts, votive
candles, halos and wing hints, chain links, ledger books, playing cards as
physical objects, star-sparkles, the four-color thread, the projector beam.

**Faces (the mascot rule — settled during cards 9–10).** The set's
creature species may put a face on something only where that thing is
EXPERIENCING the mechanic (the price line being saved in Neon Stop Loss:
yes; a decorative smile on Candle Vigil's candle: no). Characters act;
objects at rest stay objects. Prompt "no face on X" explicitly for
protected objects — the generator has thoroughly learned this universe
puts faces on things.

**Template geometry (measured via crop simulation).** On the rendered
card the name bar covers ~ the top 11.5% and the ability/flavor box ~ the
bottom 38%: the visible art window is ~11.5–62% of frame height. Most run
images land near the card's 744:1038 aspect, so zoom 1.0 leaves almost no
vertical slack — anything below ~62% will sit under the box. Keep the
focal inside the window; confirm with the /card-template Art Y + Zoom
sliders, then copy the final numbers into CARD_ART.

**Rarity intent.** Commons: one clear idea, clean and cheerful (subtle
foil). Uncommons: one idea + one flourish. Rares: a cinematic light moment,
still bright ("v" foil — leave diagonal highlight room). The terminal-foil
gets the radiant treatment — paint it already glowing.

**Prompt-craft notes (words that work / words that bite).** DO say:
cel-shaded, bold clean linework, saturated, vibrant, playful, chunky,
rounded, glossy, toy-like, sparkles, bright bounce lighting, colorful
background. DON'T say: neon-noir, void, deep shadows, volumetric gloom,
cinematic dark, photoreal — v1 proved the generator takes those straight to
Gotham.

---

## The Lens Key family — shared template ("The Slide")

The four lens keys are mechanically identical siblings; make them a visual
family. **Shared composition:** first-person view across a counselor's desk.
The counselor's hand (hand/forearm only — keep faces for trader cards),
rendered chunky and friendly, slides **two glowing evidence cards**
face-down toward the viewer across a colorful desk. Station color floods
the scene from that station's signature light source; the background is that
character's world in bright props. Focal band ~30% from top; desk surface
simplifies toward the bottom (text-safe). Same layout, four recolors —
instant family read in the binder.

---

## 1. AUDIT FLARE — lens key · GR80/ETHOS · common

**The idea.** An audit as a tiny celebration of clean books. GR80's chunky
chrome monk hand slides two mint-glowing cards toward you while a **cyan
flare shoots up from an open ledger like a sparkler firework** — truth as
a light you send up, and it's *delightful*.

**Focal.** The flare-burst above the ledger at ~30% from top, scattering
star-sparkles that catch on the chrome knuckles and card edges.

**Composition.** Teal desk, gentle diagonal. Open ledger center-left with
cheerful scribble-glyphs (no real text). GR80's rounded segmented chrome
hand enters upper right mid-slide. His green halo ring floats as a soft
emblem in the upper background — his signature without his face. Background:
pastel server-monastery shelf with candle jars in mint and cream.

**Palette.** Dominant `#53ffd6` + cream `#fff7ce`; deep-teal ground (not
black); one amber candle pop.

**Mood.** Cheerful precision — the joy of a ledger that balances.

**Avoid.** Photoreal chrome, skeletal fingers, black void, horror candles,
readable text.

**Prompt seed.** *Vibrant trading-card-game illustration, cel-shaded anime
style with bold clean linework and saturated colors: a friendly chunky
chrome robot-monk hand with rounded segmented fingers cheerfully slides two
glowing mint-green playing cards across a teal desk toward the viewer; a
bright cyan flare bursts up from an open ledger book like a sparkler
firework, scattering star sparkles; glowing green halo ring floating above,
colorful candle jars and pastel server racks in the background, bright
bounce lighting, glossy toy-like surfaces, playful energetic mood, rich
mint-cyan and cream palette on a colorful teal background, no text,
upper-weighted composition.*

---

## 2. FORKED RUMOR — lens key · Barron/PATHOS · common

The Slide in party-fire mode. Barron's suit hand (red cuff, gold cufflink)
slides the cards while above the desk a **glowing ticker line forks into two
diverging red-orange ribbon paths** — a road-sign made of price action, one
path burning brighter (the version people will choose to believe). Confetti
embers, cartoon flame licks, plum-purple ground packed with blurred neon
signs and emoji-style hype stickers (echo Pump Signal's chat bubbles).
Mood: deliciously tempting. Avoid: menace, realistic fire.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a suited hand with red cuff and gold cufflink slides
two glowing card backs across a plum-purple desk toward the viewer; above
the desk a neon price ticker line forks into two diverging red-orange
glowing ribbon paths, one brighter, with cartoon flame licks and confetti
embers; colorful neon signs and playful hype stickers in the background,
bright bounce lighting, glossy toy-like look, mischievous fun mood, red-
orange and gold palette on plum, no text, upper-weighted composition.*

---

## 3. WALLET SÉANCE — lens key · Marisol/LOGOS · common

The Slide as friendly forensic ritual. Marisol's hand (leather watch strap)
slides the cards; above the desk floats a **golden constellation of linked
wallet nodes** summoned séance-style, one node blinking guilty-bright with
a little "!" energy. A magnifying loupe on the desk catches the glow; a
cute candle flickers at frame edge for the séance wink. Indigo ground,
gold `#f6d365` dominant. Mood: the ledger has secrets and telling them is
fun. Avoid: skulls, spooky fog, black void.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework:
a woman's hand with leather watch strap slides two glowing card backs
across an indigo desk toward the viewer; above the desk floats a cheerful
golden constellation of linked wallet nodes like a summoned spirit diagram,
one node blinking bright; magnifying loupe on the desk catching golden
light, cute votive candle at frame edge, saturated gold and indigo palette,
bright bounce lighting, glossy toy-like surfaces, playful detective mood,
no text, upper-weighted composition.*

---

## 4. MEMPOOL PROPHECY — lens key · Eugene/MYTHOS · common

The Slide gone happily oracular. The two cards slide toward you across a
desk strewn with tarot-worn chart printouts, lit by a **crystal-ball
terminal** — a glass sphere with pending transactions swirling inside like
glittery tea leaves, pink `#ff7ad9` glow, fractal filigree curling at its
edges. Violet ground, star-sparkles. Mood: pattern-madness as second
sight, played charming. Avoid: readable text in the sphere, literal
unicorns (saved for Eugene's trader card).

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a hand slides two glowing card backs across a violet
desk toward the viewer; center, a cute crystal-ball computer terminal glows
bright pink with sparkly abstract transaction symbols swirling inside like
tea leaves, ornate fractal filigree curling at its edges; scattered
tarot-style chart cards on the desk, star sparkles in the air, saturated
pink and violet palette, bright bounce lighting, whimsical prophetic mood,
glossy toy-like look, no text, upper-weighted composition.*

---

## 5. COLD WALLET — deep scan · GR80 · uncommon

**The idea.** The cold archive opened — as a wonder, not a crypt. A big
friendly **vault door ajar**, mint light pouring out across tidy shelves of
hardware wallets displayed like treasures in a museum-reliquary, frost
sparkles in the air like tiny stars. A faint halo ring glows deeper inside.
Viewer at the threshold. Ice-blue-to-teal ground, `#53ffd6` dominant,
cream highlights. Flourish (uncommon): the frost-sparkle field. Mood:
"everything he still holds," and it's beautiful.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework:
a big friendly vault door stands ajar spilling bright mint-cyan light into
a sparkling frost-blue archive room with tidy glowing shelves of small
treasure-like hardware devices; frost sparkles floating like tiny stars, a
soft glowing halo ring deep inside, saturated ice-blue and mint palette,
bright magical lighting, glossy toy-like surfaces, wondrous mood, no text,
no figures, upper-weighted composition.*

---

## 6. CHART EXORCISM — deep scan · Marisol · uncommon

**The idea.** Dragging out what the chain hides — as a cartoon exorcism. A
big candlestick chart on a wall-screen **wiggles dramatically** while a
golden scanner beam yanks a grumpy little shadow-blob of hidden
transactions halfway out of it — the blob resists, comically stretched.
Gloved hand with the gold UV-wand at frame edge. Indigo room full of
colorful evidence pinboards. Gold beam dominant. Mood: righteous and
funny — gotcha! Avoid: horror, gore, actual demons.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a large wobbling candlestick chart on a wall screen
as a bright golden scanner beam from a handheld wand drags a grumpy little
dark blob creature of hidden data halfway out of the chart, blob comically
stretching; gloved hand holding the glowing wand at frame edge, colorful
evidence pinboard background, saturated gold and indigo palette, bright
bounce lighting, playful gotcha mood, glossy toy-like look, no text,
upper-weighted composition.*

---

## 7. ORACLE CROSSCHECK — cross-reference · LOGOS+ETHOS · rare

**The idea.** Two lenses agreeing. In a bright chamber, a **gold beam and a
mint beam cross mid-air**, and exactly at the intersection a small floating
sigil-card ignites cream-white — visible only where both lights touch.
Rare tier: cinematic but bright — clean dramatic beams, sparkle burst at
the crossing point, colorful prism haze around the overlap (leave a clean
diagonal for the "v" foil). Focal: intersection ~30%, slightly left.
Mood: revelation by triangulation, staged like a magic trick landing.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework:
in a bright airy chamber, a golden light beam and a mint-cyan light beam
cross mid-air, and at their glowing intersection a small floating ornate
card ignites in cream-white light with a sparkle burst; colorful prism
haze around the crossing point, saturated gold and mint palette on a soft
indigo background, dramatic but bright staging, glossy magical mood, no
text, no figures, upper-weighted composition.*

---

## 8. RUG WARNING — exit trace · rare · APPROVED (Rugula debut)

**Final concept (supersedes the fingerprint-trail-only brief).** Rugula's
debut card: the vampire count mid-tablecloth-trick, yanking a patterned rug
out from under a teetering tower of jewel chips — coins suspended in the
beat before the crash, monocle popping, glowing amber fingerprints on the
fabric where he grips it, exit door aglow in the background. The card shows
what the exit-trace tool CATCHES: a rug-pull in progress. Full character
canon in the Rogues addendum below (his design here is the locked
reference: widow's peak, purple eyes, cravat, navy coat).

**Approved art:** actionRugWarning — wire at `artFocus: "center 34%",
artZoom: 1.0`. Rare "v" foil: preview the diagonal sweep against the rug's
pull-line at /card-template; they align beautifully.

**Grammar note.** This is the ONE villain-starring action of the First
Twelve, sanctioned because the tool exists to catch him (specialist-debut
rule, Rogues addendum §"Where villains live"). Lens keys and deep scans
stay character-free. The retired take-1 art (high-angle fingerprint rug,
no character) survives as alt-art if ever wanted.

---

## 9. CANDLE VIGIL — shield · common · APPROVED (regen 2)

**Final concept (supersedes the flame-as-chart-bar idea).** A real votive
candle with a real warm flame inside the brass storm lantern — the chart
moved to the THREAT: the wind outside the glass is a gust of glowing red
candlestick bars, streaming and orbiting the lantern, bending around the
glass. Market storm = red candles; flame = your position; glass = the
shield. Causal metaphor, one idea, no face on the candle (mascot rule).
All wind candles stay RED — the mechanic absorbs a NEGATIVE flip; mixing
in green reads as ordinary market weather and defangs the threat. The
faint green bokeh on the distant tables is the right amount of green.

**Approved art:** actionCandleVigil.png (regen with the lantern raised and
an empty wooden ledge across the bottom third) — wire at
`artFocus: "center 34%", artZoom: 1.0`. Take 1 (chart-bar flame, smiling
candle) retired as alt-art; its brasswork was the keeper detail.

---

## 10. NEON STOP LOSS — stop loss · uncommon

**The idea.** The floor that catches you. A green price-line character
plunges down a chart cliff and lands — *boing* — on a **glowing
cyan-to-magenta neon safety bar** stretched across the fall line, with a
starburst bounce impact. Below the bar: calm cool gradient, not void.
Above: cartoonish tumbling red candles. Uncommon flourish: the impact
starburst. Mood: mechanical mercy, played like a trampoline save.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a glowing green price line plunges down a stylized
chart cliff and bounces on a bright horizontal neon safety bar with a
cyan-to-magenta gradient, starburst impact sparkles at the bounce point;
cartoon red candlestick blocks tumbling above, calm cool blue gradient
below the bar, energetic rescue mood, bright lighting, glossy toy-like
look, no text, upper-weighted composition.*

**APPROVED.** The take upgrades the brief twice: the bar visibly SAGS
mid-catch (trampoline physics on chain-anchored posts) and the rebound
arrow completes the plunge–catch–bounce story in one arc. The price
line's startled face STAYS — it passes the mascot rule (the line is
experiencing the save; the face is the comedy beat that makes the catch
read as a rescue). Near-card aspect, minimal slack: wire at
`artFocus: "center 32%", artZoom: 1.0`; if the impact starburst clips
under the ability box, push Art Y to 70–80% with zoom ~1.08 (cost: a
sliver of the tumbling candles up top).

---

## 11. INSIDER PING — wiretap · uncommon

**The idea.** One sealed number, overheard — spy-comedy, not thriller. A
shiny **brass wiretap clip with little legs** (gadget-cute) bites onto a
fat glowing data cable in a colorful cable-run, an amber signal pulse
zipping along it; above the clip a small holographic sealed envelope pops
open with a "!" sparkle. Teal-and-amber palette, headphone at frame edge.
Uncommon flourish: the traveling pulse glow. Mood: sneaky-delightful.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework:
a cute shiny brass spy-gadget clip clamps onto a fat glowing data cable in
a colorful cable run, a bright amber signal pulse zipping along the cable;
above the clip a small holographic sealed envelope pops open with a
sparkle; toy headphones at frame edge, saturated teal and amber palette,
bright playful lighting, sneaky fun spy mood, glossy toy-like look, no
text, upper-weighted composition.*

---

~**APPROVED.** Brass spider-leg clamp biting the cable (correctly
face-free — a tool doing a job), amber pulse-dots traveling INTO the tap,
sealed envelope popping open with the golden "!" at the moment of the
peek, toy headphones at frame edge. Happy accident kept as canon: of the
rainbow cable run, the tapped cable is MINT — tonight's wiretap victim is
GR80. (Alt-art idea, if ever: same scene, pink cable.) Wire at
`artFocus: "center 30%", artZoom: 1.0`; if the "!" tip clips under the
name bar, nudge to 32%.

---

## 12. TERMINAL FOIL MOMENT — wildcard · terminal-foil ★

**APPROVED (take 3, 2026-07-21).** Time frozen — suspended coffee pour,
floating pen, motionless confetti, held-breath crowd with clean faces —
and all FOUR station beams landed, one per desk: mint, magenta-pink,
gold, red-salmon. The foil's light touches every station: the set's
showpiece, as designed. Takes 1 (cheering crowd, runner-up) and 2 (two
beams) precede it; keep their files. Wire at `artFocus: "center 31%",
artZoom: 1.0` and preview with the RADIANT foil at /card-template.

**The idea.** The desk stops — in wonder. The whole candy-neon trading
floor frozen mid-gesture: tickers halted between digits, a thrown pen
hanging in air, confetti suspended — while **one radiant playing card
hovers at dead center**, beaming a four-color prismatic starburst (mint,
red-orange, gold, pink) that washes the whole scene. Time belongs to
whoever holds it. The set's showpiece: paint it already glowing for the
radiant foil; lens-flare and god-rays permitted here and only here — but
bright ones, jubilant not ominous. The card is the only perfectly sharp
object; everything else is gently frozen mid-motion. Mood: the held breath
of the whole market, right before the cheer.

**Prompt seed.** *Spectacular vibrant TCG illustration, cel-shaded with
bold linework and saturated colors: a candy-neon trading floor frozen in
time — halted glowing tickers, a pen suspended mid-air, colorful confetti
hanging motionless — while one radiant playing card hovers at dead center
beaming a prismatic four-color starburst of mint, red-orange, gold and
pink light across the scene; jubilant god rays, sparkles, the card
perfectly sharp while everything else is gently frozen, bright euphoric
mood, glossy toy-like look, no readable text, upper-weighted composition.*~

---

## Batch notes

- **Generate the four lens keys in one session** with the same seed/style
  reference so The Slide family reads as siblings — recolor + re-prop, not
  re-invent.
- **Anchor every generation on your existing winners:** if your tool takes
  image references, feed it the Pump Signal and MoonPony art. They already
  ARE the style; the prompts above describe them in words.
- Order of attack: Audit Flare (sets the family), the other three keys,
  Candle Vigil (fast single-object charm), the two deep scans, the
  specialists, and save **Terminal Foil Moment for last** — most
  iterations, most shares.
- Wire each finished piece as a `CARD_ART` entry (`src`, `artFocus`,
  `artZoom`) and eyeball at `/card-template` with the foil style set to
  the card's rarity tier.
- These twelve double as the style bible's proof run: if they hang
  together, the remaining 64 follow the same anchors (station color
  dominance, upper-weighted focal, bright diegetic light, cel-shaded fun,
  no text/frames).





  ## Art run status (2026-07-21)

Approved 12/12 — THE FIRST TWELVE ART RUN IS COMPLETE (2026-07-21).
Wiring values (zoom 1.0 unless noted):

| Card | Status | artFocus |
|---|---|---|
| Audit Flare | approved + wired | center 28% (confirmed) |
| Forked Rumor | approved (pinky inpainted) + wired | center 28% in repo; check arrowheads, 30–32 if clipped |
| Wallet Séance | approved | center 31% |
| Mempool Prophecy | approved | center 33% (protect the ball's crown) |
| Cold Wallet | approved (mint regen) | center 34% |
| Chart Exorcism | approved | center 30% |
| Oracle Crosscheck | approved | center 36% (V foil ↔ beam-X) |
| Rug Warning | approved (Rugula debut) | center 34% (V foil ↔ rug diagonal) |
| Candle Vigil | approved (regen 2: red candle-wind, real flame, no face) | center 34% |
| Neon Stop Loss | approved (face kept per mascot rule) | center 32%; if starburst clips: Art Y 70–80% + zoom ~1.08 |
| Insider Ping | approved (mint cable tapped — GR80 is tonight's victim) | center 30%; if the "!" clips under the name bar: 32% |
| Terminal Foil Moment | approved (take 3: frozen floor, four station beams) | center 31% · RADIANT foil |

---

# The Rogues of the Liminal Terminal — Villain Gallery Addendum

*Addendum to the First Twelve art briefs. Born from Rugula's debut on Rug
Warning (2026-07-21). The Pokémon insight: fandoms attach to characters.
The set's fiction is wall-to-wall villains — the CASE_PATTERNS vocabulary
in cards.js is a rogues gallery already named and waiting for bodies.*

---

## Where villains live (set grammar)

- **Coin cards are their home.** Every rug/zombie coin's `caseRef` is a
  villain's case file. The villain IS the case — put them on the coin art,
  caught doing exactly what the dossier note describes. This turns the coin
  run from landscapes into a collectible rogues roster.
- **Specialist actions may host a debut** when the tool exists to catch
  that villain (Rug Warning → Rugula, caught by the exit trace). Lens keys
  and deep scans keep their established tool/scene grammar — no villains
  there, or the cycle logic dissolves.
- **Market cards are cameo territory.** Rug Harvest is literally Rugula's
  harvest. Meme Season, Protocol Exploit, Regulator Sweep all have natural
  villain cameos. A villain seen "at large" on a market card and "case
  closed" on a coin card gives collectors a story arc across the set.
- **Legit patterns don't get villains.** Doxxed-clean, infra-grind,
  stealth-launch, redemption-arc coins stay heroic/landscape — or later
  get *guardians* (a separate, calmer species). Scarcity keeps the rogues
  special: villains appear only where a crime happened.

## Villain design language (the Rugula canon)

- **Cel-shaded, chunky, glossy — same species-language as the mascot-bots.**
  The rogues are the bots' wicked cousins, not a different art style.
- **The body is the crime.** Rugula IS a rug. Every rogue's anatomy is
  built from the thing they exploit — the scam made flesh. This is the
  franchise rule; it makes each design self-explanatory.
- **Mischief, not menace.** Huge grins, caught-in-the-act poses, delighted
  self-awareness. Villains you're happy to pull from a pack.
- **Faces are DRAWN, not carved.** (Rugula take-1 lesson.) Eyes have pupils
  and lids, grins have teeth, brows scheme — features in linework with glow
  as rim-light accent only. Glowing jack-o-lantern cutouts read as a mask:
  zero acting range, zero fandom attachment. If the face can't look sly,
  smug, AND caught, it isn't done.
- **Villains get bright scenes too.** Rogue cards obey the same
  no-more-than-~25%-true-dark rule as the rest of the set — caper-movie
  spotlights, light floors, bounce fill. Dark palettes ≠ dark scenes.
- **One signature color + gold.** Each rogue owns a hue (Rugula:
  red-violet). Gold thread/trim is the shared "rogue" tell across the
  gallery.
- **Original silhouettes only.** Inspired by the *appeal* of classic
  designs, never the shapes. No Gengar, no Meowth, no King Boo.
- **Evidence motif.** Each rogue trails the forensic sign that catches
  them (Rugula: fingerprints). The tool-cards' iconography and the rogues'
  tells interlock.

---

## The gallery (one rogue per crooked pattern)

### RUGULA ★ (canon — vampire design; the name was always Rug + Dracula)
- **Pattern:** the rug-pull itself; patron rogue of the whole gallery.
- **Body:** a dapper little vampire count whose cape IS the carpet —
  red-violet, gold pattern-weave, tassel hem (body-is-the-crime preserved).
  Widow's peak, sly fanged smirk, expressive drawn eyes with pupils and
  arched brows (the "faces are DRAWN" rule made him possible), optional
  monocle mid-pop.
- **Signature move:** the tablecloth trick — yanking a rug out from under
  a teetering tower of coins/chips, everything suspended in the beat
  before the crash. His cards are action shots of the idiom.
- **Haunts:** Rug Warning (action, debut) · BlackPalm, RugProof coins ·
  Rug Harvest market (cameo: a field of rolled rugs under a harvest moon).
- **Tell:** glowing fingerprint whorls where he grips the fabric.
- **Design lineage note:** take 1 (the carpet-ghost with jack-o-lantern
  face) is retired but taught two canon rules: faces are drawn, not
  carved; villain scenes stay bright. Its rolled-rug silhouette may
  return someday as Rugula's minion species ("ruglets").

### DEPLOYDRA
- **Pattern:** `serial-deployer` — fresh wallet, mixer funding, cloned
  contract; the assembly-line rug.
- **Body:** a hydra whose every head is *identical* — same face, same
  grin, stamped like photocopies; necks emerge from a mixer-barrel body.
  New heads bud mid-scene. Signature color: toxic lime.
- **Haunts:** future serial-deployer coins; cameo potential on any
  "new listing" market art.
- **Tell:** identical contract-scrolls, serially numbered.

### THE SIREN (Ponzi Siren, already named in the set)
- **Pattern:** `yield-mirage` — the APY was the product, paid from the
  door not the vault.
- **Body:** a mermaid whose tail is a waterfall of coins flowing *upward*
  (the payout that defies gravity) singing into a vintage microphone;
  beautiful from the front, an empty vault visible behind her.
  Signature color: sea-teal + gold.
- **Haunts:** Ponzi Siren coin (her card IS her) · Volatility Mass cameo.
- **Tell:** the 12-day hourglass, nearly empty.

### FORKLOK
- **Pattern:** `backdoor-fork` — honest-looking fork with a latent admin
  door.
- **Body:** a sturdy, trustworthy-looking little vault-golem, front all
  audited-and-tidy — with a tiny gold door in its back, slightly ajar, key
  on a chain it pretends isn't there. Signature color: steel blue.
- **Haunts:** BlackPalm coin (drained day 40) · Protocol Exploit market
  (cameo: the key under the mat).
- **Tell:** one key nobody audited.

### VAPORINA
- **Pattern:** `slick-but-broken` — beautiful pitch, hollow mechanics.
- **Body:** a dazzling hologram diva, gorgeous rendered front half; walk
  around her and she's unshaded wireframe held up by a single clothespin.
  Signature color: iridescent magenta.
- **Haunts:** VaporwareX coin ("the demo was a video") · RugProof coin
  (the actuary was the rug).
- **Tell:** a play-button that loops the same three seconds.

### SHILLBIRD
- **Pattern:** `celeb-shill` — rented influence, borrowed trust.
- **Body:** a gilded parrot in tiny designer sunglasses perched on a
  megaphone, coin-slot on its back; it says whatever was last deposited.
  Speech bubbles echo Pump Signal's sticker language. Signature color:
  hot pink + gold.
- **Haunts:** Bullish Ink coin (signed by every influencer of the season) ·
  Demon Desk coin (Barron's tuition) · Influencer Eclipse market (cameo:
  Shillbird gone dark mid-squawk — the funniest image in the set, free).
- **Tell:** the invoice.

### GASPER
- **Pattern:** `hype-fizzle` — loud launch, slow leak, no rug, just an
  empty room.
- **Body:** a goblin-shaped balloon at 60% inflation, proudly posing while
  visibly deflating from a tiny untied knot; confetti from a launch party
  nobody attends settles around it. Signature color: swamp green.
- **Haunts:** GoblinGas coin (the joke got old before the liquidity did) ·
  Wick Street coin · Dead Chain Hour market (cameo).
- **Tell:** the slow hiss — drawn as tiny musical notes escaping.

### FOMOGRE
- **Pattern:** `meme-mania` (its zombie endings) — pure crowd momentum,
  no floor.
- **Body:** a big friendly ogre built entirely of stacked green candles,
  sprinting somewhere with enormous urgency; where he's already passed,
  the candles have gone red and crumbled — he can never stop running.
  Signature color: candle green/red split.
- **Haunts:** Lucky Capsule coin (the crowd ran out of quarters) · Meme
  Season market (cameo, sprinting past Barron's desk).
- **Tell:** the crumbling red trail behind him.

### EMISSIO
- **Pattern:** `bad-tokenomics` — real product strangled by its own
  emissions.
- **Body:** an earnest fountain-spirit lovingly watering a little garden —
  with a firehose of its own coins, flooding everything it's trying to
  grow. It doesn't understand why the garden keeps drowning. The gallery's
  tragic rogue. Signature color: waterlogged violet.
- **Haunts:** future bad-tokenomics coins.
- **Tell:** the emissions-curve chart, drawn as the fountain's spray.

---

## Rollout order

1. **Rugula** — done (Rug Warning). Canon reference for the species.
2. **The Siren** — next; the coin is already in the set, already named,
   and it's the textbook (`ponzi-siren`, flavor: "Paid the first pew with
   the last pew's tithe"). Rare-quality iteration budget.
3. **Shillbird + Gasper** — attach to existing coins (Bullish Ink,
   GoblinGas) whenever those coins enter the art queue.
4. Remaining rogues land with their patterns as the coin run progresses;
   market-card cameos come last, once each rogue's "wanted poster" look is
   locked on a coin.

## Consistency kit

The Rogues of the Liminal Terminal — Villain Gallery Addendum

Addendum to the First Twelve art briefs. Born from Rugula's debut on Rug
Warning (2026-07-21). The Pokémon insight: fandoms attach to characters.
The set's fiction is wall-to-wall villains — the CASE_PATTERNS vocabulary
in cards.js is a rogues gallery already named and waiting for bodies.


Where villains live (set grammar)


Coin cards are their home. Every rug/zombie coin's caseRef is a
villain's case file. The villain IS the case — put them on the coin art,
caught doing exactly what the dossier note describes. This turns the coin
run from landscapes into a collectible rogues roster.
Specialist actions may host a debut when the tool exists to catch
that villain (Rug Warning → Rugula, caught by the exit trace). Lens keys
and deep scans keep their established tool/scene grammar — no villains
there, or the cycle logic dissolves.
Market cards are cameo territory. Rug Harvest is literally Rugula's
harvest. Meme Season, Protocol Exploit, Regulator Sweep all have natural
villain cameos. A villain seen "at large" on a market card and "case
closed" on a coin card gives collectors a story arc across the set.
Legit patterns don't get villains. Doxxed-clean, infra-grind,
stealth-launch, redemption-arc coins stay heroic/landscape — or later
get guardians (a separate, calmer species). Scarcity keeps the rogues
special: villains appear only where a crime happened.


Villain design language (the Rugula canon)


Cel-shaded, chunky, glossy — same species-language as the mascot-bots.
The rogues are the bots' wicked cousins, not a different art style.
The body is the crime. Rugula IS a rug. Every rogue's anatomy is
built from the thing they exploit — the scam made flesh. This is the
franchise rule; it makes each design self-explanatory.
Mischief, not menace. Huge grins, caught-in-the-act poses, delighted
self-awareness. Villains you're happy to pull from a pack.
Faces are DRAWN, not carved. (Rugula take-1 lesson.) Eyes have pupils
and lids, grins have teeth, brows scheme — features in linework with glow
as rim-light accent only. Glowing jack-o-lantern cutouts read as a mask:
zero acting range, zero fandom attachment. If the face can't look sly,
smug, AND caught, it isn't done.
Villains get bright scenes too. Rogue cards obey the same
no-more-than-~25%-true-dark rule as the rest of the set — caper-movie
spotlights, light floors, bounce fill. Dark palettes ≠ dark scenes.
One signature color + gold. Each rogue owns a hue (Rugula:
red-violet). Gold thread/trim is the shared "rogue" tell across the
gallery.
Original silhouettes only. Inspired by the appeal of classic
designs, never the shapes. No Gengar, no Meowth, no King Boo.
Evidence motif. Each rogue trails the forensic sign that catches
them (Rugula: fingerprints). The tool-cards' iconography and the rogues'
tells interlock.



The gallery (one rogue per crooked pattern)

RUGULA ★ (canon — vampire design; the name was always Rug + Dracula)


Pattern: the rug-pull itself; patron rogue of the whole gallery.
Body: a dapper little vampire count whose cape IS the carpet —
red-violet, gold pattern-weave, tassel hem (body-is-the-crime preserved).
Widow's peak, sly fanged smirk, expressive drawn eyes with pupils and
arched brows (the "faces are DRAWN" rule made him possible), optional
monocle mid-pop.
Signature move: the tablecloth trick — yanking a rug out from under
a teetering tower of coins/chips, everything suspended in the beat
before the crash. His cards are action shots of the idiom.
Haunts: Rug Warning (action, debut) · BlackPalm, RugProof coins ·
Rug Harvest market (cameo: a field of rolled rugs under a harvest moon).
Tell: glowing fingerprint whorls where he grips the fabric.
Design lineage note: take 1 (the carpet-ghost with jack-o-lantern
face) is retired but taught two canon rules: faces are drawn, not
carved; villain scenes stay bright. Its rolled-rug silhouette may
return someday as Rugula's minion species ("ruglets").


DEPLOYDRA


Pattern: serial-deployer — fresh wallet, mixer funding, cloned
contract; the assembly-line rug.
Body: a hydra whose every head is identical — same face, same
grin, stamped like photocopies; necks emerge from a mixer-barrel body.
New heads bud mid-scene. Signature color: toxic lime.
Haunts: future serial-deployer coins; cameo potential on any
"new listing" market art.
Tell: identical contract-scrolls, serially numbered.


THE SIREN (Ponzi Siren, already named in the set)


Pattern: yield-mirage — the APY was the product, paid from the
door not the vault.
Body: a mermaid whose tail is a waterfall of coins flowing upward
(the payout that defies gravity) singing into a vintage microphone;
beautiful from the front, an empty vault visible behind her.
Signature color: sea-teal + gold.
Haunts: Ponzi Siren coin (her card IS her) · Volatility Mass cameo.
Tell: the 12-day hourglass, nearly empty.


FORKLOK


Pattern: backdoor-fork — honest-looking fork with a latent admin
door.
Body: a sturdy, trustworthy-looking little vault-golem, front all
audited-and-tidy — with a tiny gold door in its back, slightly ajar, key
on a chain it pretends isn't there. Signature color: steel blue.
Haunts: BlackPalm coin (drained day 40) · Protocol Exploit market
(cameo: the key under the mat).
Tell: one key nobody audited.


VAPORINA


Pattern: slick-but-broken — beautiful pitch, hollow mechanics.
Body: a dazzling hologram diva, gorgeous rendered front half; walk
around her and she's unshaded wireframe held up by a single clothespin.
Signature color: iridescent magenta.
Haunts: VaporwareX coin ("the demo was a video") · RugProof coin
(the actuary was the rug).
Tell: a play-button that loops the same three seconds.


SHILLBIRD


Pattern: celeb-shill — rented influence, borrowed trust.
Body: a gilded parrot in tiny designer sunglasses perched on a
megaphone, coin-slot on its back; it says whatever was last deposited.
Speech bubbles echo Pump Signal's sticker language. Signature color:
hot pink + gold.
Haunts: Bullish Ink coin (signed by every influencer of the season) ·
Demon Desk coin (Barron's tuition) · Influencer Eclipse market (cameo:
Shillbird gone dark mid-squawk — the funniest image in the set, free).
Tell: the invoice.


GASPER


Pattern: hype-fizzle — loud launch, slow leak, no rug, just an
empty room.
Body: a goblin-shaped balloon at 60% inflation, proudly posing while
visibly deflating from a tiny untied knot; confetti from a launch party
nobody attends settles around it. Signature color: swamp green.
Haunts: GoblinGas coin (the joke got old before the liquidity did) ·
Wick Street coin · Dead Chain Hour market (cameo).
Tell: the slow hiss — drawn as tiny musical notes escaping.


FOMOGRE


Pattern: meme-mania (its zombie endings) — pure crowd momentum,
no floor.
Body: a big friendly ogre built entirely of stacked green candles,
sprinting somewhere with enormous urgency; where he's already passed,
the candles have gone red and crumbled — he can never stop running.
Signature color: candle green/red split.
Haunts: Lucky Capsule coin (the crowd ran out of quarters) · Meme
Season market (cameo, sprinting past Barron's desk).
Tell: the crumbling red trail behind him.


EMISSIO


Pattern: bad-tokenomics — real product strangled by its own
emissions.
Body: an earnest fountain-spirit lovingly watering a little garden —
with a firehose of its own coins, flooding everything it's trying to
grow. It doesn't understand why the garden keeps drowning. The gallery's
tragic rogue. Signature color: waterlogged violet.
Haunts: future bad-tokenomics coins.
Tell: the emissions-curve chart, drawn as the fountain's spray.



Rollout order


Rugula — done (Rug Warning). Canon reference for the species.
The Siren — next; the coin is already in the set, already named,
and it's the textbook (ponzi-siren, flavor: "Paid the first pew with
the last pew's tithe"). Rare-quality iteration budget.
Shillbird + Gasper — attach to existing coins (Bullish Ink,
GoblinGas) whenever those coins enter the art queue.
Remaining rogues land with their patterns as the coin run progresses;
market-card cameos come last, once each rogue's "wanted poster" look is
locked on a coin.


Consistency kit

When generating any rogue, anchor with: Rugula's final art (species/style
reference) + the relevant coin's palette. Prompt skeleton: "Vibrant TCG
illustration, cel-shaded, bold linework, saturated colors: [BODY-IS-THE-
CRIME design], huge gold grin, caught mid-[CRIME], [TELL] visible,
[SIGNATURE COLOR] + gold palette, glossy toy-like look, playful villain
energy, no text, upper-weighted composition, original character design."