import * as THREE from 'three';

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = THREE.MathUtils.clamp;
const LABELS = { Unicorn_01: 'Unicorn', Bear_01: 'Teddy bear' };
const find = (root, name) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));

function snapshot(root) {
  const result = new Map();
  root.traverse((o) => result.set(o, {
    position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone(),
    visible: o.visible, weights: o.morphTargetInfluences?.slice(),
  }));
  return result;
}
function restore(poses) {
  poses.forEach((p, o) => {
    o.position.copy(p.position); o.quaternion.copy(p.quaternion); o.scale.copy(p.scale);
    o.visible = p.visible;
    if (p.weights) o.morphTargetInfluences.splice(0, p.weights.length, ...p.weights);
    o.updateMatrix();
  });
}

// All measurements and travel are in Toy_Claw_Empty's Y-up coordinate system.
// Walking, boardwalk auto-fit, and cabinet placement can change independently.
export function boundsInMachine(object, root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), box = new THREE.Box3();
  const matrix = new THREE.Matrix4(), v = new THREE.Vector3();
  object.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    matrix.multiplyMatrices(inverse, mesh.matrixWorld);
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(matrix); box.expandByPoint(v);
    }
  });
  return box;
}

export function createClawMachine(scene, clip, onChange = () => {}) {
  const root = find(scene, 'Toy_Claw_Empty');
  if (!root || !clip) throw new Error('The strip needs Toy_Claw_Empty and the Claw_Demo animation.');
  const need = (name) => { const o = find(root, name); if (!o) throw new Error(`Claw part missing: ${name}`); return o; };
  const rail = need('Claw_Mechanism'), carriage = need('Claw_Mechanism_01');
  const shaft = need('Claw_Piston_02'), door = need('Cap_01'), lever = need('Lever'), button = need('Button_01');
  const box = need('Prize_Box');
  const fingers = ['Claw_01', 'Claw_01.001', 'Claw_01.002'].map(need);
  const toys = ['Unicorn_01', 'Bear_01'].map(need);
  const original = snapshot(root), mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
  const localPoint = (o) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  const sample = (frame) => {
    action.reset().play(); mixer.setTime((frame - 1) / 24);
    root.updateWorldMatrix(true, true);
    return { poses: snapshot(root), head: localPoint(shaft), toy: boundsInMachine(toys[0], root) };
  };
  // The exported 324-frame demo is the calibration, including morphs on
  // unnamed child meshes introduced by glTF-Transform's quantization.
  let home, open, grip, closed, chute, landed;
  try {
    home = sample(1); open = sample(82); grip = sample(100); closed = sample(154);
    chute = sample(222); landed = sample(324);
  } finally {
    action.stop(); restore(original); root.updateWorldMatrix(true, true);
  }
  const refDepth = home.head.y - grip.head.y;
  if (!(refDepth > 0.05 && refDepth < 1)) {
    mixer.uncacheRoot(scene); throw new Error('Claw_Demo does not match the calibrated pickup cycle.');
  }
  const aimOffset = grip.head.clone().sub(home.toy.getCenter(new THREE.Vector3()));
  const chuteCenter = chute.toy.getCenter(new THREE.Vector3());
  const landingCenter = landed.toy.getCenter(new THREE.Vector3());
  const trayFloor = home.toy.min.y, boxFloor = landed.toy.min.y;
  const morphs = [];
  shaft.traverse((o) => {
    const index = o.morphTargetDictionary?.['Shaft extension'];
    if (index !== undefined) morphs.push({ o, index, base: home.poses.get(o).weights[index], full: grip.poses.get(o).weights[index] });
  });
  if (!morphs.length) { mixer.uncacheRoot(scene); throw new Error('The claw shaft extension morph is missing.'); }
  // Root-space displacement to each part's parent space. No normalization:
  // retaining scale is essential when the machine is placed inside an Empty.
  const rootToParent = (o) => new THREE.Matrix3().setFromMatrix4(
    o.parent.matrixWorld.clone().invert().multiply(root.matrixWorld));
  const railBasis = rootToParent(rail), carriageBasis = rootToParent(carriage), shaftBasis = rootToParent(shaft);
  const buttonBasis = rootToParent(button);
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  const state = { mode: 'idle', phase: 'ready', x: home.head.x, z: home.head.z, depth: 0, grip: 0,
    held: null, pending: null, won: new Set(), collected: new Set(), elapsed: 0, duration: 0, message: 'Choose Manual Play or watch the demo.' };
  let relative = null, candidate = null, drop = null, movement = null, lastUI = '';
  const isBusy = () => !['ready', 'holding', 'prize'].includes(state.phase);
  function getAim(toy) {
    const center = boundsInMachine(toy, root).getCenter(new THREE.Vector3());
    return center.add(aimOffset);
  }
  function nearest() {
    let best = null, distance = 0.055;
    for (const toy of toys) {
      if (!toy.visible || state.won.has(toy)) continue;
      const aim = getAim(toy), d = Math.hypot(aim.x - state.x, aim.z - state.z);
      if (d < distance) { best = toy; distance = d; }
    }
    return best;
  }
  function overChute() {
    if (!state.held) return false;
    const c = boundsInMachine(state.held, root).getCenter(v);
    return Math.abs(c.x - chuteCenter.x) < 0.06 && Math.abs(c.z - chuteCenter.z) < 0.06;
  }
  function report(force = false) {
    const ui = { mode: state.mode, phase: state.phase, busy: isBusy(), held: state.held?.name || null,
      pending: state.pending?.name || null, collected: state.collected.size, message: state.message,
      target: state.mode === 'manual' && state.phase === 'ready' ? nearest()?.name || null : null,
      overChute: state.phase === 'holding' && overChute(),
      available: toys.filter((t) => t.visible && !state.won.has(t)).map((t) => t.name) };
    const key = JSON.stringify(ui);
    if (force || key !== lastUI) { lastUI = key; onChange(ui); }
    return ui;
  }
  function phase(name, duration, message) {
    state.phase = name; state.elapsed = 0; state.duration = duration;
    if (message) state.message = message;
    report();
  }
  function followToy() {
    if (!state.held) return;
    root.updateWorldMatrix(true, true);
    m.copy(state.held.parent.matrixWorld).invert().multiply(shaft.matrixWorld).multiply(relative);
    m.decompose(state.held.position, state.held.quaternion, state.held.scale);
    state.held.updateMatrix();
  }
  function pose() {
    rail.position.copy(home.poses.get(rail).position).add(v.set(0, 0, state.z - home.head.z).applyMatrix3(railBasis));
    carriage.position.copy(home.poses.get(carriage).position).add(v.set(state.x - home.head.x, 0, 0).applyMatrix3(carriageBasis));
    shaft.position.copy(home.poses.get(shaft).position).add(v.set(0, -state.depth, 0).applyMatrix3(shaftBasis));
    fingers.forEach((o) => o.quaternion.copy(open.poses.get(o).quaternion).slerp(closed.poses.get(o).quaternion, state.grip));
    morphs.forEach(({ o, index, base, full }) => { o.morphTargetInfluences[index] = base + (full - base) * state.depth / refDepth; });
    const pressed = ['lower', 'close', 'align', 'open'].includes(state.phase);
    button.position.copy(home.poses.get(button).position).add(v.set(0, pressed ? -0.015 : 0, 0).applyMatrix3(buttonBasis));
    followToy();
  }
  function steer(x, z) {
    state.x = clamp(x, -0.32, 0.32); state.z = clamp(z, -0.28, 0.30); pose();
  }
  function reset(mode = 'manual') {
    action.stop(); restore(home.poses);
    Object.assign(state, { mode, phase: 'ready', x: home.head.x, z: home.head.z, depth: 0, grip: 0,
      held: null, pending: null, elapsed: 0, duration: 0, message: 'Aim over a toy, then grab.' });
    state.won.clear(); state.collected.clear(); candidate = null; relative = null; drop = null;
    if (mode === 'manual') pose();
    root.updateWorldMatrix(true, true); report(true);
  }
  function alignTo(center, kind = 'align') {
    const c = boundsInMachine(state.held, root).getCenter(new THREE.Vector3());
    movement = { from: new THREE.Vector2(state.x, state.z), to: new THREE.Vector2(state.x + center.x - c.x, state.z + center.z - c.z) };
    phase(kind, kind === 'deliver' ? Math.max(0.5, movement.from.distanceTo(movement.to) / 0.25) : 0.25,
      'Moving to the prize chute.');
  }
  function press() {
    if (state.mode !== 'manual' || isBusy() || state.pending) return false;
    if (state.held) {
      if (overChute()) alignTo(chuteCenter);
      else phase('open', 0.22, 'Releasing the toy onto the tray.');
    } else {
      candidate = nearest();
      const top = candidate ? boundsInMachine(candidate, root).max.y : home.toy.max.y - 0.04;
      state.pickupDepth = clamp(refDepth + home.toy.max.y - top, 0, 0.53);
      phase('lower', 0.85, candidate ? `Picking up ${LABELS[candidate.name]}.` : 'No toy underneath — try another spot.');
    }
    pose(); return true;
  }
  function prepareDrop() {
    const toy = state.held, bounds = boundsInMachine(toy, root), c = bounds.getCenter(new THREE.Vector3());
    const toBox = overChute();
    const start = localPoint(toy), end = start.clone();
    let floor = toBox ? boxFloor : trayFloor;
    if (toBox) { end.x += landingCenter.x - c.x; end.z += landingCenter.z - c.z; }
    else {
      // A release over another toy rests on it rather than intersecting it.
      for (const other of toys) {
        if (other === toy || !other.visible || state.won.has(other)) continue;
        const b = boundsInMachine(other, root);
        if (bounds.min.x < b.max.x && bounds.max.x > b.min.x && bounds.min.z < b.max.z && bounds.max.z > b.min.z) floor = Math.max(floor, b.max.y + 0.002);
      }
    }
    const distance = Math.max(0, bounds.min.y - floor);
    end.y -= distance;
    drop = { toy, start, end, toBox, distance };
    state.held = null; relative = null;
    phase('fall', Math.max(0.15, Math.sqrt(2 * distance / 9.81)), toBox ? 'Prize falling into the box.' : 'Toy returning to the tray.');
  }
  function dropPose(t, bounce = 0) {
    const slide = smooth(clamp((t - 0.65) / 0.35, 0, 1));
    v.copy(drop.start).lerp(drop.end, slide); v.y = drop.start.y - drop.distance * t * t + bounce;
    root.updateWorldMatrix(true, false);
    drop.toy.position.copy(drop.toy.parent.worldToLocal(root.localToWorld(v)));
    drop.toy.updateMatrix();
  }
  function finishPhase() {
    switch (state.phase) {
      case 'aim': phase('ready', 0, 'Lined up. Press Grab when ready.'); break;
      case 'lower': phase('close', 0.25); break;
      case 'close':
        state.held = candidate;
        if (candidate) { root.updateWorldMatrix(true, true); relative = shaft.matrixWorld.clone().invert().multiply(candidate.matrixWorld); }
        phase('raise', 0.9); break;
      case 'raise': phase(state.held ? 'holding' : 'ready', 0, state.held ? 'Steer to the front-left chute, or choose Deliver prize.' : 'Missed! Aim over a toy and try again.'); break;
      case 'align': case 'deliver': phase('open', 0.22, 'Releasing into the prize chute.'); break;
      case 'open': prepareDrop(); break;
      case 'fall': phase('settle', 0.3); break;
      case 'settle':
        dropPose(1);
        if (drop.toBox) { state.won.add(drop.toy); state.pending = drop.toy; phase('door', 0.6, 'Opening the prize door.'); }
        else phase('ready', 0, 'Toy released. You can pick it up again.');
        break;
      case 'door': phase('prize', 0, 'You won! Collect your prize.'); break;
      case 'collect': state.pending = null; phase('ready', 0, state.collected.size === toys.length ? 'Both prizes collected! Reset to play again.' : 'Prize collected. Try the other toy.'); break;
      default: break;
    }
    pose();
  }
  function update(dt, input = { x: 0, z: 0 }) {
    if (state.mode === 'demo') {
      mixer.update(dt);
      if (action.paused) { state.message = 'Demo complete. Choose Manual Play to try it yourself.'; report(); }
      return;
    }
    if (state.mode !== 'manual') return;
    if (!isBusy() && !state.pending) {
      const length = Math.max(1, Math.hypot(input.x || 0, input.z || 0));
      if (input.x || input.z) steer(state.x + (input.x || 0) / length * dt * 0.23, state.z + (input.z || 0) / length * dt * 0.23);
    }
    lever.quaternion.copy(home.poses.get(lever).quaternion);
    if (!isBusy() && !state.pending) {
      // glTF converted Blender's lever X/Z tilt to local X/Y.
      lever.rotateX(-(input.z || 0) * 0.25); lever.rotateY((input.x || 0) * 0.25);
    }
    let remaining = dt;
    while (remaining > 1e-8 && isBusy()) {
      const amount = Math.min(remaining, state.duration - state.elapsed);
      state.elapsed += amount; remaining -= amount;
      const t = clamp(state.elapsed / state.duration, 0, 1), s = smooth(t);
      switch (state.phase) {
        case 'aim': case 'align': case 'deliver': steer(THREE.MathUtils.lerp(movement.from.x, movement.to.x, s), THREE.MathUtils.lerp(movement.from.y, movement.to.y, s)); break;
        case 'lower': state.depth = state.pickupDepth * s; break;
        case 'close': state.grip = s; break;
        case 'raise': state.depth = state.pickupDepth * (1 - s); state.grip = state.held ? 1 : 1 - s; break;
        case 'open': state.grip = 1 - s; break;
        case 'fall': dropPose(t); break;
        case 'settle': dropPose(1, t < 1 ? 0.008 * Math.exp(-4 * t) * Math.abs(Math.sin(t * Math.PI * 3)) : 0); break;
        case 'door': case 'collect': door.position.copy(home.poses.get(door).position).lerp(landed.poses.get(door).position, state.phase === 'door' ? s : 1 - s); break;
        default: break;
      }
      pose();
      if (t >= 1) finishPhase();
    }
    report();
  }
  return {
    root, box, toys, state, getAim, getStatus: () => report(), update, press,
    manual: () => reset('manual'), reset: () => reset('manual'),
    demo() { reset('demo'); state.message = 'Watch the unicorn pickup and delivery.'; action.reset().setLoop(THREE.LoopOnce, 1).play(); report(true); },
    stop() { reset('idle'); },
    moveTo(x, z) { if (state.mode !== 'manual' || isBusy() || state.pending) return false; steer(x, z); report(); return true; },
    aim(name) {
      if (state.mode !== 'manual' || isBusy() || state.held || state.pending) return false;
      const toy = toys.find((o) => o.name === name); if (!toy?.visible || state.won.has(toy)) return false;
      const at = getAim(toy); movement = { from: new THREE.Vector2(state.x, state.z), to: new THREE.Vector2(at.x, at.z) };
      phase('aim', 0.5, `Lining up with ${LABELS[name]}.`); return true;
    },
    deliver() { if (state.mode !== 'manual' || isBusy() || !state.held) return false; alignTo(chuteCenter, 'deliver'); return true; },
    collect() {
      if (state.mode !== 'manual' || state.phase !== 'prize') return false;
      state.pending.visible = false; state.collected.add(state.pending); phase('collect', 0.45, 'Prize collected!'); return true;
    },
    dispose() { action.stop(); mixer.uncacheRoot(scene); restore(original); root.updateWorldMatrix(true, true); },
  };
}
