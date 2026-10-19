import { Types, type QueryFilter } from 'mongoose';

import { notFound } from '../../common/http/errors.js';
import { afterCursor, nextCursorOf } from '../../common/http/paging.js';
import { t, type Lang } from '../../common/i18n.js';
import { logger } from '../../common/logger.js';
import type { PartDocument } from '../parts/part.model.js';
import type { SavedPartModel } from '../saved/saved.model.js';
import type { User, UserModel } from '../users/user.model.js';
import type {
  DeviceModel,
  Notification,
  NotificationDocument,
  NotificationKind,
  NotificationModel,
} from './notification.model.js';
import type { PushMessage, PushSender } from './push.js';

/** What happened to a listing; the first param of a `LISTING` notification. */
export type ListingChange = 'HIDDEN' | 'RESTORED' | 'REMOVED';

/** What a moderator did to a shop; the first param of a `SHOP` notification. */
export type ShopChange = 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'RESTORED';

export type NotificationSettings = { fitsMyCar: boolean; priceDrops: boolean; news: boolean };

/** How many users one new part may notify; the rest miss out, the app goes on. */
const MAX_RECIPIENTS = 2000;

const money = (value: number) => new Intl.NumberFormat('en-US').format(value);

/**
 * The inbox, what the user wants in it, and the phones push goes to. Parts
 * call [partListed] and [priceDropped]; everything put in an inbox is also
 * pushed to that user's phones, after the request that caused it.
 */
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationModel,
    private readonly devices: DeviceModel,
    private readonly users: UserModel,
    private readonly saved: SavedPartModel,
    private readonly push: PushSender,
  ) {}

  /** Pushes still going out; tests wait on them with [flush]. */
  private readonly sending = new Set<Promise<void>>();

  // ---- The inbox ----

  async list(userId: string, lang: Lang, cursor: string | undefined, limit: number) {
    const owner = new Types.ObjectId(userId);
    const [found, unreadCount] = await Promise.all([
      this.notifications
        .find({ userId: owner, ...afterCursor('createdAt', cursor) })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .exec(),
      this.notifications.countDocuments({ userId: owner, read: false }).exec(),
    ]);
    return {
      items: found.slice(0, limit).map((item) => present(item, lang)),
      nextCursor: nextCursorOf(found, limit, 'createdAt'),
      unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const result = await this.notifications
      .updateOne(this.mine(userId, id), { $set: { read: true } })
      .exec();
    if (result.matchedCount === 0) throw notFound('notifications.notFound');
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications
      .updateMany({ userId: new Types.ObjectId(userId), read: false }, { $set: { read: true } })
      .exec();
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.notifications.deleteOne(this.mine(userId, id)).exec();
    if (result.deletedCount === 0) throw notFound('notifications.notFound');
  }

  // ---- Settings and devices ----

  async settings(userId: string): Promise<NotificationSettings> {
    const user = await this.users.findById(userId).select('notificationSettings').exec();
    return settingsOf(user);
  }

  async updateSettings(userId: string, input: NotificationSettings): Promise<NotificationSettings> {
    const user = await this.users
      .findByIdAndUpdate(
        userId,
        { $set: { notificationSettings: input } },
        { returnDocument: 'after' },
      )
      .select('notificationSettings')
      .exec();
    return settingsOf(user);
  }

  /** The token now pushes to [userId], whoever had it before. */
  async registerDevice(userId: string, token: string, platform: 'ios' | 'android', lang: Lang) {
    await this.devices
      .updateOne(
        { token },
        { $set: { userId: new Types.ObjectId(userId), platform, lang } },
        { upsert: true },
      )
      .exec();
  }

  // ---- Push ----

  /**
   * Pushes [items], just put in their inboxes, to their users' phones without
   * holding up the caller. A failure is logged; the inbox already has them.
   */
  deliverLater(items: NotificationDocument[]): void {
    if (items.length === 0) return;
    const job = this.deliver(items)
      .catch((error: unknown) => {
        logger.error('Push failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => this.sending.delete(job));
    this.sending.add(job);
  }

  /** Resolves once every push started so far has gone out. */
  async flush(): Promise<void> {
    await Promise.all([...this.sending]);
  }

  private async deliver(items: NotificationDocument[]): Promise<void> {
    const byUser = new Map(items.map((item) => [item.userId.toString(), item]));
    const devices = await this.devices
      .find({ userId: { $in: items.map((item) => item.userId) } })
      .select('token userId lang')
      .lean()
      .exec();
    const messages: PushMessage[] = [];
    for (const device of devices) {
      const item = byUser.get(device.userId.toString());
      if (!item) continue;
      const shown = present(item, device.lang === 'en' ? 'en' : 'ar');
      messages.push({
        token: device.token,
        title: shown.title,
        body: shown.body,
        data: {
          notificationId: shown.id,
          kind: shown.kind,
          ...(shown.partId ? { partId: shown.partId } : {}),
          ...(shown.shopId ? { shopId: shown.shopId } : {}),
        },
      });
    }
    if (messages.length === 0) return;
    const { deadTokens } = await this.push.send(messages);
    if (deadTokens.length > 0) {
      await this.devices.deleteMany({ token: { $in: deadTokens } }).exec();
    }
  }

  async removeDevice(userId: string, token: string): Promise<void> {
    await this.devices.deleteOne({ token, userId: new Types.ObjectId(userId) }).exec();
  }

  // ---- What parts tell it ----

  /** A new part: everyone with a car it fits hears of it, not its seller. */
  async partListed(part: PartDocument): Promise<void> {
    if (part.isSold || part.fitments.length === 0) return;
    const fits: QueryFilter<User> = {
      _id: { $ne: part.sellerId },
      'notificationSettings.fitsMyCar': { $ne: false },
      $or: part.fitments.map((fitment) => ({
        cars: {
          $elemMatch: {
            brandId: fitment.brandId,
            modelId: fitment.modelId,
            year: { $gte: fitment.fromYear, $lte: fitment.toYear },
          },
        },
      })),
    };
    const users = await this.users.find(fits).select('_id').limit(MAX_RECIPIENTS).exec();
    await this.send(
      users.map((user) => user._id),
      'FITS_YOUR_CAR',
      [part.name, money(part.price), part.city],
      part._id,
    );
  }

  /** A part got cheaper: whoever saved it hears of it. */
  async priceDropped(part: PartDocument, from: number): Promise<void> {
    if (part.isSold || part.price >= from) return;
    const saved = await this.saved.find({ partId: part._id }).select('userId').exec();
    const users = await this.users
      .find({
        _id: { $in: saved.map((item) => item.userId), $ne: part.sellerId },
        'notificationSettings.priceDrops': { $ne: false },
      })
      .select('_id')
      .exec();
    await this.send(
      users.map((user) => user._id),
      'PRICE_DROP',
      [part.name, money(from), money(part.price)],
      part._id,
    );
  }

  /**
   * Tells a seller what 3arabity did to their listing. A removed part's
   * notice opens nothing, since the part is gone.
   */
  async listingNotice(
    sellerId: Types.ObjectId,
    change: ListingChange,
    part: { _id: Types.ObjectId; name: string },
  ): Promise<void> {
    await this.send(
      [sellerId],
      'LISTING',
      [change, part.name],
      change === 'REMOVED' ? null : part._id,
    );
  }

  /** Tells an owner what 3arabity decided about their shop, with the reason. */
  async shopNotice(
    ownerId: Types.ObjectId,
    change: ShopChange,
    shop: { _id: Types.ObjectId; name: string; statusReason?: string | null },
  ): Promise<void> {
    const items = await this.notifications.insertMany([
      {
        userId: ownerId,
        kind: 'SHOP',
        params: [change, shop.name, shop.statusReason ?? ''],
        shopId: shop._id,
      },
    ]);
    this.deliverLater(items);
  }

  /** Deleted parts leave no notifications that open nothing. */
  async partsRemoved(partIds: Types.ObjectId[]): Promise<void> {
    if (partIds.length === 0) return;
    await this.notifications.deleteMany({ partId: { $in: partIds } }).exec();
  }

  async deleteAllOf(userId: string): Promise<void> {
    const owner = new Types.ObjectId(userId);
    await Promise.all([
      this.notifications.deleteMany({ userId: owner }).exec(),
      this.devices.deleteMany({ userId: owner }).exec(),
    ]);
  }

  private async send(
    userIds: Types.ObjectId[],
    kind: NotificationKind,
    params: string[],
    partId: Types.ObjectId | null,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const items = await this.notifications.insertMany(
      userIds.map((userId) => ({ userId, kind, params, partId })),
    );
    this.deliverLater(items);
  }

  private mine(userId: string, id: string): QueryFilter<Notification> {
    if (!Types.ObjectId.isValid(id)) return { _id: { $exists: false } };
    return { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) };
  }
}

function settingsOf(
  user: { notificationSettings?: Partial<NotificationSettings> | null } | null,
): NotificationSettings {
  const settings = user?.notificationSettings;
  return {
    fitsMyCar: settings?.fitsMyCar ?? true,
    priceDrops: settings?.priceDrops ?? true,
    news: settings?.news ?? false,
  };
}

/** The notification as the app reads it, in [lang]. */
function present(item: NotificationDocument, lang: Lang) {
  const params = item.params;
  const [title, body] = (() => {
    switch (item.kind) {
      case 'FITS_YOUR_CAR':
        return [t(lang, 'notifications.fitsTitle'), t(lang, 'notifications.fitsBody', params)];
      case 'PRICE_DROP':
        return [
          t(lang, 'notifications.priceDropTitle'),
          t(lang, 'notifications.priceDropBody', params),
        ];
      case 'LISTING': {
        const [change, name] = params;
        const key = change === 'HIDDEN' ? 'Hidden' : change === 'RESTORED' ? 'Restored' : 'Removed';
        return [
          t(lang, `notifications.listing${key}Title`),
          t(lang, `notifications.listing${key}Body`, [name]),
        ];
      }
      case 'SHOP': {
        const [change, name, reason] = params;
        const key =
          change === 'APPROVED'
            ? 'Approved'
            : change === 'REJECTED'
              ? 'Rejected'
              : change === 'SUSPENDED'
                ? 'Suspended'
                : 'Restored';
        return [
          t(lang, `notifications.shop${key}Title`),
          t(lang, `notifications.shop${key}Body`, [name, reason]),
        ];
      }
      // News and announcements carry their own words: Arabic, then English.
      default:
        return lang === 'en' && params.length >= 4
          ? [params[2]!, params[3]!]
          : [params[0] ?? '', params[1] ?? ''];
    }
  })();
  return {
    id: item.id as string,
    kind: item.kind,
    title,
    body,
    partId: item.partId?.toString() ?? null,
    shopId: item.shopId?.toString() ?? null,
    read: item.read,
    createdAt: item.createdAt,
  };
}
