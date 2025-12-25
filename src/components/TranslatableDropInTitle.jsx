'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';

// Translation mapping for the special terms
const translations = {
  en: {
    'PROSPER80': 'PROSPERITY',
    'FOR ALL': 'FOR ALL', 
    'HUMAN80!': 'HUMANITY!',
    'BEHOLD!': 'BEHOLD!',
    'OUR LADY!': 'OUR LADY!',
    'HOLD RL80!': 'HOLD RL80!'
  },
  es: {
    'PROSPER80': 'PROSPERIDAD',
    'FOR ALL': 'PARA TODOS',
    'HUMAN80!': 'HUMANIDAD!',
    'BEHOLD!': '¡CONTEMPLA!',
    'OUR LADY!': '¡NUESTRA SEÑORA!',
    'HOLD RL80!': '¡MANTÉN RL80!'
  },
  fr: {
    'PROSPER80': 'PROSPÉRITÉ',
    'FOR ALL': 'POUR TOUS',
    'HUMAN80!': 'HUMANITÉ!',
    'BEHOLD!': 'VOICI!',
    'OUR LADY!': 'NOTRE DAME!',
    'HOLD RL80!': 'TENEZ RL80!'
  },
  de: {
    'PROSPER80': 'WOHLSTAND',
    'FOR ALL': 'FÜR ALLE',
    'HUMAN80!': 'MENSCHHEIT!',
    'BEHOLD!': 'SIEHE!',
    'OUR LADY!': 'UNSERE DAME!',
    'HOLD RL80!': 'HALTE RL80!'
  },
  it: {
    'PROSPER80': 'PROSPERITÀ',
    'FOR ALL': 'PER TUTTI',
    'HUMAN80!': 'UMANITÀ!',
    'BEHOLD!': 'ECCO!',
    'OUR LADY!': 'NOSTRA SIGNORA!',
    'HOLD RL80!': 'TIENI RL80!'
  },
  pt: {
    'PROSPER80': 'PROSPERIDADE',
    'FOR ALL': 'PARA TODOS',
    'HUMAN80!': 'HUMANIDADE!',
    'BEHOLD!': 'EIS!',
    'OUR LADY!': 'NOSSA SENHORA!',
    'HOLD RL80!': 'SEGURE RL80!'
  },
  ja: {
    'PROSPER80': '繁栄',
    'FOR ALL': 'すべての人のために',
    'HUMAN80!': '人類！',
    'BEHOLD!': '見よ！',
    'OUR LADY!': '聖母！',
    'HOLD RL80!': 'RL80を保持！'
  },
  zh: {
    'PROSPER80': '繁荣',
    'FOR ALL': '为所有人',
    'HUMAN80!': '人类！',
    'BEHOLD!': '看哪！',
    'OUR LADY!': '圣母！',
    'HOLD RL80!': '持有RL80！'
  }
};

