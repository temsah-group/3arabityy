import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { PART_CATEGORIES, PART_CONDITIONS } from '../catalog/catalog.js';

const fitmentSchema = new Schema(
  {
    brandId: { type: String, required: true },
    modelId: { type: String, required: true },
    fromYear: { type: Number, required: true },
    toYear: { type: Number, required: true },
  },
  { _id: false },
);

/** A spare part a seller lists. Buyers reach the seller by phone or WhatsApp. */
const partSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** The seller's shop, once 3arabity approved it; null for individuals. */
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', default: null },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, enum: PART_CATEGORIES, required: true },
    condition: { type: String, enum: PART_CONDITIONS, required: true },
    isOriginal: { type: Boolean, default: false },
    /** Whole Egyptian pounds. */
    price: { type: Number, required: true },
    oldPrice: { type: Number, default: null },
    partNumber: { type: String, default: null },
    description: { type: String, default: null },
    /** Public paths (/uploads/parts/…) or outside URLs, cover first. */
    images: { type: [String], default: [] },
    fitments: { type: [fitmentSchema], default: [] },
    city: { type: String, required: true },
    /** The number buyers call for this part, E.164. */
    phone: { type: String, required: true },
    isFeatured: { type: Boolean, default: false },
    isSold: { type: Boolean, default: false },
    /**
     * Set when 3arabity hides the part: by a moderator (`ADMIN`) or with its
     * seller's suspension (`SUSPENDED`). Hidden parts are left out of
     * everything buyers see; the seller still sees them.
     */
    hiddenAt: { type: Date, default: null },
    hiddenReason: { type: String, enum: ['ADMIN', 'SUSPENDED', null], default: null },
    /** When it went up or was last renewed; "latest" sorts by it. */
    listedAt: { type: Date, default: () => new Date() },
    stats: {
      views: { type: Number, default: 0 },
      calls: { type: Number, default: 0 },
      whatsapps: { type: Number, default: 0 },
    },
    /** Kept up to date by reviews of this part. */
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    /** Normalised words it is found by; see `searchableText`. */
    searchText: { type: String, default: '', select: false },
  },
  { timestamps: true, collection: 'parts' },
);

partSchema.index({ isSold: 1, listedAt: -1, _id: -1 });
partSchema.index({ isSold: 1, price: 1, _id: 1 });
partSchema.index({ sellerId: 1, listedAt: -1 });
partSchema.index({ shopId: 1 }, { sparse: true });
partSchema.index({ 'fitments.brandId': 1, 'fitments.modelId': 1 });

export type Part = InferSchemaType<typeof partSchema>;

/** Parts buyers may see: not hidden by 3arabity. */
export const VISIBLE = { hiddenAt: null } as const;
export type PartDocument = HydratedDocument<Part>;
export type PartModel = Model<Part>;

export const createPartModel = (connection: Connection): PartModel =>
  connection.model<Part>('Part', partSchema);
