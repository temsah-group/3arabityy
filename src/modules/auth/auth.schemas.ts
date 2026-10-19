import { z } from 'zod';

import { OtpPurpose } from './otp.model.js';

// Messages are i18n keys; `parseBody` translates them.
const email = z
  .string('validation.required')
  .trim()
  .toLowerCase()
  .pipe(z.email('validation.email').max(254, 'validation.email'));

// bcrypt reads at most 72 bytes; longer passwords would be silently cut.
export const password = z
  .string('validation.required')
  .min(8, 'validation.passwordShort')
  .refine((value) => Buffer.byteLength(value) <= 72, 'validation.passwordLong');

/** International format, as the app sends it: `+201012345678`. */
export const phone = z
  .string('validation.required')
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'validation.phone');

export const fullName = z
  .string('validation.required')
  .trim()
  .min(3, 'validation.fullName')
  .max(100, 'validation.fullName');

const otpPurpose = z.enum([OtpPurpose.REGISTER, OtpPurpose.PASSWORD_RESET], 'validation.purpose');

// The app calls the email `identifier`, leaving room for phone sign-in later.
export const registerSchema = z
  .strictObject({
    fullName,
    identifier: email,
    phone,
    password,
    confirmPassword: z.string('validation.required'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  });

export const loginSchema = z.strictObject({
  identifier: email,
  password: z.string('validation.required').min(1, 'validation.required'),
  rememberMe: z.boolean().optional(),
});

/** `phone`, and optionally `fullName`, complete a first Google sign-in. */
export const googleSchema = z.strictObject({
  idToken: z.string('validation.required').min(1, 'validation.required').max(4096),
  phone: phone.optional(),
  fullName: fullName.optional(),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.strictObject({ identifier: email });

export const resendOtpSchema = z.strictObject({ identifier: email, purpose: otpPurpose });

export const verifyOtpSchema = z.strictObject({
  identifier: email,
  otp: z.string('validation.required').regex(/^\d{6}$/, 'validation.otp'),
  purpose: otpPurpose,
});

export const resetPasswordSchema = z
  .strictObject({
    resetToken: z.string('validation.required').min(1, 'validation.required'),
    newPassword: password,
    confirmPassword: z.string('validation.required'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  });

export const refreshSchema = z.strictObject({
  refreshToken: z.string('validation.required').min(1, 'validation.required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleInput = z.infer<typeof googleSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
