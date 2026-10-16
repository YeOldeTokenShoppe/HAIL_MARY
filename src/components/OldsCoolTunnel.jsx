'use client'

import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLanguage } from './LanguageProvider'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { gltfEmissiveAnimation } from '@/lib/gltfEmissiveAnimation.mjs'
import { ShelfTrack } from '@/lib/shelfTrack.mjs'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GEYSER_VERTEX_SHADER, GEYSER_FRAGMENT_SHADER, geyserUniforms } from '@/lib/gusherShader'
import { createLowRider, LOW_RIDER_MODEL_URL } from '@/lib/palmTreeDriveCar.mjs'
import { createCandyEmeraldPaint } from '@/lib/palmTreeDrivePaint.mjs'
import { loadHubCoaster } from '@/lib/hubCoaster.mjs'

// How far below the camera path the road surface sits (world units). The low
// rider is parked this far down so its tires touch the road.
const ROAD_DROP = 0.2
// Multiplies the track's control points. The tunnel width, cart, road and
// every pacing distance below are in world units, so a longer track means
// more rail between stations at the same ride speed, not a faster ride.
// 1 = the original loop (about 54 units); 2 = about 108.
const TRACK_SCALE = 2
// Level shelves for the dioramas (ShelfTrack): each is exactly flat for this
// many world units; the ramps between them share the rest of the loop. The
// heights (world units, before VERTICAL_SCALE) set the climbs and drops.
// /hub?spothelper=1 logs each shelf's curvePosition range.
const SHELF = { length: 8, heights: [0, 4, 9, 13, 3, -4] }
// Full-frame bloom. Only pixels brighter than `threshold` glow: the wire
// (x10), its points (x7) and authored emissives (ore x4.8) stay well above
// it, while lit cloth under a 50-candela stage light stays below.
const BLOOM = { strength: 0.3, radius: 0, threshold: 1.8 }
// Ride speed in world units per second (0.92 was the original 0.017 of a
// 54-unit lap; the ship ran at about one and a half times that).
const RIDE_SPEED = 0.92
// Daytime stations: a gallery entry with `daylight` (true, or an object
// overriding these) is lit by a sun and a sky instead of the stage lamp
// alone, and the tunnel's black background and fog lerp toward its sky for
// the length of the pass. The lights exist from the start at
// zero (like the spotlights) so switching them on compiles no new shaders.
// /hub?day=0 disables it for comparison.
const DAYLIGHT = {
  sky: '#9fc9ef',        // background and fog colour at full day
  sun: '#fff1d6',        // DirectionalLight colour
  sunIntensity: 2.6,
  skyColor: '#bcd9f5',   // HemisphereLight sky
  groundColor: '#c9a977', // HemisphereLight ground (the diorama's sand)
  skyIntensity: 1.0,
  dawn: 2.0,             // world units after the light strikes for day to come up
  dawnDelay: 0,          // world units after the strike before the dawn begins (the cart covers ~0.92 per second at full speed)
  // Sky props around the station (world space, shown with it, fading with
  // the dawn): a gradient dome, a bloomed sun disc and drifting clouds.
  domeRadius: 14,
  zenith: '#5a9be6',     // dome colour overhead
  horizon: '#d3e7fa',    // dome colour at the horizon
  sunDisc: [0.5, 0.2, 0.6], // direction from the station: [away from track, up, along track]; the camera looks about level, so keep `up` low
  sunDistance: 10,
  sunSize: 1.3,
  clouds: 7,
  cloudDrift: 0.35,      // world units of sway
  // A station's `gloom: { at, over }` (seconds after it lights) drags the
  // day toward this overcast look over `over` seconds: the sun goes, the
  // dome and clouds darken and the clouds swell.
  storm: {
    sky: '#4f5861',      // background/fog at full gloom
    dome: '#4b525b',     // tint multiplied over the dome gradient
    cloud: '#3e434a',    // cloud sprite colour
    cloudScale: 1.7,     // clouds swell by this factor
    sun: 0.08,           // sun light left at full gloom (fraction)
    skyLight: 0.5,       // hemisphere light left (fraction)
    skyColor: '#6a737d', // hemisphere sky at full gloom
    groundColor: '#3a3733',
  },
}
const DAY_ENABLED = typeof window === 'undefined'
  || new URLSearchParams(window.location.search).get('day') !== '0'
// Debug: /hub?station=OIL%20FIELD starts the ride just before that station's
// light strikes (its `year`, case-insensitive) instead of the first one.
const START_STATION = typeof window !== 'undefined'
  ? (new URLSearchParams(window.location.search).get('station') || '').toUpperCase()
  : ''

