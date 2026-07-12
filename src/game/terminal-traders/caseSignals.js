// Bot-readable evidence signals for the Case Table (CASE_TABLE.md §4.4).
// SIM-SIDE SIDECAR: per-entry { dir, w } annotations for cases 001-003,
// keyed by station and entry label. At Phase 3 implementation these fold
// into the case files as each entry's `signal` field (§4.10 checklist);
// they live here for now so balance tuning doesn't churn the content files.
//
// dir: "scam" pushes P(scam) up, "legit" pushes it down.
// w: evidential STRENGTH, not threat color — weights enter the belief model
// squared (caseTable.js), so: 3 = smoking gun (9), 2 = solid fact (4),
// 1 = weak signal / mere absence of red flags (1). A stack of green vibes
// never cancels a smoking gun; only strong exculpatory facts do (case-002's
// LP LOCK / INSIDER FLOWS are exactly that).
// truth: 1 = the token was a scam (correctVerdict "doubt"), 0 = legit.
// Weights encode what the evidence indicates AFTER the station's Q&A —
// scanning a station means hearing its answers, so case-002's scary-but-
// exonerated entries carry their resolved direction, not their threat color.
// No dependencies; loadable via data: URL.

export const CASE_SIGNALS = {
  "case-001": {
    truth: 1, // PROPHET TOKEN — serial-deployer rug; monk is decisive
    stations: {
      monk: [
        { label: "DEPLOYER WALLET AGE", dir: "scam", w: 1 },
        { label: "PRIOR DEPLOYS", dir: "scam", w: 2 },
        { label: "PRIOR OUTCOMES", dir: "scam", w: 3 },
        { label: "FUNDING SOURCE", dir: "scam", w: 3 },
        { label: "CONTRACT ORIGINALITY", dir: "scam", w: 3 },
      ],
      demon: [
        { label: "TWITTER FOLLOWERS", dir: "legit", w: 1 },
        { label: "TELEGRAM ACTIVITY", dir: "legit", w: 1 },
        { label: "KOL PROMOTERS", dir: "legit", w: 1 },
        { label: "FUD SUPPRESSION", dir: "legit", w: 1 },
        { label: "POST CADENCE", dir: "legit", w: 1 },
      ],
      marisol: [
        { label: "TOP 10 HOLDERS", dir: "scam", w: 1 },
        { label: "DEPLOYER HOLDINGS", dir: "legit", w: 1 },
        { label: "VOLUME QUALITY", dir: "legit", w: 1 },
        { label: "LP / VESTING", dir: "legit", w: 1 }, // 30d lock only — weak comfort
        { label: "CONTRACT FLAGS", dir: "legit", w: 1 },
      ],
      eugene: [
        { label: "WHITEPAPER", dir: "legit", w: 1 },
        { label: "AI CLAIMS", dir: "legit", w: 2 }, // working demo — solid
        { label: "PITCH PATTERN", dir: "legit", w: 1 },
        { label: "ROADMAP REALISM", dir: "legit", w: 1 },
        { label: "ORIGIN STORY", dir: "scam", w: 1 },
      ],
    },
  },

  "case-002": {
    truth: 0, // HARBORLIGHT — scary surface, legit core; marisol+eugene decisive
    stations: {
      monk: [
        { label: "TEAM HISTORY", dir: "scam", w: 1 },
        { label: "BUILD RECORD", dir: "legit", w: 2 },
        { label: "FUNDING SOURCE", dir: "scam", w: 2 }, // ugly hop; exonerated only via marisol
        { label: "ADMIN CONTROLS", dir: "scam", w: 1 },
        { label: "DISCLOSURE", dir: "scam", w: 1 },
      ],
      demon: [
        { label: "FOLLOWER QUALITY", dir: "scam", w: 1 },
        { label: "COMMUNITY TOPICS", dir: "scam", w: 1 },
        { label: "PROMOTION PATTERN", dir: "scam", w: 2 }, // parasitic callers — the trap
        { label: "CRITICISM HANDLING", dir: "legit", w: 2 },
        { label: "POST CADENCE", dir: "scam", w: 1 },
      ],
      marisol: [
        { label: "TOP 10 HOLDERS", dir: "scam", w: 1 }, // 38% resolves to locked treasury
        { label: "INSIDER FLOWS", dir: "legit", w: 3 }, // zero team sells — smoking gun
        { label: "VOLUME QUALITY", dir: "legit", w: 1 },
        { label: "LP LOCK", dir: "legit", w: 3 }, // 12mo third-party lock — smoking gun
        { label: "TAX / FREEZE", dir: "legit", w: 2 },
      ],
      eugene: [
        { label: "POSITIONING", dir: "legit", w: 1 },
        { label: "WHITEPAPER", dir: "legit", w: 1 },
        { label: "PRODUCT PROOF", dir: "legit", w: 3 }, // shipped, audited, verifiable
        { label: "ADOPTION RISK", dir: "scam", w: 1 }, // risk, not deception
        { label: "CLAIM CHECK", dir: "scam", w: 1 },
      ],
    },
  },

  "case-003": {
    truth: 1, // MERIDIAN — latent upgrade-door rug; marisol+monk cross is decisive
    stations: {
      monk: [
        { label: "TEAM IDENTITY", dir: "legit", w: 2 },
        { label: "AUDIT", dir: "scam", w: 1 }, // proxy admin out of scope
        { label: "FUNDING", dir: "legit", w: 2 },
        { label: "PRIOR OUTCOMES", dir: "scam", w: 2 }, // 1/3 soft-exit flag
        { label: "GOVERNANCE", dir: "legit", w: 2 },
      ],
      demon: [
        { label: "AUDIENCE QUALITY", dir: "legit", w: 2 },
        { label: "DISCOURSE", dir: "legit", w: 2 },
        { label: "EARLY SEEDING", dir: "scam", w: 2 },
        { label: "CRITICISM", dir: "legit", w: 2 },
        { label: "POST CADENCE", dir: "scam", w: 1 },
      ],
      marisol: [
        { label: "LP LOCK", dir: "legit", w: 2 }, // real — and irrelevant to the door
        { label: "HOLDER CLUSTER", dir: "scam", w: 1 },
        { label: "PROXY ADMIN", dir: "scam", w: 3 }, // single EOA — the door
        { label: "UPGRADE PATH", dir: "scam", w: 3 }, // latent drain, LP lock moot
        { label: "AUDIT SCOPE", dir: "scam", w: 1 },
      ],
      eugene: [
        { label: "POSITIONING", dir: "legit", w: 1 },
        { label: "WHITEPAPER", dir: "legit", w: 1 },
        { label: "TEMPLATE MATCH", dir: "scam", w: 2 }, // soft-exit beat match
        { label: "USER PROOF", dir: "legit", w: 2 },
        { label: "NARRATIVE GAPS", dir: "scam", w: 1 },
      ],
    },
  },
};

// Docket order = the shipped case sequence.
export const DOCKET_CASE_IDS = ["case-001", "case-002", "case-003"];
