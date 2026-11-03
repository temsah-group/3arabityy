import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

async function inbox(token: string, lang = 'ar') {
  const res = await app.api
    .get('/api/v1/notifications')
    .set(auth(token))
    .set('Accept-Language', lang)
    .expect(200);
  return res.body.data as {
    items: {
      id: string;
      kind: string;
      title: string;
      body: string;
      partId: string | null;
      read: boolean;
    }[];
    unreadCount: number;
    nextCursor: string | null;
  };
}

describe('saved parts', () => {
  it('saves, lists newest first, syncs, and forgets deleted parts', async () => {
    const seller = await signUp(app, 'seller@example.com', 'بائع');
    const buyer = await signUp(app, 'buyer@example.com');
    const a = await listPart(app, seller.token, { name: 'قطعة أولى' });
    const b = await listPart(app, seller.token, { name: 'قطعة تانية' });
    const c = await listPart(app, seller.token, { name: 'قطعة تالتة' });

    await app.api.put(`/api/v1/users/me/saved/${a.id}`).set(auth(buyer.token)).expect(204);
    // Saving twice is fine.
    await app.api.put(`/api/v1/users/me/saved/${a.id}`).set(auth(buyer.token)).expect(204);
    // Saved on the phone while signed out: b then c; unknown ids are skipped.
    await app.api
      .post('/api/v1/users/me/saved/sync')
      .set(auth(buyer.token))
      .send({ partIds: [b.id, 'p1', c.id] })
      .expect(204);

    let res = await app.api.get('/api/v1/users/me/saved').set(auth(buyer.token)).expect(200);
    expect(res.body.data.total).toBe(3);
    const ids = res.body.data.items.map((item: { id: string }) => item.id);
    expect(new Set(ids)).toEqual(new Set([a.id, b.id, c.id]));
    expect(ids.indexOf(c.id)).toBeLessThan(ids.indexOf(b.id));

    // Pages.
    res = await app.api.get('/api/v1/users/me/saved?limit=2').set(auth(buyer.token)).expect(200);
    expect(res.body.data.items).toHaveLength(2);
    const next = await app.api
      .get(`/api/v1/users/me/saved?limit=2&cursor=${res.body.data.nextCursor}`)
      .set(auth(buyer.token))
      .expect(200);
    expect(next.body.data.items).toHaveLength(1);
    expect(next.body.data.nextCursor).toBeNull();

    // Sold stays, marked; deleted goes.
    await app.api
      .post(`/api/v1/parts/${b.id}/sold`)
      .set(auth(seller.token))
      .send({ sold: true })
      .expect(200);
    await app.api.delete(`/api/v1/parts/${c.id}`).set(auth(seller.token)).expect(200);
    await app.api.delete(`/api/v1/users/me/saved/${a.id}`).set(auth(buyer.token)).expect(204);
    res = await app.api.get('/api/v1/users/me/saved').set(auth(buyer.token)).expect(200);
    expect(res.body.data.items).toEqual([expect.objectContaining({ id: b.id, isSold: true })]);
  });

  it('needs a session and an existing part', async () => {
    await app.api.get('/api/v1/users/me/saved').expect(401);
    const buyer = await signUp(app, 'buyer@example.com');
    const res = await app.api
      .put('/api/v1/users/me/saved/64b7f0000000000000000000')
      .set(auth(buyer.token))
      .expect(404);
    expect(res.body.code).toBe('PART_NOT_FOUND');
  });
});

