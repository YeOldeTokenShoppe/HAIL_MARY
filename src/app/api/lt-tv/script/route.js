import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readStatus } from '../../../../../scripts/lt-tv-status.mjs';
import { refuseOutsideDev } from '@/lib/ltTv/devOnly.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGING = 'content/lt-tv/episodes';

/**
 * The screenplay file for an episode, or null if the id is not one.
 *
 * The id is checked against the episodes that exist rather than sanitised,
 * which is the same rule the runner uses: a pattern describes what an id
 * looks like, a list says which ones there are. Nothing else can become a
 * path here, so `../` never gets the chance to mean anything.
 */
async function screenplayPath(id) {
  const { episodes } = await readStatus(process.cwd());
  if (typeof id !== 'string' || !episodes.some((e) => e.id === id)) return null;
  return join(process.cwd(), STAGING, `${id}.txt`);
}

export async function GET(request) {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  const id = new URL(request.url).searchParams.get('id');
  const path = await screenplayPath(id);
  if (!path) return Response.json({ error: `Not an episode on the slate: ${String(id).slice(0, 40)}` }, { status: 400 });

  try {
    return Response.json({ id, text: await readFile(path, 'utf8') });
  } catch {
    // Not an error: an episode that has never been written has no screenplay,
    // and the page shows that as "nothing written yet" rather than a failure.
    return Response.json({ id, text: null });
  }
}

export async function PUT(request) {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const path = await screenplayPath(body?.id);
  if (!path) return Response.json({ error: `Not an episode on the slate: ${String(body?.id).slice(0, 40)}` }, { status: 400 });
  if (typeof body?.text !== 'string') return Response.json({ error: 'Expected text.' }, { status: 400 });

  // Saving only writes the screenplay. Applying it to the record is the
  // separate, explicit step — the same one the terminal runs — so a save can
  // never quietly rebuild the episode.
  await writeFile(path, body.text.endsWith('\n') ? body.text : `${body.text}\n`);
  return Response.json({ id: body.id, saved: true, bytes: body.text.length });
}
