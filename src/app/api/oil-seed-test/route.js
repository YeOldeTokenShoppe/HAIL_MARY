import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

const FAKE_NAMES = [
  "DrillSgt", "PetroMax", "OilBaron99", "GusherQueen", "DeepStrike",
  "ShaleHunter", "CrudeDude", "BarrelRoll", "PumpKing", "WildcatWilma",
  "DerrickDan", "SpudMuffin", "BlackGold", "RigPig", "BitBorer",
  "SlickRick", "PipelinePat", "WellDone", "DrillerThriller", "TexOil",
  "RoughneckRose", "CrudeAwakening", "BoreHoleBob", "FrackMaster", "OilSlick",
];

// ── Realistic customization pools (drawn from public assets + addon catalog) ──
// Sign images are real files in /public — exercising the full-res TextureLoader
// path that the perf concern centers on (no downscaling/atlas yet).
const SIGN_IMAGES = [
  "/LandGradient1.webp", "/LandGradient2.webp", "/LandGradient3.webp",
  "/IlluminatedManuscript1.webp", "/IlluminatedManuscript2.webp",
  "/IlluminatedManuscript3.webp", "/ClaimCertificate.webp",
];
// Static addons (cheap-ish: GLB clone only). Animated ones cost an extra mixer.
const STATIC_ADDONS = ["flamingo", "gravestone", "sunflowers", "gnome", "palmTree", "pumpkinPatch", "goldRocks", "skeleton"];
const ANIMATED_ADDONS = ["zombie"]; // per-frame AnimationMixer
const FENCE_TYPES = ["chainlink", "iron", "whitePicket", "stone"];
const BODY_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#f39c12", "#16a085"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Build a maxed-out pump config for fake user index `i`. Every plot gets a sign
// and add-ons. `tubeManSet` = indices that get the (expensive) TubeMan; the
// `animatedMap` = index → "zombie" (animated mixer add-ons).
function buildFakeConfig(i, tubeManSet, animatedMap) {
  const config = {
    signImageUrl: pick(SIGN_IMAGES), // every plot gets a sign image
    showSign: true,
  };

  if (Math.random() < 0.3) config.showCamera = true;       // ~30% camera
  if (Math.random() < 0.4) config.fenceType = pick(FENCE_TYPES); // ~40% fence

  // ~60% get a body/horse-head color (cheap flat-color override)
  if (Math.random() < 0.6) {
    const c = pick(BODY_COLORS);
    config.beam = { preset: "stock", color: c };
    config.horseHead = { preset: "stock", color: c };
  }

  // Add-ons — designated animated ones in fixed slots, plus 1–2 static ones so
  // every plot is decorated.
  const addons = {};
  if (tubeManSet.has(i)) addons["0"] = { id: "tubeMan", rot: 0 };
  const animal = animatedMap.get(i);
  if (animal === "zombie") addons["1"] = { id: "zombie", rot: 0 };

  const freeSlots = ["2", "5", "6", "7"].filter((s) => !addons[s]);
  const nStatic = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let n = 0; n < nStatic && freeSlots.length; n++) {
    addons[freeSlots.shift()] = { id: pick(STATIC_ADDONS), rot: Math.floor(Math.random() * 4) };
  }
  config.addons = addons;

  return config;
}

export async function POST(req) {
  try {
    const { password, count = 15, clear = false } = await req.json();

    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || password !== correct) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
    }

    // Clear previous fake data if requested
    if (clear) {
      const plotSnap = await db.collection("oilPlots").get();
      const drillSnap = await db.collection("oilDrills").get();
      const configSnap = await db.collection("pumpConfigs").get();
      let cleared = 0;
      for (const d of plotSnap.docs) {
        if (d.data().currentOwnerId?.startsWith("fake_")) {
          await d.ref.delete();
          cleared++;
        }
      }
      for (const d of drillSnap.docs) {
        if (d.id.startsWith("fake_")) {
          await d.ref.delete();
          cleared++;
        }
      }
      for (const d of configSnap.docs) {
        if (d.id.startsWith("fake_") || d.data().userId?.startsWith("fake_")) {
          await d.ref.delete();
          cleared++;
        }
      }
      if (clear === "only") {
        return NextResponse.json({ ok: true, cleared });
      }
    }

    // Build a set of already-claimed plots
    const existingSnap = await db.collection("oilPlots").get();
    const claimed = new Set();
    existingSnap.docs.forEach((d) => {
      if (d.data().currentOwnerId) claimed.add(d.id);
    });

    // Seed fake players
    const gridSize = 10;
    const maxDepth = 20;
    const seeded = [];

    // All unclaimed cells, then shuffled so a partial count scatters across the
    // field (realistic emergent map) instead of clustering in the first rows; a
    // full count still fills every cell since we take distinct entries.
    const freeCells = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const key = `${col}_${row}`;
        if (!claimed.has(key)) freeCells.push({ col, row, key });
      }
    }
    // Fisher–Yates shuffle.
    for (let i = freeCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [freeCells[i], freeCells[j]] = [freeCells[j], freeCells[i]];
    }
    const total = Math.min(count, freeCells.length);

    // Spread ~10 TubeMen and ~10 animated zombies across the field.
    const tubeManSet = new Set();
    const animatedMap = new Map();
    for (let i = 0; i < total; i++) {
      if (i % 10 === 3) tubeManSet.add(i);
      if (i % 10 === 7) animatedMap.set(i, "zombie");
    }

    for (let i = 0; i < total; i++) {
      const userId = `fake_${i}`;
      const username = FAKE_NAMES[i] || `Wildcat${i}`;

      const { col, row, key } = freeCells[i];
      claimed.add(key);

      // Random drill depth — weighted toward moderate depths
      const drillDay = Math.min(maxDepth, Math.floor(1 + Math.random() * 14 + Math.random() * 5));

      // Write oilPlots
      await db.collection("oilPlots").doc(key).set({
        col,
        row,
        drillDay,
        currentOwnerId: userId,
        ownerHistory: [{ userId, claimedAt: new Date().toISOString() }],
        disqualified: false,
      });

      // Write oilDrills
      await db.collection("oilDrills").doc(userId).set({
        userId,
        col,
        row,
        drillDay,
        username,
        totalCollected: 0,
        bonusDrills: Math.floor(Math.random() * 3),
        claimJumpsUsed: 0,
        tankDrains: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Write pumpConfigs — the customization layer the perf test targets
      // (sign image texture + addons + fence + optional camera). Doc id matches
      // the client format: `${userId}_${col}_${row}`.
      const config = buildFakeConfig(i, tubeManSet, animatedMap);
      await db.collection("pumpConfigs").doc(`${userId}_${key}`).set({
        userId,
        col,
        row,
        config,
        updatedAt: FieldValue.serverTimestamp(),
      });

      seeded.push({
        userId, username, col, row, drillDay,
        sign: !!config.signImageUrl,
        camera: !!config.showCamera,
        fence: config.fenceType || null,
        addons: config.addons ? Object.values(config.addons).map((a) => a.id) : [],
      });
    }

    return NextResponse.json({ ok: true, seeded: seeded.length, players: seeded });
  } catch (err) {
    console.error("[oil-seed-test] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
