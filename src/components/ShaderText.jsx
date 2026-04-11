"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  Mesh,
  ShaderMaterial,
  CanvasTexture,
  Vector2,
  Vector4,
  LinearFilter,
} from "three";

// ── Wave field config ─────────────────────────────────
const BASE_WAVES = [
  { amp: 1.0, fx: 2.4, fy: 0.9, ts: 1.15, phase: 0 },
  { amp: 0.82, fx: -1.3, fy: 2.6, ts: -0.87, phase: Math.PI / 2 },
  { amp: 0.65, fx: 1.7, fy: -2.0, ts: 1.41, phase: Math.PI },
  { amp: 0.7, fx: -2.8, fy: -1.2, ts: -0.66, phase: 0.8 },
  { amp: 0.5, fx: 0.9, fy: 3.1, ts: 1.05, phase: 2.3 },
  { amp: 0.38, fx: 3.2, fy: 0.7, ts: -1.23, phase: 4.7 },
  { amp: 0.3, fx: -1.0, fy: -2.4, ts: 1.56, phase: 5.5 },
  { amp: 0.28, fx: 2.1, fy: 1.7, ts: 0.54, phase: 1.1 },
];

const TURB_WAVES = [
  { amp: 0.35, fx: 5.6, fy: 4.4, ts: 1.1, hFold: 0.8 },
  { amp: 0.18, fx: 8.3, fy: -7.0, ts: -0.9, hFold: 1.3 },
  { amp: 0.1, fx: 12.0, fy: 9.5, ts: 1.6, hFold: 1.8 },
];

// ── GLSL helpers ──────────────────────────────────────
const f4 = (n) => n.toFixed(4);
function baseWaveGLSL(w) {
  const phase = w.phase !== 0 ? ` + ${f4(w.phase)}` : "";
  return `        h += ${f4(w.amp)} * sin(${f4(w.fx)}*p.x + ${f4(w.fy)}*p.y + t*${f4(w.ts)}${phase});`;
}
function turbWaveGLSL(w) {
  return `          h += uTurb * ${f4(w.amp)} * sin(${f4(w.fx)}*p.x + ${f4(w.fy)}*p.y + t*${f4(w.ts)} + h*${f4(w.hFold)});`;
}

// ── Fragment shader ───────────────────────────────────
const fragmentShader = `
  precision highp float;

  uniform float     uTime;
  uniform vec2      uRes;
  uniform vec2      uMouse;
  uniform float     uDensity;
  uniform float     uSpeed;
  uniform float     uTurb;
  uniform sampler2D uMask;
  uniform vec4      uR0, uR1, uR2, uR3;
  uniform vec3      uColorBg;
  uniform vec3      uColorFill;
  uniform vec3      uColorOutline;
  uniform float     uOutlineWidth;

  const float MASK_EDGE_LO = 0.38;
  const float MASK_EDGE_HI = 0.62;
  const float RIPPLE_DECAY_RATE   = 1.1;
  const float RIPPLE_RING_FREQ    = 7.0;
  const float RIPPLE_RING_SPEED   = 9.0;
  const float RIPPLE_DIST_FALLOFF = 2.2;
  const float RIPPLE_AMPLITUDE    = 1.8;
  const float SWELL_DIST_FALLOFF = 2.5;
  const float SWELL_FREQUENCY    = 9.0;
  const float SWELL_SPEED_MUL    = 5.0;
  const float SWELL_AMPLITUDE    = 1.2;
  const float CONTOUR_LINE_WIDTH   = 0.22;
  const float CONTOUR_AA_BASE      = 0.015;
  const float CONTOUR_AA_DENSITY   = 0.005;
  const float CONTOUR_WAVE_SCALE   = 0.5;

  float tri(float x) {
    return abs(fract(x + 0.5) - 0.5) * 2.0;
  }

  float ripple(vec4 r, vec2 uv, float t) {
    if (r.z < 0.0) return 0.0;
    float age       = t - r.z;
    float decay     = exp(-age * RIPPLE_DECAY_RATE);
    float ar        = uRes.x / uRes.y;
    vec2  delta     = (uv - r.xy) * vec2(ar, 1.0);
    float dist      = length(delta);
    float ringPhase = dist * RIPPLE_RING_FREQ - age * uSpeed * RIPPLE_RING_SPEED;
    return decay * sin(ringPhase) * exp(-dist * RIPPLE_DIST_FALLOFF) * RIPPLE_AMPLITUDE;
  }

  void main() {
    vec2  uv = gl_FragCoord.xy / uRes;
    float ar = uRes.x / uRes.y;
    vec2  p  = vec2(uv.x * ar, uv.y);
    float t  = uTime * uSpeed;

    float insideMask = texture2D(uMask, uv).r;
    float mask       = smoothstep(MASK_EDGE_LO, MASK_EDGE_HI, insideMask);

    // Dilate mask by sampling neighbors to detect outline region
    vec2 texel = uOutlineWidth / uRes;
    float dilated = insideMask;
    dilated = max(dilated, texture2D(uMask, uv + vec2( texel.x, 0.0)).r);
    dilated = max(dilated, texture2D(uMask, uv + vec2(-texel.x, 0.0)).r);
    dilated = max(dilated, texture2D(uMask, uv + vec2(0.0,  texel.y)).r);
    dilated = max(dilated, texture2D(uMask, uv + vec2(0.0, -texel.y)).r);
    dilated = max(dilated, texture2D(uMask, uv + vec2( texel.x,  texel.y)).r);
    dilated = max(dilated, texture2D(uMask, uv + vec2(-texel.x,  texel.y)).r);
    dilated = max(dilated, texture2D(uMask, uv + vec2( texel.x, -texel.y)).r);
    dilated = max(dilated, texture2D(uMask, uv + vec2(-texel.x, -texel.y)).r);
    float outerMask = smoothstep(MASK_EDGE_LO, MASK_EDGE_HI, dilated);

    if (outerMask < 0.001) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    float h = 0.0;
${BASE_WAVES.map(baseWaveGLSL).join("\n")}

    if (uTurb > 0.0) {
${TURB_WAVES.map(turbWaveGLSL).join("\n")}
    }

    vec2  swellDelta = (uv - uMouse) * vec2(ar, 1.0);
    float swellDist  = length(swellDelta);
    h += SWELL_AMPLITUDE
       * exp(-swellDist * SWELL_DIST_FALLOFF)
       * sin(swellDist * SWELL_FREQUENCY - t * SWELL_SPEED_MUL);

    h += ripple(uR0, uv, uTime);
    h += ripple(uR1, uv, uTime);
    h += ripple(uR2, uv, uTime);
    h += ripple(uR3, uv, uTime);

    float bands     = tri(h * uDensity * CONTOUR_WAVE_SCALE);
    float aaRadius  = CONTOUR_AA_BASE + CONTOUR_AA_DENSITY * uDensity;
    float isOnLine  = 1.0 - smoothstep(CONTOUR_LINE_WIDTH - aaRadius,
                                       CONTOUR_LINE_WIDTH + aaRadius, bands);
    vec3  fluidColor = mix(uColorFill, uColorBg, isOnLine);

    // Outline: where dilated mask is present but inner mask is not
    float outlineAlpha = outerMask * (1.0 - mask);
    // Composite: outline behind, fluid fill on top
    vec3 color = mix(uColorOutline, fluidColor, mask);
    float alpha = max(outlineAlpha, mask);
    gl_FragColor = vec4(color, alpha);
  }
`;

