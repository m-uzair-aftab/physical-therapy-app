# Physical Therapy Tracker Architecture

This app is a small same-origin web app for tracking physical therapy workouts. It follows the product and engineering specs with a Node HTTP server, a static browser client, shared domain helpers, and a Neon PostgreSQL database for persistent account-backed data.

## Runtime Overview

```text
Browser
  |
  | Static files and same-origin JSON requests
  v
server.js
  |
  | Reads/writes app data through lib/persistence.js
  v
Neon PostgreSQL
  project: PT Tracker
  branches: production, preview, local-dev

Shared domain modules:
  lib/exercises.js
  lib/domain.js
```

The server serves both the frontend and API from the same origin, usually:

```text
http://127.0.0.1:5002
```

This avoids CORS and cross-site cookie issues during local development.

## Main Files

| File | Purpose |
| --- | --- |
| `README.md` | Public-facing project overview with production link, demo-flow note, design credit, and architecture/hosting summary. |
| `server.js` | Node HTTP server, API routes, auth/session handling, and static file serving. |
| `public/index.html` | Browser entry point. |
| `public/app.js` | Client-side router, screens, API calls, workout draft state, compact prototype-matched markup, chart rendering. |
| `public/styles.css` | Prototype-derived clinic visual system and responsive centered shell layout. |
| `public/favicon.svg` | Main website icon using the app's green ascending-pulse mark. |
| `design_style.md` | Canonical UI design guidance for future screens and visual changes. |
| `LOCAL_RUNNING.md` | Local development runbook for starting the combined frontend/backend server. |
| `lib/exercises.js` | Seeded exercise library, canonical categories, exercise lookup helpers. |
| `lib/domain.js` | Shared pure domain logic for formatting, validation helpers, last-used lookups, progress calculations. |
| `lib/persistence.js` | Persistence adapter that uses Neon PostgreSQL when `DATABASE_URL` exists, otherwise the legacy local JSON file fallback. |
| `lib/postgres-store.js` | PostgreSQL pool, read/write mapping, and transactional full-data writes for the current small app model. |
| `lib/env.js` | Minimal `.env` loader used by the server and database scripts. |
| `scripts/migrate.js` | Idempotent PostgreSQL schema migration and exercise seed script. |
| `scripts/import-local-data.js` | Imports existing `data/app-data.json` users/workouts into the configured database branch and skips old sessions. |
| `scripts/seed-demo.js` | Idempotently seeds only the committed fake `demo@example.com` account and demo workouts into the configured database branch. |
| `scripts/fixtures/demo-seed.json` | Committed fake demo account and workout fixture for production/preview demo login. |
| `scripts/db-counts.js` | Prints safe table counts for verification. |
| `test/domain.test.js` | Unit tests for seed data, soft-delete behavior, latest-entry selection, and progress metrics. |
| `vercel.json` | Vercel project config for the Node server deployment, free-tier single-region function placement, and test build command. |
| `.env.example` | Template for local database configuration. Real `.env` files are ignored by Git. |
| `data/app-data.json` | Legacy/import source and fallback data file. Ignored by Git. |

## Frontend Architecture

The frontend is a static single-page app in `public/app.js`. It does not use a framework build step.

### Visual System

The browser UI is styled to match the clinic theme from `specs/Rehab Log (standalone).html`. Future UI work should consult `design_style.md`; the live shared design tokens are implemented in `public/styles.css`:

- Hanken Grotesk as the primary UI font.
- `#F6F8F5` app background, white surfaces, `#F1F4EF` alternate surfaces.
- `#256D5A` primary green, `#D98F45` accent orange, `#1F2933` primary text, `#67737F` muted text, and `#E3E8DF` borders.
- A shared ascending-pulse brand mark on the auth card, desktop sidebar, and mobile header, with a wrapped Physical Therapy Tracker brand name where space is tight.
- Matching inline SVG icons for the mobile header, mobile bottom navigation, and Today workout-type cards, plus `public/favicon.svg` for the browser/site icon.
- The mobile app shell uses the dynamic viewport height (`100dvh`) when supported, with a `100vh` fallback, so the bottom navigation remains visible in iOS Safari and Chrome while browser controls are shown.
- Mobile text inputs, textareas, selects, and exercise note fields render at a minimum `16px` font size to avoid iOS Safari/WebView focus zoom when the keyboard opens.
- Workout exercise panels render prototype-matched inline SVG visual thumbnails: a 104px by 68px two-pose card beside each exercise name/cue, generated client-side from the exercise pose definitions embedded in `public/app.js` and kept aligned with the design exercise visual references.
- The Core / Hip library currently contains eight exercises; `Bent knee sit up` is a reps-based exercise with a 10-rep default and appears after `Sidelying hip abduction rainbows` and before `Single-leg glute bridge hold`.
- Workout numeric steppers use 42px minus/plus buttons and a bordered editable value input, with hover and focus states, so weight/reps/duration values are visibly clickable across all exercises.
- A centered 720px content column for normal screens and workout content, with the workout finish bar fixed to the viewport, sitting directly above the mobile bottom nav and aligning its normal desktop top divider with the sidebar account divider.
- User-triggered API actions show compact inline pending states with a spinner and disabled controls while waiting for the server, including workout finish/save, auth, demo login, delete workout, and sign out.

