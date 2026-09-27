"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// A still variation of PalmTreeDrive: the I-80 sign and the synthwave sun over a
// flat grid road. No palms, no car, no streaming road motion and no scroll tour —
// the camera parks on the road and the viewer can orbit it.

const SIGN_URL = '/models/sign2.glb';
const SUN_URL = '/models/synthSunset.glb';

// Same sky, fog and light palette as the drive so the two scenes read as siblings.
const SKY_STOPS = [
  [0, '#001a33'],
  [0.3, '#ff6b35'],
  [0.4, '#ff8c42'],
  [1, '#ffa500'],
];
const FOG_COLOR = 0xff7f50;

// A little above the road, looking down the centre line toward the sun. Height
// is what makes a distant curve legible: from eye level it flattens to a sliver.
const OPENING_SHOT = {
  position: new THREE.Vector3(-3.2, 7, 40),
  target: new THREE.Vector3(6, 2.5, -60), // a touch right, splitting road and sun
  fov: 45,
};

// Left-hand shoulder of the road (the cyan lanes span |x| < 5). With the sun
// off to the right, the left side keeps the sign clear of the disc.
const SIGN_PLACEMENT = { x: -7.5, z: 14, scale: 2.1 };

// The road runs straight past the sign, then eases onto a constant heading that
// vanishes into the sun. Distances are forward from z = 0; slope is tan(heading).
// `start` moves the curve nearer or farther; `length` stretches it; `slope` sets
// how hard it turns. The sun follows the road automatically (see SUN_PLACEMENT).
const ROAD_BEND = { start: 40, length: 100, slope: 0.32 };

// Centreline x at forward distance t. Mirrors roadCentre() in the road shader.
const roadCentreAt = (t) => {
  const { start, length, slope } = ROAD_BEND;
  const u = Math.min(Math.max((t - start) / length, 0), 1);
  const past = Math.max(t - start - length, 0);
  return slope * (0.5 * length * u * u + past);
};

// Based on the drive's sun placement: the glTF node carries its own offset, so
// this lands the disc on the horizon at roughly z = -910. Its x is derived from
// the road so the disc always sits where the bent centreline meets the horizon.
const SUN_Z = -910;
const SUN_NODE_OFFSET_X = -223.8; // node translation (-0.895) × scene scale (250)
const SUN_PLACEMENT = {
  position: new THREE.Vector3(roadCentreAt(-SUN_Z) - SUN_NODE_OFFSET_X, -110, 100),
  scale: 250,
};

const buildSkyTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  SKY_STOPS.forEach(([stop, color]) => gradient.addColorStop(stop, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// The drive's road shader with its height noise and time offsets removed:
// flat ground, a static grid and a static dashed centre line. The lane and its
// dashes follow a bent centreline; the grid stays fixed to the world.
const buildRoadMaterial = (fog) => new THREE.ShaderMaterial({
  uniforms: {
    fogColor: { value: fog.color },
    fogNear: { value: fog.near },
    fogFar: { value: fog.far },
    uBendStart: { value: ROAD_BEND.start },
    uBendLength: { value: ROAD_BEND.length },
    uBendSlope: { value: ROAD_BEND.slope },
  },
  vertexShader: `
    precision highp float;
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform float uBendStart;
    uniform float uBendLength;
    uniform float uBendSlope;
    varying vec3 vPos;

    // Centreline x at forward distance t: straight, a quadratic ease into the
    // turn, then a constant heading (continuous position and direction).
    float roadCentre(float t) {
      float u = clamp((t - uBendStart) / uBendLength, 0.0, 1.0);
      float past = max(t - uBendStart - uBendLength, 0.0);
      return uBendSlope * (0.5 * uBendLength * u * u + past);
    }

    float gridLine(vec3 position, float width, float cell) {
      vec2 coord = position.xz / cell;
      vec2 grid = abs(fract(coord - 0.5) - 0.5) / (fwidth(coord) * width);
      return min(min(grid.x, grid.y), 1.0);
    }

    float dashLine(float across, float along) {
      float lineWidth = 0.2;
      float dashLength = 3.0;
      float dashGap = 2.0;
      float dashPattern = step(0.5, fract(along / (dashLength + dashGap)));
      float lineMask = 1.0 - smoothstep(0.0, lineWidth, abs(across));
      return lineMask * dashPattern;
    }

    void main() {
      float along = -vPos.z;
      float across = vPos.x - roadCentre(along);
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      // Grid lines dissolve long before the fog so the far ground stays calm.
      float l = mix(gridLine(vPos, 1.0, 2.0), 1.0, smoothstep(25.0, 90.0, depth));
      vec3 base = mix(vec3(0.0, 0.75, 1.0), vec3(0.0), smoothstep(5.0, 7.5, abs(across)));
      vec3 lineColor = vec3(1.0, 0.0, 0.933); // #ff00ee grid
      vec3 c = mix(lineColor, base, l);
      c = mix(c, vec3(1.0), dashLine(across, along) * 0.8);

      // The ground fogs out, but the lane keeps most of its glow so the road
      // runs unbroken into the sun instead of dissolving at the fog line.
      float fogFactor = smoothstep(fogNear, fogFar, depth);
      float lane = 1.0 - smoothstep(4.5, 6.5, abs(across));
      fogFactor *= 1.0 - 0.9 * lane;
      c = mix(c, fogColor, fogFactor);

      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }
  `,
});

export default function I80Horizon({ onLoadingChange }) {
  const mountRef = useRef(null);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const [ready, setReady] = useState(false);
  useEffect(() => { onLoadingChangeRef.current = onLoadingChange; }, [onLoadingChange]);
  useEffect(() => { onLoadingChangeRef.current?.(!ready); }, [ready]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let frame = 0;
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = buildSkyTexture();
    // Far fog: the drive closed at 100 units, which hid the bend and the long run
    // to the sun. The grid fades with distance instead (see the road shader).
    scene.fog = new THREE.Fog(FOG_COLOR, 100, 400);

    // The far plane must clear the sun, which sits almost 1000 units out.
    const camera = new THREE.PerspectiveCamera(OPENING_SHOT.fov, width / height, 0.1, 2500);
    camera.position.copy(OPENING_SHOT.position);
    camera.lookAt(OPENING_SHOT.target);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (error) {
      console.error('[I80Horizon] Unable to create a WebGL renderer:', error);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // Lighting lifted from the drive so the sign is lit the same way.
    scene.add(new THREE.AmbientLight(0xffa07a, 0.9));
    const sunLight = new THREE.DirectionalLight(0xff6b35, 1.2);
    sunLight.position.set(0, 5, -50);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0x9370db, 0.5);
    fillLight.position.set(20, 10, 20);
    scene.add(fillLight);
    const balanceLight = new THREE.DirectionalLight(0xffa500, 0.4);
    balanceLight.position.set(-20, 8, 10);
    scene.add(balanceLight);
    scene.add(new THREE.HemisphereLight(0xff7f50, 0x4b0082, 0.6));
    const rimLight = new THREE.DirectionalLight(0x00ffff, 0.2);
    rimLight.position.set(0, 15, -30);
    scene.add(rimLight);

    // Flat ground. It runs out past the sun so the disc sets behind the road.
    const roadGeometry = new THREE.PlaneGeometry(400, 1400, 1, 1);
    roadGeometry.rotateX(-Math.PI / 2);
    roadGeometry.translate(0, 0, -500); // z = -1200 through z = 200
    const road = new THREE.Mesh(roadGeometry, buildRoadMaterial(scene.fog));
    road.frustumCulled = false;
    scene.add(road);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(OPENING_SHOT.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 90;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // never dip below the road
    controls.update();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    dracoLoader.setWorkerLimit(2);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    // WebKit ImageBitmaps come back empty after a context restore; decode
    // through TextureLoader there, as the drive does.
    const ua = navigator.userAgent;
    if (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Android/.test(ua)) {
      loader.register((parser) => {
        parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
        parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
        parser.textureLoader.setRequestHeader(parser.options.requestHeader);
        return { name: 'webkit-context-safe-textures' };
      });
    }

    const pending = new Set([SIGN_URL, SUN_URL]);
    const settle = (url) => {
      pending.delete(url);
      if (!pending.size && !disposed) setReady(true);
    };
    const load = (url, onLoad) => {
      loader.load(url, (gltf) => {
        if (disposed) return;
        onLoad(gltf);
        settle(url);
      }, undefined, (error) => {
        console.error(`[I80Horizon] Failed to load ${url}:`, error);
        settle(url);
      });
    };

    load(SIGN_URL, ({ scene: sign }) => {
      sign.traverse((child) => {
        if (!child.isMesh) return;
        child.material.side = THREE.DoubleSide;
        child.castShadow = false;
        child.receiveShadow = false;
      });
      sign.position.set(SIGN_PLACEMENT.x, 0, SIGN_PLACEMENT.z);
      sign.scale.setScalar(SIGN_PLACEMENT.scale);
      scene.add(sign);
    });

    load(SUN_URL, ({ scene: sun }) => {
      sun.position.copy(SUN_PLACEMENT.position);
      sun.scale.setScalar(SUN_PLACEMENT.scale);
      sun.traverse((child) => {
        if (!child.isMesh) return;
        child.material = child.material.clone();
        child.material.fog = false;
        child.material.transparent = true;
        child.material.side = THREE.DoubleSide;
      });
      scene.add(sun);
    });

    const handleResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      dracoLoader.dispose();
      scene.background?.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
          material.dispose();
        });
      });
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100vh',
        backgroundColor: '#000',
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.6s ease-in-out',
        touchAction: 'none',
      }}
    />
  );
}
