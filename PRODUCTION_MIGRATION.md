# Running Production Database Migrations

Use this when you need to apply the app schema and seeded exercise catalog to the production Neon database from Mac Terminal.

## What This Does

`npm run db:migrate` runs `scripts/migrate.js`.

It safely:

- Creates missing tables/indexes if needed.
- Upserts exercises from `lib/exercises.js`, including new exercises such as `bent_knee_sit_up`.
- Leaves existing users, workouts, and workout entries in place.

## Before You Run It

1. Confirm you are using the production Neon connection string, not the local-dev branch.
2. Avoid saving the production connection string in committed files.
3. Close any Terminal window after running if you do not want the command in scrollback.

## Steps In Mac Terminal

Open Terminal and go to the project folder:

```bash
cd "/Users/uzairaftab/Library/CloudStorage/OneDrive-Personal/Documents/Coding/Physical Therapy App v2"
```

Make sure dependencies are installed:

```bash
npm install
```

Set the production database URL only for this Terminal session:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/neondb?sslmode=require&channel_binding=require'
```

Replace the placeholder value with the production Neon connection string from Neon or Vercel.

Run the migration:

```bash
npm run db:migrate
```

You should see output like:

```text
Migration complete: {"exercises":16,"users":...,"workouts":...,"entries":...}
```

Optionally check counts:

```bash
npm run db:counts
```

Remove the production URL from the current Terminal session:

```bash
unset DATABASE_URL
```

## One-Line Alternative

This avoids exporting `DATABASE_URL` into the whole Terminal session:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@HOST/neondb?sslmode=require&channel_binding=require' npm run db:migrate
```

## Afterward

Deploy the latest app code too. The production server now syncs seeded exercises before PostgreSQL reads/writes, but running this migration corrects the production database immediately.
