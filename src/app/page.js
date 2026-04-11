"use client";

import React, { useState, useEffect } from "react";
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

const SITEPAL_ACCOUNT = "9308752";

const CREW = [
  {
    id: "engineer", name: "Saint GR80", role: "Chief Engineer", image: "/cameo_GR80.webp",
    sitepal: { account: SITEPAL_ACCOUNT, sceneId: 2774449, hash: "KrTdLqh7A17B80n7535kO17Hae1HurqD", offsetX: 0},
  },
  {
    id: "captain", name: "H80Z", role: "Devil's Advocate", image: "/cameo_h80z.webp",
    sitepal: { account: SITEPAL_ACCOUNT, sceneId: 2774433, hash: "9XtgV3Ko3oxgH0LEHPcDQPrwuyz7zjTZ" },
  },
  {
    id: "comms", name: "Captain Trinity", role: "Captain", image: "/cameo_Trin80.webp",
    sitepal: { account: SITEPAL_ACCOUNT, sceneId: 2774779, hash: "tGfN2lZ9bvwkMgqqwf18M2F6PVDmx4HP" },
  },
];

// Rotating flavor lines shown below the left-side network panel. These are
// field superstitions / observations — one line each, no attribution.
const NETWORK_FLAVORS = [
  "A media company with a drilling problem",
  "Rituals for a rigged market.",
  "Every trade is a hail mary.",
  "Old gods. New markets.",
  "Is moneytheism a real religion yet?",
];

