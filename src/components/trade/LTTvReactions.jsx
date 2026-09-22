"use client";

// WHAT VIEWERS SAY ABOUT AN EPISODE — the star rating and the comments, the
// pair of them, because they answer the same question from two sides.
//
// One component for both screens. The desktop console opens it as a sheet the
// way it opens the program guide; the phone stacks it under the episode rack,
// which is where a viewer coming off a video expects to find it. Nothing in
// here knows which one it is in beyond `compact`, which only trims the
// padding.
//
// Reading is open to everybody. Rating and commenting need a Clerk sign-in,
// asked for with openSignIn() — a modal, NOT a redirect, because the LT TV set
// is a loaded 3D scene and sending a viewer away to sign in would tear it down
// and make them wait through the loader again to say "good episode".

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import {
  COMMENT_MAX_LEN,
  RATING_MAX,
  ratingSummary,
} from "@/lib/ltTv/reactions.mjs";
import {
  EMPTY_STATS,
  clearSignInReturn,
  deleteComment,
  editComment,
  fetchEpisodeReactions,
  fetchMyRating,
  peekSignInReturn,
  postComment,
  rememberBeforeSignIn,
  saveRating,
} from "@/lib/ltTvReactions";

const STARS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

/**
 * An episode's tally and comments, with a reload. Exported so the console can
 * badge its button with the average and then hand the same data to the panel,
 * rather than both of them asking for it.
 */
export function useEpisodeReactions(episodeId) {
  const [state, setState] = useState({ stats: EMPTY_STATS, comments: [] });

  const reload = useCallback(async () => {
    if (!episodeId) {
      setState({ stats: EMPTY_STATS, comments: [] });
      return;
    }
    const res = await fetchEpisodeReactions(episodeId);
    if (res.ok) setState({ stats: res.stats, comments: res.comments });
  }, [episodeId]);

  useEffect(() => {
    let live = true;
    if (!episodeId) {
      setState({ stats: EMPTY_STATS, comments: [] });
      return () => { live = false; };
    }
    // Show the previous episode's numbers to nobody.
    setState({ stats: EMPTY_STATS, comments: [] });
    fetchEpisodeReactions(episodeId).then((res) => {
      if (live && res.ok) setState({ stats: res.stats, comments: res.comments });
    });
    return () => { live = false; };
  }, [episodeId]);

  return { ...state, reload };
}

