/* =====================================================================
   Petri-dish water — real-time wave simulation (CodePen JS pane)
   - macro waves: GPU height-field, 2D wave equation on a ping-pong texture.
     Ripples propagate, reflect off the circular dish wall, and interfere.
   - micro detail: scrolling FBM normal in the wind direction.
   Three.js is pulled via dynamic import() so no importmap is needed.
   ===================================================================== */
(async () => {
	"use strict";

	let THREE;
	try {
		THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
	} catch (e) {
		THREE = await import(
			"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
		);
	}

	/* ---------------------------------------------------------------- config */
	const DISH_OUT = 4.95,
		DISH_IN = 4.62,
		RIM_Y = 1.95,
		BASE_Y = 0.22;
	const WATER_R = 4.55; // visible water radius
	const WATER_Y = 1.0; // resting water level
	const SIM = 256; // simulation texture resolution
	const UV_R = 0.46; // water radius in sim-texture uv space
	const WALL_R = 0.476; // reflecting wall radius in uv space
	const CENTER = new THREE.Vector3(0, 0.85, 0);

	const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
	const lerp = (a, b, t) => a + (b - a) * t;
	const norm2 = (x, z) => {
		const l = Math.hypot(x, z) || 1;
		return [x / l, z / l];
	};

	/* ------------------------------------------------------ shared GLSL chunk */
	const COMMON = /* glsl */ `
  uniform vec3  uKeyDir, uKeyColor, uAmb;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }
  // dim studio environment the water + glass reflect: mostly dark, with a soft
  // overhead light and one bright key light that ripples break into a glittering streak.
  vec3 envColor(vec3 dir){
    float up = dir.y;
    vec3 c = mix(vec3(0.012,0.018,0.03), vec3(0.07,0.10,0.15), smoothstep(-0.1,0.95,up));
    c += vec3(0.16,0.19,0.26) * smoothstep(0.62,1.0,up) * 0.35;        // soft overhead glow
    float k = max(dot(normalize(dir), normalize(uKeyDir)), 0.0);
    c += uKeyColor * (pow(k,500.0)*2.6 + pow(k,80.0)*0.35);            // key light streak
    return c;
  }
`;

	/* ============================================================ renderer/scene */
	const stage = document.getElementById("stage");
	const renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: false,
		powerPreference: "high-performance"
	});
	const isCoarse = matchMedia && matchMedia("(pointer:coarse)").matches;
	renderer.setPixelRatio(
		Math.min(window.devicePixelRatio || 1, isCoarse ? 1.0 : 1.6)
	);
	renderer.setClearColor(0x05060a, 1);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	stage.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(
		40,
		innerWidth / innerHeight,
		0.1,
		400
	);

	const keyDir = { value: new THREE.Vector3(0.45, 0.78, 0.3).normalize() };
	const keyColor = { value: new THREE.Color(1.0, 0.95, 0.86) };
	const ambLight = { value: new THREE.Color(1.0, 1.0, 1.0) }; // sky ambient (day→night), drives the dish only
	const envU = () => ({ uKeyDir: keyDir, uKeyColor: keyColor, uAmb: ambLight });

	/* ----------------------------------------------------------- dark backdrop */
	const backdrop = new THREE.Mesh(
		new THREE.SphereGeometry(120, 32, 16),
		new THREE.ShaderMaterial({
			side: THREE.BackSide,
			vertexShader: `varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
			fragmentShader: `varying vec3 vD;
      void main(){
        float up = normalize(vD).y*0.5+0.5;
        vec3 c = mix(vec3(0.015,0.02,0.032), vec3(0.05,0.065,0.09), smoothstep(0.15,0.85,up));
        c *= 0.9 + 0.1*up;
        gl_FragColor = vec4(c, 1.0);
      }`
		})
	);
	backdrop.renderOrder = -10;
	scene.add(backdrop);

	/* ================================================================= the dish
   One lathe-revolved thick-glass cross-section → seamless petri dish. */
	const glassMat = new THREE.ShaderMaterial({
		side: THREE.DoubleSide,
		transparent: true,
		depthWrite: false,
		uniforms: Object.assign(envU(), {
			uTint: { value: new THREE.Color(0xbfe2ff) }
		}),
		vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vW;
    void main(){ vN=normalize(mat3(modelMatrix)*normal);
      vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;
      gl_Position=projectionMatrix*viewMatrix*w; }`,
		fragmentShader:
			COMMON +
			/* glsl */ `
    uniform vec3 uTint;
    varying vec3 vN; varying vec3 vW;
    void main(){
      vec3 N=normalize(vN), V=normalize(cameraPosition-vW);
      if(dot(N,V)<0.0) N=-N;
      float fres=pow(1.0-clamp(dot(N,V),0.0,1.0),3.0);
      vec3 refl=envColor(reflect(-V,N));
      vec3 col=mix(uTint*0.05, refl, clamp(fres,0.0,1.0));
      vec3 H=normalize(V+uKeyDir);
      col += uKeyColor * pow(max(dot(N,H),0.0),120.0) * 1.5;   // crisp rim glints
      float alpha=clamp(0.05+fres*0.9,0.0,1.0);
      col *= uAmb;                                              // dish glass follows day→night
      // the dish floats in a void: its glass dissolves to black below the waterline
      float voidFade = smoothstep(${BASE_Y.toFixed(2)}, ${(
				WATER_Y * 0.96
			).toFixed(2)}, vW.y);
      col *= voidFade; alpha *= mix(0.04, 1.0, voidFade);
      gl_FragColor=vec4(pow(aces(col),vec3(1.0/2.2)), alpha);
    }`
	});
	function dishProfile() {
		const p = (r, y) => new THREE.Vector2(r, y);
		return [
			p(0, BASE_Y),
			p(DISH_IN, BASE_Y),
			p(DISH_IN, RIM_Y - 0.17),
			p(DISH_IN + 0.04, RIM_Y - 0.05),
			p((DISH_IN + DISH_OUT) / 2, RIM_Y),
			p(DISH_OUT - 0.04, RIM_Y - 0.05),
			p(DISH_OUT, RIM_Y - 0.2),
			p(DISH_OUT, 0.0),
			p(0, 0.0)
		];
	}
	const dish = new THREE.Mesh(
		new THREE.LatheGeometry(dishProfile(), 128),
		glassMat
	);
	dish.renderOrder = 12;
	scene.add(dish);

	// dish floor with animated caustics — the dancing light that makes it read as water.
	// caustics are driven by the real wave-height field (uHeight) so ripples cast moving light.
	const floorMat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uHeight: { value: null },
			uUvR: { value: UV_R },
			uWorldR: { value: WATER_R },
			uAmb: ambLight
		},
		vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
		fragmentShader: `
    precision highp float;
    uniform float uTime, uUvR, uWorldR; uniform sampler2D uHeight; uniform vec3 uAmb;
    varying vec2 vP;
    // classic procedural caustic (TDM) — the fine dancing net of light
    float caustic(vec2 uv){
      vec2 p = mod(uv*6.28318, 6.28318) - 250.0;
      vec2 i = p; float c = 1.0; float inten = 0.005;
      for (int n=0;n<5;n++){
        float t = uTime*0.55*(1.0 - (3.5/float(n+1)));
        i = p + vec2(cos(t-i.x)+sin(t+i.y), sin(t-i.y)+cos(t+i.x));
        c += 1.0/length(vec2(p.x/(sin(i.x+t)/inten), p.y/(cos(i.y+t)/inten)));
      }
      c /= 5.0; c = 1.17 - pow(c, 1.4);
      return pow(abs(c), 8.0);
    }
    void main(){
      float r = length(vP)/${DISH_IN.toFixed(2)};
      vec3 base = mix(vec3(0.10,0.23,0.29), vec3(0.03,0.10,0.16), smoothstep(0.0,1.05,r));
      // wave-driven focusing: troughs (concave) concentrate light → bright bands that travel
      vec2 uv = vec2(0.5) + (vP/uWorldR)*uUvR;
      float tx = 1.0/256.0;
      float h  = texture2D(uHeight, uv).r;
      float lap = texture2D(uHeight,uv+vec2(tx,0.)).r + texture2D(uHeight,uv-vec2(tx,0.)).r
                + texture2D(uHeight,uv+vec2(0.,tx)).r + texture2D(uHeight,uv-vec2(0.,tx)).r - 4.0*h;
      float focus = clamp(1.0 + lap*9.0, 0.4, 2.2);
      float ca = caustic(vP*0.32) * focus;
      base += vec3(0.45,0.72,0.82) * ca * 1.05 * (1.0 - r*0.25);
      gl_FragColor = vec4(base * max(uAmb, vec3(0.05)), 1.0);   // dish floor follows day→night
    }`
	});
	const floorDisc = new THREE.Mesh(
		new THREE.CircleGeometry(DISH_IN, 128),
		floorMat
	);
	floorDisc.rotation.x = -Math.PI / 2;
	floorDisc.position.y = BASE_Y + 0.004;
	scene.add(floorDisc);

	// off-screen target holding "everything under the water" for refraction
	const refractRT = new THREE.WebGLRenderTarget(2, 2, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter
	});
	const uRefract = { value: refractRT.texture };
	const uResolution = { value: new THREE.Vector2(2, 2) };

	/* ====================================================== water simulation
   State texture stores (height, velocity) in the R,G channels. */
	const simRT = () =>
		new THREE.WebGLRenderTarget(SIM, SIM, {
			type: THREE.HalfFloatType,
			format: THREE.RGBAFormat,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			wrapS: THREE.ClampToEdgeWrapping,
			wrapT: THREE.ClampToEdgeWrapping,
			depthBuffer: false,
			stencilBuffer: false
		});
	let rtA = simRT(),
		rtB = simRT();

	const simUniforms = {
		uState: { value: null },
		uTexel: { value: 1 / SIM },
		uTime: { value: 0 },
		uWindDir: { value: new THREE.Vector2(1, 0) },
		uWindStr: { value: 0.45 },
		uSpeed: { value: 0.18 }, // wave speed (CFL: keep well under 0.25 for this scheme)
		uDamp: { value: 0.9975 }, // velocity damping (light → waves actually oscillate)
		uWallR: { value: WALL_R },
		uPokes: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(0, 0, 0)) },
		uPokeCount: { value: 0 },
		uFoamPts: {
			value: Array.from({ length: 26 }, () => new THREE.Vector2(0.5, 0.5))
		}, // hull waterline in sim UV
		uFoamCount: { value: 0 },
		uFoamStr: { value: 0.0 } // foam strength (pulses with bob speed)
	};
	const simMat = new THREE.ShaderMaterial({
		uniforms: simUniforms,
		vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}`,
		fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D uState; uniform float uTexel, uTime, uWindStr, uSpeed, uDamp, uWallR;
    uniform vec2 uWindDir; uniform vec3 uPokes[4]; uniform int uPokeCount;
    uniform vec2 uFoamPts[26]; uniform int uFoamCount; uniform float uFoamStr;
    varying vec2 vUv;
    float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
    void main(){
      vec2 uv=vUv;
      float rc=distance(uv,vec2(0.5));
      if(rc>uWallR){ gl_FragColor=vec4(0.0,0.0,0.0,1.0); return; }  // wall texel
      vec4 s=texture2D(uState,uv);
      float h=s.r, v=s.g, foam=s.b;
      // Neumann wall: a neighbour outside the dish mirrors the centre height (zero gradient)
      vec2 ox=vec2(uTexel,0.0), oy=vec2(0.0,uTexel);
      float hl = distance(uv-ox,vec2(0.5))>uWallR ? h : texture2D(uState,uv-ox).r;
      float hr = distance(uv+ox,vec2(0.5))>uWallR ? h : texture2D(uState,uv+ox).r;
      float hd = distance(uv-oy,vec2(0.5))>uWallR ? h : texture2D(uState,uv-oy).r;
      float hu = distance(uv+oy,vec2(0.5))>uWallR ? h : texture2D(uState,uv+oy).r;
      float avg = (hl+hr+hd+hu)*0.25;
      float lap = (hl+hr+hd+hu) - 4.0*h;
      v += lap * uSpeed;
      v *= uDamp;
      // wind: medium-frequency travelling forcing → random waves that march downwind
      float w = vnoise(uv*11.0 - uWindDir*uTime*0.9)*0.5 + vnoise(uv*22.0 + uWindDir*uTime*0.55)*0.5;
      v += (w*2.0-1.0) * uWindStr * 0.004;
      // pokes (velocity impulses)
      for(int i=0;i<4;i++){ if(i>=uPokeCount) break;
        float d=distance(uv,uPokes[i].xy); v += uPokes[i].z * exp(-d*d*2200.0); }
      h += v;
      h = mix(h, avg, 0.022);      // numerical viscosity: kills grid-scale instability
      h *= 0.9993;                 // gentle return to flat
      v = clamp(v, -4.0, 4.0);     // safety net against runaway
      h = clamp(h, -4.0, 4.0);

      // ---- foam: born on breaking crests + where waves slam the wall, then lingers ----
      float steepness = abs(lap) * 6.0;                         // curvature of the surface
      float wallSplash = smoothstep(uWallR*0.88, uWallR, rc) * smoothstep(0.06,0.22,abs(v));
      float born = max(smoothstep(0.9, 2.4, steepness), wallSplash);
      // foam churned up where the HULL actually meets the water: blobs at each
      // waterline-contact point (which heel & bob with the boat) merge into a ring
      // that tracks the real footprint, then boils & dissipates with the sim.
      float wlFoam = 0.0;
      for (int i=0;i<26;i++){ if(i>=uFoamCount) break;
        wlFoam = max(wlFoam, smoothstep(0.028, 0.004, distance(uv, uFoamPts[i]))); }
      float churn = 0.55 + 0.45*vnoise(uv*70.0 - uWindDir*uTime*2.4 + vec2(uTime*1.5));
      born = max(born, wlFoam * churn * uFoamStr);
      foam = max(foam*0.965, born);                             // accumulate, then dissipate
      foam = clamp(foam, 0.0, 1.0);
      gl_FragColor = vec4(h, v, foam, 1.0);
    }`
	});
	const simScene = new THREE.Scene();
	const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat));

	// clear both targets to flat water
	(function clearSim() {
		const prev = renderer.getClearColor(new THREE.Color());
		const prevA = renderer.getClearAlpha();
		renderer.setClearColor(0x000000, 1);
		for (const rt of [rtA, rtB]) {
			renderer.setRenderTarget(rt);
			renderer.clear(true, true, true);
		}
		renderer.setRenderTarget(null);
		renderer.setClearColor(prev, prevA);
	})();

	const pokeQueue = []; // {uv:Vector2, amp}
	function stepSim(dt, withPokes) {
		simUniforms.uState.value = rtA.texture;
		if (withPokes && pokeQueue.length) {
			const n = Math.min(4, pokeQueue.length);
			for (let i = 0; i < n; i++) {
				const p = pokeQueue[i];
				simUniforms.uPokes.value[i].set(p.uv.x, p.uv.y, p.amp);
			}
			simUniforms.uPokeCount.value = n;
			pokeQueue.length = 0;
		} else simUniforms.uPokeCount.value = 0;
		renderer.setRenderTarget(rtB);
		renderer.render(simScene, simCam);
		renderer.setRenderTarget(null);
		const t = rtA;
		rtA = rtB;
		rtB = t;
	}

	/* ===================================================================== water
   Polar grid disc; vertex displaced by the sim height, normal from its gradient. */
	function waterGrid(radius, rings, seg) {
		const pos = [0, 0, 0],
			uv = [0.5, 0.5],
			idx = [];
		for (let r = 1; r <= rings; r++) {
			const rad = (radius * r) / rings;
			for (let s = 0; s < seg; s++) {
				const a = (s / seg) * Math.PI * 2,
					x = Math.cos(a) * rad,
					z = Math.sin(a) * rad;
				pos.push(x, 0, z);
				uv.push(0.5 + (x / radius) * UV_R, 0.5 + (z / radius) * UV_R);
			}
		}
		const v = (r, s) => 1 + (r - 1) * seg + (s % seg);
		for (let s = 0; s < seg; s++) idx.push(0, v(1, s), v(1, s + 1));
		for (let r = 2; r <= rings; r++)
			for (let s = 0; s < seg; s++) {
				idx.push(v(r - 1, s), v(r, s), v(r, s + 1));
				idx.push(v(r - 1, s), v(r, s + 1), v(r - 1, s + 1));
			}
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
		g.setIndex(idx);
		return g;
	}
	/* ====== Gerstner ocean: summed directional waves → clashing, choppy sea ====== */
	const OCEAN_WAVES = [
		{ d: [1.0, 0.25], len: 6.6, amp: 0.16, steep: 1.0 },
		{ d: [0.6, 0.8], len: 4.2, amp: 0.11, steep: 0.95 },
		{ d: [-0.45, 0.9], len: 2.9, amp: 0.075, steep: 0.9 },
		{ d: [0.85, -0.5], len: 2.0, amp: 0.05, steep: 0.85 },
		{ d: [-0.9, -0.35], len: 1.4, amp: 0.035, steep: 0.8 },
		{ d: [0.25, 1.0], len: 0.95, amp: 0.022, steep: 0.75 },
		{ d: [-1.0, 0.15], len: 0.65, amp: 0.014, steep: 0.7 },
		{ d: [0.5, -0.9], len: 0.45, amp: 0.009, steep: 0.65 }
	];
	const GERSTNER_CALLS = OCEAN_WAVES.map((w) => {
		const d = norm2(w.d[0], w.d[1]);
		return `gerstner(vec2(${d[0].toFixed(4)},${d[1].toFixed(4)}),${w.len.toFixed(
			3
		)},${w.amp.toFixed(4)},${w.steep.toFixed(3)},xz,disp,nrm,J);`;
	}).join("\n      ");

	const waterMat = new THREE.ShaderMaterial({
		side: THREE.DoubleSide, // polar-grid winding faces down; view is from above
		uniforms: Object.assign(envU(), {
			uHeight: { value: null },
			uTexel: { value: 1 / SIM },
			uTime: { value: 0 },
			uWaterY: { value: WATER_Y },
			uWorldR: { value: WATER_R },
			uUvR: { value: UV_R },
			uChop: { value: 1.0 },
			uSpeed: { value: 1.0 },
			uDispSim: { value: 0.13 },
			uWindDir: { value: new THREE.Vector2(1, 0) },
			uWindAngle: { value: 0.6 },
			uRefract,
			uResolution,
			uRefractAmt: { value: 0.055 },
			uTideDir: { value: new THREE.Vector2(1, 0) },
			uTide: { value: 0.0 }
		}),
		vertexShader: /* glsl */ `
    uniform sampler2D uHeight; uniform float uTime, uWaterY, uChop, uSpeed, uDispSim, uWorldR, uWindAngle, uTide;
    uniform vec2 uTideDir;
    varying vec2 vUv; varying vec3 vW; varying vec3 vGN; varying float vJac; varying float vH;
    void gerstner(vec2 D, float len, float amp, float steep, vec2 xz, inout vec3 disp, inout vec3 nrm, inout vec3 J){
      float ca=cos(uWindAngle), sa=sin(uWindAngle);
      D = vec2(D.x*ca - D.y*sa, D.x*sa + D.y*ca);     // steer the swell with the wind
      float k = 6.2831853/len;
      float c = sqrt(9.8/k);
      float A = amp*uChop;
      float Q = steep/(k*A*8.0 + 1e-5);
      float ph = k*dot(D,xz) - c*uTime*uSpeed;
      float cph=cos(ph), sph=sin(ph);
      disp.x += Q*A*D.x*cph;  disp.z += Q*A*D.y*cph;  disp.y += A*sph;
      nrm.x -= D.x*k*A*cph;   nrm.z -= D.y*k*A*cph;    nrm.y -= Q*k*A*sph;
      J.x -= Q*D.x*D.x*k*A*sph;  J.y -= Q*D.y*D.y*k*A*sph;  J.z -= Q*D.x*D.y*k*A*sph;
    }
    void main(){
      vec2 xz = position.xz;
      float damp = 1.0 - smoothstep(uWorldR*0.82, uWorldR*0.995, length(xz)); // calm at the glass
      vec3 disp = vec3(0.0); vec3 nrm = vec3(0.0,1.0,0.0); vec3 J = vec3(1.0,1.0,0.0);
      ${GERSTNER_CALLS}
      disp *= damp; nrm.x *= damp; nrm.z *= damp;
      float sh = texture2D(uHeight, uv).r * uDispSim;       // interactive poke ripples on top
      float tide = uTide * dot(xz, uTideDir) * damp;        // moon tilts the surface toward its azimuth
      vec3 p = position + disp;
      p.y = uWaterY + clamp(disp.y, -0.8, 0.8) + sh + tide;
      nrm.x -= uTide*uTideDir.x; nrm.z -= uTide*uTideDir.y; // tilt the normal so light/streak follows
      vUv = uv; vGN = nrm; vJac = J.x*J.y - J.z*J.z; vH = disp.y;
      vec4 w = modelMatrix*vec4(p,1.0); vW = w.xyz;
      gl_Position = projectionMatrix*viewMatrix*w;
    }`,
		fragmentShader:
			COMMON +
			/* glsl */ `
    uniform sampler2D uHeight, uRefract; uniform vec2 uWindDir, uResolution;
    uniform float uTexel, uTime, uWorldR, uUvR, uRefractAmt, uDispSim;
    varying vec2 vUv; varying vec3 vW; varying vec3 vGN; varying float vJac; varying float vH;
    void main(){
      vec3 N = normalize(vGN);
      // interactive poke-ripple slope + fine animated shimmer on top of the swell
      float hl=texture2D(uHeight,vUv-vec2(uTexel,0.)).r, hr=texture2D(uHeight,vUv+vec2(uTexel,0.)).r;
      float hd=texture2D(uHeight,vUv-vec2(0.,uTexel)).r, hu=texture2D(uHeight,vUv+vec2(0.,uTexel)).r;
      float scs = uDispSim/(uTexel*uWorldR/uUvR);
      N.x -= (hr-hl)*scs; N.z -= (hu-hd)*scs;
      vec2 dd = uWindDir*uTime*0.6 + vec2(uTime*0.1);
      N.x += (fbm(vW.xz*7.0-dd)-0.5)*0.05; N.z += (fbm(vW.xz*7.0+9.0-dd)-0.5)*0.05;
      N = normalize(N);

      vec3 V = normalize(cameraPosition - vW);
      vec3 R = reflect(-V,N); R.y = abs(R.y)+0.02;
      vec3 sky = envColor(R);
      // near-matte: barely any sky mirror, even at grazing angles → you see through
      float fres = mix(0.008, 0.075, pow(1.0-max(dot(N,V),0.0), 5.0));

      // CLEAR water: see through to the caustic-lit bottom, bent by the ripples and
      // tinted by depth (Beer-Lambert) — deep troughs go teal, crests stay clear
      vec2 suv = gl_FragCoord.xy/uResolution;
      vec3 bottom = texture2D(uRefract, clamp(suv + N.xz*uRefractAmt,0.002,0.998)).rgb * 1.28;
      vec3 waterTint = vec3(0.84,0.93,0.97);            // almost clear, the faintest aqua
      vec3 deepCol   = vec3(0.03,0.18,0.25);
      float depth = clamp(0.05 - vH*0.13, 0.008, 0.20); // crystal clear — floor + hull read through
      vec3 base = mix(bottom*waterTint, deepCol, depth);

      // subtle subsurface glow on the crests
      float sss = pow(max(0.0, dot(V,-uKeyDir)+0.35), 3.0) * clamp(vH*2.6,0.0,1.0);
      base += vec3(0.0,0.4,0.34) * sss * 0.5;

      vec3 col = mix(base, sky, fres);
      float spec = max(dot(N, normalize(V+uKeyDir)),0.0);
      col += uKeyColor * (pow(spec,700.0)*1.6 + pow(spec,90.0)*0.08);  // faint glints only
      col *= uAmb;                                                     // day → night (dish only)

      // ---- foam: crest whitecaps + a CHURNING rim band + a collar around the boat ----
      float fold = smoothstep(0.42, 0.0, vJac);          // crisp caps on sharp folds only
      float simFoam = texture2D(uHeight, vUv).b;
      float rr = length(vW.xz);
      // churning rim foam: a band by the glass that boils and drifts around the rim
      float ang = atan(vW.z, vW.x);
      float rimBand = smoothstep(uWorldR*0.90, uWorldR*0.985, rr);
      float rimChurn = fbm(vec2(ang*3.0, rr*5.5) - vec2(uTime*1.25, uTime*0.55))*1.1
                     + 0.45*sin(ang*20.0 + uTime*3.2);
      float edge = rimBand * clamp(0.30 + 0.75*rimChurn, 0.0, 1.0);
      // (boat foam now lives in the sim's foam channel — read via simFoam below —
      //  so it tracks the real heeling/bobbing hull instead of a flat painted ring)
      // foam where the water piles up high (tall crests / waves heaping on each other)
      float crestFoam = smoothstep(0.16, 0.42, vH) * 0.7;
      float foamAmt = max(max(max(fold, simFoam), edge), crestFoam);
      float ftex = fbm(vW.xz*13.0 - uWindDir*uTime*0.5);
      float fm = smoothstep(0.34, 0.72, foamAmt + (ftex-0.5)*0.6);
      col = mix(col, vec3(0.92,0.96,0.98)*max(uAmb,vec3(0.12)), clamp(fm,0.0,1.0)*0.95);

      gl_FragColor = vec4(pow(aces(col), vec3(1.0/2.2)), 1.0);
    }`
	});
	const water = new THREE.Mesh(waterGrid(WATER_R, 96, 192), waterMat);
	water.position.y = 0;
	water.renderOrder = 2;
	scene.add(water);

	/* ================================================================ boat asset
   Loads a .glb and floats it on the Gerstner ocean (height + tilt sampled in JS). */
	let boatModel = null;
	const boatGroup = new THREE.Group();
	scene.add(boatGroup);
	const keyLight = new THREE.DirectionalLight(0xffeedd, 2.4);
	keyLight.position.set(6, 9, 4);
	scene.add(keyLight);
	const fillLight = new THREE.HemisphereLight(0x9fc4e6, 0x0a1820, 0.8);
	scene.add(fillLight);
	const ambient = new THREE.AmbientLight(0x22324a, 0.06);
	scene.add(ambient);

	/* ===================================================== sun & moon + stars
   The sun and moon orbit the dish, counter-rotating — so they sit on opposite
   sides yet sweep together into an ECLIPSE at the quarter turns. A slider drives
   the phase. Their light falls ONLY on the dish (nothing else in the void to
   light); the moon brings night to the dish; stars fade up in the surrounding
   dark. Bodies fade out below the horizon so nothing shows beneath the dish. */
	const SKY_CENTER = new THREE.Vector3(0, 1.2, 0);
	const SUN_ORB = 14,
		MOON_ORB = 10; // close to the dish; moon nearer (eclipses the sun)
	let skyPhase = 0.13; // 0..1 sky dial (day → eclipse → night), set by the knob
	let tideFX = 0,
		tideFZ = 0; // tidal pull on the boat, set by the moon (updateSky)
	const _vSun = new THREE.Vector3(),
		_vMoon = new THREE.Vector3(),
		_dSun = new THREE.Vector3(),
		_dMoon = new THREE.Vector3(),
		_kdir = new THREE.Vector3();
	// a body's unit direction from (elevation-sine, azimuth)
	function bodyDir(elevSin, azim, out) {
		const h = Math.sqrt(Math.max(0, 1.0 - elevSin * elevSin));
		return out.set(h * Math.cos(azim), elevSin, h * Math.sin(azim));
	}
	function glowSprite(stop, size) {
		const cv = document.createElement("canvas");
		cv.width = cv.height = 128;
		const x = cv.getContext("2d");
		const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
		g.addColorStop(0, "rgba(255,255,255,0.95)");
		g.addColorStop(0.28, stop);
		g.addColorStop(1, "rgba(0,0,0,0)");
		x.fillStyle = g;
		x.fillRect(0, 0, 128, 128);
		const t = new THREE.CanvasTexture(cv);
		t.colorSpace = THREE.SRGBColorSpace;
		const m = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: t,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending
			})
		);
		m.scale.set(size, size, 1);
		return m;
	}
	// procedural surface textures (equirectangular, mapped onto the spheres)
	function makeMoonTex() {
		const cv = document.createElement("canvas");
		cv.width = 512;
		cv.height = 256;
		const x = cv.getContext("2d");
		x.fillStyle = "#979ba3";
		x.fillRect(0, 0, 512, 256);
		for (let i = 0; i < 8; i++) {
			// dark maria
			const px = Math.random() * 512,
				py = Math.random() * 256,
				r = 28 + Math.random() * 64;
			const g = x.createRadialGradient(px, py, 0, px, py, r);
			g.addColorStop(0, "rgba(92,97,107,0.75)");
			g.addColorStop(1, "rgba(92,97,107,0)");
			x.fillStyle = g;
			x.beginPath();
			x.arc(px, py, r, 0, 7);
			x.fill();
		}
		for (let i = 0; i < 110; i++) {
			// craters: shadow + bright rim + highlight
			const px = Math.random() * 512,
				py = Math.random() * 256,
				r = 2 + Math.random() * 11;
			x.beginPath();
			x.arc(px, py, r, 0, 7);
			x.fillStyle = "rgba(70,74,82,0.5)";
			x.fill();
			x.lineWidth = 1.1;
			x.strokeStyle = "rgba(196,200,206,0.5)";
			x.stroke();
			x.beginPath();
			x.arc(px - r * 0.3, py - r * 0.3, r * 0.5, 0, 7);
			x.fillStyle = "rgba(205,209,214,0.22)";
			x.fill();
		}
		for (let i = 0; i < 2600; i++) {
			const v = (120 + Math.random() * 70) | 0;
			x.fillStyle = "rgba(" + v + "," + v + "," + (v + 8) + ",0.05)";
			x.fillRect(Math.random() * 512, Math.random() * 256, 1, 1);
		}
		const t = new THREE.CanvasTexture(cv);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 4;
		return t;
	}
	function makeSunTex() {
		const cv = document.createElement("canvas");
		cv.width = 512;
		cv.height = 256;
		const x = cv.getContext("2d");
		x.fillStyle = "#ff9a20";
		x.fillRect(0, 0, 512, 256);
		for (let i = 0; i < 300; i++) {
			// granulation: bright + dark cells
			const px = Math.random() * 512,
				py = Math.random() * 256,
				r = 6 + Math.random() * 22,
				hot = Math.random() < 0.6;
			const g = x.createRadialGradient(px, py, 0, px, py, r);
			if (hot) {
				g.addColorStop(0, "rgba(255,228,128,0.55)");
				g.addColorStop(1, "rgba(255,228,128,0)");
			} else {
				g.addColorStop(0, "rgba(214,82,8,0.5)");
				g.addColorStop(1, "rgba(214,82,8,0)");
			}
			x.fillStyle = g;
			x.beginPath();
			x.arc(px, py, r, 0, 7);
			x.fill();
		}
		for (let i = 0; i < 6; i++) {
			// sunspots
			const px = Math.random() * 512,
				py = Math.random() * 256,
				r = 4 + Math.random() * 7;
			const g = x.createRadialGradient(px, py, 0, px, py, r);
			g.addColorStop(0, "rgba(120,28,0,0.85)");
			g.addColorStop(0.6, "rgba(170,58,0,0.5)");
			g.addColorStop(1, "rgba(170,58,0,0)");
			x.fillStyle = g;
			x.beginPath();
			x.arc(px, py, r, 0, 7);
			x.fill();
		}
		const t = new THREE.CanvasTexture(cv);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 4;
		return t;
	}
	const sunDisc = new THREE.Mesh(
		new THREE.SphereGeometry(1.0, 28, 18),
		new THREE.MeshBasicMaterial({
			map: makeSunTex(),
			color: 0xffffff,
			transparent: true,
			depthWrite: false
		})
	);
	const sunGlow = glowSprite("rgba(255,206,120,0.9)", 6.2);
	const sun = new THREE.Group();
	sun.add(sunDisc);
	sun.add(sunGlow);
	scene.add(sun);
	const _moonTex = makeMoonTex();
	const moonDisc = new THREE.Mesh(
		new THREE.SphereGeometry(0.78, 28, 18),
		new THREE.MeshStandardMaterial({
			map: _moonTex,
			bumpMap: _moonTex,
			bumpScale: 0.01,
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			emissive: 0x0a1018,
			emissiveIntensity: 1,
			transparent: true,
			depthWrite: false
		})
	);
	const moonGlow = glowSprite("rgba(150,185,235,0.4)", 2.8);
	const moon = new THREE.Group();
	moon.add(moonDisc);
	moon.add(moonGlow);
	scene.add(moon);
	// stars: far points on a dome, behind the dish, fade in at night (don't obstruct)
	const STAR_N = 720,
		_starPos = new Float32Array(STAR_N * 3);
	for (let i = 0; i < STAR_N; i++) {
		const a = Math.random() * Math.PI * 2,
			el = Math.acos(2 * Math.random() - 1),
			R = 95;
		_starPos[i * 3] = Math.sin(el) * Math.cos(a) * R;
		_starPos[i * 3 + 1] = Math.abs(Math.cos(el)) * R + 6;
		_starPos[i * 3 + 2] = Math.sin(el) * Math.sin(a) * R;
	}
	const starGeo = new THREE.BufferGeometry();
	starGeo.setAttribute("position", new THREE.BufferAttribute(_starPos, 3));
	const starMat = new THREE.PointsMaterial({
		color: 0xd6ddff,
		size: 0.55,
		sizeAttenuation: true,
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const stars = new THREE.Points(starGeo, starMat);
	stars.frustumCulled = false;
	stars.renderOrder = -5;
	scene.add(stars);

	const _warmC = new THREE.Color(1.0, 0.93, 0.8),
		_coolC = new THREE.Color(0.42, 0.55, 0.92);
	const _ambDay = new THREE.Color(1.0, 0.99, 0.96),
		_ambNight = new THREE.Color(0.1, 0.16, 0.3);
	const _skyDayC = new THREE.Color(0x9fc4e6),
		_skyNightC = new THREE.Color(0x142236),
		_tmpC = new THREE.Color();
	const _sss = (a, b, x) => {
		x = clamp((x - a) / (b - a), 0, 1);
		return x * x * (3 - 2 * x);
	};
	function updateSky() {
		const phase = skyPhase * Math.PI * 2,
			A0 = 0.6;
		// sun rises & sets; moon is antipodal in elevation (up at night) but its azimuth
		// sweeps the opposite way, so they converge into an eclipse at dusk & dawn.
		bodyDir(Math.cos(phase), phase + A0, _dSun);
		bodyDir(-Math.cos(phase), -phase + A0 + Math.PI, _dMoon);
		sun.position.copy(_dSun).multiplyScalar(SUN_ORB).add(SKY_CENTER);
		moon.position.copy(_dMoon).multiplyScalar(MOON_ORB).add(SKY_CENTER);
		const sunVis = _sss(-0.22, -0.02, _dSun.y),
			moonVis = _sss(-0.22, -0.02, _dMoon.y); // fade below horizon
		const sunLit = _sss(-0.02, 0.5, _dSun.y),
			moonLit = _sss(-0.02, 0.5, _dMoon.y); // how high → how bright
		const ecl = _sss(0.988, 0.999, _dSun.dot(_dMoon)) * Math.max(sunVis, 0.0); // moon covers sun
		const day = sunLit * (1.0 - ecl),
			cool = (1.0 - sunLit) * moonLit + ecl * 0.0;
		_kdir
			.copy(_dSun)
			.multiplyScalar(sunLit)
			.addScaledVector(_dMoon, 1.0 - sunLit);
		if (_kdir.lengthSq() < 1e-4) _kdir.copy(_dSun);
		_kdir.normalize();
		keyDir.value.copy(_kdir);
		keyLight.position.copy(_kdir).multiplyScalar(40).add(SKY_CENTER);
		const warmth = day / (day + cool + 1e-4);
		keyLight.color.copy(_warmC).lerp(_coolC, 1.0 - warmth);
		keyLight.intensity = 2.8 * day + 0.7 * cool + 0.02;
		keyColor.value
			.copy(keyLight.color)
			.multiplyScalar(0.55 * day + 0.25 * cool + 0.02);
		_tmpC
			.copy(_ambNight)
			.lerp(_ambDay, day)
			.multiplyScalar(0.16 + 0.84 * Math.max(day, cool * 0.6));
		ambLight.value.copy(_tmpC);
		fillLight.color.copy(_skyNightC).lerp(_skyDayC, day);
		fillLight.intensity = 0.7 * day + 0.22 * cool + 0.05;
		ambient.intensity = 0.05 + 0.05 * day + 0.04 * cool;
		sunDisc.material.opacity = sunVis;
		sunGlow.material.opacity = sunVis * (0.85 - 0.4 * ecl) + ecl * 0.95; // corona at eclipse
		moonDisc.material.opacity = moonVis;
		moonDisc.material.emissiveIntensity = 0.4 + 1.7 * cool;
		moonGlow.material.opacity = moonVis * 0.22 * (1.0 - day * 0.6); // faint halo — let the craters show
		starMat.opacity = clamp((1.0 - sunLit) * 0.9 - 0.12 + ecl * 0.9, 0, 1);
		// MOON TIDE: the moon tilts the water toward its azimuth + tugs the boat that way,
		// strongest when the moon is high. Rotating the knob sweeps the tide around the dish.
		const mh = Math.hypot(_dMoon.x, _dMoon.z) || 1,
			tideStr = moonLit;
		waterMat.uniforms.uTideDir.value.set(_dMoon.x / mh, _dMoon.z / mh);
		waterMat.uniforms.uTide.value = 0.055 * tideStr; // visual tilt of the surface
		tideFX = (_dMoon.x / mh) * 0.34 * tideStr; // horizontal pull on the boat
		tideFZ = (_dMoon.z / mh) * 0.34 * tideStr;
		// boat lantern: glows + casts warm light when it gets dark (night / eclipse)
		if (boatModel && boatModel.userData.lamp) {
			const lit = clamp(1.0 - sunLit + ecl, 0, 1),
				L = boatModel.userData.lamp;
			L.mat.emissiveIntensity = 0.1 + lit * 1.7;
			L.halo.material.opacity = lit * 0.95;
			L.light.intensity = lit * 2.4;
		}
		const vS = document.getElementById("vSky");
		if (vS)
			vS.textContent =
				ecl > 0.4 ? "eclipse" : day > 0.55 ? "day" : day > 0.12 ? "dusk" : "night";
	}

	const boatPos = { x: 0.2, z: -0.1, heading: 0.95, speed: 0, bvx: 0, bvz: 0 };
	/* =====================================================================
   makeBoat() — procedural Three.js r160 sailboat, drop-in for the
   petri-dish ocean scene.

   Coordinate system (matches the scene exactly):
     bow = +X, stern = -X, beam = +/-Z, up = +Y, WATERLINE at y = 0.
     Overall length ~2.9, beam ~1.0, deck top ~+0.215, keel ~-0.28.
   The returned group is added to boatGroup (placed at world y =
   WATER_Y + waveHeight and tilted to the wave normal); the caller also
   sets boatModel.rotation.y = heading.  So y = 0 here IS the waterline.

   HULL + DECK is built as ONE closed, watertight, OUTWARD-wound manifold
   BufferGeometry (positive signed volume) rendered FrontSide — the only
   geometrically-correct, backface-cullable combination under the scene's
   ACES + DirectionalLight key.  The deck closes the gunwale opening flush
   (no inset gap) and is recoloured via a geometry index-group (warm teak)
   so there is NO floating cosmetic slab.

   Superstructure / rig are separate inherently-closed primitives seated on
   the deck.  Sails / jib / flag are a self-contained Verlet CLOTH system,
   advanced via g.userData.updateCloth(dt, windLocalVec3, t).
   ===================================================================== */
	function makeBoat() {
		const g = new THREE.Group();

		// ---------- shared materials (MeshStandardMaterial only) ----------
		const matHull = new THREE.MeshStandardMaterial({
			color: 0x6b4226,
			roughness: 0.72,
			metalness: 0.05,
			side: THREE.FrontSide
		});
		const matDeck = new THREE.MeshStandardMaterial({
			color: 0xb08a55,
			roughness: 0.8,
			metalness: 0.04,
			side: THREE.FrontSide
		});
		const matTop = new THREE.MeshStandardMaterial({
			color: 0xeee3d0,
			roughness: 0.62,
			metalness: 0.03,
			side: THREE.FrontSide
		});
		const matTrim = new THREE.MeshStandardMaterial({
			color: 0x4e3320,
			roughness: 0.7,
			metalness: 0.05
		});
		const matMast = new THREE.MeshStandardMaterial({
			color: 0x4e3320,
			roughness: 0.6,
			metalness: 0.06
		});
		const matSail = new THREE.MeshStandardMaterial({
			color: 0xeee3d0,
			roughness: 0.85,
			metalness: 0.0,
			side: THREE.DoubleSide
		});
		const matBrass = new THREE.MeshStandardMaterial({
			color: 0xc9a227,
			roughness: 0.35,
			metalness: 0.65
		});
		const matGlass = new THREE.MeshStandardMaterial({
			color: 0x223742,
			roughness: 0.22,
			metalness: 0.3
		});
		const matFlag = new THREE.MeshStandardMaterial({
			color: 0xc0392b,
			roughness: 0.7,
			metalness: 0.0,
			side: THREE.DoubleSide
		});
		const matRope = new THREE.MeshStandardMaterial({
			color: 0x2a2018,
			roughness: 0.9,
			metalness: 0.0
		});

		// ===================================================================
		//  HULL + DECK  -- ONE closed watertight manifold BufferGeometry.
		//
		//  Topology: a sequence of CLOSED station loops along X. Each loop runs:
		//    starboard gunwale (top, +Z) -> down the skin to keel centreline ->
		//    up the port side -> port gunwale (top, -Z) -> across the DECK back
		//    to the starboard gunwale (the deck spans the top between gunwales).
		//  Consecutive loops are stitched into a tube. The two ends are closed
		//  with triangle fans:
		//    * BOW   -> a single raked stem apex (sharp bow).
		//    * STERN -> a FLAT planar transom fan: every stern-loop vertex meets
		//      a centroid placed *in the transom plane* (same X as the loop), so
		//      the stern reads as a firm flat transom, not a soft point.
		//  Result is a topological sphere: every edge shared by exactly 2 tris
		//  (zero boundary, zero non-manifold edges), wound OUTWARD (vol > 0).
		//
		//  Deck triangles are tagged into a second index group so the deck can be
		//  recoloured warm teak (matDeck) while the skin stays hull-brown
		//  (matHull) — all in ONE geometry, no floating slab.
		// ===================================================================
		const STATIONS = 19; // cross-sections along the length
		const SIDE_PTS = 7; // hull-skin points per side, gunwale -> keel
		const DECK_PTS = 7; // deck-span points, port gunwale -> starboard (finer camber)
		const Lbow = 1.46,
			Lstern = -1.45; // overall length ~2.91

		// --- station shape functions (t in [0,1], 0 = stern, 1 = bow) ---
		function halfBeam(t) {
			const tc = Math.min(Math.max(t, 0), 1);
			const bell = Math.sin(Math.PI * Math.pow(tc, 0.85)); // fullness amidships
			let w = 0.5 * (0.2 + 0.8 * bell);
			if (tc > 0.8) w *= 1.0 - ((tc - 0.8) / 0.2) * 0.92; // pinch to sharp bow
			if (tc < 0.1) w *= 0.78 + 0.22 * (tc / 0.1); // firm transom narrowing
			return w;
		}
		function keelY(t) {
			const trough = -0.28;
			const fromMid = t - 0.44;
			const rise =
				fromMid >= 0
					? Math.pow(fromMid / 0.56, 1.7) * 0.31 // bow rake up
					: Math.pow(-fromMid / 0.44, 1.6) * 0.15; // stern lift
			return trough + rise;
		}
		function sheerY(t) {
			const base = 0.215;
			const curve = Math.pow(Math.abs(t - 0.46) / 0.54, 1.8);
			return base + curve * 0.085; // deck/gunwale height
		}
		function stationX(t) {
			return Lstern + (Lbow - Lstern) * t;
		}

		// A station cross-section: SIDE_PTS down the starboard skin (gunwale->keel),
		// returns array of {y,z} on the +Z side. z=0 at keel.
		function skinSide(t) {
			const hb = halfBeam(t),
				ky = keelY(t),
				sy = sheerY(t);
			const pts = [];
			for (let j = 0; j < SIDE_PTS; j++) {
				const a = j / (SIDE_PTS - 1); // 0 gunwale -> 1 keel
				const ang = a * Math.PI * 0.5;
				const z = hb * Math.cos(ang);
				const y = sy + (ky - sy) * Math.sin(ang);
				pts.push({ y, z });
			}
			return pts;
		}

		// Build one CLOSED loop of vertices for station t, push into posArr,
		// return {start, count} describing the contiguous vertex range.
		// Loop order (forms a simple closed polygon, CCW seen from +X bow):
		//   [0 .. SIDE_PTS-1]              starboard skin: gunwale(+Z) down to keel
		//   [SIDE_PTS .. 2*SIDE_PTS-3]     port skin: keel(excl) up to gunwale(excl)
		//   [.. + DECK_PTS-2]              deck span: port gunwale -> starboard, excl ends
		// The deck span is gently CROWNED (cambered up) so it sheds water and is
		// not dead flat — graft from the cand_2 deck.
		function pushLoop(posArr, t) {
			const start = posArr.length / 3;
			const x = stationX(t);
			const side = skinSide(t);
			const sy = sheerY(t);
			// starboard skin gunwale -> keel  (z from +hb to 0)
			for (let j = 0; j < SIDE_PTS; j++) {
				posArr.push(x, side[j].y, side[j].z);
			}
			// port skin keel(excl) -> gunwale(excl)  (mirror z), skip keel dup and gunwale dup
			for (let j = SIDE_PTS - 2; j >= 1; j--) {
				posArr.push(x, side[j].y, -side[j].z);
			}
			// deck span: from port gunwale (z=-hb) across to starboard gunwale (z=+hb),
			//   cambered up at mid-beam.  Exclude both endpoints (they are gunwale verts).
			const gz = side[0].z; // gunwale half-beam
			for (let k = 1; k < DECK_PTS - 1; k++) {
				const f = k / (DECK_PTS - 1); // 0..1 port->starboard
				const z = -gz + 2 * gz * f;
				const crown = Math.cos((f - 0.5) * Math.PI) * 0.012; // gentle camber (cand_2)
				posArr.push(x, sy + crown, z);
			}
			const count = posArr.length / 3 - start;
			return { start, count };
		}

		const posArr = [];
		const idxSkin = []; // hull-skin + caps triangles  (matHull)
		const idxDeck = []; // deck-span triangles         (matDeck)

		// Every loop uses the same SIDE_PTS / DECK_PTS so loopCount is constant
		// (clean tube stitching).  The deck-span verts are the LAST (DECK_PTS-2)
		// entries of each loop; we use that to route quads to the deck group.
		const loopCount = SIDE_PTS + (SIDE_PTS - 2) + (DECK_PTS - 2);
		const deckSpanStart = SIDE_PTS + (SIDE_PTS - 2); // first deck-interior idx in a loop

		// interior stations: skip the extreme bow/stern (capped separately)
		const tStern = 0.018,
			tBow = 0.982;
		const loops = [];
		for (let i = 0; i < STATIONS; i++) {
			const t = tStern + (tBow - tStern) * (i / (STATIONS - 1));
			loops.push(pushLoop(posArr, t));
		}

		// A quad belongs to the DECK group iff it lies on the top deck span. The
		// deck span runs from the port gunwale (loop idx 2*SIDE_PTS-2) across the
		// interior deck points and back to the starboard gunwale (loop idx 0).
		const portGunwale = 2 * SIDE_PTS - 2;
		function isDeckEdge(j) {
			// segment j -> (j+1)%loopCount: deck if it spans port gunwale .. wrap .. stbd gunwale
			return (j >= portGunwale && j < loopCount) || j === loopCount - 1;
		}

		// stitch consecutive loops into the hull/deck tube (outward winding)
		function quad(dst, a, b, c, d) {
			dst.push(a, b, c);
			dst.push(a, c, d);
		}
		for (let i = 0; i < STATIONS - 1; i++) {
			const A = loops[i].start,
				B = loops[i + 1].start;
			for (let j = 0; j < loopCount; j++) {
				const j2 = (j + 1) % loopCount;
				// ring order is CCW around +X; tube faces outward with this winding
				const dst = isDeckEdge(j) ? idxDeck : idxSkin;
				quad(dst, A + j, A + j2, B + j2, B + j);
			}
		}

		// --- STERN cap: FLAT planar transom fan. Centroid sits IN the transom
		//     plane (same X as the stern loop) so the stern is a firm flat
		//     transom, not a soft mid-height point. ---
		{
			const L = loops[0];
			let cy = 0,
				cz = 0;
			for (let j = 0; j < loopCount; j++) {
				const p = (L.start + j) * 3;
				cy += posArr[p + 1];
				cz += posArr[p + 2];
			}
			cy /= loopCount;
			cz /= loopCount;
			const apex = posArr.length / 3;
			posArr.push(stationX(tStern), cy, cz); // planar: x = transom X
			for (let j = 0; j < loopCount; j++) {
				const j2 = (j + 1) % loopCount;
				idxSkin.push(apex, L.start + j2, L.start + j); // winding faces -X (outward at stern)
			}
		}
		// --- BOW cap: fan the bow loop to a single raked stem apex (sharp bow) ---
		{
			const L = loops[STATIONS - 1];
			const yb = sheerY(tBow) * 0.4 + keelY(tBow) * 0.6;
			const apex = posArr.length / 3;
			posArr.push(stationX(tBow) + 0.1, yb, 0); // raked forward, faces +X
			for (let j = 0; j < loopCount; j++) {
				const j2 = (j + 1) % loopCount;
				idxSkin.push(apex, L.start + j, L.start + j2); // winding faces +X (outward at bow)
			}
		}

		// ---- assemble the ONE manifold geometry with two material groups ----
		const hullGeo = new THREE.BufferGeometry();
		hullGeo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
		// single index buffer = skin group followed by deck group
		const allIdx = idxSkin.concat(idxDeck);
		hullGeo.setIndex(allIdx);
		hullGeo.addGroup(0, idxSkin.length, 0); // material 0 = hull skin + caps
		hullGeo.addGroup(idxSkin.length, idxDeck.length, 1); // material 1 = deck
		hullGeo.computeVertexNormals();
		const hullMesh = new THREE.Mesh(hullGeo, [matHull, matDeck]);
		hullMesh.userData.isHullManifold = true;
		g.userData.hullGeometry = hullGeo;
		g.add(hullMesh);

		// ---- WATERLINE CONTACT RING (local, y=0): a loop of points tracing the hull
		//      where it meets the water. The caller transforms these each frame so the
		//      foam follows the REAL footprint as the boat heels & bobs. ----
		{
			const NWL = 13,
				ring = [];
			for (let i = 0; i < NWL; i++) {
				const t = tStern + (tBow - tStern) * (i / (NWL - 1));
				ring.push(
					new THREE.Vector3(stationX(t), 0, Math.max(halfBeam(t) * 0.95, 0.04))
				);
			}
			for (let i = NWL - 1; i >= 0; i--) {
				const t = tStern + (tBow - tStern) * (i / (NWL - 1));
				ring.push(
					new THREE.Vector3(stationX(t), 0, -Math.max(halfBeam(t) * 0.95, 0.04))
				);
			}
			g.userData.waterline = ring;
		}

		// ---- BUOYANCY SAMPLE GRID: points spread over the submerged hull (local
		//      y≈-0.12, mid-draft) weighted by local beam, so Archimedes buoyancy +
		//      restoring roll/pitch can be integrated from the wave field each frame. ----
		{
			const pts = [],
				NX = 8;
			for (let i = 0; i < NX; i++) {
				const t = tStern + (tBow - tStern) * ((i + 0.5) / NX);
				const x = stationX(t),
					hb = Math.max(halfBeam(t) * 0.85, 0.05);
				pts.push({ x, y: -0.12, z: 0, w: hb * 1.0 });
				pts.push({ x, y: -0.12, z: hb * 0.7, w: hb * 0.6 });
				pts.push({ x, y: -0.12, z: -hb * 0.7, w: hb * 0.6 });
			}
			g.userData.buoyPts = pts;
		}

		// sample interpolated half-beam / sheer at a world x (for seating props)
		function halfBeamAtX(x) {
			const t = (x - Lstern) / (Lbow - Lstern);
			return halfBeam(Math.min(1, Math.max(0, t)));
		}
		function sheerAtX(x) {
			const t = (x - Lstern) / (Lbow - Lstern);
			return sheerY(Math.min(1, Math.max(0, t)));
		}
		const deckY = 0.215; // nominal deck level for seating superstructure

		// ===================================================================
		//  CREAM TOPSIDE STRAKE  -- a thin separate band just under the gunwale,
		//  hugging the hull skin (purely cosmetic, sits flush on the skin).
		// ===================================================================
		{
			const sv = [],
				si = [];
			for (let i = 0; i < STATIONS; i++) {
				const t = tStern + (tBow - tStern) * (i / (STATIONS - 1));
				const x = stationX(t);
				const side = skinSide(t);
				const g0 = side[0],
					g1 = side[1]; // gunwale + one step down
				sv.push(x, g0.y, g0.z, x, g1.y, g1.z); // starboard
				sv.push(x, g0.y, -g0.z, x, g1.y, -g1.z); // port
			}
			for (let i = 0; i < STATIONS - 1; i++) {
				const a = i * 4,
					b = (i + 1) * 4;
				si.push(a, a + 1, b + 1, a, b + 1, b); // starboard band
				si.push(a + 2, b + 3, a + 3, a + 2, b + 2, b + 3); // port band
			}
			const sg = new THREE.BufferGeometry();
			sg.setAttribute("position", new THREE.Float32BufferAttribute(sv, 3));
			sg.setIndex(si);
			sg.computeVertexNormals();
			const m = new THREE.Mesh(sg, matTop);
			m.material.side = THREE.DoubleSide;
			g.add(m);
		}

		// ===================================================================
		//  TOE RAIL  -- a single CLOSED ribbon loop following the sheer,
		//  extruded up by h (inherently watertight trim piece — graft cand_2).
		// ===================================================================
		{
			const p = [],
				id = [];
			const h = 0.04,
				inset = 0.97;
			const loop = [];
			for (let i = 0; i < STATIONS; i++) {
				const t = tStern + (tBow - tStern) * (i / (STATIONS - 1));
				const x = stationX(t),
					sy = sheerY(t);
				loop.push([x, sy, Math.max(halfBeam(t) * inset, 0.03)]);
			}
			for (let i = STATIONS - 1; i >= 0; i--) {
				const t = tStern + (tBow - tStern) * (i / (STATIONS - 1));
				const x = stationX(t),
					sy = sheerY(t);
				loop.push([x, sy, -Math.max(halfBeam(t) * inset, 0.03)]);
			}
			const Ln = loop.length;
			for (let k = 0; k < Ln; k++) {
				const a = loop[k];
				p.push(a[0], a[1], a[2]);
			} // lower ring
			for (let k = 0; k < Ln; k++) {
				const a = loop[k];
				p.push(a[0], a[1] + h, a[2]);
			} // upper ring
			for (let k = 0; k < Ln; k++) {
				const a = k,
					b = (k + 1) % Ln,
					a2 = k + Ln,
					b2 = ((k + 1) % Ln) + Ln;
				id.push(a, b, b2);
				id.push(a, b2, a2);
			}
			const geo = new THREE.BufferGeometry();
			geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
			geo.setIndex(id);
			geo.computeVertexNormals();
			const m = new THREE.Mesh(geo, matTrim);
			m.material.side = THREE.DoubleSide;
			g.add(m);
		}

		// ===================================================================
		//  SUPERSTRUCTURE  -- closed primitive meshes seated ON the deck.
		// ===================================================================

		// ---- low cabin / coachroof: dark-glass windows, raked windscreen, door ----
		{
			const cabin = new THREE.Group();
			const cx = -0.34,
				cw = 0.82,
				cd = 0.56,
				ch = 0.26;
			const baseY = deckY + ch / 2;
			const body = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), matTop);
			body.position.set(cx, baseY, 0);
			cabin.add(body);
			const roof = new THREE.Mesh(
				new THREE.BoxGeometry(cw + 0.08, 0.045, cd + 0.08),
				matTrim
			);
			roof.position.set(cx, deckY + ch + 0.02, 0);
			cabin.add(roof);
			// side windows (dark glass), slightly proud of the cabin sides
			const winSide = new THREE.BoxGeometry(0.5, 0.11, 0.015);
			const wl = new THREE.Mesh(winSide, matGlass);
			wl.position.set(cx, deckY + 0.155, cd / 2 + 0.004);
			cabin.add(wl);
			const wr = new THREE.Mesh(winSide, matGlass);
			wr.position.set(cx, deckY + 0.155, -cd / 2 - 0.004);
			cabin.add(wr);
			// forward windscreen (dark glass, slightly forward-raked face)
			const winFront = new THREE.Mesh(
				new THREE.BoxGeometry(0.015, 0.11, 0.36),
				matGlass
			);
			winFront.position.set(cx + cw / 2 + 0.004, deckY + 0.16, 0);
			winFront.rotation.z = -0.18;
			cabin.add(winFront);
			// companionway door on the aft cabin wall
			const door = new THREE.Mesh(
				new THREE.BoxGeometry(0.015, 0.18, 0.16),
				matTrim
			);
			door.position.set(cx - cw / 2 - 0.004, deckY + 0.1, 0);
			cabin.add(door);
			g.add(cabin);
		}

		// ---- foredeck hatch with a glass lid ----
		{
			const hatch = new THREE.Mesh(
				new THREE.BoxGeometry(0.2, 0.05, 0.22),
				matTrim
			);
			hatch.position.set(0.72, deckY + 0.025, 0);
			g.add(hatch);
			const lid = new THREE.Mesh(
				new THREE.BoxGeometry(0.165, 0.012, 0.185),
				matGlass
			);
			lid.position.set(0.72, deckY + 0.056, 0);
			g.add(lid);
		}

		// ---- cockpit well: a recessed coaming ring just forward of the helm ----
		{
			const wellX = -0.86;
			const rimF = new THREE.Mesh(
				new THREE.BoxGeometry(0.02, 0.07, 0.42),
				matTrim
			);
			rimF.position.set(wellX + 0.24, deckY + 0.035, 0);
			g.add(rimF);
			const rimB = new THREE.Mesh(
				new THREE.BoxGeometry(0.02, 0.07, 0.42),
				matTrim
			);
			rimB.position.set(wellX - 0.24, deckY + 0.035, 0);
			g.add(rimB);
			const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.02), matTrim);
			rimL.position.set(wellX, deckY + 0.035, 0.21);
			g.add(rimL);
			const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.02), matTrim);
			rimR.position.set(wellX, deckY + 0.035, -0.21);
			g.add(rimR);
		}

		// ---- helm: brass binnacle + ship's wheel (a real place to steer) ----
		{
			const helm = new THREE.Group();
			const ped = new THREE.Mesh(
				new THREE.CylinderGeometry(0.05, 0.07, 0.2, 14),
				matBrass
			);
			ped.position.set(-0.62, deckY + 0.1, 0);
			helm.add(ped);
			const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 9), matBrass);
			cap.position.set(-0.62, deckY + 0.21, 0);
			helm.add(cap);
			const wheel = new THREE.Group();
			const rim = new THREE.Mesh(
				new THREE.TorusGeometry(0.11, 0.014, 9, 20),
				matTrim
			);
			wheel.add(rim);
			const hub = new THREE.Mesh(
				new THREE.CylinderGeometry(0.024, 0.024, 0.045, 10),
				matBrass
			);
			hub.rotation.x = Math.PI / 2;
			wheel.add(hub);
			for (let s = 0; s < 6; s++) {
				const spk = new THREE.Mesh(
					new THREE.CylinderGeometry(0.007, 0.007, 0.235, 6),
					matTrim
				);
				spk.rotation.z = s * (Math.PI / 3);
				wheel.add(spk);
			}
			wheel.position.set(-0.5, deckY + 0.2, 0);
			wheel.rotation.y = Math.PI / 2;
			helm.add(wheel);
			g.add(helm);
		}

		// ---- aft cockpit bench (graft cand_2) ----
		{
			const seat = new THREE.Mesh(
				new THREE.BoxGeometry(0.28, 0.035, 0.32),
				matTrim
			);
			seat.position.set(-1.04, deckY + 0.075, 0);
			g.add(seat);
			for (const zz of [-0.12, 0.12])
				for (const xx of [-0.94, -1.14]) {
					const leg = new THREE.Mesh(
						new THREE.BoxGeometry(0.03, 0.075, 0.03),
						matTrim
					);
					leg.position.set(xx, deckY + 0.035, zz);
					g.add(leg);
				}
		}

		// ---- perimeter rail: stanchions + top rail following the sheer (both sides) ----
		{
			const railH = 0.16,
				inset = 0.86;
			const RN = 12;
			const up = new THREE.Vector3(0, 1, 0);
			const postG = new THREE.CylinderGeometry(0.009, 0.009, railH, 6);
			for (const sgn of [1, -1]) {
				const pts = [];
				for (let i = 0; i < RN; i++) {
					const x = -1.22 + (i / (RN - 1)) * 2.42;
					const hb = halfBeamAtX(x) * inset;
					if (hb < 0.045) continue;
					const sy = sheerAtX(x);
					const post = new THREE.Mesh(postG, matBrass);
					post.position.set(x, sy + railH / 2, hb * sgn);
					g.add(post);
					pts.push(new THREE.Vector3(x, sy + railH, hb * sgn));
				}
				for (let i = 0; i < pts.length - 1; i++) {
					const a = pts[i],
						b = pts[i + 1];
					const mid = a.clone().add(b).multiplyScalar(0.5);
					const len = a.distanceTo(b);
					if (len < 1e-4) continue;
					const seg = new THREE.Mesh(
						new THREE.CylinderGeometry(0.006, 0.006, len, 6),
						matBrass
					);
					seg.position.copy(mid);
					seg.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
					g.add(seg);
				}
			}
		}

		// ---- cleats ----
		function cleat(x, z) {
			const c = new THREE.Group();
			const base = new THREE.Mesh(
				new THREE.BoxGeometry(0.06, 0.03, 0.03),
				matTrim
			);
			base.position.set(x, sheerAtX(x) + 0.015, z);
			c.add(base);
			const horn = new THREE.Mesh(
				new THREE.CylinderGeometry(0.01, 0.01, 0.085, 6),
				matBrass
			);
			horn.rotation.x = Math.PI / 2;
			horn.position.set(x, sheerAtX(x) + 0.038, z);
			c.add(horn);
			return c;
		}
		g.add(cleat(1.06, 0.12));
		g.add(cleat(1.06, -0.12));
		g.add(cleat(-1.04, 0.2));
		g.add(cleat(-1.04, -0.2));

		// ---- stern LANTERN — glows + casts warm light on the boat at night ----
		{
			const lamp = new THREE.Group();
			const post = new THREE.Mesh(
				new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6),
				matTrim
			);
			post.position.set(-1.16, deckY + 0.11, 0);
			lamp.add(post);
			const cage = new THREE.Mesh(
				new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8),
				matBrass
			);
			cage.position.set(-1.16, deckY + 0.25, 0);
			lamp.add(cage);
			const lampMat = new THREE.MeshStandardMaterial({
				color: 0xfff0c8,
				emissive: 0xffb24d,
				emissiveIntensity: 0.0,
				roughness: 0.4
			});
			const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), lampMat);
			bulb.position.set(-1.16, deckY + 0.25, 0);
			lamp.add(bulb);
			// soft additive halo
			const cv = document.createElement("canvas");
			cv.width = cv.height = 64;
			const cx = cv.getContext("2d");
			const gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
			gr.addColorStop(0, "rgba(255,225,150,0.95)");
			gr.addColorStop(0.4, "rgba(255,180,80,0.5)");
			gr.addColorStop(1, "rgba(0,0,0,0)");
			cx.fillStyle = gr;
			cx.fillRect(0, 0, 64, 64);
			const halo = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: new THREE.CanvasTexture(cv),
					transparent: true,
					depthWrite: false,
					blending: THREE.AdditiveBlending,
					opacity: 0
				})
			);
			halo.scale.set(0.5, 0.5, 1);
			halo.position.set(-1.16, deckY + 0.25, 0);
			lamp.add(halo);
			const light = new THREE.PointLight(0xffb86b, 0.0, 4.0, 2.0);
			light.position.set(-1.16, deckY + 0.3, 0);
			lamp.add(light);
			g.add(lamp);
			g.userData.lamp = { mat: lampMat, halo, light };
		}

		// ===================================================================
		//  RIG  -- mast, boom, gooseneck, stays/shrouds (thin cylinders)
		// ===================================================================
		const mastX = 0.2;
		const mastBaseY = deckY;
		const mastTopY = 2.0;
		const mast = new THREE.Mesh(
			new THREE.CylinderGeometry(0.028, 0.042, mastTopY - mastBaseY, 14),
			matMast
		);
		mast.position.set(mastX, (mastBaseY + mastTopY) / 2, 0);
		g.add(mast);
		const truck = new THREE.Mesh(
			new THREE.SphereGeometry(0.028, 10, 8),
			matBrass
		);
		truck.position.set(mastX, mastTopY, 0);
		g.add(truck);

		// boom off the mast (runs aft, slightly above deck)
		const boomLen = 1.05,
			boomY = deckY + 0.34;
		const boomTailX = mastX - boomLen;
		const boom = new THREE.Mesh(
			new THREE.CylinderGeometry(0.022, 0.022, boomLen, 10),
			matMast
		);
		boom.rotation.z = Math.PI / 2;
		boom.position.set(mastX - boomLen / 2, boomY, 0);
		g.add(boom);
		// gooseneck sphere at the boom/mast joint (graft cand_1)
		{
			const gn = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), matBrass);
			gn.position.set(mastX - 0.02, boomY, 0);
			g.add(gn);
		}

		// stays / shrouds
		const stayTop = new THREE.Vector3(mastX, mastTopY - 0.04, 0);
		const forestayTack = new THREE.Vector3(1.34, sheerAtX(1.34) + 0.02, 0);
		const backstayTack = new THREE.Vector3(-1.3, sheerAtX(-1.3) + 0.02, 0);
		{
			const up = new THREE.Vector3(0, 1, 0);
			const anchors = [
				forestayTack,
				backstayTack,
				new THREE.Vector3(mastX - 0.02, deckY + 0.02, 0.42),
				new THREE.Vector3(mastX - 0.02, deckY + 0.02, -0.42),
				new THREE.Vector3(mastX + 0.1, deckY + 0.02, 0.34),
				new THREE.Vector3(mastX + 0.1, deckY + 0.02, -0.34)
			];
			for (const a of anchors) {
				const mid = stayTop.clone().add(a).multiplyScalar(0.5);
				const len = stayTop.distanceTo(a);
				const line = new THREE.Mesh(
					new THREE.CylinderGeometry(0.004, 0.004, len, 5),
					matRope
				);
				line.position.copy(mid);
				line.quaternion.setFromUnitVectors(up, a.clone().sub(stayTop).normalize());
				g.add(line);
			}
		}

		// ===================================================================
		//  VERLET CLOTH SYSTEM  -- mainsail, jib, masthead flag.
		//
		//  Each cloth is a grid of particles (pos, prev, pinned).  Per substep we
		//  Verlet-integrate the free particles under gravity + wind + multi-
		//  frequency turbulence, then satisfy structural / shear / bend distance
		//  constraints 4x, re-asserting the pins AFTER EACH iteration so the luff/
		//  foot/hoist can never be dragged off the rig (graft cand_1).  Positions
		//  are written into a BufferGeometry every frame.
		// ===================================================================
		const cloths = [];

		function makeCloth(opts) {
			// opts: nu, nv (grid), build(u,v,i,j)->{pos:Vector3, pinned:bool},
			//       material, gravity, damping, windScale, turbScale, normal[3]
			const nu = opts.nu,
				nv = opts.nv;
			const N = nu * nv;
			const pos = new Float32Array(N * 3);
			const prev = new Float32Array(N * 3);
			const pinned = new Uint8Array(N);
			const anchor = new Float32Array(N * 3); // where pinned verts are held (static)
			const idxOf = (i, j) => j * nu + i;

			for (let j = 0; j < nv; j++) {
				for (let i = 0; i < nu; i++) {
					const o = (j * nu + i) * 3;
					const r = opts.build(i / (nu - 1), j / (nv - 1), i, j);
					pos[o] = r.pos.x;
					pos[o + 1] = r.pos.y;
					pos[o + 2] = r.pos.z;
					prev[o] = r.pos.x;
					prev[o + 1] = r.pos.y;
					prev[o + 2] = r.pos.z; // zero velocity
					pinned[j * nu + i] = r.pinned ? 1 : 0;
					if (r.pinned) {
						anchor[o] = r.pos.x;
						anchor[o + 1] = r.pos.y;
						anchor[o + 2] = r.pos.z;
					}
				}
			}

			// build constraints: structural (4-neighbour), shear (diagonal), bend (skip-one).
			// bend springs are SOFT (low stiffness) so the cloth stays floppy and can ripple
			// instead of holding a rigid shape — structural/shear keep it from stretching.
			const cons = [];
			function addCon(a, b, k) {
				const ax = pos[a * 3],
					ay = pos[a * 3 + 1],
					az = pos[a * 3 + 2];
				const bx = pos[b * 3],
					by = pos[b * 3 + 1],
					bz = pos[b * 3 + 2];
				const rest = Math.hypot(bx - ax, by - ay, bz - az);
				if (rest > 1e-6) cons.push({ a, b, rest, k });
			}
			for (let j = 0; j < nv; j++)
				for (let i = 0; i < nu; i++) {
					const o = idxOf(i, j);
					if (i + 1 < nu) addCon(o, idxOf(i + 1, j), 1.0); // struct horiz
					if (j + 1 < nv) addCon(o, idxOf(i, j + 1), 1.0); // struct vert
					if (i + 1 < nu && j + 1 < nv) addCon(o, idxOf(i + 1, j + 1), 0.8); // shear \
					if (i + 1 < nu && j - 1 >= 0) addCon(o, idxOf(i + 1, j - 1), 0.8); // shear /
					if (i + 2 < nu) addCon(o, idxOf(i + 2, j), 0.25); // bend horiz (soft)
					if (j + 2 < nv) addCon(o, idxOf(i, j + 2), 0.25); // bend vert (soft)
				}

			// geometry
			const geo = new THREE.BufferGeometry();
			geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
			// grid UVs (so a texture — e.g. the CodePen flag — can map across the cloth)
			const uvs = new Float32Array(N * 2);
			for (let j = 0; j < nv; j++)
				for (let i = 0; i < nu; i++) {
					const o = (j * nu + i) * 2;
					uvs[o] = i / (nu - 1);
					uvs[o + 1] = 1 - j / (nv - 1);
				}
			geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
			const tri = [];
			for (let j = 0; j < nv - 1; j++)
				for (let i = 0; i < nu - 1; i++) {
					const a = idxOf(i, j),
						b = idxOf(i + 1, j),
						c = idxOf(i, j + 1),
						d = idxOf(i + 1, j + 1);
					tri.push(a, c, b, b, c, d);
				}
			geo.setIndex(tri);
			geo.computeVertexNormals();
			geo.userData.isCloth = true;
			const mesh = new THREE.Mesh(geo, opts.material);
			g.add(mesh);

			const cloth = {
				nu,
				nv,
				N,
				pos,
				prev,
				pinned,
				cons,
				geo,
				anchor,
				vnrm: new Float32Array(N * 3), // scratch per-vertex normals (aerodynamics)
				gravity: opts.gravity !== undefined ? opts.gravity : -2.0,
				damping: opts.damping !== undefined ? opts.damping : 0.98,
				windScale: opts.windScale !== undefined ? opts.windScale : 1.0,
				turbScale: opts.turbScale !== undefined ? opts.turbScale : 0.0,
				normal: opts.normal || [0, 0, 1]
			};
			cloths.push(cloth);
			return cloth;
		}

		// approximate per-vertex normals from current grid positions (for aerodynamics)
		function clothNormals(cloth) {
			const { nu, nv, pos, vnrm } = cloth;
			for (let j = 0; j < nv; j++)
				for (let i = 0; i < nu; i++) {
					const o = (j * nu + i) * 3;
					const ir = Math.min(nu - 1, i + 1) * 1,
						il = Math.max(0, i - 1);
					const ju = Math.min(nv - 1, j + 1),
						jd = Math.max(0, j - 1);
					const ax = (j * nu + ir) * 3,
						bx = (j * nu + il) * 3,
						cy = (ju * nu + i) * 3,
						dy = (jd * nu + i) * 3;
					const ux = pos[ax] - pos[bx],
						uy = pos[ax + 1] - pos[bx + 1],
						uz = pos[ax + 2] - pos[bx + 2];
					const vx = pos[cy] - pos[dy],
						vy = pos[cy + 1] - pos[dy + 1],
						vz = pos[cy + 2] - pos[dy + 2];
					let nx = uy * vz - uz * vy,
						ny = uz * vx - ux * vz,
						nz = ux * vy - uy * vx;
					const l = Math.hypot(nx, ny, nz) || 1;
					vnrm[o] = nx / l;
					vnrm[o + 1] = ny / l;
					vnrm[o + 2] = nz / l;
				}
		}

		function clothStep(cloth, windX, windY, windZ, windLen, t, dt) {
			const { N, nu, pos, prev, pinned, cons, anchor, vnrm } = cloth;
			const damping = cloth.damping;
			const dt2 = dt * dt;
			const g_ = cloth.gravity;
			const ws = cloth.windScale,
				ts = cloth.turbScale;
			// aerodynamic pressure: wind hitting the face pushes ALONG the surface normal
			// (∝ wind·n). This fills the sails AND self-sustains flapping as the cloth
			// curves and the normals swing — sign-independent, so winding doesn't matter.
			clothNormals(cloth);
			const press = 2.2 * ws;
			// ---- Verlet integrate free particles ----
			for (let p = 0; p < N; p++) {
				if (pinned[p]) {
					pos[p * 3] = anchor[p * 3];
					pos[p * 3 + 1] = anchor[p * 3 + 1];
					pos[p * 3 + 2] = anchor[p * 3 + 2];
					prev[p * 3] = anchor[p * 3];
					prev[p * 3 + 1] = anchor[p * 3 + 1];
					prev[p * 3 + 2] = anchor[p * 3 + 2];
					continue;
				}
				const o = p * 3;
				const nx = vnrm[o],
					ny = vnrm[o + 1],
					nz = vnrm[o + 2];
				const wDotN = windX * nx + windY * ny + windZ * nz; // how square the wind hits
				const aero = wDotN * press; // along the normal
				// low-frequency rolling turbulence (per-particle phase) for living luff/flutter
				const i = p % nu,
					j = (p - i) / nu;
				const turb =
					ts *
					(0.5 + 0.85 * windLen) *
					(Math.sin(t * 2.3 + i * 0.9 + j * 0.5) * 0.6 +
						Math.sin(t * 3.9 - i * 0.6 + j * 1.2) * 0.4);
				const f = aero + turb;
				const ax = windX * ws * 0.12 + nx * f;
				const ay = g_ + ny * f;
				const az = windZ * ws * 0.12 + nz * f;
				const px = pos[o],
					py = pos[o + 1],
					pz = pos[o + 2];
				const vx = (px - prev[o]) * damping,
					vy = (py - prev[o + 1]) * damping,
					vz = (pz - prev[o + 2]) * damping;
				pos[o] = px + vx + ax * dt2;
				pos[o + 1] = py + vy + ay * dt2;
				pos[o + 2] = pz + vz + az * dt2;
				prev[o] = px;
				prev[o + 1] = py;
				prev[o + 2] = pz;
			}
			// ---- satisfy constraints; re-anchor pins after EVERY iteration ----
			const ITER = 4;
			for (let it = 0; it < ITER; it++) {
				for (let c = 0; c < cons.length; c++) {
					const cc = cons[c];
					const a = cc.a,
						b = cc.b,
						rest = cc.rest,
						ck = cc.k;
					const ao = a * 3,
						bo = b * 3;
					let dx = pos[bo] - pos[ao],
						dy = pos[bo + 1] - pos[ao + 1],
						dz = pos[bo + 2] - pos[ao + 2];
					let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
					if (d < 1e-6) continue;
					const diff = ((d - rest) / d) * ck;
					const pa = pinned[a],
						pb = pinned[b];
					if (pa && pb) continue;
					if (!pa && !pb) {
						const k = 0.5 * diff;
						pos[ao] += dx * k;
						pos[ao + 1] += dy * k;
						pos[ao + 2] += dz * k;
						pos[bo] -= dx * k;
						pos[bo + 1] -= dy * k;
						pos[bo + 2] -= dz * k;
					} else if (pa) {
						pos[bo] -= dx * diff;
						pos[bo + 1] -= dy * diff;
						pos[bo + 2] -= dz * diff;
					} else {
						pos[ao] += dx * diff;
						pos[ao + 1] += dy * diff;
						pos[ao + 2] += dz * diff;
					}
				}
				// re-assert pins so a stiff bend constraint can't drag them off the rig
				for (let p = 0; p < N; p++) {
					if (!pinned[p]) continue;
					const o = p * 3;
					pos[o] = anchor[o];
					pos[o + 1] = anchor[o + 1];
					pos[o + 2] = anchor[o + 2];
				}
			}
		}

		function clothWrite(cloth) {
			const attr = cloth.geo.attributes.position;
			const arr = attr.array;
			const pos = cloth.pos;
			for (let p = 0; p < cloth.N; p++) {
				arr[p * 3] = pos[p * 3];
				arr[p * 3 + 1] = pos[p * 3 + 1];
				arr[p * 3 + 2] = pos[p * 3 + 2];
			}
			attr.needsUpdate = true;
			cloth.geo.computeVertexNormals();
		}

		// ---- MAINSAIL (Bermuda-ish triangle with a small roach): luff pinned on
		//      the mast (vertical), foot pinned on the boom (horizontal); the
		//      chord tapers to a small head (not a true needle) for a roach-like
		//      trailing edge (graft cand_1). Leech + belly billow to leeward. ----
		{
			const tackY = boomY; // foot height (along boom)
			const headY = mastTopY - 0.1; // head near masthead
			const luffX = mastX - 0.03; // luff sits just aft of mast
			const footTailX = boomTailX + 0.02; // clew end of foot
			const headChord = 0.23; // head/foot chord ratio (small roach)
			makeCloth({
				nu: 11,
				nv: 13,
				material: matSail, // finer grid (graft cand_2)
				gravity: -2.0,
				damping: 0.972,
				windScale: 1.05,
				turbScale: 0.24,
				normal: [0, 0, 1],
				build: (u, v, i, j) => {
					// v: 0 = foot (bottom), 1 = head (top). u: 0 = luff (mast), 1 = leech.
					const luffY = tackY + (headY - tackY) * v; // up the mast
					// chord shrinks from full at foot to headChord*full at head (roach)
					const chord = (footTailX - luffX) * (1 - (1 - headChord) * v);
					const x = luffX + chord * u;
					// gentle initial belly toward +Z (leeward), zero at edges
					const belly =
						Math.sin(Math.PI * u * (1 - 0.4 * v)) *
						Math.sin(Math.PI * v) *
						0.16 *
						(1 - u * 0.3);
					const z = belly;
					const pinned = u === 0 /* luff on mast */ || v === 0; /* foot on boom */
					return { pos: new THREE.Vector3(x, luffY, z), pinned };
				}
			});
		}

		// ---- JIB (triangle): luff pinned along the forestay (bow tack -> upper
		//      mast). Tightened params grafted from cand_1 (nu:10,nv:7, gravity
		//      -1.6, damping 0.985, belly amp 0.13 with (1-u*0.3) falloff) so the
		//      convergent head does not over-stretch. ----
		{
			const headY = mastTopY - 0.42;
			const head = new THREE.Vector3(mastX + 0.02, headY, 0);
			const tack = new THREE.Vector3(
				forestayTack.x - 0.04,
				forestayTack.y + 0.02,
				0
			);
			const clew = new THREE.Vector3(mastX + 0.3, deckY + 0.42, 0); // believable sheeting point (cand_2)
			makeCloth({
				nu: 10,
				nv: 7,
				material: matSail,
				gravity: -1.6,
				damping: 0.984,
				windScale: 0.9,
				turbScale: 0.1,
				normal: [0, 0, -1],
				build: (u, v, i, j) => {
					// v: 0 = foot (tack->clew) -> 1 = head. u: 0 = luff (forestay) -> 1 = leech.
					const luff = tack.clone().lerp(head, v); // along the forestay
					const width = 1 - 0.82 * v; // SMALL head chord (no degenerate collapse → no "rip")
					const toClew = clew.clone().sub(luff);
					const p = luff.clone().add(toClew.multiplyScalar(width * u));
					const belly =
						Math.sin(Math.PI * u * (1 - 0.3 * v)) * Math.sin(Math.PI * v) * -0.11; // gentle billow to -Z
					p.z += belly;
					// pin the luff (forestay) AND the clew corner (sheeted down) so it sets
					// like a real headsail instead of flogging loose.
					const pinned = i === 0 || (i === 10 - 1 && j === 0);
					return { pos: p, pinned };
				}
			});
		}

		// ---- MASTHEAD FLAG / pennant: hoist edge pinned at the masthead, rest
		//      flutters. Initialised with a -Z fly spread (down to ~-0.32) so it
		//      reads as a flying pennant from frame 0 (fix cand_2's flat strip). ----
		{
			const fx0 = mastX,
				fy0 = mastTopY - 0.03;
			const fw = 0.32,
				fh = 0.13;
			// --- CodePen logo flag: red ground + white logomark drawn to a canvas ---
			(function applyCodePenLogo() {
				const cv = document.createElement("canvas");
				cv.width = 320;
				cv.height = 130;
				const c = cv.getContext("2d");
				c.fillStyle = "#c0392b";
				c.fillRect(0, 0, cv.width, cv.height); // flag red
				// logo box centred, height-constrained so it isn't stretched on the wide flag
				const S = 104,
					ox = cv.width * 0.5 - S * 0.5,
					oy = cv.height * 0.5 - S * 0.5;
				const P = (x, y) => [ox + x * S, oy + y * S];
				c.strokeStyle = "#fff";
				c.lineWidth = S * 0.072;
				c.lineJoin = "round";
				c.lineCap = "round";
				// outer hexagon (pointed left & right, flat top & bottom)
				const hex = [
					P(0.3, 0.18),
					P(0.7, 0.18),
					P(0.94, 0.5),
					P(0.7, 0.82),
					P(0.3, 0.82),
					P(0.06, 0.5)
				];
				c.beginPath();
				c.moveTo(hex[0][0], hex[0][1]);
				for (let k = 1; k < hex.length; k++) c.lineTo(hex[k][0], hex[k][1]);
				c.closePath();
				c.stroke();
				// the two CodePen cross-bars: horizontal to the side points, vertical to the edges
				c.beginPath();
				let a = P(0.06, 0.5),
					b = P(0.94, 0.5);
				c.moveTo(a[0], a[1]);
				c.lineTo(b[0], b[1]);
				a = P(0.5, 0.18);
				b = P(0.5, 0.82);
				c.moveTo(a[0], a[1]);
				c.lineTo(b[0], b[1]);
				c.stroke();
				const tex = new THREE.CanvasTexture(cv);
				tex.colorSpace = THREE.SRGBColorSpace;
				tex.anisotropy = 4;
				matFlag.map = tex;
				matFlag.color.set(0xffffff);
				matFlag.needsUpdate = true;
			})();
			makeCloth({
				nu: 10,
				nv: 5,
				material: matFlag,
				gravity: -0.9,
				damping: 0.915,
				windScale: 2.2,
				turbScale: 1.25,
				normal: [0, 0, -1],
				build: (u, v, i, j) => {
					// u: 0 = hoist (at mast) -> 1 = fly end. v across the height.
					const x = fx0 - 0.02 - u * 0.04;
					const y = fy0 - v * fh - u * 0.02;
					const z = -(u * fw); // trails to -Z (fly spread from frame 0)
					const pinned = u === 0;
					return { pos: new THREE.Vector3(x, y, z), pinned };
				}
			});
		}

		// ---- integration hook: advance ALL cloths one frame ----
		// dt capped; fixed-substep accumulator. SUB = 1/72 so a 60fps frame reliably
		// triggers at least one substep (a 1/60 threshold can skip frames when dt≈1/60).
		let _accum = 0;
		const SUB = 1 / 72,
			MAXSUB = 4;
		g.userData.updateCloth = function (dt, windLocal, t) {
			if (!(dt > 0)) return;
			dt = Math.min(dt, 0.05); // cap incoming dt
			const wx = windLocal.x || 0,
				wy = windLocal.y || 0,
				wz = windLocal.z || 0;
			const wlen =
				typeof windLocal.length === "function"
					? windLocal.length()
					: Math.hypot(wx, wy, wz);
			_accum += dt;
			let steps = 0;
			while (_accum >= SUB && steps < MAXSUB) {
				for (let c = 0; c < cloths.length; c++)
					clothStep(cloths[c], wx, wy, wz, wlen, t, SUB);
				_accum -= SUB;
				steps++;
			}
			if (steps === MAXSUB) _accum = 0; // drop backlog to stay stable
			for (let c = 0; c < cloths.length; c++) clothWrite(cloths[c]);
		};

		return g;
	}

	boatModel = makeBoat();
	boatModel.rotation.y = boatPos.heading;
	boatGroup.add(boatModel);
	boatGroup.position.set(boatPos.x, WATER_Y, boatPos.z); // start at the waterline (buoyancy settles it)
	const _ss = (a, b, x) => {
		x = clamp((x - a) / (b - a), 0, 1);
		return x * x * (3 - 2 * x);
	};

	/* ===================================================== fish — a small school
   circling under the surface, seen through the clear water (refraction pass). */
	function makeFish(color) {
		const grp = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial({
			color,
			roughness: 0.5,
			metalness: 0.15,
			emissive: new THREE.Color(color).multiplyScalar(0.1)
		});
		const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), mat);
		body.scale.set(1.0, 0.5, 0.34);
		grp.add(body); // elongated along +X (forward)
		const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 4), mat);
		tail.rotation.z = -Math.PI / 2;
		tail.scale.set(1, 1, 0.18);
		tail.position.set(-0.17, 0, 0);
		grp.add(tail);
		const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4), mat);
		fin.scale.set(1, 1, 0.22);
		fin.position.set(0.0, 0.07, 0);
		grp.add(fin); // dorsal fin
		grp.scale.setScalar(0.75 + Math.random() * 0.6);
		return { grp, tail };
	}
	const fishes = [];
	const FISH_COLORS = [
		0xff8a3c,
		0xe6c64e,
		0xd8e2ec,
		0xef6b5a,
		0x8fc0d0,
		0xf0a830
	];
	for (let i = 0; i < 11; i++) {
		const f = makeFish(FISH_COLORS[i % FISH_COLORS.length]);
		scene.add(f.grp);
		fishes.push({
			grp: f.grp,
			tail: f.tail,
			radius: 0.9 + Math.random() * 3.0,
			depth: BASE_Y + 0.2 + Math.random() * 0.55,
			speed: (0.25 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1),
			phase: Math.random() * Math.PI * 2,
			bob: 0.04 + Math.random() * 0.06,
			wig: Math.random() * 6.283
		});
	}
	function updateFishes(t) {
		for (const fi of fishes) {
			const ang = fi.phase + t * fi.speed;
			fi.grp.position.set(
				Math.cos(ang) * fi.radius,
				fi.depth + Math.sin(t * 1.3 + fi.wig) * fi.bob,
				Math.sin(ang) * fi.radius
			);
			const vx = -Math.sin(ang) * fi.speed,
				vz = Math.cos(ang) * fi.speed;
			fi.grp.rotation.set(0, Math.atan2(-vz, vx), Math.sin(t * 5 + fi.wig) * 0.04); // face travel + slight roll
			fi.tail.rotation.y = Math.sin(t * 9 + fi.wig) * 0.6; // tail swish
		}
	}

	// expanding-ring ripples spawned by taps/pokes — so the boat actually bobs &
	// heels when ripples reach it (the GPU sim height isn't read back to the CPU).
	const boatRipples = []; // {x,z,t0,amp}
	function rippleAt(x, z) {
		let h = 0,
			dhx = 0,
			dhz = 0;
		const now = simTime;
		for (let i = boatRipples.length - 1; i >= 0; i--) {
			const r = boatRipples[i];
			const tau = now - r.t0;
			if (tau > 3.2) {
				boatRipples.splice(i, 1);
				continue;
			}
			const dx = x - r.x,
				dz = z - r.z,
				d = Math.hypot(dx, dz) + 1e-4;
			const c = 2.2,
				r0 = c * tau,
				k = 6.5,
				width = 0.72;
			const e = (d - r0) / width,
				env = Math.exp(-e * e);
			const base = ((r.amp * 0.06 * Math.exp(-tau / 1.7)) / (1 + r0 * 0.8)) * env;
			const phase = k * (d - r0);
			h += base * Math.cos(phase);
			const dhdd =
				base * (((-2 * e) / width) * Math.cos(phase) - k * Math.sin(phase));
			dhx += (dhdd * dx) / d;
			dhz += (dhdd * dz) / d;
		}
		return { h, dhx, dhz };
	}

	function gerstnerSampleJS(x, z) {
		const t = simTime,
			chop = waterMat.uniforms.uChop.value,
			a = waterMat.uniforms.uWindAngle.value,
			spd = waterMat.uniforms.uSpeed.value;
		const ca = Math.cos(a),
			sa = Math.sin(a);
		let y = 0,
			nx = 0,
			nz = 0,
			ny = 1;
		for (const w of OCEAN_WAVES) {
			const d = norm2(w.d[0], w.d[1]);
			const Dx = d[0] * ca - d[1] * sa,
				Dz = d[0] * sa + d[1] * ca;
			const k = (2 * Math.PI) / w.len,
				c = Math.sqrt(9.8 / k),
				A = w.amp * chop,
				Q = w.steep / (k * A * 8 + 1e-5);
			const ph = k * (Dx * x + Dz * z) - c * t * spd,
				cph = Math.cos(ph),
				sph = Math.sin(ph);
			y += A * sph;
			nx -= Dx * k * A * cph;
			nz -= Dz * k * A * cph;
			ny -= Q * k * A * sph;
		}
		const damp = 1 - _ss(WATER_R * 0.82, WATER_R * 0.995, Math.hypot(x, z));
		y *= damp;
		nx *= damp;
		nz *= damp;
		const rp = rippleAt(x, z); // poke ripples bob/heel the boat
		y += rp.h;
		nx += -rp.dhx * 0.35;
		nz += -rp.dhz * 0.35; // gentle heel, not capsize
		const td = waterMat.uniforms.uTide.value,
			tdr = waterMat.uniforms.uTideDir.value; // moon tide
		y += td * (x * tdr.x + z * tdr.y) * damp;
		const nl = Math.hypot(nx, ny, nz) || 1;
		return { y, nx: nx / nl, ny: ny / nl, nz: nz / nl };
	}
	// ---- BOAT DRIFT: the boat floats free in the dish. Pushing the water shoves it
	//      (impulses on bvx/bvz); a spring pulls it back toward the centre, the moon's
	//      tide tugs it toward the moon, and a touch of wind nudges it downwind. It
	//      weathervanes to face its motion and throws a bow wave when moving. ----
	const SAIL_MAXR = WATER_R * 0.78;
	let _bowT = 0;
	function stepSail(dt) {
		if (!boatModel) return;
		dt = Math.min(dt, 0.04);
		const wF = windStr.value / 1000;
		const wdx = Math.cos(windAngle),
			wdz = Math.sin(windAngle);
		// forces: moon tide + gentle wind drift − spring to centre
		boatPos.bvx += (tideFX + wdx * wF * 0.05 - 0.7 * boatPos.x) * dt;
		boatPos.bvz += (tideFZ + wdz * wF * 0.05 - 0.7 * boatPos.z) * dt;
		const damp = Math.pow(0.22, dt); // drift damping (settles back to rest)
		boatPos.bvx *= damp;
		boatPos.bvz *= damp;
		boatPos.x += boatPos.bvx * dt;
		boatPos.z += boatPos.bvz * dt;
		const r = Math.hypot(boatPos.x, boatPos.z); // soft wall
		if (r > SAIL_MAXR) {
			const k = SAIL_MAXR / r;
			boatPos.x *= k;
			boatPos.z *= k;
			boatPos.bvx *= 0.3;
			boatPos.bvz *= 0.3;
		}
		const sp = Math.hypot(boatPos.bvx, boatPos.bvz);
		boatPos.speed = sp;
		// heading: face the way it drifts; at rest, weathervane to the wind
		const desired =
			sp > 0.12 ? Math.atan2(-boatPos.bvz, boatPos.bvx) : Math.atan2(-wdz, wdx);
		let diff = desired - boatPos.heading;
		diff = Math.atan2(Math.sin(diff), Math.cos(diff));
		boatPos.heading += diff * Math.min(1, 1.8 * dt);
		boatModel.rotation.y = boatPos.heading;
		// bow wave when moving
		_bowT -= dt;
		if (sp > 0.3 && _bowT <= 0) {
			_bowT = 0.12;
			const bx = Math.cos(boatPos.heading),
				bz = -Math.sin(boatPos.heading);
			const bowx = boatPos.x + bx * 1.2,
				bowz = boatPos.z + bz * 1.2;
			if (Math.hypot(bowx, bowz) < WATER_R * 0.96) {
				pokeQueue.push({
					uv: new THREE.Vector2(
						0.5 + (bowx / WATER_R) * UV_R,
						0.5 + (bowz / WATER_R) * UV_R
					),
					amp: -0.4 * sp
				});
				emitSplash(bowx, WATER_Y, bowz, 2, 0.2 * sp);
			}
		}
	}

	// ---- BUOYANCY: real rigid-body float (Archimedes) ----
	// Sample the water height under a grid of hull points; each submerged point gives
	// an upward buoyant force ∝ its depth. Sum → heave force + pitch/roll torques, then
	// integrate the boat as a damped rigid body. Floating, bobbing, pitching and heeling
	// all EMERGE from displaced volume + the wave/ripple field (so ripples bob it too).
	const boatRB = { y: WATER_Y, vy: 0, pitch: 0, pVel: 0, roll: 0, rVel: 0 };
	const _bowAxis = new THREE.Vector3(),
		_sideAxis = new THREE.Vector3();
	const _qRoll = new THREE.Quaternion(),
		_qPitch = new THREE.Quaternion();
	const _bpW = new THREE.Vector3();
	const BUOY_K = 80,
		BUOY_DMAX = 0.5,
		BUOY_LIN = 1.8; // stiffness, max draft, heave damping
	const BUOY_IROLL = 0.95,
		BUOY_IPITCH = 1.5,
		BUOY_ANG = 1.5;
	function stepBoat(dt) {
		if (!boatModel || !boatModel.userData.buoyPts) return;
		dt = Math.min(dt, 0.04);
		boatModel.updateWorldMatrix(true, false);
		const pts = boatModel.userData.buoyPts;
		let Fsum = 0,
			Wsum = 0,
			tRoll = 0,
			tPitch = 0;
		for (const p of pts) {
			_bpW.set(p.x, p.y, p.z);
			boatModel.localToWorld(_bpW); // current world pos of this hull point
			const wh = WATER_Y + gerstnerSampleJS(_bpW.x, _bpW.z).y; // water surface height there
			const cl = Math.min(BUOY_DMAX, Math.max(0, wh - _bpW.y)); // submersion (clamped)
			const F = p.w * cl;
			Fsum += F;
			Wsum += p.w;
			tRoll += -p.z * F; // restoring torques (Archimedes)
			tPitch += p.x * F;
		}
		const ay = (BUOY_K * Fsum) / Wsum - 9.8 - BUOY_LIN * boatRB.vy; // buoyancy − gravity − drag
		boatRB.vy += ay * dt;
		boatRB.y += boatRB.vy * dt;
		boatRB.rVel +=
			((BUOY_K * tRoll) / Wsum / BUOY_IROLL - BUOY_ANG * boatRB.rVel) * dt;
		boatRB.pVel +=
			((BUOY_K * tPitch) / Wsum / BUOY_IPITCH - BUOY_ANG * boatRB.pVel) * dt;
		boatRB.roll = Math.max(-0.55, Math.min(0.55, boatRB.roll + boatRB.rVel * dt));
		boatRB.pitch = Math.max(
			-0.45,
			Math.min(0.45, boatRB.pitch + boatRB.pVel * dt)
		);
		const h = boatPos.heading;
		_bowAxis.set(Math.cos(h), 0, -Math.sin(h)); // heel about the bow–stern axis
		_sideAxis.set(Math.sin(h), 0, Math.cos(h)); // pitch about the athwartships axis
		_qRoll.setFromAxisAngle(_bowAxis, boatRB.roll);
		_qPitch.setFromAxisAngle(_sideAxis, boatRB.pitch);
		boatGroup.quaternion.copy(_qRoll).multiply(_qPitch);
		boatGroup.position.set(boatPos.x, boatRB.y, boatPos.z);
	}

	// advance the boat's Verlet cloth (mainsail / jib / flag). Builds world wind
	// from the wind slider, transforms it into the boat's LOCAL frame (rebuilding
	// boatModel's quaternion from rotation.y — three.js may not have synced it),
	// then drives g.userData.updateCloth.
	const _wWind = new THREE.Vector3(),
		_lWind = new THREE.Vector3();
	const _qBoatModel = new THREE.Quaternion(),
		_qInv = new THREE.Quaternion();
	const _qYaxis = new THREE.Vector3(0, 1, 0);
	function updateBoatCloth(dt) {
		if (!boatModel || !boatModel.userData.updateCloth) return;
		const wStr = windStr.value / 1000;
		// gusts: the wind breathes so the sails fill and luff instead of sitting frozen
		const gust =
			1 + 0.35 * Math.sin(simTime * 0.9) + 0.18 * Math.sin(simTime * 2.3 + 1.7);
		const wMag = (0.55 + wStr * 2.6) * gust; // breeze -> stormy, pulsing
		_wWind.set(Math.cos(windAngle) * wMag, 0, Math.sin(windAngle) * wMag);
		_qBoatModel.setFromAxisAngle(_qYaxis, boatModel.rotation.y);
		_qInv.copy(boatGroup.quaternion).multiply(_qBoatModel).invert();
		_lWind.copy(_wWind).applyQuaternion(_qInv);
		boatModel.userData.updateCloth(dt, _lWind, simTime);
	}

	/* ===================================================== splash particles
   A pooled THREE.Points spray. Droplets are launched up+out from a point,
   fall under gravity, and park below the floor when spent. Emitted from
   taps, the boat's hull when it slams a wave, and breaking crests. */
	const SPLASH_MAX = 320;
	const splashPos = new Float32Array(SPLASH_MAX * 3);
	const splashVel = new Float32Array(SPLASH_MAX * 3);
	const splashLife = new Float32Array(SPLASH_MAX);
	let splashHead = 0;
	for (let i = 0; i < SPLASH_MAX; i++) {
		splashPos[i * 3 + 1] = -999;
	} // park all
	const splashGeo = new THREE.BufferGeometry();
	splashGeo.setAttribute("position", new THREE.BufferAttribute(splashPos, 3));
	const dropTex = (function () {
		const c = document.createElement("canvas");
		c.width = c.height = 64;
		const x = c.getContext("2d");
		const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(0.35, "rgba(230,245,255,0.85)");
		g.addColorStop(1, "rgba(200,230,255,0)");
		x.fillStyle = g;
		x.beginPath();
		x.arc(32, 32, 32, 0, 7);
		x.fill();
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		return t;
	})();
	const splashMat = new THREE.PointsMaterial({
		size: 0.085,
		map: dropTex,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		sizeAttenuation: true,
		opacity: 0.9
	});
	const splashPoints = new THREE.Points(splashGeo, splashMat);
	splashPoints.frustumCulled = false;
	splashPoints.renderOrder = 5;
	scene.add(splashPoints);

	function emitSplash(x, y, z, count, power) {
		power = power == null ? 1 : power;
		for (let n = 0; n < count; n++) {
			const i = splashHead;
			splashHead = (splashHead + 1) % SPLASH_MAX;
			const a = Math.random() * Math.PI * 2,
				r = Math.random();
			const up = (1.4 + Math.random() * 2.2) * (0.6 + power);
			splashVel[i * 3] = Math.cos(a) * r * (1.1 + power) * 1.3;
			splashVel[i * 3 + 1] = up;
			splashVel[i * 3 + 2] = Math.sin(a) * r * (1.1 + power) * 1.3;
			splashPos[i * 3] = x;
			splashPos[i * 3 + 1] = y + 0.02;
			splashPos[i * 3 + 2] = z;
			splashLife[i] = 0.5 + Math.random() * 0.5;
		}
	}
	function updateSplashes(dt) {
		let any = false;
		for (let i = 0; i < SPLASH_MAX; i++) {
			if (splashLife[i] <= 0) continue;
			any = true;
			splashLife[i] -= dt;
			splashVel[i * 3 + 1] -= 9.0 * dt; // gravity
			splashPos[i * 3] += splashVel[i * 3] * dt;
			splashPos[i * 3 + 1] += splashVel[i * 3 + 1] * dt;
			splashPos[i * 3 + 2] += splashVel[i * 3 + 2] * dt;
			if (splashLife[i] <= 0 || splashPos[i * 3 + 1] < WATER_Y - 0.15) {
				splashLife[i] = 0;
				splashPos[i * 3 + 1] = -999; // park
			}
		}
		if (any) splashGeo.attributes.position.needsUpdate = true;
	}
	// auto-splash: the hull slamming into a wave throws spray; tall crests near it foam
	let _boatPrevY = WATER_Y,
		_crestTimer = 0,
		boatFoamPulse = 0;
	// project the hull's waterline ring into the sim each frame so the foam tracks
	// the REAL contact footprint as the boat heels & bobs (not a fixed ellipse).
	const _wlTmp = new THREE.Vector3();
	function syncSimBoat() {
		if (!boatModel || !boatModel.userData.waterline) return;
		boatModel.updateWorldMatrix(true, false);
		const wl = boatModel.userData.waterline,
			pts = simUniforms.uFoamPts.value;
		const n = Math.min(wl.length, pts.length);
		for (let i = 0; i < n; i++) {
			_wlTmp.copy(wl[i]);
			boatModel.localToWorld(_wlTmp);
			pts[i].set(
				0.5 + (_wlTmp.x / WATER_R) * UV_R,
				0.5 + (_wlTmp.z / WATER_R) * UV_R
			);
		}
		simUniforms.uFoamCount.value = n;
		simUniforms.uFoamStr.value = 0.5 + boatFoamPulse; // base ring + bob-driven churn
	}
	function autoSplash(dt) {
		boatFoamPulse *= Math.pow(0.06, dt); // fade the heave foam pulse
		if (!boatModel || simTime < 0.6) {
			_boatPrevY = boatGroup.position.y;
			return;
		}
		const vy = (boatGroup.position.y - _boatPrevY) / Math.max(dt, 1e-3);
		_boatPrevY = boatGroup.position.y;
		// the hull edges cutting up/down through the surface always churn foam (scales with bob speed)
		boatFoamPulse = Math.max(boatFoamPulse, Math.min(0.9, Math.abs(vy) * 0.6));
		if (vy < -0.9) {
			// slamming down → spray + sound
			const p = boatGroup.position,
				power = Math.min(1.4, -vy * 0.5);
			emitSplash(
				p.x + 0.9 * Math.cos(boatPos.heading),
				WATER_Y,
				p.z + 0.9 * Math.sin(boatPos.heading),
				10,
				power
			);
			playSplash(Math.min(1, -vy * 0.4));
			playThud(Math.min(1, -vy * 0.35)); // dull hull slap
		}
		_crestTimer -= dt;
		if (_crestTimer <= 0) {
			_crestTimer = 0.12;
			const ang = Math.random() * Math.PI * 2,
				rr = 1.2 + Math.random() * 2.6;
			const x = boatPos.x + Math.cos(ang) * rr,
				z = boatPos.z + Math.sin(ang) * rr;
			if (Math.hypot(x, z) < WATER_R * 0.96) {
				const s = gerstnerSampleJS(x, z);
				if (s.y > 0.2 + (1 - windStr.value / 1000) * 0.18)
					emitSplash(x, WATER_Y + s.y, z, 4, 0.5); // breaking crest
			}
		}
	}

	/* ===================================================== procedural audio
   WebAudio sea-scape: a low ocean bed + a slowly swelling surf "wash" (waves
   rolling in & out) + wind that tracks the slider, PLUS boat-motion sound —
   water lapping the hull as it rocks, wood creaks when it heels, a hull slap
   when it drops, and splash transients. Muted until the speaker is clicked
   (autoplay rules). The button is injected so the HTML pane stays markup-free. */
	let audio = null,
		audioOn = false;
	function buildAudio() {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		const ctx = new AC();
		const master = ctx.createGain();
		master.gain.value = 0;
		master.connect(ctx.destination);
		// shared pink-ish noise buffer
		const len = ctx.sampleRate * 2;
		const buf = ctx.createBuffer(1, len, ctx.sampleRate);
		const d = buf.getChannelData(0);
		let b0 = 0,
			b1 = 0,
			b2 = 0;
		for (let i = 0; i < len; i++) {
			const w = Math.random() * 2 - 1;
			b0 = 0.99 * b0 + 0.05 * w;
			b1 = 0.96 * b1 + 0.08 * w;
			b2 = 0.9 * b2 + 0.12 * w;
			d[i] = (b0 + b1 + b2 + w * 0.2) * 0.25;
		}
		const loopNoise = (lpType, freq, q) => {
			const src = ctx.createBufferSource();
			src.buffer = buf;
			src.loop = true;
			src.playbackRate.value = 0.9 + Math.random() * 0.2;
			const f = ctx.createBiquadFilter();
			f.type = lpType;
			f.frequency.value = freq;
			if (q) f.Q.value = q;
			const g = ctx.createGain();
			g.gain.value = 0;
			src.connect(f).connect(g).connect(master);
			src.start();
			return { f, g };
		};
		const ocean = loopNoise("lowpass", 320); // deep bed
		const wash = loopNoise("lowpass", 520); // surf whoosh (low-passed → no hiss)
		const wind = loopNoise("lowpass", 900); // airy wind, NOT a resonant drone
		const hull = loopNoise("lowpass", 360); // water lapping the hull (motion only)
		return {
			ctx,
			master,
			buf,
			oceanGain: ocean.g,
			washGain: wash.g,
			washLP: wash.f,
			windGain: wind.g,
			windBP: wind.f,
			hullGain: hull.g,
			hullBP: hull.f
		};
	}
	function playSplash(power) {
		if (!audio || !audioOn) return;
		power = Math.min(1, Math.max(0.1, power || 0.5));
		const ctx = audio.ctx,
			t = ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = audio.buf;
		src.playbackRate.value = 1.0 + Math.random() * 0.5;
		const bp = ctx.createBiquadFilter();
		bp.type = "bandpass";
		bp.Q.value = 0.9;
		bp.frequency.setValueAtTime(1800 + power * 1400, t);
		bp.frequency.exponentialRampToValueAtTime(500, t + 0.18);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.5 * power, t + 0.012);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 + power * 0.12);
		src.connect(bp).connect(g).connect(audio.master);
		src.start(t);
		src.stop(t + 0.5);
	}
	// soft, low water "plip" for taps — a gentle drop, not the harsh splash burst
	function playPlip() {
		if (!audio || !audioOn) return;
		const ctx = audio.ctx,
			t = ctx.currentTime;
		const o = ctx.createOscillator();
		o.type = "sine";
		o.frequency.setValueAtTime(360 + Math.random() * 80, t);
		o.frequency.exponentialRampToValueAtTime(150, t + 0.11);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.045, t + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
		o.connect(g).connect(audio.master);
		o.start(t);
		o.stop(t + 0.22);
	}
	// wood creak when the hull flexes (rocks through). Sawtooth glide through a
	// resonant band-pass = a believable groan. Rate-limited.
	function playCreak(intensity) {
		if (!audio || !audioOn) return;
		intensity = Math.min(1, Math.max(0.2, intensity));
		const ctx = audio.ctx,
			t = ctx.currentTime,
			f0 = 85 + Math.random() * 120;
		const osc = ctx.createOscillator();
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(f0 * 1.7, t);
		osc.frequency.exponentialRampToValueAtTime(
			f0,
			t + 0.18 + Math.random() * 0.18
		);
		const bp = ctx.createBiquadFilter();
		bp.type = "bandpass";
		bp.Q.value = 7;
		bp.frequency.value = f0 * 2.4;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.11 * intensity, t + 0.04);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4 + Math.random() * 0.25);
		osc.connect(bp).connect(g).connect(audio.master);
		osc.start(t);
		osc.stop(t + 0.8);
	}
	// dull low thud when the hull slaps down into a wave
	function playThud(power) {
		if (!audio || !audioOn) return;
		power = Math.min(1, Math.max(0.2, power));
		const ctx = audio.ctx,
			t = ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = audio.buf;
		src.playbackRate.value = 0.65;
		const lp = ctx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 170;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.38 * power, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
		src.connect(lp).connect(g).connect(audio.master);
		src.start(t);
		src.stop(t + 0.3);
	}
	let _prevRV = 0,
		_creakT = -10;
	function updateAudio() {
		if (!audio || !audioOn) return;
		const s = windStr.value / 1000,
			t = simTime;
		// wind: very subtle airy layer (no tonal drone)
		audio.windGain.gain.value = 0.01 + s * 0.07;
		audio.windBP.frequency.value = 700 + s * 500;
		// SEA: steady bed + ONE smooth slow swell (gentle whoosh, regular — not random)
		audio.oceanGain.gain.value = 0.16 + s * 0.08;
		const swell = 0.5 + 0.5 * Math.sin(t * 0.5);
		audio.washGain.gain.value = (0.05 + s * 0.2) * (0.4 + 0.6 * swell);
		audio.washLP.frequency.value = 360 + s * 260 + 180 * swell;
		// BOAT: water lapping — silent at rest, rises with motion + sailing speed
		const motion = Math.min(
			1,
			Math.abs(boatRB.vy) * 0.65 +
				Math.abs(boatRB.rVel) * 0.5 +
				Math.abs(boatRB.pVel) * 0.4 +
				Math.abs(boatPos.speed) * 0.5
		);
		audio.hullGain.gain.value = motion * 0.12;
		audio.hullBP.frequency.value = 280 + motion * 340;
		// creak when the roll reverses with enough energy (hull working)
		const rv = boatRB.rVel;
		if (_prevRV * rv < 0 && Math.abs(_prevRV) > 0.45 && t - _creakT > 0.45) {
			playCreak(Math.min(1, Math.abs(_prevRV) * 0.8));
			_creakT = t;
		}
		_prevRV = rv;
	}
	function toggleAudio() {
		if (!audio) {
			audio = buildAudio();
			if (!audio) return;
		}
		if (audio.ctx.state === "suspended") audio.ctx.resume();
		audioOn = !audioOn;
		audio.master.gain.setTargetAtTime(
			audioOn ? 0.75 : 0.0,
			audio.ctx.currentTime,
			0.05
		);
		sndBtn.classList.toggle("on", audioOn);
		sndBtn.textContent = audioOn ? "🔊" : "🔈";
	}
	// inject the speaker toggle (keeps the HTML pane markup-free for this feature)
	const sndBtn = document.createElement("button");
	sndBtn.id = "sndBtn";
	sndBtn.type = "button";
	sndBtn.textContent = "🔈";
	sndBtn.title = "sound on/off";
	(document.getElementById("stage") || document.body).appendChild(sndBtn);
	sndBtn.addEventListener("click", toggleAudio);

	/* =============================================================== interaction */
	const cam = {
		az: 0.9,
		polar: 0.92,
		radius: 12.5,
		taz: 0.9,
		tpolar: 0.92,
		tradius: 12.5
	};
	const ray = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	const canvas = renderer.domElement;
	let drag = null,
		pid = null,
		lastX = 0,
		lastY = 0,
		moved = 0,
		lastPush = null;
	const setNDC = (e) =>
		ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);

	function rayToWater() {
		const o = ray.ray.origin,
			d = ray.ray.direction;
		if (Math.abs(d.y) < 1e-5) return null;
		const t = (WATER_Y - o.y) / d.y;
		if (t <= 0) return null;
		const p = o.clone().add(d.clone().multiplyScalar(t));
		return Math.hypot(p.x, p.z) < WATER_R * 0.99 ? p : null;
	}
	function poke(x, z, amp) {
		pokeQueue.push({
			uv: new THREE.Vector2(
				0.5 + (x / WATER_R) * UV_R,
				0.5 + (z / WATER_R) * UV_R
			),
			amp
		});
		boatRipples.push({ x, z, t0: simTime, amp }); // so the ripple reaches & bobs the boat
		if (boatRipples.length > 24) boatRipples.shift();
		emitSplash(x, WATER_Y, z, 14, 0.9 * amp); // visible splash at the tap
		playPlip(); // a soft water "plip", not a harsh splash
	}
	// drag across the water to PUSH it — ripples follow the cursor and the nearby boat
	// is shoved in the drag direction (it drifts back to centre afterward).
	function pushWater(px, pz, vx, vz) {
		const sp = Math.hypot(vx, vz);
		const amp = -Math.min(1.6, 0.55 + sp * 5.0);
		pokeQueue.push({
			uv: new THREE.Vector2(
				0.5 + (px / WATER_R) * UV_R,
				0.5 + (pz / WATER_R) * UV_R
			),
			amp
		});
		boatRipples.push({ x: px, z: pz, t0: simTime, amp });
		if (boatRipples.length > 24) boatRipples.shift();
		const dd = Math.hypot(boatPos.x - px, boatPos.z - pz);
		if (dd < 3.2 && sp > 1e-5) {
			// shove the boat in the drag direction
			const fall = 1 - dd / 3.2,
				imp = Math.min(2.0, sp * 55) * fall;
			boatPos.bvx += (vx / sp) * imp;
			boatPos.bvz += (vz / sp) * imp;
		}
		if (sp > 0.03) emitSplash(px, WATER_Y, pz, 1, 0.18);
	}

	canvas.addEventListener("pointerdown", (e) => {
		if (pid !== null) {
			if (canvas.hasPointerCapture && canvas.hasPointerCapture(pid)) return;
			pid = null;
		}
		pid = e.pointerId;
		try {
			canvas.setPointerCapture(pid);
		} catch (_) {}
		lastX = e.clientX;
		lastY = e.clientY;
		moved = 0;
		// over the water → push the water; over the surrounding void → orbit the camera
		setNDC(e);
		ray.setFromCamera(ndc, camera);
		const p = rayToWater();
		if (p) {
			drag = "push";
			lastPush = p;
		} else {
			drag = "orbit";
			lastPush = null;
		}
	});
	canvas.addEventListener("pointermove", (e) => {
		if (e.pointerId !== pid) return;
		const dx = e.clientX - lastX,
			dy = e.clientY - lastY;
		lastX = e.clientX;
		lastY = e.clientY;
		moved += Math.abs(dx) + Math.abs(dy);
		if (drag === "orbit") {
			cam.taz -= dx * 0.005;
			cam.tpolar = clamp(cam.tpolar - dy * 0.005, 0.16, 1.45);
		} else if (drag === "push") {
			setNDC(e);
			ray.setFromCamera(ndc, camera);
			const p = rayToWater();
			if (p) {
				if (lastPush) pushWater(p.x, p.z, p.x - lastPush.x, p.z - lastPush.z);
				lastPush = p;
			}
		}
	});
	function endDrag(e) {
		if (e.pointerId !== pid) return;
		if (moved < 6) {
			setNDC(e);
			ray.setFromCamera(ndc, camera);
			const p = rayToWater();
			if (p) poke(p.x, p.z, 1.2);
		} // quick tap = a ripple
		try {
			canvas.releasePointerCapture(pid);
		} catch (_) {}
		pid = null;
		drag = null;
		lastPush = null;
	}
	canvas.addEventListener("pointerup", endDrag);
	canvas.addEventListener("pointercancel", endDrag);
	canvas.addEventListener("lostpointercapture", (e) => {
		if (e.pointerId === pid) {
			pid = null;
			drag = null;
		}
	});
	canvas.addEventListener(
		"wheel",
		(e) => {
			e.preventDefault();
			cam.tradius = clamp(cam.tradius * (1 + Math.sign(e.deltaY) * 0.08), 9, 26);
		},
		{ passive: false }
	);

	/* sliders: wind strength + direction */
	const windStr = document.getElementById("windStr");
	const windDir = document.getElementById("windDir");
	const vWind = document.getElementById("vWind"),
		vDir = document.getElementById("vDir");
	let windAngle = 0.6;
	function applyWind() {
		const s = windStr.value / 1000;
		windAngle = (windDir.value / 1000) * Math.PI * 2;
		const wx = Math.cos(windAngle),
			wz = Math.sin(windAngle);
		waterMat.uniforms.uChop.value = 0.3 + s * 1.5; // wave size / choppiness
		waterMat.uniforms.uWindAngle.value = windAngle; // swell travels with the wind
		waterMat.uniforms.uWindDir.value.set(wx, wz);
		simUniforms.uWindStr.value = 0.0; // sim is just for poke ripples now
		simUniforms.uWindDir.value.set(wx, wz);
		vWind.textContent =
			s < 0.18 ? "calm" : s < 0.45 ? "breeze" : s < 0.72 ? "choppy" : "stormy";
		vDir.textContent = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"][
			Math.round(windAngle / (Math.PI / 4)) % 8
		];
	}
	windStr.addEventListener("input", applyWind);
	windDir.addEventListener("input", applyWind);
	applyWind();

	/* sky: a rotary knob spins the sun & moon (day → dusk ECLIPSE → night → dawn eclipse) */
	const skyKnob = document.getElementById("skyKnob");
	const skyInd = skyKnob ? skyKnob.querySelector(".knob-ind") : null;
	function setSky(p) {
		skyPhase = ((p % 1) + 1) % 1;
		if (skyInd) skyInd.style.transform = "rotate(" + skyPhase * 360 + "deg)";
		updateSky();
	}
	if (skyKnob) {
		let kPid = null;
		const knobAngle = (e) => {
			const r = skyKnob.getBoundingClientRect();
			const a = Math.atan2(
				e.clientY - (r.top + r.height / 2),
				e.clientX - (r.left + r.width / 2)
			);
			setSky((a + Math.PI / 2) / (Math.PI * 2)); // 0 phase = indicator up
		};
		skyKnob.addEventListener("pointerdown", (e) => {
			kPid = e.pointerId;
			try {
				skyKnob.setPointerCapture(kPid);
			} catch (_) {}
			knobAngle(e);
			e.preventDefault();
		});
		skyKnob.addEventListener("pointermove", (e) => {
			if (e.pointerId === kPid) knobAngle(e);
		});
		const kEnd = (e) => {
			if (e.pointerId === kPid) {
				kPid = null;
				try {
					skyKnob.releasePointerCapture(e.pointerId);
				} catch (_) {}
			}
		};
		skyKnob.addEventListener("pointerup", kEnd);
		skyKnob.addEventListener("pointercancel", kEnd);
	}
	setSky(skyPhase);

	/* ==================================================================== loop */
	let vpW = 0,
		vpH = 0;
	function resize() {
		const w = innerWidth || 1,
			h = innerHeight || 1;
		vpW = innerWidth;
		vpH = innerHeight;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
		renderer.getDrawingBufferSize(uResolution.value);
		refractRT.setSize(
			Math.max(2, Math.floor(uResolution.value.x * 0.75)),
			Math.max(2, Math.floor(uResolution.value.y * 0.75))
		);
	}
	addEventListener("resize", resize);
	resize();

	// render the scene: first the underwater view (no water) → refractRT, then the full frame
	function renderScene() {
		waterMat.uniforms.uHeight.value = rtA.texture;
		floorMat.uniforms.uHeight.value = rtA.texture;
		floorMat.uniforms.uTime.value = simTime;
		// (boat is positioned by stepBoat() in the frame loop)
		// refraction pass: hide only the water. The boat STAYS visible so its
		// submerged hull shows through the surface (a strong "clear water" cue).
		water.visible = false;
		renderer.setRenderTarget(refractRT);
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);
		water.visible = true;
		renderer.render(scene, camera);
	}

	let last = performance.now() / 1000,
		simTime = 0;
	function frame() {
		requestAnimationFrame(frame);
		if (document.hidden) {
			last = performance.now() / 1000;
			return;
		}
		if (innerWidth !== vpW || innerHeight !== vpH) resize();
		const now = performance.now() / 1000;
		const dt = Math.min(0.05, now - last);
		last = now;
		simTime += dt;
		simUniforms.uTime.value = simTime;
		waterMat.uniforms.uTime.value = simTime;

		stepSail(dt); // sail toward the tapped destination (wind-driven)
		stepBoat(dt); // buoyancy: float/bob/pitch/roll from displaced volume
		// advance the simulation (a couple of substeps for lively propagation)
		syncSimBoat(); // boat foam ring follows the (now-updated) hull
		stepSim(dt, true);
		stepSim(dt, false);

		cam.az += (cam.taz - cam.az) * 0.12;
		cam.polar += (cam.tpolar - cam.polar) * 0.12;
		cam.radius += (cam.tradius - cam.radius) * 0.1;
		camera.position
			.setFromSphericalCoords(cam.radius, cam.polar, cam.az)
			.add(CENTER);
		camera.lookAt(CENTER);

		updateBoatCloth(dt);
		autoSplash(dt);
		updateSplashes(dt);
		updateFishes(simTime);
		updateAudio();
		renderScene();
	}

	/* boot — render once immediately so the dish appears even if the tab loads in the
   background (where requestAnimationFrame is paused), then start the live loop. */
	const loader = document.getElementById("loader");
	cam.az = cam.taz;
	cam.polar = cam.tpolar;
	cam.radius = cam.tradius;
	camera.position
		.setFromSphericalCoords(cam.radius, cam.polar, cam.az)
		.add(CENTER);
	camera.lookAt(CENTER);
	stepBoat(0);
	updateFishes(0);
	renderScene();
	setTimeout(() => loader.classList.add("hide"), 200);
	requestAnimationFrame(frame);
})();
