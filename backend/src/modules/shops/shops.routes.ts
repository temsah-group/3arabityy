import { Router, type RequestHandler } from 'express';

import { badRequest, ErrorCode } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody, parseQuery } from '../../common/http/validate.js';
import { limit } from '../../middleware/rate-limit.js';
import { listQuerySchema } from '../parts/parts.schemas.js';
import type { PartsService } from '../parts/parts.service.js';
import { photoExtension } from '../users/photo-storage.js';
import { photoUpload } from '../users/users.routes.js';
import {
  adminShopsQuerySchema,
  adminShopUpdateSchema,
  shopInputSchema,
  shopsQuerySchema,
  shopUpdateSchema,
} from './shops.schemas.js';
import type { ShopsService } from './shops.service.js';

/** `/shops` in the app's API (see `docs/api-contract.md`). */
export function shopsRoutes(
  shops: ShopsService,
  parts: PartsService,
  requireAuth: RequestHandler,
  optionalAuth: RequestHandler,
): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    send(res, { data: await shops.list(parseQuery(shopsQuerySchema, req)) });
  });

  // ---- The signed-in user's own shop; before `/:id` ----

  router.get('/mine', requireAuth, async (req, res) => {
    send(res, { data: await shops.mine(req.auth!.userId) });
  });

  router.post('/', requireAuth, limit({ max: 10 }), async (req, res) => {
    const shop = await shops.apply(req.auth!.userId, parseBody(shopInputSchema, req));
    send(res, { status: 201, message: 'shops.applied', data: shop });
  });

  router.patch('/mine', requireAuth, async (req, res) => {
    const shop = await shops.update(req.auth!.userId, parseBody(shopUpdateSchema, req));
    send(res, { message: 'shops.saved', data: shop });
  });

  for (const kind of ['logo', 'cover'] as const) {
    router.post(`/mine/${kind}`, requireAuth, limit({ max: 30 }), photoUpload, async (req, res) => {
      const file = req.file;
      if (!file) throw badRequest(ErrorCode.PHOTO_REQUIRED, 'users.photoRequired');
      const extension = photoExtension(file.buffer);
      if (!extension) throw badRequest(ErrorCode.PHOTO_INVALID, 'users.photoInvalid');
      const shop = await shops.setPhoto(req.auth!.userId, kind, file.buffer, extension);
      send(res, { message: 'shops.saved', data: shop });
    });
    router.delete(`/mine/${kind}`, requireAuth, async (req, res) => {
      send(res, { message: 'shops.saved', data: await shops.removePhoto(req.auth!.userId, kind) });
    });
  }

  // ---- One shop ----

  router.get('/:id', async (req, res) => {
    send(res, { data: await shops.byId(req.params.id as string) });
  });

  router.get('/:id/parts', optionalAuth, async (req, res) => {
    const ownerId = await shops.openOwner(req.params.id as string);
    const query = parseQuery(listQuerySchema.omit({ sellerId: true }), req);
    send(res, { data: await parts.list({ ...query, sellerId: ownerId }, req.auth?.userId) });
  });

  return router;
}

/** The dashboard's shops, under `/admin/shops`. */
export function shopsAdminRoutes(shops: ShopsService): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    send(res, { data: await shops.adminList(parseQuery(adminShopsQuerySchema, req)) });
  });
  router.get('/:id', async (req, res) => {
    send(res, { data: await shops.adminShop(req.params.id as string) });
  });
  router.patch('/:id', async (req, res) => {
    const input = parseBody(adminShopUpdateSchema, req);
    send(res, {
      message: 'admin.saved',
      data: await shops.adminUpdate(req.admin!, req.params.id as string, input),
    });
  });
  return router;
}
