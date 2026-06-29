# Physical Therapy Exercise Tracker Engineering Spec

Source requirements: [physical-therapy-app-spec.md](physical-therapy-app-spec.md)

## 1. Purpose

This document translates the product requirements into an implementation-ready engineering plan for version 1 of the Physical Therapy Exercise Tracker.

Version 1 is a mobile-first authenticated web app for logging predefined physical therapy workouts, reviewing workout history, and tracking exercise-specific progress over time.

## 2. Engineering Goals

- Provide account-backed workout data that persists across sessions and devices.
- Keep workout logging fast on mobile.
- Seed the app with the predefined Functional and Core / Hip exercise libraries.
- Show last-used values while logging a workout.
- Save only exercises explicitly marked complete.
- Support history, detail, edit, delete, and progress views.
- Keep the codebase simple enough for a focused version 1 without overbuilding future features.

## 3. Recommended Technical Stack

The requirements do not mandate a stack. For a practical version 1 without requiring a custom domain, use:

- Framework: Next.js with React and TypeScript
- Routing: Next.js App Router or Pages Router
- Backend: Next.js route handlers/API routes with TypeScript
- API style: REST JSON
- Database: PostgreSQL
- ORM/query layer: Drizzle, Prisma, or equivalent typed database layer
- Auth: Email/password with secure password hashing and same-origin HTTP-only session cookies
- Charts: Recharts or another lightweight React chart library
- Styling: CSS modules, Tailwind, or a small design-token-driven CSS layer

This same-origin full-stack setup avoids cross-origin cookie/CORS complexity on the default hosting domains.

## 4. Architecture

### 4.1 High-Level Components

- Web app
  - Auth screens
  - App shell and navigation
  - Workout logging flow
  - History views
  - Progress views
  - Settings views
- API route handlers
  - Authentication endpoints
  - Exercise library endpoints
  - Workout CRUD endpoints
  - Progress read endpoints
- Database
  - Users
  - Exercises
  - Workouts
  - Workout exercise entries
  - Sessions, if using server-side sessions

### 4.2 Request Flow

1. User signs in with email and password.
2. The app creates a session and returns a secure HTTP-only same-origin cookie.
3. Client calls same-origin authenticated APIs using the session cookie.
4. API route handlers scope all workout/history/progress queries by authenticated user ID.
5. Client renders mobile-first views and performs optimistic local form updates only before saving.

## 5. Domain Concepts

### 5.1 Workout Category

Use one enum for workout categories:

```ts
type WorkoutCategory = "functional" | "core_hip";
```

Display labels:

| Value | Label |
| --- | --- |
| `functional` | Functional |
| `core_hip` | Core / Hip |

The design prototype uses `core` as a local mock shorthand in places. Do not use that value in persisted data, API payloads, route params, or application domain types. The canonical API/database value is `core_hip`; the user-facing label is `Core / Hip`.

### 5.2 Measurement Type

Exercises can support one or more measurement fields:

```ts
type MeasurementType = "weight" | "reps" | "duration" | "notes";
```

### 5.3 Primary Metric

Each exercise has one primary metric for progress charts:

```ts
type PrimaryMetric = "weight" | "reps" | "duration";
```

### 5.4 Side Mode

Side mode determines whether reps/duration are tracked as a single value or side-specific values:

```ts
type SideMode = "none" | "each_side" | "left_right";
```

Version 1 should use `each_side` for exercises described as "each side" and should not require separate left/right entry unless the exercise is later configured with `left_right`.

For version 1, `each_side` uses one shared input. For example, "15 reps each side" is entered as `15` in the shared reps field, not as separate left and right values.

## 6. Data Model

### 6.1 Users

Stores application accounts.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID or serial primary key | Internal user ID |
| `email` | text, unique, required | Lowercase normalized |
| `password_hash` | text, required | Never store raw passwords |
| `name` | text, nullable | Optional display name |
| `created_at` | timestamp, required | Server generated |
| `updated_at` | timestamp, required | Server generated |

Indexes:

- Unique index on `email`

### 6.2 Exercises

Seeded predefined exercise library.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable slug-like ID |
| `name` | text, required | Display name |
| `category` | enum, required | `functional` or `core_hip` |
| `description` | text, required | Setup/cues |
| `default_weight` | decimal, nullable | Pounds |
| `default_reps` | integer, nullable | Reps |
| `default_duration_seconds` | integer, nullable | Seconds |
| `measurement_types` | json/text array, required | Supported fields |
| `primary_metric` | enum, required | Chart default |
| `side_mode` | enum, required | Side-specific behavior |
| `sort_order` | integer, required | Display order within category |
| `created_at` | timestamp, required | Server generated |
| `updated_at` | timestamp, required | Server generated |

