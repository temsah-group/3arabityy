import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { setCarBrands } from '../src/modules/catalog/catalog.js';
import { hashPassword } from '../src/modules/users/users.service.js';
import { auth, listPart, PASSWORD, signUp } from './helpers/people.js';
import { startTestApp, type TestApp } from './helpers/test-app.js';

let app: TestApp;
let adminHash: string;

beforeAll(async () => {
  app = await startTestApp();
  adminHash = await hashPassword(PASSWORD);
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  await app.reset();
  // An earlier test may have saved its own cars.
  setCarBrands(null);
});

const ADMIN = '/api/v1/admin';

/** Makes an admin with [role] and signs in; returns the dashboard token. */
async function admin(
  role: 'OWNER' | 'MODERATOR' = 'OWNER',
  email = `${role.toLowerCase()}@3arabity.com`,
) {
  await app.container.models.Admin.create({
    email,
    fullName: 'Admin',
    role,
    passwordHash: adminHash,
  });
  const res = await app.api
    .post(`${ADMIN}/auth/login`)
    .send({ email, password: PASSWORD })
    .expect(200);
  return res.body.data.accessToken as string;
}

async function report(token: string, target: 'PART' | 'SELLER', targetId: string, reason: string) {
  await app.api
    .post('/api/v1/reports')
    .set(auth(token))
    .send({ target, targetId, reason })
    .expect(201);
}

async function inbox(token: string) {
  const res = await app.api.get('/api/v1/notifications').set(auth(token)).expect(200);
  return res.body.data.items as {
    kind: string;
    title: string;
    body: string;
    partId: string | null;
  }[];
}

