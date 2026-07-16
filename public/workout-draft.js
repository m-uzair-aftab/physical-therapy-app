export const ACTIVE_DRAFT_VERSION = 1;

export function activeDraftKey(userId) {
  return `pt-active-workout-draft:${userId}`;
}

export function draftResumePath(draft) {
  if (!draft) return "/today";
  if (draft.mode === "edit" && draft.workoutId) return `/history/${draft.workoutId}/edit`;
  return `/workouts/new/${draft.type}`;
}

export function draftSummary(draft) {
  if (!draft) return null;
  const entries = Object.values(draft.entries || {});
  const doneCount = entries.filter((entry) => entry.done).length;
  return {
    mode: draft.mode || "create",
    workoutId: draft.workoutId || null,
    type: draft.type,
    typeLabel: draft.typeLabel || "",
    startedAt: draft.startedAt || null,
    updatedAt: draft.updatedAt || null,
    doneCount,
    totalCount: Array.isArray(draft.exercises) ? draft.exercises.length : entries.length,
  };
}

export function serializeDraft(userId, draft) {
  if (!userId || !draft?.type || !draft?.entries) return null;
  const now = new Date().toISOString();
  return {
    version: ACTIVE_DRAFT_VERSION,
    userId,
    mode: draft.mode || "create",
    workoutId: draft.workoutId || null,
    type: draft.type,
    typeLabel: draft.typeLabel || "",
    notes: draft.notes || "",
    entries: draft.entries,
    startedAt: draft.startedAt || now,
    updatedAt: now,
  };
}

export function normalizeStoredDraft(userId, stored) {
  if (!stored || stored.version !== ACTIVE_DRAFT_VERSION || stored.userId !== userId) return null;
  if (!stored.type || !stored.entries || typeof stored.entries !== "object") return null;
  return {
    mode: stored.mode === "edit" ? "edit" : "create",
    workoutId: stored.workoutId || null,
    type: stored.type,
    typeLabel: stored.typeLabel || "",
    notes: stored.notes || "",
    entries: stored.entries,
    startedAt: stored.startedAt || stored.updatedAt || null,
    updatedAt: stored.updatedAt || stored.startedAt || null,
  };
}

export function mergeDraftEntries(freshItems, storedEntries = {}) {
  const entries = {};
  for (const item of freshItems) {
    const exercise = item.exercise;
    const last = item.lastEntry;
    const stored = storedEntries[exercise.id] || {};
    entries[exercise.id] = {
      exerciseId: exercise.id,
      done: Boolean(stored.done),
      skipped: Boolean(stored.skipped),
      weight: stored.weight ?? last?.weight ?? exercise.defaultWeight,
      reps: stored.reps ?? last?.reps ?? exercise.defaultReps,
      durationSeconds: stored.durationSeconds ?? last?.durationSeconds ?? exercise.defaultDurationSeconds,
      notes: stored.notes || "",
      showNote: Boolean(stored.showNote),
    };
  }
  return entries;
}

export function historyRowsLatestFirst(entries = []) {
  return [...entries].sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt));
}

export function noteHistoryRows(entries = []) {
  return historyRowsLatestFirst(entries).filter((entry) => String(entry.notes || "").trim());
}
