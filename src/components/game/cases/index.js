import CASE_001 from "./case-001";
import CASE_002 from "./case-002";
import CASE_003 from "./case-003";

// Ordered list — drives the case sequence in /trade/page.js.
export const CASE_FILES = [CASE_001, CASE_002, CASE_003];

// Id-keyed map — lookup by `case.id` (e.g., from a saved progress record or URL).
export const CASES = Object.fromEntries(CASE_FILES.map((c) => [c.id, c]));

// Named re-exports preserve the legacy import surface from GameOverlay.jsx.
export { CASE_001 as SAMPLE_CASE, CASE_002, CASE_003 };
