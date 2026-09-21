"use client";
// "NEW EPISODE" IN THE GUIDE, FOR BOTH PLATFORMS.
//
// The rule itself lives in the timeline module next to `episodeIsPlayable`,
// because it is a fact about a record rather than about a component. What is
// here is the one thing a component has to get right: WHEN the clock is read.
//
// An episode is new relative to now, and `now` differs between the server that
// renders the HTML and the browser that hydrates it. Resolving it during
// render means React compares a badge drawn against build time with one drawn
// against the viewer's clock, which is a hydration mismatch — and on a
// statically rendered page the served HTML would carry whichever week the
// build happened in, forever. So the clock is read in an effect and the badge
// appears on the first paint after mount, a frame later than the rest of the
// guide and always right.
import { useEffect, useMemo, useState } from "react";
import { isNewEpisode, isBadgePreview } from "@/lib/ltTv/episodeTimeline.mjs";

/**
 * `{ isNew(episode), showHasNew(show) }` — both false until mounted.
 *
 * `showHasNew` is what the channel menu's show rows need: a viewer scanning
 * the guide wants to know which SHOW to open, and asking each show whether any
 * of its episodes is new answers that without expanding it.
 */
export default function useNewEpisodes() {
  const [now, setNow] = useState(null);
  // Read in the same effect as the clock, and for the same reason: the query
  // string is not knowable while the server renders.
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    try {
      setPreview(isBadgePreview(window.location.search));
    } catch {
      /* no window, or a search string that will not parse — no preview */
    }
  }, []);

  return useMemo(() => {
    const isNew = (episode) => {
      if (!episode) return false;
      // ?preview=new badges everything listed, so the badge can be looked at
      // on a slate that has nothing recent on it. See isBadgePreview.
      if (preview) return true;
      return now === null ? false : isNewEpisode(episode, now);
    };
    return {
      isNew,
      // A show with no episodes has nothing new even in preview: "Coming soon"
      // and "New" on the same row would be a lie in both directions.
      showHasNew: (show) => (show?.episodes || []).some(isNew),
    };
  }, [now, preview]);
}
