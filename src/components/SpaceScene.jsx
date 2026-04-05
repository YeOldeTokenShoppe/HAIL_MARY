import React, { Suspense, useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Loader,
  useGLTF,
  PerspectiveCamera,
  OrbitControls,
  Stars,
} from "@react-three/drei";
import "../app/space/space.css";

/* ── SitePal character configs ── */
const SITEPAL_ACCOUNT = "9308752";
const SITEPAL_CHARACTERS = {
  window1: {
    containerId: "space-sitepal-iframe-w1",
    sceneId: 2774433,
    hash: "9XtgV3Ko3oxgH0LEHPcDQPrwuyz7zjTZ",
    placeholder: "/cameo_h80z.webp",
  },
  window2: {
    containerId: "space-sitepal-iframe-w2",
    sceneId: 2774449,
    hash: "I648K1uFf0emrXlmak9YhnqEztpPhJl2",
    placeholder: "/cameo_GR80.webp",
  },
  window3: {
    containerId: "space-sitepal-iframe-w3",
    sceneId: 2774779,
    hash: "yu12qQuwKxZnb6wl8AoA0lB7YpF6sPD9",
    placeholder: "",
  },
  window4: {
    containerId: "space-sitepal-iframe-w4",
    sceneId: 2774434,
    hash: "8G1pJDn6ZW6wf1f7cHLUvSdNZt55z3Vq",
    placeholder: "/cameo_kitty.webp",
  },
};

/* ── Zoom context shared between Model and CameraController ── */
const ZoomContext = createContext();

/* ── SitePal embed via isolated iframe ──
   Each character gets its own iframe so document.write doesn't nuke the React app.
   We use srcdoc with crossorigin-anonymous image loading to avoid canvas tainting. */
function SitePalIframe({ containerId, sceneId, hash, delay = 0 }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!iframeRef.current) return;
      const iframe = iframeRef.current;

      const html = `<!DOCTYPE html>
<html><head><style>
  html,body{margin:0;padding:0;overflow:hidden;background:transparent;}
</style>
<script>
// Patch getContext to force preserveDrawingBuffer BEFORE SitePal loads
(function(){
  var orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, attrs){
    if(type==="webgl"||type==="webgl2"||type==="experimental-webgl"){
      attrs = Object.assign({}, attrs, {preserveDrawingBuffer:true});
    }
    return orig.call(this, type, attrs);
  };
})();

// Suppress all audio from the start — intercept AudioContext so nothing plays
(function(){
  var OrigAC = window.AudioContext || window.webkitAudioContext;
  if(OrigAC){
    var PatchedAC = function(){
      var ctx = new OrigAC();
      ctx.suspend();
      return ctx;
    };
    PatchedAC.prototype = OrigAC.prototype;
    window.AudioContext = PatchedAC;
    window.webkitAudioContext = PatchedAC;
  }
  // Mute any audio/video elements as soon as they're created
  var origAppend = Element.prototype.appendChild;
  Element.prototype.appendChild = function(child){
    var result = origAppend.call(this, child);
    if(child.tagName === 'AUDIO' || child.tagName === 'VIDEO'){
      child.muted = true;
      child.volume = 0;
    }
    return result;
  };
})();
</script>
</head><body>
<div id="sitepal-container"></div>
<script type="text/javascript" src="https://vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${SITEPAL_ACCOUNT}&js=0"></script>
<script type="text/javascript">
  AC_VHost_Embed(${SITEPAL_ACCOUNT},600,800,"",1,0,${sceneId},0,1,0,"${hash}",0,0);
  function vh_sceneLoaded(){
    try{ stopSpeech(); }catch(e){}
    try{ setPlayerVolume(0); }catch(e){}
    setTimeout(function(){ try{ stopSpeech(); }catch(e){} }, 500);
  }
</script>
</body></html>`;

      const blob = new Blob([html], { type: "text/html" });
      iframe.src = URL.createObjectURL(blob);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (iframeRef.current) iframeRef.current.src = "about:blank";
    };
  }, [sceneId, hash, delay]);

  return (
    <iframe
      id={containerId}
      ref={iframeRef}
      title={`sitepal-${sceneId}`}
      style={{
        position: "fixed",
        left: -9999,
        top: 0,
        width: 600,
        height: 800,
        opacity: 0.01,
        pointerEvents: "none",
        zIndex: -1,
        border: "none",
      }}
    />
  );
}

