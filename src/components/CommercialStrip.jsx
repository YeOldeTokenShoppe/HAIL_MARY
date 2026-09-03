"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, useGLTF, useAnimations } from "@react-three/drei";
import { extendKTX2, releaseKTX2Workers } from "@/lib/ktx2";
import useEnvMapSafe from "@/hooks/useEnvMapSafe";
import {
  TATTOOS_IDLE_SITEPAL_CROP,
  TATTOOS_IDLE_SITEPAL_FILTER,
  TATTOOS_SEATED_SITEPAL_CROP,
  TATTOOS_SEATED_SITEPAL_FILTER,
  VENDOR_SITEPAL_CONFIG,
  SKIN_SAMPLE_DEFAULT,
  getVendorSitePalSource,
  activateVendorSitePal,
  deactivateVendorSitePal,
  onVendorTalk,
} from "@/lib/vendorSitePal";

// ── Commercial strip — a boardwalk apron hung off the −Z edge of the mesa
// (the side clear of the X/Y axis labels), outside the drillable grid so it
// never touches the blockHash-seeded deposit layout.
//
// Geometry comes from CommercialStrip.glb (one 4K atlas, 4 materials). The
// three voiced vendors are separate GLBs exported IN POSITION in the strip's
// own coordinate space — so the strip and every character share one transform
// group and no per-stall placement exists any more. Re-exporting any of them
// from Blender just works: the group auto-fits from the strip's bounding box.

// The gltf-transform-optimized build (2K WebP, node structure preserved via
// --instance false so the spotlight/collision names survive). The ?v tag
// busts the CDN/browser cache on re-export (the strip URL had none, which
// served stale files before); BUMP it whenever this GLB is rebuilt.
// The KTX2/Basis build is the default (2026-09-02): the same 2K atlases, but
// they stay GPU-compressed instead of decoding to RGBA — ≈52 MB of texture
// memory for the strip against ≈198 MB for the webp build, and no decode on
// load. Verified rendering in Chrome, Safari and iPad Safari; the loader
// wiring is KTX2Init/CleanCanvas (see src/lib/ktx2.js). ?strip=webp falls
// back to the webp build for an A/B. Rebuild recipe: docs/strip-export.md.
// ONE tag for BOTH builds. They are two encodings of the same Blender export, so
// a rebuild invalidates both — and the KTX2 URL is the one actually fetched by
// default, so bumping only the webp tag changes nothing. That is exactly how a
// stale strip reached rl80.com on 2026-09-02 while local dev looked correct: the
// dev server revalidates on every request regardless of the query string, so the
// fresh file always won locally, while the CDN kept serving whatever it had
// cached under the unchanged `?v=ktx2` key. BUMP THIS on every rebuild.
const STRIP_MODEL_V = "9";
const STRIP_MODEL_WEBP = `/models/CommercialStrip3_opt2k.glb?v=${STRIP_MODEL_V}`;
const STRIP_MODEL_KTX2 = `/models/CommercialStrip3_opt2k_ktx2.glb?v=${STRIP_MODEL_V}`;
const STRIP_MODEL =
  typeof window !== "undefined" && /[?&]strip=webp\b/.test(window.location.search)
    ? STRIP_MODEL_WEBP
    : STRIP_MODEL_KTX2;

// Strip-local yaw that means "facing the customer side of the boardwalk".
// Props sit on local +X, so the field-facing direction is local −X; the group's
// own Y-rotation is added on top in faceDirWorld to get world space.
const VENDOR_LOCAL_FACE_YAW = -Math.PI / 2;

// Interior dim: a prop you can be INSIDE (the fortune teller's wagon) is lit by
// the scene's ambient with no occlusion, so in daylight its inside reads as
// flat and blown out — there is nothing to cast into it and her purple wagon
// PointLight is gated off outside night/dusk. Rather than darken the wagon on
// the boardwalk, where it looks correct, the dim is gated on FOCUS: it applies
// only while the close-up has the camera inside. Eased rather than switched, so
// it lands as eyes adjusting instead of a lighting pop.
//
// Multiplies the material's base colour, which is the only per-material lever on
// ambient response — MeshStandardMaterial has no "receive less ambient" knob.
const INTERIOR_DIM_EASE = 2.5;     // 1/s — ~0.4s to settle, matched to the fly-in
//
// Per-vendor fields: `model`, `prop`, `idleClip`, `talkClip`, `sitepal`,
// `faceYaw`/`faceDist`/`faceLift`/`camDrop` (close-up framing), `gazeLift`/
// `gazeTurn` (head-tracking bias), `glowMesh`/`glowColor`,
// `sitepalCrop`/`sitepalFilter` (override the registry's crop/filter for this
// vendor — set per POSE in poseOverrides when a head angle differs enough that
// one crop cannot serve both), `interiorDim` (0-1 multiplier on the PROP's base
// colour while focused; omit for props you never get inside) and
// `interiorContents` ({ level, props[], character } — the same dim at a second,
// gentler level for the furniture inside that prop and for the character).
//
// Two ways to give a vendor more than one resting pose. Pick ONE:
//
// `poseModels: ["/models/X_Stand.glb", "/models/X_Sit.glb"]` — separate GLBs,
//   each exported with the character already in place (the normal pipeline).
//   One is drawn at random per page load and it is the only file fetched, so
//   this costs nothing at runtime. Simplest to author; the cost is that a mesh
//   or texture change means re-exporting every pose file.
//
// `poseClips: ["idle", "sit"]` — one GLB, several clips, where each clip's Root
//   bone carries the placement. Use only if you need to TRANSITION between
//   poses at runtime. Both clips must key the Root bone even when static, and
//   "Export Deformation Bones Only" must be off or the non-deforming Synty Root
//   is stripped and every placement silently vanishes.
//
// `offset: [x, y, z]` — nudge the CHARACTER without re-exporting the GLB. In
//   STRIP-LOCAL units, the same space the character GLBs are authored in, so the
//   numbers line up with the root translations you would read in Blender (the
//   strip is ~77 units long and auto-fits to ~0.135 world scale, so 1 here is a
//   small step, not a metre). Moves the character and nothing else — the prop's
//   click volume and label stay put. Because poseOverrides merge over the
//   vendor, a pose can carry its own offset.
//   NOT to be confused with `focusOffset`, which moves the CAMERA's look-at
//   target and leaves the character where it is.
//
// `poseOverrides: { "<model url>": { ...any vendor field } }` — optional. The
//   named pose's fields are merged over the vendor when that pose is drawn, so
//   behaviour can differ per pose, not just framing. A seated pose and a
//   standing pose need very different approach angles (this is what put the
//   fortune teller's camera inside her wagon), and a working pose may want to
//   pause and look up where a standing one just tracks.
//   Useful keys: companionModel (a second character that exists only with this
//   pose, e.g. the tattoo client in the chair), faceDist / faceLift / camDrop
//   (framing), focusOffset [x,y,z] in strip-local units (shifts the look-at
//   target laterally, for shots framing more than one character), faceYaw
//   (which way
//   the character LOOKS — also sets the head-tracking pitch axis), approachYaw
//   (where the camera flies in from; defaults to faceYaw), pauseOnFocus,
//   focusGazeDelay (seconds to keep working before looking up),
//   focusHeadRoll (radians of head cock about the gaze axis),
//   focusGazeLift, headPitchUp, gazeTurn.
export const VENDOR_CATALOG = [
  { id: "fortunes",  label: "",  awning: "#5a4a78", accent: "#c79bff",
    model: "/models/Vendor_FortuneTeller_Character.glb", idleClip: "sit_idle",
    offset: [0, 0, 0],
    prop: "FortuneTeller_Wagon_Empty",
    // Her wagon is the one prop the camera goes INSIDE; the boardwalk view is
    // untouched. See INTERIOR_DIM_EASE above.
    //
    // TWO levels on purpose. The shell is the enclosing box and goes almost
    // black, but her furniture and the character herself only step DOWN toward
    // it — at the shell's 0.05 they would vanish, at 1.0 they read as lit by a
    // different sun than the room they are sitting in.
    interiorDim: 0.15,
    interiorContents: {
      level: 0.35,
      // Booth furniture: everything within ~2.5 units of the wagon EXCEPT the
      // crystal ball. That one is the light source, and the glow rig already
      // owns its materials — dimming it here would mean two effects assigning
      // .material on the same mesh, and whichever ran last would win.
      props: [
        "SM_Prop_Table_02", "SM_Prop_Table_02_Cloth_01", "SM_Prop_Rug_01",
        "SM_Prop_Stool_01", "SM_Prop_Stool_01.001",
        "SM_Prop_Stool_01.002", "SM_Prop_Stool_01.003",
      ],
      // Her own GLB, kept a touch brighter than the furniture so she still
      // reads as the subject of the shot.
      character: 0.5,
    },
    // She sits square to the boardwalk rather than facing off it, so her
    // strip-local face yaw is 0 (90° off the VENDOR_LOCAL_FACE_YAW default).
    // faceYaw swings the fly-in (and the head-tracking rest direction) to meet
    // her face across the table; faceDist stops the camera inside the wagon.
    // Seated character: keep the approach nearly level — big camDrop values
    // put the camera under her table.
    faceYaw: 0, faceDist: 0.25, faceLift: 0, camDrop: -0.05,
    // Crystal ball mood: cloned-material emissive glow + a small violet
    // point light pooled inside the wagon, gently pulsing.
    // Crystal ball: faint emissive sheen + a small violet light. (Set
    // moodDim: true here to also dim the world lights while she's focused —
    // the theatrical night-séance look; currently off, daylight stays.)
    glowMesh: "SM_Prop_Crystal_Ball_01", glowColor: "#8a63e8",
    // Key into VENDOR_SITEPAL_CONFIG: on focus her SitePal avatar is cropped
    // onto Face1 (Face2, the painted face, hides) and she speaks a greeting.
    sitepal: "fortunes" },
  { id: "souvenirs", label: "", awning: "#8a6d2f", accent: "#ffd700",
    prop: "SM_Prop_Tent_02 (24)" },
  { id: "hotdogs",   label: "",  awning: "#a33b2a", accent: "#ffd24d",
    model: "/models/Vendor_HotDog_Character.glb", idleClip: "idle",
    offset: [-0.5, 0, 5.0],
    // CommercialStrip2 replaced SM_Prop_HotdogStand_01 with the full cart.
    prop: "SM_Veh_Hotdog_Cart_01",
    // Standing cart vendor — same framing as the salesman.
    faceDist: 0.18, faceLift: -0.03, camDrop: -0.35,
    talkClip: "talking",
    sitepal: "hotdogs" },
  { id: "tattoos",   label: "",    awning: "#4a3b6b", accent: "#d6a4ff",
    // Two exported poses, one drawn per page load. Deliberately NO idleClip:
    // each file carries a single, differently-named clip ("idle" vs
    // "tattooing"), so the first-clip fallback picks the right one either way.
    poseModels: ["/models/Vendor_TattooArtist_idle.glb",
                 "/models/Vendor_TattooArtist_tattooing.glb"],
    // Her two poses are placed differently, so each can override this in
    // poseOverrides below if they need to diverge.
    offset: [0, 0, 0],
    // Her booth: sign, barber chair and stool all cluster at z ≈ 29; the tent
    // is the click volume. In the tattooing pose she sits on
    // SM_Prop_Stool_01.004 (x 1.90, z 28.58) — her own root matches it exactly.
    prop: "SM_Prop_Tent_01",
    // Both pose GLBs carry Face1/Face2/Face3 under the same names, so the one
    // sitepal config works whichever file this load drew.
    sitepal: "tattoos",
    // Standing out front vs seated at the stool want different approaches:
    // standing takes the low hero angle the other standing vendors use, seated
    // needs a near-level one or the camera ends up under the bench.
    // STARTING VALUES — worth an eyeball pass once both files are in.
    // Each override names its own clip. The first-clip fallback above does work,
    // but it is the fragile path (it depends on enumerating drei's lazy action
    // getters at a moment when they may all still be undefined). Naming the
    // clip routes her through actions[restClip] like every other vendor.
    poseOverrides: {
      "/models/Vendor_TattooArtist_idle.glb":      { idleClip: "idle", faceDist: 0.18, faceLift: -0.03, camDrop: -0.35,
        sitepalCrop: TATTOOS_IDLE_SITEPAL_CROP, sitepalFilter: TATTOOS_IDLE_SITEPAL_FILTER },
      // Seated at the stool (local z 28.58) working on the barber chair (z
      // 29.69), so she faces strip-local +Z — which the group's +90° maps to
      // world +X. faceYaw 0 encodes that. This matters for more than the
      // camera: pitch is applied about UP × faceDir, so a faceYaw that is 90°
      // out rotates her head about an axis running THROUGH her face and the
      // "look up" reads as a sideways roll.
      // Then freeze the clip on focus and lift her gaze the rest of the way —
      // focusGazeLift ≈ how far her animated head is pitched down.
      // Camera comes straight in from the boardwalk front (local -X). The
      // tent's front poles sit at local x 0.2-0.5 in two clusters, z 28.2-28.6
      // and z 29.8-30.2, leaving an opening between them — and the pair's
      // midpoint is z 29.11, so a pure -X line threads that gap almost dead
      // centre. The earlier -PI/4 aimed straight into the z~29.8 pole.
      // Side-on is also what frames BOTH of them; she turns to camera via the
      // head tracking (clamped at 63°, so a natural 3/4 rather than a full
      // swivel).
      "/models/Vendor_TattooArtist_tattooing.glb": {
        idleClip: "tattooing",
        // The client only exists on the loads where she is actually tattooing.
        // Kept in his own GLB rather than merged into hers: both Synty rigs
        // name their bones identically (Pelvis, spine_01, head...), and three
        // binds animation tracks to bones BY NAME taking the first match — so
        // merged, his idle_sit could end up driving her skeleton.
        companionModel: "/models/Vendor_TattooArtist_Client.glb",
        faceYaw: 0, approachYaw: -Math.PI / 2,
        // pull back a little and aim at the artist/client midpoint rather than
        // her head — she is at local z 28.58, the client at 29.64
        faceDist: 0.34, faceLift: 0.02, camDrop: -0.06,
        focusOffset: [0.15, 0, 0.5],
        // beat before she looks up — long enough to read as finishing a line,
        // short enough not to feel unresponsive
        pauseOnFocus: true, focusGazeDelay: 1.8, focusGazeLift: 0.5, headPitchUp: 1.0,
        // ~20° head cock, eased in with the look-up. Negative flips the tilt.
        focusHeadRoll: -0.55,
        // Her own crop/filter: bowed over the chair, the camera meets her face
        // from further above than it does standing, so the standing box does
        // not land. Tune this pair with ?pose=tattooing.
        sitepalCrop: TATTOOS_SEATED_SITEPAL_CROP, sitepalFilter: TATTOOS_SEATED_SITEPAL_FILTER },
    } },
  { id: "promos",    label: "",    awning: "#17505e", accent: "#5fe9ff",
    // RL80 promos + merch, working the prize wheel at the balloon end of the
    // strip. Her GLB is exported in strip space like the rest (root at local
    // x 0, z -29.96), so she needs no placement here.
    model: "/models/Vendor_HoloGirl.glb", idleClip: "idle", talkClip: "talking",
    offset: [-0.3, 0, 2.5],
    // The wheel, NOT the tent she happens to stand inside: SM_Prop_Tent_02
    // (23) has no vendor now, so it has no click volume either, and hers is
    // the only proxy in this stretch of boardwalk. Keep it that way — a
    // PROXY_LOCAL_SIZE box is 5 units on a side, so a second vendor on that
    // tent would put a cube (origin x 1.79) around her too.
    prop: "SM_Prop_Prize_Wheel_01",
    // Standing vendor: same close-up framing as the salesman and hot dog cart.
    faceDist: 0.18, faceLift: -0.03, camDrop: -0.35,
    // Her GLB also ships "bored" and "thankful". Both key the same bones as
    // the idle, so the extras pass in VendorModel correctly refuses to play
    // them alongside it — they are here for a future mood hook, not dead
    // weight to delete.
    sitepal: "promos" },
  { id: "tacos",     label: "",    awning: "#2f6b4a", accent: "#8fe6b0",
    // Extraterrestrial taco-and-beverage trailer. His GLB was re-exported with
    // idle/talking clips and Face1-3 — an earlier build had neither, so if he
    // ever reverts to a T-pose or the projection stops landing, check the export
    // before checking this file.
    model: "/models/Vendor_Alien.glb", idleClip: "idle", talkClip: "talking",
    offset: [0, 0, 0],
    // The trailer itself, not the sign or the taco — it is the big click target
    // and the thing a player reads as "the booth".
    prop: "SM_Veh_Food_Trailer_02",
    // He serves from inside the trailer: his root is lifted 0.52 and his head
    // sits ~2.4 strip-local against a standing vendor's ~1.6. faceDist/faceLift
    // are measured from the head BONE so they need no height compensation, but
    // camDrop does — the standing -0.35 looks up steeply enough to frame the
    // trailer's underside, so this is eased off.
    faceDist: 0.2, faceLift: -0.02, camDrop: -0.28,
    sitepal: "tacos" },
  { id: "rugs",      label: "",    awning: "#7a2f3a", accent: "#e0a4b0",
    // The rug merchant — a con artist by metaphor, which in this field's
    // vocabulary means one thing. He is SEATED at his stall.
    //
    // His GLB ships five clips and only two are wired. Root offsets from
    // idle_goblin, measured in Empty space (his rig is RugGoblin_Empty > Root,
    // where Root carries the 0.01 scale, so these need no rescaling — unlike
    // the carny, whose Armature holds the scale above Root):
    //   sit_talk  0.024   <- used; the smallest offset of any talk clip here
    //   pointing  no Root track at all, so it cannot displace him
    //   talking   0.397   <- NOT used, would visibly pop (HoloGirl's 0.25 is
    //                        the largest that ships)
    //   idle      0.407   <- the superseded placement, kept in the export
    model: "/models/Vendor_Rugs.glb", idleClip: "idle_goblin", talkClip: "sit_talk",
    offset: [0, 0, 0],
    prop: "SM_Prop_Market_Stall_05",
    // The ONLY vendor with a positive camDrop, i.e. the camera above him looking
    // down. He is the only one seated behind a loaded counter, and the counter is
    // the problem: his eyes sit at strip-local y ~1.30 and the boxes stacked on
    // the table top out at 1.29 — the same height. Anything close to a level
    // sightline goes straight through the merchandise.
    //
    // Remember camDrop is not the final angle: CameraFlyTo adds FOCUS_TILT (0.15)
    // before normalising, so the old -0.15 cancelled it exactly and produced a
    // dead-level shot. +0.2 gives dir.y 0.35, which at this faceDist puts the
    // lens ~0.92 local units above his face — clear over the stack, looking down
    // at him across the counter the way a customer would.
    faceDist: 0.28, faceLift: 0, camDrop: 0.2,
    sitepal: "rugs" },
  { id: "carny",     label: "",    awning: "#6b3f1f", accent: "#ffc46b",
    // The balloon barker, alone at the far -Z end with the hot air balloon as
    // his only neighbour — so the balloon is his click volume.
    //
    // "yelling" is his talk clip and "pointing" is used per-line (see the carny
    // greetings in vendorSitePal.js) for the lines that reference the balloon.
    //
    // Both are safe to crossfade, but the check needs care: his rig nests as
    // Carny_Empty > Armature(scale 0.01) > Root, so his Root translations are
    // INSIDE that 0.01 and must be scaled before comparing to a rig like
    // HoloGirl's, where Root itself carries the scale. Corrected, "yelling"
    // sits 0.027 from carny_idle and "pointing" 0.139 — against 0.12 for the
    // hot dog vendor and 0.25 for HoloGirl, both of which ship fine. Compare
    // raw numbers across rigs and you will "find" a 10x pop that is not there.
    //
    // His hat, hair, eyepatch, mustache and mic are bone-parented statics on the
    // Head bone, so they stay put over the projected face. If the SitePal avatar
    // already draws a mustache or eyepatch, add those mesh names to regularFaces
    // so they hide while he is speaking.
    model: "/models/Vendor_Carny.glb", idleClip: "carny_idle",
    offset: [0, 0, 0],
    prop: "SM_Prop_Hot_Air_Balloon_01.002",
    talkClip: "yelling",
    faceDist: 0.18, faceLift: -0.03, camDrop: -0.35,
    sitepal: "carny" },
  { id: "tonics",    label: "",    awning: "#7a3524", accent: "#ff8c5a",
    model: "/models/Vendor_SnakeOilSalesman_Character.glb", idleClip: "idle",
    offset: [0, 0, 0],
    prop: "SM_Veh_Wagon_Shop_01",
    // His head is ~0.045 world units tall — a true close-up needs to be this near
    faceDist: 0.18, faceLift: -0.03, camDrop: -0.35,
    // His idle carries the head slightly low and left of center; lift the
    // tracked gaze ~7° and turn it ~4.5° toward the viewer's right
    gazeLift: 0.12, gazeTurn: -0.2,
    talkClip: "hard_sell",
    sitepal: "tonics" },
];

// A vendor with `poseModels` ships one GLB per resting pose, each exported with
// the character already placed (standing outside the booth vs seated inside).
// The choice is made HERE, at module scope, so it happens once per page load
// and the preloader and the component agree — which means only the chosen file
// is ever fetched. Two files on disk, one file downloaded.
// ?pose=<substring> pins the draw instead of leaving it to chance — needed to
// tune a pose's crop at all, since otherwise reaching the one you want is a
// coin flip per reload. Matches the model URL case-insensitively, so
// ?pose=tattooing and ?pose=idle each name one of her two files.
const CHOSEN_POSE_MODEL = {};
const POSE_PIN =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("pose")?.toLowerCase()
    : null;
VENDOR_CATALOG.forEach((v) => {
  const pool = v.poseModels?.length ? v.poseModels : (v.model ? [v.model] : []);
  if (!pool.length) return;
  const pinned = POSE_PIN && pool.find((url) => url.toLowerCase().includes(POSE_PIN));
  CHOSEN_POSE_MODEL[v.id] = pinned || pool[Math.floor(Math.random() * pool.length)];
});

