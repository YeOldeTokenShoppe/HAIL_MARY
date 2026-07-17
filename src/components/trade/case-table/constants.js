// Shared display constants for the Case Table screens (CASE_TABLE.md §4).
// Game rules live in the engine (docketRun.js / caseKit.js) — this is the
// presentation-side vocabulary: seat order, verdict labels/colors, rarity
// colors, and the seat-meta helper that folds YOU into the character roster.
import { TABLE_RULES } from "@/game/terminal-traders/caseTable";
import { YOU } from "@/game/terminal-traders/docketRun";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";

export const SEATS = [YOU, ...CHARACTER_ORDER];
export const STAKE = TABLE_RULES.stake; // the council's flat benchmark stake
export const START_PF = TABLE_RULES.startPortfolio;
export const DOCK_H = 240; // table dock height — tall enough for the card-shaped kit hand

export const VLABEL = { believe: "TRUST", doubt: "DOUBT", abstain: "ABSTAIN" };
export const VCOLOR = { believe: "#4dffaa", doubt: "#ff5454", abstain: "#ffd23a" };
export const RARITY_COLOR = { common: "#bfeede", uncommon: "#4dffaa", rare: "#8ee9ff", mythic: "#ff7ad9", "terminal-foil": "#ffd23a" };

export const seatMeta = (k) => (k === YOU
  ? { name: "YOU", color: "#2fd6d6", portrait: null, sigil: "◈" }
  : CHARACTER_META[k]);
