import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// The card in play — a holographic trading card the projector casts at the
// center of the desks, replacing the legacy geometric beacon (knot). States:
//   'delib'  — card back to the camera, swaying in the beam: the table is
//              working the case and the verdict is still face-down.
//   'reveal' — flips to the front with a glitch burst: topic/verdict shown.
//   'idle'   — slow free tumble between cases.
// The card billboards toward the camera on yaw, so "back" and "front" hold
// from any orbit angle; the flip animates the extra half-turn between them.
//
// Follows `anchorRef` (the GLB beacon mesh) the same way BeaconBeam does, so
// it floats exactly where the knot did — even if the GLB moves it.
//
// All knobs live in HOLOGRAM_CARD_CONFIG; edit + save to see it live.
export const HOLOGRAM_CARD_CONFIG = {
  // Placeholder art — wire `front` to the live case/topic card later.
  front: "/TCG/actionCard_PumpSignal.png",
  back: "/TCG/cardBack.webp",
  // The Pump Signal render is a tall legacy asset (824x1578). Genesis
  // template cards are 744x1038 → set 744 / 1038 when those land.
  aspect: 824 / 1578,
  height: 0.36,      // card height, parent-local units (beam is 0.7 tall)
  yOffset: 0.35,     // lift above the beacon anchor point
  holo: 0.35,        // 0 = full-color print, 1 = pure cyan projection
  scan: 0.5,         // scanline strength
  glitch: 0.35,      // ambient glitch amount
  opacity: 0.96,
  brightness: 1.5,   // post-tint gain — lifts the dark card art out of the holo dimming
  glow: 0.7,         // baked halo strength in the margin around the card (0 = off)
  glowWidth: 0.18,   // how far the halo spreads past the card edge (card-uv units)
  glowMargin: 1.55,  // plane enlargement that makes room for the halo (feeds geometry + uMargin)
  sway: 0.22,        // deliberation sway amplitude (radians)
  // true: card yaw-tracks the camera so back/front hold from any orbit angle.
  // false: card sits fixed in the world at faceYaw (radians, 0 = +Z), so you
  // can physically orbit around to the other face.
  billboard: true,
  faceYaw: 0,
  bob: 0.012,        // hover bob amplitude
  holoColor: "#66f7ff",
};

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  uniform sampler2D uMap;
  uniform float uTime, uHolo, uScan, uGlitch, uBurst, uOpacity, uReady, uBright, uGlow, uGlowWidth, uMargin;
  uniform vec3 uHoloColor;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    if (uReady < 0.5) discard;

    // The plane is enlarged by uMargin; the card art occupies the central
    // 1/uMargin, and the ring of margin around it is where the halo lives.
    vec2 uv = (vUv - 0.5) * uMargin + 0.5;

    // Occasional horizontal slice displacement (glitch); bursts on reveal.
    float t7 = floor(uTime * 9.0);
    float band = floor(uv.y * 24.0);
    float g = step(1.0 - (0.02 + uGlitch * 0.03 + uBurst * 0.35), hash(t7 * 13.7 + band * 3.1));
    uv.x += g * (hash(band + t7) * 2.0 - 1.0) * (0.012 + uBurst * 0.05);

    // Rounded-rect signed distance (<0 inside the card, >0 out in the margin).
    vec2 p = abs(uv - 0.5) - vec2(0.455, 0.455);
    float rd = length(max(p, 0.0)) - 0.045;
    float mask = 1.0 - smoothstep(-0.004, 0.004, rd);

    // ── Card art (only meaningful inside the card) ──
    vec4 col = texture2D(uMap, uv);

    // Chromatic fringe, grows with the burst.
    float ca = 0.0015 + uBurst * 0.006;
    col.r = texture2D(uMap, uv + vec2(ca, 0.0)).r;
    col.b = texture2D(uMap, uv - vec2(ca, 0.0)).b;

    // Hologram tint: keep luminance, push toward the projector cyan.
    float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    vec3 holoCol = uHoloColor * (0.35 + lum * 1.15);
    col.rgb = mix(col.rgb, holoCol, uHolo);

    // Scanlines + subtle flicker.
    float scan = 1.0 - uScan * 0.18 * (0.5 + 0.5 * sin(uv.y * 420.0 + uTime * 7.0));
    float flick = 0.97 + 0.03 * sin(uTime * 61.0) * (0.3 + uHolo);
    col.rgb *= scan * flick * (1.0 + uBurst * 0.6);

    // Lift the card art out of the holo dimming (tunable via config.brightness).
    col.rgb *= uBright;

    // Inner edge rim so it reads as projected light, not a flat texture.
    float edgeD = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    col.rgb += uHoloColor * (1.0 - smoothstep(0.0, 0.05, edgeD)) * (0.25 + uHolo * 0.6);

    // ── Baked halo: cyan glow in the margin, hugging the card edge and fading
    //    outward. Breathes so the projection reads as alive, not a decal. ──
    float breathe = 0.82 + 0.18 * sin(uTime * 1.6);
    float halo = pow(1.0 - smoothstep(0.0, uGlowWidth, max(rd, 0.0)), 1.5) * uGlow * breathe;

    // ── Composite card OVER halo OVER scene as one normal-blended pixel.
    //    Inside the card (mask≈1) haloA≈0, so this reduces to the original
    //    output — the card render is unchanged; the halo only adds in the margin.
    float cardA = uOpacity * mask * (0.88 + 0.12 * uHolo);
    float haloA = clamp(halo * (1.0 - mask), 0.0, 1.0);
    float outA = cardA + haloA * (1.0 - cardA);
    if (outA <= 0.0001) discard;
    vec3 premult = col.rgb * cardA + uHoloColor * haloA * (1.0 - cardA);
    gl_FragColor = vec4(premult / outA, outA);
  }
