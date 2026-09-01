'use client'

import * as THREE from 'three'
import { useRef, useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
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
  // The 512px WebP is all the polaroid plane can show, but the lightbox blows
  // one card up to most of the viewport height, where that re-encode goes soft
  // on a 2x display. The .jpg originals run up to 1024px and are only fetched
  // by the click that opens the lightbox, so the section's load is unchanged.
  full: `/carousel_images/img${i + 1}.jpg`,
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
  // Set once a press travels past the slop threshold, so the click that ends a
  // spin-drag can be told apart from a click that opens a card. Read in
  // handleSelect and only reset on the next press.
  const movedRef = useRef(false)
  const [grabbing, setGrabbing] = useState(false)
  const [hoveringCard, setHoveringCard] = useState(false)
  // Index of the polaroid shown enlarged, or null. Doubles as the lightbox's
  // open flag.
  const [selected, setSelected] = useState(null)
  const [inView, setInView] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const { is80sMode } = useMusic()
  const { t } = useLanguage()
  // Read here rather than inside <Carousel>, which sits across the Canvas
  // boundary, so the lightbox and the cards are captioned from one source.
  const captions = useCaptions()

  const handleSelect = useCallback((i) => {
    if (movedRef.current) return
    // Kill the flick's glide, so the ribbon isn't still coasting when the
    // lightbox closes and hands the page back.
    velocityRef.current = 0
    setSelected(i)
  }, [])

  const closeLightbox = useCallback(() => setSelected(null), [])

  const stepLightbox = useCallback((dir) => {
    setSelected((i) => (i === null ? null : (i + dir + IMAGES.length) % IMAGES.length))
  }, [])

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
    let downX = 0

    const onDown = (e) => {
      draggingRef.current = true
      setGrabbing(true)
      lastX = e.clientX
      lastT = e.timeStamp
      downX = e.clientX
      movedRef.current = false
      velocityRef.current = 0
    }

    const onMove = (e) => {
      if (!draggingRef.current) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      // Measured from the press, not summed per-move: a hand that wanders a
      // pixel and comes back is still a click. 4px is the usual slop — below
      // it, a trackpad tap can register a stray move of 1-2px.
      if (Math.abs(e.clientX - downX) > 4) movedRef.current = true
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
                /* manipulation rather than the container's pan-x, for two
                   reasons: it takes iOS's double-tap-to-zoom off the stack so
                   the second tap reaches the close-up handler instead of the
                   browser, and unlike pan-x it still lets a vertical swipe
                   scroll the page — this gallery sits in a scrolling document
                   here, not in /about's full-page takeover where pan-x was
                   chosen. Scoped to this section so /about keeps pan-x. */
                touch-action: manipulation;
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
        <MobilePolaroidGallerySimple
          images={IMAGES}
          is80sMode={is80sMode}
          onSelect={setSelected}
        />

        {selected !== null && (
          <Lightbox
            index={selected}
            captions={captions}
            onClose={closeLightbox}
            onStep={stepLightbox}
          />
        )}
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
          lines={['Snapshots', 'From the', 'Singular80']}
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
            // Body copy matched to .holy-trin-pillar-desc (holyTrin.css, in its
            // min-width:901px block) — the prose of the nearest section, and the
            // same register the intro's .hero-intro__cry reads in. Copied rather
            // than reusing either class: both are BEM-scoped to their own
            // section and carry its layout with them. The system-sans 14px this
            // replaces was the only body text on the page not set in
            // IoskeleyMono, which is why it read as foreign.
            fontFamily: '"IoskeleyMono", "IBM Plex Mono", ui-monospace, monospace',
            fontWeight: 400,
            fontSize: 'clamp(0.92rem, 1.05vw, 1.12rem)',
            // The pillars' own 1.2 is set for one-line labels; this sentence
            // wraps, so it takes the intro cry's 1.24 — the leading that section
            // uses for running prose.
            lineHeight: 1.24,
            letterSpacing: 0,
            color: '#e9d4a0',
            opacity: 0.95,
            // As on the pillars: holds the line legible where it crosses the
            // starfield showing through the alpha canvas.
            textShadow: '0 1px 8px rgba(0, 0, 0, 0.6)',
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
          // zoom-in over a card is the only hint that the polaroids open; the
          // drag affordance still wins while a drag is actually underway.
          cursor: grabbing ? 'grabbing' : hoveringCard ? 'zoom-in' : 'grab',
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
            {/* Scale the whole scene up ~18%. Applied to a parent of both the
                card ring and the banner so their threaded relationship (ribbon
                radius 1.6 vs cards 1.4) is preserved.
                Lifted +0.2 in Y as well: the camera rests above centre and looks
                down into the ring, and the polaroids are bottom-heavy (captions
                hang below each photo), so at this size the ring's bottom clipped
                the lower frustum edge while the top had empty headroom. The shift
                spends that headroom to clear the bottom without shrinking. */}
            <group scale={1.18} position={[0, 0.2, 0]}>
              <Rig
                progressRef={progressRef}
                dragRef={dragRef}
                velocityRef={velocityRef}
                draggingRef={draggingRef}
                turns={turns}
                // Roll eased from 0.15 → 0.08 to pair with the group scale above.
                // The vertical fov (15°) is fixed, so the enlarged ring has no
                // extra top/bottom room; at the old tilt the outer corner of a
                // side-facing card — now 18% further out — crossed the frustum
                // edge at the quarter-turn angles. Less roll pulls that corner
                // back in while keeping a visible tilt and the larger size.
                rotation={[0, 0, 0.08]}
              >
                <Carousel
                  captions={captions}
                  onSelect={handleSelect}
                  onHoverChange={setHoveringCard}
                />
              </Rig>
              <Banner position={[0, -0.15, 0]} is80sMode={is80sMode} progressRef={progressRef} />
            </group>
          </Suspense>
        </Canvas>
        )}
      </div>

      {selected !== null && (
        <Lightbox
          index={selected}
          captions={captions}
          onClose={closeLightbox}
          onStep={stepLightbox}
        />
      )}
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

