import type { Response } from 'express';

import { t, type MessageKey } from '../i18n.js';

/**
 * Every success has the same envelope: `{ success, message, data }`.
 * The app reads its payload from `data` and shows `message` as-is.
 */
export function send(
  res: Response,
  {
    message = 'ok',
    data = null,
    status = 200,
  }: { message?: MessageKey; data?: unknown; status?: number },
): void {
  res.status(status).json({ success: true, message: t(res.req.lang, message), data });
}
