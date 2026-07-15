"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import "./Confessional.css";

/**
 * Confessional — bottom-anchored chat drawer for character dialogue.
 *
 * Props:
 *  - isOpen:          boolean — controlled open state
 *  - onToggle:        () => void — called to flip open/closed
 *  - characterName:   string — display name for the speaking character
 *  - initialMessage:  string — the character's opening line (typewriter reveal)
 *  - onSendMessage:   async (text, history) => replyText — called with the
 *                     user's message and full history; the resolved string is
 *                     appended as the character's reply. Without it, a static
 *                     placeholder response is used.
 *  - hideLauncher:    when true, the collapsed-state bubble CTA is NOT rendered
 *                     and the greeting's typewriter is deferred until the drawer
 *                     opens. Use when an external control (e.g. a SPEAK button)
 *                     is the sole launcher, so no conversation text appears
 *                     until the user chooses to open it.
 *  - bottomOffset:    px number — raises the drawer's bottom anchor by this much
 *                     (+ safe-area) so its input row clears a fixed bottom nav
 *                     dock. Null keeps the default 0.75rem anchor.
 *  - presetInput:     seeds the input field when the drawer opens (e.g. the
 *                     rite buttons' "Bless me, Our Lady, for I have sinned — ").
 *                     The seeker finishes the sentence; empty string is a no-op.
 *  - placeholder:     input placeholder — pass the apparition's localized
 *                     line (e.g. "Háblale a Nuestra Señora...") to keep the
 *                     invitation in her tongue.
 */
