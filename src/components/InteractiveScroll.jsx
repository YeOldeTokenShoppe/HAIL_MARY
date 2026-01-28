"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";

function createTextCanvas() {
  const canvas = document.createElement("canvas");
  const w = 4096;
  const h = 4096;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Parchment background — warm tone that blends with scroll material
  ctx.fillStyle = "#f5e6c8";
  ctx.fillRect(0, 0, w, h);

  // Subtle parchment grain texture
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 3000; i++) {
    const rx = Math.random() * w;
    const ry = Math.random() * h;
    const rs = Math.random() * 3 + 1;
    ctx.fillStyle = Math.random() > 0.5 ? "#8B7355" : "#a0926b";
    ctx.fillRect(rx, ry, rs, rs);
  }
  ctx.globalAlpha = 1.0;

  // Flip on Y-axis (mirror horizontally) and upside down
  ctx.save();
  ctx.translate(w, h);
  ctx.scale(-1, -1);

  const cx = w * 0.49;
  let y = h * 0.11;

  // Latin quote
  ctx.textAlign = "center";
  ctx.font = 'bold 207px "Courier New", monospace';
  ctx.fillStyle = "#3a2a0a";
  ctx.fillText("\u201CBene agere est vere", cx, y);
  y += 252;
  ctx.fillText("lucrari.\u201D", cx, y);
  y += 270;

  // Translation
  ctx.font = "bold italic 153px Georgia, serif";
  ctx.fillStyle = "rgba(50, 35, 10, 0.85)";
  ctx.fillText("(To act well is to profit truly.)", cx, y);
  y += 198;

  // Attribution
  ctx.font = 'bold 117px "Courier New", monospace';
  ctx.fillStyle = "rgba(50, 35, 10, 0.7)";
  ctx.fillText("\u2014 St. Gr80", cx, y);
  y += 216;

  // Gold divider
  const grad = ctx.createLinearGradient(w * 0.3, 0, w * 0.7, 0);
  grad.addColorStop(0, "rgba(160, 120, 20, 0)");
  grad.addColorStop(0.3, "rgba(160, 120, 20, 0.7)");
  grad.addColorStop(0.5, "rgba(160, 120, 20, 1)");
  grad.addColorStop(0.7, "rgba(160, 120, 20, 0.7)");
  grad.addColorStop(1, "rgba(160, 120, 20, 0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, y);
  ctx.lineTo(w * 0.7, y);
  ctx.stroke();
  y += 198;

  // Poem
  const lines = [
    { text: "We are trustless\u2014",        font: 'bold 171px Georgia, serif',   color: "#3a2a0a" },
    { text: "But we believe",               font: 'bold italic 162px Georgia, serif', color: "rgba(30, 18, 5, 0.92)" },
    { text: "In code and cryptography.",     font: 'bold 153px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "In purity of circuitry.",       font: 'bold 153px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "In virtue over villainy.",      font: 'bold 153px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "In the virtual machine.",       font: 'bold 153px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "",                              font: '153px Georgia, serif',        color: "transparent", gap: 72 },
    { text: "Mater ex machina.",             font: 'bold italic 189px Georgia, serif', color: "#3a2a0a" },
    { text: "",                              font: '153px Georgia, serif',        color: "transparent", gap: 72 },
    { text: "Incorruptible integrity",       font: 'bold 153px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "An avatar of resistance",       font: 'bold 153px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "in a market built to break you.", font: 'bold 153px Georgia, serif', color: "rgba(30, 18, 5, 0.9)" },
    { text: "",                              font: '153px Georgia, serif',        color: "transparent", gap: 72 },
    { text: "Hold RL80 in your wallet as",   font: 'bold italic 153px Georgia, serif', color: "rgba(30, 18, 5, 0.9)" },
    { text: "a rosary for prosperity.",      font: 'bold italic 153px Georgia, serif', color: "rgba(30, 18, 5, 0.9)" },
  ];

  for (const line of lines) {
    if (line.gap) { y += line.gap; continue; }
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, cx, y);
    y += 198;
  }

  ctx.restore();

  return canvas;
}

