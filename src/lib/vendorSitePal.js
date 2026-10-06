// ── Vendor SitePal bridge (/hailmary commercial strip) ─────────────────────
// Single-host portal for the vendor characters, following the /trade pattern:
// one embed in the page document (VendorSitePalHost.jsx), scenes swapped via
// loadSceneByID(), and the live frame cropped onto the character's face mesh
// by CommercialStrip's per-frame compositor. Only one vendor speaks at a time.
//
// Speech is SitePal engine 14 — ElevenLabs THROUGH the SitePal account:
// sayText(text, <EL voice UUID>, 1, 14) speaks arbitrary text in the
// character's ElevenLabs voice with real lipsync. sayAudio is NOT used here:
// it resolves account track names only, never URLs (proven by
// /trade/spike-sayaudio).
//
// NOTE: SitePal caches rendered TTS by text — after changing a voice, re-word
// the greeting lines or the old voice replays from cache.

export const VENDOR_SITEPAL_CONTAINER_ID = "vendor-sitepal-host";
export const VENDOR_SITEPAL_ACCOUNT = "9308752";

// Embed params for AC_VHost_Embed. Positional: account, h, w, bgcolor,
// firstscene, controls, sceneId, sl, load, context, embedId, version,
// responsive. context=1 is REQUIRED on a Next.js page (framework bootstrap
// path — else setPlayerVolume/saySilent/replay misbehave).
export const VENDOR_SITEPAL_EMBED_PARAMS =
  '9308752,600,800,"",1,0,2775386,0,1,1,"NnOEeZgOFXXyFlkCbvkh423d963uH40B",0,1';

// Crop region in the source SitePal canvas → the face mesh's 512² texture.
// Mutable export, read every frame — tune live from the console via
// window.__vendorSitePalCrop then paste the values back here.
export const FORTUNES_SITEPAL_CROP = {
  cropX: 194,
  cropY: 106,
  cropW: 187,
  cropH: 216,
  rotateZ: 0,
  rotateX: 0,
};

// Color correction (CSS filter values; 100 = identity) — SitePal frames come
// back washed out. Also mutable/live like the crop.
export const FORTUNES_SITEPAL_FILTER = {
  saturate: 265,
  contrast: 181,
  brightness: 30,
  hueRotate: -9,
  sepia: 51,
};


// Salesman crop/filter — tuned via /hailmary?tune=vendor (SALESMAN tab);
// re-tune there and paste the logged values back here if his scene's avatar
// ever changes.
export const TONICS_SITEPAL_CROP = {
  cropX: 206,
  cropY: 138,
  cropW: 154,
  cropH: 232,
  rotateZ: 2,
  rotateX: 0,
};
export const TONICS_SITEPAL_FILTER = {
  saturate: 117,
  contrast: 103,
  brightness: 147,
  hueRotate: 7,
  sepia: 22,
};

// Hot dog vendor crop/filter — tuned via /hailmary?tune=vendor (HOT DOG
// tab); re-tune there and paste the logged values back here if his scene's
// avatar ever changes.
export const HOTDOGS_SITEPAL_CROP = {
  cropX: 190,
  cropY: 140,
  cropW: 161,
  cropH: 222,
  rotateZ: 0,
  rotateX: 0,
};
export const HOTDOGS_SITEPAL_FILTER = {
  saturate: 174,
  contrast: 103,
  brightness: 114,
  hueRotate: 0,
  sepia: 36,
};

// Promos hologram crop/filter — tuned via /hailmary?tune=vendor (PROMOS tab);
// re-tune there and paste the logged values back here if her scene's avatar
// ever changes. Note the tighter box than the other three: cropH 155 against
// their 222. No sepia either, unlike the dusty prospectors — she is a
// projection, and the warm cast reads as grime on a screen that should look
// backlit.

export const PROMOS_SITEPAL_CROP = {
  cropX: 202,
  cropY: 124,
  cropW: 151,
  cropH: 154,
  rotateZ: 4,
  rotateX: 0,
};
export const PROMOS_SITEPAL_FILTER = {
  saturate: 110,
  contrast: 103,
  brightness: 115,
  hueRotate: 0,
  sepia: 0,
};

// Rug merchant crop/filter — tuned via /hailmary?tune=vendor (RUGS tab);
// re-tune there and paste the logged values back here if his scene's avatar ever
// changes. He is the only vendor carrying a hueRotate (27°) — his SitePal
// avatar's skin runs a different hue from the goblin mesh it projects onto, and
// that shift is what reconciles the two. Don't "clean it up" to 0.
export const RUGS_SITEPAL_CROP = {
cropX: 190,
  cropY: 163,
  cropW: 171,
  cropH: 212,
  rotateZ: 0,
  rotateX: 0,
};
export const RUGS_SITEPAL_FILTER = {
 saturate: 210,
  contrast: 87,
  brightness: 183,
  hueRotate: 27,
  sepia: 19,
};

// Taco trailer alien crop/filter — tuned via /hailmary?tune=vendor (TACOS tab).
// His filter is the odd one out and that is deliberate: near-identity, and the
// only one that DARKENS (brightness 94) where every human vendor is pushed to
// 124-137 with heavy saturation. Those corrections exist to rescue washed-out
// human skin; his avatar needs none of it, and the usual warm push turns him
// grey-green. Resist normalising these toward the others.
export const TACOS_SITEPAL_CROP = {
  cropX: 208,
  cropY: 162,
  cropW: 159,
  cropH: 217,
  rotateZ: 0,
  rotateX: 0,
};
  export const TACOS_SITEPAL_FILTER = {
  saturate: 139,
  contrast: 130,
  brightness: 70,
  hueRotate: 0,
  sepia: 0,
};

