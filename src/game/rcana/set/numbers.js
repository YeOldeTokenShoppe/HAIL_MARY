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
  plata: 81, // La Plata (was 85 until 2026-11-21; El Gallo's old number, then the Cult's for a day)
  diamond: 82, // Diamond Hands (took La Vaca's number, 2026-11-21)
  predict: 83, // The Prediction Market (took El Aguacate's number, 2026-11-21; the first printed Location)
  bono: 84, // The Savings Bond — unfaced
  cava: 3, // La Cava — unfaced (took El Ángel's number when the Angel and Shady Lady were cut, 2026-11-15)
  catedral: 4, // La Catedral — unfaced (took La Tramposa's number)
  jardin: 44,
  map: 33,
  mine: 31,
  oil: 34,
  semilla: 37,
  // Events
  bull: 11,
  moon: 49,
  inherit: 8, // The Inheritance — unfaced
  squeeze: 9,
  unlock: 10, // Token Unlock — unfaced
  moneda: 50, // The Airdrop — unfaced
  crash: 38,
  fall: 51, // Fall From Grace — unfaced
  holyroller: 52, // The Holy Roller — unfaced
  fuego: 53, // Nuestra Señora del Fuego — unfaced
  virtual: 54, // The Virtual Mary — unfaced
  feast: 55, // The Feast of Perpetual Profit — unfaced
  techwreck: 48,
  ballena: 24,
  illuminati: 28,
  rueda: 56, // The Wheel — unfaced
  godcandle: 57,
  moralhazard: 59, // Moral Hazard — unfaced
  mardigras: 41,
  // Hazards
  trap: 58, // Liquidity Trap — unfaced (was The World)
  bear: 13,
  hack: 40,
  paperhands: 60, // Paper Hands (added 2026-11-21 as 89; took The Virtue Signal's number the same day, so the set is 88)
  infierno: 61, // El Infierno
  rug: 39,
  taxman: 36,
  escandalo: 46,
  scam: 47,
  // Remedies
  bell: 17,
  catacumbas: 62, // Las Catacumbas — unfaced (was Quantum Resistance)
  talisman: 63, // The Talisman (2026-11-21: The Keys and The Audit merged; it has The Keys' number)
  tortilla: 16,
  publicista: 64, // El Comunicado — unfaced
  whistle: 42, // The Whistleblower (took La Horchata's number, 2026-11-21)
  stimulus: 65, // The Stimulus (took The Burro's number, 2026-11-20)
  // Relics
  heart: 66, // El Corazón — unfaced
  halo: 67, // La Aureola — unfaced
  rosary: 18,
  grail: 68, // The Grail — the graded card in the vault (was the El Cáliz Relic, retired 2026-11-15)
  enigma: 69, // El Enigma — unfaced
  skull: 19,
  perp: 70, // Perpetuals (was 86 until 2026-11-21; took The Shroud's number when the set went to 86)
  rideordie: 35,
  lottery: 71, // El Boleto
  geometry: 72, // Sacred Geometry
  tattoo: 73, // El Tatuaje — unfaced
  dashboard: 74, // La Virgencita — unfaced
  mission: 77, // The Mission (added 2026-11-21; took The Cleansing's number on 2026-11-22)
  pareto: 85, // The 80/20 Rule (added 2026-11-22)
  rewind: 86, // Rewind (added 2026-11-22)
  singular: 87, // The Singular80 (it was always numbered last until Back to the 80s took 88, 2026-11-22)
  eighties: 88, // Back to the 80s — the portal, card 88 of 88 (added 2026-11-22)
  motherboard: 5, // La Placa Madre — unfaced (a Relic since 2026-11-12)
  // Graces
  ofrenda: 75, // La Ofrenda — unfaced
  cherub: 76, // El Exvoto — unfaced
  ponzi: 78, // The Ponzi (was La Pirámide, before that Divine Intervention)
  anima: 79, // Ánima Sola — unfaced
  confession: 80, // La Confesión
  fountain: 25,
  rose: 23,
  lagrimas: 6, // Las Lágrimas — unfaced (took The Neural Cathedral's number)
};

export const numberOf = (key) => RESERVED_NUMBERS[key];
