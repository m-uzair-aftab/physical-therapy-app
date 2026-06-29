const app = document.getElementById("app");

const state = {
  user: null,
  route: window.location.pathname,
  loading: true,
  error: "",
  data: {},
  draft: null,
  modal: null,
};

const CATEGORY_LABELS = {
  functional: "Functional",
  core_hip: "Core / Hip",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, withTime = false) {
  if (!value) return "";
  const date = new Date(value);
  const options = withTime
    ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { weekday: "long", month: "long", day: "numeric" };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

function firstName() {
  const name = String(state.user?.name || "").trim();
  if (!name) return "there";
  return name.split(/\s+/)[0];
}

function greetingTitle() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${greeting}, ${firstName()}`;
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function categoryClass(category) {
  return category === "core_hip" ? "core" : "";
}

function routeInfo(pathname = state.route) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { name: "root" };
  if (segments[0] === "sign-in") return { name: "sign-in" };
  if (segments[0] === "register") return { name: "register" };
  if (segments[0] === "today") return { name: "today" };
  if (segments[0] === "history" && segments[1] && segments[2] === "edit") return { name: "workout-edit", id: segments[1] };
  if (segments[0] === "history" && segments[1]) return { name: "workout-detail", id: segments[1] };
  if (segments[0] === "history") return { name: "history" };
  if (segments[0] === "progress" && segments[1]) return { name: "progress-detail", id: segments[1] };
  if (segments[0] === "progress") return { name: "progress" };
  if (segments[0] === "settings") return { name: "settings" };
  if (segments[0] === "workouts" && segments[1] === "new") return { name: "workout-new", type: segments[2] };
  if (segments[0] === "workouts" && segments[2] === "summary") return { name: "summary", id: segments[1] };
  return { name: "not-found" };
}

function isPublicRoute(info = routeInfo()) {
  return info.name === "sign-in" || info.name === "register";
}

function navigate(path) {
  if (window.location.pathname !== path) {
    history.pushState(null, "", path);
  }
  state.route = path;
  state.error = "";
  void loadRoute();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Something went wrong.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadMe() {
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
  } catch {
    state.user = null;
  }
}

async function loadRoute() {
  const info = routeInfo();
  state.loading = true;
  render();

  if (info.name === "root") {
    navigate(state.user ? "/today" : "/sign-in");
    return;
  }

  if (!state.user && !isPublicRoute(info)) {
    navigate("/sign-in");
    return;
  }

  if (state.user && isPublicRoute(info)) {
    navigate("/today");
    return;
  }

  try {
    state.data = {};
    if (info.name === "today") {
      state.data.workouts = (await api("/api/workouts?limit=1")).workouts;
    } else if (info.name === "history") {
      state.data.workouts = (await api("/api/workouts?limit=50")).workouts;
    } else if (info.name === "workout-detail" || info.name === "summary") {
      state.data.workout = (await api(`/api/workouts/${info.id}`)).workout;
    } else if (info.name === "progress") {
      state.data.exercises = (await api("/api/progress/exercises")).exercises;
    } else if (info.name === "progress-detail") {
      state.data.progress = await api(`/api/progress/exercises/${info.id}`);
    } else if (info.name === "workout-new") {
      await startDraft(info.type);
    } else if (info.name === "workout-edit") {
      await startEditDraft(info.id);
    }
  } catch (error) {
    if (error.status === 401) {
      state.user = null;
      navigate("/sign-in");
      return;
    }
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function startDraft(type) {
  if (!CATEGORY_LABELS[type]) {
    state.error = "Invalid workout type.";
    return;
  }
  const data = await api(`/api/workouts/start-data?type=${encodeURIComponent(type)}`);
  const entries = {};
  for (const item of data.exercises) {
    const exercise = item.exercise;
    const last = item.lastEntry;
    entries[exercise.id] = {
      exerciseId: exercise.id,
      done: false,
      skipped: false,
      weight: last?.weight ?? exercise.defaultWeight,
      reps: last?.reps ?? exercise.defaultReps,
      durationSeconds: last?.durationSeconds ?? exercise.defaultDurationSeconds,
      notes: "",
      showNote: false,
    };
  }
  state.draft = {
    mode: "create",
    type,
    typeLabel: data.typeLabel,
    exercises: data.exercises,
    entries,
    notes: "",
    error: "",
  };
}

async function startEditDraft(id) {
  const detail = (await api(`/api/workouts/${id}`)).workout;
  const startData = await api(`/api/workouts/start-data?type=${encodeURIComponent(detail.type)}`);
  const savedEntries = new Map(detail.entries.map((entry) => [entry.exerciseId, entry]));
  const entries = {};
  for (const item of startData.exercises) {
    const exercise = item.exercise;
    const saved = savedEntries.get(exercise.id);
    entries[exercise.id] = {
      exerciseId: exercise.id,
      done: Boolean(saved),
      skipped: false,
      weight: saved?.weight ?? item.lastEntry?.weight ?? exercise.defaultWeight,
      reps: saved?.reps ?? item.lastEntry?.reps ?? exercise.defaultReps,
      durationSeconds: saved?.durationSeconds ?? item.lastEntry?.durationSeconds ?? exercise.defaultDurationSeconds,
      notes: saved?.notes || "",
      showNote: Boolean(saved?.notes),
    };
  }
  state.draft = {
    mode: "edit",
    workoutId: id,
    type: detail.type,
    typeLabel: detail.typeLabel,
    exercises: startData.exercises,
    entries,
    notes: detail.notes || "",
    error: "",
  };
}

function authShell(mode) {
  const isRegister = mode === "register";
  return `
    <div class="auth-wrap">
      <section class="auth-card" aria-labelledby="auth-title">
        <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>Rehab Log</span></div>
        <h1 class="auth-title" id="auth-title">${isRegister ? "Create account" : "Welcome back"}</h1>
        <p class="subtle">${isRegister ? "Set up your private therapy log." : "Sign in to continue your therapy log."}</p>
        <form class="form" data-auth-form="${mode}">
          ${isRegister ? formField("name", "Name", "text", "Optional", "") : ""}
          ${formField("email", "Email", "email", "you@example.com", "email")}
          ${formField("password", "Password", "password", "At least 8 characters", "current-password")}
          <div class="error-text" data-form-error>${escapeHtml(state.error)}</div>
          <button class="button primary full" type="submit">${isRegister ? "Create Account" : "Sign In"}</button>
        </form>
        <p class="subtle">
          ${isRegister ? "Already have an account?" : "New here?"}
          <button class="button linkish" data-nav="${isRegister ? "/sign-in" : "/register"}">${isRegister ? "Sign in" : "Create an account"}</button>
        </p>
      </section>
    </div>
  `;
}

function formField(name, label, type, placeholder, autocomplete) {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input class="input" id="${name}" name="${name}" type="${type}" placeholder="${placeholder}" autocomplete="${autocomplete}">
    </div>
  `;
}

