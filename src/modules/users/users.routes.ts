import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import { send } from '../../common/http/response.js';
import { parseBody } from '../../common/http/validate.js';
import { fullName, phone } from '../auth/auth.schemas.js';
import { presentUser } from './user.presenter.js';
import type { UsersService } from './users.service.js';

const updateProfileSchema = z.strictObject({
  fullName: fullName.optional(),
  phone: phone.optional(),
});

export function usersRoutes(users: UsersService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/me', async (req, res) => {
    send(res, { data: presentUser(await users.getById(req.auth!.userId)) });
  });

  router.patch('/me', async (req, res) => {
    const changes = parseBody(updateProfileSchema, req);
    const user = await users.updateProfile(req.auth!.userId, changes);
    send(res, { message: 'users.profileUpdated', data: presentUser(user) });
  });

  return router;
}
