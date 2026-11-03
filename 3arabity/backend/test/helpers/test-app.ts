import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { type Connection } from 'mongoose';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { loadEnv } from '../../src/config/env.js';
import { createContainer, type Container } from '../../src/container.js';
import type { GoogleIdentity, GoogleVerifier } from '../../src/modules/auth/google.js';
import type { Mail, Mailer } from '../../src/modules/mail/mailer.js';
import type { PushMessage, PushSender } from '../../src/modules/notifications/push.js';

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

/** Accepts the tokens made by [token]; anything else is rejected like a forgery. */
export class FakeGoogle implements GoogleVerifier {
  private readonly issued = new Map<string, GoogleIdentity>();

  token(identity: GoogleIdentity): string {
    const idToken = `google-token-${this.issued.size + 1}`;
    this.issued.set(idToken, identity);
    return idToken;
  }

  async verify(idToken: string): Promise<GoogleIdentity | null> {
    return this.issued.get(idToken) ?? null;
  }
}

/** Keeps every push; tokens in [dead] are reported gone, like an uninstalled app. */
export class CapturingPush implements PushSender {
  readonly sent: PushMessage[] = [];
  readonly dead = new Set<string>();

  async send(messages: PushMessage[]): Promise<{ deadTokens: string[] }> {
    this.sent.push(...messages);
    return { deadTokens: messages.map((m) => m.token).filter((token) => this.dead.has(token)) };
  }
}

export type TestApp = {
  api: ReturnType<typeof request>;
  mailer: CapturingMailer;
  google: FakeGoogle;
  push: CapturingPush;
  container: Container;
  reset(): Promise<void>;
  close(): Promise<void>;
};

export async function startTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();
  const uploads = await mkdtemp(path.join(tmpdir(), 'arabity-uploads-'));
  const env = loadEnv({
    UPLOADS_DIR: uploads,
    NODE_ENV: 'test',
    MONGO_URI: mongo.getUri('arabity-test'),
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789-abcdefghij',
    JWT_RESET_SECRET: 'test-reset-secret-0123456789-abcdefghijk',
    ADMIN_JWT_SECRET: 'test-admin-secret-0123456789-abcdefghijkl',
    ADMIN_ORIGINS: 'https://admin.example.com',
    SITE_URL: 'https://3rbyty.example',
  });
  const connection: Connection = await mongoose.createConnection(env.MONGO_URI).asPromise();
  const mailer = new CapturingMailer();
  const google = new FakeGoogle();
  const push = new CapturingPush();
  const container = createContainer(connection, env, { mailer, google, push });
  await Promise.all(Object.values(container.models).map((model) => model.syncIndexes()));
  const api = request(createApp(container));

  return {
    api,
    mailer,
    google,
    push,
    container,
    async reset() {
      await container.notifications.flush();
      mailer.sent.length = 0;
      push.sent.length = 0;
      push.dead.clear();
      // Every collection, so each test starts empty.
      await Promise.all(
        Object.values(container.connection.collections).map((collection) =>
          collection.deleteMany({}),
        ),
      );
    },
    async close() {
      await connection.close();
      await mongo.stop();
      await rm(uploads, { recursive: true, force: true });
    },
  };
}
