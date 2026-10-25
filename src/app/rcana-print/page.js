"use client";

// /rcana-print?id=<face id>[&scale=1]
//
// One card, flat, on a transparent page: the print target for
// scripts/rcana-render-faces.mjs, which screenshots `.rc-stage` here into
// public/TCG/rcana/<id>/face.webp for the Playtest 2 table, the binder and
// anywhere else a card is shown as a picture rather than as the live stack.
// depth 0 flattens the planes into a print; FX sheets stay (they are painted
// on the card) but nothing moves. Not linked from anywhere.
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RcanaCard from "@/components/RcanaCard";
import { RCANA_SET, toRcanaCard } from "@/game/rcana/cardFace";

function PrintCard() {
  const params = useSearchParams();
  const id = params.get("id") || RCANA_SET[0]?.id;
  const scale = Number(params.get("scale") || 1);
  const source = RCANA_SET.find((c) => c.id === id);
  if (!source) {
    return <pre style={{ color: "#f66", padding: 16 }}>no face "{id}" — ids: {RCANA_SET.map((c) => c.id).join(", ")}</pre>;
  }
  const card = toRcanaCard(source);
  return (
    <main
      data-print-ready
      style={{ margin: 0, padding: 0, background: "transparent", display: "inline-block", width: 744 * scale }}
    >
      <RcanaCard data={card} scale={scale} depth={0} interactive={false} showFx sway={false} />
    </main>
  );
}

// useSearchParams needs a Suspense boundary above it or `next build` refuses
// to prerender the route.
export default function RcanaPrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintCard />
    </Suspense>
  );
}