The app keeps the real client state and API-backed data, but screen markup in `public/app.js` is intentionally compact and close to the prototype: badge-style history rows, spark-style progress rows, compact workout panels, and a large current-metric progress detail header.

### Client State

The main state object tracks:

```js
{
  user,
  route,
  loading,
  error,
  data,
  draft,
  modal,
  pendingAction
}
```

`routeInfo()` converts the current path into a screen descriptor, for example:

- `/sign-in`
- `/register`
- `/today`
- `/workouts/new/functional`
- `/workouts/new/core_hip`
- `/workouts/:id/summary`
- `/history`
- `/history/:id`
- `/history/:id/edit`
- `/progress`
- `/progress/:exerciseId`
- `/settings`

`loadRoute()` is the main route loader. It redirects unauthenticated users to `/sign-in`, redirects signed-in users away from auth pages, and fetches screen data from the API.

`pendingAction` stores the currently running API-backed user action. Screens use it to render task-specific progress labels such as `Saving workout...`, prevent duplicate submissions, and temporarily disable related controls until the request resolves.

### Workout Draft Flow

Starting a workout calls:

```text
GET /api/workouts/start-data?type=functional
GET /api/workouts/start-data?type=core_hip
```

The response includes exercises plus the signed-in user's last saved entry for each exercise. The client initializes a local draft from last-used values when available, otherwise from exercise defaults.

The browser stores one active unsaved workout draft per signed-in user in `localStorage`, keyed by user id. Active drafts survive refreshes and normal in-app navigation on the same browser, but they are not account-wide or synced across devices. Completed entries are collected from draft state and posted to the server. Skipped exercises are not submitted.

When an active draft exists, the Today, History, Progress, and Settings screens show a compact resume card. Desktop sidebar and mobile header indicators also expose a direct Resume action while the user is outside the workout screen. Starting a workout from Today while a draft is active opens a choice dialog to resume the current workout or discard it and start the selected type. The active draft is cleared only after a successful finish/save or an explicit discard confirmation.

Workout control updates for numeric steppers, note disclosure, done toggles, and skip toggles mutate only the affected DOM nodes plus progress counters/fill. They do not re-render the full workout screen, so logging an exercise does not jump or visually refresh the page.

Each workout exercise panel keeps the existing `Last time` line and adds a `Prior values` link beside it. When exercise notes are expanded, a `Prior notes` link appears below the note box. These links reuse `GET /api/progress/exercises/:exerciseId`, sort entries latest-first in the browser, and mount/remove the history modal without re-rendering the workout page underneath.

Each workout panel includes a static visual card for the exercise. The live app maps the canonical exercise IDs from `lib/exercises.js` to the Functional/Core visual IDs from `specs/design/Exercise Library Visuals.dc.html`, builds the same two-pose SVG primitives used by `specs/design/PT Tracker.dc (1).html`, and displays them in the workout header next to the exercise text. These visuals are presentational only and do not affect workout draft data or API payloads.

Workout mode also keeps UI-only note disclosure state in each draft entry. Exercise notes are hidden behind a `+ Note` control by default, expand to a textarea when selected, and keep typed text in draft state even when collapsed. Existing saved exercise notes initialize expanded during workout editing.

Workout-level notes are no longer shown in the create/edit workout UI so the workout screen matches the standalone prototype. New workouts submit an empty workout-level notes string. Editing an existing workout keeps the saved workout-level notes in draft state and sends them back on save, so existing notes are preserved even though they are not editable in the workout screen.

### Progress Charts

Progress charts are rendered as inline SVG in `public/app.js`. The chart is backed by the table data from:

```text
GET /api/progress/exercises/:exerciseId
```

If there are fewer than two points, the UI shows an empty chart state and still renders the historical table when entries exist.

## Backend Architecture

`server.js` uses Node built-in modules plus `pg` for PostgreSQL:

- `http` for the server
- `fs/promises` for static files and the JSON fallback path
- `crypto` for password hashing, session tokens, and IDs
- `path` and `url` for filesystem and static serving
- `pg` through `lib/postgres-store.js` for Neon PostgreSQL

### Request Handling

Requests are split into two broad paths:

```text
/api/*       -> JSON API route handling
everything else -> static file or SPA fallback
```

