import { cookies } from 'next/headers';
import { answerQuestion, writeBanter } from '../../../../../scripts/lt-tv-live.mjs';
import { SESSION_COOKIE, tokenIsValid } from '@/lib/ltTv/lineupAuth.mjs';
import { IS_DEV } from '@/lib/ltTv/devOnly.mjs';
import { liveShowFor } from '@/lib/ltTv/liveDesk.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// THE LIVE DESK'S WRITER, over HTTP: one viewer question in, a short in-
// character exchange out — or, with `kind: "banter"` and no question, what the
// two of them say to each other while the queue is empty. The desk on /trade?live=desk calls this and speaks
// the result on the set; scripts/lt-tv-live.mjs is where the words are made.
//
// A THIRD KIND OF ROUTE UNDER /api/lt-tv/. The studio routes 404 outside
// development and the ratings and comments are public. This one has to work
// on the DEPLOYED site — the live show runs from the producer's own browser,
// not from a checkout — and it spends an Anthropic call per question, so it is
// neither. It takes the lineup page's session: sign in once with the admin
// password (the desk asks for it, or /admin/lt-tv) and the signed cookie that
// page already issues opens this too. In development it is open, like the rest
// of the studio, so the desk can be rehearsed locally without a password.
//
// Nothing the browser sends is trusted: the question and the name are capped
// and cleaned in src/lib/ltTv/liveDesk.mjs, the show is checked against the
// two live shows, and what comes back from the model is reduced to lines for
// characters who actually sit at that desk before anything is returned.

async function allowed() {
  if (IS_DEV()) return true;
  const store = await cookies();
  return tokenIsValid(store.get(SESSION_COOKIE)?.value);
}

export async function POST(request) {
  if (!(await allowed())) {
    return Response.json({ error: 'Sign in to run the live desk.', signIn: true }, { status: 401 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    // Handled below as a missing question.
  }

  const show = liveShowFor(body?.show);
  if (!show) return Response.json({ error: 'The live desk runs on the news set or the Markets & Morality set.' }, { status: 400 });

  const recent = Array.isArray(body?.recent) ? body.recent.slice(-8) : [];
  const out = body?.kind === 'banter'
    ? await writeBanter({ show, recent })
    : await answerQuestion({ show, question: body?.question, name: body?.name, recent });
  if (out.error) return Response.json({ error: out.error }, { status: 422 });
  return Response.json({ lines: out.lines });
}
