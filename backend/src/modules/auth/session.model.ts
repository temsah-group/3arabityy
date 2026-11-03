import {
  Schema,
  Types,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

export const RefreshTokenState = {
  ACTIVE: 'ACTIVE',
  ROTATED: 'ROTATED',
  REVOKED: 'REVOKED',
} as const;

/**
 * One row per refresh token. A sign-in starts a session; each refresh marks
 * its token ROTATED and adds the next one to the same session. Presenting a
 * ROTATED token again means it leaked, so the whole session is revoked.
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, required: true },
    /** Public half of the token, used to find the row. */
    selector: { type: String, required: true },
    /** SHA-256 of the secret half; the secret is random, so no slow hash is needed. */
    secretHash: { type: String, required: true },
    state: {
      type: String,
      enum: Object.values(RefreshTokenState),
      default: RefreshTokenState.ACTIVE,
    },
    device: { type: String, default: 'unknown', maxlength: 200 },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
    /** The session's end; every token of a session shares it. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'refresh_tokens' },
);

refreshTokenSchema.index({ selector: 1 }, { unique: true });
refreshTokenSchema.index({ userId: 1, sessionId: 1, state: 1 });
// MongoDB removes a row once its session has ended.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema> & { userId: Types.ObjectId };
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export type RefreshTokenModel = Model<RefreshToken>;

export const createRefreshTokenModel = (connection: Connection): RefreshTokenModel =>
  connection.model<RefreshToken>('RefreshToken', refreshTokenSchema);