// Roller-coaster / time-machine carny. The CROP is tuned via /hailmary?tune=vendor (CARNY tab);
// the FILTER below is the promos seed, kept because it read correctly on him by
// eye rather than because it was swept — so if his colour ever looks off, that
// block is the one that was never actually measured.
export const CARNY_SITEPAL_CROP = {
  cropX: 208,
  cropY: 100,
  cropW: 191,
  cropH: 239,
  rotateZ: 0,
  rotateX: 0,
};
export const CARNY_SITEPAL_FILTER = {
  saturate: 180,
  contrast: 103,
  brightness: 124,
  hueRotate: 0,
  sepia: 28,
};

// The Midway chaplain (docs/midway-chapel.md). Scene 2775640 (2026-10-05).
// The CROP is the carny's as a SEED — SitePal heads land in roughly the same
// place on the 600×800 canvas — and the FILTER is neutral. Neither has been
// swept against his face yet: tune via /hailmary?tune=vendor (CHAPEL tab) and
// paste the logged values back here.
export const CHAPEL_SITEPAL_CROP = {
  cropX: 208,
  cropY: 100,
  cropW: 191,
  cropH: 239,
  rotateZ: 0,
  rotateX: 0,
};
export const CHAPEL_SITEPAL_FILTER = {
  saturate: 100,
  contrast: 100,
  brightness: 100,
  hueRotate: 0,
  sepia: 0,
};

// Tattoo artist — TWO sets, one per pose GLB, because her head sits at a very
// different angle standing out front versus bent over the chair. rotateX is the
// knob that earns its keep here: it squashes the crop vertically by cos(angle),
// which is what reconciles a face the camera is looking at from above. The lamp
// under her tent also falls on her differently seated, so the filters are free
// to diverge too.
//
// Which set is used is decided by `sitepalCrop`/`sitepalFilter` in her
// poseOverrides (CommercialStrip.jsx), keyed by whichever pose file this page
// load drew. The registry entry below points at the IDLE pair as the default,
// so a pose that names neither still renders.
//
// Tune via /hailmary?tune=vendor, and note the pose is drawn at random per
// load: ?pose=idle / ?pose=tattooing pins the one you want. Getting that wrong
// is the easy mistake here — the tuner tab names the const, but nothing checks
// that the tab matches the pose actually on screen.
export const TATTOOS_IDLE_SITEPAL_CROP = {
  cropX: 158,
  cropY: 144,
  cropW: 229,
  cropH: 235,
  rotateZ: 9,
  rotateX: 0,
};
export const TATTOOS_IDLE_SITEPAL_FILTER = {
  saturate: 137,
  contrast: 105,
  brightness: 121,
  hueRotate: 0,
  sepia: 30,
};

// Seated at the stool, head bowed over the work.
export const TATTOOS_SEATED_SITEPAL_CROP = {
  cropX: 142,
  cropY: 150,
  cropW: 224,
  cropH: 226,
  rotateZ: -5,
  rotateX: 0,
};
export const TATTOOS_SEATED_SITEPAL_FILTER = {
  saturate: 92,
  contrast: 103,
  brightness: 133,
  hueRotate: 0,
  sepia: 27,
};

// Rig crew (RigCrew.jsx): the goblin workers brief the player through SitePal
// scene 2775497 in Michelle's account, projected onto their Face2. The crop is
// seeded from the rug merchant's (also a goblin avatar) and is UNTUNED: adjust
// live via window.__crewSitePalCrop / window.__crewSitePalFilter in the console
// while a briefing runs, then paste the values back here. The skin match aims
// at Face2's authored colour (the goblin's face swatch, #b5b794), so brightness
// is moot; saturate/contrast/hue still shape the crop.
// First pass 2026-09-11 from the live frame: her scene is a close-up goblin head in a hard hat
// filling the 600×450 player, so the crop is the face from just under the brim to the chin,
// cheek to cheek (Face2 is 1.3:1, wider than tall — the box keeps that aspect). Contrast is
// pulled down because the avatar's baked shading is strong and the skin gain (≈1.5×) pushed the
// lit side past white when the sample sat in the eye sockets; the sample box is a cheek now.
// Michelle's second pass in the CREW tab (2026-09-11): tighter on the face, a hair of roll,
// contrast and brightness nudged so the skin match has less to lift.
export const CREW_SITEPAL_CROP = {
  cropX: 142,
  cropY: 179,
  cropW: 247,
  cropH: 205,
  rotateZ: -1,
  rotateX: 0,
};
export const CREW_SITEPAL_FILTER = {
  saturate: 104,
  contrast: 103,
  brightness: 90,
  hueRotate: 6,
  sepia: 0,
};
if (typeof window !== "undefined") { window.__crewSitePalCrop = CREW_SITEPAL_CROP; window.__crewSitePalFilter = CREW_SITEPAL_FILTER; }

// Skin match (CommercialStrip's projection compositor). The projected crop
// is measured — per-channel median of a box on the crop canvas — and its
// material colour set to target ÷ measured, so the skin lands on the face's
// authored colour whatever SitePal's own lighting did; the scene lights then
// treat both faces alike through the day-night cycle. Optional per-vendor
// fields in the registry below:
//   skinTarget: "#rrggbb"  — aim here instead of the projFace's authored
//                            flat colour (the Blender eyedropper value).
//   skinSample: {x,y,w,h}  — measurement box as fractions of the crop canvas
//                            (default: the central 40%, cheeks and nose).
//                            Move it off a beard or a mask; ?tune=vendor
//                            draws it in blue on the frame preview.
//   skinMatch: false       — lit projection, no correction.
// The filter's `brightness` is cancelled by the match; saturate, contrast,
// sepia and hue-rotate still shape the crop before it is measured.
export const SKIN_SAMPLE_DEFAULT = Object.freeze({ x: 0.3, y: 0.3, w: 0.4, h: 0.4 });

