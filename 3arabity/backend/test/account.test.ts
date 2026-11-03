import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startTestApp, type TestApp } from './helpers/test-app.js';

const EMAIL = 'mona@example.com';
const PASSWORD = 'Sup3rSecret!';

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

const api = (lang = 'ar') => ({
  post: (url: string, body: object, token?: string) => {
    const req = app.api.post(`/api/v1${url}`).set('Accept-Language', lang);
    return token ? req.set('Authorization', `Bearer ${token}`).send(body) : req.send(body);
  },
  patch: (url: string, body: object, token: string) =>
    app.api
      .patch(`/api/v1${url}`)
      .set('Accept-Language', lang)
      .set('Authorization', `Bearer ${token}`)
      .send(body),
  delete: (url: string, token: string, body: object = {}) =>
    app.api
      .delete(`/api/v1${url}`)
      .set('Accept-Language', lang)
      .set('Authorization', `Bearer ${token}`)
      .send(body),
  get: (url: string, token: string) =>
    app.api.get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
});

async function signedUp(): Promise<void> {
  await api()
    .post('/auth/register', {
      fullName: 'منى أحمد',
      identifier: EMAIL,
      phone: '+201012345678',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    })
    .expect(201);
  await api()
    .post('/auth/verify-otp', {
      identifier: EMAIL,
      otp: app.mailer.lastCode(EMAIL),
      purpose: 'register',
    })
    .expect(200);
}

async function signIn(password = PASSWORD): Promise<string> {
  const res = await api().post('/auth/login', { identifier: EMAIL, password }).expect(200);
  return res.body.data.accessToken as string;
}

// The smallest files each type is recognised by.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

const upload = (token: string, bytes: Buffer, name = 'photo.png') =>
  app.api
    .post('/api/v1/users/me/photo')
    .set('Authorization', `Bearer ${token}`)
    .attach('photo', bytes, name);

const onDisk = (publicPath: string) =>
  existsSync(path.join(app.container.env.UPLOADS_DIR, 'avatars', path.basename(publicPath)));

describe('changing the password', () => {
  it('needs the current one, keeps this device and signs out the others', async () => {
    await signedUp();
    const here = await signIn();
    const elsewhere = await signIn();

    const wrong = await api().patch(
      '/users/me/password',
      { currentPassword: 'not-it-123', newPassword: 'N3wSecret!!', confirmPassword: 'N3wSecret!!' },
      here,
    );
    // 400, so the app does not mistake it for an expired session.
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({
      code: 'WRONG_PASSWORD',
      message: 'كلمة المرور الحالية غير صحيحة',
    });

    const res = await api().patch(
      '/users/me/password',
      { currentPassword: PASSWORD, newPassword: 'N3wSecret!!', confirmPassword: 'N3wSecret!!' },
      here,
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    await api().get('/users/me', here).expect(200);
    expect((await api().get('/users/me', elsewhere)).status).toBe(401);
    expect(
      (await api().post('/auth/login', { identifier: EMAIL, password: PASSWORD })).status,
    ).toBe(401);
    await signIn('N3wSecret!!');
  });

  it('checks the new password like sign-up does', async () => {
    await signedUp();
    const token = await signIn();
    const short = await api().patch(
      '/users/me/password',
      { currentPassword: PASSWORD, newPassword: 'short', confirmPassword: 'short' },
      token,
    );
    expect(short.status).toBe(400);
    expect(short.body.code).toBe('VALIDATION_FAILED');

    const mismatch = await api('en').patch(
      '/users/me/password',
      { currentPassword: PASSWORD, newPassword: 'N3wSecret!!', confirmPassword: 'Other-123!' },
      token,
    );
    expect(mismatch.body.message).toBe('The passwords do not match');

    const same = await api().patch(
      '/users/me/password',
      { currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD },
      token,
    );
    expect(same.status).toBe(400);
  });
});

describe('the profile photo', () => {
  it('uploads, is served, replaces the old one and can be removed', async () => {
    await signedUp();
    const token = await signIn();

    const first = await upload(token, PNG).expect(200);
    const firstPath = first.body.data.profilePhotoUrl as string;
    expect(firstPath).toMatch(/^\/uploads\/avatars\/[0-9a-f-]+\.png$/);
    const served = await app.api.get(firstPath).expect(200);
    expect(Buffer.from(served.body as Buffer).subarray(0, 8)).toEqual(PNG.subarray(0, 8));

    const second = await upload(token, JPEG, 'face.jpg').expect(200);
    const secondPath = second.body.data.profilePhotoUrl as string;
    expect(secondPath).toMatch(/\.jpg$/);
    expect(onDisk(firstPath)).toBe(false);
    expect(onDisk(secondPath)).toBe(true);

    const me = await api().get('/users/me', token).expect(200);
    expect(me.body.data.profilePhotoUrl).toBe(secondPath);

    const removed = await api().delete('/users/me/photo', token).expect(200);
    expect(removed.body.data.profilePhotoUrl).toBeNull();
    expect(onDisk(secondPath)).toBe(false);
  });

  it('refuses what is not an image, a missing file and a file too large', async () => {
    await signedUp();
    const token = await signIn();

    const text = await upload(token, Buffer.from('not an image at all'), 'photo.png');
    expect(text.status).toBe(400);
    expect(text.body.code).toBe('PHOTO_INVALID');

    const none = await app.api
      .post('/api/v1/users/me/photo')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(none.status).toBe(400);
    expect(none.body.code).toBe('PHOTO_REQUIRED');

    const big = await upload(
      token,
      Buffer.concat([JPEG, Buffer.alloc(6 * 1024 * 1024)]),
      'big.jpg',
    );
    expect(big.status).toBe(413);
    expect(big.body.code).toBe('PHOTO_TOO_LARGE');
  });

  it('needs a signed-in user', async () => {
    const res = await app.api.post('/api/v1/users/me/photo').attach('photo', PNG, 'p.png');
    expect(res.status).toBe(401);
  });
});

describe('deleting the account', () => {
  it('needs the password, then removes the account, its sessions and photo', async () => {
    await signedUp();
    const token = await signIn();
    const photo = (await upload(token, PNG).expect(200)).body.data.profilePhotoUrl as string;

    const wrong = await api().delete('/users/me', token, { password: 'not-it-123' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('WRONG_PASSWORD');

    const res = await api('en').delete('/users/me', token, { password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Your account was deleted for good');

    expect((await api().get('/users/me', token)).status).toBe(401);
    expect(onDisk(photo)).toBe(false);
    expect(await app.container.models.User.countDocuments()).toBe(0);
    expect(await app.container.models.RefreshToken.countDocuments()).toBe(0);
    expect(
      (await api().post('/auth/login', { identifier: EMAIL, password: PASSWORD })).status,
    ).toBe(401);

    // The email is free to sign up again.
    await signedUp();
  });
});
