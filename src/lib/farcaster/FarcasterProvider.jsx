'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';

const FarcasterContext = createContext(null);

export function FarcasterProvider({ children }) {
  const [context, setContext] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Signal to Warpcast immediately so the splash screen clears
    sdk.actions.ready();
    setIsReady(true);

    const init = async () => {
      try {
        // Read context from the SDK (provides FID, username, etc.)
        const ctx = await sdk.context;
        setContext(ctx);
      } catch (err) {
        console.warn('[FarcasterProvider] Could not read SDK context:', err);
      }
    };

    init();
  }, []);

  return (
    <FarcasterContext.Provider value={{ sdk, context, isReady }}>
      {children}
    </FarcasterContext.Provider>
  );
}

export function useFarcasterContext() {
  const ctx = useContext(FarcasterContext);
  if (!ctx) {
    throw new Error('useFarcasterContext must be used within a FarcasterProvider');
  }
  return ctx;
}
