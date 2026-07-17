"use client";
import React from "react";
import OwnBinder from "@/components/binder/OwnBinder";

// /binder — your Genesis 80 binder (GENESIS.md roadmap: 80 slots, owned in
// holofoil, unowned ghosted, share). The same binder is reachable inside the
// /trade Liminal Terminal via the hub's BINDER module (OwnBinder embedded).
export default function BinderPage() {
  return <OwnBinder />;
}
