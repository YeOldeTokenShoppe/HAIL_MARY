'use client';

// THE LT TV STUDIO — every step of making an episode, as buttons.
//
// The terminal tools are the real pipeline and this does not reimplement any
// of them: every button posts an action name to /api/lt-tv/run, which maps it
// to the same command you would have typed. So the page cannot drift from the
// tools, and anything you do here you could have done by hand.
//
// It also shows the output of each run verbatim, rather than turning it into
// a green tick. The scripts say useful things — how many lines were written,
// which segment is over its word target, why a step refused — and a dashboard
// that swallows them would make you open a terminal to find out what happened,
// which is the thing this exists to avoid.

import { useCallback, useEffect, useState } from 'react';

const STAGES = {
  planned: { label: 'Planned', hint: 'named, not written', dot: 'bg-neutral-500' },
  written: { label: 'Written', hint: 'not recorded', dot: 'bg-amber-500' },
  recorded: { label: 'Recorded', hint: 'not on the slate', dot: 'bg-sky-500' },
  'on-air': { label: 'On air', hint: 'playable in the guide', dot: 'bg-emerald-500' },
};

export default function Studio() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [running, setRunning] = useState(null);
  const [log, setLog] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/lt-tv/status', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `status ${res.status}`);
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = useCallback(async (action, id, spends) => {
    // A step that spends money asks first. The ones that do not, do not — a
    // confirm on a free action teaches you to click through confirms.
    if (spends && !window.confirm(`This spends ${spends}. Go ahead?`)) return;
    setRunning(`${action}:${id ?? ''}`);
    setLog({ action, id, output: 'Running…', pending: true });
    try {
      const res = await fetch('/api/lt-tv/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json();
      setLog({ action, id, ...data, output: data.output || data.error || '(no output)' });
      await load();
    } catch (err) {
      setLog({ action, id, ok: false, output: err.message });
    } finally {
      setRunning(null);
    }
  }, [load]);

  if (error) {
    return (
      <Shell>
        <p className="text-red-400">{error}</p>
        <button onClick={load} className={BTN}>Try again</button>
      </Shell>
    );
  }
  if (!status) return <Shell><p className="text-neutral-400">Reading the slate…</p></Shell>;

  return (
    <Shell>
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LT TV studio</h1>
          <p className="text-sm text-neutral-400">
            Every step of making an episode. Development only — this page does not exist in a deployed build.
          </p>
        </div>
        <button onClick={load} className={BTN}>Refresh</button>
      </header>

      <Keys env={status.env} />

      {status.shows.map((show) => (
        <section key={show.id} className="mb-10">
          <h2 className="mb-3 border-b border-neutral-800 pb-2 text-lg font-medium">{show.title}</h2>
          {show.episodes.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing on the slate yet.</p>
          ) : (
            show.episodes.map((e) => (
              <Episode
                key={e.id}
                episode={e}
                env={status.env}
                open={openId === e.id}
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
                onRun={run}
                running={running}
              />
            ))
          )}
        </section>
      ))}

      {status.orphans.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 border-b border-neutral-800 pb-2 text-lg font-medium text-amber-400">
            Not attached to any show
          </h2>
          {status.orphans.map((e) => (
            <Episode key={e.id} episode={e} env={status.env} open={openId === e.id}
              onToggle={() => setOpenId(openId === e.id ? null : e.id)} onRun={run} running={running} />
          ))}
        </section>
      )}

      {log && <RunLog log={log} onClose={() => setLog(null)} />}

      <footer className="mt-12 border-t border-neutral-800 pt-4 text-xs leading-relaxed text-neutral-500">
        Read from the slate, the staging area and the audio directory — never from a record of what a
        previous run did, so it stays right when you do a step by hand. The one thing it cannot see is
        SitePal: the Audio Manager is outside the repo, so a clip name here means the record asks for
        that name, not that the upload exists.
      </footer>
    </Shell>
  );
}

const BTN = 'rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-40';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-10">{children}</div>
    </div>
  );
}

function Keys({ env }) {
  const missing = [
    !env.anthropic && 'ANTHROPIC_API_KEY (writing a script)',
    !env.elevenlabs && 'ELEVENLABS_API_KEY (recording)',
  ].filter(Boolean);
  if (!missing.length) return null;
  return (
    <div className="mb-8 rounded border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm">
      <p className="mb-1 font-medium text-amber-300">Not set in this dev server</p>
      <ul className="list-inside list-disc text-neutral-300">
        {missing.map((m) => <li key={m}>{m}</li>)}
      </ul>
      <p className="mt-1 text-neutral-400">
        Put them in <code className="text-neutral-300">.env.local</code> and restart <code className="text-neutral-300">npm run dev</code>.
        Steps that need one will fail until then.
      </p>
    </div>
  );
}

