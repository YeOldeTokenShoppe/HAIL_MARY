# The Ascension — scene integration plan

How to turn the real `/trade` hub scene ([CyborgTempleScene.jsx](../../components/CyborgTempleScene.jsx))
into the race: **remove the round platform, swap the desk for a long track, reuse the
monitors as the live charts, keep the moon as the finish.** Based on a read-only scout
of the scene (June 2026). The scene is one big GLB traversed at runtime in a `useEffect`.

## Approach: a `raceMode` prop, not a fork
Add a `raceMode` prop to `CyborgTempleScene`. In the GLB-traversal `useEffect` (~line 2401)
toggle visibility by mode; in the JSX return (~line 5777) conditionally render a new track
group. Everything stays in one scene so the camera, lights, grid void, and moon are reused.

## What to hide in race mode
- **Round/hex platform + ticker rings** — all `Cylinder*` meshes (the glow pass is at
  lines 2404–2416, `Cylinder043_0` ref at 2418). Set `.visible = false` for `Cylinder*`.
- **The desk/workstation** — lives under the `StageProps` group (lines 1003–1009; today
  toggled by `revealMode` via `stageProps.visible = !revealMode`).
  ⚠️ **VERIFY FIRST (open question #1):** does `StageProps` also contain the `Screen1–4`
  meshes we want to KEEP as charts? If so, do **not** hide the whole group — enumerate
  `StageProps.children`, identify the desk sub-meshes, and hide those selectively.

## What to reuse
- **Monitors as charts** — `Screen1–4` (and optionally `ScreenA–D`), lines 2603–2617.
  Their content is GLB-baked but the project already swaps screen-like materials to a
  `CanvasTexture` for SitePal faces (the `ensureMaterial()` pattern, lines 4210–4239:
  `MeshBasicMaterial({ map: CanvasTexture, toneMapped: false })`). **Bind the ChartPanel
  canvas to the Screen meshes' `material.map` the same way** — reuse the exact
  `ChartPanel` drawing code, just render to the screen meshes instead of a standalone
  plane. One shared overlaid chart can map to one screen; or split per-racer across screens
  later.
- **The moon / beam** — there's an angel `SpotLight` (lines 5796–5813) and point lights
  (`Point003/006/00`). No mesh literally named `Moon` was found (open question #2 — likely
  baked, or it's the beam). Simplest: **place our own moon sphere** at the track's far end
  (as the dev harness already does) and treat it as the finish; reuse the existing beam for
  atmosphere.
- **Our Lady** — `HolographicStatue3` (config at lines 112–121) is imported but currently
  commented out (lines 5785–5791). Re-enable and reposition it above the finish as the
  divine guide.

## What to add
- **The long track group** — port the harness `RaceTrack3D` (flat lanes + finish line)
  but stretch it into a long runway pointing at the moon beam through the grid void.
  Insert as a conditional group after the main `groupRef` closes (~line 5829):
  `{raceMode && <RaceTrackGroup ... />}`.
  ⚠️ **Scale (open question #4):** the scene group is scaled `1.2`. Put the track inside
  the same scaled group, or apply matching scale, so world units line up.
- **The runners** — the GLB's characters are parented into the workstation scene and hard
  to re-pose onto a track. Simplest: **load separate racer GLBs for race mode** (the
  harness already mounts its own racers), rather than reusing the baked-in characters.

## Camera (open question #3)
`CameraControlsRig` (page.js ~line 632) is tuned to orbit the workstation. The race wants a
**side/tracking shot down the runway** toward the moon. Add a race camera pose (or a rig
branch) activated with `raceMode`, separate from the current orbit/intro logic.

## Open questions to resolve before/while implementing
1. Is `Screen1–4` inside `StageProps`? (Determines whether we can hide the desk by hiding
   the group, or must hide desk sub-meshes selectively.)
2. Is there a baked moon mesh, or do we add our own? (Leaning: add our own.)
3. Race camera framing — new pose vs. new rig branch.
4. Track scale relative to the `1.2`-scaled scene group.
5. Reuse baked characters vs. load separate racer GLBs for the track (leaning: separate).

## Recommended sequencing
The dev harness (`/ascension-dev`) already embodies the long-track + overlaid-chart look,
so **finish the gameplay there first** (real GLBs + Mixamo clips, the auto turn-loop, Our
Lady's on-track presence). Do this scene swap as one focused milestone afterward — it's
well-understood now, but it's surgery on a large stateful component and shouldn't block the
fun part. The `ChartPanel` and `RaceTrack3D` components are written to port directly.
