// Static metadata for the four investigators. Mirrors the inline data
// in src/app/trade/page.js (~line 4082) so the dossier reads the same
// names/labels/portraits as the in-Terminal character selector. If
// both surfaces need to evolve in lockstep, fold this into a single
// shared source — for now D2 keeps it duplicated to avoid touching
// the trade page (see §13 of the case-file brief).
//
// Role colors are already in use elsewhere in the project (treasure
// gold for GR80, the magenta/cyan/green accent trio for the other
// three), so no new design tokens are introduced.

// traderId joins each station to its canonical Genesis trader card
// (CASE_TABLE.md §2.3) — station keys stay monk/demon because they're
// baked into the authored cases and SitePal audio slot names.
export const CHARACTER_META = {
  monk: {
    name: 'Saint GR80',
    traderId: 'gr80',
    role: 'ETHOS',
    roleSub: 'CREDIBILITY',
    sigil: '✠',
    portrait: '/thumbnail_gr80.png',
    color: '#daa520',    // treasure gold
  },
  demon: {
    name: 'John Barron',
    traderId: 'john-barron',
    role: 'PATHOS',
    roleSub: 'HYPE',
    sigil: '◬',
    portrait: '/thumbnail_johnBarron.png',
    color: '#ff3ea0',    // magenta accent
  },
  marisol: {
    name: 'Detective Marisol',
    traderId: 'marisol',
    role: 'LOGOS',
    roleSub: 'ONCHAIN',
    sigil: '✧',
    portrait: '/thumbnail_marisol.png',
    color: '#8ee9ff',    // cyan accent
  },
  eugene: {
    name: 'Eugene',
    traderId: 'eugene',
    role: 'MYTHOS',
    roleSub: 'STORY',
    sigil: '⟁',
    portrait: '/thumbnail_eugene.png',
    color: '#4dffaa',    // forensics green
  },
};

// Stable render order — used by the dossier so the rows always appear
// in the same sequence regardless of how the API hands them back.
export const CHARACTER_ORDER = ['monk', 'demon', 'marisol', 'eugene'];
