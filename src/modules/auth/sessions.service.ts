import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import { Types } from 'mongoose';

import { ErrorCode, unauthorized } from '../../common/http/errors.js';
import { RefreshTokenState, type RefreshTokenModel } from './session.model.js';

const TOKEN_PATTERN = /^([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type IssuedSession = { userId: string; sessionId: string; refreshToken: string };

/** Refresh tokens: `<selector>.<secret>`, single use, rotated on every refresh. */
export class SessionsService {
  constructor(private readonly tokens: RefreshTokenModel) {}

  async start(userId: string, days: number, device: string): Promise<IssuedSession> {
    const sessionId = randomUUID();
    const refreshToken = await this.issue({
      userId: new Types.ObjectId(userId),
      sessionId,
      device,
      expiresAt: new Date(Date.now() + days * DAY_MS),
    });
    return { userId, sessionId, refreshToken };
  }

  /** Swaps [refreshToken] for the next one of the same session. */
  async rotate(refreshToken: string, device: string | undefined): Promise<IssuedSession> {
    const parsed = TOKEN_PATTERN.exec(refreshToken);
    if (!parsed) throw invalid();
    const [, selector, secret] = parsed as unknown as [string, string, string];

    const row = await this.tokens.findOne({ selector }).exec();
    if (!row || !matches(secret, row.secretHash)) throw invalid();

    if (row.state === RefreshTokenState.ROTATED) {
      await this.revokeSession(row.userId.toString(), row.sessionId, 'REFRESH_TOKEN_REUSE');
      throw invalid(ErrorCode.REFRESH_TOKEN_REUSED);
    }
    if (row.state === RefreshTokenState.REVOKED) throw invalid(ErrorCode.SESSION_REVOKED);
    if (row.expiresAt.getTime() <= Date.now()) throw invalid(ErrorCode.SESSION_EXPIRED);

    // Only one caller can move the row out of ACTIVE; a racing replay loses.
    const consumed = await this.tokens
      .findOneAndUpdate(
        { _id: row._id, state: RefreshTokenState.ACTIVE },
        { $set: { state: RefreshTokenState.ROTATED, rotatedAt: new Date() } },
      )
      .exec();
    if (!consumed) {
      await this.revokeSession(row.userId.toString(), row.sessionId, 'CONCURRENT_REUSE');
      throw invalid(ErrorCode.REFRESH_TOKEN_REUSED);
    }

    const next = await this.issue({
      userId: row.userId,
      sessionId: row.sessionId,
      device: (device ?? row.device).slice(0, 200),
      expiresAt: row.expiresAt,
    });
    return { userId: row.userId.toString(), sessionId: row.sessionId, refreshToken: next };
  }

  async isActive(userId: string, sessionId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const live = await this.tokens
      .exists({
        userId: new Types.ObjectId(userId),
        sessionId,
        state: RefreshTokenState.ACTIVE,
        expiresAt: { $gt: new Date() },
      })
      .exec();
    return live !== null;
  }

  async revokeSession(userId: string, sessionId: string, reason = 'LOGOUT'): Promise<void> {
    await this.tokens
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          sessionId,
          state: { $ne: RefreshTokenState.REVOKED },
        },
        { $set: { state: RefreshTokenState.REVOKED, revokedAt: new Date(), revokeReason: reason } },
      )
      .exec();
  }

  /** Signs the user out everywhere, e.g. after a password reset. */
  async revokeAll(userId: string, reason: string): Promise<void> {
    await this.tokens
      .updateMany(
        { userId: new Types.ObjectId(userId), state: { $ne: RefreshTokenState.REVOKED } },
        { $set: { state: RefreshTokenState.REVOKED, revokedAt: new Date(), revokeReason: reason } },
      )
      .exec();
  }

  /** Signs the user out everywhere except [keepSessionId], e.g. after a password change. */
  async revokeOthers(userId: string, keepSessionId: string, reason: string): Promise<void> {
    await this.tokens
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          sessionId: { $ne: keepSessionId },
          state: { $ne: RefreshTokenState.REVOKED },
        },
        { $set: { state: RefreshTokenState.REVOKED, revokedAt: new Date(), revokeReason: reason } },
      )
      .exec();
  }

  /** Forgets every session of a deleted account. */
  async deleteAll(userId: string): Promise<void> {
    await this.tokens.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }

  private async issue(row: {
    userId: Types.ObjectId;
    sessionId: string;
    device: string;
    expiresAt: Date;
  }): Promise<string> {
    const selector = randomBytes(18).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    await this.tokens.create({ ...row, selector, secretHash: sha256(secret) });
    return `${selector}.${secret}`;
  }
}

const invalid = (
  code: (typeof ErrorCode)[keyof typeof ErrorCode] = ErrorCode.INVALID_REFRESH_TOKEN,
) => unauthorized(code, 'auth.signInAgain');

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function matches(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
