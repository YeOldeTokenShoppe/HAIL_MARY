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
  // Rail faces from both Bottom_Box and Samson_Post are consolidated into one
  // object; the upper service deck is separate too (2026-09-08).
  { id: "safetyRails",   label: "SAFETY RAILS",    meshes: ["Safety_Rails"] },
  { id: "platform",      label: "SERVICE PLATFORM", meshes: ["Service_Platform"] },
  // The post retains its A-frame and ladder, with its own structural paint.
  { id: "post",          label: "SAMSON POST",    meshes: ["Samson_Post"] },
  { id: "motorBox",      label: "MOTOR BOX",      meshes: ["Cube", "Wheel_Box", "Under_Pump", "Motor_Pulley"] },
  // Synty plot, 2026-09-07: Michelle split the motor box so its pipe run paints with the
  // pipes and its small control panel with the machine panel; the well curb gets its own
  // zone (stock = concrete) so a theme can choose to paint it.
  { id: "wellCurb",      label: "WELL CURB",      meshes: ["WellFrame"] },
  { id: "crankWheel",    label: "CRANK & LINKAGE",    meshes: ["Wheel_Back", "Pitman"] },
  { id: "beam",          label: "WALKING BEAM",   meshes: ["Body_Pump"] },
  { id: "counterweight", label: "COUNTERWEIGHTS", meshes: ["Cylinder_Pump", "Cylinder_Pump001", "Counterweight"] },
  { id: "horseHead",     label: "HORSE HEAD",     meshes: ["Head_Pump"] },
  { id: "drillPipe",     label: "DRILL PIPE",     meshes: ["Straw", "Cylinder"] },
  // Synty pumpjack (?rig=4) reuses Body_Pump / Head_Pump / Wheel_Back / Straw / Bottom_Box /
  // Under_Pump / Pipe_01 / Wheel, so those zones need no new names. Belt, Belt_Clip_0N stay unzoned (atlas).
  // The liquids rig (2026-09-06): the kiosk is the machine panel, with its base and the
  // three-monitor console; the silo's ladder is the scaffold; the ground pipe run is
  // Synty pipe parts (three.js drops the ".00N" dots from node names).
  // The Synty plot's box body is `MachinePanel_Body`; its DANGER decal became a separate
  // `DANGER_LABEL` plane (2026-09-07), so the body takes paint and the decal never does. The
  // instruments (screen, gauge, buttons, toggles, lamps, key) stay stock. Zoom hooks match the prefix.
  { id: "machinePanel",  label: "MACHINE PANEL",  meshes: ["MachinePanel", "MachinePanel_Body", "Under_Pump_Pipe_Panel", "Kiosk_Base", "Console"] },
  { id: "tankScaffold",  label: "TANK SCAFFOLD",  meshes: ["Fuel_Tank_Scaffold", "Fuel_Tank_Ladder"] },
  { id: "signFrame",     label: "SIGN FRAME",     meshes: ["SignFrame", "SignFrame001"] },
  { id: "pipes",          label: "PIPES",           meshes: ["Pipe_01", "Pipe_02", "Pipe_03", "Under_Pump_Pipes", "Pipe_Refinery",
    "SM_Prop_Pipe_Part_Straight_01", "SM_Prop_Pipe_Part_Straight_01001", "SM_Prop_Pipe_Part_Straight_01002",
    "SM_Prop_Pipe_Part_Corner_01", "SM_Prop_Pipe_Part_Corner_01001", "SM_Prop_Pipe_Part_Corner_01002", "SM_Prop_Pipe_Part_Corner_01003", "SM_Prop_Pipe_Part_Corner_01004",
    "SM_Prop_Pipe_Part_Connect_01", "SM_Prop_Pipe_Part_Connect_01001", "SM_Prop_Pipe_Part_Connect_01002", "SM_Prop_Pipe_Part_Connect_01003", "SM_Prop_Pipe_Part_Connect_01004", "SM_Prop_Pipe_Part_Connect_01005", "SM_Prop_Pipe_Part_Connect_01006", "SM_Prop_Pipe_Part_Connect_01007"] },
  { id: "valve",          label: "VALVE WHEEL",     meshes: ["Wheel", "Wheel_BOP"] },
  // the three liquid lines: risers and their wheels, and the front outlet wheels.
  // Outlets and elbows stay UNTHEMED — their colour is the liquid legend.
  { id: "lines",          label: "LIQUID LINES",    meshes: ["Riser_Betroleum", "Riser_Paraboleum", "Riser_Vitriol",
    "Valve_Betroleum", "Valve_Paraboleum", "Valve_Vitriol", "Valve_Out_Betroleum", "Valve_Out_Paraboleum", "Valve_Out_Vitriol",
    "Valve_Out_Betroleum_Stem", "Valve_Out_Paraboleum_Stem", "Valve_Out_Vitriol_Stem",
    "Outlet_Betroleum", "Outlet_Paraboleum", "Outlet_Vitriol", "Outlet_Elbow_Betroleum", "Outlet_Elbow_Paraboleum", "Outlet_Elbow_Vitriol", "Outlet_Manifold"] },
  // the silo shell (translucent glass in code — the theme tints the glass; keep tints light or the oil inside hides).
  // Tank_* are the three compartments once the shell is split.
  { id: "tank",           label: "STORAGE TANK",    meshes: ["Fuel_Tank", "Tank_Betroleum", "Tank_Paraboleum", "Tank_Vitriol"] },
];

