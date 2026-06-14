"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ShaderText from "@/components/ShaderText";
import NoiseBackground from "@/components/NoiseBackground";
import { SignInButton } from "@clerk/nextjs";
import { WalletConnectionModal } from "@/components/WalletConnectionModal";
import NavControlsHome from "@/components/NavControlsHome";
import MobileBottomNav from "@/components/MobileBottomNav";
import BuyModal from "@/components/BuyModal";
import CyberNav from "@/components/CyberNav";
import { useMusic } from "@/components/MusicContext";
import { db, collection, query, orderBy, onSnapshot, doc } from "@/lib/firebaseClient";
import { useOilApiFetch } from "@/lib/oilApiClient";
import OilAnchorEvent from "@/components/OilAnchorEvent";
import OilClaimCertificate from "@/components/OilClaimCertificate";
import dynamic from "next/dynamic";

// Fairness console (COMMIT / ANCHOR / REVEAL) — needed HERE because the commit
// (which starts the anchor countdown) happens during registration, when the
// admin is standing in this lobby, not on the field.
const OilVerifyPanel = dynamic(() => import("@/components/OilVerifyPanel"), { ssr: false });
const OilAdminGuide = dynamic(() => import("@/components/OilAdminGuide"), { ssr: false });

const QUALIFICATION_THRESHOLD = 20; // $20 USD worth of RL80
const DEFAULT_GRID_SIZE = 10; // fallback until oilGame/settings gridSize arrives
const MAX_BONUS_DRILLS = 10;
const REFERRAL_BONUS = 3;

// RL80 trades sub-cent — fixed-decimal display loses all significant digits
// for prices below ~$0.0001. Scale precision to the magnitude of the value.
function formatRl80Price(p) {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(5);
  if (p >= 0.0001) return p.toFixed(7);
  return p.toFixed(10);
}

