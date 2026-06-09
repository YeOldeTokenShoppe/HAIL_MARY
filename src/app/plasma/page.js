'use client';

import PlasmaGlobe from '@/components/PlasmaGlobe';

export default function PlasmaPage() {
  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
      }}
    >
      <PlasmaGlobe numRays={25} style={{ background: '#000' }} />
    </main>
  );
}
