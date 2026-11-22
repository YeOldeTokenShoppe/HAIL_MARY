"use client";

// RcanaLive3D — a card's art as a live 3D scene (2026-11-20).
//
// A few cards carry an animated 3D object in their art window in place of a painted subject. It only
// ever runs on the ONE live card (the enlarged, tilting card): thumbnails, hands and rendered faces show
// the card's poster picture, and a grid of cards never opens a 3D canvas. So:
//   · the scene's code is loaded only when such a card is opened (a dynamic import per `kind`)
//   · it pauses when the tab is hidden, the canvas is off screen or the card is turned over (`paused`)
//   · a phone or a small machine gets it without bloom, at one device pixel per pixel
//   · reduced-motion users, and browsers with no WebGL, keep the poster
// The canvas fades in over the poster once its first frame is drawn, and takes no pointer events: the
// card's own tilt turns the object (the scene reads --tx / --ty from the card's stage).
import React, { useEffect, useRef, useState } from "react";

// kind (an art file's `live3d`) -> its scene module, which exports mount(canvas, opts).
const SCENES = {
  "sacred-geometry": () => import("@/game/rcana/live3d/sacredGeometry.js"),
  singularity: () => import("@/game/rcana/live3d/singularity.js"),
  "sacred-lattice": () => import("@/game/rcana/live3d/sacredLattice.js"),
};
export const RCANA_LIVE3D_KINDS = Object.keys(SCENES);

export default function RcanaLive3D({ kind, paused = false, style }) {
  const ref = useRef(null);
  const apiRef = useRef(null);
  const state = useRef({ paused, inView: true });
  const [on, setOn] = useState(false);
  state.current.paused = paused;
  const sync = () => { const api = apiRef.current; if (!api) return; if (state.current.paused || !state.current.inView || document.hidden) api.stop(); else api.start(); };

  useEffect(() => {
    const canvas = ref.current; const load = SCENES[kind];
    if (!canvas || !load) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    let dead = false, io = null;
    const stage = canvas.closest(".rc3-stage");
    const getTilt = () => (stage ? { x: parseFloat(stage.style.getPropertyValue("--tx")) || 0, y: parseFloat(stage.style.getPropertyValue("--ty")) || 0 } : { x: 0, y: 0 });
    // The card is scaled by a CSS transform, so the canvas is measured as it appears, not as it is laid out.
    const size = () => { const r = canvas.getBoundingClientRect(); apiRef.current?.resize(r.width, r.height, window.devicePixelRatio || 1); };
    load().then((scene) => {
      if (dead) return;
      const small = (navigator.hardwareConcurrency || 8) <= 4 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      apiRef.current = scene.mount(canvas, { getTilt, bloom: !small, maxPixelRatio: small ? 1 : 1.5 });
      size();
      io = new IntersectionObserver(([entry]) => { state.current.inView = entry.isIntersecting; sync(); }); io.observe(canvas);
      document.addEventListener("visibilitychange", sync); window.addEventListener("resize", size);
      sync(); setOn(true);
    }).catch(() => { /* no WebGL, or the scene failed to load: the poster stays */ });
    return () => {
      dead = true; io?.disconnect(); document.removeEventListener("visibilitychange", sync); window.removeEventListener("resize", size);
      apiRef.current?.dispose(); apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  useEffect(sync, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} aria-hidden="true" style={{ ...style, display: "block", opacity: on ? 1 : 0, transition: "opacity 450ms ease-out", pointerEvents: "none" }} />;
}
