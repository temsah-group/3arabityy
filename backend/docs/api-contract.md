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
  "hasPassword": true,
  "signedInWithGoogle": false,
  "createdAt": "…", "updatedAt": "…"
}
```

`hasPassword` is false for an account made with Google until it sets a
password; such an account changes its password without the current one and
confirms deleting with Google instead.

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
  "rating": { "avg": 4.5, "count": 12 },
  "shop": ShopSummary | null,
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
- `shop` is the seller's shop while it is approved and shown:
  `{ id, name, logoUrl, verified, rating: { avg, count }, delivers }`.

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
  "phone": "+201001234501",
  "shopId": "s_…" | null
}
```

`shopId`: the seller's open shop, which the app shows instead.

### Shop

```json
{
  "id": "s_…", "ownerId": "6ad2…",
  "name": "محل النور لقطع الغيار", "description": "…" | null,
  "logoUrl": "/uploads/shops/<uuid>.jpg" | null, "coverUrl": … | null,
  "phone": "+20100…", "whatsapp": "+20100…" | null,
  "city": "القاهرة", "address": "12 شارع التحرير، الدقي",
  "location": { "lat": 30.04, "lng": 31.21 } | null,
  "hours": "يومياً ١٠ص - ١٠م" | null,
  "brandIds": ["toyota"], "categories": ["BRAKES"],
  "delivery": {
    "available": true, "governorates": ["القاهرة", "الجيزة"],
    "feeFrom": 50 | null, "feeTo": 100 | null,
    "eta": "خلال يومين" | null, "note": … | null
  },
  "verified": true, "featured": false,
  "rating": { "avg": 4.6, "count": 31 },
  "delivers": true, "partsCount": 42, "createdAt": "…"
}
```

