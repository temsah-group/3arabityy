import { Router } from 'express';
import type { Connection } from 'mongoose';

import { send } from '../../common/http/response.js';

/** Liveness plus the database connection, for load balancers and the app's dev sheet. */
export function healthRoutes(connection: Connection): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const database = connection.readyState === 1 ? 'up' : 'down';
    res.status(database === 'up' ? 200 : 503);
    send(res, {
      data: { status: database === 'up' ? 'ok' : 'degraded', database },
      status: res.statusCode,
    });
  });
  return router;
}
