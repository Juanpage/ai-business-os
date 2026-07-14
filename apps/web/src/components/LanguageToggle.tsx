'use client';

import { useLanguage, type Locale } from '@/lib/language-context';

const LOCALES: Locale[] = ['es', 'en'];

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex overflow-hidden rounded-md ring-1 ring-gray-300" role="group">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`px-2 py-1 text-xs font-medium ${
            locale === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