// Preload the strip and vendor GLBs (same idiom as ADDON_CATALOG in OilVoxelGrid)
// NOT module-scope preloaded: a KTX2 GLB must not parse before the renderer
// exists (KTX2Loader.detectSupport needs it), or its textures fail and cache
// as broken. It loads inside the Canvas via useGLTF below, after <KTX2Init/>
// has run detectSupport.
Object.values(CHOSEN_POSE_MODEL).forEach((url) => useGLTF.preload(url, true, true, extendKTX2));
// ...and the companion belonging to whichever pose was drawn, so it arrives
// with the character rather than popping in a beat later.
VENDOR_CATALOG.forEach((v) => {
  const companion = v.poseOverrides?.[CHOSEN_POSE_MODEL[v.id]]?.companionModel;
  if (companion) useGLTF.preload(companion, true, true, extendKTX2);
});

// three.js GLTFLoader pushes EVERY node name through
// PropertyBinding.sanitizeNodeName, whose reserved set is [ ] . : / — dots are
// deleted outright and whitespace becomes "_". So the names in the GLB are NOT
// the names in the scene:
//     "Spotlight_Bulb.001"    -> "Spotlight_Bulb001"
//     "SM_Prop_Tent_02 (23)"  -> "SM_Prop_Tent_02_(23)"
//     "Face3.001"             -> "Face3001"
// Every lookup here must therefore compare sanitized-to-sanitized, or it
// silently matches nothing. (This is also why a ".\d{3}" suffix pattern can
// never fire — the dot is already gone by the time we see the name.)
function sanitizeName(n) {
  return String(n ?? "").replace(/\s/g, "_").replace(/[\[\]\.:\/]/g, "");
}

// Match a Blender-authored name against the loaded scene: exact sanitized hit
// first, then the same name plus Blender's 3-digit dedup suffix, so a re-export
// that renames "Foo" to "Foo.001" still resolves.
function findByBaseName(root, name) {
  if (!root || !name) return null;
  const want = sanitizeName(name);
  const re = new RegExp(`^${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{3}$`);
  let exact = null, suffixed = null;
  root.traverse((o) => {
    if (exact) return;
    const n = sanitizeName(o.name);
    if (n === want) exact = o;
    else if (!suffixed && re.test(n)) suffixed = o;
  });
  return exact || suffixed;
}

// Rest-pose face direction in world space. vendor.faceYaw is expressed in the
// STRIP's local frame (default VENDOR_LOCAL_FACE_YAW = facing off the deck);
// stripRotY is the shared group's Y-rotation, which carries it to world space.
function faceDirWorld(vendor, out, stripRotY = 0) {
  const yaw = (vendor.faceYaw ?? VENDOR_LOCAL_FACE_YAW) + stripRotY;
  return out.set(Math.sin(yaw), 0, Math.cos(yaw));
}

// Where the camera flies IN from. Defaults to the way the vendor faces, which
// is usually what you want — but the two are not the same thing and must be
// separable: faceYaw also picks the head-tracking pitch axis, so it has to stay
// truthful about which way the character actually looks, while the camera may
// need to come in off-axis to clear whatever the vendor is working on (the
// tattoo artist's barber chair sits exactly on her eyeline).
function approachDirWorld(vendor, out, stripRotY = 0) {
  const yaw = (vendor.approachYaw ?? vendor.faceYaw ?? VENDOR_LOCAL_FACE_YAW) + stripRotY;
  return out.set(Math.sin(yaw), 0, Math.cos(yaw));
}

// Scratch objects for the per-frame head tracking (no per-frame allocation)
const _headPos = /* @__PURE__ */ new THREE.Vector3();
const _toCam = /* @__PURE__ */ new THREE.Vector3();
const _face = /* @__PURE__ */ new THREE.Vector3();
const _right = /* @__PURE__ */ new THREE.Vector3();
const _UP = /* @__PURE__ */ new THREE.Vector3(0, 1, 0);
const _parentQ = /* @__PURE__ */ new THREE.Quaternion();
const _worldQ = /* @__PURE__ */ new THREE.Quaternion();
const _yawQ = /* @__PURE__ */ new THREE.Quaternion();
const _pitchQ = /* @__PURE__ */ new THREE.Quaternion();
const _deltaQ = /* @__PURE__ */ new THREE.Quaternion();
const _rollQ = /* @__PURE__ */ new THREE.Quaternion();
const _rollAxis = /* @__PURE__ */ new THREE.Vector3();

const HEAD_YAW_LIMIT = 1.1;    // rad (~63°) — how far the head will turn to follow
const HEAD_PITCH_UP = 0.7;     // rad (~40°) — looking up at a tall camera
const HEAD_PITCH_DOWN = 0.55;  // rad (~32°) — looking down

// Tuned for full daylight: a subtle magic presence on the ball with a soft
// violet pool right around it — the sun stays in charge of the interior.
const GLOW_EMISSIVE_BASE = 0.12;   // resting glow on the non-glass prop parts
const GLOW_EMISSIVE_AMP = 0.08;    // extra glow at the top of the flicker
const GLOW_LIGHT_INTENSITY = 0.08; // point light strength — it sits nearly on
                                   // the table, so inverse-square makes even
                                   // small values read strongly up close
const GLOW_LIGHT_DISTANCE = 0.3;   // world units — a pool around the ball only
const SWIRL_BASE_OPACITY = 0.5;    // resting density of the swirl glass

// ── Crystal-ball swirl shader ──────────────────────────────────────────────
// Replaces the glass mesh's material (the prop's "crystal" primitive is its
// own mesh). Angular interference bands, twisted harder toward the core and
// drifting with time, plus a fresnel rim — bright regions push past the base
// color, which reads as bloom without a postprocessing pass.
const SWIRL_VERT = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vLocal = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SWIRL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform vec3 uCenter;
  uniform float uRadius;
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 p = (vLocal - uCenter) / uRadius;
    float ang = atan(p.z, p.x);
    float r = length(p.xz);
    float tw = ang + uTime * 0.45 + (1.0 - r) * 2.8;
    float bands =
      sin(tw * 3.0 + p.y * 6.0 + uTime * 0.9) * 0.5 +
      sin(tw * 5.0 - p.y * 4.0 - uTime * 1.4) * 0.35 +
      sin(p.y * 9.0 + uTime * 0.65) * 0.15;
    bands = bands * 0.5 + 0.5;
    float fresnel = pow(1.0 - abs(dot(normalize(vViewDir), normalize(vWorldNormal))), 2.0);
    vec3 col = mix(uColorA, uColorB, bands);
    col += uColorB * fresnel * 0.7;
    float alpha = clamp(uOpacity + bands * 0.22 + fresnel * 0.35, 0.0, 1.0);
    gl_FragColor = vec4(col * (0.55 + bands * 0.9 + fresnel * 0.6), alpha);
  }
