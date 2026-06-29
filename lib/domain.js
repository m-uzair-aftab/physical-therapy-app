import { EXERCISES, getExercise } from "./exercises.js";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
  };
}

export function clampNumber(value, integer = false) {
  if (value === "" || value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  return integer ? Math.round(number) : Math.round(number * 10) / 10;
}

export function trimNote(value, max = 1000) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

export function valueForMetric(entry, primaryMetric) {
  if (primaryMetric === "weight") return entry.weight ?? null;
  if (primaryMetric === "reps") return entry.reps ?? entry.leftReps ?? entry.rightReps ?? null;
  if (primaryMetric === "duration") {
    return entry.durationSeconds ?? entry.leftDurationSeconds ?? entry.rightDurationSeconds ?? null;
  }
  return null;
}

export function formatEntryValues(entry, exercise = getExercise(entry.exerciseId)) {
  const parts = [];
  if (entry.weight !== null && entry.weight !== undefined) parts.push(`${trimNumber(entry.weight)} lb`);
  if (entry.reps !== null && entry.reps !== undefined) {
    parts.push(`${entry.reps} reps${exercise?.sideMode === "each_side" ? " each side" : ""}`);
  }
  if (entry.durationSeconds !== null && entry.durationSeconds !== undefined) {
    parts.push(`${entry.durationSeconds} sec${exercise?.sideMode === "each_side" ? " each side" : ""}`);
  }
  return parts.join(" - ") || "Note only";
}

export function formatMetricValue(value, primaryMetric) {
  if (value === null || value === undefined) return "No entries";
  if (primaryMetric === "weight") return `${trimNumber(value)} lb`;
  if (primaryMetric === "duration") return `${value} sec`;
  return `${value} reps`;
}

export function trimNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}

export function latestEntryForExercise(data, userId, exerciseId) {
  const entries = [];
  for (const workout of data.workouts) {
    if (workout.userId !== userId || workout.deletedAt) continue;
    for (const entry of workout.entries) {
      if (entry.exerciseId === exerciseId) entries.push({ workout, entry });
    }
  }
  entries.sort((a, b) => new Date(b.workout.performedAt) - new Date(a.workout.performedAt));
  return entries[0] || null;
}

export function workoutsForUser(data, userId) {
  return data.workouts
    .filter((workout) => workout.userId === userId && !workout.deletedAt)
    .sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt));
}

export function progressForExercise(data, userId, exerciseId) {
  const exercise = getExercise(exerciseId);
  if (!exercise) return null;

  const rows = [];
  for (const workout of data.workouts) {
    if (workout.userId !== userId || workout.deletedAt) continue;
    for (const entry of workout.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      rows.push({
        workoutId: workout.id,
        entryId: entry.id,
        performedAt: workout.performedAt,
        weight: entry.weight ?? null,
        reps: entry.reps ?? null,
        durationSeconds: entry.durationSeconds ?? null,
        leftReps: entry.leftReps ?? null,
        rightReps: entry.rightReps ?? null,
        leftDurationSeconds: entry.leftDurationSeconds ?? null,
        rightDurationSeconds: entry.rightDurationSeconds ?? null,
        notes: entry.notes || "",
      });
    }
  }

  rows.sort((a, b) => new Date(a.performedAt) - new Date(b.performedAt));
  const points = rows
    .map((entry) => ({
      performedAt: entry.performedAt,
      value: valueForMetric(entry, exercise.primaryMetric),
    }))
    .filter((point) => point.value !== null && point.value !== undefined);

  return { exercise, rows, points };
}

export function exerciseProgressList(data, userId) {
  return EXERCISES.map((exercise) => {
    const latest = latestEntryForExercise(data, userId, exercise.id);
    const value = latest ? valueForMetric(latest.entry, exercise.primaryMetric) : null;
    return {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      primaryMetric: exercise.primaryMetric,
      mostRecentEntry: latest
        ? {
            performedAt: latest.workout.performedAt,
            value,
            label: formatMetricValue(value, exercise.primaryMetric),
          }
        : null,
    };
  });
}
