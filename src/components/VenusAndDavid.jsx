import { animate, engine } from 'animejs'
import { MeshLine } from 'makio-meshline'

// Use seconds for anime.js durations (matches the original makio demo).
engine.timeUnit = 's'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { float, Fn, fract, instanceIndex, mix, mul, pass, pow, select, sin, sub, texture, uniform, vec2, vec3 } from 'three/tsl'
import {
	ACESFilmicToneMapping,
	Box3,
	DataTexture,
	FloatType,
	FrontSide,
	Matrix4,
	MeshBasicNodeMaterial,
	PerspectiveCamera,
	PostProcessing,
	Ray,
	RepeatWrapping,
	RGBAFormat,
	Scene,
	Vector3,
	WebGPURenderer,
} from 'three/webgpu'
import { MeshBVH, SAH } from 'three-mesh-bvh'

import './VenusAndDavid.css'

const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test( navigator.userAgent )

const PI_TSL = float( 3.141592653589793 )

const backInOut = Fn( ( [t] ) => {
	const f = select( t.lessThan( 0.5 ), mul( 2.0, t ), sub( 1.0, mul( 2.0, t ).sub( 1.0 ) ) )
	const g = pow( f, 3.0 ).sub( f.mul( sin( f.mul( PI_TSL ) ) ) )
	return select( t.lessThan( 0.5 ), mul( 0.5, g ), mul( 0.5, sub( 1.0, g ) ).add( 0.5 ) )
}, { t: 'float', return: 'float' } )

function centerAndScaleModel( model, targetSize ) {
	model.position.set( 0, 0, 0 )
	model.rotation.set( 0, 0, 0 )
	model.scale.set( 1, 1, 1 )
	model.updateMatrixWorld( true )
	const box = new Box3().setFromObject( model )
	const size = box.getSize( new Vector3() )
	const center = box.getCenter( new Vector3() )
	const maxDim = Math.max( size.x, size.y, size.z )
	if ( maxDim > 0 ) {
		const scale = targetSize / maxDim
		model.scale.setScalar( scale )
		center.multiplyScalar( scale )
	}
	model.position.sub( center )
	model.updateMatrixWorld( true )
	const bounds = new Box3().setFromObject( model )
	const finalSize = bounds.getSize( new Vector3() )
	const outerRadius = 0.5 * Math.hypot( finalSize.x, finalSize.z ) * 1.2
	return { bounds, outerRadius }
}