The owner's own shop (`/shops/mine`) adds `status` (`PENDING`, `APPROVED`,
`REJECTED`, `SUSPENDED`), `statusReason` (why it was rejected or suspended)
and `hidden` (the owner's account is suspended).

### Notification

```json
{
  "id": "n_…", "kind": "FITS_YOUR_CAR",
  "title": "قطعة جديدة تركب على عربيتك",
  "body": "…", "partId": "p_…" | null, "shopId": "s_…" | null,
  "read": false, "createdAt": "…"
}
```

Kinds: `FITS_YOUR_CAR`, `PRICE_DROP`, `LISTING`, `SHOP` (the shop was
approved, rejected, suspended or restored; opens `shopId`), `REVIEW` (a new
review for the seller, or the seller's answer for its author; opens the part
or shop), `SYSTEM`. Pushes carry `notificationId`, `kind`, and `partId` or
`shopId`.

### Review

```json
{
  "id": "r_…", "target": "SHOP" | "PART", "targetId": "…",
  "rating": 4, "text": "محترمين وسريعين" | null,
  "author": { "name": "منى أ.", "photoUrl": … | null },
  "reply": { "text": "…", "at": "…" } | null,
  "mine": false, "createdAt": "…", "updatedAt": "…"
}
```

`author.name` is the first name and the initial of the second.

---

## 3. Endpoints

### Auth ✅ (`/auth`)

| Method | Path                    | Body                                                             | Notes                                                                                    |
| ------ | ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST   | `/auth/register`        | `fullName, identifier (email), phone, password, confirmPassword` | 201; emails a code                                                                       |
| POST   | `/auth/login`           | `identifier, password, rememberMe?`                              | `{ accessToken, refreshToken, user }`; `403 ACCOUNT_NOT_VERIFIED` sends a code           |
| POST   | `/auth/google`          | `idToken, phone?, fullName?, rememberMe?`                        | as login; a first sign-in without `phone` is `400 PHONE_REQUIRED` with `email, fullName` |
| POST   | `/auth/verify-otp`      | `identifier, otp, purpose: register \| password_reset`           | reset gives `{ resetToken }`                                                             |
| POST   | `/auth/resend-otp`      | `identifier, purpose`                                            | `429 OTP_RESEND_TOO_SOON` with `retryAfterSeconds`                                       |
| POST   | `/auth/forgot-password` | `identifier`                                                     | same answer for unknown emails                                                           |
| POST   | `/auth/reset-password`  | `resetToken, newPassword, confirmPassword`                       | signs out everywhere                                                                     |
| POST   | `/auth/refresh`         | `refreshToken`                                                   | rotates; a replayed token ends the session                                               |
| POST   | `/auth/logout` 🔒       |                                                                  |                                                                                          |

### Account ✅ (`/users/me`) 🔒

| Method | Path                 | Body                                             | Returns                                                  |
| ------ | -------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| GET    | `/users/me`          |                                                  | User                                                     |
| PATCH  | `/users/me`          | `fullName?, phone?`                              | User                                                     |
| PATCH  | `/users/me/password` | `currentPassword?, newPassword, confirmPassword` | message; keeps this session, signs out others            |
| DELETE | `/users/me`          | `password`, or `idToken` without a password      | message; deletes the account, its parts, sessions, photo |
| POST   | `/users/me/photo`    | multipart `photo` (JPEG/PNG/WebP ≤ 5 MB)         | User                                                     |
| DELETE | `/users/me/photo`    |                                                  | User                                                     |

Deleting the account must also delete the user's parts and their photos,
saved parts and reports they made (🔜 once those exist).

### Parts ✅

| Method | Path                 | Auth      | Body / query                          | Returns                                                                      |
| ------ | -------------------- | --------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/parts`             | 👁         | see **Search** below                  | page of Part                                                                 |
| GET    | `/parts/featured`    | 👁         | `condition?, cars?, limit?`           | `{ items: [Part] }`                                                          |
| GET    | `/parts/home`        | 👁         | `condition?, cars?`                   | `{ featured: [Part] (≤ 8), latest: [Part] (≤ 6), fittingCount }`             |
| GET    | `/parts/batch`       | 👁         | `ids=a,b,…` (≤ 50)                    | `{ items: [Part] }` in that order, sold included, unknown skipped; no views  |
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

`/parts/home` is the app's home screen in one request: the newest featured
parts and the newest parts for the condition and cars, and `fittingCount`,
how many parts for sale fit any of `cars` whatever their condition (0
without `cars`).

Sold parts are hidden from `/parts`, `/parts/featured`, `/parts/home`, `/parts/:id/similar`
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

### Sellers ✅ 👁

| Method | Path                 | Returns                                                 |
| ------ | -------------------- | ------------------------------------------------------- |
| GET    | `/sellers/:id`       | Seller                                                  |
| GET    | `/sellers/:id/parts` | page of Part (same query as `/parts`, `sellerId` fixed) |

Counts and `firstListedAt` cover parts for sale. `city` is where most of them
are; `phone` is the number on the latest listing (null with no listings), never
the account's own. Unknown id: `404 SELLER_NOT_FOUND`.

### Shops ✅

| Method | Path                      | Body / query                                         | Returns          |
| ------ | ------------------------- | ---------------------------------------------------- | ---------------- |
| GET    | `/shops`                  | `?q&city&deliversTo&brandId&sort=TOP\|NEWEST&cursor` | page of Shop     |
| GET    | `/shops/:id`              |                                                      | Shop             |
| GET    | `/shops/:id/parts`        | same query as `/parts`                               | page of Part     |
| GET    | `/shops/mine` 🔒          |                                                      | own Shop \| null |
| POST   | `/shops` 🔒               | Shop fields (no ids, counts or flags)                | 201 own Shop     |
| PATCH  | `/shops/mine` 🔒          | changed fields                                       | own Shop         |
| POST   | `/shops/mine/logo` 🔒     | multipart `photo` (≤ 5 MB)                           | own Shop         |
| POST   | `/shops/mine/cover` 🔒    | multipart `photo`                                    | own Shop         |
| DELETE | `/shops/mine/logo\|cover` |                                                      | own Shop         |

- One shop per account; a second application is `409 SHOP_EXISTS`.
- A new shop is `PENDING` and buyers see nothing of it until a moderator
  approves it. Editing a `REJECTED` shop sends it back to `PENDING`; a
  `SUSPENDED` one cannot be edited (`403 SHOP_SUSPENDED`).
- Once approved, every part the owner lists (before and after) shows under it.
- With `delivery.available`, `governorates` needs at least one.
- `TOP` puts featured shops first, then by rating, weighted so a shop with a
  couple of reviews doesn't outrank one with many. Shop lists page by
  position: `nextCursor` is a number as a string.
- `GET /parts/home` also returns `shops`: up to 10, in `TOP` order.

### Saved parts ✅ 🔒

| Method | Path                      | Returns                                                            |
| ------ | ------------------------- | ------------------------------------------------------------------ |
| GET    | `/users/me/saved`         | page of Part (sold ones included, marked)                          |
| PUT    | `/users/me/saved/:partId` | 204                                                                |
| DELETE | `/users/me/saved/:partId` | 204                                                                |
| POST   | `/users/me/saved/sync`    | body `{ "partIds": [] }` saved on the device while signed out; 204 |

`sync` takes up to 200 ids, oldest saved first; ids of parts that are gone are
skipped. Deleted parts leave every saved list. Parts carry no `isSaved`: the
app knows its saved ids from this list.

### Saved shops ✅ 🔒

| Method | Path                            | Returns                                              |
| ------ | ------------------------------- | ---------------------------------------------------- |
| GET    | `/users/me/saved-shops`         | page of Shop, newest saved first                     |
| PUT    | `/users/me/saved-shops/:shopId` | 204; 404 unless the shop is open                     |
| DELETE | `/users/me/saved-shops/:shopId` | 204                                                  |
| POST   | `/users/me/saved-shops/sync`    | body `{ "shopIds": [] }` saved while signed out; 204 |

Like saved parts. A shop that is suspended or hidden stays saved but is left
out of the list until it opens again; a deleted shop leaves every list.

### Notifications ✅ 🔒

| Method | Path                            | Body                                 | Returns                                                    |
| ------ | ------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| GET    | `/notifications`                |                                      | page of Notification, newest first, plus `unreadCount`     |
| POST   | `/notifications/:id/read`       |                                      | 204                                                        |
| POST   | `/notifications/read-all`       |                                      | 204                                                        |
| DELETE | `/notifications/:id`            |                                      | 204                                                        |
| GET    | `/notifications/settings`       |                                      | `{ "fitsMyCar": true, "priceDrops": true, "news": false }` |
| PUT    | `/notifications/settings`       | same shape                           | same                                                       |
| PUT    | `/notifications/devices/:token` | `{ "platform": "ios" \| "android" }` | 204; push token, in the `Accept-Language` language         |
| DELETE | `/notifications/devices/:token` |                                      | 204; on sign-out                                           |

`title` and `body` come in the request's language. The server sends:

- `FITS_YOUR_CAR` ✅ when a new part fits one of the user's cars (see Cars),
  unless `fitsMyCar` is off; never to its seller;
- `PRICE_DROP` ✅ when a saved part's price goes down, unless `priceDrops` is
  off;
- `LISTING` for news about the user's own parts: ✅ hidden, shown again or
  removed by a moderator; 🔜 renewal reminders after 30 days;
- `SYSTEM` 🔜 for announcements.

Deleting a part deletes its notifications. Everything put in an inbox is also
pushed through Firebase to the user's registered phones, in the language the
app had when it registered the token (`Accept-Language`), so the app
registers again after a language change. The push carries
`data: { notificationId, kind, partId? }` for the tap; Android shows it on the
`arabity_default` channel. Tokens FCM reports as gone are deleted.

### Cars (garage) ✅ 🔒

So "new part fits your car" can work, the server needs the user's cars. The
app keeps them on the device and syncs them:

| Method | Path             | Body                       | Returns                                           |
| ------ | ---------------- | -------------------------- | ------------------------------------------------- |
| GET    | `/users/me/cars` |                            | `{ "items": [{ "brandId", "modelId", "year" }] }` |
| PUT    | `/users/me/cars` | `{ "items": [...] }` (≤ 5) | same                                              |

### Reviews ✅

| Method | Path                                | Body / query                | Returns                       |
| ------ | ----------------------------------- | --------------------------- | ----------------------------- |
| GET    | `/shops/:id/reviews` 👁              | `?cursor&limit`             | page of Review (see below)    |
| GET    | `/parts/:id/reviews` 👁              | `?cursor&limit`             | page of Review                |
| PUT    | `/shops\|parts/:id/reviews/mine` 🔒 | `{ rating, text? }`         | Review                        |
| DELETE | `/shops\|parts/:id/reviews/mine` 🔒 |                             | 200                           |
| POST   | `/shops/:id/contact` 👁              | `{ channel }`               | 204                           |
| GET    | `/reviews/received` 🔒              | `?cursor&limit`             | page of Review + `targetName` |
| PUT    | `/reviews/:id/reply` 🔒             | `{ text }`; null removes it | Review                        |

- The first page also has `summary: { avg, count, breakdown: [1★…5★] }`,
  `mine` (the viewer's review or null) and `canReview`.
- Only a buyer who reached the seller may review (`403 REVIEW_NOT_ALLOWED`):
  a part needs a call or WhatsApp about that part (`POST /parts/:id/contact`
  with a token); a shop, about any of its parts or from the shop page
  (`POST /shops/:id/contact`). Never the seller (`400 REVIEW_OWN`).
- One review per buyer and shop or part; `PUT` again changes it. The seller
  is told of the first one; the author is told of the seller's first answer.
- Only the seller answers (`403 NOT_REVIEW_SELLER`).
- Hidden reviews (by a moderator) are not listed and don't count.

### Reports ✅ 🔒

| Method | Path       | Body                                                                                   | Returns |
| ------ | ---------- | -------------------------------------------------------------------------------------- | ------- |
| POST   | `/reports` | `{ "target": "PART" \| "SELLER", "targetId": "…", "reason": "SCAM", "details": "…"? }` | 201     |

One report per user and target (`409 ALREADY_REPORTED` on a repeat).
`details` is required (≥ 5 chars) for `OTHER`. Reasons must suit the target:
part-only `FAKE, WRONG_INFO, COUNTERFEIT, STOLEN`; seller-only
`UNREACHABLE, ABUSIVE`; both `SCAM, OTHER`. A seller's `targetId` is their
account id (the part's `seller.id`). Reporting one's own part or oneself is
`400 CANNOT_REPORT_SELF`; an unknown target `404 PART_NOT_FOUND` or
`SELLER_NOT_FOUND`. A review (`target: "REVIEW"`) takes `FAKE, ABUSIVE,
OTHER`; its owner is whoever wrote it.

### Admin dashboard ✅ (`/admin`)

For the dashboard only (the separate `3arabity-admin` project), never the app.
Served only when `ADMIN_JWT_SECRET` is set; browsers only from
`ADMIN_ORIGINS`. Admins are their own accounts (`admins` collection), made
with `npm run admin:create`; app tokens are refused (401) and admin tokens
open none of the app's routes.

`POST /admin/auth/login` `{ "email", "password" }` → `{ accessToken,
expiresInSeconds, admin: { id, email, fullName, role, lastLoginAt } }`. One
token, `ADMIN_TOKEN_HOURS` long, no refresh; five wrong passwords lock the
admin for 15 minutes (`429 ACCOUNT_LOCKED`). Everything else needs
`Authorization: Bearer <admin token>`.

Tables page by offset: `?page=1&pageSize=25` (≤ 100) →
`{ items, total, page, pageSize }`.

| Method | Path                                 | Body / query                                                                                                    | Who   |
| ------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----- |
| GET    | `/admin/auth/me`                     |                                                                                                                 | all   |
| GET    | `/admin/overview`                    | counts of users, parts and open reports                                                                         | all   |
| GET    | `/admin/stats`                       | `?days=7…365` (30): see below                                                                                   | all   |
| GET    | `/admin/reports`                     | `?status=OPEN\|CLOSED&target=PART\|SELLER`, grouped by target                                                   | all   |
| GET    | `/admin/reports/:target/:id`         | every report on it, with reporters                                                                              | all   |
| POST   | `/admin/reports/:target/:id/resolve` | `{ "action": "DISMISS\|HIDE_PART\|REMOVE_PART\|HIDE_REVIEW\|SUSPEND_SELLER", "note" }`                          | all   |
| GET    | `/admin/users`                       | `?q=&status=ACTIVE\|SUSPENDED&verified=true\|false`                                                             | all   |
| GET    | `/admin/users/:id`                   | account, counts, cars, history                                                                                  | all   |
| PATCH  | `/admin/users/:id`                   | `{ "status"?, "verified"?, "note" }`; `verified` owners only                                                    | all   |
| GET    | `/admin/parts`                       | `?q=&status=FOR_SALE\|SOLD\|HIDDEN&featured=&sellerId=`                                                         | all   |
| GET    | `/admin/parts/:id`                   | part, seller, stats, open reports, history                                                                      | all   |
| PATCH  | `/admin/parts/:id`                   | `{ "hidden"?, "featured"?, "note" }`; `featured` owners only                                                    | all   |
| DELETE | `/admin/parts/:id`                   | `{ "note" }`                                                                                                    | all   |
| GET    | `/admin/shops`                       | `?status&q&page`; adds `counts` per status                                                                      | all   |
| GET    | `/admin/shops/:id`                   | own Shop, `owner`, `history`                                                                                    | all   |
| PATCH  | `/admin/shops/:id`                   | `{ "status"?, "featured"?, "verified"?, "note" }`; note for reject/suspend                                      | all   |
| GET    | `/admin/reviews`                     | `?hidden&target&sellerId&page`                                                                                  | all   |
| PATCH  | `/admin/reviews/:id`                 | `{ "hidden", "note" }`                                                                                          | all   |
| GET    | `/admin/settings`                    | as `/app-config`                                                                                                | owner |
| PUT    | `/admin/settings/support`            | `{ "email", "phone", "whatsapp" }` (E.164)                                                                      | owner |
| PUT    | `/admin/settings/documents/:name`    | `terms\|privacy\|faq`: `{ "sections": [...] }` (1–50)                                                           | owner |
| PUT    | `/admin/settings/cars`               | `{ "brands": [{ id, nameAr, nameEn, models: [{ id, nameAr, nameEn, fromYear, toYear }] }] }`                    | owner |
| GET    | `/admin/announcements`               | sent announcements, newest first                                                                                | owner |
| POST   | `/admin/announcements`               | `{ titleAr, titleEn, bodyAr, bodyEn, audience: "ALL"\|"SELLERS", inbox, banner, bannerUntil? }`                 | owner |
| POST   | `/admin/announcements/:id/end`       | takes the home banner down; inbox messages stay                                                                 | owner |
| DELETE | `/admin/announcements/:id`           | removes it from the home screen and every inbox                                                                 | owner |
| GET    | `/admin/offers`                      | the home screen's offers, in order, with `active`, `endsAt`, `live`                                             | owner |
| POST   | `/admin/offers/photo`                | multipart `photo` → `{ path }` under `/uploads/offers/`                                                         | owner |
| POST   | `/admin/offers`                      | `{ tagAr, tagEn, titleAr, titleEn, subtitleAr?, subtitleEn?, image, condition?, active?, endsAt? }`; goes first | owner |
| PATCH  | `/admin/offers/:id`                  | any of those fields                                                                                             | owner |
| PUT    | `/admin/offers/order`                | `{ ids }` first to last                                                                                         | owner |
| DELETE | `/admin/offers/:id`                  | removes it and its photo                                                                                        | owner |
| GET    | `/admin/audit`                       | `?targetId=&adminId=`                                                                                           | owner |

Roles: `OWNER` does everything; `MODERATOR` cannot verify sellers, feature
parts or read the log (`403 ADMIN_ROLE_REQUIRED`). Suspending, restoring,
hiding, showing, removing and every resolution but `DISMISS` need a `note`
of ≥ 3 characters (`400 NOTE_REQUIRED`); it goes to the audit log, never to
the user.

- **Suspending** signs the account out everywhere and hides all its parts;
  restoring shows again the parts the suspension hid (not ones a moderator
  hid).
- **Hidden parts** are left out of search, featured, similar, sellers' pages
  and saved lists, and `GET /parts/:id` is 404 for anyone but their seller,
  who sees `isHidden: true`. The seller gets a `LISTING` notification on
  hiding, showing and removal (params `["HIDDEN"|"RESTORED"|"REMOVED", name]`).
- **Resolving** closes every open report on that target, keeping the
  action, note, admin and time.
- **Statistics** (`/admin/stats`): `daily` (`[{ date: "YYYY-MM-DD", users,
parts }]`, Cairo days, quiet ones included), `totals` over the range, and
  over parts for sale now: `forSale` (`parts, sellers, sold, views, calls,
whatsapps`, totals since each part went up), `byCategory`, `byCity` and
  `byBrand` (top 10, `[{ key, count }]`, brands with `name`) and `topParts`
  (top 10 by calls + WhatsApp).
- **Announcements** go, with `inbox`, to every active account (`ALL`) or
  every one with a part listed (`SELLERS`) as a `SYSTEM` notification with
  params `[titleAr, bodyAr, titleEn, bodyEn]`, shown in the reader's
  language. With `banner` the newest one still up shows on the home screen
  (`announcement` in `/app-config`), to signed-out users too, until
  `bannerUntil` or until it is ended. At least one of `inbox` and `banner`.
- **Cars**: the whole list at once. Codes (`id`) are lower-case letters,
  digits and dashes, unique per list and per make. A make or model that a
  part or a user's car uses cannot be removed (`409 CARS_IN_USE`); renaming
  and changing years is fine. New parts are checked against the saved list
  at once; other servers catch up within a minute.

### App config ✅ 👁

`GET /app-config` → what the app says about 3arabity, edited from the dashboard:

```json
{
  "support": { "email": "…", "phone": "+20…", "whatsapp": "+20…" } | null,
  "terms":   { "sections": [{ "titleAr", "titleEn", "bodyAr", "bodyEn" }], "updatedAt": "…" },
  "privacy": { "sections": [...], "updatedAt": "…" },
  "faq":     { "sections": [...], "updatedAt": "…" },
  "cars":    { "brands": [{ "id", "nameAr", "nameEn", "models": [{ "id", "nameAr", "nameEn", "fromYear", "toYear": null }] }], "updatedAt": "…" | null },
  "announcement": { "id", "titleAr", "titleEn", "bodyAr", "bodyEn", "createdAt" } | null,
  "offers": [{ "id", "tagAr", "tagEn", "titleAr", "titleEn", "subtitleAr", "subtitleEn", "image": "/uploads/offers/…", "condition": "NEW"|"USED"|"IMPORTED"|null }],
  "updatedAt": "…" | null
}
```

FAQ sections are questions (`title…`) and answers (`body…`). `{supportEmail}`
in any text stands for `support.email`. `support` is null until an owner
sets it from the dashboard; there are no placeholder contacts. Never-edited
texts are the launch texts. `offers` are the home screen's slides, at most
10, in the dashboard's order; empty until an owner adds some. Cached for five minutes (`Cache-Control`).

### Health ✅

`GET /health` → `{ "status": "ok" | "degraded", "database": "up" | "down" }`.

---

## 4. New error codes

| Code                   | Status | When                                      |
| ---------------------- | ------ | ----------------------------------------- |
| `PART_NOT_FOUND`       | 404    | unknown or deleted part                   |
| `NOT_PART_OWNER`       | 403    | editing someone else's part               |
| `TOO_MANY_PHOTOS`      | 400    | more than 8 images                        |
| `UPLOAD_NOT_OWNED`     | 400    | an image path the caller did not upload   |
| `ALREADY_REPORTED`     | 409    | second report of the same target          |
| `TOO_MANY_CARS`        | 400    | more than 5 cars                          |
| `SELLER_NOT_FOUND`     | 404    | unknown seller account                    |
| `CANNOT_REPORT_SELF`   | 400    | reporting one's own part or oneself       |
| `ADMIN_ROLE_REQUIRED`  | 403    | a moderator doing an owner's action       |
| `NOTE_REQUIRED`        | 400    | an admin action without a reason          |
| `USER_NOT_FOUND`       | 404    | unknown account, in the dashboard         |
| `CARS_IN_USE`          | 409    | removing a car parts or users still use   |
| `PHONE_REQUIRED`       | 400    | first Google sign-in without a phone      |
| `GOOGLE_TOKEN_INVALID` | 401    | a Google token that does not check out    |
| `GOOGLE_SIGN_IN_OFF`   | 503    | `GOOGLE_CLIENT_IDS` is not set            |
| `USE_GOOGLE`           | 401    | password sign-in to a Google-only account |
| `SHOP_NOT_FOUND`       | 404    | unknown shop, or one buyers may not see   |
| `SHOP_EXISTS`          | 409    | applying for a second shop                |
| `SHOP_SUSPENDED`       | 403    | editing a suspended shop                  |
| `REVIEW_NOT_FOUND`     | 404    | unknown review                            |
| `REVIEW_NOT_ALLOWED`   | 403    | reviewing without reaching the seller     |
| `REVIEW_OWN`           | 400    | reviewing one's own shop or part          |
| `NOT_REVIEW_SELLER`    | 403    | answering a review of someone else        |
