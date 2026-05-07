"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import SlotMachineScreen from "./SlotMachineScreen";

// Adapter: finds the ScreenB mesh in the workstation GLB, creates a canvas +
// CanvasTexture, applies it as that mesh's material, and exposes both via
// window globals so SlotMachineScreen (which reads window[canvasGlobal] /
// window[textureGlobal]) can paint into it.

const CANVAS_GLOBAL = "__screenBCanvas";
const TEXTURE_GLOBAL = "__screenBTexture";
const MESH_GLOBAL = "__screenBMesh";

export default function ScreenBSlotMachine() {
  const { scene } = useThree();
  const [ready, setReady] = useState(false);
  const attachedRef = useRef(false);

  useFrame(() => {
    if (attachedRef.current || !scene) return;

    let mesh = null;
    scene.traverse((child) => {
      if (mesh) return;
      if (child.isMesh && child.name === "ScreenB") mesh = child;
    });
    if (!mesh) return;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.center.set(0.5, 0.5);

    mesh.material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      toneMapped: false,
    });
    mesh.material.needsUpdate = true;

    window[CANVAS_GLOBAL] = canvas;
    window[TEXTURE_GLOBAL] = texture;
    window[MESH_GLOBAL] = mesh;

    attachedRef.current = true;
    setReady(true);
  });

  useEffect(() => {
    return () => {
      const tex = window[TEXTURE_GLOBAL];
      if (tex && tex.dispose) tex.dispose();
      delete window[CANVAS_GLOBAL];
      delete window[TEXTURE_GLOBAL];
      delete window[MESH_GLOBAL];
    };
  }, []);

  if (!ready) return null;
  return (
    <SlotMachineScreen
      canvasGlobal={CANVAS_GLOBAL}
      textureGlobal={TEXTURE_GLOBAL}
    />
  );
}
