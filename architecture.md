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
  branches: production, local-dev

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
| `scripts/db-counts.js` | Prints safe table counts for verification. |
| `test/domain.test.js` | Unit tests for seed data, soft-delete behavior, latest-entry selection, and progress metrics. |
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
- Workout exercise panels render prototype-matched inline SVG visual thumbnails: a 104px by 68px two-pose card beside each exercise name/cue, generated client-side from the exercise pose definitions embedded in `public/app.js`.
- Workout numeric steppers use 42px minus/plus buttons and a bordered editable value input, with hover and focus states, so weight/reps/duration values are visibly clickable across all exercises.
- A centered 720px content column for normal screens and workout content, with the workout finish bar spanning the scroll area, centering its controls to the same 720px measure, and aligning its normal desktop top divider with the sidebar account divider.

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
  modal
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

### Workout Draft Flow

Starting a workout calls:

```text
GET /api/workouts/start-data?type=functional
GET /api/workouts/start-data?type=core_hip
```

The response includes exercises plus the signed-in user's last saved entry for each exercise. The client initializes a local draft from last-used values when available, otherwise from exercise defaults.

The browser stores unsaved workout edits only in memory until the user finishes or saves. Completed entries are collected from draft state and posted to the server. Skipped exercises are not submitted.

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
Branch: production  -> clean schema-only branch for future deployment
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

If `DATABASE_URL` is absent, `lib/persistence.js` falls back to the legacy JSON store at `data/app-data.json`. This fallback keeps the app runnable without Neon, but normal local development now uses the `local-dev` Neon branch.

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

## Production Considerations

The app now has a real Neon PostgreSQL project and a clean `production` branch. Production currently contains schema plus seeded exercises only; imported user/workout data lives on `local-dev`.

Before storing real production data:

- Add rate limiting to auth endpoints.
- Add stronger operational logging without logging private notes or passwords.
- Seed `demo@example.com` and its representative workout/history data in the production database if the public demo-login link should remain available after deployment.
- Confirm backup and restore policy beyond the Free plan's limited history window.
- Keep production and local development on separate Neon branches or databases.
- Consider replacing the current whole-data persistence adapter with route-level repository methods if the app grows beyond a small personal workload.
- Keep same-origin deployment to preserve simple cookie auth.
