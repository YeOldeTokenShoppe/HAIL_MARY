"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useOilApiFetch } from "@/lib/oilApiClient";
import { buildDeckFromCollection } from "@/game/terminal-traders/collection";

// Loads the signed-in player's card collection (granting the starter set on
// first fetch, server-side) and derives the playable deck pool from it.
// Signed-out visitors get { cards: null, deckPool: null } — callers fall back
// to the full Genesis pool so the game stays playable without an account.
export function useCardCollection() {
  const { isSignedIn, isLoaded } = useUser();
  const apiFetch = useOilApiFetch();
  const [cards, setCards] = useState(null);
  const [total, setTotal] = useState(0);
  const [starterGranted, setStarterGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setCards(null);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/tcg-collection");
      if (!res.ok) throw new Error(`collection fetch failed (${res.status})`);
      const data = await res.json();
      setCards(data.cards || {});
      setTotal(data.total || 0);
      setStarterGranted(Boolean(data.starterGranted));
    } catch (err) {
      setError(err.message);
      setCards(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, apiFetch]);

  useEffect(() => {
    if (isLoaded) refresh();
  }, [isLoaded, refresh]);

  const deckPool = useMemo(
    () => (cards ? buildDeckFromCollection(cards) : null),
    [cards],
  );

  return { cards, deckPool, total, starterGranted, loading, error, refresh };
}
