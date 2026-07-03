import { loadEnv } from "../lib/env.js";
import { closePool, withClient } from "../lib/postgres-store.js";

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

await withClient(async (client) => {
  const result = await client.query(`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from sessions) as sessions,
      (select count(*)::int from exercises) as exercises,
      (select count(*)::int from workouts) as workouts,
      (select count(*)::int from workout_entries) as entries
  `);
  console.log(JSON.stringify(result.rows[0]));
});

await closePool();