/* ------------------------------------------------------------------ */
/*  A) ScrollModel3D – inner R3F component                            */
/* ------------------------------------------------------------------ */
const OPEN_ANIM = "Armature|3_Opened Action _Armature";
const CLOSE_ANIM = "Armature|1_Close Action_Armature";
const PAPER_MESH = "Object_38";

function ScrollModel3D({ isOpen, onToggle, scale = 1 }) {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/scroll.glb");
  const { actions } = useAnimations(animations, group);

  const materialClonedRef = useRef(false);
  const originalMapRef = useRef(null);
  const paperMeshRef = useRef(null);

  // Play open/close animations
  useEffect(() => {
    const animName = isOpen ? OPEN_ANIM : CLOSE_ANIM;
    const action = actions[animName];
    if (!action) return;

    action.reset();
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();

    return () => {
      action.fadeOut(0.2);
    };
  }, [isOpen, actions]);

  // ---- Text-on-mesh ----

  const textTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = createTextCanvas();
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Clone paper material once
  useEffect(() => {
    if (materialClonedRef.current) return;
    scene.traverse((child) => {
      if (child.isMesh && child.name === PAPER_MESH) {
        child.material = child.material.clone();
        originalMapRef.current = child.material.map;
        paperMeshRef.current = child;
        materialClonedRef.current = true;
      }
    });
  }, [scene]);

  // Enforce texture on paper mesh
  useFrame(({ invalidate }) => {
    const mesh = paperMeshRef.current;
    if (!mesh) return;
    const targetMap = isOpen ? textTexture : originalMapRef.current;
    if (mesh.material.map !== targetMap) {
      mesh.material.map = targetMap;
      mesh.material.needsUpdate = true;
      invalidate();
    }
  });

  // Pointer cursor
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  return (
    <primitive
      ref={group}
      object={scene}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  B) InteractiveScroll – exported wrapper                           */
/* ------------------------------------------------------------------ */
export default function InteractiveScroll({ isMobile, isSmallPhone }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const openHeight = isMobile ? "70vh" : "80vh";
  const modelScale = isSmallPhone ? 4.7 : isMobile ? 4.8 : 4.8;

  return (
    <>
    <style>{`
      @keyframes scrollPulse {
        0%, 100% { filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.15)); }
        50% { filter: drop-shadow(0 0 18px rgba(255, 215, 0, 0.5)); }
      }
    `}</style>

    {/* Closed state: scroll image — no WebGL context */}
    {!isOpen && (
      <div
        onClick={(e) => { e.stopPropagation(); open(); }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        style={{
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "scrollPulse 3s ease-in-out infinite",
        }}
      >
        <img
          src="/images/scroll.webp"
          alt="Tap to read scroll"
          style={{
            width: isSmallPhone ? 120 : isMobile ? 140 : 180,
            height: "auto",
            objectFit: "contain",
          }}
        />
        <span style={{
          fontFamily: "Georgia, serif",
          fontSize: isSmallPhone ? "0.55rem" : isMobile ? "0.6rem" : "0.7rem",
          color: "rgba(255, 255, 255, 0.35)",
          fontStyle: "italic",
          letterSpacing: "0.05em",
          marginTop: "0.3rem",
        }}>
          tap to read
        </span>
      </div>
    )}

    {/* Open state: full 3D Canvas — portaled to body to escape stacking contexts */}
    {isOpen && createPortal(
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9999,
          background: "rgba(0, 0, 0, 0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "90vw",
            maxWidth: "900px",
            height: openHeight,
          }}
        >
          <Canvas
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0, 0.5, 3.8], fov: 40 }}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 4]} intensity={1.2} />
            <pointLight position={[-2, 1, 2]} intensity={0.4} color="#ffd700" />

            <ScrollModel3D
              isOpen={isOpen}
              onToggle={toggle}
              scale={modelScale}
            />
          </Canvas>
        </div>

        <p
          onClick={close}
          style={{
            textAlign: "center",
            fontSize: "0.7rem",
            color: "rgba(255, 255, 255, 0.4)",
            margin: "0.4rem 0 0",
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          tap to close
        </p>
      </div>,
      document.body
    )}
    </>
  );
}

useGLTF.preload("/models/scroll.glb");
