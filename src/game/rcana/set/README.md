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
   market forces, hazards and instruments (Bull Run, Rug Pull, Blue Chip).

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
   the design's `cred`/`liq` unless overridden. Traders' flavor prints as a
   quote and leads the panel; everything else narrates after the rule.

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

The stat boxes are painted into the plate, so the plate follows the card's
type (`PLATES` in `artSpec.js`, chosen by `plate` from `buildFace()`):

| plate | left box | right (drop) box | types |
|---|---|---|---|
| `boxed` (`LOTERIA_FRAME2`) | halo: Grace | cost = income | Trader |
| `valued` (`LOTERIA_FRAME2_value`) | **ingot: Prosperity** | **cost** | Asset, Opportunity Event |
| `sealed` (`LOTERIA_FRAME2_sealed`) | **usage seal** | **cost** (Market: **—**) | Hazard, Market, Remedy, Relic, Grace |

The drop box is always "the Liquidity on this card": what you pay to play
it — and on a Trader, also what they pay you a turn (hire cost = income, by
rule). The class label is set in Blackletter, the wordmark's face. Events
and Artifacts use live usage medallions instead of the legacy full-canvas
type overlays in `public/TCG/badges/<type>.webp` (`TYPE_BADGE`). The rarity heart sits
under the wordmark on every plate. An art file may still pin a `frame:`.

### Artifact template

Cards whose printed class is `Artifact` use the swept teal-and-gold header
in `RcanaArtifactTemplate.jsx`. The larger subtype symbol sits to the left
of `Remedy`, `Grace` or `Relic`; `Artifact` remains on the right. The engine's
`artifact` type prints as `Relic` and uses the **Equip** seal.
Traders and Assets use the compact swept header in `RcanaTypeHeader.jsx`:
a gold number cell and a colored field with the type name in pale-gold
Blackletter. `COMPACT_TYPE_HEADER` defines its footprint and FX clearance.
`headerColors.js` assigns plum to Traders, forest green to Assets, teal to
Artifacts, and indigo to Events. All Artifact subtypes share teal; all Event
subtypes share indigo. Hazard usage seals retain their red warning color.

Rarity is **Common → Uncommon → Rare → Mythic**. Relic is exclusively an
Artifact subtype; it is not a rarity.

The lower-left seal describes use: **Single use**, **Equip**, or **To shrine**.
`artifactTemplate.js` maps these from the engine type and handles the Grace
exceptions: the Rose is **Offer**, and the Fountain is **Spend**. This is
display information only. The old subtype badge is omitted for Artifacts.
FX clearance follows the full header, including on La Tortilla's steam.

All four card classes share `RcanaLiquidityBox.jsx`: deep teal, a gold inset
and divider, a blue droplet with a pale-gold outline, and a pale-gold value.
They cover each plate's painted cyan box at the positions in `liquidityBox.js`,
so new frame artwork is not required. Liquidity stays teal across types,
independent of header color. Trader and Asset Grace/Prosperity boxes retain
their current designs.

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

### Event subtypes and usage seals

Events share the full-width swept header and medallion components with
Artifacts (`RcanaSubtypeFurniture.jsx`). `eventTemplate.js` derives the
printed subtype from the existing game type and `played` flag:

| Engine behavior | Printed subtype | Lower-left information |
|---|---|---|
| `type: "hazard"` | Hazard | Red **Until cleared** seal; pinned-card symbol |
| `type: "event", played: true` | Opportunity | Existing numeric **Prosperity** value |
| `type: "event"`, no `played` | Market | Indigo **On draw** seal; draw-card symbol |

The header uses a skull, sparkles, or globe to the left of the subtype and
`Event` in Blackletter on the gold right panel. Future cards inherit their
header and stamp automatically; they do not need new frame artwork.
Market Events print **—** for Liquidity because they resolve automatically.
The God Candle can leave an ongoing Market effect after resolving.

The playtest gallery groups all Event designs under these three subtypes,
including designs without art. The build injects the same subtype mapping
used by the live cards, without changing engine rules. Exit Scam's text
names Opportunities, Yield Farm's text names Market Events, and The World
ends ongoing Market effects; it does not clear attached Hazards.

Blank templates are also available at
`/rcana-print?template=event&subtype=hazard`, `subtype=opportunity`, and
`subtype=market`. They leave card-specific text and numbers empty. For visible
changes, render affected Event faces and rebuild the playtest table.

## Open design calls (placeholders in code, flagged where they live)

- ~~**Type → class.**~~ Settled in `TYPE_CLASS` (`set/index.js`): Trader,
  Asset (assets), Event (events and hazards), Artifact (artifacts,
  remedies, graces). Event and Artifact subtypes print beside their class
  in the swept header. The engine's seven types are untouched.
- ~~**Stats → boxes.**~~ Settled (`buildFace()`): the drop box is always
  Liquidity; the halo box is standing — Grace on a Trader, **Prosperity (the
  card's value)** on an Asset or a called Event. Other types print blank
  boxes. Cost prints as a coin in the tab on every type. Rarity stays the
  heart; by convention an Asset's rarity tracks its Prosperity tier.
- **Numbering.** Lotería numbers are assigned per face by hand. If the set
  should number by type (Traders 1–11, …), do it in `faces.js` deliberately
  rather than by insertion order.

## Performance budget (per card, from measurements in `RcanaCard.jsx`)

- Tilt is compositor-only; the FX light is the whole cost. Keep ≤ ~10 facets
  per sheet and one sheet per card unless the second is small.
- `sway` is per-card opt-in and already stops off-screen; never on in a grid.
- Grids/binders render with `showFx={false}` — a flame over a 90px card is
  noise that costs a blur.
