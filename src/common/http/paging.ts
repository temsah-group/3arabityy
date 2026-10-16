import { Types } from 'mongoose';
import { z } from 'zod';

import { badRequest, ErrorCode } from './errors.js';

/** `?cursor=&limit=` on every list (see the contract's "Lists and pages"). */
export const pageQuerySchema = z.object({
  cursor: z.string().max(500, 'validation.query').optional(),
  limit: z.coerce
    .number('validation.query')
    .int('validation.query')
    .min(1, 'validation.query')
    .max(50, 'validation.query')
    .default(20),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * Where the last page ended: the sort value and id of its last row, so the
 * next page starts right after it even when values repeat.
 */
export function encodeCursor(value: Date | number, id: string): string {
  const v = value instanceof Date ? value.toISOString() : value;
  return Buffer.from(JSON.stringify({ v, id })).toString('base64url');
}

export function decodeCursor(
  cursor: string | undefined,
  kind: 'date' | 'number',
): { value: Date | number; id: Types.ObjectId } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
      v: unknown;
      id: unknown;
    };
    if (typeof parsed.id !== 'string' || !Types.ObjectId.isValid(parsed.id)) throw new Error();
    const value = kind === 'date' ? new Date(String(parsed.v)) : Number(parsed.v);
    if (value instanceof Date ? Number.isNaN(value.getTime()) : !Number.isFinite(value))
      throw new Error();
    return { value, id: new Types.ObjectId(parsed.id) };
  } catch {
    throw badRequest(ErrorCode.VALIDATION_FAILED, 'validation.query');
  }
}

/** Rows after [cursor] in `{ [field]: -1, _id: -1 }` order. */
export function afterCursor(field: string, cursor: string | undefined): object {
  const after = decodeCursor(cursor, 'date');
  if (!after) return {};
  return {
    $or: [{ [field]: { $lt: after.value } }, { [field]: after.value, _id: { $lt: after.id } }],
  };
}

/** The cursor of the page that follows, when [found] has one row past [limit]. */
export function nextCursorOf<T extends { id?: unknown; get(path: string): unknown }>(
  found: T[],
  limit: number,
  field: string,
): string | null {
  const last = found[limit - 1];
  if (found.length <= limit || !last) return null;
  return encodeCursor(last.get(field) as Date, String(last.id));
}
