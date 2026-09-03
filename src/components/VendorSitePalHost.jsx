"use client";

import { useEffect, useRef, useState } from "react";
import { isTouchDevice } from "@/lib/deviceTier";
import {
  VENDOR_SITEPAL_CONTAINER_ID,
  VENDOR_SITEPAL_ACCOUNT,
  VENDOR_SITEPAL_EMBED_PARAMS,
  FORTUNES_SITEPAL_CROP,
  FORTUNES_SITEPAL_FILTER,
  TONICS_SITEPAL_CROP,
  TONICS_SITEPAL_FILTER,
  HOTDOGS_SITEPAL_CROP,
  HOTDOGS_SITEPAL_FILTER,
  PROMOS_SITEPAL_CROP,
  PROMOS_SITEPAL_FILTER,
  RUGS_SITEPAL_CROP,
  RUGS_SITEPAL_FILTER,
  TACOS_SITEPAL_CROP,
  TACOS_SITEPAL_FILTER,
  CARNY_SITEPAL_CROP,
  CARNY_SITEPAL_FILTER,
  TATTOOS_IDLE_SITEPAL_CROP,
  TATTOOS_IDLE_SITEPAL_FILTER,
  TATTOOS_SEATED_SITEPAL_CROP,
  TATTOOS_SEATED_SITEPAL_FILTER,
  VENDOR_SITEPAL_CONFIG,
  SKIN_SAMPLE_DEFAULT,
  speakPendingVendorLine,
  getVendorSitePalSource,
  notifyVendorTalk,
} from "@/lib/vendorSitePal";

// Vendor tabs for the crop tuner. constName is used by the "Log values"
// output so the pasted block lands on the right export in vendorSitePal.js.
// `sitepalId` is the VENDOR_SITEPAL_CONFIG key — normally the same as the tab
// key, but the tattoo artist gets one tab per POSE while remaining a single
// sitepal vendor, so those two tabs both point at "tattoos".
const TUNER_VENDORS = {
  fortunes: { label: "FORTUNE", crop: FORTUNES_SITEPAL_CROP, filter: FORTUNES_SITEPAL_FILTER, constName: "FORTUNES" },
  tonics: { label: "SALESMAN", crop: TONICS_SITEPAL_CROP, filter: TONICS_SITEPAL_FILTER, constName: "TONICS" },
  hotdogs: { label: "HOT DOG", crop: HOTDOGS_SITEPAL_CROP, filter: HOTDOGS_SITEPAL_FILTER, constName: "HOTDOGS" },
  promos: { label: "PROMOS", crop: PROMOS_SITEPAL_CROP, filter: PROMOS_SITEPAL_FILTER, constName: "PROMOS" },
  rugs: { label: "RUGS", crop: RUGS_SITEPAL_CROP, filter: RUGS_SITEPAL_FILTER, constName: "RUGS" },
  tacos: { label: "TACOS", crop: TACOS_SITEPAL_CROP, filter: TACOS_SITEPAL_FILTER, constName: "TACOS" },
  carny: { label: "CARNY", crop: CARNY_SITEPAL_CROP, filter: CARNY_SITEPAL_FILTER, constName: "CARNY" },
  // Two poses, two crop sets. Only the pose this page load DREW is on screen —
  // pin it with ?pose=idle / ?pose=tattooing or you are tuning a set nothing is
  // currently using.
  tattoos_idle: { label: "TAT STAND", crop: TATTOOS_IDLE_SITEPAL_CROP, filter: TATTOOS_IDLE_SITEPAL_FILTER, constName: "TATTOOS_IDLE", sitepalId: "tattoos" },
  tattoos_seated: { label: "TAT SIT", crop: TATTOOS_SEATED_SITEPAL_CROP, filter: TATTOOS_SEATED_SITEPAL_FILTER, constName: "TATTOOS_SEATED", sitepalId: "tattoos" },
};

// ── Single SitePal host embed for the /hailmary vendor strip ───────────────
// Mounted once at page level (outside the Canvas). CommercialStrip's
// compositor reads the live canvas out of this container every frame and
// crops it onto the focused vendor's face mesh.

