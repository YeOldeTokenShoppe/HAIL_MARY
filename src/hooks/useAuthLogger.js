'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { logClerkLogin } from '@/lib/authLogger';

export function useAuthLogger() {
  const { user, isLoaded } = useUser();
  const hasLoggedLogin = useRef(false);
  const lastUserId = useRef(null);

  // Log Clerk login events
  useEffect(() => {
    if (isLoaded && user) {
      // Only log if this is a new session or different user
      if (!hasLoggedLogin.current || lastUserId.current !== user.id) {
        
        // Log to Firebase
        logClerkLogin(user).then(docId => {
          if (docId) {
          }
        }).catch(error => {
          console.error('Error logging Clerk login:', error);
        });
        
        hasLoggedLogin.current = true;
        lastUserId.current = user.id;
      }
    } else if (isLoaded && !user) {
      // User logged out
      hasLoggedLogin.current = false;
      lastUserId.current = null;
    }
  }, [user, isLoaded]);

  return { user, isLoaded };
}