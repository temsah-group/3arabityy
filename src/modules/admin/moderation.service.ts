import { Types, type PipelineStage, type QueryFilter } from 'mongoose';

import { AppError, badRequest, ErrorCode, forbidden } from '../../common/http/errors.js';
import type { SessionsService } from '../auth/sessions.service.js';
import { carBrands, normalizeSearchText } from '../catalog/catalog.js';
import type {
  ListingChange,
  NotificationsService,
} from '../notifications/notifications.service.js';
import type { Part, PartDocument, PartModel } from '../parts/part.model.js';
import { presentPart } from '../parts/part.presenter.js';
import type { PartsService } from '../parts/parts.service.js';
import type { ReportAction, ReportModel, ReportTarget } from '../reports/reports.js';
import {
  AccountStatus,
  type User,
  type UserDocument,
  type UserModel,
} from '../users/user.model.js';
import type { AdminActor } from './admin-auth.js';
import type { AuditModel } from './admin.model.js';
import type {
  AuditQuery,
  PartsQuery,
  PartUpdate,
  ReportsQuery,
  Resolution,
  UsersQuery,
  UserUpdate,
} from './admin.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days are counted in Egypt's time, so a day starts at midnight in Cairo. */
const TIMEZONE = 'Africa/Cairo';

/** `YYYY-MM-DD` of [date] in Cairo. */
const cairoDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const partNotFound = () => new AppError(404, ErrorCode.PART_NOT_FOUND, 'parts.notFound');
const userNotFound = () => new AppError(404, ErrorCode.USER_NOT_FOUND, 'admin.userNotFound');

const objectId = (id: string, missing: () => AppError) => {
  if (!Types.ObjectId.isValid(id)) throw missing();
  return new Types.ObjectId(id);
};

/** A page of an admin table: offset paging, since tables jump to page N. */
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

const pageOf = <T>(items: T[], total: number, query: { page: number; pageSize: number }) => ({
  items,
  total,
  page: query.page,
  pageSize: query.pageSize,
});

const skipOf = (query: { page: number; pageSize: number }) => (query.page - 1) * query.pageSize;

/** What admins need to see of an account. */
function presentAccount(user: UserDocument) {
  return {
    id: user.id as string,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    profilePhotoUrl: user.profilePhotoUrl ?? null,
    accountStatus: user.accountStatus,
    isVerifiedSeller: user.isVerifiedSeller ?? false,
    emailVerified: user.emailVerifiedAt != null,
    createdAt: user.createdAt,
  };
}

/**
 * Everything the dashboard does to the app's data: reviewing reports,
 * suspending accounts, verifying sellers and moderating listings. Every
 * change is written to the audit log with the admin and their reason.
 */
export class ModerationService {
  constructor(
    private readonly deps: {
      users: UserModel;
      parts: PartModel;
      reports: ReportModel;
      audit: AuditModel;
      partsService: PartsService;
      sessions: SessionsService;
      notifications: NotificationsService;
      /** Hides or shows the account's shop with its suspension. */
      ownerSuspended?: (userId: string, suspended: boolean) => Promise<void>;
    },
  ) {}

  // ---- Overview ----

  async overview() {
    const { users, parts, reports } = this.deps;
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [
      usersTotal,
      usersThisWeek,
      suspended,
      verifiedSellers,
      partsForSale,
      partsThisWeek,
      partsHidden,
      openTargets,
    ] = await Promise.all([
      users.countDocuments().exec(),
      users.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      users.countDocuments({ accountStatus: AccountStatus.SUSPENDED }).exec(),
      users.countDocuments({ isVerifiedSeller: true }).exec(),
      parts.countDocuments({ isSold: false, hiddenAt: null }).exec(),
      parts.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      parts.countDocuments({ hiddenAt: { $ne: null } }).exec(),
      reports
        .aggregate<{ n: number }>([
          { $match: { status: 'OPEN' } },
          { $group: { _id: { target: '$target', targetId: '$targetId' } } },
          { $count: 'n' },
        ])
        .exec(),
    ]);
    return {
      users: { total: usersTotal, thisWeek: usersThisWeek, suspended, verifiedSellers },
      parts: { forSale: partsForSale, thisWeek: partsThisWeek, hidden: partsHidden },
      reports: { openTargets: openTargets[0]?.n ?? 0 },
    };
  }

