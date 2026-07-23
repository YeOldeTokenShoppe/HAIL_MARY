"use client";
// The curtain call as a self-contained backdrop — the four characters from
// the /trade temple scene (RL80_4anims GLB) lined up on the stage carpet,
// playing their per-outcome reaction clips. Extracted for surfaces that
// don't mount CyborgTempleScene (the Case Table reveal on /case-table-dev
// and the mobile CRT), so the result screen can overlay its info on the
// scene instead of a flat terminal panel.
//
// Deliberately a SUBSET of the temple reveal: outcome reactions only
// (aligned / missed / abstained). 'council' stays temple-only — it needs
// the SmartPhone frame-gate and the Monk argue↔pray alternation, none of
// which earn their keep here.
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

const MODEL_URL = "/models/RL80_4anims_v89_opt.glb";

// Kick the GLB fetch before the reveal mounts (CaseTable calls this when the
// player enters the analyst calls — the reveal follows within a minute).
export function preloadCurtainCall() {
  useGLTF.preload(MODEL_URL);
}

// Per-outcome reaction clips — mirrors the temple's REACTION_PATTERNS
// (CyborgTempleScene.jsx) for the three outcome keys. Every clip here is one
// of the verified STANDING clips; seated gameplay clips would leave the
// character sitting on air with the desks hidden.
const REACTIONS = {
  aligned:   { Monk: /monk_cheering/i,  Demon: /demon_clapping/i,     Detective: /detective_clap/i,   RL80: /unicorn_clapping/i },
  missed:    { Monk: /monk_standPray/i, Demon: /demon_disappointed/i, Detective: /detective_defeat/i, RL80: /unicorn_disappointed/i },
  abstained: { Monk: /monk_standPray/i, Demon: /demon_shrug/i,        Detective: /detective_stand/i,  RL80: /unicorn_stand/i },
};

// Stage lineup — the temple's STAGE_LINEUP verbatim (positions are local to
// the GLB root; the empties keep their authored scales). The unicorn's
// authored facing is reversed, hence the π yaw.
const LINEUP = {
  Monk_empty:      { position: [-0.75, 0.18, 0], rotation: [0, 0, 0] },
  Demon_Empty:     { position: [-0.25, 0.18, 0], rotation: [0, 0, 0] },
  Detective_Empty: { position: [ 0.25, 0.18, 0], rotation: [0, 0, 0] },
  RL80_Empty:      { position: [ 0.75, 0.3,  0], rotation: [0, Math.PI, 0] },
  Unicorn_Empty:   { position: [ 0.75, 0.3,  0], rotation: [0, Math.PI, 0] },
};

