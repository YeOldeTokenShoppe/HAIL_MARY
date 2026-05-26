'use client';
import InvestigatorRow from './InvestigatorRow';
import { CHARACTER_ORDER, CHARACTER_META } from './characterMeta';

// The inner page that lives inside the manila folder. Drives entirely
// off `caseData` (§7 shape, with an added `investigators[].characterId`
// to look up portraits + role meta).
//
// Lays out four sections:
//   1. Header        — token + case number + filed timestamp
//   2. Body          — 4 InvestigatorRow components in CHARACTER_ORDER
//   3. Stamp slot    — designated zone where D3 lands the verdict stamp
//   4. Footer        — exhibit mark + project name + filed date
export default function DossierPage({ caseData, opened, showStampSlot = true }) {
  const token = caseData?.token || {};
  const ticker = token.ticker || '???';
  const address = token.address || '';
  const chain = (token.chain || 'unknown').toUpperCase();
  const caseNumber = caseData?.caseNumber || '0-000-????';
  const timestamp = caseData?.timestamp ? formatTimestamp(caseData.timestamp) : '----';
  const investigators = orderInvestigators(caseData?.investigators);

  return (
    <div style={styles.root}>
      {/* Header — fixed left/right columns. Token info on the right
          reads top-down (ticker → address → chain) so it scans like a
          file-cabinet label. */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.kicker}>// LIMINAL TERMINAL — FORENSIC FILE</div>
          <h1 style={styles.title}>CASE {caseNumber}</h1>
          <div style={styles.timestamp}>FILED · {timestamp}</div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.ticker}>${ticker}</div>
          <div style={styles.addressRow}>
            <span style={styles.addressLabel}>SUBJECT</span>
            <span style={styles.address}>{truncateAddress(address)}</span>
          </div>
          <div style={styles.chainBadge}>{chain}</div>
        </div>
      </header>

      <div style={styles.divider} />

      {/* Body — four investigator rows in fixed order. */}
      <section style={styles.body}>
        <div style={styles.bodyKicker}>// FIELD REPORTS</div>
        <div style={styles.rows}>
          {investigators.map((inv) => (
            <InvestigatorRow key={inv.characterId} investigator={inv} />
          ))}
        </div>
      </section>

      {/* Stamp slot — D3 lands a real stamp here. The dashed outline is
          presentational; in the production assembly the slot exists as a
          target rect but renders transparently. */}
      {showStampSlot && (
        <div style={styles.stampSlot} aria-label="verdict stamp slot">
          <div style={styles.stampStub}>VERDICT STAMP — PENDING</div>
        </div>
      )}

      {/* Footer — three-column ledger style. */}
      <footer style={styles.footer}>
        <span>EXHIBIT A</span>
        <span style={styles.footerCenter}>OUR LADY OF PERPETUAL PROFIT</span>
        <span>FILE · {timestamp.split(' ')[0]}</span>
      </footer>
    </div>
  );
}

// Sort investigator entries into CHARACTER_ORDER. Drops entries with
// no matching characterId (defensive — the API is the source of truth
// but a malformed entry shouldn't crash the dossier). If the input is
// missing entirely, returns an empty list (no rows render).
function orderInvestigators(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const entry of list) {
    if (entry && entry.characterId && CHARACTER_META[entry.characterId]) {
      byId.set(entry.characterId, entry);
    }
  }
  return CHARACTER_ORDER.map((id) => byId.get(id)).filter(Boolean);
}

function truncateAddress(addr) {
  if (typeof addr !== 'string' || !addr) return '----';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTimestamp(iso) {
  // Stable cross-locale rendering: ISO date + space + HH:MM UTC.
  // Avoids the Intl variability that bites SSR/CSR hydration.
  try {
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
  } catch {
    return '----';
  }
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    height: '100%',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 0,
  },
  kicker: {
    fontSize: 9,
    letterSpacing: '0.22em',
    color: '#8a6f3f',
    fontFamily: "'Orbitron', 'Special Elite', monospace",
  },
  title: {
    fontFamily: "'Pirata One', 'Special Elite', serif",
    fontSize: 'clamp(22px, 4vw, 32px)',
    color: '#2a2520',
    letterSpacing: '0.04em',
    margin: 0,
    lineHeight: 1.05,
  },
  timestamp: {
    fontSize: 9,
    letterSpacing: '0.18em',
    color: '#8a6f3f',
    fontFamily: "'Orbitron', 'Special Elite', monospace",
    marginTop: 2,
  },
  ticker: {
    fontFamily: "'Pirata One', 'Special Elite', serif",
    fontSize: 'clamp(22px, 4vw, 30px)',
    color: '#8a1c1c',
    lineHeight: 1,
  },
  addressRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'baseline',
  },
  addressLabel: {
    fontSize: 8,
    letterSpacing: '0.22em',
    color: '#8a6f3f',
    fontFamily: "'Orbitron', 'Special Elite', monospace",
  },
  address: {
    fontFamily: "'Orbitron', 'Special Elite', monospace",
    fontSize: 11,
    color: '#3a3128',
    letterSpacing: '0.04em',
  },
  chainBadge: {
    fontFamily: "'Orbitron', 'Special Elite', monospace",
    fontSize: 9,
    letterSpacing: '0.22em',
    color: '#5a4a2a',
    border: '1px solid #5a4a2a',
    padding: '2px 8px',
    borderRadius: 2,
    background: 'rgba(244,236,210,0.5)',
  },
  divider: {
    height: 1,
    background: 'repeating-linear-gradient(to right, #8a6f3f 0 4px, transparent 4px 8px)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 0,
  },
  bodyKicker: {
    fontSize: 9,
    letterSpacing: '0.22em',
    color: '#8a6f3f',
    fontFamily: "'Orbitron', 'Special Elite', monospace",
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
  },
  stampSlot: {
    border: '1px dashed rgba(138,111,63,0.55)',
    borderRadius: 4,
    minHeight: 88,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    padding: '8px 12px',
  },
  stampStub: {
    fontSize: 10,
    letterSpacing: '0.32em',
    color: 'rgba(138,111,63,0.7)',
    fontFamily: "'Orbitron', 'Special Elite', monospace",
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 9,
    letterSpacing: '0.22em',
    color: '#8a6f3f',
    fontFamily: "'Orbitron', 'Special Elite', monospace",
    paddingTop: 6,
    borderTop: '1px solid rgba(138,111,63,0.25)',
  },
  footerCenter: {
    letterSpacing: '0.3em',
    fontFamily: "'Pirata One', 'Special Elite', serif",
    fontSize: 11,
    letterSpacing: '0.18em',
    color: '#5a4a2a',
  },
};
