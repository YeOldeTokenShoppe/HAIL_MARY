import React, { useRef, useState, useEffect, useCallback } from 'react'
import './MobileCarousel.css'
import TickerCard from './TickerCard'

const defaultSlides = [
  { image: '/carousel_images/img1.jpg', title: 'Market Rally', desc: 'Ride the bull run to glory' },
  { image: '/carousel_images/img2.jpg', title: 'La Virgen', desc: 'Blessings on the boulevard' },
  { image: '/carousel_images/img3.jpg', title: 'Sacred Battle', desc: 'Light vs. chaos, eternal' },
  { component: TickerCard, title: 'RL80 Live', desc: 'Real-time token data' },
  { image: '/carousel_images/img5.jpg', title: 'DJ Mary', desc: 'Drop the beat, raise the spirit' },
  { video: '/videos/gr80_greetings.mp4', title: 'Saint GR80', desc: 'A holy introduction' },
  { image: '/carousel_images/img7.jpg', title: 'HODL Madonna', desc: 'Diamond hands, sacred bonds' },
  { image: '/carousel_images/img8.jpg', title: 'Illumin80', desc: 'The truth glows in the dark' },
]

export default function MobileCarousel({
  slides = defaultSlides,
  autoPlay = true,
  autoPlayInterval = 4000,
  onCardClick,
}) {
  const trackRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollTimeout = useRef(null)
  const autoPlayRef = useRef(null)

  // Observe which card is centered
  const updateActiveCard = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const cards = track.children
    const trackRect = track.getBoundingClientRect()
    const center = trackRect.left + trackRect.width / 2

    let closestIndex = 0
    let closestDist = Infinity

    for (let i = 0; i < cards.length; i++) {
      const cardRect = cards[i].getBoundingClientRect()
      const cardCenter = cardRect.left + cardRect.width / 2
      const dist = Math.abs(cardCenter - center)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    }

    setActiveIndex(closestIndex)
  }, [])

  // Scroll listener
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const onScroll = () => {
      updateActiveCard()
      setIsUserScrolling(true)
      clearTimeout(scrollTimeout.current)
      scrollTimeout.current = setTimeout(() => {
        setIsUserScrolling(false)
      }, 2000)
    }

    track.addEventListener('scroll', onScroll, { passive: true })
    return () => track.removeEventListener('scroll', onScroll)
  }, [updateActiveCard])

  // Auto-play
  useEffect(() => {
    if (!autoPlay || isUserScrolling) {
      clearInterval(autoPlayRef.current)
      return
    }

    autoPlayRef.current = setInterval(() => {
      const next = (activeIndex + 1) % slides.length
      scrollToIndex(next)
    }, autoPlayInterval)

    return () => clearInterval(autoPlayRef.current)
  }, [autoPlay, autoPlayInterval, activeIndex, isUserScrolling, slides.length])

  const scrollToIndex = (index) => {
    const track = trackRef.current
    if (!track || !track.children[index]) return

    const card = track.children[index]
    const trackRect = track.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const offset = cardRect.left - trackRect.left - (trackRect.width / 2 - cardRect.width / 2) + track.scrollLeft

    track.scrollTo({ left: offset, behavior: 'smooth' })
  }

  const handleDotClick = (index) => {
    setIsUserScrolling(false)
    scrollToIndex(index)
  }

  return (
    <div className="mobile-carousel">
      {/* Scroll track */}
      <div className="mobile-carousel__track" ref={trackRef}>
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`mobile-carousel__card ${i === activeIndex ? 'active' : ''}`}
            onClick={() => onCardClick?.(i)}
          >
            {slide.component ? (
              <slide.component />
            ) : slide.video ? (
              <video
                src={slide.video}
                autoPlay
                loop
                muted
                playsInline
                className="mobile-carousel__video"
                onClick={(e) => {
                  e.stopPropagation()
                  e.target.muted = !e.target.muted
                }}
              />
            ) : (
              <img src={slide.image} alt={slide.title} loading={i < 3 ? 'eager' : 'lazy'} draggable={false} />
            )}
          </div>
        ))}
      </div>

      {/* Title & description below card */}
      {slides[activeIndex]?.title && (
        <div className="mobile-carousel__label visible" key={activeIndex}>
          <h3 className="mobile-carousel__title">{slides[activeIndex].title}</h3>
          <p className="mobile-carousel__desc">{slides[activeIndex].desc}</p>
        </div>
      )}

      {/* Counter */}
      <div className="mobile-carousel__counter">
        <span>{activeIndex + 1}</span> / {slides.length}
      </div>

      {/* Dots */}
      <div className="mobile-carousel__dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`mobile-carousel__dot ${i === activeIndex ? 'active' : ''}`}
            onClick={() => handleDotClick(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Autoplay progress */}
      {autoPlay && !isUserScrolling && (
        <div className="mobile-carousel__progress">
          <div
            key={activeIndex}
            className="mobile-carousel__progress-fill animating"
            style={{ '--duration': `${autoPlayInterval}ms` }}
          />
        </div>
      )}

      {/* Swipe hint */}
      <div className="mobile-carousel__hint">&#10095;</div>
    </div>
  )
}