function appShell(inner, active = routeInfo().name) {
  const isWorkout = active === "workout-new" || active === "workout-edit";
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>Rehab Log</span></div>
        <nav class="side-nav" aria-label="Main navigation">${navButtons(active)}</nav>
        <div class="sidebar-foot">
          <div class="row-title">${escapeHtml(state.user?.name || "Account")}</div>
          <div class="row-meta">${escapeHtml(state.user?.email || "")}</div>
        </div>
      </aside>
      <header class="mobile-header">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="mobile-header-title">${mobileTitle(active)}</span>
      </header>
      <main class="main ${isWorkout ? "workout-main" : ""}">
        <div class="content">
          ${state.error ? `<div class="error-text">${escapeHtml(state.error)}</div>` : ""}
          ${state.loading ? `<div class="empty card">Loading...</div>` : inner}
        </div>
      </main>
      <nav class="bottom-nav" aria-label="Main navigation">${navButtons(active)}</nav>
      ${modalHtml()}
    </div>
  `;
}

function navButtons(active) {
  const map = [
    ["today", "/today", "Today"],
    ["history", "/history", "History"],
    ["progress", "/progress", "Progress"],
    ["settings", "/settings", "Settings"],
  ];
  const normalized = active.startsWith("workout") || active === "summary" ? "today" : active.startsWith("progress") ? "progress" : active;
  return map
    .map(
      ([name, path, label]) => `
        <button class="nav-button ${normalized === name ? "active" : ""}" data-nav="${path}" aria-label="${label}">
          <span class="nav-icon" aria-hidden="true"></span>
          <span>${label}</span>
        </button>
      `,
    )
    .join("");
}

function mobileTitle(active) {
  if (active === "history" || active === "workout-detail" || active === "workout-edit") return "History";
  if (active === "progress" || active === "progress-detail") return "Progress";
  if (active === "settings") return "Settings";
  if (active === "summary") return "Saved";
  if (active === "workout-new") return state.draft?.typeLabel || "Workout";
  return "Today";
}

function todayScreen() {
  const recent = state.data.workouts?.[0];
  return appShell(`
    <div class="page-kicker">${todayLabel()}</div>
    <h1 class="page-title">${escapeHtml(greetingTitle())}</h1>
    <p class="page-sub">Pick a session to start logging.</p>
    <div class="grid-two">
      ${workoutTypeCard("functional", "Gross motor movements", "8 exercises")}
      ${workoutTypeCard("core_hip", "Strengthening", "7 exercises")}
    </div>
    <h2 class="section-title">Recent</h2>
    ${
      recent
        ? workoutListItem(recent)
        : `<div class="empty card">No workouts yet. Start a workout from Today.</div>`
    }
  `, "today");
}

function workoutTypeCard(type, subtitle, count) {
  return `
    <button class="card type-card ${categoryClass(type)}" data-nav="/workouts/new/${type}">
      <span class="type-icon" aria-hidden="true"></span>
      <span class="type-name">${categoryLabel(type)}</span>
      <span class="type-meta">${subtitle} &middot; ${count}</span>
    </button>
  `;
}

function historyScreen() {
  const workouts = state.data.workouts || [];
  return appShell(`
    <h1 class="page-title">History</h1>
    <p class="page-sub">Your completed sessions, most recent first.</p>
    ${
      workouts.length
        ? `<div class="list">${workouts.map(workoutListItem).join("")}</div>`
        : `<div class="empty card">No workouts yet. Start a workout from Today.</div>`
    }
  `, "history");
}

function workoutListItem(workout) {
  return `
    <button class="card list-card" data-nav="/history/${workout.id}">
      <span class="row-left">
        <span class="badge ${categoryClass(workout.type)}">${escapeHtml(workout.typeLabel || categoryLabel(workout.type))}</span>
        <span>
          <span class="row-title">${formatDate(workout.performedAt, true)}</span>
          <span class="row-meta">${workout.completedExerciseCount} exercises completed</span>
        </span>
      </span>
      <span class="chevron" aria-hidden="true">&rsaquo;</span>
    </button>
  `;
}

function progressListItem(exercise) {
  return `
    <button class="card list-card progress-item" data-nav="/progress/${exercise.id}">
      <span class="row-left">
        <span class="spark" aria-hidden="true"></span>
        <span>
          <span class="row-title">${escapeHtml(exercise.name)}</span>
          <span class="row-meta">${metricLabel(exercise.primaryMetric)}</span>
        </span>
      </span>
      <span class="progress-right">
        <span class="progress-value">${escapeHtml(exercise.mostRecentEntry?.label || "No entries")}</span>
        <span class="chevron" aria-hidden="true">&rsaquo;</span>
      </span>
    </button>
  `;
}

function detailEntryRow(entry) {
  return `
    <section class="card detail-entry">
      <div class="detail-entry-top">
        <div class="detail-name">${escapeHtml(entry.exerciseName)}</div>
      </div>
      <div class="detail-value">${escapeHtml(entry.valueLabel)}</div>
      ${entry.notes ? `<div class="note">&ldquo;${escapeHtml(entry.notes)}&rdquo;</div>` : ""}
    </section>
  `;
}

function summaryEntryRow(entry) {
  return `
    <div class="summary-row">
      <span class="summary-name">${escapeHtml(entry.exerciseName)}</span>
      <span class="summary-val">${escapeHtml(entry.valueLabel)}</span>
    </div>
  `;
}

function workoutNotesRow(notes) {
  return `
    <section class="card detail-entry">
      <div class="detail-name">Workout notes</div>
      <div class="detail-value">${escapeHtml(notes)}</div>
    </section>
  `;
}

function metricUnit(metric) {
  if (metric === "weight") return "lb";
  if (metric === "duration") return "sec";
  return "reps";
}

function metricDeltaLabel(points, metric) {
  if (!points || points.length < 2) return "";
  const first = Number(points[0].value);
  const last = Number(points[points.length - 1].value);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return "";
  const delta = Math.round((last - first) * 10) / 10;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${trimNumber(delta)} ${metricUnit(metric)} since ${formatDate(points[0].performedAt)}`;
}

