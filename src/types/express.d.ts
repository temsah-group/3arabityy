import type { Lang } from '../common/i18n.js';

declare global {
  namespace Express {
    interface Request {
      /** Language of the reply, from Accept-Language. */
      lang: Lang;
      /** Set by `authenticate` on protected routes. */
      auth?: { userId: string; sessionId: string };
    }
  }
}

export {};
