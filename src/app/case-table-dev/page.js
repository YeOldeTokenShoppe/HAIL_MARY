"use client";

import CaseTableDev from "@/components/trade/CaseTableDev";

// Dev-only playable mock of the Case Table (CASE_TABLE.md §4, mock phase B).
export default function CaseTableDevPage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#02100e" }}>
      <CaseTableDev />
    </div>
  );
}
