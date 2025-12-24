"use client";

// Safe wrappers for Clerk UI components that work during build time
export function SafeSignInButton({ children, ...props }) {
  // Check if Clerk is available
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    // Return the button child directly if provided, or a default button
    if (children) {
      return children;
    }
    return (
      <button {...props} style={{ ...props.style, cursor: 'not-allowed', opacity: 0.5 }}>
        Sign In
      </button>
    );
  }

  try {
    const { SignInButton } = require('@clerk/nextjs');
    return <SignInButton {...props}>{children}</SignInButton>;
  } catch (error) {
    console.warn('Clerk SignInButton not available');
    return children || <button {...props}>Sign In</button>;
  }
}

export function SafeUserButton(props) {
  // Check if Clerk is available
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    // Return a placeholder avatar button
    return (
      <button
        style={{
          width: props.appearance?.elements?.avatarBox?.width || "3.5rem",
          height: props.appearance?.elements?.avatarBox?.height || "3.5rem",
          borderRadius: props.appearance?.elements?.avatarBox?.borderRadius || "8px",
          backgroundColor: props.appearance?.elements?.avatarBox?.backgroundColor || "rgba(0, 0, 0, 0.7)",
          border: props.appearance?.elements?.avatarBox?.border || "2px solid rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "not-allowed",
          opacity: 0.5,
          ...props.style
        }}
      >
        <span style={{ fontSize: "1.5rem" }}>👤</span>
      </button>
    );
  }

  try {
    const { UserButton } = require('@clerk/nextjs');
    return <UserButton {...props} />;
  } catch (error) {
    console.warn('Clerk UserButton not available');
    return (
      <button style={{ ...props.style, cursor: 'not-allowed', opacity: 0.5 }}>
        <span style={{ fontSize: "1.5rem" }}>👤</span>
      </button>
    );
  }
}