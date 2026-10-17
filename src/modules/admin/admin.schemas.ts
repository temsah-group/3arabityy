import { z } from 'zod';

import { REPORT_ACTIONS, REPORT_TARGETS } from '../reports/reports.js';

const note = z
  .string()
  .trim()
  .max(500, 'validation.description')
  .nullish()
  .transform((value) => (value ? value : null));

const flag = z.enum(['true', 'false'], 'validation.query').transform((value) => value === 'true');

/** `?page=&pageSize=` on every admin table. */
const pageQuery = z.object({
  page: z.coerce
    .number('validation.query')
    .int('validation.query')
    .min(1, 'validation.query')
    .default(1),
  pageSize: z.coerce
    .number('validation.query')
    .int('validation.query')
    .min(1, 'validation.query')
    .max(100, 'validation.query')
    .default(25),
});

const id = z.string().max(64, 'validation.query');

export const loginSchema = z.strictObject({
  email: z
    .string('validation.required')
    .trim()
    .min(3, 'validation.email')
    .max(200, 'validation.email'),
  password: z
    .string('validation.required')
    .min(1, 'validation.required')
    .max(200, 'validation.passwordLong'),
});

export const reportsQuerySchema = pageQuery.extend({
  status: z.enum(['OPEN', 'CLOSED'], 'validation.query').default('OPEN'),
  target: z.enum(REPORT_TARGETS, 'validation.query').optional(),
});
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

export const reportTargetSchema = z.enum(REPORT_TARGETS, 'validation.query');

export const resolutionSchema = z.strictObject({
  action: z.enum(REPORT_ACTIONS, 'validation.required'),
  note,
});
export type Resolution = z.infer<typeof resolutionSchema>;

export const usersQuerySchema = pageQuery.extend({
  q: z.string().max(100, 'validation.query').optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED'], 'validation.query').optional(),
  verified: flag.optional(),
});
export type UsersQuery = z.infer<typeof usersQuerySchema>;

export const userUpdateSchema = z.strictObject({
  status: z.enum(['ACTIVE', 'SUSPENDED'], 'validation.query').optional(),
  verified: z.boolean('validation.required').optional(),
  note,
});
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const partsQuerySchema = pageQuery.extend({
  q: z.string().max(100, 'validation.query').optional(),
  status: z.enum(['FOR_SALE', 'SOLD', 'HIDDEN'], 'validation.query').optional(),
  featured: flag.optional(),
  sellerId: id.optional(),
});
export type PartsQuery = z.infer<typeof partsQuerySchema>;

export const partUpdateSchema = z.strictObject({
  hidden: z.boolean('validation.required').optional(),
  featured: z.boolean('validation.required').optional(),
  note,
});
export type PartUpdate = z.infer<typeof partUpdateSchema>;

export const removalSchema = z.strictObject({ note });

export const auditQuerySchema = pageQuery.extend({
  targetId: id.optional(),
  adminId: id.optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;
