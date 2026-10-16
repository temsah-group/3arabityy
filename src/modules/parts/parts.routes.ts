import { Router, type RequestHandler } from 'express';
import multer from 'multer';

import { AppError, badRequest, ErrorCode } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody, parseQuery } from '../../common/http/validate.js';
import { limit } from '../../middleware/rate-limit.js';
import { MAX_PART_PHOTO_MB, photoExtension } from '../users/photo-storage.js';
import {
  contactSchema,
  createPartSchema,
  featuredQuerySchema,
  limitQuerySchema,
  listQuerySchema,
  soldSchema,
  updatePartSchema,
} from './parts.schemas.js';
import type { PartsService } from './parts.service.js';

const pageQuery = listQuerySchema.pick({ cursor: true, limit: true });

/** One image in the `photo` field, kept in memory until it is checked. */
const photoUpload: RequestHandler = (req, res, next) => {
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PART_PHOTO_MB * 1024 * 1024, files: 1, fields: 0 },
  }).single('photo')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(
        new AppError(413, ErrorCode.PHOTO_TOO_LARGE, 'users.photoTooLarge', [MAX_PART_PHOTO_MB]),
      );
    }
    if (error instanceof multer.MulterError) {
      return next(badRequest(ErrorCode.PHOTO_REQUIRED, 'users.photoRequired'));
    }
    next(error);
  });
};

export function partsRoutes(
  parts: PartsService,
  requireAuth: RequestHandler,
  optionalAuth: RequestHandler,
): Router {
  const router = Router();
  const viewer = (req: { auth?: { userId: string } }) => req.auth?.userId;

  router.get('/', optionalAuth, async (req, res) => {
    send(res, { data: await parts.list(parseQuery(listQuerySchema, req), viewer(req)) });
  });

  router.get('/featured', optionalAuth, async (req, res) => {
    send(res, { data: await parts.featured(parseQuery(featuredQuerySchema, req), viewer(req)) });
  });

  router.get('/mine', requireAuth, async (req, res) => {
    const { cursor, limit: size } = parseQuery(pageQuery, req);
    send(res, { data: await parts.mine(req.auth!.userId, cursor, size) });
  });

  router.post('/', requireAuth, limit({ max: 30 }), async (req, res) => {
    const part = await parts.create(req.auth!.userId, parseBody(createPartSchema, req));
    send(res, { message: 'parts.created', data: part, status: 201 });
  });

  router.get('/:id', optionalAuth, async (req, res) => {
    send(res, { data: await parts.byId(req.params.id as string, viewer(req)) });
  });

  router.get('/:id/similar', optionalAuth, async (req, res) => {
    const { limit: size } = parseQuery(limitQuerySchema, req);
    send(res, { data: await parts.similar(req.params.id as string, size, viewer(req)) });
  });

  router.patch('/:id', requireAuth, async (req, res) => {
    const part = await parts.update(
      req.auth!.userId,
      req.params.id as string,
      parseBody(updatePartSchema, req),
    );
    send(res, { message: 'parts.updated', data: part });
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    await parts.remove(req.auth!.userId, req.params.id as string);
    send(res, { message: 'parts.deleted' });
  });

  router.post('/:id/sold', requireAuth, async (req, res) => {
    const { sold } = parseBody(soldSchema, req);
    const part = await parts.setSold(req.auth!.userId, req.params.id as string, sold);
    send(res, { message: sold ? 'parts.markedSold' : 'parts.backOnSale', data: part });
  });

  router.post('/:id/renew', requireAuth, async (req, res) => {
    send(res, {
      message: 'parts.renewed',
      data: await parts.renew(req.auth!.userId, req.params.id as string),
    });
  });

  router.post('/:id/contact', optionalAuth, limit({ max: 60 }), async (req, res) => {
    const { channel } = parseBody(contactSchema, req);
    await parts.contact(req.params.id as string, channel, viewer(req));
    res.status(204).end();
  });

  return router;
}

/** `POST /uploads/parts`: a part photo, before the listing is sent. */
export function uploadRoutes(parts: PartsService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post('/parts', requireAuth, limit({ max: 60 }), photoUpload, async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest(ErrorCode.PHOTO_REQUIRED, 'users.photoRequired');
    const extension = photoExtension(file.buffer);
    if (!extension) throw badRequest(ErrorCode.PHOTO_INVALID, 'users.photoInvalid');
    const path = await parts.uploadPhoto(req.auth!.userId, file.buffer, extension);
    send(res, { message: 'parts.photoUploaded', data: { path }, status: 201 });
  });
  return router;
}
