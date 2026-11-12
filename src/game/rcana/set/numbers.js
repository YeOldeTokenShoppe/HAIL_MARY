// R-cana set numbers — one reserved number per design, 1 to 80.
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
  angel: 3, // El Ángel — unfaced
  shady: 4, // La Tramposa — unfaced
  // Assets
  tech: 14,
  meme: 22,
  collectibles: 30,
  motherboard: 5, // The Motherboard — unfaced
  realestate: 32,
  cathedral: 6, // The Neural Cathedral — unfaced
  stablecoin: 43,
  bluechip: 45,
  jardin: 44,
  map: 33,
  mine: 31,
  oil: 34,
  semilla: 37,
  // Events
  bull: 11,
  moon: 49,
  inherit: 8, // The Inheritance — unfaced
  squeeze: 9, // Short Squeeze — unfaced
  unlock: 10, // Token Unlock — unfaced
  moneda: 50, // Pay Day — unfaced
  crash: 38,
  fall: 51, // Fall From Grace — unfaced
  holyroller: 52, // The Holy Roller — unfaced
  fuego: 53, // Nuestra Señora en Fuego — unfaced
  virtual: 54, // The Virtual Mary — unfaced
  feast: 55, // The Feast of Perpetual Profit — unfaced
  techwreck: 48,
  ballena: 24,
  illuminati: 28,
  rueda: 56, // The Wheel — unfaced
  godcandle: 57, // The God Candle — unfaced
  world: 58, // The World — unfaced
  moralhazard: 59, // Moral Hazard — unfaced
  mardigras: 41,
  // Hazards
  bear: 13,
  hack: 40,
  virtue: 60, // The Virtue Signal — unfaced
  infierno: 61, // El Infierno — unfaced
  rug: 39,
  taxman: 36,
  escandalo: 46,
  scam: 47,
  // Remedies
  bell: 17,
  resist: 62, // La Resistencia — unfaced
  keys: 63, // Las Llaves — unfaced
  tortilla: 16,
  publicista: 64, // El Comunicado — unfaced
  horchata: 42,
  burro: 65, // El Burro — unfaced
  // Relics
  heart: 66, // El Corazón — unfaced
  halo: 67, // La Aureola — unfaced
  rosary: 18,
  grail: 68, // El Cáliz — unfaced
  enigma: 69, // El Enigma — unfaced
  skull: 19,
  shroud: 70, // El Sudario — unfaced
  rideordie: 35,
  lottery: 71, // El Boleto — unfaced
  geometry: 72, // La Geometría — unfaced
  tattoo: 73, // El Tatuaje — unfaced
  dashboard: 74, // La Virgencita — unfaced
  // Graces
  ofrenda: 75, // La Ofrenda — unfaced
  cherub: 76, // El Exvoto — unfaced
  intercession: 77, // La Intercesión — unfaced
  intervention: 78, // La Intervención — unfaced
  anima: 79, // Ánima Sola — unfaced
  confession: 80, // La Confesión — unfaced
  fountain: 25,
  rose: 23,
};

export const numberOf = (key) => RESERVED_NUMBERS[key];
