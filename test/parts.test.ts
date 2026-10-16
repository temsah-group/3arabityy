import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

const PASSWORD = 'Sup3rSecret!';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

/** Signs up, confirms and signs in; returns the access token and user id. */
async function account(email: string, name = 'بائع تجربة') {
  const api = app.api;
  await api
    .post('/api/v1/auth/register')
    .send({
      fullName: name,
      identifier: email,
      phone: '+201012345678',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    })
    .expect(201);
  await api
    .post('/api/v1/auth/verify-otp')
    .send({ identifier: email, otp: app.mailer.lastCode(email), purpose: 'register' })
    .expect(200);
  const res = await api
    .post('/api/v1/auth/login')
    .send({ identifier: email, password: PASSWORD })
    .expect(200);
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function upload(token: string): Promise<string> {
  const res = await app.api
    .post('/api/v1/uploads/parts')
    .set(auth(token))
    .attach('photo', JPEG, 'p.jpg')
    .expect(201);
  return res.body.data.path as string;
}

const pads = (images: string[], extra: object = {}) => ({
  name: 'طقم تيل فرامل أمامي',
  category: 'BRAKES',
  condition: 'NEW',
  isOriginal: true,
  price: 1250,
  oldPrice: 1450,
  partNumber: '04465-02220',
  description: 'أصلي في الكرتونة',
  images,
  fitments: [{ brandId: 'toyota', modelId: 'corolla', fromYear: 2014, toYear: 2020 }],
  city: 'القاهرة',
  phone: '+201001234501',
  ...extra,
});

async function list(query = '', token?: string) {
  const req = app.api.get(`/api/v1/parts${query}`);
  if (token) req.set(auth(token));
  const res = await req.expect(200);
  return res.body.data as {
    items: { id: string; name: string; stats?: object }[];
    nextCursor: string | null;
    total?: number;
    facets?: { cities: string[]; maxPrice: number };
  };
}

const onDisk = (publicPath: string) =>
  existsSync(path.join(app.container.env.UPLOADS_DIR, 'parts', path.basename(publicPath)));

describe('listing a part', () => {
  it('uploads photos, publishes, and shows the part with its seller', async () => {
    const seller = await account('seller@example.com', 'الأمانة لقطع الغيار');
    const photo = await upload(seller.token);
    expect(photo).toMatch(/^\/uploads\/parts\/[0-9a-f-]+\.jpg$/);
    expect(onDisk(photo)).toBe(true);

    const res = await app.api
      .post('/api/v1/parts')
      .set(auth(seller.token))
      .send(pads([photo]));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'طقم تيل فرامل أمامي',
      category: 'BRAKES',
      price: 1250,
      images: [photo],
      isSold: false,
      seller: {
        id: seller.id,
        name: 'الأمانة لقطع الغيار',
        phone: '+201001234501',
        verified: false,
      },
      stats: { views: 0, calls: 0, whatsapps: 0 },
    });
  });

  it('checks every field like the app does', async () => {
    const seller = await account('seller@example.com');
    const photo = await upload(seller.token);
    const post = (body: object) =>
      app.api.post('/api/v1/parts').set(auth(seller.token)).set('Accept-Language', 'en').send(body);

    const badCar = await post(
      pads([photo], {
        fitments: [{ brandId: 'toyota', modelId: 'corolla', fromYear: 1990, toYear: 2000 }],
      }),
    );
    expect(badCar.status).toBe(400);
    expect(badCar.body.message).toBe('The car or its years are not valid');

    expect((await post(pads([photo], { city: 'Paris' }))).body.message).toBe(
      'Choose a governorate',
    );
    expect((await post(pads([photo], { oldPrice: 900 }))).body.message).toBe(
      'The price before the discount must be higher',
    );
    expect((await post(pads([]))).body.message).toBe('Add at least one photo');
    expect((await post(pads([photo], { surprise: true }))).body.code).toBe('VALIDATION_FAILED');
  });

  it('only takes photos the seller uploaded, and at most eight', async () => {
    const seller = await account('seller@example.com');
    const other = await account('other@example.com');
    const theirs = await upload(other.token);
    const res = await app.api
      .post('/api/v1/parts')
      .set(auth(seller.token))
      .send(pads([theirs]));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UPLOAD_NOT_OWNED');

    const mine = await Promise.all(Array.from({ length: 9 }, () => upload(seller.token)));
    const many = await app.api.post('/api/v1/parts').set(auth(seller.token)).send(pads(mine));
    expect(many.body.code).toBe('TOO_MANY_PHOTOS');
  });

  it('needs a signed-in seller to upload and publish', async () => {
    expect((await app.api.post('/api/v1/parts').send(pads(['https://x.test/a.jpg']))).status).toBe(
      401,
    );
    expect(
      (await app.api.post('/api/v1/uploads/parts').attach('photo', JPEG, 'p.jpg')).status,
    ).toBe(401);
  });
});

