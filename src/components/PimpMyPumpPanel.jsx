"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { PanelSection, PanelTitle, PANEL_ICONS } from "./HailMaryPanel";
import { isPremiumTheme, isPremiumFence, isPremiumAddon, makePurchaseId, PREMIUM_PRICES } from "@/lib/oilPremium";

// Normalize an uploaded sign image to <=maxDim px (preserving aspect) and re-encode
// as WebP before it's stored. /hailmary is a shared scene — every player loads each
// other's sign as a GPU texture, so bounding it here keeps the field cheap for all.
// (A Storage rule also caps file size server-side as a guardrail.)
async function resizeSignImage(file, maxDim = 1024, quality = 0.92) {
  let img;
  let bmp = null;
  try {
    bmp = await createImageBitmap(file);
    img = bmp;
  } catch {
    img = await new Promise((resolve, reject) => {
      const el = new Image();
      const u = URL.createObjectURL(file);
      el.onload = () => { URL.revokeObjectURL(u); resolve(el); };
      el.onerror = (e) => { URL.revokeObjectURL(u); reject(e); };
      el.src = u;
    });
  }
  const w = img.width || 1;
  const h = img.height || 1;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
  if (bmp?.close) bmp.close();
  // Lossless PNG first — razor-sharp on hard-edged logos/text, matching a baked
  // texture (a 2-color logo encodes tiny). Only fall back to lossy WebP when the PNG
  // would blow the ~1MB Storage cap — i.e. for photographic uploads, where lossy
  // artifacts are invisible anyway.
  const STORAGE_CAP = 1_000_000;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob || blob.size > STORAGE_CAP) {
    const webp = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (webp) blob = webp;
  }
  return blob;
}

