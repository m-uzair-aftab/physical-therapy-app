# Physical Therapy Exercise Tracker Spec

## 1. Product Overview

The Physical Therapy Exercise Tracker is a focused web app for logging physical therapy exercises and workouts. The app helps the user start a workout quickly, track exercise values such as weight, reps, and time, and review progress over time.

The app is intended to be a calm, practical rehab/training log. It should prioritize speed during workouts, clear history, and simple progress tracking over social, gamified, or coaching-heavy features.

The design prototype for this product is [Rehab Log (standalone).html](<Rehab Log (standalone).html>). Implementation should use this prototype as the primary reference for visual direction, layout patterns, interaction feel, and screen composition.

If the prototype conflicts with this product spec or the engineering spec, the specs are authoritative. The prototype should not be treated as the source of truth for backend behavior, sample data, local state, hardcoded dates, fake progress series, missing account creation screens, prototype-only category names, or bundled HTML internals.

## 2. Product Goals

- Let the user start a physical therapy workout quickly.
- Let the user choose between predefined workout types.
- Show the last-used values for each exercise.
- Let the user update weight, reps, time, or notes during a workout.
- Let the user mark individual exercises complete.
- Allow exercises to be skipped without penalty.
- Save completed workout exercises to history.
- Show which dates each workout type was completed.
- Show progress over time for each specific exercise.

## 3. Non-Goals for Version 1

- The app will not provide medical advice.
- The app will not prescribe new exercises.
- The app will not include social sharing.
- The app will not include trainer or clinician management.
- The app will not require custom workout programming in the first version.
- The app will not require complex multi-set tracking unless added later.

## 4. Users

### Primary User

An individual doing recurring physical therapy exercises who wants to track whether workouts were completed and how exercise loads, reps, and times change over time.

### User Needs

- Start logging without friction.
- See what was done last time.
- Quickly adjust values during the workout.
- Skip optional exercises.
- Review historical consistency.
- Understand whether specific exercises are progressing.

## 5. Exercise Library

The app ships with two predefined exercise categories.

### 5.1 Functional Gross Motor Movements

| Exercise | Default Tracking | Notes / Cues |
| --- | --- | --- |
| Squat with overhead dumbbell press | 12.5 lb weight | Squat paired with overhead dumbbell press. |
| Medicine ball / dumbbell press-outs | 10 lb weight | Press ball or dumbbell straight out. |
| Walking lunges with trunk rotation and ball press-out | 10 lb weight | Rotate trunk and press ball out during lunges. |
| Pulley lifts | 14 lb weight | Pulley set low. Stand in deep squat, lift up and away, then return. |
| Pulley chops | 20.5 lb weight | Pulley set high. Half-kneel and pull down/across body. |
| Half-kneeling rise to opposite-arm overhead dumbbell raise and single-leg balance | 12.5 lb weight | Weight is held in the opposite hand from the forward leg. As the user rises into single-leg stance, the weight is in the arm on the side where the leg lifts into the air. |
| Farmer's carry at side | 35 lb weight | Track weight only. |
| Farmer's overhead carry | 17.5 lb weight | Track weight only. |

### 5.2 Core / Hip Strengthening

| Exercise | Default Tracking | Notes / Cues |
| --- | --- | --- |
| Lateral band walks or monster walks with ball press-out or overhead press | Reps | Can be performed with ball press-out or ball overhead. |
| Front plank, alternating legs | 60 sec duration | Track total duration. |
| Sidelying hip abduction rainbows | 15 reps each side | Top hip lifts into a rainbow arc forward and back. Keep hip stacked. |
| Single-leg glute bridge hold | 45 sec duration | Track hold time. |
| Back single-leg scissor drop | 15 reps each side | Can add upper body crunch for increased upper abdominal activation. |
| Ball back extension | 30 reps total | Track total reps. |
| Ball side flexion | 10 reps each side | Track reps per side or each-side value. |

## 6. User Flows

### 6.1 Sign In Flow

1. User opens the app.
2. User sees a sign-in screen.
3. User enters email and password.
4. User taps `Sign In`.
5. App authenticates the user.
6. App routes the user to the dashboard.

Version 1 will use real user accounts so workout history can persist across sessions and devices.

Account creation must be available in the app for version 1.

### 6.2 Start Workout Flow

1. User signs in.
2. App opens to the dashboard.
3. User selects a workout type:
   - Functional
   - Core / Hip
4. App opens workout mode for the selected type.
5. App displays all exercises in that category.
6. Each exercise shows:
   - Exercise name
   - Setup or cue notes
   - Last-used values
   - Editable values for today
   - Done control
   - Optional notes field
7. Workout mode includes a workout-level notes field.
8. User updates values as needed.
9. User marks completed exercises done.
10. User taps `Finish Workout`.
11. App saves completed exercises only.
12. App returns user to the dashboard or workout summary.

