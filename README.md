# Daily Question Delivery

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/) [![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/) [![Supabase](https://img.shields.io/badge/Supabase-Storage%20%2B%20Realtime-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

A Next.js app that delivers a daily set of questions to students with scheduled unlocks, an admin workflow for uploading and managing the day, and realtime updates via Supabase.

## Table of Contents

-   [Features](#features)
-   [Tech Stack](#tech-stack)
-   [Project Structure](#project-structure)
-   [Data Model](#data-model)
-   [Environment Variables](#environment-variables)
-   [Setup](#setup)
-   [Usage](#usage)
-   [Scheduled Unlocks (CRON)](#scheduled-unlocks-cron)
-   [Supabase Realtime](#supabase-realtime)
-   [Available Scripts](#available-scripts)
-   [Security Notes](#security-notes)
-   [Troubleshooting](#troubleshooting)
-   [Deployment](#deployment)
-   [Contributing](#contributing)
-   [License](#license)

## Features

-   Admin
    -   Create/continue an active daily session
    -   Set a target number of questions (locked after first upload)
    -   Upload question screenshots (stored in Supabase Storage, auto-numbered)
    -   Start/End the day
    -   Unlock questions in batches of 3 (manual button or CRON API)
    -   Live updates for question states and activity log
-   Student
    -   See countdown to next unlock (client-side estimate: last unlock + 30 min)
    -   View unlocked question images
    -   Mark questions as Viewed / Completed
    -   Progress bar of completed vs target
-   Auth
    -   Simple cookie-based HMAC session
    -   Default users seeded on first visit to `Login`:
        -   Admin: `admin` / `admin123`
        -   Student: `student` / `student123`
-   API
    -   `POST /api/unlock` to unlock up to 3 locked questions (Bearer `CRON_SECRET`)

## Tech Stack

-   Next.js 14 (App Router, TypeScript)
-   Prisma ORM (PostgreSQL)
-   Tailwind CSS
-   Supabase (Storage + Realtime)

## Project Structure

```
app/
  admin/
    actions.ts       # Admin server actions
    page.tsx         # Admin UI (target, upload, start/end day, unlock now)
  api/
    unlock/route.ts  # CRON-protected unlock endpoint
  login/
    actions.ts       # Login/logout actions
    page.tsx         # Seeds defaults + login form
  student/
    actions.ts       # Student actions (viewed/completed)
    page.tsx         # Student dashboard loader
  layout.tsx         # Root layout + metadata
  globals.css        # Tailwind theme tokens
components/
  admin/Updates.tsx              # Admin live updates (questions + activity)
  student/StudentDashboard.tsx   # Student view
  ui/button.tsx                  # Button helper (cva)
lib/
  auth.ts            # Cookie session (HMAC), requireRole
  password.ts        # scrypt hashing
  prisma.ts          # Prisma client
  storage.ts         # Supabase Storage helpers
  system-user.ts     # Ensures system user
  supabase/
    client.ts        # Browser client (anon)
    server.ts        # Server client with cookies
    service.ts       # Service role client
prisma/
  schema.prisma      # DB schema
  migrations/        # Prisma migrations
```

## Data Model

-   `User`: `id`, `email` (unique), `username?` (unique), `passwordHash?`, `role`, `createdAt`
-   `Session`: `id`, `target`, `uploaded`, `startedAt?`, `endedAt?`, `active`, `createdAt`
-   `Question`: `id`, `sessionId` → `Session`, `number` (unique per session), `imageUrl`, `status` (`locked` | `unlocked` | `viewed` | `completed`), `unlockTime?`, `createdAt`
-   `UserActivity`: `id`, `questionId` → `Question`, `studentId` → `User`, `action` (`unlocked` | `viewed` | `completed`), `timestamp`

Details in `prisma/schema.prisma`.

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

-   `DATABASE_URL` — Postgres pooled connection (app runtime)
-   `DIRECT_URL` — Postgres direct connection (Prisma CLI)
-   `AUTH_SECRET` — Random string for HMAC session signing
-   `CRON_SECRET` — Secret for `/api/unlock` endpoint
-   `NEXT_PUBLIC_SUPABASE_URL` — Supabase URL (public)
-   `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)
-   `SUPABASE_SERVICE_KEY` — Supabase service role key (server-only, Storage)

The app auto-creates a `questions` bucket on first upload.

## Setup

```bash
# 1) Install deps
npm install

# 2) Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# 3) Start dev server
npm run dev
```

Open `http://localhost:3000` and go to `Login`.

Default users (seeded on first render of `Login`):

-   Admin: `admin` / `admin123`
-   Student: `student` / `student123`

## Usage

Admin flow:

1. Login as Admin
2. Set `target` (locked after first upload)
3. Upload screenshots up to the target
4. Click `Start Day` (unlocks up to 3 immediately)
5. Click `Unlock Now (3)` for next batch
6. Click `End Day` to close the session (purges activity, deletes completed questions, marks session inactive)

Student flow:

1. Login as Student
2. See countdown and unlocked questions
3. Expand a question to view image
4. Mark Viewed / Completed

## Scheduled Unlocks (CRON)

-   Endpoint: `POST /api/unlock`
-   Header: `Authorization: Bearer <CRON_SECRET>`

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/unlock
```

Configure a platform cron (e.g., Vercel Cron) to call this periodically (e.g., every 30 minutes).

## Supabase Realtime

Ensure Realtime is enabled for the `public` schema or specifically the `Question` and `UserActivity` tables. The app listens for `postgres_changes` on:

-   `public.Question`
-   `public.UserActivity`

## Available Scripts

-   `npm run dev` — Start Next.js dev server
-   `npm run build` — Build production bundle
-   `npm start` — Start production server
-   `npm run prisma:generate` — Generate Prisma client
-   `npm run prisma:migrate` — Run Prisma migrate dev

## Security Notes

-   Sessions are HMAC-signed tokens in HTTP-only cookies; suitable for a demo but consider a hardened approach for production.
-   Keep `SUPABASE_SERVICE_KEY` and `CRON_SECRET` server-only.
-   Storage upload size limited to 10MB per file (see `lib/storage.ts`).

## Troubleshooting

-   Prisma errors: verify `DATABASE_URL`/`DIRECT_URL`, DB reachable.
-   Realtime not updating: check `NEXT_PUBLIC_SUPABASE_*` values and Realtime table settings.
-   Storage uploads failing: ensure `SUPABASE_SERVICE_KEY` and bucket `questions` exists (auto-created).
-   Can’t login: render `/login` once to seed default users or create users in DB.

## Deployment

-   Deploy to Vercel; use Supabase for DB/Storage/Realtime
-   Configure environment variables in your host
-   Use pooled `DATABASE_URL` for runtime and `DIRECT_URL` for migrations

## Contributing

1. Fork and create a feature branch
2. Make changes with clear commits
3. Ensure Prisma schema/migrations are up to date
4. Open a PR describing the change and any setup notes
