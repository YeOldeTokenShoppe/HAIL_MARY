"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import MainMobileNav from "@/components/MainMobileNav";
import CommsPanel from "@/components/CommsPanel";
import CyberButton from "@/components/CyberButton";
import BuyModal from "@/components/BuyModal";

const SpaceScene = dynamic(() => import("@/components/SpaceScene"), {
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
        background: "#272730",
        fontFamily: "monospace",
      }}
    >
      Loading...
    </div>
  ),
});

const CREW = [
  { id: "captain", name: "Captain", role: "Commanding Officer", image: "/cameo_h80z.webp" },
  { id: "engineer", name: "Saint GR80", role: "Chief Engineer", image: "/cameo_GR80.webp" },
  { id: "comms", name: "Virgil", role: "Comms Officer", image: "/cameo_kitty.webp" },
];

export default function SpacePage() {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showComms, setShowComms] = useState(false);
  const [showMission, setShowMission] = useState(false);
  const [activeCrewIndex, setActiveCrewIndex] = useState(0);

  return (
    <>
      <SpaceScene />

      <CommsPanel
        open={showComms}
        onClose={() => setShowComms(false)}
        crew={CREW}
        activeCrewIndex={activeCrewIndex}
        onCrewSelect={setActiveCrewIndex}
        onSend={(msg, member) => {
          console.log(`[Comms] Message to ${member.name}:`, msg);
        }}
      />

      <CyberButton
        hideTrigger
        externalOpen={showMission}
        onExternalClose={() => setShowMission(false)}
        modalTitle="Mission Briefing — Sector 7G"
        modalBody={
          <>
            <p>
              Seismic readings have detected a high-density deposit
              2.4 km beneath the surface. Estimated yield: 14,000 barrels.
            </p>
            <p>
              The Hail Mary Prospecting Co. drill crew is standing by.
              Our Lady willing, this one hits.
            </p>
            <p>Deploy the drill?</p>
          </>
        }
        onProceed={() => {
          window.location.href = "/oil";
        }}
      />

      <MainMobileNav
        onBuyClick={() => setShowBuyModal(true)}
        onCommsClick={() => setShowComms(true)}
        onMissionClick={() => setShowMission(true)}
        onLeaderboardClick={() => console.log("Leaderboard")}
        onLoungeClick={() => console.log("Lounge")}
      />

      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </>
  );
}
