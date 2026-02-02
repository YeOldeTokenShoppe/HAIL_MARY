'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../lib/i18n/messages/en.json';
import es from '../lib/i18n/messages/es.json';
import fr from '../lib/i18n/messages/fr.json';
import ja from '../lib/i18n/messages/ja.json';
import ru from '../lib/i18n/messages/ru.json';
import ko from '../lib/i18n/messages/ko.json';
import zh from '../lib/i18n/messages/zh.json';
import hi from '../lib/i18n/messages/hi.json';
import ar from '../lib/i18n/messages/ar.json';
import vi from '../lib/i18n/messages/vi.json';
import de from '../lib/i18n/messages/de.json';
import it from '../lib/i18n/messages/it.json';
import pt from '../lib/i18n/messages/pt.json';
import la from '../lib/i18n/messages/la.json';

const translations = { en, es, fr, ja, ru, ko, zh, hi, ar, vi, de, it, pt, la };

const LanguageContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  detectedLanguage: null,
  isAutoDetected: false,
});

// Always start with 'en' to match server render and avoid hydration mismatch.
// The actual language preference is applied after mount in useEffect.
export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('en');
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [isAutoDetected, setIsAutoDetected] = useState(false);

  // Detect browser language on mount
  useEffect(() => {
    const detectLanguage = () => {
      // Store the browser's detected language
      const browserLang = navigator.language || navigator.userLanguage;
      setDetectedLanguage(browserLang);

      // URL params first (explicit override, highest priority)
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');

      if (urlLang && translations[urlLang]) {
        setLocale(urlLang);
        localStorage.setItem('preferredLanguage', urlLang);
        setIsAutoDetected(false);
        return;
      }

      // If the user has manually chosen a language, always respect it.
      const manualLang = localStorage.getItem('manualLanguage');
      if (manualLang && translations[manualLang]) {
        setLocale(manualLang);
        setIsAutoDetected(false);
        return;
      }

      // Then check localStorage (auto-detected preference from a prior visit)
      const savedLang = localStorage.getItem('preferredLanguage');
      if (savedLang && translations[savedLang]) {
        setLocale(savedLang);
        setIsAutoDetected(false);
        return;
      }

      // Finally, try browser languages (ordered by user preference)
      const browserLangs = navigator.languages || [browserLang];
      for (const lang of browserLangs) {
        const langCode = lang.split('-')[0].toLowerCase();
        if (translations[langCode]) {
          setLocale(langCode);
          localStorage.setItem('preferredLanguage', langCode);
          setIsAutoDetected(true);
          return;
        }
      }

      // No supported language found, default to English
      setLocale('en');
      setIsAutoDetected(true);
    };

    detectLanguage();
  }, []);

  // When manually changing locale, mark as not auto-detected and save to localStorage
  const handleSetLocale = (newLocale) => {
    setLocale(newLocale);
    setIsAutoDetected(false);
    // Save under both keys: 'manualLanguage' is a sticky override that
    // browser auto-detection can never overwrite.
    localStorage.setItem('preferredLanguage', newLocale);
    localStorage.setItem('manualLanguage', newLocale);
  };

  // Translation function with interpolation support
  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[locale];

    for (const k of keys) {
      value = value?.[k];
    }

    if (!value) return key; // Return key if translation not found

    // Handle interpolation: replace {{variable}} with params.variable
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return value;
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
