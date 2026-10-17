import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import { createApp } from '../app.js';
import { logger } from '../common/logger.js';
import { loadEnv } from '../config/env.js';
import { createContainer } from '../container.js';
import { SAMPLE_PASSWORD, seedSampleData } from './seed.js';

/**
 * `npm run dev:memory`: the API on a fresh in-memory database filled with
 * the app's sample parts, so the app can be tried without MongoDB Atlas or
 * a network. Everything is gone when it stops. Codes are printed, never
 * emailed.
 */
async function main() {
  const mongo = await MongoMemoryServer.create();
  const env = loadEnv({
    // Development secrets unless .env gives its own.
    JWT_ACCESS_SECRET: 'dev-memory-access-secret-0123456789-abcdef',
    JWT_RESET_SECRET: 'dev-memory-reset-secret-0123456789-abcdefg',
    ADMIN_JWT_SECRET: 'dev-memory-admin-secret-0123456789-abcdefgh',
    // The dashboard's dev server (Vite).
    ADMIN_ORIGINS: 'http://localhost:5173',
    ...process.env,
    NODE_ENV: 'development',
    MONGO_URI: mongo.getUri('arabity-dev'),
    MAIL_HOST: '',
  });
  const connection = await mongoose.createConnection(env.MONGO_URI).asPromise();
  const container = createContainer(connection, env);
  await Promise.all(Object.values(container.models).map((model) => model.syncIndexes()));
  const seeded = await seedSampleData(container);
  logger.info('Sample data ready', {
    ...seeded,
    signIn: `seller01@example.com … / ${SAMPLE_PASSWORD}`,
    dashboard: `admin@example.com / ${SAMPLE_PASSWORD}`,
  });

  const server = createApp(container).listen(env.PORT, () => {
    logger.info('3arabity API listening (in-memory database)', { port: env.PORT });
  });
  const shutdown = () => {
    server.close(() => {
      void connection.close().finally(() => mongo.stop().finally(() => process.exit(0)));
    });
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

main().catch((error: unknown) => {
  logger.error('Startup failed', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