`;

function makeSwirlMaterial(glassMesh, colorHex) {
  const geo = glassMesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const bs = geo.boundingSphere;
  return new THREE.ShaderMaterial({
    vertexShader: SWIRL_VERT,
    fragmentShader: SWIRL_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorHex).multiplyScalar(0.55) },
      uColorB: { value: new THREE.Color(colorHex).lerp(new THREE.Color("#ffffff"), 0.45) },
      uOpacity: { value: SWIRL_BASE_OPACITY },
      uCenter: { value: bs.center.clone() },
      uRadius: { value: bs.radius },
    },
    transparent: true,
    depthWrite: false,
  });
}

// ── SitePal projection: lit material, skin match, crossfade ────────────────
// The crop used to land on an unlit MeshBasicMaterial with tone mapping off,
// so it ignored every scene light while the painted face beside it took the
// sun/moon arcs, the hemisphere fill, the env map and ACES. Each vendor's
// filter then matched the final pixel at ONE time of day and drifted through
// the rest of the cycle. The projection now wears a clone of the painted
// face's own material with the crop as its map, so both faces see identical
// light and the filter only has to match albedo — which does not change with
// the hour. The skin match below does even that part automatically.
const PROJ_FADE_S = 0.28;       // painted ↔ projected crossfade, seconds
const SKIN_SAMPLE_MS = 900;     // how often the crop is re-measured
const SKIN_EMA = 0.35;          // smoothing on the measured skin colour
const SKIN_GAIN_MIN = 0.2;
const SKIN_GAIN_MAX = 5;
// ?skinmatch=0 leaves the projection lit but un-corrected — the A/B for
// judging what the gain is doing.
const SKIN_MATCH_ENABLED =
  typeof window === "undefined" || !/[?&]skinmatch=0\b/.test(window.location.search);
const _skinSample = new THREE.Color();

// Lazily builds the 512² crop canvas + CanvasTexture and dresses the
// projection face in a LIT material derived from the painted face's own.
// flipY=false matches glTF UVs.
function ensureVendorProjectionMaterial(st) {
  if (!st.cropCanvas) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    st.cropCanvas = c;
    st.cropCtx = c.getContext("2d");
  }
  if (!st.texture) {
    const tex = new THREE.CanvasTexture(st.cropCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    st.texture = tex;
  }
  if (!st.material && st.proj) {
    const authored = Array.isArray(st.proj.material) ? st.proj.material[0] : st.proj.material;
    const painted = st.regulars[0]?.material;
    // Base on the painted face's material — lights, env map, emissive, fog
    // and tone mapping identical by construction — else the projection
    // face's own authored one, else a plain standard material.
    const base = painted?.isMeshStandardMaterial ? painted
      : authored?.isMeshStandardMaterial ? authored : null;
    const m = base ? base.clone() : new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
    m.map = st.texture;
    // The painted face's emissive map is the same atlas as its colour map, so
    // the crop plays that role here too: emissive × crop matches emissive ×
    // atlas (HoloGirl's glow) instead of a flat wash.
    m.emissiveMap = m.emissiveMap ? st.texture : null;
    // Every other map is authored in atlas UV space, which the projection
    // face's UVs do not share — sampled here they would read garbage.
    m.normalMap = null; m.bumpMap = null; m.roughnessMap = null; m.metalnessMap = null;
    m.aoMap = null; m.alphaMap = null; m.lightMap = null; m.displacementMap = null;
    // COLOR_0 is white on every vendor face, and a face without the
    // attribute would render black with vertexColors on.
    m.vertexColors = false;
    m.color.set(0xffffff);      // the skin-match gain lands here
    m.side = THREE.DoubleSide;
    m.toneMapped = true;
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
    // Bias the projection toward the camera in depth so it composites over
    // the painted face during the crossfade even where the two are coplanar.
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
    m.userData.hmProjectionClone = true;
    m.needsUpdate = true;
    st.material = m;
  }
  if (!st.materialApplied && st.proj && st.material) {
    st.proj.material = st.material;
    st.materialApplied = true;
  }
}

// What the projected skin should land on. `skinTarget` (hex) in the vendor's
// config wins; otherwise the projection face's authored flat colour — the
// one eyedropped in Blender to match the painted skin — which the mesh keeps
// in userData because its live material is our clone. A textured authored
// face has no single colour to aim at: no correction.
function refreshVendorSkinTarget(st, sp) {
  const skin = st.skin;
  const key = sp.skinTarget || "";
  if (skin.targetKey === key) return;
  skin.targetKey = key;
  if (key) { skin.target = new THREE.Color(key); return; }
  const authored = st.proj?.userData?.hmAuthoredColor;
  skin.target = authored ? authored.clone() : null;
}

// Per-channel median of the crop's skin box (sRGB → working space), eased
// into st.skin.measured. Skin dominates a face crop, so hair, eyes and the
// moving mouth do not pull a median the way they pull a mean. Cheap and
// rare: ~2.5k samples every SKIN_SAMPLE_MS, nothing per frame.
function sampleVendorSkin(st, sp, nowMs) {
  const skin = st.skin;
  if (nowMs - skin.lastSampleAt < SKIN_SAMPLE_MS) return;
  skin.lastSampleAt = nowMs;
  const c = st.cropCanvas;
  const box = sp.skinSample || SKIN_SAMPLE_DEFAULT;
  const x = Math.round(box.x * c.width), y = Math.round(box.y * c.height);
  const w = Math.max(4, Math.round(box.w * c.width)), h = Math.max(4, Math.round(box.h * c.height));
  let data;
  try { data = st.cropCtx.getImageData(x, y, w, h).data; } catch (e) { return; }
  const rs = [], gs = [], bs = [];
  for (let j = 0; j < h; j += 4) {
    for (let i = 0; i < w; i += 4) {
      const k = (j * w + i) * 4;
      rs.push(data[k]); gs.push(data[k + 1]); bs.push(data[k + 2]);
    }
  }
  if (rs.length < 16) return;
  const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  const mr = med(rs), mg = med(gs), mb = med(bs);
  // A blank frame (embed not drawing yet) or a white one must not become a gain.
  const sum = mr + mg + mb;
  if (sum < 24 || sum > 740) return;
  _skinSample.setRGB(mr / 255, mg / 255, mb / 255, THREE.SRGBColorSpace);
  if (!skin.measured) skin.measured = _skinSample.clone();
  else skin.measured.lerp(_skinSample, SKIN_EMA);
}

// target ÷ measured as the material colour: exposure and white balance in one
// per-channel gain the shader applies for free. Publishes the numbers for the
// ?tune=vendor panel.
function applyVendorSkinGain(st, sp, vendorId) {
  const m = st.material;
  if (!m) return;
  const skin = st.skin;
  const active = SKIN_MATCH_ENABLED && sp.skinMatch !== false && !!skin.target && !!skin.measured;
  let gain = null;
  if (active) {
    const t = skin.target, s = skin.measured;
    const g = (a, b) => Math.min(SKIN_GAIN_MAX, Math.max(SKIN_GAIN_MIN, a / Math.max(b, 1e-3)));
    gain = [g(t.r, s.r), g(t.g, s.g), g(t.b, s.b)];
    m.color.setRGB(gain[0], gain[1], gain[2]);
  } else {
    m.color.set(0xffffff);
  }
  if (typeof window !== "undefined") {
    window.__vendorSitePalSkinMatch = {
      vendorId,
      active,
      measured: skin.measured ? "#" + skin.measured.getHexString() : null,
      target: skin.target ? "#" + skin.target.getHexString() : null,
      gain,
    };
  }
}
const HEAD_EASE = 8;           // 1/s — smoothing rate toward the target angles

function VendorModel({ vendor, focusedRef, headRef, stripScene, stripRotY = 0, dimRef }) {
  const group = useRef();
  // Stable for the whole session: chosen at module load, so the hook's URL
  // never changes under it and Suspense fetches exactly one file.
  const { scene, animations } = useGLTF(CHOSEN_POSE_MODEL[vendor.id] || vendor.model, true, true, extendKTX2);
  const { actions, mixer } = useAnimations(animations, group);

  // Cap per-frame animation advance: on a main-thread hitch the mixer would
  // otherwise skip the clip forward by the whole stalled interval, which reads
  // as a split-second pose pop in a face close-up. Capping converts the skip
  // into an imperceptible micro-slowdown.
  useEffect(() => {
    const orig = mixer.update.bind(mixer);
    mixer.update = (d) => orig(Math.min(d, 1 / 30));
    return () => { mixer.update = orig; };
  }, [mixer]);
  // Pose variants. A vendor may ship several mutually-exclusive RESTING poses
  // that place the armature differently — e.g. the tattoo artist standing
  // outside her booth vs seated inside it. Because the placement lives in the
  // Root bone inside each clip, switching between them mid-scene would teleport
  // her, so one is drawn at random per page load and held for the whole
  // session. Chosen in a ref, not per render: re-rolling on any re-render (a
  // parent state change, HMR) would move her while the player is looking.
  const poseRef = useRef(null);
  if (poseRef.current === null) {
    const pool = vendor.poseClips?.length ? vendor.poseClips
      : (vendor.idleClip ? [vendor.idleClip] : []);
    poseRef.current = pool.length ? pool[Math.floor(Math.random() * pool.length)] : "";
  }
  // The chosen pose IS this session's idle — everything that used to reach for
  // vendor.idleClip has to come back to this one instead, or a talk crossfade
  // would drop her back into the other pose's position.
  const restClip = poseRef.current || vendor.idleClip;

  const restActionRef = useRef(null);
  const extrasRef = useRef([]);
  const needsStartRef = useRef(false);

  // Start (or restart) this session's resting pose. Returns false if the rig
  // is not ready yet, which is a real state and not an error — see the retry
  // in useFrame below.
  const startRest = () => {
    const all = Object.values(actions || {});
    // find(Boolean), NOT [0]. drei builds `actions` out of lazy getters that
    // return undefined while the group ref is still unattached, so enumerating
    // them can hand back a list of undefineds. Taking [0] then silently leaves
    // the character in bind pose — a T-pose that never recovers, because this
    // effect only re-runs on [actions, restClip] and neither ever changes
    // again. Vendors that name their clip get here via actions[restClip];
    // the tattoo artist's two pose files deliberately do not, so this
    // fallback is her ONLY path in.
    const action = (restClip && actions?.[restClip]) || all.find(Boolean);
    if (!action) return false;

    restActionRef.current = action;
    // No fadeIn: on (re)mount the bindings sit at bind pose, and a weight fade
    // would visibly blend from T-pose. Playing at full weight snaps straight
    // into the idle on the first mixer update instead.
    action.reset().play();

    // A pose file can carry MORE THAN ONE character — the tattoo artist's
    // client rides along in her tattooing export. Those clips drive separate
    // skeletons and all of them have to run, whereas a vendor's own alternate
    // clips (hard_sell, shifty) drive the SAME bones as the idle and must not,
    // or they blend into mush. Disjoint bone targets is what separates the two
    // cases, so no per-vendor config is needed.
    const bone = (t) => t.name.split(".")[0];
    const restTargets = new Set(action.getClip().tracks.map(bone));
    const extras = [];
    all.forEach((a) => {
      if (!a || a === action) return;
      if (a.getClip().tracks.some((t) => restTargets.has(bone(t)))) return;
      a.reset().play();
      extras.push(a);
    });
    extrasRef.current = extras;
    return true;
  };

  useEffect(() => {
    needsStartRef.current = !startRest();
    return () => {
      restActionRef.current?.stop();
      extrasRef.current.forEach((a) => a.stop());
      extrasRef.current = [];
      restActionRef.current = null;
      needsStartRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, restClip]);

  // The retry. VendorModel suspends on useGLTF on the way in (the env map used
  // to be a second suspension before it moved to the non-suspending
  // useEnvMapSafe) — so the order in which the group ref attaches relative to
  // this effect is not something to rely on, and a re-suspend after commit
  // (any newly added vendor GLB perturbs it) tears
  // effects down and back up. If the pose could not be started, keep trying:
  // one cheap ref check per frame until it takes, then never again.
  useFrame(() => {
    if (!needsStartRef.current) return;
    // A GLB with no animations at all can never succeed — retrying it every
    // frame for the life of the page would be a silent spin. Only the
    // "clips exist but the rig wasn't ready yet" case is worth retrying.
    if (!animations?.length) { needsStartRef.current = false; return; }
    if (startRest()) needsStartRef.current = false;
  });

  // Low-graphics idle gate (mobile tier, via window.__hmLowGfx). Freeze the
  // resting idle when the vendor is neither focused (sky zoom) nor being
  // approached on foot, so its skinned mixer stops advancing — the character
  // holds a static pose until you engage it. Full quality never pauses. A
  // paused action still writes its frozen pose, so nothing pops to bind pose;
  // a talk/gesture crossfade only ever runs while focused (→ unpaused here).
  useFrame(() => {
    const rest = restActionRef.current;
    if (!rest) return;
    if (!window.__hmLowGfx) { if (rest.paused) rest.paused = false; return; }
    let active = !!focusedRef?.current;
    if (!active) {
      const spot = window.__hmVendorSpots?.[vendor.id];
      const w = window.__hmWalkerPos;
      if (spot && w) active = Math.hypot(spot.x - w.x, spot.z - w.z) < 2.2;
    }
    rest.paused = !active;
  });

  // Environment-map fill: the strip sits on the −Z edge where one scene
  // directional grazes and the other lights the vendors' BACKS, so their
  // field-facing sides read near-silhouette on ambient alone. The rigs stay
  // legible via IBL from the same preset — give the vendor materials the
  // identical treatment (no extra dynamic lights, mobile-safe).
  const envMap = useEnvMapSafe("warehouse");
  useEffect(() => {
    if (!envMap) return;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m || !m.isMeshStandardMaterial) return;
        if (m.envMap !== envMap) { m.envMap = envMap; m.needsUpdate = true; }
        m.envMapIntensity = 0.45;
      });
    });
  }, [scene, envMap]);

  // Character half of the interior dim (VendorStall owns the eased factor).
  // Clones for the same reason the stall does: a Synty character shares one
  // material across several meshes, and the projection face gets its material
  // REPLACED later by ensureVendorProjectionMaterial — which simply means the
  // projected face stops being dimmed, not that the two rigs fight.
  const charDimRef = useRef({ clones: [] });
  useEffect(() => {
    const level = vendor.interiorContents?.character;
    if (!level) return;
    const st = charDimRef.current;
    const byMaterial = new Map();
    const swappedFor = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const swapped = mats.map((m) => {
        if (!m || !m.color) return m;
        let clone = byMaterial.get(m.uuid);
        if (!clone) {
          clone = m.clone();
          clone.userData = {};                       // see the scrub note above
          clone.userData.hmBaseColor = m.color.clone();
          byMaterial.set(m.uuid, clone);
          st.clones.push(clone);
        }
        return clone;
      });
      swappedFor.push({ mesh: o, original: o.material });
      o.material = Array.isArray(o.material) ? swapped : swapped[0];
    });
    return () => {
      swappedFor.forEach(({ mesh, original }) => { mesh.material = original; });
      st.clones.forEach((m) => { try { m.dispose(); } catch (e) {} });
      st.clones = [];
    };
  }, [scene, vendor.interiorContents]);

  // Talk-clip swap: crossfade idle → vendor.talkClip while the greeting audio
  // actually plays (SitePal's talk callbacks via the vendorSitePal bridge),
  // and back when it ends or is cut off. Vendors without a talkClip (the
  // seated fortune teller) simply never swap. Crossfades run between two
  // playing actions, so bind pose is never touched.
  const talkModeRef = useRef(false);
  // Which action is currently standing in for the idle — talkClip or a gesture.
  const activeTalkRef = useRef(null);
  useEffect(() => {
    // talkClip is no longer required: a vendor with per-line gestures but no
    // default talk clip still animates on the lines that name one.
    if (!vendor.sitepal) return;
    const off = onVendorTalk((vendorId, talking, gesture) => {
      if (vendorId !== vendor.sitepal) return;
      if (talking === talkModeRef.current) return;
      const idle = (restClip && actions?.[restClip]) || Object.values(actions || {}).find(Boolean);
      if (!idle) return;
      if (talking) {
        // A gesture named by THIS line wins over the vendor's default talkClip.
        // An unknown name falls through, so a typo or a re-export that drops a
        // clip degrades to ordinary talking rather than freezing the rig.
        const next = (gesture && actions?.[gesture]) || actions?.[vendor.talkClip];
        if (!next) return;
        talkModeRef.current = true;
        activeTalkRef.current = next;
        next.reset().crossFadeFrom(idle, 0.25, false).play();
      } else {
        // Fade back from whatever ACTUALLY played. Recomputing talkClip here
        // would fade from the wrong action whenever a gesture had replaced it,
        // leaving the gesture running at full weight underneath the idle.
        const prev = activeTalkRef.current;
        talkModeRef.current = false;
        activeTalkRef.current = null;
        if (prev) idle.reset().crossFadeFrom(prev, 0.35, false).play();
        else idle.reset().play();
      }
    });
    return () => { off(); talkModeRef.current = false; activeTalkRef.current = null; };
  }, [actions, vendor.sitepal, vendor.talkClip, restClip]);

  // All three character exports carry a stray unskinned "Icosphere" (42 verts,
  // ~2 units across) sitting at the character's origin — the debris the source
  // .blend keeps in its `glTF_not_exported` collection, which the character
  // exports didn't exclude. Left in, it renders as a grey ball at each
  // vendor's feet. Narrow rule: unskinned, mesh, named Icosphere*.
  useEffect(() => {
    const junk = [];
    scene.traverse((o) => {
      if (o.isMesh && !o.isSkinnedMesh && /^Icosphere\d*$/.test(sanitizeName(o.name))) junk.push(o);
    });
    junk.forEach((o) => { o.visible = false; o.raycast = () => {}; });
    return () => { junk.forEach((o) => { o.visible = true; }); };
  }, [scene]);

  // Locate the head bone once (Synty-style rigs name it "Head"/"head")
  useEffect(() => {
    const want = (vendor.headBone || "head").toLowerCase();
    let head = null;
    scene.traverse((o) => { if (!head && o.isBone && o.name.toLowerCase() === want) head = o; });
    if (headRef) headRef.current = head;
    return () => { if (headRef) headRef.current = null; };
  }, [scene, vendor.headBone, headRef]);

  // Glow mesh (e.g. the crystal ball): clone its material(s) before setting
  // emissive — Synty props share one atlas material, so mutating in place
  // would set the whole wagon glowing. Originals are restored on cleanup
  // because the useGLTF scene is cached and shared across mounts.
  const glowRef = useRef({ mats: [], targets: [], light: null, swirl: null });
  useEffect(() => {
    if (!vendor.glowMesh) return;
    const g = glowRef.current;
    // Multi-material glTF exports arrive as a Group named for the prop with
    // one child Mesh per material — traverse rather than assuming a Mesh.
    // The glow prop (the crystal ball) lives in the STRIP GLB now, not in the
    // character file, so search the strip first and fall back to the character.
    const root = findByBaseName(stripScene, vendor.glowMesh)
      || findByBaseName(scene, vendor.glowMesh);
    if (!root) return;
    const color = new THREE.Color(vendor.glowColor || "#c79bff");
    g.mats = [];
    g.targets = [];
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      g.targets.push({ mesh: o, original: o.material });
      // The glass primitive ("crystal" material) gets the animated swirl;
      // the stand and any other parts get the plain emissive clone.
      if (mats.some((m) => /crystal|glass/i.test(m?.name || ""))) {
        const swirl = makeSwirlMaterial(o, vendor.glowColor || "#c79bff");
        g.swirl = swirl;
        g.mats.push(swirl);
        o.material = swirl;
        return;
      }
      const clones = mats.map((m) => {
        const clone = m.clone();
        clone.emissive = color.clone();
        clone.emissiveIntensity = GLOW_EMISSIVE_BASE;
        g.mats.push(clone);
        return clone;
      });
      o.material = Array.isArray(o.material) ? clones : clones[0];
    });
    if (!g.targets.length) return;
    const light = new THREE.PointLight(color, GLOW_LIGHT_INTENSITY, GLOW_LIGHT_DISTANCE, 2);
    root.add(light);
    g.light = light;
    return () => {
      root.remove(light);
      g.targets.forEach(({ mesh, original }) => { mesh.material = original; });
      g.mats.forEach((m) => { try { m.dispose(); } catch (e) {} });
      g.mats = []; g.targets = []; g.light = null; g.swirl = null;
    };
  }, [scene, stripScene, vendor.glowMesh, vendor.glowColor]);

  // SitePal projection state: proj face (receives the avatar crop) + regular
  // face (hidden while projecting). Texture/material are built lazily on
  // first show and disposed on unmount (material.dispose does NOT free map).
  const projRef = useRef({
    proj: null, regulars: [],
    cropCanvas: null, cropCtx: null,
    texture: null, material: null, materialApplied: false,
    authoredMaterial: null,
    fade: 0,   // 0 = painted face, 1 = projection; crossfaded per frame
    skin: { measured: null, target: null, targetKey: undefined, lastSampleAt: 0, sceneVersion: -1 },
  });
  useEffect(() => {
    const sp = vendor.sitepal ? VENDOR_SITEPAL_CONFIG[vendor.sitepal] : null;
    if (!sp) return;
    const st = projRef.current;
    st.proj = findByBaseName(scene, sp.projFace) || null;
    st.regulars = (sp.regularFaces || [])
      .map((name) => findByBaseName(scene, name))
      .filter(Boolean);
    if (st.proj) {
      st.proj.visible = false; // hidden until the projection is live
      // Remember the face's authored material and flat colour. useGLTF hands
      // the same scene object to every mount, so an unclean remount could
      // find our clone already in place — never take THAT for authored.
      const cur = Array.isArray(st.proj.material) ? st.proj.material[0] : st.proj.material;
      if (cur && !cur.userData?.hmProjectionClone) {
        st.authoredMaterial = cur;
        if (!st.proj.userData.hmAuthoredColor && cur.color && !cur.map) {
          st.proj.userData.hmAuthoredColor = cur.color.clone();
        }
      }
    }
    st.fade = 0;
    st.skin = { measured: null, target: null, targetKey: undefined, lastSampleAt: 0, sceneVersion: -1 };
    return () => {
      if (st.proj && st.authoredMaterial) st.proj.material = st.authoredMaterial;
      if (st.texture) { try { st.texture.dispose(); } catch (e) {} }
      if (st.material) { try { st.material.dispose(); } catch (e) {} }
      st.texture = null; st.material = null;
      st.cropCanvas = null; st.cropCtx = null;
      st.materialApplied = false;
      st.fade = 0;
      st.regulars.forEach((m) => { m.visible = true; });
      if (st.proj) st.proj.visible = false;
    };
  }, [scene, vendor.sitepal]);

  // Head-follows-camera while the stall is in focus. Registered after
  // useAnimations so it runs after the mixer writes the animated pose each
  // frame; the delta is applied in world space, which stays axis-correct
  // regardless of the rig's bone orientation convention.
  const trackRef = useRef({ yaw: 0, pitch: 0, roll: 0 });
  const dwellRef = useRef(0);   // seconds focused, for focusGazeDelay
  useFrame((state, delta) => {
    // Interior dim, driven by the stall's shared eased factor so she tracks the
    // room she is sitting in exactly rather than on a clock of her own.
    const charLevel = vendor.interiorContents?.character;
    const dimClones = charDimRef.current.clones;
    if (charLevel && dimClones.length && dimRef?.current) {
      const t = dimRef.current.t;
      dimClones.forEach((m) => {
        const base = m.userData.hmBaseColor;
        if (base) m.color.copy(base).multiplyScalar(1 + (charLevel - 1) * t);
      });
    }
    // Crystal-ball life: advance the swirl shader, and drive the light +
    // stand emissive with a quasi-periodic flicker (two incommensurate
    // sines — organic drift, never a metronome).
    const g = glowRef.current;
    if (g.mats.length) {
      const tNow = state.clock.elapsedTime;
      if (g.swirl) g.swirl.uniforms.uTime.value = tNow;
      const flicker = 0.75 + 0.17 * Math.sin(tNow * 1.7) + 0.08 * Math.sin(tNow * 2.93 + 1.3);
      g.mats.forEach((m) => {
        if (!m.isShaderMaterial) m.emissiveIntensity = (GLOW_EMISSIVE_BASE + GLOW_EMISSIVE_AMP) * flicker;
      });
      if (g.light) g.light.intensity = GLOW_LIGHT_INTENSITY * 1.3 * flicker;
    }
    // SitePal face projection: while focused (and the right scene is live in
    // the host), crop the avatar frame onto the proj face and hide the
    // regular one. Same math as the temple/talk-show compositors.
    const sp = vendor.sitepal ? VENDOR_SITEPAL_CONFIG[vendor.sitepal] : null;
    if (sp) {
      const st = projRef.current;
      const focusedNow = !!focusedRef?.current;
      const source = focusedNow ? getVendorSitePalSource() : null;
      const onScene =
        typeof window !== "undefined" &&
        window.__vendorSitePalSceneLoaded === true &&
        window.__vendorSitePalCurrentSceneId === sp.sceneId;
      // Face A/B pin from the ?tune=vendor panel — { mode, vendorId }, scoped
      // to the vendor whose tab is open so it lines up with the crop sliders.
      // The projection lands on a DIFFERENT mesh from the painted face
      // (projFace vs regularFaces), so a mis-registered crop reads as the face
      // jumping the moment SitePal takes over. Pinning one holds the camera
      // still while you flip between them.
      //
      // A pin is ABSOLUTE: exactly one of the two meshes is ever visible, so
      // the swap is a clean A/B with nothing overlapping and nothing left
      // behind. In particular "face2" does not wait on a live SitePal frame —
      // it is the mesh you are comparing, and the whole point is to see where
      // its geometry sits against the painted one.
      const ab = typeof window !== "undefined" ? window.__vendorSitePalFaceOverride : null;
      const pinned = ab && ab.vendorId === vendor.sitepal ? ab.mode : null;
      let show = !!(focusedNow && source && onScene && st.proj);
      if (pinned === "face1") show = false;
      else if (pinned === "face2") show = !!st.proj;
      // Painting is gated separately from visibility. Without a live frame of
      // the RIGHT scene there is nothing honest to draw: a pinned face2 that
      // has never projected keeps its authored material (which is what you
      // want to see), and one that has keeps its last good frame instead of
      // flashing to the flat backfill.
      if (show && source && onScene) {
        ensureVendorProjectionMaterial(st);
        const skin = st.skin;
        // A scene swap in the host is a different avatar: drop the old skin
        // measurement rather than easing out of it.
        const ver = window.__vendorSitePalSceneVersion || 0;
        if (ver !== skin.sceneVersion) { skin.sceneVersion = ver; skin.measured = null; skin.lastSampleAt = 0; }
        refreshVendorSkinTarget(st, sp);
        const ctx = st.cropCtx;
        const canvas = st.cropCanvas;
        // A pose may carry its own pair (poseOverrides), else the registry's.
        const { cropX, cropY, cropW, cropH, rotateZ, rotateX } = vendor.sitepalCrop || sp.crop;
        const f = vendor.sitepalFilter || sp.filter;
        // Letterbox backfill in the MEASURED skin colour, so after the gain it
        // lands on the target exactly like the skin beside it. Before the
        // first measurement, the target itself.
        ctx.fillStyle = skin.measured ? skin.measured.getStyle()
          : skin.target ? skin.target.getStyle() : "#9F7854";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        try {
          ctx.save();
          ctx.filter = `saturate(${f.saturate}%) contrast(${f.contrast}%) brightness(${f.brightness}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%)`;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rotateZ * Math.PI) / 180);
          ctx.scale(1, Math.cos((rotateX * Math.PI) / 180));
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
          ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          ctx.filter = "none";
        } catch (e) {
          // Source canvas not yet renderable (preserveDrawingBuffer race).
        }
        if (st.texture) st.texture.needsUpdate = true;
        sampleVendorSkin(st, sp, performance.now());
        applyVendorSkinGain(st, sp, vendor.sitepal);
      }
      // Crossfade rather than cut: the projection eases in over the painted
      // face (transparent, no depth write) and only once it is fully opaque
      // does the painted face hide; reversed on the way out. A/B pins stay a
      // hard cut — the whole point of a pin is to see the swap.
      const fadeTarget = show ? 1 : 0;
      if (pinned || !st.material) st.fade = fadeTarget;
      else if (st.fade !== fadeTarget) {
        const stepF = delta / PROJ_FADE_S;
        st.fade = fadeTarget > st.fade ? Math.min(1, st.fade + stepF) : Math.max(0, st.fade - stepF);
      }
      const fade = st.fade;
      if (st.proj) st.proj.visible = fade > 0;
      if (st.material) {
        const mid = fade > 0 && fade < 1;
        st.material.opacity = fade;
        st.material.transparent = mid;
        st.material.depthWrite = !mid;
      }
      st.regulars.forEach((m) => { m.visible = fade < 1; });
    }
    // A working pose (head down over the tattoo) can't be corrected by additive
    // tracking: the delta is driven by CAMERA ELEVATION, so a level camera asks
    // for ~0 pitch and she never lifts — you just get the small yaw twitch.
    // Freeze the clip instead and let the gaze bias carry her head all the way
    // up. Paused actions keep writing their frozen pose, so the additive delta
    // still has a stable base and the anti-compounding guard below still holds.
    //
    // focusGazeDelay holds that off for a beat so she finishes the line she is
    // working on before noticing you. It gates the clip freeze AND the gaze
    // together — freezing her instantly and lifting her head later reads as a
    // hitch, whereas doing both at once reads as "stopped work, looked up".
    // Returning to work is NOT delayed: she should drop her gaze promptly.
    const isFocused = !!focusedRef?.current;
    dwellRef.current = isFocused ? dwellRef.current + delta : 0;
    const engaged = isFocused && dwellRef.current >= (vendor.focusGazeDelay ?? 0);

    if (vendor.pauseOnFocus && restActionRef.current) {
      restActionRef.current.paused = engaged;
    }

    const head = headRef?.current;
    if (!head) return;
    const t = trackRef.current;
    head.getWorldPosition(_headPos);
    // Gaze target: a nearby walking cowboy outranks the camera — he's a
    // counter-high customer, so the vendor looks DOWN at him while talking
    // instead of over his hat at the lens.
    const _wp = window.__hmWalkerPos;
    if (_wp && (_wp.x - _headPos.x) ** 2 + (_wp.z - _headPos.z) ** 2 < 1.0) {
      _toCam.set(_wp.x - _headPos.x, _wp.y + 0.12 - _headPos.y, _wp.z - _headPos.z);
    } else {
      _toCam.copy(state.camera.position).sub(_headPos);
    }
    let targetYaw = 0, targetPitch = 0, targetRoll = 0;
    if (engaged) {
      faceDirWorld(vendor, _face, stripRotY);
      const flat = Math.hypot(_toCam.x, _toCam.z);
      // gazeLift (rad) corrects a rest pose that carries the head high or
      // low — positive lifts the gaze above the pure camera angle.
      // focusGazeLift is added only while focused — it is the "look up from
      // your work" correction, and headPitchUp raises the clamp so a steeply
      // bowed pose isn't capped before it reaches the viewer.
      targetPitch = THREE.MathUtils.clamp(
        Math.atan2(_toCam.y, flat) + (vendor.gazeLift ?? 0) + (vendor.focusGazeLift ?? 0),
        -HEAD_PITCH_DOWN, vendor.headPitchUp ?? HEAD_PITCH_UP
      );
      // gazeTurn (rad) corrects a sideways rest-pose bias — positive shifts
      // the gaze toward the viewer's right.
      let dYaw = Math.atan2(_toCam.x, _toCam.z) - Math.atan2(_face.x, _face.z) + (vendor.gazeTurn ?? 0);
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      targetYaw = THREE.MathUtils.clamp(dYaw, -HEAD_YAW_LIMIT, HEAD_YAW_LIMIT);
      // focusHeadRoll cocks the head about the GAZE axis (head -> camera), so
      // the tilt reads as exactly this angle on screen no matter how far she
      // had to turn or lift to meet you. Rolling about the rest-pose forward
      // instead would smear into yaw/pitch once her head is turned.
      targetRoll = vendor.focusHeadRoll ?? 0;
    }
    const k = 1 - Math.exp(-HEAD_EASE * delta);
    t.yaw += (targetYaw - t.yaw) * k;
    t.pitch += (targetPitch - t.pitch) * k;
    t.roll += (targetRoll - t.roll) * k;
    if (Math.abs(t.yaw) >= 1e-4 || Math.abs(t.pitch) >= 1e-4 || Math.abs(t.roll) >= 1e-4) {
      // The mixer does not necessarily rewrite the bone every frame (e.g. the
      // first frames after a loop wrap). If the bone still holds the value WE
      // wrote last frame, restore the clean animated pose first — otherwise
      // the delta compounds on its own output (the recurring head-snap bug).
      if (!t.lastOut) { t.lastOut = new THREE.Quaternion(); t.lastClean = new THREE.Quaternion(); t.hasLast = false; }
      if (t.hasLast && head.quaternion.equals(t.lastOut)) {
        head.quaternion.copy(t.lastClean);
      }
      t.lastClean.copy(head.quaternion);
      head.parent.getWorldQuaternion(_parentQ);
      _worldQ.copy(_parentQ).multiply(head.quaternion);
      _yawQ.setFromAxisAngle(_UP, t.yaw);
      faceDirWorld(vendor, _face, stripRotY);
      _right.crossVectors(_UP, _face).normalize();
      // negative: _right is the face-left axis, so positive pitch (camera
      // above) needs a negative rotation about it to tilt the face upward
      _pitchQ.setFromAxisAngle(_right, -t.pitch);
      _deltaQ.copy(_yawQ).multiply(_pitchQ);
      if (Math.abs(t.roll) >= 1e-4) {
        // roll last, about the axis she is actually looking along
        _rollAxis.copy(_toCam).normalize();
        _rollQ.setFromAxisAngle(_rollAxis, t.roll);
        _deltaQ.premultiply(_rollQ);
      }
      _worldQ.premultiply(_deltaQ);
      head.quaternion.copy(_parentQ.invert().multiply(_worldQ));
      t.lastOut.copy(head.quaternion);
      t.hasLast = true;
    }
  });

  // No local transform: the character GLBs are exported in position in the
  // strip's own coordinate space, so the shared group above places them.
  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

const DECK_DEPTH = 1.2;   // boardwalk depth (cellSize units), off the mesa edge
const DECK_MARGIN = 0.2;  // deck overhang past the mesa's side walls
const DECK_OVERLAP = 0.02;  // how far the deck's inner edge bites into the mesa wall
// Lift the walking surface a hair PROUD of the field instead of exactly level
// with it. The deck top used to be anchored to world y = 0, and OilVoxelGrid's
// ground box (position [0, -worldH/2, 0], height worldH) puts its top face at
// world y = 0 as well — so across the DECK_OVERLAP band where the deck is
// deliberately buried into the mesa, two surfaces sat at identical depth along
// the entire edge. That is a z-fight by construction, and the overlap is
// precisely what makes it visible.
//
// World units, and tiny on purpose: 0.004 against a 10-unit-wide mesa is well
// under a pixel at any sane camera distance, so the seam does not read as a
// step — but it is far more than the depth buffer needs to pick a winner. A
// boardwalk sitting slightly proud of the dirt is also just what a boardwalk
// does. Do NOT solve this by shrinking DECK_OVERLAP: the overlap is what stops
// a hairline gap opening along the wall at grazing angles.
const DECK_LIFT = 0.004;
// Clicking the boardwalk itself flies the camera to whatever stretch you
// clicked. This exists because OrbitControls' dolly is TARGET-relative: it
// slides the camera along the line to controls.target and nothing more, so with
// the target parked over the middle of the field no amount of zooming ever
// reaches the strip on the far −Z edge. Panning the target there works but is
// undiscoverable. Handing the existing focus rig a point is the cheap fix — it
// moves camera AND target together, which is the thing zoom cannot do.
//
// Framing numbers are in WORLD units, not strip-local, because the focus rig
// lives outside the auto-fitted group. For scale: a stall is only ~0.49 world
// units tall at the current fit, so these are small numbers by design.
// At fov 50 this frames roughly half the strip's length (~5 world units of the
// 10.4 the deck spans) and about six stall-heights vertically — wide enough to
// read as "the area you clicked" rather than a single booth, close enough that
// picking a character out of it is an easy second click. Raise it to see more
// of the strip, lower it to land tighter on one stall.
const STRIP_VIEW_DIST = 3.0;   // how far back the camera sits from the hit point
const STRIP_VIEW_RAISE = 0.35; // lift the LOOK-AT off the deck to awning height
const STRIP_VIEW_LIFT = 0.45;  // +Y on the approach vector → looking slightly down
const STRIP_CLICK_DRAG_PX = 4; // beyond this the pointer was orbiting, not clicking
const STRUT_COUNT = 4;      // knee braces spaced along the deck's length
const STRUT_END_INSET = 0.6; // gap from the deck's ends to the outermost brace
const STRUT_DROP = 1.15;    // how far a brace falls down the mesa face (cellSize units)
const STRUT_EMBED = 0.15;   // how far the foot buries into the mesa wall
const STRUT_TOP_INSET = 0.08; // how far in from the deck's outer edge the head sits
const STRUT_THICK = 0.09;   // square section of the brace
const WOOD_POST = "#4e3b26";

// The strip GLB is authored running along its own local Z; +90° about Y lays
// that onto the mesa's X edge, and maps local (x,y,z) → world (z, y, −x).
const STRIP_ROT_Y = Math.PI / 2;

// The per-vendor face-framing numbers (faceDist/faceLift) were tuned when the
// characters rendered at this scale. framingUnit rescales them to whatever the
// strip auto-fits to, so the tuned close-ups survive a re-export.
const LEGACY_MODEL_SCALE = 0.1;

// `framingUnit` replaces the old `cellSize` multiplier on the face-framing
// numbers. Those values were tuned against characters rendered at modelScale
// 0.1; scaling them by (stripScale / 0.1) preserves the exact same framing now
// that the characters are sized by the strip's auto-fit instead.
// Click volume over a paired prop, in strip-local units (the Synty tents are
// roughly this size in the strip's own space).
const PROXY_LOCAL_SIZE = 5;

// Module-level so the common "no offset" case reuses one array instead of
// allocating a fresh [0,0,0] every render (R3F would then see a changed prop).
const VENDOR_NO_OFFSET = /* @__PURE__ */ Object.freeze([0, 0, 0]);

function VendorStall({ vendor: baseVendor, stripScene, stripRotY, framingUnit, propObj, onVendorClick, onFocusObject, onZoomOut, onFocusChange }) {
  // Fold this session's pose framing over the vendor so the close-up matches
  // whichever pose was actually drawn.
  const vendor = useMemo(() => {
    const over = baseVendor.poseOverrides?.[CHOSEN_POSE_MODEL[baseVendor.id]];
    return over ? { ...baseVendor, ...over } : baseVendor;
  }, [baseVendor]);
  const rootRef = useRef();
  const zoomedRef = useRef(false);
  const headRef = useRef(null);

  // ── Focus-gated interior dim (see INTERIOR_DIM_EASE) ─────────────────────
  // Materials are CLONED before anything is written: BOARDWALK_Atlas_MAT is
  // shared by 77 meshes across the boardwalk, so tinting it in place would
  // darken most of the strip. One clone per unique material, not per mesh.
  // The clone stays assigned whether focused or not — at dim 1.0 it renders
  // identically, and swapping materials on the fly would cost a recompile
  // mid-flight.
  //
  // `t` is a single eased 0→1 focus factor SHARED by every consumer — the
  // shell here, and the character over in VendorModel, which reads this same
  // ref. Each maps it to its own level via lerp(1, level, t), so the whole
  // booth moves as one; two independent eases would let them drift apart
  // mid-fade and the room would come apart while you fly in.
  const dimRef = useRef({ t: 0, targets: [], clones: [] });
  useEffect(() => {
    const shell = vendor.interiorDim;
    if (!shell) return;
    const st = dimRef.current;
    // Clone key is (material, level), NOT material alone: the shell and the
    // furniture both use BOARDWALK_Atlas_MAT, and one shared clone could only
    // carry one of the two levels.
    const byMaterial = new Map();
    const claim = (root, level) => {
      if (!root) return;
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const swapped = mats.map((m) => {
          if (!m || !m.color) return m;
          const key = `${m.uuid}@${level}`;
          let clone = byMaterial.get(key);
          if (!clone) {
            clone = m.clone();
            // clone() JSON-round-trips userData, so a Texture stashed there
            // comes back as a plain object and throws on upload. Same scrub as
            // the string-light clone below.
            clone.userData = {};
            clone.userData.hmBaseColor = m.color.clone();
            clone.userData.hmDimLevel = level;
            byMaterial.set(key, clone);
            st.clones.push(clone);
          }
          return clone;
        });
        st.targets.push({ mesh: o, original: o.material });
        o.material = Array.isArray(o.material) ? swapped : swapped[0];
      });
    };
    claim(propObj, shell);
    const contents = vendor.interiorContents;
    if (contents?.props?.length) {
      contents.props.forEach((name) => claim(findByBaseName(stripScene, name), contents.level));
    }
    return () => {
      // Captured locals, not refs: a ref read in a cleanup can already be null,
      // and then the restore silently never runs and the clones leak.
      st.targets.forEach(({ mesh, original }) => { mesh.material = original; });
      st.clones.forEach((m) => { try { m.dispose(); } catch (e) {} });
      st.targets = []; st.clones = []; st.t = 0;
    };
  }, [propObj, stripScene, vendor.interiorDim, vendor.interiorContents]);

  useFrame((_, delta) => {
    const st = dimRef.current;
    const target = zoomedRef.current ? 1 : 0;
    if (Math.abs(st.t - target) < 1e-3) return;       // settled: stop writing
    st.t += (target - st.t) * (1 - Math.exp(-INTERIOR_DIM_EASE * delta));
    st.clones.forEach((m) => {
      const base = m.userData.hmBaseColor;
      if (base) m.color.copy(base).multiplyScalar(1 + (m.userData.hmDimLevel - 1) * st.t);
    });
  });

  // Same click-to-zoom idiom as OilTower: first click dollies in — to the
  // character's face when the model has a head bone, else head-on to the
  // stall — second click pulls back to the overview.
  // The full face-zoom flow, shared between a sky click and the walker's
  // on-foot entry (the "hm-vendor-enter" window event).
  const enterVendor = () => {
    if (zoomedRef.current) return;
    onVendorClick?.(vendor.id);
    // Voiced vendors greet on approach: swap the host to their SitePal scene
    // and speak an ElevenLabs line (engine 14) with real lipsync. The click
    // itself is the audio-unlock gesture.
    if (vendor.sitepal) activateVendorSitePal(vendor.sitepal);
    if (vendor.moodDim) window.dispatchEvent(new CustomEvent("vendor-mood", { detail: { active: true } }));
    if (!onFocusObject || !rootRef.current) return;
    const normal = approachDirWorld(vendor, new THREE.Vector3(), stripRotY);
    if (headRef.current) {
      const headPos = new THREE.Vector3();
      headRef.current.getWorldPosition(headPos);
      // faceLift moves the look-at point (frame center) up/down the body.
      headPos.y += (vendor.faceLift ?? 0) * framingUnit;
      // focusOffset shifts the look-at LATERALLY, in strip-local units, for
      // shots framing more than one character — the tattoo pair wants the
      // midpoint between artist and client, not her head. Converted through the
      // group's +90°: local (x,y,z) -> world (z, y, -x).
      const fo = vendor.focusOffset;
      if (fo) {
        const sc = framingUnit * LEGACY_MODEL_SCALE;
        headPos.x += (fo[2] ?? 0) * sc;
        headPos.y += (fo[1] ?? 0) * sc;
        headPos.z += -(fo[0] ?? 0) * sc;
      }
      // camDrop tilts the approach ray: negative puts the camera BELOW the
      // target looking up (hero shot), positive above looking down. This is
      // what changes the composition — faceLift alone shifts camera and
      // target together, leaving the framing identical.
      normal.y += vendor.camDrop ?? 0;
      normal.normalize();
      onFocusObject(headPos, normal, (vendor.faceDist ?? 0.65) * framingUnit);
    } else if (propObj) {
      // Character-less vendor: frame its paired prop from the prop's own WORLD
      // bounds (setFromObject walks world matrices), so the shot fits the tent
      // at whatever scale the strip auto-fitted to.
      const box = new THREE.Box3().setFromObject(propObj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      onFocusObject(center, normal, Math.max(size.x, size.y, size.z) * 1.6);
    } else {
      const center = new THREE.Vector3();
      rootRef.current.getWorldPosition(center);
      center.y += 0.45 * framingUnit;
      onFocusObject(center, normal, 1.8 * framingUnit);
    }
    zoomedRef.current = true;
    // Hand the spotlight something to aim at: the head bone when the vendor is
    // rigged, else the paired prop so tent-only vendors still get lit.
    onFocusChange?.({ id: vendor.id, object: headRef.current || propObj || rootRef.current });
  };
  // flyOut=false is the walker's exit: he resumes his own camera where he
  // stands, so no overview fly-back.
  const exitVendor = (flyOut = true) => {
    if (!zoomedRef.current) return;
    zoomedRef.current = false;
    if (vendor.sitepal) deactivateVendorSitePal();
    if (vendor.moodDim) window.dispatchEvent(new CustomEvent("vendor-mood", { detail: { active: false } }));
    onFocusChange?.(null);
    if (flyOut) onZoomOut?.();
    // Tell the walker (if he's mid-visit) that the scene ended, whichever
    // door it ended through.
    window.dispatchEvent(new CustomEvent("hm-vendor-left"));
  };
  const handleClick = (e) => {
    e.stopPropagation();
    if (zoomedRef.current) { exitVendor(); return; }
    enterVendor();
  };
  // Register this stall for the walker — world position + label — and answer
  // its enter/exit events.
  const enterRef = useRef(); enterRef.current = enterVendor;
  const exitRef = useRef(); exitRef.current = exitVendor;
  useEffect(() => {
    const reg = (window.__hmVendorSpots = window.__hmVendorSpots || {});
    // Anchor on the vendor's HEAD once the character loads — the group root
    // can sit at the far end of a trailer (the taco stand's soda machine),
    // which pointed the walker's hat-cam at the appliances. eyeY carries the
    // real eye height per vendor (seated, standing, counter — all differ).
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const head = headRef.current;
      const anchor = head || (tries > 12 ? rootRef.current : null);
      if (anchor) {
        const v = new THREE.Vector3();
        anchor.getWorldPosition(v);
        reg[vendor.id] = {
          id: vendor.id, label: vendor.label || vendor.id,
          x: v.x, z: v.z, eyeY: head ? v.y : null,
        };
        clearInterval(t);
      } else if (tries > 40) {
        clearInterval(t);
      }
    }, 250);
    const onEnter = (e) => { if (e.detail?.id === vendor.id) enterRef.current?.(); };
    const onExit = () => exitRef.current?.(false);
    window.addEventListener("hm-vendor-enter", onEnter);
    window.addEventListener("hm-vendor-exit", onExit);
    return () => {
      clearInterval(t);
      delete reg[vendor.id];
      window.removeEventListener("hm-vendor-enter", onEnter);
      window.removeEventListener("hm-vendor-exit", onExit);
    };
  }, [vendor.id, vendor.label]);
  // Identity transform: this group is a child of the shared strip group, and
  // both the strip GLB and the character GLBs are authored in that same frame.
  // The click volume over the paired prop is what makes the tent itself
  // clickable — for character-less vendors it is the ONLY click target.
  const p = propObj?.position;
  const labelSize = 0.75 / (framingUnit || 1);
  return (
    <group
      ref={rootRef}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {vendor.companionModel && <CompanionModel url={vendor.companionModel} />}
      {(vendor.model || vendor.poseModels?.length) && (
        // Wraps ONLY the character. The prop click-proxy and label below are
        // positioned from the prop's own origin and must stay on the prop, so
        // they deliberately sit outside this group — nudging a vendor moves the
        // vendor, not their tent's click volume.
        <group position={vendor.offset || VENDOR_NO_OFFSET}>
          <VendorModel
            vendor={vendor}
            focusedRef={zoomedRef}
            dimRef={dimRef}
            headRef={headRef}
            stripScene={stripScene}
            stripRotY={stripRotY}
          />
        </group>
      )}
      {p && (
        <mesh position={[p.x, p.y + PROXY_LOCAL_SIZE / 2, p.z]}>
          <boxGeometry args={[PROXY_LOCAL_SIZE, PROXY_LOCAL_SIZE, PROXY_LOCAL_SIZE]} />
          {/* transparent, not `visible={false}` — invisible objects are skipped
              by the raycaster and would take no clicks at all */}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {p && vendor.label ? (
        <Text
          position={[p.x, p.y + PROXY_LOCAL_SIZE, p.z]}
          fontSize={labelSize}
          color={vendor.accent}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {vendor.label}
        </Text>
      ) : null}
    </group>
  );
}

// ── Spotlight rig ───────────────────────────────────────────────────────────
// 7 poles × 2 bulbs sit at strip-local y=8, x≈3.98 — one pair per pole. Two
// jobs, deliberately split, because they have very different costs:
//   1. Bulbs READ as lit from any distance  → emissive material + additive
//      halo. Zero lights.
//   2. The FOCUSED vendor gets a real beam  → exactly one SpotLight, moved to
//      whichever bulb is nearest and aimed at them, alive only while zoomed.
// Fourteen real spotlights would be ~14 extra shadow passes a frame; the strip
// already avoids extra dynamic lights on purpose (see the envMap fill above).
// Export layout: 14 units named Spotlight.001–.014, each with two children —
// Spotlight_Housing.NNN (the ~1300-vert fixture) and Spotlight_Bulb.NNN (the
// 8-vert lamp). Only the lamp should ever glow; emissive on the housing is what
// turned the whole apparatus white before it was split out.
//
// The lamp ships its own material carrying emissiveFactor [1,1,1], so the glow
// is authored in Blender. This component defers to that and only applies its
// own emissive when the asset ships an unlit bulb — Blender stays the single
// source of truth for the look, and re-exports can't fight the code.
const BULB_RE = /^Spotlight_Bulb\d*$/;   // post-sanitize: "Spotlight_Bulb.001" -> "Spotlight_Bulb001"

const BULB_EMISSIVE = "#ffdca8";   // warm filament
const BULB_EMISSIVE_INTENSITY = 1.6;
// "Did Blender author a glow?" has to be a BRIGHTNESS test, not a non-zero
// test. An export can carry a small but non-zero emissiveFactor for a lamp
// that is visually dead — this one ships 0.0253, about sRGB #2d2d2d — and a
// `> 0` check reads that as authored and suppresses the fallback. Any max
// channel below this is treated as "shipped unlit".
const BULB_AUTHORED_MIN = 0.35;
const HALO_COLOR = "#ffe6b8";
const HALO_PX = 11;                // constant SCREEN size — a bulb mesh goes
                                   // sub-pixel from aerial and vanishes; a
                                   // fixed-px sprite is how distant practicals
                                   // actually read.
const HALO_NEAR = 2.5;             // world units: fully faded out this close…
const HALO_FAR = 9.0;              // …and fully on by here (aerial)

// Throw is short: bulbs sit at local y=8 → ~1.08 world units up at the 0.135
// auto-fit, and a character is ~0.26 world tall, so the beam travels ~0.84.
// At the old 0.5 rad the pool was ~0.46 wide — 9× the character, i.e. a wash
// with no readable edge. Tight angle + low penumbra is what makes it a SPOT.
// three r0.185 is physically-correct: intensity is candela and falls off 1/d²,
// so at 0.84 units the surface sees intensity/0.71. It still competes with
// dirA 4.0 + dirB 3.0 + ambient 0.6 of daylight, and ACES rolls off highlights
// — see the moodDim note below if you want it to really bite.
const SPOT_COLOR = "#fff2d0";
const SPOT_INTENSITY = 9.0;
const SPOT_DISTANCE = 2.6;         // WORLD units — NOT scaled by the strip
                                   // group, so this light is mounted outside it
const SPOT_ANGLE = 0.22;
const SPOT_PENUMBRA = 0.35;
const SPOT_EASE = 4.5;             // 1/s fade in/out

// A SpotLight is invisible in air — three.js has no volumetric scattering, so a
// light alone can never look like it "emanates". The visible shaft has to be
// geometry: an additive cone from bulb to target, apex at the bulb. It lights
// nothing; it is purely the beam you can see. The two are complements, not
// alternatives — the cone can't brighten the vendor, the light can't be seen.
const BEAM_COLOR = "#ffeec4";
const BEAM_ANGLE = 0.30;           // rad, half-angle of the visible shaft
// Measured to the STRIP'S ORIGIN, not to the nearest bulb — so this is "how far
// back am I standing from the boardwalk", not "how close is that one lamp".
//
// Retuned 2026-08-23. The old 1.5 → 4.0 band assumed you only ever reached the
// strip by orbiting in from the far side, which left you beyond BEAM_FAR at full
// strength. Click-to-fly now lands you at STRIP_VIEW_DIST (3.0), which sat right
// inside the fade and dimmed the shafts to ~60%. The band still exists for the
// case it was written for — a vendor face close-up putting the camera INSIDE a
// cone, which would just wash the screen — it simply starts later now.
const BEAM_NEAR = 0.9;             // world units: hidden this close…
const BEAM_FAR = 2.2;
// PlaneGeometry faces +Z; this lays it flat so its normal points up.
const FLAT_Q = /* @__PURE__ */ new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
// Undercarriage glow comes from real PointLights authored in Blender and
// carried by the GLB via KHR_lights_punctual. The model owns position, colour
// and intensity; this gates them by time of day and nothing else.
//
// The one exception is a WHITE-only safety net, because this specific failure
// has happened twice: Blender's glTF exporter reads a light's colour from its
// **Emission node**, not the Colour swatch in the Light panel. "Use Nodes" is
// forced on for lights, so the swatch is cosmetic to glTF and a default
// Emission node ships [1,1,1] no matter how the swatch looks. Fix at source by
// matching the Emission node's Color to the swatch — but the fallback below
// keeps the scene right if an export regresses, and yields the moment the file
// carries a real colour, so the asset always wins when it has an opinion.
const WAGON_LIGHT_FALLBACK = {
  Point: "#3fd6c8",      // salesman wagon  — teal
  Point001: "#8a63e8",   // fortune teller  — purple
};
// Multiplier on the AUTHORED intensity, so Blender still owns the brightness.
const WAGON_LIGHT_BY_ENV = { night: 1.0, dusk: 0.7, hell: 1.0 };

const POOL_LIFT = 0.05;            // strip-local nudge off the boards (no z-fight)
const POOL_SPREAD = 1.15;          // pool radius vs. the cone base, a touch wider
                                   // so the light looks like it spills, not stops
const POOL_GAIN = 1.9;             // pool is brighter than the shaft: you are
                                   // seeing a lit surface, not thin air              // …and at full strength by here, which is
                                   // the range the strip is actually viewed from

// A beam is ADDITIVE: it can only brighten what is behind it, so against a lit
// daytime sky there is nothing to add to and it reads as nothing. This is a
// property of the lighting, not a tuning value — no opacity makes a beam show
// in full sun. So the rig keys off the scene's env preset: strong at night,
// present at dusk/hell, off in daylight where it would only add haze.
// (parabolumEnv is a separate mode on the page — add it here if you want beams
// there too. GeodeDusk used to be listed here; the Geode theme was removed
// 2026-08-23.)
const BEAM_BY_ENV = { night: 0.05, dusk: 0.01, hell: 0.05 };
const BEAM_DEFAULT = 0;            // day, solstice: no beam
const SPOT_BOOST_BY_ENV = { night: 1.2, dusk: 1.0, hell: 1.0 };  // × SPOT_INTENSITY


// Build a light cone that ENDS ON THE GROUND by construction, instead of a
// symmetric cone we then try to clip. A plain ConeGeometry's base is a disk
// perpendicular to its own axis, so once the lamp is tilted only the disk's
// centre sits at deck height and the low side punches through the boards.
//
// Here every rim vertex is the intersection of an edge-ray with the deck plane,
// so the base is a horizontal ellipse at exactly deck level and nothing can
// exist below it — no clipping planes, no renderer state, no material recompile
// order to get wrong. Positions are relative to the apex, so the mesh just sits
// at the bulb with no rotation or scale.
function groundConeGeometry(aimQuat, apexY, halfAngle, groundY, segs = 22) {
  const d = new THREE.Vector3(0, 1, 0).applyQuaternion(aimQuat).normalize();
  if (d.y > -1e-3) return null;                       // aimed level or up
  const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(d, ref).normalize();
  const v = new THREE.Vector3().crossVectors(d, u).normalize();
  const tanA = Math.tan(halfAngle);
  const drop = apexY - groundY;
  if (!(drop > 0)) return null;
  const maxT = (drop / -d.y) * 2.5;                   // cap rays that never hit
  const rim = [];
  const dir = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    dir.copy(d).addScaledVector(u, Math.cos(th) * tanA).addScaledVector(v, Math.sin(th) * tanA).normalize();
    const t = dir.y < -1e-4 ? Math.min((groundY - apexY) / dir.y, maxT) : maxT;
    rim.push(dir.x * t, dir.y * t, dir.z * t);
  }
  const pos = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 3, b = (i + 1) * 3;
    pos.push(0, 0, 0, rim[a], rim[a + 1], rim[a + 2], rim[b], rim[b + 1], rim[b + 2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,230,184,0.85)");
  g.addColorStop(1.0, "rgba(255,210,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Emissive bulbs + one additive Points cloud. Rendered INSIDE the strip group
// using strip-local positions; sizeAttenuation:false keeps the halo a constant
// pixel size, so the group's ~0.135 scale can't shrink it away.
const _haloAt = /* @__PURE__ */ new THREE.Vector3();

function BulbRig({ stripScene, envPreset, clipPlanes }) {
  // A tilted cone's base disk is perpendicular to its OWN axis, so only its
  // centre lands at deck height — the low side dips below the boards and shows
  // against the void under the strip. A world-space clipping plane at deck
  // level cuts exactly that, and costs one uniform plus a discard.
  const gl = useThree((st) => st.gl);
  // Must be on BEFORE the materials first compile: the shader bakes in
  // NUM_CLIPPING_PLANES, and flipping this in an effect (i.e. after the first
  // render) leaves already-compiled materials with clipping stripped out — the
  // plane then looks inert no matter what you set its constant to.
  if (gl && !gl.localClippingEnabled) gl.localClippingEnabled = true;

  const matRef = useRef(null);
  const [localPts, setLocalPts] = useState(null);
  const [beamXf, setBeamXf] = useState(null);
  const [coneGeos, setConeGeos] = useState(null);
  const pointsMat = useRef(null);

  useEffect(() => {
    const bulbs = [];
    stripScene.traverse((o) => { if (o.isMesh && BULB_RE.test(sanitizeName(o.name))) bulbs.push(o); });
    if (!bulbs.length) return;

    // Defer to the asset when Blender already authored the glow. Only light the
    // bulbs ourselves if they arrive unlit — and clone before touching, since
    // all 14 share one material (and so does the unrelated "Circle" mesh, which
    // must not inherit a filament).
    //
    // The current export ships emissiveFactor 0.0253 on Material.001 — black to
    // the eye, but enough to clear a "not zero" threshold, which is what left
    // the lamps dark at night: the code believed Blender had an opinion and
    // stood down. Compare against BULB_AUTHORED_MIN so only a real glow wins.
    const first = bulbs[0].material;
    const e = first?.emissive;
    const authored = !!e && Math.max(e.r, e.g, e.b) >= BULB_AUTHORED_MIN;
    let restore = null;
    if (!authored) {
      const lit = first.clone();
      lit.emissive = new THREE.Color(BULB_EMISSIVE);
      lit.emissiveIntensity = BULB_EMISSIVE_INTENSITY;
      lit.toneMapped = false;
      matRef.current = lit;
      bulbs.forEach((b) => { b.material = lit; });
      restore = () => {
        bulbs.forEach((b) => { b.material = first; });
        try { lit.dispose(); } catch (err) {}
        matRef.current = null;
      };
    }

    // Positions relative to stripScene (identity inside the group), so they are
    // correct no matter what the auto-fit resolved to. Uses world positions, so
    // the parent Spotlight.NNN transform is already folded in.
    stripScene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(stripScene.matrixWorld).invert();
    const arr = new Float32Array(bulbs.length * 3);
    const xf = [];
    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    bulbs.forEach((b, i) => {
      b.updateWorldMatrix(true, false);
      // full local transform, not just position — each lamp is aimed
      // individually and the cone has to inherit that rotation
      m4.copy(inv).multiply(b.matrixWorld).decompose(pos, quat, scl);
      arr.set([pos.x, pos.y, pos.z], i * 3);
      xf.push({ p: [pos.x, pos.y, pos.z], q: [quat.x, quat.y, quat.z, quat.w] });
    });
    setLocalPts(arr);
    setBeamXf(xf);

    // one exact, ground-terminated cone per lamp (deck is local y = 0)
    const qq = new THREE.Quaternion();
    const geos = xf.map((t) => {
      qq.set(t.q[0], t.q[1], t.q[2], t.q[3]);
      return groundConeGeometry(qq, t.p[1], BEAM_ANGLE, 0);
    });
    setConeGeos((prev) => { prev?.forEach((g) => g && g.dispose()); return geos; });

    return () => {
      restore?.();
      setConeGeos((prev) => { prev?.forEach((g) => g && g.dispose()); return null; });
    };
  }, [stripScene]);

  const beamMat = useRef();
  const poolMat = useRef();
  const beamPeak = BEAM_BY_ENV[envPreset] ?? BEAM_DEFAULT;

  // One cone geometry and one material shared by all 14 shafts.
  const poolGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const beamMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(BEAM_COLOR),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    clippingPlanes: clipPlanes,
  }), [clipPlanes]);
  const poolMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(BEAM_COLOR),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    clippingPlanes: clipPlanes,
  }), [clipPlanes]);
  beamMat.current = beamMaterial;
  poolMat.current = poolMaterial;
  useEffect(() => () => {
    try { beamMaterial.dispose(); } catch (e) {}
    try { poolGeo.dispose(); } catch (e) {}
    try { poolMaterial.dispose(); } catch (e) {}
  }, [beamMaterial, poolGeo, poolMaterial]);

  const tex = useMemo(() => (typeof document === "undefined" ? null : haloTexture()), []);
  useEffect(() => { if (tex && poolMaterial) { poolMaterial.map = tex; poolMaterial.needsUpdate = true; } }, [tex, poolMaterial]);
  useEffect(() => {
    if (beamMaterial) beamMaterial.needsUpdate = true;
    if (poolMaterial) poolMaterial.needsUpdate = true;
  }, [beamMaterial, poolMaterial]);
  useEffect(() => () => { try { tex?.dispose(); } catch (e) {} }, [tex]);

  // Fade the halo in with camera distance so it carries the aerial read without
  // blowing out a face close-up, where the emissive mesh already does the work.
  // Measured to the STRIP, not the world origin — the mesa origin sits ~5.6
  // units off the boardwalk, which would leave the halo half-lit up close.
  const ptsRef = useRef();
  useFrame((state) => {
    const m = pointsMat.current, o = ptsRef.current;
    if (!m || !o) return;
    o.getWorldPosition(_haloAt);
    const d = state.camera.position.distanceTo(_haloAt);
    m.opacity = THREE.MathUtils.clamp((d - HALO_NEAR) / (HALO_FAR - HALO_NEAR), 0, 1);
    m.visible = m.opacity > 0.01;

    const bm = beamMat.current;
    if (bm) {
      const ramp = THREE.MathUtils.clamp((d - BEAM_NEAR) / (BEAM_FAR - BEAM_NEAR), 0, 1);
      bm.opacity = beamPeak * ramp;
      bm.visible = bm.opacity > 0.005;
      const pm = poolMat.current;
      if (pm) {
        pm.opacity = Math.min(1, beamPeak * POOL_GAIN * ramp);
        pm.visible = pm.opacity > 0.005;
      }
    }
  });

  if (!localPts || !tex) return null;

  // Visible shafts, in STRIP-LOCAL units so the auto-fit scale carries them for
  // free. Each cone hangs from its bulb down to the deck (local y≈0): the cone
  // apex is at +h/2, so seating it at y - h/2 pins the apex on the lamp and
  // flares the base into a pool on the boards. One geometry + one material
  // shared across all 14.
  // Each lamp is aimed individually in Blender — the fixture's local +Y is its
  // throw direction (consistently ~0.7–0.83 downward in world, with the two
  // lamps on each pole splaying opposite ways). So the cone inherits that
  // rotation instead of hanging straight down, and its length is extended to
  // wherever the tilted axis actually reaches the deck.
  const beams = [];
  if (beamPeak > 0 && beamXf && coneGeos && beamMaterial) {
    const aim = new THREE.Vector3(), q = new THREE.Quaternion(), poolQ = new THREE.Quaternion();
    beamXf.forEach((t, i) => {
      const geo = coneGeos[i];
      if (!geo) return;                          // lamp aimed level or upward
      q.set(t.q[0], t.q[1], t.q[2], t.q[3]);
      aim.set(0, 1, 0).applyQuaternion(q).normalize();
      const h = t.p[1] / -aim.y;
      const r = Math.tan(BEAM_ANGLE) * h;

      // shaft: geometry is already apex-relative and ends on the deck, so it
      // needs position only — no rotation, no scale, nothing to get wrong
      beams.push(
        <mesh
          key={`beam-${i}`}
          position={[t.p[0], t.p[1], t.p[2]]}
          geometry={geo}
          material={beamMaterial}
          frustumCulled={false}
          renderOrder={2}
        />
      );

      // the pool it lands in: a cone meeting a plane off-axis makes an ELLIPSE,
      // stretched along the direction of travel by 1/sin(elevation)
      poolQ.setFromAxisAngle(_UP, Math.atan2(aim.x, aim.z)).multiply(FLAT_Q);
      const stretch = 1 / Math.max(0.25, -aim.y);
      beams.push(
        <mesh
          key={`pool-${i}`}
          position={[t.p[0] + aim.x * h, POOL_LIFT, t.p[2] + aim.z * h]}
          quaternion={[poolQ.x, poolQ.y, poolQ.z, poolQ.w]}
          scale={[r * 2 * POOL_SPREAD, r * 2 * POOL_SPREAD * stretch, 1]}
          geometry={poolGeo}
          material={poolMaterial}
          frustumCulled={false}
          renderOrder={3}
        />
      );
    });
  }

  return (
    <>
      {beams}
      <points ref={ptsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[localPts, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={pointsMat}
          map={tex}
          color={HALO_COLOR}
          size={HALO_PX}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </>
  );
}

// A second character that only exists alongside a particular pose — the tattoo
// client, who should be in the chair only on the loads where the artist is
// actually seated and tattooing. Kept in its OWN GLB rather than merged into
// hers: both Synty rigs name their bones identically (Pelvis, spine_01, head,
// Hand_L...), and three.js binds animation tracks to bones BY NAME, taking the
// first match in the tree. Merged, the client's clip can end up driving the
// artist's skeleton. Separate files keep each binding unambiguous, and each
// export stays a simple one-armature job.
//
// Exported in position like every other character, so it renders at identity.
function CompanionModel({ url }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);
  const { actions, mixer } = useAnimations(animations, group);

  useEffect(() => {
    const orig = mixer.update.bind(mixer);
    mixer.update = (d) => orig(Math.min(d, 1 / 30));
    return () => { mixer.update = orig; };
  }, [mixer]);

  useEffect(() => {
    const a = Object.values(actions || {})[0];
    a?.reset().play();
    return () => a?.stop();
  }, [actions]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

// ── Photo booth ─────────────────────────────────────────────────────────────
// A working PHOTOMATIC: click the booth and its polaroid-framed side screen
// becomes a live webcam viewfinder (the square screen behind the curtain
// mirrors the same feed); click again for a 3-2-1 countdown, flash, and a
// stylized print that develops from overexposed white and stays on the outer
// screen across sessions (localStorage). Everything the player reads —
// prompts, countdown, the datestamp — is drawn ON the screen canvas, not as
// DOM chrome, so the whole exchange happens with an in-world machine.
//
// The screens are found by MATERIAL name, not node name: the booth mesh is one
// object whose glTF primitives split per material, and material names survive
// export untouched (unlike node names, which sanitizeNodeName rewrites). The
// .blend authors both screens with clean 0-1 UVs, verified un-flipped —
// flipY:false + a normally-drawn canvas is the correct pairing for glTF UVs,
// same as the SitePal projection above.
// Screen roles (post booth-remodel, Aug 23): BoothScreen_Cabin is the framed
// viewfinder INSIDE the curtained pocket — flight target and live mirror.
// BoothScreen_Inner/Outer are the LEGACY names from the previous export and
// only matter until the strip GLB is re-exported: outer was the framed screen,
// inner the entrance niche (now separated out as Booth_AdBoard, material
// "BoothScreen_Ad", which this code deliberately never touches).
const BOOTH_SCREEN_CABIN = "BoothScreen_Cabin";
const BOOTH_SCREEN_OUTER = "BoothScreen_Outer";
const BOOTH_SCREEN_INNER = "BoothScreen_Inner";
const BOOTH_PHOTO_KEY = "hm_booth_photo";

// Canvas matches the outer screen's authored aspect (0.489 × 0.426 strip
// units ≈ 1.148:1). The inner screen is square, so the shared texture squeezes
// ~15% there — it is a preview mirror behind a curtain; nobody measures it.
const BOOTH_W = 512;
const BOOTH_H = 446;

// The session happens INSIDE the cabin: the flight threads through the
// curtain and parks facing the inner screen, so the booth's own walls provide
// the enclosure (the open top spills daylight in). Distance in strip-local
// units × the auto-fit scale; the cabin is ~1.3 local units deep, so the
// camera sits most of the way back toward the curtain.
const BOOTH_INSIDE_DIST_LOCAL = 0.85;
// OrbitControls floor while inside, in WORLD units. CameraFlyTo's default 0.3
// floor is deeper than the entire cabin — this override (threaded through
// handleFocusObject's 4th arg) is what lets the camera fit at all.
const BOOTH_INSIDE_MIN_DIST = 0.05;
// Occupancy lamp: a small warm bulb that eases on while the booth is in use.
// Mounted inside the scaled group, so POSITION is strip-local but distance is
// WORLD units (the GLOW_LIGHT_DISTANCE trap). Inverse-square makes tiny
// intensities read strongly this close — same reasoning as the crystal ball.
const BOOTH_CABIN_LIGHT = 0.06;
const BOOTH_CABIN_LIGHT_DIST = 0.5;  // WORLD units

const BOOTH_COUNT_SECONDS = 3;    // countdown length
const BOOTH_FLASH_TIME = 0.35;    // seconds of white-out on the screen
const BOOTH_DEVELOP_TIME = 2.4;   // overexposed white → print, polaroid-style
// The flash also pops in the WORLD: one point light just off the screen face.
// Mounted inside the scaled group, so its POSITION is strip-local — but
// distance/decay are world-space and do not inherit the fit (the
// GLOW_LIGHT_DISTANCE trap), hence the small world-unit distance.
const BOOTH_FLASH_LIGHT = 18;
const BOOTH_FLASH_DIST = 2.0;     // WORLD units
const BOOTH_AMBER = "#ffd9a0";    // screen chrome text — kin to the vendor accents

// NO SIGNAL diagnoses, keyed by the getUserMedia rejection's error name (plus
// "insecure" for origins where the API doesn't exist at all). Naming the exact
// cause on the screen turns a support question into a self-serve fix.
// Kept SHORT on purpose: these render on the 512px booth screen (the DOM
// banner the page pops alongside carries the full step-by-step). Lines that
// still run long get auto-shrunk by boothMessageScreen.
const BOOTH_CAM_HINTS = {
  insecure: ["camera needs localhost or https"],
  NotAllowedError: ["camera blocked for this site", "address bar camera icon > allow", "then re-enter the booth"],
  // NotAllowedError whose message says "denied by system": the OS, not the
  // browser, is the blocker (this is the one that bit on macOS — the site
  // permission read `granted` while every request still failed).
  SystemDenied: ["the OS is blocking the camera", "system settings > privacy > camera", "then restart the browser"],
  NotFoundError: ["no camera detected on this device"],
  NotReadableError: ["camera is in use by another app"],
  unknown: ["camera unavailable", "check browser permissions"],
};

// Companion overlay hook: draws a scene character into the print BEFORE
// stylization, so player and companion grade as one photograph.
// (ctx, w, h) on the snapshot canvas, base video frame already down.
let boothCompanionDraw = null;
export function setBoothCompanionDraw(fn) { boothCompanionDraw = fn; }

// ── Booth photobombs ────────────────────────────────────────────────────────
// Transparent character renders (authored in Blender) drawn into the print at
// capture. Deliberately NOT shown in the live mirror — the photobomb reveals
// itself as the print develops, which is the whole gag, and rarity is what
// makes a bombed print worth showing off.
//   url:    PNG with alpha under /public. The render's flat cut edge is the
//           side it enters from and sits flush on the print's border.
//   side:   "left" | "right" — which border the cut edge hugs.
//   height: fraction of the print's height the render is scaled to.
//   chance: independent roll per snap, tried in order — first hit wins.
// Dev override: ?boothbomb=<substring of url> forces that companion.
const BOOTH_COMPANIONS = [
  { url: "/booth/companions/demon.webp", side: "left", height: 0.95, chance: 0.2 },
];
const _companionImgs = new Map();
function boothCompanionImage(url) {
  let img = _companionImgs.get(url);
  // A FAILED load retries (throttled): assets get dropped into /public
  // mid-session while authoring, and a permanently-cached 404 would need a
  // full reload to notice the file arrived.
  if (img && img.complete && !img.naturalWidth && Date.now() - (img.__failedAt || 0) > 3000) {
    img = null;
  }
  if (!img) {
    img = new Image();
    img.onerror = () => { img.__failedAt = Date.now(); };
    img.src = url;
    _companionImgs.set(url, img);
  }
  return img;
}
// The render's OPAQUE bounding box, scanned once and cached on the image.
// Anchoring by opaque pixels (not the file's canvas) means transparent padding
// left over from an export can never open a gap at the print's edge.
//
// The threshold is deliberately HIGH: lossy WebP alpha leaves a feather of
// near-invisible pixels along a hard cut edge, and a low threshold anchors
// that invisible fringe to the border — which reads as a thin gap against a
// dark photo. Requiring solidly visible pixels puts the character's real
// silhouette on the edge and simply discards the fringe.
const COMPANION_ALPHA_MIN = 96;

// ── Booth styles ────────────────────────────────────────────────────────────
// The CHOSEN overlay layer, cycled via the STYLE chip drawn on the mirror —
// visible live before the snap, unlike photobombs, which stay random and
// capture-only (the demon is not a menu item). Each style is a full-print-size
// transparent webp (512×446) drawn 1:1 over the video, before the stylize
// pass, so it grades into the photograph. Adding a style = one line here plus
// the webp in /public/booth/styles/. A missing file shows its label but draws
// nothing, so styles can be wired before the art lands.
// Optional `fit` places a raw render instead of requiring pre-composed art:
// the image's OPAQUE bounds are scaled to `h` (fraction of print height,
// aspect preserved) and centered at (`cx`,`cy`) in print fractions. No `fit`
// = full-bleed 1:1 (for frames/borders authored at 512×446).
const BOOTH_STYLES = [
  { id: "plain", label: "PLAIN", url: null },
  { id: "hat", label: "HMPC HAT", url: "/booth/styles/hat.webp", fit: { h: 0.38, cx: 0.5, cy: 0.17 } },
  // `bg` = full scene rendered BEHIND the segmented sitter (author it as a
  // complete opaque 512×446 scene — no cutout window needed). A style may
  // carry both `bg` and `url` (overlay on top).
  { id: "synthwave", label: "SYNTHWAVE", bg: "/booth/styles/synthwave.webp" },
  // Full kit: segmented sitter in front of the sunset, cap on top.
  { id: "hat_synthwave", label: "HAT + SYNTHWAVE", bg: "/booth/styles/synthwave.webp", url: "/booth/styles/hat.webp", fit: { h: 0.38, cx: 0.5, cy: 0.17 } },
];
const BOOTH_STYLE_KEY = "hm_booth_style";
// STYLE chip: canvas rect on the mirror, bottom-left above the footer bar.
// Clicks are routed by the screen quad's UV, so this rect IS the hit target —
// computed from the label so draw and hit-test always agree, whatever the
// longest style name grows to. (10.3 ≈ advance width of 17px monospace.)
function boothChipRect(label) {
  return { x: 12, y: BOOTH_H - 78, w: 24 + Math.round((label.length + 8) * 10.3), h: 32 };
}

// ── Booth capture modes ─────────────────────────────────────────────────────
// POLAROID = the single print. STRIP = four shots in sequence, composited
// into the classic vertical booth strip. Cycled by the MODE chip
// (bottom-right of the mirror, mirroring the STYLE chip's mechanics).
const BOOTH_MODES = ["POLAROID", "STRIP"];
const BOOTH_MODE_KEY = "hm_booth_mode";
const BOOTH_STRIP_SHOTS = 4;
const BOOTH_STRIP_COUNT = 2;      // seconds of countdown for shots 2..N
const BOOTH_INTERLUDE_TIME = 1.4; // beat between shots — reposition time
function boothModeChipRect(label) {
  const w = 24 + Math.round((label.length + 7) * 10.3); // "MODE ▸ " = 7 chars
  return { x: BOOTH_W - 12 - w, y: BOOTH_H - 78, w, h: 32 };
}
function boothModeChip(ctx, label) {
  const c = boothModeChipRect(label);
  ctx.fillStyle = "rgba(10,8,6,0.72)";
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = "rgba(255,217,160,0.65)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(c.x, c.y, c.w, c.h);
  ctx.font = "700 17px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = BOOTH_AMBER;
  ctx.fillText("MODE ▸ " + label, c.x + 10, c.y + c.h / 2 + 1);
}

// The physical print that EJECTS from the slot under the cabin screen —
// nothing auto-pops any more: the machine hands you the print in-world, and
// clicking it opens the share overlay. Sizes in strip-local units; the eject
// slides out over BOOTH_EJECT_TIME with a paper flutter that settles.
const BOOTH_EJECT_TIME = 1.6;
// Fallback print widths for exports that predate the Booth_PrintSlot mesh —
// when the slot exists, prints are sized to its mouth instead.
const BOOTH_PRINT_WIDTH = { strip: 0.26, square: 0.3 };
// How far the print feeds out before it rests, per format. With the
// bottom-first feed the UNEMERGED part is the image's TOP, so these run
// nearly full: what stays gripped in the slit is just the top paper margin —
// every frame (and the whole polaroid photo) ends up visible.
// Clicking the hanging print opens the full view.
const BOOTH_EJECT_EXTENT = { strip: 0.97, square: 0.97 };
// Print width as a fraction of the slot's slit width, per format.
const BOOTH_PRINT_SLIT_FACTOR = { strip: 0.55, square: 0.8 };
// Paper curl: the emerged paper runs straight for BOOTH_CURL_FLAT of its
// length, then bends toward the viewer on this radius (strip-local units) —
// receipt physics, and it lifts the strip's tail so nothing scrapes the wall.
const BOOTH_CURL_RADIUS = 0.45;
const BOOTH_CURL_FLAT = 0.45;
// Pitch of the whole feed path away from the wall, radians — the print juts
// diagonally out of the slit toward the viewer (dispenser-ticket style)
// instead of dropping flat down the wall. 0 = the old straight-down hang.
const BOOTH_EJECT_PITCH = 0.6;

// The little physical polaroid: the print's centre square on white stock with
// the classic chin. (The DOM overlay still shows the full captioned card —
// this is just the object the machine spits out.)
function composeMiniPolaroid(snap) {
  const M = 14, F = 336, CHIN = 64;
  const W = F + M * 2, H = M + F + CHIN;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#f7f4ec";
  x.fillRect(0, 0, W, H);
  const S = Math.min(snap.width, snap.height);
  x.drawImage(snap, (snap.width - S) / 2, 0, S, S, M, M, F, F);
  return c;
}

// The classic strip: each shot center-cropped to the same square the polaroid
// keeps, stacked with gutters on warm paper, HMPC branding + date at the foot.
function composeBoothStrip(shots) {
  const F = BOOTH_H;                 // square frame edge
  const M = 20, G = 12, FOOT = 64;
  const W = F + M * 2;
  const H = M + shots.length * F + (shots.length - 1) * G + FOOT;
  const cnv = document.createElement("canvas");
  cnv.width = W;
  cnv.height = H;
  const x = cnv.getContext("2d");
  x.fillStyle = "#f2ecdf";
  x.fillRect(0, 0, W, H);
  const sx = (BOOTH_W - F) / 2;
  shots.forEach((s, i) => {
    x.drawImage(s, sx, 0, F, F, M, M + i * (F + G), F, F);
  });
  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}.'${String(now.getFullYear() % 100).padStart(2, "0")}`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = "700 22px ui-monospace, Menlo, monospace";
  x.fillStyle = "#6b5b47";
  x.fillText("HMPC PHOTOMATIC", W / 2, H - FOOT / 2 - 10);
  x.font = "500 16px ui-monospace, Menlo, monospace";
  x.fillStyle = "rgba(107,91,71,0.8)";
  x.fillText(stamp, W / 2, H - FOOT / 2 + 14);
  return cnv;
}