// Canvas textures for the daylight sky props (built once per station).
// This scene renders through the composer with no OutputPass, so nothing
// tone-maps or sRGB-encodes the frame (toneMappingExposure has no effect
// here): colours reach the screen as stored. The textures are therefore
// tagged NoColorSpace (no sRGB decode) and the sky colours set as linear,
// so the painted values are what is seen.
function makeSkyDomeTexture(zenith, horizon) {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  // The horizon sits at the station's height (v = 0.5); the camera looks
  // about level, so the visible sky is the band just above it. The haze
  // gives way to the zenith colour within that band, not at the top.
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, zenith)
  g.addColorStop(0.3, zenith)
  g.addColorStop(0.5, horizon)
  g.addColorStop(1, horizon)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 2, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  return texture
}
function makeSunTexture() {
  // Raw RGBA like the clouds (see makeCloudTexture): a hot core, a short
  // soft edge, then a long faint corona.
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      let alpha
      if (d < 0.28) alpha = 1
      else if (d < 0.36) alpha = 1 - (d - 0.28) / 0.08 * 0.45
      else alpha = Math.max(0, 0.55 * (1 - (d - 0.36) / 0.64))
      const warm = Math.min(d / 0.36, 1) // white core shading to a warm rim
      const o = (y * size + x) * 4
      data[o] = 255
      data[o + 1] = Math.round(252 - warm * 20)
      data[o + 2] = Math.round(240 - warm * 70)
      data[o + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.NoColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
// A soft cumulus: overlapping white puffs on a flatter base. `seed` varies
// the shape so a sky of a few shared textures does not repeat visibly.
// Built as raw RGBA data rather than a canvas: a translucent canvas goes
// through a premultiplied-alpha round trip on upload that WebKit turns into
// coloured noise in the low-alpha texels.
function makeCloudTexture(seed) {
  let r = seed * 9301 + 49297
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 }
  const width = 256
  const height = 128
  const puffs = []
  const count = 7 + Math.floor(rand() * 4)
  for (let i = 0; i < count; i++) {
    puffs.push({ x: 50 + rand() * 156, y: 44 + rand() * 30, radius: 22 + rand() * 26 })
  }
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    // Row 0 is the bottom of the texture (flipY is off for data textures).
    // The underside fades out over the base band so the cloud sits flat.
    const base = Math.min(Math.max((y - 10) / 34, 0), 1)
    for (let x = 0; x < width; x++) {
      let clear = 1
      for (const puff of puffs) {
        const dx = x - puff.x
        const dy = y - puff.y
        const d = Math.sqrt(dx * dx + dy * dy) / puff.radius
        if (d >= 1) continue
        const falloff = d < 0.55 ? 1 - d * 0.6 : (1 - d) / 0.45 * 0.67
        clear *= 1 - falloff * 0.95
      }
      const alpha = (1 - clear) * base
      const o = (y * width + x) * 4
      data[o] = data[o + 1] = data[o + 2] = 255
      data[o + 3] = Math.round(Math.min(alpha, 1) * 255)
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  texture.colorSpace = THREE.NoColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
// Seconds of dark tunnel before the first station's light strikes. The ride
// starts this far (at full speed) before that strike point rather than at
// the top of the loop, so the first stage is always seen switching on.
const LEAD_IN_SECONDS = 4
// The camera looks (and the vehicle sits) this far ahead along the track.
const LOOK_AHEAD = 1.35
const WORLD_UP = new THREE.Vector3(0, 1, 0)
// Stations: gallery entries with a `model` slow the ride as the vehicle
// passes. Distances are world units along the track.
const STATION = {
  crawl: 0.07,      // speed multiplier at the station (1 = full pace)
  hold: 0.315,      // half-width of the window held at crawl (a gallery entry's `hold` overrides it)
  approach: 3.25,   // ramp length before the hold window (slowing down)
  release: 1.35,    // ramp length after it (speeding back up)
  gaze: 0.9,        // how far the camera turns toward the station (1 = straight at it)
  spot: 50,         // spotlight intensity (candela) once the station is lit
  spotLead: 4.9,    // the light switches on this far before the slow-down begins (entry `spotLead` overrides)
  spotRise: 0.11,   // and takes this long to come up (short = a stage light snapping on)
  spotFlash: 0.4,   // ignition overshoot (fraction above full) that settles over spotFlashLen
  spotFlashLen: 0.65,
  houseLead: 2.0,   // the tunnel lights start fading out this far before the slow-down begins
  houseFade: 2.0,   // and take this long to go dark; they return with the release ramp
}
// Length of one lap in world units, set when the track is built. Ride
// positions are lap fractions, so pacing distances convert through it.
let LAP = 1
const frac = (units) => units / LAP
// Debug: /hub?spothelper=1 draws each station spotlight's cone and exposes
// the lights and STATION constants as window.__hubStation for live tuning.
const SPOT_HELPER = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('spothelper') === '1'

// Where a station's light strikes, relative to the station (negative =
// before it). Never before the previous stage has gone dark, so only one
// stage is ever lit; `stations` must be sorted by u.
function strikeOffset(index, stations) {
  const s = stations[index]
  const lead = -frac(s.hold + STATION.approach + s.spotLead)
  if (stations.length < 2) return lead
  const prev = stations[(index + stations.length - 1) % stations.length]
  // Measured backward from this station, so it is always in (-1, 0].
  let prevDark = prev.u + frac(prev.hold + STATION.release) - s.u
  prevDark = ((prevDark % 1) + 1) % 1 - 1
  return Math.max(lead, prevDark)
}

// Spotlight level for a station: snaps on at the strike point, holds
// through the pass, then fades with the release ramp.
function spotWeight(u, station, on = -frac(station.hold + STATION.approach + station.spotLead)) {
  let d = u - station.u
  d -= Math.round(d)
  if (d >= 0) return stationWeight(u, station)
  if (d < on) return 0
  const x = STATION.spotRise > 0 ? Math.min((d - on) / frac(STATION.spotRise), 1) : 1
  const rise = x * x * (3 - 2 * x)
  // Lamp strike: overshoot on ignition, decaying to the held level.
  const f = STATION.spotFlashLen > 0 ? Math.min((d - on) / frac(STATION.spotFlashLen), 1) : 1
  return rise * (1 + STATION.spotFlash * (1 - f))
}

// Daylight level for a daylight station: comes up over `dawn` units from
// the strike point (a sunrise, not a lamp), holds through the pass and
// fades with the release ramp, so night returns before the next station.
function daylightWeight(u, station, on) {
  let d = u - station.u
  d -= Math.round(d)
  if (d >= 0) return stationWeight(u, station)
  const dawn = station.daylight.dawn ?? DAYLIGHT.dawn
  // The dawn may start later than the strike, but always completes by the station.
  const start = Math.min(on + frac(station.daylight.dawnDelay ?? DAYLIGHT.dawnDelay), -frac(dawn))
  if (d < start) return 0
  const x = dawn > 0 ? Math.min((d - start) / frac(dawn), 1) : 1
  return x * x * (3 - 2 * x)
}

// One station's influence at ride position `u` (0..1, wrapping): 1 within
// the hold window, smoothstepped to 0 over the approach ramp before it and
// the release ramp after it.
function stationWeight(u, station) {
  return windowWeight(u, station, station.hold, STATION.approach, station.hold, STATION.release)
}
// 1 within `before`..`after` units of the station, smoothstepped to 0 over
// the ramps outside those edges (world units; the before side is approaching).
function windowWeight(u, station, before, beforeRamp, after, afterRamp) {
  let d = u - station.u
  d -= Math.round(d) // wrap to -0.5..0.5; negative = still approaching
  const edge = frac(d < 0 ? before : after)
  const ramp = frac(d < 0 ? beforeRamp : afterRamp)
  const x = Math.min(Math.max((Math.abs(d) - edge) / ramp, 0), 1)
  return 1 - x * x * (3 - 2 * x)
}
// House-light fade: like the slow-down window but opening houseLead units
// earlier (fading over houseFade) and closing with the same release ramp.
function houseWeight(u, stations) {
  const lead = STATION.approach + STATION.houseLead - STATION.houseFade
  let weight = 0
  for (const s of stations) {
    weight = Math.max(weight, windowWeight(u, s, s.hold + lead, STATION.houseFade, s.hold, STATION.release))
  }
  return weight
}

// The strongest station at `u` and its weight, for pacing and the gaze.
function stationAt(u, stations) {
  let best = null
  let weight = 0
  for (const s of stations) {
    const w = stationWeight(u, s)
    if (w > weight) { weight = w; best = s }
  }
  return { station: best, weight }
}

// Speed multiplier: 1 on open track, STATION.crawl at a station.
function rideSpeedAt(u, stations) {
  return 1 - (1 - STATION.crawl) * stationAt(u, stations).weight
}

// Candle flames for dioramas: any node named Flame_Empty* in a station's
// glTF gets a small flickering flame (the shrine's votive shader, trimmed).
// Height is in world units so it reads the same at every station scale.
const FLAME = {
  height: 0.03,     // world height of a flame (the dioramas are ~3.5 wide)
  intensity: 1.2,   // colour multiplier; the full-frame bloom adds the glow
  speed: 0.2,      // flicker rate (the shrine votives run at 3)
  prefix: /^Flame_Empty/i,
  // Flames authored in Blender (meshes named "Candle flame …") are hidden so
  // every station uses the same shader flames and the knobs above apply.
  authored: /^Candle flame/i,
}
const flameUniforms = { uTime: { value: 0 } }

// Teardrop profile, 0.6 tall with its base at y = -0.1 (the shader maps
// that range to 0..1), bulging low and tapering to a point.
function createFlameGeometry() {
  const points = []
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = 0.2 * Math.sin(Math.PI * Math.pow(t, 0.6)) * (1 - t * 0.35)
    points.push(new THREE.Vector2(Math.max(r, 0.0001), -0.1 + 0.6 * t))
  }
  return new THREE.LatheGeometry(points, 8)
}

function createFlameMaterial(phase) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: flameUniforms.uTime,
      uPhase: { value: phase },
      uSpeed: { value: FLAME.speed },
      uIntensity: { value: FLAME.intensity },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uSpeed;
      varying float vHeight;
      void main() {
        vec3 pos = position;
        vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);
        float ft = uTime * uSpeed + uPhase;
        pos.x += (sin(ft * 1.5) * 0.06 * vHeight + sin(ft * 2.3) * 0.03) * vHeight;
        pos.z += cos(ft * 1.8) * 0.02 * vHeight * vHeight;
        pos.y += (sin(ft * 2.0) * 0.02 + sin(ft * 3.7) * 0.02 * vHeight) * vHeight;
        pos.y *= 1.0 + sin(ft * 2.5) * 0.1 * vHeight;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uSpeed;
      uniform float uIntensity;
      varying float vHeight;
      void main() {
        float time = uTime * uSpeed + uPhase;
        vec3 inner = vec3(1.0, 0.95, 0.8);
        vec3 mid = vec3(1.0, 0.55, 0.05);
        vec3 outer = vec3(1.0, 0.25, 0.0);
        vec3 color = vHeight < 0.3 ? mix(inner, mid, vHeight / 0.3)
                   : vHeight < 0.7 ? mix(mid, outer, (vHeight - 0.3) / 0.4)
                   : mix(outer, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
        float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
        float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);
        gl_FragColor = vec4(color * uIntensity * flicker, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  })
}

// Parent a flame to every Flame_Empty under `model`, scaled so each stands
// FLAME.height tall in world units whatever the empty's own scale.
function addStationFlames(model, geometry, track) {
  const empties = []
  model.traverse((node) => { if (FLAME.prefix.test(node.name)) empties.push(node) })
  model.updateMatrixWorld(true)
  const worldScale = new THREE.Vector3()
  empties.forEach((empty, i) => {
    const material = createFlameMaterial(i * 1.7)
    const flame = new THREE.Mesh(geometry, material)
    flame.name = 'StationFlame'
    flame.frustumCulled = false
    empty.getWorldScale(worldScale)
    // The lathe profile is 0.6 tall, so this makes the flame FLAME.height
    // world units tall regardless of the empty's inherited scale.
    flame.scale.setScalar(FLAME.height / 0.6 / Math.max(worldScale.y, 1e-6))
    flame.position.y = 0.1 * flame.scale.y // base of the profile sits on the empty
    empty.add(flame)
    track.materials.push(material)
  })
  return empties.length
}
// Scales the control points' height so the climbs and drops are gentler
// for the car (1 is the original tunnel).
const VERTICAL_SCALE = 0.75
// Length of the low rider in world units; the road is about 0.48 wide.
const CAR_LENGTH = 0.42

// /hub camera defaults. Players can switch between inside and behind views.
// Distances are in scene units relative to the cart: +Y up, +Z forward.
const COASTER_POV = {
  mode: 'inside',
  eyeHeight: 0.29,
  seatOffset: 0.06, // Negative moves toward the back of the cart.
  fov: 65, // Larger values give a wider view from the seat.
}

// Custom scanline shader
const ScanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.2 }  // Reduced from 0.5 for more subtle effect
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Create scanlines
      float scanline = sin(vUv.y * 98.0 * 3.14159 * 2.0 + time * 0.5);  // Increased from 72 to 144 for finer lines
      scanline = abs(scanline);
      scanline = pow(scanline, 3.0);  // Increased from 2.0 to 3.0 for sharper/thinner lines
      
      // Apply scanline effect
      color.rgb *= mix(1.0, scanline, intensity);
      
      gl_FragColor = color;
    }
  `
}

// Drop a clip's tracks that target nodes outside `rootName`'s hierarchy
// (an NLA export can carry a second rig's bones in its rest pose).
function restrictClip(clip, model, rootName) {
  const root = model.getObjectByName(rootName)
  if (!root) { console.warn(`Clip ${clip.name}: node ${rootName} not found`); return }
  const inside = new Set()
  root.traverse((node) => { inside.add(node.name); if (node.uuid) inside.add(node.uuid) })
  clip.tracks = clip.tracks.filter((track) => {
    try {
      return inside.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName)
    } catch (e) {
      return true // unparseable name: leave the track alone
    }
  })
  clip.resetDuration()
}

// Every `every` loops of `main`, cross-fade to one pass of `clip` and back.
// Both actions share the entry's mixer, so they blend on the same rig.
function attachInterlude(entry, main, clip, { every = 10, fade = 0.25 }) {
  const { mixer } = entry
  const interlude = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
  interlude.clampWhenFinished = true // hold the last pose while fading back
  let loops = 0
  let playing = false
  mixer.addEventListener('loop', (e) => {
    if (e.action !== main || playing || ++loops < every) return
    loops = 0
    playing = true
    interlude.reset().play()
    main.crossFadeTo(interlude, fade, false)
  })
  mixer.addEventListener('finished', (e) => {
    if (e.action !== interlude) return
    playing = false
    main.reset().play()
    interlude.crossFadeTo(main, fade, false)
  })
  // Each time the station is revealed it starts on the main loop again.
  entry.restart = () => {
    loops = 0
    playing = false
    interlude.stop()
    main.reset().play()
  }
}

const _gusherCam = new THREE.Vector3()
const _gusherPos = new THREE.Vector3()
const _gloomColor = new THREE.Color()

// A scripted station (entry `sequence`), timed in seconds after the station
// lights, advanced like the mixers (a paused ride still plays it out):
//   idle                 the rig's looping clip from the reveal
//   tremor: { at, for }  the diorama shivers in place, building over `for` seconds
//   shake: { at, for }   the camera trembles, building over `for` seconds
//   erupt: { at, rise, delay }  the gusher column rises over `rise`; `delay`
//                        later the celebration starts
//   then: [steps]        each a clip name or { name, times, reverse, for }:
//                        played `times` through (default once), backwards
//                        with `reverse`, or for `for` seconds (a timed idle);
//                        crossfaded in turn, then back to idle
// Returns a mixer entry for FloatingGallery.mixers: `restart` resets it on
// each reveal, `tick` runs the timeline, `shake` is read by the frame loop.
function buildSequence(info, model, animations, root, gusher) {
  const seq = info.sequence
  const byName = (name) => animations.find((clip) => clip.name === name)
  const mixer = new THREE.AnimationMixer(model)
  mixer.timeScale = info.animationSpeed ?? 1
  const fade = seq.fade ?? 0.35
  const idleClip = byName(seq.idle || 'idle')
  if (!idleClip) console.warn(`Station ${info.year}: idle clip not found: ${seq.idle || 'idle'}`)
  const idle = idleClip ? mixer.clipAction(idleClip).setLoop(THREE.LoopRepeat, Infinity) : null
  const queue = []
  for (const item of seq.then || []) {
    const { name, times = 1, reverse = false, for: seconds = null } = typeof item === 'string' ? { name: item } : item
    const clip = byName(name)
    if (!clip) { console.warn(`Station ${info.year}: sequence clip not found: ${name}`); continue }
    // One action per clip: a repeated or reversed step reconfigures it.
    queue.push({ action: mixer.clipAction(clip), clip, times, reverse, seconds })
  }
  const shakeAt = seq.shake?.at ?? 4
  const shakeFor = Math.max(seq.shake?.for ?? 3, 0.01)
  const tremorAt = seq.tremor?.at ?? Infinity
  const tremorFor = Math.max(seq.tremor?.for ?? 3, 0.01)
  const fit = model.parent // the station's scaled group; jogged in place for the tremor
  const eruptAt = seq.erupt?.at ?? shakeAt + shakeFor
  const rise = Math.max(seq.erupt?.rise ?? 1.2, 0.01)
  const celebrateAt = eruptAt + (seq.erupt?.delay ?? 0.5)

  const entry = { mixer, root, delay: 0, delayRemaining: 0, wasVisible: false, restart: null, tick: null, shake: 0 }
  let time = 0
  let step = -1
  let current = null
  let celebrating = false
  let stepEndsAt = Infinity // a timed step advances at this sequence time
  // Start a step: its action restarts with the step's loop count and
  // direction and fades in over the one playing (the same action, as with
  // Rallying forward then back, just turns around in place).
  const play = ({ action, clip, times = 1, reverse = false, seconds = null }) => {
    if (!action) return
    const timed = seconds != null
    action.reset()
    action.setLoop(timed || times > 1 ? THREE.LoopRepeat : THREE.LoopOnce, timed ? Infinity : times)
    action.clampWhenFinished = !timed
    action.timeScale = reverse ? -1 : 1
    if (reverse) action.time = clip.duration
    action.play()
    if (current && current !== action) current.crossFadeTo(action, fade, false)
    current = action
    stepEndsAt = timed ? time + seconds : Infinity
  }
  const idleStep = { action: idle, clip: idleClip, seconds: Infinity }
  const advance = () => {
    step += 1
    play(step < queue.length ? queue[step] : idleStep)
  }
  mixer.addEventListener('finished', (e) => {
    if (e.action === current && stepEndsAt === Infinity && step < queue.length) advance()
  })
  entry.restart = () => {
    time = 0
    step = -1
    celebrating = false
    mixer.stopAllAction()
    current = null
    play(idleStep)
    entry.shake = 0
    fit.position.set(0, 0, 0)
    if (gusher) {
      gusher.active = false
      gusher.material.uniforms.uTime.value = 0
      gusher.material.uniforms.uOpacity.value = 0
      gusher.mesh.scale.y = gusher.height * 0.02
    }
  }
  entry.tick = (dt) => {
    time += dt
    // Tremor envelope: builds to the blow, spikes with it, settles in a
    // second and a half. Shared by the diorama shiver and the camera shake.
    const envelope = (at, len) => {
      if (time < at) return 0
      if (time < eruptAt) { const x = Math.min((time - at) / len, 1); return x * x * (3 - 2 * x) }
      return 1.4 * Math.max(0, 1 - (time - eruptAt) / 1.5)
    }
    entry.shake = envelope(shakeAt, shakeFor)
    // The diorama jogs in place (mostly vertical, a ground rumble) by a few
    // millimetres, from incommensurate sines.
    const tremor = envelope(tremorAt, tremorFor) * 0.008
    fit.position.set(
      Math.sin(time * 43.1) * tremor * 0.5,
      (Math.sin(time * 53.7) + 0.5 * Math.sin(time * 31.1 + 1.0)) * tremor,
      Math.sin(time * 37.3 + 2.0) * tremor * 0.5
    )
    if (gusher && time >= eruptAt) {
      const e = Math.min((time - eruptAt) / rise, 1)
      gusher.active = true
      gusher.mesh.scale.y = gusher.height * Math.max(e * e * (3 - 2 * e), 0.02)
      gusher.material.uniforms.uOpacity.value = Math.min(e * 2, 1)
    }
    if (!celebrating && time >= celebrateAt) {
      celebrating = true
      advance()
    } else if (time >= stepEndsAt) {
      advance()
    }
  }
  return entry
}

class FloatingGallery extends THREE.Group {
  constructor(curve) {
    super()
    
    this.curve = curve // Store curve reference
    this.images = []
    this.textures = [] // Track textures for disposal
    this.materials = [] // Track materials for disposal
    this.geometries = [] // Track geometries for disposal
    this.imageData = [
      {
        // Test station: a glTF diorama in place of the image. `width` is
        // the fitted size of its longest side; the ride slows here.
        model: '/models/alchemyDiorama2.glb?v=potion-fx-4',
        animationSpeed: 1 / 3, // Eight-second source clip plays over 24 seconds.
        year: 'ALCHEMY',
        description: 'The first station',
        spotLead: 1.0,        // light strikes ~3 s later than the default 4.9 (full speed: ~0.92 units/s)
        curvePosition: 0.038, // shelf 1 mid (see SHELF; ?spothelper=1 logs every shelf's range)
        width: 3.5,
        height: 3.5,
        radialOffset: -2.1,      // Distance from center of tunnel (sign = side)
        angle: -Math.PI,             // Angle around tunnel (radians)
        verticalOffset: 1.2,     // Additional vertical offset
        rotateY: Math.PI/0.7       // Rotate 180 degrees around Y-axis
      },
      {
        // Tulipmania: the merchant's speculative bubble rises and bursts.
        model: '/models/tulipmania.glb?v=tulip-fx-6',
        focusPoint: [-0.1, 1.15, 8.4], // Merchant's upper body in exported scene coordinates.
        animationSpeed: 1 / 3, // Ten-second source clip plays over 30 seconds.
        animationDelay: 3, // Real seconds holding the opening pose after the station lights up.
        once: true,        // the bubble rises and bursts once per pass, then holds (no loop)
        // The windmill: its exported clip is static, so the blade turns by script
        // about its own axle (the mesh's thin axis), slowly, while the station shows.
        spin: [{ node: 'Blade', axis: 'x', rpm: 4 }],
        year: 'TULIPMANIA',
        description: 'A fortune blooms, then the bubble bursts.',
        hold: 0.73,           // crawl half-window for this station only (STATION.hold elsewhere)
        spotLead: 1.5,        // light strikes later here: the cart climbs up to this shelf
        // A sunlit market (sun + sky lights, sky-blue tunnel; see DAYLIGHT) that
        // clouds over when the bubble pops: clip time 6.3 s at a third speed,
        // after the 3 s opening hold, is ~22 s after the station lights.
        daylight: { gloom: { at: 22, over: 5 } },
        curvePosition: 0.180, // shelf 2
        width: 3.5,
        height: 3.5,
        radialOffset: 2.2,
        angle: -Math.PI,
        verticalOffset: 1.1,
        rotateY: -Math.PI /0.7
      },
      {
        // Gold rush: the miner works his claim. The export carries five
        // clips on one rig, so only the named one plays.
        model: '/models/goldRushDiorama.glb?v=4',
        // Miner 2 swings the pickaxe (first clip = the interlude's main loop);
        // miner 1 shovels at full speed. The Shoveling export also carries
        // miner 2's bones, so it is limited to miner 1's hierarchy, and the
        // shovel's own clip is stretched to the shoveling loop so they stay in step.
        clips: [
          'MiningGround2',
          { name: 'Shoveling', under: 'Miner1_Empty', speed: 1 },
          { name: 'ShovelAction', speed: 1, syncTo: 'Shoveling' },
        ],
        animationSpeed: 0.5,  // default speed for the clips above (the swing)
        interlude: { clip: 'wipe_sweat', every: 10 }, // one wipe after every ten swings
        hide: ['Icosphere'],  // node names to hide
        // emissive: { lambert1727: 0 } would switch off the gold ore's glow
        // (material name -> emissive intensity).
        year: 'GOLD RUSH',
        description: 'Everyone digs; a few strike it rich.',
        spotLead: 2.1,        // light strikes ~3 s later than the default 4.9
        curvePosition: 0.362, // shelf 3
        width: 3.5,
        height: 3.5,
        radialOffset: -2.1,   // same side as Alchemy (stations alternate)
        angle: -Math.PI,
        verticalOffset: -0.2,
        rotateY: Math.PI / 0.5
      },
      {
        // Oil field: the wildcatter's gusher under a desert sun. The rig
        // ships several Mixamo clips; only the idle plays.
        model: '/models/Oil_Field_Gusher.glb?v=2',
        hold: 1.2,            // a long stop: 14 s of idle anticipation, then the strike and a ~30 s celebration
        // The strike, in seconds after the station lights (see buildSequence):
        // the wildcatter idles, the ground trembles, the well blows, and he
        // celebrates through the clips below before idling again. Rallying
        // walks him off his mark, so it is played back in reverse to return.
        sequence: {
          idle: 'idle',
          tremor: { at: 14, for: 3 },   // the diorama itself shivers first
          shake: { at: 15.5, for: 1.5 }, // the camera joins, faintly, just before the blow
          erupt: { at: 18, rise: 1.2, delay: 0.5 },
          then: [
            { name: 'Victory', times: 2 },
            { name: 'Jumping', times: 2 },
            'Rallying',
            { name: 'Rallying', reverse: true },
            { name: 'idle', for: 3 },
            'Victory',
            'Victory',
            'Victory'
          ],
        },
        // The gusher column (the field's geyser shader): x/z from the
        // `opening` empty at the derrick's crown, floor from the derrick's own
        // origin, so it blows up through the lattice and fountains above it.
        // Sizes are model units (the derrick is about 1 tall).
        // Narrow jet up to the opening, then opens (`flare`, 1 = the field's
        // full cap). `parabolum: 0` = plain black crude, 1 = the field's opal.
        gusher: { anchor: 'opening', ground: 'tripo_node_fb7245ff', width: 0.6, height: 2.0, flare: 0.6, parabolum: 0 },
        animationSpeed: 1,
        year: 'OIL FIELD',
        description: 'Strike oil, and the desert turns to gold.',
        daylight: {           // desert noon: deep zenith, dusty horizon, a blaring sun
          sky: '#bcd8f2',
          zenith: '#3f86d6',
          horizon: '#e9e3cf',
          sun: '#fff6e0',
          sunIntensity: 1.5,  // pale sand and the white plume cross the bloom threshold above this
          skyColor: '#c7dcf2',
          groundColor: '#d9b77a',
          skyIntensity: 0.6,
          sunSize: 2.0,
          clouds: 2,
          dawnDelay: 4.6,     // the sky stays dark for ~5 s after the light strikes, then day comes up
        },
        focusPoint: [0.45, 0.45, 0.1], // low on the derrick itself: the wildcatter lands beside the HUD, the plume's cap stays in frame
        curvePosition: 0.522, // shelf 4
        width: 3.5,
        height: 3.5,
        radialOffset: 1.7,    // same side as Tulipmania
        angle: -Math.PI,
        verticalOffset: 0.3,  // the sand (0.65 below the fitted centre) sits just under eye level
        rotateY: -Math.PI / 0.7
      },
    //   {
    //     url: '/carousel_images/img12.jpg',
    //     year: '599 CE',
    //     description: 'Our Lady shows how followers how to find their own four tunas',
    //     curvePosition: 0.26,
    //     width: 1,
    //     height: 1,
    //     radialOffset: 0.7,
    //     angle: Math.PI,
    //     verticalOffset: 0.1,
    //     rotateY: Math.PI,
    //     rotateZ: Math.PI / 8
    //   },
    //   {
    //     url: '/carousel_images/img8.jpg',
    //     year: '380 CE',
    //     description: 'Pre-meme era patronage of the arts',
    //     curvePosition: 0.34,
    //     width: 1,
    //     height: 1,
    //     radialOffset: -0.6,
    //     // angle: -Math.PI,
    //     rotateY: Math.PI,
    // rotateZ: -Math.PI * 0.02,  // Flip upside down (180 degrees)
    //     verticalOffset: 0.5
    //   },
    //   { 
    //     url: '/carousel_images/img13.jpg',
    //     year: '1100 CE',
    //   description: 'Early Carpathian staking protocol',
    //     curvePosition: 0.39,
    //     width: 1,
    //     height: 1,
    //     radialOffset: 0.7,
    //     angle: Math.PI,
    //     rotateY: Math.PI,

    //     verticalOffset: 0.2

    //   },
    //   { 
    //     url: '/carousel_images/img3.jpg',
    //     year: '1350 CE',
    //     description: 'Early clown encounter turns ugly',
    //     curvePosition: 0.47,
    //     width: 1,
    //     height: 1,
    //     radialOffset: -0.65,
    //     angle: -Math.PI,
    //     verticalOffset: 0.3,

    //     rotateY: Math.PI       // Rotate 180 degrees around Y-axis

    //   },
    //   { 
    //     url: '/carousel_images/img9.jpg',
    //     year: '1680',
    //     description: 'Monetary theory for a young privateer',
    //     curvePosition: 0.54,
    //     width: 1.3,
    //     height: 1.3,
    //     radialOffset: -0.5,
    //     // angle: -Math.PI/6,
    //     verticalOffset: 0.5,
    //     rotateY: Math.PI       // Rotate 180 degrees around Y-axis

    //   },
    //   { 
    //     url: '/carousel_images/img11.jpg',
    //     year: '1790',
    //     description: 'Heroine of Mythology',
    //     curvePosition: 0.63,
    //     width: 1.4,
    //     height: 1.4,
    //     radialOffset: 1,
    //     angle: -Math.PI,
    //     verticalOffset: 0.1,
    //     rotateY: Math.PI       // Rotate 180 degrees around Y-axis

    //   },
    //   {
    //     url: '/carousel_images/img2.jpg',
    //     year: '1991 CE',
    //     description: 'The Guardian of Good Times',
    //     curvePosition: 0.71,
    //     width: 1.1,
    //     height: 1.1,
    //     radialOffset: -0.8,
    //     angle: -Math.PI,
    //     verticalOffset: 0.3,
    //     rotateY: Math.PI
    //   },
    //   {
    //  url: '/carousel_images/img4.jpg',
    //     year: '2010',
    //     description: 'Featured in popular manga series',
    //     curvePosition: 0.78,
    //     width: 1.2,
    //     height: 1.2,
    //     radialOffset: 0.6,
    //     angle: -Math.PI,
    //     verticalOffset: 0.4,
    //     rotateY: Math.PI,
    //     rotateZ: -Math.PI / 2.25

    //   },
    //   {
    //     url: '/carousel_images/img5.jpg',
    //     year: '2031',
    //     description: 'Laying down DeFi Beats',
    //     curvePosition: 0.86,
    //     width: 1,
    //     height: 1,
    //     radialOffset: 0.75,
    //     angle: -Math.PI,
    //     verticalOffset: 0.2,
    //     rotateY: Math.PI,  // 180° + 30° to fix mirror and rotation
    //     rotateZ: 0                      // No vertical flip needed
    //   },
    //   { 
    //    url: '/carousel_images/img6.jpg', 
    //     year: '2077',
    //     description: 'A popular virtue signal among avant-garde automatons',
    //     curvePosition: 0.98,
    //     width: 1,
    //     height: 1,
    //     radialOffset: -0.5,
    //     angle: -Math.PI,
    //     verticalOffset: 0.5,
    //         rotateZ: -Math.PI/7,  // Flip upside down (180 degrees)

    //     rotateY: Math.PI       // Rotate 180 degrees around Y-axis

    //   },
     
    ]
    
    const loader = new THREE.TextureLoader()
    this.stations = [] // { u, position } for each diorama slot (ride pacing + gaze)
    this.modelLoads = [] // cancel flags for in-flight glTF loads
    this.dracoLoader = null
    this.flameGeometry = null // shared by every station flame
    this.mixers = [] // { mixer, root } per animated station
    this.gushers = [] // { mesh, material, root } geyser columns (entry `gusher`)
    this.spinners = [] // { node, axis, speed, root } nodes turned by script (entry `spin`)
    this.lastT = null
    this.helpers = [] // SpotLightHelpers when ?spothelper=1
    this.daylight = 0 // 0..1, strongest daylight station at the ride position (setRide)
    this.gloom = 0 // 0..1, that station's overcast mix (update)
    this.shake = 0 // camera shake requested by a scripted station this frame (update)
    this.daylightStation = null
    
    this.imageData.forEach((imageInfo, i) => {
      const position = new THREE.Vector3()
      const tangent = new THREE.Vector3()
      const normal = new THREE.Vector3()
      const binormal = new THREE.Vector3()
      
      curve.getPointAt(imageInfo.curvePosition, position)
      curve.getTangentAt(imageInfo.curvePosition, tangent)
      
      normal.crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
      binormal.crossVectors(tangent, normal)
      
      const xOffset = Math.cos(imageInfo.angle) * imageInfo.radialOffset
      const zOffset = Math.sin(imageInfo.angle) * imageInfo.radialOffset
      
      position.add(normal.clone().multiplyScalar(xOffset))
      position.add(binormal.clone().multiplyScalar(zOffset))
      position.y += imageInfo.verticalOffset
      
      if (imageInfo.model) {
        const towardTrack = normal.clone().multiplyScalar(-xOffset)
          .add(binormal.clone().multiplyScalar(-zOffset)).normalize()
        const root = this.buildStation(imageInfo, position, tangent, towardTrack)
        root.userData = {
          ...root.userData,
          initPosition: root.position.clone(),
          year: imageInfo.year,
          floatOffset: 0,
          floatSpeed: 0,
          floatAmplitude: 0 // dioramas sit still; only the image planes hover
        }
        root.visible = false // revealed when its spotlight strikes (setRide)
        this.add(root)
        this.images.push(root)
        this.stations.push({
          u: imageInfo.curvePosition,
          hold: imageInfo.hold ?? STATION.hold,
          spotLead: imageInfo.spotLead ?? STATION.spotLead,
          position: root.userData.focusTarget, spot: root.userData.spot, root,
          daylight: root.userData.daylight, // { ...DAYLIGHT overrides, sun, sky } or undefined
        })
        return
      }

      const geometry = new THREE.PlaneGeometry(imageInfo.width, imageInfo.height)
      const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        fog: false
      })
      
      loader.load(imageInfo.url, (texture) => {
        // Optimize texture size
        texture.minFilter = THREE.LinearMipMapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        
        material.map = texture
        material.needsUpdate = true
        this.textures.push(texture) // Track for disposal
      })
      
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(position)
      mesh.lookAt(position.clone().add(tangent))
      
      // Apply rotations - Y rotation defaults to 180 degrees to face camera
      const yRotation = imageInfo.rotateY !== undefined ? imageInfo.rotateY : Math.PI
      const xRotation = imageInfo.rotateX || 0
      const zRotation = imageInfo.rotateZ || 0
      
      // Apply rotations in order: Y, X, Z
      mesh.rotation.y += yRotation
      mesh.rotation.x += xRotation  
      mesh.rotation.z += zRotation
      


      
      const edgeGeometry = new THREE.EdgesGeometry(geometry)
      const edgeMaterial = new THREE.LineBasicMaterial({ 
        color: new THREE.Color('#41f').multiplyScalar(4)
      })
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
      mesh.add(edges)
      
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fa0'
      ctx.font = 'bold 48px Tourney, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(imageInfo.year, canvas.width * 0.5, canvas.height * 0.5)
      
      const yearTexture = new THREE.CanvasTexture(canvas)
      const yearLabelWidth = imageInfo.width * 0.4
      const yearGeometry = new THREE.PlaneGeometry(yearLabelWidth, yearLabelWidth * 0.25)
      const yearMaterial = new THREE.MeshBasicMaterial({
        map: yearTexture,
        transparent: true,
        side: THREE.DoubleSide,
        fog: false
      })
      const yearMesh = new THREE.Mesh(yearGeometry, yearMaterial)
      yearMesh.position.set(0, -(imageInfo.height/2 + 0.1), 0.1)
      mesh.add(yearMesh)
      
      // Track for disposal
      this.textures.push(yearTexture)
      this.materials.push(material, yearMaterial, edgeMaterial)
      this.geometries.push(geometry, yearGeometry, edgeGeometry)
      
      mesh.userData = {
        initPosition: mesh.position.clone(),
        year: imageInfo.year,
        floatOffset: i * Math.PI / 6,
        floatSpeed: 0.5,
        floatAmplitude: 0.2
      }
      
      this.add(mesh)
      this.images.push(mesh)
    })
    
    this.stations.sort((a, b) => a.u - b.u)
    this.frustumCulled = false
  }
  
  // A diorama slot: an empty group posed like an image plane (facing back
  // along the track), filled by the glTF once it loads. The model is centred
  // on the group and scaled so its longest side equals `width`. It stays
  // invisible until its spotlight strikes, so it never shows through the
  // canopy from another pass of the loop and appears all at once, lit.
  buildStation(info, position, tangent, towardTrack) {
    const root = new THREE.Group()
    root.name = `Station:${info.year}`
    root.position.copy(position)
    root.userData.focusTarget = position.clone()
    // Face along the track but stay level: the raw tangent carries the
    // rail's pitch, which would tilt the diorama on every hill.
    const level = tangent.clone().setY(0)
    if (level.lengthSq() < 1e-6) level.set(0, 0, 1)
    root.lookAt(position.clone().add(level.normalize()))

    // A warm spotlight above the slot, pulled toward the track so it lights
    // the diorama's facing side. Off until the cart approaches (see update).
    // Hard-edged cone (no penumbra) so it reads as a stage light; tuned
    // live via ?spothelper=1 on the alchemy station (width 1.2).
    const spot = new THREE.SpotLight(0xffe2b8, 0, 0, 0.7, 0, 2)
    spot.name = `StationSpot:${info.year}`
    spot.position.copy(position)
      .addScaledVector(towardTrack, info.width * 0.5)
      .add(new THREE.Vector3(0, info.width * 0.57, 0))
    spot.target.position.copy(position)
    this.add(spot, spot.target)
    root.userData.spot = spot
    if (SPOT_HELPER) {
      const helper = new THREE.SpotLightHelper(spot, 0xffe2b8)
      this.add(helper)
      this.helpers.push(helper)
    }
    if (info.daylight && DAY_ENABLED) {
      // A daytime station: a sun high over the slot, from the track side and
      // a little along it so the facing side is lit with some modelling,
      // plus a sky/ground hemisphere for the shadow side. Both start at zero
      // and are driven by daylightWeight (setRide) for this pass only.
      const cfg = { ...DAYLIGHT, ...(typeof info.daylight === 'object' ? info.daylight : {}) }
      const sun = new THREE.DirectionalLight(cfg.sun, 0)
      sun.name = `StationSun:${info.year}`
      sun.position.copy(position)
        .addScaledVector(towardTrack, info.width * 0.6)
        .addScaledVector(tangent, info.width * 0.4)
        .add(new THREE.Vector3(0, info.width * 1.2, 0))
      sun.target.position.copy(position)
      const sky = new THREE.HemisphereLight(cfg.skyColor, cfg.groundColor, 0)
      sky.name = `StationSky:${info.year}`
      sky.position.set(0, 1, 0)
      this.add(sun, sun.target, sky)

      // Sky props in world space around the station (the root is rotated to
      // face the track, so world placement is simpler). Shown with the
      // station and faded by the same dawn weight (setRide).
      const props = new THREE.Group()
      props.name = `StationSky:${info.year}`
      props.position.copy(position)
      props.visible = false
      const fading = [] // materials whose opacity follows the daylight
      const domeGeometry = new THREE.SphereGeometry(cfg.domeRadius, 24, 16)
      const domeMaterial = new THREE.MeshBasicMaterial({
        map: makeSkyDomeTexture(cfg.zenith, cfg.horizon),
        side: THREE.BackSide, fog: false, transparent: true, opacity: 0, depthWrite: false,
      })
      const dome = new THREE.Mesh(domeGeometry, domeMaterial)
      dome.renderOrder = -10 // behind everything, before the stations
      props.add(dome)
      fading.push(domeMaterial)
      this.geometries.push(domeGeometry)
      this.materials.push(domeMaterial)
      this.textures.push(domeMaterial.map)

      const up = new THREE.Vector3(0, 1, 0)
      const away = towardTrack.clone().negate()
      const along = tangent.clone().setY(0).normalize()
      const sunDir = new THREE.Vector3()
        .addScaledVector(away, cfg.sunDisc[0])
        .addScaledVector(up, cfg.sunDisc[1])
        .addScaledVector(along, cfg.sunDisc[2])
        .normalize()
      const sunTexture = makeSunTexture()
      this.textures.push(sunTexture)
      // The disc itself is pushed past the bloom threshold so it glows; a
      // wider, faint halo sits behind it below the threshold.
      const discMaterial = new THREE.SpriteMaterial({ map: sunTexture, fog: false, transparent: true, opacity: 0, depthWrite: false })
      discMaterial.color.setRGB(2.2, 2.2, 2.1) // near-neutral: a warm tint fringes green once red clips
      const haloMaterial = new THREE.SpriteMaterial({ map: sunTexture, fog: false, transparent: true, opacity: 0, depthWrite: false })
      haloMaterial.color.setRGB(1.0, 0.95, 0.8)
      haloMaterial.userData.maxOpacity = 0.35
      const disc = new THREE.Sprite(discMaterial)
      const halo = new THREE.Sprite(haloMaterial)
      disc.position.copy(sunDir).multiplyScalar(cfg.sunDistance)
      halo.position.copy(disc.position)
      disc.scale.setScalar(cfg.sunSize)
      halo.scale.setScalar(cfg.sunSize * 3.2)
      disc.renderOrder = halo.renderOrder = -9
      props.add(halo, disc)
      fading.push(discMaterial, haloMaterial)
      this.materials.push(discMaterial, haloMaterial)

      // Clouds: sprites scattered through the upper sky, most of them on the
      // far side of the station where the camera looks, swaying gently.
      const cloudTextures = [0, 1, 2].map((i) => makeCloudTexture(i + 1))
      this.textures.push(...cloudTextures)
      const clouds = []
      let r = 7
      const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 }
      for (let i = 0; i < cfg.clouds; i++) {
        const material = new THREE.SpriteMaterial({
          map: cloudTextures[i % cloudTextures.length], fog: false, transparent: true,
          opacity: 0, depthWrite: false,
        })
        material.userData.maxOpacity = 0.75 + rand() * 0.25
        const cloud = new THREE.Sprite(material)
        const distance = 6 + rand() * 6
        const dir = new THREE.Vector3()
          .addScaledVector(away, 0.35 + rand() * 0.6)
          .addScaledVector(along, (rand() - 0.5) * 1.6)
          .addScaledVector(up, 0.1 + rand() * 0.3)
          .normalize()
        cloud.position.copy(dir).multiplyScalar(distance)
        const width = 2.2 + rand() * 2.6
        cloud.scale.set(width, width * 0.5, 1)
        cloud.renderOrder = -8
        cloud.userData = { base: cloud.position.clone(), phase: rand() * Math.PI * 2, speed: 0.08 + rand() * 0.08 }
        props.add(cloud)
        clouds.push(cloud)
        fading.push(material)
        this.materials.push(material)
      }
      this.add(props)
      for (const cloud of clouds) cloud.userData.scale = cloud.scale.clone()
      root.userData.daylight = {
        ...cfg, sun, sky, props, fading, clouds, along,
        dome: domeMaterial, sunMaterials: [discMaterial, haloMaterial],
        // Gloom state (update): seconds since the station lit, and the 0..1 mix
        // (`gloom` itself is the entry's { at, over } config, if any).
        gloomTime: 0, gloomMix: 0, wasVisible: false,
        baseSkyColor: sky.color.clone(), baseGroundColor: sky.groundColor.clone(),
      }
      if (SPOT_HELPER) {
        const helper = new THREE.DirectionalLightHelper(sun, info.width * 0.3, cfg.sun)
        this.add(helper)
        this.helpers.push(helper)
      }
    }
    root.rotation.y += info.rotateY !== undefined ? info.rotateY : Math.PI
    root.rotation.x += info.rotateX || 0
    root.rotation.z += info.rotateZ || 0

    if (!this.dracoLoader) {
      this.dracoLoader = new DRACOLoader()
      this.dracoLoader.setDecoderPath('/draco/')
      this.dracoLoader.setWorkerLimit(1)
    }
    const gltfLoader = new GLTFLoader()
    gltfLoader.register(gltfEmissiveAnimation)
    gltfLoader.setDRACOLoader(this.dracoLoader)
    const load = { cancelled: false }
    this.modelLoads.push(load)

    gltfLoader.load(info.model, (gltf) => {
      if (load.cancelled) return
      const model = gltf.scene
      // Exported lights (key/fill rigs, one point light per candle) would
      // light the whole tunnel at Blender wattages and cost a shader variant
      // each; the stage spotlight and the authored emissives carry the look.
      const lights = []
      model.traverse((child) => { if (child.isLight) lights.push(child) })
      lights.forEach((light) => light.parent?.remove(light))
      model.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const scale = info.width / Math.max(size.x, size.y, size.z, 1e-6)
      const centre = box.getCenter(new THREE.Vector3())
      const fit = new THREE.Group()
      fit.name = 'StationFit'
      fit.scale.setScalar(scale)
      model.position.sub(centre)
      fit.add(model)
      model.traverse((child) => {
        if (!child.isMesh) return
        child.frustumCulled = false
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        for (const material of materials) {
          if (!material) continue
          this.materials.push(material)
          if (material.map) this.textures.push(material.map)
          if (material.emissiveMap) this.textures.push(material.emissiveMap)
          // No fog: the station is hidden until its light strikes, then
          // shown whole, instead of fading in through the tunnel fog.
          material.fog = false
          // An entry's `emissive` map overrides a material's emissive intensity.
          if (info.emissive && material.name in info.emissive) material.emissiveIntensity = info.emissive[material.name]
          // Solid things exported with alphaMode BLEND (the Tripo alchemist:
          // blended AND double-sided) render as transparent, which disables
          // depth sorting inside the mesh — far faces paint over near ones.
          // Make them opaque with an alpha cutout, so a texture that does
          // carry holes still keeps them. Real glass stays blended.
          if (material.transparent && !/glas|glass|crystal|water|swirl|bubble/i.test(material.name || '')) {
            material.transparent = false
            material.alphaTest = 0.5
            material.depthWrite = true
          }
          material.needsUpdate = true
          // Authored emissive strengths are trusted: the diorama's candle
          // flames and sparks are built to bloom (threshold 1 in this scene).
        }
        if (child.geometry) this.geometries.push(child.geometry)
      })
      root.add(fit)
      root.updateMatrixWorld(true)
      // An entry's `gusher` hangs the field's geyser column off a named empty:
      // a plane in model space, Y-locked to face the camera each frame
      // (update), scrolling while the station is visible. `ground` names a
      // node whose height is the column's floor (default: the anchor's).
      let gusherRecord = null
      if (info.gusher) {
        const anchor = model.getObjectByName(info.gusher.anchor)
        const ground = info.gusher.ground ? model.getObjectByName(info.gusher.ground) : anchor
        if (!anchor || !ground) console.warn(`Station ${info.year}: gusher node not found: ${!anchor ? info.gusher.anchor : info.gusher.ground}`)
        else {
          const { width = 0.5, height = 1.2, parabolum = 1, flare = 1 } = info.gusher
          // Column floor and the anchor's height above it (model space); the
          // anchor becomes the shader's neck when it sits above the floor.
          const anchorY = model.worldToLocal(anchor.getWorldPosition(_gusherPos)).y
          const groundY = model.worldToLocal(ground.getWorldPosition(_gusherPos)).y
          const neck = Math.min(Math.max((anchorY - groundY) / height, 0), 0.9)
          // Origin at the plane's bottom edge, so scaling y grows it upward.
          const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)
          const material = new THREE.ShaderMaterial({
            vertexShader: GEYSER_VERTEX_SHADER,
            fragmentShader: GEYSER_FRAGMENT_SHADER,
            uniforms: geyserUniforms({ parabolum, neck, flare }),
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.name = `StationGusher:${info.year}`
          mesh.renderOrder = 10
          mesh.frustumCulled = false
          // The plane's bottom edge sits at the floor, under the anchor (model space).
          model.worldToLocal(anchor.getWorldPosition(mesh.position))
          mesh.position.y = groundY
          mesh.scale.set(width, height, 1)
          model.add(mesh)
          this.geometries.push(geometry)
          this.materials.push(material)
          // `active` false parks the column (a sequence erupts it, see buildSequence).
          gusherRecord = { mesh, material, root, height, active: true }
          this.gushers.push(gusherRecord)
        }
      }
      // Large sets can frame a performer instead of their bounding-box centre.
      if (info.focusPoint) {
        model.localToWorld(root.userData.focusTarget.fromArray(info.focusPoint))
        spot.target.position.copy(root.userData.focusTarget)
      }
      // Animation: a Blender "Scene" export merges everything into one clip
      // (the alchemist's rig, the candle flicker, the gold motes); play every
      // clip the file ships, looping. Advanced from update() while visible.
      // An entry's `interlude` names a clip played once, in place of the main
      // loop (the first of `clips`), after every N loops of it.
      const interludeClip = info.interlude
        && (gltf.animations || []).find((clip) => clip.name === info.interlude.clip)
      if (info.interlude && !interludeClip) console.warn(`Station interlude clip not found: ${info.interlude.clip}`)
      // An entry's `clips` lists the clips to play (default: all), each a
      // name or { name, speed, under, syncTo }: `speed` overrides
      // animationSpeed for that clip, `under` keeps only its tracks inside
      // that node's hierarchy, `syncTo` gives it another clip's duration.
      // A scripted station builds its own mixer (buildSequence) in place of
      // the per-clip mixers below.
      const sequenced = info.sequence ? buildSequence(info, model, gltf.animations || [], root, gusherRecord) : null
      if (sequenced) this.mixers.push(sequenced)
      // An entry's `spin` lists nodes turned by script ({ node, axis, rpm });
      // their own (static) Scene-export clips are skipped so they cannot
      // overwrite the rotation every frame.
      const spun = new Set()
      for (const { node: name, axis = 'y', rpm = 1 } of info.spin || []) {
        const node = model.getObjectByName(name)
        if (!node) { console.warn(`Station ${info.year}: spin node not found: ${name}`); continue }
        spun.add(name)
        this.spinners.push({ node, axis, speed: (rpm * Math.PI * 2) / 60, root })
      }
      let clipOptions = (info.clips || []).map((c) => (typeof c === 'string' ? { name: c } : c))
      const shipped = (gltf.animations || []).map((clip) => clip.name)
      const missing = clipOptions.filter((c) => !shipped.includes(c.name)).map((c) => c.name)
      if (missing.length) console.warn(`Station ${info.year}: clips not in ${info.model}: ${missing.join(', ')} (shipped: ${shipped.join(', ') || 'none'})`)
      // None of the listed clips exported: play what shipped rather than freeze.
      const useListed = clipOptions.length > missing.length
      if (!useListed) clipOptions = []
      const optionsFor = (clip) => clipOptions.find((c) => c.name === clip.name)
      for (const clip of sequenced ? [] : gltf.animations || []) {
        if (clip === interludeClip || spun.has(clip.name)) continue
        const options = optionsFor(clip)
        if (useListed && !options) continue
        if (options?.under) restrictClip(clip, model, options.under)
        if (options?.syncTo) {
          const other = gltf.animations.find((c) => c.name === options.syncTo)
          if (other) clip.duration = other.duration
        }
        const scenery = clip.name === 'WindmillBlade_SlowRotation'
        const mixer = new THREE.AnimationMixer(model)
        // The exported windmill loop has its own speed and no opening hold.
        mixer.timeScale = scenery ? 1 : (options?.speed ?? info.animationSpeed ?? 1)
        // An entry's `once` plays its clips a single time per pass and
        // holds the final pose; each reveal starts them over.
        const once = Boolean(info.once) && !scenery
        const action = mixer.clipAction(clip)
          .setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
          .play()
        if (once) action.clampWhenFinished = true
        mixer.update(0)
        const entry = {
          mixer, root,
          delay: scenery ? 0 : Math.max(0, info.animationDelay ?? 0),
          delayRemaining: 0,
          wasVisible: false,
          restart: once ? () => action.reset().play() : null,
        }
        if (interludeClip && clip.name === (clipOptions[0]?.name ?? clip.name)) {
          attachInterlude(entry, action, interludeClip, info.interlude)
        }
        this.mixers.push(entry)
      }
      // Hide any flames authored in Blender (kept in the tree so the clip's
      // tracks still find their nodes) and light the Flame_Empty nodes with
      // the shared shader flames instead. An entry's `hide` lists further
      // node names to hide (props that the chosen clip does not use).
      model.traverse((child) => {
        if (child.isMesh && FLAME.authored.test(child.name)) child.visible = false
        if (info.hide?.includes(child.name)) child.visible = false
      })
      if (!this.flameGeometry) {
        this.flameGeometry = createFlameGeometry()
        this.geometries.push(this.flameGeometry)
      }
      addStationFlames(model, this.flameGeometry, this)
    }, undefined, (error) => {
      if (!load.cancelled) console.warn(`Station model could not load: ${info.model}`, error)
    })

    return root
  }

  // The gallery root an intersected mesh belongs to (planes carry label and
  // edge children; stations are whole glTF trees).
  rootOf(object) {
    let node = object
    while (node && !this.images.includes(node)) node = node.parent
    return node || null
  }

  // Called with the vehicle's ride position: each station's spotlight
  // comes up as the cart approaches and fades after it passes.
  setRide(u) {
    // Strongest daylight at this ride position, 0..1 (read by the frame
    // loop for the background and fog).
    let daylight = 0
    this.stations.forEach((s, i) => {
      const on = strikeOffset(i, this.stations)
      const w = spotWeight(u, s, on)
      if (s.spot) s.spot.intensity = STATION.spot * w
      s.root.visible = w > 0
      if (s.daylight) {
        const d = daylightWeight(u, s, on)
        s.daylight.sun.intensity = s.daylight.sunIntensity * d
        s.daylight.sky.intensity = s.daylight.skyIntensity * d
        s.daylight.props.visible = d > 0
        for (const material of s.daylight.fading) material.opacity = (material.userData.maxOpacity ?? 1) * d
        if (d > daylight) { daylight = d; this.daylightStation = s }
      }
    })
    this.daylight = daylight
    this.gloom = this.daylightStation?.daylight.gloomMix ?? 0
  }

  update(t, camera) {
    flameUniforms.uTime.value = t
    // Wall-clock step for the station mixers (clamped so a background tab
    // does not lurch); hidden stations are not advanced.
    const dt = this.lastT === null ? 0 : Math.min(Math.max(t - this.lastT, 0), 0.1)
    this.lastT = t
    let shake = 0 // strongest camera shake asked for by a scripted station (0..1+)
    for (const entry of this.mixers) {
      const { mixer, root, delay } = entry
      if (!root.visible) {
        entry.wasVisible = false
        continue
      }
      if (!entry.wasVisible) {
        entry.restart?.()
        if (delay > 0) {
          mixer.setTime(0)
          entry.delayRemaining = delay
        }
      }
      entry.wasVisible = true
      // Count the hold in real seconds, independently of animationSpeed.
      const held = Math.min(entry.delayRemaining, dt)
      entry.delayRemaining -= held
      const playback = dt - held
      if (playback > 0) mixer.update(playback)
      entry.tick?.(playback)
      if (entry.shake > shake) shake = entry.shake
    }
    this.shake = shake
    for (const helper of this.helpers) helper.update()
    for (const { node, axis, speed, root } of this.spinners) {
      if (!root.visible) continue
      if (axis === 'x') node.rotateX(speed * dt)
      else if (axis === 'z') node.rotateZ(speed * dt)
      else node.rotateY(speed * dt)
    }
    for (const { mesh, material, root, active } of this.gushers) {
      mesh.visible = root.visible && active
      if (!mesh.visible) continue
      material.uniforms.uTime.value += dt
      if (camera) {
        // Y-locked billboard, like the field's geyser plane.
        const cam = camera.getWorldPosition(_gusherCam)
        const at = mesh.getWorldPosition(_gusherPos)
        mesh.lookAt(cam.x, at.y, cam.z)
      }
    }
    for (const s of this.stations) {
      if (!s.daylight) continue
      const day = s.daylight
      // Gloom clock: counts from the reveal, like the mixers.
      if (!s.root.visible) { day.wasVisible = false; day.gloomMix = 0; continue }
      if (!day.wasVisible) { day.wasVisible = true; day.gloomTime = 0 }
      day.gloomTime += dt
      let g = 0
      if (day.gloom && day.gloom.at != null && typeof day.gloom === 'object') {
        const x = Math.min(Math.max((day.gloomTime - day.gloom.at) / Math.max(day.gloom.over ?? 4, 0.01), 0), 1)
        g = x * x * (3 - 2 * x)
      }
      day.gloomMix = g
      if (!day.props.visible) continue
      for (const cloud of day.clouds) {
        const { base, phase, speed, scale } = cloud.userData
        cloud.position.copy(base).addScaledVector(day.along, Math.sin(t * speed + phase) * day.cloudDrift)
        cloud.scale.copy(scale).multiplyScalar(1 + (day.storm.cloudScale - 1) * g)
        cloud.material.color.set('#ffffff').lerp(_gloomColor.set(day.storm.cloud), g)
      }
      // Overcast: over the daylight values setRide just set.
      day.sun.intensity *= 1 - (1 - day.storm.sun) * g
      day.sky.intensity *= 1 - (1 - day.storm.skyLight) * g
      day.sky.color.copy(day.baseSkyColor).lerp(_gloomColor.set(day.storm.skyColor), g)
      day.sky.groundColor.copy(day.baseGroundColor).lerp(_gloomColor.set(day.storm.groundColor), g)
      day.dome.color.set('#ffffff').lerp(_gloomColor.setStyle(day.storm.dome, THREE.LinearSRGBColorSpace), g)
      for (const material of day.sunMaterials) material.opacity *= 1 - g
    }
    this.images.forEach((image) => {
      const userData = image.userData
      
      const floatY = Math.sin(t * userData.floatSpeed + userData.floatOffset) * userData.floatAmplitude
      image.position.y = userData.initPosition.y + floatY
    })
  }
  
  dispose() {
    this.modelLoads.forEach(load => { load.cancelled = true })
    this.mixers.forEach(({ mixer }) => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()) })
    this.mixers = []
    this.helpers.forEach(helper => helper.dispose())
    this.helpers = []
    if (SPOT_HELPER && typeof window !== 'undefined') delete window.__hubStation
    this.dracoLoader?.dispose()
    this.dracoLoader = null
    // Dispose of all tracked resources
    this.textures.forEach(texture => texture.dispose())
    this.materials.forEach(material => material.dispose())
    this.geometries.forEach(geometry => geometry.dispose())
    
    // Clear arrays
    this.textures = []
    this.materials = []
    this.geometries = []
    this.images = []
  }
}

class WireTunnel extends THREE.LineSegments {
  // canopy: keep only the part of the tunnel that arches over the road.
  // canopyFloor is the cut height, -1 (bottom) .. 1 (top), measured along the
  // camera's screen-up at each ring; 0 keeps the half above the horizon.
  constructor({ canopy = true, canopyFloor = -0.75, smoothPath = false } = {}) {
    const basePoints = [
      { x: 6.097824119373165, y: 2.962665382204997, z: 1.7433171949691226 },
      { x: 2.498887329278077, y: 1.876906878980996, z: -6.263607800877008 },
      { x: 0.405, y: 5.021, z: -3.628 },
      { x: -2.157131886014289, y: 6.643373663865348, z: 0.46083444814894103 },
      { x: -3.4743927694436687, y: -3.0277132522771772, z: 5.268922787973147 },
      { x: -5.980, y: -2.381, z: 1.233 },
      { x: -6.004952702196002, y: 0.16039311931742395, z: -3.59371911696846 }
    ]

    // The plan of the loop comes from the original points; the heights are
    // replaced by the shelf profile (the points' own y is no longer used).
    const curve = new ShelfTrack(
      basePoints.map(p => ({ x: p.x * TRACK_SCALE, z: p.z * TRACK_SCALE })),
      { shelfLength: SHELF.length, heights: SHELF.heights.map(h => h * VERTICAL_SCALE) }
    )
    if (smoothPath) curve.updateArcLengths()
    LAP = curve.getLength()
    // Rings per lap; scaled with the track so their spacing stays the same.
    const tubularSegments = Math.round(130 * TRACK_SCALE)
    const radialSegments = 7
    const tube = new THREE.TubeGeometry(curve, tubularSegments, 0.2, radialSegments, true)

    // Height of every tube vertex above its ring's centre, along the same
    // screen-up the road uses (world up projected off the curve tangent), so
    // "above the road" means the same thing here as it does for the road.
    const tubePositions = tube.attributes.position
    const heights = new Float32Array(tubePositions.count).fill(1)
    if (canopy) {
      const up = new THREE.Vector3(0, 1, 0)
      const centre = new THREE.Vector3()
      const tangent = new THREE.Vector3()
      const upDir = new THREE.Vector3()
      const offset = new THREE.Vector3()
      for (let i = 0; i <= tubularSegments; i++) {
        // The closed tube's last ring repeats ring 0.
        const u = (i % tubularSegments) / tubularSegments
        curve.getPointAt(u, centre)
        curve.getTangentAt(u, tangent)
        upDir.copy(up).addScaledVector(tangent, -up.dot(tangent)).normalize()
        for (let j = 0; j <= radialSegments; j++) {
          const k = i * (radialSegments + 1) + j
          offset.fromBufferAttribute(tubePositions, k).sub(centre)
          heights[k] = offset.dot(upDir) / offset.length()
        }
      }
      // Drop every face that touches a vertex below the cut; the wire is
      // then extracted from what remains, so the cut edge reads as a rail.
      const index = tube.index.array
      const kept = []
      for (let f = 0; f < index.length; f += 3) {
        const a = index[f], b = index[f + 1], c = index[f + 2]
        if (heights[a] > canopyFloor && heights[b] > canopyFloor && heights[c] > canopyFloor) kept.push(a, b, c)
      }
      tube.setIndex(kept)
    }
    const wire = new THREE.EdgesGeometry(tube, 1.125)

    super(
      wire, 
      new THREE.LineBasicMaterial({ 
        color: new THREE.Color('#41f').multiplyScalar(10),
        transparent: true, // fades with the house lights (setHouseLights)
      })
    )
    this.curve = curve

    // One glowing point per kept tube vertex (the duplicate seam ring and
    // seam column are skipped so no point is doubled).
    const color = new THREE.Color()
    const pointPositions = []
    const colors = []
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const k = i * (radialSegments + 1) + j
        if (heights[k] <= canopyFloor) continue
        pointPositions.push(tubePositions.getX(k), tubePositions.getY(k), tubePositions.getZ(k))
        color.setHSL((Math.random() - 0.5) * 0.15, 1, 0.6).multiplyScalar(7)
        colors.push(color.r, color.g, color.b)
      }
    }
    
    const pointsGeometry = new THREE.BufferGeometry()
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3))
    pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    })
    // House lights: the whole point cloud fades out (colour and opacity) as
    // the cart slows for a station and back in as it leaves; see setHouseLights.
    this.houseLights = { uDim: { value: 0 } }
    pointsMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.houseLights)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n uniform float uDim;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor *= 1.0 - uDim;')
    }
    
    const points = new THREE.Points(pointsGeometry, pointsMaterial)
    points.frustumCulled = false
    this.add(points)
    
    const gShip = new THREE.ConeGeometry(0.1, 0.05, 3).translate(0, -0.1, 0)
    const mShip = new THREE.MeshLambertMaterial({
      polygonOffset: true,
      polygonOffsetUnits: -0.001,
      polygonOffsetFactor: 1,
      color: new THREE.Color('magenta')
    })
    const ship = new THREE.Mesh(gShip, mShip)
    this.ship = ship
    this.add(ship)
    
    const shipWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(gShip), 
      new THREE.LineBasicMaterial({
        color: new THREE.Color('magenta').multiplyScalar(10)
      })
    )
    ship.add(shipWire)
  }

  // weight 0..1: the active station's slow-down weight.
  setHouseLights(weight) {
    this.houseLights.uDim.value = weight
    this.material.opacity = 1 - weight // the wire itself
  }
}

// The synthwave road from the landing drive (PalmTreeDrive's ground shader),
// laid as a ribbon along the tunnel curve so it runs out from under the viewer
// into the centre of the vortex. The ribbon's "down" is the camera's screen-down
// (world up projected off the tangent), so it always sits straight below the
// fly-through camera and the ship, through every climb and bank of the curve.
// It is static in world space: the camera's motion along the curve is what
// makes the grid stream past, so pausing the tunnel pauses the road too.
class SynthwaveRoad extends THREE.Mesh {
  constructor(curve, {
    segments = 600,
    halfWidth = 0.24,   // world units; maps to 7.5 road units (the landing road's black edge)
    drop = ROAD_DROP,   // how far below the curve (camera/ship) the surface sits
    acrossScale = 7.5 / 0.24,
    alongScale = 8      // road units per world unit along the curve (sets grid pace)
  } = {}) {
    const count = (segments + 1) * 2
    const positions = new Float32Array(count * 3)
    const uvs = new Float32Array(count * 2)
    const length = curve.getLength()
    const up = new THREE.Vector3(0, 1, 0)
    const point = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const right = new THREE.Vector3(1, 0, 0)
    const down = new THREE.Vector3()
    const edge = new THREE.Vector3()

    for (let i = 0; i <= segments; i++) {
      const u = i / segments
      curve.getPointAt(u % 1, point)
      curve.getTangentAt(u % 1, tangent)
      const side = new THREE.Vector3().crossVectors(tangent, up)
      if (side.lengthSq() > 1e-6) right.copy(side.normalize())
      down.crossVectors(tangent, right).normalize()
      point.addScaledVector(down, drop)

      edge.copy(point).addScaledVector(right, -halfWidth)
      positions.set([edge.x, edge.y, edge.z], i * 6)
      edge.copy(point).addScaledVector(right, halfWidth)
      positions.set([edge.x, edge.y, edge.z], i * 6 + 3)

      // uv.x: road units across (-7.5..7.5); uv.y: road units along the curve
      const along = u * length * alongScale
      uvs.set([-halfWidth * acrossScale, along, halfWidth * acrossScale, along], i * 4)
    }

    const indices = []
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3
      indices.push(a, b, c, b, d, c)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(indices)

    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { glow: { value: 1.0 } }
      ]),
      vertexShader: `
        varying vec2 vRoad;
        void main() {
          vRoad = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        uniform float glow;
        varying vec2 vRoad;

        // Same grid as the landing road: magenta lines every 2 road units.
        float line(vec2 coord, float width) {
          vec2 grid = abs(fract(coord - 0.5) - 0.5) / (fwidth(coord) * width);
          return min(min(grid.x, grid.y), 1.0);
        }

        void main() {
          float l = line(vRoad / 2.0, 1.0);
          float x = abs(vRoad.x);
          // Cyan asphalt to 5 units, black shoulder by 7.5 (PalmTreeDrive's base).
          vec3 base = mix(vec3(0.0, 0.75, 1.0), vec3(0.0), smoothstep(5.0, 7.5, x));
          vec3 lineColor = vec3(1.0, 0.0, 0.933); // #ff00ee
          // Let the grid thin out at the ribbon's edge instead of cutting off.
          float edgeFade = 1.0 - smoothstep(6.5, 7.5, x);
          vec3 c = mix(lineColor * edgeFade, base, l);

          // Dashed white centre line: 3 on, 2 off, like the landing road.
          float dash = step(0.5, fract(vRoad.y / 5.0));
          float centre = 1.0 - smoothstep(0.0, 0.2, x);
          c = mix(c, vec3(1.0), centre * dash * 0.8);

          c *= glow;

          float depth = gl_FragCoord.z / gl_FragCoord.w;
          float fogFactor = smoothstep(fogNear, fogFar, depth);
          c = mix(c, fogColor, fogFactor);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      fog: true
    })

    super(geometry, material)
    this.frustumCulled = false
  }
}

