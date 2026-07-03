import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../lib/env.js";
import { closePool } from "../lib/postgres-store.js";
import { writeData } from "../lib/persistence.js";

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add the local-dev Neon URL to .env before importing.");
  process.exit(1);
}

const sourcePath = process.argv[2] || path.join(process.cwd(), "data", "app-data.json");
const raw = await fs.readFile(sourcePath, "utf8");
const parsed = JSON.parse(raw);

const data = {
  users: Array.isArray(parsed.users) ? parsed.users : [],
  sessions: [],
  workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
  createdAt: parsed.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

await writeData(data);

const entryCount = data.workouts.reduce(
  (total, workout) => total + (Array.isArray(workout.entries) ? workout.entries.length : 0),
  0,
);

console.log(
  `Import complete: ${JSON.stringify({
    users: data.users.length,
    sessions: 0,
    workouts: data.workouts.length,
    entries: entryCount,
  })}`,
);

await closePool();
