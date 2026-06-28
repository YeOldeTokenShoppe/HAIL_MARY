// Volumetric fire on the fireHorse mane + tail.
//
// Faithful port of three.js' r185 `webgpu_volume_fire.html` example
// (GPU fluid sim: semi-Lagrangian advection + curlNoise, buoyancy, Jacobi
// projection, ray-marched VolumeNodeMaterial). The only structural changes:
//   - the emitter reads the GLB's Mane + Tail vertices (skinning-aware) instead
//     of a rotating teapot's vertices,
//   - the sim volume is fitted around the loaded horse,
//   - the teapot / DragControls / Inspector-GUI are removed (static emitter).
//
// WebGPU only. Imported dynamically from the page so the webgpu build never
// touches SSR or the rest of the (WebGL) app.

import * as THREE from 'three/webgpu';
import {
	vec3, vec4, uvec3, float, Fn, uniform,
	texture3D, textureStore, instanceIndex,
	screenCoordinate, pass,
	smoothstep, mix, min, max, floor,
	mx_noise_float, storage, storageTexture, If, cameraPosition, hue,
	Loop, positionWorld, positionLocal,
	interleavedGradientNoise, frameId, fract,
	saturation, cos, sin, atan,
} from 'three/tsl';

import { snoise, snoiseVec3 } from 'three/addons/tsl/math/curlNoise.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

const MODEL_URL = '/models/fireHorse.glb';

// ---------------------------------------------------------------------------
// Entry point. Mounts into `container`, returns a dispose() fn.
// ---------------------------------------------------------------------------

