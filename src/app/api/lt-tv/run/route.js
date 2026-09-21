import { execFile } from 'node:child_process';
import { readStatus } from '../../../../../scripts/lt-tv-status.mjs';
import { resolveAction } from '../../../../../scripts/lt-tv-actions.mjs';
import { refuseOutsideDev } from '@/lib/ltTv/devOnly.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A script step can call a model and take a while. Long enough to finish, short
// enough that a wedged run does not hold the page open forever.
const TIMEOUT_MS = 10 * 60 * 1000;

export async function POST(request) {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  // The browser sends an action NAME and an episode id. resolveAction turns
  // those into a fixed argv array or refuses; nothing from the request is ever
  // concatenated into a command. See scripts/lt-tv-actions.mjs.
  // The episodes rather than their ids: an action whose destination is part
  // of the episode (where a stray working copy belongs) reads it from what was
  // inspected here, so the request still carries nothing but a name and an id.
  const { episodes, orphans } = await readStatus(process.cwd());
  const known = [...episodes, ...orphans.filter((o) => !episodes.some((e) => e.id === o.id))];
  const resolved = resolveAction(body?.action, body?.id, known);
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }

  const started = Date.now();
  const result = await new Promise((resolve) => {
    execFile(
      resolved.command,
      resolved.args,
      { cwd: process.cwd(), timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, shell: false },
      (error, stdout, stderr) => {
        resolve({
          // A non-zero exit is an outcome to show, not a server error: the
          // scripts say useful things when they refuse, and the page prints
          // their words rather than a status code.
          ok: !error,
          code: error?.code ?? 0,
          timedOut: Boolean(error?.killed),
          output: [stdout, stderr].filter(Boolean).join('\n').trimEnd(),
        });
      },
    );
  });

  return Response.json({ ...result, action: body.action, id: body.id ?? null, ms: Date.now() - started });
}
