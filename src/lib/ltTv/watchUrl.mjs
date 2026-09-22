// WHERE YOU WERE WATCHING, written into the address bar.
//
// /trade keeps the whole LT TV position in React state — whether the tab is
// open, whether you are on the lineup or in a show, and which episode. That is
// fine until something navigates: signing in redirects back to /trade, the
// page mounts fresh, and the viewer lands on the trade landing rather than on
// the episode they were halfway through with a comment half typed.
//
// So the position also lives in one query parameter. Nothing navigates to set
// it — it is written with history.replaceState — and on arrival it is read
// back. Any return to /trade, from a sign-in or a bookmark or a link somebody
// sent, comes back to the same seat.
//
// The value is the EPISODE ID in a show ("news-01"), or the SHOW ID on the
// lineup ("news"), which makes it readable and means it is checked against the
// episodes that exist rather than parsed.

export const WATCH_PARAM = "lttv";

/** The parameter value for a position, or null when LT TV is not open. */
export function watchValue({ open, view, showId, episodeId } = {}) {
  if (!open) return null;
  if (view === "set" && episodeId) return episodeId;
  return showId || null;
}

/**
 * A parameter value read back into a position, or null when it names nothing
 * on the slate — a stale link should open LT TV's lineup at worst, never throw
 * the page at an episode that is not there.
 */
export function readWatch(value, shows) {
  if (typeof value !== "string" || !value) return null;
  if (!Array.isArray(shows)) return null;

  for (const show of shows) {
    if (show?.id === value) return { view: "lineup", showId: show.id, episodeIndex: 0 };
  }
  for (const show of shows) {
    const episodes = Array.isArray(show?.episodes) ? show.episodes : [];
    const index = episodes.findIndex((episode) => episode?.id === value);
    if (index >= 0) return { view: "set", showId: show.id, episodeIndex: index };
  }
  return null;
}

/** The current address with the position written into it. Never navigates. */
export function withWatch(search, value) {
  const params = new URLSearchParams(search || "");
  if (value) params.set(WATCH_PARAM, value);
  else params.delete(WATCH_PARAM);
  const query = params.toString();
  return query ? `?${query}` : "";
}
