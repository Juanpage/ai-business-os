'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Locale = 'es' | 'en';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LOCALE_KEY = 'aibos_locale';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es');

  // Rehidrata la preferencia guardada.
  useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_KEY);
    if (saved === 'es' || saved === 'en') {
      setLocaleState(saved);
    }
  }, []);

  function setLocale(l: Locale): void {
    window.localStorage.setItem(LOCALE_KEY, l);
    setLocaleState(l);
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage debe usarse dentro de <LanguageProvider>');
  }
  return ctx;
}