### 6.3 Workout Mode Flow

Workout mode is the main logging experience. It should be optimized for mobile use and fast entry.

Each exercise appears as a compact exercise panel with:

- Name
- Cues
- Last logged values
- Today's editable values
- Done toggle or button
- Optional notes

Workout mode also includes:

- Workout-level notes
- Completed-exercise progress indicator
- Sticky finish bar
- Cancel workout option

Example:

```text
Pulley Chops
High pulley, half kneel, pull down and across body.

Last time:
20.5 lb · 12 reps each side

Today:
Weight: 20.5 lb
Reps: 12
Side: Each side
Done
```

### 6.4 Finish Workout Flow

1. User taps `Finish Workout`.
2. App checks whether at least one exercise is marked done.
3. If one or more exercises are done, app saves the workout.
4. If no exercises are done, app asks the user to confirm canceling or discarding the workout.
5. App shows a confirmation message.
6. App routes the user to the dashboard or workout detail view.

Fully empty workouts must not be saved.

Saved workout data includes:

- Date and time
- Workout type
- Workout-level notes
- Completed exercise entries
- Weight, reps, duration, side-specific values, and notes where provided

### 6.5 Workout History Flow

1. User opens `History`.
2. App shows previous workouts in reverse chronological order.
3. Each history item shows:
   - Date
   - Workout type
   - Number of completed exercises
4. User taps a workout.
5. App shows workout details:
   - Workout notes
   - Completed exercises
   - Logged values
   - Notes
6. User can edit or delete entries if needed.

### 6.6 Exercise Progress Flow

1. User opens `Progress`.
2. App shows all exercises grouped by type.
3. User selects an exercise.
4. App shows:
   - Exercise name
   - Category
   - Most recent logged value
   - Progress chart
   - Historical table
5. User can review changes in weight, reps, duration, or side-specific values over time.

## 7. Functional Requirements

### 7.1 Authentication

- User can create an account.
- User can sign in.
- User can sign out.
- Workout data is associated with the signed-in user.
- Unauthenticated users cannot access workout history.
- Account-backed storage is required for version 1.

### 7.2 Exercise Library

- App includes predefined exercise categories.
- App includes predefined exercises.
- Each exercise has:
  - ID
  - Name
  - Category
  - Description or cues
  - Default weight, reps, or duration where applicable
  - Measurement fields
  - Sort order

### 7.3 Workout Tracking

- User can start a workout by category.
- User can see all exercises for the selected category.
- User can see last-used values for each exercise.
- User can edit today's values before marking an exercise complete.
- User can mark exercises complete.
- User can skip exercises.
- User can finish a workout.
- App saves completed exercises only.
- App does not save fully empty workouts.
- App stores workout date and type.
- App stores workout-level notes when provided.

### 7.4 History

- User can view previous workouts.
- User can identify workout type by date.
- User can open a workout detail view.
- User can see all completed exercises for a workout.
- User can see the logged values for each completed exercise.

### 7.5 Progress Tracking

- User can select an exercise and view historical entries.
- Each exercise has one primary progress metric.
- The progress chart shows the primary metric associated with the selected exercise.
- App can display progress metrics for:
  - Weight
  - Reps
  - Duration
  - Side-specific reps
  - Side-specific duration
- Weighted exercises show weight progress by default.
- Rep-based exercises show rep progress by default.
- Duration-based exercises show duration progress by default.
- App can show a simple chart and table for each exercise.

### 7.6 Editing and Deleting

Recommended for version 1:

- User can edit a saved workout.
- User can delete a saved workout.
- User can edit a saved exercise entry.
- User can delete a saved exercise entry.
- Deleted workouts are soft-deleted and excluded from normal app views.

This is important because logging during exercise is prone to mistakes.

## 8. Non-Functional Requirements

- Mobile-first responsive design.
- Fast interactions during workout mode.
- Large touch targets.
- Clear typography and contrast.
- Minimal typing.
- Persistent data storage.
- Reliable save behavior.
- Works on phone, tablet, and desktop.
- Interface should be calm, efficient, and uncluttered.
- App should avoid motivational clutter, social mechanics, or decorative noise.

## 9. Information Architecture

Recommended main navigation:

- Today
- History
- Progress
- Settings

### 9.1 Today

Purpose: start workouts quickly.

Content:

- Start Functional workout
- Start Core / Hip workout
- Most recent workout summary
- Optional quick link to last workout

### 9.2 History

Purpose: review completed workouts.

Content:

- Chronological workout list
- Workout type indicators
- Completed exercise count
- Workout detail drill-in

### 9.3 Progress

Purpose: review exercise-specific change over time.