Static routes serve files from `public/`. Unknown non-API paths fall back to `public/index.html`, which lets browser routes like `/history/:id` load directly.

### Authentication

The app uses email/password accounts.

Passwords are hashed with PBKDF2:

```text
pbkdf2_sha256$iterations$salt$hash
```

On successful register or login, the server creates a random session token, stores only its SHA-256 hash in the `sessions` table, and sends the raw token in an HTTP-only cookie:

```text
pt_session
```

Cookie settings:

- `HttpOnly`
- `SameSite=Lax`
- `Path=/`
- `Max-Age=30 days`
- `Secure` only when `NODE_ENV=production`

Authenticated API routes call `requireUser()` and scope all user data to the current session user.

### CSRF Protection

Because auth uses cookies, mutating API routes run a same-origin check through `assertSameOrigin()`. Same-origin local requests are allowed; cross-origin writes are rejected.

## Data Storage

Runtime app data is stored in Neon PostgreSQL when `DATABASE_URL` is configured. The Neon setup is:

```text
Project: PT Tracker
Region: AWS US West 2 (Oregon)
Branch: production  -> production deployment data
Branch: preview     -> Vercel preview deployment data with fake demo seed data only
Branch: local-dev   -> local testing branch with imported JSON data
```

The PostgreSQL schema is managed by `npm run db:migrate`:

```text
users
sessions
exercises
workouts
workout_entries
```

`scripts/migrate.js` creates the tables and indexes idempotently, then upserts the seeded exercises from `lib/exercises.js`. The app still treats exercises as code-owned canonical data for labels, validation, and UI behavior; the database copy supports foreign keys and operational inspection.

`scripts/import-local-data.js` imports existing `data/app-data.json` users, password hashes, workouts, and workout entries into the currently configured database branch. It intentionally skips old sessions, so users sign in again after import.

`scripts/seed-demo.js` reads `scripts/fixtures/demo-seed.json` and upserts only `demo@example.com` plus committed fake workouts into the currently configured database branch. It clears that demo user's old sessions and replaces only that demo user's workouts, leaving other users untouched. Use this for production and preview demo-login support instead of importing `data/app-data.json`.

If `DATABASE_URL` is absent, `lib/persistence.js` falls back to the legacy JSON store at `data/app-data.json`. This fallback keeps the app runnable without Neon, but normal local development now uses the `local-dev` Neon branch.

When PostgreSQL persistence is active, `lib/postgres-store.js` syncs the seeded exercise catalog from `lib/exercises.js` before reading or writing app data. This keeps the database `exercises` foreign-key table aligned with code-defined exercises such as newly added Core / Hip movements before workout entries are saved.

## Domain Model

### Categories

Canonical workout categories live in `lib/exercises.js`:

```js
functional
core_hip
```

The UI label for `core_hip` is `Core / Hip`. The prototype's `core` shorthand is not used in persisted data or API routes.

### Exercises

Exercises are seeded in code through `EXERCISES`. Each exercise has:

- `id`
- `name`
- `category`
- `description`
- default values
- `measurementTypes`
- `primaryMetric`
- `sideMode`
- `sortOrder`

Version 1 uses one shared field for `each_side` exercises. Separate left/right fields exist in API payloads and stored entries for future compatibility, but the UI does not require separate side entry.

The Core / Hip lateral band walks / monster walks exercise is tracked as a weight-based exercise and starts at a 10 lb default when no saved last-used value exists.

Progress list spark markers are category-colored: Functional uses the primary green token and Core / Hip uses the accent orange token, matching the Today cards and History badges.

### Workouts

A saved workout contains:

- `id`
- `userId`
- `type`
- `performedAt`
- `notes`
- `entries`
- `deletedAt`
- timestamps

Deleted workouts are soft-deleted by setting `deletedAt`. Normal history, last-used, and progress queries exclude soft-deleted workouts.

### Workout Entries

Each workout entry represents a completed exercise. There is no persisted `completed` flag because an entry exists only when the exercise was completed.

Entries can store:

- `weight`
- `reps`
- `durationSeconds`
- left/right future fields
- `notes`

## API Surface

### Auth

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account and sign in. |
| `POST` | `/api/auth/login` | Sign in. |
| `POST` | `/api/auth/demo` | Sign in as the seeded demo user without exposing demo credentials to the browser. |
| `POST` | `/api/auth/logout` | Sign out and clear session. |
| `GET` | `/api/auth/me` | Return current authenticated user. |

### Exercises

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/exercises` | Return all seeded exercises. |
| `GET` | `/api/exercises?category=core_hip` | Return exercises for one category. |

### Workouts

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/workouts/start-data?type=:type` | Return exercise library plus last-used values. |
| `POST` | `/api/workouts` | Save a new workout with completed entries. |
| `GET` | `/api/workouts` | Return signed-in user's non-deleted workout history. |
| `GET` | `/api/workouts/:id` | Return workout detail. |
| `PUT` | `/api/workouts/:id` | Replace workout metadata and entries. |
| `DELETE` | `/api/workouts/:id` | Soft-delete workout. |

