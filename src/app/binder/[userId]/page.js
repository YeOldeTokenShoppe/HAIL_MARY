"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import GenesisBinder from "@/components/binder/GenesisBinder";

// /binder/[userId] — a shared, read-only binder. Data comes from the public
// tcg-binder API (server-authoritative collection, no side effects).
export default function SharedBinderPage() {
  const { userId } = useParams();
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tcg-binder?u=${encodeURIComponent(userId)}`);
        if (cancelled) return;
        if (!res.ok) { setMissing(true); return; }
        const data = await res.json();
        setCards(data.cards || {});
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (missing) {
    return (
      <div style={{ minHeight: "100vh", background: "#02100e", color: "#2fd6d6", fontFamily: "'Courier New', monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.14em", color: "#ffd23a" }}>▸ GENESIS 80 · BINDER</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#f4fffb" }}>No binder at this address.</div>
        <div style={{ fontSize: 12, color: "#bfeede", opacity: 0.8 }}>Either the link is wrong or this analyst hasn't opened an account with the Terminal.</div>
      </div>
    );
  }

  return (
    <GenesisBinder
      cards={cards}
      loading={loading}
      publicView
      ownerLabel="SHARED BINDER"
    />
  );
}
