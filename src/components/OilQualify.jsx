"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ShaderText from "@/components/ShaderText";
import NoiseBackground from "@/components/NoiseBackground";
import { SignInButton } from "@clerk/nextjs";
import { WalletConnectionModal } from "@/components/WalletConnectionModal";
import NavControlsHome from "@/components/NavControlsHome";
import MobileBottomNav from "@/components/MobileBottomNav";
import BuyModal from "@/components/BuyModal";
import CyberNav from "@/components/CyberNav";
import { useMusic } from "@/components/MusicContext";
import { db, collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc, serverTimestamp, arrayUnion, increment } from "@/lib/firebaseClient";

const QUALIFICATION_THRESHOLD = 20; // $20 USD worth of RL80
const GRID_SIZE = 10; // Fixed 10x10 grid
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

export default function OilQualify({
  theme: themeProp,
  darkMode,
  isMobile,
  user,
  isAdmin,
  saveGameSettings,
  walletAddress,
  tokenBalance,
  isWalletConnected,
  storedRef,
}) {
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
  const [xIdentityVerified, setXIdentityVerified] = useState(false); // true when X username comes from Clerk OAuth
  const [allPlots, setAllPlots] = useState({}); // oilPlots collection: { "col_row": { ... } }
  const [claiming, setClaiming] = useState(false);
  const [shareNote, setShareNote] = useState(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const certRef = useRef(null);
  const [signatureName, setSignatureName] = useState("");

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  // Pre-fill signature once user loads
  useEffect(() => {
    if (user && !signatureName) {
      setSignatureName("dev team");
    }
  }, [user]);

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

  // Check X follow via live API — triggered by button click
  const handleCheckFollow = useCallback(() => {
    const clean = xUsername.trim().replace(/^@/, "").toLowerCase();
    if (!clean) return;
    setXCheckingFollow(true);
    setXFollowVerified(false);
    fetch(`/api/check-follow?username=${encodeURIComponent(clean)}`)
      .then((r) => r.json())
      .then((data) => {
        setXFollowVerified(!!data.follows);
        setXCheckingFollow(false);
      })
      .catch(() => {
        setXFollowVerified(false);
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
      // Check if this X username is already claimed by another player
      const clean = xUsername.trim().replace(/^@/, "").toLowerCase();
      const taken = players.find((p) => p.xUsername === clean && p.id !== user.id);
      if (taken) {
        setError("This X username is already registered by another player.");
        setRegistering(false);
        return;
      }
      await setDoc(doc(db, "oilQualified", user.id), {
        userId: user.id,
        clerkName: user.fullName || user.firstName || "Anonymous",
        clerkAvatar: user.imageUrl || null,
        walletAddress,
        xUsername: xUsername.trim().replace(/^@/, "").toLowerCase(),
        registeredAt: serverTimestamp(),
        qualified: liveCheck?.qualified || false,
        lastSnapshotBalance: liveCheck?.balance || "0",
        lastSnapshotUsdValue: liveCheck?.usdValue || 0,
        lastSnapshotAt: serverTimestamp(),
        plotCol: null,
        plotRow: null,
        pickedAt: null,
      });
      setSuccess("Registration confirmed!");
    } catch (err) {
      setError(err.message);
    } finally {
      setRegistering(false);
    }
  }, [user, walletAddress, liveCheck, xFollowVerified, xUsername]);

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

  // Claim a plot on the inline 10x10 grid (merged into registration flow)
  const handleClaimPlot = useCallback(async (col, row) => {
    if (!user || !db || claiming) return;
    const key = `${col}_${row}`;
    const existing = allPlots[key];
    if (existing?.currentOwnerId) return; // already claimed
    setClaiming(true);
    setError(null);
    try {
      // Generate default referral code (first 8 chars of wallet address)
      const defaultRefCode = walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user.id.slice(0, 8);

      // 1. Write oilPlots/{col_row}
      await setDoc(doc(db, "oilPlots", key), {
        col,
        row,
        drillDay: existing?.drillDay ?? 0,
        currentOwnerId: user.id,
        ownerHistory: arrayUnion({ userId: user.id, claimedAt: new Date().toISOString() }),
        disqualified: false,
      }, { merge: true });
      // 2. Write oilDrills/{userId}
      await setDoc(doc(db, "oilDrills", user.id), {
        userId: user.id,
        col,
        row,
        drillDay: 0,
        lastDrillDate: null,
        claimJumpsUsed: 0,
        totalCollected: 0,
        tankDrains: 0,
        lastDrainExtracted: 0,
        bonusDrills: 0,
        confirmedReferrals: 0,
        referralCode: defaultRefCode,
        username: user.fullName || user.firstName || "",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // 3. Create oilReferrals/{code} for this player's referral code
      await setDoc(doc(db, "oilReferrals", defaultRefCode), {
        userId: user.id,
        code: defaultRefCode,
        createdAt: serverTimestamp(),
      });
      // 4. Update oilQualified/{userId} with referredBy
      const refCode = storedRef || (typeof window !== "undefined" ? localStorage.getItem("oil_ref") : null);
      await setDoc(doc(db, "oilQualified", user.id), {
        plotCol: col,
        plotRow: row,
        pickedAt: serverTimestamp(),
        referredBy: refCode || null,
      }, { merge: true });
      // 5. Credit the referrer if valid
      if (refCode) {
        try {
          const refDocSnap = await getDoc(doc(db, "oilReferrals", refCode));
          if (refDocSnap.exists()) {
            const referrerId = refDocSnap.data().userId;
            // Validate: not self-referral
            if (referrerId && referrerId !== user.id) {
              const referrerDrillSnap = await getDoc(doc(db, "oilDrills", referrerId));
              if (referrerDrillSnap.exists()) {
                const referrerData = referrerDrillSnap.data();
                const currentBonus = referrerData.bonusDrills || 0;
                const bonusToAdd = Math.min(REFERRAL_BONUS, MAX_BONUS_DRILLS - currentBonus);
                if (bonusToAdd > 0) {
                  await updateDoc(doc(db, "oilDrills", referrerId), {
                    bonusDrills: increment(bonusToAdd),
                    confirmedReferrals: increment(1),
                    updatedAt: serverTimestamp(),
                  });
                }
              }
            }
          }
          // Clear localStorage after crediting
          if (typeof window !== "undefined") localStorage.removeItem("oil_ref");
        } catch (refErr) {
          console.error("Failed to credit referrer:", refErr);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  }, [user, allPlots, claiming, walletAddress, storedRef]);

  // Release current plot so user can pick a different one
  const [releasing, setReleasing] = useState(false);
  const handleReleasePlot = useCallback(async () => {
    if (!user || !db || !userPlotEntry) return;
    setReleasing(true);
    setError(null);
    try {
      const plotKey = `${userPlotEntry.col}_${userPlotEntry.row}`;
      // Release the plot
      await setDoc(doc(db, "oilPlots", plotKey), {
        currentOwnerId: null,
        ownerHistory: arrayUnion({ userId: user.id, releasedAt: new Date().toISOString(), reason: "voluntary" }),
      }, { merge: true });
      // Clear col/row in oilDrills
      await setDoc(doc(db, "oilDrills", user.id), {
        col: null,
        row: null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Clear in oilQualified
      await setDoc(doc(db, "oilQualified", user.id), {
        plotCol: null,
        plotRow: null,
        pickedAt: null,
      }, { merge: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setReleasing(false);
    }
  }, [user, userPlotEntry]);

  const mono = "'Share Tech Mono', monospace";

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
            <img src="/brand-mark-mono.svg" alt="Home" width="24" height="24" style={{ display: "block" }} />
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
            fontSize: isMobile ? 12 : 14,
            letterSpacing: "0.35em",
            color: theme.gold,
          }}>
            PLAYER QUALIFICATION
          </div>
          <div style={{
            fontSize: 10,
            color: theme.text,
            marginTop: 8,
            letterSpacing: "0.1em",
          }}>
            HOLD ${QUALIFICATION_THRESHOLD}+ USD OF RL80 & FOLLOW @RL80TOKEN
          </div>
        </div>

        {/* Hero image — Claim Certificate with dynamic fields */}
        <div ref={certRef} style={{
          margin: "20px auto 0",
          maxWidth: 480,
          position: "relative",
          borderRadius: 4,
          overflow: "hidden",
        }}>
          <img src="/ClaimCertificate.webp" alt="Claim Certificate" style={{ width: "100%", display: "block" }} />
          {/* Dynamic field overlays — fill in progressively as the user advances
              through the funnel (sign in → register → claim plot). Each field
              renders independently so the certificate previews what a completed
              claim will look like, as enticement. */}
          {(() => {
            const certFont = "'Share Tech Mono', monospace";
            const inkColor = "#3a2a18";
            const placeholderColor = "rgba(58, 42, 24, 0.32)";
            const rot = "rotate(-5.5deg)";
            const fieldStyle = {
              position: "absolute",
              fontFamily: certFont,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              transform: rot,
            };
            const claimId = walletAddress
              ? walletAddress.slice(0, 10).toUpperCase()
              : user?.id
              ? user.id.slice(0, 10).toUpperCase()
              : null;
            const grantedTo = user?.fullName || user?.firstName || (user ? "Anonymous" : null);
            const plotCol = userPlotEntry?.col ?? userPlayer?.plotCol;
            const plotRow = userPlotEntry?.row ?? userPlayer?.plotRow;
            const hasPlot = plotCol != null && plotRow != null;
            const pickedRaw = userPlayer?.pickedAt;
            const claimDate = pickedRaw?.toDate?.()
              ? pickedRaw.toDate()
              : pickedRaw?.seconds
              ? new Date(pickedRaw.seconds * 1000)
              : new Date(); // default to today as a preview before the plot is locked in
            const dateStr = claimDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
            return (
              <>
                <div style={{ ...fieldStyle, top: "52%", left: "50%", fontSize: isMobile ? "2.8vw" : 14, fontWeight: 700, color: claimId ? inkColor : placeholderColor }}>
                  {claimId || "[ CLAIM ID ]"}
                </div>
                <div style={{ ...fieldStyle, top: "60%", left: "60%", fontSize: isMobile ? "2.8vw" : 14, fontWeight: 700, color: hasPlot ? inkColor : placeholderColor }}>
                  {hasPlot ? `(${plotCol}, ${plotRow})` : "( COL , ROW )"}
                </div>
                <div style={{ ...fieldStyle, top: "69%", left: "60%", fontSize: isMobile ? "2.8vw" : 14, fontWeight: 700, color: grantedTo ? inkColor : placeholderColor }}>
                  {grantedTo || "[ YOUR NAME ]"}
                </div>
                <div style={{ ...fieldStyle, top: "83%", left: "40%", fontSize: isMobile ? "2.4vw" : 12, fontWeight: 700, color: pickedRaw ? inkColor : placeholderColor }}>
                  {dateStr}
                </div>
                {signatureName && (
                  <div style={{
                    position: "absolute",
                    top: "80%",
                    right: "15%",
                    fontFamily: "'Permanent Marker', cursive",
                    fontSize: isMobile ? "3.5vw" : 18,
                    color: inkColor,
                    pointerEvents: "none",
                    transform: rot,
                    opacity: 0.85,
                    whiteSpace: "nowrap",
                  }}>
                    {signatureName}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Signature Field — shown when user has claimed a plot */}
        {userPlayer && userHasPlot && (
          <div style={{
            margin: "16px auto 0",
            maxWidth: 480,
            padding: "12px 16px",
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            background: "rgba(20, 12, 28, 0.55)",
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", color: theme.gold, fontWeight: 700, marginBottom: 8 }}>
              SIGN YOUR CLAIM
            </div>
            <div style={{
              position: "relative",
              borderRadius: 3,
              overflow: "hidden",
              border: `1px solid ${signatureName ? theme.green + "44" : theme.border}`,
              background: "rgba(245, 239, 230, 0.92)",
            }}>
              <style>{`.oil-sig-input::placeholder { color: rgba(58, 42, 24, 0.3); font-family: 'Permanent Marker', cursive; }`}</style>
              <input
                className="oil-sig-input"
                type="text"
                placeholder="Type your name to sign"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                maxLength={30}
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "'Permanent Marker', cursive",
                  fontSize: 22,
                  color: "#3a2a18",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {signatureName && (
              <div style={{ fontSize: 9, color: theme.green, marginTop: 6, textAlign: "center" }}>
                Signature applied to certificate above
              </div>
            )}
          </div>
        )}

        {/* Share buttons — only when certificate has data */}
        {userPlayer && userHasPlot && (
          <div style={{ margin: "12px auto 0", maxWidth: 480, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {/* Share on X — copies PNG to clipboard, then opens Twitter compose */}
            <button
              onClick={async () => {
                try {
                  setShareNote("Capturing image...");
                  const { default: html2canvas } = await import("html2canvas");
                  const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: null, useCORS: true });

                  // Re-draw onto a fresh canvas to get a clean PNG blob (same pattern as PolaroidSnapshot)
                  const img = new Image();
                  img.src = canvas.toDataURL("image/png");
                  await new Promise((r) => { img.onload = r; img.onerror = r; });
                  const c = document.createElement("canvas");
                  c.width = img.width; c.height = img.height;
                  c.getContext("2d").drawImage(img, 0, 0);
                  const pngBlob = await new Promise((r) => c.toBlob(r, "image/png"));

                  let clipboardOk = false;
                  if (pngBlob && navigator.clipboard && window.ClipboardItem) {
                    try {
                      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
                      clipboardOk = true;
                    } catch (clipErr) {
                      console.error("Clipboard copy failed:", clipErr);
                    }
                  }

                  if (clipboardOk) {
                    setShareNote("Image copied! Press Cmd+V (or Ctrl+V) to paste it into your tweet");
                    await new Promise((r) => setTimeout(r, 1500));
                  }

                  const refCode = walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user?.id?.slice(0, 8);
                  const text = `I just staked my claim at Hail Mary Prospecting Co.\n\nrl80.xyz/oil?ref=${refCode}`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=550,height=420");
                  setTimeout(() => setShareNote(null), 5000);
                } catch (err) { console.error("Share failed:", err); }
              }}
              style={{
                padding: "8px 16px",
                background: `${theme.gold}22`,
                border: `1px solid ${theme.gold}`,
                borderRadius: 3,
                color: theme.gold,
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              SHARE ON X
            </button>
            {/* Copy image as PNG */}
            <button
              onClick={async () => {
                try {
                  setShareNote("Copying...");
                  const { default: html2canvas } = await import("html2canvas");
                  const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: null, useCORS: true });
                  const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
                  if (pngBlob && navigator.clipboard && window.ClipboardItem) {
                    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
                    setShareNote("Copied to clipboard!");
                  }
                  setTimeout(() => setShareNote(null), 3000);
                } catch (err) { console.error("Copy failed:", err); }
              }}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: `1px solid ${theme.border}`,
                borderRadius: 3,
                color: theme.muted,
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              COPY IMAGE
            </button>
            {/* Download */}
            <button
              onClick={async () => {
                try {
                  const { default: html2canvas } = await import("html2canvas");
                  const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: null, useCORS: true });
                  const link = document.createElement("a");
                  link.download = "hail-mary-claim.png";
                  link.href = canvas.toDataURL("image/png");
                  link.click();
                  setShareNote("Downloaded!");
                  setTimeout(() => setShareNote(null), 3000);
                } catch (err) { console.error("Download failed:", err); }
              }}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: `1px solid ${theme.border}`,
                borderRadius: 3,
                color: theme.muted,
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              DOWNLOAD
            </button>
            {/* Mobile native share */}
            {typeof navigator !== "undefined" && navigator.share && (
              <button
                onClick={async () => {
                  try {
                    const { default: html2canvas } = await import("html2canvas");
                    const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: null, useCORS: true });
                    const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
                    if (!pngBlob) return;
                    const file = new File([pngBlob], "hail-mary-claim.png", { type: "image/png" });
                    const refCode = walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user?.id?.slice(0, 8);
                    await navigator.share({
                      title: "Hail Mary Prospecting Co.",
                      text: `I just staked my claim! Join me: rl80.xyz/oil?ref=${refCode}`,
                      files: [file],
                    });
                  } catch (err) {
                    if (err.name !== "AbortError") console.error("Share failed:", err);
                  }
                }}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  color: theme.muted,
                  fontFamily: mono,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                SHARE
              </button>
            )}
            {shareNote && (
              <div style={{ width: "100%", textAlign: "center", fontSize: 10, color: theme.green, marginTop: 4 }}>
                {shareNote}
              </div>
            )}
          </div>
        )}

        {/* Sign-in / user badge */}
        <div style={{ marginTop: 20 }}>
          {!user ? (
            <SignInButton mode="modal" forceRedirectUrl="/oil">
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
          <div style={{
            fontSize: isMobile ? 52 : 72,
            fontWeight: 700,
            color: theme.gold,
            lineHeight: 1,
          }}>
            {qualifiedPlayers.length}
          </div>
          <div style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: theme.muted,
            marginTop: 8,
          }}>
            QUALIFIED PLAYERS
          </div>
          <div style={{
            fontSize: 10,
            color: theme.muted,
            marginTop: 4,
          }}>
            {players.length} registered total
          </div>

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
              {GRID_SIZE * GRID_SIZE} PLOTS &mdash; $500 USDC PRIZE POOL
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
              { step: "01", title: "HOLD RL80 & FOLLOW", desc: `Hold at least $${QUALIFICATION_THRESHOLD} USD worth of RL80 tokens and follow @rl80token on X.` },
              { step: "02", title: "REGISTER & PICK YOUR PLOT", desc: "Connect your wallet, verify your X follow, register, then pick a plot on the 10x10 grid. First come, first served." },
              { step: "03", title: "DRILL FOR OIL", desc: "Each day 1 new layer unlocks to drill. Click to drill each layer. Refer friends for bonus depth (up to +10 layers). Max depth: 20." },
              { step: "04", title: "CLAIM JUMP", desc: "Move to a different unclaimed plot. First 2 jumps are free, each jump after costs 1 bonus drill." },
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

        {/* Brochure Images */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}>
          {["/plotPic5.webp", "/plotPic7.webp"].map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setLightboxSrc(src)}
              style={{
                aspectRatio: "4 / 3",
                borderRadius: 4,
                border: `2px solid ${theme.gold}`,
                background: `linear-gradient(160deg, ${theme.gold}06, transparent)`,
                overflow: "hidden",
                padding: 0,
                cursor: "zoom-in",
              }}
              aria-label="View larger"
            >
              <img src={src} alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
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

          {/* Secondary CTA — prospects who haven't signed up yet can peek inside.
              Plain <a> (not next/link) so we force a full nav: OilPage stays
              mounted on client-side routes to itself and its one-shot effect
              wouldn't re-read ?preview=1. */}
          <a
            href="/oil?preview=1"
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
              <SignInButton mode="modal" forceRedirectUrl="/oil">
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
            </div>
          ) : (
            <div style={{
              padding: isMobile ? 14 : 20,
              border: `1px solid ${theme.border}`,
              borderRadius: 4,
              background: theme.panelBg,
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
                          onChange={(e) => setXUsername(e.target.value)}
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
                      <div style={{ fontSize: 10, marginTop: 6, color: theme.muted }}>
                        Enter your X username and click VERIFY
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

        {/* Inline Plot Grid — shown after registration, before plot is picked */}
        {userRegistered && userPlayer?.qualified && !userHasPlot && (
          <div style={{
            marginBottom: 24,
            padding: isMobile ? 16 : 20,
            border: `1px solid ${theme.gold}44`,
            borderRadius: 4,
            background: `${theme.gold}06`,
          }}>
            <div style={{
              fontSize: 12,
              letterSpacing: "0.15em",
              color: theme.green,
              marginBottom: 4,
              fontWeight: 700,
              textAlign: "center",
            }}>
              YOU ARE QUALIFIED — PICK YOUR PLOT
            </div>
            <div style={{
              fontSize: 10,
              color: theme.muted,
              marginBottom: 14,
              textAlign: "center",
            }}>
              Click any available cell on the {GRID_SIZE}x{GRID_SIZE} grid to claim it
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gap: 2,
              width: "100%",
              maxWidth: isMobile ? "100%" : 500,
              margin: "0 auto",
            }}>
              {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
                const col = i % GRID_SIZE;
                const row = Math.floor(i / GRID_SIZE);
                const key = `${col}_${row}`;
                const plotData = allPlots[key];
                const taken = plotData?.currentOwnerId != null;
                const isDQ = plotData?.disqualified;
                const canPick = !taken && !claiming;

                return (
                  <div
                    key={key}
                    onClick={() => canPick && handleClaimPlot(col, row)}
                    style={{
                      aspectRatio: "1",
                      border: `1px solid ${taken ? theme.border : theme.gold}44`,
                      borderRadius: 2,
                      background: taken
                        ? `${theme.muted}15`
                        : isDQ
                        ? `${theme.warn}15`
                        : canPick
                        ? `${theme.gold}12`
                        : "transparent",
                      cursor: canPick ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: isMobile ? 7 : 9,
                      color: taken ? theme.muted : theme.borderLight,
                      transition: "background 0.15s",
                    }}
                    title={taken ? "Claimed" : isDQ ? `Pre-drilled (depth ${plotData?.drillDay || 0})` : `(${col}, ${row})`}
                  >
                    {taken ? (
                      <span style={{ fontSize: isMobile ? 8 : 10, color: theme.muted }}>&#9632;</span>
                    ) : isDQ && plotData?.drillDay > 0 ? (
                      <span style={{ fontSize: isMobile ? 6 : 8, color: theme.warn }}>D{plotData.drillDay}</span>
                    ) : (
                      <span>{col},{row}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              fontSize: 10,
              color: theme.muted,
              marginTop: 10,
            }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: `${theme.gold}30`, marginRight: 4, verticalAlign: "middle" }} /> Available</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: `${theme.muted}30`, marginRight: 4, verticalAlign: "middle" }} /> Taken</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: `${theme.warn}30`, marginRight: 4, verticalAlign: "middle" }} /> Pre-drilled</span>
            </div>
            {error && (
              <div style={{ color: theme.red, fontSize: 11, textAlign: "center", marginTop: 8 }}>
                {error}
              </div>
            )}
          </div>
        )}

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
              PLOT CLAIMED — ({userPlotEntry?.col}, {userPlotEntry?.row})
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
                  rl80.xyz/oil?ref={walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user?.id?.slice(0, 8)}
                </span>
                <button
                  onClick={() => {
                    const code = walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user?.id?.slice(0, 8);
                    navigator.clipboard.writeText(`https://rl80.xyz/oil?ref=${code}`);
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
            { label: "PRIZE POOL", value: "$500 USDC", sub: "Hidden underground" },
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

        {/* Panorama image */}
        <div style={{
          marginBottom: 24,
          borderRadius: 4,
          border: `2px solid ${theme.gold}`,
          background: `linear-gradient(170deg, ${theme.gold}05, ${theme.gold}0a, ${theme.gold}03)`,
          display: "flex",
          // alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}>
          <div style={{ textAlign: "center" }}>
            {/* <div style={{ fontSize: 32, opacity: 0.12 }}>&#127956;</div> */}
            {/* <div style={{ fontSize: 8, letterSpacing: "0.15em", color: theme.muted, marginTop: 4 }}> */}
              <img src="/moneyShot.png" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            {/* </div> */}
          </div>
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
            <li>Hold at least ${QUALIFICATION_THRESHOLD} USD worth of RL80 tokens and follow @rl80token on X to qualify.</li>
            <li>Admin runs snapshots to verify token balances on-chain. Drop below threshold = disqualified, plot released.</li>
            <li>Fixed {GRID_SIZE}x{GRID_SIZE} grid (100 plots). Pick your plot when you register. First come, first served.</li>
            <li>Each day, 1 new layer unlocks to drill (10 passive over the contest). Click to drill each layer. Refer friends for up to 10 bonus layers (max depth: 20).</li>
            <li>Claim jumping: move to an unclaimed plot. First 2 jumps free, then each jump costs 1 bonus drill.</li>
            <li>Referrals: share your referral link. When a new player qualifies and claims a plot, you earn +3 bonus drills (capped at 10).</li>
            <li>Oil distribution is seeded by a verifiable on-chain block hash. $500 USDC prize pool.</li>
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
                {["ticket_sale", "active", "ended"].map((phase) => (
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

      {/* Bottom Mobile Nav — same layout as /oil game page:
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
              maxHeight: "92vh",
              objectFit: "contain",
              borderRadius: 4,
              boxShadow: "0 30px 80px rgba(0, 0, 0, 0.6)",
              cursor: "default",
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
