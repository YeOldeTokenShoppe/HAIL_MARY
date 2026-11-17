// R-cana — APPARITIONS: the cards where Our Lady appears, and where her halo is (2026-11-16).
//
// The finish for an apparition is LIGHT, not a material: her halo glows
// faintly at rest, and as the card tilts it brightens, its rays turn and a
// glint travels round the ring. Light takes the halo's own colour, so the same
// finish serves a gold halo and a cyan one. It lives inside the art, so it
// never competes with the frame's metal (which belongs to rarity).
//
// Keyed by face id. Drawn by src/components/RcanaCard3.jsx.
//   layer   the art layer she is on; the light rides that layer's parallax,
//           its glow behind the layer and its glint over it
//   cx, cy  the halo's centre, as % of the card's width and height
//   r       the halo ring's radius, as % of the card's width
//   color   the light's colour
// Optional, for the appearances that are not a figure with a ring halo:
//   over      true when she is painted INTO the layer (a silhouette, a scorch
//             mark): the light then sits on top of the layer, not behind it
//   ry        an oval light: its vertical radius as % of the card's height
//   rays      false for a soft glow with no rays
//   glint     false for no travelling glint (there is no ring for it to ride)
//   rest      how lit it is with the card at rest, 0-1 (default .3)
//   strength  overall brightness, 0-1 (default 1)
//   spread    how far the glow reaches, in halo radii (default 3.4)
//   mask      rays painted in the art itself: they light like embers, and a
//             brighter pulse runs out along them as the card tilts
export const APPARITIONS = {
  // La Rosa: her silhouette behind the rose is dark at rest and comes up as the card tilts.
  "la-rosa": { layer: "scene", over: true, cx: 50, cy: 24, r: 15, ry: 21, spread: 1.6, rays: false, glint: false, rest: 0, strength: 1, color: "#b8ffd8" },
  // La Fuente: the statue has no halo, so the tilt gives her one — a small light behind her head.
  "la-fuente": { layer: "subject", cx: 49.2, cy: 11.3, r: 3.2, spread: 4.2, glint: false, rest: 0.1, color: "#fff1c4" },
  // La Tortilla: she is toasted into it, rays and all; the scorch glows like embers.
  // `mask` lights her own scorched rays: an image the size of the layer, opaque where the rays are.
  "tortilla": { layer: "subject", over: true, cx: 48.8, cy: 33, r: 6.5, spread: 3.2, rays: false, glint: false, rest: 0.1, strength: 0.3, color: "#ffb04a", mask: "/TCG/rcana/tortilla/rays-mask.webp?v=1" },
  "fire-horse": { layer: "subject", cx: 54.5, cy: 15.8, r: 7.5, color: "#ffdc78" },
  "holy-roller": { layer: "subject", cx: 40, cy: 17, r: 8.5, color: "#ffdc78" },
  "ride-or-die": { layer: "subject", cx: 56.5, cy: 15, r: 10, color: "#ffe08a" }, // The Lowrider: her aureole over the car
  "mardi-gras": { layer: "subject", cx: 49.5, cy: 18.6, r: 7, color: "#ffdc78" },
  "virtual-mary": { layer: "subject", cx: 54.5, cy: 20, r: 6, color: "#6ff3ff" }, // the hologram: the same light, in her cyan
};
