# Exporting the pump-jack plot (allProps4)

The plot the game loads by default is `public/models/oilJack_fancy_allProps4.glb`. It is
built from the Blender scene in `~/Documents/Codex/2026-09-05/fo-x20/outputs/HMPC_Rig_Discovery_Pass_chiralL.blend`
in two steps: a Blender glTF export of the plot objects, then `scripts/optimize-rig.mjs`.

## 1. Blender export

**Frame 1 first.** The field shader reads each node's transform as the rest pose, so the
timeline must sit on frame 1 (beam level, counterweights down, rod at the top) when you export.

**Select exactly the plot.** Everything visible within the plot footprint, plus the seven
marker empties. As of 2026-09-07 (panel rebuild) that is:

- Rig: `Bottom_Box` (root) with `Body_Pump` → `Head_Pump`, `Counterweight`, `Wheel_Back`,
  `Straw`, `Pitman`, `Motor_Pulley`, `Belt`, `Belt_Clip_01..03`, `Samson_Post`, `Under_Pump`
  (+ `Safety_Rails` and `Service_Platform`, split off on 2026-09-08 for independent paint)
  (+ `Under_Pump_Pipes`, `Under_Pump_Pipe_Panel`, split off for the themes), `Pipe_01`, `Wheel_BOP`
- Markers (empties): `CrankPin_Left`, `CrankPin_Right`, `BeamPin_Left`, `BeamPin_Right`,
  `CrankAxle`, `RodRef`, and `FlareTip` (child of `Pipe_03`, at the riser nozzle). **They look
  unused in the outliner and are not.** The field's pitman four-bar reads the five crank/beam
  markers; without them the merged field falls back to a cosine drive. They were deleted in a
  tidy-up once (2026-09-07) and rebuilt from geometry: `CrankAxle` = the `Counterweight`
  origin, `CrankPin_L/R` = the `Pitman` origin at each arm's x, `BeamPin_L/R` = the centroid of
  the Pitman's top bearing at each arm's x, all at frame 1, parented to `Bottom_Box`.
- Plot props: `Alert_Light_RED`, `Well`, `WellFrame`, `Pipe_03` with `Wheel` (riser valve),
  `Wheel_BOP`
- Machine panel: `MachinePanel_Body` (themed), `DANGER_LABEL` (decal plane, never painted),
  `PressurePanel` + `PressurePanelFrame` (the single LED screen), `Gauge` with `GaugeNeedle`,
  `Gauge_Marks`, `Gauge_Yellow/Orange/Red`, `RedButton` + `RedButtonBorder` + `RedButton_Housing`
  + `RedButton_Plate` (the open EXTRACT hex, left), `PassButton` + `PassButton_Housing` +
  `PassButton_Cover` (the caged PASS button, right), `Text_Extract`, `Text_Pass`,
  `Toggle_N/E/S/W` on `Toggle_*_Base`, `Lamp_N/E/S/W` with `Lamp_*_Border`, `Key_Housing` +
  `KeySwitch` (the +Y side face)

Leave out anything prefixed `OLD_`, the parked panel parts far from the origin, the
towers (`SM_Bld_*`, `GasTowerWindow`; the game loads the tower separately), the stray
`Icosphere`/`Cylinder.001`/`Plane.080`, and any mesh with no faces or no material.

The panel borrows from several Synty packs. To keep the texture count down, the gauge parts
and the toggle levers had their UVs collapsed onto flat swatches of the SciFi Horror atlas
(2026-09-07; the original UVs are kept in a `UV_orig` layer) and the alert light points at the
same 4096 atlas as the rest. Any new panel part should reuse an atlas already in the export
(SciFi Horror colour/emissive, Gang Warfare, Military, Apocalypse Wasteland) or be a flat colour.

**Exporter settings** (File → Export → glTF 2.0):

| Section | Setting |
|---|---|
| Format | glTF Binary (.glb) |
| Include | Selected Objects only |
| Transform | +Y Up |
| Mesh | Apply Modifiers off, UVs on, Normals on |
| Material | Export, Images: Automatic |
| Compression | Draco on (optional; the optimizer decodes it) |
| Animation | on, Mode: **NLA Tracks**, Merge Animation: **NLA Track**, Force Sampling on, Optimize Animation Size on |
| Skinning / Shape Keys / Lights / Cameras | off |

