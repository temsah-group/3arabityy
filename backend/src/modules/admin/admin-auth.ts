import bcrypt from 'bcrypt';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { ErrorCode, forbidden, tooManyRequests, unauthorized } from '../../common/http/errors.js';
import type { AdminDocument, AdminModel, AdminRole } from './admin.model.js';

const TYPE = 'admin';
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

type AdminClaims = { sub: string; pwv: number; typ: typeof TYPE };

/** Who is signed in to the dashboard, set on `req.admin`. */
export type AdminActor = { id: string; email: string; role: AdminRole };

export function presentAdmin(admin: AdminDocument) {
  return {
    id: admin.id as string,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt ?? null,
  };
}

/**
 * Dashboard sign-in. One token, signed with its own key and good for a few
 * hours, then the admin signs in again; there are no refresh tokens. A
 * password change or deactivation ends every token at once.
 */
export class AdminAuthService {
  constructor(
    private readonly admins: AdminModel,
    private readonly settings: { secret: string; hours: number },
  ) {}

  async login(email: string, password: string) {
    const admin = await this.admins
      .findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash')
      .exec();
    if (!admin) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw unauthorized(ErrorCode.INVALID_CREDENTIALS, 'auth.invalidCredentials');
    }
    const until = admin.lockedUntil?.getTime() ?? 0;
    if (until > Date.now()) {
      const seconds = Math.ceil((until - Date.now()) / 1000);
      throw tooManyRequests(
        ErrorCode.ACCOUNT_LOCKED,
        'auth.accountLocked',
        [Math.ceil(seconds / 60)],
        { retryAfterSeconds: seconds },
      );
    }
    if (!(await bcrypt.compare(password, admin.passwordHash))) {
      admin.failedLoginAttempts += 1;
      if (admin.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        admin.failedLoginAttempts = 0;
        admin.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      }
      await admin.save();
      throw unauthorized(ErrorCode.INVALID_CREDENTIALS, 'auth.invalidCredentials');
    }
    if (!admin.active) throw forbidden(ErrorCode.ACCOUNT_SUSPENDED, 'auth.suspended');

    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    admin.lastLoginAt = new Date();
    await admin.save();

    const claims: AdminClaims = { sub: admin.id as string, pwv: admin.passwordVersion, typ: TYPE };
    const accessToken = jwt.sign(claims, this.settings.secret, {
      algorithm: 'HS256',
      expiresIn: this.settings.hours * 3600,
    });
    return {
      accessToken,
      expiresInSeconds: this.settings.hours * 3600,
      admin: presentAdmin(admin),
    };
  }

  /** The active admin [token] was signed for, or a 401. */
  async verify(token: string): Promise<AdminDocument> {
    let claims: Record<string, unknown>;
    try {
      const decoded = jwt.verify(token, this.settings.secret, { algorithms: ['HS256'] });
      if (typeof decoded !== 'object') throw new Error();
      claims = decoded as Record<string, unknown>;
    } catch {
      throw unauthorized();
    }
    if (claims.typ !== TYPE || typeof claims.sub !== 'string' || typeof claims.pwv !== 'number') {
      throw unauthorized(ErrorCode.INVALID_TOKEN_TYPE);
    }
    const admin = await this.admins.findById(claims.sub).exec();
    if (!admin || !admin.active || admin.passwordVersion !== claims.pwv) {
      throw unauthorized(ErrorCode.SESSION_REVOKED, 'auth.sessionExpired');
    }
    return admin;
  }

  async byId(id: string): Promise<AdminDocument | null> {
    return this.admins.findById(id).exec();
  }
}

/** Accepts `Authorization: Bearer <admin token>` and sets `req.admin`. */
export function requireAdmin(auth: AdminAuthService): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1]) throw unauthorized();
    const admin = await auth.verify(match[1]);
    req.admin = { id: admin.id as string, email: admin.email, role: admin.role };
    next();
  };
}

/** Lets only [roles] through; after [requireAdmin]. */
export function requireRole(...roles: AdminRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      throw forbidden(ErrorCode.ADMIN_ROLE_REQUIRED, 'admin.roleRequired');
    }
    next();
  };
}
