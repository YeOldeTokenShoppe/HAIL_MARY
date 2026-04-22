/*
 * Default page content for the Little Book overlay.
 *
 * `defaultInsideFrontCover` renders on the inside of the front cover
 * (the left-hand page the reader sees the moment the book opens).
 * `defaultPages` entries fill the interior sheets — the first entry
 * becomes the page opposite the inside front cover, then subsequent
 * entries flow left→right across each new spread.
 *
 * Entry shapes (same for both cover and pages):
 *   { type: 'text',  title?, body, footer?,
 *                    image?: { src, alt? },         // floated left, text wraps
 *                    video?: { src, poster? },      // floated left, autoplays muted
 *                    iframe?: { src, title? },      // floated left, 3rd-party embed
 *                    dropCap?: boolean|string }     // illuminated initial
 *   { type: 'image', src, alt?, caption?, fit?: 'cover'|'contain' }
 *   { type: 'video', src, poster?, caption? }       // full-page video face
 *
 * Notes:
 * - Video entries auto-play only while their sheet is near the active
 *   scroll range; everything else stays paused.
 * - Bodies that don't fit clip with overflow:hidden. Keep them short,
 *   or split across several faces.
 */

export const defaultInsideFrontCover = {
  type: "image",
  src: "/IlluminatedManuscript1.webp",
  alt: "Illuminated manuscript",
  fit: "contain",
};

