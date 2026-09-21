// THE LT TV SLATE. Every episode is one JSON record under ./episodes, and a
// record is the whole episode: what the guide shows (title, summary, air date)
// AND what the set plays (the SitePal clip names, the line starts, who holds
// each line, the reaction cues). Nothing about an episode lives in a component
// any more, so adding next week's show is adding a file here rather than
// editing TalkShowScene and overwriting the episode that was there.
//
// TO ADD AN EPISODE
//   1. Drop its JSON in ./episodes (elevenlabs-dialogue-test writes most of it
//      — see docs/talk-show-production.md).
//   2. Add the import and the EPISODE_RECORDS entry below. That one line is
//      the only code edit; bundlers can't glob a directory at build time.
// Order in EPISODE_RECORDS is the order the guide lists them, per show.
//
// A record with no `audio` is `status: "planned"`: it is listed in the guide
// and cannot be played, which is how a slate entry announces a show that has
// not been recorded yet instead of quietly replaying another episode.
import showsFile from "./shows.json";
import roundtable01 from "./episodes/roundtable-01.json";
import roundtable02 from "./episodes/roundtable-02.json";
import roundtable03 from "./episodes/roundtable-03.json";
import roundtable04 from "./episodes/roundtable-04.json";
import roundtable05 from "./episodes/roundtable-05.json";
import roundtable06 from "./episodes/roundtable-06.json";
import news01 from "./episodes/news-01.json";

import { formatRuntime, episodeIsPlayable } from "@/lib/ltTv/episodeTimeline.mjs";

const EPISODE_RECORDS = [
  roundtable01,
  roundtable02,
  roundtable03,
  roundtable04,
  roundtable05,
  roundtable06,
  news01,
];

// Runtime is DERIVED, not typed: it's the end of the dialogue the record
// carries, so the guide can't advertise a length the recording doesn't have.
// A record may still override it (a trailer, a rough cut) with `runtime`.
function decorate(record) {
  const playable = episodeIsPlayable(record);
  return {
    ...record,
    playable,
    status: record.status || (playable ? "published" : "planned"),
    runtime:
      record.runtime ||
      (playable ? formatRuntime(record.dialogueEnd) : null),
  };
}

export const EPISODES = EPISODE_RECORDS.map(decorate);

export const EPISODES_BY_ID = Object.fromEntries(
  EPISODES.map((episode) => [episode.id, episode]),
);

// A show carries its own episodes, in slate order. A show with none is listed
// in the guide as Coming soon.
export const SHOWS = showsFile.shows.map((show) => ({
  ...show,
  episodes: EPISODES.filter((episode) => episode.showId === show.id),
}));

export function findShow(showId) {
  return SHOWS.find((show) => show.id === showId) || SHOWS[0];
}

// The episode the panel, the scene and the channel card should all be looking
// at, for a (show, index) selection. Falls back to the show's first episode so
// a stale index can never leave the set without a record.
export function findEpisode(showId, episodeIndex = 0) {
  const show = findShow(showId);
  return show.episodes[episodeIndex] || show.episodes[0] || null;
}
