"use client";
import React from "react";
import CaseTable from "./case-table/CaseTable";

// /case-table-dev — the Case Table's dev sandbox (CASE_TABLE.md §4).
// The game itself lives in case-table/CaseTable.jsx (engine in
// src/game/terminal-traders/caseKit.js + docketRun.js); this wrapper just
// turns on the dev-only lobby controls (deterministic seed stepper, tips
// reset) that don't ship to /trade. Silent mode: no sitePalScenes, so the
// channels run text-only for fast iteration.
export default function CaseTableDev() {
  return <CaseTable dev />;
}
