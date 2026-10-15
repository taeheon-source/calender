# 2026 Korea Shared Calendar

Next.js and Postgres based calendar for 2026 South Korea schedules.

## Local setup

1. Copy `.env.example` to `.env.local`
2. Set `POSTGRES_URL` and `SITE_PASSWORD`
3. Install packages with `npm install`
4. Run `npm run dev`

## Deploy to Vercel

1. Push this folder to a Git repository
2. Import the repository in Vercel
3. Add a Postgres database in Vercel Storage or connect an external Postgres database
4. Set `POSTGRES_URL` and `SITE_PASSWORD` in the Vercel project environment variables
5. Deploy

The app auto-creates the `calendar_events` table on first API access.

## Password protection

Set `SITE_PASSWORD` to require a password for every page and API route.
Visitors are redirected to `/login`; a login lasts until the browser is closed.
Changing `SITE_PASSWORD` logs everyone out. If it is not set, the site is open.
