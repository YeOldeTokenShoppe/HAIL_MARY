import * as THREE from 'three';

const under = (object, ancestor) => { for (let o = object; o; o = o.parent) if (o === ancestor) return true; return false; };

// Capture native canvas gestures before OrbitControls' bubbling listeners.
// R3F stopPropagation alone only stops 3D hit propagation, not those listeners.
export function bindClawPointerControls({ canvas, camera, getMachine, isActive, getControls, onActivate = () => {}, eventTarget = window }) {
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
    const kind = pick(e); if (!kind) return;
    swallow(e);
    if (!isActive()) onActivate();
    const c = getMachine(); if (c.state.mode !== 'manual') c.manual();
    gesture = { id: e.pointerId, kind, startX: e.clientX, startY: e.clientY, x: 0, z: 0, orbit: null };
    lockOrbit(); canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = kind === 'lever' ? 'grabbing' : 'pointer';
    if (kind === 'button') c.press();
  };
  const move = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    swallow(e); lockOrbit();
    if (gesture.kind === 'lever') { gesture.x = axis(e.clientX - gesture.startX); gesture.z = axis(e.clientY - gesture.startY); }
  };
  const up = (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    swallow(e); release();
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
