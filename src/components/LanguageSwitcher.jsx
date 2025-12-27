'use client';

import React, { useState }  from 'react';

import { useLanguage } from './LanguageProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale, detectedLanguage, isAutoDetected } = useLanguage();
    const [isMobileView, setIsMobileView] = useState(false);
    const [isMobileDevice, setIsMobileDevice] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  
  
  const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'ja', label: '日本語' }
  ];
  
  return (
    <div style={{
      position: 'fixed',
      top: '9rem',
      right: '1rem',
                    width: isMobileDevice ? "3rem" : "3.5rem",
      zIndex: 9999,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
  
      // padding: '4px',
      borderRadius: '4px',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }}>
      <select 
        value={locale} 
        onChange={(e) => setLocale(e.target.value)}
        style={{
          backgroundColor: 'transparent',
          color: '#ffffff',
          border: 'none',
          padding: '2px 4px',

          cursor: 'pointer',
          fontSize: '12px',
          outline: 'none'
        }}
      >
        {languages.map(lang => (
          <option key={lang.code} value={lang.code} style={{ backgroundColor: '#1a1a2e' }}>
            {lang.code.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}