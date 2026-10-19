import { Types, type QueryFilter } from 'mongoose';

import { AppError, badRequest, conflict, ErrorCode, forbidden } from '../../common/http/errors.js';
import type { AdminActor } from '../admin/admin-auth.js';
import type { AuditModel } from '../admin/admin.model.js';
import type { ShopChange } from '../notifications/notifications.service.js';
import { VISIBLE, type PartModel } from '../parts/part.model.js';
import type { PhotoStorage } from '../users/photo-storage.js';
import { AccountStatus, type UserModel } from '../users/user.model.js';
import { OPEN_SHOP, type Shop, type ShopDocument, type ShopModel } from './shop.model.js';
import type {
  AdminShopsQuery,
  AdminShopUpdate,
  ShopInput,
  ShopsQuery,
  ShopUpdate,
} from './shops.schemas.js';

/** How many shops the home screen shows. */
const HOME_SHOPS = 10;

const shopNotFound = () => new AppError(404, ErrorCode.SHOP_NOT_FOUND, 'shops.notFound');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What a part shows of the shop it is sold by. */
export type ShopSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  rating: { avg: number; count: number };
  delivers: boolean;
};

export const summaryOf = (shop: ShopDocument): ShopSummary => ({
  id: shop.id as string,
  name: shop.name,
  logoUrl: shop.logoUrl ?? null,
  verified: shop.isVerified,
  rating: { avg: shop.rating?.avg ?? 0, count: shop.rating?.count ?? 0 },
  delivers: shop.delivery?.available ?? false,
});

/** The shop as buyers see it. */
function presentShop(shop: ShopDocument, partsCount: number) {
  return {
    ...summaryOf(shop),
    ownerId: shop.ownerId.toString(),
    description: shop.description ?? null,
    coverUrl: shop.coverUrl ?? null,
    phone: shop.phone,
    whatsapp: shop.whatsapp ?? null,
    city: shop.city,
    address: shop.address,
    location: shop.location ? { lat: shop.location.lat, lng: shop.location.lng } : null,
    hours: shop.hours ?? null,
    brandIds: shop.brandIds,
    categories: shop.categories,
    delivery: {
      available: shop.delivery?.available ?? false,
      governorates: shop.delivery?.governorates ?? [],
      feeFrom: shop.delivery?.feeFrom ?? null,
      feeTo: shop.delivery?.feeTo ?? null,
      eta: shop.delivery?.eta ?? null,
      note: shop.delivery?.note ?? null,
    },
    featured: shop.isFeatured,
    partsCount,
    createdAt: shop.createdAt,
  };
}

/** The owner's own view: the shop plus where its application stands. */
function presentOwn(shop: ShopDocument, partsCount: number) {
  return {
    ...presentShop(shop, partsCount),
    status: shop.status,
    statusReason: shop.statusReason ?? null,
    hidden: shop.hiddenAt != null,
  };
}

/**
 * Shops: an owner applies, 3arabity approves, and from then on every part
 * the owner lists shows under the shop. Buyers browse approved shops.
 */
export class ShopsService {
  constructor(
    private readonly deps: {
      shops: ShopModel;
      parts: PartModel;
      users: UserModel;
      audit: AuditModel;
      photos: PhotoStorage;
      notify: (ownerId: Types.ObjectId, change: ShopChange, shop: ShopDocument) => Promise<void>;
      /** A deleted shop: notifications that open it go. */
      removed?: (shopId: Types.ObjectId) => Promise<void>;
    },
  ) {}

  // ---- Buyers ----