Content:

- Exercise list grouped by workout type
- Exercise detail page
- Chart
- History table

### 9.4 Settings

Purpose: account and app preferences.

Content:

- Profile
- Units
- Sign out

## 10. Screens

### 10.1 Sign In

Contains:

- Email field
- Password field
- Sign in button
- Create account link

### 10.1.1 Create Account

Contains:

- Name field, optional
- Email field
- Password field
- Create account button
- Sign in link

### 10.2 Dashboard / Today

Contains:

- Greeting or current date
- Two workout type actions:
  - Functional
  - Core / Hip
- Recent workout summary
- Navigation to History and Progress

### 10.3 Workout Mode

Contains:

- Workout type title
- Exercise list
- Exercise logging controls
- Workout-level notes
- Completed-exercise progress indicator
- Finish workout button
- Cancel workout option

### 10.4 Workout Summary

Contains:

- Saved confirmation
- Workout type
- Date
- Completed exercises
- Link to details

### 10.5 History

Contains:

- Reverse chronological workout list
- Date
- Workout type
- Completed exercise count

### 10.6 Workout Detail

Contains:

- Workout date
- Workout type
- Workout notes
- Completed exercises
- Logged values
- Edit and delete actions

### 10.7 Progress

Contains:

- Exercise list
- Category filters
- Most recent values

### 10.8 Exercise Progress Detail

Contains:

- Exercise name
- Exercise cues
- Most recent entry
- Progress chart
- Historical table

## 11. Data Model Draft

### 11.1 User

```text
id
email
name
createdAt
updatedAt
```

### 11.2 Exercise

```text
id
name
category
description
defaultWeight
defaultReps
defaultDurationSeconds
measurementTypes
primaryMetric
sideMode
sortOrder
createdAt
updatedAt
```

Possible `category` values:

```text
functional
core_hip
```

Possible `measurementTypes` values:

```text
weight
reps
duration
notes
```

Possible `primaryMetric` values:

```text
weight
reps
duration
```

Possible `sideMode` values:

```text
none
each_side
left_right
```

### 11.3 Workout

```text
id
userId
type
date
notes
deletedAt
createdAt
updatedAt
```

Possible `type` values:

```text
functional
core_hip
```

### 11.4 WorkoutExerciseEntry

```text
id
workoutId
exerciseId
weight
reps
durationSeconds
leftReps
rightReps
leftDurationSeconds
rightDurationSeconds
notes
completed
createdAt
updatedAt
```

## 12. Version 1 Scope

Version 1 should include:

- Sign in
- Create account
- Sign out
- Dashboard / Today screen
- Start Functional workout
- Start Core / Hip workout
- Preloaded exercise library
- Last-used values per exercise
- Workout mode
- Workout-level notes
- Optional exercise completion
- Save completed exercises only
- Prevent fully empty workout saves
- Workout history
- Workout detail
- Exercise progress list
- Exercise progress chart/table
- Edit saved workouts
- Delete saved workouts
- Soft-delete saved workouts

## 13. Future Enhancements

Potential later additions:

- Calendar heatmap.
- Custom exercises.
- Custom workout templates.
- Multi-set tracking.
- Pain, soreness, or difficulty rating.
- Export to CSV.
- Exercise demo images or videos.
- Reminders.
- Clinician share link.
- Progress notes by week.

## 14. Design System

Use [Rehab Log (standalone).html](<Rehab Log (standalone).html>) as the design prototype for version 1. The design system below captures the intended direction, while the prototype should guide concrete layout, spacing, component composition, and interaction patterns.

### 14.0 Design Prototype Guidance

The prototype is authoritative for design direction and interaction inspiration only. If it conflicts with this spec or the engineering spec, the specs win.

Use the prototype as the primary reference for:

- Today screen layout
- Mobile bottom navigation
- Desktop sidebar navigation
- Compact exercise panels
- Numeric stepper controls
- Skip and done states
- Sticky finish bar
- History and detail layouts
- Progress chart and history table presentation
- Calm clinical visual tone

Do not copy prototype-only behavior as product requirements:

- Fake user data
- Local-only state
- Hardcoded dates
- Fake progress series
- Missing register flow
- Prototype category shorthand such as `core`
- Bundled HTML/runtime internals

Canonical product and engineering decisions remain:

- Workout categories are `functional` and `core_hip`.
- The UI label for `core_hip` is `Core / Hip`.
- Account creation is included in the app.
- Empty workouts are not saved.
- Workout-level notes are included from day one.
- Deleted workouts are soft-deleted.
- Weight units are fixed to pounds.
- `each_side` values use one shared input.
- Existing exercise definitions and defaults in this spec remain authoritative over prototype sample defaults.

### 14.1 Visual Direction

