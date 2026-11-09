# R-cana set — adding a card

The printed set behind `/card-template` (R-cana view) and, eventually, the
table. A card is three things, each in its own place:

| What | Where | Owns |
|---|---|---|
| **Design** | `set/designs.js` | key, name, type, cost, game stats, rules text — the game's truth |
| **Face** | `set/faces.js` | number, rarity, halo/hydro, the printed ability line, flavor |
| **Art** | `art/<id>.js` + `public/TCG/rcana/<id>/` | backdrop, depth layers, FX sheets and their light |

`set/index.js` merges design + face into `RCANA_SET`; `art/index.js` collects
the art files into `RCANA_ART`; `cardFace.js` re-exports both, so nothing
upstream changes its imports.

`designs.js` was lifted from the Playtest 2 table, whose build source had
never been committed. The build is restored: `src/game/playtest2/pt2-build.js`
injects `designs.js` and the faces into `pt2-table.src.html` and writes
`public/playtest2/table.html`. **Never edit `table.html` by hand.**

## Steps

1. **Design** — if the card isn't in `designs.js`, add a `D(...)` line. If it
   is, skip this. (`npm run rcana:lint` lists every design with no face yet.)
   The printed name, when it differs from the engine's, is the design's
   `printName`. Rule: lotería names for figures, devotional objects and
   classic lotería images (El Monje, El Exvoto, La Luna); market names for
   market forces, calamities and instruments (Bull Run, Rug Pull, Blue Chip).

2. **Art files** — author on the frame's own **1024 × 1422** canvas so layers
   land where drawn with no offsets. Export WebP into
   `public/TCG/rcana/<id>/`:
   - `scene.webp` — the environment, real alpha where the backdrop should show
   - `subject.webp` — the figure; draw past the border if it should break out
   - `prop.webp` — optional loose foreground object
   - `fx-<name>.webp` — optional FX sheet(s), transparent where there's no fire

3. **Trace the FX light** (per sheet):
   ```
   npm run rcana:trace -- public/TCG/rcana/<id>/fx-flame.webp
   ```
   Paste the printed `facets:` block into a reflection in the art file. Then
   tune by eye with the bench's **FX facets** toggle on:
   - one shared `axis` per ridge; `angle`s stepping left→right make a tilt
     *walk* the highlight; negative axis-y = lights when tilted toward the top
   - ~10 facets max — cost tracks lit gradient area, not count, but keep it
   - a `tune` block overrides the shared `fire` material for this card only

