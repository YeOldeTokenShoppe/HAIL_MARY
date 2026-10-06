import * as THREE from 'three';

const under = (object, ancestor) => { for (let o = object; o; o = o.parent) if (o === ancestor) return true; return false; };

// Capture native canvas gestures before OrbitControls' bubbling listeners.
// R3F stopPropagation alone only stops 3D hit propagation, not those listeners.
//
// isDirect (the phone): the cabinet itself is the controller, no panel needed.
//  · a drag that starts ANYWHERE on the cabinet steers the claw, relative to
//    where the finger went down — so it can be dragged from below the toys
//    without a thumb covering them — and at the cabinet's own on-screen scale,
//    so the claw keeps pace with the finger;
//  · the red button takes any touch within BUTTON_REACH px of it (it is about
//    20px across on a phone, and the lever is its neighbour);
//  · a touch that does not move is a tap, reported through onTap with a `hit`
//    test against what was under the finger (a toy to aim at, the prize to take).
const BUTTON_REACH = 34, TAP_PX = 8, TAP_MS = 500;
export function bindClawPointerControls({ canvas, camera, getMachine, isActive, getControls, onActivate = () => {}, eventTarget = window, isDirect = () => false, onTap = () => {} }) {
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let gesture = null;
  const axis = (value) => Math.abs(value) < 5 ? 0 : THREE.MathUtils.clamp(value / 48, -1, 1);
  const swallow = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  function lockOrbit() {
    const orbit = getControls();
    if (gesture && orbit?.enabled && !gesture.orbit) { gesture.orbit = orbit; orbit.enabled = false; }
    // A camera fly-in may have re-enabled it during the gesture.
    if (gesture?.orbit) gesture.orbit.enabled = false;
  }
  function release() {
    if (!gesture) return;
    const old = gesture; gesture = null;
    if (canvas.hasPointerCapture?.(old.id)) canvas.releasePointerCapture(old.id);
    if (old.orbit) old.orbit.enabled = true;
    canvas.style.cursor = '';
  }
  const _p = new THREE.Vector3(), _q = new THREE.Vector3();
  // client px of a point given in the machine's own space
  function toScreen(c, v, rect) {
    c.root.localToWorld(v).project(camera);
    return [rect.left + (v.x + 1) / 2 * rect.width, rect.top + (1 - v.y) / 2 * rect.height];
  }
  function pickDirect(e) {
    const c = getMachine(); if (!c) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    camera.updateWorldMatrix(true, false); c.root.updateWorldMatrix(true, true);
    ray.setFromCamera(pointer, camera);
    const button = c.root.getObjectByName('Button_01');
    if (button) {
      const at = toScreen(c, c.root.worldToLocal(button.getWorldPosition(_p)), rect);
      if (Math.hypot(e.clientX - at[0], e.clientY - at[1]) <= BUTTON_REACH) return { kind: 'button', hits: [] };
    }
    const hits = ray.intersectObject(c.root, true);
    if (!hits.length) return null;   // off the cabinet: not ours
    // signed px per machine unit along its X, at mid height — what a drag is measured in
    const a = toScreen(c, _p.set(0, 1, 0), rect), b = toScreen(c, _q.set(0.1, 1, 0), rect);
    const scale = (b[0] - a[0]) / 0.1;
    return { kind: 'steer', hits, scale: Math.abs(scale) > 20 ? scale : 300 };
  }
  function pick(e) {
    const c = getMachine(); if (!c) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    camera.updateWorldMatrix(true, false); c.root.updateWorldMatrix(true, true);
    ray.setFromCamera(pointer, camera);
    const lever = c.root.getObjectByName('Lever'), button = c.root.getObjectByName('Button_01');
    const hits = ray.intersectObject(c.root, true);
    for (const hit of hits) {
      // Only claim a visible control surface, not one behind the cabinet.
      if (hit.distance - hits[0].distance > 0.045 * c.root.getWorldScale(new THREE.Vector3()).y) break;
      if (under(hit.object, lever)) return 'lever';
      if (under(hit.object, button)) return 'button';
    }
    return null;
  }
  const down = (e) => {
    if (e.target !== canvas || e.button !== 0 || gesture) return;
    const direct = isDirect();
    const picked = direct ? pickDirect(e) : pick(e); if (!picked) return;
    const kind = direct ? picked.kind : picked;
    swallow(e);
    if (!isActive()) onActivate();
    const c = getMachine(); if (c.state.mode !== 'manual') c.manual();
    gesture = { id: e.pointerId, kind, startX: e.clientX, startY: e.clientY, x: 0, z: 0, orbit: null,
      hits: picked.hits || [], scale: picked.scale || 300, x0: c.state.x, z0: c.state.z, moved: 0, t: performance.now() };
    lockOrbit(); canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = kind === 'lever' ? 'grabbing' : 'pointer';
    if (kind === 'button') c.press();
  };
  const move = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    swallow(e); lockOrbit();
    if (gesture.kind === 'lever') { gesture.x = axis(e.clientX - gesture.startX); gesture.z = axis(e.clientY - gesture.startY); }
    else if (gesture.kind === 'steer') {
      const dx = e.clientX - gesture.startX, dy = e.clientY - gesture.startY;
      gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));
      // across the screen is the machine's X; down the screen is toward the player (+Z), at the same rate
      if (gesture.moved > TAP_PX) getMachine()?.moveTo(gesture.x0 + dx / gesture.scale, gesture.z0 + dy / Math.abs(gesture.scale));
    }
  };
  const up = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture;
    swallow(e); release();
    if (g.kind === 'steer' && g.moved <= TAP_PX && performance.now() - g.t < TAP_MS && e.type === 'pointerup') {
      onTap({ hit: (o) => !!o && g.hits.some((h) => under(h.object, o)) });
    }
  };
  // Suppress the compatibility click for a captured control, so the strip
  // handler cannot trigger a second grab on release.
  let suppressClick = false;
  const captureDown = (e) => { if (gesture && e.target === canvas) { swallow(e); return; } down(e); suppressClick = !!gesture; };
  const click = (e) => { if (suppressClick && e.target === canvas) { swallow(e); suppressClick = false; } };
  const blur = () => release();
  eventTarget.addEventListener('pointerdown', captureDown, true);
  eventTarget.addEventListener('pointermove', move, true);
  eventTarget.addEventListener('pointerup', up, true);
  eventTarget.addEventListener('pointercancel', up, true);
  eventTarget.addEventListener('click', click, true);
  eventTarget.addEventListener('blur', blur);
  canvas.addEventListener('lostpointercapture', up, true);
  return {
    lockOrbit,
    input() { lockOrbit(); return gesture?.kind === 'lever' ? { x: gesture.x, z: gesture.z } : { x: 0, z: 0 }; },
    release,
    dispose() {
      release();
      eventTarget.removeEventListener('pointerdown', captureDown, true);
      eventTarget.removeEventListener('pointermove', move, true);
      eventTarget.removeEventListener('pointerup', up, true);
      eventTarget.removeEventListener('pointercancel', up, true);
      eventTarget.removeEventListener('click', click, true);
      eventTarget.removeEventListener('blur', blur);
      canvas.removeEventListener('lostpointercapture', up, true);
    },
  };
}
