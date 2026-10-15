import { Router, type Request, type RequestHandler } from 'express';

import { send } from '../../common/http/response.js';
import { parseBody } from '../../common/http/validate.js';
import { limit } from '../../middleware/rate-limit.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import { OtpPurpose } from './otp.model.js';

/** Which phone the session belongs to, as the app names it. */
const deviceOf = (req: Request) =>
  String(req.headers['x-device-name'] ?? req.headers['user-agent'] ?? 'unknown').slice(0, 200);

export function authRoutes(auth: AuthService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post('/register', limit({ max: 5 }), async (req, res) => {
    const result = await auth.register(parseBody(registerSchema, req), req.lang);
    send(res, { message: 'auth.registered', data: result, status: 201 });
  });

  router.post('/login', limit({ max: 10 }), async (req, res) => {
    const result = await auth.login(parseBody(loginSchema, req), deviceOf(req), req.lang);
    send(res, { message: 'auth.loggedIn', data: result });
  });

  router.post('/forgot-password', limit({ max: 5 }), async (req, res) => {
    const { identifier } = parseBody(forgotPasswordSchema, req);
    await auth.forgotPassword(identifier, req.lang);
    send(res, { message: 'auth.resetCodeSent' });
  });

  router.post('/resend-otp', limit({ max: 5 }), async (req, res) => {
    const { identifier, purpose } = parseBody(resendOtpSchema, req);
    await auth.resendOtp(identifier, purpose, req.lang);
    send(res, {
      message: purpose === OtpPurpose.PASSWORD_RESET ? 'auth.resetCodeSent' : 'auth.otpSent',
    });
  });

  router.post('/verify-otp', limit({ max: 10 }), async (req, res) => {
    const input = parseBody(verifyOtpSchema, req);
    const result = await auth.verifyOtp(input);
    send(res, {
      message: input.purpose === OtpPurpose.REGISTER ? 'auth.emailVerified' : 'auth.otpVerified',
      data: result.resetToken ? { resetToken: result.resetToken } : null,
    });
  });

  router.post('/reset-password', limit({ max: 5 }), async (req, res) => {
    await auth.resetPassword(parseBody(resetPasswordSchema, req));
    send(res, { message: 'auth.passwordReset' });
  });

  router.post('/refresh', limit({ max: 30 }), async (req, res) => {
    const { refreshToken } = parseBody(refreshSchema, req);
    const device = req.headers['x-device-name'] ? deviceOf(req) : undefined;
    send(res, { message: 'auth.refreshed', data: await auth.refresh(refreshToken, device) });
  });

  router.post('/logout', requireAuth, async (req, res) => {
    const { userId, sessionId } = req.auth!;
    await auth.logout(userId, sessionId);
    send(res, { message: 'auth.loggedOut' });
  });

  return router;
}
