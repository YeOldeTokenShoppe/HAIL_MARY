"use client";
import React from "react";
import { useUser } from "@clerk/nextjs";
import { useCardCollection } from "@/hooks/useCardCollection";
import GenesisBinder from "@/components/binder/GenesisBinder";

// The signed-in player's own binder — data wiring shared by the /binder page
// and the Liminal Terminal's BINDER module (embedded, with an exit back to
// the hub). Signed out shows the full set ghosted; signing in grants the
// starter collection server-side on first fetch.
export default function OwnBinder({ embedded = false, onExit }) {
  const { isSignedIn, user } = useUser();
  const { cards, loading } = useCardCollection();
  const shareUrl = isSignedIn && user?.id && typeof window !== "undefined"
    ? `${window.location.origin}/binder/${user.id}`
    : null;
  return (
    <GenesisBinder
      cards={cards}
      loading={loading}
      signedOut={!isSignedIn}
      ownerLabel="YOUR BINDER"
      shareUrl={shareUrl}
      embedded={embedded}
      onExit={onExit}
    />
  );
}
