"use client";
// The scene's OWN sky as the reflection map (2026-09-04). Chrome used to
// reflect drei's Venice-sunset HDR by day (canal, buildings, trees) and an
// indoor warehouse by night — nothing a mesa has ever seen. This builds a
// small equirectangular HDR texture from the live sky palette: zenith →
// horizon gradient above, the mesa's ground tone below, a hot sun disc placed
// by the time of day (a cool moon at night, a red horizon glow in hell). It
// re-renders only when the palette or the hour changes, and the renderer's
// PMREM path picks it up like any equirect map. Half-float so the sun can be
// brighter than white — that is what puts the highlight on the chrome.
import { useMemo } from "react";
import * as THREE from "three";

const W = 256, H = 128;
const cache = new Map();

const lin = (hex, fallback) => { const c = new THREE.Color(hex || fallback); return c.convertSRGBToLinear(); };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function buildSkyEnv({ sky = "#54aee8", skyBottom = "#c9e7f7", ground = "#d8c9a8", sunHour = 12, preset = "day" }) {
  const zen = lin(sky), hor = lin(skyBottom, sky), gnd = lin(ground, "#d8c9a8");
  const isHell = preset === "hell";
  // Chrome reflects this map's colour EXACTLY (white base, metalness 1), so a
  // tinted palette — dusk's pink horizon — turned the whole rig pink. Pull the
  // sky and ground toward their own luminance: the map keeps its light/dark
  // structure (that is what sells metal) but only a hint of the hue.
  const neutral = (c, k) => { const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722; c.r += (l - c.r) * k; c.g += (l - c.g) * k; c.b += (l - c.b) * k; return c; };
  if (!isHell) { neutral(zen, 0.45); neutral(hor, 0.6); neutral(gnd, 0.35); }
  // Mirror, not satin: what reads as chrome is CONTRAST — a bright horizon line
  // over a dark ground, a zenith darker than the horizon, and a hot sun. The
  // ground drops to ~45% and the sky's horizon band is lifted.
  const MIRROR = { ground: 0.01, horizonLift: 1.25, zenith: 0.85 };
  if (!isHell) { gnd.multiplyScalar(MIRROR.ground); hor.multiplyScalar(MIRROR.horizonLift); zen.multiplyScalar(MIRROR.zenith); }
  const isNight = preset === "night" || (!isHell && sunHour != null && (sunHour < 5.5 || sunHour > 19.5));
  // Night: the hemisphere ground colour is far darker than the violet mesa the
  // player actually sees, and a black map turns chrome matte. Lift the ground
  // toward the horizon violet and give the sky a faint glow band so the metal
  // still reads as metal under the Lyquid80 sky.
  if (isNight) { gnd.lerp(hor, 0.6).multiplyScalar(2.0); hor.multiplyScalar(1.35); }
  // Sun: rises east (azimuth +90°) at 6, peaks at noon, sets west at 18.
  const h = sunHour == null ? 12 : sunHour;
  const sunEl = Math.sin(((h - 6) / 12) * Math.PI) * (65 * Math.PI / 180);
  const sunAz = ((h - 12) / 12) * Math.PI;                 // 0 = south (toward +Z in equirect terms)
  const body = isHell ? null : isNight
    ? { el: 48 * Math.PI / 180, az: -0.8, r: 2.2 * Math.PI / 180, glow: 14 * Math.PI / 180, color: lin("#e8d0ff"), core: 4.0, halo: 0.45 }
    : { el: Math.max(sunEl, -2 * Math.PI / 180), az: sunAz, r: 1.7 * Math.PI / 180, glow: 9 * Math.PI / 180, color: lin(h < 8 || h > 16.5 ? "#ffc088" : "#fff6dc"), core: 14, halo: 1.1 };
  const bx = body ? Math.cos(body.el) * Math.sin(body.az) : 0, by = body ? Math.sin(body.el) : 0, bz = body ? Math.cos(body.el) * Math.cos(body.az) : 0;

  const data = new Uint16Array(W * H * 4);
  const px = new THREE.Color();
  for (let y = 0; y < H; y++) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI;             // +π/2 top row → −π/2 bottom
    const s = Math.sin(el), c = Math.cos(el);
    for (let x = 0; x < W; x++) {
      const az = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
      if (el >= 0) {
        // sky: horizon colour at 0°, zenith at 90°; a quick ease keeps a bright band on the horizon line
        const t = Math.pow(clamp01(s), 0.5);
        px.copy(hor).lerp(zen, t);
        if (isHell) { const g = Math.exp(-Math.pow(el / (9 * Math.PI / 180), 2)); px.r += 1.2 * g; px.g += 0.25 * g; }
      } else {
        // ground: the mesa tone, darkening toward the nadir; a thin haze at the horizon
        const d = clamp01(-el / (Math.PI / 2));
        px.copy(gnd).multiplyScalar(1.0 - 0.6 * Math.pow(d, 0.7));
        // a crisp horizon: only a hair of haze, so the ground edge stays a line in the reflection
        const haze = Math.exp(-Math.pow(el / (1.2 * Math.PI / 180), 2)) * 0.5;
        px.lerp(hor, haze);
      }
      if (body) {
        const dx = c * Math.sin(az), dy = s, dz = c * Math.cos(az);
        const cosAng = clamp01(dx * bx + dy * by + dz * bz);
        const ang = Math.acos(cosAng);
        const core = Math.exp(-Math.pow(ang / body.r, 2)) * body.core;
        const halo = Math.exp(-Math.pow(ang / body.glow, 1.5)) * body.halo;
        px.r += body.color.r * (core + halo); px.g += body.color.g * (core + halo); px.b += body.color.b * (core + halo);
      }
      const i = (y * W + x) * 4;
      data[i] = THREE.DataUtils.toHalfFloat(px.r);
      data[i + 1] = THREE.DataUtils.toHalfFloat(px.g);
      data[i + 2] = THREE.DataUtils.toHalfFloat(px.b);
      data[i + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// `skyEnv` = { sky, skyBottom, ground, sunHour, preset }. Returns a cached
// texture per palette+hour (hour rounded to a quarter), never throws.
export default function useSkyEnvMap(skyEnv) {
  const key = skyEnv
    ? `${skyEnv.preset}|${skyEnv.sky}|${skyEnv.skyBottom}|${skyEnv.ground}|${skyEnv.sunHour == null ? "-" : Math.round(skyEnv.sunHour * 4) / 4}`
    : null;
  return useMemo(() => {
    if (!key) return null;
    let t = cache.get(key);
    if (!t) { try { t = buildSkyEnv({ ...skyEnv, sunHour: skyEnv.sunHour == null ? null : Math.round(skyEnv.sunHour * 4) / 4 }); cache.set(key, t); } catch (e) { console.warn("useSkyEnvMap failed", e); return null; } }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