describe('finding parts', () => {
  async function seed() {
    const seller = await account('seller@example.com');
    const make = async (extra: object) => {
      const res = await app.api
        .post('/api/v1/parts')
        .set(auth(seller.token))
        .send(pads(['https://images.example.com/a.jpg'], extra))
        .expect(201);
      return res.body.data.id as string;
    };
    const ids = {
      pads: await make({}),
      filter: await make({
        name: 'فلتر زيت',
        category: 'FILTERS',
        condition: 'USED',
        isOriginal: false,
        price: 300,
        oldPrice: null,
        partNumber: null,
        city: 'الجيزة',
        fitments: [{ brandId: 'hyundai', modelId: 'elantra', fromYear: 2012, toYear: 2016 }],
      }),
      engine: await make({
        name: 'موتور كامل 1.6',
        category: 'ENGINE',
        condition: 'IMPORTED',
        price: 68000,
        oldPrice: null,
        partNumber: null,
        fitments: [{ brandId: 'toyota', modelId: 'corolla', fromYear: 2008, toYear: 2013 }],
      }),
    };
    return { seller, ids };
  }

  it('matches every word, ignoring Arabic letter forms and part-number dashes', async () => {
    const { ids } = await seed();
    expect((await list('?q=' + encodeURIComponent('فلاتر'))).items).toHaveLength(1);
    expect((await list('?q=' + encodeURIComponent('تيل امامي'))).items.map((p) => p.id)).toEqual([
      ids.pads,
    ]);
    expect((await list('?q=0446502220')).items.map((p) => p.id)).toEqual([ids.pads]);
    expect((await list('?q=corolla')).items).toHaveLength(2);
    expect((await list('?q=' + encodeURIComponent('كورولا موتور'))).items.map((p) => p.id)).toEqual(
      [ids.engine],
    );
  });

  it('filters by category, condition, origin, city, price and car', async () => {
    const { ids } = await seed();
    expect((await list('?category=FILTERS')).items.map((p) => p.id)).toEqual([ids.filter]);
    expect((await list('?condition=IMPORTED')).items.map((p) => p.id)).toEqual([ids.engine]);
    expect((await list('?origin=AFTERMARKET')).items.map((p) => p.id)).toEqual([ids.filter]);
    expect((await list('?city=' + encodeURIComponent('الجيزة'))).items).toHaveLength(1);
    expect((await list('?minPrice=1000&maxPrice=5000')).items.map((p) => p.id)).toEqual([ids.pads]);
    // A 2016 Corolla takes the pads (2014–2020), not the 2008–2013 engine.
    expect((await list('?cars=toyota:corolla:2016')).items.map((p) => p.id)).toEqual([ids.pads]);
    expect((await list('?cars=toyota:corolla:2016,hyundai:elantra:2015')).items).toHaveLength(2);
    const bad = await app.api.get('/api/v1/parts?cars=toyota').expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
  });

  it('sorts, pages with a cursor, and sends facets on the first page', async () => {
    await seed();
    const first = await list('?sort=PRICE_LOW&limit=2');
    expect(first.items.map((p) => p.name)).toEqual(['فلتر زيت', 'طقم تيل فرامل أمامي']);
    expect(first.total).toBe(3);
    expect(first.facets).toEqual({ cities: ['الجيزة', 'القاهرة'], maxPrice: 68000 });
    const second = await list(`?sort=PRICE_LOW&limit=2&cursor=${first.nextCursor}`);
    expect(second.items.map((p) => p.name)).toEqual(['موتور كامل 1.6']);
    expect(second.nextCursor).toBeNull();
    expect(second.facets).toBeUndefined();

    const newest = await list('?limit=10');
    expect(newest.items[0]?.name).toBe('موتور كامل 1.6');
    expect((await app.api.get('/api/v1/parts?cursor=nonsense')).status).toBe(400);
  });

  it('gives similar parts by category and car, never the part itself', async () => {
    const { ids } = await seed();
    const res = await app.api.get(`/api/v1/parts/${ids.pads}/similar`).expect(200);
    const similar = res.body.data.items.map((p: { id: string }) => p.id);
    expect(similar).toContain(ids.engine); // same Corolla
    expect(similar).not.toContain(ids.pads);
    expect(similar).not.toContain(ids.filter);
  });

  it("counts buyer views and contacts, never the seller's own", async () => {
    const { seller, ids } = await seed();
    const buyer = await account('buyer@example.com');
    await app.api.get(`/api/v1/parts/${ids.pads}`).expect(200);
    const seen = await app.api.get(`/api/v1/parts/${ids.pads}`).set(auth(buyer.token)).expect(200);
    expect(seen.body.data.stats).toBeUndefined();
    await app.api.get(`/api/v1/parts/${ids.pads}`).set(auth(seller.token)).expect(200);
    await app.api.post(`/api/v1/parts/${ids.pads}/contact`).send({ channel: 'CALL' }).expect(204);
    await app.api
      .post(`/api/v1/parts/${ids.pads}/contact`)
      .set(auth(buyer.token))
      .send({ channel: 'WHATSAPP' })
      .expect(204);
    await app.api
      .post(`/api/v1/parts/${ids.pads}/contact`)
      .set(auth(seller.token))
      .send({ channel: 'CALL' })
      .expect(204);

    const mine = await app.api.get('/api/v1/parts/mine').set(auth(seller.token)).expect(200);
    const stats = mine.body.data.items.find((p: { id: string }) => p.id === ids.pads).stats;
    expect(stats).toEqual({ views: 2, calls: 1, whatsapps: 1 });
  });

  it('answers unknown parts with PART_NOT_FOUND', async () => {
    expect((await app.api.get('/api/v1/parts/000000000000000000000000')).body.code).toBe(
      'PART_NOT_FOUND',
    );
    expect((await app.api.get('/api/v1/parts/nope')).status).toBe(404);
  });
});

