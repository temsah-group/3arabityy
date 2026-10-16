import type { MessageKey } from '../i18n.js';

/** Stable codes the app branches on. Messages may change; codes do not. */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  ACCOUNT_ALREADY_VERIFIED: 'ACCOUNT_ALREADY_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',

  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN_TYPE: 'INVALID_TOKEN_TYPE',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',

  OTP_NOT_REQUESTED: 'OTP_NOT_REQUESTED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_RESEND_TOO_SOON: 'OTP_RESEND_TOO_SOON',

  WRONG_PASSWORD: 'WRONG_PASSWORD',
  PHOTO_REQUIRED: 'PHOTO_REQUIRED',
  PHOTO_INVALID: 'PHOTO_INVALID',
  PHOTO_TOO_LARGE: 'PHOTO_TOO_LARGE',

  PART_NOT_FOUND: 'PART_NOT_FOUND',
  NOT_PART_OWNER: 'NOT_PART_OWNER',
  TOO_MANY_PHOTOS: 'TOO_MANY_PHOTOS',
  UPLOAD_NOT_OWNED: 'UPLOAD_NOT_OWNED',

  TOO_MANY_CARS: 'TOO_MANY_CARS',
  SELLER_NOT_FOUND: 'SELLER_NOT_FOUND',
  ALREADY_REPORTED: 'ALREADY_REPORTED',
  CANNOT_REPORT_SELF: 'CANNOT_REPORT_SELF',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Extra fields copied onto the error body for the app to act on. */
export type ErrorDetails = {
  identifier?: string;
  isVerified?: boolean;
  requiresVerification?: boolean;
  otpSent?: boolean;
  expiresInMinutes?: number;
  retryAfterSeconds?: number;
  errors?: { field: string; message: string }[];
};

/** An expected failure, answered with [status] and a translated message. */
export class AppError extends Error {
  /** Replaces the translated message, e.g. with the first validation problem. */
  headline?: string;

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly messageKey: MessageKey,
    readonly params: readonly unknown[] = [],
    readonly details: ErrorDetails = {},
  ) {
    super(code);
    this.name = 'AppError';
  }
}

export const badRequest = (
  code: ErrorCode,
  key: MessageKey,
  params?: readonly unknown[],
  details?: ErrorDetails,
) => new AppError(400, code, key, params, details);

export const unauthorized = (
  code: ErrorCode = ErrorCode.UNAUTHORIZED,
  key: MessageKey = 'auth.unauthorized',
) => new AppError(401, code, key);

export const forbidden = (code: ErrorCode, key: MessageKey, details?: ErrorDetails) =>
  new AppError(403, code, key, [], details);

export const notFound = (key: MessageKey = 'error.notFound') =>
  new AppError(404, ErrorCode.NOT_FOUND, key);

export const conflict = (code: ErrorCode, key: MessageKey) => new AppError(409, code, key);

export const tooManyRequests = (
  code: ErrorCode,
  key: MessageKey,
  params?: readonly unknown[],
  details?: ErrorDetails,
) => new AppError(429, code, key, params, details);
