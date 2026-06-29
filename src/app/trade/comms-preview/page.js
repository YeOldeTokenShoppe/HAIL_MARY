"use client";
import React from "react";
import MobileTerminalGame from "@/components/trade/MobileTerminalGame";

// Dev preview for the mobile Liminal Terminal game (COUNCIL grid → live SitePal
// channels). Phone-frame so it's reviewable at any width. /trade/comms-preview.
export default function CommsPreviewPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14,
      background: "#000", padding: 20, fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        position: "relative", width: 390, height: 740, maxHeight: "90vh",
        borderRadius: 28, overflow: "hidden",
        border: "2px solid #1a2a28", boxShadow: "0 0 60px rgba(47,214,214,0.12)",
      }}>
        <MobileTerminalGame active onExit={() => {}} />
      </div>
      <div style={{ color: "#37e3e3", fontSize: 12, letterSpacing: "0.05em", opacity: 0.7 }}>
        MobileTerminalGame preview
      </div>
    </div>
  );
}
