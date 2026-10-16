import type { Connection } from 'mongoose';

import type { Env } from './config/env.js';
import { authenticate, optionalAuthenticate } from './middleware/authenticate.js';
import { AuthService } from './modules/auth/auth.service.js';
import { OtpService } from './modules/auth/otp.service.js';
import { createOtpModel } from './modules/auth/otp.model.js';
import { createRefreshTokenModel } from './modules/auth/session.model.js';
import { SessionsService } from './modules/auth/sessions.service.js';
import { TokenService } from './modules/auth/tokens.js';
import { createMailer, type Mailer } from './modules/mail/mailer.js';
import { createPartModel } from './modules/parts/part.model.js';
import { PartsService } from './modules/parts/parts.service.js';
import { createUploadModel } from './modules/parts/upload.model.js';
import { createUserModel } from './modules/users/user.model.js';
import { AccountService } from './modules/users/account.service.js';
import { PhotoStorage } from './modules/users/photo-storage.js';
import { UsersService } from './modules/users/users.service.js';

/** Builds every service by hand, so dependencies stay visible. Tests swap the mailer. */
export function createContainer(
  connection: Connection,
  env: Env,
  overrides: { mailer?: Mailer } = {},
) {
  const models = {
    User: createUserModel(connection),
    RefreshToken: createRefreshTokenModel(connection),
    Otp: createOtpModel(connection),
    Part: createPartModel(connection),
    Upload: createUploadModel(connection),
  };

  const mailer = overrides.mailer ?? createMailer(env);
  const users = new UsersService(models.User);
  const sessions = new SessionsService(models.RefreshToken);
  const tokens = new TokenService(env);
  const otp = new OtpService(models.Otp, {
    // Its own key derived from the reset secret, never shared with a JWT.
    secret: `otp:${env.JWT_RESET_SECRET}`,
    expiresMinutes: env.OTP_EXPIRES_MINUTES,
    resendSeconds: env.OTP_RESEND_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });
  const auth = new AuthService(users, sessions, tokens, otp, mailer, env);
  const photos = new PhotoStorage(env.UPLOADS_DIR);
  const parts = new PartsService(models.Part, models.Upload, models.User, photos);
  const account = new AccountService(users, models.User, sessions, models.Otp, photos, parts);
  const requireAuth = authenticate({ tokens, sessions, users });

  return {
    connection,
    env,
    models,
    mailer,
    users,
    sessions,
    tokens,
    otp,
    auth,
    photos,
    parts,
    account,
    requireAuth,
    optionalAuth: optionalAuthenticate(requireAuth),
  };
}

export type Container = ReturnType<typeof createContainer>;
