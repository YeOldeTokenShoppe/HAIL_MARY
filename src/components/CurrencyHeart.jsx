"use client";

import React from "react";
import { HEART_HOLO } from "../game/rcana/cardFace.js";

// The rarity mark's geometry: the site's own favicon heart and arrow, paths
// lifted from /favicon.svg. The dark copy behind each shape is the icon's own
// drop shadow, which is what keeps it legible on parchment. Everything that
// draws the mark — the flat ink tiers, the foil patch, the currency OVD — is
// built on these four paths, inside the favicon's own transform.
export const HEART_SHADOW =
  "M246.281,61.414C244.75,56.211 239.805,52.113 233.957,52.113C229.051,52.113 224.785,54.883 222.629,58.949C220.473,54.883 216.211,52.113 211.301,52.113C205.188,52.113 199.836,56.211 198.785,62.164C196.125,77.254 213.004,89.066 222.668,96.129C231.602,89.598 250.66,76.285 246.281,61.414Z";
export const HEART =
  "M243.715,60.457C242.215,55.371 237.383,51.363 231.664,51.363C226.867,51.363 222.699,54.07 220.59,58.047C218.484,54.07 214.312,51.363 209.516,51.363C203.535,51.363 198.309,55.371 197.281,61.188C194.676,75.941 211.18,87.492 220.629,94.395C229.363,88.012 247.996,74.992 243.715,60.457Z";
export const ARROW_SHADOW =
  "M199,90.207L216.801,72.309L219.883,76.758L237.043,59.594L229.113,58.777L250.652,54.816L245.484,71.629L244.566,64.637L218.633,83.449L215.66,79.781L199,90.207Z";
export const ARROW =
  "M197.754,89.027L215.555,71.133L218.633,75.582L235.797,58.418L227.867,57.598L249.406,53.641L244.238,70.453L243.32,63.461L217.387,82.273L214.414,78.605L197.754,89.027Z";
export const FAVICON_TRANSFORM = "translate(-262.671875,-68.484385) scale(1.333333)";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const pct = (v) => `${Math.max(0, Math.min(100, v)).toFixed(2)}%`;

