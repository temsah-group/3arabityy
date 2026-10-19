import bcrypt from 'bcrypt';

import { notFound } from '../../common/http/errors.js';
import type { UserDocument, UserModel } from './user.model.js';

const PASSWORD_HASH_ROUNDS = 12;

export class UsersService {
  constructor(private readonly users: UserModel) {}

  findById(id: string): Promise<UserDocument | null> {
    return this.users.findById(id).exec();
  }

  async getById(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw notFound('users.notFound');
    return user;
  }

  /** Includes the password hash, for sign-in only. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.users.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
  }

  findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.users.findOne({ googleId }).exec();
  }

  /** A confirmed account with no password; Google vouched for the email. */
  createFromGoogle(input: {
    fullName: string;
    email: string;
    phone: string;
    googleId: string;
  }): Promise<UserDocument> {
    return this.users.create({
      ...input,
      passwordHash: null,
      hasPassword: false,
      emailVerifiedAt: new Date(),
    });
  }

  /** Takes over an unconfirmed sign-up; its password was never proven, so it goes. */
  claimForGoogle(
    user: UserDocument,
    input: { fullName: string; phone: string; googleId: string },
  ): Promise<UserDocument> {
    user.set({
      ...input,
      passwordHash: null,
      hasPassword: false,
      passwordVersion: user.passwordVersion + 1,
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    return user.save();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.users.findOne({ email: email.toLowerCase() }).exec();
  }

  async create(input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<UserDocument> {
    return this.users.create({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
    });
  }

  /** Replaces the details of an account that was never confirmed. */
  async replaceUnverified(
    user: UserDocument,
    input: { fullName: string; phone: string; password: string },
  ): Promise<UserDocument> {
    user.fullName = input.fullName;
    user.phone = input.phone;
    user.passwordHash = await hashPassword(input.password);
    user.hasPassword = true;
    user.passwordVersion += 1;
    return user.save();
  }

  async markEmailVerified(user: UserDocument): Promise<UserDocument> {
    user.emailVerifiedAt ??= new Date();
    return user.save();
  }

  async setPassword(user: UserDocument, password: string): Promise<UserDocument> {
    user.passwordHash = await hashPassword(password);
    user.hasPassword = true;
    user.passwordVersion += 1;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    return user.save();
  }

  async updateProfile(
    userId: string,
    changes: { fullName?: string | undefined; phone?: string | undefined },
  ): Promise<UserDocument> {
    const user = await this.getById(userId);
    if (changes.fullName !== undefined) user.fullName = changes.fullName;
    if (changes.phone !== undefined) user.phone = changes.phone;
    return user.save();
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}
