import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getExercise, isValidCategory } from "../lib/exercises.js";
import { loadEnv } from "../lib/env.js";
import { readData, writeData } from "../lib/persistence.js";
import { closePool } from "../lib/postgres-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, "fixtures", "demo-seed.json");

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Set it to the target Neon branch before seeding demo data.");
  process.exit(1);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex"), iterations = 210000) {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function normalizeEntry(entry, now) {
  const exerciseId = requiredString(entry.exerciseId, "entry.exerciseId");
  if (!getExercise(exerciseId)) throw new Error(`Unknown demo exercise: ${exerciseId}`);

  return {
    id: requiredString(entry.id, "entry.id"),
    exerciseId,
    weight: entry.weight ?? null,
    reps: entry.reps ?? null,
    durationSeconds: entry.durationSeconds ?? null,
    leftReps: entry.leftReps ?? null,
    rightReps: entry.rightReps ?? null,
    leftDurationSeconds: entry.leftDurationSeconds ?? null,
    rightDurationSeconds: entry.rightDurationSeconds ?? null,
    notes: entry.notes || "",
    createdAt: entry.createdAt || now,
    updatedAt: now,
  };
}

function normalizeWorkout(workout, userId, now) {
  const type = requiredString(workout.type, "workout.type");
  if (!isValidCategory(type)) throw new Error(`Invalid demo workout type: ${type}`);
  if (!Array.isArray(workout.entries) || workout.entries.length === 0) {
    throw new Error(`Demo workout ${workout.id || "(missing id)"} needs entries.`);
  }

  return {
    id: requiredString(workout.id, "workout.id"),
    userId,
    type,
    performedAt: requiredString(workout.performedAt, "workout.performedAt"),
    notes: workout.notes || "",
    entries: workout.entries.map((entry) => normalizeEntry(entry, now)),
    deletedAt: null,
    createdAt: workout.createdAt || workout.performedAt,
    updatedAt: now,
  };
}

const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
const email = requiredString(fixture.user?.email, "user.email").toLowerCase();
const name = requiredString(fixture.user?.name, "user.name");
const password = requiredString(fixture.user?.password, "user.password");
const now = new Date().toISOString();

const data = await readData();
let demoUser = data.users.find((user) => user.email === email);

if (!demoUser) {
  demoUser = {
    id: crypto.randomUUID(),
    email,
    name,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  data.users.push(demoUser);
} else {
  demoUser.name = name;
  demoUser.passwordHash = hashPassword(password);
  demoUser.updatedAt = now;
}

data.sessions = data.sessions.filter((session) => session.userId !== demoUser.id);
data.workouts = data.workouts.filter((workout) => workout.userId !== demoUser.id);
const demoWorkouts = fixture.workouts.map((workout) => normalizeWorkout(workout, demoUser.id, now));
data.workouts.push(...demoWorkouts);

await writeData(data);

const entryCount = demoWorkouts.reduce((total, workout) => total + workout.entries.length, 0);
console.log(
  `Demo seed complete: ${JSON.stringify({
    email,
    workouts: demoWorkouts.length,
    entries: entryCount,
    sessionsCleared: true,
  })}`,
);

await closePool();
