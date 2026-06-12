// Two-way sync channel between the phone feed (WatchlistPhoneTexture)
// and the chamber's hand animation (MaryChamber). Module-level signal:
// same long-distance pattern as candleIgnitionPulse / chamberFocus.
//
// feed → chamber: the auto-scroll phase, published each frame, so the
// hand knows when to gesture and when to rest. Phases mirror the feed's
// own state machine:
//   'pausing' | 'scrolling' | 'bottom_pause' | 'scrolling_up'
//
// chamber → feed: flick impulses. When external drive is ON (chamber
// mounted), the feed's 'scrolling' phase stops its continuous glide and
// advances ONLY when an impulse arrives — each of her thumb flicks
// pushes a chunk of feed-pixels, and the feed's smooth-lerp turns the
// jump into a momentum coast. Drive is switched off on chamber unmount
// so /illumin80's mount keeps the original continuous auto-scroll.
let state = { phase: "pausing" };
let externalDrive = false;
let pendingFlickPx = 0;

export function publishPhoneScroll(phase) {
  state.phase = phase;
}

export function getPhoneScroll() {
  return state;
}

export function setPhoneScrollExternalDrive(on) {
  externalDrive = on;
  if (!on) pendingFlickPx = 0;
}

export function isPhoneScrollExternalDrive() {
  return externalDrive;
}

export function requestPhoneScrollFlick(px) {
  pendingFlickPx += px;
}

export function consumePhoneScrollFlick() {
  const px = pendingFlickPx;
  pendingFlickPx = 0;
  return px;
}
