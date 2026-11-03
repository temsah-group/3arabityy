import { z } from 'zod';

import { pageQuery } from '../admin/admin.schemas.js';
import { phone } from '../auth/auth.schemas.js';
import { findBrand, isGovernorate, PART_CATEGORIES } from '../catalog/catalog.js';

const text = (max: number, key: 'validation.description' | 'validation.required') =>
  z
    .string()
    .trim()
    .max(max, key)
    .nullish()
    .transform((value) => (value ? value : null));

const fee = z
  .number('validation.deliveryFee')
  .int('validation.deliveryFee')
  .min(0, 'validation.deliveryFee')
  .max(100_000, 'validation.deliveryFee')
  .nullish()
  .transform((value) => value ?? null);

const delivery = z
  .strictObject({
    available: z.boolean('validation.required'),
    governorates: z
      .array(z.string().refine(isGovernorate, 'validation.city'))
      .max(27, 'validation.city')
      .default([])
      .transform((list) => [...new Set(list)]),
    feeFrom: fee,
    feeTo: fee,
    eta: text(50, 'validation.description'),
    note: text(200, 'validation.description'),
  })
  .refine((value) => !value.available || value.governorates.length > 0, {
    message: 'validation.deliveryAreas',
    path: ['governorates'],
  })
  .refine((value) => value.feeFrom == null || value.feeTo == null || value.feeTo >= value.feeFrom, {
    message: 'validation.deliveryFee',
    path: ['feeTo'],
  });

const fields = {
  name: z
    .string('validation.shopName')
    .trim()
    .min(3, 'validation.shopName')
    .max(60, 'validation.shopName'),
  description: text(500, 'validation.description'),
  phone,
  whatsapp: phone.nullish().transform((value) => value ?? null),
  city: z.string('validation.city').refine(isGovernorate, 'validation.city'),
  address: z
    .string('validation.address')
    .trim()
    .min(5, 'validation.address')
    .max(200, 'validation.address'),
  // Egypt and a little around it.
  location: z
    .strictObject({
      lat: z.number('validation.location').min(21, 'validation.location').max(32.5),
      lng: z.number('validation.location').min(24, 'validation.location').max(37.5),
    })
    .nullish()
    .transform((value) => value ?? null),
  hours: text(100, 'validation.description'),
  brandIds: z
    .array(z.string().refine((id) => findBrand(id) !== undefined, 'validation.car'))
    .max(30, 'validation.car')
    .default([])
    .transform((list) => [...new Set(list)]),
  categories: z
    .array(z.enum(PART_CATEGORIES, 'validation.category'))
    .default([])
    .transform((list) => [...new Set(list)]),
  delivery: delivery.default({
    available: false,
    governorates: [],
    feeFrom: null,
    feeTo: null,
    eta: null,
    note: null,
  }),
};

export const shopInputSchema = z.strictObject(fields);
export type ShopInput = z.infer<typeof shopInputSchema>;

/** Edits send only what changed. */
export const shopUpdateSchema = z.strictObject({
  name: fields.name.optional(),
  description: fields.description.optional(),
  phone: fields.phone.optional(),
  whatsapp: fields.whatsapp.optional(),
  city: fields.city.optional(),
  address: fields.address.optional(),
  location: fields.location.optional(),
  hours: fields.hours.optional(),
  brandIds: fields.brandIds.optional(),
  categories: fields.categories.optional(),
  delivery: delivery.optional(),
});
export type ShopUpdate = z.infer<typeof shopUpdateSchema>;

export const shopsQuerySchema = z.object({
  q: z.string().trim().max(100, 'validation.query').optional(),
  city: z.string().max(40, 'validation.query').optional(),
  /** Shops that deliver to this governorate. */
  deliversTo: z.string().max(40, 'validation.query').optional(),
  brandId: z.string().max(40, 'validation.query').optional(),
  sort: z.enum(['TOP', 'NEWEST'], 'validation.query').default('TOP'),
  cursor: z.string().max(500, 'validation.query').optional(),
  limit: z.coerce
    .number('validation.query')
    .int('validation.query')
    .min(1, 'validation.query')
    .max(50, 'validation.query')
    .default(20),
});
export type ShopsQuery = z.infer<typeof shopsQuerySchema>;

// ---- The dashboard ----

export const adminShopsQuerySchema = pageQuery.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], 'validation.query').optional(),
  q: z.string().max(100, 'validation.query').optional(),
});
export type AdminShopsQuery = z.infer<typeof adminShopsQuerySchema>;

export const adminShopUpdateSchema = z.strictObject({
  status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED'], 'validation.query').optional(),
  featured: z.boolean('validation.required').optional(),
  verified: z.boolean('validation.required').optional(),
  note: z
    .string()
    .trim()
    .max(500, 'validation.description')
    .nullish()
    .transform((value) => (value ? value : null)),
});
export type AdminShopUpdate = z.infer<typeof adminShopUpdateSchema>;
