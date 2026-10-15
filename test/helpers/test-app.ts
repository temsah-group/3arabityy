import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { type Connection } from 'mongoose';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { loadEnv } from '../../src/config/env.js';
import { createContainer, type Container } from '../../src/container.js';
import type { Mail, Mailer } from '../../src/modules/mail/mailer.js';

/** Keeps every email so tests can read the codes out of them. */
export class CapturingMailer implements Mailer {
  readonly sent: Mail[] = [];

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
  }

  /** The six-digit code from the latest email to [to]. */
  lastCode(to: string): string {
    const mail = this.sent.filter((item) => item.to === to).at(-1);
    const code = mail?.text.match(/\b\d{6}\b/)?.[0];
    if (!code) throw new Error(`No code was emailed to ${to}`);
    return code;
  }
}

export type TestApp = {
  api: ReturnType<typeof request>;
  mailer: CapturingMailer;
  container: Container;
  reset(): Promise<void>;
  close(): Promise<void>;
};

export async function startTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();
  const env = loadEnv({
    NODE_ENV: 'test',
    MONGO_URI: mongo.getUri('arabity-test'),
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789-abcdefghij',
    JWT_RESET_SECRET: 'test-reset-secret-0123456789-abcdefghijk',
  });
  const connection: Connection = await mongoose.createConnection(env.MONGO_URI).asPromise();
  const mailer = new CapturingMailer();
  const container = createContainer(connection, env, { mailer });
  await Promise.all(Object.values(container.models).map((model) => model.syncIndexes()));
  const api = request(createApp(container));

  return {
    api,
    mailer,
    container,
    async reset() {
      mailer.sent.length = 0;
      const { User, RefreshToken, Otp } = container.models;
      await Promise.all([User.deleteMany({}), RefreshToken.deleteMany({}), Otp.deleteMany({})]);
    },
    async close() {
      await connection.close();
      await mongo.stop();
    },
  };
}