export async function startVolumetricFire( container ) {

	if ( WebGPU.isAvailable() === false ) {

		const msg = document.createElement( 'div' );
		msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff7a18;font-family:monospace;text-align:center;padding:2rem;';
		msg.textContent = 'WebGPU is not available in this browser. Try desktop Chrome/Edge (or Safari Technology Preview).';
		container.appendChild( msg );
		return () => msg.remove();

	}

	// -----------------------------------------------------------------------
	// Globals (mirrors the example's module-scope state)
	// -----------------------------------------------------------------------

	const GRID_SIZE_X = 100;
	const GRID_SIZE_Y = 100;
	const GRID_SIZE_Z = 200;
	const CELL_COUNT = GRID_SIZE_X * GRID_SIZE_Y * GRID_SIZE_Z;
	const PRESSURE_ITERATIONS = 2; // Jacobi iterations (keep even!)
	const VOLUME_WORLD_SIZE_X = 12;
	const VOLUME_WORLD_SIZE_Y = 12;
	const VOLUME_WORLD_SIZE_Z = 24;
	const VOLUME_WORLD_SIZE_DIAGONAL = Math.sqrt( VOLUME_WORLD_SIZE_X ** 2 + VOLUME_WORLD_SIZE_Y ** 2 + VOLUME_WORLD_SIZE_Z ** 2 );
	const uVolumeWorldSize = uniform( new THREE.Vector3( VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z ) );
	const TEXEL_X = 1 / GRID_SIZE_X;
	const TEXEL_Y = 1 / GRID_SIZE_Y;
	const TEXEL_Z = 1 / GRID_SIZE_Z;

	// sim textures
	let velTexA, velTexB; // velocity field (xyz)
	let dyeTexA, dyeTexB; // x = density (smoke), y = temperature (fire)
	let divTex; // divergence
	let pressTexA, pressTexB; // pressure (Jacobi ping-pong)
	let dyeTexNode, dyeTexWriteNode, curlNoiseTex, curlNoiseTexNode;

	// compute passes
	let advectVelocityPass, divergencePass, jacobiPassAB, jacobiPassBA, projectPass, advectDyePass, emitFirePass, computeCurlNoisePass;

	// emitter (mane + tail) — baked world-space vertices
	let emitVerticesBuffer, emitCount;
	const emitCentroid = new THREE.Vector3();

	// sim uniforms
	const uDt = uniform( 0.016 );
	const uTime = uniform( 0 );

	const uBuoyancy = uniform( 2.0 ); // moderate: flames lift off the mane/tail and merge, without pooling at the withers
	const uWeight = uniform( 0.15 );
	const uTurbulence = uniform( 3.2 );
	const uTurbulenceDecay = uniform( 0.1 );
	const uTurbFrequency = uniform( 10.0 );
	const uVelDamping = uniform( 0.25 );

	const uCooling = uniform( 1.0 );
	const uDissipation = uniform( 0.4 );

	const uEmitDensity = uniform( 1.0 ); // low — clean bright flames, little dark smoke (area-weighted emitters spread fire evenly even at low density)
	const uEmitTemperature = uniform( 11.0 ); // hot core, a touch below max to keep the dense withers from blowing fully white

	// kept for the wind/advection + point-light math; static horse => speed 0
	const uEmitterPosition = uniform( new THREE.Vector3() );
	const uEmitterSpeed = uniform( 0.0 );
	const uEmitterVelocity = uniform( new THREE.Vector3() );
	const uWindStrength = uniform( 6.5 );

	// render uniforms
	const uFireIntensity = uniform( 195.0 );
	const uFireGlowSpread = uniform( 5.0 ); // firePower = 6 - spread = 1 (brighter at low temp)
	const uShadowAbsorption = uniform( 2.0 );
	const uShadowAmbient = uniform( 0.5 );
	const uFireStartColor = uniform( new THREE.Color( 0xffe68c ) );
	const uFireMidColor = uniform( new THREE.Color( 0xff7305 ) );
	const uFireEndColor = uniform( new THREE.Color( 0xff0000 ) );
	const uFireHue = uniform( 0.0 );
	const uAsymmetry = uniform( 0.0 );
	const uPowderStrength = uniform( 0.59 );
	const uMultiScattering = uniform( 1.0 );
	const uPointLightVolumeIntensity = uniform( 2.0 );
	const uPointLightSurfaceIntensity = uniform( 3.0 ); // lower: don't flood the back white & wash out the flames
	const uLightNearIntensity = uniform( 10.0 );
	const uLightFarIntensity = uniform( 15.0 );
	const uLightFarDistance = uniform( 10.0 );
	const uPointLightProjectionRadius = uniform( 20.0 );
	const uPointLightProjectionFrequency = uniform( 0.2 );
	const uPointLightProjectionNoiseFade = uniform( 17.0 );
	const uPointLightProjectionCenterFade = uniform( 3.25 );
	const uSaturation = uniform( 1.1 ); // hoisted (used by the point-light node)

	const uFlameHeight = uniform( 3.5 );
	const uSway = uniform( new THREE.Vector3() );
	const uFlicker = uniform( 1.0 );
	const uColorNoise = uniform( 0.0 );
	const cpuNoise = new ImprovedNoise();

	let uKeyLightPos;

	// -----------------------------------------------------------------------
	// Storage 3D textures (the "voxels")
	// -----------------------------------------------------------------------

	function createStorage3D( name ) {

		const texture = new THREE.Storage3DTexture( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z );
		texture.name = name;
		texture.format = THREE.RGBAFormat;
		texture.type = THREE.HalfFloatType;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.wrapR = THREE.ClampToEdgeWrapping;

		return texture;

	}

	// -----------------------------------------------------------------------
	// TSL helpers shared by the compute kernels
	// -----------------------------------------------------------------------

	const getVoxelCoord = ( id ) => {

		const x = id.mod( GRID_SIZE_X );
		const y = id.div( GRID_SIZE_X ).mod( GRID_SIZE_Y );
		const z = id.div( GRID_SIZE_X * GRID_SIZE_Y );

		return uvec3( x, y, z );

	};

	const coordToUVW = ( coord ) => vec3( coord ).add( 0.5 ).div( vec3( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z ) );

	// -----------------------------------------------------------------------
	// Fluid simulation - compute kernels
	// -----------------------------------------------------------------------

	function createComputePasses() {

		// 0) Precompute curl noise into 3D storage texture
		computeCurlNoisePass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const freq = uTurbFrequency;
			const e = float( 0.1 ).div( freq );
			const dx = vec3( e, 0.0, 0.0 );
			const dy = vec3( 0.0, e, 0.0 );
			const dz = vec3( 0.0, 0.0, e );

			const p = uvw.mul( vec3( VOLUME_WORLD_SIZE_X / VOLUME_WORLD_SIZE_Y, 1.0, VOLUME_WORLD_SIZE_Z / VOLUME_WORLD_SIZE_Y ) );
			const p_x0 = snoiseVec3( p.sub( dx ).mul( freq ) );
			const p_x1 = snoiseVec3( p.add( dx ).mul( freq ) );
			const p_y0 = snoiseVec3( p.sub( dy ).mul( freq ) );
			const p_y1 = snoiseVec3( p.add( dy ).mul( freq ) );
			const p_z0 = snoiseVec3( p.sub( dz ).mul( freq ) );
			const p_z1 = snoiseVec3( p.add( dz ).mul( freq ) );

			const x = p_y1.z.sub( p_y0.z ).sub( p_z1.y ).add( p_z0.y );
			const y = p_z1.x.sub( p_z0.x ).sub( p_x1.z ).add( p_x0.z );
			const z = p_x1.y.sub( p_x0.y ).sub( p_y1.x ).add( p_y0.x );

			const noiseVal = vec3( x, y, z ).mul( 5.0 );

			textureStore( curlNoiseTex, coord, vec4( noiseVal, 0.0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'computeCurlNoise' );

		// 1) Advect velocity + external forces (buoyancy, weight, turbulence)
		advectVelocityPass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const vel = texture3D( velTexA, uvw, 0 ).xyz;

			const velUVW = vel.div( uVolumeWorldSize );
			const prevPos = uvw.sub( velUVW.mul( uDt ) );
			const newVel = texture3D( velTexA, prevPos, 0 ).xyz.toVar();

			const dye = dyeTexNode.sample( uvw ).level( 0 );
			const density = dye.r;
			const temperature = dye.g;
			const age = dye.b;

			const buoyancyForce = temperature.mul( uBuoyancy ).sub( density.mul( uWeight ) ).mul( VOLUME_WORLD_SIZE_Y );
			newVel.addAssign( vec3( 0, buoyancyForce, 0 ).mul( uDt ) );

			const thermalNoisePos = uvw.add( vec3( 0, age.negate().mul( 0.6 ), age.mul( 0.13 ) ).div( uTurbFrequency ) );
			const decay = age.mul( uTurbulenceDecay.negate() ).exp();
			const thermalTurbulence = curlNoiseTexNode.sample( thermalNoisePos ).level( 0 ).xyz.mul( uTurbulence ).mul( temperature ).mul( decay );

			const ambientNoisePos = uvw.mul( 0.5 ).add( vec3( 0, uTime.mul( 0.25 ), uTime.mul( 0.06 ) ).div( uTurbFrequency ) );
			const ambientTurbulence = curlNoiseTexNode.sample( ambientNoisePos ).level( 0 ).xyz.mul( uTurbulence.mul( 0.2 ) ).mul( density );

			const turbulence = thermalTurbulence.add( ambientTurbulence ).mul( VOLUME_WORLD_SIZE_Y );
			newVel.addAssign( turbulence.mul( uDt ) );

			newVel.mulAssign( max( float( 1 ).sub( uVelDamping.mul( uDt ) ), 0 ) );

			// Wind effect: bounding sphere around the emitter (off when static)
			const worldPos = uvw.sub( 0.5 ).mul( uVolumeWorldSize ).add( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) );
			const dist = worldPos.distance( uEmitterPosition );
			const emitterRadius = float( 1.0 );

			If( dist.lessThan( emitterRadius ), () => {

				const ratio = dist.div( emitterRadius );
				const falloff = smoothstep( 0.0, 1.0, float( 1.0 ).sub( ratio ) );

				const windNoisePos = uvw.add( vec3( 0.0, uTime.mul( 0.5 ), 0.0 ).div( uTurbFrequency ) );
				const windTurbulence = curlNoiseTexNode.sample( windNoisePos ).level( 0 ).xyz.mul( uTurbulence ).mul( uEmitterSpeed );

				const windVel = uEmitterVelocity.mul( uWindStrength ).add( windTurbulence ).mul( uDt ).mul( falloff );

				newVel.addAssign( windVel );

			} );

			const edge = min( uvw, vec3( 1 ).sub( uvw ) );
			const boundary = smoothstep( 0.0, 0.08, min( edge.x, min( edge.y, edge.z ) ) );
			newVel.mulAssign( boundary );

			textureStore( velTexB, coord, vec4( newVel, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'advectVelocity' );

		// 2) Divergence of the advected velocity
		divergencePass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const vR = texture3D( velTexB, uvw.add( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const vL = texture3D( velTexB, uvw.sub( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const vU = texture3D( velTexB, uvw.add( vec3( 0, TEXEL_Y, 0 ) ), 0 ).y;
			const vD = texture3D( velTexB, uvw.sub( vec3( 0, TEXEL_Y, 0 ) ), 0 ).y;
			const vF = texture3D( velTexB, uvw.add( vec3( 0, 0, TEXEL_Z ) ), 0 ).z;
			const vB = texture3D( velTexB, uvw.sub( vec3( 0, 0, TEXEL_Z ) ), 0 ).z;

			const divergence = vR.sub( vL ).add( vU.sub( vD ) ).add( vF.sub( vB ) ).mul( 0.5 );

			textureStore( divTex, coord, vec4( divergence, 0, 0, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'divergence' );

		// 3) Jacobi pressure solve (ping-pong A <-> B)
		const jacobi = ( pressRead, pressWrite, name ) => Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const pR = texture3D( pressRead, uvw.add( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pL = texture3D( pressRead, uvw.sub( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pU = texture3D( pressRead, uvw.add( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pD = texture3D( pressRead, uvw.sub( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pF = texture3D( pressRead, uvw.add( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;
			const pB = texture3D( pressRead, uvw.sub( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;

			const divergence = texture3D( divTex, uvw, 0 ).x;

			const pressure = pR.add( pL ).add( pU ).add( pD ).add( pF ).add( pB ).sub( divergence ).div( 6 );

			textureStore( pressWrite, coord, vec4( pressure, 0, 0, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( name );

		jacobiPassAB = jacobi( pressTexA, pressTexB, 'jacobiAB' );
		jacobiPassBA = jacobi( pressTexB, pressTexA, 'jacobiBA' );

		// 4) Project: subtract pressure gradient -> divergence-free velocity
		projectPass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const pR = texture3D( pressTexA, uvw.add( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pL = texture3D( pressTexA, uvw.sub( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pU = texture3D( pressTexA, uvw.add( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pD = texture3D( pressTexA, uvw.sub( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pF = texture3D( pressTexA, uvw.add( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;
			const pB = texture3D( pressTexA, uvw.sub( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;

			const gradient = vec3( pR.sub( pL ), pU.sub( pD ), pF.sub( pB ) ).mul( 0.5 );

			const vel = texture3D( velTexB, uvw, 0 ).xyz.sub( gradient );

			textureStore( velTexA, coord, vec4( vel, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'project' );

		// 5) Advect density / temperature
		advectDyePass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const vel = texture3D( velTexA, uvw, 0 ).xyz;
			const velUVW = vel.div( uVolumeWorldSize );
			const prevPos = uvw.sub( velUVW.mul( uDt ) );

			const dye = dyeTexNode.sample( prevPos ).level( 0 );

			const density = dye.r.mul( max( float( 1 ).sub( uDissipation.mul( uDt ) ), 0 ) ).toVar();
			const temperature = dye.g.mul( max( float( 1 ).sub( uCooling.mul( uDt ) ), 0 ) ).toVar();

			const gridDims = vec3( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z );
			const nearestUVW = floor( prevPos.mul( gridDims ) ).add( 0.5 ).div( gridDims );
			const age = dyeTexNode.sample( nearestUVW ).level( 0 ).b.add( uDt ).toVar();

			temperature.assign( temperature.clamp( 0, 12 ) );

			If( density.lessThanEqual( 0.01 ), () => {

				age.assign( 0.0 );

			} );

			textureStore( dyeTexWriteNode, coord, vec4( density, temperature, age, 1.0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'advectDye' );

		// 6) Emit density/temperature from the mane + tail vertices
		//    (positions are pre-baked into world space; static emitter)
		emitFirePass = Fn( () => {

			const worldPos = emitVerticesBuffer.element( instanceIndex );

			const uvw = worldPos.sub( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) ).div( uVolumeWorldSize ).add( 0.5 );

			If( uvw.x.greaterThanEqual( 0 ).and( uvw.x.lessThanEqual( 1 ) )
				.and( uvw.y.greaterThanEqual( 0 ) ).and( uvw.y.lessThanEqual( 1 ) )
				.and( uvw.z.greaterThanEqual( 0 ) ).and( uvw.z.lessThanEqual( 1 ) ), () => {

				const coord = uvec3( uvw.mul( vec3( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z ) ) );

				const flicker = mx_noise_float( worldPos.mul( 9.0 ).add( vec3( 0.0, uTime.negate().mul( 2.5 ), uTime.mul( 0.7 ) ) ) ).mul( 0.5 ).add( 0.5 );

				const emissionFactor = uEmitTemperature.greaterThan( 0.0 ).select( float( 1.0 ), float( 0.0 ) );

				const densityVal = uEmitDensity.mul( float( 1 / 120 ) ).mul( flicker.mul( 0.85 ).add( 0.15 ) ).mul( emissionFactor );

				If( densityVal.greaterThan( 0.0 ), () => {

					const tempVal = uEmitTemperature.mul( float( 1 / 120 ) ).mul( flicker.mul( 0.85 ).add( 0.15 ) ).mul( emissionFactor );

					const currentDye = dyeTexNode.sample( uvw ).level( 0 );
					const newDensity = currentDye.r.add( densityVal );
					const newTemp = currentDye.g.add( tempVal ).clamp( 0.0, 12.0 );

					const currentAge = currentDye.b;
					const newAge = mix( currentAge, float( 0.0 ), densityVal.div( max( newDensity, 0.001 ) ) );

					textureStore( dyeTexWriteNode, coord, vec4( newDensity, newTemp, newAge, 1.0 ) ).toWriteOnly();

				} );

			} );

		} )().compute( emitCount ).setName( 'emitFire' ); // one thread per mane/tail vertex

	}

	// -----------------------------------------------------------------------
	// Renderer / scene
	// -----------------------------------------------------------------------

	const renderer = new THREE.WebGPURenderer();
	renderer.setSize( container.clientWidth, container.clientHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 2;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.transmitted = true;
	container.appendChild( renderer.domElement );

	await renderer.init();

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x000000 );

	const camera = new THREE.PerspectiveCamera( 60, container.clientWidth / container.clientHeight, 0.1, 100 );
	camera.position.set( 14, 5.5, 4.4 );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 3.6, 0 );
	controls.maxDistance = 40;
	controls.minDistance = 2;
	controls.update();

	// Simulation resources

	velTexA = createStorage3D( 'velocity A' );
	velTexB = createStorage3D( 'velocity B' );
	dyeTexA = createStorage3D( 'dye A' );
	dyeTexB = createStorage3D( 'dye B' );
	divTex = createStorage3D( 'divergence' );
	pressTexA = createStorage3D( 'pressure A' );
	pressTexB = createStorage3D( 'pressure B' );
	curlNoiseTex = createStorage3D( 'curlNoise' );
	curlNoiseTex.wrapS = THREE.RepeatWrapping;
	curlNoiseTex.wrapT = THREE.RepeatWrapping;
	curlNoiseTex.wrapR = THREE.RepeatWrapping;

	dyeTexNode = texture3D( dyeTexA );
	dyeTexWriteNode = storageTexture( dyeTexB ).toWriteOnly();
	curlNoiseTexNode = texture3D( curlNoiseTex );

	// Floor (same placement as the example)
	const floorPlane = new THREE.Mesh( new THREE.PlaneGeometry( 80, 80 ), new THREE.MeshStandardMaterial( { color: 0x111115, roughness: 0.8 } ) );
	floorPlane.rotation.x = - Math.PI / 2;
	floorPlane.position.y = 0.8;
	floorPlane.receiveShadow = true;
	scene.add( floorPlane );

	// -----------------------------------------------------------------------
	// Load the horse and bake the mane + tail emitter
	// -----------------------------------------------------------------------

	const gltf = await new GLTFLoader().loadAsync( MODEL_URL );
	const horse = gltf.scene;

	// Find the mane + tail (the emitters); never cull the skinned meshes.
	const emitMeshes = [];
	horse.traverse( ( o ) => {

		if ( o.isMesh ) o.frustumCulled = false;
		if ( o.isMesh && /mane|tail/i.test( o.name ) ) emitMeshes.push( o );

	} );

	scene.add( horse );

	// Static emit topology: a flat list of (mesh, vertexIndex) refs plus the face
	// triples (as indices into that list). Only the POSITIONS change per animation
	// frame; the topology is fixed, so build it once.
	const vertRefs = []; // { mesh, i }
	const faceTriples = []; // [ a, b, c ] indices into vertRefs
	for ( const mesh of emitMeshes ) {

		const base = vertRefs.length;
		const pos = mesh.geometry.attributes.position;
		for ( let i = 0; i < pos.count; i ++ ) vertRefs.push( { mesh, i } );

		const index = mesh.geometry.index;
		const faceCount = index ? index.count / 3 : pos.count / 3;
		for ( let f = 0; f < faceCount; f ++ ) {

			const a = ( index ? index.getX( f * 3 ) : f * 3 ) + base;
			const b = ( index ? index.getX( f * 3 + 1 ) : f * 3 + 1 ) + base;
			const c = ( index ? index.getX( f * 3 + 2 ) : f * 3 + 2 ) + base;
			faceTriples.push( [ a, b, c ] );

		}

	}

	const vertCount = vertRefs.length; // 234 combined (GLTFLoader-processed mane + tail)
	const worldVerts = Array.from( { length: vertCount }, () => new THREE.Vector3() );

	// Fit the horse into the volume ONCE (rest pose): scale for flame headroom,
	// orient the long axis along Z (the 24-deep box axis), center in XZ, feet on floor.
	horse.updateWorldMatrix( true, true );
	let box = new THREE.Box3().setFromObject( horse );
	let size = box.getSize( new THREE.Vector3() );
	const TARGET_HEIGHT = 5.0;
	horse.scale.setScalar( TARGET_HEIGHT / Math.max( size.y, 1e-4 ) );
	horse.updateWorldMatrix( true, true );

	box = new THREE.Box3().setFromObject( horse );
	size = box.getSize( new THREE.Vector3() );
	if ( size.x > size.z ) {

		horse.rotation.y = Math.PI / 2;
		horse.updateWorldMatrix( true, true );
		box = new THREE.Box3().setFromObject( horse );

	}

	const center = box.getCenter( new THREE.Vector3() );
	horse.position.x += - center.x;
	horse.position.z += - center.z;
	horse.position.y += floorPlane.position.y - box.min.y; // feet on floor
	horse.traverse( ( o ) => { if ( o.isMesh ) o.castShadow = true; } );
	horse.updateWorldMatrix( true, true );

	// Bake skinned vertex WORLD positions. The mane/tail are skinned and their bones
	// sit under the scaled horse, so applyBoneTransform after the fit double-applies
	// the fit scale. Read at identity (horse-local), then map through the fit once.
	const fitPos = horse.position.clone();
	const fitQuat = horse.quaternion.clone();
	const fitScale = horse.scale.clone();
	const fitMatrix = horse.matrixWorld.clone();

	horse.position.set( 0, 0, 0 );
	horse.quaternion.identity();
	horse.scale.set( 1, 1, 1 );
	horse.updateWorldMatrix( true, true );
	for ( const mesh of emitMeshes ) if ( mesh.isSkinnedMesh && mesh.skeleton ) mesh.skeleton.update();
	for ( let v = 0; v < vertCount; v ++ ) {

		const { mesh, i } = vertRefs[ v ];
		const w = worldVerts[ v ].fromBufferAttribute( mesh.geometry.attributes.position, i );
		if ( mesh.isSkinnedMesh && typeof mesh.applyBoneTransform === 'function' ) {

			mesh.applyBoneTransform( i, w );
			mesh.localToWorld( w );

		} else {

			w.applyMatrix4( mesh.matrixWorld );

		}

	}
	horse.position.copy( fitPos ); // restore for rendering
	horse.quaternion.copy( fitQuat );
	horse.scale.copy( fitScale );
	horse.updateWorldMatrix( true, true );
	for ( let v = 0; v < vertCount; v ++ ) worldVerts[ v ].applyMatrix4( fitMatrix );

	// Build the emitter point cloud with AREA-WEIGHTED face sampling so coverage is
	// uniform over the whole surface. (A fixed N-per-face over-seeds the densely
	// tessellated mane base and starves the sparse crest/tail → fire pooled at the
	// withers.) Points-per-face scale with the face's world area.
	const pts = [];
	emitCentroid.set( 0, 0, 0 );
	for ( let v = 0; v < vertCount; v ++ ) {

		const w = worldVerts[ v ];
		pts.push( w.x, w.y, w.z );
		emitCentroid.add( w );

	}
	emitCentroid.multiplyScalar( 1 / Math.max( vertCount, 1 ) );

	const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cr = new THREE.Vector3();
	const CELL = 0.055 * 0.055; // dense surface sampling so the embers merge into continuous flame
	for ( const [ a, b, c ] of faceTriples ) {

		const wa = worldVerts[ a ], wb = worldVerts[ b ], wc = worldVerts[ c ];
		e1.subVectors( wb, wa );
		e2.subVectors( wc, wa );
		const area = 0.5 * cr.crossVectors( e1, e2 ).length();
		const n = Math.min( 24, Math.max( 1, Math.round( area / CELL ) ) );
		for ( let k = 0; k < n; k ++ ) {

			// deterministic scatter across the triangle (golden-ratio low-discrepancy)
			let u = ( k + 0.5 ) / n;
			let v = ( ( k + 1 ) * 0.6180339887498949 ) % 1;
			if ( u + v > 1 ) { u = 1 - u; v = 1 - v; }
			pts.push( wa.x + u * e1.x + v * e2.x, wa.y + u * e1.y + v * e2.y, wa.z + u * e1.z + v * e2.z );

		}

	}

	emitCount = pts.length / 3;
	const emitAttr = new THREE.Float32BufferAttribute( new Float32Array( pts ), 3 );
	emitVerticesBuffer = storage( emitAttr, 'vec3', emitCount ).toReadOnly();
	uEmitterPosition.value.copy( emitCentroid );

	console.log(
		`[firehorse-fire] emitting from ${emitMeshes.map( ( m ) => m.name ).join( '+' )}: ${emitCount} area-weighted points`,
	);

	createComputePasses();

	// Precompute curl noise on the GPU
	await renderer.computeAsync( computeCurlNoisePass );

	// -----------------------------------------------------------------------
	// Volumetric material - ray marches the simulated 3D texture
	// -----------------------------------------------------------------------

	const volumetricMaterial = new THREE.VolumeNodeMaterial();
	volumetricMaterial.steps = 16;
	volumetricMaterial.transparent = true;
	volumetricMaterial.blending = THREE.AdditiveBlending;
	volumetricMaterial.depthWrite = false;

	volumetricMaterial.offsetNode = fract( interleavedGradientNoise( screenCoordinate ).add( float( frameId ).mul( 0.618033988749895 ) ) );

	const fireRamp = Fn( ( [ t ] ) => {

		const color = vec3( 0 ).toVar();
		color.assign( mix( vec3( 0.0, 0.0, 0.0 ), uFireEndColor, smoothstep( 0.05, 0.35, t ) ) );
		color.assign( mix( color, uFireMidColor, smoothstep( 0.35, 0.65, t ) ) );
		color.assign( mix( color, uFireStartColor, smoothstep( 0.65, 1.0, t ) ) );

		return color;

	} );

	const henyeyGreenstein = Fn( ( [ cosTheta, g ] ) => {

		const g2 = g.mul( g );
		const denom = float( 1.0 ).add( g2 ).sub( float( 2.0 ).mul( g ).mul( cosTheta ) );
		const oneMinusG2 = float( 1.0 ).sub( g2 );
		return oneMinusG2.div( denom.pow( 1.5 ) ).mul( 0.079577 );

	} );

	const getVolumeSample = ( { positionRay } ) => {

		const uvw = positionRay.sub( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) ).div( uVolumeWorldSize ).add( 0.5 ).toVar();

		const noiseDistortion = texture3D( velTexA, uvw, 0 ).xyz.div( uVolumeWorldSize ).mul( 0.15 );
		const distortedUVW = uvw.add( noiseDistortion ).clamp( 0.0, 1.0 ).toVar();

		const sample = dyeTexNode.sample( distortedUVW ).level( 0 );

		const density = sample.r;
		const age = sample.b;
		const temperature = sample.g;

		const detailNoise = snoise( positionRay.mul( 5.5 ).add( vec3( 0, age.mul( 0.8 ).negate(), 0 ) ) );
		density.mulAssign( detailNoise.mul( 0.35 ).add( 0.85 ) );

		const edge = min( distortedUVW, vec3( 1 ).sub( distortedUVW ) );
		density.mulAssign( smoothstep( 0.0, 0.06, min( edge.x, min( edge.y, edge.z ) ) ) );

		return { density, temperature, age, distortedUVW };

	};

	volumetricMaterial.scatteringNode = Fn( ( { positionRay } ) => {

		const { density } = getVolumeSample( { positionRay } );

		const lightDir = uKeyLightPos.sub( positionRay ).normalize();
		const shadowDensitySum = float( 0.0 ).toVar();
		const shadowStepSize = 0.35;

		for ( let i = 0; i < 2; i ++ ) {

			const stepDist = ( i + 0.5 ) * shadowStepSize;
			const shadowPos = positionRay.add( lightDir.mul( stepDist ) );
			const shadowUVW = shadowPos.sub( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) ).div( uVolumeWorldSize ).add( 0.5 );

			const shadowEdge = min( shadowUVW, vec3( 1 ).sub( shadowUVW ) );
			const shadowFade = smoothstep( 0.0, 0.06, min( shadowEdge.x, min( shadowEdge.y, shadowEdge.z ) ) );

			const shadowSample = texture3D( dyeTexA, shadowUVW, 0 ).r.mul( shadowFade );
			shadowDensitySum.addAssign( shadowSample );

		}

		const tau = shadowDensitySum.mul( shadowStepSize ).mul( uShadowAbsorption );
		const beer = tau.negate().exp();

		const multiScatter = tau.mul( 0.25 ).negate().exp().mul( 0.5 );

		const baseTransmittance = mix( beer, beer.add( multiScatter ), uMultiScattering );

		const powder = float( 1.0 ).sub( tau.mul( 2.0 ).negate().exp() );
		const finalTransmittance = mix( baseTransmittance, baseTransmittance.mul( powder ), uPowderStrength );

		const lightTransmittance = finalTransmittance.add( uShadowAmbient ).clamp( 0.0, 1.0 );

		const viewDir = cameraPosition.sub( positionRay ).normalize();
		const cosTheta = viewDir.dot( lightDir ).clamp( - 1.0, 1.0 );
		const phase = henyeyGreenstein( cosTheta, uAsymmetry );

		const smokeScattering = vec3( density ).mul( lightTransmittance ).mul( phase.mul( 12.56637 ) );

		return smokeScattering;

	} );

	volumetricMaterial.scatteringEmissiveNode = Fn( ( { positionRay } ) => {

		const { density, temperature } = getVolumeSample( { positionRay } );

		const firePower = float( 6.0 ).sub( uFireGlowSpread );
		const fire = fireRamp( temperature.clamp( 0, 1 ) ).mul( temperature.pow( firePower ) ).mul( uFireIntensity );

		const fireColor = hue( fire, uFireHue );

		const distance = positionRay.sub( uKeyLightPos ).length();
		const attenuation = float( 400.0 ).div( distance.pow( 2.0 ) );

		return fireColor.mul( density.add( 0.15 ) ).mul( attenuation );

	} );

	const volumeCastShadow = Fn( () => {

		const startPos = positionWorld;
		const lightDir = positionWorld.sub( cameraPosition ).normalize();

		const steps = uniform( 'int' ).onRenderUpdate( ( { material, object } ) => material.steps || ( object && object.material && object.material.steps ) || volumetricMaterial.steps );
		const maxDistance = float( VOLUME_WORLD_SIZE_DIAGONAL );
		const stepSize = maxDistance.div( steps ).toVar();
		const rayDir = lightDir.toVar();

		const distTravelled = float( 0.0 ).toVar();
		const transmittance = float( 1.0 ).toVar();

		Loop( steps, () => {

			const positionRay = startPos.add( rayDir.mul( distTravelled ) );

			const { density } = getVolumeSample( { positionRay } );

			const absorption = density.mul( uShadowAbsorption ).mul( 0.01 );
			const falloff = absorption.negate().mul( stepSize ).exp();

			transmittance.mulAssign( falloff );

			distTravelled.addAssign( stepSize );

		} );

		transmittance.greaterThanEqual( 0.99 ).discard();

		const shadowOpacity = transmittance.oneMinus();

		return vec4( vec3( 0 ), shadowOpacity.mul( 5 ) );

	} );

	const volumetricMesh = new THREE.Mesh( new THREE.BoxGeometry( VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z ), volumetricMaterial );
	volumetricMesh.position.y = VOLUME_WORLD_SIZE_Y / 2 + 0.4;
	volumetricMesh.receiveShadow = true;
	scene.add( volumetricMesh );

	const shadowMaterial = new THREE.VolumeNodeMaterial();
	shadowMaterial.steps = volumetricMaterial.steps;
	shadowMaterial.offsetNode = volumetricMaterial.offsetNode;
	shadowMaterial.castShadowNode = volumeCastShadow();
	shadowMaterial.shadowSide = THREE.FrontSide;
	shadowMaterial.colorWrite = false;
	shadowMaterial.depthWrite = false;
	shadowMaterial.blending = THREE.CustomBlending;
	shadowMaterial.blendEquation = THREE.AddEquation;
	shadowMaterial.blendSrc = THREE.ZeroFactor;
	shadowMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
	shadowMaterial.blendEquationAlpha = THREE.AddEquation;
	shadowMaterial.blendSrcAlpha = THREE.OneFactor;
	shadowMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;

	const volumetricShadowMesh = new THREE.Mesh( new THREE.BoxGeometry( VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z ), shadowMaterial );
	volumetricShadowMesh.position.y = VOLUME_WORLD_SIZE_Y / 2 + 0.4;
	volumetricShadowMesh.castShadow = true;
	scene.add( volumetricShadowMesh );

	// Point light - the fire's own glow, projected onto the floor / horse
	const isVolume = Fn( ( { material } ) => {

		const isVolumeMaterial = material && material.isVolumeNodeMaterial;

		return float( isVolumeMaterial ? 1.0 : 0.0 );

	} )();

	const pointLightColor = Fn( () => {

		const P = positionWorld;
		const A = uEmitterPosition;

		const H = vec3( 0.0, uFlameHeight, 0.0 );

		const V = P.sub( A );
		const t = V.dot( H ).div( H.dot( H ) ).clamp( 0.0, 1.0 );
		const C = A.add( uSway ).add( H.mul( t ) );
		const distToSegment = P.sub( C ).length();

		const r = float( 1.2 );
		const softAttenuation = float( 1.0 ).div( distToSegment.pow( 2.0 ).add( r.pow( 2.0 ) ) );

		const distToLight = P.sub( A ).length();
		const decayExponent = float( 2.0 );
		const defaultAttenuation = distToLight.pow( decayExponent ).max( 0.01 ).reciprocal();

		const attenuationCorrection = isVolume.equal( 1.0 ).select(
			softAttenuation.div( defaultAttenuation ),
			float( 1.0 )
		);

		const currentIntensity = isVolume.equal( 1.0 ).select( uPointLightVolumeIntensity, uPointLightSurfaceIntensity );

		const colorT = uEmitTemperature.div( 8.34 ).mul( 0.5 ).add( 0.20 ).add( uColorNoise ).clamp( 0.0, 1.0 );
		const fireColor = fireRamp( colorT );
		const coloredFire = hue( saturation( fireColor, uSaturation ), uFireHue );

		const relP = P.xz.sub( A.xz );
		const angle = atan( relP.y, relP.x );
		const distXZ = relP.length();

		const freqScale = uPointLightProjectionFrequency;
		const angleNoise = mx_noise_float( vec3( cos( angle ).mul( float( 1.5 ).mul( freqScale ) ), sin( angle ).mul( float( 1.5 ).mul( freqScale ) ), uTime.mul( 0.6 ) ) ).mul( 0.5 ).add( 0.5 );

		const centerFadeFactor = smoothstep( 0.0, uPointLightProjectionCenterFade, distXZ );
		const cleanAngleNoise = mix( float( 1.0 ), angleNoise, centerFadeFactor );

		const noiseCoord1 = vec3( P.x.mul( float( 0.6 ).mul( freqScale ) ), uTime.mul( 1.2 ), P.z.mul( float( 0.6 ).mul( freqScale ) ) );
		const projN1 = mx_noise_float( noiseCoord1 ).mul( 0.5 ).add( 0.5 );

		const noiseCoord2 = vec3( P.x.mul( float( 1.5 ).mul( freqScale ) ), uTime.mul( 2.5 ), P.z.mul( float( 1.5 ).mul( freqScale ) ) );
		const projN2 = mx_noise_float( noiseCoord2 ).mul( 0.5 ).add( 0.5 );

		const projNoise = projN1.mul( 0.65 ).add( projN2.mul( 0.35 ) );

		const projectionIntensity = projNoise.mul( cleanAngleNoise.mul( 0.5 ).add( 0.5 ) );

		const noiseFadeFactor = distToSegment.div( uPointLightProjectionNoiseFade ).clamp( 0.0, 1.0 );
		const finalIntensity = mix( projectionIntensity, float( 1.0 ), noiseFadeFactor );

		const radialTemp = float( 1.0 ).sub( distToSegment.div( uPointLightProjectionRadius ) ).clamp( 0.0, 1.0 );

		const colorTProj = radialTemp.mul( finalIntensity ).clamp( 0.0, 1.0 );
		const fireColorProj = fireRamp( colorTProj );
		const coloredFireProj = hue( saturation( fireColorProj, uSaturation ), uFireHue );

		const finalFireColor = isVolume.equal( 1.0 ).select( coloredFire, coloredFireProj );

		const tempScale = uEmitTemperature.div( 8.34 ).max( 0.0 );
		const tempFactor = tempScale.pow( 4.0 );

		const densityScale = uEmitDensity.div( 11.02 ).max( 0.0 );

		const fadeIn = smoothstep( 0.0, 3.0, uTime );

		const baseColor = finalFireColor.mul( tempFactor ).mul( densityScale ).mul( uFireIntensity ).mul( currentIntensity ).mul( uFlicker ).mul( fadeIn );

		const distRatio = distToSegment.div( uLightFarDistance ).clamp( 0.0, 1.0 );
		const distanceScale = mix( uLightNearIntensity, uLightFarIntensity, smoothstep( 0.0, 1.0, distRatio ) );

		const finalScale = isVolume.equal( 1.0 ).select( distanceScale, float( 1.0 ) );

		return baseColor.mul( attenuationCorrection ).mul( finalScale );

	} )();

	const pointLight = new THREE.PointLight( 0xffffff, 1, 100, 2 );
	pointLight.colorNode = pointLightColor;
	pointLight.position.copy( emitCentroid );
	pointLight.castShadow = false;
	scene.add( pointLight );

	// Key light - white spot with shadow
	const keyLight = new THREE.SpotLight( 0xffffff, 1000 );
	keyLight.position.set( - 3 * ( VOLUME_WORLD_SIZE_X / 8 ), 6 * ( VOLUME_WORLD_SIZE_Y / 8 ) + VOLUME_WORLD_SIZE_Y / 2 + 0.4, 3 * ( VOLUME_WORLD_SIZE_Z / 8 ) );
	keyLight.angle = Math.PI / 5;
	keyLight.penumbra = 1;
	keyLight.decay = 2;
	keyLight.distance = 0;
	keyLight.castShadow = true;
	keyLight.shadow.intensity = .98;
	keyLight.shadow.mapSize.width = 1024;
	keyLight.shadow.mapSize.height = 1024;
	keyLight.shadow.camera.near = 1;
	const maxVolumeSize = Math.max( VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z );
	keyLight.shadow.camera.far = 20 * ( maxVolumeSize / 8 );
	keyLight.shadow.bias = - 0.001;
	keyLight.shadow.focus = 1;
	keyLight.target.position.set( 1, 0, 0 );
	scene.add( keyLight );
	scene.add( keyLight.target );

	uKeyLightPos = uniform( keyLight.position );

	// -----------------------------------------------------------------------
	// Render Pipeline (scene + half-res volumetric + denoise + bloom)
	// -----------------------------------------------------------------------

	const renderPipeline = new THREE.RenderPipeline( renderer );

	const LAYER_VOLUMETRIC_LIGHTING = 10;

	const volumetricLayer = new THREE.Layers();
	volumetricLayer.disableAll();
	volumetricLayer.enable( LAYER_VOLUMETRIC_LIGHTING );

	volumetricMesh.layers.disableAll();
	volumetricMesh.layers.enable( LAYER_VOLUMETRIC_LIGHTING );

	keyLight.layers.enable( LAYER_VOLUMETRIC_LIGHTING );
	pointLight.layers.enable( LAYER_VOLUMETRIC_LIGHTING );

	const scenePass = pass( scene, camera );
	scenePass.name = 'Scene Pass';

	const volumetricPass = pass( scene, camera );
	volumetricPass.name = 'Volumetric Lighting';
	volumetricPass.setLayers( volumetricLayer );
	volumetricPass.setResolutionScale( 0.75 ); // sharper thin mane/tail plume

	const denoiseStrength = uniform( 0.25 ); // less blur washout
	const blurredVolumetricPass = gaussianBlur( volumetricPass, denoiseStrength, 1 );

	const volumetricRGB = blurredVolumetricPass.rgb;
	const adjustedVolumetricRGB = saturation( volumetricRGB, uSaturation );
	const adjustedVolumetric = vec4( adjustedVolumetricRGB, blurredVolumetricPass.a ).mul( .5 );

	const scenePassColor = scenePass.max( adjustedVolumetric ).add( adjustedVolumetric );

	const bloomPass = bloom( scenePassColor );
	bloomPass.threshold.value = 0.5;
	bloomPass.strength.value = 0.1;
	bloomPass.radius.value = 1.0;

	renderPipeline.outputNode = scenePassColor.add( bloomPass );
	renderPipeline.needsUpdate = true;

	// -----------------------------------------------------------------------
	// Animation loop
	// -----------------------------------------------------------------------

	const params = { simSpeed: 1.2, smokeLifespan: 2.0, fireLifespan: 2.6, turbulence: 3.2 };

	let simulationTime = 0;
	let lastTime = performance.now();
	let simAccumulator = 0;
	let disposed = false;

	function updateTemporalUniforms( time ) {

		uTime.value = time % 1000;

		const heightNoise = cpuNoise.noise( 0, time * 2.5, 0 );
		uFlameHeight.value = 3.5 + heightNoise * 0.8;

		const swayX = cpuNoise.noise( time * 3.5, 0, 0 ) * 0.4;
		const swayZ = cpuNoise.noise( 0, 0, time * 3.5 ) * 0.4;
		uSway.value.set( swayX, 0, swayZ );

		const slowNoise = cpuNoise.noise( 0, time * 0.8, 0 );
		const fastNoise = cpuNoise.noise( 0, time * 15.0, 0 );
		uFlicker.value = slowNoise * 0.12 + fastNoise * 0.06 + 0.82;

		const colorNoise = cpuNoise.noise( time * 5.0, time * 5.0, 0 ) * 0.08;
		uColorNoise.value = colorNoise;

	}

	function animate() {

		if ( disposed ) return;

		const currentTime = performance.now();
		const delta = Math.min( ( currentTime - lastTime ) * 0.001, 1 / 30 );
		lastTime = currentTime;

		if ( params.simSpeed > 0 ) {

			const dt = delta * params.simSpeed;
			simAccumulator += dt;

			const stepTime = 1 / 120;
			const simStep = stepTime * params.simSpeed;

			const maxAccumulator = simStep * 8;
			if ( simAccumulator > maxAccumulator ) simAccumulator = maxAccumulator;

			uDt.value = simStep;
			uTurbulence.value = params.simSpeed > 0 ? params.turbulence / Math.sqrt( params.simSpeed ) : 0;
			uDissipation.value = params.smokeLifespan >= 100.0 ? 0.0 : 1.0 / params.smokeLifespan;
			uCooling.value = 1.0 / params.fireLifespan;

			while ( simAccumulator >= simStep ) {

				simulationTime += simStep;
				updateTemporalUniforms( simulationTime );

				renderer.compute( advectVelocityPass );
				renderer.compute( divergencePass );

				for ( let i = 0; i < PRESSURE_ITERATIONS; i ++ ) {

					renderer.compute( ( i % 2 === 0 ) ? jacobiPassAB : jacobiPassBA );

				}

				renderer.compute( projectPass );
				renderer.compute( advectDyePass );
				renderer.compute( emitFirePass );

				// Ping-pong dye textures
				const temp = dyeTexNode.value;
				dyeTexNode.value = dyeTexWriteNode.value;
				dyeTexWriteNode.value = temp;

				simAccumulator -= simStep;

			}

		} else {

			updateTemporalUniforms( simulationTime );

		}

		// Point light range tracks fire size + a 3s fade-in
		const tempRatio = uEmitTemperature.value / 8.34;
		const densityRatio = uEmitDensity.value / 11.02;
		const intensityRatio = uFireIntensity.value / 5.63;
		const sizeFactor = Math.sqrt( tempRatio * densityRatio * intensityRatio );
		const tt = Math.min( Math.max( simulationTime / 3.0, 0.0 ), 1.0 );
		const fadeIn = tt * tt * ( 3.0 - 2.0 * tt );
		pointLight.distance = Math.max( 0.01, 40.0 * Math.max( 0.2, sizeFactor ) * fadeIn );

		renderPipeline.render();

	}

	renderer.setAnimationLoop( animate );

	// -----------------------------------------------------------------------
	// Slider panel (live tuning)
	// -----------------------------------------------------------------------

	const panel = document.createElement( 'div' );
	panel.style.cssText = 'position:absolute;top:12px;left:12px;width:248px;padding:10px 12px;background:rgba(10,6,8,0.74);border:1px solid rgba(255,120,40,0.35);border-radius:8px;font:12px/1.4 ui-monospace,monospace;color:#fff;z-index:10;backdrop-filter:blur(4px);user-select:none;';
	const title = document.createElement( 'div' );
	title.textContent = '🔥 fire horse';
	title.style.cssText = 'color:#ffb070;margin-bottom:6px;font-weight:bold;letter-spacing:.04em;';
	panel.appendChild( title );

	const addSlider = ( label, min, max, step, value, onInput ) => {

		const row = document.createElement( 'div' );
		row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;';
		const lab = document.createElement( 'label' );
		lab.textContent = label;
		lab.style.cssText = 'flex:0 0 86px;color:#ffb070;';
		const input = document.createElement( 'input' );
		input.type = 'range';
		input.min = min; input.max = max; input.step = step; input.value = value;
		input.style.cssText = 'flex:1;min-width:0;accent-color:#ff7305;';
		const out = document.createElement( 'span' );
		out.textContent = ( + value ).toFixed( 2 );
		out.style.cssText = 'flex:0 0 38px;text-align:right;color:#fff;';
		input.addEventListener( 'input', () => {

			const v = parseFloat( input.value );
			out.textContent = v.toFixed( 2 );
			onInput( v );

		} );
		row.append( lab, input, out );
		panel.appendChild( row );

	};

	addSlider( 'Intensity', 0, 200, 1, uFireIntensity.value, ( v ) => { uFireIntensity.value = v; } );
	addSlider( 'Temperature', 0, 12, 0.1, uEmitTemperature.value, ( v ) => { uEmitTemperature.value = v; } );
	addSlider( 'Density', 0, 20, 0.1, uEmitDensity.value, ( v ) => { uEmitDensity.value = v; } );
	addSlider( 'Buoyancy', 0, 10, 0.1, uBuoyancy.value, ( v ) => { uBuoyancy.value = v; } );
	addSlider( 'Fire life', 0.5, 5, 0.1, params.fireLifespan, ( v ) => { params.fireLifespan = v; } );
	addSlider( 'Smoke life', 1, 30, 0.5, params.smokeLifespan, ( v ) => { params.smokeLifespan = v; } );
	addSlider( 'Hue', 0, 360, 1, 0, ( v ) => { uFireHue.value = THREE.MathUtils.degToRad( v ); } );

	container.appendChild( panel );

	// -----------------------------------------------------------------------
	// Resize + dispose
	// -----------------------------------------------------------------------

	function onResize() {

		const w = container.clientWidth, h = container.clientHeight;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize( w, h );

	}

	window.addEventListener( 'resize', onResize );

	return function dispose() {

		disposed = true;
		window.removeEventListener( 'resize', onResize );
		renderer.setAnimationLoop( null );
		if ( panel.parentNode === container ) container.removeChild( panel );
		controls.dispose();
		renderer.dispose();
		if ( renderer.domElement && renderer.domElement.parentNode === container ) {

			container.removeChild( renderer.domElement );

		}

	};

}
