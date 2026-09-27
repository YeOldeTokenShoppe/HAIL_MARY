"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import CoinLoader from "@/components/CoinLoader";

const I80Horizon = dynamic(() => import("@/components/I80Horizon"), {
  ssr: false,
  loading: () => null,
});

// Still synthwave horizon: the I-80 sign and the sun on a flat grid road.
export default function I80Page() {
  const [isSceneLoading, setIsSceneLoading] = useState(true);

  return (
    <main style={{ position: "relative", width: "100%", height: "100vh", backgroundColor: "#000", overflow: "hidden" }}>
      {isSceneLoading && (
        <div style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000",
          zIndex: 9999,
        }}>
          <CoinLoader loading={isSceneLoading} />
        </div>
      )}
      <I80Horizon onLoadingChange={setIsSceneLoading} />
    </main>
  );
}
