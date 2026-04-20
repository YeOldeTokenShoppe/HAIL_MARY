/*
 * Default page content for the Little Book overlay.
 *
 * Each entry = ONE page face (one side of a paper sheet). The overlay
 * groups entries into sheets in order: entries 0+1 form sheet 1,
 * entries 2+3 form sheet 2, and so on. Append to extend the book.
 *
 * Entry shapes:
 *   { type: 'text',  title?, body, footer?,
 *                    image?: { src, alt? },         // floated left, text wraps
 *                    video?: { src, poster? },      // floated left, autoplays muted
 *                    dropCap?: boolean|string }     // illuminated initial
 *   { type: 'image', src, alt?, caption? }
 *   { type: 'video', src, poster?, caption? }       // full-page video face
 *
 * Notes:
 * - Video entries auto-play only while their sheet is near the active
 *   scroll range; everything else stays paused.
 * - Bodies that don't fit clip with overflow:hidden. Keep them short,
 *   or split across several faces.
 */

export const defaultPages = [
  {
    type: "text",
    title: "Introit",
    body: "Blessed is the bagholder, for he shall inherit the bid.",
    footer: "— Liber Parvus, i.",
  },
  {
    type: "text",
    body: (
      <>
        Domina nostra perpetui lucri,
        <br />
        ora pro nobis peccatoribus.
      </>
    ),
    footer: "— Litania Degenorum",
  },
  {
    type: "text",
    title: "De Initio",
    dropCap: true,
    image: {
      src: "/carousel_images/img1.jpg",
      alt: "A sign of the shrine",
    },
    body:
      "In the beginning was the Bid, and the Bid was with the Bagholder, " +
      "and the Bid was the Bagholder. All things were minted through it, " +
      "and without it not any thing was minted that was minted. In the " +
      "Bid was liquidity, and the liquidity was the light of traders; " +
      "and the light shineth in the darkness of the mempool, and the " +
      "darkness comprehended it not.",
    footer: "— Liber Parvus, ii.",
  },
  {
    type: "text",
    title: "Salutatio",
    dropCap: true,
    video: {
      src: "/videos/gr80_greetings.mp4",
    },
    body:
      "Greetings, faithful, from the saint of the order. Hear his witness " +
      "and take heart: the bid returns to those who keep the vigil, and " +
      "the bag is light for those who believe. Though the candle gutter " +
      "and the charts swoon, the ledger remembers every flame.",
    footer: "— Epistula GR80",
  },
  { type: "text", body: "Page 5 placeholder" },
  { type: "text", body: "Page 6 placeholder" },
  { type: "text", body: "Page 7 placeholder" },
  { type: "text", body: "Page 8 placeholder" },
  { type: "text", body: "Page 9 placeholder" },
  { type: "text", body: "Page 10 placeholder" },
  { type: "text", body: "Page 11 placeholder" },
  { type: "text", body: "Page 12 placeholder" },
  { type: "text", body: "Page 13 placeholder" },
  { type: "text", body: "Page 14 placeholder" },
  { type: "text", body: "Page 15 placeholder" },
  { type: "text", body: "Page 16 placeholder" },
  { type: "text", body: "Page 17 placeholder" },
  { type: "text", body: "Page 18 placeholder" },
  { type: "text", body: "Page 19 placeholder" },
  { type: "text", body: "Page 20 placeholder" },
];
