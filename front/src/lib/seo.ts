import { useEffect } from 'react';

import { useI18n } from './i18n';

const SITE = { ar: 'عربيتي', en: '3arabity' };
const DEFAULT_TITLE = { ar: 'عربيتي — قطع غيار العربيات في مصر', en: '3arabity — car parts in Egypt' };
const DEFAULT_DESCRIPTION = {
  ar: 'عربيتي: اشتري وبيع قطع غيار العربيات في مصر، جديد ومستعمل واستيراد. دوّر بالماركة والموديل والسنة واتواصل مع البيّاع مباشرة.',
  en: '3arabity: buy and sell car parts in Egypt, new, used and imported. Search by make, model and year and contact the seller directly.',
};

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function apply(title: string, description: string) {
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', window.location.href);
}

/**
 * The tab title and description for one page; the site's own while [title]
 * is null (still loading) and again once the page closes. Search engines read
 * these after running the page.
 */
export function usePageMeta(title: string | null | undefined, description?: string | null) {
  const { lang } = useI18n();
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE[lang]}` : DEFAULT_TITLE[lang];
    const text = description?.replace(/\s+/g, ' ').trim();
    apply(fullTitle, text ? (text.length > 160 ? `${text.slice(0, 157)}…` : text) : DEFAULT_DESCRIPTION[lang]);
    return () => apply(DEFAULT_TITLE[lang], DEFAULT_DESCRIPTION[lang]);
  }, [title, description, lang]);
}
