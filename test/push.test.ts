import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../src/modules/users/users.service.js';
import { auth, listPart, PASSWORD, signUp } from './helpers/people.js';
import { startTestApp, type TestApp } from './helpers/test-app.js';

let app: TestApp;

beforeAll(async () => {
  app = await startTestApp();
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  await app.reset();
});

const corolla = { brandId: 'toyota', modelId: 'corolla', year: 2016 };

function registerPhone(token: string, pushToken: string, lang = 'ar', platform = 'android') {
  return app.api
    .put(`/api/v1/notifications/devices/${pushToken}`)
    .set(auth(token))
    .set('Accept-Language', lang)
    .send({ platform })
    .expect(204);
}

async function withCar(email: string) {
  const user = await signUp(app, email);
  await app.api
    .put('/api/v1/users/me/cars')
    .set(auth(user.token))
    .send({ items: [corolla] })
    .expect(200);
  return user;
}

/** Waits for the pushes started by the last request. */
async function pushed() {
  await app.container.notifications.flush();
  return app.push.sent;
}

describe('push', () => {
  it('goes to every phone of the user, each in its own language', async () => {
    const buyer = await withCar('buyer@example.com');
    const seller = await signUp(app, 'seller@example.com');
    await registerPhone(buyer.token, 'phone-ar-token', 'ar');
    await registerPhone(buyer.token, 'tablet-en-token', 'en', 'ios');
    await registerPhone(seller.token, 'seller-phone-token');

    const part = await listPart(app, seller.token);
    const sent = await pushed();

    expect(sent).toHaveLength(2);
    const [inbox] = (await app.api.get('/api/v1/notifications').set(auth(buyer.token)).expect(200))
      .body.data.items;
    expect(sent.find((m) => m.token === 'phone-ar-token')).toEqual({
      token: 'phone-ar-token',
      title: 'قطعة جديدة تركب على عربيتك',
      body: 'طقم تيل فرامل أمامي بـ 1,250 جنيه في القاهرة',
      data: { notificationId: inbox.id, kind: 'FITS_YOUR_CAR', partId: part.id },
    });
    expect(sent.find((m) => m.token === 'tablet-en-token')?.title).toBe('A new part fits your car');
    // The seller's own part tells them nothing.
    expect(sent.some((m) => m.token === 'seller-phone-token')).toBe(false);
  });

  it('follows the user when a phone changes hands', async () => {
    const first = await withCar('first@example.com');
    const second = await signUp(app, 'second@example.com');
    const seller = await signUp(app, 'seller@example.com');
    await registerPhone(first.token, 'shared-phone-token');
    await registerPhone(second.token, 'shared-phone-token');

    await listPart(app, seller.token);
    expect(await pushed()).toEqual([]);
  });

  it('stops after sign-out, and forgets tokens FCM says are gone', async () => {
    const buyer = await withCar('buyer@example.com');
    const seller = await signUp(app, 'seller@example.com');
    await registerPhone(buyer.token, 'old-phone-token');
    await registerPhone(buyer.token, 'uninstalled-token');
    await registerPhone(buyer.token, 'signed-out-token');
    await app.api
      .delete('/api/v1/notifications/devices/signed-out-token')
      .set(auth(buyer.token))
      .expect(204);
    app.push.dead.add('uninstalled-token');

    await listPart(app, seller.token);
    expect((await pushed()).map((m) => m.token).sort()).toEqual([
      'old-phone-token',
      'uninstalled-token',
    ]);
    const left = await app.container.models.Device.find().select('token').lean();
    expect(left.map((d) => d.token)).toEqual(['old-phone-token']);
  });

  it('carries announcements from the dashboard', async () => {
    const buyer = await signUp(app, 'buyer@example.com');
    await registerPhone(buyer.token, 'phone-en-token', 'en');
    await app.container.models.Admin.create({
      email: 'owner@3arabity.com',
      fullName: 'Owner',
      role: 'OWNER',
      passwordHash: await hashPassword(PASSWORD),
    });
    const login = await app.api
      .post('/api/v1/admin/auth/login')
      .send({ email: 'owner@3arabity.com', password: PASSWORD })
      .expect(200);
    await app.api
      .post('/api/v1/admin/announcements')
      .set(auth(login.body.data.accessToken))
      .send({
        titleAr: 'عرض الصيف',
        titleEn: 'Summer offer',
        bodyAr: 'انشر قطعتك ببلاش',
        bodyEn: 'List for free',
        audience: 'ALL',
        inbox: true,
        banner: false,
      })
      .expect(201);

    const [message] = await pushed();
    expect(message).toMatchObject({
      token: 'phone-en-token',
      title: 'Summer offer',
      body: 'List for free',
      data: { kind: 'SYSTEM' },
    });
    expect(message?.data.partId).toBeUndefined();
  });

  it('a failing sender leaves the inbox and the request alone', async () => {
    const buyer = await withCar('buyer@example.com');
    const seller = await signUp(app, 'seller@example.com');
    await registerPhone(buyer.token, 'only-phone-token');
    const original = app.push.send.bind(app.push);
    app.push.send = () => Promise.reject(new Error('FCM is down'));
    try {
      await listPart(app, seller.token);
      await app.container.notifications.flush();
    } finally {
      app.push.send = original;
    }
    const inbox = await app.api.get('/api/v1/notifications').set(auth(buyer.token)).expect(200);
    expect(inbox.body.data.items).toHaveLength(1);
  });
});
