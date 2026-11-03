import cars from './car-catalog.json' with { type: 'json' };
import governorates from './governorates.json' with { type: 'json' };

/**
 * Car makes and models and Egypt's governorates. The cars start as the
 * list in `car-catalog.json` (the one the app ships with); owners edit them
 * from the dashboard, and [setCarBrands] puts the saved list in use.
 */
export type CarModel = {
  id: string;
  nameAr: string;
  nameEn: string;
  fromYear: number;
  toYear: number | null;
};
export type CarBrand = { id: string; nameAr: string; nameEn: string; models: CarModel[] };

/** The launch list, used until an owner saves one. */
export const DEFAULT_CAR_BRANDS = cars as CarBrand[];

let brands: CarBrand[] = DEFAULT_CAR_BRANDS;

/** The cars parts are listed for and searched by. */
export function carBrands(): CarBrand[] {
  return brands;
}

/** Puts [list] in use, or the launch list when null. */
export function setCarBrands(list: CarBrand[] | null): void {
  brands = list?.length ? list : DEFAULT_CAR_BRANDS;
}
const cities = new Set(governorates as string[]);

export const PART_CATEGORIES = [
  'ENGINE',
  'BRAKES',
  'SUSPENSION',
  'ELECTRICAL',
  'BODY',
  'LIGHTS',
  'FILTERS',
  'TYRES',
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const PART_CONDITIONS = ['NEW', 'USED', 'IMPORTED'] as const;
export type PartCondition = (typeof PART_CONDITIONS)[number];

/** Category names in both languages, so either finds the part. */
const categoryNames: Record<PartCategory, [string, string]> = {
  ENGINE: ['المحرك', 'Engine'],
  BRAKES: ['الفرامل', 'Brakes'],
  SUSPENSION: ['العفشة', 'Suspension'],
  ELECTRICAL: ['الكهرباء', 'Electrical'],
  BODY: ['الصاج والبودي', 'Body panels'],
  LIGHTS: ['الفوانيس', 'Lights'],
  FILTERS: ['الفلاتر والزيوت', 'Filters & oils'],
  TYRES: ['الكاوتش', 'Tyres & rims'],
};

export function findBrand(id: string): CarBrand | undefined {
  return brands.find((brand) => brand.id === id);
}

export function findModel(brandId: string, modelId: string): CarModel | undefined {
  return findBrand(brandId)?.models.find((model) => model.id === modelId);
}

/** First and last year the model was made; still made means this year. */
export function modelYears(model: CarModel, now = new Date()): [number, number] {
  return [model.fromYear, model.toYear ?? now.getUTCFullYear()];
}

export function isGovernorate(city: string): boolean {
  return cities.has(city);
}

/**
 * Lower-case, without Arabic diacritics, with the letter forms people type
 * interchangeably made the same (أ إ آ → ا, ة → ه, ى → ي) and without the
 * dashes in part numbers. Matches `normalizeSearchText` in the app.
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[-_/]/g, '')
    .trim();
}

/** Everything a part is found by, normalised: name, number, category, city and cars. */
export function searchableText(part: {
  name: string;
  partNumber?: string | null;
  category: PartCategory;
  city: string;
  sellerName?: string;
  fitments: { brandId: string; modelId: string }[];
}): string {
  const words = [
    part.name,
    part.partNumber ?? '',
    ...categoryNames[part.category],
    part.city,
    part.sellerName ?? '',
  ];
  for (const fitment of part.fitments) {
    const brand = findBrand(fitment.brandId);
    const model = findModel(fitment.brandId, fitment.modelId);
    words.push(brand?.nameAr ?? '', brand?.nameEn ?? '', model?.nameAr ?? '', model?.nameEn ?? '');
  }
  return normalizeSearchText(words.join(' '));
}
