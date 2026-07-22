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

**One starring coin per rogue (ruling, 2026-07-21).** A coin belongs to
exactly one rogue; co-haunting is reserved for MARKET cards, where two
rogues sharing a crowd scene is the point. This doc had double-booked
BlackPalm (Rugula + Forklok) and RugProof (Rugula + Vaporina) — Forklok's
debut art settled BlackPalm, so the pairs are **Forklok/BlackPalm,
Rugula/RugProof, Vaporina/VaporwareX**. The Haunts lines below and
`rogues.js` are corrected to match; keep it that way, so each rogue's
debut stays the one card that is unmistakably theirs.

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
- **Haunts:** Rug Warning (action, debut) · RugProof coin (his starring
  coin) · Rug Harvest market (cameo: a field of rolled rugs under a
  harvest moon). BlackPalm is Forklok's — released 2026-07-21.
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
- **Haunts:** VaporwareX coin ("the demo was a video") — hers alone.
  RugProof is Rugula's; her second appearance should be a market cameo.
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
   and it's the textbook (`ponzi-siren`, flavor: "Paid from the door,
   not the vault"). Rare-quality iteration budget.
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
Haunts: Rug Warning (action, debut) · RugProof coin (his starring coin) ·
Rug Harvest market (cameo: a field of rolled rugs under a harvest moon).
BlackPalm is Forklok's — released 2026-07-21.
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
Haunts: VaporwareX coin ("the demo was a video") — hers alone. RugProof
is Rugula's; her second appearance should be a market cameo.
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
and it's the textbook (ponzi-siren, flavor: "Paid from the door,
not the vault"). Rare-quality iteration budget.
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

---

# Batch 2 — The Coin Dozen (briefs 13–24)

*Queued 2026-07-21, the day the First Twelve closed. The coin run opens:
all seven starter-collection coins (the cards every new player actually
holds), six rogue debuts (executing Rollout steps 2–4 of the addendum
above), and two legit showpieces. Style bible, template geometry, and
prompt-craft notes from the First Twelve apply unchanged.*

*Anchor images to feed the generator: `coinCard_MoonPony.webp` for the
legit coins, `actionRugWarning.webp` for the rogues (add
`actionCard_PumpSignal.webp` when a brief calls for sticker-bubble
language). MoonPony and Rugula already ARE the two coin voices — the
briefs below describe them in words.*

## Coin-card grammar (applies to all twelve)

- **Two species of coin art.** A coin with a crooked `caseRef` is a
  wanted poster: its rogue caught mid-crime, doing exactly what the
  dossier note describes. A legit coin is a heroic artifact or landscape
  of the token's world — no villains ever (scarcity keeps the rogues
  special; addendum §"Where villains live").
- **The dossier note is the shot list.** Every coin's one-line `caseRef`
  note (cards.js) names the image. "Drained day 40" and "the crowd ran
  out of quarters" are stage directions, not flavor.
- **What MoonPony teaches** (the legit-coin proof): one adorable subject
  filling the upper half, mid-action, glossy toy highlights; the
  background is *populated* cosmos (nebula clouds, star-sparkles, a prop
  with a joke in it — the moon is cratered like cheese), not a void; the
  bottom third quiets to gradient for the text boxes.
- **What Rug Warning teaches** (the rogue proof): the villain acts in a
  BRIGHT jewel-toned scene, mid-idiom, monocle-popping delight; the tell
  (fingerprints) glows right where the crime touches the world; the
  background sells the setting (gem towers, glowing exit door) without
  crowding the act.
- **Rarity ladder unchanged:** commons one clear idea · uncommons one
  idea + one flourish · rares a cinematic-but-bright light moment with a
  clean diagonal for the "v" foil.

---

## 13. PONZI SIREN — coin · meme · common · rug (yield-mirage) · THE SIREN debut ★

**The idea.** Her card IS her (addendum canon). The Siren mid-performance:
a glamorous mermaid diva singing into a vintage gold microphone atop an
open vault door — and her tail is a sparkling waterfall of gold coins
flowing *upward*, the payout that defies gravity. Behind her, the vault
she performs on stands wide open and brightly, beautifully EMPTY. Paid
from the door, not the vault.

**Focal.** Her face and the mic at ~30% from top; the upward coin-tail
carries the eye down through center; empty vault shelves glow behind.
Bottom third: stage floor, a few stray coins, calm gradient (text-safe).

