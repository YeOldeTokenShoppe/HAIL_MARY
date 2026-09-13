// Opt-in authoring controls; never mounted on the normal landing page.
export function createPalmTreeDriveCameraHelper({ camera, controls, canvas, timeline, trigger, freezeTour, setStage }) {
  const panel = document.createElement('section');
  panel.id = 'palm-camera-helper';
  panel.setAttribute('aria-label', 'Camera helper');
  Object.assign(panel.style, { position: 'fixed', top: '90px', right: '16px', width: '290px', maxHeight: '75vh', overflow: 'auto', padding: '16px', border: '1px solid #67e8f9', borderRadius: '10px', background: 'rgba(10,15,25,.96)', color: '#eefcff', font: '12px/1.5 monospace', zIndex: '100000', pointerEvents: 'auto' });
  const heading = document.createElement('strong');
  heading.textContent = 'Camera helper';
  panel.append(heading);
  const instructions = document.createElement('p');
  instructions.textContent = 'Choose a tour position, then use Free camera. Drag to orbit, right-drag to pan, and scroll to zoom. Use Apply coordinates after editing the fields, or Capture shot to record your current view.';
  panel.append(instructions);
  // The landing page has a scroll spacer above its canvas. Receive orbit
  // gestures on a dedicated surface above that spacer, below this panel.
  const orbitSurface = document.createElement('div');
  orbitSurface.id = 'palm-camera-orbit-surface';
  orbitSurface.setAttribute('aria-label', 'Camera orbit area');
  Object.assign(orbitSurface.style, { position: 'fixed', inset: '0', zIndex: '99999', display: 'none', pointerEvents: 'auto', touchAction: 'none', cursor: 'grab' });
  document.body.append(orbitSurface);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Tour camera — choose Free camera to orbit.';
  status.style.color = '#a5f3fc';
  panel.append(status);
  let editing = false;
  const previous = { maxDistance: controls.maxDistance, minDistance: controls.minDistance, maxPolarAngle: controls.maxPolarAngle, pointerEvents: canvas.style.pointerEvents, touchAction: canvas.style.touchAction };
  const fields = {};
  const snapshot = () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z, targetX: controls.target.x, targetY: controls.target.y, targetZ: controls.target.z, fov: camera.fov });
  const output = document.createElement('textarea');
  output.setAttribute('aria-label', 'Captured camera shot');
  output.readOnly = true;
  output.rows = 9;
  Object.assign(output.style, { width: '100%', background: '#111c2c', color: '#a5f3fc', marginTop: '12px' });
  const sync = () => { const shot = snapshot(); for (const key in fields) fields[key].value = shot[key].toFixed(4); };
  const freeze = () => { freezeTour(); trigger.disable(false); timeline.pause(); };
  const freeCamera = () => {
    freeze(); editing = true; controls.enabled = true;
    controls.maxDistance = 100; controls.minDistance = 0.02; controls.maxPolarAngle = Math.PI;
    orbitSurface.style.display = 'block';
    if (controls.domElement !== orbitSurface) controls.connect(orbitSurface);
    freeButton.setAttribute('aria-pressed', 'true');
    status.textContent = 'Free camera active — drag the scene to orbit.';
    sync();
  };
  const lockCamera = () => {
    editing = false; controls.enabled = false;
    orbitSurface.style.display = 'none';
    if (controls.domElement !== canvas) controls.connect(canvas);
    canvas.style.pointerEvents = previous.pointerEvents; canvas.style.touchAction = previous.touchAction;
    freeButton.setAttribute('aria-pressed', 'false');
    status.textContent = 'Tour camera — choose Free camera to orbit.';
  };
  const button = (label, action) => {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label;
    Object.assign(el.style, { padding: '6px 9px', margin: '3px', border: '1px solid #47717b', borderRadius: '4px', cursor: 'pointer', background: '#132a34', color: '#e5fbff' });
    el.addEventListener('click', action); panel.append(el); return el;
  };
  const scrub = (progress) => {
    freeze(); lockCamera(); timeline.progress(progress); setStage(Math.min(4, Math.floor(progress * 5)));
    slider.value = progress; sync();
  };
  const freeButton = button('Free camera', freeCamera);
  freeButton.setAttribute('aria-pressed', 'false');
  button('Mary close-up', () => scrub(1));
  button('Start view', () => scrub(0));
  const label = document.createElement('label'); label.textContent = 'Tour position'; label.style.display = 'block';
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = 1; slider.step = 0.001; slider.value = timeline.progress(); slider.style.width = '100%';
  slider.addEventListener('input', () => scrub(Number(slider.value))); label.append(slider); panel.append(label);
  for (const key of ['x', 'y', 'z', 'targetX', 'targetY', 'targetZ', 'fov']) {
    const row = document.createElement('label'); row.textContent = key;
    Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', marginTop: '4px' });
    const input = document.createElement('input'); input.type = 'number'; input.step = key === 'fov' ? '1' : '0.01'; input.style.width = '135px'; input.style.color = '#111'; input.style.background = '#e8f3f8';
    fields[key] = input;
    row.append(input); panel.append(row);
  }
  button('Apply coordinates', () => {
    const values = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, Number(field.value)]));
    if (!Object.values(values).every(Number.isFinite)) return;
    freeCamera();
    camera.position.set(values.x, values.y, values.z);
    controls.target.set(values.targetX, values.targetY, values.targetZ);
    camera.fov = Math.min(100, Math.max(5, values.fov));
    camera.updateProjectionMatrix(); controls.update(); sync();
  });
  const capture = () => { sync(); output.value = JSON.stringify(Object.fromEntries(Object.entries(snapshot()).map(([key, value]) => [key, Number(value.toFixed(4))])), null, 2); };
  button('Capture shot', capture);
  const copy = button('Copy shot', async () => {
    capture();
    try { await navigator.clipboard.writeText(output.value); copy.textContent = 'Copied'; }
    catch { output.focus(); output.select(); copy.textContent = 'Select and copy below'; }
  });
  button('Resume tour', () => { lockCamera(); trigger.enable(); trigger.refresh(); });
  const onOrbitChange = () => {
    if (editing && !Object.values(fields).includes(document.activeElement)) sync();
  };
  controls.addEventListener('change', onOrbitChange);
  panel.append(output); document.body.append(panel); sync();
  // Stop the automatic tour while the user is preparing a shot.
  freeze();
  return {
    get isEditing() { return editing; },
    dispose() {
      controls.removeEventListener('change', onOrbitChange);
      lockCamera(); controls.maxDistance = previous.maxDistance; controls.minDistance = previous.minDistance; controls.maxPolarAngle = previous.maxPolarAngle;
      orbitSurface.remove(); panel.remove();
    },
  };
}
