import { Types, type QueryFilter } from 'mongoose';

import { AppError, badRequest, ErrorCode, forbidden } from '../../common/http/errors.js';
import { normalizeSearchText, searchableText } from '../catalog/catalog.js';
import type { PhotoStorage } from '../users/photo-storage.js';
import type { UserModel } from '../users/user.model.js';
import type { Part, PartDocument, PartModel } from './part.model.js';
import { presentPart, type PublicPart, type SellerSummary } from './part.presenter.js';
import {
  MAX_PART_PHOTOS,
  type CarQuery,
  type CreatePartInput,
  type FeaturedQuery,
  type ListQuery,
  type UpdatePartInput,
} from './parts.schemas.js';
import type { UploadModel } from './upload.model.js';

type Page = { items: PublicPart[]; nextCursor: string | null; total?: number };

const SORTS = {
  NEWEST: { field: 'listedAt', direction: -1 },
  PRICE_LOW: { field: 'price', direction: 1 },
  PRICE_HIGH: { field: 'price', direction: -1 },
} as const;

const notFound = () => new AppError(404, ErrorCode.PART_NOT_FOUND, 'parts.notFound');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Listings: search, the seller's own parts and what they do to them. */
export class PartsService {
  constructor(
    private readonly parts: PartModel,
    private readonly uploads: UploadModel,
    private readonly users: UserModel,
    private readonly photos: PhotoStorage,
  ) {}

  // ---- Reading ----

  async list(query: ListQuery, viewerId?: string): Promise<Page & { facets?: object }> {
    const filter = this.searchFilter(query);
    const page = await this.page(filter, query.sort, query.cursor, query.limit, viewerId);
    if (query.cursor) return page;
    const [total, facets] = await Promise.all([
      this.parts.countDocuments(filter).exec(),
      this.facets(),
    ]);
    return { ...page, total, facets };
  }

  async featured(query: FeaturedQuery, viewerId?: string): Promise<{ items: PublicPart[] }> {
    const filter: QueryFilter<Part> = { isSold: false, isFeatured: true };
    if (query.condition) filter.condition = query.condition;
    if (query.cars) Object.assign(filter, fitsAny(query.cars));
    const found = await this.parts.find(filter).sort({ listedAt: -1 }).limit(query.limit).exec();
    return { items: await this.present(found, viewerId) };
  }

  async mine(userId: string, cursor: string | undefined, limit: number): Promise<Page> {
    return this.page({ sellerId: new Types.ObjectId(userId) }, 'NEWEST', cursor, limit, userId);
  }

  /** One part, sold or not; a buyer's visit counts as a view. */
  async byId(id: string, viewerId?: string): Promise<PublicPart> {
    const part = await this.find(id);
    if (part.sellerId.toString() !== viewerId) {
      await this.parts.updateOne({ _id: part._id }, { $inc: { 'stats.views': 1 } }).exec();
      if (part.stats) part.stats.views += 1;
    }
    return (await this.present([part], viewerId))[0]!;
  }

