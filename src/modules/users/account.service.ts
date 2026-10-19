import bcrypt from 'bcrypt';

import { badRequest, ErrorCode } from '../../common/http/errors.js';
import type { OtpModel } from '../auth/otp.model.js';
import type { SessionsService } from '../auth/sessions.service.js';
import type { PhotoStorage } from './photo-storage.js';
import type { UserDocument, UserModel } from './user.model.js';
import type { UsersService } from './users.service.js';

/**
 * What the signed-in user does to their own account: change the password,
 * set or remove the photo, delete the account.
 */
export class AccountService {
  constructor(
    private readonly users: UsersService,
    private readonly userModel: UserModel,
    private readonly sessions: SessionsService,
    private readonly otps: OtpModel,
    private readonly photos: PhotoStorage,
    /** Modules holding what the user made: parts, saved parts, the inbox… */
    private readonly owned: { deleteAllOf(userId: string): Promise<void> }[],
    /** Whether a Google ID token belongs to the given Google account. */
    private readonly isGoogleAccount: (idToken: string, googleId: string) => Promise<boolean>,
  ) {}

  /**
   * Keeps this session; every other device has to sign in again. An account
   * made with Google sets its first password without a current one.
   */
  async changePassword(
    userId: string,
    sessionId: string,
    input: { currentPassword?: string | undefined; newPassword: string },
  ): Promise<void> {
    const user = await this.withPassword(userId);
    if (user.passwordHash) {
      // 400, not 401: a wrong password must not look like an expired session.
      if (!(await this.matches(input.currentPassword, user.passwordHash))) {
        throw badRequest(ErrorCode.WRONG_PASSWORD, 'users.wrongPassword');
      }
      if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
        throw badRequest(ErrorCode.VALIDATION_FAILED, 'users.samePassword');
      }
    }
    await this.users.setPassword(user, input.newPassword);
    await this.sessions.revokeOthers(userId, sessionId, 'PASSWORD_CHANGED');
  }

  /**
   * Deletes the account, its sessions, its codes and its photo, after the
   * password, or for an account without one, after signing in to Google again.
   */
  async deleteAccount(
    userId: string,
    proof: { password?: string | undefined; idToken?: string | undefined },
  ): Promise<void> {
    const user = await this.withPassword(userId);
    const confirmed = user.passwordHash
      ? await this.matches(proof.password, user.passwordHash)
      : !!proof.idToken &&
        !!user.googleId &&
        (await this.isGoogleAccount(proof.idToken, user.googleId));
    if (!confirmed) {
      throw badRequest(
        user.passwordHash ? ErrorCode.WRONG_PASSWORD : ErrorCode.GOOGLE_TOKEN_INVALID,
        user.passwordHash ? 'users.wrongPassword' : 'auth.googleInvalid',
      );
    }
    await Promise.all([
      this.sessions.deleteAll(userId),
      ...this.owned.map((module) => module.deleteAllOf(userId)),
      this.otps.deleteMany({ email: user.email }).exec(),
      this.photos.remove(user.profilePhotoUrl),
    ]);
    await this.userModel.deleteOne({ _id: user._id }).exec();
  }

  /** Replaces the photo with [bytes] (already checked to be an image). */
  async setPhoto(userId: string, bytes: Buffer, extension: string): Promise<UserDocument> {
    const user = await this.users.getById(userId);
    const previous = user.profilePhotoUrl;
    user.profilePhotoUrl = await this.photos.saveAvatar(bytes, extension);
    await user.save();
    await this.photos.remove(previous);
    return user;
  }

  async removePhoto(userId: string): Promise<UserDocument> {
    const user = await this.users.getById(userId);
    await this.photos.remove(user.profilePhotoUrl);
    user.profilePhotoUrl = null;
    return user.save();
  }

  private async matches(password: string | undefined, hash: string): Promise<boolean> {
    return password !== undefined && bcrypt.compare(password, hash);
  }

  private async withPassword(userId: string): Promise<UserDocument> {
    const found = await this.userModel.findById(userId).select('+passwordHash').exec();
    if (!found) return this.users.getById(userId); // throws "not found"
    return found;
  }
}
