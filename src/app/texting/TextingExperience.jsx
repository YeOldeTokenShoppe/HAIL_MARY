'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './texting.module.css';

const MODEL_URL = '/models/madonna-texting-phone-v1.glb';
const stamp = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function TextingExperience() {
  const host = useRef(null);
  const api = useRef(null);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { playingRef.current = !media.matches; setPlaying(!media.matches); };
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    setStatus('loading');
    setProgress(0);
    setTime(0);
    setDuration(0);

    async function init() {
      const [THREE, { GLTFLoader }, { MeshoptDecoder }, { OrbitControls }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/libs/meshopt_decoder.module.js'),
        import('three/addons/controls/OrbitControls.js'),
      ]);
      if (cancelled) return;
      const element = host.current;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      renderer.domElement.setAttribute('aria-label', 'Animated sculpture of Our Lady texting, wearing a flowing cape. Drag to rotate and pinch or scroll to zoom.');
      renderer.domElement.setAttribute('role', 'img');
      element.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.maxPolarAngle = Math.PI * 0.88;
      scene.add(new THREE.HemisphereLight(0xe8eeff, 0x5e4268, 2.4));
      const key = new THREE.DirectionalLight(0xffeddb, 3.5);
      key.position.set(3, 5, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9badff, 3);
      rim.position.set(-4, 3, -2);
      scene.add(rim);

      let model, mixer, clipDuration = 0, frame, last = 0, lastUi = 0, ready = false;
      let hidden = document.hidden;
      let needsRender = true;
      const home = new THREE.Vector3();
      const center = new THREE.Vector3();
      let radius = 1;
      const fit = () => {
        const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
        const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
        const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.13;
        home.set(center.x + distance * 0.15, center.y + distance * 0.04, center.z + distance);
        camera.position.copy(home);
        controls.target.copy(center);
        controls.minDistance = radius * 1.1;
        controls.maxDistance = distance * 2.2;
        camera.near = radius / 100;
        camera.far = distance * 20;
        camera.updateProjectionMatrix();
        controls.update();
        needsRender = true;
      };
      const resize = () => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        if (ready) fit();
        needsRender = true;
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      const visibility = () => { hidden = document.hidden; last = 0; needsRender = true; };
      const changed = () => { needsRender = true; };
      const lost = (event) => { event.preventDefault(); ready = false; setStatus('error'); };
      document.addEventListener('visibilitychange', visibility);
      renderer.domElement.addEventListener('webglcontextlost', lost);
      controls.addEventListener('change', changed);
      const disposeModel = (root) => {
        const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
        root.traverse((object) => {
          if (object.geometry) geometries.add(object.geometry);
          if (object.skeleton) skeletons.add(object.skeleton);
          for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
            if (!material) continue;
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
          }
        });
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
        skeletons.forEach((s) => s.dispose());
      };
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        document.removeEventListener('visibilitychange', visibility);
        renderer.domElement.removeEventListener('webglcontextlost', lost);
        controls.removeEventListener('change', changed);
        controls.dispose();
        if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(model); }
        if (model) disposeModel(model);
        renderer.dispose();
        renderer.domElement.remove();
        api.current = null;
      };

      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(MODEL_URL, (gltf) => {
        if (cancelled) { disposeModel(gltf.scene); return; }
        model = gltf.scene;
        scene.add(model);
        mixer = new THREE.AnimationMixer(model);
        const clip = gltf.animations[0];
        if (clip) { mixer.clipAction(clip).play(); clipDuration = clip.duration; }
        mixer.update(0);
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        bounds.getCenter(center);
        // Frame the figure with room for the moving hem.
        const size = bounds.getSize(new THREE.Vector3());
        radius = Math.max(size.y / 2, size.x / 2, size.z / 2) * 1.05;
        ready = true;
        fit();
        setDuration(clipDuration);
        setStatus('ready');
        api.current = {
          reset: fit,
          seek: (value) => { mixer.setTime(value); needsRender = true; setTime(value); },
          rotate: (angle) => {
            const offset = camera.position.clone().sub(controls.target);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            camera.position.copy(controls.target).add(offset);
            controls.update();
            needsRender = true;
          },
        };
      }, (event) => {
        if (!cancelled && event.total) setProgress(Math.round(event.loaded / event.total * 100));
      }, () => { if (!cancelled) setStatus('error'); });

      const interval = window.matchMedia('(pointer: coarse)').matches ? 1000 / 30 : 1000 / 60;
      function tick(now) {
        frame = requestAnimationFrame(tick);
        if (hidden || !ready) { last = 0; return; }
        if (last && now - last < interval) return;
        const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
        last = now;
        controls.update();
        if (playingRef.current && mixer) { mixer.update(delta); needsRender = true; }
        if (needsRender) { renderer.render(scene, camera); needsRender = false; }
        if (now - lastUi > 150 && mixer && clipDuration) {
          setTime(mixer.time % clipDuration);
          lastUi = now;
        }
      }
      frame = requestAnimationFrame(tick);
    }
    init().catch(() => { cleanup(); if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; cleanup(); };
  }, [attempt]);

  const toggle = () => { playingRef.current = !playingRef.current; setPlaying(playingRef.current); };
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">Hail Mary<span>Our Lady of Perpetual Profit</span></Link>
        <Link className={styles.back} href="/">Back to the world <span aria-hidden="true">↗</span></Link>
      </header>
      <section className={styles.experience} aria-labelledby="texting-title">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>A moment between miracles</p>
          <h1 id="texting-title">Divine connection.</h1>
          <p className={styles.subtitle}>Even Our Lady has a message to send.</p>
        </div>
        <div className={styles.stage}>
          <div ref={host} className={styles.canvas} />
          {status === 'loading' && <div className={styles.message} role="status"><span className={styles.loader} />Bringing Our Lady into view{progress > 0 ? ` · ${progress}%` : '…'}</div>}
          {status === 'error' && <div className={styles.message} role="alert"><p>The sculpture couldn’t load. Please try again in a browser with WebGL enabled.</p><button onClick={() => setAttempt((n) => n + 1)}>Try again</button></div>}
          <p className={styles.gesture}>Drag to explore <span>·</span> Scroll or pinch to zoom</p>
        </div>
        <div className={styles.console} aria-label="Sculpture controls">
          <div className={styles.controls}>
            <button className={styles.play} onClick={toggle} disabled={status !== 'ready'} aria-label={playing ? 'Pause animation' : 'Play animation'}><span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{playing ? 'Pause' : 'Play'}</button>
            <label className={styles.timeline}><span className={styles.srOnly}>Animation position</span><input type="range" min="0" max={duration || 1} step="0.01" value={time} disabled={status !== 'ready'} aria-valuetext={`${time.toFixed(1)} seconds of ${duration.toFixed(1)} seconds`} onChange={(event) => api.current?.seek(Number(event.target.value))} /></label>
            <span className={styles.time}>{stamp(time)} / {stamp(duration)}</span>
            <button className={styles.reset} onClick={() => api.current?.reset()} disabled={status !== 'ready'}>Reset view</button>
          </div>
          <div className={styles.caption}><span>Our Lady, texting</span><div className={styles.rotation}><button onClick={() => api.current?.rotate(-Math.PI / 8)} disabled={status !== 'ready'} aria-label="Rotate sculpture left">←</button><span>Explore in 3D</span><button onClick={() => api.current?.rotate(Math.PI / 8)} disabled={status !== 'ready'} aria-label="Rotate sculpture right">→</button></div><span>Always connected.</span></div>
        </div>
      </section>
    </main>
  );
}
