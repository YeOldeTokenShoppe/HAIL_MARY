# Step 2 — Tiered strike feedback (3D visual scaling) — HANDOFF

**Goal:** make the 3D oil response scale with strike size instead of every hit firing an identical full gusher. Tiers already exist (step 1, done). This step is purely the *visual* pass.

```
dry        → dust/rock kick-up only (already correct)
strike     → dust + a small "seep" oil bubble (NEW)        + tank tick + soft blip
gusher     → dust + the full geyser + shake/roar           + Polaroid/CCTV/broadcast
motherlode → dust + bigger/tinted geyser                    + amplified extras
```
Design rationale + the dual-feature context is in `docs/oil-game.md` and memory `oil-timeline-feed`. The rock/dust kick-up is the CONSTANT across all strikes; the OIL response is what scales.

## What's already done (step 1 — shipped, building green)

- `oil-strike-tick/route.js`: `tierFor(oil)` classifies each strike relative to the field's richest cell (`maxOil`): **gusher ≥ 50%**, **motherlode ≥ 85%** (self-calibrating per season; tune these two fractions here). The tier is written to **`gusherEvents.tier`** on every strike doc AND drives the feed label.
- Feed (`page.js`): `TIMELINE_META` has strike/gusher/motherlode (icon/color/verb); single-rail FIELD ACTIVITY panel renders them. Confirmed working ("struck oil" vs "gusher" vs "MOTHERLODE!").
- So **the renderer can just read `ev.tier` off each `gusherEvents` doc** — no recompute needed.

## The work (in order)

