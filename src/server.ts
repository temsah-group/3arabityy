import mongoose from 'mongoose';

import { createApp } from './app.js';
import { logger } from './common/logger.js';
import { loadEnv } from './config/env.js';
import { createContainer } from './container.js';

async function main() {
  const env = loadEnv();
  const connection = await mongoose
    .createConnection(env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 })
    .asPromise();
  const container = createContainer(connection, env);
  // Unique indexes (one account per email) must exist before the first write.
  await Promise.all(Object.values(container.models).map((model) => model.syncIndexes()));

  const app = createApp(container);
  const server = app.listen(env.PORT, () => {
    logger.info('3arabity API listening', { port: env.PORT, env: env.NODE_ENV });
  });
  // Above typical load-balancer idle timeouts, so they close first.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = (signal: string) => {
    logger.info('Shutting down', { signal });
    server.close(() => {
      connection.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.error('Startup failed', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
