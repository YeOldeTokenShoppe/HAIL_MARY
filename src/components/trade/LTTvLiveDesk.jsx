"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TALKSHOW_PORTALS,
  TALKSHOW_LIVE,
  HOUSE_PREVIEW,
} from "@/components/trade/TalkShowScene";
import {
  LIVE_SHOWS,
  LIVE_NAMES,
  LIVE_TTS,
  MAX_NAME_CHARS,
  MAX_QUESTION_CHARS,
  cleanName,
  cleanQuestion,
  lineTimeoutMs,
} from "@/lib/ltTv/liveDesk.mjs";
import { spoken } from "@/lib/ltTv/pronounce.mjs";

/**
 * THE LIVE Q&A DESK — the producer's panel for a live LT TV show.
 *
 * Mount with ?live=desk on /trade, open LT TV and enter the news set or the
 * Markets & Morality set. Type (or paste) a viewer's question with their name
 * and it goes to the writer at once, so by the time you reach it the answer
 * is already written and you can read it before it airs. "Air it" has the
 * show's reader read the question out and the two characters answer it,
 * spoken live by SitePal in their own ElevenLabs voices with lip-sync, while
 * the camera cuts to whoever is talking.
 *
 * BETWEEN QUESTIONS the pair banter. While the desk is live and nothing is in
 * the queue, a piece of small talk is kept written in advance and aired once
 * the set has been quiet for a few seconds; pressing Air it on a question
 * during banter cuts in after the line being spoken. It is off the moment the
 * desk is not live, because every piece is a writer call and live speech.
 *
 * ONE BROWSER, ON PURPOSE. Live speech is generated per playback, so this is
 * run in the producer's browser and broadcast from there — never in viewers'
 * pages, where it would be generated (and paid for) once per viewer. See
 * src/lib/ltTv/liveDesk.mjs.
 *
 * How it reaches the set: SitePal calls go into each character's own portal
 * (TALKSHOW_PORTALS, the iframe their face is cropped from), and who is
 * speaking goes to TALKSHOW_LIVE, which the scene's frame loop reads for the
 * camera and the listener's head. The house lights are held up through
 * HOUSE_PREVIEW while the desk is live, the same pin the lighting board uses.
 */

const STORAGE_KEY = "lt_tv_live_desk_v1";
// The shot for each line of an answer, in order. The question is read to
// camera; the answer cuts between singles with the two-shot in between as
// the reaction, which is the coverage the recorded shows were short of.
const SHOT_FOR_LINE = ["direct", "single", "two", "single", "close", "single"];
// A breath between one character finishing and the next starting. SitePal
// also takes a moment to start live speech, so this is kept short.
const GAP_MS = 250;
// Banter opens wide, so it reads as the two of them talking rather than a
// segment, and cuts in for the lines after.
const SHOT_FOR_BANTER = ["two", "single", "single", "two", "close", "single"];
// How long the set is quiet, after the last thing said, before they banter.
const BANTER_WAITS = [10, 20, 40, 60];
const BANTER = "banter";
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function portalWindow(key) {
  const portal = TALKSHOW_PORTALS.current?.[key];
  if (!portal?.ready) return null;
  try {
    return portal.frame?.contentWindow || null;
  } catch {
    return null;
  }
}

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

/**
 * Speak one line in one character's portal and resolve when SitePal says it
 * has finished — or when the failsafe runs out, or the desk is stopped.
 */