Every animated part carries its clip on an NLA track named `pump`, so the export yields one
clip called `pump`. Write to `models-src/oilJack_allProps4_raw.glb`. The same export runs from
a script: select the set above, `scene.frame_set(1)`, then `bpy.ops.export_scene.gltf(...)`
with `export_animation_mode='NLA_TRACKS'`, `export_force_sampling=True`,
`export_frame_range=False`, `export_apply=False`, Draco on, skins/morphs/lights/cameras off.

## 2. Optimize

```bash
RIG_EXCLUDE=OLD_Pipe_01 node scripts/optimize-rig.mjs models-src/oilJack_allProps4_raw.glb public/models/oilJack_fancy_allProps4.glb
```

`RIG_EXCLUDE` matters: the script's default excludes `Pipe_01`, which on this rig is the
wellhead. The script keeps empty leaf nodes (the markers) and shrinks every atlas to 1024px WebP.

## 3. Cache-bust

Bump the `?v=` on the allProps4 URL in both loaders, `src/components/OilVoxelGrid.jsx`
(`FIELD_RIG_GLB`) and `src/components/RigScene.jsx` (`RIG_GLB`), then confirm with
`grep -n 'allProps4.glb?v=' src/components/OilVoxelGrid.jsx src/components/RigScene.jsx` —
if either lags, the browser keeps serving the previous GLB from cache and the page lies to you.

## Placement conventions

- `Bottom_Box` (rig root) sits at world z 0.03 so the skid rests on the ground as a platform.
  Its tail was shortened by 0.69 on 2026-09-08 (one empty rail bay removed behind the motor;
  skid now ends at world y 1.70) for the portrait phone frame. The pre-cut mesh is kept in the
  blend as the `Bottom_Box_pre_shorten` mesh datablock (fake user): assign it back to the
  object to revert.
- `Well` and `WellFrame` are world-space objects (not children of the rig): a black box (`Well_Void`,
  roughness 1, specular 0) whose top is 5 cm above ground and an 8 cm concrete-grey curb
  (`WellFrame_Concrete`) around it. The well is a single upward quad; the curb has no bottom
  faces, outward normals, and its walls run 2 cm below ground so they cut the terrain instead of
  sharing an edge with it (2026-09-08 — the curb shipped inside-out with an upward-facing bottom
  ring lying exactly on the ground plane, which flickered against the ground on desktop). Never
  make a face coplanar with the terrain. Anything meant to read as a hole must be a dark surface
  *above* the terrain — a pit below it is hidden by the ground plane.
- Pipe drops must end below world z 0 or they float.

## Names the game depends on

- Zones (theme paint): `Body_Pump` beam, `Head_Pump` horse head, `Counterweight`, `Wheel_Back`
  crank wheel, `Straw` drill pipe, `Bottom_Box` base, `Samson_Post` post, `Under_Pump` motor
  box, `Safety_Rails` both upper/lower railings, `Service_Platform` upper deck, `Pipe_01`/`Pipe_03`/`Under_Pump_Pipes` pipes, `Wheel` valve, `MachinePanel_Body` +
  `Under_Pump_Pipe_Panel` machine panel (since the DANGER decal moved to its own `DANGER_LABEL`
  plane, 2026-09-07), `WellFrame` well curb (stock = concrete; no fallback, a theme must name it).
  New presets explicitly paint the post, rails, platform, and curb. Missing zones in older
  saved configs fall back to a sibling (post → base/beam, rails/platform → base,
  counterweights → crank wheel, motor box → base plate; `ZONE_FALLBACK` in OilVoxelGrid.jsx). Unlisted names keep their
  atlas colours: the decal and every panel instrument stay stock. The body name still starts
  with `MachinePanel`, which is what the zoom-to-panel hooks match on.
- The machine-panel cluster was moved 0.14 toward the head on 2026-09-08 so the counterweight
  sweep (radius 0.75 about the crank axle) clears the key switch; keep that gap if you move it.
