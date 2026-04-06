import React, { Suspense, useRef, useState, useCallback, createContext, useContext } from "react";
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

/* ── Zoom context shared between Model and CameraController ── */
const ZoomContext = createContext();

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

/* ── 3D Model ── */
function Model({ url }) {
  const { scene } = useGLTF(url);
  const { setZoomed, setTargetPos, setTargetLookAt } = useContext(ZoomContext);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    const hitPoint = e.point.clone();
    const camPos = e.camera.position.clone();
    const dir = hitPoint.clone().sub(camPos).normalize();
    const zoomPos = hitPoint.clone().sub(dir.multiplyScalar(3));
    setTargetLookAt(hitPoint);
    setTargetPos(zoomPos);
    setZoomed(true);
  }, [setZoomed, setTargetPos, setTargetLookAt]);

  return <primitive object={scene} onClick={handleClick} />;
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

  return (
    <div className="space-page">
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
          <ambientLight intensity={0.5 * Math.PI} />
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
            <Model url="/models/Scene2.glb" />
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

useGLTF.preload("/models/Scene2.glb");