export default function HomePage() {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showComms, setShowComms] = useState(false);
  const [showMission, setShowMission] = useState(false);
  const [activeCrewIndex, setActiveCrewIndex] = useState(0);
  // When SpaceScene enters its zoom-in animation, fade out the HUD overlays
  // (both panels + beam) so the user can focus on the character cameo.
  const [sceneZoomed, setSceneZoomed] = useState(false);

  // Rotating flavor line under the network panel. Key on index so remounting
  // re-runs the CSS fade-in animation on each change.
  const [flavorIdx, setFlavorIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setFlavorIdx((i) => (i + 1) % NETWORK_FLAVORS.length);
    }, 7000);
    return () => clearInterval(id);
  }, []);

  // Geometry for the dashed signal beam from the drill rig (on the asteroid)
  // to the capsule relay on the left of the HUD panel. Recomputed on resize
  // so the endpoints stay glued to the rig / capsule regardless of viewport
  // dimensions. We approximate the rig's screen position — the asteroid
  // autorotates slowly so exact projection isn't worth the plumbing.
  const [beamGeom, setBeamGeom] = useState(null);
  useEffect(() => {
    const computeBeam = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Mobile doesn't show the beam at all — see the media query in globals.css
      if (vw < 769) {
        setBeamGeom(null);
        return;
      }

      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const isWide = vw >= 1280;
      const panelRight = (isWide ? 4 : 2.5) * remPx;
      const panelWidth = isWide ? 340 : 320;

      // Beam terminates just outside the panel's left edge at vertical centre.
      const panelEdgeX = vw - panelRight - panelWidth - 2;
      const panelEdgeY = vh / 2;

      // Approximate drill rig position on the asteroid — roughly centred
      // horizontally. rigY targets the TOP of the rig (where an antenna
      // would sit) rather than the front lamp, so the beam reads as a
      // radio/telemetry broadcast instead of a light capture.
      const rigX = vw * 0.50;
      const rigY = vh * 0.38;

      const dx = panelEdgeX - rigX;
      const dy = panelEdgeY - rigY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

      setBeamGeom({ rigX, rigY, length, angleDeg });
    };

    computeBeam();
    window.addEventListener("resize", computeBeam);
    return () => window.removeEventListener("resize", computeBeam);
  }, []);

  return (
    <>
      <SpaceScene onZoomChange={setSceneZoomed} />

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

      {/* Beam from the drill rig on the asteroid to the capsule relay.
          Position/length/rotation is JS-driven so the endpoints track the
          rig and the capsule across viewport sizes. Rendered OUTSIDE
          .prospecting-banner on purpose — the banner has a `transform` on it
          which would make `position: fixed` children relative to the banner
          box instead of the viewport. */}
      {beamGeom && (
        <div
          className={`prospecting-banner__beam${sceneZoomed ? " prospecting-banner__beam--faded" : ""}`}
          aria-hidden="true"
          style={{
            top: `${beamGeom.rigY}px`,
            left: `${beamGeom.rigX}px`,
            width: `${beamGeom.length}px`,
            transform: `rotate(${beamGeom.angleDeg}deg)`,
          }}
        >
          <div className="prospecting-banner__beam-pulse" />
          <div className="prospecting-banner__beam-origin" />
        </div>
      )}

      {/* ── Left-side network panel (subordinate to the telemetry panel) ──
          Narrower variant of .prospecting-banner. Desktop-only; hidden on
          mobile via the --network modifier to keep the small screen clean. */}
      <div className={`prospecting-banner prospecting-banner--network${sceneZoomed ? " prospecting-banner--faded" : ""}`}>
        <div className="prospecting-banner__panel">
          <span className="prospecting-banner__bracket prospecting-banner__bracket--tl" />
          <span className="prospecting-banner__bracket prospecting-banner__bracket--tr" />
          <span className="prospecting-banner__bracket prospecting-banner__bracket--bl" />
          <span className="prospecting-banner__bracket prospecting-banner__bracket--br" />

          <div className="prospecting-banner__meta">
            <span>NETWORK // STATS</span>
          </div>

          <div className="prospecting-banner__netstats">
            <div className="prospecting-banner__netstat">
              <span className="prospecting-banner__netstat-label">TOTAL STRIKES</span>
              <span className="prospecting-banner__netstat-value">12,849</span>
            </div>
            <div className="prospecting-banner__netstat">
              <span className="prospecting-banner__netstat-label">USDC PAID</span>
              <span className="prospecting-banner__netstat-value">$18.4K</span>
            </div>
            <div className="prospecting-banner__netstat">
              <span className="prospecting-banner__netstat-label">DEEPEST STRIKE</span>
              <span className="prospecting-banner__netstat-value">1.24 KM</span>
            </div>
          </div>
        </div>

        <p className="prospecting-banner__flavor" key={flavorIdx}>
          <span className="prospecting-banner__flavor-mark">//</span>
          {NETWORK_FLAVORS[flavorIdx]}
        </p>
      </div>

      {/* ── Prospecting HUD readout ── */}
      <div className={`prospecting-banner${sceneZoomed ? " prospecting-banner--faded" : ""}`}>
        <div className="prospecting-banner__panel">
          <span className="prospecting-banner__bracket prospecting-banner__bracket--tl" />
          <span className="prospecting-banner__bracket prospecting-banner__bracket--tr" />
          <span className="prospecting-banner__bracket prospecting-banner__bracket--bl" />
          <span className="prospecting-banner__bracket prospecting-banner__bracket--br" />

          <div className="prospecting-banner__meta">
            <span>
              <span className="prospecting-banner__data">03/47</span>
              {" // TELEMETRY"}
            </span>
            <span className="prospecting-banner__live">
              <span className="prospecting-banner__led" />
              LIVE
            </span>
          </div>

          <h2 className="prospecting-banner__title">
            HAIL MARY<br />PROSPECTING CO.
          </h2>

          <p className="prospecting-banner__body">
            Scanning crust for cryptographic deposits. Strike pays in USDC. Stake requirements:{" "}
            <span className="prospecting-banner__token">$20 RL80 min.</span>
          </p>

          <div className="prospecting-banner__divider" />

          <div className="prospecting-banner__rig">RIG ID: HM-09 HORIZON</div>

          <div className="prospecting-banner__stats">
            <div className="prospecting-banner__stat">
              <div className="prospecting-banner__stat-value">0.4km</div>
              <div className="prospecting-banner__stat-label">DEPTH</div>
            </div>
            <div className="prospecting-banner__stat-divider" />
            <div className="prospecting-banner__stat">
              <div className="prospecting-banner__stat-value">47</div>
              <div className="prospecting-banner__stat-label">PROSPECTORS</div>
            </div>
          </div>
        </div>
      </div>

      <MainMobileNav
        onBuyClick={() => setShowBuyModal(true)}
        onCommsClick={() => setShowComms(true)}
        onMissionClick={() => setShowMission(true)}
        onLeaderboardClick={() => console.log("Leaderboard")}
      />

      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </>
  );
}