// Main TranslatableDropInTitle component
export default function TranslatableDropInTitle({ 
  lines = ["PROSPER80", "FOR ALL", "HUMAN80!"],
  colors = ["#e55643", "#2b9f5e", "#f1c83c"],
  fontSize = { mobile: "2.5rem", desktop: "4rem" },
  isMobile = false,
  onAnimationComplete = () => {},
  triggerAnimation = true,
  instanceId,
  language = 'en'
}) {
  // Always split characters for better animation, but translate first
  const shouldSplitCharacters = true;
  
  // Translate the lines
  const translatedLines = useMemo(() => {
    const currentTranslations = translations[language] || translations['en'];
    
    return lines.map(line => {
      // Try exact match first
      if (currentTranslations[line]) {
        return currentTranslations[line];
      }
      
      // For English or if no translation found, return original
      if (language === 'en') {
        // For English, replace PROSPER80 and HUMAN80 with full words
        return line
          .replace('PROSPER80', 'PROSPERITY')
          .replace('HUMAN80', 'HUMANITY');
      }
      
      // For other languages, return as-is if no translation
      return line;
    });
  }, [lines, language]);
  
  // Log for debugging
  // useEffect(() => {
  //   console.log('TranslatableDropInTitle:', {
  //     language,
  //     originalLines: lines,
  //     translatedLines,
  //     shouldSplitCharacters
  //   });
  // }, [language, lines, translatedLines, shouldSplitCharacters]);

  const stableId = useMemo(() => {
    if (instanceId) return instanceId;
    const contentHash = translatedLines.join('').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `dropin-${contentHash}-${language}`;
  }, [instanceId, translatedLines, language]);
  
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  
  const playAnimation = () => {
    if (!containerRef.current) return;
    
    // Kill any existing animations
    if (animationRef.current) {
      animationRef.current.kill();
    }
    
    const tl = gsap.timeline({
      onComplete: onAnimationComplete
    });
    
    if (shouldSplitCharacters) {
      // Character animation for English
      const letters = containerRef.current.querySelectorAll('.title-letter');
      
      tl.fromTo(letters,
        { 
          opacity: 0, 
          y: 80 
        },
        { 
          opacity: 1, 
          y: 0,
          duration: 0.5,
          ease: "back.out(1.7)",
          stagger: 0.05
        }
      );
    } else {
      // Line animation for other languages
      const lines = containerRef.current.querySelectorAll('.title-line');
      
      tl.fromTo(lines,
        { 
          opacity: 0, 
          y: 50 
        },
        { 
          opacity: 1, 
          y: 0,
          duration: 0.6,
          ease: "back.out(1.7)",
          stagger: 0.2
        }
      );
    }
    
    animationRef.current = tl;
  };
  
  useEffect(() => {
    if (triggerAnimation) {
      const timer = setTimeout(() => {
        playAnimation();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [triggerAnimation, language]);
  
  // Render character-split version for English
  if (shouldSplitCharacters) {
    return (
      <div ref={containerRef} style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        textAlign: 'center',
      }}>
        <style jsx>{`
          @font-face {
            font-family: 'Fjalla One';
            src: url('/fonts/FjallaOne-Regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          
          .title-letter-${stableId} {
            transform: skew(-10deg);
            display: inline-block;
            font-family: 'Fjalla One', sans-serif !important;
            text-shadow: rgba(83, 61, 74, 0.8) 1px 1px,
                         rgba(83, 61, 74, 0.8) 2px 2px,
                         rgba(83, 61, 74, 0.8) 3px 3px,
                         rgba(83, 61, 74, 0.8) 4px 4px,
                         rgba(83, 61, 74, 0.8) 5px 5px,
                         rgba(83, 61, 74, 0.8) 6px 6px;
            min-width: 10px;
            min-height: 10px;
            position: relative;
            filter: brightness(1.1);
          }
        `}</style>
        <h1 style={{
          color: '#fff',
          textTransform: 'uppercase',
          fontSize: isMobile ? fontSize.mobile : fontSize.desktop,
          margin: 0,
          lineHeight: 1.12,
          letterSpacing: '2px',
          fontFamily: "'Fjalla One', sans-serif",
        }}>
          {translatedLines.map((line, lineIndex) => (
            <div
              key={`line-${lineIndex}`}
              style={{
                display: 'flex',
                justifyContent: 'center',
                transform: 'rotate(-10deg)',
                margin: '0 auto',
                width: 'fit-content',
              }}
            >
              {line.split('').map((char, charIndex) => (
                <span 
                  key={`${lineIndex}-${charIndex}`}
                  className={`title-letter title-letter-${stableId}`}
                  style={{ 
                    color: colors[lineIndex % colors.length],
                    fontFamily: "'Fjalla One', sans-serif"
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </div>
          ))}
        </h1>
      </div>
    );
  }
  
  // Render whole-line version for other languages
  return (
    <div ref={containerRef} style={{
      position: 'relative',
      display: 'inline-block',
      width: '100%',
      textAlign: 'center',
    }}>
      <style jsx>{`
        @font-face {
          font-family: 'Fjalla One';
          src: url('/fonts/FjallaOne-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        .title-line-${stableId} {
          display: block;
          transform: rotate(-10deg) skew(-10deg);
          font-family: 'Fjalla One', sans-serif !important;
          text-shadow: rgba(83, 61, 74, 0.8) 1px 1px,
                       rgba(83, 61, 74, 0.8) 2px 2px,
                       rgba(83, 61, 74, 0.8) 3px 3px,
                       rgba(83, 61, 74, 0.8) 4px 4px,
                       rgba(83, 61, 74, 0.8) 5px 5px,
                       rgba(83, 61, 74, 0.8) 6px 6px;
          filter: brightness(1.1);
        }
      `}</style>
      <h1 style={{
        color: '#fff',
        textTransform: 'uppercase',
        fontSize: isMobile ? fontSize.mobile : fontSize.desktop,
        margin: 0,
        lineHeight: 1.12,
        letterSpacing: '2px',
        fontFamily: "'Fjalla One', sans-serif",
      }}>
        {translatedLines.map((line, lineIndex) => (
          <div
            key={`line-${lineIndex}`}
            className={`title-line title-line-${stableId}`}
            style={{ 
              color: colors[lineIndex % colors.length],
              fontFamily: "'Fjalla One', sans-serif",
              margin: '0 auto',
              width: 'fit-content'
            }}
          >
            {line}
          </div>
        ))}
      </h1>
    </div>
  );
}