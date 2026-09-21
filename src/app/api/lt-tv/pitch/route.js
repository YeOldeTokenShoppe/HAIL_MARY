import { readFile } from 'node:fs/promises';
import { readStatus } from '../../../../../scripts/lt-tv-status.mjs';
import { planTextPath } from '../../../../../scripts/lt-tv-pitch.mjs';
import { refuseOutsideDev } from '@/lib/ltTv/devOnly.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// THE PITCH, AS A PAGE TO READ.
//
// Read-only on purpose. The pitch is changed in the writers' room, where every
// change is checked against what the pass that made it actually verified — a
// text box would let a fact be reworded by hand, and a fact reworded by hand
// is a number nobody checked going out in a character's voice.
//
// The id is checked against the pitches and episodes that exist rather than
// sanitised, the same rule the other studio routes use.

/** Every id that is a real subject here: an episode, or a pitch on disk. */
async function knownIds() {
  const status = await readStatus(process.cwd());
  return [
    ...status.episodes.map((e) => e.id),
    ...status.shows.flatMap((s) => (s.pitches ?? []).map((p) => p.id)),
  ];
}

export async function GET(request) {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  const id = new URL(request.url).searchParams.get('id');
  if (typeof id !== 'string' || !(await knownIds()).includes(id)) {
    return Response.json({ error: `Not an episode or a pitch: ${String(id).slice(0, 40)}` }, { status: 400 });
  }

  try {
    return Response.json({ id, text: await readFile(planTextPath(id), 'utf8') });
  } catch {
    // Not an error: most episodes were written before there was such a thing
    // as a pitch, and an episode with none simply does not show the panel.
    return Response.json({ id, text: null });
  }
}
