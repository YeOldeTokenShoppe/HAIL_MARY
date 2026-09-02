"use client";

import { SignUp } from "@clerk/nextjs";
import { useEffect, useState } from "react";

// Sign-up counterpart to the lightweight /sign-in page (same no-3D-scene
// rationale — safe OAuth redirects). Clerk's SignIn links here for account
// creation; OAuth providers (Google/Base) create the account on first sign-in,
// so most users never see this, but email/password sign-up lands here.
export default function SignUpPage() {
  const [redirect, setRedirect] = useState("/hailmary");
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("redirect_url");
      if (p && p.startsWith("/")) setRedirect(p);
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
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={redirect}
        fallbackRedirectUrl={redirect}
      />
    </div>
  );
}