Indexes:

- Index on `category, sort_order`

### 6.3 Workouts

Represents a saved workout session.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID or serial primary key | Internal workout ID |
| `user_id` | foreign key, required | Owner |
| `type` | enum, required | Workout category |
| `performed_at` | timestamp, required | Date/time of workout |
| `notes` | text, nullable | Optional workout-level notes |
| `deleted_at` | timestamp, nullable | Soft delete marker |
| `created_at` | timestamp, required | Server generated |
| `updated_at` | timestamp, required | Server generated |

Indexes:

- Index on `user_id, performed_at desc` for rows where `deleted_at is null`
- Index on `user_id, type, performed_at desc` for rows where `deleted_at is null`

### 6.4 Workout Exercise Entries

Represents one completed exercise in a workout.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID or serial primary key | Internal entry ID |
| `workout_id` | foreign key, required | Parent workout |
| `exercise_id` | foreign key, required | Exercise library item |
| `weight` | decimal, nullable | Pounds |
| `reps` | integer, nullable | General reps or each-side reps |
| `duration_seconds` | integer, nullable | General duration or each-side duration |
| `left_reps` | integer, nullable | Future-ready |
| `right_reps` | integer, nullable | Future-ready |
| `left_duration_seconds` | integer, nullable | Future-ready |
| `right_duration_seconds` | integer, nullable | Future-ready |
| `notes` | text, nullable | Exercise notes |
| `created_at` | timestamp, required | Server generated |
| `updated_at` | timestamp, required | Server generated |

Rules:

- Only completed exercises are saved as entries.
- Version 1 does not need a `completed` column in persisted entries because existence means completion.
- If preserving the requirements draft exactly is preferred, a `completed` boolean may be included, but it should always be true for saved entries.

Indexes:

- Index on `workout_id`
- Index on `exercise_id`
- Composite index on `exercise_id, workout_id`

### 6.5 Sessions

Needed only if using server-side sessions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Session token hash or ID |
| `user_id` | foreign key, required | Owner |
| `expires_at` | timestamp, required | Expiration |
| `created_at` | timestamp, required | Server generated |

Indexes:

- Index on `user_id`
- Index on `expires_at`

## 7. Seed Exercise Library

Exercise IDs should be stable because history records reference them.

### 7.1 Functional Gross Motor Movements

| ID | Name | Defaults | Measurements | Primary Metric | Side Mode |
| --- | --- | --- | --- | --- | --- |
| `squat_overhead_db_press` | Squat with overhead dumbbell press | 12.5 lb | weight, notes | weight | none |
| `press_outs` | Medicine ball / dumbbell press-outs | 10 lb | weight, notes | weight | none |
| `walking_lunges_trunk_rotation_press_out` | Walking lunges with trunk rotation and ball press-out | 10 lb | weight, notes | weight | none |
| `pulley_lifts` | Pulley lifts | 14 lb | weight, notes | weight | none |
| `pulley_chops` | Pulley chops | 20.5 lb | weight, notes | weight | each_side |
| `half_kneeling_rise_overhead_raise_balance` | Half-kneeling rise to opposite-arm overhead dumbbell raise and single-leg balance | 12.5 lb | weight, notes | weight | each_side |
| `farmers_carry_side` | Farmer's carry at side | 35 lb | weight, notes | weight | none |
| `farmers_overhead_carry` | Farmer's overhead carry | 17.5 lb | weight, notes | weight | none |

### 7.2 Core / Hip Strengthening

| ID | Name | Defaults | Measurements | Primary Metric | Side Mode |
| --- | --- | --- | --- | --- | --- |
| `lateral_band_monster_walks_press` | Lateral band walks or monster walks with ball press-out or overhead press | none | reps, notes | reps | none |
| `front_plank_alternating_legs` | Front plank, alternating legs | 60 sec | duration, notes | duration | none |
| `sidelying_hip_abduction_rainbows` | Sidelying hip abduction rainbows | 15 reps each side | reps, notes | reps | each_side |
| `single_leg_glute_bridge_hold` | Single-leg glute bridge hold | 45 sec | duration, notes | duration | none |
| `back_single_leg_scissor_drop` | Back single-leg scissor drop | 15 reps each side | reps, notes | reps | each_side |
| `ball_back_extension` | Ball back extension | 30 reps total | reps, notes | reps | none |
| `ball_side_flexion` | Ball side flexion | 10 reps each side | reps, notes | reps | each_side |

Notes/cues must be seeded from the source requirements document.

