// speechify — turn an on-screen chat line into a spoken-coherent one for TTS.
//
// Eugene's bubble lines are authored for READING: emoji (✨💫🤔), ticker/money
// shorthand ($340K), the "RL80" token, arrows, etc. Piped verbatim to
// ElevenLabs those get read literally or mangled ("sparkles", "R-L-eighty",
// "dollar three forty kay"). This strips/expands the on-screen-isms so the
// SPOKEN audio stays coherent — the chat bubble keeps the original text.
//
// It's a conservative safety-net, not a rewrite: for lines that need exact
// phrasing, author a `spoken:` override on the line object (see resolveLine +
// playUnicornBeat), which is speechified too but starts from your wording.

// Emoji & pictographs — read aloud or dropped awkwardly by TTS, so remove them.
// Covers the common blocks: symbols/pictographs, supplemental symbols &
// emoticons, dingbats, misc-symbols, arrows, and variation selectors / ZWJ.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{200D}]/gu;

// $340K → "340 thousand dollars", $1.2M → "1.2 million dollars", $500 → "500 dollars"
function expandMoney(s) {
  return s.replace(/\$\s?(\d[\d,.]*)\s?([KkMmBb])?/g, (_, num, suf) => {
    const clean = num.replace(/,/g, '');
    const scale = { k: 'thousand', m: 'million', b: 'billion' }[(suf || '').toLowerCase()];
    return scale ? `${clean} ${scale} dollars` : `${clean} dollars`;
  });
}

// Chat shorthand → spoken words. TTS reads "pls" as letters/garbled, so expand
// the common ones. ADD MORE HERE: key = shorthand (lowercase), value = spoken
// form. Matched whole-word + case-insensitive; leading capital is preserved.
const SHORTHAND = {
  pls: 'please',
  plz: 'please',
  thx: 'thanks',
  tbh: 'to be honest',
  imo: 'in my opinion',
  btw: 'by the way',
  omg: 'oh my gosh',
};
const SHORTHAND_RE = new RegExp(`\\b(${Object.keys(SHORTHAND).join('|')})\\b`, 'gi');
function expandShorthand(s) {
  return s.replace(SHORTHAND_RE, (m) => {
    const rep = SHORTHAND[m.toLowerCase()];
    if (!rep) return m;
    return /^[A-Z]/.test(m) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
  });
}

// Phonetic respellings — words THIS ElevenLabs voice mispronounces, rewritten so
// they SOUND right (spoken-only; the bubble keeps the original spelling). e.g.
// the voice reads "hi" as "hee", so respell to "high" — same /haɪ/ sound. ADD
// MORE HERE: key = word as written (lowercase), value = a spelling that reads
// correctly in the voice. Whole-word + case-insensitive; leading capital kept.
const PRONUNCIATION = {
  hi: 'high',
};
const PRONUNCIATION_RE = new RegExp(`\\b(${Object.keys(PRONUNCIATION).join('|')})\\b`, 'gi');
function fixPronunciation(s) {
  return s.replace(PRONUNCIATION_RE, (m) => {
    const rep = PRONUNCIATION[m.toLowerCase()];
    if (!rep) return m;
    return /^[A-Z]/.test(m) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
  });
}

// Collapse silly letter elongations (Hiii, sooo, yesss) down to the plain word
// so respelling is predictable and the voice doesn't drawl. 3+ repeats → 1.
function collapseElongation(s) {
  return s.replace(/([a-z])\1{2,}/gi, '$1');
}

export function speechify(text) {
  if (!text) return '';
  let s = String(text);
  s = collapseElongation(s); // Hiii → Hi, sooo → so (before the word maps run)
  s = s.replace(/\$?\bRL[-\s]?80\b/gi, 'R-Lady'); // token pronunciation, app-wide
  s = expandShorthand(s); // pls → please, thx → thanks, …
  s = fixPronunciation(s); // hi → high (respell mispronounced words)
  s = expandMoney(s);
  s = s.replace(/(\d)\s?%/g, '$1 percent'); // 40% → 40 percent
  s = s.replace(/\s*&\s*/g, ' and '); // ampersand → "and"
  s = s.replace(/\s*→\s*/g, ', '); // arrow flow → comma pause (before emoji strip)
  s = s.replace(EMOJI, ''); // drop remaining emoji/pictographs
  // Tidy the seams the substitutions leave behind.
  s = s
    .replace(/\s+([,.!?;:])/g, '$1') // no space before punctuation
    .replace(/\s{2,}/g, ' ') // collapse runs of whitespace
    .trim();
  return s;
}