function Carousel({ captions, onSelect, onHoverChange, radius = 1.4, count = 8 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Card
          key={i}
          url={IMAGES[i].url}
          position={[Math.sin((i / count) * Math.PI * 2) * radius, 0, Math.cos((i / count) * Math.PI * 2) * radius]}
          rotation={[0, (i / count) * Math.PI * 2, 0]}
          caption={captions[i]}
          onSelect={() => onSelect(i)}
          onHoverChange={onHoverChange}
        />
      ))}
    </>
  )
}

function Card({ url, caption, onSelect, onHoverChange, ...props }) {
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
          onHoverChange?.(true)
        }}
        onPointerOut={() => {
          hover(false)
          onHoverChange?.(false)
        }}
        // stopPropagation so a click only ever opens the nearest card, not the
        // one facing away on the far side of the ring behind it. Bound to the
        // photo rather than the group, keeping the click target identical to
        // the hover target that advertises it.
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.()
        }}
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

/**
 * The enlarged view of a single polaroid.
 *
 * Portalled to <body> rather than rendered inside the section: the section is
 * overflow:hidden and the dock is fixed at z-index 10000, so a child here would
 * be clipped by the former and painted under the latter. 10050 matches
 * LittleBookOverlay, the page's other full-screen takeover.
 */