/* ── Polls an iframe for SitePal's render canvas ── */
function waitForIframeCanvas(iframe, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const canvases = doc.querySelectorAll("canvas");
          // SitePal typically creates 2 canvases — the last one is the render canvas
          if (canvases.length >= 2) { resolve(canvases[canvases.length - 1]); return; }
          if (Date.now() - start > timeout) {
            if (canvases.length > 0) { resolve(canvases[canvases.length - 1]); return; }
            reject(new Error("SitePal canvas not found in iframe"));
            return;
          }
        }
      } catch (e) { /* iframe not ready yet */ }
      requestAnimationFrame(check);
    };
    check();
  });
}

/* ── Reusable hook: SitePal iframe canvas → chroma-keyed CanvasTexture ── */
function useSitePalTexture(containerId, placeholderSrc, { rotation = 0 } = {}) {
  const textureRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const cropCtxRef = useRef(null);
  const sitePalSourceRef = useRef(null);
  const materialRef = useRef(null);
  const bgColorRef = useRef(null);
  const loggedErrorRef = useRef(false);
  const [isLive, setIsLive] = useState(false);
  const CHROMA_TOLERANCE = 60;

  // Create emissive material with glow gradient (no placeholder image)
  const material = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 512;
    const ctx = c.getContext("2d");
    const cx = c.width / 2;
    const cy = c.height / 2;
    const grad = ctx.createRadialGradient(cx, cy * 0.9, 0, cx, cy, cx * 1.4);
    grad.addColorStop(0, "rgba(160, 200, 255, 0.9)");
    grad.addColorStop(0.25, "rgba(100, 160, 255, 0.7)");
    grad.addColorStop(0.55, "rgba(60, 100, 200, 0.5)");
    grad.addColorStop(0.8, "rgba(30, 50, 120, 0.4)");
    grad.addColorStop(1, "rgba(15, 20, 60, 0.6)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    const glowTex = new THREE.CanvasTexture(c);
    glowTex.flipY = false;
    glowTex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: glowTex,
      emissiveMap: glowTex,
      emissive: new THREE.Color(0.8, 0.6, 1.0),
      emissiveIntensity: 1.5,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  // Poll for iframe and its SitePal canvas, then create live texture
  useEffect(() => {
    let cancelled = false;

    const pollForIframe = () => {
      if (cancelled) return;
      const iframe = document.getElementById(containerId);
      if (!iframe || !iframe.contentDocument) {
        setTimeout(pollForIframe, 500);
        return;
      }

      waitForIframeCanvas(iframe).then((el) => {
        if (cancelled) return;
        console.log(`[SitePal] Found canvas for ${containerId}:`, el.tagName, el.width, el.height);

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = 512;
        cropCanvas.height = 512;
        const cropCtx = cropCanvas.getContext("2d");

        const tex = new THREE.CanvasTexture(cropCanvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;

        textureRef.current = tex;
        cropCanvasRef.current = cropCanvas;
        cropCtxRef.current = cropCtx;
        sitePalSourceRef.current = el;
        setIsLive(true);

        if (materialRef.current) {
          materialRef.current.map = tex;
          materialRef.current.emissiveMap = tex;
          materialRef.current.needsUpdate = true;
        }
      }).catch((err) => {
        console.warn(`[SitePal] Canvas not found for ${containerId}:`, err);
      });
    };
    pollForIframe();

    return () => { cancelled = true; };
  }, [containerId]);

  // Per-frame chroma key update
  const updateTexture = useCallback(() => {
    if (!cropCtxRef.current || !sitePalSourceRef.current) return;
    const ctx = cropCtxRef.current;
    const src = sitePalSourceRef.current;
    const canvas = cropCanvasRef.current;
    try {
      // Draw a radial glow backdrop so keyed-out areas look like cockpit lighting
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const grad = ctx.createRadialGradient(cx, cy * 0.9, 0, cx, cy, cx * 1.4);
      grad.addColorStop(0, "rgba(160, 200, 255, 0.9)");   // bright white-blue center
      grad.addColorStop(0.25, "rgba(100, 160, 255, 0.7)"); // soft blue
      grad.addColorStop(0.55, "rgba(60, 100, 200, 0.5)");  // mid glow
      grad.addColorStop(0.8, "rgba(30, 50, 120, 0.4)");    // gentle fade
      grad.addColorStop(1, "rgba(15, 20, 60, 0.6)");       // soft edge
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (rotation) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(src, 0, 0, src.width || 600, src.height || 800, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(src, 0, 0, src.width || 600, src.height || 800, 0, 0, canvas.width, canvas.height);
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;

      if (!bgColorRef.current && (d[0] + d[1] + d[2]) > 0) {
        bgColorRef.current = [d[0], d[1], d[2]];
      }

      if (bgColorRef.current) {
        const [bgR, bgG, bgB] = bgColorRef.current;
        const tol = CHROMA_TOLERANCE;
        // Replace keyed pixels with dark backdrop color instead of transparency
        for (let i = 0; i < d.length; i += 4) {
          const dr = d[i] - bgR;
          const dg = d[i + 1] - bgG;
          const db = d[i + 2] - bgB;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist < tol) {
            d[i] = 26; d[i + 1] = 26; d[i + 2] = 46; // #1a1a2e
            d[i + 3] = 255;
          } else if (dist < tol * 1.5) {
            // Blend toward backdrop at the edges
            const blend = (dist - tol) / (tol * 0.5);
            d[i] = Math.round(26 + (d[i] - 26) * blend);
            d[i + 1] = Math.round(26 + (d[i + 1] - 26) * blend);
            d[i + 2] = Math.round(46 + (d[i + 2] - 46) * blend);
            d[i + 3] = 255;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (e) {
      if (!loggedErrorRef.current) {
        console.warn(`[SitePal] updateTexture error:`, e.message);
        loggedErrorRef.current = true;
      }
    }
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }, []);

  return { material, updateTexture, isLive };
}

/* ── Smooth camera zoom controller ── */
function CameraController({ controlsRef }) {
  const { camera } = useThree();
  const { zoomed, targetPos, targetLookAt, defaultPos, defaultLookAt } = useContext(ZoomContext);
  const lerpSpeed = 2.5;
  const phase = useRef("idle");
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-lerpSpeed * delta);

    if (zoomed && phase.current === "idle") {
      phase.current = "zooming-in";
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.autoRotate = false;
      }
    }

    if (phase.current === "zooming-in") {
      camera.position.lerp(targetPos, t);
      currentLookAt.current.lerp(targetLookAt, t);
      camera.lookAt(currentLookAt.current);

      const dist = camera.position.distanceTo(targetPos);
      if (dist < 0.05) {
        phase.current = "zoomed";
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetLookAt);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = false;
          controlsRef.current.update();
        }
      }
    }

    if (!zoomed && (phase.current === "zoomed" || phase.current === "zooming-in")) {
      phase.current = "zooming-out";
      if (controlsRef.current) controlsRef.current.enabled = false;
    }

    if (phase.current === "zooming-out") {
      camera.position.lerp(defaultPos, t);
      currentLookAt.current.lerp(defaultLookAt, t);
      camera.lookAt(currentLookAt.current);

      const dist = camera.position.distanceTo(defaultPos);
      if (dist < 0.1) {
        phase.current = "idle";
        camera.position.copy(defaultPos);
        currentLookAt.current.copy(defaultLookAt);
        if (controlsRef.current) {
          controlsRef.current.target.copy(defaultLookAt);
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = true;
          controlsRef.current.update();
        }
      }
    }
  });

  return null;
}

