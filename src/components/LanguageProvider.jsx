'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import ja from '../../messages/ja.json';

const translations = { en, es, fr, ja };

const LanguageContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('en');
  
  // Detect browser language on mount
  useEffect(() => {
    const detectLanguage = () => {
      // Check URL params first
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');
      
      if (urlLang && translations[urlLang]) {
        setLocale(urlLang);
        return;
      }
      
      // Check browser language
      const browserLang = navigator.language || navigator.userLanguage;
      const langCode = browserLang.split('-')[0].toLowerCase();
      
      if (translations[langCode]) {
        setLocale(langCode);
      }
    };
    
    detectLanguage();
  }, []);
  
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
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
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