class FlyThrough {
  // vehicle: an Object3D kept just ahead of the camera on the curve, facing
  // along it (its +Z points forward, the Object3D.lookAt convention).
  constructor(camera, curve, vehicle, coasterRide = null, stations = []) {
    this.camera = camera
    this.curve = curve
    this.vehicle = vehicle
    this.coasterRide = coasterRide
    this.stations = stations
    this.cameraMode = COASTER_POV.mode
    this.la = new THREE.Vector3()
    this.tangent = new THREE.Vector3()
    this.laVehicle = new THREE.Vector3()
  }

  setCameraMode(mode) {
    this.cameraMode = mode
    const fov = this.coasterRide && mode === 'inside' ? COASTER_POV.fov : 45
    if (this.camera.fov !== fov) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }

  // ride: position along the curve in laps (fraction, may exceed 1).
  update(ride) {
    const cameraA = ride % 1
    const lookAtA = (ride + frac(LOOK_AHEAD)) % 1

    // Turn toward a station as the vehicle passes it (same window as the
    // slow-down). The blend is on the look target, so the camera still
    // rides the track and settles back to forward on the way out.
    const { station, weight } = stationAt(lookAtA, this.stations)
    const gaze = station ? weight * STATION.gaze : 0

    this.curve.getPointAt(cameraA, this.camera.position)
    this.curve.getPointAt(lookAtA, this.la)
    if (gaze > 0) this.la.lerp(station.position, gaze)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(this.la)
    
    // The vehicle sits at the camera's look-ahead point on the curve and
    // faces along the road under it (the curve tangent there), rather than
    // cutting across bends toward a point further ahead.
    this.curve.getPointAt(lookAtA, this.vehicle.position)
    this.curve.getTangentAt(lookAtA, this.tangent)
    this.laVehicle.copy(this.vehicle.position).add(this.tangent)
    this.vehicle.lookAt(this.laVehicle)
    this.coasterRide?.placeVehicle(lookAtA)

    // Apply the rider's POV after the cart's axle-based pose is finalized.
    // Both the eye and target use that pose, so the camera rides the cart
    // through turns and hills without drifting off the seat.
    if (this.coasterRide && this.cameraMode === 'inside') {
      const { eyeHeight, seatOffset } = COASTER_POV
      this.camera.position
        .set(0, eyeHeight, seatOffset)
        .applyQuaternion(this.vehicle.quaternion)
        .add(this.vehicle.position)
      this.laVehicle
        .set(0, eyeHeight, seatOffset + 1)
        .applyQuaternion(this.vehicle.quaternion)
        .add(this.vehicle.position)
      if (gaze > 0) this.laVehicle.lerp(station.position, gaze)
      // The seat's up follows the cart's pitch and bank; looking sideways
      // from a slope turns that into a rolled horizon, so level the view
      // as the gaze takes over and let it return on the way out.
      this.camera.up.set(0, 1, 0).applyQuaternion(this.vehicle.quaternion)
      if (gaze > 0) this.camera.up.lerp(WORLD_UP, gaze).normalize()
      this.camera.lookAt(this.laVehicle)
    }
  }
}

