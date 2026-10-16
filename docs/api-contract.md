# 3arabity API contract (v1)

What the Flutter app expects from the server. The app's models and its
`ApiEndpoints` follow this file; change both together.

Base URL: `/api/v1`. JSON in and out, UTF-8. Every request may send
`Accept-Language: ar | en` (default `ar`); messages come back in that language.

Status: ✅ built · 🔜 to build next.

---

## 1. Conventions

### Envelope

Success:

```json
{ "success": true, "message": "تمت العملية بنجاح", "data": {} }
```

Failure:

```json
{
  "success": false,
  "message": "…",
  "code": "VALIDATION_FAILED",
  "errors": [{ "field": "price", "message": "…" }]
}
```

The app shows `message` as is and branches on `code`. A wrong password on an
account action is `400 WRONG_PASSWORD`, never `401`. A `401` makes the app
refresh the session and, failing that, sign the user out.

### Auth

`Authorization: Bearer <accessToken>` on every route marked 🔒. A route marked
👁 works signed out and returns more (for example `isSaved`) when a token is
sent.

### Lists and pages

Every list takes `?cursor=<opaque>&limit=<1..50, default 20>` and returns:

```json
{ "items": [ ], "nextCursor": "eyJ…" | null, "total": 132 }
```

`nextCursor: null` means the last page. `total` may be omitted when costly.

### Dates, money, phones, media

- Dates are ISO 8601 in UTC: `"2026-10-16T12:21:01.066Z"`.
- Prices are whole Egyptian pounds as integers: `1250`.
- Phones are E.164: `"+201012345678"`.
- Media the server stores are **paths**, not full URLs:
  `"/uploads/parts/<uuid>.jpg"`. The app joins them to the server address,
  so they survive a change of host. Outside URLs (`https://…`) pass through.

### Enums (wire values)

