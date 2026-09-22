// WHAT A VIEWER LEAVES BEHIND ON AN EPISODE — a star rating and a comment.
//
// Everything in this file is pure: no Firestore, no network, no process.env.
// The route modules do the talking to Firestore; the rules about what counts
// as a rating, what counts as a comment, and what a star average becomes when
// somebody changes their mind all live here, where they can be tested without
// a database. scripts/lt-tv-reactions.test.mjs is that test.
//
// WHERE IT LIVES IN FIRESTORE, and why it is shaped this way:
//
//   ltTvEpisodes/{episodeId}                  the public tally
//   ltTvEpisodes/{episodeId}/ratings/{userId} one doc per viewer, private
//   ltTvEpisodes/{episodeId}/comments/{id}    the comments, public
//
// Subcollections rather than one flat collection with an episodeId field,
// because "this episode's comments, newest first" over a flat collection is a
// composite index somebody has to go and create in the Firebase console. In a
// subcollection it is the automatic single-field index, so this ships without
// anyone clicking anything.
//
// The tally is a stored total rather than a count over the ratings: reading
// every rating to draw one star average would cost a read per viewer per
// page load, and the whole point of the tally doc is that the guide can show
// 4.6 (12) for one read.
//
// The rating docs are keyed by the viewer's Clerk user id, which means a
// second rating from the same person REPLACES the first instead of stacking,
// without a query to find the old one.

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const COMMENT_MAX_LEN = 600;
export const NAME_MAX_LEN = 40;

export const EPISODES_COLLECTION = "ltTvEpisodes";
export const RATINGS_SUBCOLLECTION = "ratings";
export const COMMENTS_SUBCOLLECTION = "comments";
export const COMMENT_RATE_COLLECTION = "ltTvCommentRateLimits";

// Same shape as the shrine testimonials guard in src/app/api/testimonials —
// deliberately a separate copy rather than a shared import, so tuning what a
// comment under an episode may say never silently changes what a testimonial
// may say. If both lists drift apart, that is allowed.
const BAD_WORDS = [
  "nigger", "nigga", "faggot", "fag", "tranny", "retard", "retarded",
  "kike", "spic", "chink", "gook", "wetback", "cunt", "cock",
  "rape", "raping", "kys", "kill yourself",
];
const URL_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|co|link|app|finance|fun|lol|cash|gift|money|ai|gg|club|shop|to|me)\b/i;

/**
 * An episode id is checked against the episodes that EXIST, never against a
 * pattern. A pattern says what an id looks like; a list says which ones there
 * are, and only the second one stops a request writing a tally for an episode
 * nobody can watch. Same rule as the studio's action table.
 */
export function isKnownEpisode(id, knownIds) {
  if (typeof id !== "string" || !id) return false;
  if (!Array.isArray(knownIds) && !(knownIds instanceof Set)) return false;
  const list = knownIds instanceof Set ? knownIds : new Set(knownIds);
  return list.has(id);
}

export function validateRating(value) {
  if (value === null) return { ok: true, rating: null }; // clearing a rating
  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(rating))
    return { ok: false, reason: "A rating is one to five stars." };
  if (rating < RATING_MIN || rating > RATING_MAX)
    return { ok: false, reason: "A rating is one to five stars." };
  return { ok: true, rating };
}

export function validateComment(text) {
  const trimmed = (text ?? "").toString().trim();
  if (!trimmed) return { ok: false, reason: "Write something first." };
  if (trimmed.length > COMMENT_MAX_LEN)
    return { ok: false, reason: `Max ${COMMENT_MAX_LEN} characters.` };
  if (URL_RE.test(trimmed))
    return { ok: false, reason: "Links aren't allowed in comments." };
  const lower = trimmed.toLowerCase();
  for (const word of BAD_WORDS) {
    if (lower.includes(word))
      return { ok: false, reason: "That comment was held back." };
  }
  return { ok: true, text: trimmed };
}

export function normaliseName(value) {
  const name = (value ?? "").toString().trim().slice(0, NAME_MAX_LEN);
  return name || "Viewer";
}

function safeCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function safeSum(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The tally after one viewer moves from `previous` stars to `next`, where
 * either may be null (null previous = they had not rated; null next = they
 * took their rating back). Clamps at zero, so a tally that has drifted — a
 * rating deleted straight out of the console, say — recovers upward instead
 * of going negative and showing a nonsense average forever.
 */
export function applyRating(stats, { previous = null, next = null } = {}) {
  let count = safeCount(stats?.count);
  let sum = safeSum(stats?.sum);

  if (previous != null) {
    count = Math.max(0, count - 1);
    sum = Math.max(0, sum - previous);
  }
  if (next != null) {
    count += 1;
    sum += next;
  }
  if (count === 0) sum = 0;

  return { count, sum, average: averageOf(sum, count) };
}

export function applyCommentDelta(stats, delta) {
  return Math.max(0, safeCount(stats?.commentCount) + delta);
}

function averageOf(sum, count) {
  if (!count) return 0;
  return Math.round((sum / count) * 100) / 100;
}

/** What the console draws: the number, the crowd size, and a spoken label. */
export function ratingSummary(stats) {
  const count = safeCount(stats?.count);
  const sum = safeSum(stats?.sum);
  const average = averageOf(sum, count);
  return {
    count,
    average,
    // One decimal on screen; the stored average keeps two so repeated edits
    // don't accumulate rounding.
    display: count ? average.toFixed(1) : "—",
    label: count
      ? `${average.toFixed(1)} out of 5, from ${count} ${count === 1 ? "rating" : "ratings"}`
      : "Not rated yet",
  };
}

/** Comments as the panel wants them: newest first, and never more than max. */
export function sortComments(comments, max = 100) {
  const list = Array.isArray(comments) ? comments.slice() : [];
  list.sort((a, b) => (toMillis(b?.createdAt) - toMillis(a?.createdAt)));
  return list.slice(0, max);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
