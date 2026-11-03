import { Types } from 'mongoose';

import { afterCursor, nextCursorOf } from '../../common/http/paging.js';
import type { PartModel } from '../parts/part.model.js';
import type { PartsService } from '../parts/parts.service.js';
import type { SavedPartModel } from './saved.model.js';

/** The parts a signed-in user saved, on every device they sign in on. */
export class SavedService {
  constructor(
    private readonly saved: SavedPartModel,
    private readonly partModel: PartModel,
    private readonly parts: PartsService,
  ) {}

  /** Newest saved first; sold parts stay, marked sold. */
  async list(userId: string, cursor: string | undefined, limit: number) {
    const owner = new Types.ObjectId(userId);
    const found = await this.saved
      .find({ userId: owner, ...afterCursor('savedAt', cursor) })
      .sort({ savedAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();
    const items = await this.parts.presentIds(
      found.slice(0, limit).map((item) => item.partId),
      userId,
    );
    const nextCursor = nextCursorOf(found, limit, 'savedAt');
    if (cursor) return { items, nextCursor };
    return { items, nextCursor, total: await this.saved.countDocuments({ userId: owner }).exec() };
  }

  async save(userId: string, partId: string): Promise<void> {
    await this.parts.assertExists(partId);
    await this.saved
      .updateOne(
        { userId: new Types.ObjectId(userId), partId: new Types.ObjectId(partId) },
        { $setOnInsert: { savedAt: new Date() } },
        { upsert: true },
      )
      .exec();
  }

  async unsave(userId: string, partId: string): Promise<void> {
    if (!Types.ObjectId.isValid(partId)) return;
    await this.saved
      .deleteOne({ userId: new Types.ObjectId(userId), partId: new Types.ObjectId(partId) })
      .exec();
  }

  /**
   * Adds parts saved on the device while signed out, oldest first, so the
   * last one is the newest saved. Ids of parts that are gone are skipped.
   */
  async sync(userId: string, partIds: string[]): Promise<void> {
    const ids = [...new Set(partIds)].filter((id) => Types.ObjectId.isValid(id));
    if (ids.length === 0) return;
    const existing = new Set(
      (
        await this.partModel
          .find({ _id: { $in: ids } })
          .select('_id')
          .exec()
      ).map((part) => part.id as string),
    );
    const owner = new Types.ObjectId(userId);
    const now = Date.now();
    const kept = ids.filter((id) => existing.has(id));
    if (kept.length === 0) return;
    await this.saved.bulkWrite(
      kept.map((id, index) => ({
        updateOne: {
          filter: { userId: owner, partId: new Types.ObjectId(id) },
          update: { $setOnInsert: { savedAt: new Date(now - (kept.length - index)) } },
          upsert: true,
        },
      })),
    );
  }

  async partsRemoved(partIds: Types.ObjectId[]): Promise<void> {
    if (partIds.length === 0) return;
    await this.saved.deleteMany({ partId: { $in: partIds } }).exec();
  }

  async deleteAllOf(userId: string): Promise<void> {
    await this.saved.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }
}
