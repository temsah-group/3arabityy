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

type Person = { token: string; id: string };

/** An approved shop owned by a fresh account. */
async function openShop() {
  const owner = await signUp(app, 'owner@example.com', 'صاحب المحل');
  const res = await app.api
    .post('/api/v1/shops')
    .set(auth(owner.token))
    .send(shopInput())
    .expect(201);
  const admin = await adminToken(app);
  await app.api
    .patch(`/api/v1/admin/shops/${res.body.data.id}`)
    .set(auth(admin))
    .send({ status: 'APPROVED' })
    .expect(200);
  return { owner, shopId: res.body.data.id as string, admin };
}

const contactPart = (who: Person, partId: string) =>
  app.api
    .post(`/api/v1/parts/${partId}/contact`)
    .set(auth(who.token))
    .send({ channel: 'WHATSAPP' })
    .expect(204);

const review = (who: Person, path: string, body: object, status = 200) =>
  app.api.put(`/api/v1/${path}/reviews/mine`).set(auth(who.token)).send(body).expect(status);

async function inbox(token: string) {
  await app.container.notifications.flush();
  const res = await app.api.get('/api/v1/notifications').set(auth(token)).expect(200);
  return res.body.data.items as {
    kind: string;
    title: string;
    partId: string | null;
    shopId: string | null;
  }[];
}

describe('reviewing a shop', () => {
  it('needs a call first, then rates the shop and tells its owner', async () => {
    const { owner, shopId } = await openShop();
    const buyer = await signUp(app, 'buyer@example.com', 'منى أحمد علي');

    // Not before reaching the shop, and never one's own shop.
    await review(buyer, `shops/${shopId}`, { rating: 5 }, 403);
    await review(owner, `shops/${shopId}`, { rating: 5 }, 400);

    let res = await app.api
      .get(`/api/v1/shops/${shopId}/reviews`)
      .set(auth(buyer.token))
      .expect(200);
    expect(res.body.data.canReview).toBe(false);

    await app.api
      .post(`/api/v1/shops/${shopId}/contact`)
      .set(auth(buyer.token))
      .send({ channel: 'CALL' })
      .expect(204);
    const written = await review(buyer, `shops/${shopId}`, { rating: 4, text: 'محترمين وسريعين' });
    expect(written.body.data).toMatchObject({
      rating: 4,
      text: 'محترمين وسريعين',
      author: { name: 'منى أ.' },
      mine: true,
    });

    // Writing again changes it; the owner hears of it once.
    await review(buyer, `shops/${shopId}`, { rating: 5, text: '' });
    res = await app.api.get(`/api/v1/shops/${shopId}/reviews`).set(auth(buyer.token));
    expect(res.body.data).toMatchObject({
      canReview: true,
      summary: { avg: 5, count: 1, breakdown: [0, 0, 0, 0, 1] },
      mine: { rating: 5, text: null },
    });
    expect(res.body.data.items).toHaveLength(1);

    const shop = await app.api.get(`/api/v1/shops/${shopId}`).expect(200);
    expect(shop.body.data.rating).toEqual({ avg: 5, count: 1 });

    const notices = await inbox(owner.token);
    const reviews = notices.filter((n) => n.kind === 'REVIEW');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ title: 'تقييم جديد 4★', shopId });

    await review(buyer, `shops/${shopId}`, { rating: 6 }, 400);
  });

  it('a shop with many good reviews outranks one with a single perfect one', async () => {
    const { shopId: big, admin } = await openShop();
    const other = await signUp(app, 'other@example.com');
    const small = await app.api
      .post('/api/v1/shops')
      .set(auth(other.token))
      .send(shopInput({ name: 'محل صغير' }))
      .expect(201);
    await app.api
      .patch(`/api/v1/admin/shops/${small.body.data.id}`)
      .set(auth(admin))
      .send({ status: 'APPROVED' })
      .expect(200);

    const buyers = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) => signUp(app, `b${n}@example.com`)),
    );
    for (const buyer of buyers) {
      await app.api
        .post(`/api/v1/shops/${big}/contact`)
        .set(auth(buyer.token))
        .send({ channel: 'CALL' });
      await review(buyer, `shops/${big}`, { rating: 5 });
    }
    // A single 5 for the small shop.
    const extra = buyers[0]!;
    await app.api
      .post(`/api/v1/shops/${small.body.data.id}/contact`)
      .set(auth(extra.token))
      .send({ channel: 'CALL' });
    await review(extra, `shops/${small.body.data.id}`, { rating: 5 });

    const res = await app.api.get('/api/v1/shops').expect(200);
    expect(res.body.data.items.map((s: { id: string }) => s.id)).toEqual([big, small.body.data.id]);
  });
});