const VenusAndDavid = forwardRef( function VenusAndDavid( {
	davidUrl = '/models/david.glb',
	venusUrl = '/models/venus.glb',
	dracoDecoderPath = '/draco/',
	initial = 'david',
	showUI = true,
	className,
	style,
}, ref ) {
	const containerRef = useRef( null )
	const apiRef = useRef( { venus() {}, david() {} } )
	const [selected, setSelected] = useState( initial === 'venus' ? 'woman' : 'man' )

	useImperativeHandle( ref, () => ( {
		venus: () => apiRef.current.venus(),
		david: () => apiRef.current.david(),
	} ), [] )

	useEffect( () => {
		const container = containerRef.current
		if ( !container ) return

		let alive = true
		const disposers = []
		const dispose = () => {
			while ( disposers.length ) {
				try { disposers.pop()() } catch ( e ) { console.warn( e ) }
			}
		}

		;( async () => {
			const renderer = new WebGPURenderer( { antialias: true, reverseDepth: true, alpha: false } )
			renderer.setPixelRatio( window.devicePixelRatio || 1 )
			renderer.setSize( container.clientWidth, container.clientHeight )
			renderer.setClearColor( 0x000000, 1 )
			renderer.toneMapping = ACESFilmicToneMapping
			disposers.push( () => renderer.dispose() )

			await renderer.init()
			if ( !alive ) { dispose(); return }

			container.appendChild( renderer.domElement )
			disposers.push( () => {
				if ( renderer.domElement.parentNode ) renderer.domElement.parentNode.removeChild( renderer.domElement )
			} )

			const scene = new Scene()
			const camera = new PerspectiveCamera( 55, container.clientWidth / container.clientHeight, 1, 100 )

			// Minimal orbit camera with a tweenable `_theta` (matches the original makio control).
			// Initial theta is offset by 2π so the first venus/david click always produces a full spin
			// (target values are 2.3 and 2.3 + 2π — being parked at the latter means either click moves a full revolution).
			const orbit = {
				_theta: 2.3 + Math.PI * 2,
				_phi: Math.PI / 2,
				_radius: 16,
				target: new Vector3( 0, 0, 0 ),
				minRadius: 6,
				maxRadius: 30,
				apply() {
					const r = this._radius
					const sp = Math.sin( this._phi )
					camera.position.set(
						this.target.x + r * sp * Math.sin( this._theta ),
						this.target.y + r * Math.cos( this._phi ),
						this.target.z + r * sp * Math.cos( this._theta ),
					)
					camera.lookAt( this.target )
				},
			}
			orbit.apply()

			const dom = renderer.domElement
			let dragging = false
			let lastX = 0, lastY = 0
			const onPointerDown = ( e ) => {
				dragging = true
				lastX = e.clientX
				lastY = e.clientY
				dom.setPointerCapture?.( e.pointerId )
			}
			const onPointerUp = ( e ) => {
				dragging = false
				dom.releasePointerCapture?.( e.pointerId )
			}
			const onPointerMove = ( e ) => {
				if ( !dragging ) return
				const dx = e.clientX - lastX
				const dy = e.clientY - lastY
				lastX = e.clientX
				lastY = e.clientY
				orbit._theta -= dx * 0.005
				orbit._phi = Math.max( 0.15, Math.min( Math.PI - 0.15, orbit._phi - dy * 0.005 ) )
			}
			const onWheel = ( e ) => {
				e.preventDefault()
				orbit._radius = Math.max( orbit.minRadius, Math.min( orbit.maxRadius, orbit._radius + e.deltaY * 0.02 ) )
			}
			dom.addEventListener( 'pointerdown', onPointerDown )
			dom.addEventListener( 'pointerup', onPointerUp )
			dom.addEventListener( 'pointercancel', onPointerUp )
			dom.addEventListener( 'pointermove', onPointerMove )
			dom.addEventListener( 'wheel', onWheel, { passive: false } )
			disposers.push( () => {
				dom.removeEventListener( 'pointerdown', onPointerDown )
				dom.removeEventListener( 'pointerup', onPointerUp )
				dom.removeEventListener( 'pointercancel', onPointerUp )
				dom.removeEventListener( 'pointermove', onPointerMove )
				dom.removeEventListener( 'wheel', onWheel )
			} )

			const loader = new GLTFLoader()
			const draco = new DRACOLoader()
			draco.setDecoderPath( dracoDecoderPath )
			loader.setDRACOLoader( draco )

			const [gltfA, gltfB] = await Promise.all( [
				loader.loadAsync( davidUrl ),
				loader.loadAsync( venusUrl ),
			] )
			if ( !alive ) { dispose(); return }

			const modelA = gltfA.scene
			const modelB = gltfB.scene

			let meshesA = []
			modelA.traverse( o => { if ( o.isMesh ) { meshesA.push( o ); o.material = new MeshBasicNodeMaterial() } } )
			const meshesB = []
			modelB.traverse( o => { if ( o.isMesh ) { meshesB.push( o ); o.material = new MeshBasicNodeMaterial() } } )

			const targetSize = 12
			const { bounds: boundsA, outerRadius: rA } = centerAndScaleModel( modelA, targetSize )
			const { bounds: boundsB, outerRadius: rB } = centerAndScaleModel( modelB, targetSize )
			const outerRadius = Math.max( rA, rB )

			const davidGeoms = []
			for ( const obj of meshesA ) {
				obj.updateMatrixWorld( true )
				const g = obj.geometry.clone()
				g.applyMatrix4( obj.matrixWorld )
				davidGeoms.push( g )
			}
			if ( davidGeoms.length > 1 ) {
				const merged = mergeGeometries( davidGeoms, false )
				merged.boundsTree = new MeshBVH( merged, { maxLeafTris: 1, strategy: SAH, indirect: true } )
				merged.computeBoundingBox()
				meshesA = [{ isMesh: true, geometry: merged, matrixWorld: new Matrix4() }]
			} else if ( meshesA.length === 1 ) {
				const obj = meshesA[0]
				obj.geometry.boundsTree = new MeshBVH( obj.geometry, { maxLeafTris: 1, strategy: SAH, indirect: true } )
				obj.geometry.computeBoundingBox()
				obj.updateMatrixWorld( true )
			}
			for ( const obj of meshesB ) {
				obj.geometry.boundsTree = new MeshBVH( obj.geometry, { maxLeafTris: 1, strategy: SAH, indirect: true } )
				obj.geometry.computeBoundingBox()
				obj.updateMatrixWorld( true )
			}
			disposers.push( () => {
				for ( const m of [...meshesA, ...meshesB] ) m.geometry?.disposeBoundsTree?.()
			} )

			const samplesPerRing = isMobile ? 64 : 96
			const numRings = 64
			const minY = Math.min( boundsA.min.y, boundsB.min.y )
			const maxY = Math.max( boundsA.max.y, boundsB.max.y )

			const ringsA = generateRings( meshesA, boundsA, minY, maxY, samplesPerRing, numRings, outerRadius )
			const ringsB = generateRings( meshesB, boundsB, minY, maxY, samplesPerRing, numRings, outerRadius )
			const { texA, texB } = buildPositionTextures( ringsA, ringsB, samplesPerRing, numRings )
			disposers.push( () => { texA.dispose(); texB.dispose() } )

			const morph = uniform( initial === 'venus' ? 1 : 0 )
			const opacityU = uniform( 0 )

			const tA = texture( texA )
			const tB = texture( texB )

			const percent = Fn( () => {
				const p = morph
				const y = float( instanceIndex ).div( float( numRings ) )
				return backInOut( p.mul( 2 ).sub( y ).clamp() ).toVar()
			} )()

			const line = new MeshLine()
				.instances( numRings )
				.segments( samplesPerRing )
				.closed( true )
				.needsUV( true )
				.color( 0xffffff )
				.transparent( true )
				.lineWidth( 0.02 )
				.gpuPositionNode( Fn( ( [progress] ) => {
					const y = float( instanceIndex ).div( float( numRings ) ).toVar()
					const v = y.add( float( 0.5 ).div( float( numRings ) ) )
					const u = fract( progress )
					const posA = tA.sample( vec2( u, v ) ).xyz
					const posB = tB.sample( vec2( u, v ) ).xyz
					const extra = percent.clamp().sub( .5 ).abs().mul( 2 ).oneMinus().abs().toVar()
					const pos = mix( posA, posB, percent )
					pos.xz.mulAssign( extra.mul( 0.6 ).add( 1 ) )
					return pos
				} ) )
				.colorFn( Fn( () => {
					const y = float( instanceIndex ).div( float( numRings ) ).toVar()
					const v = y.add( float( 0.5 ).div( float( numRings ) ) )
					const alphaA = tA.sample( vec2( 0, v ) ).w
					const alphaB = tB.sample( vec2( 0, v ) ).w
					const alpha = mix( alphaA, alphaB, percent )
					return vec3( 1, y.smoothstep( 0, 1 ), percent.smoothstep( 0, .5 ) ).mul( alpha )
				} ) )
				.opacityFn( Fn( () => {
					const y = float( instanceIndex ).div( float( numRings ) ).toVar()
					const v = y.add( float( 0.5 ).div( float( numRings ) ) ).oneMinus()
					return v.smoothstep( opacityU.oneMinus().sub( 0.1 ), opacityU.oneMinus() )
				} ) )
				.widthFn( Fn( ( [width] ) => {
					const y = float( instanceIndex ).div( float( numRings ) ).toVar()
					const v = y.add( float( 0.5 ).div( float( numRings ) ) )
					const alphaA = tA.sample( vec2( 0, v ) ).w
					const alphaB = tB.sample( vec2( 0, v ) ).w
					const alpha = mix( alphaA, alphaB, percent )
					return width.add( percent.sub( .5 ).abs().mul( 2 ).oneMinus().abs().mul( 0.1 ) ).mul( alpha )
				} ) )

			scene.add( line )
			disposers.push( () => { scene.remove( line ); line.dispose?.() } )

			const post = new PostProcessing( renderer )
			const scenePass = pass( scene, camera )
			const sceneColor = scenePass.getTextureNode( 'output' )
			const bloomPass = bloom( sceneColor, 0.5, 0.01, 0.1 )
			post.outputNode = sceneColor.add( bloomPass )
			disposers.push( () => post.dispose() )

			apiRef.current.venus = () => {
				animate( morph, { value: 1, duration: 2, ease: 'linear' } )
				animate( orbit, { _theta: 2.6 - 0.3, duration: 1.5, ease: 'inOutQuad' } )
			}
			apiRef.current.david = () => {
				animate( morph, { value: 0, duration: 2, ease: 'linear' } )
				animate( orbit, { _theta: 2.3 + Math.PI * 2, duration: 1.5, ease: 'inOutQuad' } )
			}

			animate( opacityU, { value: 1, duration: 1.8, delay: 0.01, ease: 'outExpo' } )

			const onResize = () => {
				const w = container.clientWidth, h = container.clientHeight
				camera.aspect = w / h
				camera.updateProjectionMatrix()
				renderer.setSize( w, h )
				line.resize?.()
			}
			const ro = new ResizeObserver( onResize )
			ro.observe( container )
			disposers.push( () => ro.disconnect() )

			let raf = 0
			const tick = () => {
				if ( !alive ) return
				orbit.apply()
				post.render()
				raf = requestAnimationFrame( tick )
			}
			raf = requestAnimationFrame( tick )
			disposers.push( () => cancelAnimationFrame( raf ) )
		} )().catch( err => console.error( '[VenusAndDavid] init failed:', err ) )

		return () => {
			alive = false
			dispose()
		}
	}, [davidUrl, venusUrl, dracoDecoderPath, initial] )

	const onMan = () => { setSelected( 'man' ); apiRef.current.david() }
	const onWoman = () => { setSelected( 'woman' ); apiRef.current.venus() }

	return (
		<div className={`venus-and-david${className ? ' ' + className : ''}`} style={style}>
			<div ref={containerRef} className="venus-and-david__canvas" />
			{showUI && (
				<div className="morph-ui">
					<div className="select-gender">Select your gender</div>
					<div className="buttons">
						<button className={`man${selected === 'man' ? ' active' : ''}`} title="Man" onClick={onMan}>
							<span>Man</span>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
								<path d="M15.05 8.537L18.585 5H14V3h8v8h-2V6.414l-3.537 3.537a7.5 7.5 0 1 1-1.414-1.414zM10.5 20a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z" />
							</svg>
						</button>
						<button className={`woman${selected === 'woman' ? ' active' : ''}`} title="Woman" onClick={onWoman}>
							<span>Woman</span>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
								<path d="M11 15.934V19H9v2h2v2h2v-2h2v-3.066A7.5 7.5 0 1 0 11 15.934zM12 14a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
							</svg>
						</button>
					</div>
				</div>
			)}
		</div>
	)
} )

