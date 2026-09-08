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
  (`WellFrame_Concrete`) around it, bases buried. Anything meant to read as a hole must
  be a dark surface *above* the terrain — a pit below it is hidden by the ground plane.
- Pipe drops must end below world z 0 or they float.

## Names the game depends on

- Zones (theme paint): `Body_Pump` beam, `Head_Pump` horse head, `Counterweight`, `Wheel_Back`
  crank wheel, `Straw` drill pipe, `Bottom_Box` base, `Samson_Post` post, `Under_Pump` motor
  box, `Pipe_01`/`Pipe_03`/`Under_Pump_Pipes` pipes, `Wheel` valve, `MachinePanel_Body` +
  `Under_Pump_Pipe_Panel` machine panel (since the DANGER decal moved to its own `DANGER_LABEL`
  plane, 2026-09-07), `WellFrame` well curb (stock = concrete; no fallback, a theme must name it).
  Zones a theme does not name fall back to a sibling (post → beam, counterweights → crank wheel,
  motor box → base plate; `ZONE_FALLBACK` in OilVoxelGrid.jsx). Unlisted names keep their
  atlas colours: the decal and every panel instrument stay stock. The body name still starts
  with `MachinePanel`, which is what the zoom-to-panel hooks match on.
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
  panel normal), `Toggle_N/E/S/W` (lever pivot at the base top), `Lamp_N/E/S/W`, `KeySwitch`,
  `Well`/`WellFrame` (unpainted).
- Field linkage: `Pitman` plus the six markers drive the merged-field four-bar.

## Checks after an export

- The raw GLB's image list should have every atlas you expect. An export taken while a part
  is mid-edit has shipped with a texture missing once.
- The optimizer prints `clips pump` and the node count; markers should survive (67 nodes,
  5 textures, ~415 KB as of 2026-09-08; v17). Seven empties expected.
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
