# Claw machine controls

Click the claw machine in the 3D commercial strip, or walk up and press E.
Choose **Manual Play** or **Watch Demo**. This is a local toy interaction;
collecting a toy does not award tokens, money, or persistent inventory.

- Drag the physical joystick to steer; click the red button to grab/drop.
  These gestures capture the pointer and temporarily pause OrbitControls.
  Release the joystick to center it; drag elsewhere to orbit the camera.
- WASD / arrow keys or hold the direction buttons to aim.
- **Aim: Unicorn / Aim: Teddy** provides optional positioning assistance.
- **Grab** / Space lowers, closes, and lifts the claw. A miss is allowed.
- Steer the held toy to the front-left chute, then **Drop** / Space.
- **Deliver prize** automatically carries the held toy to the chute and drops it.
- A drop elsewhere returns the toy to the tray, where it can be picked up again.
- **Collect prize** removes the delivered toy and closes the sliding door.
- **Reset** (beside Exit at the top of the controls) / R restores both prizes and the home pose. **Exit** / Escape leaves.

`CommercialStrip.jsx` routes machine clicks to `ClawMachineController.jsx`.
The controller owns only `Claw_Demo`; other strip and vendor clips keep running.
`PlayerWalker.jsx` yields its input and camera while the claw panel is open.
The model is returned to its original pose when the controller unmounts.

`src/lib/clawMachine.mjs` contains the deterministic game state and geometry
operations. All movement is relative to `Toy_Claw_Empty`, so boardwalk auto-fit
and machine rotation/scale do not change travel. Held toys follow the shaft
through matrices without changing their parent. The shaft morph is found on
its descendant meshes, including unnamed meshes created by optimization.

The current calibration samples the existing **324-frame, 24-fps** `Claw_Demo`:
home 1, open 82, grab 100, closed/lifted 154, chute 222, landed/door-open 324.
If the authored demo timing changes, update those samples in the controller.
The travel limits and grab tolerance describe this cabinet and its half-size
prizes. Keep the named nodes, their hierarchy, animation, and shaft morph when
re-exporting; no Blender Python script runs in the browser.

Validation: `node scripts/test-claw-machine.mjs` decodes both shipping GLBs,
checks both toy wins, misses, tray release/re-grab, fixed grip during movement,
placement under a rotated/scaled parent, box containment, vertical door travel,
collection/reset, demo/manual switching, and preservation of unrelated nodes.
Textures are omitted from this headless test; browser rendering checks use the
actual texture-compressed model.