function Lightbox({ index, captions, onClose, onStep }) {
  const image = IMAGES[index]
  const caption = captions[index]
  // Tracked by url, not a boolean: keyed to the src, it resets itself when the
  // arrows step to a new photo without needing an effect to clear it.
  const [loadedUrl, setLoadedUrl] = useState(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === 'ArrowLeft') onStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onStep])

  // Window scroll drives the ribbon's rotation, so an unlocked page would let a
  // stray wheel spin the carousel behind the scrim and leave it somewhere else
  // on close. Saved and restored rather than cleared, per LittleBookOverlay.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div
      className="rc-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={caption ? `${caption.year}, ${caption.location}` : 'Enlarged souvenir'}
      onClick={onClose}
    >
      <style>{`
        .rc-lightbox {
          position: fixed;
          inset: 0;
          z-index: 10050;
          display: grid;
          place-items: center;
          background: radial-gradient(
            ellipse at center,
            rgba(10, 6, 20, 0.72) 0%,
            rgba(2, 3, 8, 0.93) 100%
          );
          animation: rc-lb-fade 0.2s ease both;
        }

        /* Sized off height as well as width: the frame is a square photo plus a
           caption, so a wide-but-short window would otherwise push the caption
           off the bottom. */
        .rc-lightbox__polaroid {
          position: relative;
          width: min(86vw, 460px, 58vh);
          margin: 0;
          padding: 14px 14px 0;
          background: #fdfcf7;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.3);
          cursor: default;
          animation: rc-lb-in 0.28s cubic-bezier(0.2, 0.8, 0.3, 1) both;
        }

        /* Holds the WebP the carousel already has cached, so the frame is filled
           the instant it opens and the .jpg sharpens in over it rather than
           flashing an empty white square. */
        .rc-lightbox__frame {
          position: relative;
          aspect-ratio: 1;
          background-size: cover;
          background-position: center;
          background-color: #111;
        }

        .rc-lightbox__img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .rc-lightbox__img--loaded { opacity: 1; }

        /* Mirrors the in-canvas caption: same face, same black → #444 → #666
           ramp down the three lines. */
        .rc-lightbox__caption {
          font-family: "Homemade Apple", cursive;
          text-align: center;
          padding: 20px 6px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .rc-lightbox__year { font-size: 1.15rem; color: #000; }
        .rc-lightbox__location { font-size: 0.8rem; color: #444; }
        .rc-lightbox__desc { font-size: 0.8rem; color: #666; line-height: 1.5; }

        .rc-lightbox__count {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          letter-spacing: 2px;
          color: rgba(241, 215, 122, 0.7);
        }

        .rc-lightbox__btn {
          position: fixed;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid rgba(42, 214, 238, 0.22);
          background: rgba(6, 11, 19, 0.72);
          color: #f1d77a;
          cursor: pointer;
          line-height: 1;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .rc-lightbox__btn:hover {
          background: rgba(10, 18, 30, 0.92);
          border-color: rgba(42, 214, 238, 0.5);
        }

        .rc-lightbox__close {
          top: 20px;
          right: max(20px, 3vw);
          width: 40px;
          height: 40px;
          font-size: 20px;
        }
        .rc-lightbox__close:hover { transform: scale(1.08); }

        .rc-lightbox__nav {
          top: 50%;
          width: 46px;
          height: 46px;
          font-size: 24px;
          /* Own the translate here — the hover rule has to restate it or the
             button would snap back to centre-on-top as it scales. */
          transform: translateY(-50%);
        }
        .rc-lightbox__nav:hover { transform: translateY(-50%) scale(1.08); }
        .rc-lightbox__nav--prev { left: max(16px, 4vw); }
        .rc-lightbox__nav--next { right: max(16px, 4vw); }

        /* Phones: at 86vw the photo runs under arrows pinned to the side
           margins, so they drop to a row beneath it and the frame gives back
           enough height for them to sit in. */
        @media (max-width: 768px) {
          .rc-lightbox__polaroid { width: min(84vw, 420px, 52vh); }
          .rc-lightbox__nav {
            top: auto;
            bottom: calc(24px + env(safe-area-inset-bottom, 0px));
            transform: none;
          }
          .rc-lightbox__nav:hover { transform: none; }
          .rc-lightbox__nav--prev { left: calc(50% - 74px); }
          .rc-lightbox__nav--next { right: calc(50% - 74px); }
        }

        @keyframes rc-lb-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rc-lb-in {
          from { opacity: 0; transform: scale(0.92) rotate(-3deg); }
          to { opacity: 1; transform: scale(1) rotate(-1deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .rc-lightbox, .rc-lightbox__polaroid { animation: none; }
          .rc-lightbox__polaroid { transform: rotate(-1deg); }
          .rc-lightbox__img { transition: none; }
        }
      `}</style>

      <span className="rc-lightbox__count">
        {String(index + 1).padStart(2, '0')} / {String(IMAGES.length).padStart(2, '0')}
      </span>

      <button className="rc-lightbox__btn rc-lightbox__close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      <button
        className="rc-lightbox__btn rc-lightbox__nav rc-lightbox__nav--prev"
        // Without this the click reaches the backdrop and closes the lightbox
        // the moment it steps.
        onClick={(e) => {
          e.stopPropagation()
          onStep(-1)
        }}
        aria-label="Previous souvenir"
      >
        ‹
      </button>

      {/* Keyed so a step restarts the drop-in rather than swapping the photo
          inside a frame that never moves. */}
      <figure
        key={index}
        className="rc-lightbox__polaroid"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rc-lightbox__frame" style={{ backgroundImage: `url(${image.url})` }}>
          <img
            key={image.full}
            className={`rc-lightbox__img${loadedUrl === image.full ? ' rc-lightbox__img--loaded' : ''}`}
            src={image.full}
            alt={caption ? `${caption.year}, ${caption.location}. ${caption.description}` : ''}
            onLoad={() => setLoadedUrl(image.full)}
          />
        </div>
        {caption && (
          <figcaption className="rc-lightbox__caption">
            <span className="rc-lightbox__year">{caption.year}</span>
            <span className="rc-lightbox__location">{caption.location}</span>
            <span className="rc-lightbox__desc">{caption.description}</span>
          </figcaption>
        )}
      </figure>

      <button
        className="rc-lightbox__btn rc-lightbox__nav rc-lightbox__nav--next"
        onClick={(e) => {
          e.stopPropagation()
          onStep(1)
        }}
        aria-label="Next souvenir"
      >
        ›
      </button>
    </div>,
    document.body
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
