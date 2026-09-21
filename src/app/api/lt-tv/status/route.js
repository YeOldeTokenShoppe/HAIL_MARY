import { readStatus } from '../../../../../scripts/lt-tv-status.mjs';
import {
  actionsFor,
  showActionsFor,
  rehomeActionFor,
  removeActionsFor,
} from '../../../../../scripts/lt-tv-actions.mjs';
import { refuseOutsideDev } from '@/lib/ltTv/devOnly.mjs';

// Reads the working tree, so it can never be cached or prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  try {
    const status = await readStatus(process.cwd());
    return Response.json({
      ...status,
      // Which buttons to offer each episode is decided here, from the same
      // table the runner validates against — so the page cannot offer a
      // button that the server would then refuse.
      shows: status.shows.map((show) => ({
        ...show,
        // A show's own buttons: the ones that make an episode exist.
        actions: showActionsFor(show.id),
        episodes: show.episodes.map((e) => ({
          ...e,
          actions: actionsFor(e.stage),
          // Taking it down, kept apart from the steps that move it forwards.
          removals: removeActionsFor(e),
        })),
      })),
      orphans: status.orphans.map((e) => ({
        ...e,
        // A stray working copy is offered the move FIRST, because every other
        // step on it acts on an episode the guide does not have.
        actions: [rehomeActionFor(e), ...actionsFor(e.stage)].filter(Boolean),
        removals: removeActionsFor(e),
      })),
      env: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
      },
      readAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
