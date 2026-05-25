"use client";

import React, { useEffect, useRef, useId } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

gsap.registerPlugin(MorphSVGPlugin);

const PATHS = {
  one: "M169.6,70.26S344,17.6,409.52,157.16c33.76,71.93-52.57,172.55,49.12,211.58,116.78,44.82,90,237.44-2.86,231.88s-87.36-115-215.93-42-223,2.19-133.4-144C124.82,384.69,91,342.15,79,296.1,60.2,223.67,58.5,110.87,169.6,70.26Z",
  two: "M308.46,95S447.72,125.77,357,224.74c-69.92,76.3,145.21,38.9,106,154.11-41.79,122.81,70.21,198-22,231.58C343.34,646,358.3,485.61,216.83,571c-81.51,49.17-155.91-18.61-77-86.9S234.7,402.34,163.33,292C118.33,222.36,213.34,79.94,308.46,95Z",
  three: "M345,168.26c74.38-5.66,139,20.88,74.28,92.49S539.36,286.64,496,372.21s52,123.45-15.92,167.48S335,417.83,235.71,511.14s-160.19-13.47-103.1-62.85,68.47-57.74,17-138.93S270.66,173.93,345,168.26Z",
  four: "M329.44,95S434.63,103,378,224.74c-35.16,75.55,91.41,85.56,52.21,200.78C388.43,548.32,508.33,544.05,462,610.43,402.51,695.68,354.5,563.36,237.81,571c-53,3.45-118.36-53.63-77-86.9,81.34-65.4,32.36-81.94-39-192.32C76.82,222.13,142.33,81.12,329.44,95Z",
  five: "M175,136.38C244,96.91,358.05,125.34,399,195s-10.5,97.85,36.73,193-11.28,143.08-72.6,116.3c-48.94-21.38-109.4-14-183.25,1.41s-98-49.79-74-102.2,71-58.64,40.76-110.37S105.88,175.85,175,136.38Z",
};

const NOISE_VERT = `#version 300 es
precision mediump float;
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const NOISE_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
#define PI 3.14159265358979323846
uniform float width;
uniform float height;
uniform float time;
uniform float scale;
uniform vec3 palette[8];

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
  float n = (snoise(vec3(uv * scale, time)) + 1.0) / 2.0;
  float light = (1.0 - cos(n * 15.0 * 2.0 * PI)) * 0.5;
  float t = clamp(light, 0.0, 0.9999) * 7.0;
  int idx = int(floor(t));
  float frac = fract(t);
  vec3 fg = mix(palette[idx], palette[idx + 1], frac);
  fragColor = vec4(fg, 1.0);
}`;

const PALETTE = [
  [0.165, 0.043, 0.176],  // deep purple  #2a0b2d
  [0.851, 0.176, 0.690],  // magenta      #d92db0
  [0.831, 0.686, 0.216],  // gold         #d4af37
  [0.165, 0.839, 0.933],  // cyan         #2ad6ee
  [0.831, 0.686, 0.216],  // gold
  [0.851, 0.176, 0.690],  // magenta
  [0.165, 0.043, 0.176],  // deep purple
  [0.165, 0.839, 0.933],  // cyan
];

export default function MorphingGoop({ className }) {
  const uid = useId();
  const clipId = `goop-clip-${uid.replace(/:/g, "")}`;
  const strokePathRef = useRef(null);
  const clipPathRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const stroke = strokePathRef.current;
    const clip = clipPathRef.current;
    if (!stroke || !clip) return;

    const morphTargets = [PATHS.two, PATHS.three, PATHS.four, PATHS.three, PATHS.five, PATHS.one];
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    morphTargets.forEach((target) => {
      tl.to(stroke, { duration: 3.5, morphSVG: target, ease: "none" }, tl.duration());
      tl.to(clip, { duration: 3.5, morphSVG: target, ease: "none" }, tl.duration() - 3.5);
    });

    return () => tl.kill();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: true });
    if (!gl) return;

    const compile = (src, type) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
      return sh;
    };

    const vs = compile(NOISE_VERT, gl.VERTEX_SHADER);
    const fs = compile(NOISE_FRAG, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
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

    gl.uniform1f(uScale, 4.0);

    for (let i = 0; i < 8; i++) {
      const loc = gl.getUniformLocation(program, `palette[${i}]`);
      gl.uniform3fv(loc, PALETTE[i]);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
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
    const speed = 0.00018;
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
      try {
        gl.deleteBuffer(buf);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      } catch {}
    };
  }, []);

  return (
    <div className={className} ref={containerRef} style={{ position: "relative" }}>
      {/* Hidden SVG defining the clipPath */}
      <svg
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox"
            transform="scale(0.001634, 0.001424)"
          >
            <path ref={clipPathRef} d={PATHS.one} />
          </clipPath>
        </defs>
      </svg>

      {/* Noise canvas clipped to the blob shape */}
      <div
        style={{
          width: "100%",
          aspectRatio: "612 / 702.19",
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
          aria-hidden="true"
        />
      </div>

      {/* Visible stroke outline + glow on top */}
      <svg
        className="goop-svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 612 702.19"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <linearGradient id={`${clipId}-grad`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2ad6ee" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#d92db0" />
          </linearGradient>
          <filter id={`${clipId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          ref={strokePathRef}
          d={PATHS.one}
          fill="none"
          stroke={`url(#${clipId}-grad)`}
          strokeWidth="2"
          filter={`url(#${clipId}-glow)`}
        />
      </svg>
    </div>
  );
}
