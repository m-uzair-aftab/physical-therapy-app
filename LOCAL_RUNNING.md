# Running Locally

Run the app from the project folder:

```bash
cd "/Users/uzairaftab/Library/CloudStorage/OneDrive-Personal/Documents/Coding/Physical Therapy App v2"
npm run dev
```

Then open:

```text
http://127.0.0.1:5002
```

The frontend and backend run together in this app:

- Frontend: static files in `public/`, served by `server.js`
- Backend: JSON API routes under `/api/*`, also handled by `server.js`
- Local database: Neon Postgres via `DATABASE_URL` in `.env`
- Fallback local data: `data/app-data.json`, used only when `DATABASE_URL` is not set

To run on a different port:

```bash
PORT=5010 npm run dev
```

## Database

This project uses a Neon project named `PT Tracker`.

- `production`: clean schema-only branch for future deployment
- `local-dev`: local testing branch with imported data from `data/app-data.json`

The real connection string belongs in `.env`, which is ignored by Git:

```bash
cp .env.example .env
```

Run migrations:

```bash
npm run db:migrate
```

Import the existing JSON data into the currently configured database branch:

```bash
npm run db:import-local
```

Check row counts:

```bash
npm run db:counts
```

Requirements:

- Node.js `>=20`
- Run `npm install` before starting the app so the PostgreSQL driver is available.