function whenWritten(ms) {
  // Null means the write has not been timestamped by the server yet, which for
  // a comment the viewer has this second posted means now.
  if (!ms) return "just now";
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function LTTvReactions({ episodeId, episodeTitle, compact = false, reactions }) {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { openSignIn } = useClerk();

  // The console already has this for its button; on the phone the panel is on
  // its own and fetches for itself.
  const own = useEpisodeReactions(reactions ? null : episodeId);
  const { stats, comments, reload } = reactions || own;
  const [myRating, setMyRating] = useState(null);
  const [hoverStar, setHoverStar] = useState(0);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // A star clicked while signed out. Held in state rather than in storage, so
  // it waits for Clerk to finish loading rather than racing it.
  const [pendingStar, setPendingStar] = useState(null);
  const [notice, setNotice] = useState(null);
  const draftRef = useRef(null);

  const summary = useMemo(() => ratingSummary(stats), [stats]);
  const viewerName =
    user?.username || user?.firstName || user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Viewer";

  // A viewer's own star is private, so it comes back from the API with their
  // token rather than from the feed. Re-asked when the episode changes or they
  // sign in; cleared when they sign out so the previous viewer's star does not
  // stay lit on a shared machine.
  useEffect(() => {
    let live = true;
    if (!episodeId || !isSignedIn) {
      setMyRating(null);
      return () => { live = false; };
    }
    fetchMyRating(episodeId, getToken).then((res) => {
      if (live && res.ok) setMyRating(res.rating ?? null);
    });
    return () => { live = false; };
  }, [episodeId, isSignedIn, getToken]);

  // Switching episodes must not carry a half-typed comment onto another show
  // — unless the "switch" is this episode coming back from a sign-in, which is
  // the one case where the draft in hand is still the draft in hand.
  useEffect(() => {
    const returning = peekSignInReturn();
    if (returning && returning.episodeId === episodeId) {
      setDraft(returning.draft);
      setPendingStar(returning.rating);
      clearSignInReturn();
    } else {
      setDraft("");
      setPendingStar(null);
    }
    setEditingId(null);
    setNotice(null);
  }, [episodeId]);

  // Signing in navigates away and back. Two things have to survive it: the
  // address, which carries the episode (see src/lib/ltTv/watchUrl.mjs), and
  // the half-written comment, which does not belong in a URL.
  const requireSignIn = useCallback(
    (rating = null) => {
      rememberBeforeSignIn(episodeId, { draft, rating });
      const here =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/trade";
      openSignIn?.({ forceRedirectUrl: here });
    },
    [draft, episodeId, openSignIn],
  );

  const rate = useCallback(
    async (value) => {
      if (!isSignedIn) return requireSignIn(value);
      if (busy) return;
      // Clicking the star you already gave takes the rating back, the way a
      // toggle should; the tally then forgets you entirely.
      const next = myRating === value ? null : value;
      const previous = myRating;
      setMyRating(next); // optimistic: the star lights under the cursor
      setBusy(true);
      const res = await saveRating(episodeId, next, getToken);
      setBusy(false);
      if (!res.ok) {
        setMyRating(previous);
        setNotice(res.reason);
      } else {
        setNotice(null);
        reload();
      }
    },
    [busy, episodeId, getToken, isSignedIn, myRating, reload, requireSignIn],
  );

  // The star they clicked on the way to signing in, landed now that they are
  // back and signed in. One shot: cleared whether or not it took, so a refusal
  // cannot loop.
  useEffect(() => {
    if (pendingStar == null || !isSignedIn || !episodeId) return;
    const star = pendingStar;
    setPendingStar(null);
    setMyRating(star);
    saveRating(episodeId, star, getToken).then((res) => {
      if (res.ok) reload();
      else {
        setMyRating(null);
        setNotice(res.reason);
      }
    });
  }, [episodeId, getToken, isSignedIn, pendingStar, reload]);

  const send = useCallback(async () => {
    if (!isSignedIn) return requireSignIn();
    if (busy || !draft.trim()) return;
    setBusy(true);
    const res = await postComment({
      episodeId,
      text: draft,
      displayName: viewerName,
      avatarUrl: user?.imageUrl || null,
      getToken,
    });
    setBusy(false);
    if (res.ok) {
      setDraft("");
      setNotice(null);
      reload();
    } else {
      setNotice(res.reason);
    }
  }, [busy, draft, episodeId, getToken, isSignedIn, reload, requireSignIn, user, viewerName]);

  const saveEdit = useCallback(async () => {
    if (busy || !editingId) return;
    setBusy(true);
    const res = await editComment({ episodeId, id: editingId, text: editDraft, getToken });
    setBusy(false);
    if (res.ok) {
      setEditingId(null);
      setNotice(null);
      reload();
    } else {
      setNotice(res.reason);
    }
  }, [busy, editDraft, editingId, episodeId, getToken, reload]);

  const remove = useCallback(
    async (id) => {
      if (busy) return;
      setBusy(true);
      const res = await deleteComment({ episodeId, id, getToken });
      setBusy(false);
      if (res.ok) reload();
      else setNotice(res.reason);
    },
    [busy, episodeId, getToken, reload],
  );

  if (!episodeId) return null;

  const shown = hoverStar || myRating || 0;

  return (
    <section
      className={`ltr-root${compact ? " is-compact" : ""}`}
      aria-label={`Ratings and comments for ${episodeTitle || "this episode"}`}
    >
      <div className="ltr-rating">
        <div
          className="ltr-stars"
          role="radiogroup"
          aria-label={`Rate this episode out of ${RATING_MAX}`}
          onMouseLeave={() => setHoverStar(0)}
        >
          {STARS.map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={myRating === star}
              aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
              className={`ltr-star${star <= shown ? " is-lit" : ""}`}
              onMouseEnter={() => setHoverStar(star)}
              onFocus={() => setHoverStar(star)}
              onBlur={() => setHoverStar(0)}
              onClick={() => rate(star)}
              disabled={busy}
            >
              ★
            </button>
          ))}
        </div>
        <div className="ltr-score">
          <b>{summary.display}</b>
          <span>{summary.label}</span>
        </div>
      </div>

      {isSignedIn && myRating != null && (
        <p className="ltr-yours">
          You gave this {myRating} out of {RATING_MAX}.{" "}
          <button type="button" className="ltr-link" onClick={() => rate(myRating)} disabled={busy}>
            Clear
          </button>
        </p>
      )}

      <h4 className="ltr-heading">
        {stats.commentCount || comments.length
          ? `${stats.commentCount || comments.length} ${
              (stats.commentCount || comments.length) === 1 ? "comment" : "comments"
            }`
          : "Comments"}
      </h4>

      {/* THE BOX IS THERE WHETHER OR NOT YOU ARE SIGNED IN. Asking somebody to
          sign in before they are allowed to type is asking them to decide
          whether the thought is worth the errand; letting them write it first
          and signing in to send it keeps the words, which come back with them.
          Same for a star: clicking one signed out asks for the sign-in and
          then lands the star, since a star is one click with nothing to
          reconsider. The comment is NOT sent on the way back — it is put back
          in the box, because words that go public get a last look. */}
      <div className="ltr-compose">
        <textarea
          ref={draftRef}
          value={draft}
          maxLength={COMMENT_MAX_LEN}
          rows={compact ? 2 : 3}
          placeholder="What did you make of this episode?"
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Write a comment"
        />
        <div className="ltr-compose-row">
          <span className="ltr-count">
            {draft.length}/{COMMENT_MAX_LEN}
          </span>
          <button type="button" className="ltr-send" onClick={send} disabled={busy || !draft.trim()}>
            {busy ? "Sending…" : isSignedIn ? "Comment" : "Sign in and comment"}
          </button>
        </div>
      </div>

      {notice && (
        <p className="ltr-notice" role="status">
          {notice}
        </p>
      )}

      <ul className="ltr-list">
        {comments.length === 0 && <li className="ltr-empty">No comments yet. Say the first thing.</li>}
        {comments.map((comment) => {
          const mine = isSignedIn && comment.userId && comment.userId === user?.id;
          return (
            <li key={comment.id} className="ltr-comment">
              {comment.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ltr-avatar" src={comment.avatarUrl} alt="" />
              ) : (
                <span className="ltr-avatar ltr-avatar-blank" aria-hidden="true">
                  {(comment.displayName || "V").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="ltr-body">
                <div className="ltr-byline">
                  <b>{comment.displayName || "Viewer"}</b>
                  <span>{whenWritten(comment.createdAt)}</span>
                  {comment.edited && <span className="ltr-edited">edited</span>}
                </div>
                {editingId === comment.id ? (
                  <div className="ltr-compose">
                    <textarea
                      value={editDraft}
                      maxLength={COMMENT_MAX_LEN}
                      rows={2}
                      onChange={(event) => setEditDraft(event.target.value)}
                      aria-label="Edit your comment"
                    />
                    <div className="ltr-compose-row">
                      <button type="button" className="ltr-link" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                      <button type="button" className="ltr-send" onClick={saveEdit} disabled={busy}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="ltr-text">{comment.text}</p>
                )}
                {mine && editingId !== comment.id && (
                  <div className="ltr-own">
                    <button
                      type="button"
                      className="ltr-link"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditDraft(comment.text || "");
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="ltr-link" onClick={() => remove(comment.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <style jsx>{`
        .ltr-root {
          --cyan: #20d7f2;
          --magenta: #ef62dc;
          color: #f7f4fa;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: left;
        }
        .ltr-root *, .ltr-root *::before { box-sizing: border-box; }
        .ltr-rating { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .ltr-stars { display: flex; gap: 2px; }
        .ltr-star {
          background: none; border: 0; padding: 0 2px; cursor: pointer;
          font-size: ${compact ? "24px" : "22px"}; line-height: 1;
          color: rgba(247, 244, 250, 0.25); transition: color 120ms ease, transform 120ms ease;
        }
        .ltr-star.is-lit { color: #ffc93c; }
        .ltr-star:hover:not(:disabled) { transform: scale(1.12); }
        .ltr-star:disabled { cursor: default; }
        .ltr-star:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 4px; }
        .ltr-score { display: flex; flex-direction: column; line-height: 1.25; }
        .ltr-score b { font-size: 18px; font-weight: 700; }
        .ltr-score span { font-size: 12px; color: #a9a5b2; }
        .ltr-yours { margin: 8px 0 0; font-size: 12px; color: #a9a5b2; }
        .ltr-heading { margin: ${compact ? "16px" : "20px"} 0 10px; font-size: 15px; font-weight: 650; }
        .ltr-compose { display: flex; flex-direction: column; gap: 8px; }
        .ltr-compose textarea {
          width: 100%; resize: vertical; padding: 10px 12px; font: inherit; font-size: 14px;
          color: #f7f4fa; background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 10px;
        }
        .ltr-compose textarea:focus { outline: none; border-color: var(--cyan); }
        .ltr-compose-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .ltr-count { font-size: 11px; color: #6f6b78; }
        .ltr-send {
          padding: 8px 16px; border-radius: 999px; border: 0; cursor: pointer;
          font: inherit; font-size: 13px; font-weight: 650; color: #07060b;
          background: linear-gradient(120deg, var(--cyan), var(--magenta));
        }
        .ltr-send:disabled { opacity: 0.45; cursor: default; }
        .ltr-notice { margin: 10px 0 0; font-size: 12px; color: #ffb4b4; }
        .ltr-link {
          background: none; border: 0; padding: 0; cursor: pointer;
          font: inherit; font-size: 12px; color: var(--cyan); text-decoration: underline;
        }
        .ltr-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
        .ltr-empty { font-size: 13px; color: #6f6b78; }
        .ltr-comment { display: flex; gap: 10px; }
        .ltr-avatar { width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto; object-fit: cover; }
        .ltr-avatar-blank {
          display: grid; place-items: center; font-size: 13px; font-weight: 700; color: #07060b;
          background: linear-gradient(120deg, var(--cyan), var(--magenta));
        }
        .ltr-body { flex: 1 1 auto; min-width: 0; }
        .ltr-byline { display: flex; align-items: baseline; gap: 8px; font-size: 12px; color: #a9a5b2; }
        .ltr-byline b { font-size: 13px; color: #f7f4fa; }
        .ltr-edited { font-style: italic; }
        .ltr-text { margin: 4px 0 0; font-size: 14px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
        .ltr-own { display: flex; gap: 12px; margin-top: 6px; }
      `}</style>
    </section>
  );
}