  async list(query: ShopsQuery) {
    const filter: QueryFilter<Shop> = { ...OPEN_SHOP };
    if (query.q) filter.name = { $regex: escapeRegex(query.q), $options: 'i' };
    if (query.city) filter.city = query.city;
    if (query.deliversTo) {
      filter['delivery.available'] = true;
      filter['delivery.governorates'] = query.deliversTo;
    }
    if (query.brandId) filter.brandIds = query.brandId;
    const offset = offsetOf(query.cursor);
    const sort: Record<string, -1> =
      query.sort === 'NEWEST'
        ? { approvedAt: -1, _id: -1 }
        : { isFeatured: -1, 'rating.score': -1, approvedAt: -1, _id: -1 };
    const found = await this.deps.shops
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(query.limit + 1)
      .exec();
    const items = found.slice(0, query.limit);
    return {
      items: await this.presentMany(items),
      nextCursor: found.length > query.limit ? String(offset + query.limit) : null,
      ...(query.cursor ? {} : { total: await this.deps.shops.countDocuments(filter).exec() }),
    };
  }

  /** The home screen's row: featured shops first, then the best rated. */
  async home() {
    const found = await this.deps.shops
      .find(OPEN_SHOP)
      .sort({ isFeatured: -1, 'rating.score': -1, approvedAt: -1, _id: -1 })
      .limit(HOME_SHOPS)
      .exec();
    return this.presentMany(found);
  }

  async byId(id: string) {
    const shop = await this.find(id);
    if (shop.status !== 'APPROVED' || shop.hiddenAt) throw shopNotFound();
    return (await this.presentMany([shop]))[0]!;
  }

  /** The owner of an open shop, for its parts list. */
  async openOwner(id: string): Promise<string> {
    const shop = await this.find(id);
    if (shop.status !== 'APPROVED' || shop.hiddenAt) throw shopNotFound();
    return shop.ownerId.toString();
  }

  // ---- The owner ----

  async apply(userId: string, input: ShopInput) {
    const ownerId = new Types.ObjectId(userId);
    if (await this.deps.shops.exists({ ownerId })) {
      throw conflict(ErrorCode.SHOP_EXISTS, 'shops.exists');
    }
    try {
      const shop = await this.deps.shops.create({ ...input, ownerId, status: 'PENDING' });
      return presentOwn(shop, 0);
    } catch (error) {
      // Two applications at once.
      if ((error as { code?: number }).code === 11000) {
        throw conflict(ErrorCode.SHOP_EXISTS, 'shops.exists');
      }
      throw error;
    }
  }

  /** Null when the user has no shop. */
  async mine(userId: string) {
    const shop = await this.deps.shops.findOne({ ownerId: new Types.ObjectId(userId) }).exec();
    return shop ? presentOwn(shop, await this.countParts(shop)) : null;
  }

  /** Edits the shop; a rejected one goes back for review. */
  async update(userId: string, input: ShopUpdate) {
    const shop = await this.own(userId);
    shop.set(input);
    if (shop.status === 'REJECTED') {
      shop.status = 'PENDING';
      shop.statusReason = null;
    }
    await shop.save();
    return presentOwn(shop, await this.countParts(shop));
  }

  async setPhoto(userId: string, kind: 'logo' | 'cover', bytes: Buffer, extension: string) {
    const shop = await this.own(userId);
    const field = kind === 'logo' ? 'logoUrl' : 'coverUrl';
    const before = shop[field];
    shop[field] = await this.deps.photos.save('shops', bytes, extension);
    await shop.save();
    await this.deps.photos.remove(before);
    return presentOwn(shop, await this.countParts(shop));
  }

  async removePhoto(userId: string, kind: 'logo' | 'cover') {
    const shop = await this.own(userId);
    const field = kind === 'logo' ? 'logoUrl' : 'coverUrl';
    const before = shop[field];
    shop[field] = null;
    await shop.save();
    await this.deps.photos.remove(before);
    return presentOwn(shop, await this.countParts(shop));
  }

  // ---- For other modules ----

  /** The approved shop [userId] owns, which new parts go under; else null. */
  async approvedShopOf(userId: string): Promise<Types.ObjectId | null> {
    const shop = await this.deps.shops
      .findOne({ ownerId: new Types.ObjectId(userId), status: 'APPROVED' })
      .select('_id')
      .exec();
    return shop?._id ?? null;
  }

