import { readStatus } from '../../../../../scripts/lt-tv-status.mjs';
import { actionsFor } from '../../../../../scripts/lt-tv-actions.mjs';
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
        episodes: show.episodes.map((e) => ({ ...e, actions: actionsFor(e.stage) })),
      })),
      orphans: status.orphans.map((e) => ({ ...e, actions: actionsFor(e.stage) })),
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
