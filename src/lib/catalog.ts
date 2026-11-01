import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import bundledCars from '@/data/car-catalog.json';
import governorateList from '@/data/governorates.json';

import { get } from './api';
import { useI18n } from './i18n';
import type { AppConfig, CarBrand, Category, Condition, GarageCar, ReportReason } from './types';

export const CATEGORIES: { id: Category; ar: string; en: string }[] = [
  { id: 'ENGINE', ar: 'المحرك', en: 'Engine' },
  { id: 'BRAKES', ar: 'الفرامل', en: 'Brakes' },
  { id: 'SUSPENSION', ar: 'العفشة', en: 'Suspension' },
  { id: 'ELECTRICAL', ar: 'الكهرباء', en: 'Electrical' },
  { id: 'BODY', ar: 'الصاج والبودي', en: 'Body' },
  { id: 'LIGHTS', ar: 'الفوانيس', en: 'Lights' },
  { id: 'FILTERS', ar: 'الفلاتر والزيوت', en: 'Filters & oils' },
  { id: 'TYRES', ar: 'الكاوتش والجنوط', en: 'Tyres & rims' },
];

export const CONDITIONS: { id: Condition; ar: string; en: string }[] = [
  { id: 'NEW', ar: 'جديد', en: 'New' },
  { id: 'USED', ar: 'مستعمل', en: 'Used' },
  { id: 'IMPORTED', ar: 'استيراد', en: 'Imported' },
];

export const GOVERNORATES: string[] = governorateList;

const GOVERNORATES_EN: Record<string, string> = {
  القاهرة: 'Cairo',
  الجيزة: 'Giza',
  الإسكندرية: 'Alexandria',
  القليوبية: 'Qalyubia',
  الدقهلية: 'Dakahlia',
  الشرقية: 'Sharqia',
  الغربية: 'Gharbia',
  المنوفية: 'Monufia',
  البحيرة: 'Beheira',
  'كفر الشيخ': 'Kafr El Sheikh',
  دمياط: 'Damietta',
  بورسعيد: 'Port Said',
  الإسماعيلية: 'Ismailia',
  السويس: 'Suez',
  الفيوم: 'Faiyum',
  'بني سويف': 'Beni Suef',
  المنيا: 'Minya',
  أسيوط: 'Asyut',
  سوهاج: 'Sohag',
  قنا: 'Qena',
  الأقصر: 'Luxor',
  أسوان: 'Aswan',
  'البحر الأحمر': 'Red Sea',
  'الوادي الجديد': 'New Valley',
  مطروح: 'Matrouh',
  'شمال سيناء': 'North Sinai',
  'جنوب سيناء': 'South Sinai',
};

export const REPORT_REASONS: {
  id: ReportReason;
  ar: string;
  en: string;
  targets: ('PART' | 'SELLER')[];
}[] = [
  { id: 'FAKE', ar: 'إعلان وهمي', en: 'Fake listing', targets: ['PART'] },
  { id: 'WRONG_INFO', ar: 'بيانات غلط', en: 'Wrong details', targets: ['PART'] },
  { id: 'COUNTERFEIT', ar: 'قطعة مقلدة على إنها أصلي', en: 'Counterfeit sold as original', targets: ['PART'] },
  { id: 'STOLEN', ar: 'قطعة مسروقة', en: 'Stolen part', targets: ['PART'] },
  { id: 'UNREACHABLE', ar: 'مش بيرد', en: "Doesn't answer", targets: ['SELLER'] },
  { id: 'ABUSIVE', ar: 'أسلوب مسيء', en: 'Abusive', targets: ['SELLER'] },
  { id: 'SCAM', ar: 'نصب', en: 'Scam', targets: ['PART', 'SELLER'] },
  { id: 'OTHER', ar: 'سبب تاني', en: 'Something else', targets: ['PART', 'SELLER'] },
];

/** `/app-config`: support, documents, cars, banner, offers. Cached by the server for 5 min. */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: () => get<AppConfig>('/app-config'),
    staleTime: 5 * 60_000,
  });
}

/** The car list the dashboard keeps, or the bundled one until it loads. */
export function useCars(): CarBrand[] {
  const { data } = useAppConfig();
  const brands = data?.cars?.brands;
  return brands && brands.length ? brands : (bundledCars as CarBrand[]);
}

export function modelYears(model: { fromYear: number; toYear: number | null }): [number, number] {
  // Same rule as the server: an open-ended model runs to this year.
  return [model.fromYear, model.toYear ?? new Date().getUTCFullYear()];
}

/** Labels that follow the language. */
export function useLabels() {
  const { lang, pick } = useI18n();
  const brands = useCars();

  const category = useCallback(
    (id: Category) => {
      const c = CATEGORIES.find((x) => x.id === id);
      return c ? (lang === 'ar' ? c.ar : c.en) : id;
    },
    [lang],
  );
  const condition = useCallback(
    (id: Condition) => {
      const c = CONDITIONS.find((x) => x.id === id);
      return c ? (lang === 'ar' ? c.ar : c.en) : id;
    },
    [lang],
  );
  const city = useCallback(
    (name: string | null | undefined) =>
      !name ? '' : lang === 'ar' ? name : (GOVERNORATES_EN[name] ?? name),
    [lang],
  );
  const brand = useCallback(
    (brandId: string) => {
      const b = brands.find((x) => x.id === brandId);
      return b ? pick(b.nameAr, b.nameEn) : brandId;
    },
    [brands, pick],
  );
  const model = useCallback(
    (brandId: string, modelId: string) => {
      const m = brands.find((x) => x.id === brandId)?.models.find((x) => x.id === modelId);
      return m ? pick(m.nameAr, m.nameEn) : modelId;
    },
    [brands, pick],
  );
  const car = useCallback(
    (c: GarageCar) => `${brand(c.brandId)} ${model(c.brandId, c.modelId)} ${c.year}`,
    [brand, model],
  );
  return { category, condition, city, brand, model, car, brands };
}

// public/brands/<id>.png, from github.com/filippofilip95/car-logos-dataset
// (commit e334a4d). Makes it has no logo for show their initial.
const NO_LOGO = new Set(['dfsk']);

/** A make's logo, or null to show its initial instead. */
export function brandLogo(brandId: string): string | null {
  return NO_LOGO.has(brandId) ? null : `/brands/${brandId}.png`;
}

export const carsParam = (cars: GarageCar[]) =>
  cars.map((c) => `${c.brandId}:${c.modelId}:${c.year}`).join(',') || undefined;
