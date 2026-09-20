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
//
// The look lives in studio.module.css, next door. It is a stylesheet and not
// utility classes because this app does not compile Tailwind — see the note at
// the top of that file.

import { useCallback, useEffect, useState } from 'react';
import s from './studio.module.css';

const STAGES = {
  planned: { label: 'Planned', hint: 'named, not written', dot: s.dotPlanned, word: s.stagePlanned },
  written: { label: 'Written', hint: 'not recorded', dot: s.dotWritten, word: s.stageWritten },
  recorded: { label: 'Recorded', hint: 'not on the slate', dot: s.dotRecorded, word: s.stageRecorded },
  'on-air': { label: 'On air', hint: 'playable in the guide', dot: s.dotOnAir, word: s.stageOnAir },
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
      <Shell onRefresh={load}>
        <p className={`${s.notice} ${s.noticeError}`}>{error}</p>
        <button onClick={load} className={`${s.btn} ${s.noticeBtn}`}>Try again</button>
      </Shell>
    );
  }
  if (!status) {
    return (
      <Shell onRefresh={load}>
        <p className={s.notice}>Reading the slate…</p>
      </Shell>
    );
  }

  return (
    <Shell onRefresh={load}>
      <p className={s.intro}>
        Every step of making an episode. Development only — this page does not exist in a deployed build.
      </p>

      <Keys env={status.env} />

      {status.shows.map((show) => (
        <section key={show.id} className={s.show}>
          <div className={s.showHead}>
            <h2 className={s.showTitle}>{show.title}</h2>
          </div>
          {show.episodes.length === 0 ? (
            <p className={s.empty}>Nothing on the slate yet.</p>
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
        <section className={s.show}>
          <div className={`${s.showHead} ${s.orphanHead}`}>
            <h2 className={`${s.showTitle} ${s.orphanTitle}`}>Not attached to any show</h2>
          </div>
          {status.orphans.map((e) => (
            <Episode key={e.id} episode={e} env={status.env} open={openId === e.id}
              onToggle={() => setOpenId(openId === e.id ? null : e.id)} onRun={run} running={running} />
          ))}
        </section>
      )}

      {log && <RunLog log={log} onClose={() => setLog(null)} />}

      <footer className={s.footer}>
        Read from the slate, the staging area and the audio directory — never from a record of what a
        previous run did, so it stays right when you do a step by hand. The one thing it cannot see is
        SitePal: the Audio Manager is outside the repo, so a clip name here means the record asks for
        that name, not that the upload exists.
      </footer>
    </Shell>
  );
}

function Shell({ children, onRefresh }) {
  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.masthead}>
          <h1 className={s.wordmark}>
            <span className={s.wordmarkLt}>LT TV</span>
            <span className={s.wordmarkStudio}>Studio</span>
          </h1>
          <span className={s.devPill}>Local only</span>
          <button onClick={onRefresh} className={s.btn}>Refresh</button>
        </header>
        {children}
      </div>
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
    <div className={s.keys}>
      <p className={s.keysTitle}>Not set in this dev server</p>
      <ul className={s.keysList}>
        {missing.map((m) => <li key={m}>{m}</li>)}
      </ul>
      <p className={s.keysFoot}>
        Put them in <code>.env.local</code> and restart <code>npm run dev</code>.
        Steps that need one will fail until then.
      </p>
    </div>
  );
}

