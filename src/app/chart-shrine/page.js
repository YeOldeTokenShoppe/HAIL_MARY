"use client";
import React, { useState } from "react";
import Link from "next/link";
import ChartShrine, { TIMEFRAME_OPTIONS } from "@/components/ChartShrine";
import { useCandles } from "@/hooks/useCandles";
import "./chart-shrine.css";

const UNISWAP_URL =
  "https://app.uniswap.org/explore/tokens/base/0x30d01555d88c76500a82754a1d53cac082a6cb75?inputCurrency=NATIVE";
const GECKO_URL =
  "https://www.geckoterminal.com/base/pools/0x40d827acdbefd8ef46953e2b1ac87b8697b82203";

export default function ChartShrinePage() {
  const [timeframeKey, setTimeframeKey] = useState("30m");
  const tfOpt =
    TIMEFRAME_OPTIONS.find((o) => o.key === timeframeKey) ||
    TIMEFRAME_OPTIONS[0];
  const data = useCandles({
    count: 18,
    days: tfOpt.days,
    aggregate: tfOpt.aggregate,
  });

  return (
    <main className="shrine-page">
      <div className="shrine-stage">
        <ChartShrine
          {...data}
          timeframeKey={timeframeKey}
          onTimeframeChange={setTimeframeKey}
        />
      </div>

      <div className="shrine-actions">
        <a
          className="shrine-btn primary"
          href={UNISWAP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Swap on Uniswap
        </a>
        <a
          className="shrine-btn"
          href={GECKO_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Live chart on GeckoTerminal
        </a>
        <Link className="shrine-btn ghost" href="/">
          Home
        </Link>
      </div>
    </main>
  );
}
