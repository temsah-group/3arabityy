# 3arabity عربيتي — Front (web)

The website for buyers and sellers, next to the Flutter app. Same API
(`3arabity-backend`), same rules, same look (navy `#14213D`, orange `#F77F00`,
Cairo). Arabic and RTL by default, English from the header.

React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind.

## Run it

```bash
# 1. The API, in another terminal (sample data, codes printed in its log)
cd ../3arabity-backend && npm run dev:memory

# 2. The site
npm install
npm run dev        # http://localhost:5174
```

Sign in with `seller01@example.com` / `Password123`. When you register, the
6-digit code appears in the API's console.

In development Vite forwards `/api` and `/uploads` to the API
(`API_PROXY_TARGET`, default `http://localhost:3000`), so the browser sees one
origin and the backend needs no CORS setup. Port 5174 leaves 5173 to the admin
dashboard.

## Production

`npm run build` makes `dist/`, a static single-page site: serve `index.html`
for every path that is not a file.

- Same domain (recommended): put the site and the API behind one host and send
  `/api` and `/uploads` to the API. Nothing else to set.
- Different hosts: build with `VITE_API_URL=https://api.example.com/api/v1`
  and add the site's address to the backend's `CORS_ORIGINS`.

## Layout

```
src/
  lib/          api (envelope, errors, token refresh), auth, i18n, catalog
                (categories, governorates, cars from /app-config), collections
                (garage, saved, recently viewed), paging, types
  components/   Layout, ui, parts, cars, shops, reviews, actions
  pages/        Home, parts/, shops/, auth/, account/, notifications/, Help
```

Copy is written as `tr('عربي', 'English')` next to each other.

## Behaviour that follows the app

- Saved parts and the garage stay on the device while signed out and go to
  the account on sign-in (`/users/me/saved/sync`, `/users/me/cars`). Signing
  out clears them from the device.
- A 401 refreshes the session once; if that fails the user is told they were
  signed out.
- Calls and WhatsApp taps are counted (`/parts/:id/contact`,
  `/shops/:id/contact`), which also lets the buyer review.

## Not in this version

- Google sign-in: needs a Web client id in the backend's `GOOGLE_CLIENT_IDS`.
- Browser push: the API registers `ios` and `android` devices only.
- Picking a shop's location on a map (the shop page links to Google Maps by
  address instead).
- Tokens live in `localStorage`. An `httpOnly` cookie for the refresh token
  would be safer but needs a backend change.