### Progress

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/progress/exercises` | Return all exercises with most recent values. |
| `GET` | `/api/progress/exercises/:exerciseId` | Return summary, chart points, and table rows for one exercise. |

## Important Flows

### Register or Login

```text
User submits credentials
  -> server validates input
  -> password is hashed or verified
  -> session token is created
  -> token hash is stored in PostgreSQL
  -> HTTP-only cookie is set
  -> browser routes to /today
```

### Demo Login

```text
User selects Try the demo experience on /sign-in
  -> client posts to /api/auth/demo
  -> server finds demo@example.com in the configured persistence store
  -> session token is created for that account
  -> browser routes to /today with the demo user's exercises, history, and progress
```

### Start Workout

```text
User opens /workouts/new/:type
  -> client calls start-data API
  -> server loads category exercises
  -> server finds latest non-deleted entry per exercise for that user
  -> client builds local draft
  -> user edits values, marks done, skips exercises
```

### Finish Workout

```text
User taps Finish Workout
  -> client collects entries where done=true and skipped=false
  -> if none, show discard-only modal
  -> POST /api/workouts
  -> server validates category, exercise ownership by type, numbers, and notes
  -> server saves workout and entries through the configured persistence adapter
  -> client routes to summary
```

### Progress Detail

```text
User opens /progress/:exerciseId
  -> server gathers all matching entries for current user
  -> soft-deleted workouts are excluded
  -> points use exercise.primaryMetric
  -> client renders SVG chart and table
```

## Local Testing

Install dependencies:

```sh
npm install
```

Create `.env` from `.env.example` and set `DATABASE_URL` to the Neon `local-dev` branch. Then apply migrations and, when needed, import the legacy JSON data:

```sh
npm run db:migrate
npm run db:import-local
npm run db:counts
```

Start the app:

```sh
npm run dev
```

Run unit tests:

```sh
npm test
```

The app runs at:

```text
http://127.0.0.1:5002
```

Current seeded demo account, if present in `data/app-data.json`:

```text
Email: demo@example.com
Password: password123
```

Because `data/app-data.json` is ignored by Git, local demo data is not part of the committed source.
The sign-in page also exposes a demo-login action that creates a session for `demo@example.com` without sending the password from the browser. The configured database or JSON fallback must include that demo user plus representative workout history for the feature to work.

## Production Deployment

The production target is Vercel on the Hobby/free plan, connected to the GitHub repository `m-uzair-aftab/physical-therapy-app`. Vercel should use the repo root, `main` as the production branch, and automatic Git deployments so pushes to `main` create production deployments and other branches create preview deployments.

Vercel runs the root `server.js` Node HTTP server as a same-origin app/API deployment. Static assets stay in `public/`, and API routes remain under `/api/*`; no CORS layer is needed.

`vercel.json` keeps the deployment free-tier friendly:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["pdx1"],
  "buildCommand": "npm test"
}
```

The single `pdx1` function region keeps the Hobby deployment within the one-region limit and close to Neon US West/Oregon. The app should not enable paid Vercel add-ons such as Web Analytics, Speed Insights, Observability Plus, Edge Config, Workflows, Secure Compute, Static IPs, or image transformation features.

Production Vercel environment variables:

```text
DATABASE_URL=<Neon production branch pooled connection string with SSL>
DB_POOL_MAX=1
NODE_ENV=production
```

Preview Vercel environment variables:

```text
DATABASE_URL=<Neon preview branch pooled connection string with SSL>
DB_POOL_MAX=1
NODE_ENV=production
```

`NODE_ENV=production` is required so session cookies include `Secure` on Vercel HTTPS deployments. `DB_POOL_MAX=1` keeps serverless database connection usage conservative.

Initial production or preview database setup:

```sh
npm run db:migrate
npm run db:seed-demo
npm run db:counts
```

## Production Considerations

The app now has a real Neon PostgreSQL project with separate `production`, `preview`, and `local-dev` branches. Production and preview should use committed fake demo data only unless real user data is intentionally created through the deployed app.

Before storing real production data:

- Add rate limiting to auth endpoints.
- Add stronger operational logging without logging private notes or passwords.
- Seed `demo@example.com` with `npm run db:seed-demo` if the public demo-login link should remain available after deployment.
- Confirm backup and restore policy beyond the Free plan's limited history window.
- Keep production, preview, and local development on separate Neon branches or databases.
- Consider replacing the current whole-data persistence adapter with route-level repository methods if the app grows beyond a small personal workload.
- Keep same-origin deployment to preserve simple cookie auth.
