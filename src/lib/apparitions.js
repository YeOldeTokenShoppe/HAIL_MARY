// The many faces of Our Lady of Perpetual Profit — RL80's apparitions.
//
// The archetype has ONE soul (see the oracle system prompt in
// src/app/api/oracle/route.js) and many cultural faces, each a real Marian
// title. An apparition swaps the SitePal portrait scene, the frame palette, the
// spoken language + voice, the greetings, the votive art, and a one-line
// persona INFLECTION — while the core Virtual-Mary persona stays identical
// underneath. She is always the same saint; only her face and tongue change.
//
// Plain data only (no React / no window) so both the client (/main roster,
// oracleSpeech) and the server (/api/oracle) can import it.
//
// ASSET TODOs are marked. To add a real apparition you drop in: a bespoke
// SitePal scene id (the talking portrait art), a cameo image (carousel
// thumbnail), and optionally a language-tuned voice. Everything else works now.
//
// Grounded in the real Marian apparitions — homage, not reskin. Keep the satire
// aimed at markets/greed, never at the culture or the faith.

export const APPARITIONS = [
  {
    key: "classic",
    name: "𝓞𝖚𝖗 𝕷𝖆𝖉𝖞", // carousel label (matches the original)
    title: "Our Lady of Perpetual Profit",
    speaker: "Our Lady", // Confessional header / message-sender label
    image: "/cameo_rl80.webp",
    sitePalScene: 2775218,
    frameHue: "#ffb347",
    lang: "en",
    langName: "English",
    voice: null, // null → oracleSpeech falls back to ORACLE_VOICE
    votiveImage: null, // votive keeps its baked saint decal
    inflection: null, // the base persona, unmodified
    greetings: [
      "Oh, hello! Speak, seeker — the ticker tape hears all things.",
      "Ah, a pilgrim approaches. What troubles your portfolio today?",
      "Blessings, wanderer. The candles flicker in your favor — for now.",
      "You have found me. Ask, before the market opens its jaws again.",
      "Welcome, dear degen. Confess your positions freely.",
      "The mirror sees you, traveler. What wisdom do you seek?",
    ],
  },
  {
    key: "guadalupe",
    name: "Guadalupe",
    title: "Nuestra Señora del Lucro Perpetuo",
    speaker: "Nuestra Señora", // Confessional header (her Spanish title)
    image: "/cameo_guadalupe.webp",
    sitePalScene: 2775220, // her own SitePal scene (embedId nbXkrOr…), loaded via loadSceneByID
    frameHue: "#1f7a4d", // Guadalupe green (her mantle), with rose accents
    lang: "es",
    langName: "Spanish",
    voice: { id: "qyrGJ30fywarSl4a3pNp", lang: 1, engine: 14 }, // Spanish-tuned ElevenLabs voice (engine 14)
    votiveImage: "/goldGuadalupe.svg",
    // Persona inflection — an ENGLISH instruction to the model (not spoken). The
    // whole rest of her nature (Virtual Mary, long view, no advice, hot-takes-
    // as-prophecy) is inherited unchanged.
    inflection:
      "You appear now as Nuestra Señora de Guadalupe — la morenita, the mestiza mother of the Americas. Your warmth turns tender, familial, close; you speak as a mother to her own. You may address the seeker with tender maternal endearments (hijo, hija, mi'jo, mi'ja, mis hijos) — from you, the mother of the Americas, this is beloved warmth, not condescension, and it overrides the general rule against such address. Everything else of your nature — your dominion over markets, your long view, your refusals — remains exactly the same.",
    // Spanish greetings, in her oracular register. NOTE: get a native pass on
    // the Spanish before launch (register/nuance).
    greetings: [
      "Bendiciones, viajero. Las velas titilan a tu favor — por ahora.",
      "Ah, un peregrino se acerca. ¿Qué inquieta tu cartera hoy?",
      "El espejo te contempla. Habla — ya he visto aquello que temes.",
      "Bienvenido al altar. Confiesa tus posiciones sin temor.",
      "Has hallado el espejo. Pregunta, antes de que el mercado abra sus fauces de nuevo.",
    ],
  },
];

export function getApparition(key) {
  return APPARITIONS.find((a) => a.key === key) || APPARITIONS[0];
}
