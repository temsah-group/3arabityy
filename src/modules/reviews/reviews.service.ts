import { Types, type QueryFilter } from 'mongoose';

import { AppError, badRequest, ErrorCode, forbidden } from '../../common/http/errors.js';
import { afterCursor, nextCursorOf } from '../../common/http/paging.js';
import type { AdminActor } from '../admin/admin-auth.js';
import type { AuditModel } from '../admin/admin.model.js';
import { VISIBLE, type PartModel } from '../parts/part.model.js';
import { OPEN_SHOP, RATING_PRIOR, type ShopModel } from '../shops/shop.model.js';
import type { UserModel } from '../users/user.model.js';
import type {
  ContactModel,
  Review,
  ReviewDocument,
  ReviewModel,
  ReviewTarget,
} from './review.model.js';

/** What happened, for the notification it causes. */
export type ReviewEvent = 'NEW' | 'REPLY';

export type ReviewNotice = (
  userId: Types.ObjectId,
  event: ReviewEvent,
  review: ReviewDocument,
  targetName: string,
) => Promise<void>;

/** The shop or part a review is about, while buyers may see it. */
type Subject = {
  target: ReviewTarget;
  id: Types.ObjectId;
  name: string;
  sellerId: Types.ObjectId;
  shopId: Types.ObjectId | null;
};

const reviewNotFound = () => new AppError(404, ErrorCode.REVIEW_NOT_FOUND, 'reviews.notFound');

/** "أحمد نبيل" → "أحمد ن.": enough to be a person, not enough to find one. */
export function shortName(fullName: string | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.length === 1 ? words[0]! : `${words[0]} ${[...words[1]!][0]}.`;
}

/**
 * Reviews of shops and parts. Only someone who called or messaged the
 * seller may write one, never the seller; the seller may answer. Each
 * review moves its shop's or part's rating.
 */
export class ReviewsService {
  constructor(
    private readonly deps: {
      reviews: ReviewModel;
      contacts: ContactModel;
      parts: PartModel;
      shops: ShopModel;
      users: UserModel;
      audit: AuditModel;
      notify: ReviewNotice;
    },
  ) {}

  // ---- Who reached whom ----

  /** [userId] called or messaged [sellerId], about [partId] if given. */
  async contacted(userId: string, sellerId: Types.ObjectId, partId?: Types.ObjectId) {
    if (sellerId.toString() === userId) return;
    await this.deps.contacts
      .updateOne(
        { userId: new Types.ObjectId(userId), sellerId },
        { $set: { lastAt: new Date() }, ...(partId ? { $addToSet: { partIds: partId } } : {}) },
        { upsert: true },
      )
      .exec();
  }

  /** The shop page's call and WhatsApp buttons. */
  async contactShop(shopId: string, viewerId?: string) {
    const subject = await this.subject('SHOP', shopId);
    if (viewerId) await this.contacted(viewerId, subject.sellerId);
  }

  // ---- Reading ----

