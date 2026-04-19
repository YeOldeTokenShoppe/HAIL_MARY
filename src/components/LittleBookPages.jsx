/*
 * Default page content for the Little Book overlay.
 *
 * Each entry = ONE page face (one side of a paper sheet). The overlay
 * groups entries into sheets in order: entries 0+1 form sheet 1,
 * entries 2+3 form sheet 2, and so on. Append to extend the book.
 *
 * Entry shapes:
 *   { type: 'text',  title?, body, footer? }   // title/body/footer accept ReactNode
 *   { type: 'image', src, alt?, caption? }
 *   { type: 'video', src, poster?, caption? }  // must be muted-playable on iOS
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
  { type: "text", body: "Page 3 placeholder" },
  { type: "text", body: "Page 4 placeholder" },
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
