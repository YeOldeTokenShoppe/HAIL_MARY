"use client";

// Safe wrappers for Clerk hooks that work during build time
export function useSafeUser() {
  // Check if we're in a build environment or if Clerk is not available
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return {
      user: null,
      isSignedIn: false,
      isLoaded: true
    };
  }

  // Only import and use Clerk hooks if we're in the browser with proper config
  try {
    // Dynamic import to avoid build-time errors
    const { useUser } = require('@clerk/nextjs');
    return useUser();
  } catch (error) {
    console.warn('Clerk not available, returning mock user data');
    return {
      user: null,
      isSignedIn: false,
      isLoaded: true
    };
  }
}