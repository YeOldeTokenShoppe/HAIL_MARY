import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as Tone from "tone";

const NOTES = ["C3","D3","E3","G3","A3","C4","D4","E4","G4","A4","C5","D5"];

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uB0, uB1, uB2, uB3, uB4, uB5;
uniform float uR0, uR1, uR2, uR3, uR4, uR5;
uniform float uSmooth;
uniform float uGlow;
uniform float uHue;

varying vec2 vUv;

/* ── HSL to RGB ── */
vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

/* ── SDF ── */
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float mapBlobs(vec3 p) {
  float d = length(p - uB0) - uR0;
  d = smin(d, length(p - uB1) - uR1, uSmooth);
  d = smin(d, length(p - uB2) - uR2, uSmooth);
  d = smin(d, length(p - uB3) - uR3, uSmooth);
  d = smin(d, length(p - uB4) - uR4, uSmooth);
  d = smin(d, length(p - uB5) - uR5, uSmooth);
  return d;
}

float mapRing(vec3 p) {
  vec3 rp = p - vec3(0.0, -1.0, 0.0);
  float outer = sdTorus(rp, vec2(2.1, 0.07));
  float inner = sdTorus(rp, vec2(1.4, 0.04));
  float base  = sdTorus(rp - vec3(0.0, -0.15, 0.0), vec2(1.75, 0.12));
  return min(min(outer, inner), base);
}