describe('garage', () => {
  it('keeps up to five valid cars', async () => {
    const user = await signUp(app, 'driver@example.com');
    let res = await app.api.get('/api/v1/users/me/cars').set(auth(user.token)).expect(200);
    expect(res.body.data.items).toEqual([]);

    res = await app.api
      .put('/api/v1/users/me/cars')
      .set(auth(user.token))
      .send({ items: [corolla, { brandId: 'hyundai', modelId: 'elantra', year: 2015 }] })
      .expect(200);
    expect(res.body.data.items).toHaveLength(2);
    res = await app.api.get('/api/v1/users/me/cars').set(auth(user.token)).expect(200);
    expect(res.body.data.items[0]).toEqual(corolla);

    const six = [2015, 2016, 2017, 2018, 2019, 2020].map((year) => ({ ...corolla, year }));
    res = await app.api
      .put('/api/v1/users/me/cars')
      .set(auth(user.token))
      .send({ items: six })
      .expect(400);
    expect(res.body.code).toBe('TOO_MANY_CARS');

    for (const bad of [
      { brandId: 'toyota', modelId: 'nope', year: 2016 },
      { ...corolla, year: 1990 },
    ]) {
      res = await app.api
        .put('/api/v1/users/me/cars')
        .set(auth(user.token))
        .send({ items: [bad] })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
  });
});

describe('notifications', () => {
  it('tells owners of a fitting car about a new part, in their language', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const fits = await signUp(app, 'fits@example.com');
    const other = await signUp(app, 'other@example.com');
    const quiet = await signUp(app, 'quiet@example.com');
    for (const [user, car] of [
      [fits, corolla],
      [other, { ...corolla, year: 2010 }],
      [quiet, corolla],
    ] as const) {
      await app.api
        .put('/api/v1/users/me/cars')
        .set(auth(user.token))
        .send({ items: [car] })
        .expect(200);
    }
    await app.api
      .put('/api/v1/notifications/settings')
      .set(auth(quiet.token))
      .send({ fitsMyCar: false, priceDrops: true, news: false })
      .expect(200);
    // The seller has the car too, but hears nothing of their own part.
    await app.api
      .put('/api/v1/users/me/cars')
      .set(auth(seller.token))
      .send({ items: [corolla] })
      .expect(200);

    const part = await listPart(app, seller.token);

    const ar = await inbox(fits.token);
    expect(ar.unreadCount).toBe(1);
    expect(ar.items[0]).toMatchObject({
      kind: 'FITS_YOUR_CAR',
      title: 'قطعة جديدة تركب على عربيتك',
      body: 'طقم تيل فرامل أمامي بـ 1,250 جنيه في القاهرة',
      partId: part.id,
      read: false,
    });
    expect((await inbox(fits.token, 'en')).items[0]?.title).toBe('A new part fits your car');
    expect((await inbox(other.token)).items).toEqual([]);
    expect((await inbox(quiet.token)).items).toEqual([]);
    expect((await inbox(seller.token)).items).toEqual([]);
  });

  it('tells savers when a price drops, and reads and deletes', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const saver = await signUp(app, 'saver@example.com');
    const part = await listPart(app, seller.token);
    await app.api.put(`/api/v1/users/me/saved/${part.id}`).set(auth(saver.token)).expect(204);

    // Up is not news; down is.
    await app.api
      .patch(`/api/v1/parts/${part.id}`)
      .set(auth(seller.token))
      .send({ price: 1300 })
      .expect(200);
    await app.api
      .patch(`/api/v1/parts/${part.id}`)
      .set(auth(seller.token))
      .send({ price: 1100 })
      .expect(200);
    await app.api
      .patch(`/api/v1/parts/${part.id}`)
      .set(auth(seller.token))
      .send({ price: 1000 })
      .expect(200);

    let box = await inbox(saver.token);
    expect(box.items.map((item) => item.kind)).toEqual(['PRICE_DROP', 'PRICE_DROP']);
    expect(box.items[0]?.body).toBe('طقم تيل فرامل أمامي: من 1,100 لـ 1,000 جنيه');
    expect(box.unreadCount).toBe(2);

    const [first, second] = box.items;
    await app.api
      .post(`/api/v1/notifications/${first!.id}/read`)
      .set(auth(saver.token))
      .expect(204);
    expect((await inbox(saver.token)).unreadCount).toBe(1);
    // Someone else's notification is not found.
    await app.api
      .post(`/api/v1/notifications/${second!.id}/read`)
      .set(auth(seller.token))
      .expect(404);
    await app.api.post('/api/v1/notifications/read-all').set(auth(saver.token)).expect(204);
    expect((await inbox(saver.token)).unreadCount).toBe(0);
    await app.api.delete(`/api/v1/notifications/${second!.id}`).set(auth(saver.token)).expect(204);
    box = await inbox(saver.token);
    expect(box.items).toHaveLength(1);

    // Deleting the part takes its notifications with it.
    await app.api.delete(`/api/v1/parts/${part.id}`).set(auth(seller.token)).expect(200);
    expect((await inbox(saver.token)).items).toEqual([]);
  });

  it('keeps settings and push devices', async () => {
    const user = await signUp(app, 'user@example.com');
    let res = await app.api.get('/api/v1/notifications/settings').set(auth(user.token)).expect(200);
    expect(res.body.data).toEqual({ fitsMyCar: true, priceDrops: true, news: false });
    res = await app.api
      .put('/api/v1/notifications/settings')
      .set(auth(user.token))
      .send({ fitsMyCar: false, priceDrops: true, news: true })
      .expect(200);
    expect(res.body.data).toEqual({ fitsMyCar: false, priceDrops: true, news: true });
    await app.api
      .put('/api/v1/notifications/settings')
      .set(auth(user.token))
      .send({ fitsMyCar: false })
      .expect(400);

    const token = 'push-token-0123456789';
    await app.api
      .put(`/api/v1/notifications/devices/${token}`)
      .set(auth(user.token))
      .send({ platform: 'ios' })
      .expect(204);
    expect(await app.container.models.Device.countDocuments({ token })).toBe(1);
    await app.api
      .delete(`/api/v1/notifications/devices/${token}`)
      .set(auth(user.token))
      .expect(204);
    expect(await app.container.models.Device.countDocuments({ token })).toBe(0);
  });
});

