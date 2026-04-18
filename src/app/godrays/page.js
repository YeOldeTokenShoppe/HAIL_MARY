"use client";

import dynamic from "next/dynamic";

const GodraysScene = dynamic(() => import("@/components/GodraysScene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        background: "#000",
        fontFamily: "monospace",
      }}
    >
      Loading...
    </div>
  ),
});

export default function GodraysPage() {
  return <GodraysScene />;
}
