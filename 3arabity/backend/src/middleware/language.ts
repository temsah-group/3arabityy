import type { RequestHandler } from 'express';

import { resolveLang } from '../common/i18n.js';

export const language: RequestHandler = (req, _res, next) => {
  req.lang = resolveLang(req.headers['accept-language']);
  next();
};