- Hooks: `Straw` (wellhead position and gusher), `Head_Pump`/`Body_Pump` (gusher flip and
  blowback), `RedButton*` (EXTRACT: first click zooms, then drains; the border/housing/plate
  share the prefix so they are click targets too), `PassButton*` (two-click PASS: a click on
  the cage swings `PassButton_Cover` open about its top hinge, a second click on `PassButton`
  fires `hm:pass-confirm` on window for the v2 route; anything else or 8 s drops the cover),
  the rig card's MACHINE PANEL chip (dispatches `hm:focus-panel`; the highlighted rig zooms),
  `Wheel` (the riser valve: click-to-spin; the preventer's wheel is `Wheel_BOP`), `FlareTip`
  (its origin is the flame anchor for the planned PASS flare), `PressurePanel` (the one LED
  screen; with no `PressurePanel2` the depth readout docks beside the panel until the
  single-screen readout is written), `GaugeNeedle` (pivot at the dial centre, turns about the
  panel normal), `Toggle_N/E/S/W` (lever pivot at the base top; a tap flips the lever ±55° about
  its local X — the panel's width axis — as a per-neighbour lateral standing order, state in
  localStorage `hm:lateral-switches`, announced as `hm:lateral-toggle`; `TOGGLE_*` in
  OilVoxelGrid.jsx), `Lamp_N/E/S/W` (lit by code when that neighbour has an open layer;
  `window.__hmLamps.set(dir, on)` for testing), `KeySwitch`,
  `Well`/`WellFrame` (unpainted).
- Field linkage: `Pitman` plus the six markers drive the merged-field four-bar.

## Checks after an export

- The raw GLB's image list should have every atlas you expect. An export taken while a part
  is mid-edit has shipped with a texture missing once.
- The optimizer prints `clips pump` and the node count; markers should survive (69 nodes,
  5 textures after the rail/platform split on 2026-09-08; v18). Seven empties expected.
- Load `/hailmary?stock=1` to see the rigs unpainted, then a themed view.
- If the console shows `mergeAttributes() failed. BufferAttribute.gpuType must be consistent`
  and the field goes black, a primitive was written with interleaved vertex data (Draco
  skips non-indexed primitives such as a lone triangle, and gltf-transform interleaves
  whatever it writes raw). The optimizer now writes raw data SEPARATE and the field merge
  de-interleaves defensively; keep both. Do not add `weld()` to fix it: its internal prune
  deletes the marker empties.

## The community tank (GasTower.glb)

Separate model. The default community tank is the windowed tank-on-legs (`TANK_TOWER_URL`,
OilTower.glb); the Synty derrick is behind `?tower=derrick` (`DERRICK_URL`, GasTower.glb). Export the
`GasTower` object (with its `GasTowerFloor` child and the `GasTowerWindow` empty) centred on the
origin with its base at z 0, animation off, to `models-src/GasTower_raw.glb`, then:

```bash
node scripts/optimize-rig.mjs models-src/GasTower_raw.glb public/models/GasTower.glb
```

and bump `TANK_TOWER_URL`'s `?v=`. Names that matter: any mesh starting `GasTower` is clickable
(zooms to the `GasTowerWindow` empty on the −X face); an opaque tower glows with the community
fraction, a tower with a transparent `GasTowerWindow` mesh shows the liquid column instead.

## Rail/platform separation (2026-09-08)

`Safety_Rails` collects all 776 rail faces: 736 from `Bottom_Box` and 40 small
faces that were in `Samson_Post`. `Service_Platform` contains the 20-face upper
deck. Both are static children of `Bottom_Box`, with identity local transforms.
All 1,583 original faces across the two source meshes and their UVs were verified
unchanged after separation. The post keeps its ladder and A-frame.

Include both new objects in every subsequent export. They share the original
Military atlas, so the split adds no textures. PimpMyPump exposes independent
SAFETY RAILS and SERVICE PLATFORM zones; new themes use beam paint on the rails
and a brushed motor-box color on the deck. Older saved configurations that lack
the zones inherit base paint. Explicit STOCK choices are respected.

## Crew stations and the crew character (2026-09-09)

The plot now carries four **station empties** for the crew workers. In the blend they are
parented to `MachinePanel_Body` and `Samson_Post`; **add them to the plot selection above**
(`Crew_Panel_Pass`, `Crew_Panel_Extract`, `Crew_Ladder_Base`, `Crew_Ladder_Top`). They are
not in the shipped allProps4 (v22) yet; they ride along in the next export. The optimizer
keeps them (empty leaves) like the crank markers.

Frame convention: origin between the feet at sole level, local +X = facing. Drop a crew GLB's
root node onto a station's world transform and the worker stands there. `Crew_Panel_*` put the
`crew_push` fingertip on the PASS / EXTRACT button (the two are 0.172 apart along the panel).
The climb goes straight up from `Crew_Ladder_Base` on the `crew_climb` loop until the soles
are 0.479 below platform height, then `crew_topOfLadder` (her Mixamo clip, 2026-09-11) carries
the worker the rest of the way: its root path rises 0.474 and steps 0.334 forward (along the
station's facing) onto the landing, and the page rides the group along that same path so the
feet stay on the rungs. From the landing a 0.35 s slide reaches `Crew_Ladder_Top`, which sits
9 cm further inboard (x -0.45 vs the landing's -0.363; move the empty to x -0.363 and the slide
vanishes). `hm_climb_rise_m` (0.154 per 0.8 s cycle) is the world rise the in-place
`crew_climb` loop expects per cycle, so the whole climb takes about 9.5 s (5.4 s on the rungs,
4.0 s topping out). With Custom Properties on, each empty exports `hm_station`, `hm_clip` and
(base only) `hm_climb_rise_m`, `hm_climb_cycle_s` as extras.

Five more spots were added on 2026-09-09 for the "found doing" activities (unsaved until
Michelle saves the rig blend). Same frame convention; extras `hm_station`, `hm_clips`, `hm_look`:

| Spot | Blender x, y, z | facing | parent | activities |
|---|---|---|---|---|
| `Crew_Motor` | 0.40, 0.70, 0.236 | 180° | Under_Pump | idle, tablet (east side, clear of the crank sweep) |
| `Crew_Rail_Doze` | 0.45, 2.157, 0.236 | -90° | Bottom_Box | SEAT MARKER at the north walkway rail: marks where the worker's BACK goes; the page seats the body 0.50 forward along the arrow (the seated pose reaches 45 cm behind its origin, ±28 cm sideways). Put doze markers at the rail. |
| `Crew_Rail_Doze_Top` | 0.25, -0.42, 1.725 | -90° | Service_Platform | seat marker at the platform's north rail, same rule (excludes the lookout: same zone) |
| `Crew_Lookout` | 0.363, -0.776, 1.725 | -90° | Service_Platform | idle, tablet, wave, facing the horse head (Michelle's spot; replaces Crew_Platform_Lookout) |
| `Crew_Valve` | -1.05, -2.445, 0 | 90° | Pipe_03 | idle, wave, tablet (south of the riser wheel, facing it; a valve-turning clip is wanted) |
| `Crew_Wellhead` | 0.556, -2.092, 0 | 180° | Bottom_Box | idle, tablet (east of the curb, on the ground) |
| `Crew_Panel_Aside` | 0.655, -0.38, 0.245 | 174° | MachinePanel_Body | where the operator steps while the panel view is open |
| `Crew_Chat_A` / `Crew_Chat_B` | 0.155, 1.821 / -0.345, 1.821, 0.236 | 180° / 0° | Bottom_Box | the chat pair on the north walkway (2026-09-11 wrap-around base), facing each other 0.5 apart |

All thirteen empties shipped in the rig export of 2026-09-11 (v24, wrap-around walkway; the skid now runs to y 2.23):
the optimizer keeps them and, with Custom Properties on, their `hm_*` extras. Export note: the
panel instruments hang off `MachinePanel_Body_Door` in the blend, which is not exported; the
scripted export temporarily mirrors the live GLB's parenting (levers under their bases, needle
and dial faces under `Gauge`, cover under `PassButton_Housing`, key under `Key_Housing`) so the
page's absolute lever/needle rotations keep their frames, then restores the door parenting.
`crew_ninjaStance` is reserved for attacks (the guard loop between throws); `alert` mode plays
`crew_nervous` during a hell breach with no demon in range.

World transforms of the first four, before `PUMPJACK_SCALE` (glTF/three is Blender x, z, -y; the yaw survives as
`rotation.y`):

| Station | Blender x, y, z | three x, y, z | yaw |
|---|---|---|---|
| `Crew_Panel_Pass` | 0.655, -0.863, 0.245 | 0.655, 0.245, 0.863 | 3.036 rad (174°) |
| `Crew_Panel_Extract` | 0.655, -1.035, 0.245 | 0.655, 0.245, 1.035 | 3.036 rad |
| `Crew_Ladder_Base` | -0.697, -0.755, 0.236 | -0.697, 0.236, 0.755 | -0.054 rad (-3°) |
| `Crew_Ladder_Top` | -0.450, -0.760, 1.725 | -0.450, 1.725, 0.760 | -0.054 rad |

**Crew character** lives in its own file since 2026-09-09:
`~/Documents/Codex/2026-09-05/fo-x20/outputs/HMPC_Crew_Goblin.blend` (30 fps; the rig blend is
back at 24 fps). The rig blend's `Collection` is linked into it as the read-only `RigRef`
instance, so the panel, ladder and station empties are always current for authoring; the
crew's own objects live in the local `Crew` collection. It exports to
`models-src/crew_goblin_raw.glb` → `public/models/crew_goblin.glb` (~1 MB, 48 nodes, one skin
of 44 joints, two 512 px WebP atlases). One command does the export and the optimize:

```bash
scripts/export-crew.sh
```

(`scripts/export-crew.py` inside background Blender, then `optimize-rig.mjs` at 512 px.) It
selects `Crew2_Empty` and everything under it, so a prop bone-parented to the armature (name
it `Prop_*`, e.g. `Prop_Tablet` on `hand_l`) rides along as a child of that joint and the page
shows it per activity. The script unhides the family first: an object hidden with the eye
icon silently refuses selection and drops out of the export (the tablet vanished that way on
2026-09-10; the printout's `could_not_select` should stay empty). Bump `CREW_GLB`'s `?v=` only
after the optimizer has written the file — the dev server hot-reloads the new URL at once and
the browser caches whatever bytes are there at that moment. A prop can move within a clip: give it its own action on an NLA track
named like the clip (`Prop_Tablet` has `crew_tablet_prop` on a `crew_tablet` track, 1-995) and
the exporter merges it into that clip. The tablet's track tilts it 26-29° up on its right
edge (pivot = left edge, in the left hand's grip) so the right thumb and fingertips rest on the
screen during the hold (frames 958-995 and 1-31), lets the thumb press it flat over 31-46, and
lifts it again over 942-958; keys 1 and 995 are identical so the loop is seamless. By hand the same export is: select `Crew2_Empty` +
`Armature` + `SK_Dungeon_GoblinMale_01` + `SM_Chr_Attach_Helmet_02` with `Crew2_Empty` at the
identity (the script does this and puts it back), NLA Tracks, Force Sampling, frame range off,
Apply Modifiers off, Skinning on, Custom Properties on, Draco off. Then:

```bash
RIG_TEX_SIZE=512 node scripts/optimize-rig.mjs models-src/crew_goblin_raw.glb public/models/crew_goblin.glb
```

Nineteen clips ship (2026-09-11, 1.83 MB with `RIG_RESAMPLE=1`, which `export-crew.sh` sets):
the six below plus `crew_topOfLadder` 4.0 s (one-shot, root-motion: hanging on the ladder →
standing on the landing; its start root was unified onto the shared frame and the root pinned
for the whole clip, the path it walked is sampled into `TOP_PATH` in RigCrew.jsx — re-sample if
the clip is retimed or re-imported), `crew_clap` 1.2 s, `crew_cheer` 1.9 s, `crew_victory1` 1.9 s, `crew_victory2`
1.7 s (a spin jump), `crew_cower` 1.5 s (one-shot into a held curl; its root was lifted per
frame so it stays on the floor), `crew_throw` 2.2 s (right hand, release at 0.83 s, straight
down the facing), `crew_nervous` 6.3 s, `crew_acknowledge` 2.0 s, `crew_ninjaStance` 9.2 s
(turns through 160°, flavor only), `crew_talking` 10.3 s, `crew_shrug` 2.0 s,
`crew_musicListening` 4.5 s. Bump `CREW_GLB`'s `?v=` only AFTER the optimizer has written the
file: hot reload fetches the new URL at once, and a browser that grabs it mid-export caches the
old bytes under the new name (2026-09-10). Clips are the NLA track names: `crew_idle` 7.0 s loop, `crew_tablet` 33.2 s loop, `crew_push`
3.27 s one-shot (button contact at 1.27 s, frame 38 of 98), `crew_climb` 0.8 s loop, in place,
`crew_wave` 5.2 s loop, `crew_dozing` 1.87 s loop (a seated doze; its take's root was 23 cm off and
7 cm under the floor, shifted onto the shared frame at the split). All six share one root frame (the ladder take was re-based onto the others' root, so a clip
switch never moves the worker). The push is baked FK; the IK rig that authored it stays in the
blend, muted, with its target `Crew2_PushTarget` in `glTF_not_exported`. A gltf-transform
`resample()` pass would take the file to about 690 KB; the 33 s tablet clip is most of it.

**Before the next rig export, two things changed in the scene:**

- Frame rate: the crew file is 30 fps, the rig blend 24 fps (reset at the split). A rig export
  at 30 fps would ship `pump` at 4.03 s instead of 5.04 s (the audio loop and `window.__hmPump`
  lock to that period), so keep the rig blend at 24.
- The panel instruments (gauge parts, needle, toggles, `PassButton_Cover`) are now children of
  `MachinePanel_Body_Door`, which is not in the export list, so they flatten to root nodes
  carrying their world transforms. Their local axes keep the same world orientation, so the
  needle/toggle rotations should still behave; check the gauge and toggles on the page after
  the export.

## Crew on the page (2026-09-09)

`src/components/RigCrew.jsx`, mounted inside `Pumpjack` (OilVoxelGrid.jsx) as a sibling of
the rig primitive at `PUMPJACK_SCALE`; enabled on the highlighted rig (desktop) and always
in the phone `RigScene` (`crewEnabled`). Loads `public/models/crew_goblin.glb?v=1` (bump
`CREW_GLB` in RigCrew.jsx after a re-export), one SkeletonUtils clone + AnimationMixer per
worker, `frustumCulled=false` on the skinned meshes, mixer delta capped at 1/30.

- **Stations**: `STATIONS` maps spot id → `Crew_*` node name + fallback transform. A spot is
  read from the rig scene by name when the node exists (`fromRig: true` in the dev hook),
  else the fallback. Until the rig export carries the empties, everything is fallback.
- **Roles / activities**: `ROLES` (operator, inspector) list weighted spots; `MENU` lists
  weighted acts per spot plus the head's point of interest (`camera`, `head_pump`); `ACTS`
  maps act → clip, dwell range, props to show (`Prop_Tablet` for crew_tablet). Gates
  (`envPreset === "night"`, `hellActive`, `pumpPausedRef`) reweight dozing.
- **Found doing**: spots are picked per sighting from a PRNG seeded by plot position + a
  10-minute bucket (+ a counter bumped on `visibilitychange`), two workers never share the
  panel zone. Acts chain on random dwell timers within a spot. The ladder is the only
  on-screen move: idle at the base → `climbUp` (crew_climb with a group rise of 0.154/0.8 s,
  stopping 0.479 below the platform) → `topIn` (crew_topOfLadder once, the group riding
  `TOP_PATH` scaled so the soles land exactly on the platform) → 0.35 s slide to `ladder_top`
  → idle/tablet there for 40–90 s → `stepOut` (0.35 s slide back to the landing) → `topOut`
  (the same clip backwards from its last frame, the group riding the path in reverse) →
  `climbDown` (crew_climb at timeScale −1) → rest 20–40 s → again. Verified end to end
  2026-09-11 (six round trips in the trace; landing at -0.363, 1.725, 0.773).
- **Decide**: `page.js` `handleLayerDecide` dispatches `hm:decide {detail:{action}}`; the
  operator, if at either panel station, slides (0.35 s) to that button's station and plays
  crew_push once. The 3D panel's `hm:pass-confirm` is not routed (it executes nothing yet).
- **Head look**: yaw ±1.0 rad / pitch −0.45..+0.55 toward the spot's target while idling or
  waving, eased, with the vendor anti-compounding guard; off when `window.__hmLowGfx`.
- **Panel view**: while the machine-panel view is open (phone `view === "panel"`, desktop
  the pumpjack's zoom ref) an operator at either button station slides 0.5 s to
  `panel_aside` (beside the key-switch face, z 0.38, fallback only; author `Crew_Panel_Aside`
  in the rig blend to move it) and slides back when the view closes. A decide during the
  view still gets the push, then the operator steps aside again. Without this the helmet
  filled the phone's panel camera.
- **Climb rise is data**: the rise per crew_climb cycle comes from `hm_climb_rise_m` on
  `Crew_Ladder_Base` (glTF extras → `userData`) when the rig ships it, else 0.154; the cycle
  length is the clip's own duration. Retime the climb in Blender (one cycle = one rung is
  0.214 on this ladder), set the property, re-export the rig — no page change.
- **Modes** (RigCrew.jsx, highest first), layered over the menu at the worker's current spot:
  `cower` (an `hm-demon-attack` within CREW_ALERT_RANGE, or a hell breach: crew_cower once, held,
  then played back to stand), `defend` (`window.__hmDemonState` within 3 cells: face it,
  crew_nervous, crew_throw every 3–5 s with a fireball from the right hand; `CREW_THROWS_COUNT`
  = true also fires `hm-shoot` from the worker so the demon resolves it like a cowboy shot),
  `celebrate` (`gusherActive`: crew_clap loop with the odd victory1/2), `brief`/`listen` (a tap
  on either worker: the operator turns to face the camera and reads `window.__hmBriefing.lines`
  — page.js builds them from the status pill, the away recap and the tank — in a bubble, one line
  per 3.2 s, the other turns to the talker and nods and shrugs; the turn is the same eased body
  yaw the defend mode uses, no clip, and both ease back to their station facing after), `chat`/`chatListen` (a quarter of sightings put both at the chat pair, taking 8–12 s
  turns), `music` (`window.__hmMusicOn` from the music player: crew_musicListening).
- **Dozing** is only ever a sighting at `rail_doze` / `rail_doze_top` (never chained into): one
  pass of crew_dozing, the last frame held 2–4 s, another pass — caught sleeping. The boss gets
  3–6 s to catch them (`DOZE_CAUGHT`), then they scramble up (crew_cower played backwards from
  the seat) into the spot's `awake` menu (idle, tablet) and never doze again that sighting; a
  tap or any mode change wakes them the same way. The clip itself was a chair sit: on
  2026-09-11 the thighs were rotated (per-key, local-axis offsets found by search) so the legs
  lie on the floor, seat on the floor, each foot on its own side. Clip switching retires every
  clip still carrying weight, not just running ones: a finished one-shot (clampWhenFinished)
  is paused, not running, and left at weight 1 it blends 50/50 with the next clip (the
  half-crouch seen after the doze scramble, 2026-09-11).
- **Dev hook**: `window.__hmCrew.state()` (includes each `Prop_*` node's visibility), `go("inspector",
  "rail_doze")`, `act("operator", "tablet")`, `brief()`, `reroll("chat")`, and
  `force = { celebrate, hell, music, demon:{x,y,z}, timeScale }`. Workers
  run on their own sim clock (capped frame deltas × `timeScale`), so a hidden tab never skips
  a timer and `timeScale` fast-forwards for testing.

Open: whether crew throws count (`CREW_THROWS_COUNT`), a headphones prop for the music clip,
her ladder retime (0.154 vs 0.214 per rung). Verified 2026-09-09 in the phone scene via the
dev hook with fast-forward: brief bubble, celebrate, defend + fireballs, cower/stand-up, music,
chat hand-off, panel step-aside; the ladder round trip (climb → top-out → slide → stay → step
out → reverse top-out → descend) was watched end to end on 2026-09-11. Every worker keeps a
phase trace (`window.__hmCrew.state().<role>.trace`, last 40 transitions with sim time and
position) for checking scripted moves without polling frames.
