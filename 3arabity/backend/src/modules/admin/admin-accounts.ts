import bcrypt from 'bcrypt';

import type { Env } from '../../config/env.js';
import { hashPassword } from '../users/users.service.js';
import type { AdminModel } from './admin.model.js';

/**
 * Makes the admins listed in `ADMIN_ACCOUNTS`, or brings each up to date: its
 * name, its role and, when it differs, its password (which signs it out
 * everywhere). Admins not in the list are left as they are.
 */
export async function syncAdminAccounts(
  admins: AdminModel,
  accounts: Env['ADMIN_ACCOUNTS'],
): Promise<{ created: string[]; updated: string[] }> {
  const created: string[] = [];
  const updated: string[] = [];
  for (const account of accounts) {
    const existing = await admins.findOne({ email: account.email }).select('+passwordHash').exec();
    if (!existing) {
      await admins.create({
        email: account.email,
        fullName: account.name,
        role: account.role,
        passwordHash: await hashPassword(account.password),
      });
      created.push(account.email);
      continue;
    }
    const samePassword = await bcrypt.compare(account.password, existing.passwordHash);
    const changed =
      !samePassword ||
      existing.fullName !== account.name ||
      existing.role !== account.role ||
      !existing.active;
    if (!changed) continue;
    existing.fullName = account.name;
    existing.role = account.role;
    existing.active = true;
    if (!samePassword) {
      existing.passwordHash = await hashPassword(account.password);
      existing.passwordVersion += 1;
      existing.failedLoginAttempts = 0;
      existing.lockedUntil = null;
    }
    await existing.save();
    updated.push(account.email);
  }
  return { created, updated };
}
