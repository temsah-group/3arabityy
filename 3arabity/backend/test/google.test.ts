import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startTestApp, type TestApp } from './helpers/test-app.js';

const EMAIL = 'mona@example.com';
const PHONE = '+201012345678';
const PASSWORD = 'Sup3rSecret!';
const MONA = { sub: 'google-mona', email: EMAIL, name: 'منى أحمد' };

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

const post = (path: string, body: object) =>
  app.api.post(`/api/v1${path}`).set('Accept-Language', 'en').send(body);

const google = (extra: object = {}, identity = MONA) =>
  post('/auth/google', { idToken: app.google.token(identity), ...extra });

async function registerWithPassword(confirm = true) {
  await post('/auth/register', {
    fullName: 'Mona Password',
    identifier: EMAIL,
    phone: '+201099999999',
    password: PASSWORD,
    confirmPassword: PASSWORD,
  }).expect(201);
  if (!confirm) return;
  await post('/auth/verify-otp', {
    identifier: EMAIL,
    otp: app.mailer.lastCode(EMAIL),
    purpose: 'register',
  }).expect(200);
}

describe('POST /auth/google', () => {
  it('asks a new user for a phone number, with what Google told us', async () => {
    const res = await google().expect(400);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PHONE_REQUIRED',
      email: EMAIL,
      fullName: 'منى أحمد',
    });
    expect(await app.container.models.User.countDocuments()).toBe(0);
  });

  it('creates a confirmed account without a password, then signs in again', async () => {
    const first = await google({ phone: PHONE, fullName: 'Mona A.' }).expect(200);
    expect(first.body.data.accessToken).toBeTruthy();
    expect(first.body.data.user).toMatchObject({
      email: EMAIL,
      fullName: 'Mona A.',
      phone: PHONE,
      hasPassword: false,
      signedInWithGoogle: true,
      emailVerification: { isVerified: true },
    });
    expect(app.mailer.sent).toHaveLength(0);

    // No phone needed any more.
    const again = await google().expect(200);
    expect(again.body.data.user.id).toBe(first.body.data.user.id);
  });

  it('links Google to an existing confirmed account and keeps its password', async () => {
    await registerWithPassword();
    const res = await google().expect(200);
    expect(res.body.data.user).toMatchObject({
      fullName: 'Mona Password',
      phone: '+201099999999',
      hasPassword: true,
      signedInWithGoogle: true,
    });
    await post('/auth/login', { identifier: EMAIL, password: PASSWORD }).expect(200);
  });

  it('takes over an unconfirmed sign-up and drops its unproven password', async () => {
    await registerWithPassword(false);
    await google().expect(400); // still needs the phone
    const res = await google({ phone: PHONE }).expect(200);
    expect(res.body.data.user).toMatchObject({ phone: PHONE, hasPassword: false });
    expect(await app.container.models.User.countDocuments()).toBe(1);

    const login = await post('/auth/login', { identifier: EMAIL, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.code).toBe('USE_GOOGLE');
  });

  it('refuses a token Google did not issue', async () => {
    const res = await post('/auth/google', { idToken: 'forged', phone: PHONE }).expect(401);
    expect(res.body.code).toBe('GOOGLE_TOKEN_INVALID');
  });

  it('refuses another Google account claiming a linked email', async () => {
    await google({ phone: PHONE }).expect(200);
    const res = await google({}, { ...MONA, sub: 'someone-else' }).expect(401);
    expect(res.body.code).toBe('GOOGLE_TOKEN_INVALID');
  });

  it('turns a suspended account away', async () => {
    await google({ phone: PHONE }).expect(200);
    await app.container.models.User.updateOne({ email: EMAIL }, { accountStatus: 'SUSPENDED' });
    const res = await google().expect(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('an account made with Google', () => {
  async function signedIn() {
    const res = await google({ phone: PHONE }).expect(200);
    return `Bearer ${res.body.data.accessToken as string}`;
  }

  it('sets its first password without a current one', async () => {
    const auth = await signedIn();
    await app.api
      .patch('/api/v1/users/me/password')
      .set('Authorization', auth)
      .send({ newPassword: PASSWORD, confirmPassword: PASSWORD })
      .expect(200);
    const login = await post('/auth/login', { identifier: EMAIL, password: PASSWORD }).expect(200);
    expect(login.body.data.user.hasPassword).toBe(true);
  });

  it('sets a password through "forgot password" too', async () => {
    await signedIn();
    await post('/auth/forgot-password', { identifier: EMAIL }).expect(200);
    const verified = await post('/auth/verify-otp', {
      identifier: EMAIL,
      otp: app.mailer.lastCode(EMAIL),
      purpose: 'password_reset',
    }).expect(200);
    await post('/auth/reset-password', {
      resetToken: verified.body.data.resetToken,
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    }).expect(200);
    await post('/auth/login', { identifier: EMAIL, password: PASSWORD }).expect(200);
  });

  it('is deleted only after signing in to the same Google account again', async () => {
    const auth = await signedIn();
    const remove = (body: object) =>
      app.api.delete('/api/v1/users/me').set('Authorization', auth).send(body);

    expect((await remove({}).expect(400)).body.code).toBe('GOOGLE_TOKEN_INVALID');
    await remove({ idToken: app.google.token({ ...MONA, sub: 'someone-else' }) }).expect(400);
    await remove({ idToken: app.google.token(MONA) }).expect(200);
    expect(await app.container.models.User.countDocuments()).toBe(0);
  });
});