/* ── 3D Model with live SitePal textures on all windows ── */
function Model({ url }) {
  const { scene } = useGLTF(url);
  const { setZoomed, setTargetPos, setTargetLookAt } = useContext(ZoomContext);

  const w1 = SITEPAL_CHARACTERS.window1;
  const w2 = SITEPAL_CHARACTERS.window2;
  const w3 = SITEPAL_CHARACTERS.window3;
  const w4 = SITEPAL_CHARACTERS.window4;

  const { material: window1Material, updateTexture: updateW1, isLive: w1Live } = useSitePalTexture(w1.containerId, w1.placeholder);
  const { material: window2Material, updateTexture: updateW2, isLive: w2Live } = useSitePalTexture(w2.containerId, w2.placeholder);
  const { material: window3Material, updateTexture: updateW3, isLive: w3Live } = useSitePalTexture(w3.containerId, w3.placeholder, { rotation: 10 });
  const { material: window4Material, updateTexture: updateW4, isLive: w4Live } = useSitePalTexture(w4.containerId, w4.placeholder);

  const allLive = w1Live && w2Live && w3Live && w4Live;

  useFrame(() => {
    updateW1();
    updateW2();
    updateW3();
    updateW4();
  });

  const handleWindowClick = useCallback((e) => {
    e.stopPropagation();
    const hitPoint = e.point.clone();
    const camPos = e.camera.position.clone();
    const dir = hitPoint.clone().sub(camPos).normalize();
    const zoomPos = hitPoint.clone().sub(dir.multiplyScalar(3));
    setTargetLookAt(hitPoint);
    setTargetPos(zoomPos);
    setZoomed(true);
  }, [setZoomed, setTargetPos, setTargetLookAt]);

  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh) return;
      if (child.name === "Window1") child.material = window1Material;
      if (child.name === "Window2") child.material = window2Material;
      if (child.name === "Window3") child.material = window3Material;
      if (child.name === "Window4") child.material = window4Material;
    });
  }, [scene, window1Material, window2Material, window3Material, window4Material]);

  const clickableWindows = ["Window1", "Window2", "Window3", "Window4"];

  return <primitive object={scene} onClick={(e) => {
    if (allLive && clickableWindows.includes(e.object.name)) handleWindowClick(e);
  }} />;
}