function drawBoothStyleOverlay(ctx, w, h, style) {
  if (!style?.url) return;
  const img = boothCompanionImage(style.url);
  if (!img.complete || !img.naturalWidth) return;
  const fit = style.fit;
  if (!fit) {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }
  const bb = companionOpaqueBox(img);
  const dh = h * (fit.h ?? 0.4);
  const dw = dh * (bb.w / bb.h);
  const dx = w * (fit.cx ?? 0.5) - dw / 2;
  const dy = h * (fit.cy ?? 0.2) - dh / 2;
  ctx.drawImage(img, bb.x, bb.y, bb.w, bb.h, dx, dy, dw, dh);
}

function boothStyleChip(ctx, label) {
  const c = boothChipRect(label);
  ctx.fillStyle = "rgba(10,8,6,0.72)";
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = "rgba(255,217,160,0.65)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(c.x, c.y, c.w, c.h);
  ctx.font = "700 17px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = BOOTH_AMBER;
  ctx.fillText("STYLE ▸ " + label, c.x + 10, c.y + c.h / 2 + 1);
}

// ── Booth backdrop segmentation ─────────────────────────────────────────────
// A style with `bg` puts a full scene BEHIND the sitter, which needs to know
// which pixels are the person: MediaPipe selfie segmentation, self-hosted
// (public/mediapipe — wasm + 250KB model), lazy-loaded only when the booth is
// entered and only if some style declares a bg. Everything degrades: while the
// segmenter loads (or if it fails), a bg style just shows the plain mirror.
let _segmenter = null;
let _segmenterState = "idle"; // idle | loading | ready | failed
async function ensureBoothSegmenter() {
  if (_segmenterState !== "idle") return;
  _segmenterState = "loading";
  try {
    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    _segmenter = await ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/mediapipe/selfie_segmenter.tflite", delegate: "GPU" },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
    _segmenterState = "ready";
  } catch (e) {
    console.warn("[booth] segmenter unavailable — backdrop styles will show the plain mirror:", e);
    _segmenterState = "failed";
  }
}

