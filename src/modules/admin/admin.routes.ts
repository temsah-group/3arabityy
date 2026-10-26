import { Router } from 'express';

import { notFound } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody, parseQuery } from '../../common/http/validate.js';
import { limit } from '../../middleware/rate-limit.js';
import { presentAdmin, requireAdmin, requireRole, type AdminAuthService } from './admin-auth.js';
import {
  auditQuerySchema,
  loginSchema,
  partsQuerySchema,
  partUpdateSchema,
  removalSchema,
  reportsQuerySchema,
  reportTargetSchema,
  resolutionSchema,
  statsQuerySchema,
  usersQuerySchema,
  userUpdateSchema,
} from './admin.schemas.js';
import {
  announcementsAdminRoutes,
  type AnnouncementsService,
} from '../announcements/announcements.js';
import { offersAdminRoutes, type OffersService } from '../offers/offers.js';
import { settingsAdminRoutes, type SettingsService } from '../settings/settings.js';
import { reviewsAdminRoutes } from '../reviews/reviews.routes.js';
import type { ReviewsService } from '../reviews/reviews.service.js';
import { shopsAdminRoutes } from '../shops/shops.routes.js';
import type { ShopsService } from '../shops/shops.service.js';
import type { ModerationService } from './moderation.service.js';

/** The dashboard's API, under `/api/v1/admin` (see `docs/api-contract.md`). */
export function adminRoutes(
  auth: AdminAuthService,
  moderation: ModerationService,
  settings: SettingsService,
  announcements: AnnouncementsService,
  shops: ShopsService,
  reviews: ReviewsService,
  offers: OffersService,
): Router {
  const router = Router();
  const signedIn = requireAdmin(auth);
  const owner = requireRole('OWNER');

  router.post('/auth/login', limit({ max: 10 }), async (req, res) => {
    const input = parseBody(loginSchema, req);
    send(res, { message: 'auth.loggedIn', data: await auth.login(input.email, input.password) });
  });

  router.use(signedIn);

  router.get('/auth/me', async (req, res) => {
    const admin = await auth.byId(req.admin!.id);
    send(res, { data: admin && presentAdmin(admin) });
  });

  router.get('/overview', async (_req, res) => {
    send(res, { data: await moderation.overview() });
  });

  router.get('/stats', async (req, res) => {
    const { days } = parseQuery(statsQuerySchema, req);
    send(res, { data: await moderation.stats(days) });
  });

  // ---- Reports ----

  router.get('/reports', async (req, res) => {
    send(res, { data: await moderation.reports(parseQuery(reportsQuerySchema, req)) });
  });

  router.get('/reports/:target/:id', async (req, res) => {
    const target = targetOf(req.params.target);
    send(res, { data: await moderation.reportsOn(target, req.params.id as string) });
  });

  router.post('/reports/:target/:id/resolve', async (req, res) => {
    const target = targetOf(req.params.target);
    const input = parseBody(resolutionSchema, req);
    send(res, {
      message: 'admin.saved',
      data: await moderation.resolve(req.admin!, target, req.params.id as string, input),
    });
  });

  // ---- Accounts ----

  router.get('/users', async (req, res) => {
    send(res, { data: await moderation.users(parseQuery(usersQuerySchema, req)) });
  });

  router.get('/users/:id', async (req, res) => {
    send(res, { data: await moderation.user(req.params.id as string) });
  });

  router.patch('/users/:id', async (req, res) => {
    const input = parseBody(userUpdateSchema, req);
    send(res, {
      message: 'admin.saved',
      data: await moderation.updateUser(req.admin!, req.params.id as string, input),
    });
  });

  // ---- Listings ----

  router.get('/parts', async (req, res) => {
    send(res, { data: await moderation.parts(parseQuery(partsQuerySchema, req)) });
  });

  router.get('/parts/:id', async (req, res) => {
    send(res, { data: await moderation.part(req.params.id as string) });
  });

  router.patch('/parts/:id', async (req, res) => {
    const input = parseBody(partUpdateSchema, req);
    send(res, {
      message: 'admin.saved',
      data: await moderation.updatePart(req.admin!, req.params.id as string, input),
    });
  });

  router.delete('/parts/:id', async (req, res) => {
    const { note } = parseBody(removalSchema, req);
    await moderation.removePart(req.admin!, req.params.id as string, note);
    send(res, { message: 'parts.deleted' });
  });

  // ---- Shops: applications, suspensions; featuring and badges are owners' ----

  router.use('/shops', shopsAdminRoutes(shops));
  router.use('/reviews', reviewsAdminRoutes(reviews));

  // ---- What the app says about 3arabity (owners) ----

  router.use('/settings', settingsAdminRoutes(settings, owner));

  // ---- Messages to every user (owners) ----

  router.use('/announcements', announcementsAdminRoutes(announcements, owner));

  // ---- The home screen's offers (owners) ----

  router.use('/offers', offersAdminRoutes(offers, owner));

  // ---- The log (owners) ----

  router.get('/audit', owner, async (req, res) => {
    send(res, { data: await moderation.audit(parseQuery(auditQuerySchema, req)) });
  });

  return router;
}

/** `PART`, `SELLER` or `REVIEW` from the path; anything else is no route. */
function targetOf(value: unknown) {
  const parsed = reportTargetSchema.safeParse(value);
  if (!parsed.success) throw notFound();
  return parsed.data;
}