export default VenusAndDavid

function generateRings( meshes, bounds, minY, maxY, samplesPerRing, numRings, outerRadius ) {
	const lines = []
	const actives = []
	const height = Math.max( 0.0001, maxY - minY )
	const cx = ( bounds.min.x + bounds.max.x ) * 0.5
	const cz = ( bounds.min.z + bounds.max.z ) * 0.5

	const meshData = []
	for ( const mesh of meshes ) {
		if ( mesh.geometry.boundsTree ) {
			meshData.push( { mesh, invMat: new Matrix4().copy( mesh.matrixWorld ).invert() } )
		}
	}

	const ray = new Ray()
	const localRay = new Ray()
	const dir = new Vector3()
	const origin = new Vector3()
	const target = new Vector3()

	for ( let r = 0; r < numRings; r++ ) {
		const t = r / ( numRings - 1 )
		const y = minY + t * height
		const ring = new Float32Array( samplesPerRing * 3 )
		target.set( cx, y, cz )

		let prevX = 0, prevY = y, prevZ = 0
		let hasHit = false
		let firstHitIndex = -1
		let lastHitX = 0, lastHitY = y, lastHitZ = 0

		const rays = []
		for ( let i = 0; i < samplesPerRing; i++ ) {
			const a = ( i / samplesPerRing ) * Math.PI * 2
			dir.set( Math.cos( a ), 0, Math.sin( a ) )
			origin.set( target.x + dir.x * outerRadius, target.y, target.z + dir.z * outerRadius )
			dir.negate()
			rays.push( { origin: origin.clone(), dir: dir.clone(), hit: null, distance: Infinity } )
		}

		for ( const { mesh, invMat } of meshData ) {
			for ( const rd of rays ) {
				if ( rd.distance < 0.1 ) continue
				ray.set( rd.origin, rd.dir )
				localRay.copy( ray ).applyMatrix4( invMat )
				const hit = mesh.geometry.boundsTree.raycastFirst( localRay, FrontSide )
				if ( hit && hit.distance < rd.distance ) {
					hit.point.applyMatrix4( mesh.matrixWorld )
					rd.hit = hit
					rd.distance = hit.distance
				}
			}
		}

		for ( let i = 0; i < samplesPerRing; i++ ) {
			const rd = rays[i]
			let px, py, pz
			if ( rd.hit ) {
				px = rd.hit.point.x; py = rd.hit.point.y; pz = rd.hit.point.z
				hasHit = true
				if ( firstHitIndex < 0 ) firstHitIndex = i
				lastHitX = px; lastHitY = py; lastHitZ = pz
			} else if ( hasHit ) {
				px = prevX; py = prevY; pz = prevZ
			} else {
				px = target.x + dir.x * 0.1
				py = target.y
				pz = target.z + dir.z * 0.1
			}
			prevX = px; prevY = py; prevZ = pz
			const o = i * 3
			ring[o] = px; ring[o + 1] = py; ring[o + 2] = pz
		}

		if ( firstHitIndex > 0 ) {
			for ( let i = 0; i < firstHitIndex; i++ ) {
				const o = i * 3
				ring[o] = lastHitX; ring[o + 1] = lastHitY; ring[o + 2] = lastHitZ
			}
		}

		lines.push( ring )
		actives.push( hasHit )
	}

	return { lines, actives }
}

