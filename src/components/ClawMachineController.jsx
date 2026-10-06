"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createClawMachine, boundsInMachine } from '@/lib/clawMachine.mjs';
import { bindClawPointerControls } from '@/lib/clawPointerControls.mjs';

const CENTER = (_object, _camera, size) => [size.width / 2, size.height / 2];
const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyR', 'Escape']);
const initialUI = { mode: 'idle', phase: 'ready', busy: false, available: [], collected: 0, message: 'Choose Manual Play or watch the demo.' };
const buttonStyle = { minHeight: 40, padding: '8px 12px', border: '1px solid #95714c', borderRadius: 6, background: '#36241b', color: '#fff2db', cursor: 'pointer', font: 'inherit', fontWeight: 600, touchAction: 'manipulation' };
const under = (object, ancestor) => { for (let o = object; o; o = o.parent) if (o === ancestor) return true; return false; };

// touch (the phone stage): the cabinet is played with the fingers — drag on it
// to steer, tap a toy to line up, tap the red button to grab, tap the prize to
// take it (see bindClawPointerControls' direct mode). The control panel shrinks
// to a status line with the few things the cabinet has no part for (demo, reset,
// deliver), so the camera can hold the cabinet at full size instead of backing
// off to make room for a d-pad.
const TOUCH_STATUS = [
  [/Press Grab when ready/, 'Lined up — tap the red button to grab.'],
  [/Aim over a toy, then grab/, 'Drag on the machine to steer, or tap a toy.'],
  [/Steer to the front-left chute/, 'Got it! Drag to the front-left chute and tap the button — or Deliver.'],
  [/Collect your prize/, 'You won! Tap the prize to take it.'],
  [/Missed!/, 'Missed! Drag over a toy and tap the button.'],
  [/Choose Manual Play/, 'Drag on the machine to steer. The red button grabs.'],
];
const touchStatus = (message) => (TOUCH_STATUS.find(([re]) => re.test(message || '')) || [null, message])[1];
// y: the band of the cabinet's height kept in view (0 = floor, 1 = top of the
// sign); x: half-width kept, as a share of the cabinet's width (0.5 = all of it).
const TOUCH_FRAME = { y: [0.11, 0.83], x: 0.43 };
const chipStyle = { ...buttonStyle, minHeight: 34, padding: '6px 10px', fontSize: 12 };
export default function ClawMachineController({ stripScene, animations, interactionRef, focus, onFocusChange, onFocusObject, onZoomOut, onVendorClick, stripScale, touch = false }) {
  const clip = useMemo(() => animations.find((a) => a.name === 'Claw_Demo'), [animations]);
  const panelAnchor = useRef(null), directControls = useRef(null);
  const machine = useRef(null), active = useRef(false), keys = useRef(new Set()), pointers = useRef(new Map());
  const callbacks = useRef({}); callbacks.current = { onFocusChange, onFocusObject, onZoomOut, onVendorClick };
  const touchRef = useRef(touch); touchRef.current = touch;
  const [open, setOpen] = useState(false), [ui, setUI] = useState(initialUI), [error, setError] = useState(null);
  const { camera, size, gl, controls } = useThree();
  const orbitRef = useRef(controls); orbitRef.current = controls;
  const clearInput = () => { keys.current.clear(); pointers.current.clear(); directControls.current?.release(); };
  const close = (zoomOut = true) => {
    if (!active.current) return;
    active.current = false; clearInput(); machine.current?.stop(); setOpen(false);
    // Do not clear a different stall's focus when it has just taken over.
    callbacks.current.onFocusChange?.((current) => current?.id === 'claw' ? null : current);
    window.dispatchEvent(new CustomEvent('hm-claw-active', { detail: { active: false } }));
    window.dispatchEvent(new CustomEvent('hm-vendor-left'));
    if (zoomOut) callbacks.current.onZoomOut?.();
  };
  const frameMachine = (root) => {
    root.updateWorldMatrix(true, true);
    const bounds = boundsInMachine(root, root), dimensions = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    // Touch: frame the part that is PLAYED — the glass, the control deck and the
    // prize door — and let the marquee, the wheels and a sliver of each side
    // pillar run off the screen. Framing the whole cabinet left the toys and the
    // button small on a phone for the sake of a sign nobody touches.
    const crop = touchRef.current ? TOUCH_FRAME : null;
    if (crop) centre.y = bounds.min.y + dimensions.y * (crop.y[0] + crop.y[1]) / 2;
    const at = root.localToWorld(centre);
    const normal = new THREE.Vector3(0.18, 0.08, 1).transformDirection(root.matrixWorld);
    const scale = root.getWorldScale(new THREE.Vector3()).y;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov || 50) / 2);
    // Reserve room beneath the cabinet for the mobile control panel: what the
    // panel actually takes once it has been measured (it is short until Manual
    // Play opens the controls), the old worst-case guess before that. The guess
    // alone left the cabinet a small thing at the top of a tall phone screen,
    // its lever and button too small to touch.
    const reserved = size.width < 700 ? (panelH.current ? Math.min(panelH.current + 34, size.height * 0.62) : Math.min(440, size.height * 0.56)) : 0;
    const visibleHeight = Math.max(0.35, (size.height - reserved) / size.height);
    const halfY = crop ? dimensions.y * (crop.y[1] - crop.y[0]) / 2 * 1.03 : dimensions.y * 0.55;
    const halfX = crop ? dimensions.x * crop.x : dimensions.x * 0.6;
    const dist = (Math.max(halfY / (tanV * visibleHeight), halfX / (tanV * camera.aspect)) + dimensions.z * 0.6) * scale;
    if (reserved) at.addScaledVector(new THREE.Vector3(0, 1, 0).transformDirection(root.matrixWorld), -dist * tanV * reserved / size.height);
    callbacks.current.onFocusObject?.(at, normal, dist, Math.min(0.1, dist * 0.2));
  };
  const enter = () => {
    if (active.current) return;
    const root = machine.current?.root || stripScene.getObjectByName('Toy_Claw_Empty');
    if (!root) return;
    // Finish any vendor/booth visit before acquiring the shared camera.
    window.dispatchEvent(new CustomEvent('hm-vendor-exit'));
    active.current = true; setOpen(true); clearInput();
    callbacks.current.onVendorClick?.('claw');
    window.dispatchEvent(new CustomEvent('hm-claw-active', { detail: { active: true } }));
    callbacks.current.onFocusChange?.({ id: 'claw', object: root });
    // nothing to choose first on a phone: the machine is live the moment you step up
    if (touchRef.current && machine.current && machine.current.state.mode === 'idle') machine.current.manual();
    frameMachine(root);
  };
  const handlers = useRef({}); handlers.current = { enter, close, frame: () => { if (machine.current) frameMachine(machine.current.root); } };
  // The panel's height, measured: re-frame whenever it changes on a narrow
  // screen (wide ones dock the panel beside the cabinet and reserve nothing).
  const panelH = useRef(0), panelObserver = useRef(null), narrow = useRef(false); narrow.current = size.width < 700;
  const measurePanel = useCallback((el) => {
    panelObserver.current?.disconnect(); panelObserver.current = null;
    if (!el || typeof ResizeObserver === 'undefined') { panelH.current = 0; return; }
    const observer = new ResizeObserver(() => {
      const h = el.offsetHeight; if (Math.abs(h - panelH.current) < 6) return;
      panelH.current = h;
      if (active.current && narrow.current) handlers.current.frame();
    });
    observer.observe(el); panelObserver.current = observer;
  }, []);

  useEffect(() => {
    if (active.current) handlers.current.close(false);
    setOpen(false);
    if (!stripScene.getObjectByName('Toy_Claw_Empty')) return;
    try {
      const controller = createClawMachine(stripScene, clip, setUI);
      machine.current = controller; setUI(controller.getStatus()); setError(null);
      return () => { controller.dispose(); machine.current = null; };
    } catch (e) { setError(e.message); console.error('[Claw machine]', e); }
  }, [stripScene, clip]);

  useEffect(() => {
    interactionRef.current = {
      close: (zoomOut) => handlers.current.close(zoomOut),
      handleClick(e) {
        const root = machine.current?.root || stripScene.getObjectByName('Toy_Claw_Empty');
        if (!root || !under(e.object, root)) return false;
        e.stopPropagation();
        if (!active.current) { handlers.current.enter(); return true; }
        const c = machine.current;
        // Use intersected descendants too: the cabinet glass can be the
        // first hit in front of a toy or control in the same machine.
        const hits = e.intersections || [e];
        const hit = (o) => o && hits.some((h) => under(h.object, o));
        // Reaching for a toy or the button IS choosing to play: no need to find
        // Manual Play in the panel first.
        if (c && c.state.mode !== 'manual' && !c.getStatus().busy && (hit(root.getObjectByName('Button_01')) || c.toys.some((o) => hit(o)))) c.manual();
        if (c?.state.mode === 'manual') {
          if (hit(root.getObjectByName('Button_01'))) c.press();
          else if (c.state.pending && hit(c.box)) c.collect();
          else if (!c.state.held) {
            const toy = c.toys.find((o) => hit(o)); if (toy) c.aim(toy.name);
          }
        }
        return true;
      },
    };
    const onEnter = (e) => { if (e.detail?.id === 'claw') handlers.current.enter(); };
    const onExit = () => handlers.current.close(false);
    window.addEventListener('hm-vendor-enter', onEnter);
    window.addEventListener('hm-vendor-exit', onExit);
    return () => {
      interactionRef.current = null;
      window.removeEventListener('hm-vendor-enter', onEnter);
      window.removeEventListener('hm-vendor-exit', onExit);
      if (active.current) {
        active.current = false;
        window.dispatchEvent(new CustomEvent('hm-claw-active', { detail: { active: false } }));
        window.dispatchEvent(new CustomEvent('hm-vendor-left'));
      }
    };
  }, [interactionRef, stripScene]);

  useEffect(() => {
    if (active.current && focus?.id !== 'claw') handlers.current.close(false);
  }, [focus]);
  // debug: window.__hmClaw() — the machine's status and where its controls are on
  // screen (client px), for driving a test by touch
  useEffect(() => {
    const onScreen = (o) => {
      if (!o) return null;
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [Math.round(r.left + (c.x + 1) / 2 * r.width), Math.round(r.top + (1 - c.y) / 2 * r.height)];
    };
    const read = () => { const c = machine.current, root = c?.root; return { active: active.current, status: c?.getStatus?.() ?? null, head: c ? [+c.state.x.toFixed(3), +c.state.z.toFixed(3)] : null, at: root ? { lever: onScreen(root.getObjectByName('Lever')), button: onScreen(root.getObjectByName('Button_01')), bear: onScreen(root.getObjectByName('Bear_01')), unicorn: onScreen(root.getObjectByName('Unicorn_01')), box: onScreen(c.box) } : null }; };
    window.__hmClaw = read;
    return () => { if (window.__hmClaw === read) delete window.__hmClaw; };
  }, [camera, gl]);
  useEffect(() => {
    if (active.current) handlers.current.frame();
  }, [size.width, size.height]);

  useEffect(() => {
    const root = stripScene.getObjectByName('Toy_Claw_Empty'); if (!root) return;
    root.updateWorldMatrix(true, true);
    const at = root.localToWorld(new THREE.Vector3(0, 1.2, 0.5));
    const registry = (window.__hmVendorSpots = window.__hmVendorSpots || {});
    registry.claw = { id: 'claw', label: 'Claw machine', x: at.x, z: at.z, eyeY: at.y };
    return () => { delete registry.claw; };
  }, [stripScene, stripScale]);

  useEffect(() => {
    if (!open) return;
    const down = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!KEYS.has(e.code)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      keys.current.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Escape') handlers.current.close();
      else if (e.code === 'Space') machine.current?.press();
      else if (e.code === 'KeyR') { clearInput(); machine.current?.reset(); }
    };
    const up = (e) => {
      keys.current.delete(e.code);
      if (KEYS.has(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    const lostFocus = () => clearInput();
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    window.addEventListener('blur', lostFocus); document.addEventListener('visibilitychange', lostFocus);
    return () => {
      clearInput(); window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', lostFocus); document.removeEventListener('visibilitychange', lostFocus);
    };
  }, [open]);

  useEffect(() => {
    const binding = bindClawPointerControls({
      canvas: gl.domElement, camera, getMachine: () => machine.current,
      isActive: () => active.current, getControls: () => orbitRef.current, onActivate: () => handlers.current.enter(),
      isDirect: () => touchRef.current,
      onTap: ({ hit }) => {
        const c = machine.current; if (!c) return;
        if (c.state.pending) { if (hit(c.box) || hit(c.state.pending)) c.collect(); }
        else if (!c.state.held) { const toy = c.toys.find((o) => hit(o)); if (toy) c.aim(toy.name); }
      },
    });
    directControls.current = binding;
    return () => { binding.dispose(); directControls.current = null; };
  }, [gl, camera]);

  // Reassert gesture ownership before drei updates OrbitControls at priority -1.
  useFrame(() => { directControls.current?.lockOrbit(); }, -2);

  useFrame((_, delta) => {
    // Html still checks its 3D anchor against the camera even with a custom
    // screen position. Keep the panel in front when the boardwalk is behind
    // the world origin, or Html would hide a perfectly valid open panel.
    if (panelAnchor.current) {
      camera.updateWorldMatrix(true, false);
      const anchor = panelAnchor.current;
      anchor.position.set(0, 0, -1);
      camera.localToWorld(anchor.position);
      anchor.parent.worldToLocal(anchor.position);
      anchor.updateMatrixWorld();
    }
    const c = machine.current; if (!c || !active.current) return;
    const k = keys.current;
    let x = Number(k.has('ArrowRight') || k.has('KeyD')) - Number(k.has('ArrowLeft') || k.has('KeyA'));
    let z = Number(k.has('ArrowDown') || k.has('KeyS')) - Number(k.has('ArrowUp') || k.has('KeyW'));
    pointers.current.forEach((p) => { x += p.x; z += p.z; });
    const joystick = directControls.current?.input();
    if (joystick) { x += joystick.x; z += joystick.z; }
    c.update(Math.min(delta, 0.05), { x: THREE.MathUtils.clamp(x, -1, 1), z: THREE.MathUtils.clamp(z, -1, 1) });
  });

  if (!open) return null;
  const manual = ui.mode === 'manual';
  const command = (fn) => { clearInput(); machine.current?.[fn](); };
  const btn = (label, fn, disabled = false, extra = {}) => (
    <button type="button" disabled={disabled} onClick={(e) => { fn(); if (e.detail > 0) e.currentTarget.blur(); }} style={{ ...buttonStyle, opacity: disabled ? 0.45 : 1, ...extra }}>{label}</button>
  );
  const direction = (label, x, z, gridColumn) => (
    <button type="button" aria-label={label} disabled={ui.busy || !!ui.pending} style={{ ...buttonStyle, gridColumn, touchAction: 'none', opacity: ui.busy || ui.pending ? 0.45 : 1 }}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); machine.current?.moveTo(uiState().x + x * 0.015, uiState().z + z * 0.015); pointers.current.set(e.pointerId, { x, z }); }}
      onPointerUp={(e) => pointers.current.delete(e.pointerId)} onPointerCancel={(e) => pointers.current.delete(e.pointerId)} onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); machine.current?.moveTo(uiState().x + x * 0.025, uiState().z + z * 0.025); } }}>
      {z < 0 ? '↑' : z > 0 ? '↓' : x < 0 ? '←' : '→'}
    </button>
  );
  const uiState = () => machine.current?.state || { x: 0, z: 0 };
  if (touch) return (
    <group ref={panelAnchor}>
    <Html fullscreen calculatePosition={CENTER} zIndexRange={[110, 100]} style={{ pointerEvents: 'none' }}>
      <section ref={measurePanel} aria-label="Claw machine" style={{ position: 'absolute', left: 10, right: 10, bottom: 12, boxSizing: 'border-box', pointerEvents: 'auto', background: 'rgba(27, 18, 14, .92)', color: '#fff2db', border: '1px solid #b48b56', borderRadius: 10, padding: '9px 11px', fontFamily: 'system-ui, sans-serif', fontSize: 13, boxShadow: '0 6px 22px #0007' }}
        onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <p role="status" aria-live="polite" style={{ margin: 0, lineHeight: 1.4, minHeight: 36, textAlign: 'left' }}>{error ? `The claw machine could not start. ${error}` : touchStatus(ui.message)}</p>
        {!error && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
          {ui.held && btn('Deliver', () => machine.current?.deliver(), ui.busy, { ...chipStyle, background: '#9a6430' })}
          {ui.pending && btn('Take prize', () => machine.current?.collect(), ui.phase !== 'prize', { ...chipStyle, background: '#69512c' })}
          {btn(ui.mode === 'demo' ? 'Play' : 'Demo', () => command(ui.mode === 'demo' ? 'manual' : 'demo'), false, chipStyle)}
          {btn('Reset', () => command('reset'), false, chipStyle)}
          <span style={{ marginLeft: 'auto', color: '#d5bc98', fontSize: 12, whiteSpace: 'nowrap' }}>{ui.collected} / 2 prizes</span>
        </div>}
      </section>
    </Html>
    </group>
  );
  return (
    <group ref={panelAnchor}>
    <Html fullscreen calculatePosition={CENTER} zIndexRange={[110, 100]} style={{ pointerEvents: 'none' }}>
      <section ref={measurePanel} aria-label="Claw machine controls" style={{ position: 'absolute', right: 16, bottom: 20, width: 'min(340px, calc(100% - 32px))', maxHeight: Math.max(0, size.height - 40), boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: 'auto', background: 'rgba(27, 18, 14, .97)', color: '#fff2db', border: '1px solid #b48b56', borderRadius: 12, padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 13, boxShadow: '0 10px 36px #0008' }}
        onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0, marginBottom: 12 }}>
          <strong style={{ fontSize: 18, color: '#f1c77d' }}>PRIZE CLAW</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn('Reset', () => command('reset'), !!error, { background: '#725029' })}
            {btn('Exit', () => close())}
          </div>
        </div>
        <div style={{ minHeight: 0, overflowY: 'auto' }}>
        {error ? <p role="alert">The claw machine could not start. {error}</p> : <>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn('Manual Play', () => command('manual'), false, { flex: 1, background: manual ? '#725029' : '#36241b' })}
            {btn('Watch Demo', () => command('demo'), false, { flex: 1 })}
          </div>
          <p role="status" aria-live="polite" style={{ minHeight: 38, margin: '12px 0', lineHeight: 1.5 }}>{ui.message}</p>
          {manual && <>
            <div style={{ display: 'flex', gap: 8 }}>
              {btn('Aim: Unicorn', () => machine.current?.aim('Unicorn_01'), ui.busy || !!ui.held || !!ui.pending || !ui.available.includes('Unicorn_01'), { flex: 1 })}
              {btn('Aim: Teddy', () => machine.current?.aim('Bear_01'), ui.busy || !!ui.held || !!ui.pending || !ui.available.includes('Bear_01'), { flex: 1 })}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 42px)', gap: 4 }}>
                {direction('Move backward', 0, -1, 2)}
                {direction('Move left', -1, 0, 1)}{direction('Move forward', 0, 1, 2)}{direction('Move right', 1, 0, 3)}
              </div>
              <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                {btn(ui.held ? 'Drop' : 'Grab', () => machine.current?.press(), ui.busy || !!ui.pending, { background: '#9a6430' })}
                {btn('Deliver prize', () => machine.current?.deliver(), ui.busy || !ui.held)}
              </div>
            </div>
            <p style={{ color: '#d5bc98', margin: '10px 0', minHeight: 18 }}>{ui.overChute ? 'Over the chute — ready to drop.' : ui.target ? `Ready to grab ${ui.target === 'Unicorn_01' ? 'the unicorn' : 'the teddy bear'}.` : 'Drag the joystick · Press the red button · WASD / Space'}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {ui.pending && btn('Collect prize', () => machine.current?.collect(), ui.phase !== 'prize', { background: '#69512c' })}
              <span style={{ alignSelf: 'center', marginLeft: 'auto', color: '#d5bc98' }}>{ui.collected} / 2 collected</span>
            </div>
          </>}
        </>}
        </div>
      </section>
    </Html>
    </group>
  );
}
