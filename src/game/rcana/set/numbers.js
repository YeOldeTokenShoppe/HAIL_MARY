// R-cana set numbers — one reserved number per design, 1 to RCANA_SET_SIZE.
//
// A face entry (set/faces.js) prints its `number`; rcana:lint checks that it
// matches the reservation here, so numbers are not handed out ad hoc as art
// arrives. The 40 faces rendered by 2026-11-12 keep the provisional
// numbers they already print (7–49, scattered by row, lotería-fashion); the
// rest were dealt the open slots (1–6, 8–10, 50–80) in row order. Rarity is
// deferred: every new face is Common until the set earns tiers.
//
// Numbers are an index, not a code: the type badge says the row.
export const RESERVED_NUMBERS = {
  // Traders
  unicornio: 20,
  gato: 21,
  investigadora: 26,
  monje: 12,
  diablito: 7,
  celebridad: 29,
  abuela: 15,
  prospector: 27,
  general: 1, // El General — unfaced
  bot: 2, // El Robot — unfaced
  // Assets
  tech: 14,
  meme: 22,
  nacimiento: 30, // El Nacimiento (was Collectibles, whose face keeps its art for a later set)
  realestate: 32,
  stablecoin: 43,
  bluechip: 45,
  plata: 80, // Quicksilver (La Plata): card 80 for element 80, mercury (2026-11-23; it traded numbers with Coin-op Confession)
  garth: 82, // Garth Raider (2026-11-26; Diamond Hands's old number)
  predict: 83, // The Prediction Market (took El Aguacate's number, 2026-11-21; the first printed Location)
  bono: 84, // The Savings Bond — unfaced
  cava: 3, // La Cava — unfaced (took El Ángel's number when the Angel and Shady Lady were cut, 2026-11-15)
  catedral: 4, // La Catedral (took La Tramposa's number)
  jardin: 44, // Dividend Stock (Yield Farm until 2026-11-26)
  index: 33, // Index Fund (2026-11-26; Treasure Map's old number)
  mine: 31,
  oil: 34,
  semilla: 37,
  // Events
  bull: 11,
  moon: 49,
  inherit: 8, // The Inheritance
  squeeze: 9,
  unlock: 10, // The Sell-Off (Token Unlock until 2026-11-26)
  moneda: 50, // The Airdrop
  crash: 38,
  fall: 51, // Fall From Grace
  holyroller: 52, // The Holy Roller — unfaced
  fuego: 53, // Nuestra Señora del Fuego — unfaced
  virtual: 54, // The Virtual Mary — unfaced
  feast: 55, // The Feast of Perpetual Profit
  techwreck: 48,
  ballena: 24,
  illuminati: 28,
  rueda: 56, // The Wheel
  godcandle: 57,
  moralhazard: 59, // Moral Hazard
  mardigras: 41,
  // Hazards
  trap: 58, // Liquidity Trap (was The World)
  bear: 13,
  hack: 40,
  junk: 60, // Junk Bond (2026-11-26; Paper Hands's old number)
  infierno: 61, // El Infierno
  rug: 39,
  taxman: 36,
  escandalo: 46,
  scam: 47,
  // Remedies
  goldbar: 17, // Gold Bar (2026-11-26; The Bell's old number)
  catacumbas: 62, // Las Catacumbas (faced 2026-11-25; was Quantum Resistance)
  talisman: 63, // Pocket Saint, The Talisman until 2026-11-25 (2026-11-21: The Keys and The Audit merged; it has The Keys' number)
  tortilla: 16,
  short: 42, // The Short (2026-11-26; The Whistleblower's old number, La Horchata's before her)
  stimulus: 65, // The Stimulus (took The Burro's number, 2026-11-20)
  // Relics
  heart: 66, // El Corazón
  swan: 67, // The Black Swan (added 2026-11-23; The Halo's old number)
  rosary: 18,
  grail: 68, // The Grail — the graded card in the vault (was the El Cáliz Relic, retired 2026-11-15)
  porkbellies: 69, // Pork Bellies (2026-11-26; Enigma Machine's old number)
  skull: 19,
  perp: 70, // Perpetuals (was 86 until 2026-11-21; took The Shroud's number when the set went to 86)
  rideordie: 35,
  lottery: 71, // El Boleto
  fineart: 72, // Fine Art (2026-11-26; Sacred Geom8ry's old number)
  tattoo: 73, // El Tatuaje — unfaced
  dashboard: 74, // La Virgencita
  racehorse: 77, // Racehorse (2026-11-26; The Mission's old number)
  special: 85, // Special Offer (2026-11-25; The 80/20 Rule's old number)
  rewind: 86, // Rewind (added 2026-11-22)
  singular: 87, // The Singular80 (it was always numbered last until Back to the 80s took 88, 2026-11-22)
  pawn: 64, // Pawn Shop (added 2026-11-23; The Press Release's old number)
  eighties: 88, // Back to the 80s — the portal, card 88 of 88 (added 2026-11-22)
  motherboard: 5, // La Placa Madre (a Relic since 2026-11-12)
  // Graces
  ofrenda: 75, // La Ofrenda
  cherub: 76, // El Exvoto
  ponzi: 78, // The Ponzi (was La Pirámide, before that Divine Intervention)
  anima: 79, // Ánima Sola — unfaced
  confession: 81, // La Confesión (80 until 2026-11-23, when Quicksilver took it)
  fountain: 25,
  rose: 23,
  visitor: 6, // The Visitor (added 2026-11-23; The Tears' old number)
};

export const numberOf = (key) => RESERVED_NUMBERS[key];