// Flip this if the composite comes out inverted (backdrop covering the PERSON
// while the room survives) — the mask's polarity is model-defined. (true is
// CORRECT for this model — Michelle verified the category mask ran inverted.)
const BOOTH_MASK_INVERT = false;
// The cutout knobs. THRESHOLD is how sure the model must be that a pixel is
// you before it survives — RAISE it to trim the dark halo the model hedges
// around hair, LOWER it if it starts eating hairline/shoulders. SOFTNESS is
// the width of the semi-transparent band at the silhouette edge.
const BOOTH_MASK_THRESHOLD = 0.5;
const BOOTH_MASK_SOFTNESS = 0.2;
// Per-frame confidence jitter makes the silhouette boundary crawl; each new
// mask is blended into a running average at this weight before thresholding.
// Lower = steadier edge but more ghosting on fast movement; 1 = off.
const BOOTH_MASK_SMOOTHING = 0.35;

// Backdrop scene (unmirrored) + segmented sitter (mirrored) onto ctx. Runs a
// fresh segmentation per call, so the capture gets the exact snap-moment mask.
// Returns true when something was drawn (even the graceful unmasked fallback).
function drawBoothBackdropFrame(st, ctx, w, h, bgImg) {
  const video = st.video;
  if (!video?.videoWidth) return false;
  let masked = false;
  if (_segmenterState === "ready" && _segmenter) {
    try {
      const res = _segmenter.segmentForVideo(video, performance.now());
      const mask = res.confidenceMasks[0];
      const mw = mask.width, mh = mask.height;
      const arr = mask.getAsFloat32Array();
      if (!st.maskCanvas) {
        st.maskCanvas = document.createElement("canvas");
        st.maskCtx = st.maskCanvas.getContext("2d");
        st.personCanvas = document.createElement("canvas");
        st.personCanvas.width = w;
        st.personCanvas.height = h;
        st.personCtx = st.personCanvas.getContext("2d");
      }
      if (st.maskCanvas.width !== mw || st.maskCanvas.height !== mh) {
        st.maskCanvas.width = mw;
        st.maskCanvas.height = mh;
        st.maskData = null;
      }
      if (!st.maskData) st.maskData = st.maskCtx.createImageData(mw, mh);
      const md = st.maskData.data;
      if (!st.maskSmooth || st.maskSmooth.length !== arr.length) {
        st.maskSmooth = new Float32Array(arr.length);
        st.maskSmoothInit = false;
      }
      const sm = st.maskSmooth;
      for (let i = 0; i < arr.length; i++) {
        const conf = BOOTH_MASK_INVERT ? 1 - arr[i] : arr[i];
        sm[i] = st.maskSmoothInit ? sm[i] + (conf - sm[i]) * BOOTH_MASK_SMOOTHING : conf;
        const a = (sm[i] - BOOTH_MASK_THRESHOLD) / BOOTH_MASK_SOFTNESS;
        md[i * 4 + 3] = a <= 0 ? 0 : a >= 1 ? 255 : (a * 255) | 0;
      }
      st.maskSmoothInit = true;
      st.maskCtx.putImageData(st.maskData, 0, 0);
      mask.close();
      // person = mirrored video ∩ mirrored mask (identical cover transforms,
      // so the mask lands exactly on the pixels it was computed from)
      const p = st.personCtx;
      p.clearRect(0, 0, w, h);
      drawCoverMirrored(p, video, video.videoWidth, video.videoHeight, w, h);
      p.globalCompositeOperation = "destination-in";
      p.filter = "blur(2px)"; // soften the binary mask edge
      drawCoverMirrored(p, st.maskCanvas, mw, mh, w, h);
      p.filter = "none";
      p.globalCompositeOperation = "source-over";
      masked = true;
    } catch (e) {
      // fall through to the unmasked mirror
    }
  }
  const bs = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
  ctx.drawImage(
    bgImg,
    (w - bgImg.naturalWidth * bs) / 2,
    (h - bgImg.naturalHeight * bs) / 2,
    bgImg.naturalWidth * bs,
    bgImg.naturalHeight * bs
  );
  if (masked) ctx.drawImage(st.personCanvas, 0, 0);
  else drawVideoCover(ctx, video, w, h);
  return true;
}

