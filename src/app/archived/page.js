"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import MainMobileNav from "@/components/MainMobileNav";
import CommsPanel from "@/components/CommsPanel";
import CyberButton from "@/components/CyberButton";
import BuyModal from "@/components/BuyModal";
import CoinLoader from "@/components/CoinLoader";


const SpaceScene = dynamic(() => import("@/components/SpaceScene"), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />,
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
    id: "comms", name: "Captain Marisol", role: "Captain", image: "/cameo_Trin80.webp",
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
  // Keep the CoinLoader on top until SpaceScene's GLB has actually loaded,
  // so we don't flash the bare .bg gradient between chunk-load and GLB-load.
  const [sceneReady, setSceneReady] = useState(false);
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

  // Shared ref written by AntennaProjector inside the R3F canvas with the
  // Antenna's screen-space position each frame. The beam overlay reads from
  // this via a rAF loop — no React state, no re-renders.
  const antennaScreenRef = useRef({ x: 0, y: 0 });
  const beamRef = useRef(null);

  // ── Signal entrance sequence (desktop only) ──
  // Phases: 0 = hidden, 1 = broadcast rings, 2 = beam extends,
  //         3 = panels receive, 4 = steady state (pulse loops)
  // Mobile has no overlay — the CLAIM (mission) FAB in MainMobileNav is
  // the only entry point on small screens.
  const [signalPhase, setSignalPhase] = useState(0);
  const signalStarted = useRef(false);
  // Beam extension: tracks when phase 2 starts so the rAF can interpolate width
  const extendStartRef = useRef(0);   // timestamp when extension begins
  const EXTEND_DURATION = 1600;       // ms for the beam to fully extend

  useEffect(() => {
    let raf;
    const update = () => {
      const el = beamRef.current;
      if (el) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Mobile has no beam/overlay — skip everything.
        if (vw < 769) {
          el.style.display = "none";
          raf = requestAnimationFrame(update);
          return;
        }
        el.style.display = "";

        const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const isWide = vw >= 1280;

        const panelRight = (isWide ? 4 : 2.5) * remPx;
        const panelWidth = isWide ? 340 : 320;
        const panelEdgeX = vw - panelRight - panelWidth - 2;
        const panelEdgeY = vh / 2;

        // Beam origin tracks the Antenna's projected screen position
        const rigX = antennaScreenRef.current.x;
        const rigY = antennaScreenRef.current.y;

        if (rigX > 0 || rigY > 0) {
          const dx = panelEdgeX - rigX;
          const dy = panelEdgeY - rigY;
          const fullLength = Math.sqrt(dx * dx + dy * dy);
          const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

          // Beam extension: interpolate width from 0 → full during phase 2
          let length = fullLength;
          if (extendStartRef.current > 0) {
            const elapsed = performance.now() - extendStartRef.current;
            // Ease-out cubic: fast start, gentle arrival
            const t = Math.min(elapsed / EXTEND_DURATION, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            length = fullLength * eased;
          } else if (!signalStarted.current || extendStartRef.current === 0) {
            // Before extension starts, width is 0 (beam hidden via background:none anyway)
            length = 0;
          }

          el.style.top = `${rigY}px`;
          el.style.left = `${rigX}px`;
          el.style.width = `${length}px`;
          el.style.transform = `rotate(${angleDeg}deg)`;

          // Kick off the entrance sequence once we have a valid position
          // (desktop only — the mobile branch above handles its own kickoff).
          if (!signalStarted.current) {
            signalStarted.current = true;
            // Phase 1: broadcast rings
            setSignalPhase(1);
            // Phase 2: beam extends (after broadcast pulses twice)
            setTimeout(() => {
              extendStartRef.current = performance.now();
              setSignalPhase(2);
            }, 1400);
            // Phase 3: panels receive (after beam fully extends)
            setTimeout(() => setSignalPhase(3), 1400 + EXTEND_DURATION + 200);
            // Phase 4: steady state (pulse loop starts)
            setTimeout(() => setSignalPhase(4), 1400 + EXTEND_DURATION + 1000);
          }
        }
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <SpaceScene
        onZoomChange={setSceneZoomed}
        antennaScreenRef={antennaScreenRef}
        onReady={() => setSceneReady(true)}
      />

      {/* Stays on top through both phases (chunk load, then GLB load) until
          SpaceScene signals ready — prevents the purple-gradient flash. */}
      <CoinLoader loading={!sceneReady} />

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
        modalBodyPages={[
          <p key="strike">
            HM-09 INTEGR80 pinged a high-density ecrypted goo deposit at
            2.4 km. Estimated yield: 14,000 bbl, valued at 500 USDC.
          </p>,
          <p key="stake">
            Hold <strong>$20 RL80</strong> for claim eligibility. Drill crew is standing by.
          </p>,
          <p key="deploy">Our Lady willing, this one hits. Deploy?</p>,
        ]}
        onProceed={() => {
          window.location.href = "/hailmary";
        }}
      />

      {/* Beam from the Antenna on the spaceship to the HUD panel.
          Position/length/rotation are updated each frame via rAF reading
          the Antenna's projected screen position from antennaScreenRef.
          Rendered OUTSIDE .prospecting-banner on purpose — the banner has
          a `transform` on it which would make `position: fixed` children
          relative to the banner box instead of the viewport. */}
      <div
        ref={beamRef}
        className={[
          "prospecting-banner__beam",
          sceneZoomed && "prospecting-banner__beam--faded",
          signalPhase >= 1 && "signal-phase-broadcast",
          signalPhase >= 2 && "signal-phase-extend",
          signalPhase >= 4 && "signal-phase-live",
        ].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
          <div className="prospecting-banner__beam-pulse" />
          <div className="prospecting-banner__beam-origin" />
      </div>

      {/* ── Left-side network panel (subordinate to the telemetry panel) ──
          Narrower variant of .prospecting-banner. Desktop-only; hidden on
          mobile via the --network modifier to keep the small screen clean. */}
      <div className={[
        "prospecting-banner prospecting-banner--network",
        sceneZoomed && "prospecting-banner--faded",
        signalPhase >= 3 ? "signal-phase-receive" : "signal-phase-hidden",
      ].filter(Boolean).join(" ")}>
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

      {/* ── Prospecting HUD readout — desktop only (hidden on mobile via CSS) ── */}
      <div className={[
        "prospecting-banner",
        sceneZoomed && "prospecting-banner--faded",
        signalPhase >= 3 ? "signal-phase-receive" : "signal-phase-hidden",
      ].filter(Boolean).join(" ")}>
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
