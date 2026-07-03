import pg from "pg";
import { loadEnv } from "./env.js";

const { Pool } = pg;

let pool;

function maybeNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function maybeDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowTimestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function getPool() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  }

  if (!pool) {
    const databaseUrl = new URL(process.env.DATABASE_URL);
    if (databaseUrl.searchParams.get("sslmode") === "require") {
      databaseUrl.searchParams.set("sslmode", "verify-full");
    }

    pool = new Pool({
      connectionString: databaseUrl.toString(),
      max: Number(process.env.DB_POOL_MAX || 5),
    });
  }

  return pool;
}

export function usingPostgres() {
  loadEnv();
  return Boolean(process.env.DATABASE_URL);
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export async function withClient(callback) {
  const client = await getPool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function readPostgresData() {
  return withClient(async (client) => {
    const usersResult = await client.query(
      `select id, email, name, password_hash, created_at, updated_at
       from users
       order by created_at asc`,
    );
    const sessionsResult = await client.query(
      `select id, token_hash, user_id, expires_at, created_at
       from sessions
       order by created_at asc`,
    );
    const workoutsResult = await client.query(
      `select id, user_id, type, performed_at, notes, deleted_at, created_at, updated_at
       from workouts
       order by performed_at asc, created_at asc`,
    );
    const entriesResult = await client.query(
      `select id, workout_id, exercise_id, weight, reps, duration_seconds,
              left_reps, right_reps, left_duration_seconds, right_duration_seconds,
              notes, created_at, updated_at
       from workout_entries
       order by created_at asc`,
    );

    const entriesByWorkout = new Map();
    for (const row of entriesResult.rows) {
      const entry = {
        id: row.id,
        exerciseId: row.exercise_id,
        weight: maybeNumber(row.weight),
        reps: row.reps,
        durationSeconds: row.duration_seconds,
        leftReps: row.left_reps,
        rightReps: row.right_reps,
        leftDurationSeconds: row.left_duration_seconds,
        rightDurationSeconds: row.right_duration_seconds,
        notes: row.notes || "",
        createdAt: rowTimestamp(row.created_at),
        updatedAt: rowTimestamp(row.updated_at),
      };

      if (!entriesByWorkout.has(row.workout_id)) entriesByWorkout.set(row.workout_id, []);
      entriesByWorkout.get(row.workout_id).push(entry);
    }

    const users = usersResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name || "",
      passwordHash: row.password_hash,
      createdAt: rowTimestamp(row.created_at),
      updatedAt: rowTimestamp(row.updated_at),
    }));

    const sessions = sessionsResult.rows.map((row) => ({
      id: row.id,
      tokenHash: row.token_hash,
      userId: row.user_id,
      expiresAt: rowTimestamp(row.expires_at),
      createdAt: rowTimestamp(row.created_at),
    }));

    const workouts = workoutsResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      performedAt: rowTimestamp(row.performed_at),
      notes: row.notes || "",
      entries: entriesByWorkout.get(row.id) || [],
      deletedAt: rowTimestamp(row.deleted_at),
      createdAt: rowTimestamp(row.created_at),
      updatedAt: rowTimestamp(row.updated_at),
    }));

    return {
      users,
      sessions,
      workouts,
      createdAt: users[0]?.createdAt || workouts[0]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function writePostgresData(data) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query("delete from workout_entries");
      await client.query("delete from workouts");
      await client.query("delete from sessions");
      await client.query("delete from users");

      for (const user of data.users || []) {
        await client.query(
          `insert into users (id, email, name, password_hash, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            user.id,
            user.email,
            user.name || "",
            user.passwordHash,
            maybeDate(user.createdAt) || new Date().toISOString(),
            maybeDate(user.updatedAt) || new Date().toISOString(),
          ],
        );
      }

      for (const session of data.sessions || []) {
        await client.query(
          `insert into sessions (id, token_hash, user_id, expires_at, created_at)
           values ($1, $2, $3, $4, $5)`,
          [
            session.id,
            session.tokenHash,
            session.userId,
            maybeDate(session.expiresAt),
            maybeDate(session.createdAt) || new Date().toISOString(),
          ],
        );
      }

      for (const workout of data.workouts || []) {
        await client.query(
          `insert into workouts (id, user_id, type, performed_at, notes, deleted_at, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            workout.id,
            workout.userId,
            workout.type,
            maybeDate(workout.performedAt),
            workout.notes || "",
            maybeDate(workout.deletedAt),
            maybeDate(workout.createdAt) || new Date().toISOString(),
            maybeDate(workout.updatedAt) || new Date().toISOString(),
          ],
        );

        for (const entry of workout.entries || []) {
          await client.query(
            `insert into workout_entries (
              id, workout_id, exercise_id, weight, reps, duration_seconds,
              left_reps, right_reps, left_duration_seconds, right_duration_seconds,
              notes, created_at, updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              entry.id,
              workout.id,
              entry.exerciseId,
              entry.weight ?? null,
              entry.reps ?? null,
              entry.durationSeconds ?? null,
              entry.leftReps ?? null,
              entry.rightReps ?? null,
              entry.leftDurationSeconds ?? null,
              entry.rightDurationSeconds ?? null,
              entry.notes || "",
              maybeDate(entry.createdAt) || new Date().toISOString(),
              maybeDate(entry.updatedAt) || new Date().toISOString(),
            ],
          );
        }
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}
