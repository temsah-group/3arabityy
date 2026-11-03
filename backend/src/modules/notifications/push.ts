import { readFileSync } from 'node:fs';

import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';

import { logger } from '../../common/logger.js';
import type { Env } from '../../config/env.js';

/** One phone's copy of one notification, already in that phone's language. */
export type PushMessage = {
  token: string;
  title: string;
  body: string;
  /** What the app opens on a tap: `notificationId`, `kind`, `partId`. */
  data: Record<string, string>;
};

export interface PushSender {
  /** Sends what it can; returns the tokens that will never work again. */
  send(messages: PushMessage[]): Promise<{ deadTokens: string[] }>;
}

/** FCM's limit on one `sendEach` call. */
const FCM_BATCH = 500;

/** Tokens FCM will never deliver to: the app was removed, or the token is junk. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** The Android channel the app creates; FCM falls back to a default one without it. */
export const ANDROID_CHANNEL = 'arabity_default';

/** Real delivery through Firebase Cloud Messaging, to Android and iOS. */
export class FcmPushSender implements PushSender {
  private readonly app: App;

  /** [account] is the key downloaded from the Firebase console, already parsed. */
  constructor(account: Record<string, string>) {
    this.app = initializeApp({ credential: cert(account) }, 'push');
  }

  async send(messages: PushMessage[]): Promise<{ deadTokens: string[] }> {
    const deadTokens: string[] = [];
    for (let start = 0; start < messages.length; start += FCM_BATCH) {
      const batch = messages.slice(start, start + FCM_BATCH);
      const result = await getMessaging(this.app).sendEach(batch.map(toFcm));
      result.responses.forEach((response, index) => {
        if (response.success) return;
        const code = response.error?.code ?? 'unknown';
        if (DEAD_TOKEN_CODES.has(code)) deadTokens.push(batch[index]!.token);
        else logger.warn('Push not delivered', { code });
      });
    }
    return { deadTokens };
  }
}

function toFcm(message: PushMessage): Message {
  return {
    token: message.token,
    notification: { title: message.title, body: message.body },
    data: message.data,
    android: { priority: 'high', notification: { channelId: ANDROID_CHANNEL } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}

/** Development without Firebase: says what would have gone out. */
export class LogPushSender implements PushSender {
  async send(messages: PushMessage[]): Promise<{ deadTokens: string[] }> {
    if (messages.length > 0) {
      logger.info('Push (not sent, no Firebase key in FIREBASE_SERVICE_ACCOUNT or _FILE)', {
        count: messages.length,
        first: messages[0]!.title,
      });
    }
    return { deadTokens: [] };
  }
}

/** The key from `.env` itself, or else from the file it names; neither logs instead. */
export function createPushSender(env: Env): PushSender {
  if (env.FIREBASE_SERVICE_ACCOUNT) return new FcmPushSender(env.FIREBASE_SERVICE_ACCOUNT);
  if (env.FIREBASE_SERVICE_ACCOUNT_FILE) {
    const account = JSON.parse(readFileSync(env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8')) as Record<string, string>;
    return new FcmPushSender(account);
  }
  return new LogPushSender();
}