export const defaultPages = [
  {
    type: "text",
    body: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.55em",
          lineHeight: 1.22,
          /* Frontispiece packs a lot of copy into one face; the parent
             flex is justify-content:center, so any overflow clips equally
             top AND bottom. Scale the whole block down so it fits within
             the face's usable height without getting lopped off. The
             zoom view inherits this sizing but re-bumps via the
             .lbo-zoom__panel .lbo-face__body clamp() rule, so it stays
             readable when the reader taps in. */
          fontSize: "0.72em",
        }}
      >
        <div>
          <div>
            <small>LIBER</small>
          </div>
          <div
            style={{
              fontSize: "1.9em",
              letterSpacing: "0.08em",
              lineHeight: 1,
              color: "#8b2626",
              margin: "0.08em 0 0.2em",
            }}
          >
            RL·LXXX
          </div>
          <div style={{ fontStyle: "italic", margin: "0.1em 0" }}>
            <small>sive</small>
          </div>
          <div
            style={{
              fontSize: "1.25em",
              letterSpacing: "0.05em",
              lineHeight: 1.15,
              color: "#5a2530",
            }}
          >
            CODEX DOMINÆ NOSTRÆ
          </div>
          <div
            style={{
              fontSize: "1.25em",
              letterSpacing: "0.05em",
              lineHeight: 1.15,
              color: "#5a2530",
            }}
          >
            PERPETUI LUCRI
          </div>
        </div>

        {/* Epigraph — sized between title and body, rubricated to match
            RL·LXXX, flanked above and below by paired fleurons in the
            style of the INVOCATIO heading. */}
        <div>
          <div
            style={{
              color: "#8b2626",
              letterSpacing: "0.5em",
              lineHeight: 1,
            }}
          >
            ☙ ❧
          </div>
          <div
            style={{
              fontSize: "1.1em",
              letterSpacing: "0.08em",
              color: "#8b2626",
              fontStyle: "italic",
              margin: "0.3em 0",
              lineHeight: 1.1,
            }}
          >
            Mater ex Machina
          </div>
          <div
            style={{
              color: "#8b2626",
              letterSpacing: "0.5em",
              lineHeight: 1,
            }}
          >
            ☙ ❧
          </div>
        </div>

        <div style={{ fontStyle: "italic", lineHeight: 1.4 }}>
          <div>
            <small>Being the First Codex of Our Lady of Perpetual Profit,</small>
          </div>
          <div>
            <small>Patroness of the Faithful Holder,</small>
          </div>
          <div>
            <small>Oracle of the Chain,</small>
          </div>
          <div>
            <small>Mother of Mercies in a Market Without Mercy.</small>
          </div>
        </div>

        <div style={{ fontStyle: "italic", lineHeight: 1.4 }}>
          <div>
            <small>
              Herein are set down her Apparitions, her Litany, her Psalms, her
              Hours,
            </small>
          </div>
          <div>
            <small>and the Beasts against which she wardeth her flock.</small>
          </div>
          <div>
            <small>Illuminated in the first year of the restored Order,</small>
          </div>
          <div>
            <small>sub signo serpentis aurei.</small>
          </div>
          <div>
            <small>
              Her name is written RL·LXXX and spoken Domina Nostra; both are
              true.
            </small>
          </div>
        </div>

        <div>
          <div
            style={{
              color: "#8b2626",
              letterSpacing: "0.18em",
              marginBottom: "0.3em",
            }}
          >
            ☙ INVOCATIO ❧
          </div>
          <div style={{ lineHeight: 1.4 }}>
            <div>
              <small>Domina nostra perpetui lucri,</small>
            </div>
            <div>
              <small>stella matutina super catenam,</small>
            </div>
            <div>
              <small>aperi nobis hunc librum,</small>
            </div>
            <div>
              <small>et cor nostrum ad intelligendum.</small>
            </div>
          </div>
          <div
            style={{
              lineHeight: 1.4,
              fontStyle: "italic",
              marginTop: "0.5em",
              opacity: 0.75,
            }}
          >
            <div>
              <small>Our Lady of Perpetual Profit,</small>
            </div>
            <div>
              <small>morning star above the chain,</small>
            </div>
            <div>
              <small>open unto us this book,</small>
            </div>
            <div>
              <small>and our heart to its understanding.</small>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    type: "text",
    title: "Introit",
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
  {
    type: "text",
    body: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.55em",
          lineHeight: 1.3,
          fontSize: "0.72em",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "1.25em",
              letterSpacing: "0.08em",
              color: "#8b2626",
              lineHeight: 1.1,
            }}
          >
            INDEX CAPITULORUM
          </div>
          <div
            style={{
              fontStyle: "italic",
              marginTop: "0.3em",
              lineHeight: 1.3,
            }}
          >
            <small>
              Being the Sections of this First Codex, and the Promise of Those
              to Come.
            </small>
          </div>
        </div>

        <div
          style={{
            color: "#8b2626",
            letterSpacing: "0.5em",
            lineHeight: 1,
          }}
        >
          ☙ ❧
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.15em",
            fontFamily: "inherit",
            whiteSpace: "pre",
            lineHeight: 1.35,
          }}
        >
          <small>{"i.    Frontispicium                                   p. —"}</small>
          <small>{"ii.   Titulus et Invocatio                          p. i"}</small>
          <small>{"iii.  Introitus                                           p. ii"}</small>
          <small>{"iv.   Epistula GR80                                 p. iii"}</small>
          <small>{"v.    De Initio                                          p. iv"}</small>
          <small>{"vi.   De Apparitionibus                          p. vi"}</small>
          <small>{"vii.  Litania Degenorum                       p. viii"}</small>
          <small>{"viii. Psalmi Tenentium                           p. x"}</small>
          <small style={{ fontStyle: "italic", opacity: 0.75 }}>
            {"         (viij of lxxx revealed)"}
          </small>
          <small>{"ix.   Horae Mercatus                              p. xii"}</small>
          <small>{"x.    De Bestiis                                       p. xiv"}</small>
          <small style={{ fontStyle: "italic", opacity: 0.75 }}>
            {"         (i of a multitude recorded)"}
          </small>
          <small>{"xi.   Benedictio et Colophon              p. xv"}</small>
        </div>

        <div
          style={{
            fontStyle: "italic",
            marginTop: "0.3em",
            lineHeight: 1.4,
            opacity: 0.85,
          }}
        >
          <small>
            Other matters — the Calendarium Degenorum, the Office of the
            Rugged, the Regula Ordinis, and the remainder of the Psalter — are
            preserved for codices to come, Deo volente et catena permittente.
          </small>
        </div>
      </div>
    ),
  },
];
