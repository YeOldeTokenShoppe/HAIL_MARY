"use client";

import TerminalTradersGame from "@/components/TerminalTradersGame";
import { useCardCollection } from "@/hooks/useCardCollection";

// Signed-in players draw from their owned collection (starter set is granted
// server-side on first load); signed-out visitors play the full Genesis pool.
export default function TerminalTradersPage() {
  const { deckPool, loading } = useCardCollection();
  if (loading) return null;
  return <TerminalTradersGame cardPool={deckPool} />;
}
