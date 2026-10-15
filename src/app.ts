import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';

import type { Container } from './container.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { language } from './middleware/language.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';

export const API_PREFIX = '/api/v1';

export function createApp(container: Container) {
  const { env } = container;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  // The mobile app sends no Origin; only listed browser origins are allowed.
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(language);

  const api = Router();
  api.use('/health', healthRoutes(container.connection));
  api.use('/auth', authRoutes(container.auth, container.requireAuth));
  api.use('/users', usersRoutes(container.users, container.requireAuth));
  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
