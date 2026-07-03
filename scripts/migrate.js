import { EXERCISES } from "../lib/exercises.js";
import { loadEnv } from "../lib/env.js";
import { closePool, withClient } from "../lib/postgres-store.js";

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add it to .env or export it before running migrations.");
  process.exit(1);
}

const schemaSql = `
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key,
  token_hash text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists exercises (
  id text primary key,
  name text not null,
  category text not null check (category in ('functional', 'core_hip')),
  description text not null,
  default_weight numeric(8, 2),
  default_reps integer,
  default_duration_seconds integer,
  measurement_types jsonb not null default '[]'::jsonb,
  primary_metric text not null check (primary_metric in ('weight', 'reps', 'duration')),
  side_mode text not null check (side_mode in ('none', 'each_side', 'left_right')),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercises_category_sort_order_idx on exercises (category, sort_order);

create table if not exists workouts (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('functional', 'core_hip')),
  performed_at timestamptz not null,
  notes text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workouts_user_performed_active_idx
  on workouts (user_id, performed_at desc)
  where deleted_at is null;

create index if not exists workouts_user_type_performed_active_idx
  on workouts (user_id, type, performed_at desc)
  where deleted_at is null;

create table if not exists workout_entries (
  id uuid primary key,
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id text not null references exercises(id),
  weight numeric(8, 2),
  reps integer,
  duration_seconds integer,
  left_reps integer,
  right_reps integer,
  left_duration_seconds integer,
  right_duration_seconds integer,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_entries_workout_id_idx on workout_entries (workout_id);
create index if not exists workout_entries_exercise_id_idx on workout_entries (exercise_id);
create index if not exists workout_entries_exercise_workout_idx on workout_entries (exercise_id, workout_id);
`;

await withClient(async (client) => {
  await client.query("begin");
  try {
    await client.query(schemaSql);

    for (const exercise of EXERCISES) {
      await client.query(
        `insert into exercises (
          id, name, category, description, default_weight, default_reps,
          default_duration_seconds, measurement_types, primary_metric,
          side_mode, sort_order, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, now())
        on conflict (id) do update set
          name = excluded.name,
          category = excluded.category,
          description = excluded.description,
          default_weight = excluded.default_weight,
          default_reps = excluded.default_reps,
          default_duration_seconds = excluded.default_duration_seconds,
          measurement_types = excluded.measurement_types,
          primary_metric = excluded.primary_metric,
          side_mode = excluded.side_mode,
          sort_order = excluded.sort_order,
          updated_at = now()`,
        [
          exercise.id,
          exercise.name,
          exercise.category,
          exercise.description,
          exercise.defaultWeight,
          exercise.defaultReps,
          exercise.defaultDurationSeconds,
          JSON.stringify(exercise.measurementTypes),
          exercise.primaryMetric,
          exercise.sideMode,
          exercise.sortOrder,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const counts = await client.query(`
    select
      (select count(*)::int from exercises) as exercises,
      (select count(*)::int from users) as users,
      (select count(*)::int from workouts) as workouts,
      (select count(*)::int from workout_entries) as entries
  `);
  console.log(`Migration complete: ${JSON.stringify(counts.rows[0])}`);
});

await closePool();
