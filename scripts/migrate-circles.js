import { loadEnv } from "../lib/env.js";
import { closePool, withClient } from "../lib/postgres-store.js";

loadEnv();

try {
  await withClient((client) => client.query(
    "alter table workout_entries add column if not exists circles integer check (circles >= 0)",
  ));
  console.log("Circles migration complete.");
} finally {
  await closePool();
}
