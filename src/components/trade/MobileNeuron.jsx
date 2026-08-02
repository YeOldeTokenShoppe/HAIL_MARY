"use client";
// NEURAL CATHEDRAL — a Liminal Terminal channel.
//
// Ported from Techartist's "Bioelectric consciousness engine" CodePen (MIT —
// see neuron/LICENSE-neuron.txt). The scene itself is in neuron/NeuronScene;
// this is the screen around it: framing, HUD, input, and the composer.
//
// MOBILE BUDGET. This is the heaviest screen on mobile, so it's worth being
// explicit about why it's affordable: it has the GPU to itself. TradeLaptop
// unmounts its scene while the CRT is open (SceneLoader + EffectComposer both
// go), and unlike LT TV there are no SitePal portals competing. That's the same
// budget LT TV spends on two avatar renderers, spent here on one scene.
//
// The measured original was 101 geometry draws + 14 full-screen post passes at
// 54k triangles. Draws and triangles were never the problem — the 14 post
// passes were, being roughly 1.9x the base fill on top of the scene. Hence the
// bloom settings below, plus the two geometry fixes in NeuronScene.
import React, { useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import NeuronScene from "./neuron/NeuronScene";
import usePerfHud from "./PerfHud";
import TerminalModuleHeader from "./TerminalModuleHeader";

// Pulled back and wider than the pen's desktop pose — it ships a compact
// variant for exactly this and these are those numbers.
const CAM_POSITION = [34, 24, 62];
const CAM_FOV = 52;

export default function MobileNeuron({ onExit }) {
  // Readouts arrive every frame from useFrame, so they're written to a ref and
  // flushed to React on an interval. Re-rendering the tree 60x/second to move a
  // text label would cost more than the scene it's describing.
  const readout = useRef({
    membraneV: -70, axonLoad: 2, sync: 24,
    label: "RESTING", dendrites: "CALM", phase: 0, firing: false,
  });
  const [hud, setHud] = useState(readout.current);
  const fireRef = useRef(false);
  const [boosted, setBoosted] = useState(false);

  const onState = useCallback((s) => { readout.current = s; }, []);
  const onBloom = useCallback((on) => {
    setBoosted((prev) => (prev === on ? prev : on));
  }, []);

  React.useEffect(() => {
    // 10Hz is well past readable for a numeric readout and costs ~1/6th of
    // per-frame React work.
    const id = setInterval(() => setHud({ ...readout.current }), 100);
    return () => clearInterval(id);
  }, []);

  const fire = () => { fireRef.current = true; };

  // ?perf=1 only — see PerfHud for why drift is the number that matters here.
  const { probe: perfProbe, readout: perfReadout } = usePerfHud();

  const dpr = typeof window === "undefined"
    ? 1
    : Math.min(window.devicePixelRatio || 1, 1.5);

  return (
    <div className="mn-root">
      <TerminalModuleHeader
        channel="NEURAL CATHEDRAL"
        mode="BIOFIELD"
        code="NC-09"
        accent="#00e5ff"
        active
        onBack={onExit}
      />

      {/* The stage is also the trigger, and now the ONLY one — the pen's
          "Manual Override" button did exactly what tapping the field does, so
          it was a row of height buying nothing. Removing it is also what makes
          this screen fit above Safari's toolbar on a short phone.
          The pen bound pointerdown ON WINDOW, which inside the terminal would
          fire on every tap in the app — the tuner dials, TUNE IN, EXIT. Scoped
          to the canvas wrapper instead. */}
      <div className="mn-stage-shell">
        <div className="mn-stage" onPointerDown={fire}>
          <Canvas
          dpr={dpr}
          camera={{ position: CAM_POSITION, fov: CAM_FOV, near: 0.1, far: 500 }}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "default",
            precision: "mediump",
            stencil: false,
            depth: true,
            preserveDrawingBuffer: false,
          }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.2;
            scene.fog = new THREE.FogExp2(0x010204, 0.015);
          }}
          style={{ width: "100%", height: "100%", background: "#010204" }}
        >
          <NeuronScene onState={onState} fireRef={fireRef} onBloom={onBloom} />
          {perfProbe}
          <OrbitControls
            enableDamping
            dampingFactor={0.04}
            autoRotate
            autoRotateSpeed={0.6}
            enablePan={false}
            enableZoom={false}
            minDistance={24}
            maxDistance={140}
            /* One finger orbits, two do nothing — the pen left the defaults,
               where a two-finger gesture dollies and fights the page. Matches
               how TradeLaptop configures its own controls. */
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: undefined }}
          />
          {/* Fix 3: the pen ran UnrealBloomPass at full resolution over 5 mip
              levels — 14 full-screen passes, the dominant cost of the frame.
              Half resolution cuts each pass to a quarter of the area.
              `levels` matters as much as the scale here: mipmapBlur defaults to
              8, which is 17 passes — MORE than the pen had. The bottom levels
              are a few pixels wide and contribute almost nothing visually, but
              every pass is still a render-target switch, and on a tile-based
              mobile GPU each of those is a tile flush. 4 keeps the visible
              spread and halves the switches. */}
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={boosted ? 2.5 : 1.6}
              luminanceThreshold={0.1}
              luminanceSmoothing={0.6}
              mipmapBlur
              levels={4}
              resolutionScale={0.5}
            />
          </EffectComposer>
        </Canvas>

          {perfReadout}
          <div className="mn-scan" aria-hidden="true" />
          <div className="mn-field-id">
            <span>CH 03 // FIELD ARRAY</span>
            <span>● LINK STABLE</span>
          </div>
          <div className="mn-hint">{hud.firing ? "FIRING SEQUENCE…" : "TAP THE FIELD TO TRIGGER AN IMPULSE"}</div>
        </div>
      </div>

      <div className="mn-hud">
        <div className="mn-row">
          <span className="mn-label">Membrane V</span>
          <span className={`mn-val ${hud.phase === 2 ? "is-hot" : hud.phase === 4 ? "is-cold" : ""}`}>
            {hud.membraneV > 0 ? "+" : ""}{hud.membraneV.toFixed(1)} mV
          </span>
        </div>
        <div className="mn-row">
          <span className="mn-label">Dendrite State</span>
          <span className="mn-val">{hud.dendrites}</span>
        </div>
        <div className="mn-row">
          <span className="mn-label">Axon Load</span>
          <span className={`mn-val ${hud.phase === 3 ? "is-hot" : ""}`}>
            {String(Math.round(hud.axonLoad)).padStart(2, "0")}%
          </span>
        </div>
        <div className="mn-row">
          <span className="mn-label">Signal Phase</span>
          <span className={`mn-val ${hud.firing ? (hud.phase === 4 ? "is-cold" : "is-hot") : ""}`}>
            {hud.label}
          </span>
        </div>
        <div className="mn-row">
          <span className="mn-label">Synaptic Coh</span>
          <span className="mn-val">{String(Math.round(hud.sync)).padStart(2, "0")}%</span>
        </div>
      </div>

      <style>{`
        .mn-root {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background:
            linear-gradient(90deg, rgba(41,58,65,0.32) 0 8px, transparent 8px calc(100% - 8px), rgba(41,58,65,0.32) calc(100% - 8px)),
            radial-gradient(90% 70% at 50% 42%, rgba(0,45,58,0.22), transparent 72%),
            #000405;
          color: #2fd6d6; font-family: 'IoskeleyMono', 'Courier New', monospace;
          overflow: hidden; user-select: none;
        }

        /* Takes the slack rather than claiming a fixed square. A 1:1 stage plus
           the readout can overflow a short phone (an SE's visible
           viewport is ~500pt once Safari's chrome is up), and with the body
           scroll locked an overflow is unreachable, not merely awkward. Letting
           the stage shrink keeps the telemetry reachable. The scene is roughly
           spherical, so it takes the aspect change without refitting. */
        .mn-stage-shell {
          position: relative; flex: 1 1 auto; min-height: 140px; margin: 10px 11px 0;
          padding: 8px;
          background: linear-gradient(145deg, #132229, #061012 34%, #020405 78%);
          border: 1px solid rgba(0,229,255,0.3);
          box-shadow: 0 9px 24px rgba(0,0,0,0.72), inset 0 0 0 1px rgba(255,255,255,0.025);
          clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
        }
        .mn-stage-shell::before {
          content: ""; position: absolute; inset: 3px; z-index: 1; pointer-events: none;
          border: 1px solid rgba(0,229,255,0.13);
        }
        .mn-stage {
          position: relative; width: 100%; height: 100%;
          border: 1px solid color-mix(in srgb, #00e5ff 48%, transparent);
          background: #010204; overflow: hidden; touch-action: pan-y;
          box-shadow: inset 0 0 35px rgba(0,0,0,0.85), 0 0 18px rgba(0,229,255,0.08);
        }
        .mn-scan {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px);
        }
        .mn-hint {
          position: absolute; left: 0; right: 0; bottom: 8px; text-align: center;
          font-size: 9px; letter-spacing: 0.16em; color: #00e5ff; opacity: 0.55;
          pointer-events: none;
        }
        .mn-field-id {
          position: absolute; z-index: 2; left: 9px; right: 9px; top: 8px;
          display: flex; justify-content: space-between; gap: 10px;
          color: #76aaa9; font-size: 7px; letter-spacing: 0.14em;
          text-shadow: 0 1px 3px #000; pointer-events: none;
        }
        .mn-field-id span:first-child { color: #00e5ff; }

        .mn-hud {
          flex: 0 0 auto; margin: 10px 11px calc(env(safe-area-inset-bottom, 0px) + 11px);
          padding: 2px 10px 3px; display: grid; grid-template-columns: 1fr 1fr;
          border: 1px solid rgba(0,229,255,0.18);
          background: rgba(2,18,18,0.72);
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
        .mn-row {
          display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
          border-bottom: 1px solid rgba(0,229,255,0.08); padding: 7px 7px 6px;
        }
        .mn-row:nth-child(odd) { border-right: 1px solid rgba(0,229,255,0.08); }
        .mn-row:last-child { grid-column: 1 / -1; border-bottom: 0; border-right: 0; }
        .mn-label { font-size: 10px; letter-spacing: 0.1em; color: #2fd6d6; opacity: 0.55; }
        .mn-val { font-size: 12px; letter-spacing: 0.06em; color: #cfeee8; }
        .mn-val.is-hot { color: #ffaa00; text-shadow: 0 0 8px rgba(255,170,0,0.4); }
        .mn-val.is-cold { color: #ff0066; text-shadow: 0 0 8px rgba(255,0,102,0.4); }

        @media (max-height: 620px) {
          .mn-stage-shell { margin-top: 7px; }
          .mn-hud { margin-top: 7px; }
          .mn-row { padding-top: 5px; padding-bottom: 4px; }
          .mn-label { font-size: 8px; }
          .mn-val { font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