## 8. API Specification

All API routes that access user data require authentication unless explicitly marked public.

### 8.1 Auth

#### `POST /api/auth/register`

Creates an account and signs the user in.

Request:

```json
{
  "email": "user@example.com",
  "password": "password",
  "name": "Optional Name"
}
```

Response `201`:

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "Optional Name"
  }
}
```

Validation:

- Email is required and must be valid.
- Password is required and must meet the configured minimum length.
- Email must be unique.

#### `POST /api/auth/login`

Signs in an existing user.

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response `200`:

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "Optional Name"
  }
}
```

#### `POST /api/auth/logout`

Destroys the active session.

Response `204`.

#### `GET /api/auth/me`

Returns the authenticated user.

Response `200`:

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "Optional Name"
  }
}
```

### 8.2 Exercises

#### `GET /api/exercises`

Returns all seeded exercises grouped or filterable by category.

Query params:

- `category`: optional `functional` or `core_hip`

Response `200`:

```json
{
  "exercises": [
    {
      "id": "pulley_chops",
      "name": "Pulley chops",
      "category": "functional",
      "description": "Pulley set high. Half-kneel and pull down/across body.",
      "defaultWeight": 20.5,
      "defaultReps": null,
      "defaultDurationSeconds": null,
      "measurementTypes": ["weight", "notes"],
      "primaryMetric": "weight",
      "sideMode": "each_side",
      "sortOrder": 5
    }
  ]
}
```

### 8.3 Workout Draft Data

#### `GET /api/workouts/start-data?type=functional`

Returns exercise library items plus the signed-in user's last-used values for that workout type.

Response `200`:

```json
{
  "type": "functional",
  "exercises": [
    {
      "exercise": {
        "id": "pulley_chops",
        "name": "Pulley chops",
        "description": "Pulley set high. Half-kneel and pull down/across body.",
        "measurementTypes": ["weight", "notes"],
        "primaryMetric": "weight",
        "sideMode": "each_side",
        "defaultWeight": 20.5,
        "defaultReps": null,
        "defaultDurationSeconds": null
      },
      "lastEntry": {
        "performedAt": "2026-06-25T18:30:00.000Z",
        "weight": 20.5,
        "reps": 12,
        "durationSeconds": null,
        "notes": ""
      }
    }
  ]
}
```

Server logic:

- For each exercise in the category, find the latest entry for the current user.
- If no last entry exists, the client should prefill today's fields from exercise defaults.

### 8.4 Workouts

#### `POST /api/workouts`

Creates a workout with one or more completed entries.

Request:

```json
{
  "type": "functional",
  "performedAt": "2026-06-28T18:30:00.000Z",
  "notes": "",
  "entries": [
    {
      "exerciseId": "pulley_chops",
      "weight": 20.5,
      "reps": 12,
      "durationSeconds": null,
      "leftReps": null,
      "rightReps": null,
      "leftDurationSeconds": null,
      "rightDurationSeconds": null,
      "notes": ""
    }
  ]
}
```

Response `201`:

```json
{
  "workout": {
    "id": "workout_id",
    "type": "functional",
    "performedAt": "2026-06-28T18:30:00.000Z",
    "completedExerciseCount": 1
  }
}
```

Validation:

- `type` is required.
- `entries` must contain at least one completed exercise entry.
- Fully empty workouts must not be saved.
- Each `exerciseId` must exist and belong to the selected workout type.
- Numeric values must be non-negative.
- Notes should be length-limited.

#### `GET /api/workouts`

Returns the signed-in user's non-deleted workout history in reverse chronological order.

Query params:

- `limit`: optional, default 50
- `offset`: optional, default 0
- `type`: optional workout category filter

Response `200`:

```json
{
  "workouts": [
    {
      "id": "workout_id",
      "type": "functional",
      "performedAt": "2026-06-28T18:30:00.000Z",
      "completedExerciseCount": 6
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

#### `GET /api/workouts/:id`

Returns workout details.

Response `200`:

```json
{
  "workout": {
    "id": "workout_id",
    "type": "functional",
    "performedAt": "2026-06-28T18:30:00.000Z",
    "notes": "",
    "entries": [
      {
        "id": "entry_id",
        "exerciseId": "pulley_chops",
        "exerciseName": "Pulley chops",
        "exerciseDescription": "Pulley set high. Half-kneel and pull down/across body.",
        "weight": 20.5,
        "reps": 12,
        "durationSeconds": null,
        "notes": ""
      }
    ]
  }
}
```

Authorization:

- Return `404` if the workout does not exist or does not belong to the current user.

#### `PUT /api/workouts/:id`

Updates workout metadata and replaces entries.

Request shape matches `POST /api/workouts`.

Rules:

- Replacement is acceptable for version 1 because entries are single-value records.
- Update must be transactional: update workout and entries together.
- If replacement entries are empty, reject with `400`. Fully empty workouts are not saved in version 1.

#### `DELETE /api/workouts/:id`

Soft-deletes a workout by setting `deleted_at`. Entries remain in the database for retention/audit purposes but should be excluded from history, detail, last-used values, and progress queries.

Response `204`.

### 8.5 Workout Entries

These endpoints are optional if workout editing replaces the full entry list. They are useful for focused edit/delete interactions.

#### `PATCH /api/workout-entries/:id`

Updates one saved exercise entry.

#### `DELETE /api/workout-entries/:id`

Deletes one saved exercise entry.

Rules:

- If deleting the last entry in a workout, soft-delete the parent workout or reject the action with guidance to delete the workout. Fully empty saved workouts are not supported in version 1.

### 8.6 Progress

#### `GET /api/progress/exercises`

Returns exercises with most recent logged values for the current user.

Response `200`:

```json
{
  "exercises": [
    {
      "id": "pulley_chops",
      "name": "Pulley chops",
      "category": "functional",
      "primaryMetric": "weight",
      "mostRecentEntry": {
        "performedAt": "2026-06-28T18:30:00.000Z",
        "value": 20.5,
        "label": "20.5 lb"
      }
    }
  ]
}
```

#### `GET /api/progress/exercises/:exerciseId`

Returns chart points and table rows for one exercise.

Response `200`:

```json
{
  "exercise": {
    "id": "pulley_chops",
    "name": "Pulley chops",
    "category": "functional",
    "description": "Pulley set high. Half-kneel and pull down/across body.",
    "primaryMetric": "weight"
  },
  "summary": {
    "mostRecentValue": 20.5,
    "mostRecentPerformedAt": "2026-06-28T18:30:00.000Z"
  },
  "points": [
    {
      "performedAt": "2026-06-28T18:30:00.000Z",
      "value": 20.5
    }
  ],
  "entries": [
    {
      "workoutId": "workout_id",
      "entryId": "entry_id",
      "performedAt": "2026-06-28T18:30:00.000Z",
      "weight": 20.5,
      "reps": 12,
      "durationSeconds": null,
      "notes": ""
    }
  ]
}
```

Metric mapping:

- `weight`: use `workout_exercise_entries.weight`
- `reps`: use `reps`, or `left_reps`/`right_reps` only for future `left_right` exercises
- `duration`: use `duration_seconds`, or side duration fields only for future `left_right` exercises

## 9. Frontend Routes

Recommended routes:

| Route | Access | Purpose |
| --- | --- | --- |
| `/sign-in` | Public | Sign in |
| `/register` | Public | Create account |
| `/today` | Authenticated | Dashboard / start workout |
| `/workouts/new/:type` | Authenticated | Workout mode |
| `/workouts/:id/summary` | Authenticated | Save confirmation |
| `/history` | Authenticated | Workout history |
| `/history/:id` | Authenticated | Workout detail |
| `/history/:id/edit` | Authenticated | Edit saved workout |
| `/progress` | Authenticated | Exercise progress list |
| `/progress/:exerciseId` | Authenticated | Exercise progress detail |
| `/settings` | Authenticated | Profile, units, sign out |

Default behavior:

- Unauthenticated users visiting authenticated routes redirect to `/sign-in`.
- Authenticated users visiting `/sign-in` redirect to `/today`.
- Root `/` redirects to `/today` or `/sign-in` depending on auth state.

## 10. Frontend Screens

### 10.1 Sign In

Fields:

- Email
- Password

Actions:

- Sign in
- Navigate to create account

States:

- Loading
- Invalid credentials
- Network/server error

### 10.2 Register

Fields:

- Name, optional
- Email
- Password

Actions:

- Create account
- Navigate to sign in

Version 1 must support in-app account creation. Accounts should not require admin creation.

### 10.3 Today

Content:

- Current date or short greeting
- Start Functional workout action
- Start Core / Hip workout action
- Most recent workout summary
- Link to last workout detail, if available

Behavior:

- Tapping a workout type opens `/workouts/new/:type`.
- Recent summary should be hidden or replaced with a useful empty state when no workouts exist.

### 10.4 Workout Mode

Data source:

- `GET /api/workouts/start-data?type=:type`

Each exercise panel:

- Exercise name
- Cue text
- Last-used values or default values
- Editable fields for supported measurements
- Done toggle
- Skip control
- Optional notes

Workout-level controls:

- Workout notes field, shown from day one
- Completed-exercise progress indicator
- Finish workout button
- Cancel workout option
- Sticky finish bar, especially on mobile

State model:

```ts
type WorkoutDraftEntry = {
  exerciseId: string;
  done: boolean;
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  leftReps?: number | null;
  rightReps?: number | null;
  leftDurationSeconds?: number | null;
  rightDurationSeconds?: number | null;
  notes?: string;
};
```

The left/right fields are reserved for future `left_right` exercises. Version 1 should render one shared input for `each_side` values and should leave left/right fields unset.

Behavior:

- Initialize today's values from the latest entry if present; otherwise use exercise defaults.
- User can edit values without marking done.
- Only entries with `done: true` are submitted.
- Numeric values should use stepper controls where practical.
- Recommended step sizes are `2.5 lb` for weight, `1` for reps, and `5 sec` for duration.
- For `each_side` exercises, use one shared reps or duration input that represents the per-side value.
- Finish button remains available, but if zero exercises are done, show a cancel-only confirmation. Do not save fully empty workouts.
- Done and skipped states should be visually distinct and accessible without relying on color alone.
- Cancel workout asks for confirmation if any local edits or done states exist.

### 10.5 Workout Summary

Content:

- Saved confirmation
- Workout type
- Date/time
- Completed exercises
- Link to workout detail
- Link back to Today

### 10.6 History

Data source:

- `GET /api/workouts`

Content:

- Reverse chronological list
- Workout type label
- Date
- Completed exercise count

States:

- Loading
- Empty history
- Error

### 10.7 Workout Detail

Data source:

- `GET /api/workouts/:id`

Content:

- Date/time
- Workout type
- Workout notes
- Completed exercise entries
- Logged values
- Exercise notes

Actions:

- Edit workout
- Delete workout

Delete behavior:

- Confirm before delete.
- On success, navigate to History.

### 10.8 Workout Edit

Data source:

- `GET /api/workouts/:id`
- `GET /api/exercises?category=:type`

Behavior:

- Show exercises from the workout category.
- Prefill completed entries from the saved workout.
- Allow adding previously skipped exercises by marking them done.
- Submit replacement payload to `PUT /api/workouts/:id`.

### 10.9 Progress

Data source:

- `GET /api/progress/exercises`

Content:

- Exercise list grouped by category
- Most recent value for each exercise
- Category filter or tabs

States:

- Empty progress for exercises with no entries
- Loading
- Error

### 10.10 Exercise Progress Detail

Data source:

- `GET /api/progress/exercises/:exerciseId`

Content:

- Exercise name
- Category
- Cue text
- Most recent value
- Simple line chart
- Historical table

Chart behavior:

- X-axis: workout date
- Y-axis: primary metric
- Hide chart or show a helpful empty state when fewer than two points exist.

### 10.11 Settings

Content:

- Email/name
- Units display, fixed to pounds for version 1
- Sign out

## 11. Validation Rules

### 11.1 General Numeric Inputs

- Empty numeric fields are allowed before save.
- Saved numeric values must be greater than or equal to 0.
- Decimal values are allowed for weight.
- Reps and duration must be whole numbers.
- Duration is stored in seconds.

### 11.2 Exercise Entry Validity

For a completed entry:

- At least one configured measurement value or a note should be present.
- If an exercise has a default value and the user marks it done without edits, save the default/last-used displayed value.
- Do not save entries for skipped exercises.
- Do not save a workout if no exercise entries are marked done.

### 11.3 Notes

- Exercise note max length: 1,000 characters.
- Workout note max length: 1,000 characters.
- Trim leading/trailing whitespace on save.

### 11.4 Dates

- Store timestamps in UTC.
- Render dates/times in the user's local timezone.
- Default `performedAt` to the current time when the workout is finished.

## 12. Last-Used Value Logic

For each exercise in a workout draft:

1. Query the latest workout entry for the authenticated user and exercise from a non-deleted workout.
2. Use the entry values as `lastEntry`.
3. If `lastEntry` exists, prefill today's editable fields from `lastEntry`.
4. If no `lastEntry` exists, prefill from exercise defaults.
5. If neither exists, leave the input empty.

The "Last time" display should show the latest saved value, not the default value. Defaults can be shown as today's starting values when no history exists.

## 13. Progress Metric Logic

Each exercise has a configured `primaryMetric`.

Chart values are calculated per saved entry:

| Primary Metric | Value Source |
| --- | --- |
| `weight` | `entry.weight` |
| `reps` | `entry.reps` |
| `duration` | `entry.duration_seconds` |

If the primary metric value is missing for an entry, exclude that entry from chart points but keep it in the historical table.

Progress queries must exclude entries whose parent workout has `deleted_at` set.

## 14. Authentication And Authorization

### 14.1 Passwords

- Hash passwords with bcrypt, argon2, or another accepted password hashing algorithm.
- Never log raw passwords.
- Normalize emails to lowercase before storage and lookup.

### 14.2 Sessions

- Use HTTP-only secure cookies.
- Set `SameSite=Lax` or stricter.
- Configure cookie `Secure` in production.
- Expire sessions after a reasonable duration, such as 30 days.

### 14.3 Authorization

- Every workout and entry query must be scoped by current user.
- Do not expose whether another user's workout ID exists.
- Return `404` for missing or unauthorized workout resources.

## 15. Error Handling

Use consistent JSON errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Entries must contain at least one completed exercise."
  }
}
```

Recommended error codes:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `INTERNAL_ERROR`

Frontend behavior:

- Show inline validation errors near fields.
- Show non-blocking save errors near the save/finish action.
- Avoid losing unsaved workout draft values after a failed save.

## 16. Accessibility

- All form fields must have labels.
- Icon buttons must have accessible names.
- Done toggles must be keyboard accessible.
- Touch targets should be at least 44px by 44px.
- Color should not be the only completed/error indicator.
- Charts must be accompanied by a readable table.
- Focus should move predictably after route changes and modal confirmations.

## 17. Performance

- Initial authenticated app load should avoid fetching all workout history.
- History should be paginated.
- Progress detail should fetch one exercise at a time.
- Exercise library can be cached client-side because it changes rarely.
- Workout draft state should update locally without server calls until finish/save.

## 18. Security And Privacy

- All user workout data is private to the account.
- Avoid storing medical advice or clinician-generated content in version 1.
- Do not include social sharing.
- Do not send analytics events containing exercise notes unless explicitly scrubbed.
- Protect all mutating endpoints against CSRF if using cookie-based auth.

## 19. Design Implementation Notes

Use the design system values from the product requirements:

- Background: `#F7F8F6`
- Surface: `#FFFFFF`
- Primary: `#256D5A`
- Primary hover: `#1F5C4C`
- Accent: `#D98F45`
- Text primary: `#1F2933`
- Text secondary: `#64707D`
- Border: `#D9DED8`
- Success: `#2F855A`
- Warning: `#B7791F`
- Error: `#C2413D`

Implementation guidance:

- Mobile-first layout.
- Use the design prototype as the primary reference for layout and interaction patterns.
- Use mobile bottom navigation for the authenticated app.
- Use desktop sidebar navigation when there is enough horizontal space.
- Keep workout mode dense but readable.
- Use compact panels for repeated exercises.
- Keep primary actions easy to reach.
- Use numeric steppers for workout values where practical.
- Use a completed-exercise progress indicator in workout mode.
- Use a sticky finish bar in workout mode.
- Use confirmation modals for empty-workout cancel/discard and workout deletion.
- Avoid marketing-style hero sections.
- Avoid nested cards.
- Use accessible lucide icons or familiar icon buttons for edit, delete, back, and more actions. Do not copy prototype square marker placeholders literally.

## 20. Prototype Implementation Notes

[Rehab Log (standalone).html](<Rehab Log (standalone).html>) is the design prototype for version 1. Use it for UI direction, not for backend or domain behavior.

Use the prototype as the primary reference for:

- Today screen composition
- Mobile bottom navigation
- Desktop sidebar navigation
- Compact workout panels
- Numeric stepper controls
- Skip and done states
- Sticky finish bar
- History/detail layouts
- Progress chart and history table treatment
- Calm clinical visual tone

Do not implement prototype-only mock behavior as production behavior:

- Fake user data
- Local-only state
- Hardcoded dates
- Fake progress series
- Missing registration flow
- Prototype category shorthand such as `core`
- Bundled HTML/runtime internals

When the prototype conflicts with this engineering spec or the product spec, the specs are authoritative.

Resolved conflict handling:

- In-app account creation is required even though the prototype only shows sign-in.
- Fully empty workouts must not be saved; the empty-workout modal should only support canceling/discarding.
- Workout-level notes are required from day one even though the prototype mainly models exercise-level notes.
- Deleted workouts are soft-deleted even though the prototype removes items from local state.
- Weight units are fixed to pounds.
- `each_side` values use one shared input.
- Existing exercise definitions and defaults in the specs override prototype sample defaults.

## 21. Testing Plan

### 21.1 Unit Tests

Cover:

- Exercise seed mapping
- Last-used value selection
- Progress metric extraction
- Input validation
- Auth utility functions

### 21.2 API Tests

Cover:

- Register/login/logout/me
- Authenticated route protection
- Create workout with completed entries
- Reject workout with invalid exercise/type mismatch
- History scoped to current user
- Workout detail scoped to current user
- Update workout transaction behavior
- Soft-delete workout behavior
- Progress endpoint chart data

### 21.3 UI Tests

Cover:

- Sign in flow
- Start Functional workout
- Start Core / Hip workout
- Mark exercises done and finish workout
- Confirm behavior when finishing with zero completed exercises
- Workout mode progress indicator and sticky finish bar
- Stepper controls for weight, reps, and duration
- Skip and done state behavior
- Empty-workout cancel/discard modal
- History list and detail navigation
- Edit saved workout
- Delete saved workout
- Progress list and detail chart/table

### 21.4 Manual QA Checklist

- Works on phone viewport.
- Works on tablet viewport.
- Works on desktop viewport.
- Touch targets are comfortable in workout mode.
- Unsaved workout values are not lost after validation errors.
- Last-used values update after saving a workout.
- Skipped exercises are not saved.
- Deleted workouts disappear from history and progress.

## 22. Implementation Sequence

### Phase 1: Project Foundation

- Create app structure.
- Configure TypeScript, linting, formatting, and test tooling.
- Configure database connection and migrations.
- Add design tokens and base layout.

### Phase 2: Authentication

- Implement user model.
- Implement register, login, logout, and current user endpoints.
- Add protected route behavior.
- Build sign-in and register screens.

### Phase 3: Exercise Library

- Implement exercise schema and seed migration.
- Add exercise API endpoint.
- Verify seeded exercises and sort order.

### Phase 4: Workout Logging

- Implement workout and entry schemas.
- Implement workout start-data endpoint.
- Build Today screen.
- Build Workout Mode screen.
- Implement workout create endpoint.
- Add workout summary screen.

### Phase 5: History And Editing

- Implement history list endpoint.
- Implement workout detail endpoint.
- Implement update/delete endpoints.
- Build History, Detail, and Edit screens.

### Phase 6: Progress

- Implement progress list endpoint.
- Implement progress detail endpoint.
- Build Progress and Exercise Progress Detail screens.
- Add chart and historical table.

### Phase 7: Polish And QA

- Add empty states.
- Add loading and error states.
- Complete accessibility pass.
- Complete responsive QA.
- Configure production hosting, environment variables, backups, and deployment checks.
- Add production readiness checks.

## 23. Acceptance Criteria

Version 1 is complete when:

- A user can create an account, sign in, and sign out.
- A signed-in user can start either predefined workout type.
- Workout mode shows every exercise for the selected type.
- Each exercise shows cue text, last-used values, editable values, notes, and a done control.
- Workout mode includes skip controls, numeric steppers where practical, a completed-exercise progress indicator, and a sticky finish bar.
- Workout mode includes workout-level notes.
- A user can skip exercises.
- Finishing a workout saves only completed exercises.
- Fully empty workouts cannot be saved.
- A user can view workout history in reverse chronological order.
- A user can open workout details.
- A user can edit and delete saved workout data.
- Deleted workouts are soft-deleted and excluded from normal app views.
- A user can view exercise progress with a chart and table.
- User data is private and scoped to the signed-in account.
- The app is usable on mobile, tablet, and desktop.

## 24. Resolved Product Decisions

The following decisions are confirmed for version 1:

- Account creation is included in the app.
- Fully empty workouts are not saved. If no exercise is marked done, the user can only cancel the workout.
- Weight units are fixed to pounds.
- `each_side` values use one shared input in version 1.
- Workout-level notes are shown in the UI from day one.
- Deleted workouts are soft-deleted.
- The product and engineering specs override the design prototype when conflicts exist.

## 25. Future-Compatible Decisions

The schema leaves room for future features without requiring version 1 UI complexity:

- `left_reps` and `right_reps` support future side-specific tracking.
- `left_duration_seconds` and `right_duration_seconds` support future side-specific timed exercises.
- Stable exercise IDs support progress continuity.
- Workout notes can support future weekly progress notes.
- API pagination supports longer workout histories.
- Exercise measurement metadata can support custom exercises later.

## 26. Deployment Recommendations

The app can be deployed several ways. For version 1 without a custom domain, prioritize same-origin hosting, low operational overhead, managed PostgreSQL, easy previews, and reliable backups.

### 26.1 Split Frontend/Backend Option

Use this only if you later add a custom domain or a robust same-origin proxy/rewrite layer:

| Layer | Recommended Service | Why |
| --- | --- | --- |
| Frontend | Vercel | Strong frontend hosting and previews |
| Backend | Render Web Service | Straightforward Node.js service hosting |
| Database | Neon Postgres | Managed serverless PostgreSQL |

With no custom domain, this setup puts the frontend and backend on different origins. Cookie-based auth can become fragile across browsers and mobile privacy settings because it requires credentialed CORS and cross-site cookie configuration. It is no longer the recommended default for version 1.

### 26.2 Single-Origin Render Alternative

Use Render as an alternative only if the frontend build and backend API are served from the same Render Web Service origin:

| Layer | Service |
| --- | --- |
| Web app and API | Render Web Service |
| Database | Render PostgreSQL or Neon Postgres |

This is a reasonable alternative if you want one vendor for runtime services, logs, environment variables, and billing. Avoid splitting the frontend onto Render Static Site and the backend onto a separate Render Web Service unless you also implement a same-origin proxy/rewrite strategy.

### 26.3 Fastest Prototype Option

Use Railway for backend and database, with either Railway or Vercel for the frontend:

| Layer | Service |
| --- | --- |
| Frontend | Vercel or Railway |
| Backend | Railway |
| Database | Railway PostgreSQL |

Railway is convenient for rapid prototypes and small apps, especially when the backend and database should be created quickly from one project dashboard. For version 1 production, prefer a same-origin deployment unless Railway is serving the app and API from the same origin. Before relying on it long term, confirm pricing, backup behavior, and production resource limits.

### 26.4 Recommended Default: Full-Stack Vercel

Use this setup for version 1:

| Layer | Recommended Service |
| --- | --- |
| Web app and API routes | Vercel |
| Database | Neon Postgres |

This deploys the Next.js frontend and route handlers under one `*.vercel.app` origin, avoiding cross-origin cookie/CORS issues without needing a custom domain.

Recommended production URLs:

- App and API: `https://your-project.vercel.app`
- API routes: same-origin paths such as `https://your-project.vercel.app/api/workouts`
- Database: private connection string stored only in server-side environment variables

Important notes:

- Keep frontend pages and API route handlers in the same Next.js deployment.
- Use HTTP-only same-origin session cookies.
- Do not use JWT auth merely to work around cross-origin deployment. JWTs in `Authorization` headers still require CORS when the API is cross-origin and usually introduce browser-readable token storage tradeoffs.
- Cross-origin CORS config should not be needed for normal app/API calls in the recommended deployment.
- Keep `DATABASE_URL`, session secrets, and password hashing config server-side only.

### 26.5 Supabase-Heavy Option

Supabase can host the database and optionally handle authentication:

| Layer | Service |
| --- | --- |
| Frontend | Vercel |
| Backend | Node.js API on Render, or Supabase Edge Functions for lightweight server logic |
| Database | Supabase Postgres |
| Auth | Supabase Auth, optional |

This is attractive if you want managed auth and a Postgres dashboard. If using Supabase Auth, update the authentication section of this spec because session handling, user IDs, and auth middleware will differ from custom email/password sessions.

### 26.6 Services To Avoid For Version 1

Avoid self-managed VPS/database hosting for the first release unless you specifically want infrastructure work. The app handles personal health-adjacent logs, so managed backups, security updates, TLS, and operational reliability are worth outsourcing early.

### 26.7 Production Environment Variables

Backend variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV=production`

Optional variables:

- `COOKIE_DOMAIN`, only if a custom domain/subdomain setup is added later
- `CORS_ORIGIN`, only if an external frontend or third-party client is intentionally supported later
- `NEXT_PUBLIC_APP_URL`, only if the frontend needs to render absolute app URLs

Do not expose:

- Database credentials
- Session secrets
- Password hashing secrets or parameters that should remain private

### 26.8 Database Operations

Minimum production expectations:

- Automated daily backups on a paid database tier before real personal data is stored.
- Migration command documented and run as part of deploy or release process.
- Separate development and production databases.
- Point-in-time recovery if the app becomes important for long-term tracking.
- Clear retention behavior for deleted workouts.

### 26.9 Deployment Decision

Recommended version 1 choice: option 26.4.

- Web app and API routes: Vercel
- Database: Neon Postgres

Reasoning:

- It keeps the frontend and API on one origin without requiring a custom domain.
- It supports HTTP-only same-origin cookie auth without cross-origin CORS/cookie fragility.
- It supports a Next.js plus Postgres architecture.
- It is inexpensive to start and can scale enough for a personal or small-user app.
- It avoids running servers or databases manually.
