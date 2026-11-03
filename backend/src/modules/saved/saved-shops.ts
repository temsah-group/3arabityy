import { Router, type RequestHandler } from 'express';
import { Schema, Types, type Connection, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { afterCursor, nextCursorOf, pageQuerySchema } from '../../common/http/paging.js';
import { send } from '../../common/http/response.js';
import { parseBody, parseQuery } from '../../common/http/validate.js';
import type { ShopsService } from '../shops/shops.service.js';

/** A shop a user saved; the saved list is newest saved first. */
const savedShopSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    savedAt: { type: Date, default: () => new Date() },
  },
  { collection: 'saved_shops' },
);

savedShopSchema.index({ userId: 1, shopId: 1 }, { unique: true });
savedShopSchema.index({ userId: 1, savedAt: -1, _id: -1 });
savedShopSchema.index({ shopId: 1 });

export type SavedShop = InferSchemaType<typeof savedShopSchema>;
export type SavedShopModel = Model<SavedShop>;

export const createSavedShopModel = (connection: Connection): SavedShopModel =>
  connection.model<SavedShop>('SavedShop', savedShopSchema);

/** The shops a signed-in user saved, on every device they sign in on. */
export class SavedShopsService {
  constructor(
    private readonly saved: SavedShopModel,
    private readonly shops: ShopsService,
  ) {}

  /**
   * Newest saved first. A shop closed or hidden since stays saved but is
   * left out until it opens again.
   */
  async list(userId: string, cursor: string | undefined, limit: number) {
    const owner = new Types.ObjectId(userId);
    const found = await this.saved
      .find({ userId: owner, ...afterCursor('savedAt', cursor) })
      .sort({ savedAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();
    const items = await this.shops.openByIds(found.slice(0, limit).map((item) => item.shopId));
    return { items, nextCursor: nextCursorOf(found, limit, 'savedAt') };
  }

  async save(userId: string, shopId: string): Promise<void> {
    await this.shops.byId(shopId);
    await this.saved
      .updateOne(
        { userId: new Types.ObjectId(userId), shopId: new Types.ObjectId(shopId) },
        { $setOnInsert: { savedAt: new Date() } },
        { upsert: true },
      )
      .exec();
  }

  async unsave(userId: string, shopId: string): Promise<void> {
    if (!Types.ObjectId.isValid(shopId)) return;
    await this.saved
      .deleteOne({ userId: new Types.ObjectId(userId), shopId: new Types.ObjectId(shopId) })
      .exec();
  }

  /**
   * Adds shops saved on the device while signed out, oldest first, so the
   * last one is the newest saved. Shops that are not open are skipped.
   */
  async sync(userId: string, shopIds: string[]): Promise<void> {
    const ids = [...new Set(shopIds)].filter((id) => Types.ObjectId.isValid(id));
    if (ids.length === 0) return;
    const open = new Set(
      (await this.shops.openByIds(ids.map((id) => new Types.ObjectId(id)))).map((shop) => shop.id),
    );
    const kept = ids.filter((id) => open.has(id));
    if (kept.length === 0) return;
    const owner = new Types.ObjectId(userId);
    const now = Date.now();
    await this.saved.bulkWrite(
      kept.map((id, index) => ({
        updateOne: {
          filter: { userId: owner, shopId: new Types.ObjectId(id) },
          update: { $setOnInsert: { savedAt: new Date(now - (kept.length - index)) } },
          upsert: true,
        },
      })),
    );
  }

  /** A deleted shop leaves every saved list. */
  async shopRemoved(shopId: Types.ObjectId): Promise<void> {
    await this.saved.deleteMany({ shopId }).exec();
  }

  async deleteAllOf(userId: string): Promise<void> {
    await this.saved.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }
}

const syncSchema = z.strictObject({
  shopIds: z.array(z.string().max(64), 'validation.required').max(200, 'validation.required'),
});

/** `/users/me/saved-shops`: the signed-in user's saved shops. */
export function savedShopsRoutes(saved: SavedShopsService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);
  const user = (req: { auth?: { userId: string } }) => req.auth!.userId;

  router.get('/', async (req, res) => {
    const { cursor, limit } = parseQuery(pageQuerySchema, req);
    send(res, { data: await saved.list(user(req), cursor, limit) });
  });

  router.post('/sync', async (req, res) => {
    await saved.sync(user(req), parseBody(syncSchema, req).shopIds);
    res.status(204).end();
  });

  router.put('/:shopId', async (req, res) => {
    await saved.save(user(req), req.params.shopId as string);
    res.status(204).end();
  });

  router.delete('/:shopId', async (req, res) => {
    await saved.unsave(user(req), req.params.shopId as string);
    res.status(204).end();
  });

  return router;
}