1. **Scale the geyser by tier in BOTH render paths.** Height / particle count / duration ∝ tier. Small strike = short low "seep" bubble; gusher = current beam; motherlode = bigger (+ tint).
2. **Gate the dramatic extras to gusher+** (screen shake, roar/sound, auto-Polaroid/CCTV capture, field-wide broadcast). Small strikes get only the seep + dust + tank tick + soft blip.
3. **Fire the dust/rock kick on every strike** so it shows in admin FORCE-STRIKE testing too (currently it doesn't — see gotcha below).

## STATUS — step 2 SHIPPED (build green)

There turned out to be only **one** geyser component to scale: the field "multi-beam"
is just N `Pumpjack` instances (one per active `gusherEvents` cell, plus the highlighted
rig) — the `ShaderGusher`/`RemoteGusher` split from the old memory no longer exists. So
tiering `Pumpjack` covers both the close-up and the field view.

**Done (`OilVoxelGrid.jsx`):**
- `GUSHER_TIER_VIS` config (after the gusher consts, ~line 961) — per-tier `height / width /
  duration / spill / blowback / dust / tint`. **This is the single tuning table.** `tierVis(t)` helper.
- `Pumpjack` takes a `gusherTier` prop (mirrored to `gusherTierPropRef`); the active run's
  tier is frozen into `gusherTierRef` at `initGusher` time.
- `initGusher(hell, tier, durationOverride)` — resolves tier (explicit arg → prop → "gusher";
  hell rides "motherlode"), sets duration from the tier, **fires `initDust(vis.dust)` on every
  eruption (fixes #3)**, and seeds geyser/spill scale. Per-frame loop keeps geyser `scale`
  (width/height) + base anchor, `spill` scale, `uTint`, and the rig **blowback** all tier-scaled.
- Geyser fragment shader: new `uTint` uniform → molten-gold push for motherlode (off for hell).
- `initDust(intensity)` scales the kick velocity by tier (particle COUNT stays fixed — mobile budget).
- `PumpjackInstances` builds `gusherTierByCell` from `gusherEvents` and passes `gusherTier` per cell.
- Fixed hell-banish fade to use `gusherDurationRef` (was hardcoded `GUSHER_DURATION`, broke now
  that hell runs the longer motherlode duration).

**Done (`page.js`):**
- Auto-Polaroid (~2695) and CCTV recording (~1930) now **skip `tier === "strike"`** — captures/clips
  reserved for gusher+. Small strikes get only the in-world seep + dust + tank tick.

**Tuning:** all feel knobs live in `GUSHER_TIER_VIS`. Current values: strike `height 0.7 / width 0.55 /
sputter:true` (recurring coughs, see below), gusher = baseline 1.0, motherlode `height 1.45 / dur +1.5s / tint 1.0`.

### Strike tier = a *droplet fountain*, a different primitive (not a scaled column)

Scaling the geyser column down still read as "gusher, smaller" — the column is fundamentally a
*continuous* turbulent beam, so any size of it looks like a jet. A weak well needs a different
*primitive*: **discrete ballistic droplets** that arc up from the nozzle and fall back.

- **Dedicated shader** `_sputterFragmentShader` (+ `_sputterVertexShader`) — a per-pixel particle
  fountain (ballistic `y = yv·t − ½t²`, recycled per arc) adapted from a Shadertoy fountain, ported to
  our conventions: **transparent** (alpha = droplet coverage, no opaque background), **Lyquid80 cyan**
  (not the original fire palette), and the particle budget **cut hard** to `SPUTTER_PARTICLES` (28),
  single loop, for the mobile GPU ceiling. Its own mesh/material (`sputterMeshRef`/`sputterMatRef`),
  a short squarish billboard (`0.9 × 1.2`) anchored so droplets launch from the wellhead at uv (0.5, 0).
- **Runs continuously** while the strike's event is live → inherently persistent + un-missable AND
  obviously not a jet, so the cough-cycle envelope is gone. `overflowing` for the sputter tier =
  `gusherActivePropRef` (keeps it alive until banked); a small steady puddle is the at-a-glance marker.
- **Mutually exclusive with the geyser column:** exactly one of `{geyserMesh, sputterMesh}` is visible,
  chosen by tier in `initGusher` + reconciled per-frame. Gusher/motherlode still use the geyser column.
- **Pump keeps running** for strikes (`initGusher` skips the pump-pause/head-tilt/oil-stain; blowback 0).
- **A/B toggle:** `STRIKE_FOUNTAIN` (default ON) — `?sputtershader=0` falls back to the scaled-column
  + cough-envelope (the `STRIKE_SPUTTER_*` consts still drive that fallback path). Lets you compare.
- Persistent *record* also lives in the FIELD ACTIVITY feed (who/what/when), independent of the 3D moment.

**Tuning the fountain:** `SPUTTER_PARTICLES` (count — bump up only after checking phone FPS with several
strikes live), droplet `r`/`aa` + launch `xv`/`yv` ranges inside `_sputterFragmentShader`, plane size +
anchor in the `sputterMeshRef` JSX. Sustained tiers unchanged.

**Not done / deferred:** no audio system exists yet, so "roar/sound" gating is N/A (note for later).
The strike-reveal screen-shake on the *highlighted* rig (`revealStrike`) is unchanged — it's the
local suspense rumble, mostly admin/demo; the eruption blowback is what now scales by tier.

## Key files & symbols (line numbers drift — grep the symbols)

**`src/components/OilVoxelGrid.jsx`** (the 3D, ~4000 lines, perf-sensitive):
- Geyser shaders: `_geyserVertexShader` / `_geyserFragmentShader` (~490–630); iridescent palette `GUSHER_IRID` / `GUSHER_GLSL` (~313–331).
- Per-rig geyser: `geyserMeshRef` / `geyserMatRef` / `geyserUniforms` (~2319–2326); fire/reveal logic in the strike effect (~2440–2475, `forceStrikeGusher` path); `GUSHER_DURATION` (~948); feeder depth `GUSHER_FEEDER_*` (~957–959).
- **Dust/rock system:** `DUST_COUNT=80` (~2094), `initDust()` (~2543), trigger effect on `drillEvent` (~2573, gated on `highlighted`), extra dust "waves" during the boring phase (~2833–2839). Dry-layer = dust-only (no shake/oil) — already tiered.
- **Find the field-wide multi-beam path** — the per-rig `geyserMesh` is for the highlighted rig; the field view shows MANY beams at once (see the screenshot). I did NOT fully locate the field remote-beam renderer this session — START HERE: grep how `gusherEvents` are consumed for the 3D, and see memory `oil_dual_gusher_renderers` ("Pumpjack geyser (wellhead-anchored) vs ShaderGusher/RemoteGusher for remote/test gushers, GUSHER_WELLHEAD_OFFSET"). BOTH paths must scale by tier or the feel will be inconsistent between field and close-up views.

**`src/app/hailmary/page.js`:**
- `gusherEvents` subscription (~1563, `where status == active`) — carries `.tier` now.
- `drillEvent` increments when `effectiveDrillDay` rises (~2825–2841). **Admin/report `effectiveDrillDay = demoDay`** (~1805) — NOT advanced by FORCE STRIKE — which is why dust doesn't show in admin testing. For step-2 #3, drive the dust off the strike/`gusherEvents` path (or also kick it on `oilStrike`/`forceStrikeGusher`).
- `oilStrike`/`combinedStrike` (~2768, 2822), `forceStrikeGusher` prop, `<OilVoxelGrid>` usages (~5956 desktop, ~6514 mobile).

## Gotchas

- **Dual gusher paths** (memory `oil_dual_gusher_renderers`): wellhead offset differs; scale BOTH.
- **Mobile GPU ceiling** (memory `little_book_mobile_gpu`): keep the "seep" cheap (few particles, short-lived); don't add heavy 3D.
- **iOS CanvasTexture gotcha** (memory `r3f_ios_canvas_texture_gotcha`) if any new canvas-textured FX.
- **Admin testing quirk:** FORCE STRIKE fires the beam (via `gusherEvents`) but NOT the dust (dust = `demoDay`/local drill). Fixing #3 also fixes testing visibility. Until then, use the DRILL DEMO play button to see dust.

## Tuning knobs
- Tier thresholds: `gusherThreshold` (0.5) / `motherlodeThreshold` (0.85) in `oil-strike-tick` `runTick`.
- Watch real strikes and adjust — on a small grid/few deposits, `maxOil` can be high, making gushers rarer than expected.

## How to test
- Admin → FORCE STRIKE a deep rig (deep=20). Feed should already tier correctly. After step 2: beams should differ by size, and dust should kick on each strike.
- DRILL DEMO play button shows the dust sequence today (drives `demoDay`).
- RESET BOARD clears `oilTimeline` + gushers for a clean run.
