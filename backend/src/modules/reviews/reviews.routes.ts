import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import { pageQuerySchema } from '../../common/http/paging.js';
import { send } from '../../common/http/response.js';
import { parseBody, parseQuery } from '../../common/http/validate.js';
import { limit } from '../../middleware/rate-limit.js';
import { pageQuery } from '../admin/admin.schemas.js';
import { contactSchema } from '../parts/parts.schemas.js';
import { REVIEW_TARGETS, type ReviewTarget } from './review.model.js';
import type { ReviewsService } from './reviews.service.js';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'validation.reviewText')
    .nullish()
    .transform((value) => (value ? value : null));

const reviewSchema = z.strictObject({
  rating: z
    .number('validation.rating')
    .int('validation.rating')
    .min(1, 'validation.rating')
    .max(5, 'validation.rating'),
  text: text(500),
});

const replySchema = z.strictObject({ text: text(500) });

const adminReviewsQuery = pageQuery.extend({
  hidden: z
    .enum(['true', 'false'], 'validation.query')
    .transform((value) => value === 'true')
    .optional(),
  target: z.enum(REVIEW_TARGETS, 'validation.query').optional(),
  sellerId: z.string().max(64, 'validation.query').optional(),
});

const adminReviewUpdate = z.strictObject({
  hidden: z.boolean('validation.required'),
  note: z
    .string()
    .trim()
    .max(500, 'validation.description')
    .nullish()
    .transform((value) => (value ? value : null)),
});

/**
 * Reviews under the shop or part they are about (`/shops/:id/reviews`,
 * `/parts/:id/reviews`), and the seller's side under `/reviews`. Mounted
 * at the API's root, after the shops and parts routers.
 */
export function reviewsRoutes(
  reviews: ReviewsService,
  requireAuth: RequestHandler,
  optionalAuth: RequestHandler,
): Router {
  const router = Router();

  for (const [path, target] of [
    ['/shops/:id/reviews', 'SHOP'],
    ['/parts/:id/reviews', 'PART'],
  ] as const satisfies readonly (readonly [string, ReviewTarget])[]) {
    router.get(path, optionalAuth, async (req, res) => {
      const { cursor, limit: size } = parseQuery(pageQuerySchema, req);
      send(res, {
        data: await reviews.list(target, req.params.id as string, req.auth?.userId, cursor, size),
      });
    });

    router.put(`${path}/mine`, requireAuth, limit({ max: 30 }), async (req, res) => {
      const input = parseBody(reviewSchema, req);
      send(res, {
        message: 'reviews.saved',
        data: await reviews.write(req.auth!.userId, target, req.params.id as string, input),
      });
    });

    router.delete(`${path}/mine`, requireAuth, async (req, res) => {
      await reviews.remove(req.auth!.userId, target, req.params.id as string);
      send(res, { message: 'reviews.deleted' });
    });
  }

  router.post('/shops/:id/contact', optionalAuth, limit({ max: 60 }), async (req, res) => {
    parseBody(contactSchema, req);
    await reviews.contactShop(req.params.id as string, req.auth?.userId);
    res.status(204).end();
  });

  router.get('/reviews/received', requireAuth, async (req, res) => {
    const { cursor, limit: size } = parseQuery(pageQuerySchema, req);
    send(res, { data: await reviews.received(req.auth!.userId, cursor, size) });
  });

  router.put('/reviews/:id/reply', requireAuth, limit({ max: 60 }), async (req, res) => {
    const { text: reply } = parseBody(replySchema, req);
    send(res, {
      message: reply ? 'reviews.replied' : 'reviews.replyRemoved',
      data: await reviews.reply(req.auth!.userId, req.params.id as string, reply),
    });
  });

  return router;
}

/** The dashboard's reviews, under `/admin/reviews`. */
export function reviewsAdminRoutes(reviews: ReviewsService): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    send(res, { data: await reviews.adminList(parseQuery(adminReviewsQuery, req)) });
  });
  router.patch('/:id', async (req, res) => {
    const { hidden, note } = parseBody(adminReviewUpdate, req);
    send(res, {
      message: 'admin.saved',
      data: await reviews.setHidden(req.admin!, req.params.id as string, hidden, note),
    });
  });
  return router;
}
