import * as THREE from 'three'

// The oil gusher: the Paraboleum/Lyquid80 opal geyser column from the
// /hailmary field (OilVoxelGrid), shared with the /hub tunnel's Oil Field
// diorama. A Y-locked billboard plane (0.9 x 3.0 in the field, 1 x 1 scaled
// in the tunnel) fed uTime, uOpacity and the mode uniforms below.
// Moved here from OilVoxelGrid.jsx on 2026-10-15; the GLSL is unchanged.
const _v3 = (c) => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`;

// Recolors the erupting gusher (geyser shader) AND its ground spill/splatter to a
// teal/green/blue variant of the opal substance: full thin-film iridescence +
// bloom + glitter (the "wow"), but the spectrum is held green/blue-dominant (red
// kept low) so pink is structurally impossible. Scoped to the eruption: the 5
// voxel surfaces, side panels, rig tint, and wellhead idle glow stay on stock
// opal. To revert, delete GUSHER_IRID + gusherPalette and swap the geyser+spill
// shaders' gusherPalette/GUSHER_IRID refs back to iridPalette/ACTIVE_IRID.
export const GUSHER_IRID = {
  // ABYSS TEAL: cycles emerald GREEN → TEAL → deep BLUE → CYAN. Red is held LOW
  // across the whole cycle (a.r=0.10) so green/blue always dominate — pink is
  // structurally impossible (it needs high red). Green & blue swing out of phase
  // to roll through the teal→blue→cyan band. Dark ocean-teal base; bright cyan
  // bloom + high sheen keep the opal wow.
  // Green & blue held ANTI-PHASE (dG=0, dB=0.5) so the column swings the full
  // distance spring-GREEN → TEAL → deep BLUE → TEAL for visible banding, not one
  // flat cyan. A little red rides the green end for a warm spring-green (blue stays
  // low there → no pink).
  a: [0.12, 0.55, 0.58], b: [0.12, 0.42, 0.42], c: [1.0, 1.0, 1.0], d: [0.00, 0.00, 0.50],
  base:   [0.02, 0.07, 0.13],  // dark ocean-teal (the dark body reads deep teal)
  baseHi: [0.08, 0.30, 0.34],  // teal mid
  glow:   [0.14, 0.68, 0.90],  // electric cyan bloom, eased so the banding shows
  sheen: 1.9,
};
export const GUSHER_GLSL = `
vec3 gusherPalette(float t) {
  return ${_v3(GUSHER_IRID.a)} + ${_v3(GUSHER_IRID.b)} * cos(6.28318530718 * (${_v3(GUSHER_IRID.c)} * t + ${_v3(GUSHER_IRID.d)}));
}
`;

// ── Oil Geyser Shader (GPU-driven upward gusher) ────────────────────────────
export const GEYSER_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GEYSER_FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
uniform float uNightMode;
uniform float uParabolum;
uniform float uHell;
uniform float uTint;     // motherlode: push the column toward molten gold (0 otherwise)
uniform vec2 uResolution;
// Neck (tunnel derrick): below this plane height the column stays a bare
// jet; the spread and cap open above it, scaled by uFlare. 0 = off (field).
uniform float uNeck;
uniform float uFlare;

// Hash and noise
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i), f),
                 dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                 dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}
${GUSHER_GLSL}
void main() {
  float x = vUv.x - 0.5;
  // When viewing the back face, flip x so the flow pattern stays consistent
  if (!gl_FrontFacing) x = -x;
  float y = vUv.y;

  float T = uTime;

  // ── Fast scrolling noise layers that rush UPWARD ──
  // Key: subtract time from y so the pattern moves up. Hell roars ~1.7x faster so
  // it reads as superheated gas/flame rather than flowing liquid.
  float tScale = mix(1.0, 1.7, uHell);
  float scroll1 = fbm(vec2(x * 8.0, y * 5.0 - T * 4.0 * tScale));
  float scroll2 = fbm(vec2(x * 10.0 + 3.7, y * 6.0 - T * 5.0 * tScale + 1.3));
  float scroll3 = fbm(vec2(x * 14.0 - 1.1, y * 8.0 - T * 6.0 * tScale + 5.7));

  // Combine into turbulent displacement
  float turb = scroll1 * 0.55 + scroll2 * 0.3 + scroll3 * 0.15;

  // Extra-fast flicker layer for hell — drives flame-tongue sway and brightness
  // flicker. Roughly -0.5..0.5; we offset to taste below.
  float flameFlick = fbm(vec2(x * 9.0 + 1.7, y * 11.0 - T * 12.0));

  // Shape height: with a neck, the opening profile is remapped to the part
  // of the plane above it (the jet below stays at baseWidth).
  float ys = uNeck > 0.0 ? max(y - uNeck, 0.0) / (1.0 - uNeck) : y;
  float flare = uNeck > 0.0 ? uFlare : 1.0;

  // ── Column shape (oil): narrow jet at base, cresting cap that curls back down ──
  float baseWidth = 0.06;
  float spread = 0.35 * ys * ys * flare; // quadratic spread up the jet
  float wobble = scroll1 * 0.1 * ys;

  // Cap zone: oil mushrooms outward starting at ys ~0.55
  float capZone = smoothstep(0.55, 0.78, ys);
  float capBulge = capZone * 0.28 * flare;
  // Lobes push outward from center
  float capLobe = capZone * sign(x + 0.001) * (fbm(vec2(abs(x) * 6.0 - T * 1.5, y * 4.0 + T * 2.0)) * 0.12 * flare);

  float oilWidth = baseWidth + spread + capBulge + abs(capLobe);
  float oilXOff = x + wobble + capLobe;
  // Soft inner edge: in the cap, the boundary becomes a wide gentle gradient
  float oilInner = mix(oilWidth * 0.3, oilWidth * 0.0, capZone);

  // ── Furnace-blast shape (hell): a torch-flame teardrop — narrow nozzle at the
  //    wellmouth, billowing belly, tapering to flickering tongues. No liquid cap. ──
  float fl = flameFlick - 0.5; // ~ -1..0; magnitude drives raggedness
  float belly = 0.26 * smoothstep(0.02, 0.30, y) * (1.0 - smoothstep(0.32, 0.96, y));
  float ragged = abs(fl) * 0.10 * (0.4 + y);                  // turbulent flickering edge
  float tongues = smoothstep(0.55, 1.0, y) * abs(fl) * 0.16;  // flame tips lick upward
  // Scaled in a touch so the flame base stays within the pad instead of
  // spilling its shader edge onto the ground past the wellhead.
  float hellWidth = (baseWidth + belly + ragged + tongues) * 0.78;
  float hellXOff = x + wobble * 1.4 + fl * 0.16 * y;          // flames sway, not a tidy column
  float hellInner = hellWidth * 0.05;                         // soft, gaseous — no hard liquid wall

  float columnWidth = mix(oilWidth, hellWidth, uHell);
  float xOff = mix(oilXOff, hellXOff, uHell);
  float innerEdge = mix(oilInner, hellInner, uHell);
  float shape = smoothstep(columnWidth, innerEdge, abs(xOff));

  // ── Vertical profile ──
  float coreDensity = smoothstep(0.0, 0.08, y);

  // Oil stays solid (no smoke dissipation); hell stays fairly dense in the belly
  // but breaks up into flickering flame toward the tips.
  float wispiness = mix(mix(0.85, 0.4, y), mix(0.92, 0.78, y), uHell);
  float density = mix(turb * 0.5 + 0.5, 1.0, wispiness) * coreDensity;

  // Chaotic blobs rushing upward
  float blobs = noise(vec2(x * 10.0, y * 8.0 - T * 5.0 * tScale));
  blobs = smoothstep(0.1, 0.5, blobs) * (1.0 - y * 0.3);
  density = max(density, blobs * 0.8);

  // Oil: dense mushroom cap fill. Hell skips the cap entirely (no liquid crest).
  float capDensity = capZone * (fbm(vec2(sign(x + 0.001) * abs(x) * 2.0 - sign(x + 0.001) * T * 2.0, y * 5.0 - T * 0.8)) * 0.4 + 0.6);
  density = mix(mix(density, max(density, capDensity), capZone), density, uHell);

  // Hell: flicker the brightness and taper density toward the tips so the flame
  // licks and dies out up top instead of standing as a solid wall.
  float flameDensity = (0.62 + 0.55 * flameFlick) * (1.0 - smoothstep(0.35, 1.0, y) * 0.72);
  density *= mix(1.0, flameDensity, uHell);
  density = max(density, 0.0);

  // ── Color: very dark oil with occasional slick highlights ──
  vec3 darkOil = vec3(0.03, 0.015, 0.008);
  vec3 midOil = vec3(0.08, 0.04, 0.02);
  vec3 highlight = vec3(0.15, 0.10, 0.06);

  // Night mode: shift palette toward emissive blue
  vec3 darkOilNight = vec3(0.01, 0.02, 0.08);
  vec3 midOilNight = vec3(0.03, 0.06, 0.18);
  vec3 highlightNight = vec3(0.08, 0.15, 0.4);
  darkOil = mix(darkOil, darkOilNight, uNightMode);
  midOil = mix(midOil, midOilNight, uNightMode);
  highlight = mix(highlight, highlightNight, uNightMode);

  // Paraboleum: iridescent opal gusher (overrides night when active). Dark teal
  // base; the rainbow sheen is layered on after compositing below.
  darkOil = mix(darkOil, ${_v3(GUSHER_IRID.base)}, uParabolum);
  midOil = mix(midOil, ${_v3(GUSHER_IRID.baseHi)} * 0.6, uParabolum);
  highlight = mix(highlight, ${_v3(GUSHER_IRID.baseHi)}, uParabolum);

  // Hell: a fiery eruption — charred-red base, molten-orange body, red-orange crests
  darkOil = mix(darkOil, vec3(0.26, 0.02, 0.0), uHell);
  midOil = mix(midOil, vec3(0.95, 0.16, 0.01), uHell);
  highlight = mix(highlight, vec3(1.8, 0.55, 0.06), uHell);

  float colorNoise = scroll2 * 0.5 + 0.5;
  vec3 col = mix(darkOil, midOil, colorNoise);
  col = mix(col, highlight, pow(max(density, 0.0), 4.0) * 0.6);

  // Iridescent oil-slick sheen: bands of petrol-rainbow that flow up the column
  // and drift over time. abs(x) fakes a grazing/fresnel term so the sheen
  // intensifies toward the rounded edges of the gusher, like light off a film.
  float irFres = pow(clamp(abs(x) * 2.0, 0.0, 1.0), 1.3);
  // Higher vertical frequency = more rainbow bands stacked up the column; the 0.5
  // floor spreads the sheen across the full width (not just the edges) so the
  // whole gusher cycles through the spectrum instead of glowing a single hue.
  float irPhase = fract(y * 1.7 - T * 0.14 + fbm(vec2(x * 3.5, y * 2.2 - T * 0.1)) * 0.4 + abs(x) * 0.6);
  // Chromatic dispersion: per-channel phase split. A base split applies across the
  // whole width so the rainbow reads everywhere, and fans out further at the grazing
  // silhouette (irFres) for a strong prismatic edge fringe — light splitting through
  // an oil film.
  float disp = 0.05 + 0.12 * irFres;
  vec3 irSheen = vec3(
    gusherPalette(irPhase + disp).r,
    gusherPalette(irPhase).g,
    gusherPalette(irPhase - disp).b
  );
  // Sheen carried up the FULL column (looser density gate) and stronger overall.
  float irAmt = uParabolum * (0.38 + 0.5 * irFres) * smoothstep(0.02, 0.2, density) * ${GUSHER_IRID.sheen.toFixed(3)};
  col = mix(col, irSheen, irAmt * 0.7) + irSheen * irAmt * 0.5;

  // ── Glitter motes: bright iridescent flecks streaming up the FULL height of the
  //    column, twinkling as they rise (sparser/dimmer toward the top, like rising
  //    embers). Two noise octaves give a mix of fine + coarse sparkles. They boost
  //    BOTH color and alpha (see compositing below) so they twinkle against the sky
  //    rather than vanishing where the jet thins out. Parabolum-only. ──
  float moteN  = noise(vec2(x * 50.0, y * 36.0 - T * 9.0)) * 0.5 + 0.5;
  float moteN2 = noise(vec2(x * 84.0 + 19.0, y * 60.0 - T * 14.0)) * 0.5 + 0.5;
  float moteTwinkle = 0.55 + 0.45 * sin(T * 16.0 + x * 47.0 + y * 31.0);
  float moteHeight = mix(1.0, 0.5, y); // thin out gently up top
  float motes = (smoothstep(0.66, 0.9, moteN) + smoothstep(0.78, 0.95, moteN2))
              * moteTwinkle * moteHeight * uParabolum * shape;
  // Cool cyan-white glitter biased toward the palette — sparkle for the opal wow
  // without washing the column white. Tinted by the teal spectrum, dimmed a touch.
  vec3 moteCol = mix(vec3(0.70, 0.92, 0.95), gusherPalette(fract(irPhase + 0.5)), 0.55);
  col += moteCol * motes * 1.6;

  // Hell: white-hot furnace mouth at the base, cooling to red-orange up the flame.
  // Confined to the bottom ~45% so the body stays red-orange, not yellow.
  float heat = (1.0 - smoothstep(0.0, 0.45, y)) * uHell * coreDensity;
  col = mix(col, vec3(2.1, 1.05, 0.4), heat * 0.5);

  // Emissive glow — blue at night, neon-green for Paraboleum, molten-orange for hell
  float emissive = max(max(uNightMode, uParabolum), uHell) * (0.3 + 0.45 * pow(max(density, 0.0), 2.0));
  // Extra bloom for the cosmic-opal gusher (parabolum only — night/hell unchanged).
  emissive *= mix(1.0, 1.2, uParabolum);
  vec3 glowCol = mix(vec3(0.05, 0.1, 1.35), ${_v3(GUSHER_IRID.glow)}, uParabolum);
  glowCol = mix(glowCol, vec3(2.4, 0.5, 0.04), uHell);
  col += glowCol * emissive;

  // White guard: the dense core stacks body + sheen + bloom + motes additively and
  // clips to white. Where luminance runs hot, pull it back toward a cyan-teal hue
  // (scaled by that luminance so it stays bright, just cyan instead of white).
  // Parabolum-only so night/hell keep their own hot cores.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(0.18, 0.82, 0.92) * lum, smoothstep(0.9, 1.5, lum) * uParabolum * 0.5);

  // ── Alpha compositing ──
  float alpha = shape * density * uOpacity;
  // Solid core boost
  float coreBoost = smoothstep(columnWidth * 0.5, 0.0, abs(xOff)) * coreDensity * 0.5;
  alpha = min(alpha + coreBoost * uOpacity, 1.0);
  // Glitter motes carry their OWN alpha so they sparkle against the sky up the whole
  // column, even where the jet has thinned to near-transparent. Clamped via the
  // dome/edge fade below so they still respect the silhouette.
  alpha = max(alpha, clamp(motes, 0.0, 1.0) * uOpacity * 0.9);

  // Top fade. Oil rounds into a dome; hell tapers into ragged, flickering flame
  // tips that dissipate higher up the plane.
  float domeCenter = 0.65; // y-center of the dome
  float dx = x * 1.8; // stretch x so dome is taller than wide
  float dy = max(ys - domeCenter, 0.0); // only fade above dome center
  float domeDist = sqrt(dx * dx + dy * dy);
  float domeFade = smoothstep(0.4, 0.05, domeDist);
  // Flame-tip fade: 1 through the body, falling to 0 at a flickering, noise-jittered
  // top edge so the tongues lick and break up instead of ending in a clean dome.
  float hellTop = smoothstep(1.0, 0.74 + flameFlick * 0.16, y);
  float topFade = mix(domeFade, hellTop, uHell);

  // Edge fade — sides and bottom
  float edgeFade = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x)
                 * smoothstep(0.0, 0.02, y) * topFade;
  alpha *= edgeFade;
  // Neck mode: the whole plane is in view, so the plume must die out before
  // the plane's top edge (the dome fade alone leaves a faint hard cut).
  if (uNeck > 0.0) alpha *= smoothstep(1.0, 0.78, ys);

  // Motherlode tint — nudge the iridescent column toward a hot molten gold so the
  // richest strikes read as richer, not merely taller. Disabled for the hell fire
  // path (it owns its own fiery palette) and 0 for strike/gusher tiers.
  col = mix(col, col * vec3(1.5, 1.18, 0.55) + vec3(0.14, 0.07, 0.0), uTint * (1.0 - uHell));

  gl_FragColor = vec4(col, alpha);
}
`;


// Fresh uniforms for one geyser instance (the field and the tunnel each own theirs).
export function geyserUniforms({ parabolum = 1, night = 0, hell = 0, tint = 0, neck = 0, flare = 1 } = {}) {
  return {
    uTime: { value: 0 },
    uOpacity: { value: 1.0 },
    uNightMode: { value: night },
    uParabolum: { value: parabolum },
    uHell: { value: hell },
    uTint: { value: tint },
    uResolution: { value: new THREE.Vector2(256, 512) },
    uNeck: { value: neck },
    uFlare: { value: flare },
  }
}