// Small price tag rendered on locked items in place of the old lock icon.
// Dark pill (not the old faint-gold) so the price stays legible once the item is
// selected — selected buttons switch to the gold activeBg (#d4a854), which used to
// swallow the gold-on-gold chip whole.
const priceChipStyle = {
  marginLeft: 5,
  padding: "0 5px",
  borderRadius: 2,
  background: "rgba(20, 16, 8, 0.78)",
  border: "1px solid #d4a854",
  color: "#f0c862",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

// ── Zone definitions ─────────────────────────────────────────────────────────
export const PUMP_ZONES = [
  { id: "pad",           label: "PAD",            meshes: ["ground", "ground001"] },
  { id: "foundation",    label: "BASE PLATE",     meshes: ["Bottom_Box"] },
  { id: "motorBox",      label: "MOTOR BOX",      meshes: ["Cube", "Wheel_Box", "Under_Pump"] },
  { id: "crankWheel",    label: "CRANK WHEEL",    meshes: ["Wheel_Back"] },
  { id: "beam",          label: "WALKING BEAM",   meshes: ["Body_Pump"] },
  { id: "counterweight", label: "COUNTERWEIGHTS", meshes: ["Cylinder_Pump", "Cylinder_Pump001"] },
  { id: "horseHead",     label: "HORSE HEAD",     meshes: ["Head_Pump"] },
  { id: "drillPipe",     label: "DRILL PIPE",     meshes: ["Straw", "Cylinder"] },
  { id: "machinePanel",  label: "MACHINE PANEL",  meshes: ["MachinePanel"] },
  { id: "tankScaffold",  label: "TANK SCAFFOLD",  meshes: ["Fuel_Tank_Scaffold"] },
  { id: "signFrame",     label: "SIGN FRAME",     meshes: ["SignFrame", "SignFrame001"] },
  { id: "pipes",          label: "PIPES",           meshes: ["Pipe_01", "Pipe_02", "Pipe_03", "Pipe_Refinery"] },
  { id: "valve",          label: "VALVE WHEEL",     meshes: ["Wheel"] },
];

export const MATERIAL_PRESETS = {
  stock:    { label: "STOCK",         roughness: null,  metalness: null, emissive: null,     emissiveIntensity: 0, envMapIntensity: 0 },
  matte:    { label: "MATTE",         roughness: 0.92,  metalness: 0.05, emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.1 },
  chrome:   { label: "CHROME",        roughness: 0.0,   metalness: 1.0,  emissive: "#8b8787", emissiveIntensity: 0, envMapIntensity: 3.0, useStandard: true },
  brushed:  { label: "BRUSHED STEEL", roughness: 0.3,   metalness: 0.8,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 2.0 },
  rust:     { label: "RUST",          roughness: 0.95,  metalness: 0.2,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.3 },
  gold:     { label: "GOLD",          roughness: 0.15,  metalness: 0.9,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 2.5 },
  neon:     { label: "NEON GLOW",     roughness: 0.5,   metalness: 0.1,  emissive: "auto",   emissiveIntensity: 1.5, envMapIntensity: 0.5 },
  neonDeep: { label: "DEEP NEON",     roughness: 0.4,   metalness: 0.15, emissive: "auto",   emissiveIntensity: 0.6, envMapIntensity: 0.8 },
};

// ── Add-on catalog & slot positions ──────────────────────────────────────────
export const ADDON_CATALOG = [
  { id: "gravestone",      label: "GRAVESTONE",       color: "#555555", shape: "cross",    model: "/models/addons/gravestone.glb" },
  { id: "skeleton",      label: "HOME DEPOT SKELETON",       color: "#e8dcc8", shape: "cylinder", model: "/models/addons/HDSkeleton.glb" },
  { id: "flamingo",      label: "PINK FLAMINGO",  color: "#ff69b4", shape: "cone",     model: "/models/addons/pinkFlamingo.glb" },
  { id: "bearRug",       label: "BEAR RUG",       color: "#8B5A2B", shape: "box",      model: "/models/addons/Bear_Rug.glb" },
  // T-REX is no longer a placeable add-on — it now invades as a rogue character
  // (see ROGUE_CATALOG "dinosaur" in RogueCharacter.jsx).
  { id: "goldRocks",     label: "GOLD ROCKS",     color: "#ffd700", shape: "sphere",   model: "/models/addons/goldRocks.glb" },
  { id: "palmTree",      label: "PALM TREE",      color: "#2d8a4e", shape: "cylinder", model: "/models/addons/palmTree.glb" },
  { id: "pumpkinPatch",  label: "PUMPKIN PATCH",  color: "#e87530", shape: "sphere",   model: "/models/addons/pumpkinPatch.glb" },
  { id: "zombie",      label: "PET ZOMBIE",      color: "#cc3333", shape: "sphere",   model: "/models/addons/zombie.glb", animated: true, premium: true },
  { id: "tubeMan",      label: "TUBEMAN",      color: "#cc3333", shape: "sphere",   model: "/models/addons/tubeMan.glb", animated: "tubeMan", premium: true },

  { id: "sunflowers",      label: "SUNFLOWERS",      color: "#ffd700", shape: "cone",   model: "/models/addons/Sunflowers.glb" },
  { id: "gnome",      label: "GARDEN GNOME",      color: "#33c2ccff", shape: "cone",   model: "/models/addons/gnome.glb" },
  { id: "scarecrow",   label: "SCARECROW",      color: "#c9a227", shape: "cone",   model: "/models/addons/scarecrow.glb" },
  { id: "forSaleSign", label: "FOR SALE SIGN",  color: "#d4202a", shape: "box",    model: "/models/addons/ForSaleSign.glb" },
  // { id: "neonSign",      label: "NEON SIGN",      color: "#ff00ff", shape: "box",      emissive: true },
  // { id: "gnome",         label: "GARDEN GNOME",   color: "#33a1ccff", shape: "cone" },
  // { id: "cactus",        label: "COOL CACTUS",    color: "#2d8a4e", shape: "cylinder" },
  // { id: "flowers",       label: "POTTED FLOWERS", color: "#ff69b4", shape: "sphere" },
  // { id: "alienPlants",   label: "ALIEN PLANTS",   color: "#7b2ff7", shape: "cone",     emissive: true },
  // { id: "fountain",      label: "FOUNTAIN",       color: "#4488cc", shape: "cylinder" },
];

//  [5] [6] [7]   ← back (far from camera)
//  [3] PUMP [4]
//  [0] [1] [2]   ← front (close to camera)
export const ADDON_SLOTS = [
  { x: -0.25, y: 0, z:  0.25 }, // 0 front-left
  { x:  0.0,  y: 0, z:  0.25 }, // 1 front-center
  { x:  0.25, y: 0, z:  0.25 }, // 2 front-right
  { x: -0.25, y: 0, z:  0.0  }, // 3 mid-left
  { x:  0.25, y: 0, z:  0.0  }, // 4 mid-right
  { x: -0.25, y: 0, z: -0.25 }, // 5 back-left
  { x:  0.0,  y: 0, z: -0.25 }, // 6 back-center
  { x:  0.25, y: 0, z: -0.25 }, // 7 back-right
];

// Center column slots are unavailable (reserved — the sign/pipework runs through
// the front- and back-center of the plot). Grayed out and non-interactive.
export const BLOCKED_ADDON_SLOTS = new Set(["1", "6"]);

export const FENCE_CATALOG = [
  { id: "chainlink",    label: "CHAIN LINK",    model: "/models/addons/Fence_Chainlink.glb",    scale: 0.1 },
  { id: "iron",         label: "IRON",          model: "/models/addons/Fence_Iron.glb",         scale: 0.1 },
  { id: "whitePicket",  label: "WHITE PICKET",  model: "/models/addons/Fence_WhitePicket.glb",  scale: 0.1 },
];

// Sign styles — each its own GLB (separate from the rig). Internal mesh names per
// model: `Sign` (front image), `Sign2` (back), `SignFrame`. `cameraModel` is an
// optional matching camera GLB pre-positioned on that sign (shown when showCamera).
export const SIGN_CATALOG = [
  { id: "sign1", label: "TALL SIGN", model: "/models/addons/Sign1.glb", cameraModel: "/models/addons/SecurityCamera_Sign1.glb" },
  { id: "sign2", label: "BILLBOARD", model: "/models/addons/Sign2.glb", cameraModel: "/models/addons/SecurityCamera_Sign2.glb" },
];

const BASE_MAX_ADDONS = 3;

// Default config: all zones use stock (original model materials)
export function getDefaultPumpConfig() {
  const config = {};
  PUMP_ZONES.forEach((z) => {
    config[z.id] = { color: null, preset: "stock" };
  });
  config.signImageUrl = null;
  config.signStyle = "sign1"; // which SIGN_CATALOG entry to render
  config.signFit = "fill";    // how the uploaded image maps onto the sign face: fill | fit | stretch
  config.showCamera = false;
  config.showSign = false;
  config.fenceType = null;
  config.addons = {};
  return config;
}

// ── Fun preset themes (full rig presets) ─────────────────────────────────────
// Exported for the phone's showcase rig (RigScene pager) — same list the editor offers.
export const THEME_PRESETS = {
  stock: { label: "FACTORY DEFAULT", build: () => getDefaultPumpConfig() },
  goldRush: {
    label: "GOLD RUSH",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad           = { color: "#3d2b1a", preset: "matte" };   // dark earth
      c.foundation    = { color: "#8B6914", preset: "brushed" }; // bronze

      c.beam          = { color: "#FFD700", preset: "gold" };
      c.horseHead     = { color: "#FFD700", preset: "gold" };
      c.counterweight = { color: "#DAA520", preset: "gold" };
      c.crankWheel    = { color: "#B8860B", preset: "brushed" };
      c.motorBox      = { color: "#8B7355", preset: "matte" };
      c.drillPipe     = { color: "#CD853F", preset: "brushed" };
      c.machinePanel  = { color: "#8B7355", preset: "gold" };
      c.tankScaffold  = { color: "#B8860B", preset: "brushed" };
      c.signFrame     = { color: "#DAA520", preset: "gold" };
      c.pipes         = { color: "#CD853F", preset: "gold" };
      return c;
    },
  },
  murdered: {
    label: "MURDERED OUT",
    build: () => {
      const c = getDefaultPumpConfig();
      PUMP_ZONES.forEach((z) => {
        c[z.id] = { color: "#1a1a1a", preset: "chrome" };
      });
      c.pad = { color: "#0a0a0a", preset: "matte" };
      return c;
    },
  },
  cyberpunk: {
    label: "CYBERPUNK",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad           = { color: "#0c0814", preset: "matte" };   // near-black violet
      c.foundation    = { color: "#1a1028", preset: "brushed" }; // dark violet steel

      c.beam          = { color: "#008fa8", preset: "neonDeep" };// electric cyan — hero
      c.horseHead     = { color: "#1a1028", preset: "brushed" }; // dark violet

      c.counterweight = { color: "#c4154f", preset: "neonDeep" };// hot magenta
      c.machinePanel  = { color: "#c4154f", preset: "neonDeep" };// hot magenta

      c.crankWheel    = { color: "#1a1028", preset: "brushed" }; // dark violet steel
      c.motorBox      = { color: "#1a1028", preset: "brushed" }; // dark violet steel

      c.drillPipe     = { color: "#7a1fcc", preset: "neonDeep" };// purple glow
      c.signFrame     = { color: "#1a1028", preset: "neonDeep" };// cyan
      c.pipes         = { color: "#1a1028", preset: "brushed" }; // dark violet steel
      c.tankScaffold  = { color: "#1a1028", preset: "brushed" }; // dark violet steel
      c.valve         = { color: "#c4154f", preset: "neonDeep" };// hot magenta
      return c;
    },
  },
  rusty: {
    label: "ABANDONED FIELD",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad           = { color: "#3E2723", preset: "matte" };   // dirt
      c.foundation    = { color: "#6a6a60", preset: "brushed" }; // weathered steel

      c.beam          = { color: "#8B4513", preset: "rust" };    // heavy rust
      c.horseHead     = { color: "#6a6a60", preset: "brushed" }; // worn bare metal

      c.counterweight = { color: "#8B4513", preset: "rust" };    // rusted through
      c.machinePanel  = { color: "#704214", preset: "rust" };

      c.crankWheel    = { color: "#5C3317", preset: "rust" };
      c.motorBox      = { color: "#6a6a60", preset: "brushed" }; // faded steel

      c.drillPipe     = { color: "#7A4A2A", preset: "rust" };
      c.signFrame     = { color: "#6a6a60", preset: "brushed" }; // bare metal
      c.pipes         = { color: "#8B4513", preset: "rust" };    // corroded pipes
      c.tankScaffold  = { color: "#6a6a60", preset: "brushed" }; // weathered
      c.valve         = { color: "#5C3317", preset: "rust" };
      return c;
    },
  },
 
  toxic: {
  label: "BIOHAZARD",
  build: () => {
    const c = getDefaultPumpConfig();

    c.pad           = { color: "#1a1a0a", preset: "matte" };   // dark grime
    c.foundation    = { color: "#2a2a10", preset: "matte" };  // dirty dark olive

    c.beam          = { color: "#c4b800", preset: "neonDeep" }; // caution yellow
    c.horseHead     = { color: "#1a1a0a", preset: "brushed" };  // dark industrial

    c.counterweight = { color: "#6b8c00", preset: "neonDeep" }; // toxic sludge green
    c.machinePanel  = { color: "#c4b800", preset: "neonDeep" }; // caution yellow

    c.crankWheel    = { color: "#1a1a0a", preset: "brushed" };  // dark industrial
    c.motorBox      = { color: "#1a1a0a", preset: "brushed" };

    c.drillPipe     = { color: "#6b8c00", preset: "neonDeep" }; // toxic sludge green
    c.signFrame     = { color: "#c4b800", preset: "neonDeep" }; // caution yellow
    c.pipes         = { color: "#2a2a10", preset: "brushed" };  // grimy dark
    c.tankScaffold  = { color: "#2a2a10", preset: "brushed" };
    c.valve         = { color: "#c4b800", preset: "neonDeep" }; // caution yellow

    return c;
  },
},
hellforged: {
  label: "HELLFORGED",
  build: () => {
    const c = getDefaultPumpConfig();

    c.beam          = { color: "#8B0000", preset: "brushed" };
    c.horseHead     = { color: "#B22222", preset: "brushed" };
    c.counterweight = { color: "#FF2400", preset: "neon" };
    c.crankWheel    = { color: "#5A0A0A", preset: "matte" };
    c.motorBox      = { color: "#2B0000", preset: "matte" };
    c.foundation    = { color: "#1A0000", preset: "matte" };
    c.drillPipe     = { color: "#FF4500", preset: "neon" };
    c.pad           = { color: "#0D0000", preset: "matte" };
    c.machinePanel  = { color: "#FF2400", preset: "neon" };
    c.tankScaffold  = { color: "#2B0000", preset: "brushed" };
    c.signFrame     = { color: "#B22222", preset: "brushed" };
    c.pipes         = { color: "#FF4500", preset: "neon" };

    return c;
  },
},

