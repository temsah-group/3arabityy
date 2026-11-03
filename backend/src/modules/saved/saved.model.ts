import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

/** A part a user saved; the saved list is newest saved first. */
const savedPartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    partId: { type: Schema.Types.ObjectId, ref: 'Part', required: true },
    savedAt: { type: Date, default: () => new Date() },
  },
  { collection: 'saved_parts' },
);

savedPartSchema.index({ userId: 1, partId: 1 }, { unique: true });
savedPartSchema.index({ userId: 1, savedAt: -1, _id: -1 });
savedPartSchema.index({ partId: 1 });

export type SavedPart = InferSchemaType<typeof savedPartSchema>;
export type SavedPartDocument = HydratedDocument<SavedPart>;
export type SavedPartModel = Model<SavedPart>;

export const createSavedPartModel = (connection: Connection): SavedPartModel =>
  connection.model<SavedPart>('SavedPart', savedPartSchema);
