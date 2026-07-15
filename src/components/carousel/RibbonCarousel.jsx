'use client'

import * as THREE from 'three'
import { useRef, useState, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Image, Text } from '@react-three/drei'
import { easing } from 'maath'
import './util'
import { useMusic } from '../MusicContext'
import { useLanguage } from '../LanguageProvider'
import MobilePolaroidGallerySimple from './MobilePolaroidGallerySimple'
import DropInTitle from '../DropInTitle'

// Objects, not bare strings: MobilePolaroidGallerySimple reads `img.url` and
// silently falls back to the .jpg path when it's absent, so passing strings
// would leave phones on the 2.5 MB originals while desktop used the WebP.
// 512px WebP re-encodes of img1-8.jpg — 0.56 MB vs 2.54 MB on the wire, and
// ~10.6 MB of texture memory vs ~35.1 MB. The .jpg originals stay in place;
// /about's Carousel.js and OldsCoolTunnel still reference them.
const IMAGES = Array.from({ length: 8 }, (_, i) => ({
  url: `/carousel_images/img${i + 1}.webp`,
}))

const FALLBACK_CAPTIONS = [
  { year: '2200 BCE', location: 'High Pass of the Fertile Crescent', description: 'Driving back a bear market' },
  { year: '1981 CE', location: 'Los Angeles', description: 'The Guardian of Good Times' },
  { year: 'circa 1350–1450 CE', location: 'Eastern Mediterranean', description: 'Early clown encounter turns ugly' },
  { year: '2019 CE', location: 'Tokyo', description: 'Featured in popular manga series' },
  { year: '2031 CE', location: 'Neo-Miami', description: 'Laying down DeFi Beats' },
  { year: '2077 CE', location: 'Night City', description: 'Autonomous artisans provide laser-inscripted devotions' },
  { year: '87 CE', location: 'Peloponnesian Peninsula', description: 'Offering guidance for the attention economy' },
  { year: '4th century CE', location: 'Transtiberim, Rome', description: 'Pre-meme era patronage of the arts' },
]

function useCaptions() {
  const { t } = useLanguage()
  return useMemo(() => {
    const translated = []
    for (let i = 0; i < 8; i++) {
      const caption = t(`carousel.captions.${i}`)
      if (caption && typeof caption === 'object') translated.push(caption)
    }
    return translated.length === 8 ? translated : FALLBACK_CAPTIONS
  }, [t])
}

/**
 * The ribbon carousel as a page section. Unlike the /about original this does
 * not use drei's <ScrollControls> — that mounts its own scroll container and
 * swallows wheel events, which would trap the reader at the bottom of a
 * document-scroll page. Rotation is driven off the section's own progress
 * through the viewport instead, so it is a passive reader of window scroll
 * and composes with the statue scene's scroll handling above it.
 */
