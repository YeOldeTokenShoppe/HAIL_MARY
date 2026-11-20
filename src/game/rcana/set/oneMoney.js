// R-cana — ONE MONEY, for card text (2026-11-16).
//
// The printed rules lines were written for Playtest 2's two currencies:
// small numbers of Liquidity/coins and big numbers of Prosperity. Playtest 3
// has one, in $M, at $10M a coin. Until each line gets its own rewrite this
// puts the numbers into that one unit so a card's text agrees with its
// badges on the code-drawn frame (src/components/RcanaCard3.jsx):
//
//   "Bank 100 Prosperity."                  -> "Collect $100M."
//   "collect 1 Liquidity each turn"         -> "collect $10M each turn"
//   "Sell for 6 coins, or bank 75 ..."      -> dropped on an Asset (the plate is its sale price)
//
// It only moves money. It does NOT fix lines whose rule itself changed —
// Credibility as points (Scandal, Anima Sola) and d6 targets (Meme Coin,
// Oil Field, El Gallo). Those need a line in TRINITY_TEXT or in designs.js.
import { MONEY_UNIT } from "./trinity.js";

const m = (n) => `$${n}M`;
const coins = (n) => m(Number(n) * MONEY_UNIT);

export function oneMoney(text, cardClass) {
  let t = String(text || "").replace(/\s*\n\s*/g, " ").trim();
  if (cardClass === "Asset") {
    t = t
      .replace(/^Sell for \d+ coins?, or roll:\s*/i, "On sale, roll: ")
      .replace(/^Sell for \d+ coins?, or bank \d+(?: Prosperity)?\s*(?:—\s*|[.,]\s*|$)/i, "")
      .replace(/^(\d+) while/, (_, n) => `Sells for ${m(n)} while`);
  }
  t = t
    .replace(/\bBank (\d+)(?: Prosperity)?/g, (_, n) => `Collect ${m(n)}`)
    .replace(/\bbank (\d+)(?: Prosperity)?/g, (_, n) => `collect ${m(n)}`)
    .replace(/\bbanks\b/g, "collects")
    .replace(/(\d+)\+ banked Prosperity/g, (_, n) => `${m(n)} or more`)
    .replace(/(\d+) Prosperity/g, (_, n) => m(n))
    .replace(/(\d+) or more Liquidity/g, (_, n) => `${coins(n)} or more`)
    .replace(/(\d+) (?:Liquidity|coins?)\b/g, (_, n) => coins(n))
    .replace(/\b(cost|[Pp]ays?|collects) (\d)\b(?![\d+]| cards?)/g, (_, verb, n) => `${verb} ${coins(n)}`)
    // What is left: bare Prosperity amounts, always 25 or more ("worth 25 more", "else 25").
    .replace(/(?<![\d$])\b(\d{2,3})\b(?!\+|M\b)/g, (all, n) => (Number(n) >= 25 ? m(n) : all));
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