describe('reviewing a part', () => {
  it('needs a call about that part; the seller answers and the buyer hears', async () => {
    const seller = await signUp(app, 'seller@example.com', 'بياع');
    const buyer = await signUp(app, 'buyer@example.com', 'مشتري');
    const part = await listPart(app, seller.token);
    const other = await listPart(app, seller.token, { name: 'قطعة تانية' });

    await contactPart(buyer, part.id);
    await review(buyer, `parts/${other.id}`, { rating: 4 }, 403);
    const written = await review(buyer, `parts/${part.id}`, { rating: 2, text: 'مش أصلي' });
    const id = written.body.data.id as string;

    const shown = await app.api.get(`/api/v1/parts/${part.id}`).expect(200);
    expect(shown.body.data.rating).toEqual({ avg: 2, count: 1 });

    // Only the seller answers.
    await app.api
      .put(`/api/v1/reviews/${id}/reply`)
      .set(auth(buyer.token))
      .send({ text: 'x' })
      .expect(403);
    await app.api
      .put(`/api/v1/reviews/${id}/reply`)
      .set(auth(seller.token))
      .send({ text: 'القطعة أصلي وعليها ضمان' })
      .expect(200);

    const received = await app.api.get('/api/v1/reviews/received').set(auth(seller.token));
    expect(received.body.data.items[0]).toMatchObject({
      targetName: 'طقم تيل فرامل أمامي',
      reply: { text: 'القطعة أصلي وعليها ضمان' },
    });

    const [notice] = await inbox(buyer.token);
    expect(notice).toMatchObject({
      kind: 'REVIEW',
      title: 'البياع رد على تقييمك',
      partId: part.id,
    });

    // Taking a review back moves the rating back.
    await app.api
      .delete(`/api/v1/parts/${part.id}/reviews/mine`)
      .set(auth(buyer.token))
      .expect(200);
    const after = await app.api.get(`/api/v1/parts/${part.id}`);
    expect(after.body.data.rating).toEqual({ avg: 0, count: 0 });
  });

  it('a reported review can be hidden from the dashboard', async () => {
    const seller = await signUp(app, 'seller@example.com', 'بياع');
    const buyer = await signUp(app, 'buyer@example.com', 'مشتري');
    const part = await listPart(app, seller.token);
    await contactPart(buyer, part.id);
    const written = await review(buyer, `parts/${part.id}`, { rating: 1, text: 'كلام مسيء' });
    const id = written.body.data.id as string;

    await app.api
      .post('/api/v1/reports')
      .set(auth(seller.token))
      .send({ target: 'REVIEW', targetId: id, reason: 'ABUSIVE' })
      .expect(201);
    const admin = await adminToken(app, 'MODERATOR');
    const reports = await app.api
      .get('/api/v1/admin/reports?target=REVIEW')
      .set(auth(admin))
      .expect(200);
    expect(reports.body.data.items[0].subject).toMatchObject({ text: 'كلام مسيء', rating: 1 });

    await app.api
      .post(`/api/v1/admin/reports/REVIEW/${id}/resolve`)
      .set(auth(admin))
      .send({ action: 'HIDE_REVIEW', note: 'ألفاظ' })
      .expect(200);

    const list = await app.api.get(`/api/v1/parts/${part.id}/reviews`).expect(200);
    expect(list.body.data.items).toHaveLength(0);
    expect(list.body.data.summary.count).toBe(0);
    const hidden = await app.api.get('/api/v1/admin/reviews?hidden=true').set(auth(admin));
    expect(hidden.body.data.items[0]).toMatchObject({ id, hidden: true });
  });

  it("deleting a buyer's account removes their reviews from the rating", async () => {
    const seller = await signUp(app, 'seller@example.com');
    const buyer = await signUp(app, 'buyer@example.com');
    const part = await listPart(app, seller.token);
    await contactPart(buyer, part.id);
    await review(buyer, `parts/${part.id}`, { rating: 3 });
    await app.api
      .delete('/api/v1/users/me')
      .set(auth(buyer.token))
      .send({ password: 'Sup3rSecret!' })
      .expect(200);
    const after = await app.api.get(`/api/v1/parts/${part.id}`);
    expect(after.body.data.rating).toEqual({ avg: 0, count: 0 });
  });
});
