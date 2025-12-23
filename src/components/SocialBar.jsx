import React, { useState, useEffect } from 'react';

const SocialBar = ({ is80sMode = false }) => {
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const iconSize = isMobile ? 20 : 30; // Dynamic icon size
  
  const socialLinks = [
    {
      id: 'twitter',
      href: 'https://twitter.com/yourusername',
      icon: (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      id: 'discord',
      href: 'https://discord.gg/yourserver',
      icon: (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      )
    },
    {
      id: 'telegram',
      href: 'https://t.me/yourchannel',
      icon: (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 1 0 24 12a12 12 0 0 0-12.056-12zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      )
    },
    {
      id: 'instagram',
      href: 'https://instagram.com/yourusername',
      icon: (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      )
    }
  ];

  const [isExpanded, setIsExpanded] = useState(false);

  // Use expandable version for both mobile and desktop
  return (
    <div style={{ position: "relative" }}>
      {/* Main toggle button */}
      <button
          style={{
            width: isMobile ? "40px" : "60px",
            height: isMobile ? "40px" : "60px",
            borderRadius: "8px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            color: is80sMode ? '#00ff41' : 'white',
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.3s ease",
            backdropFilter: "blur(10px)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
          }}
          onClick={() => setIsExpanded(!isExpanded)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          aria-label="Social Media"
          title="Social Media"
        >
          <svg width={isMobile ? "20" : "30"} height={isMobile ? "20" : "30"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/>
            <line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
          </svg>
        </button>
        
        {/* Expanded social icons */}
        {socialLinks.map((social, index) => {
          const isHovered = hoveredIcon === social.id;
          const buttonSize = isMobile ? 40 : 60; // Match parent button size
          const offset = (index + 1) * (buttonSize + 10); // Dynamic spacing between icons
          
          return (
            <a
              key={social.id}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.id}
              style={{
                position: "absolute",
                // Mobile: open to the left; Desktop: open downward
                // left: isMobile ? `-${offset}px` : "0",
                top: `${offset}px`,
                width: `${buttonSize}px`,
                height: `${buttonSize}px`,
                borderRadius: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                color: isHovered ? (is80sMode ? '#D946EF' : '#f6f841') : (is80sMode ? '#00ff41' : 'white'),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                opacity: isExpanded ? 1 : 0,
                // Both mobile and desktop: slide from top
                transform: isExpanded 
                  ? "translate(0, 0)" 
                  : "translateY(-20px)",
                transition: "all 0.3s ease",
                transitionDelay: isExpanded ? `${index * 0.05}s` : `${(3 - index) * 0.05}s`,
                pointerEvents: isExpanded ? "auto" : "none",
                backdropFilter: "blur(10px)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                textDecoration: "none",
              }}
              onMouseEnter={() => setHoveredIcon(social.id)}
              onMouseLeave={() => setHoveredIcon(null)}
            >
              {social.icon}
            </a>
          );
        })}
    </div>
  );
};

export default SocialBar;