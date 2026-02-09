'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/farcaster/wagmiConfig';
import { FarcasterProvider } from '@/lib/farcaster/FarcasterProvider';

const queryClient = new QueryClient();

export default function MiniappLayout({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <FarcasterProvider>
          <div style={{
            backgroundColor: '#0a0a0a',
            minHeight: '100dvh',
            width: '100vw',
            margin: 0,
            padding: 0,
            overflow: 'hidden',
          }}>
            {children}
          </div>
        </FarcasterProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