// Load the landing page's low rider and park it on the vehicle rig with its
// tires on the road, scaled from the landing scene down to the tunnel.
// Resolves to the lowRider handle (for per-frame updates and disposal).
function loadLowRider({ rig, renderer, cameraSpeed, onError }) {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  dracoLoader.setWorkerLimit(1)
  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)

  let cancelled = false
  let lowRider = null
  let paint = null

  loader.load(LOW_RIDER_MODEL_URL, (gltf) => {
    if (cancelled) return
    // createLowRider scales the car by 2.7 and faces it down -Z; measure first
    // so the wheel roll rate can be given in the car's own units.
    const native = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3())
    const fitScale = CAR_LENGTH / (native.z * 2.7)
    lowRider = createLowRider(gltf, { roadSpeed: cameraSpeed / fitScale })
    const carScene = lowRider.car
    carScene.updateMatrixWorld(true)

    // createLowRider parks the car in the landing page's lane; centre it on
    // the rig instead (its tires are already grounded at y = 0).
    const centre = new THREE.Box3().setFromObject(carScene).getCenter(new THREE.Vector3())
    carScene.position.x -= centre.x
    carScene.position.z -= centre.z

    paint = createCandyEmeraldPaint(renderer)
    carScene.traverse((child) => {
      if (!child.isMesh) return
      paint.apply(child)
      // The car never leaves the camera's view distance; constant fog would
      // only dim it, and a tiny skinned passenger must not be culled mid-sway.
      child.frustumCulled = false
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        if (!material) continue
        material.fog = false
        // The tunnel blooms the whole frame, so the export's emissive
        // passengers and trim flare out; keep only the lights at full glow.
        if (material.emissive && !/^(headlights|taillights)/i.test(child.name)) {
          material.emissiveIntensity = Math.min(material.emissiveIntensity, 0.35)
        }
      }
    })

    const fit = new THREE.Group()
    fit.name = 'LowRiderFit'
    fit.scale.setScalar(fitScale)
    fit.position.y = -ROAD_DROP
    fit.rotation.y = Math.PI // the car's front (-Z) faces the rig's forward (+Z)
    fit.add(carScene)
    rig.add(fit)
  }, undefined, (error) => {
    if (cancelled) return
    console.warn('Low rider could not load; keeping the ship.', error)
    onError?.()
  })

  return {
    update(dt) { lowRider?.update(dt) },
    dispose() {
      cancelled = true
      lowRider?.dispose()
      dracoLoader.dispose()
    }
  }
}

