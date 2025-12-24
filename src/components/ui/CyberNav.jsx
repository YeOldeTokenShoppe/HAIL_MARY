import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CyberNav = ({ is80sMode = false, position = "fixed", musicButton = null, userButton = null, extra80sButton = null, auroraButton = null }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredItemPath, setHoveredItemPath] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showExtraButtons, setShowExtraButtons] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const pathname = usePathname();
  
  // Clear hover state when pathname changes or menu state changes
  React.useEffect(() => {
    setHoveredItemPath('');
    // Enable hover after a delay when menu opens
    if (isMenuOpen) {
      setCanHover(false);
      const timer = setTimeout(() => {
        setCanHover(true);
      }, 300); // Wait 300ms after menu opens before allowing hover
      return () => clearTimeout(timer);
    } else {
      setCanHover(false);
    }
  }, [pathname, isMenuOpen]);
  
  // Check for mobile device
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Reset hover state when menu closes and handle body scroll
  React.useEffect(() => {
    if (!isMenuOpen) {
      setHoveredItemPath('');
      // Hide extra buttons when menu closes
      setShowExtraButtons(false);
      // Re-enable body scroll
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    } else {
      // Disable body scroll when menu is open
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    }
    
    // Cleanup on unmount
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    };
  }, [isMenuOpen]);

  const navItems = [
    { id: '00', date: 'ICON ON I-80', title: "ROADMAP", path: '/', thumbnail: '/I80.png' },
    { id: '01', date: 'DEFI GRAV80', title: 'SOMETHING ABOUT RL80', path: '/home', thumbnail: '/darkSky.png' },
    // { id: '02', date: 'LIGHT UTIL80', title: 'THE ILLUMIN80', path: '/gallery3', thumbnail: '/heart.png' },
    { id: '02', date: 'PRAYER & PROBABIL80', title: 'TRADING DESK', path: '/trade', thumbnail: '/lightning.png' },
    { id: '03', date: 'ETHICS & MORAL80', title: 'SCROLLS OF ST. GR80', path: '/ethos', thumbnail: '/stgr81.png' },
    { id: '04', date: 'CHAR80 & LIQUID80', title: 'COIN FOUNTAIN', path: '/fountain', thumbnail: '/fountain2.png' },
    { id: '05', date: 'QUANT80 & CURIOS80', title: 'TOKENOMICS & FAQ', path: '/tokenomics', thumbnail: '/coinFront.png' },

  ];

  // Always use mobile-style menu
  return (
      <>
        {/* Aurora Button - flies out to the left from CyberNav */}
        {auroraButton && (
          <div
            style={{
              position: position === "relative" ? "relative" : position,
              top: position === "relative" ? "0" : (position === "absolute" ? "10px" : "20px"),
              right: position === "relative" ? (showExtraButtons ? (isMobile ? "8rem" : "9rem") : "0") : (showExtraButtons ? (isMobile ? "9rem" : "10rem") : "20px"),
              zIndex: position === "relative" ? 1 : 9992,
              opacity: showExtraButtons ? 1 : 0,
              pointerEvents: showExtraButtons ? "auto" : "none",
              transform: showExtraButtons ? "translateX(0) scale(1)" : "translateX(100%) scale(0)",
              transformOrigin: "right center",
              transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {auroraButton}
          </div>
        )}
        
        {/* Music Button - flies out to the left from CyberNav */}
        {musicButton && (
          <div
            style={{
              position: position === "relative" ? "relative" : position,
              top: position === "relative" ? "0" : (position === "absolute" ? "10px" : "20px"),
              right: position === "relative" ? (showExtraButtons ? (isMobile ? "4.5rem" : "5rem") : "0") : (showExtraButtons ? (isMobile ? "5.5rem" : "6rem") : "20px"),
              zIndex: position === "relative" ? 1 : 9992,
              opacity: showExtraButtons ? 1 : 0,
              pointerEvents: showExtraButtons ? "auto" : "none",
              transform: showExtraButtons ? "translateX(0) scale(1)" : "translateX(100%) scale(0)",
              transformOrigin: "right center",
              transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s",
            }}
          >
            {musicButton}
          </div>
        )}
        
        {/* User Button - flies out downward from CyberNav */}
        {userButton && (
          <div
            style={{
              position: position === "relative" ? "relative" : position,
              top: position === "relative" ? (showExtraButtons ? (isMobile ? "3.5rem" : "4rem") : "0") : (position === "absolute" ? (showExtraButtons ? (isMobile ? "4.5rem" : "5.5rem") : "10px") : (showExtraButtons ? (isMobile ? "5.5rem" : "6rem") : "20px")),
              right: position === "relative" ? "0" : "20px",
              zIndex: position === "relative" ? 1 : 9992,
              opacity: showExtraButtons ? 1 : 0,
              pointerEvents: showExtraButtons ? "auto" : "none",
              transform: showExtraButtons ? "translateY(0) scale(1)" : "translateY(-100%) scale(0)",
              transformOrigin: "center top",
              transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s",
            }}
          >
            {userButton}
          </div>
        )}
        
        {/* 80s Button - flies out below User Button from CyberNav origin */}
        {extra80sButton && (
          <div
            style={{
              position: position === "relative" ? "relative" : position,
              top: position === "relative" ? (showExtraButtons ? (isMobile ? "8.5rem" : "8rem") : "0") : (position === "absolute" ? (showExtraButtons ? (isMobile ? "10.5rem" : "11rem") : "10px") : (showExtraButtons ? (isMobile ? "10.5rem" : "11rem") : "20px")),
              right: position === "relative" ? "0" : "20px",
              zIndex: position === "relative" ? 1 : 9992,
              opacity: showExtraButtons ? 1 : 0,
              pointerEvents: showExtraButtons ? "auto" : "none",
              transform: showExtraButtons ? "translateY(0) scale(1)" : "translateY(-200%) scale(0)",
              transformOrigin: "center top",
              transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s",
            }}
          >
            {extra80sButton}
          </div>
        )}
        
        <button
          style={{
            position: position === "relative" ? "relative" : position,
            top: position === "relative" ? "0" : (position === "absolute" ? "10px" : "20px"),
            right: position === "relative" ? "0" : "20px",
            zIndex: position === "relative" ? 1 : 9990,
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
            width: isMobile ? "3.5rem" : "3.75rem",
            height: isMobile ? "3.5rem" : "3.75rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
          }}
          aria-label="Menu"
          onClick={() => {
            setIsMenuOpen(!isMenuOpen);
            setShowExtraButtons(!showExtraButtons);
            setHoveredItemPath('');
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
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0, 0, 0, 0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              zIndex: 9991,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              // gap: "15px",
              padding: "40px 20px",
              isolation: "isolate"
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsMenuOpen(false);
                setHoveredItemPath('');
              }
            }}
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
                zIndex: 9992
              }}
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            {navItems.map((item) => {
              // Handle route matching - ensure exact match only
              const currentPath = pathname || '';
              const itemPath = item.path || '';
              const isActive = currentPath === itemPath && currentPath !== '';
              const isHovered = hoveredItemPath === itemPath && !isActive;
              
              
              return (
                <Link 
                  key={item.id} 
                  href={item.path}
                  style={{ textDecoration: 'none', display: 'block', cursor: 'pointer' }}
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    setHoveredItemPath('');
                    
                    // Force a hard navigation if on the same page to reset state
                    if (currentPath === itemPath) {
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
                      gap: "12px",
                      padding: isActive ? "14px" : "16px",
                      borderRadius: "10px",
                      backgroundColor: isActive 
                        ? (is80sMode ? "#67e8f9" : "#c896ff")
                        : (isHovered ? "rgba(200, 150, 255, 0.15)" : "transparent"),
                      border: isActive ? "2px solid" : "2px solid transparent",
                      outline: isHovered && !isActive ? "2px dashed rgba(200, 150, 255, 0.5)" : "none",
                      transition: "all 0.3s ease"
                    }}
                    onMouseEnter={(e) => {
                      // Only set hover if we're allowed to (after initial delay) and not on active item
                      if (!isActive && canHover) {
                        setHoveredItemPath(itemPath);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredItemPath('');
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
                          fontSize: isMobile ? "0.75rem" : "0.875rem",
                          fontFamily: "'Rajdhani', sans-serif",
                          textAlign: "left"
                        }}
                      >
                        {item.date}
                      </span>
                      <span
                        style={{
                          color: isActive ? '#000000' : (is80sMode ? "#D946EF" : '#ffff00'),
                          fontSize: isMobile ? "1.25rem" : "1.5rem",
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