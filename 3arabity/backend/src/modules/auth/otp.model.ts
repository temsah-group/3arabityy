import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';

export const OtpPurpose = { REGISTER: 'register', PASSWORD_RESET: 'password_reset' } as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

/** The one live code per email and purpose; a new request replaces it. */
const otpSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true },
    purpose: { type: String, required: true, enum: Object.values(OtpPurpose) },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'otp_codes' },
);

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
// Kept a day past expiry so the resend cooldown and "expired" message still work.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export type OtpCode = InferSchemaType<typeof otpSchema>;
export type OtpModel = Model<OtpCode>;

export const createOtpModel = (connection: Connection): OtpModel =>
  connection.model<OtpCode>('OtpCode', otpSchema);
