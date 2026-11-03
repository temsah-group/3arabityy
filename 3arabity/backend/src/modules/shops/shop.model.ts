import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { PART_CATEGORIES } from '../catalog/catalog.js';

/**
 * `PENDING` until a moderator looks at it; buyers only ever see `APPROVED`
 * shops. A `REJECTED` shop goes back to `PENDING` when its owner edits it.
 */
export const SHOP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type ShopStatus = (typeof SHOP_STATUSES)[number];

/**
 * Ranking pulls a shop's average towards [mean] as if it had [weight] more
 * reviews of it, so two 5-star reviews don't beat a hundred 4.8s.
 */
export const RATING_PRIOR = { mean: 4, weight: 5 } as const;

const deliverySchema = new Schema(
  {
    available: { type: Boolean, default: false },
    /** Governorates it delivers to, by their Arabic names (as a part's `city`). */
    governorates: { type: [String], default: [] },
    /** A rough fee in whole pounds; the buyer agrees the rest on the phone. */
    feeFrom: { type: Number, default: null },
    feeTo: { type: Number, default: null },
    /** How long it takes, in the shop's words ("خلال يومين"). */
    eta: { type: String, default: null },
    note: { type: String, default: null },
  },
  { _id: false },
);

/**
 * A spare-parts shop: one per account. Every part its owner lists shows
 * under it once 3arabity approves it. Buyers reach it by phone or WhatsApp.
 */
const shopSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: null },
    logoUrl: { type: String, default: null },
    coverUrl: { type: String, default: null },
    /** E.164, like a part's `phone`. */
    phone: { type: String, required: true },
    whatsapp: { type: String, default: null },
    /** The governorate, by its Arabic name. */
    city: { type: String, required: true },
    address: { type: String, required: true },
    location: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },
    /** Opening hours in the shop's words ("يومياً ١٠ص - ١٠م"). */
    hours: { type: String, default: null },
    brandIds: { type: [String], default: [] },
    categories: { type: [String], enum: PART_CATEGORIES, default: [] },
    delivery: { type: deliverySchema, default: () => ({}) },

    status: { type: String, enum: SHOP_STATUSES, default: 'PENDING' },
    /** Why a moderator turned it down or suspended it; shown to the owner. */
    statusReason: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    /** Set while its owner's account is suspended. */
    hiddenAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    /**
     * Kept up to date by reviews. `score` is the average pulled towards a
     * typical rating while there are few reviews, so it ranks fairly.
     */
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
      score: { type: Number, default: RATING_PRIOR.mean },
    },
  },
  { timestamps: true, collection: 'shops' },
);

shopSchema.index({ ownerId: 1 }, { unique: true });
shopSchema.index({ status: 1, isFeatured: -1, 'rating.score': -1, _id: -1 });
shopSchema.index({ status: 1, createdAt: -1, _id: -1 });
shopSchema.index({ status: 1, city: 1 });
shopSchema.index({ status: 1, 'delivery.governorates': 1 });

export type Shop = InferSchemaType<typeof shopSchema>;
export type ShopDocument = HydratedDocument<Shop>;
export type ShopModel = Model<Shop>;

/** Shops buyers may see. */
export const OPEN_SHOP = { status: 'APPROVED', hiddenAt: null } as const;

export const createShopModel = (connection: Connection): ShopModel =>
  connection.model<Shop>('Shop', shopSchema);
