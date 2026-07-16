import assert from "node:assert/strict";
import test from "node:test";
import { EXERCISES, exercisesForCategory, getExercise } from "../lib/exercises.js";
import {
  exerciseProgressList,
  latestEntryForExercise,
  progressForExercise,
  valueForMetric,
} from "../lib/domain.js";
import {
  draftResumePath,
  draftSummary,
  historyRowsLatestFirst,
  mergeDraftEntries,
  normalizeStoredDraft,
  noteHistoryRows,
  serializeDraft,
} from "../public/workout-draft.js";

test("exercise seed uses canonical categories", () => {
  assert.equal(EXERCISES.length, 16);
  assert.equal(exercisesForCategory("functional").length, 8);
  assert.equal(exercisesForCategory("core_hip").length, 8);
  assert.equal(exercisesForCategory("core").length, 0);
});

test("core hip exercises include bent knee sit up in workout order", () => {
  const coreHip = exercisesForCategory("core_hip");
  assert.deepEqual(
    coreHip.slice(2, 5).map((exercise) => exercise.id),
    ["sidelying_hip_abduction_rainbows", "bent_knee_sit_up", "single_leg_glute_bridge_hold"],
  );

  const exercise = getExercise("bent_knee_sit_up");
  assert.equal(exercise.defaultReps, 10);
  assert.deepEqual(exercise.measurementTypes, ["reps", "notes"]);
  assert.equal(exercise.sideMode, "none");
});

test("each-side exercises use one shared reps field", () => {
  const exercise = getExercise("sidelying_hip_abduction_rainbows");
  assert.equal(exercise.sideMode, "each_side");
  assert.deepEqual(exercise.measurementTypes, ["reps", "notes"]);
  assert.equal(exercise.defaultReps, 15);
});

test("lateral band walks default to ten pounds", () => {
  const exercise = getExercise("lateral_band_monster_walks_press");
  assert.equal(exercise.defaultWeight, 10);
  assert.deepEqual(exercise.measurementTypes, ["weight", "notes"]);
  assert.equal(exercise.primaryMetric, "weight");
});

test("latestEntryForExercise ignores soft-deleted workouts", () => {
  const data = {
    workouts: [
      {
        id: "old",
        userId: "u1",
        performedAt: "2026-06-20T10:00:00.000Z",
        deletedAt: null,
        entries: [{ id: "e1", exerciseId: "pulley_chops", weight: 20.5 }],
      },
      {
        id: "deleted",
        userId: "u1",
        performedAt: "2026-06-28T10:00:00.000Z",
        deletedAt: "2026-06-29T10:00:00.000Z",
        entries: [{ id: "e2", exerciseId: "pulley_chops", weight: 99 }],
      },
    ],
  };
  const latest = latestEntryForExercise(data, "u1", "pulley_chops");
  assert.equal(latest.workout.id, "old");
  assert.equal(latest.entry.weight, 20.5);
});

test("progress uses the configured primary metric", () => {
  assert.equal(valueForMetric({ weight: 22.5, reps: 10 }, "weight"), 22.5);
  assert.equal(valueForMetric({ reps: 15 }, "reps"), 15);
  assert.equal(valueForMetric({ durationSeconds: 60 }, "duration"), 60);
});

test("progress excludes deleted workouts and sorts oldest to newest", () => {
  const data = {
    workouts: [
      {
        id: "w2",
        userId: "u1",
        performedAt: "2026-06-28T10:00:00.000Z",
        deletedAt: null,
        entries: [{ id: "e2", exerciseId: "front_plank_alternating_legs", durationSeconds: 75 }],
      },
      {
        id: "w1",
        userId: "u1",
        performedAt: "2026-06-20T10:00:00.000Z",
        deletedAt: null,
        entries: [{ id: "e1", exerciseId: "front_plank_alternating_legs", durationSeconds: 60 }],
      },
      {
        id: "w3",
        userId: "u1",
        performedAt: "2026-06-29T10:00:00.000Z",
        deletedAt: "2026-06-29T11:00:00.000Z",
        entries: [{ id: "e3", exerciseId: "front_plank_alternating_legs", durationSeconds: 200 }],
      },
    ],
  };
  const result = progressForExercise(data, "u1", "front_plank_alternating_legs");
  assert.deepEqual(
    result.points.map((point) => point.value),
    [60, 75],
  );

  const list = exerciseProgressList(data, "u1");
  const plank = list.find((exercise) => exercise.id === "front_plank_alternating_legs");
  assert.equal(plank.mostRecentEntry.value, 75);
});

test("workout draft helpers serialize, summarize, and route active drafts", () => {
  const draft = {
    mode: "create",
    type: "functional",
    typeLabel: "Functional",
    exercises: [{ exercise: { id: "pulley_chops" } }, { exercise: { id: "press_outs" } }],
    entries: {
      pulley_chops: { exerciseId: "pulley_chops", done: true, weight: 20, notes: "steady" },
      press_outs: { exerciseId: "press_outs", done: false, reps: 10, notes: "" },
    },
    notes: "",
    startedAt: "2026-07-01T12:00:00.000Z",
  };

  const stored = serializeDraft("u1", draft);
  const normalized = normalizeStoredDraft("u1", stored);

  assert.equal(normalized.type, "functional");
  assert.equal(normalized.entries.pulley_chops.weight, 20);
  assert.equal(draftResumePath(normalized), "/workouts/new/functional");
  assert.deepEqual(draftSummary(draft), {
    mode: "create",
    workoutId: null,
    type: "functional",
    typeLabel: "Functional",
    startedAt: "2026-07-01T12:00:00.000Z",
    updatedAt: null,
    doneCount: 1,
    totalCount: 2,
  });
  assert.equal(normalizeStoredDraft("other-user", stored), null);
});

test("workout draft merge preserves stored values over defaults and last entry", () => {
  const freshItems = [
    {
      exercise: {
        id: "pulley_chops",
        defaultWeight: 10,
        defaultReps: null,
        defaultDurationSeconds: null,
      },
      lastEntry: { weight: 15, reps: null, durationSeconds: null },
    },
  ];

  const entries = mergeDraftEntries(freshItems, {
    pulley_chops: {
      done: true,
      skipped: false,
      weight: 22.5,
      notes: "felt good",
      showNote: true,
    },
  });

  assert.equal(entries.pulley_chops.done, true);
  assert.equal(entries.pulley_chops.weight, 22.5);
  assert.equal(entries.pulley_chops.notes, "felt good");
  assert.equal(entries.pulley_chops.showNote, true);
});

test("exercise history helpers sort latest first and filter notes", () => {
  const entries = [
    { performedAt: "2026-06-01T10:00:00.000Z", notes: "older" },
    { performedAt: "2026-06-03T10:00:00.000Z", notes: "" },
    { performedAt: "2026-06-02T10:00:00.000Z", notes: "middle" },
  ];

  assert.deepEqual(
    historyRowsLatestFirst(entries).map((entry) => entry.performedAt),
    ["2026-06-03T10:00:00.000Z", "2026-06-02T10:00:00.000Z", "2026-06-01T10:00:00.000Z"],
  );
  assert.deepEqual(
    noteHistoryRows(entries).map((entry) => entry.notes),
    ["middle", "older"],
  );
});
