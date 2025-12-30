'use client';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { checkUserIllumin80Status } from '@/lib/utils/firestore-illumin80';

// 1. Profile Card Enhancement - adds glow to user avatar
export function Illumin80AvatarGlow({ children }) {
  const { user } = useUser();
  const [isIllumin80, setIsIllumin80] = useState(false);
  
  useEffect(() => {
    if (user?.id) {
      checkUserIllumin80Status(user.id).then(status => {
        setIsIllumin80(status.isIllumin80);
      });
    }
  }, [user]);
  
  return (
    <div style={{
      position: 'relative',
      display: 'inline-block'
    }}>
      {children}
      {isIllumin80 && (
        <>
          <div style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            width: '30px',
            height: '30px',
            backgroundColor: '#FFD700',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            boxShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
            animation: 'pulse 2s infinite',
            zIndex: 10
          }}>
            ⚜️
          </div>
          <div style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '50%',
            border: '3px solid #FFD700',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.6), inset 0 0 10px rgba(255, 215, 0, 0.3)',
            animation: 'rotate 10s linear infinite',
            pointerEvents: 'none'
          }} />
        </>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.9; }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// 2. Mini Banner - can be placed anywhere
export function Illumin80Banner() {
  const { user } = useUser();
  const [status, setStatus] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  
  useEffect(() => {
    async function checkStatus() {
      if (user) {
        // Try multiple identifiers
        const identifiers = [
          user.username,
          user.firstName,
          user.lastName,
          user.fullName,
          user.primaryEmailAddress?.emailAddress,
          user.emailAddresses?.[0]?.emailAddress,
          user.id
        ].filter(Boolean);
        
        console.log('Checking Illumin80 for:', identifiers);
        
        for (const identifier of identifiers) {
          const result = await checkUserIllumin80Status(identifier);
          if (result.isIllumin80) {
            setStatus(result);
            break;
          }
        }
      }
    }
    checkStatus();
  }, [user]);
  
  if (!status?.isIllumin80) {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'linear-gradient(135deg, #FFD700, #FFA500)',
      padding: collapsed ? '10px' : '15px 20px',
      borderRadius: '10px',
      boxShadow: '0 4px 20px rgba(255, 215, 0, 0.4)',
      transition: 'all 0.3s ease',
      zIndex: 100
    }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          background: 'transparent',
          border: 'none',
          fontSize: '12px',
          cursor: 'pointer',
          opacity: 0.7
        }}
      >
        {collapsed ? '📍' : '📌'}
      </button>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: '#333',
        fontWeight: 'bold',
        fontSize: '14px'
      }}>
        <span style={{ fontSize: '24px' }}>⚜️</span>
        <span style={{ display: collapsed ? 'none' : 'block' }}>
          ILLUMIN80 • {status.title}
        </span>
      </div>
      
      {!collapsed && status.burnedAmount && (
        <div style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>
              🔥 {status.burnedAmount?.toLocaleString()}
            </div>
            <div style={{ color: '#888', fontSize: '12px' }}>tokens burned</div>
          </div>
        </div>
      )}
    </div>
  );
}

// 3. Animated Title - replaces username in certain places
export function Illumin80Title({ username, showOriginal = false }) {
  const { user } = useUser();
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    async function checkStatus() {
      if (user) {
        // Try multiple identifiers
        const identifiers = [
          user.username,
          user.firstName,
          user.lastName,
          user.fullName,
          user.primaryEmailAddress?.emailAddress,
          user.emailAddresses?.[0]?.emailAddress,
          user.id
        ].filter(Boolean);
        
        console.log('Checking Illumin80 for:', identifiers);
        
        for (const identifier of identifiers) {
          const result = await checkUserIllumin80Status(identifier);
          if (result.isIllumin80) {
            setStatus(result);
            break;
          }
        }
      }
    }
    checkStatus();
  }, [user]);
  
  if (!status?.isIllumin80) {
    return <span>{username}</span>;
  }
  
  return (
    <span style={{
      background: 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)',
      backgroundSize: '200% 100%',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      color: 'transparent',
      fontWeight: 'bold',
      fontFamily: 'UnifrakturCook, serif',
      animation: 'shimmer 3s linear infinite',
      textShadow: '0 0 20px rgba(255, 215, 0, 0.5)'
    }}>
      {showOriginal && username}
      {showOriginal && ' • '}
      {status.title}
      
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </span>
  );
}