function buildPositionTextures( ringsA, ringsB, samplesPerRing, numRings ) {
	const w = samplesPerRing
	const h = numRings
	const dataA = new Float32Array( w * h * 4 )
	const dataB = new Float32Array( w * h * 4 )

	for ( let r = 0; r < h; r++ ) {
		const aA = ringsA.actives[r] ? 1 : 0
		const aB = ringsB.actives[r] ? 1 : 0
		const ringA = ringsA.lines[r]
		const ringB = ringsB.lines[r]
		for ( let i = 0; i < w; i++ ) {
			const idx = ( r * w + i ) * 4
			const o = i * 3
			dataA[idx]     = ringA[o]
			dataA[idx + 1] = ringA[o + 1]
			dataA[idx + 2] = ringA[o + 2]
			dataA[idx + 3] = aA
			dataB[idx]     = ringB[o]
			dataB[idx + 1] = ringB[o + 1]
			dataB[idx + 2] = ringB[o + 2]
			dataB[idx + 3] = aB
		}
	}

	const texA = new DataTexture( dataA, w, h, RGBAFormat, FloatType )
	const texB = new DataTexture( dataB, w, h, RGBAFormat, FloatType )
	texA.wrapS = RepeatWrapping
	texB.wrapS = RepeatWrapping
	texA.needsUpdate = true
	texB.needsUpdate = true
	return { texA, texB }
}