`;

function makeCardMaterial(cfg) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
    uniforms: {
      uMap: { value: null },
      uTime: { value: 0 },
      uHolo: { value: cfg.holo },
      uScan: { value: cfg.scan },
      uGlitch: { value: cfg.glitch },
      uBurst: { value: 0 },
      uOpacity: { value: cfg.opacity },
      uBright: { value: cfg.brightness ?? 1 },
      uGlow: { value: cfg.glow ?? 0 },
      uGlowWidth: { value: cfg.glowWidth ?? 0.15 },
      uMargin: { value: cfg.glowMargin ?? 1 },
      uReady: { value: 0 }, // stays 0 (discard) until the texture arrives
      uHoloColor: { value: new THREE.Color(cfg.holoColor) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
}

function HologramCard({ anchorRef, mode = "delib", config = HOLOGRAM_CARD_CONFIG, userData = {} }) {
  const groupRef = useRef();
  const tmp = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  // flip: PI = back to camera (delib), 0 = front to camera (reveal)
  const anim = useRef({ flip: Math.PI, target: Math.PI, burst: 0, spin: 0 });

  const cfg = config;
  const frontMat = useMemo(() => makeCardMaterial(cfg), []);
  const backMat = useMemo(() => makeCardMaterial(cfg), []);
  // Plane is enlarged by glowMargin so the baked halo has room past the card
  // edge; the shader remaps the art back into the central 1/glowMargin.
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(
      cfg.height * cfg.aspect * (cfg.glowMargin || 1),
      cfg.height * (cfg.glowMargin || 1)
    ),
    [cfg.height, cfg.aspect, cfg.glowMargin]
  );

  // Load card art without suspending the scene; the shader discards (uReady=0)
  // until each texture lands, so there's no black-card flash.
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const owned = [];
    const assign = (mat, url) => {
      const t = loader.load(url, () => { mat.uniforms.uReady.value = 1; });
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      mat.uniforms.uMap.value = t;
      mat.uniforms.uReady.value = 0;
      owned.push(t);
    };
    assign(frontMat, cfg.front);
    assign(backMat, cfg.back);
    return () => owned.forEach((t) => t.dispose());
  }, [frontMat, backMat, cfg.front, cfg.back]);

  useEffect(() => () => {
    geometry.dispose();
    frontMat.dispose();
    backMat.dispose();
  }, [geometry, frontMat, backMat]);

  // Mode changes retarget the flip; a reveal also fires the glitch burst.
  useEffect(() => {
    const a = anim.current;
    a.target = mode === "reveal" ? 0 : Math.PI;
    if (mode === "reveal") a.burst = 1;
  }, [mode]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const a = anim.current;

    // Follow the beacon anchor (same pattern as BeaconBeam).
    if (anchorRef?.current && g.parent) {
      g.visible = true;
      anchorRef.current.getWorldPosition(tmp.current);
      g.parent.worldToLocal(tmp.current);
      g.position.set(
        tmp.current.x,
        tmp.current.y + cfg.yOffset + Math.sin(t * 1.3) * cfg.bob,
        tmp.current.z
      );
    } else {
      g.visible = false;
      return;
    }

    a.burst = Math.max(0, a.burst - delta * 1.8);
    a.flip += (a.target - a.flip) * Math.min(1, delta * 4.5);

    if (mode === "idle") {
      // Free tumble between cases.
      a.spin += delta * 0.25;
      g.rotation.y = a.spin;
    } else {
      // Base yaw: camera-tracking (billboard) or fixed world facing.
      let yaw = cfg.faceYaw;
      if (cfg.billboard) {
        camPos.current.setFromMatrixPosition(state.camera.matrixWorld);
        g.parent.worldToLocal(camPos.current);
        yaw = Math.atan2(camPos.current.x - g.position.x, camPos.current.z - g.position.z);
      }
      const swayAmp = mode === "reveal" ? cfg.sway * 0.4 : cfg.sway;
      g.rotation.y = yaw + a.flip + Math.sin(t * 0.5) * swayAmp;
    }
    g.rotation.z = Math.sin(t * 0.4) * 0.02;

    for (const m of [frontMat, backMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uBurst.value = a.burst;
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={3}>
      {/* userData carries the scene's click tag (clickable + agentId) so the
          Temple raycaster can pick the card; harmless empty object otherwise. */}
      <mesh geometry={geometry} material={frontMat} userData={userData} />
      <mesh geometry={geometry} material={backMat} rotation={[0, Math.PI, 0]} userData={userData} />
    </group>
  );
}

export default HologramCard;
