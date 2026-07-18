# Hologram Card — /trade centerpiece handoff

_2026-07-18 — Cowork session with Claude. The rotating 4-color geometric knot
at the center of the /trade desks is replaced by a holographic trading card:
"the card in play." This note is the handoff for continuing in Claude Code._

## What changed

**New: `src/components/trade/HologramCard.jsx`**
R3F component. Two shader planes (front/back) anchored to the GLB beacon the
same way `BeaconBeam` follows its anchor (`getWorldPosition` → parent-local
each frame), so the card floats exactly where the knot did, bobbing in the
projector beam.

Shader features: rounded-corner die-cut mask, scanlines, flicker, ambient
glitch bands, chromatic fringe, edge rim glow, holo tint (luminance → cyan),
glitch **burst** on reveal. Textures load without suspending the scene
(`uReady` uniform discards until loaded — no black-card flash).

**Edited: `src/components/CyborgTempleScene.jsx`** (4 touch points)
1. Import of `HologramCard` (top, after `BeaconBeam`).
2. `export const SHOW_LEGACY_BEACON = false;` — next to
   `GEOMETRIC_SHAPE_NUDGE`. Flip to `true` to restore the GLB knot instantly.
   The hidden knot still anchors beam aim + card position (matrixWorld updates
   regardless of visibility), so toggling moves nothing else.
3. `child.visible = SHOW_LEGACY_BEACON;` in the `beaconContainerRef` capture
   block (hides the knot's "Empty" container and its Shape* children).
4. `<HologramCard anchorRef={beaconRef} mode={revealMode ? 'reveal' : 'delib'} />`
   mounted right after the `BeaconBeam` block — deliberately OUTSIDE the
   `!revealMode &&` gate, so the flipped card is already face-up when the
   camera returns from the curtain call.

## States

- `delib` — card back to the viewer, swaying in the beam. The table is
  working the case; the verdict is face-down.
- `reveal` — flips to the front with a glitch burst. Currently driven by
  `revealMode` (any of aligned/missed/abstained → same flip).
- `idle` — slow free tumble. **Unused so far** — natural fit for
  between-cases / lobby state.

## Config (`HOLOGRAM_CARD_CONFIG`, exported from HologramCard.jsx)

- `front` / `back` — art paths. Front is a PLACEHOLDER
  (`/TCG/actionCard_PumpSignal.png`); back is `/cardBack.webp`.
- `aspect` — currently `824/1578` to match the legacy Pump Signal render.
  **Switch to `744/1038` when Genesis template art lands.**
- `height` (0.36) / `yOffset` (0.02) — size and lift vs the 0.7-tall beam.
  Eyeballed, may want tuning against the real desks.
- `holo` / `scan` / `glitch` / `opacity` — hologram look. `holo` 0 = full-color
  print, 1 = pure cyan projection.
- `billboard` (true) — card yaw-tracks the camera so back/front hold from any
  orbit angle. `false` = fixed world facing via `faceYaw` (players can orbit
  to peek at the hidden face).
- `sway` / `bob` — motion amplitudes.

## Open design decision (the real next step)

What IS the card each round? Candidates discussed:
- the **topic/coin card** dealt from the docket (face-down while the four
  counselors analyze, revealed as "this was the case");
- the **verdict card** (front chosen at resolution — could color/vary by
  aligned vs missed);
- the **reward card** the player earns (ties into packs/binder).

Wiring plan for any of these: pass a `config` prop (or just the front src +
aspect) from the trade page's case state. `revealMode` already drives the
flip; the topic is known at case start, so the front texture can be set
during `delib` while it's safely face-down. Card data lives in
`src/game/terminal-traders/cards.js` + `templateCard.js` (`CARD_ART` maps
card ids → art). Note: template cards are CSS-rendered (`TradingCard`
component), not textures — for arbitrary cards the scene needs either
pre-rendered art per card or a render-to-texture step (html-to-canvas of
`TradingCard`, cached per card id).

## Misc

- three is 0.185 — use `texture.colorSpace = THREE.SRGBColorSpace` (the old
  `sRGBEncoding` API is gone; already fixed once, don't reintroduce via r128
  snippets).
- A standalone tweakable mock (vanilla three.js, thread-halo variant
  included) was delivered in the Cowork chat as `hologram-card-mock.html`.
- The 4-thread halo idea (counselor threads orbiting the card, consensus =
  calm rings vs snarl) was prototyped and CUT for now — revisit only if the
  scene needs more motion.