// Per-vendor registry, keyed by VENDOR_CATALOG id. `projFace` receives the
// SitePal projection; `regularFaces` are the painted face layers hidden
// while the projection is active (the two models label them differently —
// per-vendor fields, not a convention).
export const VENDOR_SITEPAL_CONFIG = {
  // The rig crew's briefer. No greeting pool: RigCrew speaks the briefing lines
  // itself (speakVendorText), one per gesture, and closes with deactivate.
  crew: {
    sceneId: 2775497,
    voice: { voice: "LglRX59YTEmRX2HIAN3F", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    crop: CREW_SITEPAL_CROP,
    filter: CREW_SITEPAL_FILTER,
    skinSample: { x: 0.12, y: 0.62, w: 0.18, h: 0.18 },   // left cheek below the eye: clean skin, no socket shadow
    greetings: null,
  },
  fortunes: {
    sceneId: 2775386,
    voice: { voice: "3jFgoI5DB1bSRZIjmdho", lang: 1, engine: 14 },
    projFace: "Face3",
    regularFaces: ["Face1", "Face2"],
    crop: FORTUNES_SITEPAL_CROP,
    filter: FORTUNES_SITEPAL_FILTER,
    greetings: {
      first: [
        "A new face. Sit. The ball has been expecting you, even if you were not expecting the ball.",
        "So. The field sends me a stranger. Give me your eyes, and I will tell you what the dust will not.",
      ],
      returning: [
        "Ah. The ball has been restless all afternoon, and now I see why. Sit.",
        "The cards said nothing about you, stranger. I like that. It means tonight is still negotiable.",
        "Come closer. Every well out there dreams, and I am the only one on this field who listens.",
        "Day {day} already. The field grows honest near the end. So do I.",
      ],
      frequent: [
        "Back again. The regulars get the true readings. The tourists get the pretty ones. Sit.",
        "I have read your face so often I could do it from memory. Tonight, let us read something else.",
      ],
    },
  },
  tonics: {
    sceneId: 2775402,
    voice: { voice: "QPJKUe47zCn3aejMTMUr", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    crop: TONICS_SITEPAL_CROP,
    filter: TONICS_SITEPAL_FILTER,
    greetings: {
      first: [
        "A NEW customer! Friend, you have wandered into the single luckiest moment of your prospecting career.",
        "First time at my cart? Then the first sip of advice is free: buy the second bottle.",
      ],
      returning: [
        "Step right up, friend! You have the look of a prospector who knows value when it winks at him.",
        "Ah, a discerning customer. One bottle of my patented tonic and that drill of yours practically steers itself.",
        "Everything on this cart is one hundred percent genuine, friend. Mostly. The mustache included.",
        "You there! Yes, you. Dry holes got you down? I bottle luck itself, and business is booming.",
        "This tonic cured a man's rig of squeaking, his boots of pinching, and his marriage of silence. One bottle left.",
        "I don't sell hope, friend. Hope is free. I sell the bottle you keep it in.",
        "Free advice, no charge: never trust a salesman. Present company excepted, naturally.",
        "Rub two drops on your derrick and stand well back. That is all I am legally permitted to say.",
        "The fortune teller reads your future. I improve it. Small distinction, friend. Big difference.",
        "Day {day}, and business is booming. Somebody on this field is lucky. Statistically. Probably.",
      ],
      frequent: [
        "My favorite customer returns! For you, the regular price. Which is the special price. Which is the price.",
        "You again! I would offer the loyalty discount, but loyalty, friend, is priceless.",
      ],
    },
  },
  hotdogs: {
    sceneId: 2775403,
    voice: { voice: "KKjzrOiscwOprYdapRQa", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    crop: HOTDOGS_SITEPAL_CROP,
    filter: HOTDOGS_SITEPAL_FILTER,
    greetings: {
      first: [
        "New on the field? First rule: never drill hungry. Second rule: I am the only food for forty miles.",
        "Welcome to the boardwalk, friend. The dogs are hot, the field is cold, and the gossip is free.",
      ],
      returning: [
        "Hot dogs! Get your hot dogs! The only thing on this field that comes up from the ground fully cooked!",
        "Fresh off the roller, friend. The secret ingredient is that I never discuss the ingredients.",
        "You cannot drill on an empty stomach. Technically you can. But why suffer?",
        "Mustard, relish, onions, and my complete discretion regarding the frank. All included.",
        "One for a dollar, two for two dollars. The bulk discount is imaginary, but the dogs are real.",
        "Day {day}. I have sold enough dogs to pave a claim. Nobody has struck oil in a hot dog yet. Yet.",
      ],
      frequent: [
        "The usual? Of course the usual. I had it rolling the moment I saw you cross the field.",
        "You know, you are the only one out here who chews before swallowing. I respect that.",
      ],
    },
  },
  // Tattoo artist at the tent. Unlike the other vendors she has TWO pose GLBs
  // (idle / tattooing), one drawn per page load — both carry Face1/Face2/Face3
  // under the same names, so one config covers either file.
  //
  // She is the only sitepal vendor with no talkClip: each pose GLB ships a
  // single clip, so she speaks without a gesture swap (a supported case — the
  // fortune teller does the same). Give her a talk clip in Blender if the
  // stillness reads wrong while she is mid-line.
  tattoos: {
    sceneId: 2775451,
    voice: { voice: "adPLpvbQrUYGySEBoFJu", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    // Default / fallback pair. Each pose overrides these in poseOverrides.
    crop: TATTOOS_IDLE_SITEPAL_CROP,
    filter: TATTOOS_IDLE_SITEPAL_FILTER,
    greetings: {
      first: [
        "New skin. I can always tell — you are standing like the chair might bite.",
        "First time in my chair? Then we start small. Something you can hide from your own reflection.",
      ],
      returning: [
        "Sit. Everyone out here is trying to pull something permanent out of the ground. At least mine goes on the outside.",
        "I do not do names. Names come off worse than the ink does. Pick something else.",
        "Derricks, dice, and one little bottle of tonic — I have put all three on somebody this week. The tonic was his idea.",
        "Hold still and it is a line. Flinch and it is a story. Either way you are paying for it.",
        "You want the lucky number. Everybody wants the lucky number. It stops being lucky around the fourth guy.",
        "Day {day}, and I have inked more dry holes than gushers. People commemorate the strangest things.",
        "I can cover a bad one. I cannot cover a bad decision, but I can make it look deliberate.",
      ],
      frequent: [
        "You again. At this rate I run out of arm before you run out of ideas.",
        "Back already? Good. You are the only one out here who lets me finish a piece properly.",
      ],
    },
  },
  // The roller-coaster / time-machine carny (the clown-mouth entrance).
  // "R-Lady" spelling rule applies here too.
  carny: {
    sceneId: 2775422,
    voice: { voice: "oubi7HGxNVjXMnWLgwBT", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    crop: CARNY_SITEPAL_CROP,
    filter: CARNY_SITEPAL_FILTER,
    greetings: {
      first: [
        "Well hey there! Step right up, friend. This here's the Time Machine. It's a roller coaster, too. Two rides, one price. I'm practically givin' it away. I ain't, but practically.",
        { text: "Howdy! See that clown? You ride in through his mouth, and you come out the other side. WHEN you come out is the interestin' part.", gesture: "pointing" },
      ],
      returning: [
        "Step right up! One ticket, one loop, one signature on this here waiver. Don't read it. Parts of it ain't been written yet.",
        "She's safe as houses, buddy. Safe as a house from about nineteen fifty-two, anyhow. Which is where some folks say they ended up.",
        { text: "Roller coaster AND a time machine! Go up the hill, come down the hill, come down on a Tuesday. We don't get to pick the Tuesday.", gesture: "pointing" },
        "That rattlin' sound? That's just the track settlin'. Into which century, I couldn't tell you.",
        "I been runnin' this ride eleven years. Or four. Depends which end of the track you count from.",
        { text: "Fella rode it yesterday, stepped off, and knew right where the oil was gonna be. Rode it again to be sure. Ain't seen him since.", gesture: "pointing" },
        "They tell me the smart money's in R-Lady. Folks come off this ride sayin' the same thing, only they say it like they already know.",
        "Day {day}. Or thereabouts. Ride's been runnin' all mornin', and the calendar out here is more of a suggestion.",
        { text: "Naw, I don't ride it no more. Somebody's gotta stay in the present and hold the lever. Real important job.", gesture: "pointing" },
        "Clown ain't part of the ride. Clown's just the door. Try not to look him in the eye on the way in. He takes it personal.",
      ],
      frequent: [
        "Well, look who it is! My best customer. Or you will be. Or you were. This ride makes the bookkeepin' a nightmare.",
        "Back for another go? Same price as last time. Same price as next time, too. I went and checked.",
      ],
    },
  },
  // The taco-and-beverage alien. "R-Lady" spelling rule applies here too.
  tacos: {
    sceneId: 2775414,
    voice: { voice: "OhisAd2u8Q6qSA4xXAAT", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    crop: TACOS_SITEPAL_CROP,
    filter: TACOS_SITEPAL_FILTER,
    greetings: {
      first: [
        "Greetings, organism. You have arrived at the finest taco establishment within four light years. The competition is not close. There is no competition.",
        "Welcome. Do not be alarmed by my appearance. Be alarmed, if you wish, by the green sauce.",
      ],
      returning: [
        "Two tacos, one beverage. This is the correct order. I have run the calculations many times.",
        "The recipe is from my homeworld. I have adjusted it for your species. Mostly the temperature. Somewhat the legality.",
        "The green sauce is safe. The other green sauce, we do not speak of.",
        "Your planet has magnificent food and terrible opinions about which food is best. I am here to correct this, one taco at a time.",
        "You look tired, prospector. Drilling is hard work. I know. I watched you do it. All day. Through the window.",
        "This beverage glows a little. That is normal. That is flavor.",
        "I am told the clever money is in R-Lady. On my world we also had a clever money. It is now a museum.",
        "Day {day}. I have served two hundred tacos and abducted nobody. I feel this deserves more recognition than it receives.",
        "No, I will not tell you what is in it. On my world, a chef who reveals the recipe is eaten. It is a strong tradition.",
      ],
      frequent: [
        "You return. Again. My scanners recognize your walk from forty meters. This is friendship, I am told.",
        "The usual? I began preparing it while you were still out by the water tower. Efficiency. Not surveillance. Efficiency.",
      ],
    },
  },
  // The rug merchant — an exotic dealer, courtly and evasive rather than
  // street. Written in elevated, formal English on purpose: the accent belongs
  // to the ElevenLabs voice, so phonetic spelling here would only fight it (and
  // read as caricature). Keep new lines ornate and unhurried, never clipped.
  // He is seated at his stall, so no "sit down" invitations, and nothing that
  // assumes the player is standing on his merchandise.
  //
  // Same "R-Lady" spelling rule as promos below — these strings
  // go straight to sayText with no on-screen caption, and ElevenLabs reads
  // "RL80" as "R-L-eighty".
  rugs: {
    sceneId: 2775421,
    voice: { voice: "pO3rCaEbT3xVc0h3pPoG", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    crop: RUGS_SITEPAL_CROP,
    filter: RUGS_SITEPAL_FILTER,
    greetings: {
      first: [
        "Ah — a face I do not know. Welcome. Every piece here was carried a very long way, by people who no longer speak to me. That is how you know it is genuine.",
        "You honor my corner of the boardwalk. Look as long as you wish. Looking is free. Everything after the looking, we discuss.",
      ],
      returning: [
        "Silk, wool, and a little something the weaver would not name. Feel it — but only with the eyes, for now.",
        "A thief? You wound me. I am a merchant. The difference is paperwork, and I have a great deal of paperwork.",
        "This one crossed three borders to reach you. Two of them legally.",
        "You ask for my finest price. I have many finest prices. Which would you like?",
        "I would never take advantage of a customer. Advantage is taken, never given. There is a distinction, and I observe it.",
        "Every rug carries a story. This one carries a story I have improved a little, for the enjoyment of the customer.",
        "They say the clever money is in R-Lady. I am a simple dealer in textiles. But my brother deals in R-Lady, and his house is very fine.",
        "Day {day}. Eleven pieces have found new homes. The twelfth found its own way out. It will return, or it will not.",
        "The fortune teller warns you against me. She sells what has not yet happened. I sell what you can hold in two hands. Decide which is the better bargain.",
        "No, no — do not tell me your budget. Tell me your taste, and I will discover your budget.",
      ],
      frequent: [
        "My most valued friend returns. The piece I sold you — it has behaved itself? Good. Not all of them do.",
        "You come often. In my trade this means one of two things, and I am far too polite to say which. Come, there is something new.",
      ],
    },
  },
  // Promotions hologram at the prize wheel. NOTE the "R-Lady" spelling below:
  // these strings go STRAIGHT to sayText with no on-screen caption, and
  // ElevenLabs reads "RL80" as "R-L-eighty". Her whole pitch is the token, so
  // every line that names it has to be written phonetically. Keep it that way
  // in any line added here.
  promos: {
    sceneId: 2775409,
    voice: { voice: "wRBnwLc9kmVUe7Iim1Qo", lang: 1, engine: 14 },
    projFace: "Face2",
    // Face1/Face3 are her painted face layers, but Eye_L and Eye_R are NOT —
    // they are two separate eye planes (mesh "Plane") parented under the `eyes`
    // bone, so they ride the head animation and would otherwise float on top of
    // the projected avatar. `regularFaces` is just "things to hide while
    // projecting", so they belong here even though they are not face layers.
    regularFaces: ["Face1", "Face3", "Eye_L", "Eye_R"],
    crop: PROMOS_SITEPAL_CROP,
    filter: PROMOS_SITEPAL_FILTER,
    greetings: {
      first: [
        "First time at the wheel? Then you get the newcomer spin. One pull, one prize, and I do not check identification.",
        "Well, a new face. I am the promotions department, the merchandise counter, and the entire marketing budget. Charmed.",
      ],
      returning: [
        "Step up and spin! Every pull on that wheel is a shot at R-Lady merchandise, and every miss is a reason to try again.",
        "Fresh merchandise, straight off the time machine. Caps, patches, and one shirt so loud it got banned in a decade that has not happened yet.",
        "You look like a prospector who needs a hat. Everyone out here needs a hat. That is not a pitch, that is meteorology.",
        "Today's promotion: spin the wheel, take the prize, tell absolutely everyone. That last part is the one I care about.",
        "I am projected, not printed, so the merchandise is more real than I am. Sit with that for a second.",
        "Ride the coaster next door and you come back knowing the future. Spin my wheel first. Future you already knows what you won, and I hear they were thrilled.",
        "Day {day} and the wheel has not been fair once. It has been generous, which is better than fair and sells more hats.",
        "Buy nothing, spin anyway. My job is attention, and you are already giving me some.",
      ],
      frequent: [
        "My most loyal customer. You have spun that wheel so often the paint is coming off the good wedge.",
        "Back for more merchandise? At this point you are less a customer and more a walking advertisement. I approve.",
      ],
    },
  },
  // The Midway chaplain: a company-town preacher — sincere, tired, a little
  // venal (the indulgence table is right there), deadpan in Our Lady's register.
  // He mocks the FIELD, never the player's faith, and he is the other collar:
  // she blesses, he absolves. Never "child"/"my son" — seeker, friend, pilgrim.
  // "R-Lady" spelling rule applies. The ledger speech (he reads the player's
  // actual record) is a later step and goes through speakVendorText, not here.
  chapel: {
    sceneId: 2775640,
    // SCENE BROKEN (2026-10-05): requesting 2775640 makes the SitePal player throw
    // "vh_mc.idleLoadedCallback is not a function" and hang on its spinner — and
    // once it has, the host never swaps or speaks again until the page reloads.
    // Reproduced standalone with the account's own embed snippet, with both embed
    // tokens; the carny's scene is fine in the same harness. Until the scene is
    // fixed in the SitePal account, this flag makes activate/prime/speak for him
    // a no-op (one console warning) so a stall click or the CHAPEL tuner tab
    // cannot take every other vendor down with it. Delete the flag once
    // loadSceneByID(2775640) fires vh_sceneLoaded.
    sceneBroken: true,
    voice: { voice: "3y3Tv5R1v43QNZdfXoU3", lang: 1, engine: 14 },
    projFace: "Face2",
    regularFaces: ["Face1", "Face3"],
    crop: CHAPEL_SITEPAL_CROP,
    filter: CHAPEL_SITEPAL_FILTER,
    greetings: {
      first: [
        "Come in, come in. The tent is open, the bell is rung, and the collection plate is merely resting. Sit wherever the robot is not.",
        "A new face on the field. Welcome, pilgrim. I offer confession, penance and absolution, in that order, and I am told the order matters.",
      ],
      returning: [
        "Welcome back. The field has sinned since I saw you last. I do not yet know whether you helped.",
        "Candles are to the left, indulgences are to the right, and the truth is wherever you left it. Take your time.",
        "Every well on this field is a prayer, friend. Most of them are the asking kind. Very few are the thanking kind.",
        "I hear the smart money is in R-Lady. I keep a ledger, not a portfolio. The ledger is holding up better.",
        "Day {day}. I have heard confessions from half this field, and the other half is simply quieter about it.",
        "The casino is next door. We share a wall. Some nights I can hear the wheel through it. Some nights it can hear me.",
        "You drilled into something you should not have. I can tell. People walk differently after the sulfur.",
        "The chairs are free, the sermon is free, and the candle is a modest sum. A preacher has to eat, and the tent does not patch itself.",
      ],
      frequent: [
        "You again. Either your conscience is very active or my bench is very comfortable. I have checked the bench.",
        "My most faithful. Not my most virtuous, I keep a separate list for that, but faithful counts for a great deal out here.",
      ],
    },
  },
};

// The beat between arriving at a vendor and the first word: long enough for
// the camera to settle and for her to visibly notice you (the head tracking
// is already turning her toward the camera during this pause). It also
// absorbs the async tail of a previous visit's stopSpeech — without it, a
// quick defocus/refocus let the stale stop land on the NEW line, clipping it
// after the first syllable.
export const GREETING_DELAY_MS = 1200;

const state = {
  desiredVolume: 0,
  pending: null, // { vendorId, sceneId, text, voice }
  lastGreetingIdx: {},
  sourceEl: null,
  lastSceneVersion: -1,
  speakNotBefore: 0,
  speakTimer: null,
  activeVendorId: null,
  talking: false,
  gesture: null,   // clip name for the line currently being spoken
};

// ── Talk-state bridge: host callbacks → vendor models ──────────────────────
// The SitePal vh_talk*/vh_audio* callbacks land in VendorSitePalHost; vendor
// models subscribe here to crossfade idle ↔ talk clips while their greeting
// actually plays.
const talkListeners = new Set();
export function onVendorTalk(fn) {
  talkListeners.add(fn);
  return () => talkListeners.delete(fn);
}
export function notifyVendorTalk(talking) {
  if (talking === state.talking) return;
  state.talking = talking;
  const gesture = talking ? state.gesture : null;
  talkListeners.forEach((fn) => {
    try { fn(state.activeVendorId, talking, gesture); } catch (e) {}
  });
}

const w = () => (typeof window === "undefined" ? null : window);

export function vendorSitePalReady(sceneId) {
  const win = w();
  return !!(
    win &&
    win.__vendorSitePalSceneLoaded === true &&
    win.__vendorSitePalCurrentSceneId === sceneId &&
    typeof win.sayText === "function"
  );
}

// The live SitePal frame source: the LAST canvas in the host container
// (earlier ones are bootstrap stubs). Re-acquired whenever the host bumps
// __vendorSitePalSceneVersion (initial load and every scene swap).
export function getVendorSitePalSource() {
  const win = w();
  if (!win) return null;
  const v = win.__vendorSitePalSceneVersion || 0;
  if (state.lastSceneVersion !== v || !state.sourceEl) {
    const container = document.getElementById(VENDOR_SITEPAL_CONTAINER_ID);
    if (container) {
      const canvases = container.querySelectorAll("canvas");
      if (canvases.length >= 1) state.sourceEl = canvases[canvases.length - 1];
    }
    state.lastSceneVersion = v;
  }
  return state.sourceEl;
}

// Mobile/iOS audio unlock: must run INSIDE a user gesture. Resumes a shared
// AudioContext and plays a one-sample silent buffer — after that, the page is
// licensed to start audio, so the greeting that begins ~1.2s later (outside
// the gesture window) is allowed. saySilent(0) in activate primes SitePal's
// own pipeline the same way.
function unlockAudio(win) {
  try {
    const Ctx = win.AudioContext || win.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (win.__vendorAudioCtx ||= new Ctx());
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch (e) {}
}

// ── State-aware greetings ──────────────────────────────────────────────────
// Greeting pools come in visit tiers: `first` (never met — tracked in
// localStorage per vendor), `returning` (the default), `frequent` (6+
// visits — regulars treatment). A plain array still works and is treated as
// { returning: [...] }. Lines may embed {tokens} resolved from the greeting
// context (set from the page via setVendorGreetingContext); a line whose
// token has no value yet simply stays out of the pool, so data-driven lines
// switch on the moment the page supplies the data.
let greetingContext = {};
export function setVendorGreetingContext(patch) {
  greetingContext = { ...greetingContext, ...patch };
}

const FREQUENT_VISITS = 6;

function vendorVisits(vendorId, increment) {
  const win = w();
  if (!win || !win.localStorage) return 2; // SSR/no-storage → returning tier
  const key = `hm_vendor_visits_${vendorId}`;
  let n = parseInt(win.localStorage.getItem(key) || "0", 10) || 0;
  if (increment) {
    n += 1;
    try { win.localStorage.setItem(key, String(n)); } catch (e) {}
  }
  return n;
}

// A greeting entry is either a plain string or { text, gesture }. `gesture`
// names a clip in the vendor's own GLB to crossfade to while THAT line plays,
// instead of the vendor's default talkClip — so a line about the ride can
// point at the ride. Unknown gesture names fall back to talkClip, so a
// typo or a re-export that drops a clip degrades quietly.
function resolveLine(entry) {
  const line = typeof entry === "string" ? entry : entry?.text;
  const gesture = typeof entry === "string" ? null : entry?.gesture || null;
  if (!line) return null;
  let missing = false;
  const out = line.replace(/\{(\w+)\}/g, (m, k) => {
    if (greetingContext[k] === undefined || greetingContext[k] === null) {
      missing = true;
      return m;
    }
    return String(greetingContext[k]);
  });
  return missing ? null : { text: out, gesture };
}

function pickGreeting(vendorId, config) {
  const g = config.greetings;
  if (!g) return null;
  const pools = Array.isArray(g) ? { returning: g } : g;
  const visits = vendorVisits(vendorId, true);
  const tier =
    visits <= 1 ? (pools.first?.length ? "first" : "returning")
    : visits >= FREQUENT_VISITS && pools.frequent?.length ? "frequent"
    : "returning";
  // Regulars still hear the plain pool sometimes so it doesn't wear out.
  const raw = tier === "frequent" && Math.random() < 0.4
    ? [...pools.frequent, ...(pools.returning || [])]
    : (pools[tier] || pools.returning || []);
  const lines = raw.map(resolveLine).filter(Boolean);
  if (!lines.length) return null;
  const lastKey = `${vendorId}:${tier}`;
  const last = state.lastGreetingIdx[lastKey];
  let idx = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && idx === last) idx = (idx + 1) % lines.length;
  state.lastGreetingIdx[lastKey] = idx;
  return lines[idx];   // { text, gesture }
}

function speakNow(text, voice) {
  const win = w();
  if (!win || typeof win.sayText !== "function") return;
  try {
    if (typeof win.setPlayerVolume === "function") win.setPlayerVolume(7);
    win.sayText(text, voice.voice, voice.lang, voice.engine);
  } catch (e) {}
}

// Called by VendorSitePalHost's vh_sceneLoaded once the (possibly swapped)
// scene is up — speaks whatever activateVendorSitePal staged, holding the
// line until the greeting delay has elapsed.
export function speakPendingVendorLine() {
  const win = w();
  if (!win || !state.pending) return;
  if (state.desiredVolume <= 0) return;
  if (win.__vendorSitePalCurrentSceneId !== state.pending.sceneId) {
    // The scene that just finished is not the staged vendor's. That is the
    // lazy-embed case: the stall was entered while the player was still
    // booting its first scene, so activateVendorSitePal could not ask for the
    // swap itself. Ask now; the next vh_sceneLoaded lands here again with a
    // matching scene and the line goes out. Guarded so a swap already in
    // flight is not requested twice.
    if (win.__vendorSitePalSceneLoaded === true && typeof win.loadSceneByID === "function") {
      win.__vendorSitePalSceneLoaded = false;
      try { win.loadSceneByID(state.pending.sceneId); } catch (e) {}
    }
    return;
  }
  const wait = state.speakNotBefore - Date.now();
  if (wait > 0) {
    if (state.speakTimer) clearTimeout(state.speakTimer);
    state.speakTimer = setTimeout(() => {
      state.speakTimer = null;
      speakPendingVendorLine();
    }, wait);
    return;
  }
  const { text, voice, gesture } = state.pending;
  state.pending = null;
  // Set BEFORE speaking: SitePal's vh_talkStarted can fire synchronously off
  // sayText, and notifyVendorTalk reads this to tell the model which clip to
  // play. Setting it after would race and the gesture would be missed.
  state.gesture = gesture;
  if (text) speakNow(text, voice);
}

// Ask the page-level host to boot the SitePal player. On touch devices the
// host no longer embeds at page load (the player is ≈290 MB of page-process
// memory on an iPad Pro, paid by every visitor whether or not they ever reach
// the strip — measured 2026-09-02); it embeds the first time something wants
// it: the walker coming within reach of a stall, or a stall being entered.
// Idempotent, and a no-op wherever the host embedded eagerly.
export function requestVendorSitePalEmbed(reason) {
  const win = w();
  if (!win || win.__vendorSitePalEmbedded) return;
  win.__vendorSitePalWanted = true;
  try { win.dispatchEvent(new CustomEvent("vendor-sitepal-wanted", { detail: { reason } })); } catch (e) {}
}

// Pre-warm from a tap that is NOT yet a stall entry — the phone's BOARDWALK
// tab and its postcard row. On touch the host embeds lazily, so without this
// the first STEP UP would be the boot: the player would not exist inside that
// gesture, saySilent(0) could not prime iOS audio, and the first greeting
// would be blocked. (The desktop/iPad get the same warm-up from the walker
// nearing a stall.) Idempotent and cheap once the player is up.
export function warmVendorSitePal(reason) {
  const win = w();
  if (!win) return;
  requestVendorSitePalEmbed(reason);
  unlockAudio(win);
  if (typeof win.saySilent === "function") { try { win.saySilent(0); } catch (e) {} }
}

// Focus a vendor: raise volume, stage a greeting, swap scenes if needed.
// Speaks immediately when the right scene is already loaded.
// A config flagged sceneBroken (see the chapel) must never reach loadSceneByID:
// a scene the player cannot start wedges the whole host for the page lifetime.
function sceneUsable(vendorId, config) {
  if (!config?.sceneBroken) return true;
  const win = w();
  if (win && !win.__vendorSitePalBrokenWarned?.[vendorId]) {
    win.__vendorSitePalBrokenWarned = { ...(win.__vendorSitePalBrokenWarned || {}), [vendorId]: true };
    console.warn("[vendorSitePal] " + vendorId + ": SitePal scene " + config.sceneId + " is flagged sceneBroken — not loading it (see VENDOR_SITEPAL_CONFIG)." );
  }
  return false;
}

export function activateVendorSitePal(vendorId) {
  const win = w();
  const config = VENDOR_SITEPAL_CONFIG[vendorId];
  if (!win || !config || !sceneUsable(vendorId, config)) return;
  // A lazily-embedded host boots now; vh_sceneLoaded then speaks the staged
  // line once the vendor's scene is up (the pending mechanism below).
  requestVendorSitePalEmbed("activate:" + vendorId);
  try {
    state.desiredVolume = 7;
    state.activeVendorId = vendorId;
    win.__vendorSitePalDesiredVolume = 7;
    state.speakNotBefore = Date.now() + GREETING_DELAY_MS;
    if (state.speakTimer) { clearTimeout(state.speakTimer); state.speakTimer = null; }
    // This runs inside the stall click/tap — the one user gesture we get.
    // Unlock browser audio and prime SitePal's pipeline while it lasts.
    unlockAudio(win);
    // saySilent(0) is the framework-page audio-activation primer (iOS).
    if (typeof win.saySilent === "function") { try { win.saySilent(0); } catch (e) {} }
    const picked = pickGreeting(vendorId, config);
    state.pending = {
      vendorId, sceneId: config.sceneId,
      text: picked?.text, gesture: picked?.gesture || null,
      voice: config.voice,
    };
    if (vendorSitePalReady(config.sceneId)) {
      speakPendingVendorLine();
    } else if (
      win.__vendorSitePalSceneLoaded === true &&
      typeof win.loadSceneByID === "function"
    ) {
      win.__vendorSitePalSceneLoaded = false;
      win.loadSceneByID(config.sceneId);
      // vh_sceneLoaded in VendorSitePalHost calls speakPendingVendorLine().
    }
    // else: host still booting — vh_sceneLoaded will pick up the pending line.
  } catch (e) {}
}

// Bring a vendor's scene up WITHOUT staging a line — the season photo wants the
// crew's face on the workers, silent, with an expression (2026-09-30). Runs
// inside the photo click, so the embed's gesture rules are satisfied.
export function primeVendorSitePal(vendorId) {
  const win = w();
  const config = VENDOR_SITEPAL_CONFIG[vendorId];
  if (!win || !config || !sceneUsable(vendorId, config)) return false;
  requestVendorSitePalEmbed("prime:" + vendorId);
  try {
    if (state.speakTimer) { clearTimeout(state.speakTimer); state.speakTimer = null; }
    state.activeVendorId = vendorId;
    // Same staging as a greeting, with NO text: speakPendingVendorLine then only
    // brings the scene up — it asks the host for the swap once it has booted or
    // finished whatever scene it is on (the lazy-embed case activate handles the
    // same way), and clears the pending without speaking. The volume must be > 0
    // for that path to run; nothing is said, so nothing is heard.
    state.desiredVolume = 7; win.__vendorSitePalDesiredVolume = 7;
    state.speakNotBefore = Date.now();
    state.pending = { vendorId, sceneId: config.sceneId, text: null, gesture: null, voice: config.voice };
    if (vendorSitePalReady(config.sceneId)) speakPendingVendorLine();
    else if (win.__vendorSitePalSceneLoaded === true && typeof win.loadSceneByID === "function") {
      win.__vendorSitePalSceneLoaded = false;
      win.loadSceneByID(config.sceneId);
      // vh_sceneLoaded → speakPendingVendorLine() → scene matches → pending cleared, no line
    }
    // else: host still booting — vh_sceneLoaded picks the pending up and asks for the swap
  } catch (e) {}
  return true;
}

// setFacialExpression("OpenSmile" | "ClosedSmile" | "Sad" | "Angry" | "Fear" |
// "Disgust" | "Surprise" | "None", amplitude 0..1, duration s | -1) — 3D
// characters only (docs/sitepal.md); a 2D scene ignores it. True when the
// call was made.
export function setVendorExpression(expression = "None", amplitude = 0.8, durationS = 5) {
  const win = w();
  if (!win || typeof win.setFacialExpression !== "function") return false;
  try {
    if (expression === "None") win.setFacialExpression("None");
    else win.setFacialExpression(expression, amplitude, durationS);
    return true;
  } catch (e) { return false; }
}

// Speak one explicit line as `vendorId` (the crew's briefing, one line per
// gesture) — same staging as a greeting, no delay, scene swapped if needed.
// activateVendorSitePal(vendorId) should have run inside the tap that started
// the conversation (audio unlock + embed); this just queues the words.
export function speakVendorText(vendorId, text, gesture = null) {
  const win = w();
  const config = VENDOR_SITEPAL_CONFIG[vendorId];
  if (!win || !config || !text || !sceneUsable(vendorId, config)) return false;
  requestVendorSitePalEmbed("speak:" + vendorId);
  state.desiredVolume = 7;
  state.activeVendorId = vendorId;
  win.__vendorSitePalDesiredVolume = 7;
  // Keep a still-pending activation delay: the first line after activateVendorSitePal() waits
  // out GREETING_DELAY_MS like a greeting would, so it does not land on top of the saySilent(0)
  // primer and get swallowed (2026-09-12). Later lines find the delay in the past and go at once.
  if (state.speakTimer) { clearTimeout(state.speakTimer); state.speakTimer = null; }
  state.pending = { vendorId, sceneId: config.sceneId, text, gesture, voice: config.voice };
  if (vendorSitePalReady(config.sceneId)) speakPendingVendorLine();
  else if (win.__vendorSitePalSceneLoaded === true && typeof win.loadSceneByID === "function") {
    win.__vendorSitePalSceneLoaded = false;
    try { win.loadSceneByID(config.sceneId); } catch (e) {}
  }
  return !!win.__vendorSitePalEmbedded || !!win.__vendorSitePalWanted;
}
export function vendorSitePalActiveId() { return state.activeVendorId; }
if (typeof window !== "undefined") window.__crewSitePalConfig = VENDOR_SITEPAL_CONFIG.crew;   // dev: tune skinSample/skinTarget from the console

// Unfocus: mute, stop anything in flight, drop staged speech. stopSpeech()
// cannot cancel speech that hasn't STARTED, which is why pending is cleared.
export function deactivateVendorSitePal() {
  const win = w();
  if (!win) return;
  state.pending = null;
  state.gesture = null;
  if (state.speakTimer) { clearTimeout(state.speakTimer); state.speakTimer = null; }
  state.speakNotBefore = 0;
  state.desiredVolume = 0;
  // Return the character to idle even if no SitePal end-callback lands
  // (stopSpeech mid-line doesn't always fire one).
  notifyVendorTalk(false);
  win.__vendorSitePalDesiredVolume = 0;
  try { if (typeof win.setPlayerVolume === "function") win.setPlayerVolume(0); } catch (e) {}
  try { if (typeof win.stopSpeech === "function") win.stopSpeech(); } catch (e) {}
}

export function vendorSitePalDesiredVolume() {
  return state.desiredVolume;
}
