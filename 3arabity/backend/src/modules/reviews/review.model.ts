import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

export const REVIEW_TARGETS = ['SHOP', 'PART'] as const;
export type ReviewTarget = (typeof REVIEW_TARGETS)[number];

/**
 * A buyer's stars and words about a shop or a part, one per buyer and
 * target; writing again changes it. Only buyers who reached the seller may
 * write one. The seller may answer once, and change the answer.
 */
const reviewSchema = new Schema(
  {
    target: { type: String, enum: REVIEW_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** Who may answer: the part's seller or the shop's owner. */
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** The shop it is about, directly or through one of its parts. */
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: null },
    reply: {
      type: new Schema({ text: String, at: Date }, { _id: false }),
      default: null,
    },
    /** Set when a moderator hides it; hidden reviews count for nothing. */
    hiddenAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'reviews' },
);

reviewSchema.index({ authorId: 1, target: 1, targetId: 1 }, { unique: true });
reviewSchema.index({ target: 1, targetId: 1, hiddenAt: 1, createdAt: -1, _id: -1 });
reviewSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });
reviewSchema.index({ createdAt: -1, _id: -1 });

export type Review = InferSchemaType<typeof reviewSchema>;
export type ReviewDocument = HydratedDocument<Review>;
export type ReviewModel = Model<Review>;

export const createReviewModel = (connection: Connection): ReviewModel =>
  connection.model<Review>('Review', reviewSchema);

/**
 * Someone who called or messaged a seller, which lets them review the
 * seller's shop and the parts they asked about. One per buyer and seller.
 */
const contactSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** The parts they asked about; empty when they only called the shop. */
    partIds: { type: [Schema.Types.ObjectId], default: [] },
    lastAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contacts' },
);

contactSchema.index({ userId: 1, sellerId: 1 }, { unique: true });
contactSchema.index({ sellerId: 1 });

export type Contact = InferSchemaType<typeof contactSchema>;
export type ContactModel = Model<Contact>;

export const createContactModel = (connection: Connection): ContactModel =>
  connection.model<Contact>('Contact', contactSchema);