function Episode({ episode: e, env, open, onToggle, onRun, running }) {
  const stage = STAGES[e.stage];
  return (
    <article className="mb-3 rounded-lg border border-neutral-800 bg-neutral-900/60">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-900">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dot}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{e.title}</span>
          <span className="block truncate text-xs text-neutral-500">
            {stage.label} · {stage.hint}
            {e.lines ? ` · ${e.lines} lines` : ''}
            {e.runtime ? ` · ${e.runtime}${e.runtimeIsEstimate ? ' est.' : ''}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-xs text-neutral-600">{open ? 'Hide' : 'Open'}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-800 px-4 py-4">
          {e.summary && <p className="mb-4 text-sm text-neutral-400">{e.summary}</p>}

          <h3 className={H3}>Next — {e.next.why}</h3>
          <div className="mb-5 flex flex-wrap gap-2">
            {e.actions.length === 0 && <p className="text-sm text-neutral-500">Nothing to do.</p>}
            {e.actions.map((a) => {
              const blocked = a.needs.find((k) =>
                (k === 'ANTHROPIC_API_KEY' && !env.anthropic) || (k === 'ELEVENLABS_API_KEY' && !env.elevenlabs));
              const busy = running === `${a.name}:${e.id}`;
              return (
                <button
                  key={a.name}
                  title={blocked ? `${blocked} is not set` : a.blurb}
                  disabled={Boolean(blocked) || Boolean(running)}
                  onClick={() => onRun(a.name, e.id, a.spends)}
                  className={BTN}
                >
                  {busy ? 'Running…' : a.label}
                  {a.spends && <span className="ml-1.5 text-xs text-amber-400">costs</span>}
                </button>
              );
            })}
          </div>

          <Screenplay id={e.id} stage={e.stage} />

          <Files files={e.files} />
          {e.clips.length > 0 && (
            <>
              <h3 className={H3}>SitePal clip names <span className="font-normal normal-case tracking-normal text-neutral-600">— not checked against the Audio Manager</span></h3>
              <ul className="mb-4 text-sm text-neutral-300">
                {e.clips.map((c) => <li key={c}><code>{c}</code></li>)}
              </ul>
            </>
          )}
          {e.warnings.length > 0 && (
            <>
              <h3 className={`${H3} text-amber-400`}>{e.warnings.length} warning(s) from the script step</h3>
              <ul className="mb-2 list-inside list-disc text-sm text-neutral-300">
                {e.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </article>
  );
}

const H3 = 'mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500';

function Files({ files }) {
  if (!files.length) return <p className="mb-4 text-sm text-neutral-500">No files yet.</p>;
  return (
    <>
      <h3 className={H3}>Files</h3>
      <ul className="mb-5 text-sm">
        {files.map((f) => (
          <li key={f.path} className="border-b border-dashed border-neutral-800 py-1.5 last:border-0">
            <code className="text-neutral-300">{f.path}</code>
            <span className="block text-xs text-neutral-500">{f.what}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The screenplay, editable in place.
 *
 * Saving writes the file and nothing else. Applying it is the separate button,
 * which runs the same editor the terminal does — so a save can never quietly
 * rebuild the episode, and an edit you are half way through is not live.
 */
function Screenplay({ id, stage }) {
  const [text, setText] = useState(null);
  const [saved, setSaved] = useState(true);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/lt-tv/script?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) { setText(d.text); setSaved(true); } })
      .catch(() => { if (alive) setText(null); });
    return () => { alive = false; };
  }, [id, stage]);

  if (text === null) {
    return (
      <>
        <h3 className={H3}>Screenplay</h3>
        <p className="mb-5 text-sm text-neutral-500">Nothing written yet.</p>
      </>
    );
  }

  const save = async () => {
    const res = await fetch('/api/lt-tv/script', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, text }),
    });
    const data = await res.json();
    setSaved(res.ok);
    setNote(res.ok ? 'Saved. Now press Apply my edits to fold it into the record.' : data.error);
  };

  return (
    <>
      <h3 className={H3}>Screenplay — edit it here</h3>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); setNote(null); }}
        spellCheck={false}
        className="mb-2 h-80 w-full rounded border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-200"
      />
      <div className="mb-5 flex items-center gap-3">
        <button onClick={save} disabled={saved} className={BTN}>{saved ? 'Saved' : 'Save'}</button>
        {note && <span className="text-xs text-neutral-400">{note}</span>}
      </div>
    </>
  );
}

function RunLog({ log, onClose }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-700 bg-neutral-900 shadow-2xl">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm">
            <span className={log.pending ? 'text-neutral-400' : log.ok ? 'text-emerald-400' : 'text-red-400'}>
              {log.pending ? 'Running' : log.ok ? 'Done' : 'Stopped'}
            </span>
            <span className="text-neutral-500"> · {log.action}{log.id ? ` · ${log.id}` : ''}</span>
            {log.timedOut && <span className="text-amber-400"> · timed out</span>}
          </p>
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">Close</button>
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-300">
{log.output}
        </pre>
      </div>
    </div>
  );
}