describe('dashboard sign-in', () => {
  it('signs admins in; app tokens and wrong passwords get nowhere', async () => {
    const token = await admin();
    const me = await app.api.get(`${ADMIN}/auth/me`).set(auth(token)).expect(200);
    expect(me.body.data).toMatchObject({ email: 'owner@3arabity.com', role: 'OWNER' });
    expect(me.body.data.passwordHash).toBeUndefined();

    await app.api.get(`${ADMIN}/overview`).expect(401);
    const user = await signUp(app, 'buyer@example.com');
    await app.api.get(`${ADMIN}/overview`).set(auth(user.token)).expect(401);
    // Nor does an admin token open the app's own routes.
    await app.api.get('/api/v1/users/me').set(auth(token)).expect(401);

    await app.api
      .post(`${ADMIN}/auth/login`)
      .send({ email: 'owner@3arabity.com', password: 'wrong-password' })
      .expect(401);
    // An app account's password does not open the dashboard.
    await app.api
      .post(`${ADMIN}/auth/login`)
      .send({ email: 'buyer@example.com', password: PASSWORD })
      .expect(401);
  });

  it('locks after five wrong passwords and ends tokens on a new password', async () => {
    const token = await admin();
    for (let i = 0; i < 5; i++) {
      await app.api
        .post(`${ADMIN}/auth/login`)
        .send({ email: 'owner@3arabity.com', password: 'wrong-password' })
        .expect(401);
    }
    const locked = await app.api
      .post(`${ADMIN}/auth/login`)
      .send({ email: 'owner@3arabity.com', password: PASSWORD })
      .expect(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');

    await app.container.models.Admin.updateOne(
      { email: 'owner@3arabity.com' },
      { $inc: { passwordVersion: 1 } },
    );
    await app.api.get(`${ADMIN}/overview`).set(auth(token)).expect(401);
  });

  it("allows the dashboard's origin only", async () => {
    const allowed = await app.api
      .options(`${ADMIN}/auth/login`)
      .set('Origin', 'https://admin.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://admin.example.com');
    const other = await app.api
      .options(`${ADMIN}/auth/login`)
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('reports', () => {
  it('groups reports by part, and removing the part closes them and tells the seller', async () => {
    const seller = await signUp(app, 'seller@example.com', 'مخزن الأمانة');
    const a = await signUp(app, 'a@example.com');
    const b = await signUp(app, 'b@example.com');
    const part = await listPart(app, seller.token);
    await report(a.token, 'PART', part.id, 'FAKE');
    await report(b.token, 'PART', part.id, 'SCAM');
    await report(a.token, 'SELLER', seller.id, 'UNREACHABLE');
    const token = await admin('MODERATOR');

    const list = await app.api.get(`${ADMIN}/reports`).set(auth(token)).expect(200);
    expect(list.body.data.total).toBe(2);
    const group = list.body.data.items.find((item: { target: string }) => item.target === 'PART');
    expect(group).toMatchObject({
      targetId: part.id,
      count: 2,
      reasons: { FAKE: 1, SCAM: 1 },
      subject: { id: part.id, seller: { id: seller.id, email: 'seller@example.com' } },
    });

    const detail = await app.api
      .get(`${ADMIN}/reports/PART/${part.id}`)
      .set(auth(token))
      .expect(200);
    expect(detail.body.data.reports).toHaveLength(2);
    expect(detail.body.data.reports[0].reporter.email).toMatch(/@example\.com$/);

    // Anything but dismissing needs a reason.
    const bare = await app.api
      .post(`${ADMIN}/reports/PART/${part.id}/resolve`)
      .set(auth(token))
      .send({ action: 'REMOVE_PART' })
      .expect(400);
    expect(bare.body.code).toBe('NOTE_REQUIRED');

    const done = await app.api
      .post(`${ADMIN}/reports/PART/${part.id}/resolve`)
      .set(auth(token))
      .send({ action: 'REMOVE_PART', note: 'إعلان وهمي' })
      .expect(200);
    expect(done.body.data.closed).toBe(2);
    await app.api.get(`/api/v1/parts/${part.id}`).expect(404);
    const notices = await inbox(seller.token);
    expect(notices[0]).toMatchObject({ kind: 'LISTING', title: 'إعلانك اتشال', partId: null });

    const open = await app.api.get(`${ADMIN}/reports`).set(auth(token)).expect(200);
    expect(open.body.data.items.map((item: { target: string }) => item.target)).toEqual(['SELLER']);
    const closed = await app.api.get(`${ADMIN}/reports?status=CLOSED`).set(auth(token)).expect(200);
    expect(closed.body.data.items[0]).toMatchObject({ targetId: part.id, subject: null });
    await app.api.get(`${ADMIN}/reports/NOPE/${part.id}`).set(auth(token)).expect(404);
  });
});

describe('accounts', () => {
  it('suspending signs the seller out and hides their parts until restored', async () => {
    const seller = await signUp(app, 'seller@example.com', 'مخزن الأمانة');
    const buyer = await signUp(app, 'buyer@example.com');
    const part = await listPart(app, seller.token);
    const token = await admin('MODERATOR');

    const found = await app.api.get(`${ADMIN}/users?q=seller@`).set(auth(token)).expect(200);
    expect(found.body.data.items).toHaveLength(1);
    expect(found.body.data.items[0]).toMatchObject({ id: seller.id, partsCount: 1 });

    await app.api
      .patch(`${ADMIN}/users/${seller.id}`)
      .set(auth(token))
      .send({ status: 'SUSPENDED' })
      .expect(400);
    const suspended = await app.api
      .patch(`${ADMIN}/users/${seller.id}`)
      .set(auth(token))
      .send({ status: 'SUSPENDED', note: 'نصب على مشترين' })
      .expect(200);
    expect(suspended.body.data).toMatchObject({
      accountStatus: 'SUSPENDED',
      parts: { forSale: 0, hidden: 1 },
      history: [{ action: 'USER_SUSPENDED', note: 'نصب على مشترين' }],
    });

    const blocked = await app.api.get('/api/v1/users/me').set(auth(seller.token)).expect(401);
    expect(blocked.body.code).toBe('SESSION_REVOKED');
    await app.api.get(`/api/v1/parts/${part.id}`).set(auth(buyer.token)).expect(404);
    const search = await app.api.get('/api/v1/parts').expect(200);
    expect(search.body.data.total).toBe(0);
    await app.api.get(`/api/v1/sellers/${seller.id}`).expect(200);

    await app.api
      .patch(`${ADMIN}/users/${seller.id}`)
      .set(auth(token))
      .send({ status: 'ACTIVE', note: 'اتحلّت المشكلة' })
      .expect(200);
    await app.api.get(`/api/v1/parts/${part.id}`).expect(200);
    await app.api
      .post('/api/v1/auth/login')
      .send({ identifier: 'seller@example.com', password: PASSWORD })
      .expect(200);
  });

  it('only owners verify sellers, and only owners read the log', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const moderator = await admin('MODERATOR');
    const owner = await admin('OWNER');

    const refused = await app.api
      .patch(`${ADMIN}/users/${seller.id}`)
      .set(auth(moderator))
      .send({ verified: true })
      .expect(403);
    expect(refused.body.code).toBe('ADMIN_ROLE_REQUIRED');
    await app.api
      .patch(`${ADMIN}/users/${seller.id}`)
      .set(auth(owner))
      .send({ verified: true })
      .expect(200);
    const profile = await app.api.get(`/api/v1/sellers/${seller.id}`).expect(200);
    expect(profile.body.data.verified).toBe(true);

    await app.api.get(`${ADMIN}/audit`).set(auth(moderator)).expect(403);
    const log = await app.api.get(`${ADMIN}/audit`).set(auth(owner)).expect(200);
    expect(log.body.data.items[0]).toMatchObject({
      action: 'SELLER_VERIFIED',
      adminEmail: 'owner@3arabity.com',
      targetId: seller.id,
    });
    await app.api.get(`${ADMIN}/users/0123456789abcdef01234567`).set(auth(owner)).expect(404);
  });
});

describe('listings', () => {
  it('hides and shows a part, telling its seller, and features it', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const buyer = await signUp(app, 'buyer@example.com');
    const part = await listPart(app, seller.token);
    await app.api.put(`/api/v1/users/me/saved/${part.id}`).set(auth(buyer.token)).expect(204);
    const token = await admin();

    await app.api
      .patch(`${ADMIN}/parts/${part.id}`)
      .set(auth(token))
      .send({ hidden: true, note: 'صور مش للقطعة' })
      .expect(200);
    // Gone for buyers, still there for its seller.
    await app.api.get(`/api/v1/parts/${part.id}`).expect(404);
    const saved = await app.api.get('/api/v1/users/me/saved').set(auth(buyer.token)).expect(200);
    expect(saved.body.data.items).toHaveLength(0);
    const own = await app.api.get(`/api/v1/parts/${part.id}`).set(auth(seller.token)).expect(200);
    expect(own.body.data.isHidden).toBe(true);
    expect((await inbox(seller.token))[0]).toMatchObject({ kind: 'LISTING', partId: part.id });

    const hidden = await app.api.get(`${ADMIN}/parts?status=HIDDEN`).set(auth(token)).expect(200);
    expect(hidden.body.data.items[0]).toMatchObject({ id: part.id, hiddenReason: 'ADMIN' });
    // Its photos load in the dashboard, on another domain.
    const photo = await app.api.get(hidden.body.data.items[0].images[0]).expect(200);
    expect(photo.headers['cross-origin-resource-policy']).toBe('cross-origin');

    await app.api
      .patch(`${ADMIN}/parts/${part.id}`)
      .set(auth(token))
      .send({ hidden: false, featured: true, note: 'اتعدّلت' })
      .expect(200);
    const featured = await app.api.get('/api/v1/parts/featured').expect(200);
    expect(featured.body.data.items.map((p: { id: string }) => p.id)).toEqual([part.id]);

    const moderator = await admin('MODERATOR');
    await app.api
      .patch(`${ADMIN}/parts/${part.id}`)
      .set(auth(moderator))
      .send({ featured: false })
      .expect(403);
  });

  it('removes a part for good', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const part = await listPart(app, seller.token);
    const token = await admin('MODERATOR');
    await app.api.delete(`${ADMIN}/parts/${part.id}`).set(auth(token)).send({}).expect(400);
    await app.api
      .delete(`${ADMIN}/parts/${part.id}`)
      .set(auth(token))
      .send({ note: 'قطعة مسروقة' })
      .expect(200);
    await app.api.get(`${ADMIN}/parts/${part.id}`).set(auth(token)).expect(404);
    const overview = await app.api.get(`${ADMIN}/overview`).set(auth(token)).expect(200);
    expect(overview.body.data).toMatchObject({
      users: { total: 1 },
      parts: { forSale: 0 },
      reports: { openTargets: 0 },
    });
  });
});

describe('app settings', () => {
  it('serves the launch texts until an owner edits them', async () => {
    const config = await app.api.get('/api/v1/app-config').expect(200);
    expect(config.headers['cache-control']).toContain('max-age');
    // No made-up contacts: support is the dashboard's to set.
    expect(config.body.data.support).toBeNull();
    expect(config.body.data.terms.sections.length).toBeGreaterThan(3);
    expect(config.body.data.faq.sections[0].titleAr).toBeTruthy();

    const moderator = await admin('MODERATOR');
    await app.api
      .put(`${ADMIN}/settings/support`)
      .set(auth(moderator))
      .send({ email: 'help@3arabity.com', phone: '+201112223334', whatsapp: '+201112223334' })
      .expect(403);

    const owner = await admin('OWNER');
    await app.api
      .put(`${ADMIN}/settings/support`)
      .set(auth(owner))
      .send({ email: 'not-an-email', phone: '+201112223334', whatsapp: '+201112223334' })
      .expect(400);
    await app.api
      .put(`${ADMIN}/settings/support`)
      .set(auth(owner))
      .send({ email: 'help@3arabity.com', phone: '+201112223334', whatsapp: '+201112223335' })
      .expect(200);
    const privacy = [
      { titleAr: 'بياناتك', titleEn: 'Your data', bodyAr: 'نص جديد', bodyEn: 'New text' },
    ];
    await app.api
      .put(`${ADMIN}/settings/documents/privacy`)
      .set(auth(owner))
      .send({ sections: privacy })
      .expect(200);
    await app.api
      .put(`${ADMIN}/settings/documents/privacy`)
      .set(auth(owner))
      .send({ sections: [] })
      .expect(400);
    await app.api
      .put(`${ADMIN}/settings/documents/cookies`)
      .set(auth(owner))
      .send({ sections: privacy })
      .expect(404);

    const after = (await app.api.get('/api/v1/app-config').expect(200)).body.data;
    expect(after.support).toEqual({
      email: 'help@3arabity.com',
      phone: '+201112223334',
      whatsapp: '+201112223335',
    });
    expect(after.privacy.sections).toEqual(privacy);
    expect(new Date(after.privacy.updatedAt).getTime()).toBeGreaterThan(
      new Date(config.body.data.privacy.updatedAt).getTime(),
    );
    // The terms were not touched.
    expect(after.terms).toEqual(config.body.data.terms);

    const log = await app.api.get(`${ADMIN}/audit`).set(auth(owner)).expect(200);
    expect(
      log.body.data.items.map((e: { action: string; targetId: string }) => [e.action, e.targetId]),
    ).toEqual([
      ['DOCUMENT_UPDATED', 'privacy'],
      ['SUPPORT_UPDATED', 'support'],
    ]);
  });
});

describe('announcements', () => {
  const message = {
    titleAr: 'عرض الصيف',
    titleEn: 'Summer offer',
    bodyAr: 'انشر قطعتك ببلاش الشهر ده',
    bodyEn: 'List your part for free this month',
  };

  it('reaches every active inbox in its language, and the home screen', async () => {
    const buyer = await signUp(app, 'buyer@example.com');
    const seller = await signUp(app, 'seller@example.com');
    const suspended = await signUp(app, 'gone@example.com');
    await listPart(app, seller.token);
    const moderator = await admin('MODERATOR');
    const owner = await admin('OWNER');
    await app.api
      .patch(`${ADMIN}/users/${suspended.id}`)
      .set(auth(owner))
      .send({ status: 'SUSPENDED', note: 'spam' })
      .expect(200);

    await app.api
      .post(`${ADMIN}/announcements`)
      .set(auth(moderator))
      .send({ ...message, audience: 'ALL', inbox: true, banner: true })
      .expect(403);
    await app.api
      .post(`${ADMIN}/announcements`)
      .set(auth(owner))
      .send({ ...message, audience: 'ALL', inbox: false, banner: false })
      .expect(400);

    const sent = await app.api
      .post(`${ADMIN}/announcements`)
      .set(auth(owner))
      .send({ ...message, audience: 'ALL', inbox: true, banner: true })
      .expect(201);
    expect(sent.body.data).toMatchObject({ recipients: 2, bannerLive: true });

    expect((await inbox(buyer.token))[0]).toMatchObject({
      kind: 'SYSTEM',
      title: 'عرض الصيف',
      body: 'انشر قطعتك ببلاش الشهر ده',
    });
    const english = await app.api
      .get('/api/v1/notifications')
      .set(auth(seller.token))
      .set('Accept-Language', 'en')
      .expect(200);
    expect(english.body.data.items[0]).toMatchObject({ title: 'Summer offer' });

    // Signed out too, on the home screen.
    const config = await app.api.get('/api/v1/app-config').expect(200);
    expect(config.body.data.announcement).toMatchObject({
      id: sent.body.data.id,
      titleEn: 'Summer offer',
    });

    // Taken down: off the home screen, still in the inbox.
    await app.api
      .post(`${ADMIN}/announcements/${sent.body.data.id}/end`)
      .set(auth(owner))
      .expect(200);
    expect((await app.api.get('/api/v1/app-config').expect(200)).body.data.announcement).toBeNull();
    expect(await inbox(buyer.token)).toHaveLength(1);

    // Removed: gone from every inbox.
    await app.api
      .delete(`${ADMIN}/announcements/${sent.body.data.id}`)
      .set(auth(owner))
      .expect(204);
    expect(await inbox(buyer.token)).toHaveLength(0);
    const list = await app.api.get(`${ADMIN}/announcements`).set(auth(owner)).expect(200);
    expect(list.body.data.total).toBe(0);
    const log = await app.api.get(`${ADMIN}/audit`).set(auth(owner)).expect(200);
    expect(log.body.data.items.map((e: { action: string }) => e.action).slice(0, 3)).toEqual([
      'ANNOUNCEMENT_REMOVED',
      'ANNOUNCEMENT_ENDED',
      'ANNOUNCEMENT_SENT',
    ]);
  });

  it('can go to sellers only, and show on the home screen only', async () => {
    const buyer = await signUp(app, 'buyer@example.com');
    const seller = await signUp(app, 'seller@example.com');
    await listPart(app, seller.token);
    const owner = await admin('OWNER');

    const toSellers = await app.api
      .post(`${ADMIN}/announcements`)
      .set(auth(owner))
      .send({ ...message, audience: 'SELLERS', inbox: true, banner: false })
      .expect(201);
    expect(toSellers.body.data.recipients).toBe(1);
    expect(await inbox(seller.token)).toHaveLength(1);
    expect(await inbox(buyer.token)).toHaveLength(0);

    const until = new Date(Date.now() + 60_000).toISOString();
    const bannerOnly = await app.api
      .post(`${ADMIN}/announcements`)
      .set(auth(owner))
      .send({ ...message, audience: 'ALL', inbox: false, banner: true, bannerUntil: until })
      .expect(201);
    expect(bannerOnly.body.data.recipients).toBe(0);
    expect(await inbox(buyer.token)).toHaveLength(0);
    expect((await app.api.get('/api/v1/app-config').expect(200)).body.data.announcement.id).toBe(
      bannerOnly.body.data.id,
    );
    await app.api
      .post(`${ADMIN}/announcements`)
      .set(auth(owner))
      .send({
        ...message,
        audience: 'ALL',
        inbox: false,
        banner: true,
        bannerUntil: new Date(Date.now() - 60_000).toISOString(),
      })
      .expect(400);
  });
});

describe('statistics', () => {
  it('counts sign-ups and listings per day, and where buyers reach out', async () => {
    const seller = await signUp(app, 'seller@example.com');
    const buyer = await signUp(app, 'buyer@example.com');
    const part = await listPart(app, seller.token);
    await listPart(app, seller.token, { category: 'ENGINE', city: 'الجيزة' });
    await app.api.post(`/api/v1/parts/${part.id}/contact`).set(auth(buyer.token)).send({
      channel: 'WHATSAPP',
    });
    const moderator = await admin('MODERATOR');

    const res = await app.api.get(`${ADMIN}/stats?days=7`).set(auth(moderator)).expect(200);
    const stats = res.body.data;
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.at(-1)).toMatchObject({ users: 2, parts: 2 });
    expect(stats.totals).toEqual({ users: 2, parts: 2 });
    expect(stats.forSale).toMatchObject({ parts: 2, sellers: 1, sold: 0, whatsapps: 1 });
    expect(stats.topParts.map((p: { id: string }) => p.id)).toEqual([part.id]);
    expect(stats.byCategory).toEqual(
      expect.arrayContaining([
        { key: 'BRAKES', count: 1 },
        { key: 'ENGINE', count: 1 },
      ]),
    );
    expect(stats.byBrand).toEqual([{ key: 'toyota', count: 2, name: 'تويوتا' }]);
    await app.api.get(`${ADMIN}/stats?days=2`).set(auth(moderator)).expect(400);
  });
});

describe('cars', () => {
  it('lets owners add and rename cars, but not remove ones in use', async () => {
    const seller = await signUp(app, 'seller@example.com');
    await listPart(app, seller.token);
    const owner = await admin('OWNER');
    const config = (await app.api.get('/api/v1/app-config').expect(200)).body.data;
    const brands = config.cars.brands as {
      id: string;
      nameAr: string;
      models: { id: string; nameAr: string }[];
    }[];
    expect(brands.find((brand) => brand.id === 'toyota')).toBeTruthy();

    const withBaic = [
      ...brands,
      {
        id: 'baic',
        nameAr: 'بايك',
        nameEn: 'BAIC',
        models: [{ id: 'x35', nameAr: 'X35', nameEn: 'X35', fromYear: 2021, toYear: null }],
      },
    ];
    const moderator = await admin('MODERATOR');
    await app.api
      .put(`${ADMIN}/settings/cars`)
      .set(auth(moderator))
      .send({ brands: withBaic })
      .expect(403);
    await app.api
      .put(`${ADMIN}/settings/cars`)
      .set(auth(owner))
      .send({ brands: [...withBaic, withBaic.at(-1)] })
      .expect(400);
    await app.api
      .put(`${ADMIN}/settings/cars`)
      .set(auth(owner))
      .send({ brands: withBaic })
      .expect(200);

    // Parts can be listed for the new car at once.
    await listPart(app, seller.token, {
      fitments: [{ brandId: 'baic', modelId: 'x35', fromYear: 2022, toYear: 2024 }],
    });
    const after = (await app.api.get('/api/v1/app-config').expect(200)).body.data;
    expect(after.cars.brands.at(-1).id).toBe('baic');
    expect(after.cars.updatedAt).toBeTruthy();

    // The Corolla has a part listed for it.
    const withoutCorolla = withBaic.map((brand) =>
      brand.id === 'toyota'
        ? { ...brand, models: brand.models.filter((model) => model.id !== 'corolla') }
        : brand,
    );
    const refused = await app.api
      .put(`${ADMIN}/settings/cars`)
      .set(auth(owner))
      .send({ brands: withoutCorolla })
      .expect(409);
    expect(refused.body.code).toBe('CARS_IN_USE');
    expect(refused.body.message).toContain('كورولا');

    // An unused one can go.
    const withoutYaris = withBaic.map((brand) =>
      brand.id === 'toyota'
        ? { ...brand, models: brand.models.filter((model) => model.id !== 'yaris') }
        : brand,
    );
    await app.api
      .put(`${ADMIN}/settings/cars`)
      .set(auth(owner))
      .send({ brands: withoutYaris })
      .expect(200);
    await app.api
      .post('/api/v1/parts')
      .set(auth(seller.token))
      .send({ fitments: [{ brandId: 'toyota', modelId: 'yaris', fromYear: 2014, toYear: 2020 }] })
      .expect(400);
  });
});