export const MATERIAL_PRESETS = {
  stock:    { label: "STOCK",         roughness: null,  metalness: null, emissive: null,     emissiveIntensity: 0, envMapIntensity: 0 },
  matte:    { label: "MATTE",         roughness: 0.92,  metalness: 0.05, emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.1 },
  satin:    { label: "SATIN PAINT",   roughness: 0.48,  metalness: 0.15, emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.7 },
  chrome:   { label: "CHROME",        roughness: 0.0,   metalness: 1.0,  emissive: "#8b8787", emissiveIntensity: 0, envMapIntensity: 3.0, useStandard: true },
  polished: { label: "POLISHED METAL", roughness: 0.2, metalness: 0.9, emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 1.5, useStandard: true },
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
  // ?v= busts the browser cache after a re-export (the sign is authored in the rig's frame, so
  // moving it in Blender is the way to move it on the page — but only once the new file loads).
  { id: "sign1", label: "TALL SIGN", model: "/models/addons/Sign1.glb?v=2", cameraModel: "/models/addons/SecurityCamera_Sign1.glb" },
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

// Complete newer zones when building a preset, so the editor shows the actual
// paint and a player can subsequently choose STOCK on any individual zone.
function completeTheme(config) {
  const inherit = (zone, source, preset) => {
    if (!config[zone]?.color && config[zone]?.preset === "stock") {
      config[zone] = { ...config[source], ...(preset ? { preset } : {}) };
    }
  };
  inherit("post", "foundation");
  inherit("safetyRails", "beam");
  inherit("platform", "motorBox", "brushed");
  inherit("wellCurb", "foundation", "matte");
  inherit("valve", "counterweight");
  return config;
}

// ── Fun preset themes (full rig presets) ─────────────────────────────────────
// Exported for the phone's showcase rig (RigScene pager) — same list the editor offers.
export const THEME_PRESETS = {
  stock: { label: "FACTORY DEFAULT", build: () => getDefaultPumpConfig() },
  vegasVice: {
    label: "VEGAS VICE",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#211D1B", preset: "matte" };
      c.foundation     = { color: "#2D2523", preset: "satin" };
      c.post           = { color: "#45352E", preset: "satin" };
      c.safetyRails    = { color: "#BCA57D", preset: "gold" };
      c.platform       = { color: "#93877B", preset: "brushed" };
      c.beam           = { color: "#D6CCB7", preset: "satin" };
      c.horseHead      = { color: "#C3A570", preset: "gold" };
      c.counterweight  = { color: "#AF292C", preset: "satin" };
      c.crankWheel     = { color: "#68544A", preset: "brushed" };
      c.motorBox       = { color: "#322927", preset: "satin" };
      c.drillPipe      = { color: "#C8C0B5", preset: "polished" };
      c.machinePanel   = { color: "#A72A2D", preset: "satin" };
      c.tankScaffold   = { color: "#726052", preset: "brushed" };
      c.signFrame      = { color: "#C24270", preset: "neonDeep" };
      c.pipes          = { color: "#8B7A69", preset: "brushed" };
      c.lines          = { color: "#8B7A69", preset: "brushed" };
      c.tank           = { color: "#E3D7C2", preset: "matte" };
      c.valve          = { color: "#C24270", preset: "neonDeep" };
      c.wellCurb       = { color: "#55483E", preset: "matte" };
      return completeTheme(c);
    },
  },
  peacockRoyale: {
    label: "PEACOCK ROYALE",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#19252C", preset: "matte" };
      c.foundation     = { color: "#1D3940", preset: "matte" };
      c.post           = { color: "#285658", preset: "satin" };
      c.safetyRails    = { color: "#B29759", preset: "gold" };
      c.platform       = { color: "#697F8B", preset: "brushed" };
      c.beam           = { color: "#175D83", preset: "brushed" };
      c.horseHead      = { color: "#208567", preset: "polished" };
      c.counterweight  = { color: "#733F97", preset: "brushed" };
      c.crankWheel     = { color: "#46556B", preset: "brushed" };
      c.motorBox       = { color: "#253947", preset: "satin" };
      c.drillPipe      = { color: "#B1C3CA", preset: "polished" };
      c.machinePanel   = { color: "#653B83", preset: "satin" };
      c.tankScaffold   = { color: "#476B72", preset: "brushed" };
      c.signFrame      = { color: "#B29759", preset: "gold" };
      c.pipes          = { color: "#597B80", preset: "brushed" };
      c.lines          = { color: "#597B80", preset: "brushed" };
      c.tank           = { color: "#C5D9D4", preset: "matte" };
      c.valve          = { color: "#B29759", preset: "gold" };
      c.wellCurb       = { color: "#364F59", preset: "matte" };
      return completeTheme(c);
    },
  },
  deepSpaceSalvage: {
    label: "DEEP SPACE SALVAGE",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#27282D", preset: "matte" };
      c.foundation     = { color: "#35383E", preset: "matte" };
      c.post           = { color: "#747D89", preset: "brushed" };
      c.safetyRails    = { color: "#D76628", preset: "satin" };
      c.platform       = { color: "#949CA6", preset: "brushed" };
      c.beam           = { color: "#C8C5BA", preset: "satin" };
      c.horseHead      = { color: "#383E49", preset: "brushed" };
      c.counterweight  = { color: "#969A9F", preset: "brushed" };
      c.crankWheel     = { color: "#5C6470", preset: "brushed" };
      c.motorBox       = { color: "#3E4550", preset: "satin" };
      c.drillPipe      = { color: "#C2CAD3", preset: "polished" };
      c.machinePanel   = { color: "#C8C5BA", preset: "satin" };
      c.tankScaffold   = { color: "#727B87", preset: "brushed" };
      c.signFrame      = { color: "#D76628", preset: "satin" };
      c.pipes          = { color: "#86919F", preset: "brushed" };
      c.lines          = { color: "#86919F", preset: "brushed" };
      c.tank           = { color: "#DAD6CA", preset: "matte" };
      c.valve          = { color: "#C95119", preset: "neonDeep" };
      c.wellCurb       = { color: "#555C66", preset: "matte" };
      return completeTheme(c);
    },
  },
  copperhead: {
    label: "COPPERHEAD",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#242120", preset: "matte" };
      c.foundation     = { color: "#322B27", preset: "matte" };
      c.post           = { color: "#554237", preset: "brushed" };
      c.safetyRails    = { color: "#438F87", preset: "satin" };
      c.platform       = { color: "#84766B", preset: "brushed" };
      c.beam           = { color: "#242427", preset: "satin" };
      c.horseHead      = { color: "#B97448", preset: "polished" };
      c.counterweight  = { color: "#9D5835", preset: "brushed" };
      c.crankWheel     = { color: "#655045", preset: "brushed" };
      c.motorBox       = { color: "#34302F", preset: "satin" };
      c.drillPipe      = { color: "#BDB3A7", preset: "polished" };
      c.machinePanel   = { color: "#427B73", preset: "satin" };
      c.tankScaffold   = { color: "#6B5647", preset: "brushed" };
      c.signFrame      = { color: "#438F87", preset: "satin" };
      c.pipes          = { color: "#8D6B54", preset: "brushed" };
      c.lines          = { color: "#8D6B54", preset: "brushed" };
      c.tank           = { color: "#D4C8B8", preset: "matte" };
      c.valve          = { color: "#4FABA0", preset: "brushed" };
      c.wellCurb       = { color: "#53463C", preset: "matte" };
      return completeTheme(c);
    },
  },
  midnightOctane: {
    label: "MIDNIGHT OCTANE",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#111820", preset: "matte" };
      c.foundation     = { color: "#101C2C", preset: "matte" };
      c.post           = { color: "#24394A", preset: "matte" };
      c.safetyRails    = { color: "#D99159", preset: "gold" };
      c.platform       = { color: "#9AAAB3", preset: "brushed" };
      c.beam           = { color: "#167D8D", preset: "brushed" };
      c.horseHead      = { color: "#2396A0", preset: "brushed" };
      c.counterweight  = { color: "#986541", preset: "brushed" };
      c.crankWheel     = { color: "#344858", preset: "brushed" };
      c.motorBox       = { color: "#101C2C", preset: "matte" };
      c.drillPipe      = { color: "#B8C6CE", preset: "chrome" };
      c.machinePanel   = { color: "#245564", preset: "matte" };
      c.tankScaffold   = { color: "#344858", preset: "brushed" };
      c.signFrame      = { color: "#D99159", preset: "gold" };
      c.pipes          = { color: "#667E8B", preset: "brushed" };
      c.lines          = { color: "#667E8B", preset: "brushed" };
      c.tank           = { color: "#C6E0DE", preset: "matte" };
      c.valve          = { color: "#D99159", preset: "brushed" };
      c.wellCurb       = { color: "#303D47", preset: "matte" };
      return completeTheme(c);
    },
  },
  blackCherryChrome: {
    label: "BLACK CHERRY CHROME",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#190F16", preset: "matte" };
      c.foundation     = { color: "#200E18", preset: "matte" };
      c.post           = { color: "#422132", preset: "brushed" };
      c.safetyRails    = { color: "#D8D8E0", preset: "chrome" };
      c.platform       = { color: "#777481", preset: "brushed" };
      c.beam           = { color: "#9E2348", preset: "brushed" };
      c.horseHead      = { color: "#C33C67", preset: "brushed" };
      c.counterweight  = { color: "#70243F", preset: "brushed" };
      c.crankWheel     = { color: "#3E2736", preset: "brushed" };
      c.motorBox       = { color: "#200E18", preset: "matte" };
      c.drillPipe      = { color: "#D8D8E0", preset: "chrome" };
      c.machinePanel   = { color: "#9E2348", preset: "brushed" };
      c.tankScaffold   = { color: "#777481", preset: "brushed" };
      c.signFrame      = { color: "#D8D8E0", preset: "chrome" };
      c.pipes          = { color: "#817687", preset: "brushed" };
      c.lines          = { color: "#817687", preset: "brushed" };
      c.tank           = { color: "#E6CDD8", preset: "matte" };
      c.valve          = { color: "#E8A6BC", preset: "brushed" };
      c.wellCurb       = { color: "#3D2C37", preset: "matte" };
      return completeTheme(c);
    },
  },
  miamiAfterHours: {
    label: "MIAMI AFTER HOURS",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#111825", preset: "matte" };
      c.foundation     = { color: "#101827", preset: "matte" };
      c.post           = { color: "#26354D", preset: "matte" };
      c.safetyRails    = { color: "#FF786B", preset: "matte" };
      c.platform       = { color: "#84989E", preset: "brushed" };
      c.beam           = { color: "#36B5AB", preset: "brushed" };
      c.horseHead      = { color: "#BFE4DD", preset: "matte" };
      c.counterweight  = { color: "#CD5E61", preset: "brushed" };
      c.crankWheel     = { color: "#34475C", preset: "brushed" };
      c.motorBox       = { color: "#101827", preset: "matte" };
      c.drillPipe      = { color: "#BACAD4", preset: "chrome" };
      c.machinePanel   = { color: "#36B5AB", preset: "matte" };
      c.tankScaffold   = { color: "#34475C", preset: "brushed" };
      c.signFrame      = { color: "#B83E86", preset: "neonDeep" };
      c.pipes          = { color: "#577E8E", preset: "brushed" };
      c.lines          = { color: "#577E8E", preset: "brushed" };
      c.tank           = { color: "#CCE4E2", preset: "matte" };
      c.valve          = { color: "#B83E86", preset: "neonDeep" };
      c.wellCurb       = { color: "#344252", preset: "matte" };
      return completeTheme(c);
    },
  },
  goldRush: {
    label: "GOLD RUSH",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#211D18", preset: "matte" };
      c.foundation     = { color: "#30312F", preset: "matte" };
      c.post           = { color: "#474540", preset: "brushed" };
      c.safetyRails    = { color: "#D6BD82", preset: "gold" };
      c.platform       = { color: "#8D8980", preset: "brushed" };
      c.beam           = { color: "#D6BD82", preset: "gold" };
      c.horseHead      = { color: "#E5D2A0", preset: "gold" };
      c.counterweight  = { color: "#967040", preset: "brushed" };
      c.crankWheel     = { color: "#5E503C", preset: "brushed" };
      c.motorBox       = { color: "#252B2C", preset: "matte" };
      c.drillPipe      = { color: "#B1A99A", preset: "brushed" };
      c.machinePanel   = { color: "#5E503C", preset: "brushed" };
      c.tankScaffold   = { color: "#5C5E56", preset: "brushed" };
      c.signFrame      = { color: "#D6BD82", preset: "gold" };
      c.pipes          = { color: "#786A52", preset: "brushed" };
      c.lines          = { color: "#786A52", preset: "brushed" };
      c.tank           = { color: "#E2D8BE", preset: "matte" };
      c.valve          = { color: "#C5A461", preset: "gold" };
      c.wellCurb       = { color: "#494740", preset: "matte" };
      return completeTheme(c);
    },
  },
  murdered: {
    label: "MURDERED OUT",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#131619", preset: "matte" };
      c.foundation     = { color: "#1B2025", preset: "matte" };
      c.post           = { color: "#30353B", preset: "satin" };
      c.safetyRails    = { color: "#454C53", preset: "satin" };
      c.platform       = { color: "#343A40", preset: "satin" };
      c.beam           = { color: "#30363D", preset: "satin" };
      c.horseHead      = { color: "#252B31", preset: "satin" };
      c.counterweight  = { color: "#252A30", preset: "satin" };
      c.crankWheel     = { color: "#414850", preset: "brushed" };
      c.motorBox       = { color: "#20252B", preset: "matte" };
      c.drillPipe      = { color: "#4A525A", preset: "brushed" };
      c.machinePanel   = { color: "#30353B", preset: "satin" };
      c.tankScaffold   = { color: "#343A40", preset: "satin" };
      c.signFrame      = { color: "#454C53", preset: "satin" };
      c.pipes          = { color: "#353D44", preset: "satin" };
      c.lines          = { color: "#353D44", preset: "satin" };
      c.tank           = { color: "#A9AFB6", preset: "matte" };
      c.valve          = { color: "#414850", preset: "brushed" };
      c.wellCurb       = { color: "#24292E", preset: "matte" };
      return completeTheme(c);
    },
  },
  cyberpunk: {
    label: "CYBERPUNK",
    build: () => {
      const c = getDefaultPumpConfig();
      c.pad            = { color: "#100D19", preset: "matte" };
      c.foundation     = { color: "#1A1728", preset: "matte" };
      c.post           = { color: "#302B43", preset: "matte" };
      c.safetyRails    = { color: "#A9236A", preset: "neonDeep" };
      c.platform       = { color: "#68748A", preset: "brushed" };
      c.beam           = { color: "#168DA3", preset: "brushed" };
      c.horseHead      = { color: "#304559", preset: "brushed" };
      c.counterweight  = { color: "#7C284E", preset: "brushed" };
      c.crankWheel     = { color: "#393547", preset: "brushed" };
      c.motorBox       = { color: "#1A1728", preset: "matte" };
      c.drillPipe      = { color: "#899EB3", preset: "brushed" };
      c.machinePanel   = { color: "#24596D", preset: "brushed" };
      c.tankScaffold   = { color: "#393547", preset: "brushed" };
      c.signFrame      = { color: "#168DA3", preset: "brushed" };
      c.pipes          = { color: "#4C4965", preset: "brushed" };
      c.lines          = { color: "#4C4965", preset: "brushed" };
      c.tank           = { color: "#CBD5E4", preset: "matte" };
      c.valve          = { color: "#A9236A", preset: "neonDeep" };
      c.wellCurb       = { color: "#35313F", preset: "matte" };
      return completeTheme(c);
    },
  },
  toxic: {
    label: "BIOHAZARD",
    build: () => {
      const c = getDefaultPumpConfig();
      // Acid chartreuse over cold charcoal; glow stays on thin safety details.
      c.pad            = { color: "#151519", preset: "matte" };
      c.foundation     = { color: "#22232A", preset: "matte" };
      c.post           = { color: "#33333E", preset: "satin" };
      c.safetyRails    = { color: "#83AC08", preset: "neonDeep" };
      c.platform       = { color: "#717482", preset: "brushed" };
      c.beam           = { color: "#A5C817", preset: "satin" };
      c.horseHead      = { color: "#2C2C37", preset: "satin" };
      c.counterweight  = { color: "#7A940D", preset: "satin" };
      c.crankWheel     = { color: "#41414D", preset: "brushed" };
      c.motorBox       = { color: "#262630", preset: "matte" };
      c.drillPipe      = { color: "#9295A2", preset: "brushed" };
      c.machinePanel   = { color: "#A5C817", preset: "satin" };
      c.tankScaffold   = { color: "#454552", preset: "brushed" };
      c.signFrame      = { color: "#83AC08", preset: "neonDeep" };
      c.pipes          = { color: "#51515F", preset: "brushed" };
      c.lines          = { color: "#51515F", preset: "brushed" };
      c.tank           = { color: "#E1E8BF", preset: "matte" };
      c.valve          = { color: "#83AC08", preset: "neonDeep" };
      c.wellCurb       = { color: "#464650", preset: "matte" };
      return completeTheme(c);
    },
  },
