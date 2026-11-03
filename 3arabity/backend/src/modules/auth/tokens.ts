import jwt, { type SignOptions } from 'jsonwebtoken';

import { ErrorCode, unauthorized } from '../../common/http/errors.js';
import type { Env } from '../../config/env.js';

const ACCESS = 'access';
const PASSWORD_RESET = 'password_reset';
const RESET_TOKEN_LIFETIME = '10m';

type AccessClaims = { sub: string; sid: string; typ: typeof ACCESS };
type ResetClaims = { sub: string; pwv: number; typ: typeof PASSWORD_RESET };

/**
 * Short-lived JWTs. Access tokens are bound to a session (`sid`) so signing
 * out ends them; reset tokens use their own key and die with the password.
 */
export class TokenService {
  constructor(
    private readonly env: Pick<
      Env,
      'JWT_ACCESS_SECRET' | 'JWT_RESET_SECRET' | 'JWT_ACCESS_EXPIRES_IN'
    >,
  ) {}

  signAccess(userId: string, sessionId: string): string {
    const claims: AccessClaims = { sub: userId, sid: sessionId, typ: ACCESS };
    return jwt.sign(claims, this.env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: this.env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    });
  }

  verifyAccess(token: string): { userId: string; sessionId: string } {
    const claims = this.verify(token, this.env.JWT_ACCESS_SECRET);
    if (
      claims?.typ !== ACCESS ||
      typeof claims.sub !== 'string' ||
      typeof claims.sid !== 'string'
    ) {
      throw unauthorized(ErrorCode.INVALID_TOKEN_TYPE);
    }
    return { userId: claims.sub, sessionId: claims.sid };
  }

  signPasswordReset(userId: string, passwordVersion: number): string {
    const claims: ResetClaims = { sub: userId, pwv: passwordVersion, typ: PASSWORD_RESET };
    return jwt.sign(claims, this.env.JWT_RESET_SECRET, {
      algorithm: 'HS256',
      expiresIn: RESET_TOKEN_LIFETIME,
    });
  }

  /** Returns null for anything that is not a live reset token. */
  verifyPasswordReset(token: string): { userId: string; passwordVersion: number } | null {
    const claims = this.verify(token, this.env.JWT_RESET_SECRET);
    if (
      claims?.typ !== PASSWORD_RESET ||
      typeof claims.sub !== 'string' ||
      typeof claims.pwv !== 'number'
    ) {
      return null;
    }
    return { userId: claims.sub, passwordVersion: claims.pwv };
  }

  private verify(token: string, secret: string): Record<string, unknown> | null {
    try {
      const claims = jwt.verify(token, secret, { algorithms: ['HS256'] });
      return typeof claims === 'object' ? (claims as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}
