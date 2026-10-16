import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import { pageQuerySchema } from '../../common/http/paging.js';
import { send } from '../../common/http/response.js';
import { parseBody, parseQuery } from '../../common/http/validate.js';
import type { SavedService } from './saved.service.js';

const syncSchema = z.strictObject({
  partIds: z.array(z.string().max(64), 'validation.required').max(200, 'validation.required'),
});

/** `/users/me/saved`: the signed-in user's saved parts. */
export function savedRoutes(saved: SavedService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);
  const user = (req: { auth?: { userId: string } }) => req.auth!.userId;

  router.get('/', async (req, res) => {
    const { cursor, limit } = parseQuery(pageQuerySchema, req);
    send(res, { data: await saved.list(user(req), cursor, limit) });
  });

  router.post('/sync', async (req, res) => {
    await saved.sync(user(req), parseBody(syncSchema, req).partIds);
    res.status(204).end();
  });

  router.put('/:partId', async (req, res) => {
    await saved.save(user(req), req.params.partId as string);
    res.status(204).end();
  });

  router.delete('/:partId', async (req, res) => {
    await saved.unsave(user(req), req.params.partId as string);
    res.status(204).end();
  });

  return router;
}