describe('managing a listing', () => {
  async function listed() {
    const seller = await account('seller@example.com');
    const photo = await upload(seller.token);
    const res = await app.api
      .post('/api/v1/parts')
      .set(auth(seller.token))
      .send(pads([photo]))
      .expect(201);
    return { seller, photo, id: res.body.data.id as string };
  }

  it('edits only what changed and drops photos taken off', async () => {
    const { seller, photo, id } = await listed();
    const replacement = await upload(seller.token);
    const res = await app.api
      .patch(`/api/v1/parts/${id}`)
      .set(auth(seller.token))
      .send({ price: 1100, images: [replacement] })
      .expect(200);
    expect(res.body.data).toMatchObject({ price: 1100, oldPrice: 1450, images: [replacement] });
    expect(onDisk(photo)).toBe(false);
    expect(onDisk(replacement)).toBe(true);
    // Search follows the edit.
    const renamed = await app.api
      .patch(`/api/v1/parts/${id}`)
      .set(auth(seller.token))
      .send({ name: 'تيل خلفي' })
      .expect(200);
    expect(renamed.body.data.name).toBe('تيل خلفي');
    expect((await list('?q=' + encodeURIComponent('خلفي'))).items).toHaveLength(1);

    const tooLow = await app.api
      .patch(`/api/v1/parts/${id}`)
      .set(auth(seller.token))
      .send({ price: 2000 })
      .expect(400);
    expect(tooLow.body.code).toBe('VALIDATION_FAILED');
  });

  it('keeps other sellers out', async () => {
    const { id } = await listed();
    const other = await account('other@example.com');
    // Sent one at a time, so each request opens its own server.
    const attempts = [
      () => app.api.patch(`/api/v1/parts/${id}`).set(auth(other.token)).send({ price: 1 }),
      () => app.api.delete(`/api/v1/parts/${id}`).set(auth(other.token)),
      () => app.api.post(`/api/v1/parts/${id}/sold`).set(auth(other.token)).send({ sold: true }),
      () => app.api.post(`/api/v1/parts/${id}/renew`).set(auth(other.token)),
    ];
    for (const attempt of attempts) {
      const res = await attempt();
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NOT_PART_OWNER');
    }
  });

  it('hides a sold part from buyers, keeps its page, and renews it', async () => {
    const { seller, id } = await listed();
    await app.api
      .post(`/api/v1/parts/${id}/sold`)
      .set(auth(seller.token))
      .send({ sold: true })
      .expect(200);
    expect((await list()).items).toHaveLength(0);
    const page = await app.api.get(`/api/v1/parts/${id}`).expect(200);
    expect(page.body.data.isSold).toBe(true);
    const mine = await app.api.get('/api/v1/parts/mine').set(auth(seller.token)).expect(200);
    expect(mine.body.data.items).toHaveLength(1);

    const before = new Date(page.body.data.listedAt as string).getTime();
    const renewed = await app.api
      .post(`/api/v1/parts/${id}/renew`)
      .set(auth(seller.token))
      .expect(200);
    expect(renewed.body.data.isSold).toBe(false);
    expect(new Date(renewed.body.data.listedAt as string).getTime()).toBeGreaterThanOrEqual(before);
    expect((await list()).items).toHaveLength(1);
  });

  it('deletes a listing with its photos', async () => {
    const { seller, photo, id } = await listed();
    await app.api.delete(`/api/v1/parts/${id}`).set(auth(seller.token)).expect(200);
    expect(onDisk(photo)).toBe(false);
    expect((await app.api.get(`/api/v1/parts/${id}`)).status).toBe(404);
  });

  it("goes away with the seller's account", async () => {
    const { seller, photo } = await listed();
    await app.api
      .delete('/api/v1/users/me')
      .set(auth(seller.token))
      .send({ password: PASSWORD })
      .expect(200);
    expect((await list()).items).toHaveLength(0);
    expect(onDisk(photo)).toBe(false);
  });

  it('shows featured parts, narrowed by condition and car', async () => {
    const { seller, id } = await listed();
    await app.container.models.Part.updateOne({ _id: id }, { isFeatured: true }).exec();
    const all = await app.api.get('/api/v1/parts/featured').expect(200);
    expect(all.body.data.items.map((p: { id: string }) => p.id)).toEqual([id]);
    const used = await app.api.get('/api/v1/parts/featured?condition=USED').expect(200);
    expect(used.body.data.items).toHaveLength(0);
    const yaris = await app.api.get('/api/v1/parts/featured?cars=toyota:yaris:2016').expect(200);
    expect(yaris.body.data.items).toHaveLength(0);
    void seller;
  });
});