// Bounded teal phosphor grid, same construction as the temple's floor grid
// (square lines clipped to a circle + rim, radial fade in the fragment stage).
function makeGrid(radius = 14, divisions = 28) {
  const step = (2 * radius) / divisions;
  const pos = [];
  for (let i = 0; i <= divisions; i++) {
    const x = -radius + i * step;
    const dz2 = radius * radius - x * x;
    if (dz2 <= 0) continue;
    const z = Math.sqrt(dz2);
    pos.push(x, 0, -z, x, 0, z);
  }
  for (let i = 0; i <= divisions; i++) {
    const z = -radius + i * step;
    const dx2 = radius * radius - z * z;
    if (dx2 <= 0) continue;
    const x = Math.sqrt(dx2);
    pos.push(-x, 0, z, x, 0, z);
  }
  const segs = 96;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    pos.push(radius * Math.cos(a0), 0, radius * Math.sin(a0), radius * Math.cos(a1), 0, radius * Math.sin(a1));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x35e8ff) },
      uOpacity: { value: 0.55 },
      uRadius: { value: radius },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uRadius;
      void main() {
        float d = length(vPos.xz) / uRadius;
        float fade = 1.0 - smoothstep(0.45, 1.0, d);
        if (fade <= 0.001) discard;
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `,
  });
  return new THREE.LineSegments(geometry, material);
}

function Stage({ outcome }) {
  const { scene, animations } = useGLTF(MODEL_URL);

  const cloned = useMemo(() => {
    const c = skeletonClone(scene);
    // Desks/chairs/screens off — this is the bare curtain-call stage. The
    // Floor (hex carpet) sits outside StageProps and stays.
    const props = c.getObjectByName("StageProps");
    if (props) {
      props.visible = false;
      props.children.forEach((child) => { child.visible = false; });
    }
    // The Demon's SmartPhone prop exports visible; it only belongs in the
    // temple's council reaction.
    const phone = c.getObjectByName("SmartPhone");
    if (phone) phone.visible = false;
    c.traverse((o) => {
      // SitePal swap faces (Face2 variants) and closed-eye meshes ship
      // visible; without the temple's face/blink systems, hide them.
      if ((o.isMesh || o.isGroup) && /face2|closed/i.test(o.name || "")) o.visible = false;
    });
    Object.entries(LINEUP).forEach(([name, t]) => {
      const obj = c.getObjectByName(name);
      if (!obj) return;
      obj.position.set(...t.position);
      obj.rotation.set(...t.rotation);
    });
    return c;
  }, [scene]);

  // One mixer per character, rooted at that character's empty so shared bone
  // names (Demon and Detective both have a 'Root') bind to the right rig.
  // The unicorn's mixamorig bones are unique across the file, so its mixer
  // roots at the scene like the temple's does.
  const mixers = useMemo(() => {
    const roots = {
      Monk: cloned.getObjectByName("Monk_empty"),
      Demon: cloned.getObjectByName("Demon_Empty"),
      Detective: cloned.getObjectByName("Detective_Empty"),
      RL80: cloned,
    };
    const out = {};
    Object.entries(roots).forEach(([who, root]) => {
      if (root) out[who] = new THREE.AnimationMixer(root);
    });
    return out;
  }, [cloned]);

  useEffect(() => {
    const map = REACTIONS[outcome] || REACTIONS.abstained;
    const started = [];
    Object.entries(map).forEach(([who, re]) => {
      const mixer = mixers[who];
      const clip = animations.find((a) => re.test(a.name));
      if (!mixer || !clip) return;
      // Strip the SitePal-overlay face tracks the temple also strips —
      // Face1/Face2 are static swap meshes, not animation targets here.
      let clean = clip;
      const faceRe = /^(Detective_)?Face[12]([._]\w+)?\./;
      if (clip.tracks.some((t) => faceRe.test(t.name))) {
        clean = new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter((t) => !faceRe.test(t.name)));
      }
      const action = mixer.clipAction(clean);
      action.reset();
      action.time = clean.duration * 0.05;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveWeight(1);
      action.fadeIn(0.35);
      action.play();
      started.push(action);
    });
    return () => started.forEach((a) => a.fadeOut(0.35));
  }, [outcome, mixers, animations]);

  const grid = useMemo(() => {
    const g = makeGrid();
    g.position.y = -0.36;
    return g;
  }, []);

  // Tick mixers + a slow lateral sway so the wide shot doesn't read as a
  // still frame. Framing pulls back from the temple's Stage preset so the
  // lineup fits the open band between the result banner (top) and the info
  // sheet (bottom ~44%) — heads clear of the banner is the hard constraint.
  const swayRef = useRef(0);
  const { camera } = useThree();
  useFrame((_, delta) => {
    Object.values(mixers).forEach((m) => m.update(delta));
    swayRef.current += delta;
    const t = swayRef.current;
    camera.position.set(
      Math.sin(t * 0.14) * 0.14,
      0.55 + Math.sin(t * 0.09) * 0.03,
      4.15
    );
    camera.lookAt(0, 0.5, 0);
  });

  return (
    <>
      <primitive object={cloned} />
      <primitive object={grid} />
    </>
  );
}

export default function CurtainCallStage({ outcome = "abstained" }) {
  return (
    <Canvas
      camera={{ position: [0, 0.55, 4.15], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "default", stencil: false }}
      dpr={typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.75) : 1}
      style={{ position: "absolute", inset: 0, background: "transparent" }}
    >
      <fog attach="fog" args={["#03211b", 5.5, 14]} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[1.5, 3, 2.5]} intensity={0.9} />
      <pointLight position={[0, 1.6, 1.8]} intensity={0.55} color="#8ffff0" />
      <Suspense fallback={null}>
        <Stage outcome={outcome} />
      </Suspense>
    </Canvas>
  );
}
