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
a script — `scripts/export-rig.sh` (background Blender on the saved blend, then the optimizer;
2026-09-11) does steps 1 and 2 in one go, mirroring the live panel parenting and selecting the
node list plus every `Crew_*` empty. Save the blend first: it exports what is on disk. Then bump
`?v=` (step 3) only after it has finished.

The panel's front face is a separate object, `MachinePanel_Body_Door` (origin on its hinge edge,
the instruments parented to it in the blend). It is exported closed as its own node (since
2026-09-11 — before that it was left out and the page showed an open box with the instruments
floating in front). The instruments still export re-parented to their bases, so every panel
hook keeps its frame; to make the door open on the page, `attach()` the instrument nodes to the
door node at load (world transforms kept) and rotate the door about its own origin.

## 2. Optimize

```bash
RIG_EXCLUDE=OLD_Pipe_01 node scripts/optimize-rig.mjs models-src/oilJack_allProps4_raw.glb public/models/oilJack_fancy_allProps4.glb
```

`RIG_EXCLUDE` matters: the script's default excludes `Pipe_01`, which on this rig is the
wellhead. The script keeps empty leaf nodes (the markers) and shrinks every atlas to 1024px WebP.
It also passes `keepAttributes: true` to `prune()` (2026-09-11): the default strips `TEXCOORD_0`
from any primitive whose material has no texture, which silently deleted the crew's `Face2` UVs
(flat-colour mesh, textured at runtime by the SitePal compositor) — the face came out one flat texel.

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
| `Crew_Valve` | -1.05, -2.44, 0 | 90° | Pipe_03 | valve, idle, wave (south of the riser handwheel, facing it; the rim is 0.19 ahead of the feet, the hub 0.55 up — see "The handwheel") |
| `Crew_Rail_Doze2` | -1.0, 2.041, 0.236 | 4° | Bottom_Box | dozing (seat marker: north-west corner, back to the west rail; 2026-09-11) |
| `Crew_Rail_Doze3` | -0.131, -0.122, 0.236 | -90° | Bottom_Box | dozing (seat marker under the walking beam; 2026-09-11) |
| `Crew_Chat_C` | -0.751, 1.799, 0.236 | -90° | Bottom_Box | second chat pair on the west walkway, facing each other (2026-09-11) |
| `Crew_Chat_D` | -0.754, 1.299, 0.236 | 90° | Bottom_Box | " |
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

