import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('warangal_agri_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('warangal_agri_lang', language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = (lang) => {
    if (lang === 'en' || lang === 'te') {
      setLanguage(lang);
    } else {
      setLanguage((prev) => (prev === 'en' ? 'te' : 'en'));
    }
  };

  // Safe dot-notation translation resolver with English fallback
  const t = (key) => {
    const keys = key.split('.');
    let result = translations[language];
    for (const k of keys) {
      if (result && result[k] !== undefined) {
        result = result[k];
      } else {
        // Fallback to English
        let fallback = translations['en'];
        for (const fk of keys) {
          if (fallback && fallback[fk] !== undefined) {
            fallback = fallback[fk];
          } else {
            return key; // return the raw key if not found
          }
        }
        return fallback;
      }
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

