import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

export const NOTIFICATION_KINDS = [
  'FITS_YOUR_CAR',
  'PRICE_DROP',
  'LISTING',
  'SHOP',
  'SYSTEM',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * One message in a user's inbox. The words are not stored: [kind] and
 * [params] are, and the title and body are written in the reader's
 * language when the inbox is read.
 */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    params: { type: [String], default: [] },
    partId: { type: Schema.Types.ObjectId, ref: 'Part', default: null },
    /** The shop it opens, for news about a shop. */
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', default: null },
    /** The dashboard announcement it delivers, so removing that removes it. */
    announcementId: { type: Schema.Types.ObjectId, ref: 'Announcement', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'notifications' },
);

notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ partId: 1 });
notificationSchema.index({ shopId: 1 }, { sparse: true });
notificationSchema.index({ announcementId: 1 }, { sparse: true });

export type Notification = InferSchemaType<typeof notificationSchema>;
export type NotificationDocument = HydratedDocument<Notification>;
export type NotificationModel = Model<Notification>;

export const createNotificationModel = (connection: Connection): NotificationModel =>
  connection.model<Notification>('Notification', notificationSchema);

/** A phone that gets push notifications for a user, by its push token. */
const deviceSchema = new Schema(
  {
    token: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    /** The app's language when it registered; pushes are written in it. */
    lang: { type: String, enum: ['ar', 'en'], default: 'ar' },
  },
  { timestamps: true, collection: 'devices' },
);

deviceSchema.index({ token: 1 }, { unique: true });
deviceSchema.index({ userId: 1 });

export type Device = InferSchemaType<typeof deviceSchema>;
export type DeviceModel = Model<Device>;

export const createDeviceModel = (connection: Connection): DeviceModel =>
  connection.model<Device>('Device', deviceSchema);
