import type { ErrorRequestHandler, RequestHandler } from 'express';

import { AppError, ErrorCode, notFound } from '../common/http/errors.js';
import { resolveLang, t } from '../common/i18n.js';
import { logger } from '../common/logger.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound());

/** Turns any thrown error into `{ success: false, message, code, ... }`. */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) return next(error);
  const lang = req.lang ?? resolveLang(req.headers['accept-language']);

  let appError: AppError;
  if (error instanceof AppError) {
    appError = error;
  } else if (isBodyParserError(error, 'entity.too.large')) {
    appError = new AppError(413, ErrorCode.VALIDATION_FAILED, 'error.bodyTooLarge');
  } else if (isBodyParserError(error, 'entity.parse.failed')) {
    appError = new AppError(400, ErrorCode.VALIDATION_FAILED, 'error.invalidJson');
  } else {
    logger.error('Unhandled error', {
      method: req.method,
      // The query string can carry personal data; only the path is logged.
      path: req.originalUrl.split('?')[0],
      error: error instanceof Error ? error.stack : String(error),
    });
    appError = new AppError(500, ErrorCode.INTERNAL_ERROR, 'error.unexpected');
  }

  if (appError.details.retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(appError.details.retryAfterSeconds));
  }
  res.status(appError.status).json({
    success: false,
    message: appError.headline ?? t(lang, appError.messageKey, appError.params),
    code: appError.code,
    ...appError.details,
  });
};

function isBodyParserError(error: unknown, type: string): boolean {
  return typeof error === 'object' && error !== null && (error as { type?: unknown }).type === type;
}
