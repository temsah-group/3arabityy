import { Router, type RequestHandler } from 'express';
import { Types } from 'mongoose';

import { AppError, ErrorCode } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseQuery } from '../../common/http/validate.js';
import type { PartModel } from '../parts/part.model.js';
import { listQuerySchema } from '../parts/parts.schemas.js';
import type { PartsService } from '../parts/parts.service.js';
import type { UserModel } from '../users/user.model.js';

const sellerNotFound = () => new AppError(404, ErrorCode.SELLER_NOT_FOUND, 'sellers.notFound');

/**
 * A seller is an account, as buyers see it: its name and badge, and what it
 * has for sale. Sold parts are not counted.
 */
export class SellersService {
  constructor(
    private readonly users: UserModel,
    private readonly parts: PartModel,
  ) {}

  async byId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw sellerNotFound();
    const user = await this.users
      .findById(id)
      .select('fullName profilePhotoUrl isVerifiedSeller')
      .exec();
    if (!user) throw sellerNotFound();
    const sellerId = new Types.ObjectId(id);
    const [forSale, latest] = await Promise.all([
      this.parts
        .find({ sellerId, isSold: false })
        .select('category city listedAt')
        .sort({ listedAt: -1 })
        .exec(),
      this.parts.findOne({ sellerId }).sort({ listedAt: -1 }).select('phone city').exec(),
    ]);
    // Where most of their parts are.
    const cities = new Map<string, number>();
    for (const part of forSale) cities.set(part.city, (cities.get(part.city) ?? 0) + 1);
    const city = [...cities].sort((a, b) => b[1] - a[1])[0]?.[0] ?? latest?.city ?? null;
    return {
      id,
      name: user.fullName,
      city,
      photoUrl: user.profilePhotoUrl ?? null,
      verified: user.isVerifiedSeller ?? false,
      partsCount: forSale.length,
      categoriesCount: new Set(forSale.map((part) => part.category)).size,
      firstListedAt: forSale.at(-1)?.listedAt ?? null,
      // The number on their latest listing; never the account's own.
      phone: latest?.phone ?? null,
    };
  }
}

export function sellersRoutes(
  sellers: SellersService,
  parts: PartsService,
  optionalAuth: RequestHandler,
): Router {
  const router = Router();

  router.get('/:id', async (req, res) => {
    send(res, { data: await sellers.byId(req.params.id as string) });
  });

  router.get('/:id/parts', optionalAuth, async (req, res) => {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) throw sellerNotFound();
    const query = parseQuery(listQuerySchema.omit({ sellerId: true }), req);
    send(res, { data: await parts.list({ ...query, sellerId: id }, req.auth?.userId) });
  });

  return router;
}