sanctified: {
  label: "SANCTIFIED EXTRACTION",
  build: () => {
    const c = getDefaultPumpConfig();

    c.pad           = { color: "#1a1008", preset: "matte" };   // dark church floor
    c.foundation    = { color: "#3b2210", preset: "matte" };  // dark wood pew

    c.beam          = { color: "#b8960c", preset: "gold" };   // altar gold
    c.horseHead     = { color: "#f0e8d0", preset: "chrome" }; // ivory

    c.counterweight = { color: "#6b1030", preset: "brushed" };   // burgundy altar cloth
    c.machinePanel  = { color: "#6b1030", preset: "brushed" };   // burgundy

    c.crankWheel    = { color: "#3b2210", preset: "brushed" }; // dark wood
    c.motorBox      = { color: "#f0e8d0", preset: "chrome" };  // ivory

    c.drillPipe     = { color: "#b8960c", preset: "gold" };    // gold
    c.signFrame     = { color: "#b8960c", preset: "gold" };    // gold
    c.pipes         = { color: "#3b2210", preset: "brushed" }; // dark wood
    c.tankScaffold  = { color: "#3b2210", preset: "brushed" }; // dark wood
    c.valve         = { color: "#6b1030", preset: "brushed" };   // burgundy

    return c;
  },
},
arctic: {
  label: "ARCTIC INDUSTRIAL",
  build: () => {
    const c = getDefaultPumpConfig();

    c.beam          = { color: "#E6F2FF", preset: "chrome" };
    c.horseHead     = { color: "#DCE9F7", preset: "chrome" };
    c.counterweight = { color: "#A8D8FF", preset: "brushed" };
    c.crankWheel    = { color: "#C8D6E5", preset: "brushed" };
    c.motorBox      = { color: "#5E6E7E", preset: "matte" };
    c.foundation    = { color: "#4B5A6A", preset: "matte" };
    c.drillPipe     = { color: "#A8D8FF", preset: "brushed" };
    c.pad           = { color: "#2E3A46", preset: "matte" };
    c.machinePanel  = { color: "#E6F2FF", preset: "chrome" };
    c.tankScaffold  = { color: "#5E6E7E", preset: "brushed" };
    c.signFrame     = { color: "#A8D8FF", preset: "brushed" };
    c.pipes         = { color: "#DCE9F7", preset: "chrome" };

    return c;
  },
},
desert: {
  label: "MAD MAX",
  build: () => {
    const c = getDefaultPumpConfig();

    c.pad           = { color: "#2a2018", preset: "matte" };    // scorched earth
    c.foundation    = { color: "#3a3530", preset: "brushed" };  // dark scrap metal

    c.beam          = { color: "#c4a96a", preset: "matte" };    // sun-bleached sand
    c.horseHead     = { color: "#3a3530", preset: "brushed" };  // dark gunmetal

    c.counterweight = { color: "#b83a0a", preset: "neonDeep" }; // war-paint burnt orange
    c.machinePanel  = { color: "#b83a0a", preset: "neonDeep" }; // war-paint

    c.crankWheel    = { color: "#3a3530", preset: "brushed" };  // scrap metal
    c.motorBox      = { color: "#3a3530", preset: "brushed" };  // scrap metal

    c.drillPipe     = { color: "#c4a96a", preset: "matte" };    // sand
    c.signFrame     = { color: "#b83a0a", preset: "neonDeep" }; // war-paint
    c.pipes         = { color: "#3a3530", preset: "brushed" };  // dark scrap
    c.tankScaffold  = { color: "#3a3530", preset: "brushed" };  // dark scrap
    c.valve         = { color: "#b83a0a", preset: "neonDeep" }; // war-paint

    return c;
  },
},
crimsonCharge: {
  label: "RED BULL",
  build: () => {
    const c = getDefaultPumpConfig();

    c.foundation    = { color: "#050920", preset: "neonDeep" };  // aluminum can body
    c.pad           = { color: "#a0a8b4", preset: "brushed" };

    c.beam          = { color: "#050920", preset: "neonDeep" }; // deep blue band
    c.horseHead     = { color: "#c1121f", preset: "brushed" };  // red bull head

    c.counterweight = { color: "#c1121f", preset: "brushed" };  // racing red
    c.machinePanel  = { color: "#d4a017", preset: "brushed" };  // gold sun accent

    c.crankWheel    = { color: "#050920", preset: "neonDeep" };  
    c.motorBox      = { color: "#c1121f", preset: "brushed"};

    c.drillPipe     = { color: "#050920", preset: "neonDeep" }; // deep blue
    c.signFrame     = { color: "#050920", preset: "neonDeep" };  // red
    c.pipes         = { color: "#898e97", preset: "brushed" };  // aluminum
    c.valve         = { color: "#c1121f", preset: "brushed" };  // red

    return c;
  },
  
},
atomicSurge: {
  label: "MONSTER ENERGY",
  build: () => {
    const c = getDefaultPumpConfig();

    c.foundation    = { color: "#1a1a1a", preset: "matte" };  // charcoal, preserves detail
    c.pad           = { color: "#141414", preset: "matte" };

    c.beam          = { color: "#0d9e00", preset: "brushed" };  // hero green
    c.horseHead     = { color: "#0d9e00", preset: "brushed" };  // green head

    c.counterweight = { color: "#0d9e00", preset: "brushed" };
    c.machinePanel  = { color: "#0d9e00", preset: "brushed" };

    c.crankWheel    = { color: "#2a2a2a", preset: "brushed" };  // dark charcoal
    c.motorBox      = { color: "#2a2a2a", preset: "brushed" };

    c.drillPipe     = { color: "#0d9e00", preset: "brushed" };
    c.signFrame     = { color: "#0d9e00", preset: "brushed" };
    c.pipes         = { color: "#2a2a2a", preset: "brushed" };  // dark charcoal
    c.valve         = { color: "#0d9e00", preset: "brushed" };

    return c;
  },
},
tokyoNoir: {
  label: "TOKYO NOIR",
  build: () => {
    const c = getDefaultPumpConfig();

    // Base night steel
    c.pad           = { color: "#0a0f17", preset: "matte" };
    c.foundation    = { color: "#1b2433", preset: "brushed" };

    // Sodium vapor hero (amber)
    c.beam          = { color: "#cc8a10", preset: "neonDeep" }; // warm streetlight
    c.counterweight = { color: "#cc8a10", preset: "neonDeep" };

    // Deep lacquer red accent
    c.horseHead     = { color: "#7a1e1e", preset: "brushed" };
    c.machinePanel  = { color: "#8a1515", preset: "neonDeep" }; // red lantern

    // Mechanical depth
    c.crankWheel    = { color: "#1b2433", preset: "brushed" };
    c.motorBox      = { color: "#1b2433", preset: "brushed" };
    c.drillPipe     = { color: "#cc6600", preset: "neonDeep" }; // orange pulse
    c.signFrame     = { color: "#cc8a10", preset: "neonDeep" }; // amber
    c.pipes         = { color: "#1b2433", preset: "brushed" };
    c.tankScaffold  = { color: "#1b2433", preset: "brushed" };
    c.valve         = { color: "#8a1515", preset: "neonDeep" }; // red lantern

    return c;
  },
},
texas: {
  label: "LONE STAR",
  build: () => {
    const c = getDefaultPumpConfig();

    // === DAY STRUCTURE ===
    c.beam          = { color: "#1c2a44", preset: "brushed" };  // navy blue
    c.horseHead     = { color: "#c49a3a", preset: "brushed" }; // brass

    c.counterweight = { color: "#b22234", preset: "brushed" }; // Texas red
    c.machinePanel  = { color: "#1c2a44", preset: "matte" };   // navy badge base

    c.foundation    = { color: "#1c2a44", preset: "matte" };
    c.pad           = { color: "#142033", preset: "matte" };
    c.tankScaffold  = { color: "#1c2a44", preset: "brushed" };

    c.crankWheel    = { color: "#6b6b6b", preset: "brushed" };
    c.motorBox      = { color: "#5a5a5a", preset: "brushed" };

    c.drillPipe     = { color: "#c49a3a", preset: "brushed" }; // brass
    c.signFrame     = { color: "#c49a3a", preset: "brushed" };
    c.pipes         = { color: "#6b6b6b", preset: "brushed" };
    c.valve         = { color: "#b22234", preset: "brushed" }; // Texas red

    return c;
  },
},
vaporwave: {
  label: "VAPORWAVE",
  build: () => {
    const c = getDefaultPumpConfig();

    // Dark horizon base — just the ground
    c.pad           = { color: "#1a1028", preset: "brushed" };    // dark purple-blue
    c.foundation    = { color: "#1a1028", preset: "brushed"  };  // dark purple-blue

    // Hot pink grid structure
    c.beam          = { color: "#c04878", preset: "brushed" };  // synthwave pink
    c.horseHead     = { color: "#c04878", preset: "brushed" };

    // Sunset peach accents
    c.counterweight = { color: "#d4906a", preset: "brushed" };  // peach sunset
    c.machinePanel  = { color: "#d4906a", preset: "brushed" };

    // Purple mechanicals
    c.crankWheel    = { color: "#d4906a", preset: "brushed" };  // soft purple
    c.motorBox      = { color: "#8868a0", preset: "brushed" };

    // Sunset seams
    c.drillPipe     = { color: "#d4906a", preset: "brushed" };  // peach
    c.signFrame     = { color: "#d4906a", preset: "brushed" };  // peach
    c.pipes         = { color: "#c04878", preset: "brushed" };  // pink grid
    c.tankScaffold  = { color: "#8868a0", preset: "brushed" };  // soft purple
    c.valve         = { color: "#d4906a", preset: "brushed" };  // peach sunset

    return c;
  },
},
solarFlare: {
  label: "SOLAR FLARE",
  build: () => {
    const c = getDefaultPumpConfig();

    // Dark structural cage
    c.pad           = { color: "#0d0d0d", preset: "matte" };
    c.foundation    = { color: "#1a1a1a", preset: "matte" };

    // Star-core hero
    c.beam          = { color: "#cc8800", preset: "neonDeep" }; // blazing amber
    c.horseHead     = { color: "#cc6600", preset: "neonDeep" }; // deep orange

    // Molten accents
    c.counterweight = { color: "#b83500", preset: "neonDeep" }; // molten orange
    c.machinePanel  = { color: "#b83500", preset: "neonDeep" };

    // Dark frame
    c.crankWheel    = { color: "#1a1a1a", preset: "brushed" };
    c.motorBox      = { color: "#1a1a1a", preset: "brushed" };

    // Fire seams
    c.drillPipe     = { color: "#a82a00", preset: "neonDeep" }; // deep red-orange
    c.signFrame     = { color: "#cc8800", preset: "neonDeep" }; // amber
    c.pipes         = { color: "#a82a00", preset: "neonDeep" }; // lava
    c.tankScaffold  = { color: "#1a1a1a", preset: "brushed" };
    c.valve         = { color: "#b83500", preset: "neonDeep" }; // molten

    return c;
  },
},
 chrome: {
    label: "FULL CHROME",
    build: () => {
      const c = getDefaultPumpConfig();
      PUMP_ZONES.forEach((z) => {
        c[z.id] = { color: "#d8d8d8", preset: "chrome" };
      });
      c.pad = { color: "#b0b0b0", preset: "brushed" };
      c.counterweight = { color: "#e8e8e8", preset: "chrome" };
      c.horseHead = { color: "#e8e8e8", preset: "chrome" };
      c.crankWheel = { color: "#c8c8c8", preset: "chrome" };
      return c;
    },
  },
