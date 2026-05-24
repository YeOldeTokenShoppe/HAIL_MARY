"use client";

import { useEffect, useRef } from "react";

// Ambient simplex-noise WebGL2 background. Adapted from the codepen at
// https://codepen.io/Dillo/pen/PwGVwqy — stripped of mouse interaction,
// fixed to a single warm-gold palette so it reads as slow film texture.
// Renders behind everything (position:fixed, z-index:-1, pointer-events:none).
//
// Props:
//   color    — [r,g,b] in 0..1 (default warm gold #d4a854)
//   scale    — noise frequency (default 4 — bigger = finer pattern)
//   speed    — time multiplier (default 0.00025 — very slow drift)
//   opacity  — CSS opacity on the canvas (default 0.12)
//   pattern  — 0 = plain, 1 = wave (default), 2 = square wave
// Fixed palette length the shader iterates over (uniform arrays need a
// compile-time size). Eight stops is enough for a smooth iridescent ramp
// without bloating the uniform budget.
const PALETTE_SIZE = 8;

export default function NoiseBackground({
  color = [0.831, 0.659, 0.329], // #d4a854 gold (used when no palette)
  bgColor = [0.961, 0.937, 0.902], // #f5efe6 cream (theme.bg light)
  // Optional rainbow/iridescent palette — array of up to 8 [r,g,b] stops.
  // When provided, the noise's "light" value indexes through these instead
  // of using `color` for the whole surface, producing oil-slick iridescence.
  palette = null,
  scale = 4.0,
  speed = 0.000025,
  mix = 0.18, // how strongly noise blends over bg (0..1)
  pattern = 1,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: true });
    if (!gl) {
      console.warn("NoiseBackground: WebGL2 not available — skipping");
      return;
    }
    console.log("NoiseBackground GL:",
      gl.getParameter(gl.VERSION),
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      gl.getParameter(gl.RENDERER));

    // Sanity-check the pipeline with a trivial shader. If even this fails,
    // the issue is GL setup (context loss, dev-overlay interference) — not
    // our snoise code.
    {
      const trivial = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(trivial, "#version 300 es\nprecision mediump float;\nout vec4 c;\nvoid main(){c=vec4(1.0);}");
      gl.compileShader(trivial);
      console.log("NoiseBackground trivial shader compiled:",
        gl.getShaderParameter(trivial, gl.COMPILE_STATUS),
        "log:", JSON.stringify(gl.getShaderInfoLog(trivial)));
      gl.deleteShader(trivial);
    }

    const vertexSource = `#version 300 es
precision mediump float;
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

    const fragmentSource = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
#define PI 3.14159265358979323846
uniform float width;
uniform float height;
uniform float time;
uniform float scale;
uniform int pattern;
uniform vec3 hue;
uniform vec3 bgColor;
uniform float mixAmount;
uniform vec3 palette[8];
uniform bool usePalette;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  vec2 resolution = vec2(width, height);
  vec2 uv = ((gl_FragCoord.xy - resolution/2.0) / min(resolution.x, resolution.y));
  float n = (snoise(vec3(uv * scale, time)) + 1.0) / 2.0; // 0..1
  float light = n;
  if (pattern == 1) {
    light = (1.0 - cos(n * 15.0 * 2.0 * PI)) * 0.5;
  } else if (pattern == 2) {
    if (fract(n * 15.0) < 0.3) light = 1.0; else light = 0.0;
  }
  // Pick the foreground color: either the single hue, or a gradient
  // sampled through the palette array (for oil-slick iridescence).
  vec3 fg;
  if (usePalette) {
    float t = clamp(light, 0.0, 0.9999) * float(8 - 1);
    int idx = int(floor(t));
    float frac = fract(t);
    fg = mix(palette[idx], palette[idx + 1], frac);
  } else {
    fg = hue;
  }
  // Premix tint onto the page bg so we render fully opaque.
  vec3 outCol = mix(bgColor, fg, light * mixAmount);
  fragColor = vec4(outCol, 1.0);
}`;

    const compile = (src, type) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
        const log = gl.getShaderInfoLog(sh) || "(no info log)";
        console.error(`NoiseBackground ${kind} shader compile failed:\n${log}\n--- source ---\n${src}`);
        return null;
      }
      return sh;
    };

    const vs = compile(vertexSource, gl.VERTEX_SHADER);
    const fs = compile(fragmentSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("NoiseBackground link:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uWidth = gl.getUniformLocation(program, "width");
    const uHeight = gl.getUniformLocation(program, "height");
    const uTime = gl.getUniformLocation(program, "time");
    const uScale = gl.getUniformLocation(program, "scale");
    const uPattern = gl.getUniformLocation(program, "pattern");
    const uHue = gl.getUniformLocation(program, "hue");
    const uBg = gl.getUniformLocation(program, "bgColor");
    const uMix = gl.getUniformLocation(program, "mixAmount");
    const uUsePalette = gl.getUniformLocation(program, "usePalette");
    // Each palette[i] needs its own location for uniform3fv to work.
    const uPalette = Array.from({ length: PALETTE_SIZE }, (_, i) =>
      gl.getUniformLocation(program, `palette[${i}]`)
    );

    gl.uniform1f(uScale, scale);
    gl.uniform1i(uPattern, pattern);
    gl.uniform3fv(uHue, color);
    gl.uniform3fv(uBg, bgColor);
    gl.uniform1f(uMix, mix);

    // Wire palette: if user supplied one, fill the 8-stop array; else flag off.
    const palOn = Array.isArray(palette) && palette.length > 0;
    gl.uniform1i(uUsePalette, palOn ? 1 : 0);
    if (palOn) {
      // Resample whatever the user gave us into exactly PALETTE_SIZE stops.
      for (let i = 0; i < PALETTE_SIZE; i++) {
        const t = (PALETTE_SIZE === 1) ? 0 : i / (PALETTE_SIZE - 1);
        const srcIdx = t * (palette.length - 1);
        const lo = Math.floor(srcIdx);
        const hi = Math.min(palette.length - 1, lo + 1);
        const f = srcIdx - lo;
        const c = [
          palette[lo][0] * (1 - f) + palette[hi][0] * f,
          palette[lo][1] * (1 - f) + palette[hi][1] * f,
          palette[lo][2] * (1 - f) + palette[hi][2] * f,
        ];
        gl.uniform3fv(uPalette[i], c);
      }
    }

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5); // cap DPR for perf
    const resize = () => {
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uWidth, w);
      gl.uniform1f(uHeight, h);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let runTime = 0;
    let prevT = performance.now();
    const draw = () => {
      const now = performance.now();
      const dt = Math.min(now - prevT, 100);
      prevT = now;
      runTime += dt * speed;
      gl.uniform1f(uTime, runTime);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      // NOTE: do not call loseContext() here. React strict mode reuses the
      // canvas DOM node between the dev double-mount, and losing the context
      // breaks the second mount (getContext returns null forever after).
      // True unmount removes the canvas entirely, taking the context with it.
      try {
        gl.deleteBuffer(buf);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      } catch {}
    };
  }, [color, bgColor, palette, scale, speed, mix, pattern]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1,
        pointerEvents: "none",
        display: "block",
      }}
      aria-hidden="true"
    />
  );
}
