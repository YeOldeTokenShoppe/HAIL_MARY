# The rig model — what the code expects from the GLB

For re-modelling the pump jack (2026-09-05: Michelle is rebuilding the oil tank
as a vertical silo and the machine panel, after the realistic reference model).
The code reaches into the rig **by node name and material name**. Keep these and
the export drops in; rename them and tank fill, gauges, buttons, themes and the
gusher go quiet.

Files: `public/models/oilJack_fancy_allProps2.glb` (desktop field, OilVoxelGrid)
and `oilJack_fancy_allProps3.glb` (phone, RigScene — the compact one). Export
both from the same .blend if the change should show everywhere. Keep the root
transforms as they are (`Sketchfab_model` at 0.006 etc.); the code renders the
whole scene at `PUMPJACK_SCALE` 0.1.

## Animation
- Clips named exactly `Armature|spin.001`, `Armature.001|spin.001`, `Wheel_Back|spin.001`.
- `Head_Pump` (horse head) and `Body_Pump` (walking beam) — the gusher blowback
  reparents the head under the body for the duration, so both must stay named.

## The tank
- One mesh named **`Fuel_Tank`**, material named **`Fuel_Tank`**. The code turns
  it into 78 % translucent double-sided glass so the oil inside shows, and builds
  the liquid from its bounding box.
- Shape: the code now understands **either** a horizontal cylinder lying along Z
  (the original) **or a vertical silo** (tallest along Y). For the silo the
  liquid is an upright column, radius from the X/Z cross-section, standing on the
  tank floor and growing with the fill. Keep the silo a plain closed cylinder.
- **Railings, ladders, the OIL letters and the platform must be separate
  meshes**, not part of `Fuel_Tank` — anything in that mesh goes translucent and
  stretches the liquid's bounding box.
- The scaffold/legs mesh is `Fuel_Tank_Scaffold` (theme zone TANK SCAFFOLD).
- `Well`/`WellFrame`, `Tank_Base` are free names (untouched by code).

## The machine panel
- A container node named **`MachinePanel`** (its mesh is the housing; theme zone
  MACHINE PANEL), children:
  - `PressurePanel` — the control-box housing the live LED readout anchors to.
    Its children `Text_HIGH`, `Text_MED`, `Text_LOW` are the baked labels (the
    code hides/shows them).
  - `PressurePanel2` — the screen quad the digits draw on. It is exported
    **horizontal, face down**; if you stand it vertical facing out, tell me and I
    set `PANEL_MESH_ROT` to zero.
  - `GaugeNeedle` — sweeps about its LOCAL X, 0 at empty → 120° at full tank.
    `Gauge`, `Gauge.001` are the dial faces.
  - `RedButton` — drains the tank (phone: live in the MACHINE PANEL chip's view).
  - `AlarmButton_01` — the second button.
- **Which side is the front is derived**: the thinner horizontal axis of the
  panel's box is its depth, and the average position of the gauge children picks
  the side. Put gauges and buttons on the face the player should see.
- `Alert_Light_RED` (top-level, material `Alert_Light_RED`) is the beacon that
  pulses on an alarm; `Panel_Light` if present is read too.
- The readout's world-space nudges (`PANEL_READOUT_OFFSET` etc. in
  OilVoxelGrid.jsx) are tunables — expect one pass against the new box.

## Other named parts
- `Straw` (material `Straw`) — the drill pipe; scaled by depth. `Cylinder` is the
  pipe's collar (theme zone DRILL PIPE).
- `Wheel` (valve wheel, click spins it + vents steam), `Wheel_Back` (crank wheel),
  `CrankPin`/`CrankPin_Mesh`, `Cylinder_Pump`/`Cylinder_Pump.001` (counterweights).
- `Bottom_Box` (base plate), `Cube`/`Wheel_Box`/`Under_Pump` (motor box),
  `ground` (pad), `Pipe_01..03`/`Pipe_Refinery` (pipes), `SignFrame` (sign frame),
  `Envelope` (messages), `Security_Camera`, `Gate`, `Fence_Package`.
- Theme zones recolour by **mesh name**: see `PUMP_ZONES` in
  PimpMyPumpPanel.jsx. A new mesh that should take the theme needs adding there.

## Checklist before export
1. Names above intact (`.001` suffixes on duplicates are fine; the code strips them).
2. `Fuel_Tank` is one closed mesh with only the tank shell in it.
3. Panel gauges/buttons on the front face; `MachinePanel` still the parent.
4. Export → `node scripts/…` not needed; drop the GLB in `public/models/` and
   bump `?v=` if the file name is unchanged (see the strip's `STRIP_MODEL_V`).
