import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

import mongoose from 'mongoose';

import { loadEnv } from '../config/env.js';
import { ADMIN_ROLES, createAdminModel, type AdminRole } from '../modules/admin/admin.model.js';
import { hashPassword } from '../modules/users/users.service.js';

const MIN_PASSWORD = 12;

const usage = `Makes a dashboard admin, or resets one's password and role.

  npm run admin:create -- --email you@example.com --name "Your Name" [--role OWNER|MODERATOR]

The password is asked for (twice) and never shown; set ADMIN_PASSWORD to
pass it without a prompt. A new password signs the admin out everywhere.`;

/** Reads a line without echoing what is typed. */
function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const output = rl as unknown as { _writeToOutput(text: string): void };
  let asked = false;
  output._writeToOutput = (text: string) => {
    if (!asked) {
      process.stdout.write(text);
      asked = true;
    }
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string', default: 'OWNER' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || !values.email || !values.name) {
    console.log(usage);
    process.exit(values.help ? 0 : 1);
  }
  const role = values.role?.toUpperCase() as AdminRole;
  if (!ADMIN_ROLES.includes(role))
    throw new Error(`--role must be one of ${ADMIN_ROLES.join(', ')}`);

  let password = process.env.ADMIN_PASSWORD ?? '';
  if (!password) {
    password = await askHidden('Password: ');
    if ((await askHidden('Again: ')) !== password) throw new Error('The passwords do not match');
  }
  if (password.length < MIN_PASSWORD) {
    throw new Error(`The password must be at least ${MIN_PASSWORD} characters`);
  }

  const env = loadEnv();
  const connection = await mongoose.createConnection(env.MONGO_URI).asPromise();
  try {
    const Admin = createAdminModel(connection);
    await Admin.syncIndexes();
    const email = values.email.trim().toLowerCase();
    const existing = await Admin.findOne({ email }).exec();
    await Admin.updateOne(
      { email },
      {
        $set: {
          fullName: values.name.trim(),
          role,
          passwordHash: await hashPassword(password),
          active: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        $inc: { passwordVersion: 1 },
      },
      { upsert: true },
    ).exec();
    console.log(`${existing ? 'Updated' : 'Created'} ${role} ${email}`);
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
