import { rateLimit } from 'express-rate-limit';

import { ErrorCode, tooManyRequests } from '../common/http/errors.js';

/**
 * Per-client limit for one route. Answers with the same error envelope as the
 * rest of the API so the app shows its usual "too many attempts" message.
 */
export function limit({ max, windowMs = 60_000 }: { max: number; windowMs?: number }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (_req, _res, next, options) => {
      next(
        tooManyRequests(ErrorCode.RATE_LIMITED, 'error.rateLimited', [], {
          retryAfterSeconds: Math.ceil(options.windowMs / 1000),
        }),
      );
    },
  });
}
