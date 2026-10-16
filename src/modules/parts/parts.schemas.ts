import { z } from 'zod';

import { phone } from '../auth/auth.schemas.js';
import {
  findModel,
  isGovernorate,
  modelYears,
  PART_CATEGORIES,
  PART_CONDITIONS,
} from '../catalog/catalog.js';

export const MAX_PART_PHOTOS = 8;
const MAX_FITMENTS = 20;

const fitment = z
  .strictObject({
    brandId: z.string('validation.fitment'),
    modelId: z.string('validation.fitment'),
    fromYear: z.number('validation.fitment').int('validation.fitment'),
    toYear: z.number('validation.fitment').int('validation.fitment'),
  })
  .refine((value) => {
    const model = findModel(value.brandId, value.modelId);
    if (!model) return false;
    const [first, last] = modelYears(model);
    return value.fromYear <= value.toYear && value.fromYear >= first && value.toYear <= last;
  }, 'validation.fitment');

/** A photo path this server stored, or an outside https URL (sample data). */
const image = z
  .string('validation.photos')
  .regex(/^(\/uploads\/parts\/[\w-]+\.(jpg|png|webp)|https:\/\/\S+)$/, 'validation.photos');

const optionalText = (max: number, key: 'validation.description' | 'validation.required') =>
  z
    .string()
    .trim()
    .max(max, key)
    .nullish()
    .transform((value) => (value ? value : null));

const fields = {
  name: z
    .string('validation.partName')
    .trim()
    .min(3, 'validation.partName')
    .max(100, 'validation.partName'),
  category: z.enum(PART_CATEGORIES, 'validation.category'),
  condition: z.enum(PART_CONDITIONS, 'validation.condition'),
  isOriginal: z.boolean().default(false),
  price: z
    .number('validation.price')
    .int('validation.price')
    .min(1, 'validation.price')
    .max(10_000_000, 'validation.price'),
  oldPrice: z
    .number('validation.price')
    .int('validation.price')
    .positive('validation.price')
    .nullish(),
  partNumber: optionalText(40, 'validation.required'),
  description: optionalText(1000, 'validation.description'),
  images: z.array(image, 'validation.photos').min(1, 'validation.photos'),
  fitments: z
    .array(fitment, 'validation.fitments')
    .min(1, 'validation.fitments')
    .max(MAX_FITMENTS, 'validation.fitments'),
  city: z.string('validation.city').refine(isGovernorate, 'validation.city'),
  phone,
};

const oldPriceAbovePrice = (value: { price?: number; oldPrice?: number | null }) =>
  value.oldPrice == null || value.price === undefined || value.oldPrice > value.price;

export const createPartSchema = z
  .strictObject(fields)
  .refine(oldPriceAbovePrice, { message: 'validation.oldPrice', path: ['oldPrice'] });

/** Edits send only what changed. */
export const updatePartSchema = z
  .strictObject(fields)
  .partial()
  .refine(oldPriceAbovePrice, { message: 'validation.oldPrice', path: ['oldPrice'] });

export const soldSchema = z.strictObject({ sold: z.boolean('validation.required') });

export const contactSchema = z.strictObject({
  channel: z.enum(['CALL', 'WHATSAPP'], 'validation.required'),
});

/** `toyota:corolla:2016,hyundai:elantra:2015` */
const cars = z.string().transform((value, ctx) => {
  const list = value
    .split(',')
    .filter(Boolean)
    .map((item) => {
      const [brandId, modelId, year] = item.split(':');
      return { brandId: brandId ?? '', modelId: modelId ?? '', year: Number(year) };
    });
  if (
    list.length > 5 ||
    list.some((car) => !car.brandId || !car.modelId || !Number.isInteger(car.year))
  ) {
    ctx.addIssue({ code: 'custom', message: 'validation.query' });
    return z.NEVER;
  }
  return list;
});

const intParam = z.coerce
  .number('validation.query')
  .int('validation.query')
  .nonnegative('validation.query');

export const listQuerySchema = z.object({
  q: z.string().trim().max(100, 'validation.query').optional(),
  category: z.enum(PART_CATEGORIES, 'validation.query').optional(),
  condition: z.enum(PART_CONDITIONS, 'validation.query').optional(),
  origin: z.enum(['ORIGINAL', 'AFTERMARKET'], 'validation.query').optional(),
  city: z.string().optional(),
  minPrice: intParam.optional(),
  maxPrice: intParam.optional(),
  cars: cars.optional(),
  sort: z.enum(['NEWEST', 'PRICE_LOW', 'PRICE_HIGH'], 'validation.query').default('NEWEST'),
  sellerId: z
    .string()
    .regex(/^[0-9a-f]{24}$/, 'validation.query')
    .optional(),
  cursor: z.string().max(500, 'validation.query').optional(),
  limit: z.coerce
    .number('validation.query')
    .int('validation.query')
    .min(1, 'validation.query')
    .max(50, 'validation.query')
    .default(20),
});

export const featuredQuerySchema = z.object({
  condition: z.enum(PART_CONDITIONS, 'validation.query').optional(),
  cars: cars.optional(),
  limit: z.coerce
    .number('validation.query')
    .int('validation.query')
    .min(1, 'validation.query')
    .max(20, 'validation.query')
    .default(8),
});

export const limitQuerySchema = z.object({
  limit: z.coerce
    .number('validation.query')
    .int('validation.query')
    .min(1, 'validation.query')
    .max(20, 'validation.query')
    .default(6),
});

export type CreatePartInput = z.infer<typeof createPartSchema>;
export type UpdatePartInput = z.infer<typeof updatePartSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type FeaturedQuery = z.infer<typeof featuredQuerySchema>;
export type CarQuery = NonNullable<ListQuery['cars']>;