hellforged: {
  label: "HELLFORGED",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#211B1C", preset: "matte" };
    c.foundation     = { color: "#2C292D", preset: "matte" };
    c.post           = { color: "#42363B", preset: "satin" };
    c.safetyRails    = { color: "#C6531D", preset: "neonDeep" };
    c.platform       = { color: "#666169", preset: "brushed" };
    c.beam           = { color: "#852F2B", preset: "satin" };
    c.horseHead      = { color: "#3D3D46", preset: "brushed" };
    c.counterweight  = { color: "#A13222", preset: "satin" };
    c.crankWheel     = { color: "#544046", preset: "brushed" };
    c.motorBox       = { color: "#302A31", preset: "matte" };
    c.drillPipe      = { color: "#8B7770", preset: "brushed" };
    c.machinePanel   = { color: "#653536", preset: "satin" };
    c.tankScaffold   = { color: "#51454C", preset: "brushed" };
    c.signFrame      = { color: "#8B7770", preset: "brushed" };
    c.pipes          = { color: "#65535A", preset: "brushed" };
    c.lines          = { color: "#65535A", preset: "brushed" };
    c.tank           = { color: "#E5C8B8", preset: "matte" };
    c.valve          = { color: "#C6531D", preset: "neonDeep" };
    c.wellCurb       = { color: "#514548", preset: "matte" };
    return completeTheme(c);
  },
},
arctic: {
  label: "ARCTIC INDUSTRIAL",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#303E4B", preset: "matte" };
    c.foundation     = { color: "#2C3C4B", preset: "matte" };
    c.post           = { color: "#3E586F", preset: "satin" };
    c.safetyRails    = { color: "#4095AA", preset: "brushed" };
    c.platform       = { color: "#8296A8", preset: "brushed" };
    c.beam           = { color: "#9FB7CA", preset: "brushed" };
    c.horseHead      = { color: "#CBD7DF", preset: "satin" };
    c.counterweight  = { color: "#467D9B", preset: "brushed" };
    c.crankWheel     = { color: "#566B80", preset: "brushed" };
    c.motorBox       = { color: "#2E4359", preset: "satin" };
    c.drillPipe      = { color: "#C0D3DD", preset: "polished" };
    c.machinePanel   = { color: "#738FA6", preset: "brushed" };
    c.tankScaffold   = { color: "#566D80", preset: "brushed" };
    c.signFrame      = { color: "#4095AA", preset: "brushed" };
    c.pipes          = { color: "#8099AD", preset: "brushed" };
    c.lines          = { color: "#8099AD", preset: "brushed" };
    c.tank           = { color: "#EDF4F3", preset: "matte" };
    c.valve          = { color: "#42B4CA", preset: "neonDeep" };
    c.wellCurb       = { color: "#4F677A", preset: "matte" };
    return completeTheme(c);
  },
},
desert: {
  label: "MAD MAX",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#3C322A", preset: "matte" };
    c.foundation     = { color: "#393936", preset: "matte" };
    c.post           = { color: "#777060", preset: "matte" };
    c.safetyRails    = { color: "#A5533C", preset: "rust" };
    c.platform       = { color: "#77766C", preset: "rust" };
    c.beam           = { color: "#C2B397", preset: "matte" };
    c.horseHead      = { color: "#464642", preset: "matte" };
    c.counterweight  = { color: "#81523A", preset: "rust" };
    c.crankWheel     = { color: "#5E5146", preset: "rust" };
    c.motorBox       = { color: "#3D413C", preset: "matte" };
    c.drillPipe      = { color: "#9C9785", preset: "rust" };
    c.machinePanel   = { color: "#8E7860", preset: "matte" };
    c.tankScaffold   = { color: "#696357", preset: "rust" };
    c.signFrame      = { color: "#A5533C", preset: "rust" };
    c.pipes          = { color: "#76604B", preset: "rust" };
    c.lines          = { color: "#76604B", preset: "rust" };
    c.tank           = { color: "#D5CABA", preset: "matte" };
    c.valve          = { color: "#A5533C", preset: "rust" };
    c.wellCurb       = { color: "#72695A", preset: "matte" };
    return completeTheme(c);
  },
},
crimsonCharge: {
  label: "RED BULL",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#424852", preset: "matte" };
    c.foundation     = { color: "#292E38", preset: "matte" };
    c.post           = { color: "#A1ABB8", preset: "brushed" };
    c.safetyRails    = { color: "#C2CAD2", preset: "brushed" };
    c.platform       = { color: "#8D98A6", preset: "brushed" };
    c.beam           = { color: "#234D9A", preset: "satin" };
    c.horseHead      = { color: "#BC2331", preset: "satin" };
    c.counterweight  = { color: "#98232E", preset: "satin" };
    c.crankWheel     = { color: "#5D6B80", preset: "brushed" };
    c.motorBox       = { color: "#263A60", preset: "satin" };
    c.drillPipe      = { color: "#C2CAD2", preset: "polished" };
    c.machinePanel   = { color: "#234D9A", preset: "satin" };
    c.tankScaffold   = { color: "#748295", preset: "brushed" };
    c.signFrame      = { color: "#C2CAD2", preset: "brushed" };
    c.pipes          = { color: "#8D98A6", preset: "brushed" };
    c.lines          = { color: "#8D98A6", preset: "brushed" };
    c.tank           = { color: "#D8E1ED", preset: "matte" };
    c.valve          = { color: "#C0A25D", preset: "gold" };
    c.wellCurb       = { color: "#5B626C", preset: "matte" };
    return completeTheme(c);
  },
},
atomicSurge: {
  label: "MONSTER ENERGY",
  build: () => {
    const c = getDefaultPumpConfig();
    // Neutral black enamel keeps the electric green crisp under warm scene lighting.
    c.pad            = { color: "#171719", preset: "matte" };
    c.foundation     = { color: "#202023", preset: "matte" };
    c.post           = { color: "#29292D", preset: "satin" };
    c.safetyRails    = { color: "#343439", preset: "satin" };
    c.platform       = { color: "#55555C", preset: "brushed" };
    c.beam           = { color: "#19191C", preset: "satin" };
    c.horseHead      = { color: "#45D500", preset: "satin" };
    c.counterweight  = { color: "#45D500", preset: "satin" };
    c.crankWheel     = { color: "#38383E", preset: "brushed" };
    c.motorBox       = { color: "#202024", preset: "satin" };
    c.drillPipe      = { color: "#BABAC2", preset: "polished" };
    c.machinePanel   = { color: "#222226", preset: "satin" };
    c.tankScaffold   = { color: "#424248", preset: "brushed" };
    c.signFrame      = { color: "#3FB800", preset: "neonDeep" };
    c.pipes          = { color: "#44444A", preset: "brushed" };
    c.lines          = { color: "#44444A", preset: "brushed" };
    c.tank           = { color: "#D9D9DF", preset: "matte" };
    c.valve          = { color: "#3FB800", preset: "neonDeep" };
    c.wellCurb       = { color: "#303034", preset: "matte" };
    return completeTheme(c);
  },
},
tokyoNoir: {
  label: "TOKYO NOIR",
  build: () => {
    const c = getDefaultPumpConfig();
    // Ink satin, smoky ivory and vermilion; red lantern glow only on the valves.
    c.pad            = { color: "#18171B", preset: "matte" };
    c.foundation     = { color: "#202127", preset: "matte" };
    c.post           = { color: "#303137", preset: "satin" };
    c.safetyRails    = { color: "#62636A", preset: "brushed" };
    c.platform       = { color: "#74747A", preset: "brushed" };
    c.beam           = { color: "#C8C2B3", preset: "satin" };
    c.horseHead      = { color: "#A63324", preset: "satin" };
    c.counterweight  = { color: "#822B23", preset: "satin" };
    c.crankWheel     = { color: "#48474C", preset: "brushed" };
    c.motorBox       = { color: "#24252B", preset: "satin" };
    c.drillPipe      = { color: "#92908B", preset: "brushed" };
    c.machinePanel   = { color: "#38373D", preset: "satin" };
    c.tankScaffold   = { color: "#505057", preset: "brushed" };
    c.signFrame      = { color: "#62636A", preset: "brushed" };
    c.pipes          = { color: "#56565E", preset: "brushed" };
    c.lines          = { color: "#56565E", preset: "brushed" };
    c.tank           = { color: "#D9D3CB", preset: "matte" };
    c.valve          = { color: "#A62D1B", preset: "neonDeep" };
    c.wellCurb       = { color: "#46454B", preset: "matte" };
    return completeTheme(c);
  },
},
texas: {
  label: "LONE STAR",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#252A33", preset: "matte" };
    c.foundation     = { color: "#293649", preset: "matte" };
    c.post           = { color: "#4A6382", preset: "satin" };
    c.safetyRails    = { color: "#AAB4C2", preset: "brushed" };
    c.platform       = { color: "#7E8B9D", preset: "brushed" };
    c.beam           = { color: "#223957", preset: "satin" };
    c.horseHead      = { color: "#BAC2CF", preset: "brushed" };
    c.counterweight  = { color: "#872E3B", preset: "satin" };
    c.crankWheel     = { color: "#617087", preset: "brushed" };
    c.motorBox       = { color: "#303E53", preset: "satin" };
    c.drillPipe      = { color: "#BCC5D0", preset: "polished" };
    c.machinePanel   = { color: "#872E3B", preset: "satin" };
    c.tankScaffold   = { color: "#67768A", preset: "brushed" };
    c.signFrame      = { color: "#A78B58", preset: "gold" };
    c.pipes          = { color: "#8997AA", preset: "brushed" };
    c.lines          = { color: "#8997AA", preset: "brushed" };
    c.tank           = { color: "#D9DCE0", preset: "matte" };
    c.valve          = { color: "#A78B58", preset: "gold" };
    c.wellCurb       = { color: "#4B576B", preset: "matte" };
    return completeTheme(c);
  },
},
myLittlePony: {
  label: "MY LITTLE PONY",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#352842", preset: "matte" };
    c.foundation     = { color: "#49305F", preset: "satin" };
    c.post           = { color: "#76519D", preset: "satin" };
    c.safetyRails    = { color: "#38BBAE", preset: "satin" };
    c.platform       = { color: "#939BB7", preset: "brushed" };
    c.beam           = { color: "#DE459D", preset: "satin" };
    c.horseHead      = { color: "#B74ABF", preset: "brushed" };
    c.counterweight  = { color: "#C75CBC", preset: "brushed" };
    c.crankWheel     = { color: "#7D7099", preset: "brushed" };
    c.motorBox       = { color: "#59416F", preset: "satin" };
    c.drillPipe      = { color: "#D2D5E2", preset: "polished" };
    c.machinePanel   = { color: "#CB73C5", preset: "satin" };
    c.tankScaffold   = { color: "#877BA2", preset: "brushed" };
    c.signFrame      = { color: "#25B7AC", preset: "neonDeep" };
    c.pipes          = { color: "#ACB7D0", preset: "brushed" };
    c.lines          = { color: "#ACB7D0", preset: "brushed" };
    c.tank           = { color: "#E5D9ED", preset: "matte" };
    c.valve          = { color: "#25B7AC", preset: "neonDeep" };
    c.wellCurb       = { color: "#625074", preset: "matte" };
    return completeTheme(c);
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
    c.lines         = { color: "#a82a00", preset: "neonDeep" };
    c.tank          = { color: "#d89f8c", preset: "matte" };
    c.tankScaffold  = { color: "#1a1a1a", preset: "brushed" };
    c.valve         = { color: "#b83500", preset: "neonDeep" }; // molten

    return completeTheme(c);
  },
},
// chrome: {
//   label: "FULL CHROME",
//   build: () => {
//     const c = getDefaultPumpConfig();
//     c.pad            = { color: "#737B84", preset: "matte" };
//     c.foundation     = { color: "#9EA6AF", preset: "brushed" };
//     c.post           = { color: "#B2BCC6", preset: "brushed" };
//     c.safetyRails    = { color: "#E2E5E8", preset: "chrome" };
//     c.platform       = { color: "#969FA9", preset: "brushed" };
//     c.beam           = { color: "#D1D7DE", preset: "polished" };
//     c.horseHead      = { color: "#E8EAED", preset: "polished" };
//     c.counterweight  = { color: "#B7C0CB", preset: "polished" };
//     c.crankWheel     = { color: "#A8B1BA", preset: "brushed" };
//     c.motorBox       = { color: "#939DA8", preset: "brushed" };
//     c.drillPipe      = { color: "#DDE2E7", preset: "chrome" };
//     c.machinePanel   = { color: "#BBC3CC", preset: "polished" };
//     c.tankScaffold   = { color: "#A8B1BA", preset: "brushed" };
//     c.signFrame      = { color: "#E2E5E8", preset: "chrome" };
//     c.pipes          = { color: "#BCC5CE", preset: "polished" };
//     c.lines          = { color: "#BCC5CE", preset: "polished" };
//     c.tank           = { color: "#E4E9EE", preset: "matte" };
//     c.valve          = { color: "#DDE2E7", preset: "chrome" };
//     c.wellCurb       = { color: "#7E8791", preset: "matte" };
//     return completeTheme(c);
//   },
// },
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
    c.lines         = { color: "#2a1b1b", preset: "brushed" };
    c.tank          = { color: "#9f9898", preset: "matte" };
    c.tankScaffold  = { color: "#2a1b1b", preset: "brushed" };  // forge iron
    c.valve         = { color: "#6b0a0a", preset: "neonDeep" }; // ember

    return completeTheme(c);
  },
},
// celestial: {
//   label: "CELESTIAL EXECUTION",
//   build: () => {
//     const c = getDefaultPumpConfig();
//     c.pad            = { color: "#161B2B", preset: "matte" };
//     c.foundation     = { color: "#20263C", preset: "matte" };
//     c.post           = { color: "#394463", preset: "satin" };
//     c.safetyRails    = { color: "#419BAF", preset: "neonDeep" };
//     c.platform       = { color: "#8995AF", preset: "brushed" };
//     c.beam           = { color: "#C3CCDF", preset: "polished" };
//     c.horseHead      = { color: "#99C6DC", preset: "satin" };
//     c.counterweight  = { color: "#52658F", preset: "brushed" };
//     c.crankWheel     = { color: "#46516F", preset: "brushed" };
//     c.motorBox       = { color: "#252E48", preset: "satin" };
//     c.drillPipe      = { color: "#AEBFD4", preset: "polished" };
//     c.machinePanel   = { color: "#52658F", preset: "satin" };
//     c.tankScaffold   = { color: "#596681", preset: "brushed" };
//     c.signFrame      = { color: "#AEBFD4", preset: "polished" };
//     c.pipes          = { color: "#6D7D9A", preset: "brushed" };
//     c.lines          = { color: "#6D7D9A", preset: "brushed" };
//     c.tank           = { color: "#D6E8F1", preset: "matte" };
//     c.valve          = { color: "#419BAF", preset: "neonDeep" };
//     c.wellCurb       = { color: "#485169", preset: "matte" };
//     return completeTheme(c);
//   },
// },
midnightSovereign: {
  label: "DARK CROWN",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#1B1721", preset: "matte" };
    c.foundation     = { color: "#25202E", preset: "matte" };
    c.post           = { color: "#513552", preset: "satin" };
    c.safetyRails    = { color: "#B0A9BA", preset: "polished" };
    c.platform       = { color: "#6F6B7B", preset: "brushed" };
    c.beam           = { color: "#663F70", preset: "satin" };
    c.horseHead      = { color: "#D2CAD9", preset: "polished" };
    c.counterweight  = { color: "#432D4E", preset: "satin" };
    c.crankWheel     = { color: "#756A83", preset: "brushed" };
    c.motorBox       = { color: "#302737", preset: "satin" };
    c.drillPipe      = { color: "#A397B1", preset: "brushed" };
    c.machinePanel   = { color: "#6E437E", preset: "satin" };
    c.tankScaffold   = { color: "#65596F", preset: "brushed" };
    c.signFrame      = { color: "#B0A9BA", preset: "polished" };
    c.pipes          = { color: "#63546F", preset: "brushed" };
    c.lines          = { color: "#63546F", preset: "brushed" };
    c.tank           = { color: "#E0D3E7", preset: "matte" };
    c.valve          = { color: "#80489F", preset: "neonDeep" };
    c.wellCurb       = { color: "#4E4258", preset: "matte" };
    return completeTheme(c);
  },
},
metalAF: {
  label: "METAL AF",
  build: () => {
    const c = getDefaultPumpConfig();
    c.pad            = { color: "#242528", preset: "matte" };
    c.foundation     = { color: "#383D43", preset: "matte" };
    c.post           = { color: "#737B83", preset: "brushed" };
    c.safetyRails    = { color: "#9AA2AA", preset: "brushed" };
    c.platform       = { color: "#686E76", preset: "brushed" };
    c.beam           = { color: "#9FA8B0", preset: "brushed" };
    c.horseHead      = { color: "#78848E", preset: "brushed" };
    c.counterweight  = { color: "#30363D", preset: "satin" };
    c.crankWheel     = { color: "#545D67", preset: "brushed" };
    c.motorBox       = { color: "#383F47", preset: "satin" };
    c.drillPipe      = { color: "#A9ADB0", preset: "brushed" };
    c.machinePanel   = { color: "#505860", preset: "brushed" };
    c.tankScaffold   = { color: "#59636D", preset: "brushed" };
    c.signFrame      = { color: "#9AA2AA", preset: "brushed" };
    c.pipes          = { color: "#606A74", preset: "brushed" };
    c.lines          = { color: "#606A74", preset: "brushed" };
    c.tank           = { color: "#CCD2D6", preset: "matte" };
    c.valve          = { color: "#B5764E", preset: "brushed" };
    c.wellCurb       = { color: "#4C5055", preset: "matte" };
    return completeTheme(c);
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
