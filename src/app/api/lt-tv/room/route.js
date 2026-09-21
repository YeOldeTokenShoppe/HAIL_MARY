import { readStatus } from '../../../../../scripts/lt-tv-status.mjs';
import {
  readTranscript,
  say,
  applyMessage,
  declineMessage,
  summarise,
} from '../../../../../scripts/lt-tv-room.mjs';
import { refuseOutsideDev } from '@/lib/ltTv/devOnly.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// THE WRITER'S ROOM, over HTTP.
//
// Every other studio route either reads a file or runs one of a fixed table of
// commands (see scripts/lt-tv-actions.mjs). This one cannot do either: a
// conversation is free text from the browser, and there is no argv that holds
// a sentence safely.
//
// So it never becomes a command. The message is a string passed to a function
// in this process, which puts it in a model prompt; nothing here is executed,
// nothing is concatenated into a shell, and the only file it can write is the
// screenplay of an episode that is on the slate — checked against the episodes
// that exist, the same rule the other routes use.
//
// What the model sends back is not trusted either. It arrives as a list of
// changes, each one checked in scripts/lt-tv-room.mjs against the lines that
// are actually in the file, and applied only when the producer presses the
// button. The browser sends WHICH MESSAGE to apply rather than the changes
// themselves, so what lands is necessarily what was checked when it arrived
// and what she was looking at when she said yes.

/** The episode ids on the slate, or null when there is no such episode. */
async function known(id) {
  const { episodes } = await readStatus(process.cwd());
  return typeof id === 'string' && episodes.some((e) => e.id === id) ? id : null;
}

const notAnEpisode = (id) =>
  Response.json({ error: `Not an episode on the slate: ${String(id).slice(0, 40)}` }, { status: 400 });

async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request) {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  const id = new URL(request.url).searchParams.get('id');
  if (!(await known(id))) return notAnEpisode(id);

  return Response.json({ id, messages: await readTranscript(id) });
}

export async function POST(request) {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  const data = await body(request);
  if (!data) return Response.json({ error: 'Expected a JSON body.' }, { status: 400 });
  if (!(await known(data.id))) return notAnEpisode(data.id);
  if (typeof data.text !== 'string' || !data.text.trim()) {
    return Response.json({ error: 'Say something first.' }, { status: 400 });
  }

  try {
    const { entry, transcript } = await say({ id: data.id, text: data.text });
    // The index is how the changes are applied later, so it goes back with the
    // message rather than being counted again in the browser.
    return Response.json({ id: data.id, entry, index: transcript.length - 1, messages: transcript });
  } catch (err) {
    // A refusal from the model, a missing key, or a proposal that named a line
    // which is not in the script. All three are things to read, not a 500: the
    // page prints the words, the same as it does for a pipeline step.
    return Response.json({ error: err.message || String(err) }, { status: 400 });
  }
}

export async function PUT(request) {
  const refused = refuseOutsideDev();
  if (refused) return refused;

  const data = await body(request);
  if (!data) return Response.json({ error: 'Expected a JSON body.' }, { status: 400 });
  if (!(await known(data.id))) return notAnEpisode(data.id);

  const index = Number(data.index);
  if (!Number.isInteger(index) || index < 0) {
    return Response.json({ error: 'Which message?' }, { status: 400 });
  }

  try {
    if (data.decision === 'leave') {
      const { transcript } = await declineMessage({ id: data.id, index });
      return Response.json({ id: data.id, applied: false, messages: transcript });
    }

    const { applied, remembered, parseErrors } = await applyMessage({ id: data.id, index });
    return Response.json({
      id: data.id,
      applied: true,
      what: summarise(applied),
      remembered,
      parseErrors,
      messages: await readTranscript(data.id),
    });
  } catch (err) {
    return Response.json({ error: err.message || String(err) }, { status: 400 });
  }
}
