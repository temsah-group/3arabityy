import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

export const AccountType = { USER: 'USER', SELLER: 'SELLER' } as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountStatus = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' } as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

/** One car of the user's garage; "a new part fits your car" goes by it. */
const carSchema = new Schema(
  {
    brandId: { type: String, required: true },
    modelId: { type: String, required: true },
    year: { type: Number, required: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    /** Sign-in identifier, stored lower-cased. */
    email: { type: String, required: true, lowercase: true, trim: true },
    /** Contact number in E.164 (+201…); not used to sign in. */
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    /** Bumped on every password change; reset tokens carry it, so each works once. */
    passwordVersion: { type: Number, default: 0 },

    accountType: {
      type: String,
      enum: Object.values(AccountType),
      default: AccountType.USER,
    },
    accountStatus: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.ACTIVE,
    },
    emailVerifiedAt: { type: Date, default: null },
    profilePhotoUrl: { type: String, default: null },
    /** Identity checked by 3arabity; shown as a badge on their parts. */
    isVerifiedSeller: { type: Boolean, default: false },

    /** Up to five cars, in the order the app shows them. */
    cars: { type: [carSchema], default: [] },
    /** What the user wants to be told about. */
    notificationSettings: {
      fitsMyCar: { type: Boolean, default: true },
      priceDrops: { type: Boolean, default: true },
      news: { type: Boolean, default: false },
    },

    // Brute-force guard for password sign-in.
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'cars.brandId': 1, 'cars.modelId': 1 });

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export type UserModel = Model<User>;

export const createUserModel = (connection: Connection): UserModel =>
  connection.model<User>('User', userSchema);