export default function SpaceScene() {
  const [zoomed, setZoomed] = useState(false);
  const [targetPos, setTargetPos] = useState(() => new THREE.Vector3(0, 0, 6));
  const [targetLookAt, setTargetLookAt] = useState(() => new THREE.Vector3(0, 0, 0));

  const defaultPos = React.useMemo(() => new THREE.Vector3(0, 0, 16), []);
  const defaultLookAt = React.useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const controlsRef = useRef(null);

  const zoomCtx = React.useMemo(() => ({
    zoomed, setZoomed,
    targetPos, setTargetPos,
    targetLookAt, setTargetLookAt,
    defaultPos, defaultLookAt,
  }), [zoomed, targetPos, targetLookAt, defaultPos, defaultLookAt]);

  const w1 = SITEPAL_CHARACTERS.window1;
  const w2 = SITEPAL_CHARACTERS.window2;
  const w3 = SITEPAL_CHARACTERS.window3;
  const w4 = SITEPAL_CHARACTERS.window4;

  return (
    <div className="space-page">
      {/* Each SitePal character runs in its own isolated iframe */}
      <SitePalIframe containerId={w1.containerId} sceneId={w1.sceneId} hash={w1.hash} />
      <SitePalIframe containerId={w2.containerId} sceneId={w2.sceneId} hash={w2.hash} delay={2000} />
      <SitePalIframe containerId={w3.containerId} sceneId={w3.sceneId} hash={w3.hash} delay={4000} />
      <SitePalIframe containerId={w4.containerId} sceneId={w4.sceneId} hash={w4.hash} delay={6000} />
      <div className="bg" />

      <h1
        className="custom-title"
        style={{
          position: "absolute",
          top: "2rem",
          left: "2rem",
          zIndex: 290,
          color: "#f6f5f1ff",
          fontFamily: "UnifrakturCook, serif",
          textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7)",
          fontSize: "2.5rem",
          fontWeight: 900,
          lineHeight: 0.85,
          transform: "rotate(-8deg) skew(-15deg)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          margin: 0,
        }}
      >
        <span className="title-line" style={{ display: "block" }}>Our Lady</span>
        <span className="title-line" style={{ display: "block" }}>
          <span style={{ fontSize: "1rem" }}>    of    </span>
          Perpetual
        </span>
        <span className="title-line" style={{ display: "block", marginLeft: "2rem" }}>Profit</span>
      </h1>

      <Canvas
        onPointerMissed={() => { if (zoomed) setZoomed(false); }}
        dpr={[1.5, 2]}
        linear
        shadows
        camera={{ position: [0, 0, 16], fov: 75 }}
      >
        <ZoomContext.Provider value={zoomCtx}>
          <fog attach="fog" args={["#272730", 16, 30]} />
          <ambientLight intensity={0.75 * Math.PI} />
          <PerspectiveCamera makeDefault position={[0, 0, 16]} fov={75}>
            <spotLight
              castShadow
              intensity={1.25 * Math.PI}
              decay={0}
              angle={0.2}
              penumbra={1}
              position={[-25, 20, -15]}
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.0001}
            />
          </PerspectiveCamera>
          <CameraController controlsRef={controlsRef} />
          <Suspense fallback={null}>
            <Model url="/models/Scene1.glb" />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            autoRotate
            autoRotateSpeed={0.5}
            enablePan={false}
            enableZoom={zoomed}
            maxPolarAngle={zoomed ? Math.PI : Math.PI / 2}
            minPolarAngle={zoomed ? 0 : Math.PI / 2}
          />
          <Stars radius={500} depth={50} count={1000} factor={10} />
        </ZoomContext.Provider>
      </Canvas>

      <div className="layer" />
      <Loader />
    </div>
  );
}

useGLTF.preload("/models/Scene1.glb");