// 4. Access Gate - blocks content for non-Illumin80
export function Illumin80Gate({ children, fallback }) {
  const { user } = useUser();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function checkStatus() {
      if (user) {
        // Try multiple identifiers
        const identifiers = [
          user.username,
          user.firstName,
          user.lastName,
          user.fullName,
          user.primaryEmailAddress?.emailAddress,
          user.emailAddresses?.[0]?.emailAddress,
          user.id
        ].filter(Boolean);
        
        for (const identifier of identifiers) {
          const result = await checkUserIllumin80Status(identifier);
          if (result.isIllumin80) {
            setStatus(result);
            setLoading(false);
            return;
          }
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
    checkStatus();
  }, [user]);
  
  if (loading) {
    return <div>Loading access...</div>;
  }
  
  if (!status?.isIllumin80) {
    return fallback || <div>🔒 This content is exclusive to ILLUMIN80 members</div>;
  }
  
  return children;
}

// 5. Main Clerk Button Component - Now using Clerk's default UserButton
export function Illumin80ClerkButton({ isMobileDevice }) {
  const { user, isSignedIn } = useUser();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [emoji, setEmoji] = useState("😇");
  
  // Check for mobile device 
  useEffect(() => {
    // Use parent's isMobileDevice prop if provided, otherwise detect locally
    if (isMobileDevice !== undefined) {
      setIsMobile(isMobileDevice);
    } else {
      const checkMobile = () => {
        setIsMobile(window.innerWidth <= 768);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, [isMobileDevice]);

  // Alternate emoji for sign-in button
  useEffect(() => {
    const emojiInterval = setInterval(() => {
      setEmoji((prevEmoji) => (prevEmoji === "😇" ? "😈" : "😇"));
    }, 3000);
    return () => clearInterval(emojiInterval);
  }, []);
  
  useEffect(() => {
    async function checkStatus() {
      if (user) {
        setLoading(true);
        // Try multiple identifiers
        const identifiers = [
          user.username,
          user.firstName,
          user.lastName,
          user.fullName,
          user.primaryEmailAddress?.emailAddress,
          user.emailAddresses?.[0]?.emailAddress,
          user.id
        ].filter(Boolean);
        
        for (const identifier of identifiers) {
          try {
            const result = await checkUserIllumin80Status(identifier);
            if (result.isIllumin80) {
              setStatus(result);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error(`Error checking ${identifier}:`, error);
          }
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
    checkStatus();
  }, [user]);
  
  const isIllumin80 = status?.isIllumin80;
  
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button
          style={{
            width: isMobile ? "3rem" : "3.5rem",
            height: isMobile ? "3rem" : "3.5rem",
            borderRadius: "8px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(10px)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
            transition: "all 0.3s ease"
          }}
          title="Sign In"
        >
          <span style={{ fontSize: "1.8rem" }}>{emoji}</span>
        </button>
      </SignInButton>
    );
  }
  
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Illumin80 decorations */}
      {isIllumin80 && (
        <>
          {/* Flame emoji in corner */}
          <div style={{
            position: 'absolute',
            bottom: '-8px',
            right: '-8px',
            width: '24px',
            height: '24px',
            fontSize: isMobile ? '14px' : '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFD700',
            filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.6))',
            pointerEvents: 'none',
            zIndex: 1
          }}>
            {/* ❤️‍🔥 */}
          </div>
          
          {/* Subtle golden ring */}
          <div style={{
            position: 'absolute',
            top: '-2px',
            left: '-2px',
            right: '-2px',
            bottom: '-2px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            boxShadow: '0 0 8px rgba(255, 215, 0, 0.2)',
            pointerEvents: 'none',
            animation: 'subtlePulse 4s ease-in-out infinite'
          }} />
        </>
      )}
      
      {/* Clerk's default UserButton */}
      <UserButton
        appearance={{
          baseTheme: "dark",
          elements: {
            avatarBox: {
              width: isMobile ? "3rem" : "3.5rem",
              height: isMobile ? "3rem" : "3.5rem",
              borderRadius: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(10px)",
              border: isIllumin80 
                ? "2px solid #FFD700" 
                : "2px solid rgba(255, 255, 255, 0.2)",
              boxShadow: isIllumin80 
                ? "0 0 15px rgba(255, 215, 0, 0.4)" 
                : "0 2px 8px rgba(0, 0, 0, 0.3)"
            },
            userButtonPopoverCard: {
              backgroundColor: "rgba(0, 0, 0, 0.95)",
              backdropFilter: "blur(20px)",
              border: "2px solid rgba(0, 255, 0, 0.3)",
              borderRadius: "12px",
              boxShadow: "0 0 30px rgba(0, 255, 0, 0.2)"
            },
            userButtonPopoverActionButton: {
              color: "#00ff00",
              "&:hover": {
                backgroundColor: "rgba(0, 255, 0, 0.1)"
              }
            },
            userButtonPopoverActionButtonText: {
              color: "#00ff00"
            },
            userPreviewMainIdentifier: {
              color: "#00ff00",
              fontWeight: "bold"
            },
            userPreviewSecondaryIdentifier: {
              color: "rgba(0, 255, 0, 0.7)"
            }
          },
          variables: {
            colorPrimary: "#00ff00",
            colorText: "#00ff00",
            colorTextSecondary: "rgba(0, 255, 0, 0.7)",
            colorBackground: "rgba(0, 0, 0, 0.95)"
          }
        }}
      />
      
      <style jsx>{`
        @keyframes subtlePulse {
          0%, 100% { 
            opacity: 0.6;
            transform: scale(1);
          }
          50% { 
            opacity: 0.3;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}