Twenty-six clips ship (2026-09-11, 2.35 MB with `RIG_RESAMPLE=1`, which `export-crew.sh` sets; `CREW_GLB` v13, which also carries the split Face1/Face2/Face3): `crew_neutralIdle` (the briefer's between-lines hold),
`crew_walk` 1.07 s loop, in place as delivered; its take was rotated 7.9° and 3 cm off the shared
frame, so the root keys were yawed and shifted (backup in the action's `hm_root_backup`), and the
stance foot's slide gives the stride speed the page uses, 0.518 rig units/s (`WALK_SPEED`),
`crew_no` 1.8 s, `crew_yes` 1.6 s, `crew_thoughtful` 2.9 s (her Mixamo dialogue gestures, already on
tracks and on the shared frame; the briefing's replies),
`crew_valve` 6.5 s (one-shot; see "The handwheel" below), `crew_getUp` 6.1 s (her Mixamo floor
sit → standing, the wake-up after `crew_dozing`; its root was shifted 3 cm so the last frame's
root sits exactly on the shared frame, and it was pushed from the active action onto an NLA
track like the others — an active action alone does not export), and
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

### The handwheel (crew_valve, 2026-09-11)

Mixamo has no valve-turning clip, so `crew_valve` is authored procedurally in the crew blend:
both hands are IK targets (`Crew2_ValveTarget_L/R` in `glTF_not_exported`, constraints
`IK_ValveL/R` on the hands, chain 3, wrist locked, muted after the bake) driven along the rim of
the linked rig's `Wheel`, over a static base pose (crew_idle frame 1) with scripted torso
lean/roll and a 10° head-down, then baked to FK exactly like `crew_push`. The frame plan at
30 fps: 1-18 reach, then three 48-frame cycles from frame 19 (6 settle, 24 pull, 18 release and
return with a 6 cm lift off the rim), 163-196 back to the idle pose. Grips at 8:30 and 3:30
(chest height) on a 0.20 radius (the rim tube centre), 1.5 cm in front of the rim face so the
palms wrap it; each pull turns 35° clockwise as the worker sees it (left hand rises). Max reach
0.256 from the shoulder, IK residual zero. Her first review (2026-09-11): the arms sat up by the
helmet — fixed by moving the station 4.5 cm further from the wheel, dropping the grips from 8/4
o'clock and halving the head-down, so the pull happens in front of the chest. The script is
`scripts/author-crew-valve.py` (run it inside the crew session through the Blender MCP, or in
background on the saved blend); its geometry block holds the hub, radius, rim face and station,
so if the wheel or `Crew_Valve` moves, edit those numbers, re-run, re-export.

Why the wheel moved: the Synty handwheel sat with its hub 1.01 up on the riser, above the
goblin's head (0.79 tall, reach about 0.31 from a 0.48 shoulder). On 2026-09-11 the rig blend's
`Wheel` object was lowered to z 0.55 (its stem now enters the valve body/flange at 0.45-0.75) and
`Crew_Valve` moved to y -2.44 (rig v26; v25 had it at -2.395, too close for a forward reach). The same export also restored three empties
that were stale on disk — `Crew_Chat_B`, `Crew_Rail_Doze`, `Crew_Rail_Doze_Top` had been moved
through the data API in a session that closed without saving, so the disk file still had the old
spots while v24 had the new ones (`Crew_Chat_B` at 0.55, 0.55 instead of -0.345, 1.821). Data-API
moves never flag the file dirty: after such a session, save explicitly.

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
- **The handwheel turns**: while a worker plays `valve` at the valve spot, RigCrew rotates the
  rig's `Wheel` node about its local Y (the same axis and node as the click-to-spin in
  OilVoxelGrid) by the clip's pull profile — `VALVE_PULLS` windows 0.8-1.6, 2.4-3.2, 4.0-4.8 s,
  35° each, smoothstep — from wherever the wheel is. Pumpjack passes its `wheelTargetRotY` ref
  in as `wheelSpinRef`; the crew writes the same value there every frame so the click lerp agrees
  instead of fighting, and a later click spins on from the crew's angle. `VALVE_SIGN` is − because
  the node's local +Y points back at the worker (dev state `wheel.localYWorld` shows it) and the
  clip turns the wheel clockwise as the worker sees it. Each pull also vents the chimney: Pumpjack
  passes its `ventSteam` (the click-to-spin's steam burst + gauge pressure drop, guarded so a burst
  in progress is not restarted) in as `onValveTurn`, and RigCrew calls it as each pull window
  opens (dev state `valveVents` counts the calls). The
  wheel node is looked up per act, not cached: the rig scene can be re-cloned under a worker.
- **Waking up is a clip now** (2026-09-11): a caught dozer plays `crew_getUp` (floor sit →
  standing, 6.1 s) instead of crew_cower backwards; `uncower` stays as the fallback if the clip
  is missing and for standing up after a cower. Both clips come from Mixamo's sitting-on-ground
  family, so they share one sit pose: `crew_dozing`'s lower body (root, pelvis, both legs) was
  rewritten in the crew blend to crew_getUp's first frame (its own take had been a chair sit
  re-posed by hand, 7 cm higher and 26 cm further back), keeping its nodding upper body. The
  seat spots therefore have one origin, marker + 0.244 (`SEAT_BACK_OFFSET`): the sleeper's back
  ends a centimetre in front of the rail marker (`SEAT_BACK_OFFSET` 0.20 since rig v27, when
  `Crew_Rail_Doze_Top` went onto the platform rail's inner face at y -0.369 so the sleeper leans on
  it), the stand-up lands on the origin and the awake menu runs there. crew_getUp starts from the doze's END pose (the held last frame), so a wake-up that
  arrives mid-nod — the caught timer, a tap, a mode change — is queued (`wakeQueued`) until the
  pass finishes (≤ 1.9 s) and the switch is pose-exact; only a cower interrupts the sit at once.
  (An interim version moved the group across the crossfade to hide a 26 cm offset; gone now — if
  a switch must ever move the group again, move it by offset × (1 − fadeWeight) across `FADE`,
  never in one jump.)
- **Ladder retime** (2026-09-11, rig v28): the rungs of the Samson_Post ladder are at
  0.498, 0.712, 0.926, 1.153, 1.365, 1.592 (mean pitch 0.219 above a 0.236 walkway), while the
  in-place crew_climb was cut for a 0.154 rise per cycle with a foot step of only 0.077 and a
  hand reach of 0.148. No retime can put both feet on rungs with that clip: the feet alternate
  half a cycle apart, so with one rung per cycle only one foot per cycle can land on a rung.
  What ships: `hm_climb_rise_m` 0.219 (one rung per 0.8 s cycle, the climb takes 3.7 s instead
  of 5.2) and a new `hm_climb_rung0_m` 0.262 (first rung centre above the base), which RigCrew's
  `climbPhase` uses to start crew_climb at the clip time that puts the LEFT foot's plants
  (0.12 above the origin, 15/24 into the cycle) on rungs, going up and coming down. Verified on
  the page: four plants at 0.503, 0.719, 0.938, 1.157 against rungs 0.498, 0.712, 0.926, 1.153.
  Because the planted foot still rides up about 11 cm during its stance (the clip's stance drop
  is half the pitch), the plant is aimed 4 cm BELOW the rung centre (`CLIMB_PLANT_BIAS`) so the
  foot reads as on the rung through the middle of the stance instead of hovering above it (her
  "a bit high", 2026-09-11).
  The right foot lands between rungs and the hands slide 7 cm up each rung during a pull; a
  true fix is either rungs at half the pitch (0.11) in the model or a re-authored climb with IK
  hands/feet pinned to rungs (the handwheel script's method). Dev hook `climb(role)` starts a
  climb from the base; dev state `ballL` is the left ball joint's height in rig units.
- **Crew hits count** (2026-09-11): `CREW_THROWS_COUNT` is on. A throw fires "hm-shoot" from
  the thrower's world position only while `window.__hmDemonState` says the demon is in its
  vulnerable window, this client may catch it, no cooldown is running, and the thrower is within
  the demon's walker hit range (2.0) — a shot outside the window would make the demon counter and
  lock the player's revolver out, so those throws stay VFX. Dev state `counted`. Verified with a
  faked demon state: every throw counted while the window was open, none after it closed. Her
  weapon question is open: the fireball is thematically backwards for a demon; recommended
  swap is a holy-water flask from the Midway chapel, same throw clip, same counting.
- **Climb rise is data**: the rise per crew_climb cycle comes from `hm_climb_rise_m` on
  `Crew_Ladder_Base` (glTF extras → `userData`) when the rig ships it, else 0.154; the cycle
  length is the clip's own duration. Retime the climb in Blender (one cycle = one rung is
  0.214 on this ladder), set the property, re-export the rig — no page change.
- **No T-pose flashes** (2026-09-11): a skinned mesh shows the BIND pose for whatever part of
  the animation weight is missing — three.js fills `1 − Σweights` with the rest pose. Two leaks
  were closed. (1) A never-played `AnimationAction` reports `enabled` and `getEffectiveWeight()`
  1 even though the mixer is not running it, so RigCrew's "is anything still blending?" check
  counted all 24 idle clips as live and the first clip after every mount faded in from the
  bind pose: a quarter second of T-pose at each new sighting. The check now requires
  `isScheduled()`. (2) A clip restarted while still mid-fade restarted its weight at zero;
  it now blends from its current weight (`_scheduleFading(FADE, w0, 1)`). Each worker's group
  also stays invisible until the mixer has posed it once. Dev state carries `weightSum` (sum
  over scheduled clips) and `visible`; verified ≥ 1.0 on every visible frame across rerolls
  and rapid switches. Two switches inside one frame can still briefly overshoot above 1 (the
  fade-out reads a stale cached weight) — not a T-pose, and it needs a same-frame double
  switch.
- **Variety** (2026-09-11, rig v27 / crew v12): sightings roll fresh every time (page load, tab
  back, reroll) — the old plot + 10-minute-bucket seed replayed the same crew for ten minutes,
  which read as the same sleeper over and over. Dozing is spread over four seat markers
  (`rail_doze`, `rail_doze_top`, her `rail_doze2` in the north-west corner and `rail_doze3` under
  the beam) at weight 1 each × 0.5 by day (1.0 at night, 1.5 stalled, 0 in hell — night used to
  triple it, so every night sighting was a sleeper) against 7 of work, about one inspector
  sighting in five. The operator now also turns up at the valve and the lookout (panel 4 of 8).
  Chat sightings pick one of two pairs, `Crew_Chat_A/B` on the north walkway or her
  `Crew_Chat_C/D` on the west walkway (`CHAT_PAIRS`). `crew_thoughtful` joins the idle menus at
  the motor, the lookout and the wellhead. Her tablet-screen emissive (strength 3.4 on a dim
  green) exports folded into an emissiveFactor of 0.21 — brighten the emission colour itself for
  a visible glow.
- **Walking** (2026-09-11): every move between spots that is at least 0.12 long — the panel
  step-aside and back, a decide move between the two buttons (0.17), anything the dev hook's
  `walk(role, spot)` asks for — is a walk: the worker turns to the travel heading, crew_walk
  loops while the group moves in a straight line at `WALK_SPEED` (so the planted foot stays
  planted), then turns to the spot's facing on arrival. Shorter moves (the ladder landing, 0.09)
  stay a glide with the idle. There is no pathing: walks are straight lines, so the roster's
  spot changes still happen between sightings, not on screen; `walk()` is for previewing.
- **The briefer talks through SitePal** (2026-09-11): the crew goblin follows the vendors'
  scheme. In the crew blend the face is three skinned meshes, `Face1` (painted), `Face2` (flat
  projection face, authored colour #b5b794 = the goblin's face swatch, sampled area-weighted from
  the Minis atlas) and `Face3` (painted detail); the vendor registry in `src/lib/vendorSitePal.js`
  has a `crew` entry (scene 2775497, ElevenLabs voice LglRX59YTEmRX2HIAN3F through engine 14,
  projFace Face2, regularFaces Face1/Face3, no greeting pool). The compositor is the vendor one
  lifted into `src/lib/sitepalFace.js` (CommercialStrip keeps its own copy with the pose
  overrides and tuner pins — keep them in step). Flow: the tap runs `activateVendorSitePal("crew")`
  inside the gesture (audio unlock, lazy embed on touch, scene swap); the briefer waves, then each
  line goes out with `speakVendorText` while its bubble + reply gesture show; SitePal's talk
  callbacks (`onVendorTalk`) advance to the next line 0.35 s after speech ends, the BRIEF_LINE_S
  timer paces if speech never starts; between lines the briefer holds `crew_neutralIdle` (her
  clip; idle if absent); the last line's end deactivates the host and the painted face fades
  back. Only the talker projects; the listener keeps its painted face. Dev state: `projFade`,
  `faces`. The briefer also has its own words: an opener from `CREW_OPENERS` is spoken with the
  wave (and shown in the bubble) and a closer from `CREW_CLOSERS` ends the report with a nod;
  both pools live in RigCrew.jsx, never repeat the last pick, and are plain strings (SitePal
  caches TTS by text — re-word to re-voice). Tuning: `/hailmary?tune=vendor` has a CREW tab.
  Picking it loads the crew scene, and while it is the tune target
  (`window.__vendorSitePalTuneId === "crew"`) the operator projects continuously, holds its face
  toward the camera and does not step aside for the panel view — open MACHINE PANEL to get
  close. The sliders drive CREW_SITEPAL_CROP/FILTER live (seeded from the rug merchant's, also a
  goblin avatar; untuned), the face pins (Face1 · mesh / Face2 · SitePal, f to flip) are honoured
  by the shared compositor, and "Log values" prints the CREW consts to paste back. Verified
  2026-09-11 only with a faked host (a drawn canvas + stub sayText/vh_talk callbacks): opener →
  lines → closer order, pacing, gestures, projection fade in/out, skin gain, the tuner tab and
  pins. The real scene (registration, voice, lipsync) still needs her eyes and ears.
- **"Blank white Face2" post-mortem** (2026-09-11, first run against the real scene): three
  stacked causes, all fixed. (1) `scripts/optimize-rig.mjs` pruned `Face2`'s UVs (see §2 —
  crew GLB v14 is the same raw re-optimized with `keepAttributes: true`); with no `uv` attribute
  the whole face samples one texel, i.e. a flat fill. (2) `VendorSitePalHost` reset
  `window.__vendorSitePalSceneLoaded = false` in its mount effect; the page mounts the host at
  two places and a rig highlight remounts it, and no new `vh_sceneLoaded` ever follows, so the
  compositor's `onScene` gate stayed shut. It now resets only when nothing is embedded.
  (3) The crop was seeded from the rugs vendor and missed her close-up goblin avatar, and the
  skin sample sat in an eye socket (dark median → gain 2–5× → blown out). Now
  `skinSample` on the cheek (0.12,0.62,0.18,0.18). Her first pass from the CREW tab is what
  ships: `CREW_SITEPAL_CROP = {142,179,247,205, rotateZ −1}`, filter saturate 104 / contrast
  103 / brightness 90 / hue 6 (measured ≈ #847d6c vs target #b5b794, linear gain ≈ 2.0–2.3 —
  brightness is cancelled by the skin match, it only moves the gain). SitePal's own
  `[WARNING]audioStarted Callback Error … 'audioId'` is the player complaining when a line is
  cancelled while its audio is still loading; it did not reproduce with stopSpeech mid-load
  and the next line still goes out.
  The dev state (`window.__hmCrew.state().operator.projMat`) now reports `uv` bounds (must be
  0..1), a 3×3 `cropGrid` of canvas samples and `colorRaw` (the unclamped gain) — check those
  three before blaming the shader.
