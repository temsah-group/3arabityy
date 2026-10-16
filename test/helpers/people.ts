import type { TestApp } from './test-app.js';

export const PASSWORD = 'Sup3rSecret!';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Signs up, confirms and signs in; returns the access token and user id. */
export async function signUp(app: TestApp, email: string, name = 'مستخدم تجربة') {
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

/** Lists a part (Toyota Corolla 2014–2020 brake pads unless [extra] says otherwise). */
export async function listPart(app: TestApp, token: string, extra: object = {}) {
  const photo = await app.api
    .post('/api/v1/uploads/parts')
    .set(auth(token))
    .attach('photo', JPEG, 'p.jpg')
    .expect(201);
  const res = await app.api
    .post('/api/v1/parts')
    .set(auth(token))
    .send({
      name: 'طقم تيل فرامل أمامي',
      category: 'BRAKES',
      condition: 'NEW',
      isOriginal: true,
      price: 1250,
      images: [photo.body.data.path],
      fitments: [{ brandId: 'toyota', modelId: 'corolla', fromYear: 2014, toYear: 2020 }],
      city: 'القاهرة',
      phone: '+201001234501',
      ...extra,
    })
    .expect(201);
  return res.body.data as { id: string; price: number };
}
