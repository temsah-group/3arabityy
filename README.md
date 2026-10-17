# لوحة عربيتي — 3arabity admin dashboard

The dashboard for running [3arabity](../3arabity): reviewing reports,
suspending accounts, verifying sellers and moderating listings. It talks to
the backend's `/api/v1/admin` API (see `3arabity-backend/docs/api-contract.md`).

React 19, Vite, TypeScript, Mantine (RTL, Arabic), TanStack Query, React Router.

## Run it

Start the API first, in `3arabity-backend`:

```bash
npm run dev:memory   # sample data, with admin@example.com / Password123 (owner)
```

Then here:

```bash
npm install
npm run dev          # http://localhost:5173
```

In development Vite forwards `/api` and `/uploads` to `http://localhost:3000`
(set `API_TARGET` for another address), so there is no CORS to set up.

Against your own API (`npm run dev` in the backend), set `ADMIN_JWT_SECRET` in
the backend's `.env` and make an admin there:

```bash
npm run admin:create -- --email you@example.com --name "Your Name" --role OWNER
```

## Roles

- **مالك (OWNER)**: everything, plus verifying sellers, featuring listings and the audit log.
- **مشرف (MODERATOR)**: reports, suspending and restoring accounts, hiding and removing listings.

Every action asks for a reason, which goes to the audit log and never to the user.

## Build and deploy

```bash
npm test
npm run build        # static files in dist/
```

Set `VITE_API_URL` (e.g. `https://api.3arabity.com/api/v1`) before building,
and add the dashboard's address to the backend's `ADMIN_ORIGINS`. `dist/` is a
single-page app: serve it with every unknown path falling back to `index.html`.
