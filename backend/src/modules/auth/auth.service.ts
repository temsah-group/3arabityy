import bcrypt from 'bcrypt';

import {
  badRequest,
  conflict,
  ErrorCode,
  forbidden,
  tooManyRequests,
  unauthorized,
  unavailable,
} from '../../common/http/errors.js';
import type { Lang } from '../../common/i18n.js';
import { logger } from '../../common/logger.js';
import type { Env } from '../../config/env.js';
import type { Mailer } from '../mail/mailer.js';
import { codeEmail } from '../mail/templates.js';
import { AccountStatus, type UserDocument } from '../users/user.model.js';
import { presentUser } from '../users/user.presenter.js';
import type { UsersService } from '../users/users.service.js';
import type {
  GoogleInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from './auth.schemas.js';
import type { GoogleVerifier } from './google.js';
import { OtpPurpose } from './otp.model.js';
import type { OtpService } from './otp.service.js';
import type { SessionsService } from './sessions.service.js';
import type { TokenService } from './tokens.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

// Compared against when the email is unknown, so both cases take as long.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly mailer: Mailer,
    private readonly env: Pick<Env, 'REFRESH_TOKEN_DAYS' | 'REFRESH_TOKEN_REMEMBER_DAYS'>,
    /** Null when no Google client ids are configured. */
    private readonly google: GoogleVerifier | null = null,
  ) {}

  /**
   * Creates the account and emails a confirmation code. Signing up again with
   * an email that was never confirmed takes it over with the new details: the
   * first sign-up never proved it owned the address either.
   */
  async register(input: RegisterInput, lang: Lang) {
    const email = input.identifier;
    const existing = await this.users.findByEmail(email);
    if (existing?.emailVerifiedAt) {
      throw conflict(ErrorCode.EMAIL_ALREADY_REGISTERED, 'auth.emailTaken');
    }

    const details = { fullName: input.fullName, phone: input.phone, password: input.password };
    const user = existing
      ? await this.users.replaceUnverified(existing, details)
      : await this.users.create({ ...details, email });

    // A repeat sign-up inside the cooldown keeps the code already sent.
    if ((await this.otp.secondsUntilResend(email, OtpPurpose.REGISTER)) === 0) {
      await this.sendCode(email, OtpPurpose.REGISTER, lang);
    }
    return {
      identifier: user.email,
      userId: user.id as string,
      isVerified: false,
      requiresVerification: true,
      otpSent: true,
      expiresInMinutes: this.otp.settings.expiresMinutes,
    };
  }

  async login(input: LoginInput, device: string, lang: Lang) {
    const user = await this.users.findByEmailWithPassword(input.identifier);
    if (!user) {
      await bcrypt.compare(input.password, DUMMY_HASH);
      throw unauthorized(ErrorCode.INVALID_CREDENTIALS, 'auth.invalidCredentials');
    }
    if (!user.passwordHash) {
      await bcrypt.compare(input.password, DUMMY_HASH);
      throw unauthorized(ErrorCode.USE_GOOGLE, 'auth.useGoogle');
    }

    this.assertNotLocked(user);
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      await this.recordFailedLogin(user);
      throw unauthorized(ErrorCode.INVALID_CREDENTIALS, 'auth.invalidCredentials');
    }
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();
    }

    if (!user.emailVerifiedAt) {
      // The app goes straight to the code screen, so make sure a code is there.
      if ((await this.otp.secondsUntilResend(user.email, OtpPurpose.REGISTER)) === 0) {
        await this.sendCode(user.email, OtpPurpose.REGISTER, lang);
      }
      throw forbidden(ErrorCode.ACCOUNT_NOT_VERIFIED, 'auth.notVerified', {
        identifier: user.email,
        isVerified: false,
        requiresVerification: true,
        otpSent: true,
      });
    }
    this.assertActive(user);
    return this.startSession(user, input.rememberMe, device);
  }

  /**
   * Signs in with a Google ID token, linking it to the account with that email.
   * A first sign-in needs the phone number Google does not give; without it the
   * answer is `PHONE_REQUIRED` with the name and email to fill the form with.
   */
  async signInWithGoogle(input: GoogleInput, device: string) {
    if (!this.google) throw unavailable(ErrorCode.GOOGLE_SIGN_IN_OFF, 'auth.googleOff');
    const identity = await this.google.verify(input.idToken);
    if (!identity) throw unauthorized(ErrorCode.GOOGLE_TOKEN_INVALID, 'auth.googleInvalid');

    let user =
      (await this.users.findByGoogleId(identity.sub)) ??
      (await this.users.findByEmail(identity.email));
    // The email moved to another Google account; keep the one it was linked to.
    if (user?.googleId && user.googleId !== identity.sub) {
      throw unauthorized(ErrorCode.GOOGLE_TOKEN_INVALID, 'auth.googleInvalid');
    }

    if (!user?.emailVerifiedAt) {
      if (!input.phone) {
        throw badRequest(ErrorCode.PHONE_REQUIRED, 'auth.phoneRequired', [], {
          email: identity.email,
          fullName: identity.name ?? '',
        });
      }
      const details = {
        fullName: input.fullName ?? (identity.name?.trim() || identity.email.split('@')[0]!),
        phone: input.phone,
        googleId: identity.sub,
      };
      // An unconfirmed sign-up never proved it owned the email; Google just did.
      user = user
        ? await this.users.claimForGoogle(user, details)
        : await this.users.createFromGoogle({ ...details, email: identity.email });
    } else if (!user.googleId) {
      user.googleId = identity.sub;
      await user.save();
    }

    this.assertActive(user);
    return this.startSession(user, input.rememberMe, device);
  }

  /** Google's word that [idToken] belongs to [googleId]; for confirming risky actions. */
  async isGoogleAccount(idToken: string, googleId: string): Promise<boolean> {
    const identity = await this.google?.verify(idToken);
    return identity?.sub === googleId;
  }

  private async startSession(user: UserDocument, rememberMe: boolean | undefined, device: string) {
    const days = rememberMe ? this.env.REFRESH_TOKEN_REMEMBER_DAYS : this.env.REFRESH_TOKEN_DAYS;
    const session = await this.sessions.start(user.id as string, days, device);
    return {
      accessToken: this.tokens.signAccess(session.userId, session.sessionId),
      refreshToken: session.refreshToken,
      user: presentUser(user),
    };
  }

  /** Same answer whether or not the email is registered. */
  async forgotPassword(email: string, lang: Lang): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user?.emailVerifiedAt) return;
    if ((await this.otp.secondsUntilResend(email, OtpPurpose.PASSWORD_RESET)) > 0) return;
    await this.sendCode(email, OtpPurpose.PASSWORD_RESET, lang);
  }

  async resendOtp(email: string, purpose: OtpPurpose, lang: Lang): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (purpose === OtpPurpose.REGISTER) {
      if (user?.emailVerifiedAt) {
        throw conflict(ErrorCode.ACCOUNT_ALREADY_VERIFIED, 'otp.alreadyVerified');
      }
      if (!user) return;
    } else if (!user?.emailVerifiedAt) {
      // Password reset never reveals whether an email is registered.
      return;
    }
    await this.otp.assertCanResend(email, purpose);
    await this.sendCode(email, purpose, lang);
  }

  /** Confirms the email, or hands out a one-time password reset token. */
  async verifyOtp(input: VerifyOtpInput): Promise<{ resetToken?: string }> {
    const email = input.identifier;
    const user = await this.users.findByEmail(email);
    if (input.purpose === OtpPurpose.REGISTER && user?.emailVerifiedAt) {
      throw conflict(ErrorCode.ACCOUNT_ALREADY_VERIFIED, 'otp.alreadyVerified');
    }

    await this.otp.verify(email, input.purpose, input.otp);
    // A code only exists for a real account, so the user is there.
    if (!user) throw unauthorized(ErrorCode.OTP_NOT_REQUESTED, 'otp.notRequested');

    if (input.purpose === OtpPurpose.REGISTER) {
      await this.users.markEmailVerified(user);
      return {};
    }
    return { resetToken: this.tokens.signPasswordReset(user.id as string, user.passwordVersion) };
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const claims = this.tokens.verifyPasswordReset(input.resetToken);
    const user = claims ? await this.users.findById(claims.userId) : null;
    // A changed password version means this token was already used.
    if (!claims || !user || user.passwordVersion !== claims.passwordVersion) {
      throw unauthorized(ErrorCode.RESET_TOKEN_INVALID, 'auth.resetTokenInvalid');
    }
    await this.users.setPassword(user, input.newPassword);
    await this.sessions.revokeAll(user.id as string, 'PASSWORD_RESET');
  }

  async refresh(refreshToken: string, device: string | undefined) {
    const session = await this.sessions.rotate(refreshToken, device);
    const user = await this.users.findById(session.userId);
    if (!user) throw unauthorized(ErrorCode.INVALID_REFRESH_TOKEN, 'auth.signInAgain');
    try {
      this.assertActive(user);
    } catch (error) {
      await this.sessions.revokeSession(session.userId, session.sessionId, 'ACCOUNT_SUSPENDED');
      throw error;
    }
    return {
      accessToken: this.tokens.signAccess(session.userId, session.sessionId),
      refreshToken: session.refreshToken,
      user: presentUser(user),
    };
  }

  logout(userId: string, sessionId: string): Promise<void> {
    return this.sessions.revokeSession(userId, sessionId);
  }

  private async sendCode(email: string, purpose: OtpPurpose, lang: Lang): Promise<void> {
    const code = await this.otp.issue(email, purpose);
    try {
      await this.mailer.send(
        codeEmail(lang, email, purpose, code, this.otp.settings.expiresMinutes),
      );
    } catch (error) {
      // The code is stored; the user can ask for it again once mail recovers.
      logger.error('Could not send verification email', {
        purpose,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private assertNotLocked(user: UserDocument): void {
    const until = user.lockedUntil?.getTime() ?? 0;
    if (until > Date.now()) {
      const seconds = Math.ceil((until - Date.now()) / 1000);
      throw tooManyRequests(
        ErrorCode.ACCOUNT_LOCKED,
        'auth.accountLocked',
        [Math.ceil(seconds / 60)],
        {
          retryAfterSeconds: seconds,
        },
      );
    }
  }

  private async recordFailedLogin(user: UserDocument): Promise<void> {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
    }
    await user.save();
  }

  private assertActive(user: UserDocument): void {
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw forbidden(ErrorCode.ACCOUNT_SUSPENDED, 'auth.suspended');
    }
  }
}