function Episode({ episode: e, env, open, onToggle, onRun, running }) {
  const stage = STAGES[e.stage];
  // null until the screenplay has been looked for. The steps that read it are
  // offered only once it is there — see needsScreenplay in lt-tv-actions.mjs.
  const [hasScreenplay, setHasScreenplay] = useState(null);
  return (
    <article className={`${s.episode} ${open ? s.episodeOpen : ''}`}>
      <button onClick={onToggle} className={s.episodeHead} aria-expanded={open}>
        <span className={`${s.dot} ${stage.dot}`} aria-hidden />
        <span className={s.episodeTitles}>
          <span className={s.episodeTitle}>{e.title}</span>
          <span className={s.episodeMeta}>
            <span className={stage.word}>{stage.label}</span> · {stage.hint}
            {e.lines ? ` · ${e.lines} lines` : ''}
            {e.runtime ? ` · ${e.runtime}${e.runtimeIsEstimate ? ' est.' : ''}` : ''}
          </span>
        </span>
        <span className={s.disclose}>{open ? 'Hide' : 'Open'}</span>
      </button>

      {open && (
        <div className={s.episodeBody}>
          {e.summary && <p className={s.summary}>{e.summary}</p>}

          <h3 className={s.label}>Next — {e.next.why}</h3>
          <div className={s.actions}>
            {e.actions.length === 0 && <p className={s.empty}>Nothing to do.</p>}
            {e.actions.map((a, i) => {
              const missingKey = a.needs.find((k) =>
                (k === 'ANTHROPIC_API_KEY' && !env.anthropic) || (k === 'ELEVENLABS_API_KEY' && !env.elevenlabs));
              // A step is offered only when it can actually do something. Both
              // reasons it cannot are shown where its explanation would go.
              const why = missingKey
                ? `${missingKey} is not set`
                : a.needsScreenplay && hasScreenplay === false
                  ? 'Nothing written yet — there is no script to apply'
                  : null;
              const busy = running === `${a.name}:${e.id}`;
              return (
                <div key={a.name} className={s.action}>
                  <button
                    title={why || undefined}
                    disabled={Boolean(why) || Boolean(running)}
                    onClick={() => onRun(a.name, e.id, a.spends)}
                    className={`${s.btn} ${i === 0 && !why ? s.btnPrimary : ''}`}
                  >
                    {busy ? 'Running…' : a.label}
                    {/* Name the cost rather than the fact of one: "costs" on
                        its own makes you click to find out what it means, and
                        what it means is the thing you wanted to know. */}
                    {a.spends && <span className={s.cost}>{a.spends.replace(/^an? /, '')}</span>}
                  </button>
                  <span className={s.actionBlurb}>{why || a.blurb}</span>
                </div>
              );
            })}
          </div>

          <Screenplay id={e.id} stage={e.stage} onPresence={setHasScreenplay} />

          <Files files={e.files} />
          {e.clips.length > 0 && (
            <>
              <h3 className={s.label}>
                SitePal clip names <span className={s.labelNote}>— not checked against the Audio Manager</span>
              </h3>
              <ul className={s.clipList}>
                {e.clips.map((c) => <li key={c} className={s.clip}>{c}</li>)}
              </ul>
            </>
          )}
          {e.warnings.length > 0 && (
            <>
              <h3 className={`${s.label} ${s.labelWarn}`}>{e.warnings.length} warning(s) from the script step</h3>
              <ul className={s.warnList}>
                {e.warnings.map((w) => <li key={w} className={s.warn}>{w}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function Files({ files }) {
  if (!files.length) return <p className={s.empty}>No files yet.</p>;
  return (
    <>
      <h3 className={s.label}>Files</h3>
      <ul className={s.fileList}>
        {files.map((f) => (
          <li key={f.path} className={s.file}>
            <code className={s.filePath}>{f.path}</code>
            <span className={s.fileWhat}>{f.what}</span>
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
function Screenplay({ id, stage, onPresence }) {
  const [text, setText] = useState(null);
  const [saved, setSaved] = useState(true);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/lt-tv/script?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) { setText(d.text); setSaved(true); onPresence(d.text !== null); } })
      .catch(() => { if (alive) { setText(null); onPresence(false); } });
    return () => { alive = false; };
  }, [id, stage, onPresence]);

  if (text === null) {
    return (
      <>
        <h3 className={s.label}>Screenplay</h3>
        <p className={s.empty}>Nothing written yet.</p>
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
      <h3 className={s.label}>Screenplay — edit it here</h3>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); setNote(null); }}
        spellCheck={false}
        className={s.script}
      />
      <div className={s.scriptBar}>
        <button onClick={save} disabled={saved} className={s.btn}>{saved ? 'Saved' : 'Save'}</button>
        {note && <span className={s.scriptNote}>{note}</span>}
      </div>
    </>
  );
}

function RunLog({ log, onClose }) {
  const state = log.pending
    ? { className: s.runPending, word: 'Running' }
    : log.ok
      ? { className: s.runDone, word: 'Done' }
      : { className: s.runFailed, word: 'Stopped' };
  return (
    <div className={s.runlog}>
      <div className={s.runlogInner}>
        <div className={s.runlogHead}>
          <span className={`${s.runState} ${state.className}`}>{state.word}</span>
          <span className={s.runWhat}>{log.action}{log.id ? ` · ${log.id}` : ''}</span>
          {log.timedOut && <span className={s.runTimeout}>timed out</span>}
          <button onClick={onClose} className={`${s.btn} ${s.btnQuiet} ${s.runClose}`}>Close</button>
        </div>
        {/* No newline between the tag and the value: a <pre> keeps it. */}
        <pre className={s.runOutput}>{log.output}</pre>
      </div>
    </div>
  );
}
