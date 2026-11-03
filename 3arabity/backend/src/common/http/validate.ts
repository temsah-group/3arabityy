import type { Request } from 'express';
import type { z } from 'zod';

import { isMessageKey, t } from '../i18n.js';
import { badRequest, ErrorCode } from './errors.js';

/**
 * Parses the request body with [schema]. Schema messages are i18n keys, so the
 * errors come back in the caller's language, first one as the headline.
 */
export function parseBody<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  return parseInput(schema, req.body ?? {}, req);
}

/** Like [parseBody], for the query string. */
export function parseQuery<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  return parseInput(schema, req.query ?? {}, req);
}

function parseInput<S extends z.ZodType>(schema: S, input: unknown, req: Request): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const errors = result.error.issues.map((issue) => {
    const key =
      issue.code === 'unrecognized_keys'
        ? 'validation.unknownField'
        : issue.code === 'invalid_type' && issue.input === undefined
          ? 'validation.required'
          : issue.message;
    const field = issue.code === 'unrecognized_keys' ? issue.keys.join(',') : issue.path.join('.');
    return { field, message: isMessageKey(key) ? t(req.lang, key) : issue.message };
  });
  const error = badRequest(ErrorCode.VALIDATION_FAILED, 'error.validation', [], { errors });
  // The app shows `message`, so lead with the first field problem.
  error.headline = errors[0]?.message;
  throw error;
}