describe('sellers', () => {
  it('shows a seller and what they have for sale', async () => {
    const seller = await signUp(app, 'seller@example.com', 'مخزن الأمانة');
    await listPart(app, seller.token, { city: 'الجيزة' });
    await listPart(app, seller.token, { category: 'FILTERS', city: 'الجيزة' });
    const sold = await listPart(app, seller.token, { city: 'القاهرة', phone: '+201001234599' });
    await app.api
      .post(`/api/v1/parts/${sold.id}/sold`)
      .set(auth(seller.token))
      .send({ sold: true })
      .expect(200);

    const res = await app.api.get(`/api/v1/sellers/${seller.id}`).expect(200);
    expect(res.body.data).toMatchObject({
      id: seller.id,
      name: 'مخزن الأمانة',
      city: 'الجيزة',
      verified: false,
      partsCount: 2,
      categoriesCount: 2,
      phone: '+201001234599',
    });
    expect(res.body.data.firstListedAt).toEqual(expect.any(String));

    const parts = await app.api.get(`/api/v1/sellers/${seller.id}/parts`).expect(200);
    expect(parts.body.data.total).toBe(2);
    const filters = await app.api
      .get(`/api/v1/sellers/${seller.id}/parts?category=FILTERS`)
      .expect(200);
    expect(filters.body.data.items).toHaveLength(1);

    for (const id of ['64b7f0000000000000000000', 'nope']) {
      const missing = await app.api.get(`/api/v1/sellers/${id}`).expect(404);
      expect(missing.body.code).toBe('SELLER_NOT_FOUND');
    }
  });
});

describe('reports', () => {
  it('takes one report per target with a reason that suits it', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const buyer = await signUp(app, 'buyer@example.com');
    const part = await listPart(app, seller.token);
    const report = (token: string, body: object) =>
      app.api.post('/api/v1/reports').set(auth(token)).send(body);

    await app.api
      .post('/api/v1/reports')
      .send({ target: 'PART', targetId: part.id, reason: 'FAKE' })
      .expect(401);
    await report(buyer.token, { target: 'PART', targetId: part.id, reason: 'FAKE' }).expect(201);
    let res = await report(buyer.token, {
      target: 'PART',
      targetId: part.id,
      reason: 'SCAM',
    }).expect(409);
    expect(res.body.code).toBe('ALREADY_REPORTED');

    // A part reason for a seller, "other" without words.
    res = await report(buyer.token, {
      target: 'SELLER',
      targetId: seller.id,
      reason: 'FAKE',
    }).expect(400);
    expect(res.body.errors[0].field).toBe('reason');
    res = await report(buyer.token, {
      target: 'SELLER',
      targetId: seller.id,
      reason: 'OTHER',
      details: 'لا',
    }).expect(400);
    expect(res.body.errors[0].field).toBe('details');
    await report(buyer.token, {
      target: 'SELLER',
      targetId: seller.id,
      reason: 'OTHER',
      details: 'بيطلب فلوس قبل المعاينة',
    }).expect(201);

    res = await report(seller.token, { target: 'PART', targetId: part.id, reason: 'FAKE' }).expect(
      400,
    );
    expect(res.body.code).toBe('CANNOT_REPORT_SELF');
    res = await report(buyer.token, {
      target: 'PART',
      targetId: '64b7f0000000000000000000',
      reason: 'FAKE',
    }).expect(404);
    expect(res.body.code).toBe('PART_NOT_FOUND');
  });
});

describe('deleting an account', () => {
  it('takes its saved parts, inbox, devices and reports', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const buyer = await signUp(app, 'buyer@example.com');
    await app.api
      .put('/api/v1/users/me/cars')
      .set(auth(buyer.token))
      .send({ items: [corolla] })
      .expect(200);
    const part = await listPart(app, seller.token);
    await app.api.put(`/api/v1/users/me/saved/${part.id}`).set(auth(buyer.token)).expect(204);
    await app.api
      .post('/api/v1/reports')
      .set(auth(buyer.token))
      .send({ target: 'PART', targetId: part.id, reason: 'FAKE' })
      .expect(201);
    await app.api
      .put('/api/v1/notifications/devices/push-token-0123456789')
      .set(auth(buyer.token))
      .send({ platform: 'android' })
      .expect(204);

    await app.api
      .delete('/api/v1/users/me')
      .set(auth(buyer.token))
      .send({ password: PASSWORD })
      .expect(200);
    const { models } = app.container;
    expect(await models.SavedPart.countDocuments()).toBe(0);
    expect(await models.Notification.countDocuments()).toBe(0);
    expect(await models.Device.countDocuments()).toBe(0);
    expect(await models.Report.countDocuments()).toBe(0);
  });
});
