import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';

/**
 * A part photo someone uploaded. Listings may only use photos their seller
 * uploaded; `partId` is set once one does.
 */
const uploadSchema = new Schema(
  {
    path: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    partId: { type: Schema.Types.ObjectId, ref: 'Part', default: null },
  },
  { timestamps: true, collection: 'uploads' },
);

uploadSchema.index({ path: 1 }, { unique: true });
uploadSchema.index({ ownerId: 1, partId: 1 });

export type Upload = InferSchemaType<typeof uploadSchema>;
export type UploadModel = Model<Upload>;

export const createUploadModel = (connection: Connection): UploadModel =>
  connection.model<Upload>('Upload', uploadSchema);
