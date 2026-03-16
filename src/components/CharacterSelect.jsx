"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/* ── Neon frame model ── */
function NeonFrame() {
  const groupRef = useRef();

  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load("/models/neonFrame.glb", (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          // Boost emissive so Bloom picks it up
          child.material.emissiveIntensity = child.material.emissiveIntensity || 1.5;
          child.material.toneMapped = false;
        }
      });
      if (groupRef.current) {
        groupRef.current.add(model);
      }
    });

    return () => {
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          groupRef.current.remove(groupRef.current.children[0]);
        }
      }
    };
  }, []);

  return <group ref={groupRef} position={[0, -2, 0]} scale={[2, 2, 2]} />;
}

/* ── Character portrait inside the frame ── */
function CharacterPortrait({ image, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        inset: "23%",
        borderRadius: "60%",
        overflow: "hidden",
        cursor: "pointer",
        zIndex: 1,
      }}
    >
      {image ? (
        <img
          src={image}
          alt="character"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "radial-gradient(ellipse, rgba(0,255,255,0.08) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}

/**
 * CharacterSelect — ornate neon frame with character portrait + nav arrows.
 *
 * Props:
 *  - characters: [{ name, image }]  — roster of selectable characters
 *  - activeIndex: currently selected index
 *  - onSelect: (index) => void
 *  - size: pixel size of the widget (default 200)
 */
export default function CharacterSelect({
  characters = [],
  activeIndex = 0,
  onSelect,
  size = 200,
}) {
  const [index, setIndex] = useState(activeIndex);

  // Sync internal index when parent changes it (e.g. auto-advance)
  useEffect(() => {
    setIndex(activeIndex);
  }, [activeIndex]);

  const current = characters[index] || { name: "Unknown", image: null };

  const prev = () => {
    const next = (index - 1 + characters.length) % characters.length;
    setIndex(next);
    if (onSelect) onSelect(next);
  };

  const next = () => {
    const n = (index + 1) % characters.length;
    setIndex(n);
    if (onSelect) onSelect(n);
  };

  return (
    <div style={{ fontFamily: "'Cyber', 'Geo', sans-serif" }}>
      {/* Frame + portrait area */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size * 1.3,
          margin: "0 auto",
        }}
      >
        {/* 3D frame canvas */}
        <Canvas
          camera={{ position: [0, 0, 2], fov: 45 }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ambientLight intensity={0.3} />
          <pointLight position={[0, 2, 3]} intensity={1} color="#ffd36b" />
          <NeonFrame />
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.4}
              luminanceSmoothing={0.3}
              radius={0.4}
              intensity={2}
              mipmapBlur
            />
          </EffectComposer>
        </Canvas>

        {/* Portrait behind the frame */}
        <CharacterPortrait image={current.image} onClick={next} />
      </div>

      {/* Character name + nav row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginTop: 8,
        }}
      >
        {characters.length > 1 && (
          <button
            onClick={prev}
            aria-label="Previous character"
            style={{
              background: "none",
              border: "1px solid rgba(0,255,255,0.3)",
              color: "hsl(183 38% 57%)",
              fontSize: "0.8rem",
              cursor: "pointer",
              width: 24,
              height: 24,
              display: "grid",
              placeItems: "center",
              clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          >
            ‹
          </button>
        )}
        <span
          style={{
            fontSize: "0.9rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "hsl(183 38% 57%)",
            textShadow: "0 0 8px rgba(0,255,255,0.4)",
          }}
        >
          {current.name}
        </span>
        {characters.length > 1 && (
          <button
            onClick={next}
            aria-label="Next character"
            style={{
              background: "none",
              border: "1px solid rgba(0,255,255,0.3)",
              color: "hsl(183 38% 57%)",
              fontSize: "0.8rem",
              cursor: "pointer",
              width: 24,
              height: 24,
              display: "grid",
              placeItems: "center",
              clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}