- **Tuning the crew face** (2026-09-11, after her first try: "no voice, the face is distant and
  only turns to me for a moment"): with the CREW tab up, the briefer leaves whatever it was
  doing, walks to `TUNE_SPOT` (panel_pass), loops `crew_neutralIdle` with no dwell expiry and
  no mode changes, holds body and head on the camera, and — once it is standing there — fires
  `hm:crew-face` with its head (world) and facing; the highlighted rig answers with
  `onFocusObject` at `CREW_FOCUS_DIST` (0.16, floor 0.12), the same move as the panel zoom.
  Leaving the tab hands the schedule back (actEnds re-armed). Sound: the crew has no greeting
  pool (the briefing lines are RigCrew's), so the tab's `tuneLines` speak one line on select
  and the SAY A LINE button repeats one in any tab. The voice itself was never the problem:
  the ElevenLabs id fires `vh_talkStarted` ~1.6 s after `sayText` on scene 2775497, and an
  in-game brief on the phone scene started talking 5.4 s after the tap (scene swap included).
  Signed out on desktop the field has no rigs at all — pick a plot on the survey map to get one
  (and its crew) before selecting CREW.
- **Hats and the square idle** (2026-09-11, crew GLB v15): `CowboyHat` and `Ballcap` are
  bone-parented to `head` like the `Helmet`, hidden in her blend (the export unhides the whole
  family, glTF has no visibility, so the page hides them). On the rig it is hard hats only:
  `showHat()` keeps the Helmet on for every act here; flag an act `offDuty: true` and the worker
  swaps in the hat it drew once — meant for the CommercialStrip visit when that exists (a first
  cut that flagged dozing and music put a cowboy hat at the wellhead; she vetoed it).
  `crew_neutralIdle` (the square stance — every Mixamo idle leans on one leg) is offered
  wherever a menu offers `idle`, same weight; `startAct` falls back to `idle` if a stale GLB
  lacks the clip. Export from the live session with export-crew.py (restore the hats' eye
  icons afterwards), optimize, bump `?v=`.
- **Chain of command** (2026-09-11): only the claim owner at their own rig gets the boss
  briefing. page.js publishes `signedIn` and `ownerPlot` (`col_row`) on `window.__hmBriefing`;
  each Pumpjack passes its `plotId` (the same `col_row`, internal indices — the survey map shows
  them +1) down to RigCrew, and `toggleBrief` compares. Anyone else — signed out, or at somebody
  else's claim — gets `CREW_BRUSHOFF`: one opener (shrug, no wave), one line, one closer, all
  spoken by the foreman through SitePal. Verified all three cases in the pane.
- **Streetlight** (2026-09-12, rig v31): `Streetlight` + child `Streetlight_light` (Synty
  PoliceStation atlas, one more 512² texture) are in the export list; 90 nodes, 17 materials,
  6 textures. `RigStreetlights.jsx` now extracts these meshes into shared instances,
  excluding them from the field merge and animated clones. Poles/bulbs hide by day;
  warm bulbs, subtle decorative shafts and soft pad pools come on at night (TOD ramps
  17:45–18:30 / 05:30–06:15). One shadowless spotlight follows the selected field rig;
  the phone uses its streetlight head in place of the old tripod key, keeping its fill/rim.
  The merged machinery also gets a night-only material lift, leaving ground unchanged.
  A single baked atlas for the whole rig was audited
  and declined the same day: the field never samples the textures, draw calls follow mesh count
  not material count, and the panel instruments are driven per material by name.
- **Briefing replies** (2026-09-11): a tap makes the operator wave at the boss ("Hey, boss.",
  `BRIEF_GREET_S` 2.2 s), then each briefing line comes with a reply gesture: page.js sends a
  `tone` per line in `window.__hmBriefing.tones` — "no" for nothing to report (rig signed out /
  no claim / pre-season / caught up, "Nothing new", an empty tank), "yes" for news (pumping,
  drilled, strikes, unread, tank ≥ 50%), "thoughtful" for the rest (away time, hell pocket,
  field events, breach) — and RigCrew plays crew_no / crew_yes / crew_thoughtful, idling
  between lines; without a tone it reads the line (`briefGesture`). crew_talking is reserved
  for crew-to-crew chat (her rule).
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
her ladder retime (0.154 vs 0.214 per rung). The valve turn was verified on 2026-09-11 (two acts back to back, the wheel angle carried over between them). Verified 2026-09-09 in the phone scene via the
dev hook with fast-forward: brief bubble, celebrate, defend + fireballs, cower/stand-up, music,
chat hand-off, panel step-aside; the ladder round trip (climb → top-out → slide → stay → step
out → reverse top-out → descend) was watched end to end on 2026-09-11. Every worker keeps a
phase trace (`window.__hmCrew.state().<role>.trace`, last 40 transitions with sim time and
position) for checking scripted moves without polling frames.
