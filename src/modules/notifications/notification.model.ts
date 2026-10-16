import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

export const NOTIFICATION_KINDS = ['FITS_YOUR_CAR', 'PRICE_DROP', 'LISTING', 'SYSTEM'] as const;
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
    read: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'notifications' },
);

notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ partId: 1 });

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
  },
  { timestamps: true, collection: 'devices' },
);

deviceSchema.index({ token: 1 }, { unique: true });
deviceSchema.index({ userId: 1 });

export type Device = InferSchemaType<typeof deviceSchema>;
export type DeviceModel = Model<Device>;

export const createDeviceModel = (connection: Connection): DeviceModel =>
  connection.model<Device>('Device', deviceSchema);