// Parse hex color to [r,g,b] floats 0-1
function hexToRGB(hex) {
  const c = hex.replace("#", "");
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

export default function ShaderText({
  text = "HAIL MARY",
  font = "'Blackletter Outline', serif",
  fontWeight = 900,
  width,
  height,
  colorBg = "#d4a854",
  colorFill = "#2e2010",
  colorOutline = "#000000",
  outlineWidth = 2.5,
  density = 12.0,
  speed = 0.02,
  turbulence = 0.45,
  style,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  const buildMask = useCallback((renderer, maskCanvas, maskCtx, maskTex, W, H, str, fontStr) => {
    maskCanvas.width = W;
    maskCanvas.height = H;
    maskCtx.fillStyle = "#000";
    maskCtx.fillRect(0, 0, W, H);

    // Split on explicit newlines — caller controls line breaks via "\n" or an array.
    const lines = (Array.isArray(str) ? str : String(str).split("\n"))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length === 0) return maskTex.current;

    // Probe to measure ink bounds
    const probeSize = 300;
    const probeW = 2000;
    const probeH = 800;
    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = probeW;
    probeCanvas.height = probeH;
    const pc = probeCanvas.getContext("2d");
    pc.fillStyle = "#000";
    pc.fillRect(0, 0, probeW, probeH);
    pc.font = `${fontStr.replace(/\d+px/, `${probeSize}px`)}`;
    pc.textAlign = "center";
    pc.textBaseline = "middle";

    // Widest line drives the width fit. measureText is independent of canvas
    // bounds, so very long text is handled correctly.
    let widestInk = 0;
    for (const line of lines) {
      const w = pc.measureText(line).width;
      if (w > widestInk) widestInk = w;
    }
    widestInk = Math.max(1, widestInk);

    // Draw the widest line once to probe vertical ink bounds (ascender/descender).
    pc.fillStyle = "#fff";
    pc.fillText(lines.reduce((a, b) => (a.length >= b.length ? a : b)), probeW / 2, probeH / 2);

    const pd = pc.getImageData(0, 0, probeW, probeH).data;
    let minY = probeH, maxY = 0;
    for (let y = 0; y < probeH; y++) {
      for (let x = 0; x < probeW; x++) {
        if (pd[(y * probeW + x) * 4] > 64) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          break;
        }
      }
    }
    const probeInkH = Math.max(1, maxY - minY);

    // Font size such that the widest line fills 92% of W.
    const widthFitSize = probeSize * (W / widestInk) * 0.92;

    // Font size such that all lines stacked fill 95% of H.
    // lineHeight factor is derived from the ink-height ratio at probe size
    // so descenders/ascenders are respected, with a 15% gap between lines.
    const inkToFontRatio = probeInkH / probeSize; // e.g. ~0.72 for most fonts
    const lineHeightFactor = inkToFontRatio * 1.15;
    const heightFitSize = (H * 0.95) / (lines.length * lineHeightFactor);

    const finalFontSize = Math.min(widthFitSize, heightFitSize);
    const lineStep = finalFontSize * lineHeightFactor;

    maskCtx.fillStyle = "#fff";
    maskCtx.font = fontStr.replace(/\d+px/, `${finalFontSize}px`);
    maskCtx.textAlign = "center";
    maskCtx.textBaseline = "middle";

    // Baseline offset so a single line is ink-centred (compensates for any
    // imbalance between the font's ascender and descender heights).
    const probeInkCentreY = (minY + maxY) / 2;
    const probeCanvaCentreY = probeH / 2;
    const inkCentreOffset = (probeInkCentreY - probeCanvaCentreY) * (finalFontSize / probeSize);

    const totalHeight = lineStep * (lines.length - 1);
    const startY = H / 2 - totalHeight / 2 - inkCentreOffset;
    for (let i = 0; i < lines.length; i++) {
      maskCtx.fillText(lines[i], W / 2, startY + i * lineStep);
    }

    if (maskTex.current) {
      maskTex.current.image = maskCanvas;
      maskTex.current.needsUpdate = true;
    } else {
      maskTex.current = new CanvasTexture(maskCanvas);
      maskTex.current.minFilter = LinearFilter;
      maskTex.current.magFilter = LinearFilter;
    }
    return maskTex.current;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.offsetWidth;
    const H = container.offsetHeight;
    if (W === 0 || H === 0) return;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    const pr = Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H);
    renderer.domElement.style.display = "block";
    canvasRef.current = renderer.domElement;
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d");
    const maskTexRef = { current: null };
    const fontStr = `${fontWeight} 300px ${font}`;

    const upper = Array.isArray(text)
      ? text.map((s) => String(s).toUpperCase())
      : String(text).toUpperCase();
    const tex = buildMask(renderer, maskCanvas, maskCtx, maskTexRef, W, H, upper, fontStr);

    const bgRGB = hexToRGB(colorBg);
    const fillRGB = hexToRGB(colorFill);
    const outlineRGB = hexToRGB(colorOutline);

    const uniforms = {
      uTime: { value: 0.0 },
      uRes: { value: new Vector2(W * pr, H * pr) },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uDensity: { value: density },
      uSpeed: { value: speed },
      uTurb: { value: turbulence },
      uMask: { value: tex },
      uR0: { value: new Vector4(0, 0, -1, 0) },
      uR1: { value: new Vector4(0, 0, -1, 0) },
      uR2: { value: new Vector4(0, 0, -1, 0) },
      uR3: { value: new Vector4(0, 0, -1, 0) },
      uColorBg: { value: bgRGB },
      uColorFill: { value: fillRGB },
      uColorOutline: { value: outlineRGB },
      uOutlineWidth: { value: outlineWidth },
    };

    const material = new ShaderMaterial({
      uniforms,
      vertexShader: `void main(){ gl_Position = vec4(position, 1.0); }`,
      fragmentShader,
      transparent: true,
    });
    scene.add(new Mesh(new PlaneGeometry(2, 2), material));

    // Mouse tracking relative to canvas
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      uniforms.uMouse.value.set(x, y);
    };

    // Click ripples
    let rippleIndex = 0;
    const rippleSlots = [uniforms.uR0, uniforms.uR1, uniforms.uR2, uniforms.uR3];
    const onClick = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      rippleSlots[rippleIndex % 4].value.set(x, y, uniforms.uTime.value, 1);
      rippleIndex++;
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("click", onClick);

    let elapsed = 0;
    let lastTimestamp = null;
    let animId;

    const loop = (timestamp) => {
      animId = requestAnimationFrame(loop);
      const dt = lastTimestamp === null ? 0 : Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;
      elapsed += dt;
      uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(loop);

    stateRef.current = { renderer, uniforms, animId, onMouseMove, onClick };

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("click", onClick);
      renderer.dispose();
      material.dispose();
      if (maskTexRef.current) maskTexRef.current.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [text, font, fontWeight, colorBg, colorFill, colorOutline, outlineWidth, density, speed, turbulence, buildMask]);

  return (
    <div
      ref={containerRef}
      style={{
        width: width || "100%",
        height: height || 80,
        position: "relative",
        cursor: "pointer",
        ...style,
      }}
    />
  );
}