  /**
   * A page of the reviews of a shop or part, newest first. The first page
   * also has the summary and, for a signed-in viewer, their own review and
   * whether they may write one.
   */
  async list(
    target: ReviewTarget,
    id: string,
    viewerId: string | undefined,
    cursor: string | undefined,
    limit: number,
  ) {
    const subject = await this.subject(target, id);
    const filter: QueryFilter<Review> = { target, targetId: subject.id, hiddenAt: null };
    const found = await this.deps.reviews
      .find({ ...filter, ...afterCursor('createdAt', cursor) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();
    const page = {
      items: await this.present(found.slice(0, limit), viewerId),
      nextCursor: nextCursorOf(found, limit, 'createdAt'),
    };
    if (cursor) return page;
    const [summary, mine, canReview] = await Promise.all([
      this.summary(filter),
      viewerId
        ? this.deps.reviews
            .findOne({ target, targetId: subject.id, authorId: new Types.ObjectId(viewerId) })
            .exec()
        : null,
      viewerId ? this.mayReview(viewerId, subject) : false,
    ]);
    return {
      ...page,
      summary,
      mine: mine ? (await this.present([mine], viewerId))[0]! : null,
      canReview,
    };
  }

  /** Reviews of the seller's shop and parts, newest first, for them to answer. */
  async received(userId: string, cursor: string | undefined, limit: number) {
    const found = await this.deps.reviews
      .find({
        sellerId: new Types.ObjectId(userId),
        hiddenAt: null,
        ...afterCursor('createdAt', cursor),
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();
    const items = found.slice(0, limit);
    const names = await this.targetNames(items);
    const presented = await this.present(items, userId);
    return {
      items: presented.map((review, index) => ({
        ...review,
        targetName: names.get(items[index]!.targetId.toString()) ?? '',
      })),
      nextCursor: nextCursorOf(found, limit, 'createdAt'),
    };
  }

  // ---- Writing ----

  /** Writes or changes the viewer's review; the seller hears of a new one. */
  async write(
    userId: string,
    target: ReviewTarget,
    id: string,
    input: { rating: number; text: string | null },
  ) {
    const subject = await this.subject(target, id);
    if (subject.sellerId.toString() === userId) {
      throw badRequest(ErrorCode.REVIEW_OWN, 'reviews.own');
    }
    if (!(await this.mayReview(userId, subject))) {
      throw forbidden(ErrorCode.REVIEW_NOT_ALLOWED, 'reviews.notAllowed');
    }
    const key = { target, targetId: subject.id, authorId: new Types.ObjectId(userId) };
    const before = await this.deps.reviews.findOne(key).exec();
    const review = before ?? new this.deps.reviews(key);
    review.set({
      sellerId: subject.sellerId,
      shopId: subject.shopId,
      rating: input.rating,
      text: input.text,
    });
    await review.save();
    await this.rate(target, subject.id);
    if (!before) await this.deps.notify(subject.sellerId, 'NEW', review, subject.name);
    return (await this.present([review], userId))[0]!;
  }

  async remove(userId: string, target: ReviewTarget, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw reviewNotFound();
    const targetId = new Types.ObjectId(id);
    const result = await this.deps.reviews
      .deleteOne({ target, targetId, authorId: new Types.ObjectId(userId) })
      .exec();
    if (result.deletedCount === 0) throw reviewNotFound();
    await this.rate(target, targetId);
  }

  /** The seller answers a review, or with null takes the answer back. */
  async reply(userId: string, reviewId: string, text: string | null) {
    const review = await this.find(reviewId);
    if (review.sellerId.toString() !== userId) {
      throw forbidden(ErrorCode.NOT_REVIEW_SELLER, 'reviews.notSeller');
    }
    const first = !review.reply;
    review.reply = text ? { text, at: new Date() } : null;
    await review.save();
    if (text && first) {
      const names = await this.targetNames([review]);
      await this.deps.notify(
        review.authorId,
        'REPLY',
        review,
        names.get(review.targetId.toString()) ?? '',
      );
    }
    return (await this.present([review], userId))[0]!;
  }

  // ---- For other modules ----

  /** Deleted parts take their reviews with them. */
  async partsRemoved(partIds: Types.ObjectId[]): Promise<void> {
    if (partIds.length === 0) return;
    await this.deps.reviews.deleteMany({ target: 'PART', targetId: { $in: partIds } }).exec();
  }

  /** A deleted account's reviews go, and the ratings they moved are redone. */
  async deleteAllOf(userId: string): Promise<void> {
    const user = new Types.ObjectId(userId);
    const written = await this.deps.reviews.find({ authorId: user }).exec();
    await Promise.all([
      this.deps.reviews.deleteMany({ $or: [{ authorId: user }, { sellerId: user }] }).exec(),
      this.deps.contacts.deleteMany({ $or: [{ userId: user }, { sellerId: user }] }).exec(),
    ]);
    for (const review of written) await this.rate(review.target, review.targetId);
  }

  /** Who wrote a review, for reports on it. */
  async authorOf(id: string): Promise<Types.ObjectId | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const review = await this.deps.reviews.findById(id).select('authorId').exec();
    return review?.authorId ?? null;
  }

  // ---- The dashboard ----

  async adminList(query: {
    page: number;
    pageSize: number;
    hidden?: boolean | undefined;
    target?: ReviewTarget | undefined;
    sellerId?: string | undefined;
  }) {
    const filter: QueryFilter<Review> = {};
    if (query.hidden !== undefined) filter.hiddenAt = query.hidden ? { $ne: null } : null;
    if (query.target) filter.target = query.target;
    if (query.sellerId && Types.ObjectId.isValid(query.sellerId)) {
      filter.sellerId = new Types.ObjectId(query.sellerId);
    }
    const [found, total] = await Promise.all([
      this.deps.reviews
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .exec(),
      this.deps.reviews.countDocuments(filter).exec(),
    ]);
    return {
      items: await this.presentAdmin(found),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Reviews as the dashboard shows them, by id; for reports. */
  async subjects(ids: Types.ObjectId[]): Promise<Map<string, object>> {
    if (ids.length === 0) return new Map();
    const found = await this.deps.reviews.find({ _id: { $in: ids } }).exec();
    const presented = await this.presentAdmin(found);
    return new Map(presented.map((review) => [review.id, review]));
  }

  /** Hides a review (it stops counting) or shows it again. */
  async setHidden(actor: AdminActor, id: string, hidden: boolean, note: string | null) {
    const review = await this.find(id);
    if (hidden !== (review.hiddenAt != null)) {
      review.hiddenAt = hidden ? new Date() : null;
      await review.save();
      await this.rate(review.target, review.targetId);
      await this.deps.audit.create({
        adminId: new Types.ObjectId(actor.id),
        adminEmail: actor.email,
        action: hidden ? 'REVIEW_HIDDEN' : 'REVIEW_SHOWN',
        target: 'REVIEW',
        targetId: review._id,
        note,
        changes: { hidden },
      });
    }
    return (await this.presentAdmin([review]))[0]!;
  }

  // ---- Helpers ----

  private async find(id: string): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(id)) throw reviewNotFound();
    const review = await this.deps.reviews.findById(id).exec();
    if (!review) throw reviewNotFound();
    return review;
  }

  private async subject(target: ReviewTarget, id: string): Promise<Subject> {
    if (target === 'SHOP') {
      const shop = Types.ObjectId.isValid(id)
        ? await this.deps.shops.findOne({ _id: id, ...OPEN_SHOP }).exec()
        : null;
      if (!shop) throw new AppError(404, ErrorCode.SHOP_NOT_FOUND, 'shops.notFound');
      return { target, id: shop._id, name: shop.name, sellerId: shop.ownerId, shopId: shop._id };
    }
    const part = Types.ObjectId.isValid(id)
      ? await this.deps.parts.findOne({ _id: id, ...VISIBLE }).exec()
      : null;
    if (!part) throw new AppError(404, ErrorCode.PART_NOT_FOUND, 'parts.notFound');
    return {
      target,
      id: part._id,
      name: part.name,
      sellerId: part.sellerId,
      shopId: part.shopId ?? null,
    };
  }

  /** Reached the seller: about this part, or about anything for a shop. */
  private async mayReview(userId: string, subject: Subject): Promise<boolean> {
    if (subject.sellerId.toString() === userId) return false;
    const found = await this.deps.contacts
      .exists({
        userId: new Types.ObjectId(userId),
        sellerId: subject.sellerId,
        ...(subject.target === 'PART' ? { partIds: subject.id } : {}),
      })
      .exec();
    return found != null;
  }

  private async summary(filter: QueryFilter<Review>) {
    const rows = await this.deps.reviews
      .aggregate<{ _id: number; n: number }>([
        { $match: filter },
        { $group: { _id: '$rating', n: { $sum: 1 } } },
      ])
      .exec();
    // breakdown[0] is one star.
    const breakdown = [1, 2, 3, 4, 5].map((stars) => rows.find((r) => r._id === stars)?.n ?? 0);
    const count = breakdown.reduce((sum, n) => sum + n, 0);
    const total = breakdown.reduce((sum, n, index) => sum + n * (index + 1), 0);
    return { avg: count ? round(total / count) : 0, count, breakdown };
  }

  /** Writes the rating of a shop or part from its shown reviews. */
  private async rate(target: ReviewTarget, targetId: Types.ObjectId): Promise<void> {
    const [row] = await this.deps.reviews
      .aggregate<{ sum: number; count: number }>([
        { $match: { target, targetId, hiddenAt: null } },
        { $group: { _id: null, sum: { $sum: '$rating' }, count: { $sum: 1 } } },
      ])
      .exec();
    const count = row?.count ?? 0;
    const sum = row?.sum ?? 0;
    const avg = count ? round(sum / count) : 0;
    if (target === 'PART') {
      await this.deps.parts
        .updateOne({ _id: targetId }, { $set: { rating: { avg, count } } })
        .exec();
      return;
    }
    const score = (RATING_PRIOR.mean * RATING_PRIOR.weight + sum) / (RATING_PRIOR.weight + count);
    await this.deps.shops
      .updateOne({ _id: targetId }, { $set: { rating: { avg, count, score } } })
      .exec();
  }

  private async targetNames(reviews: ReviewDocument[]): Promise<Map<string, string>> {
    const ids = (target: ReviewTarget) =>
      reviews.filter((review) => review.target === target).map((review) => review.targetId);
    const [parts, shops] = await Promise.all([
      this.deps.parts
        .find({ _id: { $in: ids('PART') } })
        .select('name')
        .exec(),
      this.deps.shops
        .find({ _id: { $in: ids('SHOP') } })
        .select('name')
        .exec(),
    ]);
    return new Map([...parts, ...shops].map((item) => [item.id as string, item.name]));
  }

  private async present(reviews: ReviewDocument[], viewerId?: string) {
    const authors = await this.deps.users
      .find({ _id: { $in: reviews.map((review) => review.authorId) } })
      .select('fullName profilePhotoUrl')
      .exec();
    const byId = new Map(authors.map((user) => [user.id as string, user]));
    return reviews.map((review) => {
      const author = byId.get(review.authorId.toString());
      return {
        id: review.id as string,
        target: review.target,
        targetId: review.targetId.toString(),
        rating: review.rating,
        text: review.text ?? null,
        author: {
          name: shortName(author?.fullName),
          photoUrl: author?.profilePhotoUrl ?? null,
        },
        reply: review.reply?.text ? { text: review.reply.text, at: review.reply.at } : null,
        mine: review.authorId.toString() === viewerId,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      };
    });
  }

  private async presentAdmin(reviews: ReviewDocument[]) {
    const people = await this.deps.users
      .find({ _id: { $in: reviews.flatMap((review) => [review.authorId, review.sellerId]) } })
      .select('fullName email')
      .exec();
    const byId = new Map(people.map((user) => [user.id as string, user]));
    const names = await this.targetNames(reviews);
    const person = (id: Types.ObjectId) => {
      const user = byId.get(id.toString());
      return user ? { id: user.id as string, fullName: user.fullName, email: user.email } : null;
    };
    return reviews.map((review) => ({
      id: review.id as string,
      target: review.target,
      targetId: review.targetId.toString(),
      targetName: names.get(review.targetId.toString()) ?? null,
      rating: review.rating,
      text: review.text ?? null,
      reply: review.reply?.text ? { text: review.reply.text, at: review.reply.at } : null,
      author: person(review.authorId),
      seller: person(review.sellerId),
      hidden: review.hiddenAt != null,
      createdAt: review.createdAt,
    }));
  }
}

const round = (value: number) => Math.round(value * 10) / 10;