  /** Open shops by id, for the parts they sell. */
  async summaries(ids: Types.ObjectId[]): Promise<Map<string, ShopSummary>> {
    if (ids.length === 0) return new Map();
    const found = await this.deps.shops.find({ _id: { $in: ids }, ...OPEN_SHOP }).exec();
    return new Map(found.map((shop) => [shop.id as string, summaryOf(shop)]));
  }

  /** The open shop of [userId], for their seller page; else null. */
  async openShopIdOf(userId: string): Promise<string | null> {
    const shop = await this.deps.shops
      .findOne({ ownerId: new Types.ObjectId(userId), ...OPEN_SHOP })
      .select('_id')
      .exec();
    return shop ? (shop.id as string) : null;
  }

  /** The owner's suspension hides the shop; restoring the account shows it again. */
  async ownerSuspended(userId: string, suspended: boolean): Promise<void> {
    await this.deps.shops
      .updateOne(
        { ownerId: new Types.ObjectId(userId) },
        { $set: { hiddenAt: suspended ? new Date() : null } },
      )
      .exec();
  }

  async deleteAllOf(userId: string): Promise<void> {
    const shop = await this.deps.shops.findOne({ ownerId: new Types.ObjectId(userId) }).exec();
    if (!shop) return;
    await shop.deleteOne();
    await this.deps.removed?.(shop._id);
    await Promise.all([
      this.deps.photos.remove(shop.logoUrl),
      this.deps.photos.remove(shop.coverUrl),
    ]);
  }

  // ---- The dashboard ----

