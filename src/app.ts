import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';

import type { Container } from './container.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { language } from './middleware/language.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { partsRoutes, uploadRoutes } from './modules/parts/parts.routes.js';
import { reportsRoutes } from './modules/reports/reports.js';
import { savedRoutes } from './modules/saved/saved.routes.js';
import { sellersRoutes } from './modules/sellers/sellers.routes.js';
import { UPLOADS_ROUTE } from './modules/users/photo-storage.js';
import { usersRoutes } from './modules/users/users.routes.js';

export const API_PREFIX = '/api/v1';

export function createApp(container: Container) {
  const { env } = container;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(language);

  // The dashboard: its own origins, its own accounts. Before the app's CORS,
  // which would answer the dashboard's preflight without allowing it.
  if (container.adminAuth) {
    app.use(
      `${API_PREFIX}/admin`,
      cors({ origin: env.ADMIN_ORIGINS.length ? env.ADMIN_ORIGINS : false }),
      adminRoutes(container.adminAuth, container.moderation),
    );
  }

  // The mobile app sends no Origin; only listed browser origins are allowed.
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false }));

  const api = Router();
  api.use('/health', healthRoutes(container.connection));
  api.use('/auth', authRoutes(container.auth, container.requireAuth));
  // Before `/users`, which requires a session for everything under it.
  api.use('/users/me/saved', savedRoutes(container.saved, container.requireAuth));
  api.use('/users', usersRoutes(container.users, container.account, container.requireAuth));
  api.use('/parts', partsRoutes(container.parts, container.requireAuth, container.optionalAuth));
  api.use('/uploads', uploadRoutes(container.parts, container.requireAuth));
  api.use('/sellers', sellersRoutes(container.sellers, container.parts, container.optionalAuth));
  api.use('/notifications', notificationsRoutes(container.notifications, container.requireAuth));
  api.use('/reports', reportsRoutes(container.reports, container.requireAuth));
  app.use(API_PREFIX, api);

  // Uploaded photos. Names are random and never reused, so they cache for good.
  app.use(
    UPLOADS_ROUTE,
    express.static(env.UPLOADS_DIR, {
      immutable: true,
      maxAge: '365d',
      index: false,
      // The dashboard shows them from its own domain.
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
