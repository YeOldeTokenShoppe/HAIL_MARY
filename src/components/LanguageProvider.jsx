'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../lib/i18n/messages/en.json';
import es from '../lib/i18n/messages/es.json';
import fr from '../lib/i18n/messages/fr.json';
import ja from '../lib/i18n/messages/ja.json';

const translations = { en, es, fr, ja };

const LanguageContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  detectedLanguage: null,
  isAutoDetected: false,
});

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('en');
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  
  // Detect browser language on mount
  useEffect(() => {
    const detectLanguage = () => {
      // Store the browser's detected language
      const browserLang = navigator.language || navigator.userLanguage;
      const langCode = browserLang.split('-')[0].toLowerCase();
      setDetectedLanguage(browserLang);
      
      // Check URL params first (manual override)
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');
      
      if (urlLang && translations[urlLang]) {
        console.log('Language set from URL param:', urlLang);
        setLocale(urlLang);
        setIsAutoDetected(false);
        return;
      }
      
      console.log('Browser language detected:', browserLang, '-> langCode:', langCode);
      console.log('Available translations:', Object.keys(translations));
      
      if (translations[langCode]) {
        console.log('Auto-setting locale to browser language:', langCode);
        setLocale(langCode);
        setIsAutoDetected(true);
      } else {
        console.log('Language not supported, defaulting to English');
        setLocale('en');
        setIsAutoDetected(true);
      }
    };
    
    detectLanguage();
  }, []);
  
  // When manually changing locale, mark as not auto-detected
  const handleSetLocale = (newLocale) => {
    setLocale(newLocale);
    setIsAutoDetected(false);
  };
  
  // Translation function
  const t = (key) => {
    const keys = key.split('.');
    let value = translations[locale];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key; // Return key if translation not found
  };
  
  return (
    <LanguageContext.Provider value={{ 
      locale, 
      setLocale: handleSetLocale, 
      t, 
      detectedLanguage, 
      isAutoDetected 
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};