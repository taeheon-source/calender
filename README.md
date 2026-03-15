# 2026 Korea Shared Calendar

Next.js and Postgres based calendar for 2026 South Korea schedules.

## Local setup

1. Copy `.env.example` to `.env.local`
2. Set `POSTGRES_URL`
3. Install packages with `npm install`
4. Run `npm run dev`

## Deploy to Vercel

1. Push this folder to a Git repository
2. Import the repository in Vercel
3. Add a Postgres database in Vercel Storage or connect an external Postgres database
4. Set `POSTGRES_URL` in the Vercel project environment variables
5. Deploy

The app auto-creates the `calendar_events` table on first API access.
