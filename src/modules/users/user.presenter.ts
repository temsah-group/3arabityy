import type { UserDocument } from './user.model.js';

/**
 * The user as the app reads it (`UserModel.fromJson` in the Flutter app).
 * Only public fields: never the password hash or the lockout state.
 */
export function presentUser(user: UserDocument) {
  return {
    id: user.id as string,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    profilePhotoUrl: user.profilePhotoUrl ?? null,
    accountType: user.accountType,
    accountStatus: user.accountStatus,
    primaryIdentifierType: 'email' as const,
    emailVerification: {
      isVerified: user.emailVerifiedAt != null,
      verifiedAt: user.emailVerifiedAt ?? null,
    },
    // Phone numbers are contact details only until SMS verification exists.
    phoneVerification: { isVerified: false, verifiedAt: null },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type PublicUser = ReturnType<typeof presentUser>;