// The booth screen's NO SIGNAL hints are diegetic but small; this event lets
// the page pop a readable DOM instruction card for the same cause (and clear
// it when the camera comes up or the player leaves). Same window-event idiom
// as vendor-mood.
function announceBoothCamError(code) {
  try {
    window.dispatchEvent(new CustomEvent("booth-camera-error", { detail: code ? { code } : null }));
  } catch (e) {}
}
function companionOpaqueBox(img) {
  if (img.__bbox) return img.__bbox;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let yy = 0; yy < c.height; yy++) {
    for (let xx = 0; xx < c.width; xx++) {
      if (d[(yy * c.width + xx) * 4 + 3] > 8) {
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
        if (yy < minY) minY = yy;
        if (yy > maxY) maxY = yy;
      }
    }
  }
  img.__bbox = maxX < 0
    ? { x: 0, y: 0, w: c.width, h: c.height }
    : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  return img.__bbox;
}

function pickBoothPhotobomb() {
  let forced = null;
  try { forced = new URLSearchParams(window.location.search).get("boothbomb"); } catch (e) {}
  if (forced) return BOOTH_COMPANIONS.find((c) => c.url.includes(forced)) || null;
  for (const c of BOOTH_COMPANIONS) {
    if (Math.random() < c.chance) return c;
  }
  return null;
}
function drawBoothPhotobomb(ctx, w, h, pick = pickBoothPhotobomb()) {
  if (!pick) return;
  const img = boothCompanionImage(pick.url);
  // Not loaded yet (or missing on disk): quietly no photobomb this snap.
  if (!img.complete || !img.naturalWidth) return;
  const bb = companionOpaqueBox(img);
  const dh = h * (pick.height ?? 0.95);
  const dw = dh * (bb.w / bb.h);
  // Bottom-anchored, cut edge overdrawn 1px past the border so no seam shows.
  // (The shareable polaroid center-crops ~33px off each side, trimming that
  // much of an edge-entering companion — they stay flush there too, just a
  // step less deep into frame, which an off-frame leaner reads as anyway.)
  const y = h - dh;
  const x = pick.side === "right" ? w - dw + 1 : -1;
  ctx.drawImage(img, bb.x, bb.y, bb.w, bb.h, x, y, dw, dh);
}

// Material-name lookup (exact — material names are not sanitized on import).
function findMaterialMesh(root, matName) {
  if (!root) return null;
  let hit = null;
  root.traverse((o) => {
    if (hit || !o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m?.name === matName)) hit = o;
  });
  return hit;
}

// Outward world normal of a mesh's first triangle. The screen primitives hold
// ONLY the screen quad, so the first tri IS the screen face; glTF fronts are
// CCW, so the winding cross-product points out of the glass.
function firstTriWorldNormal(mesh, out) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const ix = (i) => (geo.index ? geo.index.getX(i) : i);
  const a = new THREE.Vector3().fromBufferAttribute(pos, ix(0));
  const b = new THREE.Vector3().fromBufferAttribute(pos, ix(1));
  const c = new THREE.Vector3().fromBufferAttribute(pos, ix(2));
  b.sub(a); c.sub(a);
  out.crossVectors(b, c);
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  return out.applyMatrix3(nm).normalize();
}

// Fill the canvas with the video, cover-cropped and mirrored (the preview is a
// mirror, and the print keeps what the preview showed — WYSIWYG beats the
// "real photo booths print un-mirrored" trivia).
function drawCoverMirrored(ctx, src, sw, sh, w, h) {
  if (!sw || !sh) return false;
  const s = Math.max(w / sw, h / sh);
  const dw = sw * s, dh = sh * s;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}
function drawVideoCover(ctx, video, w, h) {
  return drawCoverMirrored(ctx, video, video?.videoWidth, video?.videoHeight, w, h);
}

// The print treatment. A raw webcam frame is a photographic hole punched in a
// low-poly world; posterizing to a few levels per channel pulls it toward the
// flat-shaded look, the warm lift + vignette age it into the noir-manila
// palette, and grain keeps the quantized bands from reading as banding.
// One-time cost at capture (~230k px), never per-frame.
function stylizeBoothPhoto(ctx, w, h, opts = {}) {
  const { stamp = true } = opts;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // 8 levels reads as "graded film" where 6 read as "screen print" — still
  // stylized, but faces keep more of their modelling.
  const LEVELS = 8;
  const step = 255 / (LEVELS - 1);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * 1.07 + 10;
    let g = d[i + 1] * 1.0 + 5;
    let b = d[i + 2] * 0.9;
    r = Math.round(r / step) * step;
    g = Math.round(g / step) * step;
    b = Math.round(b / step) * step;
    const n = (Math.random() - 0.5) * 11;
    d[i] = Math.max(0, Math.min(255, r + n));
    d[i + 1] = Math.max(0, Math.min(255, g + n));
    d[i + 2] = Math.max(0, Math.min(255, b + n));
  }
  ctx.putImageData(img, 0, 0);
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.85);
  v.addColorStop(0, "rgba(20,10,4,0)");
  v.addColorStop(1, "rgba(20,10,4,0.38)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  // film-back datestamp — the real date, burned into the print. Strip frames
  // skip it (the strip stamps its footer once instead of four times).
  if (stamp) {
    const now = new Date();
    const ds = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}.'${String(now.getFullYear() % 100).padStart(2, "0")}`;
    ctx.font = "600 24px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(120,40,0,0.8)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = "rgba(255,150,60,0.9)";
    // Inset past the (w - h)/2 side trim of PolaroidSnapshot's square
    // center-crop, or the stamp's tail gets cropped off the shareable print.
    const cropInset = Math.max(0, (w - Math.min(w, h)) / 2);
    ctx.fillText(ds, w - cropInset - 18, h - 16);
    ctx.shadowBlur = 0;
  }
}

function boothScanlines(ctx, w, h) {
  ctx.fillStyle = "rgba(6,4,2,0.13)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
}