function speakLine({ key, text, voice, signal }) {
  return new Promise((resolve) => {
    const w = portalWindow(key);
    if (!w || typeof w.sayText !== "function") {
      resolve({ ok: false, why: `${LIVE_NAMES[key] || key}'s face is not ready` });
      return;
    }
    let started = false;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      signal?.removeEventListener?.("abort", onAbort);
      resolve(result);
    };
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== w) return;
      const type = event.data?.type;
      if (type === "sitepal-portal-talk-started") started = true;
      // An end before this line's start is the tail of something earlier.
      if (type === "sitepal-portal-talk-ended" && started) finish({ ok: true });
    };
    const onAbort = () => {
      try { w.stopSpeech?.(); } catch {}
      finish({ ok: false, why: "stopped" });
    };
    const timer = setTimeout(
      () => finish({ ok: true, why: started ? "no end reported" : "never started" }),
      lineTimeoutMs(text),
    );
    window.addEventListener("message", onMessage);
    signal?.addEventListener?.("abort", onAbort);
    try {
      w.stopSpeech?.();
      w.setPlayerVolume?.(7);
      w.sayText(spoken(text), voice, LIVE_TTS.lang, LIVE_TTS.engine);
    } catch (error) {
      console.warn("[LTTvLiveDesk] sayText failed", error);
      finish({ ok: false, why: "SitePal refused the line" });
    }
  });
}

