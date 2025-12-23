"use client";

import { useEffect, useState } from 'react';

const SimpleTextLoader = ({ loading = true, progress = 0, message = "Loading" }) => {
  const [dots, setDots] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth <= 768);
    }
  }, []);
  
  // Animate dots
  useEffect(() => {
    if (!loading) return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    
    return () => clearInterval(interval);
  }, [loading]);

  if (!loading) return null;

  // Inline styles to prevent flash of unstyled content
  const styles = {
    container: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10001,
      fontFamily: 'Orbitron, sans-serif',
    },
    content: {
      textAlign: 'center',
      color: '#ffffff'
    },
    title: {
      display: 'block',
      fontSize: '4rem',
      marginBottom: '2rem',
      letterSpacing: '0.1em',
      fontFamily: 'Orbitron, sans-serif',
      color: '#00ff41',
      textShadow: '0 0 20px #00ff41, 0 0 40px #00ff41',
      fontWeight: 'bold',
      lineHeight: 1
    },
    text: {
      fontSize: '1rem',
      marginBottom: '2rem',
      color: '#00ff41',
      minHeight: '2rem'
    },
    progressContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem'
    },
    progressBar: {
      width: '200px',
      height: '4px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '2px',
      overflow: 'hidden',
      position: 'relative'
    },
    progressFill: {
      height: '100%',
      background: 'linear-gradient(90deg, #00ff41, #00ff41)',
      borderRadius: '2px',
      transition: 'width 0.3s ease',
      boxShadow: '0 0 10px #00ff41',
      width: `${progress}%`
    },
    progressText: {
      fontSize: '1rem',
      color: '#00ff41',
      fontFamily: 'Orbitron, sans-serif',
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.text}>
          {message}{dots}
        </div>
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={styles.progressFill} />
          </div>
          <span style={styles.progressText}>{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleTextLoader;