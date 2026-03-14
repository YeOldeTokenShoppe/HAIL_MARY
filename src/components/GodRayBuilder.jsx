import { button, useControls } from "leva";
import { useEffect, useRef } from "react";

export const GodrayBuilder = ({ settings, onChange }) => {
  const curControls = useRef({});
  const pos = settings.position || [0, 0, 0];
  const rot = settings.rotation || [0, 0, 0];

  const controls = useControls("Godray Settings", {
    posX: { value: pos[0], min: -20, max: 20, step: 0.1, label: "pos X" },
    posY: { value: pos[1], min: -20, max: 20, step: 0.1, label: "pos Y" },
    posZ: { value: pos[2], min: -20, max: 20, step: 0.1, label: "pos Z" },
    rotX: { value: rot[0], min: -Math.PI, max: Math.PI, step: 0.01, label: "rot X" },
    rotY: { value: rot[1], min: -Math.PI, max: Math.PI, step: 0.01, label: "rot Y" },
    rotZ: { value: rot[2], min: -Math.PI, max: Math.PI, step: 0.01, label: "rot Z" },
    color: {
      value: settings.color || "white",
    },
    topRadius: {
      value: settings.topRadius || 3,
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    bottomRadius: {
      value: settings.bottomRadius || 2,
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    height: {
      value: settings.height || 10,
      min: 0.1,
      max: 20,
      step: 0.1,
    },
    timeSpeed: {
      value: settings.timeSpeed || 0.1,
      min: 0,
      max: 2,
      step: 0.01,
    },
    noiseScale: {
      value: settings.noiseScale || 5,
      min: 0.1,
      max: 20,
      step: 0.1,
    },
    smoothBottom: {
      value: settings.smoothBottom || 0.1,
      min: 0,
      max: 1,
      step: 0.001,
    },
    smoothTop: {
      value: settings.smoothTop || 0.9,
      min: 0,
      max: 1,
      step: 0.001,
    },
    fresnelPower: {
      value: settings.fresnelPower || 5,
      min: 1,
      max: 10,
      step: 0.1,
    },
    "Export Settings": button(() => {
      const c = curControls.current;
      const exportedSettings = {
        position: [c.posX, c.posY, c.posZ],
        rotation: [c.rotX, c.rotY, c.rotZ],
        color: c.color,
        topRadius: c.topRadius,
        bottomRadius: c.bottomRadius,
        height: c.height,
        timeSpeed: c.timeSpeed,
        noiseScale: c.noiseScale,
        smoothBottom: c.smoothBottom,
        smoothTop: c.smoothTop,
        fresnelPower: c.fresnelPower,
      };
      console.log(
        "Godray Settings:",
        JSON.stringify(exportedSettings, null, 2)
      );
      navigator.clipboard?.writeText(JSON.stringify(exportedSettings, null, 2));
    }),
  });
  curControls.current = controls;

  useEffect(() => {
    // Recombine into the format Godray expects
    const { posX, posY, posZ, rotX, rotY, rotZ, ...rest } = controls;
    onChange({
      ...rest,
      position: [posX, posY, posZ],
      rotation: [rotX, rotY, rotZ],
    });
  }, [controls, onChange]);

  return null;
};