  /** Same category or same models, best matches first; never itself or sold. */
  async similar(id: string, limit: number, viewerId?: string): Promise<{ items: PublicPart[] }> {
    const part = await this.find(id);
    const cars = part.fitments.map((f) => ({ brandId: f.brandId, modelId: f.modelId }));
    const candidates = await this.parts
      .find({
        _id: { $ne: part._id },
        isSold: false,
        $or: [
          { category: part.category },
          ...cars.map((car) => ({ fitments: { $elemMatch: car } })),
        ],
      })
      .sort({ listedAt: -1 })
      .limit(60)
      .exec();
    const sharesCar = (other: PartDocument) =>
      other.fitments.some((a) =>
        cars.some((b) => a.brandId === b.brandId && a.modelId === b.modelId),
      );
    const rank = (other: PartDocument) =>
      (other.category === part.category ? 2 : 0) + (sharesCar(other) ? 1 : 0);
    const ranked = candidates
      .map((other, index) => ({ other, index, score: rank(other) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, limit)
      .map((entry) => entry.other);
    return { items: await this.present(ranked, viewerId) };
  }

  // ---- The seller's own parts ----

  async uploadPhoto(userId: string, bytes: Buffer, extension: string): Promise<string> {
    const path = await this.photos.save('parts', bytes, extension);
    await this.uploads.create({ path, ownerId: new Types.ObjectId(userId) });
    return path;
  }

  async create(userId: string, input: CreatePartInput): Promise<PublicPart> {
    await this.assertPhotos(userId, input.images, []);
    const seller = await this.users.findById(userId).exec();
    const part = await this.parts.create({
      ...input,
      oldPrice: input.oldPrice ?? null,
      sellerId: new Types.ObjectId(userId),
      listedAt: new Date(),
      searchText: searchableText({ ...input, sellerName: seller?.fullName }),
    });
    await this.claimPhotos(userId, part);
    return (await this.present([part], userId))[0]!;
  }

  async update(userId: string, id: string, input: UpdatePartInput): Promise<PublicPart> {
    const part = await this.owned(userId, id);
    const before = [...part.images];
    if (input.images) await this.assertPhotos(userId, input.images, before);
    if (input.oldPrice !== undefined || input.price !== undefined) {
      const price = input.price ?? part.price;
      const oldPrice = input.oldPrice === undefined ? part.oldPrice : input.oldPrice;
      if (oldPrice != null && oldPrice <= price) {
        throw badRequest(ErrorCode.VALIDATION_FAILED, 'validation.oldPrice');
      }
    }
    part.set({
      ...input,
      ...(input.oldPrice === undefined ? {} : { oldPrice: input.oldPrice ?? null }),
    });
    const seller = await this.users.findById(userId).exec();
    part.set(
      'searchText',
      searchableText({
        name: part.name,
        partNumber: part.partNumber,
        category: part.category,
        city: part.city,
        sellerName: seller?.fullName,
        fitments: part.fitments,
      }),
    );
    await part.save();
    await this.claimPhotos(userId, part);
    // Photos taken off the listing are deleted.
    await this.dropPhotos(before.filter((path) => !part.images.includes(path)));
    return (await this.present([part], userId))[0]!;
  }

  async remove(userId: string, id: string): Promise<void> {
    const part = await this.owned(userId, id);
    await part.deleteOne();
    await this.dropPhotos(part.images);
  }

  async setSold(userId: string, id: string, sold: boolean): Promise<PublicPart> {
    const part = await this.owned(userId, id);
    part.isSold = sold;
    await part.save();
    return (await this.present([part], userId))[0]!;
  }

  /** Still for sale: back to the top of "latest". */
  async renew(userId: string, id: string): Promise<PublicPart> {
    const part = await this.owned(userId, id);
    part.isSold = false;
    part.listedAt = new Date();
    await part.save();
    return (await this.present([part], userId))[0]!;
  }

  /** A buyer called or messaged about it; the seller's own taps do not count. */
  async contact(id: string, channel: 'CALL' | 'WHATSAPP', viewerId?: string): Promise<void> {
    const part = await this.find(id);
    if (part.sellerId.toString() === viewerId) return;
    const field = channel === 'CALL' ? 'stats.calls' : 'stats.whatsapps';
    await this.parts.updateOne({ _id: part._id }, { $inc: { [field]: 1 } }).exec();
  }

  /** Everything a deleted account listed or uploaded goes with it. */
  async deleteAllOf(userId: string): Promise<void> {
    const owner = new Types.ObjectId(userId);
    const [parts, uploads] = await Promise.all([
      this.parts.find({ sellerId: owner }).exec(),
      this.uploads.find({ ownerId: owner }).exec(),
    ]);
    await this.parts.deleteMany({ sellerId: owner }).exec();
    await this.dropPhotos([...parts.flatMap((part) => part.images), ...uploads.map((u) => u.path)]);
  }

  // ---- Helpers ----

  private async find(id: string): Promise<PartDocument> {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const part = await this.parts.findById(id).exec();
    if (!part) throw notFound();
    return part;
  }

  private async owned(userId: string, id: string): Promise<PartDocument> {
    const part = await this.find(id);
    if (part.sellerId.toString() !== userId) {
      throw forbidden(ErrorCode.NOT_PART_OWNER, 'parts.notOwner');
    }
    return part;
  }

  /** Server photos must be the caller's uploads, or already on the part. */
  private async assertPhotos(userId: string, images: string[], current: string[]): Promise<void> {
    if (images.length > MAX_PART_PHOTOS) {
      throw badRequest(ErrorCode.TOO_MANY_PHOTOS, 'parts.tooManyPhotos', [MAX_PART_PHOTOS]);
    }
    const added = images.filter((path) => path.startsWith('/uploads/') && !current.includes(path));
    if (added.length === 0) return;
    const owned = await this.uploads
      .countDocuments({ path: { $in: added }, ownerId: new Types.ObjectId(userId) })
      .exec();
    if (owned !== new Set(added).size) {
      throw badRequest(ErrorCode.UPLOAD_NOT_OWNED, 'parts.uploadNotOwned');
    }
  }

  private async claimPhotos(userId: string, part: PartDocument): Promise<void> {
    await this.uploads
      .updateMany(
        { path: { $in: part.images }, ownerId: new Types.ObjectId(userId) },
        { $set: { partId: part._id } },
      )
      .exec();
  }

  private async dropPhotos(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await Promise.all(paths.map((path) => this.photos.remove(path)));
    await this.uploads.deleteMany({ path: { $in: paths } }).exec();
  }

  private searchFilter(query: ListQuery): QueryFilter<Part> {
    const filter: QueryFilter<Part> = { isSold: false };
    const words = normalizeSearchText(query.q ?? '')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length) {
      filter.$and = words.map((word) => ({ searchText: { $regex: escapeRegex(word) } }));
    }
    if (query.category) filter.category = query.category;
    if (query.condition) filter.condition = query.condition;
    if (query.origin) filter.isOriginal = query.origin === 'ORIGINAL';
    if (query.city) filter.city = query.city;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }
    if (query.cars) Object.assign(filter, fitsAny(query.cars));
    if (query.sellerId) filter.sellerId = new Types.ObjectId(query.sellerId);
    return filter;
  }

