import type { RequestHandler } from 'express';

import { ErrorCode, forbidden, unauthorized } from '../common/http/errors.js';
import type { SessionsService } from '../modules/auth/sessions.service.js';
import type { TokenService } from '../modules/auth/tokens.js';
import { AccountStatus } from '../modules/users/user.model.js';
import type { UsersService } from '../modules/users/users.service.js';

/**
 * Accepts `Authorization: Bearer <access token>` for a live session of an
 * active account, and sets `req.auth`.
 */
export function authenticate(deps: {
  tokens: TokenService;
  sessions: SessionsService;
  users: UsersService;
}): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1]) throw unauthorized();

    const { userId, sessionId } = deps.tokens.verifyAccess(match[1]);
    if (!(await deps.sessions.isActive(userId, sessionId))) {
      throw unauthorized(ErrorCode.SESSION_REVOKED, 'auth.sessionExpired');
    }
    const user = await deps.users.findById(userId);
    if (!user) throw unauthorized();
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw forbidden(ErrorCode.ACCOUNT_SUSPENDED, 'auth.suspended');
    }

    req.auth = { userId, sessionId };
    next();
  };
}