**Tell.** The 12-day hourglass, nearly empty, glinting at the stage edge.

**Palette.** Sea-teal + gold (her signature) on warm plum stage light —
the meme-station ground. Sparkles everywhere; zero gloom.

**Mood.** The best show in town, and the viewer has already spotted the
trick. Sly wink, huge charming grin — beautiful from the front.

**Avoid.** Disney-mermaid silhouette (original design only), spooky
darkness, realistic anatomy, readable text on coins or marquee.

**Iteration budget:** rare-grade takes even though the card is common —
she is the second species anchor; every later rogue leans on her.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold clean
linework and saturated colors: a glamorous cartoon mermaid siren with a
sly wink and huge charming grin sings into a vintage gold microphone,
her tail a glittering waterfall of gold coins flowing impossibly upward;
she performs atop a big friendly vault door standing wide open to reveal
brightly lit empty shelves; a nearly empty golden hourglass glints at
the stage edge, sea-teal and gold palette on warm plum stage lighting,
star sparkles, glossy toy-like look, playful villain energy, no text,
upper-weighted composition, original character design.*

**Take 1 wired (2026-07-21) — hourglass inpaint pending.** Wire:
coinCard_PonziSiren at `artFocus: "center 33%", artZoom: 1.0`. Two
generator upgrades canonized: the single fang that shows only when she
winks (the predator tell under the charm), and the outstretched hand
recruiting the VIEWER — the card seats you in the next pew. The scales-
becoming-coins transition on the lower tail satisfies body-is-the-crime.
Pending fix: the hourglass landed at ~83% frame height, inside the text
zone — inpaint it up onto the vault ledge (~40%) and re-export, keeping
the sand in the BOTTOM bulb (day 12 nearly up). Happy geometry accident:
the stage-floor coin pool also sits below the crop, so in the card
window the coins read as arcing upward, as designed. Her gallery slot at
/card-template is LIT (rogues.js status flipped). She is now the second
species anchor — feed her with Rug Warning for every rogue that follows.

---

## 14. BULLISH INK — coin · hype · common · zombie (celeb-shill) · SHILLBIRD debut

**The idea.** "Signed by every influencer of the season. The ink outlived
the signatures." Shillbird mid-squawk: the gilded parrot in tiny designer
sunglasses perched on a big megaphone, a gold coin dropping into the
coin-slot on its back, emoji-style hype stickers spraying from its beak
(Pump Signal's bubble language — feed that card as reference). Behind it,
a poster wall of autograph scribble-glyphs *fading to ghosts* — the ink
outliving the signatures. Tell: one small glowing invoice slip pinned
among them. Hot pink + gold on plum. Mood: it says whatever was last
deposited, and it's delighted about it. Avoid: readable words in bubbles
or autographs, real logos, gloom.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a gilded cartoon parrot wearing tiny designer
sunglasses perches on a huge megaphone, a gold coin dropping into a
coin-slot on its back, colorful emoji-style hype sticker speech bubbles
bursting from its beak; behind it a poster wall of fading autograph
scribbles with one small glowing invoice slip pinned up, hot pink and
gold palette on plum, bright bounce lighting, glossy toy-like look,
mischievous fun mood, no readable text, upper-weighted composition,
original character design.*

**APPROVED — take 1 (2026-07-21).** Wire: coinCard_BullishInk at
`artFocus: "center 30%", artZoom: 1.0`. The core gag lands in one frame:
coin mid-drop into the back slot WHILE the sticker burst leaves the beak
— pay-in and pay-out simultaneous, no caption needed. Canonized from the
take: the shades sit cocked so ONE big drawn eye shows (more acting
range than opaque lenses — keep this on every future appearance), and
the little gold sparkle-jet where the coin enters the slot. The invoice
tell pinned at ~40–52% height sits safely inside the art window — the
Siren's hourglass lesson, learned. His Demon Desk cameo (Barron's
tuition) is now unblocked for the desk-coin session.

---

## 15. GOBLINGAS — coin · meme · common · zombie (hype-fizzle) · GASPER debut

