'use client';

import React from 'react';
import { useLanguage } from './LanguageProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale, detectedLanguage, isAutoDetected } = useLanguage();
  
  const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'ja', label: '日本語' }
  ];
  
  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '6rem',
      zIndex: 9999,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: '10px',
      borderRadius: '8px',
      border: '1px solid #ffffff'
    }}>
      <select 
        value={locale} 
        onChange={(e) => setLocale(e.target.value)}
        style={{
          backgroundColor: '#1a1a2e',
          color: '#ffffff',
          border: '1px solid #ffffff',
          padding: '5px 10px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        {languages.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <div style={{ 
        color: '#ffffff', 
        fontSize: '11px', 
        marginTop: '5px',
        lineHeight: '1.3'
      }}>
        <div>Current: {locale} {isAutoDetected && '(auto)'}</div>
        {detectedLanguage && (
          <div style={{ color: '#ffff00' }}>
            Browser: {detectedLanguage}
          </div>
        )}
      </div>
    </div>
  );
}