  /** Cities with parts and the highest price, for the filter sheet. */
  private async facets(): Promise<{ cities: string[]; maxPrice: number }> {
    const [cities, top] = await Promise.all([
      this.parts.distinct('city', { isSold: false }).exec(),
      this.parts.findOne({ isSold: false }).sort({ price: -1 }).select('price').exec(),
    ]);
    return { cities: (cities as string[]).sort(), maxPrice: top?.price ?? 0 };
  }

  private async page(
    filter: QueryFilter<Part>,
    sortName: keyof typeof SORTS,
    cursor: string | undefined,
    limit: number,
    viewerId?: string,
  ): Promise<Page> {
    const { field, direction } = SORTS[sortName];
    const query: QueryFilter<Part> = { ...filter };
    const after = decodeCursor(cursor, field);
    if (after) {
      const op = direction === -1 ? '$lt' : '$gt';
      query.$or = [
        { [field]: { [op]: after.value } },
        { [field]: after.value, _id: { [op]: after.id } },
      ];
    }
    const found = await this.parts
      .find(query)
      .sort({ [field]: direction, _id: direction })
      .limit(limit + 1)
      .exec();
    const items = found.slice(0, limit);
    const last = items.at(-1);
    const nextCursor =
      found.length > limit && last
        ? encodeCursor(last.get(field) as Date | number, last.id as string)
        : null;
    return { items: await this.present(items, viewerId), nextCursor };
  }

  /** Presents parts with their sellers, read in one query. */
  private async present(parts: PartDocument[], viewerId?: string): Promise<PublicPart[]> {
    const ids = [...new Set(parts.map((part) => part.sellerId.toString()))];
    const sellers = await this.users
      .find({ _id: { $in: ids } })
      .select('fullName profilePhotoUrl isVerifiedSeller')
      .exec();
    const byId = new Map<string, SellerSummary>(
      sellers.map((user) => [
        user.id as string,
        {
          id: user.id as string,
          fullName: user.fullName,
          profilePhotoUrl: user.profilePhotoUrl,
          isVerifiedSeller: user.isVerifiedSeller,
        },
      ]),
    );
    return parts.map((part) => presentPart(part, byId.get(part.sellerId.toString()), viewerId));
  }
}

/** Fits any of [cars]: one of its fitments covers the car's make, model and year. */
function fitsAny(cars: CarQuery): QueryFilter<Part> {
  return {
    $or: cars.map((car) => ({
      fitments: {
        $elemMatch: {
          brandId: car.brandId,
          modelId: car.modelId,
          fromYear: { $lte: car.year },
          toYear: { $gte: car.year },
        },
      },
    })),
  };
}

function encodeCursor(value: Date | number, id: string): string {
  const v = value instanceof Date ? value.toISOString() : value;
  return Buffer.from(JSON.stringify({ v, id })).toString('base64url');
}

function decodeCursor(
  cursor: string | undefined,
  field: string,
): { value: Date | number; id: Types.ObjectId } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
      v: unknown;
      id: unknown;
    };
    if (typeof parsed.id !== 'string' || !Types.ObjectId.isValid(parsed.id)) throw new Error();
    const value = field === 'listedAt' ? new Date(String(parsed.v)) : Number(parsed.v);
    if (value instanceof Date ? Number.isNaN(value.getTime()) : !Number.isFinite(value))
      throw new Error();
    return { value, id: new Types.ObjectId(parsed.id) };
  } catch {
    throw badRequest(ErrorCode.VALIDATION_FAILED, 'validation.query');
  }
}
