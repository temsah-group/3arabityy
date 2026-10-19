import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { adminToken, auth, listPart, shopInput, signUp } from './helpers/people.js';
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

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

async function apply(token: string, extra: object = {}) {
  const res = await app.api
    .post('/api/v1/shops')
    .set(auth(token))
    .send(shopInput(extra))
    .expect(201);
  return res.body.data as { id: string; status: string };
}

async function decide(admin: string, id: string, body: object, status = 200) {
  return app.api.patch(`/api/v1/admin/shops/${id}`).set(auth(admin)).send(body).expect(status);
}

async function inbox(token: string) {
  const res = await app.api.get('/api/v1/notifications').set(auth(token)).expect(200);
  return res.body.data.items as { kind: string; title: string; body: string; shopId: string }[];
}

describe('applying for a shop', () => {
  it('applies once, stays hidden until approved, and checks its fields', async () => {
    const owner = await signUp(app, 'owner@example.com', 'صاحب محل');
    expect((await app.api.get('/api/v1/shops/mine').set(auth(owner.token))).body.data).toBeNull();

    const bad = await app.api
      .post('/api/v1/shops')
      .set(auth(owner.token))
      .send(shopInput({ name: 'ab', delivery: { available: true, governorates: [] } }))
      .expect(400);
    const fields = bad.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'delivery.governorates']));

    const shop = await apply(owner.token);
    expect(shop.status).toBe('PENDING');
    await app.api.post('/api/v1/shops').set(auth(owner.token)).send(shopInput()).expect(409);

    // Buyers don't see it yet.
    await app.api.get(`/api/v1/shops/${shop.id}`).expect(404);
    expect((await app.api.get('/api/v1/shops')).body.data.items).toHaveLength(0);

    const mine = await app.api.get('/api/v1/shops/mine').set(auth(owner.token)).expect(200);
    expect(mine.body.data).toMatchObject({
      status: 'PENDING',
      delivery: { available: true, governorates: ['القاهرة', 'الجيزة'], feeFrom: 50 },
    });
    await app.api.post('/api/v1/shops').send(shopInput()).expect(401);
  });

  it('sets and removes the logo and cover', async () => {
    const owner = await signUp(app, 'owner@example.com');
    await apply(owner.token);
    const res = await app.api
      .post('/api/v1/shops/mine/logo')
      .set(auth(owner.token))
      .attach('photo', JPEG, 'logo.jpg')
      .expect(200);
    expect(res.body.data.logoUrl).toMatch(/^\/uploads\/shops\/.+\.jpg$/);
    await app.api
      .post('/api/v1/shops/mine/cover')
      .set(auth(owner.token))
      .attach('photo', Buffer.from('not an image'), 'x.jpg')
      .expect(400);
    const removed = await app.api
      .delete('/api/v1/shops/mine/logo')
      .set(auth(owner.token))
      .expect(200);
    expect(removed.body.data.logoUrl).toBeNull();
  });
});

