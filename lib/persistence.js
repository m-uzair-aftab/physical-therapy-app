import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPostgresData, usingPostgres, writePostgresData } from "./postgres-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");

export function emptyData() {
  return {
    users: [],
    sessions: [],
    workouts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function readFileData() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return emptyData();
  }
}

async function writeFileData(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  data.updatedAt = new Date().toISOString();
  const tmp = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, DATA_FILE);
}

export async function readData() {
  return usingPostgres() ? readPostgresData() : readFileData();
}

export async function writeData(data) {
  data.updatedAt = new Date().toISOString();
  if (usingPostgres()) return writePostgresData(data);
  return writeFileData(data);
}

export { usingPostgres };
