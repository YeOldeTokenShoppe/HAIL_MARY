'use client'

import React, { useEffect, useRef } from 'react'

export default function FireHorseFirePage() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let dispose = null
    let cancelled = false

    // Dynamic import: keeps the heavy three/webgpu build off SSR and other routes.
    import('./volumetricFire.js')
      .then(({ startVolumetricFire }) => startVolumetricFire(container))
      .then((cleanup) => {
        if (cancelled) cleanup?.()
        else dispose = cleanup
      })
      .catch((err) => {
        console.error('[firehorse-fire] failed to start:', err)
        if (!cancelled) {
          const msg = document.createElement('div')
          msg.style.cssText =
            'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff5a3c;font-family:monospace;text-align:center;padding:2rem;'
          msg.textContent = 'Volumetric fire failed to start — see console.'
          container.appendChild(msg)
        }
      })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}
    />
  )
}