function boothChrome(ctx, w, h, t, footer) {
  ctx.fillStyle = "rgba(10,8,6,0.55)";
  ctx.fillRect(0, 0, w, 36);
  ctx.font = "700 20px ui-monospace, Menlo, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = BOOTH_AMBER;
  ctx.fillText("PHOTOMATIC", 14, 19);
  // live tally: red dot breathing, not blinking hard
  ctx.fillStyle = `rgba(255,70,50,${0.55 + 0.45 * Math.sin(t * 4)})`;
  ctx.beginPath();
  ctx.arc(w - 58, 18, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BOOTH_AMBER;
  ctx.textAlign = "right";
  ctx.fillText("LIVE", w - 14, 19);
  if (footer) {
    ctx.fillStyle = "rgba(10,8,6,0.55)";
    ctx.fillRect(0, h - 40, w, 40);
    ctx.font = "700 22px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255,217,160,${0.55 + 0.45 * Math.sin(t * 2.6)})`;
    ctx.fillText(footer, w / 2, h - 19);
  }
}

function boothMessageScreen(ctx, w, h, t, title, lines) {
  ctx.fillStyle = "#0c0906";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 44px ui-monospace, Menlo, monospace";
  ctx.fillStyle = `rgba(255,217,160,${0.7 + 0.3 * Math.sin(t * 2.2)})`;
  ctx.fillText(title, w / 2, h * 0.42);
  ctx.fillStyle = "rgba(255,217,160,0.75)";
  // Per-line auto-shrink: a line wider than the screen scales its font down
  // (floored for legibility) instead of running off the glass.
  const maxLineW = w - 36;
  lines.forEach((ln, i) => {
    let size = 20;
    ctx.font = `500 ${size}px ui-monospace, Menlo, monospace`;
    const tw = ctx.measureText(ln).width;
    if (tw > maxLineW) {
      size = Math.max(13, Math.floor((size * maxLineW) / tw));
      ctx.font = `500 ${size}px ui-monospace, Menlo, monospace`;
    }
    ctx.fillText(ln, w / 2, h * 0.58 + i * 30);
  });
  boothScanlines(ctx, w, h);
}

const _boothNormal = /* @__PURE__ */ new THREE.Vector3();

function PhotoBoothRig({ boothScene, stripScale, focus, onVendorClick, onFocusObject, onZoomOut, onFocusChange, onBoothPhoto, boothClickRef }) {
  const screens = useMemo(() => ({
    cabin: findMaterialMesh(boothScene, BOOTH_SCREEN_CABIN),
    inner: findMaterialMesh(boothScene, BOOTH_SCREEN_INNER),
    outer: findMaterialMesh(boothScene, BOOTH_SCREEN_OUTER),
  }), [boothScene]);
  // The screen the occupant faces: the cabin viewfinder, or the legacy framed
  // screen until the re-export lands. Everything keys off this one mesh.
  const viewfinder = screens.cabin || screens.outer;
  const viewfinderKey = screens.cabin ? "cabin" : "outer";

  // Strip-local geometry for the click proxy and flash lamp — via the same
  // world-box ÷ root-matrix idiom as BulbRig, so it holds whether the booth
  // arrives in its own GLB or inside a future strip export.
  const [frame, setFrame] = useState(null);
  useEffect(() => {
    if (!viewfinder) return;
    // The click proxy must span the whole BOOTH, not just the screen assembly
    // (which is its own object now) — find the shell by node name, falling
    // back to the screen's parent for exports that keep them merged.
    const root = findByBaseName(boothScene, "Photo_booth_Cube.031") || viewfinder.parent || boothScene;
    boothScene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(boothScene.matrixWorld).invert();
    const box = new THREE.Box3().setFromObject(root).applyMatrix4(inv);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).multiplyScalar(1.15);
    // Cabin interior point (booth-box centre at screen height): the occupancy
    // lamp and the flash both live here, so the flash floods the pocket and
    // spills out the open top for anyone watching from the boardwalk.
    const sBox = new THREE.Box3().setFromObject(viewfinder).applyMatrix4(inv);
    const sCenter = sBox.getCenter(new THREE.Vector3());
    const cabin = box.getCenter(new THREE.Vector3()).setY(sCenter.y);
    // Print slot: the authored Booth_PrintSlot mesh when the export carries
    // it — prints emerge through its mouth, sized to fit it. Falls back to a
    // computed point under the screen for older exports. Faces the same way
    // the screen does (same wall).
    const mV = new THREE.Matrix4().copy(inv).multiply(viewfinder.matrixWorld);
    const nL = firstTriWorldNormal({ geometry: viewfinder.geometry, matrixWorld: mV }, new THREE.Vector3());
    nL.setY(0).normalize();
    let slotPos, printW = null;
    const slotMesh = findByBaseName(boothScene, "Booth_PrintSlot");
    if (slotMesh) {
      const kBox = new THREE.Box3().setFromObject(slotMesh).applyMatrix4(inv);
      const kC = kBox.getCenter(new THREE.Vector3());
      const kS = kBox.getSize(new THREE.Vector3());
      // proud of the slot's bezel along the wall normal so the paper never
      // z-fights the housing
      const proud = (Math.abs(kS.x * nL.x) + Math.abs(kS.y * nL.y) + Math.abs(kS.z * nL.z)) / 2 + 0.02;
      slotPos = kC.clone().addScaledVector(nL, proud);
      slotPos.y = kC.y - 0.01;
      // slit width = the horizontal extent perpendicular to the wall normal
      printW = Math.abs(nL.z) > Math.abs(nL.x) ? kS.x : kS.z;
    } else {
      slotPos = new THREE.Vector3(sCenter.x, sBox.min.y - 0.06, sCenter.z).addScaledVector(nL, 0.05);
    }
    const slotQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nL);
    setFrame({
      center: center.toArray(), size: size.toArray(), cabin: cabin.toArray(),
      slotPos: slotPos.toArray(), slotQuat: slotQuat.toArray(), printW,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothScene, screens]);

  // Everything transient lives in one ref: canvas pipeline, webcam handles,
  // and the state machine ("idle" | "boot" | "denied" | "preview" |
  // "countdown" | "flash" | "develop" | "photo"). No React state — the whole
  // exchange is drawn in useFrame, and re-renders would buy nothing.
  const rig = useRef(null);
  const zoomedRef = useRef(false);
  const flashRef = useRef(null);
  const cabinRef = useRef(null);
  // The physical print hanging from the slot: { tex, w, h, format }. Its
  // slide-out is animated in useFrame; clicking it opens the share overlay.
  const [ejected, setEjected] = useState(null);
  const printRef = useRef(null);
  const ejectStartRef = useRef(0);
  useEffect(() => () => { try { ejected?.tex.dispose(); } catch (e) {} }, [ejected]);

  const ensureRig = () => {
    if (rig.current) return rig.current;
    const canvas = document.createElement("canvas");
    canvas.width = BOOTH_W;
    canvas.height = BOOTH_H;
    const snap = document.createElement("canvas");
    snap.width = BOOTH_W;
    snap.height = BOOTH_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    rig.current = {
      canvas, ctx: canvas.getContext("2d"),
      snap, snapCtx: snap.getContext("2d"),
      texture, material,
      applied: { cabin: null, inner: null, outer: null },
      video: null, stream: null, starting: false,
      state: "idle", t: 0, hasSnap: false, photoDrawn: false, camError: null,
      shutter: null, snapUrl: null, idleTimer: null,
      styleIdx: 0, modeIdx: 0,
      shots: null, bombPick: null, bombFrame: -1,
      countLen: BOOTH_COUNT_SECONDS, pendingShare: null, printCanvas: null,
    };
    // Same shutter the page's screenshot Polaroid uses, fired at the FLASH —
    // the polaroid overlay pops seconds later and stays silent (its trigger
    // path skips the sound when handed an imageSource).
    try {
      const a = new Audio("/audio/cameraShutter.mp3");
      a.preload = "auto";
      a.load();
      rig.current.shutter = a;
    } catch (e) {}
    // Last chosen style + mode survive across visits.
    try {
      const saved = BOOTH_STYLES.findIndex((s) => s.id === localStorage.getItem(BOOTH_STYLE_KEY));
      rig.current.styleIdx = Math.max(0, saved);
      rig.current.modeIdx = Math.max(0, BOOTH_MODES.indexOf(localStorage.getItem(BOOTH_MODE_KEY)));
    } catch (e) {}
    return rig.current;
  };

  const applyScreen = (st, which) => {
    const mesh = screens[which];
    if (mesh && !st.applied[which]) {
      st.applied[which] = mesh.material;
      mesh.material = st.material;
    }
  };
  const restoreScreen = (st, which) => {
    const mesh = screens[which];
    if (mesh && st.applied[which]) {
      mesh.material = st.applied[which];
      st.applied[which] = null;
    }
  };

  const stopCam = (st) => {
    st.stream?.getTracks().forEach((tr) => tr.stop());
    st.stream = null;
    st.video = null;
  };

  const startCam = () => {
    const st = rig.current;
    if (!st || st.stream || st.starting) return;
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
    if (!md?.getUserMedia) {
      // Browsers strip the camera API off insecure origins entirely — a LAN
      // IP over plain http lands here with no prompt ever shown.
      st.camError = "insecure";
      st.state = "denied";
      st.t = 0;
      announceBoothCamError(st.camError);
      return;
    }
    st.starting = true;
    md.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        const cur = rig.current;
        // The player may have left the booth (or the component unmounted)
        // while the permission prompt sat open — a granted stream then MUST be
        // stopped, or the camera-in-use light stays on with nothing drawing it.
        if (!cur || cur !== st || !zoomedRef.current) {
          stream.getTracks().forEach((tr) => tr.stop());
          if (cur === st) st.starting = false;
          return;
        }
        const video = document.createElement("video");
        video.muted = true;
        video.setAttribute("playsinline", "");
        video.srcObject = stream;
        const go = () => {
          st.stream = stream;
          st.video = video;
          st.starting = false;
          if (st.state === "boot") { st.state = "preview"; st.t = 0; }
          announceBoothCamError(null);
        };
        // The booth click was the user gesture, so play() resolving is the
        // normal path — but treat a rejection as ready anyway and let
        // drawVideoCover gate on videoWidth.
        video.play().then(go).catch(go);
      })
      .catch((err) => {
        if (rig.current !== st) return;
        st.starting = false;
        if (zoomedRef.current) {
          st.camError =
            err?.name === "NotAllowedError" && /system/i.test(err?.message || "")
              ? "SystemDenied"
              : (err?.name || "unknown");
          st.state = "denied";
          st.t = 0;
          announceBoothCamError(st.camError);
        }
      });
  };

  // Leaving the booth, by any road: camera off, extra screens back to black.
  // The VIEWFINDER keeps the print when one exists — your last photo hangs in
  // the cabin, waiting for whoever pushes through the curtain next.
  const endSession = () => {
    const st = rig.current;
    if (!st) return;
    stopCam(st);
    announceBoothCamError(null);
    restoreScreen(st, "inner");
    restoreScreen(st, viewfinderKey === "cabin" ? "outer" : "cabin");
    clearTimeout(st.idleTimer);
    if (st.hasSnap) {
      // Power the screen down as the player leaves. Swapping the live mirror
      // straight to the stored print HERE flashes it in their face during the
      // exit flight — go dark now, hang the print quietly once the camera is
      // long gone. It's there for the next peek through the curtain.
      st.ctx.fillStyle = "#0c0906";
      st.ctx.fillRect(0, 0, BOOTH_W, BOOTH_H);
      st.texture.needsUpdate = true;
      st.idleTimer = setTimeout(() => {
        if (rig.current !== st || st.state !== "idle" || !st.hasSnap) return;
        st.ctx.drawImage(st.snap, 0, 0);
        st.texture.needsUpdate = true;
      }, 2000);
    } else {
      restoreScreen(st, viewfinderKey);
    }
    st.state = "idle";
    st.photoDrawn = false;
    // Abandoned mid-sequence state must not leak into the next visit, and
    // the hanging print goes back into the machine.
    st.shots = null;
    st.pendingShare = null;
    st.printCanvas = null;
    st.countLen = BOOTH_COUNT_SECONDS;
    setEjected(null);
    // Next session starts its mask average fresh — a stale silhouette from
    // the previous sitter would ghost over the first frames.
    st.maskSmoothInit = false;
  };

  // One styled frame of the current mirror, rendered to a fresh canvas.
  // `bomb`: false = never, true = roll the odds, or a specific companion pick
  // (the strip pre-rolls once and lands its bomb on one chosen frame).
  const captureShot = (st, { bomb, stamp }) => {
    const cnv = document.createElement("canvas");
    cnv.width = BOOTH_W;
    cnv.height = BOOTH_H;
    const c = cnv.getContext("2d");
    c.filter = "saturate(82%) contrast(110%) brightness(104%)";
    c.fillStyle = "#0d0b09";
    c.fillRect(0, 0, BOOTH_W, BOOTH_H);
    {
      const style = BOOTH_STYLES[st.styleIdx];
      const bgImg = style?.bg ? boothCompanionImage(style.bg) : null;
      if (bgImg && bgImg.complete && bgImg.naturalWidth) {
        drawBoothBackdropFrame(st, c, BOOTH_W, BOOTH_H, bgImg);
      } else {
        drawVideoCover(c, st.video, BOOTH_W, BOOTH_H);
      }
    }
    c.filter = "none";
    drawBoothStyleOverlay(c, BOOTH_W, BOOTH_H, BOOTH_STYLES[st.styleIdx]);
    if (bomb) {
      try { drawBoothPhotobomb(c, BOOTH_W, BOOTH_H, bomb === true ? undefined : bomb); } catch (e) { console.warn("[booth] photobomb draw failed:", e); }
    }
    try { boothCompanionDraw?.(c, BOOTH_W, BOOTH_H); } catch (e) {}
    stylizeBoothPhoto(c, BOOTH_W, BOOTH_H, { stamp });
    return cnv;
  };

  // Mirror a shot onto the booth screen canvas and persist it as the idle
  // print (a strip session keeps its LAST frame as the in-world print).
  const adoptShot = (st, cnv) => {
    st.snapCtx.drawImage(cnv, 0, 0);
    st.hasSnap = true;
    st.snapUrl = st.snap.toDataURL("image/jpeg", 0.85);
    try { localStorage.setItem(BOOTH_PHOTO_KEY, st.snapUrl); } catch (e) {}
  };

  // Single-shot POLAROID capture.
  const capture = (st) => {
    adoptShot(st, captureShot(st, { bomb: true, stamp: true }));
    st.pendingShare = { url: st.snapUrl, format: "square" };
  };

  // The full booth-entry flow (fly inside, boot the cam, dress the screens) —
  // shared by the click below and the walker's curtain trigger (the
  // "hm-booth-enter" window event, dispatched when the cowboy steps through
  // Photo_booth_Curtain on foot).
  const enterBooth = () => {
    const st = ensureRig();
    if (zoomedRef.current) return;
    {
      zoomedRef.current = true;
      onVendorClick?.("photobooth");
      // Fly INSIDE: through the curtain to face the cabin viewfinder. Its
      // outward normal points into the pocket, so following it parks the
      // camera surrounded by the booth's own walls, mirror ahead. Computed
      // live off the mesh so a re-export that moves the booth moves the shot.
      const screenMesh = viewfinder;
      if (screenMesh && onFocusObject) {
        screenMesh.updateWorldMatrix(true, false);
        const center = new THREE.Box3().setFromObject(screenMesh).getCenter(new THREE.Vector3());
        const normal = firstTriWorldNormal(screenMesh, _boothNormal).clone();
        onFocusObject(center, normal, BOOTH_INSIDE_DIST_LOCAL * stripScale, BOOTH_INSIDE_MIN_DIST);
      }
      onFocusChange?.({ id: "photobooth", object: viewfinder || screens.inner });
      st.state = st.stream ? "preview" : "boot";
      st.t = 0;
      st.photoDrawn = false;
      clearTimeout(st.idleTimer);
      applyScreen(st, "cabin");
      applyScreen(st, "inner");
      applyScreen(st, "outer");
      // Kick the photobomb + style renders loading now so they're decoded
      // well before a capture needs them (a miss just means they sit out).
      BOOTH_COMPANIONS.forEach((cmp) => boothCompanionImage(cmp.url));
      BOOTH_STYLES.forEach((s) => {
        if (s.url) boothCompanionImage(s.url);
        if (s.bg) boothCompanionImage(s.bg);
      });
      // ...and the segmentation runtime, only because a bg style exists.
      if (BOOTH_STYLES.some((s) => s.bg)) ensureBoothSegmenter();
      st.ctx.fillStyle = "#0c0906";
      st.ctx.fillRect(0, 0, BOOTH_W, BOOTH_H);
      st.texture.needsUpdate = true;
      startCam();
    }
  };
  const enterBoothRef = useRef();
  enterBoothRef.current = enterBooth;
  useEffect(() => {
    const onEnter = () => enterBoothRef.current?.();
    window.addEventListener("hm-booth-enter", onEnter);
    return () => window.removeEventListener("hm-booth-enter", onEnter);
  }, []);

  const handleClick = (e) => {
    e.stopPropagation();
    // Same drag guard as the deck: the booth is a wide target, and R3F only
    // suppresses post-drag clicks on the pointer-MISSED path.
    if (e.delta > STRIP_CLICK_DRAG_PX) return;
    if (!zoomedRef.current) { enterBooth(); return; }
    const st = ensureRig();
    if (st.state === "countdown" || st.state === "flash" || st.state === "develop" || st.state === "interlude") return;
    // The camera sequence belongs to the SCREEN: only a click that lands on
    // the viewfinder assembly (the screen quad or its frame) starts the
    // countdown — or, with a print showing, goes again for a retake. A click
    // anywhere else in the cabin means "I'm done": exit.
    let onScreen = false;
    {
      const assembly = viewfinder?.parent;
      let o = e.object;
      while (o) {
        if (o === viewfinder || (assembly && o === assembly)) { onScreen = true; break; }
        o = o.parent;
      }
    }
    if (onScreen && st.stream) {
      if (st.state === "preview") {
        // The STYLE chip is a region of the mirror itself: the intersection's
        // UV maps straight onto the canvas (glTF v runs top-down, matching
        // the flipY:false texture), so the chip rect doubles as its hit-box.
        // Only the glass quad has meaningful UVs — frame clicks always snap.
        if (e.object === viewfinder && e.uv) {
          const cx = e.uv.x * BOOTH_W;
          const cy = e.uv.y * BOOTH_H;
          const chip = boothChipRect(BOOTH_STYLES[st.styleIdx].label);
          if (cx >= chip.x && cx <= chip.x + chip.w && cy >= chip.y && cy <= chip.y + chip.h) {
            st.styleIdx = (st.styleIdx + 1) % BOOTH_STYLES.length;
            try { localStorage.setItem(BOOTH_STYLE_KEY, BOOTH_STYLES[st.styleIdx].id); } catch (err) {}
            return;
          }
          const mchip = boothModeChipRect(BOOTH_MODES[st.modeIdx]);
          if (cx >= mchip.x && cx <= mchip.x + mchip.w && cy >= mchip.y && cy <= mchip.y + mchip.h) {
            st.modeIdx = (st.modeIdx + 1) % BOOTH_MODES.length;
            try { localStorage.setItem(BOOTH_MODE_KEY, BOOTH_MODES[st.modeIdx]); } catch (err) {}
            return;
          }
        }
        st.countLen = BOOTH_COUNT_SECONDS;
        // A fresh session swallows the previous print back into the machine.
        setEjected(null);
        st.pendingShare = null;
        if (BOOTH_MODES[st.modeIdx] === "STRIP") {
          // Pre-roll the photobomb ONCE for the whole strip and land it on a
          // random frame — the demon crashes exactly one pose of four.
          st.shots = [];
          st.bombPick = pickBoothPhotobomb();
          st.bombFrame = st.bombPick ? Math.floor(Math.random() * BOOTH_STRIP_SHOTS) : -1;
        } else {
          st.shots = null;
        }
        st.state = "countdown";
        st.t = 0;
        return;
      }
      if (st.state === "photo") { st.state = "preview"; st.t = 0; st.photoDrawn = false; return; }
    }
    // anywhere else (or "denied"/"boot" anywhere): leave
    zoomedRef.current = false;
    endSession();
    onFocusChange?.(null);
    onZoomOut?.();
  };

  // Registered with CommercialStrip so the deck's click handler can hand
  // in-booth clicks (which land on strip geometry — the cabin's own walls)
  // back to this state machine. No dep array: handleClick closes over fresh
  // props each render, so re-registering every commit keeps it current.
  useEffect(() => {
    if (!boothClickRef) return;
    boothClickRef.current = handleClick;
    return () => { boothClickRef.current = null; };
  });

  // Another stall taking the shared focus is also "leaving the booth" — the
  // webcam must not stay live while the player chats with the hot dog vendor.
  useEffect(() => {
    if (!zoomedRef.current) return;
    if (focus?.id === "photobooth") return;
    zoomedRef.current = false;
    endSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // A previous session's print hangs in the cabin on load.
  useEffect(() => {
    if (!viewfinder) return;
    let url = null;
    try { url = localStorage.getItem(BOOTH_PHOTO_KEY); } catch (e) {}
    if (!url) return;
    const st = ensureRig();
    const img = new Image();
    img.onload = () => {
      if (rig.current !== st) return;
      st.snapCtx.drawImage(img, 0, 0, BOOTH_W, BOOTH_H);
      st.hasSnap = true;
      if (st.state === "idle") {
        st.ctx.drawImage(st.snap, 0, 0);
        st.texture.needsUpdate = true;
        applyScreen(st, viewfinderKey);
      }
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens]);

  // The useGLTF scene is cached and shared across mounts: hand the screens
  // their original materials back and release the GPU objects on the way out.
  useEffect(() => () => {
    const st = rig.current;
    if (!st) return;
    stopCam(st);
    clearTimeout(st.idleTimer);
    restoreScreen(st, "cabin");
    restoreScreen(st, "inner");
    restoreScreen(st, "outer");
    try { st.texture.dispose(); } catch (e) {}
    try { st.material.dispose(); } catch (e) {}
    rig.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens]);

  useFrame((state, delta) => {
    const lamp = flashRef.current;
    if (lamp && lamp.intensity > 0.01) lamp.intensity *= Math.exp(-delta * 9);
    else if (lamp) lamp.intensity = 0;

    const st = rig.current;
    // Occupancy lamp eases on while the booth is in use, off when vacated.
    const cab = cabinRef.current;
    if (cab) {
      const want = st && st.state !== "idle" ? BOOTH_CABIN_LIGHT : 0;
      cab.intensity += (want - cab.intensity) * (1 - Math.exp(-6 * delta));
    }
    // Ejecting print: the paper feeds out of the slit (visible portion grows
    // via texture crop) and CURLS toward the viewer like a receipt — the
    // plane's rows are laid along a straight-then-arc curve each frame, with
    // a flutter that settles as it finishes.
    const pr = printRef.current;
    if (pr && ejected) {
      const e = Math.min(1, (state.clock.elapsedTime - ejectStartRef.current) / BOOTH_EJECT_TIME);
      const extent = BOOTH_EJECT_EXTENT[ejected.format] ?? 0.6;
      const k = Math.max(0.02, (1 - Math.pow(1 - e, 3)) * extent);
      const m = ejected.h * k;              // emerged paper length
      const flat = m * BOOTH_CURL_FLAT;     // straight drop before the curl
      const geo = pr.geometry;
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const s = (1 - uv.getY(i)) * m;     // distance along the paper from the slit
        if (s <= flat) {
          pos.setY(i, -s);
          pos.setZ(i, 0);
        } else {
          const a = (s - flat) / BOOTH_CURL_RADIUS;
          pos.setY(i, -(flat + BOOTH_CURL_RADIUS * Math.sin(a)));
          pos.setZ(i, BOOTH_CURL_RADIUS * (1 - Math.cos(a)));
        }
      }
      pos.needsUpdate = true;
      geo.computeBoundingSphere();          // keep the click raycast honest
      // Bottom-edge-first feed: the visible window is the image's BOTTOM k,
      // so content travels through the slit as the paper advances (offset 0),
      // and the print ends right-side-up. Pinning the TOP window instead
      // (offset 1-k) reads as the print unrolling from a fixed top edge.
      ejected.tex.repeat.set(1, k);
      ejected.tex.offset.set(0, 0);
      // negative about x tips the hang OUT of the wall toward the viewer
      pr.rotation.x = -BOOTH_EJECT_PITCH;
      pr.rotation.z = Math.sin(state.clock.elapsedTime * 5) * 0.05 * (1 - e);
    }
    if (!st || st.state === "idle") return;
    st.t += delta;
    const { ctx } = st;
    const t = st.t;
    switch (st.state) {
      case "boot":
        boothMessageScreen(ctx, BOOTH_W, BOOTH_H, t, "PHOTOMATIC", ["starting camera…", "allow the prompt if your browser asks"]);
        break;
      case "denied":
        boothMessageScreen(ctx, BOOTH_W, BOOTH_H, t, "NO SIGNAL", [
          ...(BOOTH_CAM_HINTS[st.camError] || BOOTH_CAM_HINTS.unknown),
          "click to exit",
        ]);
        break;
      case "preview":
      case "countdown": {
        const style = BOOTH_STYLES[st.styleIdx];
        const bgImg = style?.bg ? boothCompanionImage(style.bg) : null;
        const bgReady = !!(bgImg && bgImg.complete && bgImg.naturalWidth);
        const live = bgReady
          ? drawBoothBackdropFrame(st, ctx, BOOTH_W, BOOTH_H, bgImg)
          : drawVideoCover(ctx, st.video, BOOTH_W, BOOTH_H);
        if (!live) {
          boothMessageScreen(ctx, BOOTH_W, BOOTH_H, t, "PHOTOMATIC", ["starting camera…", "allow the prompt if your browser asks"]);
          break;
        }
        drawBoothStyleOverlay(ctx, BOOTH_W, BOOTH_H, style);
        boothScanlines(ctx, BOOTH_W, BOOTH_H);
        if (st.state === "preview") {
          boothChrome(ctx, BOOTH_W, BOOTH_H, t, "CLICK SCREEN TO SNAP");
          boothStyleChip(ctx, BOOTH_STYLES[st.styleIdx].label);
          boothModeChip(ctx, BOOTH_MODES[st.modeIdx]);
        } else {
          const remain = (st.countLen || BOOTH_COUNT_SECONDS) - t;
          if (remain <= 0) {
            if (st.shots) {
              const idx = st.shots.length;
              const cnv = captureShot(st, { bomb: idx === st.bombFrame ? st.bombPick : false, stamp: false });
              st.shots.push(cnv);
              adoptShot(st, cnv);
              if (st.shots.length >= BOOTH_STRIP_SHOTS) {
                const strip = composeBoothStrip(st.shots);
                st.pendingShare = { url: strip.toDataURL("image/jpeg", 0.85), format: "strip" };
                st.printCanvas = strip;
                st.shots = null;
              }
            } else {
              capture(st);
            }
            st.state = "flash";
            st.t = 0;
            if (lamp) lamp.intensity = BOOTH_FLASH_LIGHT;
            if (st.shutter) {
              try { st.shutter.currentTime = 0; st.shutter.play().catch(() => {}); } catch (e) {}
            }
            break;
          }
          boothChrome(ctx, BOOTH_W, BOOTH_H, t, st.shots ? `HOLD STILL — ${st.shots.length + 1} OF ${BOOTH_STRIP_SHOTS}` : "HOLD STILL");
          const n = String(Math.ceil(remain));
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "700 210px ui-monospace, Menlo, monospace";
          ctx.lineWidth = 10;
          ctx.strokeStyle = "rgba(12,9,6,0.75)";
          ctx.strokeText(n, BOOTH_W / 2, BOOTH_H / 2);
          ctx.fillStyle = "rgba(255,245,225,0.92)";
          ctx.fillText(n, BOOTH_W / 2, BOOTH_H / 2);
        }
        break;
      }
      case "flash":
        ctx.fillStyle = "#fffdf6";
        ctx.fillRect(0, 0, BOOTH_W, BOOTH_H);
        if (t >= BOOTH_FLASH_TIME) {
          if (st.shots && st.shots.length < BOOTH_STRIP_SHOTS) {
            st.state = "interlude";
          } else {
            st.state = "develop";
          }
          st.t = 0;
        }
        break;
      case "interlude":
        // The shot just taken lingers while the next pose is telegraphed.
        ctx.drawImage(st.snap, 0, 0);
        boothChrome(ctx, BOOTH_W, BOOTH_H, t, `NEXT: ${st.shots.length + 1} OF ${BOOTH_STRIP_SHOTS} — NEW POSE!`);
        if (t >= BOOTH_INTERLUDE_TIME) {
          st.state = "countdown";
          st.t = 0;
          st.countLen = BOOTH_STRIP_COUNT;
        }
        break;
      case "develop": {
        ctx.drawImage(st.snap, 0, 0);
        const k = Math.min(1, t / BOOTH_DEVELOP_TIME);
        ctx.fillStyle = `rgba(255,252,244,${(1 - k) ** 2})`;
        ctx.fillRect(0, 0, BOOTH_W, BOOTH_H);
        if (k >= 1) {
          st.state = "photo";
          // Print's done developing — the machine EJECTS it from the slot
          // under the screen. No auto-popup: clicking the hanging print is
          // what opens the share overlay (pendingShare sticks around so it
          // can be opened as many times as they like).
          if (st.pendingShare) {
            const printCanvas = st.pendingShare.format === "strip"
              ? st.printCanvas
              : composeMiniPolaroid(st.snap);
            if (printCanvas) {
              const tex = new THREE.CanvasTexture(printCanvas);
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.minFilter = THREE.LinearFilter;
              const w = frame?.printW
                ? frame.printW * (BOOTH_PRINT_SLIT_FACTOR[st.pendingShare.format] ?? 0.7)
                : (BOOTH_PRINT_WIDTH[st.pendingShare.format] ?? 0.3);
              setEjected({ tex, w, h: w * (printCanvas.height / printCanvas.width), format: st.pendingShare.format });
              ejectStartRef.current = state.clock.elapsedTime;
            }
            st.printCanvas = null;
          }
        }
        break;
      }
      case "photo":
        // static — draw once, then stop touching the texture
        if (st.photoDrawn) return;
        ctx.drawImage(st.snap, 0, 0);
        st.photoDrawn = true;
        break;
      default:
        break;
    }
    st.texture.needsUpdate = true;
  });

  return (
    <group
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {frame && (
        <mesh position={frame.center}>
          <boxGeometry args={frame.size} />
          {/* transparent, not visible={false} — invisible objects are skipped
              by the raycaster and would take no clicks at all */}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {frame && (
        <pointLight
          ref={flashRef}
          position={frame.cabin}
          intensity={0}
          distance={BOOTH_FLASH_DIST}
          decay={2}
          color="#fff6e8"
          castShadow={false}
        />
      )}
      {frame && (
        <pointLight
          ref={cabinRef}
          position={frame.cabin}
          intensity={0}
          distance={BOOTH_CABIN_LIGHT_DIST}
          decay={2}
          color="#ffd9a0"
          castShadow={false}
        />
      )}
      {frame && ejected && (
        <group position={frame.slotPos} quaternion={frame.slotQuat}>
          <mesh
            ref={printRef}
            onClick={(e) => {
              e.stopPropagation();
              if (e.delta > STRIP_CLICK_DRAG_PX) return;
              const sh = rig.current?.pendingShare;
              if (sh) onBoothPhoto?.(sh.url, sh.format);
            }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}
          >
            {/* height 1 is nominal — every row is repositioned along the
                feed/curl curve per frame; 24 segments keep the bend smooth */}
            <planeGeometry args={[ejected.w, 1, 1, 24]} />
            <meshBasicMaterial map={ejected.tex} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// The booth lives IN the strip GLB (CommercialStrip2 onward), so the rig just
// binds to the strip's own copy. If a re-export ever drops the booth, this
// renders nothing and the booth is visibly absent — fix at source, in Blender.
function PhotoBooth({ stripScene, ...props }) {
  // A viewfinder is what makes the booth functional: the cabin screen, or the
  // legacy framed screen until the strip re-export lands.
  const present = useMemo(
    () => !!(findMaterialMesh(stripScene, BOOTH_SCREEN_CABIN) || findMaterialMesh(stripScene, BOOTH_SCREEN_OUTER)),
    [stripScene]
  );
  if (!present) return null;
  return <PhotoBoothRig boothScene={stripScene} {...props} />;
}

const _spotAt = /* @__PURE__ */ new THREE.Vector3();
const _bulbAt = /* @__PURE__ */ new THREE.Vector3();

// Adopt the PointLights that arrived inside the GLB rather than making our own:
// they already sit at the right place under each wagon, already carry the
// authored intensity, and move automatically if the wagons move in Blender.
function WagonLights({ stripScene, envPreset }) {
  const gain = WAGON_LIGHT_BY_ENV[envPreset] ?? 0;

  useEffect(() => {
    const lights = [];
    stripScene.traverse((o) => { if (o.isPointLight) lights.push(o); });
    if (!lights.length) return;

    // Remember what the asset shipped so repeated mounts never compound on
    // their own output, and so unmount leaves the GLB's values intact.
    const original = lights.map((l) => ({ l, color: l.color.clone(), intensity: l.intensity }));
    original.forEach(({ l, color, intensity }) => {
      const white = color.r > 0.99 && color.g > 0.99 && color.b > 0.99;
      const fallback = WAGON_LIGHT_FALLBACK[sanitizeName(l.name)];
      if (white && fallback) l.color.set(fallback);   // export regressed — stand in
      else l.color.copy(color);                       // authored colour wins
      l.intensity = intensity * gain;
      l.castShadow = false;
    });

    return () => {
      original.forEach(({ l, color, intensity }) => { l.color.copy(color); l.intensity = intensity; });
    };
  }, [stripScene, gain]);

  return null;
}

// ── Blinking string lights ──────────────────────────────────────────────────
// SM_Prop_Light_04(.001-.006): seven festoon strands slung pole to pole, 23
// bulbs each. Synty's Unity build blinks them; that effect did NOT survive the
// glTF export — BOARDWALK_Atlas_MAT arrives carrying a baseColorTexture and no
// emissive of any kind — so it is rebuilt here.
//
// Two obvious approaches are both wrong, for different reasons:
//   * emissive on the material itself → BOARDWALK_Atlas_MAT is shared by 77
//     meshes across 125 nodes, i.e. most of the boardwalk. That lights the pier.
//   * emissive on a CLONE of it → closer, but one strand mesh holds the wire
//     and the sockets as well as the bulbs, so the whole strand glows as a
//     rope rather than as points.
//
// What makes it tractable is the atlas layout. All 1659 verts of the strand sit
// in just three tiny UV islands, and the bulbs are one of them. Measured off the
// decoded Draco geometry: the bulb island's 1037 verts form 23 compact ~8.5³
// blobs, while the wire island's are flat (6.8 x 6.9 x 2.4) and the sockets sit
// at u~0.076. So a cloned material plus one UV test in the fragment shader
// lights the bulbs and nothing else — no re-export, no added draw calls, no
// geometry.
const STRING_RE = /^SM_Prop_Light_04\d*$/;
// sanitizeName deletes dots, so "Face1.001" arrives as "Face1001".
const STRIP_FACE_JUNK_RE = /^Face\d*$/;
// The bulb island, padded a hair past the measured box (u 0.0211-0.0225,
// v 0.9741-0.9858) so no rim vert sitting exactly on the boundary drops out.
// The wire (v~0.929) and sockets (u~0.076) are nowhere near, so padding is free.
const STRING_BULB_UV = [0.0200, 0.0236, 0.9730, 0.9869];   // u0, u1, v0, v1
const STRING_COLOR = "#ffe0a8";
// Unlike the spotlight bulbs, this emissive IS tone mapped. Those set
// toneMapped:false, but this material also draws the wire and the sockets, and
// exempting those from ACES would leave the strands reading brighter than every
// prop touching them. So the VALUE is pushed instead: ~3 lands near white
// through ACES at the page's exposure of 1.0.
const STRING_EMISSIVE_MAX = 3.0;
const STRING_BLINK_HZ = 0.7;    // full on-off cycles per second
const STRING_DUTY = 0.55;       // fraction of each cycle spent lit
const STRING_EDGE = 0.10;       // fraction spent fading at each edge (0 = hard square)
// Each strand runs on its own clock. Golden ratio for the phase offsets: it
// spreads N values as evenly as possible around the cycle for ANY N, and
// unlike i/N it does not line the strands up into a marching chase down the
// boardwalk. Set to 0 for the old blink-in-unison behaviour.
const STRING_PHASE_STEP = 0.6180339887;
// …and each strand's rate is nudged too, so they drift instead of holding a
// fixed relationship forever. With equal rates the pattern is periodic and the
// eye finds it; a spread this small is invisible per-strand but means the
// arrangement never quite repeats. 0 disables.
const STRING_RATE_SPREAD = 0.18;   // ± fraction of STRING_BLINK_HZ
// Same reasoning as BEAM_BY_ENV: an unlit bulb against a bright sky reads as
// nothing, so daylight gets no blink at all rather than a wasted one.
const STRING_BY_ENV = { night: 1.0, dusk: 0.85, hell: 1.0 };

function StringLights({ stripScene, envPreset }) {
  const gain = STRING_BY_ENV[envPreset] ?? 0;
  // One entry per strand: its own material clone, its own uniforms, its own
  // phase and rate. Seven materials rather than one shared clone is what buys
  // the independent blink — a uniform is per material, so a single clone can
  // only ever drive all seven together.
  //
  // It costs seven Material objects and nothing else. They are not seven
  // shaders: three keys its program cache on onBeforeCompile.toString(), and
  // every clone's function has identical source, so all seven share ONE
  // compiled program and differ only in uniform values. Draw calls are
  // unchanged too — these were already seven separate meshes.
  const rigRef = useRef([]);

  useEffect(() => {
    const strands = [];
    stripScene.traverse((o) => { if (o.isMesh && STRING_RE.test(sanitizeName(o.name))) strands.push(o); });
    if (!strands.length) return;

    const originals = strands.map((m) => m.material);
    const rig = strands.map((mesh, i) => {
      const lit = mesh.material.clone();
      // clone() JSON-round-trips userData, so any Texture stashed there comes
      // back as a plain object that crashes the renderer if it is ever assigned
      // to a texture slot. Nothing uses it on this material today; dropping it
      // costs nothing and does not depend on that staying true.
      lit.userData = {};
      lit.name = `BOARDWALK_Atlas_MAT__stringlights_${i}`;

      const u = {
        uBlink: { value: 0 },
        uBulbUV: { value: new THREE.Vector4(...STRING_BULB_UV) },
        uBulbColor: { value: new THREE.Color(STRING_COLOR) },
      };
      lit.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, u);
        shader.fragmentShader =
          "uniform float uBlink;\nuniform vec4 uBulbUV;\nuniform vec3 uBulbColor;\n" +
          shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            {
              // vMapUv is declared under USE_MAP, which this material has via
              // its baseColorTexture. Injected AFTER the include so it adds to
              // the final totalEmissiveRadiance rather than being multiplied
              // away.
              float inU = step(uBulbUV.x, vMapUv.x) * step(vMapUv.x, uBulbUV.y);
              float inV = step(uBulbUV.z, vMapUv.y) * step(vMapUv.y, uBulbUV.w);
              totalEmissiveRadiance += uBulbColor * (uBlink * inU * inV);
            }`
          );
      };
      lit.needsUpdate = true;
      mesh.material = lit;

      // Deterministic, not random: the same strand gets the same offset every
      // load, so a tuning pass is reproducible. (i * 3) % 7 permutes the index
      // first, so neighbouring strands never land on adjacent rates.
      const k = strands.length > 1 ? ((i * 3) % strands.length) / (strands.length - 1) : 0.5;
      return {
        mat: lit,
        u,
        phase: (i * STRING_PHASE_STEP) % 1,
        rate: 1 + STRING_RATE_SPREAD * (k * 2 - 1),
      };
    });
    rigRef.current = rig;

    return () => {
      strands.forEach((m, i) => { m.material = originals[i]; });
      rig.forEach((r) => { try { r.mat.dispose(); } catch (e) {} });
      rigRef.current = [];
    };
    // Deliberately NOT keyed on envPreset: swapping materials on a theme change
    // would force a shader recompile mid-scene. The uniform carries the gain
    // instead, so day is simply uBlink = 0.
  }, [stripScene]);

  useFrame((state) => {
    const rig = rigRef.current;
    if (!rig.length) return;
    if (gain <= 0) {
      for (let i = 0; i < rig.length; i++) rig[i].u.uBlink.value = 0;
      return;
    }
    const t = state.clock.elapsedTime;
    const peak = gain * STRING_EMISSIVE_MAX;
    for (let i = 0; i < rig.length; i++) {
      const r = rig[i];
      const phase = (t * STRING_BLINK_HZ * r.rate + r.phase) % 1;
      const rise = THREE.MathUtils.smoothstep(phase, 0, STRING_EDGE);
      const fall = 1 - THREE.MathUtils.smoothstep(phase, STRING_DUTY, STRING_DUTY + STRING_EDGE);
      r.u.uBlink.value = Math.min(rise, fall) * peak;
    }
  });

  return null;
}

// One SpotLight for the whole strip, mounted OUTSIDE the scaled group: distance
// and decay are world-space and do NOT inherit the group's scale, while
// position would — mixing the two is the trap behind GLOW_LIGHT_DISTANCE.
function VendorSpotlight({ focus, stripScene, envPreset }) {
  const lightRef = useRef();
  const targetRef = useRef();
  const level = useRef(0);

  const bulbs = useMemo(() => {
    const out = [];
    stripScene.traverse((o) => { if (o.isMesh && BULB_RE.test(sanitizeName(o.name))) out.push(o); });
    return out;
  }, [stripScene]);

  const spotBoost = SPOT_BOOST_BY_ENV[envPreset] ?? 1;

  useEffect(() => {
    if (lightRef.current && targetRef.current) lightRef.current.target = targetRef.current;
  }, []);

  useFrame((state, delta) => {
    const l = lightRef.current, t = targetRef.current;
    if (!l || !t) return;
    const want = focus?.object ? 1 : 0;
    level.current += (want - level.current) * (1 - Math.exp(-SPOT_EASE * delta));
    l.intensity = level.current * SPOT_INTENSITY * spotBoost;
    l.visible = level.current > 0.004;
    if (!l.visible || !focus?.object) return;

    focus.object.getWorldPosition(_spotAt);
    t.position.copy(_spotAt);
    t.updateMatrixWorld();

    // nearest bulb along the boardwalk (horizontal distance only — every bulb
    // is at the same height, so vertical distance carries no information)
    let best = null, bestD = Infinity;
    for (const b of bulbs) {
      b.getWorldPosition(_bulbAt);
      const d = (_bulbAt.x - _spotAt.x) ** 2 + (_bulbAt.z - _spotAt.z) ** 2;
      if (d < bestD) { bestD = d; best = _bulbAt.clone(); }
    }
    if (best) l.position.copy(best);

  });

  return (
    <>
      <object3D ref={targetRef} />
      <spotLight
        ref={lightRef}
        color={SPOT_COLOR}
        intensity={0}
        distance={SPOT_DISTANCE}
        angle={SPOT_ANGLE}
        penumbra={SPOT_PENUMBRA}
        decay={2}
        castShadow={false}
      />
    </>
  );
}

export default function CommercialStrip({ worldW, worldD, cellSize = 1, envPreset, vendors = VENDOR_CATALOG, onVendorClick, onFocusObject, onZoomOut, onBoothPhoto }) {
  const { scene: stripScene } = useGLTF(STRIP_MODEL, true, true, extendKTX2);
  // The strip is the only KTX2 asset: once it is in, the transcoder worker and
  // its wasm heap are dead weight in the page process (see getKTX2Loader).
  useEffect(() => { if (stripScene) releaseKTX2Workers(); }, [stripScene]);
  // Which vendor is zoomed, and what the beam should point at. Lifted here so
  // one shared SpotLight can serve every vendor.
  const [focus, setFocus] = useState(null);
  // While the player is INSIDE the photo booth, every surface they can click
  // IS booth interior — and those meshes live in the strip GLB, under the
  // deck's own click handler. The booth registers its click handler here so
  // handleStripClick can hand those clicks over instead of flying the camera.
  const boothClickRef = useRef(null);

  const deckW = worldW + DECK_MARGIN * 2 * cellSize;
  const deckD = DECK_DEPTH * cellSize;
  const deckZ = -(worldD / 2 + deckD / 2); // flush against the −Z edge

  // The Boardwalk's own bounds in strip-local space. Hoisted out of clipPlanes
  // because the fit and the knee braces both need to know where the deck's
  // surface and underside actually are.
  const deckLocal = useMemo(() => {
    const deck = findByBaseName(stripScene, "Boardwalk");
    if (!deck) return null;
    stripScene.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(stripScene.matrixWorld).invert();
    return new THREE.Box3().setFromObject(deck).applyMatrix4(inv);
  }, [stripScene]);

  // Auto-fit from the GLB's own bounds rather than hand-tuned numbers, so a
  // re-export at a different size — or a different grid — still lands right.
  // With STRIP_ROT_Y = +90°, local (x,y,z) → world (z, y, −x): the strip's long
  // local Z becomes the mesa's X edge, and its local X becomes deck depth.
  //
  // Fit the BOARDWALK, not the whole scene. The deck is what has to line up
  // with the mesa edge, and it is the one thing in here that is symmetric:
  // local z spans ±38.576 about zero. The full-scene box is neither — the hot
  // air balloon at the near end hangs 3.0 units past the last board, so sizing
  // by it squeezed the deck to 96% of the edge AND slid its midpoint 1.5 units
  // off centre. The result butted up flush at the +X corner and fell short at
  // −X by 0.24 cells on a 6×6 up to 0.39 on a 10×10 — the gap widening with
  // grid size is exactly the "boardwalk drifts off centre" symptom.
  //
  // Props are allowed to overhang the ends; that is what makes the strip look
  // like it spills off the mesa. They just must not get a vote on the fit.
  const fit = useMemo(() => {
    if (deckLocal) {
      // Already in strip-local space (deckLocal divides out stripScene's own
      // world matrix), so this is immune to the transform the group below is
      // about to apply. Measuring the live scene with setFromObject is not:
      // once mounted, stripScene.matrixWorld carries the previous fit, and a
      // grid resize re-entering this memo would feed that scale back into
      // itself. Keep the local path as the one that normally runs.
      const scale = deckW / ((deckLocal.max.z - deckLocal.min.z) || 1);
      return {
        scale,
        position: [
          -((deckLocal.min.z + deckLocal.max.z) / 2) * scale, // deck centred on the mesa edge
          -deckLocal.max.y * scale + DECK_LIFT,  // walking surface a hair proud of the field
          // Butt the deck's inner edge into the mesa wall rather than centring
          // it on the nominal deck line. Scale is driven by the strip's LONG
          // axis, so its depth lands wherever the model's aspect puts it
          // (~1.05 cells, not DECK_DEPTH's 1.2) — centring split that slack in
          // two and left an open slot along the wall. local +X maps to world
          // −Z, so the deck's MIN local x is its inner edge; DECK_OVERLAP
          // buries it just past the face so no hairline can open up at grazing
          // angles.
          -worldD / 2 + DECK_OVERLAP * cellSize + deckLocal.min.x * scale,
        ],
      };
    }
    // Boardwalk mesh missing (bad export): fall back to the whole-scene box and
    // its lowest point, which is wrong in the ways described above but keeps
    // the strip on screen instead of collapsing it to zero.
    const box = new THREE.Box3().setFromObject(stripScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = deckW / (size.z || 1);
    return {
      scale,
      position: [-center.z * scale, -box.min.y * scale, deckZ + center.x * scale],
    };
  }, [stripScene, deckW, deckZ, deckLocal, worldD, cellSize]);

  // Export junk. CommercialStrip2 shipped with two of the rug goblin's face
  // meshes baked into it — Face1.001 and Face3.001. They came across UNSKINNED
  // (the strip has zero skins), so with no head bone to follow they render at
  // their raw mesh coordinates, which the auto-fit throws ~22 world units off
  // the side of the mesa and 1.6 up: a face floating in the sky.
  //
  // The rule can be this narrow and still be safe. The strip has no skins and no
  // legitimate face geometry of its own — faces belong to the character GLBs —
  // so an unskinned mesh named Face<n> inside the STRIP scene is always junk.
  // Same idiom as the Icosphere rule on the character exports.
  //
  // raycast is stubbed too, not just visibility: the strip GLB sits inside the
  // click-to-fly wrapper, so an invisible-but-pickable face would still catch a
  // click and fly the camera 22 units into empty air.
  //
  // Fix at source by deleting them from the Blender scene and re-exporting.
  // This costs nothing once they are gone.
  useEffect(() => {
    const junk = [];
    stripScene.traverse((o) => {
      if (o.isMesh && !o.isSkinnedMesh && STRIP_FACE_JUNK_RE.test(sanitizeName(o.name))) junk.push(o);
    });
    if (!junk.length) return;
    const rays = junk.map((o) => o.raycast);
    junk.forEach((o) => { o.visible = false; o.raycast = () => {}; });
    return () => { junk.forEach((o, i) => { o.visible = true; o.raycast = rays[i]; }); };
  }, [stripScene]);

  // Where the deck actually ended up, in world units. The braces need its real
  // outer edge and underside — both move with the fit, so neither can be
  // written as a constant offset from the nominal deck line.
  const deckSpan = useMemo(() => {
    if (!deckLocal) {
      return { zOuter: deckZ - deckD / 2, underY: DECK_LIFT };
    }
    const s = fit.scale;
    return {
      zOuter: fit.position[2] - deckLocal.max.x * s, // furthest from the mesa
      // Relative to the deck's TOP surface, which DECK_LIFT moved off zero. The
      // braces are built in world units outside the fitted group, so without
      // carrying the lift through they would stay behind and leave a gap
      // between each brace head and the underside it is supposed to meet.
      underY: DECK_LIFT + (deckLocal.min.y - deckLocal.max.y) * s,
    };
  }, [deckLocal, fit, deckZ, deckD]);

  // Clip the beams AND pools to the boardwalk's actual footprint. The Y plane
  // alone was never enough: a pool is a flat quad AT deck height, so nothing
  // vertical can trim it — what spills past the boards is lateral, and needs
  // edge planes. Derived from the Boardwalk mesh so it tracks the auto-fit.
  //   local X -> world Z (negated by the +90° Y rotation), local Z -> world X.
  const clipPlanes = useMemo(() => {
    const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -fit.position[1])];
    if (!deckLocal) {
      return planes;
    }
    const lb = deckLocal;
    const s = fit.scale, p = fit.position;
    const zMin = -lb.max.x * s + p[2], zMax = -lb.min.x * s + p[2];
    const xMin = lb.min.z * s + p[0],  xMax = lb.max.z * s + p[0];
    planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMin));
    planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), zMax));
    planes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -xMin));
    planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), xMax));
    return planes;
  }, [deckLocal, fit]);

  // Fly to the stretch of boardwalk that was clicked, rather than to one fixed
  // "the strip" pose — clicking near the tattoo booth should land you at the
  // tattoo booth. Characters never reach this: VendorStall stops propagation,
  // and its stalls are siblings of the wrapper below anyway.
  const handleStripClick = (e) => {
    // R3F does not suppress clicks after a drag for objects that were HIT (its
    // internal delta<=2 check only guards the pointer-MISSED path), and the deck
    // is a wide target, so an orbit drag that happens to finish over it would
    // otherwise fly the camera. e.delta is pixels travelled since pointerdown.
    if (e.delta > STRIP_CLICK_DRAG_PX) return;
    // Without this the same ray keeps going and also lands on the grid/ground
    // handlers behind the strip, which would fly there instead / as well.
    e.stopPropagation();
    // In-booth clicks (snap / exit) land on the cabin's interior walls, which
    // are strip geometry — delegate them to the booth's state machine.
    if (focus?.id === "photobooth" && boothClickRef.current) {
      boothClickRef.current(e);
      return;
    }
    if (!onFocusObject || !e.point) return;
    // Approach from the field side. +Z is the same direction the vendors use
    // (approachDirWorld resolves their default to exactly (0,0,1)), so a strip
    // click and a character click fly in from the same side and the second
    // click after the first never has to swing the camera around.
    const look = new THREE.Vector3(e.point.x, e.point.y + STRIP_VIEW_RAISE, e.point.z);
    const normal = new THREE.Vector3(0, STRIP_VIEW_LIFT, 1).normalize();
    onFocusObject(look, normal, STRIP_VIEW_DIST);
  };

  return (
    <>
      {/* diagonal knee braces: foot embedded in the mesa wall, head meeting the
          deck's underside near its outer edge. These tie the strip to the mesa
          and are not part of the Synty set, so they stay procedural and in
          world units — outside the auto-fitted group below.
          Derived from the deck line rather than hand-tuned offsets. The old
          fixed −45° brace could never fall further than the deck is deep
          (DECK_DEPTH = 1.2 cells), so its foot stopped a cell short and hung in
          the air against a 10-cell mesa wall; raking it steeper lets STRUT_DROP
          be set independently of the deck's depth. */}
      {/* Braces get the same click as the deck — they are part of the structure,
          and from a low angle they are most of what is actually hit. */}
      <group
        onClick={handleStripClick}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
      {Array.from({ length: STRUT_COUNT }, (_, i) => {
        // Spread end-to-end rather than in even cells. Cell-centring parked the
        // outermost brace a full half-cell in from each end, leaving DECK_MARGIN's
        // overhang plus that half-cell cantilevered off the mesa's side walls with
        // nothing under it — invisible from above, but the ends float at low angles.
        const span = deckW - 2 * STRUT_END_INSET * cellSize;
        const x =
          STRUT_COUNT > 1
            ? -deckW / 2 + STRUT_END_INSET * cellSize + (i * span) / (STRUT_COUNT - 1)
            : 0;
        const zTop = deckSpan.zOuter + STRUT_TOP_INSET * cellSize; // under the real outer edge
        const zBot = -worldD / 2 + STRUT_EMBED * cellSize;         // buried in the mesa wall
        const run = zTop - zBot;                                     // negative: leans inward
        const drop = STRUT_DROP * cellSize;
        const len = Math.hypot(run, drop);
        return (
          <mesh
            key={`strut-${i}`}
            position={[x, deckSpan.underY - drop / 2, (zTop + zBot) / 2]}
            rotation={[Math.atan2(run, drop), 0, 0]}
          >
            <boxGeometry args={[STRUT_THICK * cellSize, len, STRUT_THICK * cellSize]} />
            <meshStandardMaterial color={WOOD_POST} roughness={0.85} metalness={0.05} />
          </mesh>
        );
      })}
      </group>
      {/* One shared transform for the strip AND every character: the character
          GLBs are exported in the strip's coordinate space, so they must ride
          the identical scale/rotation or they drift off their props. */}
      {/* Outside the scaled group on purpose: SpotLight distance/decay are
          world-space and would not inherit fit.scale, while position would. */}
      <VendorSpotlight focus={focus} stripScene={stripScene} envPreset={envPreset} />
      <WagonLights stripScene={stripScene} envPreset={envPreset} />
      {/* Renders nothing — it swaps a shader-patched clone onto the seven
          festoon strands and drives one uniform. Outside the group with the
          other material-only effects. */}
      <StringLights stripScene={stripScene} envPreset={envPreset} />
      <group position={fit.position} rotation={[0, STRIP_ROT_Y, 0]} scale={fit.scale}>
        {/* Only the strip GLB is wrapped, deliberately. The vendor stalls and
            BulbRig's beam/pool cones are SIBLINGS of this group, so neither
            routes through this handler: a character keeps its own click, and
            the additive light shafts (big invisible-ish cones hanging in the
            air) never become click targets. */}
        <group
          onClick={handleStripClick}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = "auto"; }}
        >
          <primitive object={stripScene} />
        </group>
        {/* Inside the group: halo positions are strip-local, and the constant
            pixel size is immune to the scale. */}
        <BulbRig stripScene={stripScene} envPreset={envPreset} clipPlanes={clipPlanes} />
        {vendors.map((v) => (
          <VendorStall
            key={v.id}
            vendor={v}
            stripScene={stripScene}
            stripRotY={STRIP_ROT_Y}
            framingUnit={fit.scale / LEGACY_MODEL_SCALE}
            propObj={v.prop ? findByBaseName(stripScene, v.prop) : null}
            onVendorClick={onVendorClick}
            onFocusObject={onFocusObject}
            onZoomOut={onZoomOut}
            onFocusChange={setFocus}
          />
        ))}
        {/* The photo booth rides the same shared transform: its GLB is
            exported in the strip's coordinate space like the characters. */}
        <PhotoBooth
          stripScene={stripScene}
          stripScale={fit.scale}
          focus={focus}
          onVendorClick={onVendorClick}
          onFocusObject={onFocusObject}
          onZoomOut={onZoomOut}
          onFocusChange={setFocus}
          onBoothPhoto={onBoothPhoto}
          boothClickRef={boothClickRef}
        />
      </group>
    </>
  );
}