The app should feel calm, clean, and useful. It should look like a polished health utility rather than a commercial fitness app.

Design qualities:

- Calm
- Trustworthy
- Mobile-friendly
- Clear
- Efficient
- Lightly clinical
- Personal

Avoid:

- Loud gym branding
- Heavy gradients
- Oversized marketing sections
- Decorative clutter
- Social feed patterns
- Excessive motivational copy

### 14.2 Color Palette

| Token | Value | Usage |
| --- | --- | --- |
| Background | `#F7F8F6` | App background |
| Surface | `#FFFFFF` | Panels and cards |
| Primary | `#256D5A` | Primary actions and active states |
| Primary Hover | `#1F5C4C` | Hover state |
| Accent | `#D98F45` | Highlights and secondary emphasis |
| Text Primary | `#1F2933` | Main text |
| Text Secondary | `#64707D` | Supporting text |
| Border | `#D9DED8` | Dividers and inputs |
| Success | `#2F855A` | Completed state |
| Warning | `#B7791F` | Confirmations or cautions |
| Error | `#C2413D` | Destructive actions and errors |

### 14.3 Typography

Recommended font stack:

```css
font-family: "Hanken Grotesk", Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Suggested type scale:

| Role | Size |
| --- | --- |
| Page title | 28px |
| Section heading | 20px |
| Card title | 16-18px |
| Body | 14-16px |
| Metadata | 13px |
| Button | 14-16px |

### 14.4 Layout

- Use a mobile-first layout.
- Keep primary actions visible and easy to reach.
- Use a constrained content width on desktop.
- Use mobile bottom navigation for the main authenticated app.
- Use desktop sidebar navigation when there is enough horizontal space.
- Use a sticky finish bar in workout mode.
- Avoid deeply nested cards.
- Use clear full-width sections for main pages.
- Use cards only for individual repeated items, workout entries, exercise entries, and modals.

### 14.5 Components

#### Primary Button

Used for:

- Start workout
- Finish workout
- Save changes

#### Secondary Button

Used for:

- Cancel
- Edit
- View detail

#### Icon Button

Used for:

- Edit
- Delete
- Back
- More actions

Icon buttons should include tooltips or accessible labels.

Use accessible icon buttons or lucide icons for real implementation controls. Do not copy the prototype's square marker placeholders literally when a familiar icon communicates the action better.

#### Workout Type Selector

Used on the Today screen.

Options:

- Functional
- Core / Hip

The selector should be visually prominent but not oversized.

#### Exercise Logging Panel

Contains:

- Exercise name
- Description or cue text
- Last-used values
- Today's values
- Done control
- Skip control
- Optional notes

Numeric values should use stepper controls where practical.

Recommended step sizes:

- Weight: `2.5 lb`
- Reps: `1`
- Duration: `5 sec`

Done and skipped states should be visibly distinct and accessible without relying on color alone.

#### Workout Progress Indicator

Workout mode should show the number of completed exercises out of the total exercises for the selected workout type.

#### Sticky Finish Bar

Workout mode should keep the finish action available in a sticky bottom bar, especially on mobile.

#### Confirmation Modal

Use confirmation modals for:

- Canceling or discarding a workout with no completed exercises
- Deleting a workout

#### History List Item

Contains:

- Date
- Workout type
- Completed exercise count
- Open detail affordance

#### Progress Chart

Use a simple line chart. The chart should prioritize readability over complexity.

Each exercise has one primary progress metric, and the chart should show that metric by default.

Chart types:

- Weight over time for weighted exercises
- Reps over time for rep-based exercises
- Duration over time for duration-based exercises

#### Empty States

Empty states should be brief and useful.

Examples:

- `No workouts yet. Start a workout from Today.`
- `No entries for this exercise yet.`

## 15. Recommended MVP Decisions

The version 1 decisions are:

- Use real sign-in with account-backed data storage.
- Track one logged value per exercise per workout, not multiple sets.
- Show the full exercise list for the selected workout type.
- Save only exercises marked complete.
- For carries, track weight only.
- Show the primary metric for each exercise on its progress chart.
- Use a simple list for workout history in version 1.
- Include editing and deleting because workout logging mistakes are likely.

## 16. Resolved Product Decisions

The following decisions are confirmed for version 1:

1. Exercises track one logged value per workout.
2. The app does not support multiple sets in version 1.
3. Carries track weight only.
4. Progress charts show each exercise's primary metric.
5. Workout history uses a simple list in version 1.
6. Account creation is included in the app.
7. Fully empty workouts are not saved.
8. Weight units are fixed to pounds.
9. `each_side` values use one shared input.
10. Workout-level notes are shown in the UI from day one.
11. Deleted workouts are soft-deleted.
12. The product and engineering specs override the design prototype when conflicts exist.
