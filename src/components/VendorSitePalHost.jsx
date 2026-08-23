"use client";

import { useEffect, useRef, useState } from "react";
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
  speakPendingVendorLine,
  getVendorSitePalSource,
  notifyVendorTalk,
} from "@/lib/vendorSitePal";

// Vendor tabs for the crop tuner. constName is used by the "Log values"
// output so the pasted block lands on the right export in vendorSitePal.js.
const TUNER_VENDORS = {
  fortunes: { label: "FORTUNE", crop: FORTUNES_SITEPAL_CROP, filter: FORTUNES_SITEPAL_FILTER, constName: "FORTUNES" },
  tonics: { label: "SALESMAN", crop: TONICS_SITEPAL_CROP, filter: TONICS_SITEPAL_FILTER, constName: "TONICS" },
  hotdogs: { label: "HOT DOG", crop: HOTDOGS_SITEPAL_CROP, filter: HOTDOGS_SITEPAL_FILTER, constName: "HOTDOGS" },
  promos: { label: "PROMOS", crop: PROMOS_SITEPAL_CROP, filter: PROMOS_SITEPAL_FILTER, constName: "PROMOS" },
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

function VendorCropTuner() {
  const previewRef = useRef(null);
  const [vendorKey, setVendorKey] = useState("fortunes");
  const [, force] = useState(0);
  const active = TUNER_VENDORS[vendorKey];

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
    }, 120);
    return () => clearInterval(timer);
  }, [vendorKey]);

  const logValues = () => {
    const { crop: c, filter: f, constName } = active;
    console.log(
      `export const ${constName}_SITEPAL_CROP = {\n  cropX: ${c.cropX},\n  cropY: ${c.cropY},\n  cropW: ${c.cropW},\n  cropH: ${c.cropH},\n  rotateZ: ${c.rotateZ},\n  rotateX: ${c.rotateX},\n};\n` +
      `export const ${constName}_SITEPAL_FILTER = {\n  saturate: ${f.saturate},\n  contrast: ${f.contrast},\n  brightness: ${f.brightness},\n  hueRotate: ${f.hueRotate},\n  sepia: ${f.sepia},\n};`
    );
  };

  const slider = (obj, key, min, max) => (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <span style={{ width: 72 }}>{key}</span>
      <input
        type="range" min={min} max={max} step={1} value={obj[key]}
        onChange={(e) => { obj[key] = Number(e.target.value); force((n) => n + 1); }}
        style={{ flex: 1 }}
      />
      <span style={{ width: 34, textAlign: "right" }}>{obj[key]}</span>
    </label>
  );

  return (
    <div style={{
      position: "fixed", right: 10, bottom: 10, zIndex: 9999, width: 260,
      background: "rgba(16,20,26,0.92)", color: "#cde", padding: 10,
      borderRadius: 8, fontFamily: "monospace", display: "flex",
      flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", gap: 4 }}>
        {Object.entries(TUNER_VENDORS).map(([key, v]) => (
          <button
            key={key}
            onClick={() => setVendorKey(key)}
            style={{
              flex: 1, padding: "3px 4px", fontSize: 10, cursor: "pointer",
              background: key === vendorKey ? "#3a4a6a" : "#1a2230",
              color: "#cde", border: "1px solid #3a4a6a", borderRadius: 4,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <canvas ref={previewRef} width={240} height={180} style={{ width: "100%", borderRadius: 4, background: "#222" }} />
      {TUNER_CROP_FIELDS.map(([k, min, max]) => slider(active.crop, k, min, max))}
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>filter</div>
      {TUNER_FILTER_FIELDS.map(([k, min, max]) => slider(active.filter, k, min, max))}
      <button onClick={logValues} style={{ marginTop: 6, padding: "4px 8px", cursor: "pointer" }}>
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
    if (!window.__vendorSitePalEmbedded) {
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
    }

    // No cleanup: the host div, the player inside it, vh_sceneLoaded, and
    // the state globals all live for the page lifetime. Tearing any of them
    // down on unmount (Strict Mode / HMR) is what used to break the player.
  }, []);

  return showTuner ? <VendorCropTuner /> : null;
}
