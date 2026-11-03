import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LOGO_CID } from '../src/modules/mail/templates.js';
import { startTestApp, type TestApp } from './helpers/test-app.js';

const EMAIL = 'mohamed@example.com';
const PASSWORD = 'Sup3rSecret!';
const signUp = {
  fullName: 'محمد علي',
  identifier: EMAIL,
  phone: '+201012345678',
  password: PASSWORD,
  confirmPassword: PASSWORD,
};

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

const post = (path: string, body: object, lang = 'ar') =>
  app.api.post(`/api/v1${path}`).set('Accept-Language', lang).send(body);

async function registerAndVerify() {
  await post('/auth/register', signUp).expect(201);
  await post('/auth/verify-otp', {
    identifier: EMAIL,
    otp: app.mailer.lastCode(EMAIL),
    purpose: 'register',
  }).expect(200);
}

function login(password = PASSWORD, extra: object = {}) {
  return post('/auth/login', { identifier: EMAIL, password, ...extra });
}

describe('registration', () => {
  it('creates the account and emails a code', async () => {
    const res = await post('/auth/register', { ...signUp, identifier: '  Mohamed@Example.com ' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        identifier: EMAIL,
        isVerified: false,
        requiresVerification: true,
        otpSent: true,
        expiresInMinutes: 5,
      },
    });
    expect(app.mailer.sent).toHaveLength(1);
    const mail = app.mailer.sent[0]!;
    expect(mail.subject).toContain('عربيتي');
    // The branded version: the logo on top, the code, right to left in Arabic.
    const code = app.mailer.lastCode(EMAIL);
    expect(mail.html).toContain(`src="cid:${LOGO_CID}"`);
    expect(mail.html).toContain(code);
    expect(mail.html).toContain('dir="rtl"');
  });

  it('answers validation errors in the caller language', async () => {
    const bad = { ...signUp, identifier: 'not-an-email', confirmPassword: 'different1' };

    const arabic = await post('/auth/register', bad);
    expect(arabic.status).toBe(400);
    expect(arabic.body.code).toBe('VALIDATION_FAILED');
    expect(arabic.body.message).toBe('يرجى إدخال بريد إلكتروني صحيح');
    expect(arabic.body.errors.map((e: { field: string }) => e.field)).toEqual([
      'identifier',
      'confirmPassword',
    ]);

    const english = await post('/auth/register', bad, 'en');
    expect(english.body.message).toBe('Please enter a valid email address');
  });

  it('rejects fields it does not know', async () => {
    const res = await post('/auth/register', { ...signUp, accountType: 'SELLER' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('accountType');
  });

  it('refuses an email that is already confirmed', async () => {
    await registerAndVerify();
    const res = await post('/auth/register', signUp);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('lets an unconfirmed sign-up be redone with new details', async () => {
    await post('/auth/register', signUp).expect(201);
    const res = await post('/auth/register', { ...signUp, fullName: 'محمد أحمد' });
    expect(res.status).toBe(201);
    // Still inside the resend cooldown: the first code stays the live one.
    expect(app.mailer.sent).toHaveLength(1);
    expect(await app.container.models.User.countDocuments()).toBe(1);
  });
});

describe('email confirmation', () => {
  it('confirms with the emailed code, once', async () => {
    await post('/auth/register', signUp).expect(201);
    const code = app.mailer.lastCode(EMAIL);

    const ok = await post('/auth/verify-otp', {
      identifier: EMAIL,
      otp: code,
      purpose: 'register',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.message).toContain('تم تأكيد');

    const again = await post('/auth/verify-otp', {
      identifier: EMAIL,
      otp: code,
      purpose: 'register',
    });
    expect(again.body.code).toBe('ACCOUNT_ALREADY_VERIFIED');
  });

  it('counts wrong codes and stops after five', async () => {
    await post('/auth/register', signUp).expect(201);
    const code = app.mailer.lastCode(EMAIL);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const res = await post('/auth/verify-otp', {
        identifier: EMAIL,
        otp: wrong,
        purpose: 'register',
      });
      expect(res.body.code).toBe('OTP_INVALID');
    }
    const blocked = await post('/auth/verify-otp', {
      identifier: EMAIL,
      otp: code,
      purpose: 'register',
    });
    expect(blocked.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('enforces the resend cooldown', async () => {
    await post('/auth/register', signUp).expect(201);
    const res = await post('/auth/resend-otp', { identifier: EMAIL, purpose: 'register' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('OTP_RESEND_TOO_SOON');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('sends a code and asks for confirmation when an unconfirmed account signs in', async () => {
    await post('/auth/register', signUp).expect(201);
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ACCOUNT_NOT_VERIFIED', identifier: EMAIL });
  });
});

describe('sign-in and sessions', () => {
  it('returns tokens and the user in the shape the app reads', async () => {
    await registerAndVerify();
    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toMatch(/^[\w-]{24}\.[\w-]{43}$/);
    expect(res.body.data.user).toMatchObject({
      fullName: 'محمد علي',
      email: EMAIL,
      phone: '+201012345678',
      accountType: 'USER',
      accountStatus: 'ACTIVE',
      primaryIdentifierType: 'email',
      emailVerification: { isVerified: true },
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const me = await app.api
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(EMAIL);
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    await registerAndVerify();
    const unknown = await post('/auth/login', {
      identifier: 'nobody@example.com',
      password: PASSWORD,
    });
    const wrong = await login('wrong-password');
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('pauses sign-in after five wrong passwords', async () => {
    await registerAndVerify();
    for (let i = 0; i < 5; i++) await login('wrong-password').expect(401);
    const locked = await login();
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('rotates refresh tokens and ends the session when an old one is replayed', async () => {
    await registerAndVerify();
    const first = (await login()).body.data;

    const refreshed = await post('/auth/refresh', { refreshToken: first.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(first.refreshToken);
    expect(refreshed.body.data.user.email).toBe(EMAIL);

    const replay = await post('/auth/refresh', { refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');

    // The leak ends the whole session, including the newest token.
    const newest = await post('/auth/refresh', { refreshToken: refreshed.body.data.refreshToken });
    expect(newest.body.code).toBe('SESSION_REVOKED');
  });

  it('signs out: the access token stops working', async () => {
    await registerAndVerify();
    const { accessToken } = (await login()).body.data;
    const auth = { Authorization: `Bearer ${accessToken}` };

    await app.api.post('/api/v1/auth/logout').set(auth).expect(200);
    const after = await app.api.get('/api/v1/users/me').set(auth);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('SESSION_REVOKED');
  });

  it('turns away requests without a valid token', async () => {
    const none = await app.api.get('/api/v1/users/me');
    const forged = await app.api.get('/api/v1/users/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(none.status).toBe(401);
    expect(forged.status).toBe(401);
  });

  it('updates the profile name and phone', async () => {
    await registerAndVerify();
    const { accessToken } = (await login()).body.data;
    const res = await app.api
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'محمد علي حسن', phone: '+201112223334' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fullName: 'محمد علي حسن', phone: '+201112223334' });
  });
});

describe('password reset', () => {
  it('does not reveal whether an email is registered', async () => {
    const res = await post('/auth/forgot-password', { identifier: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(app.mailer.sent).toHaveLength(0);
  });

  it('resets with the emailed code, signs out everywhere, and works once', async () => {
    await registerAndVerify();
    const oldSession = (await login()).body.data;

    await post('/auth/forgot-password', { identifier: EMAIL }).expect(200);
    const verified = await post('/auth/verify-otp', {
      identifier: EMAIL,
      otp: app.mailer.lastCode(EMAIL),
      purpose: 'password_reset',
    });
    const { resetToken } = verified.body.data;
    expect(resetToken).toEqual(expect.any(String));

    const newPassword = 'An0therSecret!';
    const reset = { resetToken, newPassword, confirmPassword: newPassword };
    await post('/auth/reset-password', reset).expect(200);

    expect((await login()).status).toBe(401);
    expect((await login(newPassword)).status).toBe(200);

    const stale = await post('/auth/refresh', { refreshToken: oldSession.refreshToken });
    expect(stale.body.code).toBe('SESSION_REVOKED');

    const reused = await post('/auth/reset-password', reset);
    expect(reused.body.code).toBe('RESET_TOKEN_INVALID');
  });
});

describe('health', () => {
  it('reports the database', async () => {
    const res = await app.api.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', database: 'up' });
  });

  it('answers unknown routes with the error envelope', async () => {
    const res = await app.api.get('/api/v1/nothing-here').set('Accept-Language', 'en');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      code: 'NOT_FOUND',
      message: 'Route not found',
    });
  });
});