4. **Art file** — copy `art/el-toro.js`, rename, set `backdrop` and the
   `layers` (far → near; `z` defaults from `ART_PLANES` by layer id). **No
   paths**: a layer `{ id: "scene" }` is `public/TCG/rcana/<id>/scene.webp`,
   an fx `{ id: "flame" }` is `fx-flame.webp`, by convention (`artPath`). Give
   a `src` only to point at a shared file (El Diablito's flame sheet). FX take
   `blend`, `clip`, `clear: ["numberTab"]` if the sheet crosses the tab, and
   `reflection`. Register the file in `art/index.js` — one import, one key.
   A `metalFrame: "rainbow"` (any `RCANA_METAL_FRAMES` id) lays that
   Terminal Traders border over the frame by default — on the bench, in the
   print route and so on the table; the bench's **Metal frame** select
   starts on it and can still override.

5. **Face** — add an entry to `faces.js`: `id`, `design` (the engine key,
   e.g. `"bull"` — never the name), `number` (unique), `rarity`, `ability`
   (printed line — shorter than the simulator's), `flavor`. Halo/hydro print
   the design's `cred`/`liq` unless overridden. Gameplay text leads every
   class; flavor follows a separator. Traders' flavor is quoted. Every Trader
   inherits an `abilityName` from its design (a face can override it), beside the
   ABIL80 pill on the same row; authored newlines in `ability` separate
   timing from outcomes when useful.
   Trader abilities have a centered **ABIL80** (Ability) heading above the rule.
   The player inhabits one active Trader; other Traders can wait on the bench.
   Traders use ABIL80 plus their ability title, with timing and limits
   written in the rules. They do not need a separate usage pill. Add a timing
   badge only if a future activation mechanic needs one.
   Every other card has one usage/timing badge. Assets use Invest;
   Opportunities use On play; Markets use On draw; Calamities use Until cleared.
   Artifacts use Equip, Single use, To shrine, Offer or Spend as appropriate.
   A duplicate badge lead-in is removed from the rules when badges are shown.
   Traits come from the design's flags (`gamble`, `bearProof`, `income`, `choice`;
   override with `traits: [...]`). Game terms are bold, with a coin on
   "N Hydro". A short flourish precedes the flavor, and the collector line
   (`number / RCANA_SET_SIZE`) sits in the bottom-right gold margin. The bench's **Rules
   furniture** and **Collector line** toggles show the plain face.

6. **Check**
   ```
   npm run rcana:lint          # art present, files exist, numbers unique,
                               # text fits, every facet on bright sheet
   ```
   then open `/card-template → R-cana`, pick the card, tilt it, and toggle
   **Slot outlines** / **FX facets** if anything sits wrong.

## Getting a card onto the Playtest 2 table

The table (`/playtest2`) is a built, self-contained page. It reads the same
designs as the face, and shows the printed card for any design that has one.

```
npm run dev                 # terminal 1 — the print route needs the app up
npm run rcana:faces         # terminal 2 — screenshots every face to
                            #   public/TCG/rcana/<id>/face.webp
                            #   (one-time: npm i -D playwright && npx playwright install chromium)
npm run pt2:build           # rebuild the table with designs + face images
```

- **Changed a design or a face's text?** `npm run pt2:build` is enough.
- **Changed art, frame, type or anything visible?** `rcana:faces` for that
  card, then `pt2:build`: `npm run rcana:faces -- el-diablito && npm run pt2:build`.
- `npm run rcana:lint` warns when `table.html` is older than its inputs.

In the table, a design with a face renders as the picture plus its play chips
(`.card.printed`); a design without one renders as today's text card, with
its lotería number in the corner once a face entry exists. The map the table
reads is `FACES` (design key → `{ id, number, rarity, face, art }`), injected
at build.

`/rcana-print?id=<face id>` is the print target: the card at `depth={0}`,
no motion, transparent page. Open it in a browser to see exactly what the
renderer captures.

## Plates and seals

The plate follows the card's type (`PLATES` in `artSpec.js`, chosen by
`plate` from `buildFace()`). The live paper surface covers the legacy painted
footer; shared components draw labeled stats and the centered RL80 mosaic
heart-and-arrow medallion.
The stats and medallion share one warm parchment band. The existing card
frame supplies its side and bottom borders, with a matching horizontal divider
above the stats. The medallion overlaps the bottom border; the CRED badge
fits entirely inside the stat band.
The body text fits above the divider. This shared background stays behind the
footer artwork and is omitted from blank templates and the frame-hidden bench view.

| plate | left stat | right coins | types |
|---|---|---|---|
| `boxed` (`LOTERIA_FRAME2`) | angel badge: Credibility (engine: Grace) | cost and income coin bar | Trader |
| `valued` (`LOTERIA_FRAME2_value`) | gold coin and **PROSPERITY** ribbon | single cost ribbon | Asset, Opportunity Event |
| `sealed` (`LOTERIA_FRAME2_sealed`) | open; usage is above the rule | **cost** (on-draw Events: **—**) | Calamity, Ambiguity, on-draw Opportunity, Remedy, Relic, Grace |

The name banner's border matches the type tab's colour (`HEADER_COLORS`).
The plates above carry the Trader red; the other classes use a copy with the
border recoloured (`PLATES_BY_CLASS`, keyed plate → class): `_value_asset`,
`_value_event`, `_sealed_artifact`, `_sealed_event`. They are generated, not
painted — after re-exporting a plate, re-run
`node scripts/recolor-plate-banner.mjs <plate> <out> <#hex>` for each.

The cost coin shows what you pay to play the card. Traders also show an
income coin for what you collect each turn (play cost = income, by rule).
The compact Trader and Asset labels and all six Event and Artifact subtypes
use hand-painted cream wordmarks with the same ivory finish, while the
banner title retains gilt Blackletter. A teal-blue **ABIL80**
pill sits beside the named power in a centered heading on Trader abilities.
All body badges are text-only. Other types use solid class-colored badges with
cream lettering and gold trim; Calamities use red. The body follows one shared type scale:
badge/title, regular-weight rules with selective bold terms, then smaller italic
flavor beneath the flourish. Traits remain metadata rather than extra pills.
The mosaic medallion shares a fixed footer position
across all card classes. An art file may still pin a `frame:`.

### Artifact template