dragonforge: {
  label: "DRAGONFORGE",
  build: () => {
    const c = getDefaultPumpConfig();

    // Obsidian base
    c.pad           = { color: "#0a0505", preset: "matte" };
    c.foundation    = { color: "#120c0c", preset: "matte" };

    // Dragon bone structure
    c.beam          = { color: "#6b5a3d", preset: "brushed" };  // aged bronze
    c.horseHead     = { color: "#6b5a3d", preset: "brushed" };  // aged bronze

    // Furnace ember glow
    c.counterweight = { color: "#6b0a0a", preset: "neonDeep" }; // deep furnace red
    c.machinePanel  = { color: "#6b0a0a", preset: "neonDeep" }; // ember

    // Aged bronze mechanicals
    c.crankWheel    = { color: "#7a6840", preset: "brushed" };  // bronze
    c.motorBox      = { color: "#2a1b1b", preset: "brushed" };  // dark forge iron

    // Fire seams
    c.drillPipe     = { color: "#6b0a0a", preset: "neonDeep" }; // crimson
    c.signFrame     = { color: "#7a6840", preset: "brushed" };  // bronze
    c.pipes         = { color: "#2a1b1b", preset: "brushed" };  // forge iron
    c.tankScaffold  = { color: "#2a1b1b", preset: "brushed" };  // forge iron
    c.valve         = { color: "#6b0a0a", preset: "neonDeep" }; // ember

    return c;
  },
},
celestial: {
  label: "CELESTIAL EXECUTION",
  build: () => {
    const c = getDefaultPumpConfig();

    // Midnight blue base
    c.pad           = { color: "#0a0f1a", preset: "matte" };
    c.foundation    = { color: "#0c1220", preset: "matte" };

    // Midnight blue structure
    c.beam          = { color: "#0f1a30", preset: "brushed" };  // deep midnight
    c.horseHead     = { color: "#c9a227", preset: "gold" };     // gold crown

    // Emerald seams
    c.counterweight = { color: "#0a6630", preset: "brushed" };  // deep emerald
    c.machinePanel  = { color: "#0a6630", preset: "brushed" };

    // Gold trim
    c.crankWheel    = { color: "#c9a227", preset: "gold" };
    c.motorBox      = { color: "#0f1a30", preset: "brushed" };  // midnight

    // Holy seams
    c.drillPipe     = { color: "#0a6630", preset: "brushed" };  // emerald
    c.signFrame     = { color: "#c9a227", preset: "gold" };     // gold
    c.pipes         = { color: "#0f1a30", preset: "brushed" };  // midnight
    c.tankScaffold  = { color: "#0f1a30", preset: "brushed" };  // midnight
    c.valve         = { color: "#0a6630", preset: "brushed" };  // emerald

    return c;
  },
},


midnightSovereign: {
  label: "DARK CROWN",
  build: () => {
    const c = getDefaultPumpConfig();

    // Dark throne
    c.pad           = { color: "#080810", preset: "matte" };
    c.foundation    = { color: "#10101a", preset: "matte" };

    // Royal violet body
    c.beam          = { color: "#1a1030", preset: "brushed" };  // dark purple steel
    c.horseHead     = { color: "#1a1030", preset: "brushed" };

    // Crown silver
    c.counterweight = { color: "#8888a0", preset: "chrome" };   // platinum
    c.crankWheel    = { color: "#8888a0", preset: "chrome" };

    c.motorBox      = { color: "#10101a", preset: "brushed" };
    c.machinePanel  = { color: "#3a1a60", preset: "brushed" };  // deep violet

    // Violet seams
    c.drillPipe     = { color: "#3a1a60", preset: "brushed" };  // deep violet
    c.signFrame     = { color: "#8888a0", preset: "chrome" };   // platinum
    c.pipes         = { color: "#10101a", preset: "brushed" };
    c.tankScaffold  = { color: "#10101a", preset: "brushed" };
    c.valve         = { color: "#3a1a60", preset: "brushed" };  // deep violet

    return c;
  },
},

metalAF: {
  label: "METAL AF",
  build: () => {
    const c = getDefaultPumpConfig();

    // Gunmetal base
    c.pad           = { color: "#2a2a2e", preset: "matte" };
    c.foundation    = { color: "#606068", preset: "chrome" };   // polished steel

    // Chrome body
    c.beam          = { color: "#8a8a90", preset: "chrome" };   // bright chrome
    c.horseHead     = { color: "#8a8a90", preset: "chrome" };

    // Gold accents
    c.counterweight = { color: "#b8960c", preset: "gold" };
    c.machinePanel  = { color: "#b8960c", preset: "gold" };

    // Brushed steel mechanicals
    c.crankWheel    = { color: "#606068", preset: "brushed" };  // brushed steel
    c.motorBox      = { color: "#606068", preset: "brushed" };

    // Gold + steel seams
    c.drillPipe     = { color: "#b8960c", preset: "gold" };
    c.signFrame     = { color: "#b8960c", preset: "gold" };
    c.pipes         = { color: "#606068", preset: "chrome" };   // polished steel
    c.tankScaffold  = { color: "#606068", preset: "chrome" };
    c.valve         = { color: "#b8960c", preset: "gold" };

    return c;
  },
},

};