function metricParts(label, metric) {
  if (!label || label === "No entries") return { value: "No entries", unit: "" };
  const unit = metricUnit(metric);
  return { value: label.replace(` ${unit}`, ""), unit };
}

function compactDateRange(points) {
  if (!points || points.length < 2) return "";
  return `${formatDate(points[0].performedAt)} to ${formatDate(points[points.length - 1].performedAt)}`;
}

function progressRows(entries) {
  return `
    <div class="card table-card">
      ${entries
        .map(
          (entry) => `
            <div class="table-row">
              <span class="table-date">${formatDate(entry.performedAt, true)}</span>
              <span class="table-val">${escapeHtml(entry.valueLabel)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function workoutScreen() {
  const draft = state.draft;
  if (!draft) return appShell(`<div class="empty card">Workout draft unavailable.</div>`, "workout-new");
  const doneCount = Object.values(draft.entries).filter((entry) => entry.done).length;
  const total = draft.exercises.length;
  return appShell(`
    <div class="workout-wrap">
      <div class="workout-content">
        <div class="workout-head">
          <div>
            <div class="workout-kicker">${escapeHtml(draft.typeLabel)}</div>
            <h1 class="workout-title">Workout</h1>
          </div>
          <button class="workout-cancel" data-action="cancel-workout">Cancel</button>
        </div>
        <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${total ? (doneCount / total) * 100 : 0}%"></div></div>
        <p class="workout-progress-text">${doneCount} of ${total} marked done</p>
        <div class="workout-list">${draft.exercises.map(exercisePanel).join("")}</div>
      </div>
      <div class="finish-bar">
        <div class="finish-inner">
          <span class="finish-count">${doneCount} of ${total} marked done</span>
          <button class="button primary" data-action="finish-workout">${draft.mode === "edit" ? "Save Changes" : "Finish Workout"}</button>
        </div>
        <div class="error-text">${escapeHtml(draft.error || "")}</div>
      </div>
    </div>
  `, draft.mode === "edit" ? "workout-edit" : "workout-new");
}

function exercisePanel(item) {
  const exercise = item.exercise;
  const entry = state.draft.entries[exercise.id];
  const fields = [];
  if (exercise.measurementTypes.includes("weight")) fields.push(stepper(exercise.id, "weight", "Weight", entry.weight, "lb", 2.5));
  if (exercise.measurementTypes.includes("reps")) {
    fields.push(stepper(exercise.id, "reps", exercise.sideMode === "each_side" ? "Reps / side" : "Reps", entry.reps, "", 1));
  }
  if (exercise.measurementTypes.includes("duration")) {
    fields.push(stepper(exercise.id, "durationSeconds", exercise.sideMode === "each_side" ? "Seconds / side" : "Seconds", entry.durationSeconds, "sec", 5));
  }
  return `
    <section class="card exercise-panel ${entry.done ? "done" : ""} ${entry.skipped ? "skipped" : ""}" data-exercise-id="${exercise.id}">
      <div class="exercise-top">
        <div>
          <div class="exercise-name">${escapeHtml(exercise.name)}</div>
          <div class="exercise-cues">${escapeHtml(exercise.description)}</div>
        </div>
        ${entry.done ? `<span class="check-pill" aria-label="Done">&#10003;</span>` : ""}
      </div>
      <div class="last-line">${lastLine(item)}</div>
      <div class="field-grid">${fields.join("")}</div>
      ${
        entry.showNote
          ? `<textarea class="textarea note-area" id="notes-${exercise.id}" data-entry-field="notes" rows="2" maxlength="1000" placeholder="Add a note for this exercise...">${escapeHtml(entry.notes || "")}</textarea>`
          : ""
      }
      <div class="panel-actions">
        <button class="button primary done-button ${entry.done ? "active" : ""}" data-action="toggle-done">${entry.done ? "&#10003; Done" : "Mark done"}</button>
        <button class="button secondary skip-button ${entry.skipped ? "active" : ""}" data-action="toggle-skip">${entry.skipped ? "Skipped" : "Skip"}</button>
        <button class="note-toggle" data-action="toggle-note">${entry.showNote ? "Hide note" : "+ Note"}</button>
      </div>
    </section>
  `;
}

function lastLine(item) {
  const entry = item.lastEntry;
  if (!entry) return "Last time &middot; no saved entry";
  const parts = [];
  if (entry.weight !== null && entry.weight !== undefined) parts.push(`${trimNumber(entry.weight)} lb`);
  if (entry.reps !== null && entry.reps !== undefined) parts.push(`${entry.reps} reps${item.exercise.sideMode === "each_side" ? " each side" : ""}`);
  if (entry.durationSeconds !== null && entry.durationSeconds !== undefined) {
    parts.push(`${entry.durationSeconds} sec${item.exercise.sideMode === "each_side" ? " each side" : ""}`);
  }
  return `Last time &middot; ${parts.join(" &middot; ") || "note only"}`;
}

function stepper(exerciseId, field, label, value, unit, step) {
  const safeValue = value ?? "";
  return `
    <div class="field">
      <span class="field-label">${label}</span>
      <div class="stepper" data-exercise-id="${exerciseId}" data-field="${field}" data-step="${step}">
        <button type="button" data-action="step-down" aria-label="Decrease ${label}">&minus;</button>
        <span class="stepper-value">
          <input class="input" inputmode="decimal" data-entry-field="${field}" value="${escapeHtml(safeValue)}" aria-label="${label}${unit ? ` in ${unit}` : ""}">
          ${unit ? `<span aria-hidden="true">${unit}</span>` : ""}
        </span>
        <button type="button" data-action="step-up" aria-label="Increase ${label}">+</button>
      </div>
    </div>
  `;
}

function summaryScreen() {
  const workout = state.data.workout;
  if (!workout) return appShell(`<div class="empty card">Saved workout not found.</div>`, "summary");
  return appShell(`
    <div class="summary-check">&#10003;</div>
    <h1 class="summary-title">Workout saved</h1>
    <p class="page-sub">${escapeHtml(workout.typeLabel)} &middot; ${formatDate(workout.performedAt, true)}</p>
    <div class="summary-card card">
      <div class="summary-card-head">${workout.entries.length} exercises completed</div>
      ${workout.entries.map(summaryEntryRow).join("")}
    </div>
    <div class="summary-actions">
      <button class="button primary" data-nav="/today">Back to Today</button>
      <button class="button secondary" data-nav="/history/${workout.id}">View details</button>
    </div>
  `, "summary");
}

function detailScreen() {
  const workout = state.data.workout;
  if (!workout) return appShell(`<div class="empty card">Workout not found.</div>`, "workout-detail");
  return appShell(`
    <button class="button ghost back-button" data-nav="/history">&lsaquo; History</button>
    <div class="detail-head">
      <div>
        <span class="badge ${categoryClass(workout.type)}">${escapeHtml(workout.typeLabel)}</span>
        <h1 class="detail-date">${formatDate(workout.performedAt, true)}</h1>
      </div>
      <button class="edit-toggle" data-nav="/history/${workout.id}/edit">Edit</button>
    </div>
    <div class="detail-list">
      ${workout.notes ? workoutNotesRow(workout.notes) : ""}
      ${workout.entries.map(detailEntryRow).join("")}
    </div>
    <button class="delete-workout-button" data-action="ask-delete" data-workout-id="${workout.id}">Delete workout</button>
  `, "workout-detail");
}

function entryRow(entry) {
  return `
    <section class="card entry-card">
      <div class="row-title">${escapeHtml(entry.exerciseName)}</div>
      <div class="entry-value">${escapeHtml(entry.valueLabel)}</div>
      ${entry.notes ? `<div class="note">${escapeHtml(entry.notes)}</div>` : ""}
    </section>
  `;
}

function progressScreen() {
  const exercises = state.data.exercises || [];
  const groups = ["functional", "core_hip"].map((category) => ({
    category,
    exercises: exercises.filter((exercise) => exercise.category === category),
  }));
  return appShell(`
    <h1 class="page-title">Progress</h1>
    <p class="page-sub">Select an exercise to review its primary metric over time.</p>
    ${groups
      .map(
        (group) => `
          <div class="progress-group">
            <h2 class="section-title">${categoryLabel(group.category)}</h2>
            <div class="list">${group.exercises.map(progressListItem).join("")}</div>
          </div>
        `,
      )
      .join("")}
  `, "progress");
}

function progressItem(exercise) {
  return `
    <button class="card list-card" data-nav="/progress/${exercise.id}">
      <span class="row-left">
        <span class="badge ${categoryClass(exercise.category)}" aria-hidden="true"></span>
        <span>
          <span class="row-title">${escapeHtml(exercise.name)}</span>
          <span class="row-meta">${metricLabel(exercise.primaryMetric)}</span>
        </span>
      </span>
      <span class="meta">${escapeHtml(exercise.mostRecentEntry?.label || "No entries")}</span>
    </button>
  `;
}

function progressDetailScreen() {
  const progress = state.data.progress;
  if (!progress) return appShell(`<div class="empty card">Exercise not found.</div>`, "progress-detail");
  const { exercise, summary, points, entries } = progress;
  const current = metricParts(summary.mostRecentLabel, exercise.primaryMetric);
  const delta = metricDeltaLabel(points, exercise.primaryMetric);
  return appShell(`
    <button class="button ghost back-button" data-nav="/progress">&lsaquo; Progress</button>
    <span class="badge ${categoryClass(exercise.category)}">${escapeHtml(exercise.categoryLabel)}</span>
    <h1 class="prog-detail-name">${escapeHtml(exercise.name)}</h1>
    <p class="exercise-cues">${escapeHtml(exercise.description)}</p>
    <div class="big-value-row">
      <span class="big-value">${escapeHtml(current.value)}</span>
      ${current.unit ? `<span class="big-value-unit">${escapeHtml(current.unit)}</span>` : ""}
      ${delta ? `<span class="big-value-tag">${escapeHtml(delta)}</span>` : ""}
    </div>
    ${
      points.length >= 2
        ? `<div class="card chart-card">
            <div class="chart-label">${metricLabel(exercise.primaryMetric)} over time</div>
            ${chartSvg(points, exercise.primaryMetric)}
            <div class="chart-axis">${compactDateRange(points)}</div>
          </div>`
        : `<div class="empty card">No chart yet. Log this exercise at least twice to see a line.</div>`
    }
    <h2 class="section-title">History</h2>
    ${
      entries.length
        ? progressRows(entries)
        : `<div class="empty card">No entries for this exercise yet.</div>`
    }
  `, "progress-detail");
}

function chartSvg(points, metric) {
  const width = 680;
  const height = 240;
  const pad = 34;
  const values = points.map((point) => Number(point.value));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  min -= range * 0.12;
  max += range * 0.12;
  const x = (index) => pad + ((width - pad * 2) * index) / (points.length - 1);
  const y = (value) => height - pad - ((height - pad * 2) * (value - min)) / (max - min);
  const coords = points.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const circles = points
    .map(
      (point, index) =>
        `<circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="${index === points.length - 1 ? 5 : 4}" fill="#fff" stroke="#256d5a" stroke-width="3"><title>${formatDate(point.performedAt)}: ${point.value}</title></circle>`,
    )
    .join("");
  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${metricLabel(metric)} progress chart">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#d9ded8"></line>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#d9ded8"></line>
      <polyline points="${coords}" fill="none" stroke="#256d5a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${circles}
    </svg>
  `;
}

function table(entries) {
  return `
    <div class="card">
      <table class="table">
        <thead><tr><th>Date</th><th>Values</th><th>Notes</th></tr></thead>
        <tbody>
          ${entries
            .map(
              (entry) => `
                <tr>
                  <td>${formatDate(entry.performedAt, true)}</td>
                  <td>${escapeHtml(entry.valueLabel)}</td>
                  <td>${escapeHtml(entry.notes || "")}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function settingsScreen() {
  return appShell(`
    <h1 class="page-title">Settings</h1>
    <p class="page-sub">Account and preferences.</p>
    <h2 class="section-title">Profile</h2>
    <div class="card settings-card">
      <div class="setting-row"><span class="setting-label">Name</span><strong>${escapeHtml(state.user?.name || "Not set")}</strong></div>
      <div class="setting-row"><span class="setting-label">Email</span><strong>${escapeHtml(state.user?.email || "")}</strong></div>
    </div>
    <h2 class="section-title">Preferences</h2>
    <div class="card settings-card">
      <div class="setting-row"><span class="setting-label">Units</span><strong>Pounds (lb)</strong></div>
    </div>
    <button class="signout-button" data-action="sign-out">Sign out</button>
  `, "settings");
}

function notFoundScreen() {
  return appShell(`
    <h1 class="page-title">Not found</h1>
    <p class="page-sub">That page is not available.</p>
    <button class="button primary" data-nav="/today">Today</button>
  `);
}

function modalHtml() {
  if (!state.modal) return "";
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <section class="modal">
        <h2 class="modal-title" id="modal-title">${escapeHtml(state.modal.title)}</h2>
        <p class="subtle">${escapeHtml(state.modal.message)}</p>
        <div class="modal-actions">
          ${state.modal.cancel ? `<button class="button secondary" data-modal-action="cancel">${escapeHtml(state.modal.cancel)}</button>` : ""}
          <button class="button ${state.modal.danger ? "danger" : "primary"}" data-modal-action="confirm">${escapeHtml(state.modal.confirm)}</button>
        </div>
      </section>
    </div>
  `;
}

function render() {
  const info = routeInfo();
  if (info.name === "sign-in") {
    app.innerHTML = authShell("sign-in");
  } else if (info.name === "register") {
    app.innerHTML = authShell("register");
  } else if (!state.user && !state.loading) {
    app.innerHTML = authShell("sign-in");
  } else if (info.name === "today" || info.name === "root") {
    app.innerHTML = todayScreen();
  } else if (info.name === "history") {
    app.innerHTML = historyScreen();
  } else if (info.name === "workout-new" || info.name === "workout-edit") {
    app.innerHTML = workoutScreen();
  } else if (info.name === "summary") {
    app.innerHTML = summaryScreen();
  } else if (info.name === "workout-detail") {
    app.innerHTML = detailScreen();
  } else if (info.name === "progress") {
    app.innerHTML = progressScreen();
  } else if (info.name === "progress-detail") {
    app.innerHTML = progressDetailScreen();
  } else if (info.name === "settings") {
    app.innerHTML = settingsScreen();
  } else {
    app.innerHTML = notFoundScreen();
  }
}

function metricLabel(metric) {
  if (metric === "weight") return "Weight";
  if (metric === "duration") return "Duration";
  return "Reps";
}

function trimNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}

function collectWorkoutEntries() {
  const entries = [];
  for (const item of state.draft.exercises) {
    const exercise = item.exercise;
    const entry = state.draft.entries[exercise.id];
    if (!entry.done || entry.skipped) continue;
    entries.push({
      exerciseId: exercise.id,
      weight: numberOrNull(entry.weight, false),
      reps: numberOrNull(entry.reps, true),
      durationSeconds: numberOrNull(entry.durationSeconds, true),
      leftReps: null,
      rightReps: null,
      leftDurationSeconds: null,
      rightDurationSeconds: null,
      notes: entry.notes || "",
    });
  }
  return entries;
}

function numberOrNull(value, integer) {
  if (value === "" || value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return integer ? Math.round(number) : Math.round(number * 10) / 10;
}

async function finishWorkout() {
  const entries = collectWorkoutEntries();
  if (entries.length === 0) {
    state.modal = {
      title: "No exercises marked done",
      message: "Empty workouts are not saved. You can discard this workout and return to Today.",
      confirm: "Discard",
      cancel: "Keep Logging",
      onConfirm: () => {
        state.modal = null;
        navigate("/today");
      },
    };
    render();
    return;
  }

  const payload = {
    type: state.draft.type,
    performedAt: new Date().toISOString(),
    notes: state.draft.notes || "",
    entries,
  };

  try {
    state.draft.error = "";
    let saved;
    if (state.draft.mode === "edit") {
      saved = await api(`/api/workouts/${state.draft.workoutId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      navigate(`/history/${saved.workout.id}`);
    } else {
      saved = await api("/api/workouts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      navigate(`/workouts/${saved.workout.id}/summary`);
    }
  } catch (error) {
    state.draft.error = error.message;
    render();
  }
}

function setDraftValue(target) {
  if (!state.draft) return;
  if (target.dataset.draftField === "notes") {
    state.draft.notes = target.value;
    return;
  }
  const panel = target.closest("[data-exercise-id]");
  if (!panel) return;
  const entry = state.draft.entries[panel.dataset.exerciseId];
  if (!entry) return;
  const field = target.dataset.entryField;
  entry[field] = target.value;
}

function stepValue(button, direction) {
  const stepperEl = button.closest(".stepper");
  if (!stepperEl) return;
  const entry = state.draft.entries[stepperEl.dataset.exerciseId];
  const field = stepperEl.dataset.field;
  const step = Number(stepperEl.dataset.step || 1);
  const current = Number(entry[field] || 0);
  const next = Math.max(0, Math.round((current + step * direction) * 10) / 10);
  entry[field] = next;
  render();
}

function toggleExercise(button, action) {
  const panel = button.closest("[data-exercise-id]");
  if (!panel) return;
  const entry = state.draft.entries[panel.dataset.exerciseId];
  if (!entry) return;
  if (action === "toggle-done") {
    entry.done = !entry.done;
    if (entry.done) entry.skipped = false;
  }
  if (action === "toggle-skip") {
    entry.skipped = !entry.skipped;
    if (entry.skipped) entry.done = false;
  }
  if (action === "toggle-note") {
    entry.showNote = !entry.showNote;
  }
  render();
}

function cancelWorkout() {
  state.modal = {
    title: "Cancel workout?",
    message: "Unsaved workout changes will be discarded.",
    confirm: "Discard",
    cancel: "Keep Logging",
    danger: true,
    onConfirm: () => {
      state.modal = null;
      navigate("/today");
    },
  };
  render();
}

async function deleteWorkout(id) {
  try {
    await api(`/api/workouts/${id}`, { method: "DELETE" });
    state.modal = null;
    navigate("/history");
  } catch (error) {
    state.error = error.message;
    state.modal = null;
    render();
  }
}

async function signOut() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => null);
  state.user = null;
  navigate("/sign-in");
}

app.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    navigate(nav.dataset.nav);
    return;
  }

  const modalButton = event.target.closest("[data-modal-action]");
  if (modalButton) {
    const modal = state.modal;
    if (!modal) return;
    if (modalButton.dataset.modalAction === "cancel") {
      state.modal = null;
      render();
    } else if (typeof modal.onConfirm === "function") {
      modal.onConfirm();
    }
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "step-up") stepValue(actionButton, 1);
  if (action === "step-down") stepValue(actionButton, -1);
  if (action === "toggle-done" || action === "toggle-skip" || action === "toggle-note") toggleExercise(actionButton, action);
  if (action === "finish-workout") void finishWorkout();
  if (action === "cancel-workout") cancelWorkout();
  if (action === "sign-out") void signOut();
  if (action === "ask-delete") {
    const id = actionButton.dataset.workoutId;
    state.modal = {
      title: "Delete workout?",
      message: "This workout will be removed from history and progress.",
      confirm: "Delete",
      cancel: "Cancel",
      danger: true,
      onConfirm: () => void deleteWorkout(id),
    };
    render();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-draft-field], [data-entry-field]")) setDraftValue(target);
});

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-auth-form]");
  if (!form) return;
  event.preventDefault();
  state.error = "";
  const formData = new FormData(form);
  const mode = form.dataset.authForm;
  const payload = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  if (mode === "register") payload.name = formData.get("name");

  try {
    const data = await api(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.user = data.user;
    navigate("/today");
  } catch (error) {
    state.error = error.message;
    render();
  }
});

window.addEventListener("popstate", () => {
  state.route = window.location.pathname;
  void loadRoute();
});

await loadMe();
state.route = window.location.pathname;
state.loading = false;
await loadRoute();
