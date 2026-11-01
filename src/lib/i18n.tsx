import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { setApiLanguage } from './api';

export type Lang = 'ar' | 'en';

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Arabic is the source copy; the English sits next to it. */
  tr: (ar: string, en: string) => string;
  /** Picks `nameAr` / `nameEn` style pairs. */
  pick: (ar: string | null | undefined, en: string | null | undefined) => string;
}

const KEY = 'arabity.lang';
const I18nContext = createContext<I18n | null>(null);

function initialLang(): Lang {
  const stored = localStorage.getItem(KEY);
  if (stored === 'ar' || stored === 'en') return stored;
  return 'ar';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  setApiLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(KEY, next);
    setApiLanguage(next);
    setLangState(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      tr: (ar, en) => (lang === 'ar' ? ar : en),
      pick: (ar, en) => (lang === 'ar' ? ar || en || '' : en || ar || ''),
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