  async adminList(query: AdminShopsQuery) {
    const filter: QueryFilter<Shop> = {};
    if (query.status) filter.status = query.status;
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ name: pattern }, { phone: pattern }, { city: pattern }];
    }
    const [found, total, counts] = await Promise.all([
      this.deps.shops
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .exec(),
      this.deps.shops.countDocuments(filter).exec(),
      this.deps.shops
        .aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }])
        .exec(),
    ]);
    const owners = await this.owners(found);
    const parts = await this.partsCounts(found);
    return {
      items: found.map((shop) => this.presentAdmin(shop, owners, parts)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      counts: Object.fromEntries(counts.map((row) => [row._id, row.n])),
    };
  }

  async adminShop(id: string) {
    const shop = await this.find(id);
    const [owners, parts, history] = await Promise.all([
      this.owners([shop]),
      this.partsCounts([shop]),
      this.deps.audit.find({ targetId: shop._id }).sort({ createdAt: -1 }).limit(50).exec(),
    ]);
    return {
      ...this.presentAdmin(shop, owners, parts),
      history: history.map((entry) => ({
        id: entry.id as string,
        action: entry.action,
        adminEmail: entry.adminEmail,
        note: entry.note ?? null,
        changes: entry.changes ?? null,
        createdAt: entry.createdAt,
      })),
    };
  }

  /**
   * Approves, rejects or suspends a shop (telling its owner), or features
   * or verifies it (owners only). Rejecting and suspending need a reason,
   * which the owner sees. Approving brings the owner's parts under it.
   */
  async adminUpdate(actor: AdminActor, id: string, input: AdminShopUpdate) {
    const shop = await this.find(id);
    const changes: Record<string, unknown> = {};
    let notice: ShopChange | null = null;

    for (const [flag, field] of [
      ['featured', 'isFeatured'],
      ['verified', 'isVerified'],
    ] as const) {
      const value = input[flag];
      if (value === undefined || value === shop[field]) continue;
      if (actor.role !== 'OWNER') {
        throw forbidden(ErrorCode.ADMIN_ROLE_REQUIRED, 'admin.roleRequired');
      }
      shop[field] = value;
      changes[field] = value;
    }

    if (input.status && input.status !== shop.status) {
      if (input.status !== 'APPROVED' && !input.note) {
        throw badRequest(ErrorCode.NOTE_REQUIRED, 'admin.noteRequired');
      }
      // A suspended shop comes back with "restored"; a pending one is "approved".
      notice =
        input.status === 'APPROVED'
          ? shop.status === 'SUSPENDED'
            ? 'RESTORED'
            : 'APPROVED'
          : input.status;
      changes.status = input.status;
      shop.status = input.status;
      shop.statusReason = input.status === 'APPROVED' ? null : input.note;
      if (input.status === 'APPROVED' && !shop.approvedAt) shop.approvedAt = new Date();
    }
    if (Object.keys(changes).length === 0) return this.adminShop(id);

    await shop.save();
    if (changes.status === 'APPROVED') {
      // Everything the owner already lists is now the shop's.
      await this.deps.parts
        .updateMany({ sellerId: shop.ownerId }, { $set: { shopId: shop._id } })
        .exec();
    }
    if (notice) await this.deps.notify(shop.ownerId, notice, shop);
    await this.deps.audit.create({
      adminId: new Types.ObjectId(actor.id),
      adminEmail: actor.email,
      action: changes.status
        ? `SHOP_${notice}`
        : changes.isFeatured !== undefined
          ? changes.isFeatured
            ? 'SHOP_FEATURED'
            : 'SHOP_UNFEATURED'
          : changes.isVerified
            ? 'SHOP_VERIFIED'
            : 'SHOP_UNVERIFIED',
      target: 'SHOP',
      targetId: shop._id,
      note: input.note ?? null,
      changes,
    });
    return this.adminShop(id);
  }

  // ---- Helpers ----

  private async find(id: string): Promise<ShopDocument> {
    if (!Types.ObjectId.isValid(id)) throw shopNotFound();
    const shop = await this.deps.shops.findById(id).exec();
    if (!shop) throw shopNotFound();
    return shop;
  }

  private async own(userId: string): Promise<ShopDocument> {
    const shop = await this.deps.shops.findOne({ ownerId: new Types.ObjectId(userId) }).exec();
    if (!shop) throw shopNotFound();
    if (shop.status === 'SUSPENDED') {
      throw forbidden(ErrorCode.SHOP_SUSPENDED, 'shops.suspended');
    }
    return shop;
  }

  private async presentMany(shops: ShopDocument[]) {
    const counts = await this.partsCounts(shops);
    return shops.map((shop) => presentShop(shop, counts.get(shop.ownerId.toString()) ?? 0));
  }

  private async countParts(shop: ShopDocument): Promise<number> {
    return (await this.partsCounts([shop])).get(shop.ownerId.toString()) ?? 0;
  }

  /** Parts for sale per owner. */
  private async partsCounts(shops: ShopDocument[]): Promise<Map<string, number>> {
    if (shops.length === 0) return new Map();
    const rows = await this.deps.parts
      .aggregate<{ _id: Types.ObjectId; n: number }>([
        {
          $match: {
            sellerId: { $in: shops.map((shop) => shop.ownerId) },
            ...VISIBLE,
            isSold: false,
          },
        },
        { $group: { _id: '$sellerId', n: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id.toString(), row.n]));
  }

  private async owners(shops: ShopDocument[]) {
    const found = await this.deps.users
      .find({ _id: { $in: shops.map((shop) => shop.ownerId) } })
      .select('fullName email phone accountStatus')
      .exec();
    return new Map(found.map((user) => [user.id as string, user]));
  }

  private presentAdmin(
    shop: ShopDocument,
    owners: Awaited<ReturnType<ShopsService['owners']>>,
    parts: Map<string, number>,
  ) {
    const owner = owners.get(shop.ownerId.toString());
    return {
      ...presentOwn(shop, parts.get(shop.ownerId.toString()) ?? 0),
      updatedAt: shop.updatedAt,
      approvedAt: shop.approvedAt ?? null,
      owner: owner
        ? {
            id: owner.id as string,
            fullName: owner.fullName,
            email: owner.email,
            phone: owner.phone,
            suspended: owner.accountStatus === AccountStatus.SUSPENDED,
          }
        : null,
    };
  }
}

/** Shop lists page by position: the cursor is how many came before. */
function offsetOf(cursor: string | undefined): number {
  if (!cursor) return 0;
  const offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) {
    throw badRequest(ErrorCode.VALIDATION_FAILED, 'validation.query');
  }
  return offset;
}
