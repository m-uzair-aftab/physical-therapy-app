import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXERCISES,
  categoryLabel,
  exercisesForCategory,
  getExercise,
  isValidCategory,
} from "./lib/exercises.js";
import {
  clampNumber,
  exerciseProgressList,
  formatEntryValues,
  formatMetricValue,
  latestEntryForExercise,
  normalizeEmail,
  progressForExercise,
  publicUser,
  trimNote,
  workoutsForUser,
} from "./lib/domain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 5002);
const COOKIE_NAME = "pt_session";
const SESSION_DAYS = 30;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function emptyData() {
  return {
    users: [],
    sessions: [],
    workouts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function readData() {
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

async function writeData(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  data.updatedAt = new Date().toISOString();
  const tmp = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, DATA_FILE);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex"), iterations = 210000) {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, iterationsRaw, salt, expected] = String(stored || "").split("$");
  if (scheme !== "pbkdf2_sha256" || !iterationsRaw || !salt || !expected) return false;
  const iterations = Number(iterationsRaw);
  const actual = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rawValue.join("="));
  }
  return out;
}

function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  res.end(payload === undefined ? "" : JSON.stringify(payload));
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

function assertSameOrigin(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  const expected = `http://${req.headers.host}`;
  const expectedSecure = `https://${req.headers.host}`;
  return origin === expected || origin === expectedSecure;
}

async function getContext(req) {
  const data = await readData();
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return { data, user: null, session: null };

  const tokenHash = hashToken(token);
  const now = Date.now();
  data.sessions = data.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
  const session = data.sessions.find((item) => item.tokenHash === tokenHash) || null;
  const user = session ? data.users.find((item) => item.id === session.userId) || null : null;
  return { data, user, session };
}

function requireUser(res, context) {
  if (!context.user) {
    sendError(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    return null;
  }
  return context.user;
}

function createSession(data, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  data.sessions.push({
    id: crypto.randomUUID(),
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: now.toISOString(),
  });
  return token;
}

function validateEntryPayload(rawEntry, category) {
  const exercise = getExercise(rawEntry.exerciseId);
  if (!exercise || exercise.category !== category) {
    return { error: "Each exercise must exist and belong to the selected workout type." };
  }

  const weight = clampNumber(rawEntry.weight, false);
  const reps = clampNumber(rawEntry.reps, true);
  const durationSeconds = clampNumber(rawEntry.durationSeconds, true);
  const leftReps = clampNumber(rawEntry.leftReps, true);
  const rightReps = clampNumber(rawEntry.rightReps, true);
  const leftDurationSeconds = clampNumber(rawEntry.leftDurationSeconds, true);
  const rightDurationSeconds = clampNumber(rawEntry.rightDurationSeconds, true);
  const notes = trimNote(rawEntry.notes);

  if ([weight, reps, durationSeconds, leftReps, rightReps, leftDurationSeconds, rightDurationSeconds].includes(undefined)) {
    return { error: "Numeric values must be non-negative numbers." };
  }

  const hasValue = [weight, reps, durationSeconds, leftReps, rightReps, leftDurationSeconds, rightDurationSeconds].some(
    (value) => value !== null,
  );
  if (!hasValue && !notes) {
    return { error: "A completed exercise needs at least one value or note." };
  }

  return {
    entry: {
      id: rawEntry.id || crypto.randomUUID(),
      exerciseId: exercise.id,
      weight,
      reps,
      durationSeconds,
      leftReps,
      rightReps,
      leftDurationSeconds,
      rightDurationSeconds,
      notes,
      createdAt: rawEntry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function validateWorkoutPayload(payload) {
  const type = payload.type;
  if (!isValidCategory(type)) return { error: "Workout type is required." };
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    return { error: "Entries must contain at least one completed exercise." };
  }

  const entries = [];
  for (const rawEntry of payload.entries) {
    const result = validateEntryPayload(rawEntry, type);
    if (result.error) return result;
    entries.push(result.entry);
  }

  const performedAt = payload.performedAt ? new Date(payload.performedAt) : new Date();
  if (Number.isNaN(performedAt.getTime())) return { error: "Performed date must be valid." };

  return {
    workout: {
      type,
      performedAt: performedAt.toISOString(),
      notes: trimNote(payload.notes),
      entries,
    },
  };
}

function workoutSummary(workout) {
  return {
    id: workout.id,
    type: workout.type,
    typeLabel: categoryLabel(workout.type),
    performedAt: workout.performedAt,
    completedExerciseCount: workout.entries.length,
  };
}

function workoutDetail(workout) {
  return {
    id: workout.id,
    type: workout.type,
    typeLabel: categoryLabel(workout.type),
    performedAt: workout.performedAt,
    notes: workout.notes || "",
    entries: workout.entries.map((entry) => {
      const exercise = getExercise(entry.exerciseId);
      return {
        id: entry.id,
        exerciseId: entry.exerciseId,
        exerciseName: exercise?.name || entry.exerciseId,
        exerciseDescription: exercise?.description || "",
        weight: entry.weight ?? null,
        reps: entry.reps ?? null,
        durationSeconds: entry.durationSeconds ?? null,
        leftReps: entry.leftReps ?? null,
        rightReps: entry.rightReps ?? null,
        leftDurationSeconds: entry.leftDurationSeconds ?? null,
        rightDurationSeconds: entry.rightDurationSeconds ?? null,
        notes: entry.notes || "",
        valueLabel: formatEntryValues(entry, exercise),
      };
    }),
  };
}

async function handleAuth(req, res, pathname) {
  const context = await getContext(req);

  if (req.method === "POST" && pathname === "/api/auth/register") {
    const payload = await readJson(req);
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const name = trimNote(payload.name, 120);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 400, "VALIDATION_ERROR", "A valid email is required.");
    }
    if (password.length < 8) {
      return sendError(res, 400, "VALIDATION_ERROR", "Password must be at least 8 characters.");
    }
    if (context.data.users.some((user) => user.email === email)) {
      return sendError(res, 409, "CONFLICT", "An account with this email already exists.");
    }

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };
    context.data.users.push(user);
    const token = createSession(context.data, user.id);
    await writeData(context.data);
    return sendJson(res, 201, { user: publicUser(user) }, { "set-cookie": sessionCookie(token) });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const payload = await readJson(req);
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const user = context.data.users.find((item) => item.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendError(res, 401, "UNAUTHENTICATED", "Invalid email or password.");
    }
    const token = createSession(context.data, user.id);
    await writeData(context.data);
    return sendJson(res, 200, { user: publicUser(user) }, { "set-cookie": sessionCookie(token) });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const token = parseCookies(req)[COOKIE_NAME];
    if (token) {
      const tokenHash = hashToken(token);
      context.data.sessions = context.data.sessions.filter((session) => session.tokenHash !== tokenHash);
      await writeData(context.data);
    }
    res.writeHead(204, { "set-cookie": clearSessionCookie() });
    return res.end();
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const user = requireUser(res, context);
    if (!user) return;
    return sendJson(res, 200, { user: publicUser(user) });
  }

  return false;
}