export default function Confessional({ isOpen, onToggle, characterName = "Our Lady", initialMessage = "", onSendMessage, hideLauncher = false, bottomOffset = null, docked = false, presetInput = "", placeholder = "Speak to Our Lady...", align = "left" }) {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState("closed"); // closed | entering | open | exiting
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const prevInitialRef = useRef("");

  // ── Typewriter state ──
  const [typedLen, setTypedLen] = useState(0);
  const typingRef = useRef(false);
  const typingTimerRef = useRef(null);

  // Seed the input when a rite button opens the drawer (or, docked, when the
  // seed arrives) — the seeker completes the sentence.
  useEffect(() => {
    if (presetInput && (isOpen || docked)) {
      setInputVal(presetInput);
      inputRef.current?.focus();
    }
  }, [presetInput, isOpen, docked]);

  // ── iOS keyboard viewport pinning ──
  // On phones the drawer is a full-width `position: fixed` element, which sizes
  // against the LAYOUT viewport. iOS shrinks only the VISUAL viewport for the
  // keyboard and can leave the two desynced after the keyboard retracts — the
  // layout viewport stays wider than what's visible, so the drawer's right edge
  // (and the close button) ends up off-screen with no way to pan to it. CSS has
  // no unit for the visual-viewport width, so we pin the drawer's horizontal
  // box to window.visualViewport. Mobile + floating only (docked/desktop use
  // the CSS rules untouched); vertical anchoring is left to CSS so the keyboard
  // behavior we already tuned doesn't change.
  const [vvBox, setVvBox] = useState(null);
  useEffect(() => {
    if (docked || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => {
      if (!mq.matches) {
        setVvBox((prev) => (prev === null ? prev : null));
        return;
      }
      const next = { width: Math.round(vv.width), left: Math.round(vv.offsetLeft) };
      setVvBox((prev) =>
        prev && prev.width === next.width && prev.left === next.left ? prev : next
      );
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    mq.addEventListener?.("change", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      mq.removeEventListener?.("change", update);
    };
  }, [docked]);

  // Scroll to bottom on new messages. Scroll the messages CONTAINER directly
  // rather than messagesEndRef.scrollIntoView() — on iOS with the keyboard up,
  // scrollIntoView can scroll the whole page (shifting the fixed drawer) or
  // silently no-op, so a just-sent bubble lands below the fold and the send
  // reads as "did nothing". Setting scrollTop only moves the list, and the
  // container's CSS `scroll-behavior: smooth` keeps it animated.
  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // When initialMessage changes, start a new conversation with typewriter
  useEffect(() => {
    if (initialMessage && initialMessage !== prevInitialRef.current) {
      prevInitialRef.current = initialMessage;
      setMessages([{ role: "character", text: initialMessage }]);
      setTypedLen(0);
      typingRef.current = true;
    }
  }, [initialMessage]);

  // Typewriter tick
  useEffect(() => {
    if (!typingRef.current || messages.length === 0) return;
    // In launcher-less mode the greeting reveals only once the drawer opens,
    // so the typewriter doesn't run down invisibly before the user taps in.
    // Docked mode is always visible, so let it type right away.
    if (hideLauncher && !isOpen && !docked) return;
    const fullText = messages[0]?.text || "";
    if (typedLen >= fullText.length) {
      typingRef.current = false;
      return;
    }
    // Variable speed: faster for spaces, slower for punctuation
    const ch = fullText[typedLen];
    let delay = 45;
    if (ch === " ") delay = 30;
    if (".!?".includes(ch)) delay = 200;
    if (",;:".includes(ch)) delay = 120;

    typingTimerRef.current = setTimeout(() => {
      setTypedLen((l) => l + 1);
      scrollToBottom();
    }, delay);

    return () => clearTimeout(typingTimerRef.current);
  }, [typedLen, messages, scrollToBottom, isOpen, hideLauncher, docked]);

  // ── Open/close transitions ──
  useEffect(() => {
    if (isOpen && phase === "closed") {
      setPhase("entering");
      const t = setTimeout(() => {
        setPhase("open");
        // Auto-focus only on pointer devices — on touch it would pop the
        // keyboard over the freshly revealed portrait (and on iOS, trigger
        // the input auto-zoom viewport shift)
        if (typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
          inputRef.current?.focus();
        }
      }, 400);
      return () => clearTimeout(t);
    }
    if (!isOpen && (phase === "open" || phase === "entering")) {
      setPhase("exiting");
      const t = setTimeout(() => setPhase("closed"), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, phase]);

  // Send user message → oracle (or placeholder when no handler wired)
  const handleSend = async () => {
    const text = inputVal.trim();
    if (!text || pending) return;
    const history = [...messages, { role: "user", text }];
    setMessages(history);
    setInputVal("");
    scrollToBottom();

    if (!onSendMessage) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "character", text: "The faithful must be patient... my voice grows stronger each day." },
        ]);
        scrollToBottom();
      }, 1500);
      return;
    }

    setPending(true);
    try {
      const reply = await onSendMessage(text, history);
      if (reply) {
        setMessages((prev) => [...prev, { role: "character", text: reply }]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "character", text: e?.message || "The connection to the beyond wavers... ask again, seeker." },
      ]);
    } finally {
      setPending(false);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      onToggle();
    }
  };

  // ── Bubble CTA (collapsed state) — shows her message as an invitation ──
  // Docked mode is always rendered as a panel, so it never collapses.
  if (!docked && phase === "closed" && !isOpen) {
    // Launcher-less mode: an external control (the SPEAK FAB) is the sole way
    // in, so render nothing when collapsed — no premature conversation text.
    if (hideLauncher) return null;
    const bubbleText = initialMessage || "";
    const showTyped = typingRef.current ? bubbleText.slice(0, typedLen) : bubbleText;
    const showCursor = typingRef.current && typedLen < bubbleText.length;

    return (
      <div className="confessional-bubble-cta" onClick={onToggle} role="button" tabIndex={0} aria-label="Reply to character">
        <div className="confessional-bubble-sender">{characterName}</div>
        <div className="confessional-bubble-text">
          {showTyped}
          {showCursor && <span className="confessional-cursor" />}
        </div>
        <div className="confessional-bubble-reply">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Reply</span>
        </div>
      </div>
    );
  }

  // ── Drawer ──
  const drawerClass = [
    "confessional-drawer",
    docked && "confessional-drawer--docked",
    !docked && phase === "entering" && "confessional-drawer--entering",
    !docked && phase === "exiting" && "confessional-drawer--exiting",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={drawerClass}
      style={{
        ...(!docked && bottomOffset != null
          ? { bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))` }
          : {}),
        // align="center" pulls the drawer off the CSS left:1rem anchor — /main
        // needs that corner for an adviser's argument, and the drawer belongs
        // under the character whose reply it carries. Centred with auto margins
        // rather than translateX(-50%): the slide-up/down keyframes animate
        // `transform`, and would clobber it mid-animation. Skipped when docked
        // or when the mobile visual-viewport box below takes over.
        ...(align === "center" && !docked && !vvBox
          ? { left: 0, right: 0, marginLeft: "auto", marginRight: "auto" }
          : {}),
        // Horizontal box pinned to the visual viewport on mobile (see vvBox
        // effect) so the keyboard show/dismiss can't leave the drawer wider
        // than the screen. Overrides the CSS left:0/right:0/width:auto.
        ...(vvBox ? { left: `${vvBox.left}px`, right: "auto", width: `${vvBox.width}px` } : {}),
      }}
    >
      {/* Header */}
      <div className="confessional-header">
        <div className="confessional-header-left">
          <span className="confessional-status-dot" />
          <span className="confessional-title">{characterName}</span>
        </div>
        {/* Docked mode is a permanent panel — no close affordance. */}
        {!docked && (
          <button className="confessional-close-btn" onClick={onToggle} aria-label="Close chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="confessional-messages" ref={messagesRef}>
        {messages.map((msg, i) => {
          const isCharacter = msg.role === "character";
          // First message gets typewriter; subsequent character messages show instantly
          const displayText = isCharacter && i === 0 && typingRef.current
            ? msg.text.slice(0, typedLen)
            : msg.text;
          const showCursor = isCharacter && i === 0 && typingRef.current && typedLen < msg.text.length;

          return (
            <div
              key={i}
              className={`confessional-msg ${isCharacter ? "confessional-msg--character" : "confessional-msg--user"}`}
            >
              {isCharacter && i === 0 && (
                <div className="confessional-msg-sender">{characterName}</div>
              )}
              {displayText}
              {showCursor && <span className="confessional-cursor" />}
            </div>
          );
        })}
        {pending && (
          <div className="confessional-msg confessional-msg--character confessional-msg--typing" aria-label="thinking">
            <span className="confessional-typing-dots">
              <span /><span /><span />
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="confessional-input-area">
        <input
          ref={inputRef}
          className="confessional-input"
          type="text"
          placeholder={placeholder}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="confessional-send-btn"
          onClick={handleSend}
          disabled={!inputVal.trim()}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
