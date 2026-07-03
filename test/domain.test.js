import assert from "node:assert/strict";
import test from "node:test";
import { EXERCISES, exercisesForCategory, getExercise } from "../lib/exercises.js";
import {
  exerciseProgressList,
  latestEntryForExercise,
  progressForExercise,
  valueForMetric,
} from "../lib/domain.js";

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
