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

5. **Face** — add an entry to `faces.js`: `id`, `design` (the engine key,
   e.g. `"bull"` — never the name), `number` (unique), `rarity`, `ability`
   (printed line — shorter than the simulator's), `flavor`. Halo/hydro print
   the design's `cred`/`liq` unless overridden. Gameplay text leads every
   class; flavor follows a separator. Traders' flavor is quoted. An optional
   `abilityName` names a signature power. On Traders it sits beside the
   ABIL80 pill on the same row; authored newlines in `ability` separate
   timing from outcomes when useful.
   Trader abilities have an **ABIL80** (Ability) corner cap above the rule. Event and
   Artifact rules retain their usage/timing pills — Equip, Single use,
   Until cleared, On draw — removing a duplicate lead-in from the ability.
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
above the stats. The medallion and CRED ribbon tips overlap the bottom border.
The body text fits above the divider. This shared background stays behind the
footer artwork and is omitted from blank templates and the frame-hidden bench view.

| plate | left stat | right coins | types |
|---|---|---|---|
| `boxed` (`LOTERIA_FRAME2`) | medal: Credibility (engine: Grace) | cost and income coin bar | Trader |
| `valued` (`LOTERIA_FRAME2_value`) | gold coin and **PROSPERITY** ribbon | single cost ribbon | Asset, Opportunity Event |
| `sealed` (`LOTERIA_FRAME2_sealed`) | open; usage is above the rule | **cost** (Market: **—**) | Calamity, Market, Remedy, Relic, Grace |

The name banner's border matches the type tab's colour (`HEADER_COLORS`).
The plates above carry the Trader red; the other classes use a copy with the
border recoloured (`PLATES_BY_CLASS`, keyed plate → class): `_value_asset`,
`_value_event`, `_sealed_artifact`, `_sealed_event`. They are generated, not
painted — after re-exporting a plate, re-run
`node scripts/recolor-plate-banner.mjs <plate> <out> <#hex>` for each.

The cost coin shows what you pay to play the card. Traders also show an
income coin for what they pay each turn (hire cost = income, by rule).
The compact Trader/Asset labels and the six Event and Artifact
subtypes use custom gold mosaic wordmarks inspired by the Lotería edition
emblem, while the banner title retains gilt Blackletter. A teal-blue **ABIL80**
pill sits above the first line's left edge on Trader abilities. Events and Artifacts retain their usage
symbol and label above the rule. The mosaic medallion shares a fixed footer position
across all card classes. An art file may still pin a `frame:`.

### Artifact template

Cards whose printed class is `Artifact` use the swept teal-and-gold header
in `RcanaArtifactTemplate.jsx`. The larger subtype symbol sits to the left
of `Remedy`, `Grace` or `Relic`; `Artifact` remains on the right. The engine's
`artifact` type prints as `Relic` and uses the **Equip** rules badge.
Traders and Assets use the compact swept header in `RcanaTypeHeader.jsx`:
a gold number cell and a colored field with the type name in gold mosaic
lettering. `COMPACT_TYPE_HEADER` defines its footprint and FX clearance.
`headerColors.js` assigns red to Traders, forest green to Assets, teal to
Artifacts, and indigo to Events. All Artifact subtypes share teal; all Event
subtypes share indigo. Calamity usage badges retain their red warning color.

Rarity is **Common → Uncommon → Rare → Mythic**. Relic is exclusively an
Artifact subtype; it is not a rarity.

The badge above the rule describes use: **Single use**, **Equip**, or **To shrine**.
`artifactTemplate.js` maps these from the engine type and handles the Grace
exceptions: the Rose is **Offer**, and the Fountain is **Spend**. This is
display information only. The old subtype badge is omitted for Artifacts.
FX clearance follows the full header, including on La Tortilla's steam.

All four card classes share the stat furniture in `RcanaLiquidityBox.jsx`.
Trader standing uses `/RL80_CRED_medal_clean.webp`: its artwork supplies the
blue-and-gold medal, ribbons and **CRED** label. A live pale gold number sits
in its blue center, with no duplicate text above it. The medal stays at the
left of the footer, balancing the cost/income bar at the right. The medal is
slightly enlarged and lowered so its blue center aligns with the cost/income
coins, with the ribbon tips overlapping the bottom border. Its accessible
label remains **Credibility**, without changing the underlying Grace value
or rules. Assets and Opportunity Events use
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
Calamities omit the left stat; Market Events retain a dash for cost. All four
ribbon badges omit the interior gold ornaments beside their lettering,
leaving clear space around each label while retaining the outer borders.
Their ribbon backgrounds follow the header accent palette in `headerColors.js`:
Trader red (`#b20d19`), Asset forest green (`#315c3c`), Event indigo (`#38477e`),
and Artifact teal (`#155b60`). `RcanaLiquidityBox.jsx` selects the corresponding
`RL80_COST_ribbon_asset|event|artifact.webp` and
`RL80_PROSPERITY_stack_ribbon_asset|event.webp` artwork. Gold frames, coin faces,
lettering and the CRED medal's blue number well retain their existing colors.
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
shape and sits just above the first line's left edge. Its position is measured
after text fitting and font loading, without changing the paragraph's width
or alignment.

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
Artifacts (`RcanaSubtypeFurniture.jsx`). `eventTemplate.js` derives the
printed subtype from the existing game type and `played` flag:

| Engine behavior | Printed subtype | Usage / value information |
|---|---|---|
| `type: "hazard"` | CALAM80 (Calamity) | Red **Until cleared** rules badge; pinned-card symbol |
| `type: "event", played: true` | OPPORTUN80 (Opportunity) | Labeled numeric **Prosperity** mark |
| `type: "event"`, no `played` | Market | Indigo **On draw** rules badge; draw-card symbol |

The header uses a skull, sparkles, or globe to the left of the subtype and
`EVENT` in Bebas Neue capitals on the gold right panel. Future cards inherit their
header and stamp automatically; they do not need new frame artwork.
Market Events print **—** for Liquidity because they resolve automatically.
The God Candle can leave an ongoing Market effect after resolving.

The playtest gallery groups all Event designs under these three subtypes,
including designs without art. The build injects the same subtype mapping
used by the live cards, without changing engine rules. Exit Scam's text
names Opportunities, Yield Farm's text names Market Events, and The World
ends ongoing Market effects; it does not clear attached Calamities.

Blank templates are also available at
`/rcana-print?template=event&subtype=calamity`, `subtype=opportunity`, and
`subtype=market`. They leave card-specific text and numbers empty. For visible
changes, render affected Event faces and rebuild the playtest table.
The former `subtype=hazard` URL remains an alias for Calamity. The engine
keeps its `hazard` type and existing gameplay behavior.

### Header lettering

Remedy, Grace, Relic, Calamity, Opportunity and Market use transparent
WebP wordmarks in `public/TCG/labels/`. `subtypeWordmarks.js` records their
native sizes and the view boxes that omit empty canvas at render time,
preserving the lettering proportions. `typeWordmarks.js` supplies matching
Trader and Asset wordmarks for the compact headers. Each SVG exposes its
type or subtype as an accessible text label. The secondary Artifact/Event
class labels retain Bebas Neue. The bench defaults to **Lotería mosaic** and retains the
plain font options for comparison.

Source PNGs are saved under `set/labels/`; the built-in imagegen prompts,
cleanup edits and output paths are recorded in `subtype-wordmarks.prompts.json`
and `type-wordmarks.prompts.json`.

The RL80 signature spellings **CALAM80** and **OPPORTUN80** are display
labels for Calamity and Opportunity. Their original subtype keys, rules
terms and gameplay behavior stay intact; accessible labels include both
spellings. `rl80-signature-wordmarks.prompts.json` records the generated
wordmarks and source PNG/WebP paths. The exploratory gold ACTIV80 wordmark
is saved but is not used on the cards. Trader cards instead use **ABIL80**
(Ability) in the same pill style as the usage labels: teal-blue fill
(`#07536B`), pale-gold Bebas lettering and gold trim. The level pill forms a
corner cap just above the first line's left edge; the ability paragraph and
flavor remain centered. An optional ability title sits to the right of the
pill on that same heading row. It uses the real IBM Plex Serif Bold face,
larger than the regular-weight rules beneath it, so the title leads. The ABIL80
pill appears only when a Trader has ability text, and follows the bench's Rules
furniture toggle. Event and Artifact timing pills and Asset instructions retain
their existing treatment. Eugene's ticket stamp remains in the other card set.

The complete rules block (pill, title, rules and flavor) shares the parchment
plane and its surface sheen, centered vertically between the ribbon and footer.
The bench's explicit **Ink above FX** override can still lift it for comparison.
The heading anchor is measured in untransformed layout coordinates. Tilt does
not rerun rules layout, so the pill and title stay fixed on the parchment;
content, scale and font changes still recalculate their alignment.

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