export default function LTTvLiveDesk({ show = null, episodePlaying = false }) {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [live, setLive] = useState(false);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [airing, setAiring] = useState(null); // { id, line }
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState("");
  const [faces, setFaces] = useState({});
  const [banterOn, setBanterOn] = useState(true);
  const [banterAfter, setBanterAfter] = useState(20);
  // The next piece of banter, written ahead: { show, status, lines, error }.
  const [spare, setSpare] = useState(null);
  const [banterOnAir, setBanterOnAir] = useState(null); // its lines, while airing
  const [nextId, setNextId] = useState(null); // a question waiting for banter to yield
  const abortRef = useRef(null);
  const airingRef = useRef(null); // { id, kind } — read by the banter timer
  const quietSinceRef = useRef(0);
  const nextRef = useRef(null);
  const spareTokenRef = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const historyRef = useRef(history);
  historyRef.current = history;

  const cfg = LIVE_SHOWS[show] || null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).get("live")) return;
    setVisible(true);
    const saved = readSaved();
    if (Array.isArray(saved?.items)) {
      // Anything that was mid-write when the page went away has no request
      // behind it any more; offer it again rather than spinning forever.
      setItems(saved.items.map((it) =>
        it.status === "writing" || it.status === "airing"
          ? { ...it, status: it.lines?.length ? "ready" : "error", error: it.lines?.length ? "" : "The page reloaded before this was written." }
          : it,
      ));
    }
    if (Array.isArray(saved?.history)) setHistory(saved.history);
    if (typeof saved?.banterOn === "boolean") setBanterOn(saved.banterOn);
    if (BANTER_WAITS.includes(saved?.banterAfter)) setBanterAfter(saved.banterAfter);
  }, []);

  useEffect(() => {
    if (!visible) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, history: history.slice(-12), banterOn, banterAfter }));
    } catch {}
  }, [visible, items, history, banterOn, banterAfter]);

  // Which faces on this set can speak. Polled: the set loads long after the
  // desk mounts and says nothing when it does.
  useEffect(() => {
    if (!visible || !cfg) return;
    const check = () => {
      const next = {};
      cfg.actors.forEach((key) => {
        const w = portalWindow(key);
        next[key] = !w ? "loading" : typeof w.sayText === "function" ? "ready" : "no-api";
      });
      setFaces(next);
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [visible, cfg]);

  // LIVE is the desk holding the set as a show: lights up, camera directed,
  // the episode preloads kept out of the portals. Always let go on the way out
  // — a page that came back holding the house up would look like a broken cue.
  useEffect(() => {
    const on = visible && live && !!cfg;
    TALKSHOW_LIVE.on = on;
    TALKSHOW_LIVE.cast = on ? cfg.actors : null;
    TALKSHOW_LIVE.speaker = null;
    TALKSHOW_LIVE.listener = null;
    TALKSHOW_LIVE.framing = "two";
    // The lights are only touched while live, so a lighting or faces board
    // open alongside keeps whatever pin it set.
    if (on) HOUSE_PREVIEW.force = "on";
    // Going live starts the quiet clock, so banter does not open the show
    // before the producer has said anything.
    if (on) quietSinceRef.current = Date.now();
    return () => {
      TALKSHOW_LIVE.on = false;
      TALKSHOW_LIVE.cast = null;
      TALKSHOW_LIVE.speaker = null;
      TALKSHOW_LIVE.listener = null;
      if (on) HOUSE_PREVIEW.force = null;
    };
  }, [visible, live, cfg]);

  // Leaving the set, or an episode starting, ends anything on air.
  useEffect(() => {
    if ((!cfg || episodePlaying) && abortRef.current) abortRef.current.abort();
  }, [cfg, episodePlaying]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((id, fields) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...fields } : it)));
  }, []);

  const write = useCallback(async (item) => {
    patch(item.id, { status: "writing", error: "", lines: null });
    try {
      const res = await fetch("/api/lt-tv/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          show: item.show,
          name: item.name,
          question: item.question,
          recent: historyRef.current.filter((h) => h.show === item.show).slice(-4),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401 && body?.signIn) {
        setNeedsSignIn(true);
        patch(item.id, { status: "error", error: "Sign in below, then press Try again." });
        return;
      }
      if (!res.ok || !Array.isArray(body?.lines)) {
        patch(item.id, { status: "error", error: body?.error || `The writer failed (${res.status}).` });
        return;
      }
      patch(item.id, { status: "ready", lines: body.lines });
    } catch (error) {
      patch(item.id, { status: "error", error: "Could not reach the writer. Check the connection and try again." });
    }
  }, [patch]);

  const add = (event) => {
    event?.preventDefault?.();
    const q = cleanQuestion(question);
    if (!q || !cfg) return;
    const item = { id: newId(), show, name: cleanName(name), question: q, status: "writing", lines: null, error: "" };
    setItems((list) => [...list, item]);
    setQuestion("");
    setName("");
    write(item);
  };

  const signIn = async (event) => {
    event?.preventDefault?.();
    setSignInError("");
    try {
      const res = await fetch("/api/lt-tv/lineup-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSignInError(body?.error || "That did not work.");
        return;
      }
      setNeedsSignIn(false);
      setPassword("");
      // Everything that failed for want of a session gets written now.
      itemsRef.current.filter((it) => it.status === "error").forEach((it) => write(it));
      setSpare((sp) => (sp?.status === "error" ? null : sp));
    } catch {
      setSignInError("Could not reach the site.");
    }
  };

  /**
   * Performs lines on the set: the camera on whoever speaks, the other one
   * listening, one line after another until the end, Stop, or — for banter —
   * a question cutting in.
   */
  const perform = async ({ id, kind, lines }) => {
    if (!live) setLive(true);
    // Let the live effect run first so the lights and camera are already up
    // when the first word lands.
    await new Promise((r) => setTimeout(r, 60));
    TALKSHOW_LIVE.on = true;
    TALKSHOW_LIVE.cast = cfg.actors;
    HOUSE_PREVIEW.force = "on";

    const controller = new AbortController();
    abortRef.current = controller;
    airingRef.current = { id, kind };
    const shots = kind === BANTER ? SHOT_FOR_BANTER : SHOT_FOR_LINE;
    const used = new Set();
    let stopped = false;
    let yielded = false;
    let problem = "";

    for (let i = 0; i < lines.length; i += 1) {
      if (controller.signal.aborted) { stopped = true; break; }
      // Banter gives way to a question at the end of the line being spoken.
      if (kind === BANTER && nextRef.current) { yielded = true; break; }
      const line = lines[i];
      if (!cfg.actors.includes(line.speaker) || !line.voice) continue;
      setAiring({ id, line: i });
      TALKSHOW_LIVE.speaker = line.speaker;
      TALKSHOW_LIVE.listener = cfg.actors.find((a) => a !== line.speaker) || null;
      TALKSHOW_LIVE.framing = shots[i] || "single";
      used.add(line.speaker);
      const result = await speakLine({ key: line.speaker, text: line.text, voice: line.voice, signal: controller.signal });
      if (result.why === "stopped") { stopped = true; break; }
      if (!result.ok) problem = result.why;
      else if (result.why) console.warn(`[LTTvLiveDesk] line ${i + 1}: ${result.why}`);
      await new Promise((r) => setTimeout(r, GAP_MS));
    }

    // Back to the two-shot, and the portals muted again: the episode preloads
    // load clips into them silently, and assume they are silent.
    TALKSHOW_LIVE.speaker = null;
    TALKSHOW_LIVE.listener = null;
    TALKSHOW_LIVE.framing = "two";
    used.forEach((key) => {
      try { portalWindow(key)?.setPlayerVolume?.(0); } catch {}
    });
    if (abortRef.current === controller) abortRef.current = null;
    airingRef.current = null;
    quietSinceRef.current = Date.now();
    setAiring(null);
    return { stopped, yielded, problem };
  };

  const air = async (item) => {
    if (!cfg || episodePlaying || !item.lines?.length) return;
    if (airingRef.current) {
      // During banter, a question goes next rather than waiting for the end.
      if (airingRef.current.kind === BANTER) {
        nextRef.current = item.id;
        setNextId(item.id);
      }
      return;
    }
    patch(item.id, { status: "airing" });
    const { stopped, problem } = await perform({ id: item.id, kind: "question", lines: item.lines });
    if (stopped) {
      patch(item.id, { status: "ready", error: "Stopped part way through." });
      return;
    }
    patch(item.id, { status: "aired", error: problem });
    setHistory((list) => [...list, { show: item.show, name: item.name, question: item.question, lines: item.lines }].slice(-12));
  };
  const airRef = useRef(air);
  airRef.current = air;

  // ── Banter ──────────────────────────────────────────────────────────────

  const writeBanter = useCallback(async (forShow) => {
    const token = ++spareTokenRef.current;
    setSpare({ show: forShow, status: "writing", lines: null, error: "" });
    const settle = (fields) => {
      // A set change or a skip while this was being written makes it stale.
      if (spareTokenRef.current === token) setSpare({ show: forShow, lines: null, error: "", ...fields });
    };
    try {
      const res = await fetch("/api/lt-tv/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: BANTER,
          show: forShow,
          recent: historyRef.current.filter((h) => h.show === forShow).slice(-4),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401 && body?.signIn) {
        setNeedsSignIn(true);
        settle({ status: "error", error: "Sign in below and it will be written." });
        return;
      }
      if (!res.ok || !Array.isArray(body?.lines)) {
        settle({ status: "error", error: body?.error || `The writer failed (${res.status}).` });
        return;
      }
      settle({ status: "ready", lines: body.lines });
    } catch {
      settle({ status: "error", error: "Could not reach the writer." });
    }
  }, []);

  // Keep one piece written ahead while live, so it airs the moment it is due.
  // Nothing is written while the desk is not live: each piece costs a call.
  useEffect(() => {
    if (!visible || !live || !cfg || !banterOn) return;
    if (spare && spare.show === show) return;
    writeBanter(show);
  }, [visible, live, cfg, banterOn, show, spare, writeBanter]);

  const airBanter = async () => {
    const piece = spare;
    if (!cfg || airingRef.current || episodePlaying || piece?.status !== "ready" || piece.show !== show) return;
    // Straight into tonight's history, so the next piece — written while this
    // one airs — knows what was just said.
    setHistory((list) => [...list, { show, kind: BANTER, lines: piece.lines }].slice(-12));
    setBanterOnAir(piece.lines);
    setSpare(null);
    const { stopped } = await perform({ id: BANTER, kind: BANTER, lines: piece.lines });
    setBanterOnAir(null);
    // A question pressed during the last line is still waiting when banter
    // ends on its own, so it goes on either way — unless Stop was pressed.
    const waiting = nextRef.current;
    nextRef.current = null;
    setNextId(null);
    if (stopped || !waiting) return;
    const item = itemsRef.current.find((it) => it.id === waiting);
    if (item?.lines?.length && (item.status === "ready" || item.status === "aired")) airRef.current(item);
  };
  const airBanterRef = useRef(airBanter);
  airBanterRef.current = airBanter;

  // The cue: live, nothing on air, nothing in the queue for this set, and
  // quiet for long enough. Checked every second from refs, so the timer does
  // not restart every time the desk re-renders.
  const facesReadyNow = cfg ? cfg.actors.every((k) => faces[k] === "ready") : false;
  const cueRef = useRef({});
  cueRef.current = { banterAfter, episodePlaying, facesReady: facesReadyNow };
  useEffect(() => {
    if (!visible || !live || !cfg || !banterOn) return;
    const id = setInterval(() => {
      const cue = cueRef.current;
      if (airingRef.current || cue.episodePlaying || !cue.facesReady) return;
      if (itemsRef.current.some((it) => it.show === show && (it.status === "ready" || it.status === "writing"))) return;
      if (Date.now() - quietSinceRef.current < cue.banterAfter * 1000) return;
      airBanterRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [visible, live, cfg, banterOn, show]);

  const stop = () => {
    nextRef.current = null;
    setNextId(null);
    abortRef.current?.abort();
  };
  const drop = (id) => setItems((list) => list.filter((it) => it.id !== id));
  const clearAired = () => setItems((list) => list.filter((it) => it.status !== "aired"));

  if (!visible) return null;

  if (collapsed) {
    return (
      <div style={S.collapsed}>
        <button type="button" style={S.chip} onClick={() => setCollapsed(false)}>
          {live ? "● LIVE desk" : "Live desk"}
        </button>
      </div>
    );
  }

  const queue = items.filter((it) => it.show === show);
  const others = items.length - queue.length;
  const facesReady = facesReadyNow;
  const banterAiring = airing?.id === BANTER;
  const onAirItem = airing ? items.find((it) => it.id === airing.id) : null;

  return (
    <>
      {live && cfg && <div style={S.bug} aria-hidden="true">● LIVE</div>}
      {onAirItem && (
        <div style={S.lowerThird} aria-live="polite">
          <div style={S.lowerThirdLabel}>{onAirItem.name} asks</div>
          <div style={S.lowerThirdText}>{onAirItem.question}</div>
        </div>
      )}

      <div style={S.panel}>
        <div style={S.head}>
          <b style={S.title}>LIVE DESK</b>
          <button type="button" style={S.chip} onClick={() => setCollapsed(true)} aria-label="Collapse">‹</button>
        </div>

        {!cfg ? (
          <div style={S.note}>
            Open LT TV and go into the news set or the Markets &amp; Morality set. The desk runs on whichever set is showing.
          </div>
        ) : (
          <>
            <div style={S.note}>
              {cfg.title}: {LIVE_NAMES[cfg.reader]} reads each question, then {cfg.actors.map((a) => LIVE_NAMES[a]).join(" and ")} answer it.
            </div>
            <div style={S.row}>
              {cfg.actors.map((key) => (
                <span key={key} style={S.sub}>
                  {LIVE_NAMES[key]}:{" "}
                  <span style={faces[key] === "ready" ? S.ok : S.warn}>
                    {faces[key] === "ready" ? "ready" : faces[key] === "no-api" ? "no live speech" : "loading"}
                  </span>
                </span>
              ))}
            </div>
            <div style={S.row}>
              <button
                type="button"
                style={{ ...S.toggle, ...(live ? S.liveOn : null) }}
                onClick={() => setLive((v) => !v)}
                disabled={!!airing}
              >
                {live ? "● Live — press to end" : "Go live"}
              </button>
              {airing && <button type="button" style={S.danger} onClick={stop}>Stop</button>}
            </div>
            {episodePlaying && <div style={S.warnNote}>An episode is playing. Stop it before airing a question.</div>}
          </>
        )}

        {needsSignIn && (
          <form style={S.group} onSubmit={signIn}>
            <div style={S.groupLabel}>Sign in</div>
            <div style={S.sub}>The same admin password as the lineup page.</div>
            <div style={S.row}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={S.input}
                placeholder="Admin password"
                autoComplete="current-password"
              />
              <button type="submit" style={S.primary}>Sign in</button>
            </div>
            {signInError && <div style={S.warnNote}>{signInError}</div>}
          </form>
        )}

        {cfg && (
          <form style={S.group} onSubmit={add}>
            <div style={S.groupLabel}>Add a question</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...S.input, width: "100%", marginBottom: 6 }}
              placeholder="Viewer's name"
              maxLength={MAX_NAME_CHARS}
            />
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) add(e);
              }}
              style={S.textarea}
              placeholder="Paste the question from the chat"
              maxLength={MAX_QUESTION_CHARS}
              rows={3}
            />
            <div style={S.row}>
              <button type="submit" style={S.primary} disabled={!question.trim()}>Write the answer</button>
              <span style={S.fine}>Enter adds it. It is written straight away so it is ready when you are.</span>
            </div>
          </form>
        )}

        {cfg && (
          <div style={S.group}>
            <div style={S.groupLabel}>
              Queue {queue.length ? `(${queue.length})` : ""}
              {queue.some((it) => it.status === "aired") && (
                <button type="button" style={{ ...S.link, marginLeft: 8 }} onClick={clearAired}>clear aired</button>
              )}
            </div>
            {!queue.length && <div style={S.sub}>Nothing yet.</div>}
            {queue.map((it) => (
              <div key={it.id} style={{ ...S.card, ...(it.status === "airing" ? S.cardOnAir : null), ...(it.status === "aired" ? S.cardAired : null) }}>
                <div style={S.cardHead}>
                  <b style={S.asker}>{it.name}</b>
                  <span style={S.status[it.status] || S.sub}>{STATUS_LABEL[it.status] || it.status}</span>
                </div>
                <div style={S.q}>{it.question}</div>
                {it.lines?.length > 0 && (
                  <ol style={S.lines}>
                    {it.lines.map((line, i) => (
                      <li key={i} style={airing?.id === it.id && airing.line === i ? S.lineOn : S.line}>
                        <b>{LIVE_NAMES[line.speaker] || line.speaker}:</b> {line.text}
                      </li>
                    ))}
                  </ol>
                )}
                {it.error && <div style={S.warnNote}>{it.error}</div>}
                <div style={S.row}>
                  {(it.status === "ready" || it.status === "aired") && (
                    <button
                      type="button"
                      style={{ ...S.primary, ...((airing && !banterAiring) || nextId || episodePlaying || !facesReady ? S.disabled : null) }}
                      onClick={() => air(it)}
                      disabled={(!!airing && !banterAiring) || !!nextId || episodePlaying || !facesReady}
                      title={!facesReady ? "Waiting for the faces to load" : banterAiring ? "Cuts in when the line being spoken ends" : ""}
                    >
                      {nextId === it.id ? "Up next…" : banterAiring ? "Air next" : it.status === "aired" ? "Air it again" : "Air it"}
                    </button>
                  )}
                  {it.status !== "writing" && it.status !== "airing" && (
                    <button type="button" style={S.chip} onClick={() => write(it)}>
                      {it.status === "error" ? "Try again" : "Rewrite"}
                    </button>
                  )}
                  {it.status !== "airing" && (
                    <button type="button" style={S.chip} onClick={() => drop(it.id)}>Drop</button>
                  )}
                </div>
              </div>
            ))}
            {queue.some((it) => it.status === "ready") && !facesReady && (
              <div style={S.warnNote}>The faces are still loading. Air it comes on when both are ready.</div>
            )}
            {others > 0 && <div style={S.fine}>{others} more waiting for the other set.</div>}
          </div>
        )}

        {cfg && (
          <div style={S.group}>
            <div style={S.groupLabel}>Between questions</div>
            <div style={S.row}>
              <button
                type="button"
                style={{ ...S.chip, ...(banterOn ? S.chipOn : null) }}
                onClick={() => setBanterOn((v) => !v)}
              >
                {banterOn ? "Banter: on" : "Banter: off"}
              </button>
              <label style={S.sub}>
                after{" "}
                <select value={banterAfter} onChange={(e) => setBanterAfter(Number(e.target.value))} style={S.select}>
                  {BANTER_WAITS.map((n) => <option key={n} value={n}>{n}s</option>)}
                </select>{" "}
                quiet
              </label>
            </div>
            {!banterOn ? (
              <div style={S.sub}>Off. The set stays quiet between questions.</div>
            ) : !live ? (
              <div style={S.sub}>When you go live, {cfg.actors.map((a) => LIVE_NAMES[a]).join(" and ")} talk between questions whenever the queue is empty.</div>
            ) : (
              <div style={{ ...S.card, ...(banterAiring ? S.cardOnAir : null) }}>
                <div style={S.cardHead}>
                  <b style={S.asker}>{banterAiring ? "Banter" : "Next banter"}</b>
                  <span style={banterAiring ? S.status.airing : S.status[spare?.status] || S.sub}>
                    {banterAiring ? "on air" : spare?.status === "writing" ? "writing…" : spare?.status === "ready" ? "ready" : spare?.status === "error" ? "needs attention" : ""}
                  </span>
                </div>
                {(banterAiring ? banterOnAir : spare?.lines)?.length > 0 && (
                  <ol style={S.lines}>
                    {(banterAiring ? banterOnAir : spare.lines).map((line, i) => (
                      <li key={i} style={banterAiring && airing.line === i ? S.lineOn : S.line}>
                        <b>{LIVE_NAMES[line.speaker] || line.speaker}:</b> {line.text}
                      </li>
                    ))}
                  </ol>
                )}
                {!banterAiring && spare?.error && <div style={S.warnNote}>{spare.error}</div>}
                {banterAiring && nextId && <div style={S.sub}>The question goes on when this line ends.</div>}
                {!banterAiring && (
                  <div style={S.row}>
                    {spare?.status === "ready" && (
                      <button
                        type="button"
                        style={{ ...S.chip, ...(airing || episodePlaying || !facesReady ? S.disabled : null) }}
                        onClick={() => airBanter()}
                        disabled={!!airing || episodePlaying || !facesReady}
                      >
                        Banter now
                      </button>
                    )}
                    {spare?.status !== "writing" && (
                      <button type="button" style={S.chip} onClick={() => setSpare(null)}>
                        {spare?.status === "error" ? "Try again" : "Write another"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={S.fine}>
          Banter is one writer call per piece, and only while live. Each question is one call to the writer. Each line is spoken live by SitePal in the character&apos;s own ElevenLabs voice, once, in this browser only.
        </div>
      </div>
    </>
  );
}

const STATUS_LABEL = {
  writing: "writing…",
  ready: "ready",
  airing: "on air",
  aired: "aired",
  error: "needs attention",
};

const S = {
  panel: {
    position: "fixed", top: 12, right: 64, zIndex: 100000, width: 320,
    maxHeight: "calc(100vh - 24px)", overflowY: "auto",
    background: "rgba(6, 8, 14, 0.94)", border: "1px solid rgba(150,170,200,0.35)",
    borderRadius: 10, padding: "10px 12px 12px",
    font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace", color: "#cfe3ff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  },
  collapsed: { position: "fixed", top: 12, right: 64, zIndex: 100000 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: "#ff5a5a", letterSpacing: "0.12em", fontSize: 12 },
  note: { color: "#8aa0bd", margin: "6px 0 8px", fontSize: 11 },
  warnNote: { color: "#ffb86b", fontSize: 11, margin: "4px 0" },
  group: { borderTop: "1px solid rgba(150,170,200,0.18)", paddingTop: 8, marginTop: 8 },
  groupLabel: { color: "#8aa0bd", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10, marginBottom: 6 },
  row: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "6px 0" },
  sub: { color: "#8aa0bd", fontSize: 11 },
  ok: { color: "#7fe0a0" },
  warn: { color: "#ffb86b" },
  fine: { color: "#6f83a0", fontSize: 10, marginTop: 8, lineHeight: 1.45 },
  input: {
    background: "rgba(20,26,38,0.9)", color: "#e6f0ff", border: "1px solid rgba(150,170,200,0.3)",
    borderRadius: 6, padding: "5px 8px", font: "inherit", boxSizing: "border-box",
  },
  textarea: {
    width: "100%", boxSizing: "border-box", resize: "vertical",
    background: "rgba(20,26,38,0.9)", color: "#e6f0ff", border: "1px solid rgba(150,170,200,0.3)",
    borderRadius: 6, padding: "6px 8px", font: "inherit",
  },
  toggle: {
    background: "rgba(20,26,38,0.9)", color: "#cfe3ff", cursor: "pointer",
    border: "1px solid rgba(150,170,200,0.3)", borderRadius: 6, padding: "5px 10px", font: "inherit",
  },
  liveOn: { background: "#c62828", color: "#fff", borderColor: "#c62828", fontWeight: 700 },
  chip: {
    background: "rgba(20,26,38,0.9)", color: "#cfe3ff", cursor: "pointer",
    border: "1px solid rgba(150,170,200,0.3)", borderRadius: 6, padding: "3px 8px", font: "inherit",
  },
  chipOn: { borderColor: "#7fe0a0", color: "#7fe0a0" },
  select: {
    background: "rgba(20,26,38,0.9)", color: "#e6f0ff", border: "1px solid rgba(150,170,200,0.3)",
    borderRadius: 6, padding: "2px 4px", font: "inherit",
  },
  link: { background: "none", border: 0, color: "#8fb8ff", cursor: "pointer", font: "inherit", fontSize: 10, padding: 0, textTransform: "none", letterSpacing: 0 },
  primary: {
    background: "#ffcf4d", color: "#10131b", cursor: "pointer", fontWeight: 700,
    border: 0, borderRadius: 6, padding: "5px 10px", font: "inherit",
  },
  disabled: { opacity: 0.45, cursor: "not-allowed" },
  danger: {
    background: "#c62828", color: "#fff", cursor: "pointer", fontWeight: 700,
    border: 0, borderRadius: 6, padding: "5px 10px", font: "inherit",
  },
  card: {
    border: "1px solid rgba(150,170,200,0.22)", borderRadius: 8, padding: "7px 8px", margin: "6px 0",
    background: "rgba(14,18,28,0.9)",
  },
  cardOnAir: { borderColor: "#c62828", boxShadow: "0 0 0 1px #c62828 inset" },
  cardAired: { opacity: 0.6 },
  cardHead: { display: "flex", justifyContent: "space-between", gap: 8 },
  asker: { color: "#fff" },
  q: { color: "#e6f0ff", margin: "3px 0 4px" },
  lines: { margin: "4px 0 2px", paddingLeft: 18, color: "#b9cbe6" },
  line: { margin: "2px 0" },
  lineOn: { margin: "2px 0", color: "#fff", background: "rgba(198,40,40,0.25)" },
  status: {
    writing: { color: "#8fb8ff", fontSize: 11 },
    ready: { color: "#7fe0a0", fontSize: 11 },
    airing: { color: "#ff5a5a", fontSize: 11, fontWeight: 700 },
    aired: { color: "#8aa0bd", fontSize: 11 },
    error: { color: "#ffb86b", fontSize: 11 },
  },
  // On the picture itself, for the broadcast: a LIVE bug and a lower third
  // carrying the question while it is being answered.
  bug: {
    position: "fixed", top: 16, left: 16, zIndex: 99990, pointerEvents: "none",
    background: "#c62828", color: "#fff", borderRadius: 4, padding: "4px 10px",
    font: "700 13px/1.2 system-ui, -apple-system, Segoe UI, sans-serif", letterSpacing: "0.12em",
  },
  lowerThird: {
    position: "fixed", left: "50%", bottom: 48, transform: "translateX(-50%)", zIndex: 99990,
    pointerEvents: "none", width: "min(720px, calc(100vw - 32px))",
    background: "rgba(8,10,18,0.88)", borderLeft: "4px solid #c62828", borderRadius: 4,
    padding: "10px 14px", color: "#fff", font: "15px/1.35 system-ui, -apple-system, Segoe UI, sans-serif",
  },
  lowerThirdLabel: { color: "#ff8a80", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 },
  lowerThirdText: { fontSize: 16 },
};
