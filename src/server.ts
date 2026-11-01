import mongoose from 'mongoose';

import { createApp } from './app.js';
import { logger } from './common/logger.js';
import { loadEnv } from './config/env.js';
import { createContainer } from './container.js';
import { syncAdminAccounts } from './modules/admin/admin-accounts.js';

   import dns from 'node:dns';
   dns.setServers(['8.8.8.8', '1.1.1.1']);
async function main() {
  const env = loadEnv();
  const connection = await mongoose
    .createConnection(env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 })
    .asPromise();
  const container = createContainer(connection, env);
  // Unique indexes (one account per email) must exist before the first write.
  await Promise.all(Object.values(container.models).map((model) => model.syncIndexes()));
  if (env.ADMIN_ACCOUNTS.length) {
    if (!container.adminAuth) logger.warn('ADMIN_ACCOUNTS is set but ADMIN_JWT_SECRET is not; /admin is off');
    const { created, updated } = await syncAdminAccounts(container.models.Admin, env.ADMIN_ACCOUNTS);
    if (created.length || updated.length) logger.info('Admin accounts from ADMIN_ACCOUNTS', { created, updated });
  }
  // The cars owners saved, before the first part is checked against them;
  // then every minute, in case another server saved new ones.
  await container.settings.current();
  setInterval(() => void container.settings.current().catch(() => {}), 60_000).unref();

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