describe('moderating shops', () => {
  it('approves a shop: it opens, takes the parts and tells its owner', async () => {
    const owner = await signUp(app, 'owner@example.com', 'صاحب محل');
    const before = await listPart(app, owner.token, { name: 'قطعة قبل المحل' });
    const shop = await apply(owner.token);
    const admin = await adminToken(app);

    const list = await app.api
      .get('/api/v1/admin/shops?status=PENDING')
      .set(auth(admin))
      .expect(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.counts).toEqual({ PENDING: 1 });
    expect(list.body.data.items[0].owner.email).toBe('owner@example.com');

    await decide(admin, shop.id, { status: 'APPROVED' });

    const open = await app.api.get(`/api/v1/shops/${shop.id}`).expect(200);
    expect(open.body.data).toMatchObject({ name: 'محل النور لقطع الغيار', partsCount: 1 });
    expect(open.body.data.status).toBeUndefined();

    // Old and new parts carry the shop.
    const after = await listPart(app, owner.token, { name: 'قطعة بعد المحل' });
    for (const id of [before.id, after.id]) {
      const part = await app.api.get(`/api/v1/parts/${id}`).expect(200);
      expect(part.body.data.shop).toMatchObject({ id: shop.id, delivers: true });
    }
    const parts = await app.api.get(`/api/v1/shops/${shop.id}/parts`).expect(200);
    expect(parts.body.data.items).toHaveLength(2);

    // The seller page points at the shop.
    const seller = await app.api.get(`/api/v1/sellers/${owner.id}`).expect(200);
    expect(seller.body.data.shopId).toBe(shop.id);

    await app.container.notifications.flush();
    const [notice] = await inbox(owner.token);
    expect(notice).toMatchObject({ kind: 'SHOP', title: 'محلك اتقبل 🎉', shopId: shop.id });

    const history = await app.api.get(`/api/v1/admin/shops/${shop.id}`).set(auth(admin));
    expect(history.body.data.history[0].action).toBe('SHOP_APPROVED');
  });

  it('rejects with a reason; editing sends it back for review', async () => {
    const owner = await signUp(app, 'owner@example.com');
    const shop = await apply(owner.token);
    const admin = await adminToken(app, 'MODERATOR');

    await decide(admin, shop.id, { status: 'REJECTED' }, 400);
    await decide(admin, shop.id, { status: 'REJECTED', note: 'العنوان ناقص' });
    const mine = await app.api.get('/api/v1/shops/mine').set(auth(owner.token));
    expect(mine.body.data).toMatchObject({ status: 'REJECTED', statusReason: 'العنوان ناقص' });
    const [notice] = await inbox(owner.token);
    expect(notice!.body).toContain('العنوان ناقص');

    const edited = await app.api
      .patch('/api/v1/shops/mine')
      .set(auth(owner.token))
      .send({ address: '12 شارع التحرير، الدقي، الجيزة' })
      .expect(200);
    expect(edited.body.data).toMatchObject({ status: 'PENDING', statusReason: null });

    // Featuring and badges are for owners.
    await decide(admin, shop.id, { featured: true }, 403);
  });

  it('suspending a shop or its owner hides it; featured shops lead the list', async () => {
    const a = await signUp(app, 'a@example.com');
    const b = await signUp(app, 'b@example.com');
    const shopA = await apply(a.token, { name: 'محل أ' });
    const shopB = await apply(b.token, { name: 'محل ب', city: 'الجيزة', delivery: undefined });
    const admin = await adminToken(app);
    await decide(admin, shopA.id, { status: 'APPROVED' });
    await decide(admin, shopB.id, { status: 'APPROVED', featured: true, verified: true });

    let res = await app.api.get('/api/v1/shops').expect(200);
    expect(res.body.data.items.map((s: { id: string }) => s.id)).toEqual([shopB.id, shopA.id]);
    expect(res.body.data.items[0]).toMatchObject({ featured: true, verified: true });

    res = await app.api.get(`/api/v1/shops?deliversTo=${encodeURIComponent('الجيزة')}`);
    expect(res.body.data.items.map((s: { id: string }) => s.id)).toEqual([shopA.id]);
    res = await app.api.get(`/api/v1/shops?q=${encodeURIComponent('محل ب')}`);
    expect(res.body.data.items).toHaveLength(1);
    res = await app.api.get('/api/v1/shops?limit=1');
    expect(res.body.data.nextCursor).toBe('1');
    res = await app.api.get('/api/v1/shops?limit=1&cursor=1');
    expect(res.body.data.items[0].id).toBe(shopA.id);

    const home = await app.api.get('/api/v1/parts/home').expect(200);
    expect(home.body.data.shops.map((s: { id: string }) => s.id)).toEqual([shopB.id, shopA.id]);

    await decide(admin, shopB.id, { status: 'SUSPENDED', note: 'شكاوى كتير' });
    await app.api.get(`/api/v1/shops/${shopB.id}`).expect(404);
    await app.api.patch('/api/v1/shops/mine').set(auth(b.token)).send({ hours: 'x' }).expect(403);

    // The owner's suspension hides their shop too, until restored.
    await app.api
      .patch(`/api/v1/admin/users/${a.id}`)
      .set(auth(admin))
      .send({ status: 'SUSPENDED', note: 'احتيال' })
      .expect(200);
    await app.api.get(`/api/v1/shops/${shopA.id}`).expect(404);
    await app.api
      .patch(`/api/v1/admin/users/${a.id}`)
      .set(auth(admin))
      .send({ status: 'ACTIVE', note: 'تمام' })
      .expect(200);
    await app.api.get(`/api/v1/shops/${shopA.id}`).expect(200);
  });

  it('deleting the account deletes its shop', async () => {
    const owner = await signUp(app, 'owner@example.com');
    const shop = await apply(owner.token);
    await app.api
      .delete('/api/v1/users/me')
      .set(auth(owner.token))
      .send({ password: 'Sup3rSecret!' })
      .expect(200);
    expect(await app.container.models.Shop.findById(shop.id)).toBeNull();
  });
});