| Name                | Values                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `category`          | `ENGINE`, `BRAKES`, `SUSPENSION`, `ELECTRICAL`, `BODY`, `LIGHTS`, `FILTERS`, `TYRES`     |
| `condition`         | `NEW`, `USED`, `IMPORTED`                                                                |
| `origin`            | `ORIGINAL`, `AFTERMARKET` (the part's `isOriginal`)                                      |
| `sort`              | `NEWEST`, `PRICE_LOW`, `PRICE_HIGH`                                                      |
| `notification.kind` | `FITS_YOUR_CAR`, `PRICE_DROP`, `LISTING`, `SYSTEM`                                       |
| `report.target`     | `PART`, `SELLER`                                                                         |
| `report.reason`     | `FAKE`, `WRONG_INFO`, `COUNTERFEIT`, `STOLEN`, `SCAM`, `UNREACHABLE`, `ABUSIVE`, `OTHER` |

Car makes and models (`brandId`, `modelId`, such as `toyota` / `corolla`) are
the ids in the app's `car_catalog.dart`. The server validates against the same
list (`GET /vehicles` later serves it, 🔜).

---

## 2. Shapes

### User ✅

```json
{
  "id": "6ad216adf504919785738b1b",
  "fullName": "منى أحمد",
  "email": "mona@example.com",
  "phone": "+201012345678",
  "profilePhotoUrl": "/uploads/avatars/<uuid>.jpg" | null,
  "accountType": "USER" | "SELLER",
  "accountStatus": "ACTIVE" | "SUSPENDED",
  "primaryIdentifierType": "email",
  "emailVerification": { "isVerified": true, "verifiedAt": "…" },
  "phoneVerification": { "isVerified": false, "verifiedAt": null },
  "createdAt": "…", "updatedAt": "…"
}
```

### Fitment

```json
{ "brandId": "toyota", "modelId": "corolla", "fromYear": 2014, "toYear": 2026 }
```

### Part

```json
{
  "id": "p_9f2c…",
  "name": "طقم تيل فرامل أمامي",
  "category": "BRAKES",
  "condition": "NEW",
  "isOriginal": true,
  "price": 1250,
  "oldPrice": 1450 | null,
  "partNumber": "04465-02220" | null,
  "description": "طقم تيل أصلي…" | null,
  "images": ["/uploads/parts/<uuid>.jpg"],
  "fitments": [Fitment],
  "city": "القاهرة",
  "isFeatured": false,
  "isSold": false,
  "listedAt": "…",
  "seller": {
    "id": "6ad2…",
    "name": "الأمانة لقطع الغيار",
    "phone": "+201001234501",
    "photoUrl": "/uploads/avatars/<uuid>.jpg" | null,
    "verified": true
  },
  "isSaved": false,
  "stats": { "views": 120, "calls": 8, "whatsapps": 5 }
}
```

- `listedAt` is the last listing or renewal time; "latest" sorts by it.
- `isSaved` is present only with a token.
- `stats` is present only for the part's own seller.
- `seller.phone` is the number the seller listed the part with (it may differ
  from their account phone).

### Seller

```json
{
  "id": "6ad2…",
  "name": "…",
  "city": "القاهرة",
  "photoUrl": null,
  "verified": true,
  "partsCount": 12,
  "categoriesCount": 3,
  "firstListedAt": "…",
  "phone": "+201001234501"
}
```

### Notification

```json
{
  "id": "n_…", "kind": "FITS_YOUR_CAR",
  "title": "قطعة جديدة تركب على عربيتك",
  "body": "…", "partId": "p_…" | null,
  "read": false, "createdAt": "…"
}
```

---

## 3. Endpoints

### Auth ✅ (`/auth`)

| Method | Path                    | Body                                                             | Notes                                                                          |
| ------ | ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| POST   | `/auth/register`        | `fullName, identifier (email), phone, password, confirmPassword` | 201; emails a code                                                             |
| POST   | `/auth/login`           | `identifier, password, rememberMe?`                              | `{ accessToken, refreshToken, user }`; `403 ACCOUNT_NOT_VERIFIED` sends a code |
| POST   | `/auth/verify-otp`      | `identifier, otp, purpose: register \| password_reset`           | reset gives `{ resetToken }`                                                   |
| POST   | `/auth/resend-otp`      | `identifier, purpose`                                            | `429 OTP_RESEND_TOO_SOON` with `retryAfterSeconds`                             |
| POST   | `/auth/forgot-password` | `identifier`                                                     | same answer for unknown emails                                                 |
| POST   | `/auth/reset-password`  | `resetToken, newPassword, confirmPassword`                       | signs out everywhere                                                           |
| POST   | `/auth/refresh`         | `refreshToken`                                                   | rotates; a replayed token ends the session                                     |
| POST   | `/auth/logout` 🔒       |                                                                  |                                                                                |

### Account ✅ (`/users/me`) 🔒

| Method | Path                 | Body                                            | Returns                                                  |
| ------ | -------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| GET    | `/users/me`          |                                                 | User                                                     |
| PATCH  | `/users/me`          | `fullName?, phone?`                             | User                                                     |
| PATCH  | `/users/me/password` | `currentPassword, newPassword, confirmPassword` | message; keeps this session, signs out others            |
| DELETE | `/users/me`          | `password`                                      | message; deletes the account, its parts, sessions, photo |
| POST   | `/users/me/photo`    | multipart `photo` (JPEG/PNG/WebP ≤ 5 MB)        | User                                                     |
| DELETE | `/users/me/photo`    |                                                 | User                                                     |

Deleting the account must also delete the user's parts and their photos,
saved parts and reports they made (🔜 once those exist).

### Parts ✅

| Method | Path                 | Auth      | Body / query                          | Returns                                                                      |
| ------ | -------------------- | --------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/parts`             | 👁         | see **Search** below                  | page of Part                                                                 |
| GET    | `/parts/featured`    | 👁         | `condition?, cars?, limit?`           | `{ items: [Part] }`                                                          |
| GET    | `/parts/:id`         | 👁         |                                       | Part; counts a view unless it is the caller's own                            |
| GET    | `/parts/:id/similar` | 👁         | `limit?`                              | `{ items: [Part] }` (same category or same models, never itself, never sold) |
| GET    | `/parts/mine`        | 🔒        | page; sold included                   | page of Part (with `stats`)                                                  |
| POST   | `/parts`             | 🔒        | Part fields below                     | Part, 201                                                                    |
| PATCH  | `/parts/:id`         | 🔒 seller | any Part fields below                 | Part                                                                         |
| DELETE | `/parts/:id`         | 🔒 seller |                                       | message; deletes its photos                                                  |
| POST   | `/parts/:id/sold`    | 🔒 seller | `{ "sold": true \| false }`           | Part                                                                         |
| POST   | `/parts/:id/renew`   | 🔒 seller |                                       | Part with `listedAt` now and `isSold: false`                                 |
| POST   | `/parts/:id/contact` | 👁         | `{ "channel": "CALL" \| "WHATSAPP" }` | 204; counts a contact unless it is the caller's own                          |

Part fields on create and edit:

```json
{
  "name": "…", "category": "BRAKES", "condition": "NEW", "isOriginal": true,
  "price": 1250, "oldPrice": 1450, "partNumber": "…", "description": "…",
  "images": ["/uploads/parts/<uuid>.jpg"], "fitments": [Fitment],
  "city": "القاهرة", "phone": "+201012345678"
}
```

Rules: `name` 3–100 chars; `price` 1–10,000,000; `oldPrice` > `price` when
sent; 1–8 `images`, all uploaded by the caller; 1–20 `fitments` with
`fromYear ≤ toYear` inside the model's years; `city` one of the 27
governorates; `description` ≤ 1000 chars.

Sold parts are hidden from `/parts`, `/parts/featured`, `/parts/:id/similar`
and seller pages, but `GET /parts/:id` still returns them (with
`isSold: true`) so saved and shared links explain themselves.

#### Search (`GET /parts`)

| Query                             | Meaning                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `q`                               | words, all must match name, part number (dashes ignored), make or model; Arabic letter forms and diacritics normalised (أ إ آ → ا, ة → ه, ى → ي) |
| `category`, `condition`, `origin` | enums above                                                                                                                                      |
| `city`                            | governorate                                                                                                                                      |
| `minPrice`, `maxPrice`            | whole pounds                                                                                                                                     |
| `cars`                            | fits any of these cars: `toyota:corolla:2016,hyundai:elantra:2015`                                                                               |
| `sort`                            | `NEWEST` (default), `PRICE_LOW`, `PRICE_HIGH`                                                                                                    |
| `sellerId`                        | only this seller's parts                                                                                                                         |
| `cursor`, `limit`                 | paging                                                                                                                                           |

Response adds `facets` on the first page, for the filter sheet:

```json
{ "items": [Part], "nextCursor": "…", "total": 132,
  "facets": { "cities": ["القاهرة", "الجيزة"], "maxPrice": 68000 } }
```

### Uploads ✅ 🔒

| Method | Path             | Body                                     | Returns                                   |
| ------ | ---------------- | ---------------------------------------- | ----------------------------------------- |
| POST   | `/uploads/parts` | multipart `photo` (JPEG/PNG/WebP ≤ 8 MB) | `{ "path": "/uploads/parts/<uuid>.jpg" }` |

Photos are uploaded one by one while the seller fills the form, then sent as
`images` paths. Cleaning up uploads never used by a listing is still to do (🔜).

### Sellers 🔜 👁

| Method | Path                 | Returns                                                 |
| ------ | -------------------- | ------------------------------------------------------- |
| GET    | `/sellers/:id`       | Seller                                                  |
| GET    | `/sellers/:id/parts` | page of Part (same query as `/parts`, `sellerId` fixed) |

### Saved parts 🔜 🔒

| Method | Path                      | Returns                                                            |
| ------ | ------------------------- | ------------------------------------------------------------------ |
| GET    | `/users/me/saved`         | page of Part (sold ones included, marked)                          |
| PUT    | `/users/me/saved/:partId` | 204                                                                |
| DELETE | `/users/me/saved/:partId` | 204                                                                |
| POST   | `/users/me/saved/sync`    | body `{ "partIds": [] }` saved on the device while signed out; 204 |

### Notifications 🔜 🔒

| Method | Path                            | Body                                 | Returns                                                    |
| ------ | ------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| GET    | `/notifications`                |                                      | page of Notification, newest first, plus `unreadCount`     |
| POST   | `/notifications/:id/read`       |                                      | 204                                                        |
| POST   | `/notifications/read-all`       |                                      | 204                                                        |
| DELETE | `/notifications/:id`            |                                      | 204                                                        |
| GET    | `/notifications/settings`       |                                      | `{ "fitsMyCar": true, "priceDrops": true, "news": false }` |
| PUT    | `/notifications/settings`       | same shape                           | same                                                       |
| PUT    | `/notifications/devices/:token` | `{ "platform": "ios" \| "android" }` | 204; push token                                            |
| DELETE | `/notifications/devices/:token` |                                      | 204; on sign-out                                           |

The server sends:

- `FITS_YOUR_CAR` when a new part fits one of the user's cars (see Cars);
- `PRICE_DROP` when a saved part's price goes down;
- `LISTING` for news about the user's own parts (renewal reminders after 30
  days, a part removed after reports);
- `SYSTEM` for announcements.

### Cars (garage) 🔜 🔒

So "new part fits your car" can work, the server needs the user's cars. The
app keeps them on the device and syncs them:

| Method | Path             | Body                       | Returns                                           |
| ------ | ---------------- | -------------------------- | ------------------------------------------------- |
| GET    | `/users/me/cars` |                            | `{ "items": [{ "brandId", "modelId", "year" }] }` |
| PUT    | `/users/me/cars` | `{ "items": [...] }` (≤ 5) | same                                              |

### Reports 🔜 🔒

| Method | Path       | Body                                                                                   | Returns |
| ------ | ---------- | -------------------------------------------------------------------------------------- | ------- |
| POST   | `/reports` | `{ "target": "PART" \| "SELLER", "targetId": "…", "reason": "SCAM", "details": "…"? }` | 201     |

One report per user and target (`409 ALREADY_REPORTED` on a repeat).
`details` is required (≥ 5 chars) for `OTHER`. Reasons must suit the target:
part-only `FAKE, WRONG_INFO, COUNTERFEIT, STOLEN`; seller-only
`UNREACHABLE, ABUSIVE`; both `SCAM, OTHER`.

### Health ✅

`GET /health` → `{ "status": "ok" | "degraded", "database": "up" | "down" }`.

---

## 4. New error codes

| Code               | Status | When                                    |
| ------------------ | ------ | --------------------------------------- |
| `PART_NOT_FOUND`   | 404    | unknown or deleted part                 |
| `NOT_PART_OWNER`   | 403    | editing someone else's part             |
| `TOO_MANY_PHOTOS`  | 400    | more than 8 images                      |
| `UPLOAD_NOT_OWNED` | 400    | an image path the caller did not upload |
| `ALREADY_REPORTED` | 409    | second report of the same target        |
| `TOO_MANY_CARS`    | 400    | more than 5 cars                        |