export default function RibbonCarousel({ turns = 1, height = '100vh' }) {
  const sectionRef = useRef(null)
  // The canvas stage, separate from the section: the title and caption share the
  // section, and only the stage should take drag input and the grab cursor.
  const stageRef = useRef(null)
  const progressRef = useRef(0)
  // Hand-drag rotation, summed with the scroll rotation rather than replacing
  // it: grabbing the carousel offsets it from wherever scroll has it, so the
  // two never fight over the same value.
  const dragRef = useRef(0)
  const velocityRef = useRef(0)
  const draggingRef = useRef(false)
  const [grabbing, setGrabbing] = useState(false)
  const [inView, setInView] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const { is80sMode } = useMusic()
  const { t } = useLanguage()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Only mount the canvas while the section is near the viewport. StarfieldStatueScene
  // owns the page's only other WebGL context; keeping a second one alive for the whole
  // session costs GPU memory nobody is looking at.
  useEffect(() => {
    const el = sectionRef.current
    if (!el || isMobile) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '300px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isMobile])

  // Progress runs 0 → 1 as the section climbs from just-entering to filling the
  // viewport. Deliberately not normalised over the section's full pass: as the
  // last element on the page it can never scroll clear of the top, so that
  // range would strand the rotation half-finished.
  useEffect(() => {
    if (isMobile) return
    const onScroll = () => {
      const el = sectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const p = (window.innerHeight - rect.top) / window.innerHeight
      progressRef.current = Math.min(Math.max(p, 0), 1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isMobile])

  // chart-shrine.css force-sets `pointer-events: none` on direct children of
  // .shrine-page.neon, and its safety-net rule only re-enables a/button/input —
  // a <canvas> isn't covered, which would leave the carousel inert. Inline
  // styles outrank that selector, so opt back in here rather than widen a
  // selector /chart-shrine also depends on. flexShrink guards the height
  // against .shrine-page's column flex.
  const frame = {
    position: 'relative',
    zIndex: 1,
    pointerEvents: 'auto',
    flexShrink: 0,
  }

  // Panel chrome lifted from .holy-trin's mobile rule (holyTrin.css:384-408,
  // inside its max-width:900px block) so this section and the Trin80 card above
  // it read as siblings. Note this is the mobile override, NOT the base rule at
  // :205 — that one's purple linear-gradient never renders on phones.
  // Deliberately no backdrop-filter: the base rule's blur(2px) is dropped here
  // because this page runs near the mobile GPU ceiling. Duplicated rather than
  // reusing the class: .holy-trin brings its own flex layout and a ~220px top
  // margin tuned to its slot, and sits in chart-shrine.css's :not() list.
  const holyTrinPanel = {
    width: 'calc(100% - 32px)',
    maxWidth: '360px',
    // .shrine-page.neon zeroes its own padding-bottom at <=900px on the premise
    // that below-fold sections clear the fixed dock themselves (chart-shrine.css
    // :285). As the last section, this one has to — 22px alone would leave the
    // card under the 66px dock. Same figure .below-fold-chamber uses, which also
    // leaves room for socials underneath.
    margin: '0 auto calc(150px + env(safe-area-inset-bottom, 0px))',
    padding: '32px 16px 28px',
    background:
      'radial-gradient(115% 90% at 50% 0%, rgba(6, 11, 19, 0.88) 0%, rgba(3, 6, 12, 0.84) 55%, rgba(0, 0, 0, 0.74) 100%)',
    border: '1px solid rgba(42, 214, 238, 0.16)',
    borderRadius: '16px',
    color: '#f1d77a',
    textAlign: 'center',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 18px rgba(42, 214, 238, 0.07)',
  }

  // Drag-to-spin. Bound to the section rather than the canvas so a grab that
  // starts on a polaroid and slides onto empty space keeps tracking, and so
  // pointerup outside the window still releases. touchAction stays pan-y
  // (inherited from .shrine-page), which hands vertical swipes back to the
  // page scroller — horizontal swipes spin, vertical ones scroll.
  useEffect(() => {
    const el = stageRef.current
    if (!el || isMobile) return

    let lastX = 0
    let lastT = 0

    const onDown = (e) => {
      draggingRef.current = true
      setGrabbing(true)
      lastX = e.clientX
      lastT = e.timeStamp
      velocityRef.current = 0
    }

    const onMove = (e) => {
      if (!draggingRef.current) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      // A drag across the full viewport width turns it one revolution.
      const dr = (dx / window.innerWidth) * Math.PI * 2
      dragRef.current += dr
      const dt = Math.max(e.timeStamp - lastT, 1)
      lastT = e.timeStamp
      // rad/sec, clamped so a flick can't launch it into a blur.
      velocityRef.current = Math.max(Math.min((dr / dt) * 1000, 8), -8)
    }

    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      setGrabbing(false)
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isMobile])

  if (isMobile) {
    return (
      <section
        ref={sectionRef}
        className="ribbon-carousel-mobile"
        style={{
          ...frame,
          ...holyTrinPanel,
          // Height follows the content (title + caption + the polaroid box
          // below) rather than 100vh, which left the card running past the
          // polaroids to the bottom of the page.
          height: 'auto',
          overflow: 'hidden',
          // Column so the title, its caption and the polaroid container stack in
          // order and the container can absorb whatever height is left over —
          // rather than the polaroids being offset by a hand-tuned number that
          // breaks the moment the title wraps to a different line count.
          display: 'flex',
          flexDirection: 'column',
          // MobilePolaroidGallerySimple was written as a full-page takeover for
          // /about, so its .polaroid-gallery and .mobile-gallery-info are
          // position:fixed and would pin to the viewport, sit over the statue
          // and ignore scroll. This transform makes the section their containing
          // block so they resolve inside it and scroll with the page. Cheaper
          // and safer than editing the component, which /about's Carousel.js
          // still imports.
          transform: 'translateZ(0)',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Outranks the component's own rules (0,1,0). Sized
                 fixed/100vw/100vh for the full-page /about takeover, which here
                 pinned it to the card's top edge and painted over the title. Put
                 back into flow so it stacks after DropInTitle and its caption,
                 and drops the tan gradient so the panel's scrim shows through.
                 Needs an explicit height because the gallery inside is
                 position:fixed and so contributes none. transform makes this the
                 containing block for that gallery, so its top % resolves against
                 this box rather than the whole card. */
              .ribbon-carousel-mobile .polaroid-container {
                position: relative;
                top: auto;
                left: auto;
                flex: 0 0 auto;
                width: 100%;
                height: clamp(360px, 52vh, 460px);
                background: transparent;
                border-radius: 16px;
                transform: translateZ(0);
              }

              /* Centre the stack in that box. The component's own
                 top: calc(35% + 1rem) and its 2rem/7rem margins were balancing
                 it against a full 100vh takeover; against this box they'd ride
                 high and clip at the top. */
              .ribbon-carousel-mobile .polaroid-gallery {
                top: 50%;
                margin-top: 0;
                margin-bottom: 0;
              }

              /* Still fixed, and now empty since DropInTitle replaced the h2 —
                 pin it to this box rather than let it hang off the card. */
              .ribbon-carousel-mobile .mobile-gallery-info {
                color: #f1d77a;
              }

              /* The caption under the title. Keeps its system sans for
                 legibility at 14px — only the colour moves, to a dimmed tint of
                 the panel's gold, since its inherited #333 was picked to read
                 against the gallery's original tan background. */
              .ribbon-carousel-mobile .mobile-gallery-description {
                color: rgba(241, 215, 122, 0.78);
                opacity: 1;
              }
            `,
          }}
        />
        <MobilePolaroidGallerySimple images={IMAGES} is80sMode={is80sMode} />
      </section>
    )
  }

  // No background of its own — the canvas is alpha and the page's fixed
  // starfield sits behind at z-index 0, so it shows through the carousel.
  return (
    <section
      ref={sectionRef}
      style={{
        ...frame,
        // Desktop stays full-bleed — the .holy-trin card chrome is mobile-only
        // there too (holyTrin.css strips it above 901px). Cancels
        // .shrine-page's 20px side padding so the band runs edge to edge.
        width: 'calc(100% + 40px)',
        marginLeft: '-20px',
        marginRight: '-20px',
        height,
        overflow: 'hidden',
        // Column so the title and caption sit above the carousel, mirroring the
        // mobile card's order; the stage below takes whatever height is left.
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <div style={{ flex: '0 0 auto', paddingTop: '2.5rem' }}>
        <DropInTitle
          lines={['Souvenirs', 'From the', 'Singular80']}
          colors={['#00ff00', '#f4e4c1', '#ffd700']}
          fontSize={{ mobile: '3rem', desktop: '3.4rem' }}
          isMobile={false}
          triggerAnimation={inView}
          // Per-section id, matching the mater-/biz-/holy-trin- convention.
          // Not "holy-trin-heading" — that's HolyTrinSection's
          // (HolyTrinSection.jsx:78), and both render on this page.
          instanceId="carousel-heading"
        />
        <p
          style={{
            // .mobile-gallery-description lives in MobilePolaroidGallerySimple's
            // own <style>, which never mounts on desktop — hence styled here
            // rather than reusing that class.
            margin: '1.25rem auto 0',
            maxWidth: '46ch',
            padding: '0 20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px',
            lineHeight: 1.4,
            color: 'rgba(241, 215, 122, 0.78)',
            textAlign: 'center',
          }}
        >
          {t('carousel.subtitle') ||
            'A visual canon of Our Lady of Perpetual Profit, from antiquity to the future.'}
        </p>
      </div>

      {/* The drag surface is the stage, not the whole section — otherwise the
          grab cursor would sit over the title and caption too. */}
      <div
        ref={stageRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          cursor: grabbing ? 'grabbing' : 'grab',
        }}
      >
        {inView && (
        <Canvas
          camera={{ position: [0, 0, 100], fov: 15 }}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
            stencil: false,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1
          }}
        >
          {/* Black rather than the original's dusty pink: that colour was
              chosen to melt into a dawn Environment backdrop that no longer
              exists, and the cards sit inside the 8.5–12 range, so a pink fog
              would haze them against the page's dark starfield. */}
          <fog attach="fog" args={['#000000', 8.5, 12]} />
          <Suspense fallback={null}>
            <Rig
              progressRef={progressRef}
              dragRef={dragRef}
              velocityRef={velocityRef}
              draggingRef={draggingRef}
              turns={turns}
              rotation={[0, 0, 0.15]}
            >
              <Carousel />
            </Rig>
            <Banner position={[0, -0.15, 0]} is80sMode={is80sMode} progressRef={progressRef} />
          </Suspense>
        </Canvas>
        )}
      </div>
    </section>
  )
}

function Rig({ progressRef, dragRef, velocityRef, draggingRef, turns, ...props }) {
  const ref = useRef()
  const frameCount = useRef(0)

  useFrame((state, delta) => {
    if (!ref.current) return
    frameCount.current++

    // Spin-down after a flick. Decayed per-second rather than per-frame so the
    // glide lasts the same wall-clock time on a 120Hz display as on a 60Hz one.
    if (!draggingRef.current && Math.abs(velocityRef.current) > 1e-3) {
      dragRef.current += velocityRef.current * delta
      velocityRef.current *= Math.pow(0.04, delta)
    }

    const target = -progressRef.current * Math.PI * 2 * turns + dragRef.current

    if (draggingRef.current) {
      // 1:1 with the hand while held — damping here reads as lag.
      ref.current.rotation.y = target
    } else {
      // Damped rather than assigned straight from scroll position: raw window.scrollY
      // jitters with trackpad momentum, and feeding that in directly makes the ribbon
      // judder — the same reason the landing statue smooths its own scroll depth.
      easing.damp(ref.current.rotation, 'y', target, 0.25, delta)
    }

    if (frameCount.current % 2 === 0) {
      state.events.update()
      easing.damp3(state.camera.position, [-state.pointer.x * 2, state.pointer.y + 1.5, 10], 0.3, delta * 2)
      state.camera.lookAt(0, 0, 0)
    }
  })

  return <group ref={ref} {...props} />
}

function Carousel({ radius = 1.4, count = 8 }) {
  const captions = useCaptions()

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Card
          key={i}
          url={IMAGES[i].url}
          position={[Math.sin((i / count) * Math.PI * 2) * radius, 0, Math.cos((i / count) * Math.PI * 2) * radius]}
          rotation={[0, (i / count) * Math.PI * 2, 0]}
          caption={captions[i]}
        />
      ))}
    </>
  )
}

function Card({ url, caption, ...props }) {
  const groupRef = useRef()
  const imageRef = useRef()
  const [hovered, hover] = useState(false)
  const frameCount = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    frameCount.current++

    if (frameCount.current % 2 === 0) {
      easing.damp3(groupRef.current.scale, hovered ? 1.15 : 1, 0.1, delta * 2)
      if (imageRef.current?.material) {
        easing.damp(imageRef.current.material, 'zoom', hovered ? 1 : 1.5, 0.2, delta * 2)
      }
    }
  })

  return (
    <group ref={groupRef} {...props}>
      {/* White polaroid frame — offset down so the image sits high and leaves
          the fat bottom border the captions are written on. */}
      <mesh position={[0, -0.08, -0.001]}>
        <planeGeometry args={[1.05, 1.3]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>

      <Image
        ref={imageRef}
        url={url}
        transparent
        side={THREE.FrontSide}
        onPointerOver={(e) => {
          e.stopPropagation()
          hover(true)
        }}
        onPointerOut={() => hover(false)}
        position={[0, 0.05, 0.001]}
      >
        <planeGeometry args={[0.85, 0.85]} />
      </Image>

      <mesh position={[0, -0.08, -0.002]}>
        <planeGeometry args={[1.05, 1.3]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} toneMapped={false} fog={false} />
      </mesh>

      {caption && (
        <>
          <Text
            position={[0, -0.45, 0.001]}
            fontSize={0.06}
            color="black"
            anchorX="center"
            anchorY="middle"
            maxWidth={1.2}
            lineHeight={1.2}
            font="/fonts/HomemadeApple-Regular.ttf"
          >
            {caption.year}
          </Text>
          <Text
            position={[0, -0.52, 0.001]}
            fontSize={0.04}
            color="#444444"
            anchorX="center"
            anchorY="middle"
            maxWidth={1.2}
            lineHeight={1.4}
            font="/fonts/HomemadeApple-Regular.ttf"
          >
            {caption.location}
          </Text>
          <Text
            position={[0, -0.61, 0.001]}
            fontSize={0.04}
            color="#666666"
            anchorX="center"
            anchorY="middle"
            maxWidth={1}
            lineHeight={1.4}
            font="/fonts/HomemadeApple-Regular.ttf"
            textAlign="center"
          >
            {caption.description}
          </Text>
        </>
      )}

      <mesh position={[0.02, -0.1, -0.002]}>
        <planeGeometry args={[1.08, 1.33]} />
        <meshBasicMaterial color="#000000" opacity={0.15} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Banner({ is80sMode, progressRef, ...props }) {
  const ref = useRef()
  const lastProgress = useRef(0)
  const frameCount = useRef(0)

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    const DESIRED_PHRASE_COUNT = 5
    const fontSize = 84
    context.font = `bold ${fontSize}px UnifrakturCook, serif`

    const text = 'Our Lady of Perpetual Profit • Domina Nostra Lucri Perpetui • '
    const textWidth = context.measureText(text).width

    canvas.width = Math.ceil(textWidth * DESIRED_PHRASE_COUNT)
    canvas.height = 128

    if (is80sMode) {
      context.fillStyle = '#00ffff'
    } else {
      // Gold, as a vertical ramp across the ribbon's narrow height rather than a
      // flat fill — a single mid-gold reads as mustard, whereas the dark-edge →
      // highlight → dark-edge sweep catches the eye as metal as the band turns.
      // The material is toneMapped={false}, so these land unmodified by ACES.
      const sheen = context.createLinearGradient(0, 0, 0, canvas.height)
      sheen.addColorStop(0, '#8c6d1f')
      sheen.addColorStop(0.32, '#f7e98e')
      sheen.addColorStop(0.5, '#d4af37')
      sheen.addColorStop(0.68, '#f7e98e')
      sheen.addColorStop(1, '#8c6d1f')
      context.fillStyle = sheen
    }
    context.fillRect(0, 0, canvas.width, canvas.height)

    // Canvas resize resets context state, so the font has to be re-set here.
    context.font = `bold ${fontSize}px UnifrakturCook, serif`
    context.fillStyle = '#000000'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    for (let i = 0; i < DESIRED_PHRASE_COUNT; i++) {
      context.fillText(text, i * textWidth, canvas.height / 2)
    }

    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.wrapS = THREE.RepeatWrapping
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping
    canvasTexture.repeat.set(1, 1)
    canvasTexture.needsUpdate = true
    return canvasTexture
  }, [is80sMode])

  useEffect(() => () => texture?.dispose(), [texture])

  useFrame((_, delta) => {
    frameCount.current++

    if (texture) texture.offset.x += delta / 24

    if (frameCount.current % 3 === 0 && ref.current?.material?.time) {
      // Scroll velocity drives the wave, with a floor so the ribbon still
      // breathes when the page is still. ×3 compensates for the throttle.
      const p = progressRef.current
      const scrollDelta = Math.abs(p - lastProgress.current)
      lastProgress.current = p
      ref.current.material.time.value += (scrollDelta * 4 + 0.01) * 3
    }
  })

  return (
    <mesh ref={ref} {...props}>
      {/* Radius 1.6 against the carousel's 1.4 is what threads the ribbon
          through the cards rather than around them. */}
      <cylinderGeometry args={[1.6, 1.6, 0.14, 128, 16, true]} />
      <meshSineMaterial map={texture} side={THREE.DoubleSide} transparent toneMapped={false} />
    </mesh>
  )
}