// Load the vendor embed script once per page. Patches getContext to force
// preserveDrawingBuffer BEFORE SitePal creates its WebGL canvas — without it
// drawImage(sitepalCanvas, ...) reads blank and the projection is empty.
function loadVendorSitePalScriptOnce(account) {
  if (typeof window === "undefined") return Promise.resolve();
  if (!window.__vendorSitePalScriptPromise) {
    window.__vendorSitePalScriptPromise = new Promise((resolve) => {
      if (!window.__vendorSitePalGetContextPatched) {
        window.__vendorSitePalGetContextPatched = true;
        const orig = HTMLCanvasElement.prototype.getContext;
        window.__vendorSitePalOrigGetContext = orig;
        HTMLCanvasElement.prototype.getContext = function (type, attrs) {
          if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
            attrs = { ...attrs, preserveDrawingBuffer: true };
          }
          return orig.call(this, type, attrs);
        };
        // Un-patch only once the player's canvas actually exists (the embed
        // can boot slowly; a fixed timer un-patched too early and the canvas
        // was then created unreadable — blank projection). 120s backstop.
        const unpatchStart = Date.now();
        const unpatchPoll = setInterval(() => {
          const container = document.getElementById(VENDOR_SITEPAL_CONTAINER_ID);
          const hasCanvas = !!container?.querySelector("canvas");
          if (hasCanvas || Date.now() - unpatchStart > 120000) {
            clearInterval(unpatchPoll);
            if (window.__vendorSitePalOrigGetContext) {
              HTMLCanvasElement.prototype.getContext = window.__vendorSitePalOrigGetContext;
            }
          }
        }, 500);
      }
      const script = document.createElement("script");
      script.src = `//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${account}&js=0`;
      script.type = "text/javascript";
      // Resolve either way — the CALLER decides what to do — but say which
      // happened. A 504 from the CDN fires onerror; a 200 serving an HTML
      // error page fires onload and still defines nothing, so `ok` alone is
      // not enough and the caller re-checks for the global.
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return window.__vendorSitePalScriptPromise;
}

// ── Crop/filter tuner (?tune=vendor) ───────────────────────────────────────
// Shows the hidden SitePal frame with the crop rectangle drawn on it, plus
// sliders that mutate the SAME config objects the compositor reads each
// frame. "Log" prints paste-ready const blocks for vendorSitePal.js.
const TUNER_CROP_FIELDS = [
  ["cropX", 0, 600], ["cropY", 0, 450], ["cropW", 20, 600], ["cropH", 20, 450],
  ["rotateZ", -45, 45], ["rotateX", 0, 60],
];
const TUNER_FILTER_FIELDS = [
  ["saturate", 0, 300], ["contrast", 20, 200], ["brightness", 20, 200],
  ["hueRotate", -180, 180], ["sepia", 0, 100],
];
// Skin-match measurement box, fractions of the crop canvas.
const TUNER_SKIN_FIELDS = [["x", 0, 0.9], ["y", 0, 0.9], ["w", 0.05, 1], ["h", 0.05, 1]];

// Face A/B compare. The SitePal crop is projected onto its OWN mesh (projFace)
// while the painted one (regularFaces[0]) hides, so a crop that is off by a few
// pixels reads as the face JUMPING the instant the projection takes over —
// which is invisible if you only ever see one of the two. These modes pin one
// face down so the camera holds still while you swap between them; blink mode
// does the swapping for you, which is how a small shift becomes obvious.
// CommercialStrip's per-frame compositor reads the global.
const BLINK_MS = 650;

function VendorCropTuner() {
  const previewRef = useRef(null);
  const [vendorKey, setVendorKey] = useState("fortunes");
  const [, force] = useState(0);
  const active = TUNER_VENDORS[vendorKey];
  // "auto" = normal play (projection while focused). "face1" pins the painted
  // mesh, "face2" pins the projection.
  const [faceMode, setFaceMode] = useState("auto");
  const [blink, setBlink] = useState(false);
  // The compositor is per-vendor but only the FOCUSED stall ever projects, so
  // one global is unambiguous. Named for the two meshes rather than for the
  // vendor, because the mesh names are what you read in Blender.
  const sitepalId = active.sitepalId || vendorKey;
  const sitepalCfg = VENDOR_SITEPAL_CONFIG[sitepalId];
  const face1Name = sitepalCfg?.regularFaces?.[0] || "Face1";
  const face2Name = sitepalCfg?.projFace || "Face2";
  // Skin match readout: what the compositor measured on the crop, where it
  // is aiming, and the gain between them (published per frame while the
  // stall projects). Only meaningful for the vendor whose tab is open.
  const [skin, setSkin] = useState(null);
  const skinJsonRef = useRef("");
  // skinTarget is typed freely and applied only once it is a full hex (or
  // cleared, which means "the authored colour").
  const [targetText, setTargetText] = useState(sitepalCfg?.skinTarget || "");
  useEffect(() => { setTargetText(sitepalCfg?.skinTarget || ""); }, [sitepalId]); // eslint-disable-line react-hooks/exhaustive-deps
  const skinBox = sitepalCfg?.skinSample || SKIN_SAMPLE_DEFAULT;
  const editSkinBox = (key, value) => {
    if (!sitepalCfg) return;
    if (!sitepalCfg.skinSample) sitepalCfg.skinSample = { ...SKIN_SAMPLE_DEFAULT };
    sitepalCfg.skinSample[key] = value;
    force((n) => n + 1);
  };

  useEffect(() => {
    // Carries the vendor so the pin lands on the stall whose sliders are live,
    // rather than on whichever one happens to be focused — and so it still
    // works before you have flown in to anything.
    window.__vendorSitePalFaceOverride =
      faceMode === "auto" ? null : { mode: faceMode, vendorId: sitepalId };
    // Clearing on unmount matters: the pin survives a tuner close otherwise,
    // and a pinned face1 looks exactly like SitePal being broken.
    return () => { window.__vendorSitePalFaceOverride = null; };
  }, [faceMode, sitepalId]);

  // Blink comparator. Starting from "auto" it enters on face1 — the painted
  // mesh — so the first swap you see is the one you are tuning INTO.
  useEffect(() => {
    if (!blink) return;
    setFaceMode((m) => (m === "auto" ? "face1" : m));
    const timer = setInterval(
      () => setFaceMode((m) => (m === "face2" ? "face1" : "face2")),
      BLINK_MS
    );
    return () => clearInterval(timer);
  }, [blink]);

  // "f" flips by hand — the same comparison at your own pace, and the one you
  // want while a slider is mid-drag. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      setBlink(false);
      setFaceMode((m) => (m === "face1" ? "face2" : "face1"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const canvas = previewRef.current;
      const source = getVendorSitePalSource();
      if (!canvas || !source) return;
      const ctx = canvas.getContext("2d");
      const sw = source.width || 600;
      const sh = source.height || 450;
      const scale = canvas.width / sw;
      canvas.height = Math.round(sh * scale);
      try {
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const c = TUNER_VENDORS[vendorKey].crop;
      ctx.strokeStyle = "#ff3355";
      ctx.lineWidth = 2;
      ctx.strokeRect(c.cropX * scale, c.cropY * scale, c.cropW * scale, c.cropH * scale);
      // Skin-match box, in blue: the same crop fractions the compositor
      // samples, drawn un-rotated inside the crop rectangle (approximate
      // once rotateZ/rotateX are non-zero, exact otherwise).
      const id = TUNER_VENDORS[vendorKey].sitepalId || vendorKey;
      const box = VENDOR_SITEPAL_CONFIG[id]?.skinSample || SKIN_SAMPLE_DEFAULT;
      ctx.strokeStyle = "#44bbdd";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        (c.cropX + box.x * c.cropW) * scale, (c.cropY + box.y * c.cropH) * scale,
        box.w * c.cropW * scale, box.h * c.cropH * scale
      );
      const sm = window.__vendorSitePalSkinMatch;
      const next = sm && sm.vendorId === id ? sm : null;
      const json = JSON.stringify(next);
      if (json !== skinJsonRef.current) { skinJsonRef.current = json; setSkin(next); }
    }, 120);
    return () => clearInterval(timer);
  }, [vendorKey]);

  const logValues = () => {
    const { crop: c, filter: f, constName } = active;
    const b = skinBox;
    console.log(
      `export const ${constName}_SITEPAL_CROP = {\n  cropX: ${c.cropX},\n  cropY: ${c.cropY},\n  cropW: ${c.cropW},\n  cropH: ${c.cropH},\n  rotateZ: ${c.rotateZ},\n  rotateX: ${c.rotateX},\n};\n` +
      `export const ${constName}_SITEPAL_FILTER = {\n  saturate: ${f.saturate},\n  contrast: ${f.contrast},\n  brightness: ${f.brightness},\n  hueRotate: ${f.hueRotate},\n  sepia: ${f.sepia},\n};\n` +
      `// VENDOR_SITEPAL_CONFIG.${sitepalId} — skin match:\n` +
      `  skinTarget: ${sitepalCfg?.skinTarget ? JSON.stringify(sitepalCfg.skinTarget) : "undefined, // authored Face colour"}\n` +
      `  skinSample: { x: ${b.x}, y: ${b.y}, w: ${b.w}, h: ${b.h} },`
    );
  };

  const slider = (obj, key, min, max) => (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ width: 84 }}>{key}</span>
      <input
        type="range" min={min} max={max} step={1} value={obj[key]}
        onChange={(e) => { obj[key] = Number(e.target.value); force((n) => n + 1); }}
        style={{ flex: 1 }}
      />
      <span style={{ width: 42, textAlign: "right" }}>{obj[key]}</span>
    </label>
  );

  return (
    <div style={{
      position: "fixed", right: 10, bottom: 10, zIndex: 9999, width: 420,
      // The panel grew past a short viewport once there were this many vendors
      // and eleven sliders, so it scrolls rather than running off the screen.
      maxHeight: "calc(100vh - 20px)", overflowY: "auto",
      background: "rgba(16,20,26,0.94)", color: "#cde", padding: 12,
      borderRadius: 8, fontFamily: "monospace", display: "flex",
      flexDirection: "column", gap: 5,
    }}>
      {/* wrap: the row is per-vendor and keeps growing — squeezing six-plus
          labels onto one line made them unreadable */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {Object.entries(TUNER_VENDORS).map(([key, v]) => (
          <button
            key={key}
            onClick={() => setVendorKey(key)}
            style={{
              flex: "1 1 60px", padding: "4px 6px", fontSize: 11, cursor: "pointer",
              background: key === vendorKey ? "#3a4a6a" : "#1a2230",
              color: "#cde", border: "1px solid #3a4a6a", borderRadius: 4,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      {/* Face A/B: which of the two face meshes the FOCUSED stall shows. */}
      <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>
        {[
          ["auto", "AUTO"],
          ["face1", `${face1Name} · mesh`],
          ["face2", `${face2Name} · SitePal`],
        ].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => { setBlink(false); setFaceMode(mode); }}
            style={{
              flex: "1 1 0", padding: "4px 6px", fontSize: 11, cursor: "pointer",
              background: mode === faceMode ? "#6a4a2a" : "#1a2230",
              color: "#cde", border: "1px solid #6a4a2a", borderRadius: 4,
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setBlink((b) => !b)}
          style={{
            flex: "0 0 62px", padding: "4px 6px", fontSize: 11, cursor: "pointer",
            background: blink ? "#6a4a2a" : "#1a2230",
            color: "#cde", border: "1px solid #6a4a2a", borderRadius: 4,
          }}
        >
          BLINK
        </button>
      </div>
      <div style={{ fontSize: 10, opacity: 0.6 }}>
        press f to flip · pins {active.label} — exactly one face mesh is drawn
      </div>
      <canvas ref={previewRef} width={400} height={300} style={{ width: "100%", borderRadius: 4, background: "#222" }} />
      {TUNER_CROP_FIELDS.map(([k, min, max]) => slider(active.crop, k, min, max))}
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        filter <span style={{ opacity: 0.6 }}>· brightness is cancelled by the skin match</span>
      </div>
      {TUNER_FILTER_FIELDS.map(([k, min, max]) => slider(active.filter, k, min, max))}
      {/* Skin match: measured swatch, target swatch, gain. The blue box on the
          preview is the measured region; ?skinmatch=0 shows the lit crop with
          no correction for comparison. */}
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>skin match</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <span style={{ width: 84 }}>measured</span>
        <span title={skin?.measured || ""} style={{ width: 26, height: 16, borderRadius: 3, background: skin?.measured || "transparent", border: "1px solid #3a4a6a" }} />
        <span style={{ width: 84, textAlign: "right" }}>target</span>
        <span title={skin?.target || ""} style={{ width: 26, height: 16, borderRadius: 3, background: skin?.target || "transparent", border: "1px solid #3a4a6a" }} />
        <span style={{ flex: 1, opacity: 0.75, paddingLeft: 6 }}>
          {!skin ? "not projecting"
            : skin.active ? `gain ${skin.gain.map((g) => g.toFixed(2)).join(" · ")}`
            : skin.target ? (skin.measured ? "off" : "measuring…")
            : "no target — set skinTarget"}
        </span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ width: 84 }}>skinTarget</span>
        <input
          type="text" value={targetText} placeholder="authored colour"
          onChange={(e) => {
            const v = e.target.value.trim();
            setTargetText(v);
            if (!sitepalCfg) return;
            if (v === "") sitepalCfg.skinTarget = undefined;
            else if (/^#[0-9a-fA-F]{6}$/.test(v)) sitepalCfg.skinTarget = v;
          }}
          style={{ flex: 1, fontFamily: "monospace", fontSize: 12, background: "#1a2230", color: "#cde", border: "1px solid #3a4a6a", borderRadius: 4, padding: "2px 6px" }}
        />
        <span style={{ width: 42, height: 16, borderRadius: 3, background: skin?.target || "transparent", border: "1px solid #3a4a6a" }} />
      </label>
      {TUNER_SKIN_FIELDS.map(([k, min, max]) => (
        <label key={`skin-${k}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 84 }}>sample {k}</span>
          <input
            type="range" min={min} max={max} step={0.01} value={skinBox[k]}
            onChange={(e) => editSkinBox(k, Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ width: 42, textAlign: "right" }}>{skinBox[k].toFixed(2)}</span>
        </label>
      ))}
      <button onClick={logValues} style={{ marginTop: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
        Log values to console
      </button>
    </div>
  );
}

// The host div lives OUTSIDE React, appended to document.body once per page.
// React remounts (Strict Mode double-mount, HMR) previously destroyed the
// live player mid-boot — and a second AC_VHost_Embed in the same document is
// fatal — so neither the div nor the embed call may belong to the component.
function ensureHostDiv() {
  let el = document.getElementById(VENDOR_SITEPAL_CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = VENDOR_SITEPAL_CONTAINER_ID;
    // ONSCREEN on purpose (left: 0, not -9999px): browsers throttle
    // offscreen WebGL to ~1fps, which freezes the projected face while
    // audio keeps playing. Invisible via opacity, not position.
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "600px",
      height: "800px",
      opacity: "0.01",
      pointerEvents: "none",
      zIndex: "-1",
    });
    document.body.appendChild(el);
  }
  return el;
}

export default function VendorSitePalHost() {
  const [showTuner, setShowTuner] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && /[?&]tune=vendor\b/.test(window.location.search)) {
      setShowTuner(true);
    }
  }, []);

  useEffect(() => {
    // Live crop/filter tuning from the console: edit e.g.
    // __vendorSitePalCrop.cropX = 200 while focused — read every frame.
    window.__vendorSitePalCrop = FORTUNES_SITEPAL_CROP;
    window.__vendorSitePalFilter = FORTUNES_SITEPAL_FILTER;

    // Lifecycle globals. vh_sceneLoaded fires on the initial load AND after
    // every loadSceneByID swap; read getSceneAttributes() rather than
    // trusting the call, because a failed swap silently keeps the old scene.
    window.__vendorSitePalSceneLoaded = false;
    window.__vendorSitePalDesiredVolume = 0;
    window.vh_sceneLoaded = () => {
      try {
        if (typeof window.getSceneAttributes === "function") {
          const attrs = window.getSceneAttributes();
          if (attrs && attrs.sceneID) {
            window.__vendorSitePalCurrentSceneId = Number(attrs.sceneID);
          }
        }
      } catch (e) {}
      window.__vendorSitePalSceneLoaded = true;
      window.__vendorSitePalSceneVersion = (window.__vendorSitePalSceneVersion || 0) + 1;
      // interruptMode=1: a new sayText interrupts instead of queueing.
      if (typeof window.setStatus === "function") {
        try { window.setStatus(1, 0, 0, 1, 0); } catch (e) {}
      }
      if (typeof window.setPlayerVolume === "function") {
        try { window.setPlayerVolume(window.__vendorSitePalDesiredVolume || 0); } catch (e) {}
      }
      if ((window.__vendorSitePalDesiredVolume || 0) > 0) {
        speakPendingVendorLine();
      }
    };

    // Talk-state callbacks → the vendor-model animation bridge. sayText (TTS)
    // fires the vh_talk* pair; the vh_audio* names are kept as belt-and-braces
    // (some player builds fire them for TTS too — notifyVendorTalk dedups).
    window.vh_talkStarted = () => notifyVendorTalk(true);
    window.vh_talkEnded = () => notifyVendorTalk(false);
    window.vh_audioStarted = () => notifyVendorTalk(true);
    window.vh_audioEnded = () => notifyVendorTalk(false);
    window.vh_audioStopped = () => notifyVendorTalk(false);
    window.vh_speechEnded = () => notifyVendorTalk(false);

    const host = ensureHostDiv();
    // Embed exactly ONCE per page lifetime, no matter how many times this
    // component mounts. The flag (not the promise) is the guard: with the
    // embed script browser-cached, Strict Mode's first mount used to win the
    // race against its own cleanup and the second mount double-embedded —
    // which kills the player.
    const embedNow = () => {
      if (window.__vendorSitePalEmbedded) return;
      window.__vendorSitePalEmbedded = true;
      loadVendorSitePalScriptOnce(VENDOR_SITEPAL_ACCOUNT).then((ok) => {
        // The embed functions come from vhss-d.oddcast.com. When that host is
        // down it answers 504 with an HTML error page, which defines nothing.
        // This used to call AC_VHost_Embed regardless, so a vendor-side outage
        // surfaced only as an uncaught "AC_Vhost_Embed is not defined" thrown
        // from an <anonymous> script — no hint that the cause was upstream.
        const embed = window.AC_VHost_Embed || window.AC_Vhost_Embed;
        if (!ok || typeof embed !== "function") {
          console.warn(
            "[vendorSitePal] SitePal embed functions did not load from " +
              "vhss-d.oddcast.com — vendor faces and voices are unavailable. " +
              "This is an upstream outage, not a page bug: that URL should " +
              "return JavaScript, and returns an HTML error page when SitePal " +
              "is down. Everything else on the strip is unaffected."
          );
          // Un-latch. Both guards are set BEFORE the load resolves, so without
          // this the page stays permanently wedged even after SitePal recovers
          // — the next mount gets to try again instead.
          window.__vendorSitePalEmbedded = false;
          window.__vendorSitePalScriptPromise = null;
          return;
        }
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.textContent =
          `try { AC_VHost_Embed(${VENDOR_SITEPAL_EMBED_PARAMS}); } ` +
          `catch (e) { AC_Vhost_Embed(${VENDOR_SITEPAL_EMBED_PARAMS}); }`;
        host.appendChild(script);
      });
    };
    // When to boot. Desktop keeps embedding at page load, so the first stall
    // greets instantly. A finger-driven device waits for a
    // requestVendorSitePalEmbed() — the walker nearing a stall, or a stall
    // being entered — because the player costs ≈290 MB of page-process memory
    // on an iPad Pro whether or not the visitor ever reaches the strip
    // (measured 2026-09-02). ?sitepal=eager or ?tune=vendor force the old way;
    // ?sitepal=lazy forces the new way on desktop for testing.
    const search = window.location.search;
    const forceEager = /[?&](sitepal=eager|tune=vendor)\b/.test(search);
    const forceLazy = /[?&]sitepal=lazy\b/.test(search);
    const lazy = forceLazy || (!forceEager && isTouchDevice());
    if (!lazy || window.__vendorSitePalWanted) {
      embedNow();
    } else if (!window.__vendorSitePalWantedListener) {
      // Page-lifetime listener (see the no-cleanup note below); embedNow is
      // idempotent, so a remount cannot double-embed.
      window.__vendorSitePalWantedListener = true;
      window.addEventListener("vendor-sitepal-wanted", embedNow);
    }

    // No cleanup: the host div, the player inside it, vh_sceneLoaded, and
    // the state globals all live for the page lifetime. Tearing any of them
    // down on unmount (Strict Mode / HMR) is what used to break the player.
  }, []);

  return showTuner ? <VendorCropTuner /> : null;
}