async function handleApi(req, res, url) {
  if (!assertSameOrigin(req)) {
    return sendError(res, 403, "FORBIDDEN", "Cross-origin writes are not allowed.");
  }

  const authHandled = await handleAuth(req, res, url.pathname);
  if (authHandled !== false) return;

  const context = await getContext(req);

  if (req.method === "GET" && url.pathname === "/api/exercises") {
    const category = url.searchParams.get("category");
    if (category && !isValidCategory(category)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid category.");
    }
    const exercises = category ? exercisesForCategory(category) : EXERCISES;
    return sendJson(res, 200, { exercises });
  }

  if (req.method === "GET" && url.pathname === "/api/workouts/start-data") {
    const user = requireUser(res, context);
    if (!user) return;
    const type = url.searchParams.get("type");
    if (!isValidCategory(type)) return sendError(res, 400, "VALIDATION_ERROR", "Invalid workout type.");

    const exercises = exercisesForCategory(type).map((exercise) => {
      const latest = latestEntryForExercise(context.data, user.id, exercise.id);
      return {
        exercise,
        lastEntry: latest
          ? {
              performedAt: latest.workout.performedAt,
              weight: latest.entry.weight ?? null,
              reps: latest.entry.reps ?? null,
              durationSeconds: latest.entry.durationSeconds ?? null,
              notes: latest.entry.notes || "",
            }
          : null,
      };
    });
    return sendJson(res, 200, { type, typeLabel: categoryLabel(type), exercises });
  }

  if (req.method === "POST" && url.pathname === "/api/workouts") {
    const user = requireUser(res, context);
    if (!user) return;
    const payload = await readJson(req);
    const result = validateWorkoutPayload(payload);
    if (result.error) return sendError(res, 400, "VALIDATION_ERROR", result.error);

    const now = new Date().toISOString();
    const workout = {
      id: crypto.randomUUID(),
      userId: user.id,
      ...result.workout,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    context.data.workouts.push(workout);
    await writeData(context.data);
    return sendJson(res, 201, { workout: workoutSummary(workout) });
  }

  if (req.method === "GET" && url.pathname === "/api/workouts") {
    const user = requireUser(res, context);
    if (!user) return;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const type = url.searchParams.get("type");
    if (type && !isValidCategory(type)) return sendError(res, 400, "VALIDATION_ERROR", "Invalid workout type.");

    let workouts = workoutsForUser(context.data, user.id);
    if (type) workouts = workouts.filter((workout) => workout.type === type);
    const page = workouts.slice(offset, offset + limit);
    return sendJson(res, 200, {
      workouts: page.map(workoutSummary),
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < workouts.length,
      },
    });
  }

  const workoutMatch = url.pathname.match(/^\/api\/workouts\/([^/]+)$/);
  if (workoutMatch) {
    const user = requireUser(res, context);
    if (!user) return;
    const id = workoutMatch[1];
    const workout = context.data.workouts.find((item) => item.id === id && item.userId === user.id && !item.deletedAt);
    if (!workout) return sendError(res, 404, "NOT_FOUND", "Workout not found.");

    if (req.method === "GET") return sendJson(res, 200, { workout: workoutDetail(workout) });

    if (req.method === "PUT") {
      const payload = await readJson(req);
      const result = validateWorkoutPayload(payload);
      if (result.error) return sendError(res, 400, "VALIDATION_ERROR", result.error);
      workout.type = result.workout.type;
      workout.performedAt = result.workout.performedAt;
      workout.notes = result.workout.notes;
      workout.entries = result.workout.entries.map((entry) => ({ ...entry, createdAt: entry.createdAt || new Date().toISOString() }));
      workout.updatedAt = new Date().toISOString();
      await writeData(context.data);
      return sendJson(res, 200, { workout: workoutDetail(workout) });
    }

    if (req.method === "DELETE") {
      workout.deletedAt = new Date().toISOString();
      workout.updatedAt = workout.deletedAt;
      await writeData(context.data);
      res.writeHead(204);
      return res.end();
    }
  }

  if (req.method === "GET" && url.pathname === "/api/progress/exercises") {
    const user = requireUser(res, context);
    if (!user) return;
    return sendJson(res, 200, { exercises: exerciseProgressList(context.data, user.id) });
  }

  const progressMatch = url.pathname.match(/^\/api\/progress\/exercises\/([^/]+)$/);
  if (req.method === "GET" && progressMatch) {
    const user = requireUser(res, context);
    if (!user) return;
    const result = progressForExercise(context.data, user.id, progressMatch[1]);
    if (!result) return sendError(res, 404, "NOT_FOUND", "Exercise not found.");
    const { exercise, rows, points } = result;
    const recentPoint = points[points.length - 1] || null;
    return sendJson(res, 200, {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        category: exercise.category,
        categoryLabel: categoryLabel(exercise.category),
        description: exercise.description,
        primaryMetric: exercise.primaryMetric,
        sideMode: exercise.sideMode,
      },
      summary: {
        mostRecentValue: recentPoint?.value ?? null,
        mostRecentLabel: formatMetricValue(recentPoint?.value ?? null, exercise.primaryMetric),
        mostRecentPerformedAt: recentPoint?.performedAt ?? null,
      },
      points,
      entries: rows.map((row) => ({ ...row, valueLabel: formatEntryValues(row, exercise) })).reverse(),
    });
  }

  sendError(res, 404, "NOT_FOUND", "API route not found.");
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/" || pathname === "") pathname = "/index.html";

  const possibleFile = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!possibleFile.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "FORBIDDEN", "Invalid path.");
    return;
  }

  try {
    const stat = await fs.stat(possibleFile);
    if (stat.isFile()) {
      const ext = path.extname(possibleFile);
      res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(await fs.readFile(possibleFile));
      return;
    }
  } catch {
    // Fall through to SPA route fallback.
  }

  res.writeHead(200, { "content-type": MIME_TYPES[".html"] });
  res.end(await fs.readFile(path.join(PUBLIC_DIR, "index.html")));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    const status = error.status || 500;
    const code = status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR";
    sendError(res, status, code, error.message || "Unexpected server error.");
  }
});

server.listen(PORT, () => {
  console.log(`Physical Therapy Tracker running at http://127.0.0.1:${PORT}`);
});
