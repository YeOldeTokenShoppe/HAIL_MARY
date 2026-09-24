// How a word is SAID, as opposed to how it is written.
//
// The screenplay, the chiron and the transcript keep the brand as it is
// written; only the words handed to a voice (ElevenLabs for a recording,
// SitePal's live speech on the desk) are respelled. Left alone, a voice reads
// "RL80" as "R-L-eighty", and the token is "Our Lady".
//
// A recorded line is filed under the words actually sent, so adding a rule
// here re-records exactly the lines it changes the next time an episode is
// recorded, and nothing else.

export const SAY_AS = [
  // $RL80, RL80 and RL80's all read as the name. The web address is left
  // as it is written.
  [/\$?\bRL-?80\b(?!\.com)/gi, "Our Lady"],
];

/** The words to hand a voice for `text`. */
export function spoken(text) {
  return SAY_AS.reduce((out, [pattern, say]) => out.replace(pattern, say), String(text ?? ""));
}
