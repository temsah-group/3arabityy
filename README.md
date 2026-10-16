# 3arabity عربيتي — API

Backend for the 3arabity car spare parts app (new, used and imported parts in Egypt).

Node 22+, Express 5, MongoDB (Mongoose), TypeScript, Zod.

## Run it

```bash
cp .env.example .env   # then fill MONGO_URI and the two JWT secrets
npm install
npm run dev            # http://localhost:3000/api/v1
```

With `MAIL_HOST` empty, emails (and their codes) are printed to the console instead of being sent. Production refuses to start without SMTP.

```bash
npm run typecheck
npm test               # end-to-end, against an in-memory MongoDB
npm run build && npm start
```

## Layout

```
src/
  server.ts          connect, build the container, listen, graceful shutdown
  app.ts             Express app: security headers, JSON, language, routes, errors
  container.ts       builds every service by hand (no DI framework)
  config/env.ts      environment, validated once at startup
  common/
    i18n.ts          every user-facing message, Arabic and English
    http/            AppError + error codes, success envelope, body validation
    logger.ts        JSON log lines
  middleware/        authenticate, language, rate limit, error handler
  modules/
    auth/            register, login, OTP, password reset, sessions, tokens
    users/           user model, public user shape, profile, password, photo
                     and account deletion routes; photos on disk under
                     UPLOADS_DIR (served at /uploads) until object storage
    mail/            SMTP mailer and the console mailer for development
    health/          GET /health
test/                end-to-end tests with supertest
```

A new feature is a folder under `modules/` with its model, service, Zod schemas and routes, wired in `container.ts` and `app.ts`.

## Responses

Success: `{ "success": true, "message": "...", "data": ... }`

Failure: `{ "success": false, "message": "...", "code": "SOME_CODE", ...details }`

`message` is in the language of the `Accept-Language` header (`ar` by default, `en`). The app should branch on `code`, never on the text. Validation failures add `errors: [{ field, message }]`.

## Auth endpoints (`/api/v1`)

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | `fullName, identifier (email), phone (+20…), password, confirmPassword` | 201, emails a code. An unconfirmed email can sign up again. |
| POST | `/auth/verify-otp` | `identifier, otp, purpose` (`register` / `password_reset`) | `register` confirms the email; `password_reset` returns `resetToken` (10 min, single use). |
| POST | `/auth/resend-otp` | `identifier, purpose` | 60 s cooldown (`OTP_RESEND_TOO_SOON`, `retryAfterSeconds`). |
| POST | `/auth/login` | `identifier, password, rememberMe?` | `accessToken`, `refreshToken`, `user`. Unconfirmed → 403 `ACCOUNT_NOT_VERIFIED` and a fresh code. |
| POST | `/auth/refresh` | `refreshToken` | Rotates the refresh token. Replaying an old one ends the session (`REFRESH_TOKEN_REUSED`). |
| POST | `/auth/logout` | — (Bearer) | Ends this session; its access token stops working at once. |
| POST | `/auth/forgot-password` | `identifier` | Same answer whether or not the email exists. |
| POST | `/auth/reset-password` | `resetToken, newPassword, confirmPassword` | Signs the user out on every device. |
| GET / PATCH | `/users/me` | `fullName?, phone?` (PATCH) | Bearer. |
| PATCH | `/users/me/password` | `currentPassword, newPassword, confirmPassword` | Bearer. Keeps this session, signs out the others. A wrong current password is `400 WRONG_PASSWORD`, never 401. |
| DELETE | `/users/me` | `password` | Bearer. Deletes the account, its sessions, codes and photo. |
| POST | `/users/me/photo` | multipart, one image in `photo` | Bearer. JPEG, PNG or WebP (checked by content), up to 5 MB. Returns the user; `profilePhotoUrl` is a path such as `/uploads/avatars/<uuid>.jpg` that the app joins to the server address. |
| DELETE | `/users/me/photo` | | Bearer. Returns the user with `profilePhotoUrl: null`. |
| GET | `/health` | — | `{ status, database }`, 503 when the database is down. |

## Security notes

- Passwords: bcrypt (12 rounds), 8–72 bytes. Five wrong passwords pause sign-in for 15 minutes (`ACCOUNT_LOCKED`).
- Access tokens: HS256, 15 minutes, bound to a session, so sign-out and password reset end them immediately.
- Refresh tokens: `selector.secret`, only a SHA-256 of the secret is stored, single use with reuse detection.
- OTP: 6 digits, 5 minutes, 5 attempts, stored as an HMAC; one live code per email and purpose.
- Per-IP rate limits on every auth route; set `TRUST_PROXY` to the number of proxies in front of the API.
