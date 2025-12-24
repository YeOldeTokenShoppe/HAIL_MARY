import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const CyberNav = ({ is80sMode = false, position = "fixed" }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredItemPath, setHoveredItemPath] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  
  // Check for mobile device
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Reset hover state when menu closes
  React.useEffect(() => {
    if (!isMenuOpen) {
      setHoveredItemPath(null);
    }
  }, [isMenuOpen]);

  const navItems = [
    { id: '00', date: 'ICON ON I-80', title: "ROADMAP", path: '/', thumbnail: '/I80.png' },
    { id: '01', date: 'DEFI GRAV80', title: 'SOMETHING ABOUT RL80', path: '/home3', thumbnail: '/darkSky.png' },
    // { id: '02', date: 'LIGHT UTIL80', title: 'THE ILLUMIN80', path: '/gallery3', thumbnail: '/heart.png' },
    { id: '02', date: 'PRAYER & PROBABIL80', title: 'TRADING DESK', path: '/temple', thumbnail: '/lightning.png' },
    { id: '03', date: 'ETHICS & MORAL80', title: 'SCROLLS OF ST. GR80', path: '/model-viewer', thumbnail: '/stgr81.png' },
    { id: '04', date: 'CHAR80 & LIQUID80', title: 'COIN FOUNTAIN', path: '/fountain', thumbnail: '/fountain2.png' },

  ];

  // Always use mobile-style menu
  return (
      <>
        <button
          style={{
            position: position === "relative" ? "relative" : position,
            top: position === "relative" ? "0" : (position === "absolute" ? "10px" : "20px"),
            right: position === "relative" ? "0" : "20px",
            zIndex: position === "relative" ? 1 : 99999998,
            color: is80sMode ? "#D946EF" : "#ffffff",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            padding: isMobile ? "8px" : "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
               width: isMobile ? "2.5rem" : "3.75rem",
                  height: isMobile ? "2.5rem" : "3.75rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
          }}
          aria-label="Menu"
          onClick={() => {
            setIsMenuOpen(!isMenuOpen);
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "rgba(0, 0, 0, 0.8)"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "rgba(0, 0, 0, 0.7)"}
        >
          <svg width={isMobile ? "24" : "36"} height={isMobile ? "24" : "36"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isMenuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </>
            )}
          </svg>
        </button>
        
        {isMenuOpen && (
          <div
            style={{
              position: "fixed",
              top: "0",
              left: "0",
              right: "0",
              bottom: "0",
              backgroundColor: "rgba(0, 0, 0, 0.95)",
              backdropFilter: "blur(20px)",
              zIndex: 99999999,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "20px",
              padding: "20px"
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsMenuOpen(false);
              }
            }}
            onMouseLeave={() => setHoveredItemPath(null)}
          >
            <button
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                backgroundColor: "transparent",
                border: "none",
                color: is80sMode ? "#D946EF" : "#ffffff",
                cursor: "pointer",
                padding: "10px",
                fontSize: "24px",
                zIndex: 100000000
              }}
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            {navItems.map((item, index) => {
              // Handle route matching
              const isActive = pathname === item.path || 
                (item.path === '/home' && pathname === '/') ||
                (item.path === '/home2' && pathname === '/home2');
              
              const isHovered = hoveredItemPath === item.path;
              
              return (
                <Link 
                  key={`${item.id}-${pathname}`} 
                  href={item.path}
                  style={{ textDecoration: 'none', display: 'block', cursor: 'pointer' }}
                  onClick={(e) => {
                    console.log('Navigating to:', item.path);
                    setIsMenuOpen(false);
                    
                    // Force a hard navigation if on the same page to reset state
                    if (pathname === item.path) {
                      e.preventDefault();
                      window.location.href = item.path;
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "15px",
                      padding: "20px",
                      borderRadius: "10px",
                      backgroundColor: isActive 
                        ? (is80sMode ? "#67e8f9" : "#c896ff")
                        : (isHovered ? "rgb(200, 150, 255)" : "transparent"),
                      transition: "background-color 0.3s ease"
                    }}
                    onMouseEnter={() => {
                      if (!isActive) {
                        setHoveredItemPath(item.path);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredItemPath(null);
                    }}
                  >
                    <div style={{ width: "50px", height: "50px", overflow: "hidden", borderRadius: "5px", flexShrink: "0" }}>
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          opacity: isActive ? 1 : 0.8,
                          filter: is80sMode && !isActive ? 'hue-rotate(270deg) saturate(1.5)' : 'none'
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          color: isActive ? '#000000' : (is80sMode ? "#D946EF" : '#ffffff'),
                          fontWeight: "700",
                          fontSize: "14px",
                          fontFamily: "'Rajdhani', sans-serif",
                          textAlign: "left"
                        }}
                      >
                        {item.date}
                      </span>
                      <span
                        style={{
                          color: isActive ? '#000000' : (is80sMode ? "#D946EF" : '#ffff00'),
                          fontSize: "24px",
                          fontWeight: "700",
                          fontFamily: "'Rajdhani', sans-serif"
                        }}
                      >
                        {item.title}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </>
    );
};

export default CyberNav;