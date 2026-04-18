'use client'

import dynamic from 'next/dynamic'

const StarfieldStatueScene = dynamic(
  () => import('@/components/StarfieldStatueScene'),
  { ssr: false }
)

export default function StatueTestPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: 'min(700px, 90vw)', height: 'min(500px, 70vh)' }}>
        <StarfieldStatueScene
          style={{ width: '100%', height: '100%' }}
          statueProps={{ scale: [3, 3, 3] }}
          cameraRadius={2.0}
          showStats
        />
      </div>
    </div>
  )
}