// A currency-style optically variable device — the patch struck into a
// banknote. It is NOT a tinted rainbow over the heart: it is mirror-silver
// stock, engraved, and the tilt is what puts colour into the engraving.
//
//   - the mirror: a striped chrome ramp that rotates and slides with the tilt
//   - the grating: concentric rings cut into the stock, with a narrow lit
//     annulus that travels outward as the card turns — a few rings flare at a
//     time, the way a diffraction ring on a note pulses
//   - a second, off-centre rosette at another pitch, lit in the opposite
//     direction, so the two rulings beat against each other (guilloché)
//   - the band: one hard-edged pass of the spectrum sweeping diagonally
//   - the latent image: "80", unreadable straight on, resolving tilted right
//   - microtext on a circle, flaring when tilted left
//   - one white glint, a bright keyline, and the arrow printed over it all
//
// `dx`/`dy` are the card's tilt in -1..1, the same signal the flame light
// reads, so the OVD turns with the rest of the card.
export const CurrencyHeart = React.memo(function CurrencyHeart({ uid, height, dx, dy, arrow = true }) {
  const C = HEART_HOLO.currency;
  const bands = HEART_HOLO.bands;

  // A hard-edged spectral band between two offsets (in %), transparent on
  // either side. Two stops per colour at the same offset: ruled, not blended.
  const spectrum = (from, to, key) => {
    const n = bands.length;
    const w = (to - from) / n;
    const out = [<stop key={`${key}0`} offset={pct(from)} stopColor={bands[0]} stopOpacity="0" />];
    bands.forEach((c, i) => {
      out.push(<stop key={`${key}${i}a`} offset={pct(from + i * w)} stopColor={c} />);
      out.push(<stop key={`${key}${i}b`} offset={pct(from + (i + 1) * w)} stopColor={c} />);
    });
    out.push(<stop key={`${key}z`} offset={pct(to)} stopColor={bands[n - 1]} stopOpacity="0" />);
    return out;
  };

  const radii = ({ from, to, step }) => {
    const rs = [];
    for (let r = from; r <= to; r += step) rs.push(+r.toFixed(2));
    return rs;
  };
  const rings = radii(C.rings);
  const rosette = radii(C.rosette);
  const [rcx, rcy] = C.rings.centre;
  const [ocx, ocy] = C.rosette.centre;

  // Where the lit annulus sits on each ring set, as a fraction of its
  // radius. The two move against each other, which is where the moiré
  // comes from.
  const p1 = 0.5 + dx * 0.42 - dy * 0.22;
  const p2 = 0.5 - dx * 0.34 + dy * 0.28;
  const bw = C.band;

  // The band's position along its diagonal, and the mirror's angle.
  const sweep = 50 + dx * 72 - dy * 22;
  const angle = -28 + dx * 46 + dy * 18;

  // Latent numeral resolves tilting right; microtext flares tilting left.
  // Both are faintly there at rest — a security feature you cannot find at
  // all reads as missing, not hidden.
  const latent = 0.07 + clamp01((dx - 0.08) / 0.5) * 0.9;
  const micro = 0.28 + clamp01((-dx - 0.08) / 0.5) * 0.65;

  const glint = 50 + dx * 46 - dy * 12;

  const mr = C.microtext.radius;
  const microPath = `M ${rcx - mr} ${rcy + 1} a ${mr} ${mr} 0 1 1 ${2 * mr} 0 a ${mr} ${mr} 0 1 1 ${-2 * mr} 0`;

  const silverStops = C.silver.map((c, i) => (
    <stop key={i} offset={`${((i / (C.silver.length - 1)) * 100).toFixed(1)}%`} stopColor={c} />
  ));

  const id = (k) => `${uid}${k}`;
  const url = (k) => `url(#${id(k)})`;

  return (
    <svg className="rc-heart" viewBox="0 0 72 60" width={height * 1.2} height={height} aria-hidden focusable="false">
      <defs>
        <clipPath id={id("c")}>
          <path d={HEART} />
        </clipPath>

        {/* the mirror */}
        <linearGradient
          id={id("m")}
          x1="0"
          y1="0"
          x2="1"
          y2="0.55"
          gradientTransform={`rotate(${angle.toFixed(1)} 0.5 0.5) translate(${(dx * 0.14).toFixed(3)} ${(dy * 0.08).toFixed(3)})`}
        >
          {silverStops}
        </linearGradient>

        {/* the sweeping spectral band */}
        <linearGradient id={id("s")} x1="0" y1="0" x2="1" y2="0.5">
          {spectrum(sweep - C.sweepWidth, sweep + C.sweepWidth, "s")}
        </linearGradient>

        {/* light on the two ring sets: an annulus of spectrum that travels */}
        <radialGradient id={id("r1")} gradientUnits="userSpaceOnUse" cx={rcx} cy={rcy} r={C.rings.to}>
          {spectrum((p1 - bw) * 100, (p1 + bw) * 100, "a")}
        </radialGradient>
        <radialGradient id={id("r2")} gradientUnits="userSpaceOnUse" cx={ocx} cy={ocy} r={C.rosette.to}>
          {spectrum((p2 - bw) * 100, (p2 + bw) * 100, "b")}
        </radialGradient>

        {/* the dome: the patch is embossed, not flat */}
        <radialGradient id={id("d")} cx={0.4 - dx * 0.16} cy={0.3 - dy * 0.14} r="0.82">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="74%" stopColor="#000000" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
        </radialGradient>

        {/* the glint: a narrow hard bar, the one place the stock goes white */}
        <linearGradient id={id("g")} x1="0" y1="0" x2="0.65" y2="1">
          <stop offset={pct(glint - 7)} stopColor="#ffffff" stopOpacity="0" />
          <stop offset={pct(glint - 1.5)} stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset={pct(glint + 1.5)} stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset={pct(glint + 7)} stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <path id={id("t")} d={microPath} />
      </defs>

      <g transform={FAVICON_TRANSFORM}>
        <path d={HEART_SHADOW} fill="#1b1724" />

        {/* Isolated so the blends inside mix with the silver, not the
            parchment; saturated after, because screen over grey goes pastel. */}
        <g clipPath={url("c")} style={{ isolation: "isolate", filter: "saturate(1.3) contrast(1.06)" }}>
          <path d={HEART} fill={url("m")} />
          <path d={HEART} fill={url("s")} opacity={C.sweep} />

          {/* engraving: the cut, then the light in the cut */}
          <g fill="none" strokeWidth={C.rings.width} stroke="#0b0914" opacity={C.rings.engrave}>
            {rings.map((r) => <circle key={r} cx={rcx} cy={rcy} r={r} />)}
          </g>
          <g fill="none" strokeWidth={C.rings.width} stroke={url("r1")} style={{ mixBlendMode: "screen" }}>
            {rings.map((r) => <circle key={r} cx={rcx} cy={rcy} r={r} />)}
          </g>
          <g fill="none" strokeWidth={C.rosette.width} stroke="#0b0914" opacity={C.rosette.engrave}>
            {rosette.map((r) => <circle key={r} cx={ocx} cy={ocy} r={r} />)}
          </g>
          <g fill="none" strokeWidth={C.rosette.width} stroke={url("r2")} opacity={C.rosette.opacity} style={{ mixBlendMode: "screen" }}>
            {rosette.map((r) => <circle key={r} cx={ocx} cy={ocy} r={r} />)}
          </g>

          {/* latent numeral: embossed into the stock, lit by the band */}
          <g fontFamily={C.font} fontWeight="900" fontSize={C.latent.size} textAnchor="middle" letterSpacing="-1">
            <text x={rcx + 0.7} y={C.latent.y + 0.7} fill="#0b0914" opacity={latent * 0.75}>{C.latent.text}</text>
            <text x={rcx} y={C.latent.y} fill="#ffffff" opacity={latent} style={{ mixBlendMode: "overlay" }}>{C.latent.text}</text>
            <text x={rcx} y={C.latent.y} fill={url("s")} opacity={latent * 0.85}>{C.latent.text}</text>
          </g>

          {/* microtext */}
          <text fontFamily={C.font} fontWeight="700" fontSize={C.microtext.size} letterSpacing="0.25" fill="#ffffff" opacity={micro} style={{ mixBlendMode: "overlay" }}>
            <textPath href={`#${id("t")}`}>{C.microtext.text}</textPath>
          </text>

          <path d={HEART} fill={url("d")} />
          <path d={HEART} fill={url("g")} />
        </g>

        {/* keyline, so the patch keeps its edge when the mirror runs dark */}
        <path d={HEART} fill="none" stroke={HEART_HOLO.rim} strokeOpacity="0.7" strokeWidth="1" />

        {arrow && (
          <>
            {/* The arrow stays printed ink, keylined against the stock so it
                never dissolves into a band its own colour. */}
            <path d={ARROW_SHADOW} fill="#121020" />
            <path d={ARROW} fill="none" stroke="#121020" strokeWidth="2.6" strokeLinejoin="round" />
            <path d={ARROW} fill="#7dff14" />
          </>
        )}
      </g>
    </svg>
  );
});

