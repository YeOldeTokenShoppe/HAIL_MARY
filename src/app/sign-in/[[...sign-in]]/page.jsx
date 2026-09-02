"use client";

import { SignIn } from "@clerk/nextjs";
import { useEffect, useState } from "react";

// Deliberately LIGHTWEIGHT sign-in page — no 3D scene, no game UI. The whole
// point: OAuth methods (Google, Discord, …) redirect the browser to the
// provider, and on iOS Safari, navigating away from the memory-heavy /hailmary
// (its loaded WebGL scene) makes the browser snapshot the page for bfcache —
// that spike kills the tab. Signing in from THIS page has no scene to snapshot,
// so the redirect is safe. Base/wallet (SIWE) signs in-page and never redirects.
// The hailmary sign-in buttons navigate here instead of opening the modal.
export default function SignInPage() {
  // Return the user to wherever they came from (a ?redirect_url=… param),
  // defaulting to the field. Read from window to avoid the useSearchParams
  // Suspense requirement (the rest of the app uses this same pattern).
  const [redirect, setRedirect] = useState("/hailmary");
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("redirect_url");
      if (p && p.startsWith("/")) setRedirect(p); // only same-origin paths
    } catch {}
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background:
          "radial-gradient(1200px 600px at 50% -10%, #14223a 0%, #0a0f18 55%, #06090f 100%)",
      }}
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl={redirect}
        fallbackRedirectUrl={redirect}
      />
    </div>
  );
}
