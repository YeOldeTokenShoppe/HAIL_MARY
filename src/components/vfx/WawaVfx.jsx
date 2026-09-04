"use client";
// Thin R3F wrapper over wawa-vfx-vanilla (MIT, Wawa Sensei). We deliberately
// skip the `wawa-vfx` React package: it hard-imports leva (its debug panel)
// and zustand for a `debug` prop we never use. The vanilla core depends on
// three only (ShaderMaterial + InstancedMesh, WebGL) and bundles its own store.
//
// Same two-part idiom as Wawa's scripts:
//   <VFXParticles name="sparks" settings={{...}} geometry={bufferGeometry} />
//     — the pool (one InstancedMesh, allocated once; `name` must be unique app-wide).
//   <VFXEmitter ref emitter="sparks" settings={{...}} autoStart={false} />
//     — an Object3D that spawns into the pool; call ref.emitAtPos(worldPos, true)
//       for a burst, ref.start(true)/ref.stop() for time-mode streams.
//
// Note: the React package turns any `<xGeometry args/>` element into a
// PlaneGeometry (only `<primitive object>` passes through), so Wawa's "cone"
// sparks were billboarded planes. Here `geometry` is a real BufferGeometry.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { VFXEmitterCore, VFXParticlesCore } from "wawa-vfx-vanilla";

export { AppearanceMode, RenderMode } from "wawa-vfx-vanilla";

export function VFXParticles({ name, settings, alphaMap, geometry }) {
  const core = useRef(null);
  const [mesh, setMesh] = useState(null);
  // Pools are static for their mount: settings/alphaMap/geometry are read once.
  useEffect(() => {
    const c = new VFXParticlesCore(name, settings, undefined, alphaMap, geometry);
    core.current = c;
    const m = c.getMesh();
    m.name = `vfx-pool-${name}`;
    setMesh(m);
    return () => { c.dispose(); if (core.current === c) core.current = null; setMesh(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  useFrame(({ clock }) => { core.current?.update(clock.getElapsedTime()); });
  return mesh ? <primitive object={mesh} /> : null;
}

export const VFXEmitter = forwardRef(function VFXEmitter(
  { emitter, settings, localDirection = false, autoStart = true, children, ...rest },
  ref
) {
  const holder = useRef(null);
  const core = useRef(null);
  useEffect(() => {
    const h = holder.current;
    if (!h) return;
    const c = new VFXEmitterCore(emitter, settings || {}, undefined, localDirection, autoStart);
    core.current = c;
    h.add(c);
    return () => { h.remove(c); if (core.current === c) core.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitter]);
  useEffect(() => { core.current?.updateSettings(settings || {}); }, [settings]);
  useImperativeHandle(ref, () => Object.assign(holder.current, {
    start: (reset = false) => core.current?.startEmitting(reset),
    stop: () => core.current?.stopEmitting(),
    emitAtPos: (pos, reset = true) => core.current?.emitAtPos(pos, reset),
    restart: () => core.current?.restart(),
  }), []);
  useFrame(({ clock }, dt) => { core.current?.update(clock.getElapsedTime(), dt); });
  return <object3D ref={holder} {...rest}>{children}</object3D>;
});
