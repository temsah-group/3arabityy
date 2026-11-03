import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { badRequest, ErrorCode, tooManyRequests } from '../../common/http/errors.js';
import type { OtpModel, OtpPurpose } from './otp.model.js';

export type OtpSettings = {
  /** Keys the code hash, so a leaked table cannot be brute-forced offline. */
  secret: string;
  expiresMinutes: number;
  resendSeconds: number;
  maxAttempts: number;
};

/** Six-digit email codes: one live per email and purpose, a few tries each. */
export class OtpService {
  constructor(
    private readonly codes: OtpModel,
    readonly settings: OtpSettings,
  ) {}

  /** Seconds until a new code may be sent; 0 when it can go now. */
  async secondsUntilResend(email: string, purpose: OtpPurpose): Promise<number> {
    const current = await this.codes.findOne({ email, purpose }).exec();
    if (!current) return 0;
    const elapsed = (Date.now() - current.sentAt.getTime()) / 1000;
    return Math.max(0, Math.ceil(this.settings.resendSeconds - elapsed));
  }

  async assertCanResend(email: string, purpose: OtpPurpose): Promise<void> {
    const wait = await this.secondsUntilResend(email, purpose);
    if (wait > 0) {
      throw tooManyRequests(ErrorCode.OTP_RESEND_TOO_SOON, 'otp.resendTooSoon', [wait], {
        retryAfterSeconds: wait,
      });
    }
  }

  /** Stores a fresh code (replacing the previous one) and returns it to send. */
  async issue(email: string, purpose: OtpPurpose): Promise<string> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const now = new Date();
    await this.codes
      .findOneAndUpdate(
        { email, purpose },
        {
          $set: {
            codeHash: this.hash(email, purpose, code),
            attempts: 0,
            sentAt: now,
            expiresAt: new Date(now.getTime() + this.settings.expiresMinutes * 60_000),
          },
        },
        { upsert: true },
      )
      .exec();
    return code;
  }

  /** Consumes the code when it matches; otherwise counts the attempt and throws. */
  async verify(email: string, purpose: OtpPurpose, code: string): Promise<void> {
    const current = await this.codes.findOne({ email, purpose }).exec();
    if (!current) throw badRequest(ErrorCode.OTP_NOT_REQUESTED, 'otp.notRequested');
    if (current.expiresAt.getTime() <= Date.now()) {
      throw badRequest(ErrorCode.OTP_EXPIRED, 'otp.expired');
    }
    if (current.attempts >= this.settings.maxAttempts) {
      throw badRequest(ErrorCode.OTP_ATTEMPTS_EXCEEDED, 'otp.attemptsExceeded');
    }

    const expected = Buffer.from(current.codeHash, 'hex');
    const actual = Buffer.from(this.hash(email, purpose, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      // Counted atomically so parallel guesses cannot all slip under the limit.
      await this.codes.updateOne({ _id: current._id }, { $inc: { attempts: 1 } }).exec();
      throw badRequest(ErrorCode.OTP_INVALID, 'otp.invalid');
    }
    // Deleting is the "used" mark: the same code can never work twice.
    const deleted = await this.codes.deleteOne({ _id: current._id }).exec();
    if (deleted.deletedCount !== 1)
      throw badRequest(ErrorCode.OTP_NOT_REQUESTED, 'otp.notRequested');
  }

  private hash(email: string, purpose: OtpPurpose, code: string): string {
    return createHmac('sha256', this.settings.secret)
      .update(`${purpose}:${email}:${code}`)
      .digest('hex');
  }
}