**The idea.** "The joke got old before the liquidity did." Gasper: a
goblin-shaped balloon at 60% inflation, proudly holding a ta-da pose on
a little launch-party stage while visibly deflating from one tiny untied
knot — the slow hiss drawn as tiny musical notes escaping (his tell).
Around him: confetti settling on an empty party table, drooping bunting
(shapes, no letters), one sagging balloon-weight. Nobody came. Swamp
green + party gold on warm plum. Mood: pride and physics, both funny and
a little poignant — the set's gentlest villain. Avoid: menace, actual
sadness-gloom (the scene stays bright), readable banner text.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a cute goblin-shaped balloon character at
sixty-percent inflation proudly striking a ta-da pose on a small party
stage while visibly deflating from a tiny untied knot, the escaping hiss
drawn as tiny musical notes; confetti settling on an empty party table,
drooping colorful bunting, one sagging balloon weight, swamp green and
gold palette on warm plum, bright cheerful lighting, glossy toy-like
look, comic bittersweet mood, no text, upper-weighted composition,
original character design.*

**APPROVED — take 1 (2026-07-21).** Wire: coinCard_GoblinGas at
`artFocus: "center 30%", artZoom: 1.0`, fx `Sparkle` at the default
`normal` blend (the overlay's confetti-glitter reads as party debris,
not magic — the one FX that adds to the gag instead of arguing with it;
`screen` was tried and only washes the plum background out). Canonized from the take: the
tied-off knot as a little gold-ringed nozzle on his belly with the hiss
leaving it as a gold sparkle-trail that becomes musical notes (keep the
sparkle-to-note handoff on every future Gasper), the gold balloon-weight
sacks, and the ta-da pose played wide-armed and genuinely delighted —
he does not know. The tell sits ~50–62% frame height, clear of the
ability box (the Siren's hourglass lesson holds). Deviation to correct
on any reprint: he reads closer to fully inflated than the brief's 60%,
and the empty table sits far enough right that "nobody came" lands
softer than intended — pull the deflation and the emptiness forward if
Gasper gets a second card. Art is exactly the card's 1488×2076 aspect,
so artFocus is inert at zoom 1.0 and is recorded for consistency only.

---

## 16. BLACKPALM — coin · defi · uncommon · rug (backdoor-fork) · FORKLOK debut

**The idea.** "Forked a blue-chip vault and kept one key nobody audited."
Forklok the vault-golem poses front-and-center like a product shot —
sturdy, tidy, audit-badge gleaming, a little black palm-tree emblem on
his chest (the coin's mark, glyph only). The uncommon flourish is the
reveal: a mirror on the wall behind him shows his back — a tiny gold
door slightly ajar, key on a chain he pretends isn't there, a thin
trickle of coins leaking out. Drained day 40, visible only in the
mirror. Steel blue + gold on indigo. Mood: trust me / don't. Easter egg
(shipped in take 1, canon): one faint glowing fingerprint whorl on the
mirror frame. It reads as Rugula's tell paying a visit — a wink, not a
claim; BlackPalm is Forklok's alone under the one-starring-coin ruling.
Keep it low-glow on any reprint. Avoid: readable audit text, actual
ETH/brand marks, gloom.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a sturdy trustworthy-looking little vault golem
robot with a gleaming tidy front and a small black palm tree emblem
poses proudly like a product photo; in a decorative mirror behind him
his back is revealed — a tiny golden door slightly ajar with a key on a
chain and a thin trickle of gold coins leaking out; steel blue and gold
palette on rich indigo, bright showroom lighting, glossy toy-like look,
sly caught-in-the-act comedy, no text, upper-weighted composition,
original character design.*

**APPROVED — take 1 (2026-07-21).** Wire: coinCard_BlackPalm at
`artFocus: "center 30%", artZoom: 1.0`, fx `Sparkle` (showroom gleam —
the FX to swap first if the mirror reads busy). The whole gag is legible
in one read: front-facing product-shot pose with the palm medallion and
audit shield, and the mirror behind him holding the entire confession —
back hatch ajar, key on its chain, coins trickling out. Canonized from
the take: the medallion is a gold disc with the palm as a flat glyph
(never a rendered tree), the audit shield repeats as showroom wallpaper
so the room itself is vouching for him, and his face stays warm and
guileless — the mirror does all the accusing. The fingerprint whorl
easter egg made it in, low-glow on the mirror frame at ~55% height; it
survives as a wink at Rugula's tell, not a co-ownership mark (see the
one-starring-coin ruling). Reveal sits ~40–62% frame height, inside the
art window. Art is exactly the card's 1488×2076 aspect, so artFocus is
inert at zoom 1.0 and is recorded for consistency only.

---

## 17. VAPORWAREX — coin · hype · common · rug (slick-but-broken) · VAPORINA debut

**The idea.** "The demo was a video. The video was the product." Vaporina
mid-runway-pose on a demo-day stage: her front half dazzling, fully
rendered, beaming — and from the stage side the truth reads: her back
half is unshaded wireframe, propped up by a single wooden clothespin.
Beside her hovers a big holographic play-button looping the same three
seconds (her tell — a circular arrow with three tick-sparkles).
Iridescent magenta + gold on plum, spotlight-bright. Mood: the pitch of
the century, held together by one clothespin. Avoid: readable UI text,
idol-mascot lookalikes, darkness backstage (the reveal stays lit).

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a dazzling holographic diva character strikes a
glamorous pose on a bright demo stage, her front half gorgeously
rendered while her visible back half is plain glowing wireframe held up
by a single wooden clothespin; a large holographic play button with a
circular loop arrow hovers beside her, iridescent magenta and gold
palette on plum, bright spotlight staging, glossy toy-like look, playful
showbiz-scam energy, no text, upper-weighted composition, original
character design.*

**APPROVED — take 1 (2026-07-21).** Wire: coinCard_VaporwareX at
`artFocus: "center 30%", artZoom: 1.0`, fx `Rainbow 1` (she IS
refraction — the overlay does character work here, not decoration).
The reveal needs no caption: one continuous body, rendered-glossy on the
near side and glowing wireframe on the far side, split straight down her
midline, with the wooden clothespin at the waist holding the seam shut.
Canonized from the take: the wireframe half keeps its full silhouette
(hair spikes, hand, heel) so she reads as *unfinished*, never *damaged*;
the clothespin stays plain untreated wood — the only non-luxury object
in the frame, and the whole joke; and the loop-button hovers at her
gesture height with the circular arrow + three sparkles. She is the
set's first full-body standing figure: head ~20%, clothespin ~46%,
button ~28–40% — all safely inside the art window, with only her heels
running under the ability box. That trade is accepted (the pose needs
the full body); note it as precedent before approving another
full-length figure. Art is exactly the card's aspect, so artFocus is
inert at zoom 1.0 and is recorded for consistency only. **Watch item:**
the Genesis Edition badge lands on the loop-button tell's lower-left arc
— the triangle, loop arrow and sparkles still read, so take 1 ships as
is, but this is the first card where the set mark competes with the
tell. If it starts to bother, `setBadge: null` on this entry drops the
badge for this card alone; otherwise keep tells out of the upper-right
quadrant when composing future art.

---

## 18. LUCKY CAPSULE — coin · pattern · uncommon · zombie (meme-mania) · FOMOGRE debut

**The idea.** "Every capsule a coin flip. The crowd ran out of quarters."
Fomogre at full sprint: a big friendly ogre built entirely of stacked
glossy green candlestick blocks, charging with enormous joyful urgency
through a pastel arcade of gachapon capsule machines toward the next
glowing machine — while behind him his own trailing blocks have turned
red and crumble away (his tell: he can never stop running). The machines
he's passed sit with empty coin trays; one tipped-over quarter cup.
Candle green/red split on Eugene-violet ground with pink capsule pops.
Uncommon flourish: the crumbling red trail. Mood: momentum as a
character. Avoid: menace, exhaustion (he's having a great time), any
readable machine labels.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a big friendly ogre built entirely of stacked
glossy green candlestick chart blocks sprints with joyful urgency
through a pastel arcade of cute capsule-toy machines toward a glowing
one ahead, while the candle blocks trailing behind him turn red and
crumble into a fading trail; passed machines with empty coin trays and
one tipped-over cup of quarters, candle green and red on a saturated
violet arcade with pink pops, bright energetic lighting, glossy toy-like
look, comic unstoppable-momentum mood, no text, upper-weighted
composition, original character design.*

**APPROVED — take 1 (2026-07-21).** Wire: coinCard_LuckyCapsule at
`artFocus: "center 30%", artZoom: 1.0`, fx `Abstract 7` on `screen`.
The card is pure momentum:
he's mid-air, both feet off the floor, running left-to-right toward the
one lit machine while the left third of the frame dissolves. Canonized
from the take: the blocks are chunky beveled candles with gold pin-joints
(a toy that comes apart — which is the joke), the green→red turn happens
mid-limb rather than at a seam so the decay looks like it's catching up
to him, and his face stays delighted with zero awareness of the trail.
Tells: crumble-trail ~30–72% on the left, tipped quarter cup ~65–72%.
Checked on the rendered card: the cup clears the flavor band and lands
just left of the EFFECT badge, still legible, and the Genesis badge
falls on his raised fist rather than on the lit target machine — so
unlike VaporwareX nothing here needs `setBadge: null`. Art is exactly
the card's aspect, so artFocus is inert at zoom 1.0 and is recorded for
consistency only.

---

## 19. TERMINALETH — coin · bluechip · uncommon · legit (doxxed-clean)

**The idea.** "Dull as scripture, solvent as sin" — monumental boredom
made holy. The Terminal's reserve chapel: a massive chunky rounded
gem-ingot (abstract — NOT the Ethereum logo) resting on a stone altar,
polished daily by one small monk-bot with a cloth, votive candles in
perfectly tidy rows, chain-link garlands. The uncommon flourish: through
a round window behind the altar, a candy-neon market storm rages —
inside, nothing moves. Mint + cream on deep teal. Mood: unshakeable;
the joke is how uneventful it is. Mascot rule: NO face on the ingot —
the monk-bot carries all the charm. Avoid: ETH logos, drama inside the
chapel, black shadows.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a massive smooth rounded mint-glowing gem ingot
rests on a stone altar in a serene bright chapel, a small cute robed
robot monk polishing it with a cloth; tidy rows of votive candles and
chain-link garlands, and through a round window behind the altar a wild
colorful neon market storm rages outside while the chapel stays
perfectly calm; mint and cream palette on deep teal, soft sacred
lighting with bright candle glow, glossy toy-like look, serene steadfast
mood, no face on the ingot, no text, upper-weighted composition.*

**APPROVED — take 1 (2026-07-21).** Wire: coinCard_TerminalETH at
`artFocus: "center 30%", artZoom: 1.0`, fx `Sparkle` (candle glow).
The joke lands by contrast, exactly as briefed: the round window holds a
full neon candlestick storm — the loudest 30% of art in the set — and
the chapel in front of it is so still that the only motion is a small
robot with a cloth. Canonized from the take: the ingot is a faceted
mint slab on a gold plinth with a single diamond boss, no face, no logo;
the monk-bot is chest-height to it (scale does the reverence); votives
sit in glass cylinders in tidy rows; and the chain garlands are
ornamental swags, not restraints. Server racks flanking the nave are a
welcome addition — keep them for any future Terminal-interior card.
**Composition precedent (the inverse of VaporwareX):** everything that
matters — window, ingot, monk-bot — sits in the upper two-thirds, and
the bottom third is altar steps, chain swag and empty polished floor.
Checked on the rendered card: the flavor band crosses the altar front
and the ability box sits on candles and floor, so both text bands land
on furniture rather than on the subject. This is the shape to aim for on
rogue-less coins.
Filename note: the webp landed as `coinCard_terminalEth.webp` while its
own PNG master was `coinCard_TerminalETH.png`. Renamed the webp to match
(2026-07-21) — macOS hides the mismatch, but prod's filesystem is
case-sensitive, so a case drift like that is a 404 waiting for deploy.
Encode to the master's exact name.

---

## 20. CANDLE INDEX — coin · analysis · common · legit (infra-grind)

**The idea.** "An index of every wick since genesis. Boring, priceless."
The great wick archive: one wall of a cozy, vast library where the
shelves hold rows of tiny votive candles — flames alternating green and
red like an index of every candle ever printed — with a rolling ladder,
card-catalog drawers labeled in scribble-glyphs, and a librarian's desk
loupe catching the glow (Marisol's world). One clear idea: the shelf
wall. Gold on indigo. Mood: cheerful, meticulous, infinite. Mascot rule:
the candles stay faceless (protected object, same ruling as Candle
Vigil). Avoid: horror-library gloom, readable labels, wax mess — this
archive is TIDY.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a cozy vast library wall whose shelves hold
hundreds of tiny tidy votive candles with small flames alternating green
and red like a living index, a wooden rolling ladder leaning against the
shelves, card-catalog drawers with cheerful scribble glyph labels, a
brass magnifying loupe on a librarian desk catching golden light;
saturated gold and indigo palette, warm bright candle glow, glossy
toy-like look, cheerful meticulous mood, no faces on the candles, no
text, upper-weighted composition.*

**APPROVED — take 1 (2026-07-22).** Wire: coinCard_CandleIndex at
`artFocus: "center 30%", artZoom: 1.0` (exact card aspect — the crop is
the composition). The generator upgraded the loupe: instead of resting
on the desk, a small archivist-bot on the ladder holds it up to the
shelves, magnifying one green and one red flame — the "living index"
made literal, and the set's librarian mascot born in the same stroke.
Canonize the archivist-bot for any future archive/infra scene. Candles
stay faceless (mascot rule held), catalog glyphs unreadable, the desk
ledger and index cards land under the text bands exactly as the
template wants. The rotunda's scale earns "boring, priceless."

---

## 21. ZERO CHOIR — coin · infra · common · legit (stealth-launch)

**The idea.** "Launched silent as a vow; found by archaeologists, priced
by believers." A just-unearthed crypt-chapel: a semicircle choir of
small hooded robed figures whose ring-shaped bodies are literal zeros,
glowing soft mint, singing in perfect silence — their song drawn as
musical REST symbols floating up like incense (silence, notated). At the
frame's lower edge: the archaeologist's lantern and brush where the dig
broke through, dust motes sparkling in the beam. Mint + cream on deep
teal. Mood: hushed wonder — the discovery moment. Avoid: spooky crypt
gloom (this is a warm reveal), skeletons, readable inscriptions.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: inside a freshly unearthed glowing crypt chapel, a
semicircle choir of small hooded robed figures with ring-shaped bodies
like living zeros sing in silence, their song drawn as delicate musical
rest symbols floating upward like incense; a warm archaeologist lantern
and brush at the dig opening in the lower foreground, sparkling dust
motes in the light beam, mint and cream palette on deep teal, soft
wondrous lighting, glossy toy-like look, hushed discovery mood, no
text, upper-weighted composition.*

---

## 22. VOTIVE CHAIN — coin · infra · common · legit (stealth-launch)

**The idea.** "A chain of lit candles — proof-of-prayer, oddly durable."
Single-object charm, Candle Vigil's calm cousin: a chunky chain whose
every link cradles a lit votive candle, draped in a gentle curve across
the frame and receding over a soft hill of the Terminal's landscape —
every flame steady, one link mid-ignition glowing brighter (the new
block). Mint + cream with amber flame pops on twilight teal. Mood:
serene, processional, durable. Differentiation (three candle cards now
exist): Vigil = one lantern in a red storm · Index = candle shelves
indoors · Votive Chain = an outdoor chain of candle-links. Keep them
unmistakable. Mascot rule: no faces on candles. Avoid: wind, drama,
darkness — nothing threatens this chain.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a chunky golden chain whose every link cradles a
small lit votive candle drapes in a gentle curve across the frame and
recedes over a soft rolling hill into a glowing horizon, every flame
calm and steady, one link glowing brighter as its candle ignites; mint
and cream palette with warm amber flames on a bright twilight teal
landscape, soft serene lighting, glossy toy-like look, peaceful durable
mood, no faces on the candles, no text, upper-weighted composition.*

---

## 23. CHAINSERAPH — coin · infra · rare · legit (infra-grind)

**The idea.** "Six angels of uptime. The bridge that never made headlines
because it never broke." The rare's cinematic-but-bright moment: a
glowing light-bridge runs a clean diagonal between two terminal spires
(that diagonal is the "v" foil's runway — keep it uncluttered), tended
by six small seraph-bots with chain-link halos and cream wings, each
calmly maintaining a segment while tiny light-packets stream across
without incident. Focal: the central seraph where the beams meet, ~30%
from top, slightly left. Mint beam + cream wings on deep teal sky with
star-sparkles. Mood: quiet competence as glory. Count check: approve
only if the seraphs read as SIX (generators miscount — retake, don't
shrug). Avoid: battle drama, storm clouds, harp-and-toga angel clichés
(these are bots), readable signage.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a luminous mint light-bridge runs a clean diagonal
between two colorful terminal spires in a bright starry teal sky, tended
by six small cute robot seraphs with glowing chain-link halos and chunky
cream wings, each calmly maintaining its own segment as tiny light
packets stream safely across; sparkles and soft prism haze, saturated
mint and cream palette on deep teal, dramatic but bright staging, glossy
toy-like look, serene heroic mood, no text, upper-weighted composition.*

---

## 24. LIQUID SAINT — coin · bluechip · uncommon · legit (redemption-arc)

**The idea.** "Depegged once in the great cascade; recollateralized and
canonized." Kintsugi canonization: a chunky stained-glass-style saint
statue holding a coin-vessel, visibly shattered once and rejoined with
glowing gold seams — the crack-lines now the most beautiful thing on it.
The uncommon flourish: the final seam is still flowing, liquid gold
climbing to complete the repair mid-frame, while a halo ring snaps into
place above with a sparkle. Cream + gold with mint accents in soft
indigo chapel light. Mood: the scar is the sanctity. Face note: a serene
sculpted statue face is sculpture, not a mascot face — allowed; keep the
eyes gently closed. Avoid: gore-adjacent cracking, gloom, weeping —
this is triumph, not tragedy; no readable inscriptions.

**Prompt seed.** *Vibrant TCG illustration, cel-shaded with bold linework
and saturated colors: a chunky stained-glass style saint statue with a
serene closed-eyed sculpted face holds a rounded coin vessel, its body
visibly once-shattered and rejoined by glowing golden kintsugi seams;
the last seam still flowing as bright liquid gold climbs to complete the
repair, a golden halo ring snapping into place above with a sparkle
burst; cream and gold palette with soft mint accents in warm indigo
chapel light, bright reverent staging, glossy toy-like look, triumphant
redemption mood, no text, upper-weighted composition.*

---

## Batch 2 notes

- **Order of attack.** The Siren FIRST, with rare-grade iteration budget
  — she joins Rugula as species anchor for every rogue after her. Then
  the other five rogues in one stretch (anchor each on Rug Warning +
  Siren + that coin's palette). Then the six legit coins in one session
  anchored on MoonPony. Same seed/style-reference discipline as the lens
  key family.
- **Rogue debuts double as gallery reveals.** When a rogue coin is
  approved and wired, flip that rogue's `status` to `"debuted"` in
  rogues.js — their silhouette slot at /card-template lights up. That's
  the whole ceremony; don't forget it.
- **No new equines.** MoonPony owns the pony silhouette and Eugene's
  trader card owns the unicorn. Nothing in this batch grows hooves.
- **Three candle cards now exist** (Vigil / Index / Votive Chain) — the
  differentiation note in brief 22 is load-bearing; check the three side
  by side in the binder before approving either newcomer.
- **Wiring ritual per approval:** encode webp (q86, effort 6, from the
  full-res master), add the `CARD_ART` entry (`src`, `artFocus`,
  `artZoom`, `fx`), preview at /card-template with the rarity's foil,
  then record the wiring values in the status table below.

## Batch 2 status

| Card | Rogue | Status | artFocus |
|---|---|---|---|
| Ponzi Siren | The Siren ★ debut | take 1 wired — hourglass inpaint pending | center 33% |
| Bullish Ink | Shillbird debut | APPROVED take 1 + wired | center 30% |
| GoblinGas | Gasper debut | APPROVED take 1 + wired | center 30% |
| BlackPalm | Forklok debut | APPROVED take 1 + wired | center 30% |
| VaporwareX | Vaporina debut | APPROVED take 1 + wired | center 30% |
| Lucky Capsule | Fomogre debut | APPROVED take 1 + wired | center 30% |
| TerminalETH | — | APPROVED take 1 + wired | center 30% |
| Candle Index | — | APPROVED take 1 + wired | center 30% |
| Zero Choir | — | queued | — |
| Votive Chain | — | queued | — |
| ChainSeraph | — | queued | — |
| Liquid Saint | — | queued | — |

*Held for later batches: the four desk-community coins (Halo Protocol,
MarisolCoin, Demon Desk, Neon Oracle) as their own family session;
market cameos once each rogue's look is locked; Genesis Terminal and
Our Lady RL80 — the set's two remaining terminal foils — for the
finale, same as Terminal Foil Moment closed the First Twelve.*