// ── Panel component ──────────────────────────────────────────────────────────

export default function PimpMyPumpPanel({ config, onChange, isMobile, darkMode = false, theme = null, hasSelection, onSave, saving, dirty, isSignedIn, defaultExpanded = false, onExpandedChange = null, userId, readOnly = false, unlockedItems = new Set(), onPurchaseRequest }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Lets the page react to the editor opening — mobile pins a compact live view
  // of the rig above it. Reports closed on unmount.
  useEffect(() => { onExpandedChange?.(expanded); }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onExpandedChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeZone, setActiveZone] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null); // which slot is picking an addon
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [previewThemeKey, setPreviewThemeKey] = useState(null); // tracks last-applied theme for lock detection

  // Block all edits when viewing someone else's config
  if (readOnly) onChange = () => {};

  // Compute max addon slots based on unlocks
  const maxAddons = BASE_MAX_ADDONS
    + (unlockedItems.has("slotUnlock_4") ? 1 : 0)
    + (unlockedItems.has("slotUnlock_5") ? 1 : 0);

  // Detect locked premium items currently in the config (blocks save)
  const lockedInConfig = useMemo(() => {
    const items = [];
    // Check theme
    if (previewThemeKey && isPremiumTheme(previewThemeKey) && !unlockedItems.has(makePurchaseId("theme", previewThemeKey))) {
      const theme = THEME_PRESETS[previewThemeKey];
      items.push({ id: makePurchaseId("theme", previewThemeKey), label: theme?.label || previewThemeKey, category: "theme" });
    }
    // Check fence
    if (config.fenceType && isPremiumFence(config.fenceType) && !unlockedItems.has(makePurchaseId("fence", config.fenceType))) {
      const fence = FENCE_CATALOG.find(f => f.id === config.fenceType);
      items.push({ id: makePurchaseId("fence", config.fenceType), label: fence?.label || config.fenceType, category: "fence" });
    }
    // Check camera
    if (config.showCamera && !unlockedItems.has("camera")) {
      items.push({ id: "camera", label: "SECURITY CAMERA", category: "accessory" });
    }
    // Check addons (deduplicate — same addon can be in multiple slots)
    const addonsObj = config.addons || {};
    const seenAddons = new Set();
    for (const v of Object.values(addonsObj)) {
      const addonId = typeof v === "string" ? v : v?.id;
      if (addonId && !seenAddons.has(addonId) && isPremiumAddon(addonId) && !unlockedItems.has(makePurchaseId("addon", addonId))) {
        seenAddons.add(addonId);
        const addon = ADDON_CATALOG.find(a => a.id === addonId);
        items.push({ id: makePurchaseId("addon", addonId), label: addon?.label || addonId, category: "addon" });
      }
    }
    return items;
  }, [previewThemeKey, config.fenceType, config.showCamera, config.addons, unlockedItems]);

  // Dark/light color tokens
  const c = darkMode ? {
    text: "#c8c0b4", textStrong: "#e8e0d4", accent: "#d4a854",
    muted: "#8a8070", border: "#444", borderLight: "#333",
    panelBg: "rgba(26,26,31,0.95)", inputBg: "#252530",
    btnText: "#c8c0b4", btnBg: "rgba(100,90,70,0.2)",
    btnBorder: "#555", activeBg: "#d4a854", activeText: "#1a1a1f",
    activeBorder: "#b8922e", hintText: "#8a8070",
    slotBg: "rgba(100,90,70,0.12)", slotBorder: "#444",
    editorBg: "rgba(100,90,70,0.08)", pickerBg: "rgba(30,30,38,0.98)",
    sectionBorder: "#444", swatchBorder: "rgba(212,168,84,0.4)",
    plusColor: "#666", pumpCellBg: "rgba(212,168,84,0.15)", pumpCellBorder: "#555",
  } : {
    text: "#504030", textStrong: "#2e2010", accent: "#5a4010",
    muted: "#6e6050", border: "#c8bfb0", borderLight: "#d4c8b4",
    panelBg: "rgba(245,239,230,0.95)", inputBg: "#f0e8dc",
    btnText: "#504030", btnBg: "rgba(180,160,130,0.1)",
    btnBorder: "#c8bfb0", activeBg: "#d4a854", activeText: "#2e2010",
    activeBorder: "#b8922e", hintText: "#6e6050",
    slotBg: "rgba(180,160,130,0.06)", slotBorder: "#d4c8b4",
    editorBg: "rgba(180,160,130,0.05)", pickerBg: "rgba(245,239,230,0.98)",
    sectionBorder: "#d4c8b4", swatchBorder: "rgba(139,105,20,0.3)",
    plusColor: "#a09080", pumpCellBg: "rgba(184,146,46,0.1)", pumpCellBorder: "#c8b080",
  };

  const rawAddons = config.addons || {};
  // Normalize: old format was string id, new format is { id, rot }
  const addons = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(rawAddons)) {
      out[k] = typeof v === "string" ? { id: v, rot: 0 } : v;
    }
    return out;
  }, [rawAddons]);
  const addonCount = Object.keys(addons).length;
  const isFull = addonCount >= maxAddons;

  const updateZone = useCallback((zoneId, updates) => {
    onChange({ ...config, [zoneId]: { ...config[zoneId], ...updates } });
  }, [config, onChange]);

  const applyTheme = useCallback((themeKey) => {
    const newConfig = THEME_PRESETS[themeKey].build();
    newConfig.signImageUrl = config.signImageUrl;
    newConfig.showSign = config.showSign;
    newConfig.showCamera = config.showCamera;
    newConfig.fenceType = config.fenceType;
    newConfig.addons = config.addons || {};
    newConfig.poop = config.poop || false;
    onChange(newConfig);
    setActiveZone(null);
    setPreviewThemeKey(themeKey);
  }, [onChange, config.signImageUrl, config.showSign, config.showCamera, config.fenceType, config.addons]);

  // Section chrome follows the page theme; the editor body keeps its own palette (c).
  const t = theme || { border: c.sectionBorder, accent: c.accent, muted: c.muted };
  const mFs = isMobile ? 10 : 10;   // base font for labels/buttons
  const mFsLg = isMobile ? 11 : 11; // larger font for zone names/hints

  return (
    <PanelSection theme={t} isMobile={isMobile}>
      <PanelTitle theme={t} isMobile={isMobile} icon={PANEL_ICONS.pump} onToggle={() => setExpanded((e) => !e)} open={expanded}>
        PIMP MY PUMP
      </PanelTitle>

      {expanded && (
        <div>
          {!hasSelection && (
            <div style={{ ...styles.selectHint, fontSize: mFsLg, color: c.hintText }}>
              Select your claim to customize your rig
            </div>
          )}

          {/* Theme presets */}
          <div style={{ ...styles.themesRow, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>THEMES</span>
            <div style={styles.themeButtons}>
              {Object.entries(THEME_PRESETS).map(([key, theme]) => {
                const locked = isPremiumTheme(key) && !unlockedItems.has(makePurchaseId("theme", key));
                const isActive = previewThemeKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => applyTheme(key)}
                    style={{
                      ...styles.themeBtn,
                      fontSize: mFs,
                      padding: isMobile ? "5px 10px" : "3px 7px",
                      color: isActive ? c.activeText : c.btnText,
                      border: `1px solid ${isActive ? c.activeBorder : c.btnBorder}`,
                      background: isActive ? c.activeBg : c.btnBg,
                    }}
                    title={locked ? `${theme.label} — ${PREMIUM_PRICES.theme.usdc} USDC to unlock` : theme.label}
                  >
                    {theme.label}
                    {locked && <span style={{ ...priceChipStyle, fontSize: mFs - 1 }}>{PREMIUM_PRICES.theme.usdc} USDC</span>}
                  </button>
                );
              })}
            </div>

            {/* Collapsible custom parts */}
            <div
              onClick={() => setPartsExpanded(!partsExpanded)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                marginTop: 8,
                padding: "4px 0",
              }}
            >
              <span style={{ fontSize: mFs, color: c.muted, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" }}>
                CUSTOM PARTS
              </span>
              <div style={{ flex: 1, height: 1, background: c.border }} />
              <span style={{ fontSize: mFs, color: c.muted }}>{partsExpanded ? "\u25B4" : "\u25BE"}</span>
            </div>

            {partsExpanded && (
              <div style={{ marginTop: 4 }}>
                {PUMP_ZONES.map((zone) => {
                  const zoneConfig = config[zone.id] || {};
                  const isActive = activeZone === zone.id;
                  const hasCustom = zoneConfig.color || zoneConfig.preset !== "stock";

                  return (
                    <div key={zone.id}>
                      <div
                        onClick={() => setActiveZone(isActive ? null : zone.id)}
                        style={{
                          ...styles.zoneRow,
                          background: isActive ? (darkMode ? "rgba(212,168,84,0.15)" : "rgba(212,168,84,0.12)") : "transparent",
                        }}
                      >
                        <div
                          style={{
                            ...styles.swatch,
                            background: zoneConfig.color || (darkMode ? "#666" : "#7888a0"),
                            borderColor: c.swatchBorder,
                            boxShadow: hasCustom ? "0 0 4px rgba(184,146,46,0.5)" : "none",
                          }}
                        />
                        <span style={{ ...styles.zoneName, fontSize: mFsLg, color: c.text }}>{zone.label}</span>
                        <span style={{ ...styles.zonePreset, fontSize: mFs, color: c.muted }}>
                          {MATERIAL_PRESETS[zoneConfig.preset]?.label || "STOCK"}
                        </span>
                        <span style={{ ...styles.zoneChevron, fontSize: mFs, color: c.muted }}>{isActive ? "\u25B4" : "\u25BE"}</span>
                      </div>

                      {isActive && (
                        <div style={styles.zoneEditor}>
                          <div style={styles.editorRow}>
                            <span style={{ ...styles.editorLabel, fontSize: mFs, color: c.muted }}>COLOR</span>
                            <div style={styles.colorPickerWrap}>
                              <input
                                type="color"
                                value={zoneConfig.color || "#7888a0"}
                                onChange={(e) => updateZone(zone.id, { color: e.target.value })}
                                style={styles.colorInput}
                              />
                              <span style={styles.colorHex}>
                                {(zoneConfig.color || "STOCK").toUpperCase()}
                              </span>
                              {zoneConfig.color && (
                                <button
                                  onClick={() => updateZone(zone.id, { color: null })}
                                  style={styles.resetBtn}
                                >
                                  RESET
                                </button>
                              )}
                            </div>
                          </div>

                          <div style={styles.editorRow}>
                            <span style={{ ...styles.editorLabel, fontSize: mFs, color: c.muted }}>FINISH</span>
                            <div style={styles.presetButtons}>
                              {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                                <button
                                  key={key}
                                  onClick={() => updateZone(zone.id, { preset: key })}
                                  style={{
                                    ...styles.presetBtn,
                                    fontSize: mFs,
                                    padding: isMobile ? "4px 8px" : "2px 5px",
                                    background: (zoneConfig.preset || "stock") === key ? c.activeBg : c.btnBg,
                                    border: `1px solid ${(zoneConfig.preset || "stock") === key ? c.activeBorder : c.btnBorder}`,
                                    color: (zoneConfig.preset || "stock") === key ? c.activeText : c.btnText,
                                  }}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ ...styles.divider, background: c.border }} />

          {/* ── SIGN group: Visibility + Style | Image + Security Cam ── */}
          <div style={{ ...styles.presetLabel, fontSize: mFs, color: c.accent, marginBottom: 6, letterSpacing: "0.16em" }}>SIGN</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: isMobile ? 10 : 6,
            opacity: hasSelection ? 1 : 0.4,
            pointerEvents: hasSelection ? "auto" : "none",
            marginBottom: 8,
          }}>
            {/* Sign visibility toggle */}
            <div>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>VISIBILITY</span>
              <button
                onClick={() => {
                  const newShowSign = !config.showSign;
                  const updates = { ...config, showSign: newShowSign };
                  // Camera requires the sign — turn it off when sign is hidden
                  if (!newShowSign) updates.showCamera = false;
                  onChange(updates);
                }}
                style={{
                  padding: isMobile ? "5px 12px" : "3px 10px",
                  background: config.showSign ? c.activeBg : c.btnBg,
                  border: `1px solid ${config.showSign ? c.activeBorder : c.btnBorder}`,
                  borderRadius: 2,
                  color: config.showSign ? c.activeText : c.btnText,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: mFs,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                {config.showSign ? "ON" : "OFF"}
              </button>
            </div>

            {/* Sign style picker — only when more than one style exists; requires sign visible */}
            {SIGN_CATALOG.length > 1 && (
              <div style={{ opacity: config.showSign ? 1 : 0.35, pointerEvents: config.showSign ? "auto" : "none" }}>
                <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>STYLE</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {SIGN_CATALOG.map((s) => {
                    const isActive = (config.signStyle || "sign1") === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onChange({ ...config, signStyle: s.id })}
                        style={{
                          padding: isMobile ? "5px 8px" : "3px 8px",
                          background: isActive ? c.activeBg : c.btnBg,
                          border: `1px solid ${isActive ? c.activeBorder : c.btnBorder}`,
                          borderRadius: 2,
                          color: isActive ? c.activeText : c.btnText,
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: mFs - 1,
                          letterSpacing: "0.1em",
                          cursor: "pointer",
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sign image upload — only enabled when sign is visible */}
            <div style={{ opacity: config.showSign ? 1 : 0.35, pointerEvents: config.showSign ? "auto" : "none" }}>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>IMAGE</span>
              <div style={styles.signInputWrap}>
                <label style={{ ...styles.signUploadBtn, fontSize: mFs, padding: isMobile ? "5px 10px" : "3px 7px", color: c.btnText, borderColor: c.btnBorder, background: c.btnBg }}>
                  {config.signImageUrl ? "CHANGE" : "UPLOAD"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      let blob = null;
                      try {
                        blob = await resizeSignImage(file, 2048, 0.92);
                      } catch {
                        blob = null; // fall back to original on any decode/encode error
                      }
                      const url = URL.createObjectURL(blob || file);
                      onChange({ ...config, signImageUrl: url });
                    }}
                  />
                </label>
                {config.signImageUrl && (
                  <button
                    onClick={() => {
                      if (config.signImageUrl?.startsWith("blob:")) {
                        URL.revokeObjectURL(config.signImageUrl);
                      }
                      onChange({ ...config, signImageUrl: null });
                    }}
                    style={{ ...styles.resetBtn, fontSize: mFs, color: c.muted, borderColor: c.btnBorder }}
                  >
                    CLEAR
                  </button>
                )}
              </div>
              {/* Fit mode — how the uploaded image maps onto the sign face */}
              {config.signImageUrl && (
                <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                  {[["fill", "FILL"], ["fit", "FIT"], ["stretch", "STRETCH"]].map(([key, lbl]) => {
                    const isActive = (config.signFit || "fill") === key;
                    return (
                      <button
                        key={key}
                        onClick={() => onChange({ ...config, signFit: key })}
                        style={{
                          padding: isMobile ? "4px 7px" : "2px 6px",
                          background: isActive ? c.activeBg : c.btnBg,
                          border: `1px solid ${isActive ? c.activeBorder : c.btnBorder}`,
                          borderRadius: 2,
                          color: isActive ? c.activeText : c.btnText,
                          fontFamily: "'Share Tech Mono', monospace",
                          fontSize: mFs - 1,
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                        title={key === "fill" ? "Cover the sign, crop overflow (no distortion)" : key === "fit" ? "Fit the whole image, with letterbox bars" : "Stretch edge-to-edge (may distort)"}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Security camera toggle — requires sign to be visible */}
            <div style={{ opacity: config.showSign ? 1 : 0.35, pointerEvents: config.showSign ? "auto" : "none" }}>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>
                SECURITY CAM {!unlockedItems.has("camera") && <span style={{ ...priceChipStyle, fontSize: mFs - 1 }}>{PREMIUM_PRICES.accessory.usdc} USDC</span>}
              </span>
              <button
                onClick={() => onChange({ ...config, showCamera: !config.showCamera })}
                style={{
                  padding: isMobile ? "5px 12px" : "3px 10px",
                  background: config.showCamera ? c.activeBg : c.btnBg,
                  border: `1px solid ${config.showCamera ? c.activeBorder : c.btnBorder}`,
                  borderRadius: 2,
                  color: config.showCamera ? c.activeText : c.btnText,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: mFs,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                {config.showCamera ? "ON" : "OFF"}
              </button>
              {config.showCamera && userId && (
                <button
                  onClick={() => window.open(`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "OilRogueBot"}?start=${userId}`, "_blank")}
                  style={{
                    padding: isMobile ? "5px 12px" : "3px 10px",
                    background: c.btnBg,
                    border: `1px solid ${c.btnBorder}`,
                    borderRadius: 2,
                    color: c.btnText,
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: mFs,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    marginLeft: 4,
                  }}
                >
                  LINK TELEGRAM
                </button>
              )}
            </div>
          </div>

          <div style={{ ...styles.divider, background: c.border }} />

          {/* Fence selector */}
          <div style={{ opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none", marginBottom: 8 }}>
            <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>FENCE</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button
                onClick={() => onChange({ ...config, fenceType: null })}
                style={{
                  padding: isMobile ? "5px 8px" : "3px 8px",
                  background: !config.fenceType ? c.activeBg : c.btnBg,
                  border: `1px solid ${!config.fenceType ? c.activeBorder : c.btnBorder}`,
                  borderRadius: 2,
                  color: !config.fenceType ? c.activeText : c.btnText,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: mFs - 1,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                NONE
              </button>
              {FENCE_CATALOG.map((f) => {
                const fenceLocked = isPremiumFence(f.id) && !unlockedItems.has(makePurchaseId("fence", f.id));
                const isActive = config.fenceType === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => onChange({ ...config, fenceType: f.id })}
                    style={{
                      padding: isMobile ? "5px 8px" : "3px 8px",
                      background: isActive ? c.activeBg : c.btnBg,
                      border: `1px solid ${isActive ? c.activeBorder : c.btnBorder}`,
                      borderRadius: 2,
                      color: isActive ? c.activeText : c.btnText,
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: mFs - 1,
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                    {fenceLocked && <span style={{ ...priceChipStyle, fontSize: mFs - 2 }}>{PREMIUM_PRICES.fence.usdc} USDC</span>}
                  </button>
                );
              })}
            </div>

            {/* Poop cleanup */}
            {config.poop && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: mFs, color: "#a05030", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" }}>POOP DETECTED</span>
                <button
                  onClick={() => onChange({ ...config, poop: false })}
                  style={{
                    padding: isMobile ? "5px 12px" : "3px 10px",
                    background: "#a05030",
                    border: "1px solid #c06040",
                    borderRadius: 2,
                    color: "#fff",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: mFs,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  CLEAN UP
                </button>
              </div>
            )}
          </div>

          <div style={{ ...styles.divider, background: c.border }} />

          {/* Plot add-ons */}
          <div style={{ opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>PLOT ADD-ONS</span>
              <span style={{
                fontSize: mFs,
                color: isFull ? "#a05030" : c.muted,
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: "0.1em",
              }}>
                {addonCount}/{maxAddons}
              </span>
            </div>

            {/* 3x3 slot grid */}
            <div style={addonStyles.grid}>
              {[
                [5, 6, 7],
                [3, "pump", 4],
                [0, 1, 2],
              ].map((row, ri) => (
                <div key={ri} style={addonStyles.gridRow}>
                  {row.map((cell) => {
                    if (cell === "pump") {
                      return (
                        <div key="pump" style={{ ...addonStyles.pumpCell, width: isMobile ? 48 : 44, height: isMobile ? 36 : 32, background: c.pumpCellBg, borderColor: c.pumpCellBorder, color: c.muted }}>
                          <span style={{ fontSize: isMobile ? 10 : 8, letterSpacing: "0.1em" }}>PUMP</span>
                        </div>
                      );
                    }
                    const slotKey = String(cell);
                    if (BLOCKED_ADDON_SLOTS.has(slotKey)) {
                      return (
                        <div
                          key={cell}
                          style={{
                            ...addonStyles.slotCell,
                            width: isMobile ? 48 : 44,
                            height: isMobile ? 36 : 32,
                            background: c.slotBg,
                            borderColor: c.slotBorder,
                            opacity: 0.3,
                            cursor: "not-allowed",
                          }}
                          title="Unavailable"
                        >
                          <span style={{ fontSize: isMobile ? 12 : 10, color: c.muted, lineHeight: 1 }}>&#10005;</span>
                        </div>
                      );
                    }
                    const addonEntry = addons[slotKey];
                    const item = addonEntry ? ADDON_CATALOG.find((c) => c.id === addonEntry.id) : null;
                    const isEmpty = !item;
                    const disabled = isEmpty && isFull;
                    const isPicking = pickerSlot === slotKey;
                    const rot = addonEntry?.rot || 0;
                    const rotLabel = ["", "90°", "180°", "270°"][rot] || "";

                    return (
                      <div
                        key={cell}
                        style={{
                          ...addonStyles.slotCell,
                          width: isMobile ? 48 : 44,
                          height: isMobile ? 36 : 32,
                          background: item
                            ? item.color + "22"
                            : isPicking
                              ? "rgba(212,168,84,0.15)"
                              : c.slotBg,
                          borderColor: item
                            ? item.color + "66"
                            : isPicking
                              ? c.activeBorder
                              : c.slotBorder,
                          cursor: disabled ? "default" : "pointer",
                          opacity: disabled ? 0.35 : 1,
                          position: "relative",
                        }}
                        title={item ? `${item.label} (click to remove)` : disabled ? `Max ${maxAddons} add-ons` : "Click to add"}
                      >
                        {item ? (
                          <>
                            <div
                              onClick={() => {
                                const next = { ...addons };
                                delete next[slotKey];
                                onChange({ ...config, addons: next });
                              }}
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
                            >
                              <div style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: item.color,
                                boxShadow: item.emissive ? `0 0 4px ${item.color}` : "none",
                              }} />
                              <span style={{ fontSize: isMobile ? 8 : 7, color: c.text, lineHeight: 1 }}>
                                {item.label.split(" ").pop()}
                              </span>
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const allowed = item.allowedRotations || [0, 1, 2, 3];
                                const curIdx = allowed.indexOf(rot);
                                const nextRot = allowed[(curIdx + 1) % allowed.length];
                                onChange({ ...config, addons: { ...addons, [slotKey]: { ...addonEntry, rot: nextRot } } });
                              }}
                              style={{
                                position: "absolute",
                                top: -5,
                                right: -5,
                                fontSize: 12,
                                color: c.activeText,
                                background: c.activeBg,
                                border: `1px solid ${c.activeBorder}`,
                                borderRadius: "50%",
                                width: 16,
                                height: 16,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                lineHeight: 1,
                                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                              }}
                              title="Rotate 90°"
                            >
                              &#8635;
                            </div>
                          </>
                        ) : (
                          <div
                            onClick={() => {
                              if (disabled) return;
                              setPickerSlot(isPicking ? null : slotKey);
                            }}
                            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer" }}
                          >
                            <span style={{ fontSize: isMobile ? 14 : 12, color: c.plusColor }}>+</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Item picker dropdown */}
            {pickerSlot !== null && (
              <div style={{ ...addonStyles.picker, background: c.pickerBg, borderColor: c.pumpCellBorder }}>
                <div style={{ fontSize: mFs, color: c.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
                  SELECT ITEM FOR SLOT {pickerSlot}
                </div>
                <div style={addonStyles.pickerList}>
                  {ADDON_CATALOG.map((item) => {
                    const addonLocked = isPremiumAddon(item.id) && !unlockedItems.has(makePurchaseId("addon", item.id));
                    const defaultRot = item.allowedRotations ? item.allowedRotations[0] : 0;
                    // Auto-snap to nearest allowed slot if current slot isn't valid
                    const slotNum = parseInt(pickerSlot, 10);
                    const targetSlot = (item.allowedSlots && !item.allowedSlots.includes(slotNum))
                      ? String(item.allowedSlots.reduce((best, s) => Math.abs(s - slotNum) < Math.abs(best - slotNum) ? s : best))
                      : pickerSlot;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onChange({ ...config, addons: { ...addons, [targetSlot]: { id: item.id, rot: defaultRot } } });
                          setPickerSlot(null);
                        }}
                        style={{
                          ...addonStyles.pickerItem,
                          fontSize: mFs,
                          padding: isMobile ? "5px 8px" : "3px 6px",
                          color: c.text,
                        }}
                      >
                        <div style={{
                          width: 10, height: 10, borderRadius: 2,
                          background: item.color, flexShrink: 0,
                          boxShadow: item.emissive ? `0 0 4px ${item.color}` : "none",
                        }} />
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          {item.label}
                          {addonLocked && <span style={{ ...priceChipStyle, fontSize: mFs - 1 }}>{PREMIUM_PRICES.addon.usdc} USDC</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Slot unlock buttons */}
            {onPurchaseRequest && (
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {[4, 5].map((slotNum) => {
                  const slotId = `slotUnlock_${slotNum}`;
                  const owned = unlockedItems.has(slotId);
                  return (
                    <button
                      key={slotId}
                      onClick={() => {
                        if (!owned) onPurchaseRequest([{ id: slotId, label: `SLOT ${slotNum}`, category: "slotUnlock" }]);
                      }}
                      disabled={owned}
                      style={{
                        padding: isMobile ? "4px 8px" : "3px 7px",
                        background: owned ? "rgba(22,163,74,0.18)" : c.btnBg,
                        border: owned ? `1px solid rgba(22,163,74,0.55)` : `1px solid ${c.btnBorder}`,
                        borderRadius: 2,
                        color: owned ? "#16a34a" : c.btnText,
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: mFs - 1,
                        letterSpacing: "0.08em",
                        cursor: owned ? "default" : "pointer",
                      }}
                    >
                      {owned ? (
                        <>SLOT {slotNum} &#10003;</>
                      ) : (
                        <>SLOT {slotNum} <span style={{ ...priceChipStyle, fontSize: mFs - 2 }}>{PREMIUM_PRICES.slotUnlock.usdc} USDC</span></>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save button */}
          {isSignedIn && hasSelection && !readOnly && (
            <>
              <div style={{ ...styles.divider, background: c.border }} />
              {lockedInConfig.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{
                    fontSize: mFs,
                    color: "#d4a854",
                    textAlign: "center",
                    letterSpacing: "0.06em",
                    fontFamily: "'Share Tech Mono', monospace",
                    padding: "4px 0 2px",
                  }}>
                    UNLOCK TO SAVE: {lockedInConfig.map(i => i.label).join(", ")}
                  </div>
                  <button
                    onClick={() => onPurchaseRequest?.(lockedInConfig)}
                    style={{
                      padding: isMobile ? "8px 12px" : "7px 10px",
                      background: "rgba(212,168,84,0.15)",
                      border: "1px solid #d4a854",
                      borderRadius: 2,
                      color: "#d4a854",
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: mFs,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    &#128274; UNLOCK {lockedInConfig.length === 1 ? lockedInConfig[0].label : `ALL ${lockedInConfig.length} ITEMS`}
                  </button>
                </div>
              ) : (
                <button
                  onClick={onSave}
                  disabled={saving || !dirty}
                  style={{
                    ...styles.saveBtn,
                    fontSize: mFsLg,
                    padding: isMobile ? "8px 0" : "6px 0",
                    opacity: (saving || !dirty) ? 0.4 : 1,
                    cursor: (saving || !dirty) ? "default" : "pointer",
                  }}
                >
                  {saving ? "SAVING..." : dirty ? "SAVE SETTINGS" : "SAVED"}
                </button>
              )}
            </>
          )}
          {!isSignedIn && hasSelection && (
            <>
              <div style={{ ...styles.divider, background: c.border }} />
              <div style={{ ...styles.selectHint, fontSize: mFsLg, color: c.hintText }}>Sign in to save your customizations</div>
            </>
          )}
        </div>
      )}
    </PanelSection>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  section: {
    padding: "12px 14px",
    borderBottom: "1px solid #d4c8b4",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
  },

  title: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    color: "#5a4010",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Share Tech Mono', monospace",
  },

  icon: {
    fontSize: 12,
    color: "#b8922e",
  },

  chevron: {
    fontSize: 10,
    color: "#9e8e78",
  },

  body: {
    marginTop: 10,
  },

  selectHint: {
    fontSize: 11,
    color: "#6e6050",
    textAlign: "center",
    padding: "8px 0 4px",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  // Theme presets row
  themesRow: {
    marginBottom: 8,
  },

  presetLabel: {
    display: "block",
    fontSize: 10,
    color: "#6e6050",
    letterSpacing: "0.15em",
    marginBottom: 5,
    fontFamily: "'Share Tech Mono', monospace",
  },

  themeButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
  },

  themeBtn: {
    padding: "3px 7px",
    background: "rgba(180,160,130,0.1)",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#504030",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.15s",
  },

  divider: {
    height: 1,
    background: "#d4c8b4",
    margin: "8px 0",
  },

  // Zone list
  zoneList: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },

  zoneRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 4px",
    cursor: "pointer",
    borderRadius: 2,
    transition: "background 0.15s",
  },

  swatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    border: "1px solid rgba(139,105,20,0.3)",
    flexShrink: 0,
  },

  zoneName: {
    flex: 1,
    fontSize: 11,
    color: "#504030",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  zonePreset: {
    fontSize: 10,
    color: "#6e6050",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  zoneChevron: {
    fontSize: 10,
    color: "#6e6050",
    width: 10,
    textAlign: "center",
  },

  // Zone editor (expanded)
  zoneEditor: {
    padding: "6px 4px 8px 18px",
    background: "rgba(180,160,130,0.05)",
    borderLeft: "2px solid #d4a854",
    marginBottom: 4,
  },

  editorRow: {
    marginBottom: 6,
  },

  editorLabel: {
    display: "block",
    fontSize: 10,
    color: "#6e6050",
    letterSpacing: "0.15em",
    marginBottom: 3,
    fontFamily: "'Share Tech Mono', monospace",
  },

  colorPickerWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  colorInput: {
    width: 24,
    height: 18,
    padding: 0,
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    cursor: "pointer",
    background: "none",
  },

  colorHex: {
    fontSize: 11,
    fontFamily: "'Share Tech Mono', monospace",
    color: "#504030",
    letterSpacing: "0.04em",
  },

  resetBtn: {
    padding: "1px 5px",
    background: "none",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#6e6050",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    cursor: "pointer",
    letterSpacing: "0.08em",
  },

  presetButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 2,
  },

  presetBtn: {
    padding: "2px 5px",
    background: "#f0e8dc",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#504030",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    cursor: "pointer",
    transition: "all 0.15s",
    letterSpacing: "0.04em",
  },

  presetBtnActive: {
    background: "#d4a854",
    border: "1px solid #b8922e",
    color: "#3e2e10",
  },

  signSection: {
    marginBottom: 8,
  },

  signInputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  saveBtn: {
    width: "100%",
    padding: "6px 0",
    background: "#d4a854",
    border: "1px solid #b8922e",
    borderRadius: 2,
    color: "#2e2010",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    transition: "all 0.15s",
  },

  signUploadBtn: {
    padding: "3px 7px",
    background: "rgba(180,160,130,0.1)",
    border: "1px solid #b8c4ce",
    borderRadius: 2,
    color: "#3a4a58",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.15s",
  },
};

const addonStyles = {
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 6,
  },
  gridRow: {
    display: "flex",
    gap: 2,
    justifyContent: "center",
  },
  pumpCell: {
    width: 36,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(184,146,46,0.1)",
    border: "1px solid #c8b080",
    borderRadius: 2,
    color: "#5a6a78",
    fontFamily: "'Share Tech Mono', monospace",
  },
  slotCell: {
    width: 36,
    height: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #c4cdd6",
    borderRadius: 2,
    transition: "all 0.15s",
    fontFamily: "'Share Tech Mono', monospace",
  },
  picker: {
    background: "rgba(240,243,246,0.98)",
    border: "1px solid #c8b080",
    borderRadius: 3,
    padding: "6px 8px",
    marginTop: 4,
  },
  pickerList: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    maxHeight: 140,
    overflowY: "auto",
  },
  pickerItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 6px",
    background: "none",
    border: "1px solid transparent",
    borderRadius: 2,
    color: "#3a4a58",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.06em",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.1s",
  },
};

const mStyles = {
  section: {
    padding: "12px 12px",
    borderBottom: "1px solid #c4cdd6",
  },
  title: {
    ...styles.title,
    fontSize: 12,
  },
};
