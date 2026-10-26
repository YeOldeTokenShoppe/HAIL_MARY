"use client";

// /rcana-print?id=<face id>[&scale=1][&live=1]
//
// One card, flat, on a transparent page: the print target for
// scripts/rcana-render-faces.mjs, which screenshots `.rc-stage` here into
// public/TCG/rcana/<id>/face.webp for the Playtest 2 table, the binder and
// anywhere else a card is shown as a picture rather than as the live stack.
// depth 0 flattens the planes into a print; FX sheets stay (they are painted
// on the card) but nothing moves. Not linked from anywhere.
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RcanaCard from "@/components/RcanaCard";
import { RCANA_SET, RCANA_ASPECT, toRcanaCard } from "@/game/rcana/cardFace";

// Live mode fits the card to the window it is embedded in. The embedding
// lightbox makes its iframe 124% of the card box (12% of slack on every side
// for the tilt to swing into), so the card is sized to the window / 1.24,
// whichever of width or height binds.
const LIVE_SLACK = 1.24;
function useFitScale(on) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!on) return undefined;
    const fit = () => {
      const w = window.innerWidth / LIVE_SLACK;
      const h = window.innerHeight / LIVE_SLACK;
      setScale(Math.max(0.1, Math.min(w / 744, h / (744 / RCANA_ASPECT))));
    };
    fit();
    window.addEventListener("resize", fit);
    // The page shell paints black; inside a lightbox that would be a slab
    // around the card, so the frame's document goes clear.
    document.documentElement.style.background = "transparent";
    document.body.style.backgroundColor = "transparent";
    return () => window.removeEventListener("resize", fit);
  }, [on]);
  return scale;
}

function PrintCard() {
  const params = useSearchParams();
  const id = params.get("id") || RCANA_SET[0]?.id;
  const scale = Number(params.get("scale") || 1);
  // ?live=1: the card as it is on the bench — depth, tilt, sway, touch — for
  // embedding (the Playtest 2 lightbox) rather than screenshotting.
  const live = params.get("live") === "1";
  const fitScale = useFitScale(live);
  const source = RCANA_SET.find((c) => c.id === id);
  if (!source) {
    return <pre style={{ color: "#f66", padding: 16 }}>no face "{id}" — ids: {RCANA_SET.map((c) => c.id).join(", ")}</pre>;
  }
  const card = toRcanaCard(source);
  if (live) {
    return (
      <main
        data-print-ready
        style={{
          margin: 0, padding: 0, background: "transparent",
          width: "100vw", height: "100dvh", display: "grid", placeItems: "center", overflow: "hidden",
        }}
      >
        <RcanaCard data={card} scale={fitScale} depth={1} interactive showFx sway captureTouch />
      </main>
    );
  }
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