float map(vec3 p) {
  return min(mapBlobs(p), mapRing(p));
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.012, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

/* Per-blob hue offsets — spread wide for visible concentric bands */
/* Like the 2D source: main blob base hue, interactive +40deg, orbs alternate ±30-50deg */
const float HOFF0 = 0.0;      /* base hue */
const float HOFF1 = 0.11;     /* +40deg — interactive blob */
const float HOFF2 = -0.09;    /* -32deg — warm shift */
const float HOFF3 = 0.14;     /* +50deg — cool shift */
const float HOFF4 = -0.06;    /* -22deg */
const float HOFF5 = 0.19;     /* +68deg — furthest complement */

/* Distance-weighted color blending — creates concentric color bands */
/* Each blob owns its color zone; where they overlap, you see distinct rings */
vec3 blobColor(vec3 p) {
  /* Signed distances to each blob surface */
  float d0 = length(p - uB0) - uR0;
  float d1 = length(p - uB1) - uR1;
  float d2 = length(p - uB2) - uR2;
  float d3 = length(p - uB3) - uR3;
  float d4 = length(p - uB4) - uR4;
  float d5 = length(p - uB5) - uR5;

  /* Exponential weights — k controls ring sharpness */
  /* Higher k = sharper color boundaries between blobs */
  float k = 5.0;
  float w0 = exp(-d0 * k);
  float w1 = exp(-d1 * k);
  float w2 = exp(-d2 * k);
  float w3 = exp(-d3 * k);
  float w4 = exp(-d4 * k);
  float w5 = exp(-d5 * k);
  float total = w0 + w1 + w2 + w3 + w4 + w5 + 0.001;

  /* Per-blob colors with distinct hue offsets */
  vec3 c0 = hsl2rgb(uHue + HOFF0, 0.85, 0.6);
  vec3 c1 = hsl2rgb(uHue + HOFF1, 0.88, 0.58);
  vec3 c2 = hsl2rgb(uHue + HOFF2, 0.82, 0.55);
  vec3 c3 = hsl2rgb(uHue + HOFF3, 0.86, 0.6);
  vec3 c4 = hsl2rgb(uHue + HOFF4, 0.80, 0.57);
  vec3 c5 = hsl2rgb(uHue + HOFF5, 0.84, 0.62);

  /* Weighted blend — each blob dominates its own zone */
  return (c0*w0 + c1*w1 + c2*w2 + c3*w3 + c4*w4 + c5*w5) / total;
}

/* Highlight color — slightly lighter/desaturated version of local blob color */
vec3 blobHighlight(vec3 p) {
  float d0 = length(p - uB0) - uR0;
  float d1 = length(p - uB1) - uR1;
  float d2 = length(p - uB2) - uR2;
  float d3 = length(p - uB3) - uR3;
  float d4 = length(p - uB4) - uR4;
  float d5 = length(p - uB5) - uR5;
  float k = 5.0;
  float w0=exp(-d0*k), w1=exp(-d1*k), w2=exp(-d2*k);
  float w3=exp(-d3*k), w4=exp(-d4*k), w5=exp(-d5*k);
  float total = w0+w1+w2+w3+w4+w5+0.001;

  vec3 c0 = hsl2rgb(uHue + HOFF0, 0.45, 0.85);
  vec3 c1 = hsl2rgb(uHue + HOFF1, 0.48, 0.83);
  vec3 c2 = hsl2rgb(uHue + HOFF2, 0.42, 0.82);
  vec3 c3 = hsl2rgb(uHue + HOFF3, 0.46, 0.85);
  vec3 c4 = hsl2rgb(uHue + HOFF4, 0.40, 0.84);
  vec3 c5 = hsl2rgb(uHue + HOFF5, 0.44, 0.86);
  return (c0*w0 + c1*w1 + c2*w2 + c3*w3 + c4*w4 + c5*w5) / total;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  /* Elevated camera */
  vec3 ro = vec3(0.0, 3.5, 5.0);
  vec3 target = vec3(0.0, 0.2, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * fwd);

  /* Raymarch */
  float t = 0.0;
  float d = 0.0;
  for (int i = 0; i < 56; i++) {
    d = map(ro + rd * t);
    if (d < 0.008 || t > 28.0) break;
    t += d;
  }

  /* Background */
  vec3 col = vec3(0.008, 0.01, 0.025);
  vec2 center = uv - vec2(0.0, -0.15);
  /* Projector ambient glow — tinted by hue */
  vec3 glowCol = hsl2rgb(uHue, 0.6, 0.3);
  col += glowCol * 0.12 * exp(-length(center) * 2.0);

  /* Stars */
  float stars = step(0.998, fract(sin(dot(floor(uv * 300.0), vec2(12.9898, 78.233))) * 43758.5453));
  col += vec3(0.25, 0.28, 0.4) * stars * 0.35;

  /* ── Outer glow halo — rendered BEFORE surface hit ── */
  /* Sample blob field along ray for volumetric glow (like CSS box-shadow) */
  {
    float gt = 0.0;
    for (int i = 0; i < 20; i++) {
      vec3 gp = ro + rd * gt;
      float gd = mapBlobs(gp);
      /* Accumulate glow based on proximity to blob surfaces */
      if (gd < 2.0 && gd > 0.01) {
        vec3 gCol = blobColor(gp);
        float gIntensity = exp(-gd * 1.8) * 0.018;
        /* Materialization fade */
        gIntensity *= smoothstep(-1.0, 0.2, gp.y);
        col += gCol * gIntensity;
      }
      gt += max(0.15, gd * 0.5);
      if (gt > 20.0) break;
    }
  }

  if (d < 0.008) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    float blobDist = mapBlobs(p);
    float ringDist = mapRing(p);
    bool isBlob = blobDist < ringDist + 0.005;

    if (isBlob) {
      /* ── Emissive glow model — self-luminous, no external lighting ── */
      vec3 baseCol = blobColor(p);
      vec3 highlight = blobHighlight(p);

      /* Edge darkening — gentle falloff at silhouette, like the 2D gradient */
      float edge = max(dot(-rd, n), 0.0);
      float edgeFade = 0.45 + 0.55 * pow(edge, 0.6);

      /* Core brightening — lighter toward center mass of nearest blob */
      float coreBright = pow(edge, 0.3) * 0.2;

      /* Full emissive color */
      col = baseCol * edgeFade + highlight * coreBright;

      /* Merge intensification — blobs glow hotter when combined */
      col += baseCol * uGlow * 0.4;

      /* Materialization fade near projector base */
      float baseFade = smoothstep(-1.0, 0.0, p.y);
      col *= baseFade;

    } else {
      /* Projector ring — keep subtle physical lighting here, it's hardware */
      vec3 l1 = normalize(vec3(1.0, 4.0, 2.5));
      float diff = max(dot(n, l1), 0.0);
      float rim = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);

      vec3 ringCol = hsl2rgb(uHue, 0.7, 0.45);
      vec3 ringDark = vec3(0.03, 0.04, 0.07);

      col = ringDark * (diff * 0.4 + 0.3)
          + ringCol * rim * 0.8;

      float angle = atan(p.z, p.x);
      float pulse = sin(angle * 3.0 - uTime * 2.5) * 0.5 + 0.5;
      col += ringCol * pulse * 0.12 * rim;
      col += ringCol * uGlow * 0.25;
    }

    /* Depth fog */
    float fog = 1.0 - smoothstep(4.0, 22.0, t);
    col *= fog;
  }

  /* Projector beam */
  float beamR = length(center.x);
  float beam = smoothstep(1.0, 0.0, beamR) * 0.018;
  float beamY = smoothstep(-0.5, 0.6, uv.y);
  beam *= (1.0 - beamY * 0.7);
  vec3 beamCol = hsl2rgb(uHue, 0.5, 0.3);
  col += beamCol * beam;

  /* Vignette */
  col *= 1.0 - length(uv) * 0.3;

  /* Bloom — stronger now to sell the glow */
  float brightness = dot(col, vec3(0.299, 0.587, 0.114));
  col += col * smoothstep(0.35, 0.9, brightness) * 0.25;

  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}`;

/* ─── Slider styles ─── */
const sliderTrack = {
  WebkitAppearance: "none",
  appearance: "none",
  width: "100%",
  height: "4px",
  borderRadius: "2px",
  outline: "none",
  cursor: "pointer",
  background: "rgba(255,255,255,0.1)"
};

export default function Hologoo() {
  const mountRef = useRef(null);
  const [audioOn, setAudioOn] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [hue, setHue] = useState(180); // 0-360, start at cyan
  const hueRef = useRef(180);
  const stateRef = useRef({
    audio: null,
    merges: new Set(),
    mouseActive: false,
    mouseWorld: { x: 0, y: 0 }
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const canvas = el.querySelector("canvas");
    if (canvas) return; // already initialized

    const W = () => el.clientWidth;
    const H = () => el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W(), H());
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;position:absolute;top:0;left:0";
    el.insertBefore(renderer.domElement, el.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(W() * dpr, H() * dpr) },
      uB0: { value: new THREE.Vector3() },
      uB1: { value: new THREE.Vector3() },
      uB2: { value: new THREE.Vector3() },
      uB3: { value: new THREE.Vector3() },
      uB4: { value: new THREE.Vector3() },
      uB5: { value: new THREE.Vector3() },
      uR0: { value: 0.65 }, uR1: { value: 0.55 }, uR2: { value: 0.58 },
      uR3: { value: 0.48 }, uR4: { value: 0.60 }, uR5: { value: 0.45 },
      uSmooth: { value: 0.9 },
      uGlow: { value: 0 },
      uHue: { value: 0.5 } // normalized 0-1
    };

    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    /* Blobs — constrained to hologram volume above ring */
    const blobs = Array.from({ length: 6 }, () => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        Math.random() * 1.8,
        (Math.random() - 0.5) * 2.5
      ),
      baseX: (Math.random() - 0.5) * 0.8,
      baseY: 0.3 + Math.random() * 0.8,
      baseZ: (Math.random() - 0.5) * 0.8,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
      speedX: 0.1 + Math.random() * 0.2,
      speedY: 0.08 + Math.random() * 0.15,
      speedZ: 0.09 + Math.random() * 0.18,
      ampX: 0.6 + Math.random() * 0.9,
      ampY: 0.3 + Math.random() * 0.5,
      ampZ: 0.6 + Math.random() * 0.9
    }));

    const st = stateRef.current;

    /* Input */
    const onMove = (cx, cy) => {
      const rect = el.getBoundingClientRect();
      const nx = (cx - rect.left) / rect.width * 2 - 1;
      const ny = -((cy - rect.top) / rect.height * 2 - 1);
      const aspect = rect.width / rect.height;
      st.mouseWorld.x = nx * aspect * 1.8;
      st.mouseWorld.y = ny * 1.5 + 0.5;
      st.mouseActive = true;
      setShowHint(false);
    };
    const onMouseMove = (e) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onLeave = () => { st.mouseActive = false; };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("touchend", onLeave);

    /* Audio */
    const initAudio = async () => {
      if (st.audio) return;
      try {
        await Tone.start();
        const reverb = new Tone.Freeverb({ roomSize: 0.9, dampening: 1000 });
        reverb.wet.value = 0.7;
        const delay = new Tone.PingPongDelay("8n", 0.5);
        delay.wet.value = 0.35;
        const filter = new Tone.Filter(2000, "lowpass");
        const lfo = new Tone.LFO(0.06, 200, 2600);
        lfo.connect(filter.frequency);
        lfo.start();

        const pad = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3, modulationIndex: 6,
          oscillator: { type: "sine" },
          envelope: { attack: 0.3, decay: 0.5, sustain: 0.6, release: 3 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 0.2, decay: 0.4, sustain: 0.7, release: 0.8 }
        });
        pad.chain(filter, delay, reverb, Tone.Destination);
        pad.volume.value = -16;

        const pluck = new Tone.PolySynth(Tone.MembraneSynth, {
          pitchDecay: 0.07, octaves: 3.5,
          oscillator: { type: "sine" },
          envelope: { attack: 0.003, decay: 0.7, sustain: 0.01, release: 3 }
        });
        pluck.chain(filter, reverb, Tone.Destination);
        pluck.volume.value = -6;

        pad.triggerAttack(["A2", "E3", "G3"], Tone.now(), 0.06);
        Tone.Transport.start();
        st.audio = { pad, pluck, filter, reverb, delay, lfo };
        setAudioOn(true);
      } catch (err) { console.error(err); }
    };
    const onInteract = () => initAudio();
    el.addEventListener("mousedown", onInteract);
    el.addEventListener("touchstart", onInteract);

    const triggerMerge = (depth) => {
      if (!st.audio) return;
      const i1 = Math.floor(Math.random() * NOTES.length);
      const i2 = Math.min(NOTES.length - 1, i1 + 1 + Math.floor(Math.random() * 3));
      try { st.audio.pluck.triggerAttackRelease([NOTES[i1], NOTES[i2]], "8n", "+0", Math.max(0.05, Math.min(0.45, depth * 0.8))); } catch (e) {}
    };
    const updateMergeAudio = (d) => {
      if (!st.audio) return;
      st.audio.reverb.wet.value = Math.min(0.95, 0.55 + d * 0.4);
      st.audio.delay.wet.value = Math.min(0.65, 0.25 + d * 0.35);
      st.audio.pad.set({ harmonicity: Math.min(6, 3 + d * 2) });
    };

    /* Animation */
    const clock = new THREE.Clock();
    const radii = [uniforms.uR0.value, uniforms.uR1.value, uniforms.uR2.value, uniforms.uR3.value, uniforms.uR4.value, uniforms.uR5.value];
    const uKeys = ["uB0","uB1","uB2","uB3","uB4","uB5"];
    let glow = 0;
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;
      uniforms.uHue.value = hueRef.current / 360;

      for (let i = 0; i < 6; i++) {
        const b = blobs[i];
        if (i === 0 && st.mouseActive) {
          b.pos.x += (st.mouseWorld.x - b.pos.x) * 0.06;
          b.pos.y += (Math.max(-0.5, st.mouseWorld.y) - b.pos.y) * 0.06;
          b.pos.z += (0 - b.pos.z) * 0.08;
        } else if (i === 0) {
          b.pos.x += (b.baseX + Math.sin(t * b.speedX + b.phaseX) * b.ampX - b.pos.x) * 0.015;
          b.pos.y += (b.baseY + Math.cos(t * b.speedY + b.phaseY) * b.ampY - b.pos.y) * 0.015;
          b.pos.z += (b.baseZ + Math.sin(t * b.speedZ + b.phaseZ) * b.ampZ - b.pos.z) * 0.015;
        } else {
          b.pos.x = b.baseX + Math.sin(t * b.speedX + b.phaseX) * b.ampX;
          b.pos.y = b.baseY + Math.cos(t * b.speedY + b.phaseY) * b.ampY;
          b.pos.z = b.baseZ + Math.sin(t * b.speedZ + b.phaseZ) * b.ampZ;
        }
        uniforms[uKeys[i]].value.copy(b.pos);
      }

      let mergeCount = 0, totalDepth = 0;
      for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
          const dist = blobs[i].pos.distanceTo(blobs[j].pos);
          const thresh = radii[i] + radii[j] + uniforms.uSmooth.value * 0.6;
          const key = `${i}-${j}`;
          if (dist < thresh) {
            const depth = 1 - dist / thresh;
            mergeCount++; totalDepth += depth;
            if (!st.merges.has(key)) { st.merges.add(key); triggerMerge(depth); }
          } else { st.merges.delete(key); }
        }
      }
      glow += (Math.min(1, mergeCount * 0.2) - glow) * 0.05;
      uniforms.uGlow.value = glow;
      updateMergeAudio(Math.min(1, totalDepth));
      uniforms.uSmooth.value = 0.9 + Math.sin(t * 0.2) * 0.15;

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      renderer.setSize(W(), H());
      uniforms.uResolution.value.set(W() * dpr, H() * dpr);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("touchend", onLeave);
      el.removeEventListener("mousedown", onInteract);
      el.removeEventListener("touchstart", onInteract);
      cancelAnimationFrame(animId);
      renderer.dispose(); mat.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      if (st.audio) {
        try {
          st.audio.pad.releaseAll(); st.audio.pad.dispose(); st.audio.pluck.dispose();
          st.audio.filter.dispose(); st.audio.reverb.dispose(); st.audio.delay.dispose(); st.audio.lfo.dispose();
        } catch (e) {}
      }
    };
  }, []);

  const handleHue = (e) => {
    const v = parseInt(e.target.value);
    setHue(v);
    hueRef.current = v;
  };

  /* Preview swatch color */
  const swatchColor = `hsl(${hue}, 80%, 55%)`;
  const dimColor = `hsla(${hue}, 70%, 50%, 0.3)`;

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%", height: "100vh", position: "relative",
        background: "#020308", cursor: "crosshair",
        overflow: "hidden", touchAction: "none"
      }}
    >
      {/* ── Console Control Panel ── */}
      <div style={{
        position: "absolute", bottom: "1.5rem", left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20, pointerEvents: "auto",
        background: "rgba(8,10,20,0.85)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "1rem 1.5rem",
        minWidth: "280px", maxWidth: "340px",
        boxShadow: `0 0 30px ${dimColor}, inset 0 1px 0 rgba(255,255,255,0.05)`
      }}>
        {/* Panel header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "0.75rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)"
        }}>
          <span style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "0.6rem", fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.2em", textTransform: "uppercase"
          }}>
            PARAMETERS
          </span>
          <span style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "0.6rem",
            color: audioOn ? `hsla(${hue}, 80%, 60%, 0.7)` : "rgba(255,255,255,0.2)",
            letterSpacing: "0.1em",
            transition: "color 0.3s"
          }}>
            {audioOn ? "◉ AUDIO" : "CLICK FOR AUDIO"}
          </span>
        </div>

        {/* Hue control */}
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: "0.5rem"
          }}>
            <label style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "0.65rem",
              color: "rgba(136,136,153,0.7)",
              letterSpacing: "0.15em", textTransform: "uppercase"
            }}>
              HUE SHIFT
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: "12px", height: "12px", borderRadius: "50%",
                background: swatchColor,
                boxShadow: `0 0 8px ${dimColor}`,
                transition: "all 0.15s"
              }} />
              <span style={{
                fontFamily: "'Courier New', monospace",
                fontSize: "0.75rem", color: "#fff",
                fontVariantNumeric: "tabular-nums",
                minWidth: "28px", textAlign: "right"
              }}>
                {hue}
              </span>
            </div>
          </div>

          <input
            type="range"
            min="0" max="360" step="1"
            value={hue}
            onChange={handleHue}
            style={{
              ...sliderTrack,
              background: `linear-gradient(to right,
                hsl(0,80%,55%), hsl(60,80%,55%), hsl(120,80%,55%),
                hsl(180,80%,55%), hsl(240,80%,55%), hsl(300,80%,55%), hsl(360,80%,55%))`
            }}
          />

          <div style={{
            display: "flex", justifyContent: "space-between",
            marginTop: "0.35rem"
          }}>
            <span style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "0.5rem", color: "rgba(136,136,153,0.4)"
            }}>0</span>
            <span style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "0.5rem", color: "rgba(136,136,153,0.4)"
            }}>360</span>
          </div>
        </div>
      </div>

      {/* ── Top HUD ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "1.2rem 1.5rem",
        display: "flex", justifyContent: "space-between",
        pointerEvents: "none", zIndex: 10
      }}>
        <div>
          <div style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "0.55rem",
            color: `hsla(${hue}, 60%, 60%, 0.3)`,
            letterSpacing: "0.25em", marginBottom: "0.2rem",
            transition: "color 0.3s"
          }}>
            RL80 TRADERS ARCADE
          </div>
          <h1 style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "clamp(0.85rem, 2vw, 1.3rem)",
            color: "rgba(255,255,255,0.8)",
            letterSpacing: "0.3em", fontWeight: 400,
            textShadow: `0 0 25px hsla(${hue}, 70%, 50%, 0.25)`,
            margin: 0, transition: "text-shadow 0.3s"
          }}>
            HOLOGRAM TABLE
          </h1>
        </div>
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: "0.5rem", color: "rgba(136,136,153,0.25)",
          textAlign: "right", letterSpacing: "0.12em"
        }}>
          SDF METABALLS<br/>SMOOTH UNION
        </div>
      </div>

      {/* Gateway label */}
      <div style={{
        position: "absolute", bottom: "7.5rem", left: 0, right: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 10
      }}>
        <div style={{
          display: "inline-block",
          fontFamily: "'Courier New', monospace",
          fontSize: "0.5rem",
          color: `hsla(${hue}, 50%, 55%, 0.15)`,
          letterSpacing: "0.35em",
          borderTop: `1px solid hsla(${hue}, 50%, 55%, 0.06)`,
          borderBottom: `1px solid hsla(${hue}, 50%, 55%, 0.06)`,
          padding: "0.3rem 1.5rem",
          transition: "all 0.3s"
        }}>
          HAIL MARY PROSPECTING CO.
        </div>
      </div>

      {showHint && (
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          textAlign: "center", pointerEvents: "none", zIndex: 10,
          fontFamily: "'Courier New', monospace",
          fontSize: "0.65rem", color: "rgba(255,255,255,0.15)",
          letterSpacing: "0.15em",
          animation: "hintPulse 3s ease-in-out infinite",
          transform: "translateY(-50%)"
        }}>
          MOVE TO MERGE ── COLLISIONS TRIGGER REVERB
        </div>
      )}

      <style>{`
        @keyframes hintPulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.55; }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 8px rgba(255,255,255,0.4);
          cursor: pointer;
          border: none;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 8px rgba(255,255,255,0.4);
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}