Cards whose printed class is `Artifact` use the swept teal-and-gold header
in `RcanaArtifactTemplate.jsx`. The cream `Remedy`, `Grace` or `Relic`
wordmark sits at the left with comfortable padding; `Artifact` remains
on the right. Artifact and Event headers omit subtype icons. The engine's
`artifact` type prints as `Relic` and uses the **Equip** rules badge.
Traders and Assets use the compact swept header in `RcanaTypeHeader.jsx`:
a gold number cell and a colored field with an illustrated type name.
All card header numbers use locally bundled **Cinzel Bold**, registered as
`Rcana Numerals`, with lining figures sized to leave room for two digits.
The font and its SIL Open Font License are in `public/fonts/`.
`COMPACT_TYPE_HEADER` defines its footprint and FX clearance.
`headerColors.js` assigns red to Traders, forest green to Assets, teal to
Artifacts, and indigo to Events. All Artifact subtypes share teal; all Event
subtypes share indigo. Calamity usage badges retain their red warning color.

Rarity is **Common → Uncommon → Rare → Mythic**. Relic is exclusively an
Artifact subtype; it is not a rarity.

The badge above the rule describes use: **Single use**, **Equip**, or **To shrine**.
`artifactTemplate.js` maps these from the engine type and handles the Grace
exceptions: the Rose is **Offer**, and the Fountain is **Spend**. This is
display information only. Artifact usage pills use solid teal (`#155b60`),
centered cream lettering (`#fff0bc`), a fine gold inner rim and a dark outline.
The usage pills are text-only for legibility at card size. All usage/timing
badges share this treatment in their type color: green for Assets, indigo for
Events, and red for Calamities.
Their shape matches ABIL80, whose solid blue fill
marks a Trader ability. The old subtype badge is omitted for Artifacts.
FX clearance follows the full header, including on La Tortilla's steam.

All four card classes share the stat furniture in `RcanaLiquidityBox.jsx`.
Trader standing uses `RcanaCredBadge.jsx` with `/RL80_CRED_angel_plain.webp`: a round
blue enamel head with a smooth gold rim and the original floating elliptical
halo above the circle, without rays. The head is
attached to the original red **CRED** label extension. The hanging prize
ribbon tails are removed. Its head is a blank field for the live cream value;
the CRED label is painted into the extension. Transparent artwork retains its
native proportions at a common height; longer values shrink to fit.
The badge is centered in the left footer area, balancing the cost/income
bar, with space above the halo and below the head inside the stat band.
Its accessible label remains **Credibility**, without changing the underlying
Grace value or rules. The **CRED badge** selector on `/card-template` →
**R-cana** compares the default plain-halo angel, lateral rays (`angel-lateral`),
three top rays (`angel`), a left-tilted
halo (`angel-jaunty`), five soft irregular rays (`angel-soft-rays`), the earlier
winged heart and oval, and the original ribbon. Print previews accept
`?id=el-diablito&cred=angel-lateral|angel|angel-plain|angel-jaunty|angel-soft-rays|heart|oval|ribbon`; normal exports use
the angel with a plain halo. Its source is `set/RL80_CRED_angel_plain.png`.
The earlier transparent PNG sources are `set/RL80_CRED_angel.png`
and `set/RL80_CRED_angel_lateral.png`; the other comparison sources are
`set/RL80_CRED_angel_jaunty.png` and `set/RL80_CRED_angel_soft_rays.png`.
The built-in imagegen edit prompts are
recorded in `RL80_CRED_angel.prompts.json`. The earlier winged artwork and
prompts remain in `set/RL80_CRED_winged*.png` and `RL80_CRED_winged.prompts.json`.
Assets and Opportunity Events use
class-colored versions of `/RL80_PROSPERITY_stack_ribbon.webp`: three stacked
gold coins on the left and a wide ribbon with **PROSPERITY** written in full. The compact stack
distinguishes accumulated Prosperity from the single Cost coin. Its broad,
slightly tilted top face carries the live dark number; the visible rims sit
below it. The ribbon and overall badge width retain their shared footer
alignment. Its accessible label remains **Prosperity**. The transparent PNG
and edit prompt are saved as `RL80_PROSPERITY_stack_ribbon.png` and
`RL80_PROSPERITY_stack_ribbon.prompt.txt` in `set/`.

