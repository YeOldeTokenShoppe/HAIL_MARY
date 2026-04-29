"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];
const NOTO_FONT_LOCALES = ['ja', 'ko', 'zh', 'ar', 'hi', 'ru'];

const getFontFamilyForLocale = (locale) => {
  if (NOTO_FONT_LOCALES.includes(locale)) {
    return "'Noto Sans Mono', 'Courier New', monospace";
  }
  return "'Courier New', 'Orbitron', monospace";
};

const getColor = (type) => {
  switch (type) {
    case 'command': return '#00ffaa';
    case 'header': return '#ffff00';
    case 'highlight': return '#ff00ff';
    default: return '#00ff88';
  }
};

const getFontSize = (type) => {
  switch (type) {
    case 'header': return '1.4rem';
    case 'command': return '1.1rem';
    default: return '1.2rem';
  }
};

export default function FullscreenCRTOverlay({
  isActive,
  onClose,
  onLineComplete,
  locale = 'en',
  textSequence,
  terminalTitle = 'TERMINAL v1.0',
  terminalStatus = 'SECURE CONNECTION',
  tapToReturnLabel = '> tap anywhere to return',
  actionButton = null, // { label, onClick }
}) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [buttonPulse, setButtonPulse] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  const sequence = useMemo(() => textSequence || [], [textSequence]);
  const isRTL = RTL_LOCALES.includes(locale);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      setDisplayedLines([]);
      setCurrentLineIndex(0);
      setCurrentCharIndex(0);
      setAnimationComplete(false);
      const timer = setTimeout(() => setIsTyping(true), 800);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
      setDisplayedLines([]);
      setCurrentLineIndex(0);
      setCurrentCharIndex(0);
      setAnimationComplete(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (currentLineIndex >= sequence.length && sequence.length > 0 && !animationComplete) {
      const timer = setTimeout(() => setAnimationComplete(true), 800);
      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, animationComplete, sequence.length]);

  useEffect(() => {
    if (!animationComplete) return;
    const interval = setInterval(() => {
      setButtonPulse(p => (p + 0.1) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, [animationComplete]);

  useEffect(() => {
    if (!isTyping || currentLineIndex >= sequence.length) return;

    const currentLine = sequence[currentLineIndex];
    const typingSpeed = currentLine.type === 'command' ? 25 : 35;

    if (currentLine.type === 'pause') {
      const timer = setTimeout(() => {
        setDisplayedLines(prev => [...prev, { text: '', type: 'pause' }]);
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, currentLine.delay);
      return () => clearTimeout(timer);
    }

    if (currentCharIndex < currentLine.text.length) {
      const timer = setTimeout(() => {
        setCurrentCharIndex(prev => prev + 1);
      }, typingSpeed);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setDisplayedLines(prev => [...prev, { text: currentLine.text, type: currentLine.type }]);
      setCurrentLineIndex(prev => prev + 1);
      setCurrentCharIndex(0);
      onLineComplete?.();
    }, currentLine.delay);

    return () => clearTimeout(timer);
  }, [isTyping, currentLineIndex, currentCharIndex, onLineComplete, sequence]);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, currentCharIndex]);

  if (!isActive) return null;

  const currentLine = sequence[currentLineIndex];
  const typingText = currentLine && currentLine.type !== 'pause'
    ? currentLine.text.slice(0, currentCharIndex)
    : '';
  const pulseValue = (Math.sin(buttonPulse) + 1) / 2;

  return (
    <div
      onClick={() => onClose?.()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse at center, #0a1f0a 0%, #000000 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        fontFamily: getFontFamilyForLocale(locale),
        overflow: 'hidden',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.4s ease-in-out',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      <div style={{
        position: 'relative',
        width: '95%',
        maxWidth: '800px',
        height: '90%',
        maxHeight: '900px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 3,
      }}>
        <div style={{
          padding: '0.5rem 1rem',
          color: '#00ff66',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: 0.7,
        }}>
          <span>{terminalTitle}</span>
          <span style={{ opacity: 0.6 }}>{terminalStatus}</span>
        </div>

        <div
          ref={containerRef}
          style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
          }}
        >
          {displayedLines.map((line, index) => {
            if (line.type === 'pause') {
              return <div key={index} style={{ height: '0.5rem' }} />;
            }
            return (
              <div
                key={index}
                style={{
                  color: getColor(line.type),
                  fontSize: getFontSize(line.type),
                  lineHeight: 1.4,
                  textShadow: `0 0 10px ${getColor(line.type)}`,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {line.text}
              </div>
            );
          })}

          {currentLine && currentLine.type !== 'pause' && currentLineIndex < sequence.length && (
            <div style={{
              color: getColor(currentLine.type),
              fontSize: getFontSize(currentLine.type),
              lineHeight: 1.4,
              textShadow: `0 0 10px ${getColor(currentLine.type)}`,
              textAlign: isRTL ? 'right' : 'left',
            }}>
              {isRTL ? (
                <>{showCursor ? '█' : ' '}{typingText}</>
              ) : (
                <>{typingText}{showCursor ? '█' : ' '}</>
              )}
            </div>
          )}
        </div>

        {animationComplete && (
          <div style={{
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}>
            {actionButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  actionButton.onClick?.();
                }}
                style={{
                  background: `rgba(0, 68, 34, ${0.6 + pulseValue * 0.4})`,
                  border: '2px solid #00ff66',
                  borderRadius: '4px',
                  padding: '0.75rem 2rem',
                  color: '#00ffaa',
                  fontSize: '1rem',
                  fontFamily: getFontFamilyForLocale(locale),
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  boxShadow: `0 0 ${10 + pulseValue * 10}px rgba(0, 255, 102, ${0.3 + pulseValue * 0.3})`,
                  transition: 'all 0.2s',
                }}
              >
                {actionButton.label}
              </button>
            )}

            <div style={{
              color: '#00ff66',
              fontSize: '0.75rem',
              opacity: 0.7,
              letterSpacing: '0.05em',
            }}>
              {isRTL ? (
                <>{showCursor ? '_' : ' '}{tapToReturnLabel}</>
              ) : (
                <>{tapToReturnLabel}{showCursor ? '_' : ' '}</>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