// Season start banner — shows the admin-set game start date (from
// oilGame/settings.gameStartDate, a "YYYY-MM-DD" string) plus a live
// countdown. Renders nothing until a valid date is set.
function SeasonStartBanner({ gameStartDate, theme, isMobile }) {
  const dateLabel = useMemo(() => {
    if (!gameStartDate) return null;
    const d = new Date(gameStartDate + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [gameStartDate]);

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!gameStartDate) { setCountdown(""); return; }
    const target = new Date(gameStartDate + "T00:00:00Z").getTime();
    if (Number.isNaN(target)) { setCountdown(""); return; }
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("STARTING SOON"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const mn = Math.floor((diff % 3600000) / 60000);
      setCountdown(
        d > 0 ? `STARTS IN ${d}d ${h}h`
          : h > 0 ? `STARTS IN ${h}h ${String(mn).padStart(2, "0")}m`
          : `STARTS IN ${mn}m`,
      );
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [gameStartDate]);

  if (!dateLabel) return null;

  return (
    <div style={{
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${theme.border}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.35em", color: theme.muted }}>
        SEASON STARTS
      </div>
      <div style={{
        fontSize: isMobile ? 15 : 18,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: theme.textStrong,
      }}>
        {dateLabel}
      </div>
      {countdown && (
        <div style={{ fontSize: 11, letterSpacing: "0.18em", color: theme.gold }}>
          {countdown}
        </div>
      )}
    </div>
  );
}

export default function OilQualify({
  gameStartDate,
  theme: themeProp,
  darkMode,
  isMobile,
  user,
  isAdmin,
  adminPassword,
  saveGameSettings,
  walletAddress,
  tokenBalance,
  isWalletConnected,
  storedRef,
  gridSize,
  prizePool = 500,
  onEnterField,
  seedCommitment,
  anchorBlock,
  anchorBlockHash,
}) {
  // Live values from oilGame/settings (passed by the page) with safe fallbacks
  const GRID_SIZE = gridSize || DEFAULT_GRID_SIZE;
  const { play, pause, isPlaying: contextIsPlaying, nextTrack } = useMusic();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [players, setPlayers] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [liveCheck, setLiveCheck] = useState(null);
  const [checkingLive, setCheckingLive] = useState(false);
  const [snapshotRunning, setSnapshotRunning] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState(null);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [xUsername, setXUsername] = useState("");
  const [xFollowVerified, setXFollowVerified] = useState(false);
  const [xCheckingFollow, setXCheckingFollow] = useState(false);
  const [xFollowNote, setXFollowNote] = useState(null); // server guidance after a failed check
  const [xIdentityVerified, setXIdentityVerified] = useState(false); // true when X username comes from Clerk OAuth
  const [allPlots, setAllPlots] = useState({}); // oilPlots collection: { "col_row": { ... } }
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  // Auto-detect X/Twitter username from Clerk OAuth (if user signed in via X)
  useEffect(() => {
    if (!user) return;
    const xAccount = user.externalAccounts?.find(
      (a) => a.provider === "x" || a.provider === "twitter" || a.provider === "oauth_x" || a.provider === "oauth_twitter"
    );
    if (xAccount?.username) {
      const verified = xAccount.username.toLowerCase();
      setXUsername(verified);
      setXIdentityVerified(true);
      // Auto-verify follow since we have a trusted identity
      fetch(`/api/check-follow?username=${encodeURIComponent(verified)}`)
        .then((r) => r.json())
        .then((data) => {
          setXFollowVerified(!!data.follows);
        })
        .catch(() => {});
    }
  }, [user]);

  // Subscribe to qualified players collection
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "oilQualified"), orderBy("registeredAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPlayers(list);
    });
    return () => unsub();
  }, []);

  // Subscribe to last snapshot
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "oilGame", "lastSnapshot"), (snap) => {
      if (snap.exists()) setLastSnapshot(snap.data());
    });
    return () => unsub();
  }, []);

  // Subscribe to oilPlots collection for live plot availability
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "oilPlots"), (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
      setAllPlots(map);
    });
    return () => unsub();
  }, []);

  // Attaches the Clerk session token to server-authoritative oil endpoints.
  const oilApiFetch = useOilApiFetch();

  // Check X follow via live API — triggered by button click
  const handleCheckFollow = useCallback(() => {
    const clean = xUsername.trim().replace(/^@/, "").toLowerCase();
    if (!clean) return;
    setXCheckingFollow(true);
    setXFollowVerified(false);
    setXFollowNote(null);
    fetch(`/api/check-follow?username=${encodeURIComponent(clean)}`)
      .then((r) => r.json())
      .then((data) => {
        setXFollowVerified(!!data.follows);
        // Surface the server's guidance (e.g. "just followed? try again
        // shortly" while the on-demand cache refresh is cooling down).
        setXFollowNote(
          data.follows
            ? null
            : data.reason === "user_not_found"
              ? "That X account doesn't exist — check the spelling."
              : data.note || "Not verified — make sure this account follows @rl80token.",
        );
        setXCheckingFollow(false);
      })
      .catch(() => {
        setXFollowVerified(false);
        setXFollowNote("Couldn't check right now — try again in a moment.");
        setXCheckingFollow(false);
      });
  }, [xUsername]);

  // OilQualify is locked into a dark iridescent aesthetic for the ticket-sale
  // page regardless of the global darkMode pref — shadow theme so every
  // theme.text/textStrong/muted token reads correctly on the dark scrims.
  const theme = useMemo(() => ({
    ...themeProp,
    text: "#e8dcc8",
    textStrong: "#fbecd0",
    muted: "#b8a890",
    border: "rgba(212, 168, 84, 0.25)",
    bg: "#1a0d24",
    panelBg: "rgba(20, 12, 28, 0.55)",
    inputBg: "rgba(30, 18, 40, 0.7)",
    barBg: "rgba(212, 168, 84, 0.12)",
    tintBg: "rgba(20, 12, 28, 0.55)",
  }), [themeProp]);

  const qualifiedPlayers = useMemo(
    () => players.filter((p) => p.qualified),
    [players]
  );

  const userRegistered = useMemo(
    () => user && players.some((p) => p.id === user.id),
    [user, players]
  );

  const userPlayer = useMemo(
    () => user && players.find((p) => p.id === user.id),
    [user, players]
  );

  // Has this user already picked a plot?
  const userPlotEntry = useMemo(() => {
    if (!user) return null;
    return Object.values(allPlots).find((p) => p.currentOwnerId === user.id) || null;
  }, [user, allPlots]);
  const userHasPlot = !!userPlotEntry;

  // Live qualification check when wallet connects
  useEffect(() => {
    if (!walletAddress) {
      setLiveCheck(null);
      return;
    }
    let cancelled = false;
    setCheckingLive(true);
    fetch(`/api/oil-qualify?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setLiveCheck(data);
          setCheckingLive(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCheckingLive(false);
      });
    return () => { cancelled = true; };
  }, [walletAddress]);

  // Register as qualified player
  const handleRegister = useCallback(async () => {
    if (!user || !walletAddress) return;
    if (!xFollowVerified) {
      setError("You must follow @rl80token on X to qualify.");
      return;
    }
    setRegistering(true);
    setError(null);
    setSuccess(null);
    try {
      // Server re-checks the on-chain balance and decides `qualified` — the
      // client can no longer self-qualify (oilQualified is write:false).
      const res = await oilApiFetch("/api/oil-register", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          xUsername,
          clerkName: user.fullName || user.firstName || "Anonymous",
          clerkAvatar: user.imageUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        return;
      }
      setSuccess(
        data.qualified
          ? "Registration confirmed!"
          : `Registered, but your wallet holds $${data.usdValue ?? 0} of RL80 (need $${data.threshold}). Top up to qualify.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRegistering(false);
    }
  }, [user, walletAddress, xFollowVerified, xUsername, oilApiFetch]);

  // Admin: run snapshot
  const handleRunSnapshot = useCallback(async () => {
    setSnapshotRunning(true);
    setSnapshotResult(null);
    try {
      const adminPw = localStorage.getItem("oil_admin_pw") || sessionStorage.getItem("oil_admin_pw") || "";
      const res = await fetch("/api/oil-qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: adminPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Snapshot failed");
      setSnapshotResult(data);
    } catch (err) {
      setSnapshotResult({ error: err.message });
    } finally {
      setSnapshotRunning(false);
    }
  }, []);

  // Plot claiming moved ON-FIELD (2026-06-10): the lobby's 2D quick-pick grid
  // was replaced by the "PICK YOUR PLOT ON THE FIELD" CTA (onEnterField) — the
  // claim itself happens on the 3D field via the page's STAKE YOUR CLAIM
  // button (same /api/oil-claim route, same ?ref= handling).

  // Release current plot so user can pick a different one
  const [releasing, setReleasing] = useState(false);
  const handleReleasePlot = useCallback(async () => {
    if (!user || !userPlotEntry) return;
    setReleasing(true);
    setError(null);
    try {
      const res = await oilApiFetch("/api/oil-release", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setReleasing(false);
    }
  }, [user, userPlotEntry, oilApiFetch]);

  const mono = "'Share Tech Mono', monospace";

  // Brochure / panorama polaroids. Sources are straight; each gets a slight
  // individual CSS tilt — like photos laid on a table — applied in one place
  // so the grid thumbnail and the lightbox stay matched. Tweak `tilt` to taste.
  const BROCHURE_IMAGES = [
    { src: "/polaroid-3.webp", caption: "", tilt: -3 },
    { src: "/polaroid-4.webp", caption: "", tilt: 4 },
  ];
  const PANORAMA_IMAGES = [
    { src: "/polaroid-5.webp", caption: "", tilt: -4 },
    { src: "/polaroid-6.webp", caption: "", tilt: 3.5 },
  ];
  // Tilt lookup across every polaroid (grid + lightbox); 0 if not found.
  const polaroidTilt = (src) =>
    [...BROCHURE_IMAGES, ...PANORAMA_IMAGES].find((p) => p.src === src)?.tilt ?? 0;

  // Format token balance for display
  const displayBalance = tokenBalance ? Number(tokenBalance).toLocaleString() : "0";
  const liveCheckError = liveCheck?.error ?? null;
  const usdValue = liveCheck?.usdValue ?? null;
  const isQualified = liveCheck?.qualified ?? false;
  const rl80Price = liveCheck?.price ?? null;
  const neededMore = !isQualified && usdValue != null
    ? Math.ceil((QUALIFICATION_THRESHOLD - usdValue) / (rl80Price || 1))
    : 0;

  // Parse theme.bg hex into [r,g,b] floats so the shader can premix its
  // noise onto the same color as the rest of the page.
  const bgFloats = useMemo(() => {
    const hex = (theme.bg || "#f5efe6").replace("#", "");
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }, [theme.bg]);

  return (
    <div style={{
      minHeight: "100vh",
      color: theme.text,
      fontFamily: mono,
      position: "relative",
    }}>
      {/* Ambient noise background — fully opaque, premixes gold noise onto
          theme.bg in the shader so it IS the page background. Sits at z:1.
          Page content below is wrapped in a z:2 layer so it stacks above. */}
      <NoiseBackground
        bgColor={[0.10, 0.05, 0.14]} // deep midnight plum — darker than theme.bg
        palette={[
          [0.20, 0.06, 0.40], // dark indigo violet
          [0.55, 0.15, 0.50], // dusty fuchsia
          [0.65, 0.40, 0.35], // muted terracotta
        ]}
        mix={0.55}
        speed={0.00003}
        scale={3}
      />
      <div style={{ position: "relative", zIndex: 2 }}>

      {/* Nav Controls (desktop only — mobile uses MobileBottomNav) */}
      {!isMobile && (
        <style>{`.nav-mobile-home { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; gap: 6px !important; border-radius: 0 !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`}</style>
      )}
      {!isMobile && (
        <div style={{ position: "fixed", top: 12, right: 12, zIndex: 100, display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href="/"
            title="Return to shrine"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(212, 175, 55, 0.05)",
              border: "1.5px solid rgba(212, 175, 55, 0.2)",
              color: theme.accent, textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <img src="/brand-mark-cyan.svg" alt="Home" width="24" height="24" style={{ display: "block" }} />
          </a>
          <NavControlsHome
            isPlaying={contextIsPlaying}
            onPlayMusic={() => play()}
            onStopMusic={() => pause()}
            onSkipTrack={() => nextTrack()}
            hideMenu
            onUserClick={() => {}}
            isUserSignedIn={!!user}
            userImage={user?.imageUrl}
            show80sButton={false}
          />
        </div>
      )}

      {/* Hero Header */}
      <div style={{
        // Hero is transparent so NoiseBackground shows through here — no
        // borderBottom either, otherwise it floats as a stray line over the noise.
        background: "transparent",
        padding: isMobile ? "32px 16px 24px" : "48px 32px 36px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative corner brackets */}
        <div style={{ position: "absolute", top: 12, left: 12, width: 20, height: 20, borderTop: `2px solid ${theme.gold}`, borderLeft: `2px solid ${theme.gold}` }} />
        <div style={{ position: "absolute", top: 12, right: 12, width: 20, height: 20, borderTop: `2px solid ${theme.gold}`, borderRight: `2px solid ${theme.gold}` }} />
        <div style={{ position: "absolute", bottom: 12, left: 12, width: 20, height: 20, borderBottom: `2px solid ${theme.gold}`, borderLeft: `2px solid ${theme.gold}` }} />
        <div style={{ position: "absolute", bottom: 12, right: 12, width: 20, height: 20, borderBottom: `2px solid ${theme.gold}`, borderRight: `2px solid ${theme.gold}` }} />

        <div style={{ fontSize: 10, letterSpacing: "0.4em", color: theme.muted, marginBottom: 8 }}>
          EST. 2026
        </div>
        <h1 style={{
          margin: 0,
          lineHeight: 1.2,
          // color: theme.textStrong,
          color: 'gold',
          fontFamily: "'Holtwood One SC', serif",
          fontSize: isMobile ? 32 : 64,
          position: "relative",
        }}>
          {/* <ShaderText
            // text="HAIL MARY"
            font="'Blackletter', serif"
            // fontWeight={700}
            height={isMobile ? 56 : 110}
            colorBg={darkMode ? "#12161c" : "#f5efe6"}
            colorFill={theme.gold}
            density={12}
            speed={0.08}
            turbulence={0.45}
            outlineWidth={3.5}
            colorOutline={"#00000048"}
          /> */}
          HAIL MARY
          <span style={{
            marginLeft: '1rem',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: isMobile ? 28 : 48,
            letterSpacing: "0.25em",
            display: "block",
          }}>PROSPECTING CO.</span>
        </h1>
        <div style={{ width: 40, height: 1, background: theme.gold, margin: "12px auto" }} />
        <div style={{
          display: "inline-block",
          padding: isMobile ? "10px 18px" : "12px 24px",
          marginTop: 4,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          background: "rgba(20, 12, 28, 0.55)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          color: "#e8dcc8",
        }}>
          <div style={{
            fontSize: isMobile ? 18 : 24,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: theme.gold,
          }}>
            ${prizePool} USDC IS BURIED IN THIS FIELD
          </div>
          <div style={{
            fontSize: isMobile ? 10 : 12,
            letterSpacing: "0.35em",
            color: theme.gold,
            marginTop: 10,
            opacity: 0.8,
          }}>
            PLAYER QUALIFICATION
          </div>
          <div style={{
            fontSize: 10,
            color: theme.text,
            marginTop: 6,
            letterSpacing: "0.1em",
          }}>
            HOLD ${QUALIFICATION_THRESHOLD}+ USD OF RL80 & FOLLOW @RL80TOKEN
          </div>
          <div style={{
            fontSize: 9,
            color: theme.muted,
            marginTop: 4,
            letterSpacing: "0.08em",
          }}>
            HOLDING IS THE TICKET — YOU NEVER SPEND IT
          </div>

          <SeasonStartBanner gameStartDate={gameStartDate} theme={theme} isMobile={isMobile} />
        </div>

        {/* Hero — Claim Certificate with dynamic fields + the share pipeline.
            Shared component (OilClaimCertificate) — the field's pre-season
            panel renders the same certificate as a click-to-enlarge thumb.
            Fields fill in progressively (sign in → register → claim plot) so
            the certificate previews a completed claim, as enticement. */}
        <OilClaimCertificate
          variant="hero"
          user={user}
          walletAddress={walletAddress}
          plotCol={userPlotEntry?.col ?? userPlayer?.plotCol}
          plotRow={userPlotEntry?.row ?? userPlayer?.plotRow}
          pickedAt={userPlayer?.pickedAt}
          theme={theme}
          isMobile={isMobile}
          showShare={!!(userPlayer && userHasPlot)}
        />


        {/* Claim staked → the lobby's job is done. Hand the player to the 3D
            field (pre-season mode: countdown + alerts/referral/rig checklist). */}
        {userPlayer && userHasPlot && onEnterField && (
          <div style={{ margin: "16px auto 0", maxWidth: 480 }}>
            <button
              onClick={onEnterField}
              style={{
                width: "100%",
                padding: "14px 28px",
                background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                border: `1px solid ${theme.goldBorder || theme.gold}`,
                borderRadius: 3,
                color: "#fff",
                fontFamily: mono,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.15em",
                cursor: "pointer",
              }}
            >
              ⛏ ENTER THE FIELD →
            </button>
            <div style={{ textAlign: "center", fontSize: 9, color: theme.muted, marginTop: 6, letterSpacing: "0.08em" }}>
              YOUR RIG IS STAKED — SEE IT ON THE GRID & GET READY FOR THE SEASON
            </div>
          </div>
        )}

        {/* Sign-in / user badge */}
        <div style={{ marginTop: 20 }}>
          {!user ? (
            <SignInButton mode="modal" forceRedirectUrl="/hailmary">
              <button style={{
                padding: "10px 28px",
                background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                border: `1px solid ${theme.goldBorder}`,
                borderRadius: 3,
                color: "#fff",
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.15em",
                cursor: "pointer",
              }}>
                SIGN IN TO PARTICIPATE
              </button>
            </SignInButton>
          ) : (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              border: `1px solid ${theme.border}`,
              borderRadius: 3,
              background: theme.tintBg,
            }}>
              {user.imageUrl && (
                <img src={user.imageUrl} alt="" style={{ width: 22, height: 22, borderRadius: 11 }} />
              )}
              <span style={{ fontSize: 11, color: theme.textStrong }}>
                {user.fullName || user.firstName || "Signed In"}
              </span>
              {userRegistered && (
                <span style={{
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: userPlayer?.qualified ? theme.green : theme.warn,
                  padding: "2px 6px",
                  background: userPlayer?.qualified ? `${theme.green}15` : `${theme.warn}15`,
                  border: `1px solid ${userPlayer?.qualified ? theme.green : theme.warn}30`,
                  borderRadius: 2,
                }}>
                  {userPlayer?.qualified ? "QUALIFIED" : "REGISTERED"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: isMobile ? "20px 16px" : "28px 32px",
      }}>
        {/* Qualified Player Counter */}
        <div style={{
          textAlign: "center",
          padding: isMobile ? "24px 16px" : "32px 20px",
          border: `1px solid ${theme.gold}33`,
          borderRadius: 4,
          background: "rgba(20, 12, 28, 0.55)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          color: "#e8dcc8",
          marginBottom: 24,
        }}>
          {(() => {
            // Scarcity over headcount: "plots remaining" motivates at any
            // player count, while a low "qualified players" number reads as a
            // ghost town. Claimed = oilPlots docs with a current owner.
            const totalPlots = GRID_SIZE * GRID_SIZE;
            const claimedPlots = Object.values(allPlots).filter((p) => p?.currentOwnerId != null).length;
            const plotsRemaining = Math.max(0, totalPlots - claimedPlots);
            return (
              <>
                <div style={{
                  fontSize: isMobile ? 52 : 72,
                  fontWeight: 700,
                  color: theme.gold,
                  lineHeight: 1,
                }}>
                  {plotsRemaining}
                </div>
                <div style={{
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  color: theme.muted,
                  marginTop: 8,
                }}>
                  {plotsRemaining === 1 ? "PLOT REMAINING" : "PLOTS REMAINING"}
                </div>
                <div style={{
                  fontSize: 10,
                  color: theme.muted,
                  marginTop: 4,
                }}>
                  first come, first served &mdash; {claimedPlots} claimed &middot; {players.length} prospector{players.length === 1 ? "" : "s"} registered
                </div>
              </>
            );
          })()}

          <div style={{
            display: "inline-block",
            padding: "8px 20px",
            border: `1px solid ${theme.gold}`,
            borderRadius: 3,
            background: `${theme.gold}18`,
            marginTop: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.gold }}>
              {GRID_SIZE}x{GRID_SIZE} GRID
            </div>
            <div style={{ fontSize: 9, color: theme.muted }}>
              {GRID_SIZE * GRID_SIZE} PLOTS &mdash; ${prizePool} USDC PRIZE POOL
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div style={{
          marginBottom: 24,
          padding: isMobile ? 16 : 20,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          background: "rgba(20, 12, 28, 0.55)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          color: "#e8dcc8",
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 14,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            HOW IT WORKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { step: "01", title: "HOLD RL80 & FOLLOW", desc: `Hold at least $${QUALIFICATION_THRESHOLD} of RL80 and follow @rl80token on X. You never spend it — holding is the ticket. Sell anytime; you only lose your seat.` },
              { step: "02", title: "STAKE YOUR CLAIM", desc: `Connect your wallet, verify your follow, and pick a plot on the ${GRID_SIZE}x${GRID_SIZE} grid. First come, first served.` },
              { step: "03", title: "YOUR RIG DRILLS 24/7", desc: "No clicking. Once the season starts, your rig pumps around the clock and strikes at random, unpredictable times — day or night. Refer friends to drill deeper (+3 layers each, up to depth 20)." },
              { step: "04", title: "STRIKE LYQUID80 — GET PAID", desc: "Every unit you haul is worth real USDC at a fixed rate. When the season ends, payouts go straight to your wallet." },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.gold,
                  lineHeight: 1,
                  minWidth: 28,
                }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.textStrong, marginBottom: 2 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted, lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anchor-as-event — the provable-fairness trust beat: the map doesn't
            exist until the anchor block mines (live countdown once committed). */}
        <OilAnchorEvent
          theme={theme}
          isMobile={isMobile}
          seedCommitment={seedCommitment}
          anchorBlock={anchorBlock}
          anchorBlockHash={anchorBlockHash}
          gameStartDate={gameStartDate}
        />

        {/* Brochure Images */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}>
          {BROCHURE_IMAGES.map(({ src, caption, tilt }) => (
            <div key={src}>
              <button
                type="button"
                onClick={() => setLightboxSrc(src)}
                style={{
                  display: "block",
                  width: "100%",
                  // Box matches the source aspect so the polaroids fill it
                  // with no letterbox. MUST match the panorama box below so
                  // all four images render at the same size.
                  aspectRatio: "694 / 800",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  background: "transparent",
                  appearance: "none",
                  WebkitAppearance: "none",
                  cursor: "zoom-in",
                }}
                aria-label="View larger"
              >
                {/* Individual CSS tilt. scale(0.92) leaves headroom so the
                    rotated corners don't clip; contain avoids cropping. */}
                <img
                  src={src}
                  alt={caption}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    transform: `rotate(${tilt}deg) scale(0.92)`,
                    transformOrigin: "center",
                  }}
                />
              </button>
              <div style={{
                padding: "6px 4px",
                fontSize: 10,
                fontStyle: "italic",
                color: theme.muted,
                letterSpacing: "0.04em",
                lineHeight: 1.5,
                textAlign: "center",
              }}>
                {caption}
              </div>
            </div>
          ))}
        </div>

        {/* Qualification Section */}
        <div style={{
          marginBottom: 24,
          padding: isMobile ? 16 : 20,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          background: "rgba(20, 12, 28, 0.55)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          color: "#e8dcc8",
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            QUALIFY TO PLAY
          </div>

          {/* Preview link — shown ONLY while the player is not yet qualified.
              Once qualified, the single game link becomes PICK YOUR PLOT (in
              the confirmation panel below). Plain <a> (not next/link) forces a
              full nav so OilPage's one-shot effect re-reads ?preview=1. */}
          {!userPlayer?.qualified && (
            <a
              href="/hailmary?preview=1"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px 16px",
                marginBottom: 18,
                background: `linear-gradient(180deg, rgba(212,168,84,0.28), rgba(212,168,84,0.14))`,
                border: `1px solid ${theme.gold}`,
                borderRadius: 4,
                color: theme.gold,
                textDecoration: "none",
                fontFamily: mono,
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em" }}>
                PREVIEW THE GAME &rarr;
              </div>
              <div style={{ fontSize: 10, color: "#e8dcc8", marginTop: 4, letterSpacing: "0.06em" }}>
                See the rigs and grid before claiming a plot
              </div>
            </a>
          )}

          {!user ? (
            <div style={{
              textAlign: "center",
              padding: "28px 16px",
              border: `1px dashed ${theme.border}`,
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 14 }}>
                Sign in to check your qualification
              </div>
              <SignInButton mode="modal" forceRedirectUrl="/hailmary">
                <button style={{
                  padding: "10px 28px",
                  background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                  border: `1px solid ${theme.goldBorder}`,
                  borderRadius: 3,
                  color: "#fff",
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                }}>
                  SIGN IN
                </button>
              </SignInButton>
            </div>
          ) : !isWalletConnected ? (
            <div style={{
              textAlign: "center",
              padding: "28px 16px",
              border: `1px dashed ${theme.border}`,
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 14 }}>
                Connect your wallet to check RL80 balance
              </div>
              <button
                onClick={() => setShowWalletModal(true)}
                style={{
                  padding: "10px 28px",
                  background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                  border: `1px solid ${theme.goldBorder}`,
                  borderRadius: 3,
                  color: "#fff",
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                }}
              >
                CONNECT WALLET
              </button>
              {showWalletModal && (
                <WalletConnectionModal onClose={() => setShowWalletModal(false)} />
              )}
            </div>
          ) : userRegistered ? (
            <div style={{
              textAlign: "center",
              padding: "20px 16px",
              border: `1px solid ${userPlayer?.qualified ? theme.green : theme.gold}30`,
              borderRadius: 4,
              background: `${userPlayer?.qualified ? theme.green : theme.gold}08`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>
                {userPlayer?.qualified ? "\u2705" : "\u23F3"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: userPlayer?.qualified ? theme.green : theme.gold }}>
                {userPlayer?.qualified ? "YOU ARE QUALIFIED" : "REGISTERED — AWAITING SNAPSHOT"}
              </div>
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                Wallet: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </div>
              {userPlayer?.lastSnapshotUsdValue != null && (
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                  Last snapshot: ${userPlayer.lastSnapshotUsdValue.toFixed(2)} USD ({userPlayer.lastSnapshotBalance} RL80)
                </div>
              )}

              {/* Combined here: once qualified (and no plot yet), this same
                  panel carries the single game link — STAKE YOUR CLAIM. The
                  pick itself happens on the 3D field via onEnterField. */}
              {userPlayer?.qualified && !userHasPlot && (
                <>
                  <div style={{
                    fontSize: 11,
                    color: theme.muted,
                    margin: "16px auto 14px",
                    lineHeight: 1.6,
                    maxWidth: 420,
                  }}>
                    Stake your claim — walk the live field and choose your
                    ground. Click any open cell on the {GRID_SIZE}x{GRID_SIZE}{" "}
                    grid and plant your rig where you want to drill. First come,
                    first served.
                  </div>
                  <button
                    onClick={onEnterField}
                    disabled={!onEnterField}
                    style={{
                      padding: "14px 32px",
                      background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                      border: `1px solid ${theme.goldBorder || theme.gold}`,
                      borderRadius: 3,
                      color: "#fff",
                      fontFamily: mono,
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      cursor: onEnterField ? "pointer" : "default",
                    }}
                  >
                    ⛏ PICK YOUR PLOT ON THE FIELD →
                  </button>
                  {error && (
                    <div style={{ color: theme.red, fontSize: 11, textAlign: "center", marginTop: 8 }}>
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{
              padding: isMobile ? 14 : 20,
              border: `1px solid ${theme.border}`,
              borderRadius: 4,
              background: theme.panelBg,
              backdropFilter: "blur(24px) saturate(1.2)",
              WebkitBackdropFilter: "blur(24px) saturate(1.2)",
              color: "#e8dcc8",
            }}>
              {/* Wallet & Balance Info */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, color: theme.gold, letterSpacing: "0.15em", marginBottom: 10, fontWeight: 700,
                }}>
                  YOUR WALLET
                </div>
                <div style={{
                  padding: 12,
                  background: theme.inputBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  fontSize: 11,
                  color: theme.textStrong,
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}>
                  {walletAddress}
                </div>
              </div>

              {/* Balance display */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}>
                <div style={{
                  padding: 12,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.15em", color: theme.muted, marginBottom: 4 }}>
                    RL80 BALANCE
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: theme.textStrong }}>
                    {checkingLive ? "..." : displayBalance}
                  </div>
                </div>
                <div style={{
                  padding: 12,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.15em", color: theme.muted, marginBottom: 4 }}>
                    USD VALUE
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: isQualified ? theme.green : theme.textStrong,
                  }}>
                    {checkingLive ? "..." : usdValue != null ? `$${usdValue.toFixed(2)}` : "—"}
                  </div>
                </div>
              </div>

              {/* Threshold bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9,
                  color: theme.muted,
                  marginBottom: 4,
                }}>
                  <span>QUALIFICATION THRESHOLD</span>
                  <span>${QUALIFICATION_THRESHOLD} USD</span>
                </div>
                <div style={{
                  height: 6,
                  background: theme.barBg,
                  borderRadius: 3,
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, ((usdValue || 0) / QUALIFICATION_THRESHOLD) * 100)}%`,
                    background: isQualified
                      ? `linear-gradient(90deg, ${theme.green}, ${theme.green}cc)`
                      : `linear-gradient(90deg, ${theme.gold}, ${theme.gold}cc)`,
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>

              {/* X/Twitter Follow Requirement */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, color: theme.gold, letterSpacing: "0.15em", marginBottom: 10, fontWeight: 700,
                }}>
                  X/TWITTER — FOLLOW @RL80TOKEN
                </div>

                {xIdentityVerified ? (
                  /* Clerk OAuth verified — show locked username + follow status */
                  <div>
                    <div style={{
                      display: "flex", gap: 8, alignItems: "center",
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        flex: 1,
                        border: `1px solid ${xFollowVerified ? theme.green : theme.border}`,
                        borderRadius: 3,
                        padding: "10px 12px",
                        background: `${theme.green}08`,
                      }}>
                        <span style={{ fontSize: 12, color: theme.muted, marginRight: 2 }}>@</span>
                        <span style={{ fontSize: 11, color: theme.textStrong, fontFamily: mono }}>{xUsername}</span>
                        <span style={{
                          marginLeft: 8, fontSize: 9, color: theme.green,
                          padding: "1px 6px", background: `${theme.green}15`,
                          border: `1px solid ${theme.green}30`, borderRadius: 2,
                        }}>
                          VERIFIED
                        </span>
                      </div>
                      {!xFollowVerified && (
                        <a
                          href="https://x.com/rl80token"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "10px 14px",
                            background: `${theme.gold}22`,
                            border: `1px solid ${theme.gold}`,
                            borderRadius: 3,
                            color: theme.gold,
                            fontFamily: mono,
                            fontSize: 10,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          FOLLOW
                        </a>
                      )}
                    </div>
                    {xFollowVerified ? (
                      <div style={{ fontSize: 10, marginTop: 6, color: theme.green }}>
                        Identity verified via X sign-in — you follow @rl80token
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, marginTop: 6, color: theme.warn }}>
                        You signed in with X but don't follow @rl80token yet.{" "}
                        <span
                          onClick={() => {
                            fetch(`/api/check-follow?username=${encodeURIComponent(xUsername)}`)
                              .then((r) => r.json())
                              .then((data) => setXFollowVerified(!!data.follows))
                              .catch(() => {});
                          }}
                          style={{ color: theme.gold, cursor: "pointer", textDecoration: "underline" }}
                        >
                          Re-check
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Manual entry — user didn't sign in via X */
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        flex: 1,
                        border: `1px solid ${xFollowVerified ? theme.green : theme.border}`,
                        borderRadius: 3,
                        overflow: "hidden",
                      }}>
                        <span style={{ fontSize: 12, color: theme.muted, padding: "10px 0 10px 12px" }}>@</span>

                        <style>{`.oil-qualify-input { background: transparent !important; border: none !important; border-radius: 0 !important; padding: 10px 12px 10px 4px !important; width: auto !important; font-size: 11px !important; }`}</style>
                        <input
                          className="oil-qualify-input"
                          type="text"
                          placeholder="your_x_username"
                          value={xUsername}
                          onChange={(e) => { setXUsername(e.target.value); setXFollowNote(null); }}
                          style={{
                            flex: 1,
                            color: theme.text,
                            fontFamily: mono,
                            outline: "none",
                          }}
                        />
                      </div>
                      <a
                        href="https://x.com/rl80token"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: "10px 14px",
                          background: "transparent",
                          border: `1px solid ${theme.border}`,
                          borderRadius: 3,
                          color: theme.muted,
                          fontFamily: mono,
                          fontSize: 10,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        FOLLOW
                      </a>
                      <button
                        onClick={handleCheckFollow}
                        disabled={!xUsername.trim() || xCheckingFollow}
                        style={{
                          padding: "10px 14px",
                          background: xUsername.trim() && !xCheckingFollow ? `${theme.gold}22` : "transparent",
                          border: `1px solid ${xUsername.trim() ? theme.gold : theme.border}`,
                          borderRadius: 3,
                          color: xUsername.trim() ? theme.gold : theme.muted,
                          fontFamily: mono,
                          fontSize: 10,
                          cursor: xUsername.trim() && !xCheckingFollow ? "pointer" : "default",
                          whiteSpace: "nowrap",
                          opacity: xCheckingFollow ? 0.5 : 1,
                        }}
                      >
                        {xCheckingFollow ? "..." : "VERIFY"}
                      </button>
                    </div>
                    {xUsername.trim() && !xCheckingFollow && xFollowVerified && (
                      <div style={{ fontSize: 10, marginTop: 6, color: theme.green }}>
                        Verified — you follow @rl80token
                      </div>
                    )}
                    {xUsername.trim() && !xCheckingFollow && !xFollowVerified && xUsername.length > 1 && (
                      <div style={{ fontSize: 10, marginTop: 6, color: xFollowNote ? "#d4a854" : theme.muted }}>
                        {xFollowNote || "Enter your X username and click VERIFY"}
                      </div>
                    )}
                    <div style={{ fontSize: 10, marginTop: 8, color: theme.muted }}>
                      Tip:{" "}
                      <span
                        onClick={async () => {
                          if (!user) return;
                          try {
                            const res = await user.createExternalAccount({
                              strategy: "oauth_x",
                              redirectUrl: window.location.href,
                            });
                            if (res?.verification?.externalVerificationRedirectURL) {
                              window.location.href = res.verification.externalVerificationRedirectURL.href;
                            }
                          } catch (err) {
                            console.error("Link X account error:", err);
                            setError("Failed to link X account. Try again.");
                          }
                        }}
                        style={{ color: theme.gold, cursor: "pointer", textDecoration: "underline" }}
                      >
                        Link your X account
                      </span>{" "}to auto-verify your identity
                    </div>
                  </div>
                )}
              </div>

              {isQualified && xFollowVerified ? (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    background: registering
                      ? theme.barBg
                      : `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                    border: `1px solid ${registering ? theme.border : theme.goldBorder}`,
                    borderRadius: 3,
                    color: registering ? theme.muted : "#fff",
                    fontFamily: mono,
                    fontSize: 12,
                    letterSpacing: "0.12em",
                    cursor: registering ? "default" : "pointer",
                  }}
                >
                  {registering ? "REGISTERING..." : "REGISTER AS QUALIFIED PLAYER"}
                </button>
              ) : isQualified && !xFollowVerified ? (
                <div style={{
                  textAlign: "center",
                  padding: "14px 12px",
                  border: `1px solid ${theme.warn}30`,
                  borderRadius: 3,
                  background: `${theme.warn}08`,
                }}>
                  <div style={{ fontSize: 12, color: theme.warn, fontWeight: 700, marginBottom: 4 }}>
                    FOLLOW @RL80TOKEN TO REGISTER
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted }}>
                    Your RL80 balance qualifies, but you must also follow @rl80token on X
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  padding: "14px 12px",
                  border: `1px solid ${theme.warn}30`,
                  borderRadius: 3,
                  background: `${theme.warn}08`,
                }}>
                  {liveCheckError ? (
                    <>
                      <div style={{ fontSize: 12, color: theme.warn, fontWeight: 700, marginBottom: 4 }}>
                        BALANCE CHECK FAILED
                      </div>
                      <div style={{ fontSize: 11, color: theme.muted }}>
                        {liveCheckError}
                      </div>
                      <button
                        onClick={() => {
                          setLiveCheck(null);
                          setCheckingLive(true);
                          fetch(`/api/oil-qualify?wallet=${walletAddress}`)
                            .then((r) => r.json())
                            .then((data) => { setLiveCheck(data); setCheckingLive(false); })
                            .catch(() => setCheckingLive(false));
                        }}
                        style={{
                          marginTop: 8, padding: "6px 16px",
                          background: `${theme.gold}22`, border: `1px solid ${theme.gold}`,
                          borderRadius: 3, color: theme.gold, fontFamily: mono,
                          fontSize: 10, cursor: "pointer",
                        }}
                      >
                        RETRY
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: theme.warn, fontWeight: 700, marginBottom: 4 }}>
                        NOT ENOUGH RL80
                      </div>
                      <div style={{ fontSize: 11, color: theme.muted }}>
                        You need ~{neededMore.toLocaleString()} more RL80 to reach ${QUALIFICATION_THRESHOLD}
                      </div>
                      <div style={{ fontSize: 10, color: theme.muted, marginTop: 6 }}>
                        Buy RL80 on{" "}
                        <a
                          href="https://app.uniswap.org/swap?outputCurrency=0x30d01555d88c76500a82754a1d53cac082a6cb75&chain=base"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: theme.gold }}
                        >
                          Uniswap
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}

              {error && (
                <div style={{
                  color: theme.red, fontSize: 11, marginTop: 10,
                  padding: "8px 10px", background: `${theme.red}10`, borderRadius: 3,
                }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{
                  color: theme.green, fontSize: 11, marginTop: 10,
                  padding: "8px 10px", background: `${theme.green}10`, borderRadius: 3,
                }}>
                  {success}
                </div>
              )}
            </div>
          )}
        </div>

        {/* (Qualified-with-no-plot CTA merged into the "QUALIFY TO PLAY"
            confirmation panel above — the single game link lives there now.) */}

        {/* Plot picked confirmation + referral code */}
        {userRegistered && userHasPlot && (
          <div style={{
            marginBottom: 24,
            padding: 20,
            border: `1px solid ${theme.green}44`,
            borderRadius: 4,
            background: `${theme.green}08`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.green, marginBottom: 6 }}>
              PLOT CLAIMED — ({userPlotEntry.col + 1}, {userPlotEntry.row + 1})
            </div>
            <div style={{ fontSize: 11, color: theme.muted, marginBottom: 12 }}>
              You have picked your plot. The game will start soon — check back when the drilling phase begins!
            </div>
            <button
              onClick={handleReleasePlot}
              disabled={releasing}
              style={{
                padding: "6px 16px",
                background: "transparent",
                border: `1px solid ${theme.border}`,
                borderRadius: 3,
                color: theme.muted,
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                cursor: releasing ? "default" : "pointer",
                marginBottom: 12,
                opacity: releasing ? 0.5 : 1,
              }}
            >
              {releasing ? "..." : "CHANGE PLOT"}
            </button>
            {/* Referral link section */}
            <div style={{
              padding: "12px 16px",
              border: `1px solid ${theme.gold}44`,
              borderRadius: 4,
              background: `${theme.gold}08`,
            }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: theme.gold, marginBottom: 8, fontWeight: 700 }}>
                SHARE YOUR REFERRAL LINK
              </div>
              <div style={{ fontSize: 10, color: theme.muted, marginBottom: 8 }}>
                Each referral earns you +{REFERRAL_BONUS} bonus drills (up to {MAX_BONUS_DRILLS} max). Deeper drills reach richer deposits!
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 10px", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 3,
              }}>
                <span style={{ fontSize: 11, color: theme.textStrong, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  rl80.com/hailmary?ref={walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user?.id?.slice(0, 8)}
                </span>
                <button
                  onClick={() => {
                    const code = walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user?.id?.slice(0, 8);
                    navigator.clipboard.writeText(`https://rl80.com/hailmary?ref=${code}`);
                  }}
                  style={{
                    padding: "4px 12px", border: `1px solid ${theme.gold}`, borderRadius: 3,
                    background: `${theme.gold}22`, color: theme.gold, fontFamily: mono,
                    fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  COPY LINK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Details */}
        <div style={{
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
        }}>
          {[
            { label: "ENTRY", value: "HOLD " + `$${QUALIFICATION_THRESHOLD}+ RL80`, sub: "Token balance check" },
            { label: "GRID SIZE", value: `${GRID_SIZE}x${GRID_SIZE} FIXED`, sub: `${GRID_SIZE * GRID_SIZE} plots` },
            { label: "MAX DEPTH", value: "20 LAYERS", sub: "10 passive + 10 bonus" },
            { label: "PRIZE POOL", value: `$${prizePool} USDC`, sub: "Hidden underground" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: 14,
                border: `1px solid ${theme.border}`,
                borderRadius: 3,
                textAlign: "center",
                // Frosted scrim — keeps the noise visible through the card
                // while giving text a stable contrast surface.
                background: "rgba(20, 12, 28, 0.55)",
                backdropFilter: "blur(24px) saturate(1.2)",
                WebkitBackdropFilter: "blur(24px) saturate(1.2)",
                color: "#e8dcc8",
              }}
            >
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: theme.muted, marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong }}>
                {item.value}
              </div>
              <div style={{ fontSize: 9, color: theme.muted, marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Registered Players */}
        <div style={{
          marginBottom: 24,
          padding: isMobile ? 14 : 18,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          background: "rgba(20, 12, 28, 0.55)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          color: "#e8dcc8",
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span>REGISTERED PLAYERS</span>
            <span style={{ color: theme.textStrong, letterSpacing: "0.05em" }}>
              {qualifiedPlayers.length} qualified / {players.length} total
            </span>
          </div>
          <div style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            maxHeight: 320,
            overflowY: "auto",
          }}>
            {players.length === 0 ? (
              <div style={{ color: theme.muted, fontSize: 11, padding: 24, textAlign: "center" }}>
                No players registered yet — be the first prospector
              </div>
            ) : (
              players.map((p, i) => {
                const isMe = user && p.id === user.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: i < players.length - 1 ? `1px solid ${theme.border}` : "none",
                      background: isMe ? `${theme.gold}08` : "transparent",
                    }}
                  >
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: p.qualified ? theme.green : theme.muted,
                      minWidth: 52,
                      letterSpacing: "0.05em",
                    }}>
                      {p.qualified ? "QUALIFIED" : "PENDING"}
                    </div>
                    {p.clerkAvatar ? (
                      <img
                        src={p.clerkAvatar}
                        alt=""
                        style={{ width: 26, height: 26, borderRadius: 13 }}
                      />
                    ) : (
                      <div style={{
                        width: 26, height: 26, borderRadius: 13,
                        background: theme.barBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: theme.muted,
                      }}>
                        ?
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: theme.textStrong }}>
                        {p.clerkName || "Anonymous"}
                        {isMe && (
                          <span style={{ fontSize: 9, color: theme.gold, marginLeft: 6 }}>YOU</span>
                        )}
                      </div>
                      {p.walletAddress && (
                        <div style={{ fontSize: 9, color: theme.muted }}>
                          {p.walletAddress.slice(0, 6)}...{p.walletAddress.slice(-4)}
                        </div>
                      )}
                    </div>
                    {p.referredBy && (
                      <div style={{ fontSize: 9, color: theme.gold, padding: "1px 4px", background: `${theme.gold}15`, borderRadius: 2, marginRight: 4 }}>
                        ref:{p.referredBy}
                      </div>
                    )}
                    {p.lastSnapshotUsdValue != null && (
                      <div style={{ fontSize: 10, color: theme.muted }}>
                        ${p.lastSnapshotUsdValue.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panorama images */}
        <div style={{
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
        }}>
          {PANORAMA_IMAGES.map(({ src, caption, tilt }) => (
            <div key={src}>
              <button
                type="button"
                onClick={() => setLightboxSrc(src)}
                style={{
                  // Box matches the source aspect (same as the brochure box
                  // above) so all four polaroids render at the same size. The
                  // per-image tilt is applied to the <img> below.
                  display: "block",
                  width: "100%",
                  aspectRatio: "694 / 800",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  background: "transparent",
                  appearance: "none",
                  WebkitAppearance: "none",
                  cursor: "zoom-in",
                }}
                aria-label="View larger"
              >
                {/* Individual CSS tilt. scale(0.92) leaves headroom so the
                    rotated corners don't clip neighbors; contain avoids crop. */}
                <img
                  src={src}
                  alt={caption || "Oil rig at sunset"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    transform: `rotate(${tilt}deg) scale(0.92)`,
                    transformOrigin: "center",
                  }}
                />
              </button>
              {caption && (
                <div style={{
                  padding: "6px 4px",
                  fontSize: 10,
                  fontStyle: "italic",
                  color: theme.muted,
                  letterSpacing: "0.04em",
                  lineHeight: 1.5,
                  textAlign: "center",
                }}>
                  {caption}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Rules */}
        <div style={{
          marginBottom: 24,
          padding: isMobile ? 14 : 18,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          background: "rgba(20, 12, 28, 0.55)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          color: "#e8dcc8",
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 10,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            RULES
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 11,
            color: theme.text,
            lineHeight: 1.8,
          }}>
            <li>Hold at least ${QUALIFICATION_THRESHOLD} USD worth of RL80 tokens and follow @rl80token on X to qualify. You never spend the tokens — holding is the ticket.</li>
            <li>Balance snapshots verify holdings on-chain. You&apos;re only disqualified by <em>selling</em> below your entry position — a price dip never disqualifies you.</li>
            <li>Fixed {GRID_SIZE}x{GRID_SIZE} grid ({GRID_SIZE * GRID_SIZE} plots). Pick your plot when you register. First come, first served.</li>
            <li>Your rig drills automatically, 24/7 — no clicking. It strikes at random, unpredictable times, pacing through 10 base layers over the season. Refer friends for up to 10 bonus layers (max depth: 20) — deeper usually means richer.</li>
            <li>Claim jumping: move to an unclaimed plot mid-season. First 2 jumps free, then each jump costs 1 bonus drill.</li>
            <li>Referrals: share your referral link. When a new player qualifies and claims a plot, you earn +{REFERRAL_BONUS} bonus drills (capped at {MAX_BONUS_DRILLS}).</li>
            <li>The map is seeded by a future Base block hash nobody can predict — not even us — and revealed for public verification when the season ends. ${prizePool} USDC prize pool.</li>
          </ul>
        </div>

        {/* RL80 Price Info */}
        {rl80Price != null && (
          <div style={{
            marginBottom: 24,
            padding: 14,
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            textAlign: "center",
            background: "rgba(20, 12, 28, 0.55)",
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
            color: "#e8dcc8",
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: theme.muted, marginBottom: 4 }}>
              CURRENT RL80 PRICE
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.gold }}>
              ${formatRl80Price(rl80Price)}
            </div>
            <div style={{ fontSize: 9, color: theme.muted, marginTop: 2 }}>
              via Uniswap V2 on Base
            </div>
            <button
              onClick={() => setShowBuyModal(true)}
              style={{
                marginTop: 10,
                padding: "6px 14px",
                background: "rgba(0, 82, 255, 0.12)",
                border: "1px solid rgba(0, 82, 255, 0.35)",
                borderRadius: 3,
                color: theme.textStrong,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                letterSpacing: "0.15em",
                cursor: "pointer",
              }}
            >
              BUY RL80 ON COINBASE →
            </button>
          </div>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <div style={{
            marginTop: 8,
            padding: 16,
            border: "1px solid rgba(160,48,48,0.3)",
            borderRadius: 4,
            background: "rgba(160,48,48,0.04)",
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: theme.muted,
              marginBottom: 12,
              paddingBottom: 6,
              borderBottom: `1px solid ${theme.border}`,
            }}>
              ADMIN CONTROLS
            </div>

            {/* Fairness console — run COMMIT (with a lead sized to the season
                start) from right here during registration; the anchor countdown
                section above goes live the moment it lands. */}
            <div style={{ marginBottom: 16, background: "rgba(20, 12, 28, 0.55)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)", borderRadius: 4, overflow: "hidden" }}>
              <OilAdminGuide />
              <OilVerifyPanel adminPassword={adminPassword} />
            </div>

            {/* Run Snapshot */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={handleRunSnapshot}
                disabled={snapshotRunning}
                style={{
                  width: "100%",
                  padding: "10px 20px",
                  background: snapshotRunning ? theme.barBg : "rgba(160,48,48,0.15)",
                  border: "1px solid rgba(160,48,48,0.3)",
                  borderRadius: 3,
                  color: snapshotRunning ? theme.muted : theme.textStrong,
                  fontFamily: mono,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  cursor: snapshotRunning ? "default" : "pointer",
                }}
              >
                {snapshotRunning ? "RUNNING SNAPSHOT..." : "RUN QUALIFICATION SNAPSHOT"}
              </button>

              {snapshotResult && (
                <div style={{
                  marginTop: 8,
                  padding: 10,
                  border: `1px solid ${snapshotResult.error ? theme.red : theme.green}30`,
                  borderRadius: 3,
                  fontSize: 10,
                  color: snapshotResult.error ? theme.red : theme.green,
                  background: `${snapshotResult.error ? theme.red : theme.green}08`,
                }}>
                  {snapshotResult.error
                    ? `Error: ${snapshotResult.error}`
                    : `Snapshot complete: ${snapshotResult.qualifiedCount}/${snapshotResult.totalChecked} qualified at $${formatRl80Price(snapshotResult.price)}/RL80`}
                </div>
              )}

              {lastSnapshot && (
                <div style={{ fontSize: 9, color: theme.muted, marginTop: 6 }}>
                  Last snapshot: {lastSnapshot.qualifiedCount}/{lastSnapshot.totalChecked} qualified
                  {lastSnapshot.timestamp?.toDate && (
                    <> — {lastSnapshot.timestamp.toDate().toLocaleString()}</>
                  )}
                </div>
              )}
            </div>

            {/* Game Start Date */}
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: theme.muted, marginBottom: 6 }}>
                GAME START DATE
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="date"
                  onChange={(e) => saveGameSettings({ gameStartDate: e.target.value })}
                  style={{
                    padding: "6px 10px", background: theme.inputBg, border: `1px solid ${theme.border}`,
                    borderRadius: 3, color: theme.textStrong, fontFamily: mono, fontSize: 11, outline: "none",
                  }}
                />
                <button
                  onClick={() => saveGameSettings({ gameStartDate: new Date().toISOString().slice(0, 10) })}
                  style={{
                    padding: "6px 12px", border: `1px solid ${theme.border}`, borderRadius: 3,
                    fontFamily: mono, fontSize: 9, cursor: "pointer", background: "rgba(160,48,48,0.15)",
                    color: theme.textStrong,
                  }}
                >
                  START NOW
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: theme.muted, marginBottom: 6 }}>
                PHASE OVERRIDE
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["registration", "active", "ended"].map((phase) => (
                  <button
                    key={phase}
                    onClick={() => saveGameSettings({ gamePhase: phase })}
                    style={{
                      padding: "4px 10px",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 3,
                      fontFamily: mono,
                      fontSize: 9,
                      cursor: "pointer",
                      background: "transparent",
                      color: theme.muted,
                    }}
                  >
                    {phase.toUpperCase().replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: "center",
          padding: "24px 0 60px",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: theme.muted,
        }}>
          HAIL MARY PROSPECTING CO. — ALL RIGHTS RESERVED
        </div>
      </div>

      {/* Bottom Mobile Nav — same layout as /hailmary game page:
          hide music/wallet/menu, add HOME via extraLeft. */}
      {isMobile && <MobileBottomNav
        isPlaying={contextIsPlaying}
        onPlayMusic={() => play()}
        onStopMusic={() => pause()}
        onSkipTrack={() => nextTrack()}
        hideMenu
        hideMusicOnMobile
        hideWallet
        onUserClick={() => {}}
        isUserSignedIn={!!user}
        userImage={user?.imageUrl}
        onBuyClick={() => setShowBuyModal(true)}
        isMobile={isMobile}
        show80sButton={false}
        darkMode
        extraLeft={[{
          key: "home",
          label: "HOME",
          title: "Return to shrine",
          onClick: () => { window.location.href = "/"; },
          icon: <img src="/brand-mark-mono.svg" alt="" width="24" height="24" style={{ display: "block" }} />,
        }]}
      />}

      {/* Buy Modal */}
      <BuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      {/* Image lightbox — click outside or Esc to close */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "zoom-out",
            padding: 24,
          }}
        >
          <img
            src={lightboxSrc}
            alt="Oil rig at sunset"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "min(95vw, 1400px)",
              maxHeight: "88vh",
              objectFit: "contain",
              borderRadius: 4,
              boxShadow: "0 30px 80px rgba(0, 0, 0, 0.6)",
              cursor: "default",
              // Keep the same slight tilt as the thumbnail.
              transform: `rotate(${polaroidTilt(lightboxSrc)}deg)`,
              transformOrigin: "center",
            }}
          />
        </div>
      )}

      {/* CyberNav Menu Panel */}
      <CyberNav
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />
      </div>
    </div>
  );
}
