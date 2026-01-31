"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useLanguage } from "./LanguageProvider";

function createTextCanvas(translations, locale) {
  const canvas = document.createElement("canvas");
  const w = 4096;
  const h = 4096;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Check if RTL language (Arabic, Hebrew, etc.)
  const isRTL = locale === "ar";

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
  let y = h * 0.09;

  // Latin quote (always in Latin, from translation file)
  ctx.textAlign = "center";
  ctx.direction = "ltr"; // Latin quote is always LTR
  ctx.font = 'bold 207px "UnifrakturMaguntia", monospace';
  ctx.fillStyle = "#3a2a0a";
  ctx.fillText("\u201CBene agere est vere", cx, y);
  y += 252;
  ctx.fillText("lucrari.\u201D", cx, y);
  y += 270;

  // Set direction for localized text
  if (isRTL) {
    ctx.direction = "rtl";
  }

  // Translation (localized)
  ctx.font = "bold italic 153px Georgia, serif";
  ctx.fillStyle = "rgba(50, 35, 10, 0.85)";
  ctx.fillText(translations.latinTranslation, cx, y);
  y += 198;

  // Attribution (localized)
  ctx.font = 'bold 160px "Courier New", monospace';
  ctx.fillStyle = "rgba(50, 35, 10, 0.7)";
  ctx.fillText(translations.attribution, cx, y);
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

  // Poem/Credo (localized)
  const credo = translations.credo;
  const lines = [
    { text: credo.line1,  font: 'bold 190px Georgia, serif',   color: "#3a2a0a" },
    { text: credo.line2,  font: 'bold italic 162px Georgia, serif', color: "rgba(30, 18, 5, 0.92)" },
    { text: credo.line3,  font: 'bold 180px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: credo.line4,  font: 'bold 180px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: credo.line5,  font: 'bold 180px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: credo.line6,  font: 'bold 180px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "",           font: '180px Georgia, serif',        color: "transparent", gap: 72 },
    { text: credo.line7,  font: 'bold italic 210px Georgia, serif', color: "#916e29ff" },
    { text: "",           font: '180px Georgia, serif',        color: "transparent", gap: 72 },
    { text: credo.line8,  font: 'bold 180px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: credo.line9,  font: 'bold 180px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: credo.line10, font: 'bold 180px Georgia, serif',  color: "rgba(30, 18, 5, 0.9)" },
    { text: "",           font: '180px Georgia, serif',        color: "transparent", gap: 72 },
    { text: credo.line11, font: 'bold italic 180px Georgia, serif', color: "rgba(30, 18, 5, 0.9)" },
    { text: credo.line12, font: 'bold italic 180px Georgia, serif', color: "rgba(30, 18, 5, 0.9)" },
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
/*  ScrollModel3D – inner R3F component                                */
/* ------------------------------------------------------------------ */
const OPEN_ANIM = "Armature|3_Opened Action _Armature";
const CLOSE_ANIM = "Armature|1_Close Action_Armature";
const PAPER_MESH = "Object_38";

function ScrollModel3D({ isOpen, onToggle, scale = 1, translations, locale }) {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/scroll2.glb");
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
    const canvas = createTextCanvas(translations, locale);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [translations, locale]);

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

  return (
    <primitive
      ref={group}
      object={scene}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  InteractiveScroll2 – exported wrapper                              */
/* ------------------------------------------------------------------ */
export default function InteractiveScroll2({ isMobile, isSmallPhone, onClose }) {
  const [isOpen, setIsOpen] = useState(true); // Start open immediately
  const [isClosing, setIsClosing] = useState(false); // Track if close animation is playing
  const { t, locale } = useLanguage();

  // When scroll is clicked: if open, play close animation then dismiss overlay
  const toggle = useCallback(() => {
    if (isOpen && onClose && !isClosing) {
      setIsClosing(true);
      setIsOpen(false); // Trigger close animation
      // Wait for animation to complete, then dismiss overlay
      setTimeout(() => {
        onClose();
      }, 1200); // Adjust timing to match close animation duration
    } else if (!isOpen && !isClosing) {
      setIsOpen(true);
    }
  }, [isOpen, isClosing, onClose]);

  const openHeight = isMobile ? "75vh" : "80vh";
  const modelScale = isSmallPhone ? 5.0 : isMobile ? 4.8 : 5.1;

  // Get scroll translations for canvas rendering
  const scrollTranslations = useMemo(() => ({
    latinQuote: t("scroll.latinQuote"),
    latinTranslation: t("scroll.latinTranslation"),
    attribution: t("scroll.attribution"),
    credo: {
      line1: t("scroll.credo.line1"),
      line2: t("scroll.credo.line2"),
      line3: t("scroll.credo.line3"),
      line4: t("scroll.credo.line4"),
      line5: t("scroll.credo.line5"),
      line6: t("scroll.credo.line6"),
      line7: t("scroll.credo.line7"),
      line8: t("scroll.credo.line8"),
      line9: t("scroll.credo.line9"),
      line10: t("scroll.credo.line10"),
      line11: t("scroll.credo.line11"),
      line12: t("scroll.credo.line12"),
    }
  }), [t]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
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
            translations={scrollTranslations}
            locale={locale}
          />
        </Canvas>
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: "0.8rem",
          color: "rgba(255, 255, 255, 0.4)",
          margin: "0.4rem 0 0",
          letterSpacing: "0.08em",
        }}
      >
        {t("scroll.tapToToggle")}
      </p>
    </div>
  );
}

useGLTF.preload("/models/scroll2.glb");
