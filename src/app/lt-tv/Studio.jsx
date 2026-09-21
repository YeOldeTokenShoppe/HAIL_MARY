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

import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Bumped when a step finishes. Several steps REWRITE the screenplay —
  // applying edits renders it afresh from the record, which renumbers lines
  // and drops `# cut`, `# pause` and `# take` marks — and the box was only re-read when
  // the stage changed. Applying to an episode that was already `written`
  // leaves the stage alone, so the box went on showing the old text while the
  // file said something else, and the next save pushed the stale text back
  // over the applied one. Michelle hit this on 2026-09-21.
  const [ran, setRan] = useState(0);

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
      setRan((n) => n + 1);
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
          {show.actions?.length > 0 && (
            <ShowActions show={show} env={status.env} onRun={run} running={running} />
          )}
          {(show.pitches ?? []).map((p) => (
            <PitchPanel
              key={p.id}
              pitch={p}
              env={status.env}
              ran={ran}
              onChanged={() => setRan((n) => n + 1)}
            />
          ))}
          {show.episodes.length === 0 ? (
            <p className={s.empty}>{show.actions?.length ? 'Nothing on the slate yet. Start above.' : 'Nothing on the slate yet.'}</p>
          ) : (
            show.episodes.map((e) => (
              <Episode
                key={e.id}
                episode={e}
                env={status.env}
                ran={ran}
                onScriptChanged={() => setRan((n) => n + 1)}
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
            <Episode key={e.id} episode={e} env={status.env} ran={ran}
              onScriptChanged={() => setRan((n) => n + 1)} open={openId === e.id}
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

// The buttons that make a news episode exist. The week is pulled and the
// script written before there is an episode to open, so they sit under the
// show's heading rather than inside one. Same table, same runner, no id.
function ShowActions({ show, env, onRun, running }) {
  // A button that writes from a pitch is not offered until there is one. It
  // would only be able to fail, and the failure would be a file path.
  const pitched = (show.pitches ?? []).length > 0;
  return (
    <div className={`${s.actions} ${s.showActions}`}>
      {show.actions.filter((a) => !a.needsPitch || pitched).map((a, i) => {
        const missingKey = a.needs.find((k) =>
          (k === 'ANTHROPIC_API_KEY' && !env.anthropic) || (k === 'ELEVENLABS_API_KEY' && !env.elevenlabs));
        const why = missingKey ? `${missingKey} is not set` : null;
        const busy = running === `${a.name}:`;
        return (
          <div key={a.name} className={s.action}>
            <button
              title={why || undefined}
              disabled={Boolean(why) || Boolean(running)}
              onClick={() => onRun(a.name, undefined, a.spends)}
              className={`${s.btn} ${i === 0 && !why ? s.btnPrimary : ''}`}
            >
              {busy ? 'Running…' : a.label}
              {a.spends && <span className={s.cost}>{a.spends.replace(/^an? /, '')}</span>}
            </button>
            <span className={s.actionBlurb}>{why || a.blurb}</span>
          </div>
        );
      })}
    </div>
  );
}

function Episode({ episode: e, env, ran, onScriptChanged, open, onToggle, onRun, running }) {
  const stage = STAGES[e.stage];
  // null until the screenplay has been looked for. The steps that read it are
  // offered only once it is there — see needsScreenplay in lt-tv-actions.mjs.
  const [hasScreenplay, setHasScreenplay] = useState(null);

  // A step that reads the screenplay reads the FILE, so an edit still sitting
  // in the box below is invisible to it. That failed silently and looked like
  // the step doing nothing — you marked four lines and it said nothing was
  // marked. So such a step saves the box first, and runs on what you can see.
  const [unsaved, setUnsaved] = useState(false);
  const saveScreenplay = useRef(null);

  const runAction = async (a) => {
    if (a.needsScreenplay && unsaved && saveScreenplay.current) {
      if (!(await saveScreenplay.current())) return; // it said why; do not spend anything
    }
    onRun(a.name, e.id, a.spends);
  };

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
            {e.actions.filter((a) => !a.needsPitch || e.pitch).map((a, i) => {
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
                    onClick={() => runAction(a)}
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

          {e.pitch && (
            <>
              <h3 className={s.label}>
                The pitch{' '}
                <span className={s.labelNote}>
                  &mdash; {hasScreenplay ? 'what this episode was written from' : 'the idea, before anything is written'}
                </span>
              </h3>
              <PitchText id={e.id} ran={ran} />
            </>
          )}

          {(hasScreenplay || e.pitch) && (
            <>
              <h3 className={s.label}>
                Writers&rsquo; room{' '}
                <span className={s.labelNote}>
                  &mdash; talk {hasScreenplay ? 'it' : 'the pitch'} through, then agree to the changes
                </span>
              </h3>
              <Room
                id={e.id}
                mode={hasScreenplay ? 'script' : 'pitch'}
                hasKey={env.anthropic}
                unsaved={unsaved}
                saveScreenplay={saveScreenplay}
                onScriptChanged={onScriptChanged}
              />
            </>
          )}

          <Screenplay id={e.id} stage={e.stage} ran={ran} onPresence={setHasScreenplay}
            onDirty={setUnsaved} saveRef={saveScreenplay} />

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

// THE PITCH — pass 1, before anything is written.
//
// Read-only here, and that is the interesting decision. Everything else on
// this page you can edit in place, but a pitch's facts were checked against a
// real article and its sources are in the record; a text box would let a
// number be reworded by hand, and a number reworded by hand is a number nobody
// checked being spoken on air. So the pitch is changed by talking to the room
// underneath it, which is allowed to move the judgment and refuses the
// evidence.

function PitchText({ id, ran }) {
  const [text, setText] = useState(undefined);

  useEffect(() => {
    let alive = true;
    fetch(`/api/lt-tv/pitch?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setText(d.text ?? null); })
      .catch(() => { if (alive) setText(null); });
    return () => { alive = false; };
  }, [id, ran]);

  if (text === undefined) return <p className={s.empty}>Reading the pitch…</p>;
  if (text === null) return <p className={s.empty}>No pitch was saved for this one.</p>;
  return <pre className={s.pitch}>{text}</pre>;
}

// A pitch with no episode yet. The news show pitches a WEEK and only takes an
// episode number when it is written, so this sits under the show's heading
// rather than in a drawer — there is nothing to open yet.
function PitchPanel({ pitch, env, ran, onChanged }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={s.pitchPanel}>
      <button onClick={() => setOpen(!open)} className={s.pitchHead} aria-expanded={open}>
        <span className={`${s.dot} ${s.dotPitched}`} aria-hidden />
        <span className={s.episodeTitles}>
          <span className={s.episodeTitle}>{pitch.title}</span>
          <span className={s.episodeMeta}>
            <span className={s.stagePitched}>Pitched</span> · not written yet
            {pitch.stories ? ` · ${pitch.stories} stories` : ''}
            {pitch.week ? ` · ${pitch.week}` : ''}
          </span>
        </span>
        <span className={s.disclose}>{open ? 'Hide' : 'Open'}</span>
      </button>
      {open && (
        <div className={s.pitchBody}>
          <PitchText id={pitch.id} ran={ran} />
          <h3 className={s.label}>
            Writers&rsquo; room <span className={s.labelNote}>&mdash; argue with it before it is written</span>
          </h3>
          <Room id={pitch.id} mode="pitch" hasKey={env.anthropic} onScriptChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

// THE WRITERS' ROOM.
//
// The other way to change a line is to write in the file: reword it yourself,
// or put a `# note` under it and press "Rewrite the lines I marked". Both stay.
// What neither does is let you say "the middle of story two is flabby" before
// you know which line is wrong — this is the conversation for that. Michelle
// asked for it on 2026-09-21.
//
// THE SCRIPT IS STILL THE SCRIPT. The room proposes changes, you see each one
// next to the line it replaces, and only the button writes them. It places
// `# cut` and `# pause` marks for you rather than inventing a second way to
// say them, and applying its changes to the RECORD is the same explicit "Apply
// my edits" as any other edit — so a conversation you did not like is
// discarded by not applying it.
//
// The conversation lives on disk beside the screenplay, not in this component:
// closing the tab does not lose the room, and `node scripts/lt-tv-room.mjs
// <id>` is the same room from a terminal.

function Room({ id, mode = 'script', hasKey, unsaved = false, saveScreenplay = null, onScriptChanged }) {
  const pitch = mode === 'pitch';
  const [messages, setMessages] = useState(null);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const log = useRef(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/lt-tv/room?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setMessages(d.messages || []); })
      .catch(() => { if (alive) setMessages([]); });
    return () => { alive = false; };
  }, [id]);

  // Newest at the bottom, like every other conversation.
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const text = said.trim();
    if (!text || busy) return;
    // The writer reads the FILE. An edit still sitting in the box below is
    // invisible to it, which would look like the room ignoring what is on
    // screen — the same trap the marked-lines rewrite hit. So save first.
    if (unsaved && saveScreenplay?.current && !(await saveScreenplay.current())) return;

    setBusy(true);
    setError(null);
    setSaid('');
    // Her line shows immediately; nothing is written until the reply lands, so
    // a failed turn takes it back rather than leaving a message that is not
    // in the transcript on disk.
    setMessages((m) => [...(m || []), { role: 'producer', text }]);
    try {
      const res = await fetch('/api/lt-tv/room', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => (m || []).slice(0, -1));
        setSaid(text);
        setError(data.error || `room ${res.status}`);
      } else {
        setMessages(data.messages);
      }
    } catch (err) {
      setMessages((m) => (m || []).slice(0, -1));
      setSaid(text);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (index, decision) => {
    // Applying writes the screenplay file. An edit still sitting unsaved in the
    // box below would be written over it by the next Save, so it is saved
    // first and the room's changes land on top of what you can see.
    if (decision === 'apply' && unsaved && saveScreenplay?.current && !(await saveScreenplay.current())) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/lt-tv/room', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, index, decision }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `room ${res.status}`); return; }
      setMessages(data.messages);
      if (data.applied) {
        // The box below is showing the file as it was a moment ago.
        onScriptChanged();
        if (data.parseErrors?.length) {
          setError(`The script will not apply until these are fixed:\n  ${data.parseErrors.join('\n  ')}`);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.room}>
      {messages === null ? (
        <p className={s.roomEmpty}>Opening the room…</p>
      ) : messages.length === 0 ? (
        <p className={s.roomEmpty}>
          {pitch
            ? `Nobody has said anything yet. This is the idea, not the script — say what you think of it
               the way you would to a person: whether story three is really the funny one, whether the
               argument cuts both ways, what is missing. Facts and sources are not up for discussion here;
               everything else is.`
            : `Nobody has said anything yet. Talk to the writer about this episode the way you would
               talk to a person — what drags, who should have the last word, whether the ending lands.
               It has the whole screenplay in front of it. When you agree on something it offers the
               change, and nothing is written until you say so.`}
        </p>
      ) : (
        <div className={s.roomLog} ref={log}>
          {messages.map((m, i) => (
            <Turn key={`${m.at || i}-${i}`} message={m} index={i} busy={busy} onDecide={decide} />
          ))}
          {busy && (
            <div className={s.roomTurn}>
              <span className={`${s.roomWho} ${s.roomWhoWriter}`}>writer</span>
              <p className={s.roomSaid}>…</p>
            </div>
          )}
        </div>
      )}

      <div className={s.roomBar}>
        <textarea
          value={said}
          onChange={(e) => setSaid(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder={hasKey ? 'Say what you think…' : 'ANTHROPIC_API_KEY is not set in this dev server'}
          disabled={!hasKey}
          rows={1}
          className={s.roomInput}
        />
        <button onClick={send} disabled={!hasKey || busy || !said.trim()} className={`${s.btn} ${s.btnPrimary}`}>
          {busy ? 'Thinking…' : 'Say it'}
          <span className={s.cost}>Anthropic call</span>
        </button>
      </div>
      {error ? (
        <p className={s.roomError}>{error}</p>
      ) : (
        <p className={s.roomHint}>
          Enter sends, Shift+Enter starts a line.{' '}
          {pitch
            ? 'Changes you accept go into the pitch above, and the episode is written from it.'
            : 'Changes you accept are written to the screenplay below — apply them to the episode with “Apply my edits”.'}
        </p>
      )}
    </div>
  );
}

function Turn({ message: m, index, busy, onDecide }) {
  if (m.role === 'note') {
    return (
      <div className={s.roomTurn}>
        <span className={s.roomWho} />
        <p className={s.roomNote}>{m.text}</p>
      </div>
    );
  }
  const writer = m.role === 'writer';
  return (
    <div className={s.roomTurn}>
      <span className={`${s.roomWho} ${writer ? s.roomWhoWriter : ''}`}>{writer ? 'writer' : 'you'}</span>
      <p className={s.roomSaid}>{m.text}</p>
      {writer && m.changes?.length > 0 && (
        <div className={s.roomProposal}>
          {m.changes.map((c, i) => <Change key={i} change={c} />)}
          <div className={s.roomProposalBar}>
            {m.applied ? (
              <span className={s.roomProposalDone}>In the script.</span>
            ) : m.declined ? (
              <span className={s.roomProposalLeft}>Left alone.</span>
            ) : (
              <>
                <button disabled={busy} onClick={() => onDecide(index, 'apply')} className={`${s.btn} ${s.btnPrimary}`}>
                  Put {m.changes.length === 1 ? 'it' : 'them'} in the script
                </button>
                <button disabled={busy} onClick={() => onDecide(index, 'leave')} className={s.btn}>
                  Leave it
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** One proposed change, with whatever it would replace shown under it. */
function Change({ change: c }) {
  const why = c.why ? <span className={s.roomWhy}>{c.why}</span> : null;

  if (c.op === 'reword') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>line {c.n}</span>
        <span className={s.roomLine}>{c.text}</span>
        {c.was && <span className={s.roomWas}>{c.was}</span>}
        {why}
      </div>
    );
  }
  if (c.op === 'add') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>new after {c.after}</span>
        <span className={s.roomLine}>{c.speaker}  {c.text}</span>
        {why}
      </div>
    );
  }
  if (c.op === 'drop') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>cut line {c.n}</span>
        <span className={s.roomWas}>{c.was}</span>
        {why}
      </div>
    );
  }
  if (c.op === 'pause') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>{c.seconds === 0 ? 'no pause' : 'pause'}</span>
        <span className={s.roomLine}>
          {c.seconds === 0 ? `before line ${c.n}` : `${c.seconds}s before line ${c.n}`}
        </span>
        {why}
      </div>
    );
  }
  if (c.op === 'cut') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>{c.on ? 'section break' : 'no section break'}</span>
        <span className={s.roomLine}>before line {c.n}</span>
        {why}
      </div>
    );
  }
  if (c.op === 'title') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>title</span>
        <span className={s.roomLine}>{c.text}</span>
        {why}
      </div>
    );
  }
  if (c.op === 'set') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>{c.field.replace('.', ' · ')}</span>
        <span className={s.roomLine}>{c.text}</span>
        {c.was && <span className={s.roomWas}>{c.was}</span>}
        {why}
      </div>
    );
  }
  if (c.op === 'order') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>running order</span>
        <span className={s.roomLine}>{c.slots.join('  →  ')}</span>
        {why}
      </div>
    );
  }
  if (c.op === 'rule') {
    return (
      <div className={s.roomChange}>
        <span className={s.roomChangeWhat}>house note</span>
        <span className={`${s.roomLine} ${s.roomRule}`}>{c.text}</span>
        <span className={s.roomWhy}>Kept for every future episode of both shows.</span>
      </div>
    );
  }
  return null;
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

// The screenplay's first line is the show and the episode title, and
// lt-tv-edit.mjs reads the title back out of exactly that line. So the title
// field below edits THAT LINE rather than keeping a second copy of the title
// anywhere: what you type is in the file in front of you, saved by the same
// Save and applied by the same Apply my edits as any other change. A separate
// title box with its own route would be a second way for the title to be
// right, which is how the old episode metadata drifted in the first place.
const TITLE_LINE = /^([^\n]*?\s+—\s+)(.*)$/;

function readTitle(text) {
  const match = TITLE_LINE.exec(String(text ?? '').split('\n')[0] ?? '');
  return match ? match[2].trim() : null;
}

function withTitle(text, title) {
  const lines = String(text ?? '').split('\n');
  const match = TITLE_LINE.exec(lines[0] ?? '');
  if (!match) return text;
  lines[0] = `${match[1]}${title}`;
  return lines.join('\n');
}

/**
 * The screenplay, editable in place.
 *
 * Saving writes the file and nothing else. Applying it is the separate button,
 * which runs the same editor the terminal does — so a save can never quietly
 * rebuild the episode, and an edit you are half way through is not live.
 *
 * The Save button therefore stays, and stays explicit. What is automatic is
 * only the save a step needs in order to see your edits at all: see runAction
 * above.
 */
function Screenplay({ id, stage, ran, onPresence, onDirty, saveRef }) {
  const [text, setText] = useState(null);
  const [saved, setSaved] = useState(true);
  const [note, setNote] = useState(null);

  // `ran` re-reads the file after any step, because several of them rewrite
  // it. Unsaved text in the box is never overwritten — a step that reads the
  // file has already saved the box (see runAction), so after one there is
  // nothing of yours to lose, and after an edit you are half way through this
  // does not fire at all.
  const dirty = !saved;
  useEffect(() => {
    if (dirty) return undefined;
    let alive = true;
    fetch(`/api/lt-tv/script?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) { setText(d.text); setSaved(true); onPresence(d.text !== null); } })
      .catch(() => { if (alive) { setText(null); onPresence(false); } });
    return () => { alive = false; };
    // `dirty` gates this; re-running it when the box becomes clean again would
    // undo nothing, but there is no reason to refetch on every save either.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stage, ran, onPresence]);

  const save = async () => {
    const res = await fetch('/api/lt-tv/script', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, text }),
    });
    const data = await res.json();
    setSaved(res.ok);
    setNote(res.ok ? 'Saved.' : data.error);
    return res.ok;
  };

  // Handed up so a step that reads the file can save the box first. Rewritten
  // every render because `save` closes over the text as it is now.
  useEffect(() => { saveRef.current = save; });
  useEffect(() => { onDirty(!saved && text !== null); }, [saved, text, onDirty]);

  if (text === null) {
    return (
      <>
        <h3 className={s.label}>Screenplay</h3>
        <p className={s.empty}>Nothing written yet.</p>
      </>
    );
  }

  const title = readTitle(text);

  return (
    <>
      <h3 className={s.label}>Screenplay — edit it here</h3>
      {title !== null && (
        <div className={s.titleRow}>
          <label htmlFor={`title-${id}`} className={s.titleLabel}>Episode title</label>
          <input
            id={`title-${id}`}
            value={title}
            onChange={(e) => {
              setText(withTitle(text, e.target.value));
              setSaved(false);
              setNote(null);
            }}
            spellCheck={false}
            className={s.titleInput}
          />
          <span className={s.titleHint}>
            What the guide prints. It is the first line of the script below — change it in either
            place, then Save and Apply my edits.
          </span>
        </div>
      )}
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
