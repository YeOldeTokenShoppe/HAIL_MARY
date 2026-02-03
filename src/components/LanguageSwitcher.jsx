'use client';

import React from 'react';

import { useLanguage } from './LanguageProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  const languages = [
    // Most common first
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'zh', label: '中文' },
    // European languages
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'pt', label: 'Português' },
    { code: 'ru', label: 'Русский' },
    // Asian languages
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'vi', label: 'Tiếng Việt' },
    // RTL language
    { code: 'ar', label: 'العربية' },
    // Fun option at the end
    { code: 'la', label: 'Latina' }
  ];
  
  return (
    <div
      className="language-switcher-container"
      style={{
        position: 'fixed',
        top: '5rem',
        right: '1rem',
        width: '3.5rem',
        zIndex: 9999,
        backgroundColor: 'transparent',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
      <style jsx>{`
        @media (max-width: 768px) {
          .language-switcher-container {
            width: 3rem !important;
          }
        }
      `}</style>
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