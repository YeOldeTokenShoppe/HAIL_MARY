import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageProvider';


const NavButtons = () => {
  const { t } = useLanguage();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const navItems = [
    { label: t('palmTreeDrive.about'), icon: '/images/ROSE_TATTOO.webp', href: '/about' },
    { label: t('palmTreeDrive.tokenomics'), icon: '/images/DIAMOND_TATTOO.webp', href: '/tokenomics' },
    { label: t('palmTreeDrive.illuminati'), icon: '/images/ILLUMIN80_TATTOO.webp', href: '/illumin80' },
    { label: t('palmTreeDrive.trade'), icon: '/images/3ACES_TATTOO.webp', href: '/trade-school' },
  ];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <nav style={{
      ...styles.navRow,
      ...(isMobile ? styles.navRowMobile : {}),
    }}>
      {navItems.map((item, index) => (
        <a
          key={item.label}
          href={item.href}
          style={{
            ...styles.navBtn,
            ...(hoveredIndex === index ? styles.navBtnHover : {}),
          }}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <span
            style={{
              ...styles.label,
              ...(isMobile ? styles.labelMobile : {}),
              ...(hoveredIndex === index ? styles.labelHover : {}),
            }}
          >
            {item.label}
          </span>
        </a>
      ))}
    </nav>
  );
};

const styles = {
  navRow: {
    display: 'inline-flex',
    gap: '2rem',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  navRowMobile: {
    gap: '0.5rem',
    flexWrap: 'wrap',
    display: 'flex',
    maxWidth: '100%',
  },
  navBtn: {
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    padding: '10px',
  },
  navBtnHover: {
    transform: 'scale(1.05) translateY(-2px)',
  },
  label: {
    fontFamily: '"UnifrakturMaguntia", serif',
    fontSize: '1.2rem',
    color: '#000000',
    transition: 'all 0.3s ease',
    whiteSpace: 'pre-line',
    textAlign: 'center',
    lineHeight: '1.1',
    textShadow: '0 0 20px rgba(255, 0, 238, 0.9), 0 0 40px rgba(255, 0, 238, 0.6), 0 0 60px rgba(255, 0, 238, 0.4), 2px 2px 4px rgba(255, 0, 238, 0.3)',
    letterSpacing: '0.03em',
    fontWeight: 'bold',
  },
  labelMobile: {
    fontSize: '0.95rem',
    textShadow: '0 0 15px rgba(255, 0, 238, 0.9), 0 0 30px rgba(255, 0, 238, 0.6), 2px 2px 3px rgba(255, 0, 238, 0.4)',
  },
  labelHover: {
    color: '#1a0d1a',
    textShadow: '0 0 25px rgba(255, 0, 238, 1), 0 0 50px rgba(255, 0, 238, 0.8), 0 0 75px rgba(255, 0, 238, 0.6), 0 0 100px rgba(255, 0, 238, 0.4)',
    transform: 'scale(1.3)',
  },
};

export default NavButtons;