// The card body's "Sigil" foil, applied to the mark. Three layers, in the
// favicon's own box:
//
//   1. the heart printed in its metal — what you see at rest
//   2. the holo: a pastel diffraction ramp that slides with the pointer and
//      spins with the tilt, with the iridescent texture soft-lit over it;
//      screen-blended onto the metal; clipped to the heart; and masked by a
//      radial pool centred on the pointer, so the mark only lights when the
//      cursor is near it — exactly the AND of the two masks the body uses
//   3. the arrow, printed green over everything
//
// `mx`/`my` are the pointer in card percent (what slides the ramp, as on the
// body); `px`/`py` the same pointer in this box's viewBox units (what the
// pool is centred on); `hyp` the pointer's distance from the card centre.
export const SigilHeart = React.memo(function SigilHeart({ uid, height, metal, mx, my, px, py, hyp, ry, arrow = true }) {
  const S = HEART_HOLO.sigil;
  const id = (k) => `${uid}${k}`;
  const url = (k) => `url(#${id(k)})`;
  const h = hyp || 0;

  const bright = S.brightness.rest + S.brightness.lift * h;
  const strength = S.strength.rest + S.strength.lift * h;

  // The ramp: six angles and back to the first, so it tiles seamlessly.
  const sun = [...S.sun, S.sun[0]];
  const stops = sun.map((c, i) => (
    <stop key={i} offset={`${((i / (sun.length - 1)) * 100).toFixed(1)}%`} stopColor={c} />
  ));
  const spin = 45 + (ry || 0) * S.spin;
  const slideX = -(((mx ?? 50) / 100) - 0.5) * S.slide;
  const slideY = -(((my ?? 50) / 100) - 0.5) * S.slide;

  // The texture, oversized and dragged with the pointer like the body's
  // 160% iri layer.
  const tw = 72 * 1.6;
  const th = 60 * 1.6;
  const tx = -(tw - 72) * ((mx ?? 50) / 100);
  const ty = -(th - 60) * ((my ?? 50) / 100);

  const { radius, core, mid } = S.pool;

  // The strike's position along the arrow, 0..1 while the tilt is inside the
  // window and parked off either end otherwise — so the glint enters at the
  // tail, runs to the head, and leaves, once per pass through the angle.
  const K = S.strike;
  const st = K ? ((ry || 0) - K.angle) / K.window : -9;
  const sPos = ((st + 1) / 2) * (1 + (K?.width ?? 0) * 2) - (K?.width ?? 0);
  const sw = K?.width ?? 0;
  const sp = (v) => `${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%`;

  return (
    <svg className="rc-heart" viewBox="0 0 72 60" width={height * 1.2} height={height} aria-hidden focusable="false">
      <defs>
        <clipPath id={id("c")}>
          <path d={HEART} transform={FAVICON_TRANSFORM} />
        </clipPath>

        {/* the printed metal */}
        <linearGradient id={id("m")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={metal.lit} />
          <stop offset="34%" stopColor={metal.mid} />
          <stop offset="100%" stopColor={metal.deep} />
        </linearGradient>
        <linearGradient id={id("n")} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="18%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="34%" stopColor="#ffffff" stopOpacity={metal.sheen} />
          <stop offset="48%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* the diffraction ramp */}
        <linearGradient
          id={id("r")}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
          spreadMethod="repeat"
          gradientTransform={`translate(${slideX.toFixed(3)} ${slideY.toFixed(3)}) rotate(${spin.toFixed(1)} 0.5 0.5) scale(${S.period})`}
        >
          {stops}
        </linearGradient>

        {/* the pool: white where lit, black where not */}
        <radialGradient id={id("p")} gradientUnits="userSpaceOnUse" cx={px} cy={py} r={radius}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset={`${(core * 100).toFixed(1)}%`} stopColor="#ffffff" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity={mid} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <mask id={id("k")} maskUnits="userSpaceOnUse" x="0" y="0" width="72" height="60">
          <rect x="0" y="0" width="72" height="60" fill={url("p")} />
        </mask>

        {/* the strike, laid along the arrow's own diagonal */}
        {K && (
          <linearGradient id={id("x")} x1="0" y1="1" x2="1" y2="0">
            <stop offset={sp(sPos - sw)} stopColor={K.color} stopOpacity="0" />
            <stop offset={sp(sPos - sw * 0.25)} stopColor={K.color} stopOpacity={K.peak} />
            <stop offset={sp(sPos + sw * 0.25)} stopColor={K.color} stopOpacity={K.peak} />
            <stop offset={sp(sPos + sw)} stopColor={K.color} stopOpacity="0" />
          </linearGradient>
        )}
      </defs>

      {S.base === "ghost" ? (
        // A watermark: the shadow kept but faint, the heart a translucent
        // darkening of whatever it sits on, and a pale rim so the shape
        // still has an edge at rest.
        <g transform={FAVICON_TRANSFORM}>
          <path d={HEART_SHADOW} fill="#1b1724" opacity={S.ghost.shadow} />
          <path d={HEART} fill={S.ghost.fill} opacity={S.ghost.opacity} />
          <path d={HEART} fill="none" stroke={S.ghost.rim} strokeOpacity={S.ghost.rimOpacity} strokeWidth="0.9" />
        </g>
      ) : (
        <g transform={FAVICON_TRANSFORM}>
          <path d={HEART_SHADOW} fill="#1b1724" />
          <path d={HEART} fill={url("m")} />
          <path d={HEART} fill={url("n")} />
        </g>
      )}

      {/* the tint: the ramp laid plainly under the screen pass, same pool */}
      <g clipPath={url("c")} mask={url("k")} opacity={S.tint * strength}>
        <rect x="0" y="0" width="72" height="60" fill={url("r")} />
      </g>

      {/* the holo, lit only where the heart is AND the pointer is near */}
      <g clipPath={url("c")} mask={url("k")} opacity={strength} style={{ mixBlendMode: "screen" }}>
        <g style={{ isolation: "isolate", filter: `brightness(${bright.toFixed(2)}) contrast(${S.contrast}) saturate(${S.saturate})` }}>
          <rect x="0" y="0" width="72" height="60" fill={url("r")} />
          <image
            href={S.texture}
            x={tx}
            y={ty}
            width={tw}
            height={th}
            preserveAspectRatio="xMidYMid slice"
            style={{ mixBlendMode: "soft-light" }}
          />
        </g>
      </g>

      {arrow && (
        <g transform={FAVICON_TRANSFORM}>
          <path d={ARROW_SHADOW} fill="#1b1724" />
          <path d={ARROW} fill="#64ef07" />
          {K && st > -1 && st < 1 && <path d={ARROW} fill={url("x")} />}
        </g>
      )}
    </svg>
  );
});

export default CurrencyHeart;