Traders use `/RL80_COST_INCOME_coin_bar_clean.webp` as one intact piece of
artwork. Its printed **COST / INCOME** label needs no additional curved
labels. The left coin carries the acquisition cost and the right carries
income; both use live dark engraved numbers. The badge images
retain their native aspect ratios, with the number positions measured
against their blank centers. Longer values step down in size to fit.
Assets, Events and Artifacts use class-colored versions of `/RL80_COST_ribbon_wide.webp`: a matching **COST**
ribbon with one blank gold coin on the right, filled by the live cost value.
The Cost and Prosperity badges each span 30% of the card width, with mirrored
outer margins and matching space beside the center emblem. The Cost ribbon
extends inward; its label stays centered within the wider ribbon. The stat
ribbons share a baseline; Prosperity's number sits on the top of its stack.
The widened Cost artwork's edit prompt is
saved in `RL80_COST_ribbon_wide.prompt.txt`.
Calamities omit the left stat; on-draw Events retain a dash for cost. All four
ribbon badges omit the interior gold ornaments beside their lettering,
leaving clear space around each label while retaining the outer borders.
Their ribbon backgrounds follow the header accent palette in `headerColors.js`:
Trader red (`#b20d19`), Asset forest green (`#315c3c`), Event indigo (`#38477e`),
and Artifact teal (`#155b60`). `RcanaLiquidityBox.jsx` selects the corresponding
`RL80_COST_ribbon_asset|event|artifact.webp` and
`RL80_PROSPERITY_stack_ribbon_asset|event.webp` artwork. Gold frames, coin faces,
and lettering retain their existing colors. The earlier CRED ribbon remains
available as a bench comparison.
The color variants' source PNGs, saved paths and built-in imagegen prompts
are recorded in `RL80_type_badges.prompts.json`; blank templates use the same
type selection as populated cards.
Their transparent PNG sources are in `set/`; the built-in imagegen edit prompts
are recorded in `RL80_clean_badges.prompts.json`. The original decorated assets
remain available as source references.
All Artifact subtypes (Remedy, Grace and Relic), including their blank export
templates, share the wide Cost ribbon. Its artwork supplies the label and the
live value fills its gold coin. Conditional payouts remain in the rules
rather than receiving an income coin.
Each populated stat gets a medallion. The center uses
`/RL80_Mosaic_Medallion.webp`, a standalone version of the upper crest from
the supplied Lotería emblem. It retains the heart, rising arrow and RL80
lettering inside a complete gold rim, with transparency and native proportions
preserved. The PNG source is `set/RL80_Mosaic_Medallion.png`. It replaces the
rarity heart, seal and printed tier and overlaps the bottom card border;
rarity remains in the card data for gameplay and foil.
`RcanaMedallion.jsx` confines the holographic treatment to the heart, arrow
and RL80 lettering. The gold rim and crest stay original; the mosaic backing
and radial rays have a static warm-metal finish. A source-derived SVG mask
isolates the colored logo pixels within three regions, preserving engraved
edges and the holes in the lettering without a separate raster asset.
Saturated gold, rose, teal and violet are visible at rest. The existing card
tilt shifts the spectrum's hue and position, the metallic reflection, fine
rings and a brief glint; every moving pass is inside the logo mask. A screen
pass lifts the darker source before the color pass, keeping the foil vivid.
The arrow has a separate emerald/lime spectrum that shifts toward turquoise
with tilt. Its bright source is toned down before tinting so the greens stay
vivid rather than washing out to near-white; a green-pixel mask preserves
the heart and the arrow's engraved highlights.
This follows the saturated-color-over-metal approach in Kivanfan's supplied
[CodePen reference](https://codepen.io/kivsdev/pen/qQMrYv), implemented with
the existing React/SVG tilt state and no added animation loop or dependency.
The source artwork is unchanged. Static exports and reduced-motion views
use the resting colors. In `/card-template` → **R-cana**, the **Holographic
medallion** checkbox compares this treatment with the original mosaic.
The smaller collection number sits in the bottom-right gold margin, aligned
with the cost/income coins.
Flavor text sits below a single centered `/HorizontalBar3.png` flourish.
Its proportions are preserved, with only the transparent vertical padding
cropped from view. The frame's horizontal divider begins the footer below it. Cost
reads the card's acquisition cost, while Trader income reads its Hydro value.
These currently match under the Trader rules, but remain separate display
values. Triggered payouts stay in the rules text rather than receiving an
income coin. `/GoldCoin.png` also appears beside Hydro amounts in the rules
text. La Calavera and El Diablito
print their payouts as **+1 Hydro**, keeping the plus sign and amount
together after the coin. Sale prices and acquisition costs remain unsigned.
`liquidityBox.js` sets a common position for Hydro. Rules use larger text
with balanced line wrapping. Rules, usage badges and ability names stay
centered. The Trader ability pill shares the usage badges' gold-trimmed
shape and centers with the optional ability title, independently of the rules'
line breaks. Rules have explicit line spacing, and the complete block fits its
natural height to the panel after fonts load.

Blank templates are available from the same print renderer:

- `/rcana-print?template=artifact&subtype=remedy`
- `/rcana-print?template=artifact&subtype=grace`
- `/rcana-print?template=artifact&subtype=relic`

The earlier `subtype=artifact` URL and `artifact-template-artifact.png`
download remain aliases for the Relic template.

These leave the illustration, number, name, rules, rarity and cost empty.
Transparent PNG exports live in `public/TCG/frames/artifact-template-*.png`;
the component remains the editable source. Regenerate them with
`npm run rcana:artifact-templates` while the dev server is running.
After a visible template change,
render the affected Artifact faces again and run `npm run pt2:build`.

### Event subtypes and instructions

Events share the full-width swept header and instruction styling with
Artifacts (`RcanaSubtypeFurniture.jsx`). `eventTemplate.js` sorts every
Event into one of three printed subtypes by what it does to you, while the
usage badge keeps the engine's timing:

| Engine behavior | Printed subtype | Usage badge |
|---|---|---|
| `type: "hazard"` | CALAM80 (Calamity) | Red **Until cleared** |
| `type: "event", played: true` | OPPORTUN80 (Opportunity) | **On play**, with the **Prosperity** mark |
| `type: "event"`, on draw, `subtype: 'Calamity'` | CALAM80 | Red **On draw** |
| `type: "event"`, on draw, no `subtype` | OPPORTUN80 | **On draw** |
| `type: "event"`, on draw, `subtype: 'Ambiguity'` | AMBIGU80 (Ambiguity) | **On draw** |

An on-draw event names its sort on the design: a loss is a Calamity (Flash
Crash), a windfall an Opportunity (Pay Day, The God Candle, The World, The
Illumin80), and a shake-up whose winner is unknown until it resolves an
Ambiguity (The Whale, The Wheel, Moral Hazard). A face can still override
with `subClass`. In rules text, **Calamity** keeps its narrow meaning — the
attached kind that Remedies clear, El Gato knocks off and the Sacred Heart
cancels; a one-shot Calamity is not cleared or cancelled, which its **On
draw** badge shows. The header prints `EVENT` in Bebas Neue capitals on the
gold right panel. Future cards inherit their header and stamp automatically.
On-draw Events print **—** for Liquidity because they resolve automatically.
The God Candle can leave an ongoing effect after resolving.

The playtest gallery groups all Event designs under these three subtypes,
including designs without art. The build injects the same subtype mapping
used by the live cards, without changing engine rules. Yield Farm's text
names Events that fire on draw, and The World ends ongoing Event effects; it
does not clear attached Calamities.

Blank templates are also available at
`/rcana-print?template=event&subtype=calamity`, `subtype=opportunity`, and
`subtype=market`. They leave card-specific text and numbers empty. For visible
changes, render affected Event faces and rebuild the playtest table.
The former `subtype=hazard` URL remains an alias for Calamity. The engine
keeps its `hazard` type and existing gameplay behavior.

### Header lettering

Remedy, Grace, Relic, Calamity and Opportunity use transparent
WebP wordmarks in `public/TCG/labels/` (Ambiguity prints AMBIGU80 as text until
its sheet is painted; the retired Market sheet stays in the folder). `subtypeWordmarks.js` records their
native sizes and the view boxes that omit empty canvas at render time,
preserving the lettering proportions. The six subtype assets use painted
lettering matched to Trader. Their displayed letter height matches the
Trader wordmark after it fits within its narrower compact tab.
`typeWordmarks.js` supplies the ivory-painted
Trader and Asset wordmarks for the compact headers. Asset's shorter wordmark
uses the same visible letter height as Trader and the subtypes. The shared Trader
asset is `type-trader-painted.webp`, used by El Diablito, El Monje and La Abuela;
its source PNG and approved mockup are retained under `set/labels/`. Its view
box excludes transparent padding and retains a small margin around the brush
edges. `type-asset-painted.webp` supplies the Asset label, currently used by
Tech Stock; its source PNG is also retained under `set/labels/`.
The shared color matrix in `wordmarkPaint.js` maps the original gold
paint of Trader, Asset and all six subtypes to warm ivory (approximately
`#f3e5c3` at the midtone) while preserving brush texture and the original alpha.
Each rendered header has a unique filter ID so multiple cards can share the
treatment. Each SVG exposes its
type or subtype as an accessible text label. The secondary Artifact/Event
class labels retain Bebas Neue. The bench defaults to **Lotería mosaic** and retains the
plain font options for comparison.

Source PNGs are saved under `set/labels/`; the built-in imagegen prompts,
cleanup edits and output paths are recorded in `painted-subtype-wordmarks.prompts.json`
and `type-wordmarks.prompts.json`. `subtype-wordmarks.prompts.json` retains
the earlier mosaic subtype provenance.

The RL80 signature spellings **CALAM80**, **OPPORTUN80** and **REM80** are display
labels for Calamity, Opportunity and Remedy (REM80's painted sheet is composited
from the REMEDY and CALAM80 lettering, recorded in `painted-subtype-wordmarks.prompts.json`). Their original subtype keys, rules
terms and gameplay behavior stay intact; accessible labels include both
spellings. `rl80-signature-wordmarks.prompts.json` records the earlier mosaic
wordmarks and source PNG/WebP paths. The exploratory gold ACTIV80 wordmark
is saved but is not used on the cards. Trader cards instead use **ABIL80**
(Ability) in the same pill shape as the usage labels: teal-blue fill
(`#07536B`), pale-gold Bebas lettering and gold trim. The pill and named
ability title form one centered heading; the ability paragraph and flavor
share that center axis. The title sits to the right of the pill and can wrap
within the panel. It uses the real IBM Plex Serif Bold face,
larger than the regular-weight rules beneath it, so the title leads. The ABIL80
pill appears on every Trader and follows the bench's Rules furniture toggle.
All other cards use one solid usage/timing badge with class-colored fill and
cream lettering, including red for Calamities. Eugene's ticket stamp remains in the
other card set.

The complete rules block (pill, title, rules and flavor) shares the parchment
plane and its surface sheen, centered vertically between the ribbon and footer.
The bench's explicit **Ink above FX** override can still lift it for comparison.
The heading uses ordinary flex layout, with no first-line measurement. Tilt
does not rerun rules layout, so the pill and title stay fixed on the parchment;
content, scale and font changes still refit the complete block. Flavor uses
IBM Plex Serif Medium Italic at 80% of the shared rules size, with warm brown
ink and a smaller flourish. The slightly
stronger italic keeps the quote legible at smaller card scales.

El Diablito uses the existing coin-flipping art (`Diablito2.webp` plus the
separate `Diablito_Coin.webp` prop). **Devil’s Wager** resolves at turn start:
heads grants 1 Hydro; tails costs El Diablito 1 CRED. This replaces the old
refused-offer face text and the playtest's old Calamity rebate. The playtest
resolves the flip before income, respects Quantum Hack/Halo and the bench,
and uses the existing disgrace/Shroud rules. Run the mechanic checks with
`node --test scripts/rcana-diablito.test.mjs`.

## Open design calls (placeholders in code, flagged where they live)

- ~~**Type → class.**~~ Settled in `TYPE_CLASS` (`set/index.js`): Trader,
  Asset (assets), Event (events and calamities), Artifact (artifacts,
  remedies, graces). Event and Artifact subtypes print beside their class
  in the swept header. The engine's seven types are untouched.
- ~~**Stats → boxes.**~~ Settled (`buildFace()`): the coin represents
  Liquidity; the left stat is standing — Credibility (engine: Grace) in a
  medal on a Trader, **Prosperity (the card's value)** in a gold coin and ribbon
  on an Asset or a called Event. Other types omit the left stat. The mosaic
  medallion occupies the center; an Asset's rarity still tracks its Prosperity tier.
- **Numbering.** Lotería numbers are assigned per face by hand. If the set
  should number by type (Traders 1–11, …), do it in `faces.js` deliberately
  rather than by insertion order.

## Performance budget (per card, from measurements in `RcanaCard.jsx`)

- Tilt is compositor-only; the FX light is the whole cost. Keep ≤ ~10 facets
  per sheet and one sheet per card unless the second is small.
- `sway` is per-card opt-in and already stops off-screen; never on in a grid.
- Grids/binders render with `showFx={false}` — a flame over a 90px card is
  noise that costs a blur.