export default function OldsCoolTunnel({ isFullscreen = false, road = true, canopy = true, car = true, coaster = false, onReady = null }) {
  const { t } = useLanguage()
  // Fires once, after the first frame is on screen (the /hub curtain waits
  // for it). A ref so the loop never closes over a stale prop.
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const frameIdRef = useRef(null)
  const [isPaused, setIsPaused] = React.useState(false)
  const [cameraMode, setCameraMode] = React.useState(COASTER_POV.mode)
  // Ride HUD dimming: idle a few seconds after any change while riding.
  const [hudIdle, setHudIdle] = React.useState(false)
  const [hudHover, setHudHover] = React.useState(false)
  React.useEffect(() => {
    setHudIdle(false)
    if (isPaused) return undefined
    const timer = setTimeout(() => setHudIdle(true), 4000)
    return () => clearTimeout(timer)
  }, [isPaused, cameraMode])
  const cameraModeRef = useRef(COASTER_POV.mode)
  const toggleCameraRef = useRef(null)
  const [focusedImage, setFocusedImage] = React.useState(null)
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const [focusedImageData, setFocusedImageData] = React.useState(null)
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const focusStateRef = useRef({ image: null, index: -1 })
  const wasManuallyPausedRef = useRef(false) // Track if pause was user-initiated

  // Get translated image data
  const getTranslatedImageData = useMemo(() => {
    const translatedImages = t('oldsCoolTunnel.images')
    return (index, baseData) => {
      if (baseData.model) return baseData
      if (translatedImages && Array.isArray(translatedImages) && translatedImages[index]) {
        return {
          ...baseData,
          year: translatedImages[index].year || baseData.year,
          description: translatedImages[index].description || baseData.description
        }
      }
      return baseData
    }
  }, [t])

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#000')
    scene.fog = new THREE.Fog(scene.background, 0.1, 3)
    sceneRef.current = scene

    // Get container dimensions first
    const containerWidth = mountRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)
    const containerHeight = mountRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600)
    
    const camera = new THREE.PerspectiveCamera(
      coaster && cameraModeRef.current === 'inside' ? COASTER_POV.fov : 45,
      containerWidth / containerHeight,
      0.01,
      1000
    )
    camera.position.set(0, 0, 1).setLength(10)
    cameraRef.current = camera
    
    const cameraPositions = {
      tunnel: camera.position.clone(),
      overview: new THREE.Vector3(0, 50, 0),
      originalPosition: null,
      originalRotation: null
    }

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance'
    })
    
    renderer.setPixelRatio(typeof window !== 'undefined' ? window.devicePixelRatio : 1)
    renderer.setSize(containerWidth, containerHeight)
    renderer.toneMapping = THREE.ReinhardToneMapping
    renderer.toneMappingExposure = Math.pow(0.9, 4.0)
    rendererRef.current = renderer
    
    // Ensure canvas is visible
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    
    mountRef.current.appendChild(renderer.domElement)
    
    // Removed OrbitControls - no longer needed

    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerWidth, containerHeight),
      BLOOM.strength, BLOOM.radius, BLOOM.threshold
    )
    composer.addPass(bloomPass)
    
    // Add scanline effect
    const scanlinePass = new ShaderPass(ScanlineShader)
    composer.addPass(scanlinePass)

    // Removed "Old's cool" text - no longer needed

    // Only the vehicle is lit (the wire, points and gallery are unlit), so
    // these are tuned for the low rider under the tunnel's dim exposure: a
    // key from above-right, violet road glow from below, and a soft fill.
    // Kept modest: the full-frame bloom flares the car's white passengers
    // as soon as they go past white.
    const light = new THREE.DirectionalLight(0xffffff, Math.PI * 1.1)
    light.position.setScalar(1)
    scene.add(
      light,
      new THREE.HemisphereLight(0xffffff, 0x4411ff, Math.PI * 0.35),
      new THREE.AmbientLight(0xffffff, Math.PI * 0.2)
    )
    
    const wireTunnel = new WireTunnel({ canopy, smoothPath: coaster })
    scene.add(wireTunnel)

    if (road && !coaster) scene.add(new SynthwaveRoad(wireTunnel.curve))

    const gallery = new FloatingGallery(wireTunnel.curve)
    scene.add(gallery)
    galleryRef.current = gallery
    if (SPOT_HELPER) {
      // e.g. __hubStation.STATION.spot = 24; __hubStation.spots[0].angle = 0.5;
      // __hubStation.spots[0].position.y += 0.2 (helpers follow every frame)
      // Daylight: __hubStation.stations[1].daylight.sunIntensity = 3 (live); DAYLIGHT.* needs a reload
      window.__hubStation = { STATION, DAYLIGHT, gallery, spots: gallery.stations.map(s => s.spot), stations: gallery.stations, shelves: wireTunnel.curve.shelfSpans() }
      console.table(wireTunnel.curve.shelfSpans().map(s => ({ shelf: s.index + 1, from: s.start.toFixed(3), to: s.end.toFixed(3), mid: s.mid.toFixed(3), height: s.height })))
    }
    
    // Removed position arrow - no longer needed
    
    // The vehicle rig rides the curve ahead of the camera. It carries the
    // low rider when it loads, otherwise the original wireframe ship.
    const vehicle = new THREE.Group()
    vehicle.name = 'TunnelVehicle'
    scene.add(vehicle)
    const showShip = () => { vehicle.add(wireTunnel.ship); wireTunnel.ship.visible = true }
    wireTunnel.ship.visible = false
    const coasterLoad = coaster
      ? loadHubCoaster({
        scene, rig: vehicle, curve: wireTunnel.curve, drop: ROAD_DROP, carLength: CAR_LENGTH,
        onError: () => {
          if (road) scene.add(new SynthwaveRoad(wireTunnel.curve))
          showShip()
        }
      })
      : null
    const lowRiderLoad = car && !coaster
      ? loadLowRider({ rig: vehicle, renderer, cameraSpeed: RIDE_SPEED, onError: showShip })
      : null
    if (!car && !coaster) showShip()

    const flyThrough = new FlyThrough(camera, wireTunnel.curve, vehicle, coasterLoad, gallery.stations)
    flyThrough.setCameraMode(cameraModeRef.current)

    let t = 0      // wall clock (seconds) for shader and float animation
    // Ride position in laps, advanced by the speed profile. Starts a lead-in
    // before the first station's strike (the vehicle rides LOOK_AHEAD ahead).
    let ride = 0
    if (gallery.stations.length) {
      const at = Math.max(0, gallery.stations.findIndex((s) => s.root.name === `Station:${START_STATION}`))
      const first = gallery.stations[at] // sorted by u; the first unless ?station= names another
      const strikeU = first.u + strikeOffset(at, gallery.stations)
      ride = strikeU - frac(LEAD_IN_SECONDS * RIDE_SPEED + LOOK_AHEAD)
      ride = ((ride % 1) + 1) % 1
    }
    let isPausedLocal = false
    let firstFrameDone = false
    let lastDaylight = 0
    let lastGloom = 0
    const stormSky = new THREE.Color()
    // Camera shake from a scripted station: an offset added after the camera
    // is posed and removed again before the next pose, so a paused ride
    // (no re-pose) does not accumulate it.
    const shakeOffset = new THREE.Vector3()
    let shakeRoll = 0
    const NIGHT_SKY = new THREE.Color('#000')
    const daySky = new THREE.Color().setStyle(DAYLIGHT.sky, THREE.LinearSRGBColorSpace)
    let lastTime = performance.now()
    const targetFPS = 60
    const frameInterval = 1000 / targetFPS

    // Change only the camera, preserving ride progress and pause state. Apply
    // immediately so switching also works while the simulation is paused.
    const toggleCamera = () => {
      if (!coaster || focusStateRef.current.image) return
      const nextMode = cameraModeRef.current === 'inside' ? 'behind' : 'inside'
      cameraModeRef.current = nextMode
      flyThrough.setCameraMode(nextMode)
      flyThrough.update(ride)
      setCameraMode(nextMode)
    }
    toggleCameraRef.current = toggleCamera

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      
      const currentTime = performance.now()
      const elapsed = currentTime - lastTime
      
      // Throttle to target FPS
      if (elapsed > frameInterval) {
        const dt = elapsed / 1000 // Convert to seconds
        lastTime = currentTime - (elapsed % frameInterval)
        
        t += dt
        camera.position.sub(shakeOffset)
        if (shakeRoll) camera.rotateZ(-shakeRoll)
        if (!isPausedLocal) {
          // Slow through stations, measured at the vehicle, not the camera.
          const pace = rideSpeedAt((ride + frac(LOOK_AHEAD)) % 1, gallery.stations)
          ride += frac(RIDE_SPEED) * pace * dt
          flyThrough.update(ride)
          lowRiderLoad?.update(dt * pace)
        }
        
        // Every frame, paused or not, so spotlight tuning applies live.
        gallery.setRide((ride + frac(LOOK_AHEAD)) % 1)
        gallery.update(t, camera)
        // Camera shake: a jitter of a few millimetres plus a faint roll, from
        // incommensurate sines so it never settles into a rhythm.
        const shake = focusStateRef.current.image ? 0 : gallery.shake
        if (shake > 0) {
          const k = 0.0002 * shake
          shakeOffset.set(
            (Math.sin(t * 37.1) + 0.5 * Math.sin(t * 23.7 + 1.3)) * k,
            (Math.sin(t * 41.3 + 0.7) + 0.5 * Math.sin(t * 19.1 + 2.1)) * k,
            (Math.sin(t * 29.7 + 2.9) + 0.5 * Math.sin(t * 47.3)) * k
          )
          shakeRoll = (Math.sin(t * 31.3 + 0.4) + 0.5 * Math.sin(t * 17.9 + 1.9)) * 0.0012 * shake
        } else {
          shakeOffset.set(0, 0, 0)
          shakeRoll = 0
        }
        camera.position.add(shakeOffset)
        if (shakeRoll) camera.rotateZ(shakeRoll)
        wireTunnel.setHouseLights(houseWeight((ride + frac(LOOK_AHEAD)) % 1, gallery.stations))
        // Daytime station: the black tunnel and fog lerp toward the
        // station's sky for the pass, then back to night.
        if (gallery.daylight !== lastDaylight || gallery.gloom !== lastGloom) {
          lastDaylight = gallery.daylight
          lastGloom = gallery.gloom
          const sky = gallery.daylightStation?.daylight
          if (sky) {
            daySky.setStyle(sky.sky, THREE.LinearSRGBColorSpace)
            if (lastGloom > 0) daySky.lerp(stormSky.setStyle(sky.storm.sky, THREE.LinearSRGBColorSpace), lastGloom)
          }
          scene.background.copy(NIGHT_SKY).lerp(daySky, lastDaylight)
          scene.fog.color.copy(scene.background)
        }
        
        // Update scanline shader time
        if (scanlinePass && scanlinePass.uniforms.time) {
          scanlinePass.uniforms.time.value = t
        }
        
        if (composer) {
          composer.render()
        } else {
          renderer.render(scene, camera)
        }
        if (!firstFrameDone) {
          firstFrameDone = true
          onReadyRef.current?.()
        }
      }
    }

    const handleResize = () => {
      const width = mountRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)
      const height = mountRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      if (composer) {
        composer.setSize(width, height)
      }
    }

    const handleKeyPress = (e) => {
      // Only handle key presses in fullscreen mode
      if (!isFullscreen || e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return

      if (coaster && e.code === 'KeyV' && !focusStateRef.current.image) {
        e.preventDefault()
        toggleCamera()
        return
      }

      // N: skip ahead. Inside a station's window it jumps to the end of
      // that window (release); on open track it jumps to just before the
      // next station's spotlight strikes, cutting the dark travel.
      if (coaster && e.code === 'KeyN' && gallery.stations.length) {
        e.preventDefault()
        const vehicle = (ride + frac(LOOK_AHEAD)) % 1
        const wrap = (x) => ((x % 1) + 1) % 1
        const { station: current, weight } = stationAt(vehicle, gallery.stations)
        let target
        if (weight > 0) {
          target = current.u + frac(current.hold + STATION.release)
        } else {
          let best = Infinity
          gallery.stations.forEach((s, i) => {
            const strike = wrap(s.u + strikeOffset(i, gallery.stations) - frac(0.5))
            const ahead = wrap(strike - vehicle)
            if (ahead < best) { best = ahead; target = strike }
          })
        }
        ride = wrap(target - frac(LOOK_AHEAD))
        flyThrough.update(ride)
        return
      }

      if (e.code === 'Space') {
        // Let native button/link keyboard activation run without also
        // pausing the ride when the view button has focus.
        if (target instanceof HTMLElement && target.closest('button, a')) return
        e.preventDefault()
        isPausedLocal = !isPausedLocal
        wasManuallyPausedRef.current = isPausedLocal // Track manual pause state
        setIsPaused(isPausedLocal)
      }
      
      if (e.code === 'Escape' && focusStateRef.current.image) {
        focusStateRef.current = { image: null, index: -1 }
        setFocusedImage(null)
        setFocusedIndex(-1)
        setFocusedImageData(null)
        // Restore the pause state from before entering gallery
        isPausedLocal = wasManuallyPausedRef.current
        setIsPaused(wasManuallyPausedRef.current)
      }
      
      // Arrow keys for navigation when focused
      if (focusStateRef.current.image && galleryRef.current) {
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          const prevIndex = (focusStateRef.current.index - 1 + galleryRef.current.images.length) % galleryRef.current.images.length
          focusStateRef.current = { image: galleryRef.current.images[prevIndex], index: prevIndex }
          setFocusedImage(galleryRef.current.images[prevIndex])
          setFocusedIndex(prevIndex)
          setFocusedImageData(galleryRef.current.imageData[prevIndex])
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault()
          const nextIndex = (focusStateRef.current.index + 1) % galleryRef.current.images.length
          focusStateRef.current = { image: galleryRef.current.images[nextIndex], index: nextIndex }
          setFocusedImage(galleryRef.current.images[nextIndex])
          setFocusedIndex(nextIndex)
          setFocusedImageData(galleryRef.current.imageData[nextIndex])
        }
      }
      
    }
    
    const handleTouch = (e) => {
      // In portal view, don't handle touch events - let parent handle opening fullscreen
      if (!isFullscreen) {
        return
      }
      
      e.preventDefault()
      
      // If already focused on an image, unfocus first
      if (focusStateRef.current.image) {
        focusStateRef.current = { image: null, index: -1 }
        setFocusedImage(null)
        setFocusedIndex(-1)
        setFocusedImageData(null)
        isPausedLocal = false
        setIsPaused(false)
        return
      }
      
      // If paused, check if clicking on an image
      if (isPausedLocal) {
        const rect = renderer.domElement.getBoundingClientRect()
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
        
        mouseRef.current.x = (x / rect.width) * 2 - 1
        mouseRef.current.y = -(y / rect.height) * 2 + 1
        
        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        
        if (galleryRef.current && galleryRef.current.images) {
          const intersects = raycasterRef.current.intersectObjects(galleryRef.current.images, true)
          
          if (intersects.length > 0) {
            const clickedImage = galleryRef.current.rootOf(intersects[0].object)
            const imageIndex = galleryRef.current.images.indexOf(clickedImage)
            
            if (imageIndex !== -1) {
              // Store original camera position
              cameraPositions.originalPosition = camera.position.clone()
              cameraPositions.originalRotation = camera.rotation.clone()
              
              // Focus on the clicked image
              focusStateRef.current = { image: clickedImage, index: imageIndex }
              setFocusedImage(clickedImage)
              setFocusedIndex(imageIndex)
              setFocusedImageData(galleryRef.current.imageData[imageIndex])
              return
            }
          }
        }
      }
      
      // Default behavior - toggle pause
      isPausedLocal = !isPausedLocal
      wasManuallyPausedRef.current = isPausedLocal // Track manual pause state
      setIsPaused(isPausedLocal)
    }
    
    const handleClick = (e) => {
      // In portal view, don't handle click events - let parent handle opening fullscreen
      if (!isFullscreen) {
        return
      }
      
      // Handle click when focused to exit focus mode
      if (focusStateRef.current.image && !e.touches) {
        // Check if clicking on UI buttons (they have stopPropagation)
        if (!e.defaultPrevented) {
          focusStateRef.current = { image: null, index: -1 }
          setFocusedImage(null)
          setFocusedIndex(-1)
          setFocusedImageData(null)
          // Restore the pause state from before entering gallery
          isPausedLocal = wasManuallyPausedRef.current
          setIsPaused(wasManuallyPausedRef.current)
        }
        return
      }
      // Same as touch but for mouse clicks when paused
      if (isPausedLocal && !e.touches) {
        handleTouch(e)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)
      window.addEventListener('keydown', handleKeyPress)
    }
    
    // Add touch and click event listeners to the renderer's canvas
    renderer.domElement.addEventListener('touchstart', handleTouch)
    renderer.domElement.addEventListener('click', handleClick)
    
    animate()

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('keydown', handleKeyPress)
      }
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('touchstart', handleTouch)
        renderer.domElement.removeEventListener('click', handleClick)
      }
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }

      toggleCameraRef.current = null
      lowRiderLoad?.dispose()
      coasterLoad?.dispose()
      
      // Dispose of gallery resources
      if (gallery && gallery.dispose) {
        gallery.dispose()
      }
      
      // Dispose of composer and passes
      if (composer) {
        composer.passes.forEach(pass => {
          if (pass.dispose) pass.dispose()
        })
      }
      
      // Traverse and dispose all scene objects
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose()
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose())
            } else {
              object.material.dispose()
            }
          }
          if (object.texture) object.texture.dispose()
        })
        sceneRef.current.clear()
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current.forceContextLoss()
        if (mountRef.current && rendererRef.current.domElement) {
          mountRef.current.removeChild(rendererRef.current.domElement)
        }
      }
    }
  }, [isFullscreen, road, canopy, car, coaster])

  // Apply translations to focused image data when index changes
  useEffect(() => {
    if (focusedIndex >= 0 && galleryRef.current && galleryRef.current.imageData[focusedIndex]) {
      setFocusedImageData(getTranslatedImageData(focusedIndex, galleryRef.current.imageData[focusedIndex]))
    }
  }, [focusedIndex, getTranslatedImageData])

  // No camera animation needed - we'll display the image separately

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div 
        ref={mountRef} 
        style={{ 
          width: '100%', 
          height: '100vh', 
          overflow: 'hidden',
          position: 'relative',
          margin: 0
        }} 
      />
      {isFullscreen && !focusedImage && (
        // Ride HUD: a one-line pill in the bottom-left corner, out of the
        // dioramas' way (they sit centre-frame when the cart turns to them).
        // It dims after a few seconds of riding and returns on pause or hover.
        <div
          onMouseEnter={() => setHudHover(true)}
          onMouseLeave={() => setHudHover(false)}
          style={{
            position: 'absolute',
            left: 'max(1rem, env(safe-area-inset-left))',
            bottom: 'calc(1rem + env(safe-area-inset-bottom))',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px 12px',
            maxWidth: 'calc(100vw - 2rem)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: '#fa0',
            padding: '6px 12px',
            borderRadius: '999px',
            fontFamily: 'Tourney, monospace',
            fontSize: '13px',
            lineHeight: 1.2,
            border: '1px solid #41f',
            zIndex: 1000,
            opacity: hudIdle && !hudHover && !isPaused ? 0.35 : 1,
            transition: 'opacity 0.6s ease',
            pointerEvents: 'none',
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>{isPaused ? `⏸ ${t('oldsCoolTunnel.ui.paused') || 'PAUSED'}` : `▶ ${t('oldsCoolTunnel.ui.playing') || 'PLAYING'}`}</span>
          <span style={{ color: '#8af', whiteSpace: 'nowrap' }}>
            {isPaused ?
              (typeof window !== 'undefined' && 'ontouchstart' in window ? (t('oldsCoolTunnel.ui.tapImageFocus') || 'Tap an image to focus') : (t('oldsCoolTunnel.ui.clickImageFocus') || 'Click an image to focus')) :
              (typeof window !== 'undefined' && 'ontouchstart' in window ? (t('oldsCoolTunnel.ui.tapToPause') || 'Tap to Pause') : (t('oldsCoolTunnel.ui.pressSpacePause') || 'Press SPACE to Pause'))
            }
          </span>
          {coaster && (
            <button
              type="button"
              aria-label={`Switch to ${cameraMode === 'inside' ? 'behind-cart' : 'inside-cart'} view`}
              aria-keyshortcuts="V"
              title="Switch camera view (V)"
              onClick={(event) => {
                event.stopPropagation()
                toggleCameraRef.current?.()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '32px',
                padding: '4px 10px',
                border: '1px solid #8af',
                borderRadius: '999px',
                background: 'rgba(65, 17, 255, 0.18)',
                color: '#fff4e8',
                fontFamily: 'inherit',
                fontSize: '13px',
                cursor: 'pointer',
                pointerEvents: 'auto',
                touchAction: 'manipulation',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{cameraMode === 'inside' ? 'Inside cart' : 'Behind cart'}</span>
              <span aria-hidden="true" style={{ color: '#8af' }}>⇄ V</span>
            </button>
          )}
          {isPaused && (
            <span style={{ fontSize: '12px', color: '#fa0', whiteSpace: 'nowrap' }}>
              🔍 {t('oldsCoolTunnel.ui.selectImageDetail') || 'Select image for detailed view'}
            </span>
          )}
        </div>
      )}
      
      {/* Focused Image Overlay */}
      {isFullscreen && focusedImageData && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer'
          }}
          onClick={() => {
            focusStateRef.current = { image: null, index: -1 }
            setFocusedImage(null)
            setFocusedIndex(-1)
            setFocusedImageData(null)
            // Restore the pause state from before entering gallery
            setIsPaused(wasManuallyPausedRef.current)
          }}
        >
          {/* Image Display */}
          {focusedImageData.url && <img 
            src={focusedImageData.url} 
            alt={focusedImageData.year}
            style={{
              maxWidth: '90%',
              maxHeight: '60vh',
              objectFit: 'contain',
              border: '3px solid #41f',
              borderRadius: '10px',
              boxShadow: '0 0 30px rgba(65, 17, 255, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          />}
          
          {/* Info Panel */}
          <div 
            style={{
              marginTop: '30px',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: '#fa0',
              padding: '20px 30px',
              borderRadius: '10px',
              fontFamily: 'Tourney, monospace',
              fontSize: '20px',
              // border: '2px solid #41f',
              textAlign: 'center',
              minWidth: '300px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px', color: '#fff' }}>
              {focusedImageData.year}
            </div>
            {focusedImageData.description && (
              <div style={{ fontSize: '16px', color: '#fa0', marginBottom: '15px', fontStyle: 'italic' }}>
                "{focusedImageData.description}"
              </div>
            )}
            {/* <div style={{ fontSize: '14px', color: '#8af', marginTop: '15px' }}>
              {typeof window !== 'undefined' && 'ontouchstart' in window ? 'Tap outside to exit' : 'Click outside or ESC to exit'}
            </div> */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '15px',
            gap: '20px'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const prevIndex = (focusedIndex - 1 + galleryRef.current.images.length) % galleryRef.current.images.length
                focusStateRef.current = { image: galleryRef.current.images[prevIndex], index: prevIndex }
                setFocusedImage(galleryRef.current.images[prevIndex])
                setFocusedIndex(prevIndex)
                setFocusedImageData(getTranslatedImageData(prevIndex, galleryRef.current.imageData[prevIndex]))
              }}
              style={{
                background: 'transparent',
                border: '2px solid #41f',
                color: '#8af',
                padding: '5px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ← {t('oldsCoolTunnel.ui.previous') || 'Previous'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const nextIndex = (focusedIndex + 1) % galleryRef.current.images.length
                focusStateRef.current = { image: galleryRef.current.images[nextIndex], index: nextIndex }
                setFocusedImage(galleryRef.current.images[nextIndex])
                setFocusedIndex(nextIndex)
                setFocusedImageData(getTranslatedImageData(nextIndex, galleryRef.current.imageData[nextIndex]))
              }}
              style={{
                background: 'transparent',
                border: '2px solid #41f',
                color: '#8af',
                padding: '5px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              {t('oldsCoolTunnel.ui.next') || 'Next'} →
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}