  /**
   * How 3arabity is doing over the last [days]: sign-ups and new parts per
   * day, and, over every part for sale, where buyers look and reach out.
   * Views, calls and WhatsApp messages are kept per part, not per day, so
   * those are totals since each part went up.
   */
  async stats(days: number) {
    const { users, parts } = this.deps;
    const since = new Date(Date.now() - (days - 1) * DAY_MS);
    since.setUTCHours(0, 0, 0, 0);
    // A day earlier, so the first Cairo day is whole; trimmed below.
    const from = new Date(since.getTime() - DAY_MS);
    const perDay = (model: typeof users | typeof parts) =>
      (model as typeof users)
        .aggregate<{ _id: string; n: number }>([
          { $match: { createdAt: { $gte: from } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIMEZONE },
              },
              n: { $sum: 1 },
            },
          },
        ])
        .exec();
    const forSale = { isSold: false, hiddenAt: null };
    const contacts = { $add: ['$stats.calls', '$stats.whatsapps'] };
    const [signUps, listings, totals, byCategory, byCity, byBrand, topParts, sold] =
      await Promise.all([
        perDay(users),
        perDay(parts),
        parts
          .aggregate<{
            parts: number;
            sellers: string[];
            views: number;
            calls: number;
            whatsapps: number;
          }>([
            { $match: forSale },
            {
              $group: {
                _id: null,
                parts: { $sum: 1 },
                sellers: { $addToSet: '$sellerId' },
                views: { $sum: '$stats.views' },
                calls: { $sum: '$stats.calls' },
                whatsapps: { $sum: '$stats.whatsapps' },
              },
            },
          ])
          .exec(),
        this.partsBy([{ $match: forSale }], '$category'),
        this.partsBy([{ $match: forSale }], '$city', 10),
        this.partsBy([{ $match: forSale }, { $unwind: '$fitments' }], '$fitments.brandId', 10),
        parts
          .aggregate<Part & { _id: Types.ObjectId; contacts: number }>([
            { $match: forSale },
            { $addFields: { contacts } },
            { $match: { contacts: { $gt: 0 } } },
            { $sort: { contacts: -1, 'stats.views': -1 } },
            { $limit: 10 },
          ])
          .exec(),
        parts.countDocuments({ isSold: true }).exec(),
      ]);

    // Every day in the range, quiet ones included.
    const count = (rows: { _id: string; n: number }[]) =>
      new Map(rows.map((row) => [row._id, row.n]));
    const signUpsByDay = count(signUps);
    const listingsByDay = count(listings);
    const daily = [];
    for (let day = 0; day < days; day++) {
      const date = cairoDay(new Date(Date.now() - (days - 1 - day) * DAY_MS));
      daily.push({
        date,
        users: signUpsByDay.get(date) ?? 0,
        parts: listingsByDay.get(date) ?? 0,
      });
    }
    const total = totals[0];
    const brandName = new Map(carBrands().map((brand) => [brand.id, brand.nameAr]));
    return {
      days,
      daily,
      totals: {
        users: daily.reduce((sum, day) => sum + day.users, 0),
        parts: daily.reduce((sum, day) => sum + day.parts, 0),
      },
      forSale: {
        parts: total?.parts ?? 0,
        sellers: total?.sellers.length ?? 0,
        sold,
        views: total?.views ?? 0,
        calls: total?.calls ?? 0,
        whatsapps: total?.whatsapps ?? 0,
      },
      byCategory,
      byCity,
      byBrand: byBrand.map((row) => ({ ...row, name: brandName.get(row.key) ?? row.key })),
      topParts: topParts.map((part) => ({
        id: part._id.toString(),
        name: part.name,
        price: part.price,
        city: part.city,
        images: part.images,
        views: part.stats?.views ?? 0,
        calls: part.stats?.calls ?? 0,
        whatsapps: part.stats?.whatsapps ?? 0,
      })),
    };
  }

  /** How many parts per [field], most first. */
  private async partsBy(pipeline: PipelineStage[], field: string, top?: number) {
    const rows = await this.deps.parts
      .aggregate<{ _id: string; n: number }>([
        ...pipeline,
        { $group: { _id: field, n: { $sum: 1 } } },
        { $sort: { n: -1, _id: 1 } },
        ...(top ? [{ $limit: top }] : []),
      ])
      .exec();
    return rows.map((row) => ({ key: row._id, count: row.n }));
  }

  // ---- Reports ----

  /**
   * Reports grouped by what they are about, the most recently reported
   * first, with the part or account they point at.
   */
  async reports(query: ReportsQuery): Promise<Page<object>> {
    const match: Record<string, unknown> = { status: query.status };
    if (query.target) match.target = query.target;
    const [result] = await this.deps.reports
      .aggregate<{ items: GroupRow[]; total: { n: number }[] }>([
        { $match: match },
        {
          $group: {
            _id: { target: '$target', targetId: '$targetId' },
            count: { $sum: 1 },
            reasons: { $push: '$reason' },
            latestAt: { $max: '$createdAt' },
          },
        },
        { $sort: { latestAt: -1, _id: 1 } },
        {
          $facet: {
            items: [{ $skip: skipOf(query) }, { $limit: query.pageSize }],
            total: [{ $count: 'n' }],
          },
        },
      ] satisfies PipelineStage[])
      .exec();
    const groups = result?.items ?? [];
    const subjects = await this.subjects(groups.map((group) => group._id));
    const items = groups.map((group) => ({
      target: group._id.target,
      targetId: group._id.targetId.toString(),
      count: group.count,
      reasons: countOf(group.reasons),
      latestAt: group.latestAt,
      subject: subjects.get(`${group._id.target}:${group._id.targetId.toString()}`) ?? null,
    }));
    return pageOf(items, result?.total[0]?.n ?? 0, query);
  }

  /** Every report on one part or account, newest first, with who sent it. */
  async reportsOn(target: ReportTarget, id: string) {
    const targetId = objectId(id, target === 'PART' ? partNotFound : userNotFound);
    const found = await this.deps.reports
      .find({ target, targetId })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
    const reporters = await this.deps.users
      .find({ _id: { $in: found.map((report) => report.reporterId) } })
      .select('fullName email')
      .exec();
    const byId = new Map(reporters.map((user) => [user.id as string, user]));
    const subject = (await this.subjects([{ target, targetId }])).get(`${target}:${id}`) ?? null;
    return {
      target,
      targetId: id,
      subject,
      reports: found.map((report) => {
        const reporter = byId.get(report.reporterId.toString());
        return {
          id: report.id as string,
          reason: report.reason,
          details: report.details ?? null,
          status: report.status,
          createdAt: report.createdAt,
          reporter: reporter
            ? { id: reporter.id as string, fullName: reporter.fullName, email: reporter.email }
            : null,
          resolution: report.resolution
            ? {
                action: report.resolution.action,
                note: report.resolution.note ?? null,
                at: report.resolution.at,
              }
            : null,
        };
      }),
    };
  }

  /**
   * Closes the open reports on a part or account, doing [input.action]
   * first: hiding or removing the part, or suspending its seller.
   */
  async resolve(actor: AdminActor, target: ReportTarget, id: string, input: Resolution) {
    const targetId = objectId(id, target === 'PART' ? partNotFound : userNotFound);
    const action: ReportAction = input.action;
    if (action !== 'DISMISS') requireNote(input.note);
    if ((action === 'HIDE_PART' || action === 'REMOVE_PART') && target !== 'PART') {
      throw badRequest(ErrorCode.VALIDATION_FAILED, 'error.validation');
    }

    if (action === 'HIDE_PART') {
      await this.updatePart(actor, id, { hidden: true, note: input.note });
    } else if (action === 'REMOVE_PART') {
      await this.removePart(actor, id, input.note);
    } else if (action === 'SUSPEND_SELLER') {
      const sellerId =
        target === 'SELLER'
          ? id
          : (
              await this.deps.parts.findById(targetId).select('sellerId').exec()
            )?.sellerId.toString();
      if (!sellerId) throw partNotFound();
      const seller = await this.deps.users.findById(sellerId).select('accountStatus').exec();
      if (seller?.accountStatus !== AccountStatus.SUSPENDED) {
        await this.updateUser(actor, sellerId, { status: 'SUSPENDED', note: input.note });
      }
    }

    const closed = await this.deps.reports
      .updateMany(
        { target, targetId, status: 'OPEN' },
        {
          $set: {
            status: 'CLOSED',
            resolution: {
              action,
              note: input.note ?? null,
              adminId: new Types.ObjectId(actor.id),
              at: new Date(),
            },
          },
        },
      )
      .exec();
    await this.log(actor, 'REPORTS_RESOLVED', 'REPORT', targetId, input.note, {
      target,
      action,
      closed: closed.modifiedCount,
    });
    return { closed: closed.modifiedCount };
  }

  // ---- Accounts ----

  async users(query: UsersQuery): Promise<Page<object>> {
    const filter: QueryFilter<User> = {};
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
    }
    if (query.status) filter.accountStatus = query.status;
    if (query.verified !== undefined) filter.isVerifiedSeller = query.verified;
    const [found, total] = await Promise.all([
      this.deps.users
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skipOf(query))
        .limit(query.pageSize)
        .exec(),
      this.deps.users.countDocuments(filter).exec(),
    ]);
    const ids = found.map((user) => user._id);
    const [parts, reports] = await Promise.all([
      this.countBy(this.deps.parts, { sellerId: { $in: ids } }, '$sellerId'),
      this.countBy(
        this.deps.reports,
        { target: 'SELLER', targetId: { $in: ids }, status: 'OPEN' },
        '$targetId',
      ),
    ]);
    const items = found.map((user) => ({
      ...presentAccount(user),
      partsCount: parts.get(user.id as string) ?? 0,
      openReports: reports.get(user.id as string) ?? 0,
    }));
    return pageOf(items, total, query);
  }

  async user(id: string) {
    const userId = objectId(id, userNotFound);
    const user = await this.deps.users.findById(userId).exec();
    if (!user) throw userNotFound();
    const partIds = (await this.deps.parts.find({ sellerId: userId }).select('_id').exec()).map(
      (part) => part._id,
    );
    const [forSale, sold, hidden, reportsAgainst, partReports, reportsSent, history] =
      await Promise.all([
        this.deps.parts.countDocuments({ sellerId: userId, isSold: false, hiddenAt: null }).exec(),
        this.deps.parts.countDocuments({ sellerId: userId, isSold: true }).exec(),
        this.deps.parts.countDocuments({ sellerId: userId, hiddenAt: { $ne: null } }).exec(),
        this.deps.reports
          .countDocuments({ target: 'SELLER', targetId: userId, status: 'OPEN' })
          .exec(),
        this.deps.reports
          .countDocuments({ target: 'PART', targetId: { $in: partIds }, status: 'OPEN' })
          .exec(),
        this.deps.reports.countDocuments({ reporterId: userId }).exec(),
        this.history(userId),
      ]);
    return {
      ...presentAccount(user),
      cars: user.cars.map((car) => ({
        brandId: car.brandId,
        modelId: car.modelId,
        year: car.year,
      })),
      parts: { forSale, sold, hidden, total: partIds.length },
      reports: { openOnAccount: reportsAgainst, openOnParts: partReports, sent: reportsSent },
      history,
    };
  }

  /**
   * Suspends or restores an account, or sets its verified badge (owners
   * only). A suspension signs it out everywhere and hides its parts;
   * restoring brings back the parts the suspension hid.
   */
  async updateUser(actor: AdminActor, id: string, input: UserUpdate) {
    const userId = objectId(id, userNotFound);
    const user = await this.deps.users.findById(userId).exec();
    if (!user) throw userNotFound();
    const changes: Record<string, unknown> = {};

    if (input.verified !== undefined && input.verified !== (user.isVerifiedSeller ?? false)) {
      if (actor.role !== 'OWNER') {
        throw forbidden(ErrorCode.ADMIN_ROLE_REQUIRED, 'admin.roleRequired');
      }
      user.isVerifiedSeller = input.verified;
      changes.isVerifiedSeller = input.verified;
    }
    if (input.status && input.status !== user.accountStatus) {
      requireNote(input.note);
      user.accountStatus = input.status;
      changes.accountStatus = input.status;
    }
    if (Object.keys(changes).length === 0) return this.user(id);

    await user.save();
    if (changes.accountStatus === AccountStatus.SUSPENDED) {
      await this.deps.sessions.revokeAll(id, 'ACCOUNT_SUSPENDED');
      await this.deps.parts
        .updateMany(
          { sellerId: userId, hiddenAt: null },
          { $set: { hiddenAt: new Date(), hiddenReason: 'SUSPENDED' } },
        )
        .exec();
      await this.deps.ownerSuspended?.(id, true);
    } else if (changes.accountStatus === AccountStatus.ACTIVE) {
      await this.deps.parts
        .updateMany(
          { sellerId: userId, hiddenReason: 'SUSPENDED' },
          { $set: { hiddenAt: null, hiddenReason: null } },
        )
        .exec();
      await this.deps.ownerSuspended?.(id, false);
    }
    const action =
      changes.accountStatus === AccountStatus.SUSPENDED
        ? 'USER_SUSPENDED'
        : changes.accountStatus === AccountStatus.ACTIVE
          ? 'USER_RESTORED'
          : changes.isVerifiedSeller
            ? 'SELLER_VERIFIED'
            : 'SELLER_UNVERIFIED';
    await this.log(actor, action, 'USER', userId, input.note, changes);
    return this.user(id);
  }

  // ---- Listings ----

  async parts(query: PartsQuery): Promise<Page<object>> {
    const filter: QueryFilter<Part> = {};
    const words = normalizeSearchText(query.q ?? '')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length) {
      filter.$and = words.map((word) => ({ searchText: { $regex: escapeRegex(word) } }));
    }
    if (query.status === 'FOR_SALE') Object.assign(filter, { isSold: false, hiddenAt: null });
    if (query.status === 'SOLD') filter.isSold = true;
    if (query.status === 'HIDDEN') filter.hiddenAt = { $ne: null };
    if (query.featured !== undefined) filter.isFeatured = query.featured;
    if (query.sellerId) filter.sellerId = objectId(query.sellerId, userNotFound);
    const [found, total] = await Promise.all([
      this.deps.parts
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skipOf(query))
        .limit(query.pageSize)
        .exec(),
      this.deps.parts.countDocuments(filter).exec(),
    ]);
    const reports = await this.countBy(
      this.deps.reports,
      { target: 'PART', targetId: { $in: found.map((part) => part._id) }, status: 'OPEN' },
      '$targetId',
    );
    const presented = await this.presentParts(found);
    const items = presented.map((part) => ({ ...part, openReports: reports.get(part.id) ?? 0 }));
    return pageOf(items, total, query);
  }

  async part(id: string) {
    const part = await this.findPart(id);
    const [presented] = await this.presentParts([part]);
    const [openReports, history] = await Promise.all([
      this.deps.reports
        .countDocuments({ target: 'PART', targetId: part._id, status: 'OPEN' })
        .exec(),
      this.history(part._id),
    ]);
    return { ...presented!, description: part.description ?? null, openReports, history };
  }

  /** Hides or shows a part (telling its seller), or features it (owners only). */
  async updatePart(actor: AdminActor, id: string, input: PartUpdate) {
    const part = await this.findPart(id);
    const changes: Record<string, unknown> = {};
    let notice: ListingChange | null = null;

    if (input.featured !== undefined && input.featured !== part.isFeatured) {
      if (actor.role !== 'OWNER') {
        throw forbidden(ErrorCode.ADMIN_ROLE_REQUIRED, 'admin.roleRequired');
      }
      part.isFeatured = input.featured;
      changes.isFeatured = input.featured;
    }
    if (input.hidden !== undefined && input.hidden !== (part.hiddenAt != null)) {
      requireNote(input.note);
      part.hiddenAt = input.hidden ? new Date() : null;
      part.hiddenReason = input.hidden ? 'ADMIN' : null;
      changes.hidden = input.hidden;
      notice = input.hidden ? 'HIDDEN' : 'RESTORED';
    }
    if (Object.keys(changes).length === 0) return this.part(id);

    await part.save();
    if (notice) await this.deps.notifications.listingNotice(part.sellerId, notice, part);
    const action =
      changes.hidden === true
        ? 'PART_HIDDEN'
        : changes.hidden === false
          ? 'PART_SHOWN'
          : changes.isFeatured
            ? 'PART_FEATURED'
            : 'PART_UNFEATURED';
    await this.log(actor, action, 'PART', part._id, input.note, changes);
    return this.part(id);
  }

  /** Deletes a part and its photos for good, and tells its seller. */
  async removePart(actor: AdminActor, id: string, note: string | null | undefined) {
    requireNote(note);
    if (!Types.ObjectId.isValid(id)) throw partNotFound();
    const part = await this.deps.partsService.removeAny(id);
    await this.deps.notifications.listingNotice(part.sellerId, 'REMOVED', part);
    await this.log(actor, 'PART_REMOVED', 'PART', part._id, note, {
      name: part.name,
      sellerId: part.sellerId.toString(),
    });
  }

  // ---- The log ----

  async audit(query: AuditQuery): Promise<Page<object>> {
    const filter: Record<string, unknown> = {};
    if (query.targetId) filter.targetId = objectId(query.targetId, userNotFound);
    if (query.adminId) filter.adminId = objectId(query.adminId, userNotFound);
    const [found, total] = await Promise.all([
      this.deps.audit
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skipOf(query))
        .limit(query.pageSize)
        .exec(),
      this.deps.audit.countDocuments(filter).exec(),
    ]);
    return pageOf(found.map(presentEntry), total, query);
  }

  // ---- Helpers ----

  private async history(targetId: Types.ObjectId) {
    const found = await this.deps.audit.find({ targetId }).sort({ createdAt: -1 }).limit(50).exec();
    return found.map(presentEntry);
  }

  private async log(
    actor: AdminActor,
    action: string,
    target: 'USER' | 'PART' | 'REPORT',
    targetId: Types.ObjectId,
    note: string | null | undefined,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.audit.create({
      adminId: new Types.ObjectId(actor.id),
      adminEmail: actor.email,
      action,
      target,
      targetId,
      note: note ?? null,
      changes,
    });
  }

  private async findPart(id: string): Promise<PartDocument> {
    const part = await this.deps.parts.findById(objectId(id, partNotFound)).exec();
    if (!part) throw partNotFound();
    return part;
  }

  /** Parts as the app shows them, with their stats and hidden state. */
  private async presentParts(parts: PartDocument[]) {
    const sellers = await this.deps.users
      .find({ _id: { $in: parts.map((part) => part.sellerId) } })
      .select('fullName email profilePhotoUrl isVerifiedSeller accountStatus')
      .exec();
    const byId = new Map(sellers.map((user) => [user.id as string, user]));
    return parts.map((part) => {
      const seller = byId.get(part.sellerId.toString());
      const presented = presentPart(
        part,
        seller && {
          id: seller.id as string,
          fullName: seller.fullName,
          profilePhotoUrl: seller.profilePhotoUrl,
          isVerifiedSeller: seller.isVerifiedSeller,
        },
        part.sellerId.toString(),
      );
      return {
        ...presented,
        hiddenAt: part.hiddenAt ?? null,
        hiddenReason: part.hiddenReason ?? null,
        createdAt: part.createdAt,
        seller: {
          ...presented.seller,
          email: seller?.email ?? null,
          accountStatus: seller?.accountStatus ?? null,
        },
      };
    });
  }

  /** The part or account each report group points at; null once it is gone. */
  private async subjects(keys: { target: string; targetId: Types.ObjectId }[]) {
    const partIds = keys.filter((key) => key.target === 'PART').map((key) => key.targetId);
    const userIds = keys.filter((key) => key.target === 'SELLER').map((key) => key.targetId);
    const [parts, users] = await Promise.all([
      partIds.length ? this.deps.parts.find({ _id: { $in: partIds } }).exec() : [],
      userIds.length ? this.deps.users.find({ _id: { $in: userIds } }).exec() : [],
    ]);
    const presented = await this.presentParts(parts);
    const map = new Map<string, object>();
    for (const part of presented) map.set(`PART:${part.id}`, part);
    for (const user of users) map.set(`SELLER:${user.id as string}`, presentAccount(user));
    return map;
  }

  private async countBy(
    model: { aggregate: PartModel['aggregate'] },
    match: Record<string, unknown>,
    field: string,
  ): Promise<Map<string, number>> {
    const rows = await model
      .aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: match },
        { $group: { _id: field, n: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id.toString(), row.n]));
  }
}

type GroupRow = {
  _id: { target: ReportTarget; targetId: Types.ObjectId };
  count: number;
  reasons: string[];
  latestAt: Date;
};

function countOf(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function requireNote(note: string | null | undefined): void {
  if (!note || note.trim().length < 3) {
    throw badRequest(ErrorCode.NOTE_REQUIRED, 'admin.noteRequired');
  }
}

function presentEntry(entry: {
  id?: unknown;
  adminEmail: string;
  action: string;
  target: string;
  targetId: Types.ObjectId;
  note?: string | null;
  changes?: unknown;
  createdAt?: Date;
}) {
  return {
    id: String(entry.id),
    adminEmail: entry.adminEmail,
    action: entry.action,
    target: entry.target,
    targetId: entry.targetId.toString(),
    note: entry.note ?? null,
    changes: entry.changes ?? null,
    createdAt: entry.createdAt,
  };
}
