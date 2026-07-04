const app = document.getElementById("app");

const state = {
  user: null,
  route: window.location.pathname,
  loading: true,
  error: "",
  data: {},
  draft: null,
  modal: null,
  pendingAction: null,
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

function isPending(action) {
  return state.pendingAction === action;
}

function isAnyPending() {
  return Boolean(state.pendingAction);
}

function disabledAttr(disabled = isAnyPending()) {
  return disabled ? "disabled" : "";
}

function loadingButtonContent(label, pendingLabel, pending = false) {
  if (!pending) return escapeHtml(label);
  return `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(pendingLabel)}</span>`;
}

function loadingCard(label = "Loading...") {
  return `
    <div class="empty card loading-card" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
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

function appMarkIcon() {
  return `
    <svg class="app-mark-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 14h4l2.5-7 4 13 2.5-9 1.5 3H22"></path>
    </svg>
  `;
}

function navIcon(name) {
  const icons = {
    today: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5"></rect>
        <path d="M3.5 9.5h17M8 3v3M16 3v3"></path>
        <circle cx="12" cy="14.5" r="1.5"></circle>
      </svg>
    `,
    history: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5"></circle>
        <path d="M12 7.5V12l3.2 2"></path>
      </svg>
    `,
    progress: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 4v16h16"></path>
        <path d="M7.5 14l3-3 2.5 2 4-6"></path>
      </svg>
    `,
    settings: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"></path>
        <circle cx="9" cy="7" r="2.3"></circle>
        <circle cx="16" cy="12" r="2.3"></circle>
        <circle cx="12" cy="17" r="2.3"></circle>
      </svg>
    `,
  };
  return icons[name] || "";
}

function workoutTypeIcon(type) {
  if (type === "core_hip") {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 17a9 9 0 0 1 18 0"></path>
        <path d="M3 16.5v2.5M21 16.5v2.5"></path>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9.5v5M6.5 7v10M6.5 12h11M17.5 7v10M21 9.5v5"></path>
    </svg>
  `;
}

const EXERCISE_VISUAL_IDS = {
  squat_overhead_db_press: "f1",
  press_outs: "f2",
  walking_lunges_trunk_rotation_press_out: "f3",
  pulley_lifts: "f4",
  pulley_chops: "f5",
  half_kneeling_rise_overhead_raise_balance: "f6",
  farmers_carry_side: "f7",
  farmers_overhead_carry: "f8",
  lateral_band_monster_walks_press: "c1",
  front_plank_alternating_legs: "c2",
  sidelying_hip_abduction_rainbows: "c3",
  bent_knee_sit_up: "c4",
  single_leg_glute_bridge_hold: "c5",
  back_single_leg_scissor_drop: "c6",
  ball_back_extension: "c7",
  ball_side_flexion: "c8",
};

const NO_FEET_VISUALS = new Set(["f1", "f2", "f3", "f4", "f6", "f7", "f8", "c1", "c4", "c6"]);

const EXERCISE_POSES = {
  f1: {
    a: { j: { ankle: [56, 178], toe: [80, 184], knee: [88, 150], hip: [56, 142], shoulder: [64, 96], head: [73, 78], elbow: [76, 118], wrist: [62, 94] }, props: [{ t: "db", at: "wrist" }] },
    b: { j: { ankle: [60, 178], toe: [82, 184], knee: [60, 144], hip: [60, 126], shoulder: [60, 94], head: [62, 76], elbow: [66, 60], wrist: [70, 36] }, props: [{ t: "db", at: "wrist" }] },
  },
  f2: {
    a: { j: { ankle: [56, 178], toe: [78, 184], knee: [84, 152], hip: [52, 148], shoulder: [54, 108], head: [60, 90], elbow: [74, 112], wrist: [96, 114] }, props: [{ t: "ball", at: [108, 114], r: 12 }] },
    b: { j: { ankle: [60, 178], toe: [82, 184], knee: [60, 150], hip: [60, 124], shoulder: [60, 92], head: [62, 74], elbow: [62, 104], wrist: [78, 96] }, props: [{ t: "ball", at: [90, 98], r: 12 }] },
  },
  f3: {
    a: { j: { ankle: [56, 178], toe: [78, 184], knee: [56, 148], hip: [58, 128], shoulder: [58, 96], head: [60, 78], elbow: [58, 112], wrist: [78, 106], knee2: [88, 156], ankle2: [104, 180], toe2: [118, 184] }, props: [{ t: "ball", at: [90, 104], r: 11 }] },
    b: { j: { ankle: [58, 178], toe: [80, 184], knee: [58, 148], hip: [60, 128], shoulder: [60, 96], head: [62, 78], elbow: [80, 100], wrist: [100, 98], knee2: [90, 156], ankle2: [106, 180], toe2: [120, 184] }, props: [{ t: "ball", at: [112, 98], r: 11 }] },
  },
  f4: {
    a: { j: { ankle: [60, 178], toe: [82, 184], knee: [90, 150], hip: [58, 142], shoulder: [60, 98], head: [62, 80], elbow: [50, 120], wrist: [40, 140], elbow2: [68, 134], wrist2: [44, 144] }, props: [{ t: "cable", from: [8, 192], to: "wrist" }] },
    b: { j: { ankle: [60, 178], toe: [82, 184], knee: [60, 144], hip: [60, 126], shoulder: [60, 92], head: [64, 74], elbow: [78, 66], wrist: [96, 48], elbow2: [88, 82], wrist2: [100, 54] }, props: [{ t: "cable", from: [8, 192], to: "wrist" }] },
  },
  f5: {
    a: { j: { hip: [60, 150], knee: [66, 164], ankle: [66, 184], toe: [44, 184], shoulder: [62, 114], head: [66, 96], elbow: [80, 98], wrist: [100, 74], elbow2: [88, 114], wrist2: [102, 80], knee2: [86, 152], ankle2: [86, 176] }, props: [{ t: "cable", from: [120, 8], to: "wrist" }], shadow: [64, 188, 44, 4] },
    b: { j: { hip: [60, 150], knee: [66, 164], ankle: [66, 184], toe: [44, 184], shoulder: [62, 114], head: [64, 96], elbow: [58, 128], wrist: [40, 148], elbow2: [74, 142], wrist2: [44, 152], knee2: [86, 152], ankle2: [86, 176] }, props: [{ t: "cable", from: [120, 8], to: "wrist" }], shadow: [64, 188, 44, 4] },
  },
  f6: {
    a: { j: { head: [80, 96], shoulder: [80, 114], hip: [80, 150], elbow: [66, 124], wrist: [78, 116], elbow2: [94, 124], wrist2: [82, 116], knee: [100, 152], ankle: [102, 182], toe: [114, 184], knee2: [64, 180], ankle2: [80, 184], toe2: [90, 184] }, props: [{ t: "db", at: "wrist" }], shadow: [80, 188, 44, 5] },
    b: { j: { head: [80, 70], shoulder: [80, 88], hip: [80, 124], elbow: [74, 62], wrist: [70, 38], elbow2: [100, 94], wrist2: [116, 98], knee: [82, 152], ankle: [84, 182], toe: [96, 184], knee2: [58, 138], ankle2: [46, 158], toe2: [38, 162] }, props: [{ t: "db", at: "wrist" }], shadow: [86, 188, 24, 4] },
  },
  f7: {
    a: { j: { ankle: [50, 178], toe: [70, 184], knee: [52, 148], hip: [58, 126], shoulder: [58, 92], head: [60, 74], elbow: [58, 110], wrist: [58, 128], knee2: [74, 150], ankle2: [80, 178], toe2: [98, 184] }, props: [{ t: "db", at: "wrist" }] },
    b: { j: { ankle: [70, 178], toe: [90, 184], knee: [66, 150], hip: [58, 126], shoulder: [58, 92], head: [60, 74], elbow: [58, 110], wrist: [58, 128], knee2: [50, 150], ankle2: [44, 180], toe2: [62, 186] }, props: [{ t: "db", at: "wrist" }] },
  },
  f8: {
    a: { j: { ankle: [50, 178], toe: [70, 184], knee: [52, 148], hip: [58, 126], shoulder: [58, 92], head: [60, 74], elbow: [58, 62], wrist: [58, 34], knee2: [74, 150], ankle2: [80, 178], toe2: [98, 184] }, props: [{ t: "db", at: "wrist" }] },
    b: { j: { ankle: [70, 178], toe: [90, 184], knee: [66, 150], hip: [58, 126], shoulder: [58, 92], head: [60, 74], elbow: [58, 62], wrist: [58, 34], knee2: [50, 150], ankle2: [44, 180], toe2: [62, 186] }, props: [{ t: "db", at: "wrist" }] },
  },
  c1: {
    a: { j: { ankle: [50, 178], toe: [68, 184], knee: [52, 152], hip: [58, 134], shoulder: [58, 100], head: [60, 82], elbow: [58, 114], wrist: [78, 106], knee2: [72, 152], ankle2: [74, 178], toe2: [92, 184] }, props: [{ t: "band", at: [62, 177], rx: 20 }, { t: "ball", at: [90, 106], r: 11 }], shadow: [62, 188, 34, 5] },
    b: { j: { ankle: [40, 178], toe: [58, 184], knee: [44, 152], hip: [58, 134], shoulder: [58, 100], head: [60, 82], elbow: [80, 102], wrist: [100, 102], knee2: [82, 152], ankle2: [86, 178], toe2: [104, 184] }, props: [{ t: "band", at: [62, 177], rx: 32 }, { t: "ball", at: [112, 102], r: 11 }], shadow: [62, 188, 40, 5] },
  },
  c2: {
    a: { j: { head: [40, 118], shoulder: [54, 124], elbow: [54, 150], wrist: [34, 152], hip: [92, 128], knee: [112, 132], ankle: [130, 136], toe: [136, 142], knee2: [112, 122], ankle2: [132, 114], toe2: [140, 112] }, props: [], shadow: [88, 162, 58, 4] },
    b: { j: { head: [40, 118], shoulder: [54, 124], elbow: [54, 150], wrist: [34, 152], hip: [92, 128], knee: [112, 124], ankle: [132, 116], toe: [140, 114], knee2: [112, 134], ankle2: [132, 138], toe2: [140, 144] }, props: [], shadow: [88, 162, 58, 4] },
  },
  c3: {
    a: { j: { head: [40, 140], shoulder: [56, 148], hip: [86, 156], elbow: [44, 126], wrist: [34, 112], elbow2: [52, 166], wrist2: [42, 174], knee: [112, 150], ankle: [136, 142], toe: [146, 140], knee2: [90, 176], ankle2: [114, 176], toe2: [124, 178] }, props: [], shadow: [92, 186, 46, 4] },
    b: { j: { head: [44, 142], shoulder: [58, 150], hip: [88, 156], elbow: [74, 126], wrist: [68, 110], elbow2: [52, 166], wrist2: [42, 174], knee: [88, 128], ankle: [96, 110], toe: [106, 108], knee2: [90, 176], ankle2: [114, 176], toe2: [124, 178] }, props: [], shadow: [92, 186, 46, 4] },
  },
  c4: {
    a: { j: { ankle: [36, 180], toe: [54, 184], knee: [60, 158], hip: [86, 166], shoulder: [92, 124], head: [100, 106], elbow: [68, 120], wrist: [42, 116] }, props: [], shadow: [62, 188, 52, 4] },
    b: { j: { ankle: [36, 180], toe: [54, 184], knee: [60, 158], hip: [86, 170], shoulder: [110, 168], head: [130, 170], elbow: [112, 144], wrist: [114, 118] }, props: [], shadow: [62, 188, 52, 4] },
  },
  c5: {
    a: { j: { head: [30, 168], shoulder: [48, 166], elbow: [42, 174], wrist: [30, 176], hip: [88, 164], knee: [108, 144], ankle: [110, 170], toe: [126, 172], knee2: [110, 164], ankle2: [132, 164], toe2: [144, 164] }, props: [], shadow: [82, 182, 58, 4] },
    b: { j: { head: [30, 168], shoulder: [48, 166], elbow: [42, 174], wrist: [30, 176], hip: [88, 138], knee: [108, 138], ankle: [110, 170], toe: [126, 172], knee2: [112, 128], ankle2: [134, 112], toe2: [146, 104] }, props: [], shadow: [82, 182, 58, 4] },
  },
  c6: {
    a: { j: { head: [28, 166], shoulder: [46, 166], elbow: [40, 172], wrist: [28, 174], hip: [86, 164], knee: [98, 126], ankle: [108, 88], toe: [118, 80], knee2: [106, 128], ankle2: [118, 92], toe2: [128, 84] }, props: [], shadow: [72, 180, 60, 4] },
    b: { j: { head: [28, 166], shoulder: [46, 166], elbow: [40, 172], wrist: [28, 174], hip: [86, 164], knee: [98, 126], ankle: [108, 88], toe: [118, 80], knee2: [108, 150], ankle2: [128, 160], toe2: [140, 158] }, props: [], shadow: [72, 180, 60, 4] },
  },
  c7: {
    a: { j: { head: [112, 156], shoulder: [96, 148], elbow: [120, 156], wrist: [130, 160], hip: [66, 144], knee: [46, 158], ankle: [24, 176], toe: [14, 176] }, props: [{ t: "ball", at: [76, 152], r: 28, layer: "back" }], shadow: [58, 184, 50, 4] },
    b: { j: { head: [116, 114], shoulder: [98, 128], elbow: [122, 108], wrist: [132, 98], hip: [66, 142], knee: [46, 158], ankle: [24, 176], toe: [14, 176] }, props: [{ t: "ball", at: [76, 152], r: 28, layer: "back" }], shadow: [58, 184, 50, 4] },
  },
  c8: {
    a: { j: { head: [80, 100], shoulder: [82, 122], hip: [88, 150], elbow: [70, 132], wrist: [88, 138], elbow2: [94, 132], wrist2: [76, 138], knee: [66, 166], ankle: [48, 182], toe: [38, 184], knee2: [78, 168], ankle2: [60, 184], toe2: [50, 186] }, props: [{ t: "ball", at: [96, 160], r: 24, layer: "back" }], shadow: [68, 188, 46, 4] },
    b: { j: { head: [108, 108], shoulder: [98, 126], hip: [88, 150], elbow: [88, 134], wrist: [106, 138], elbow2: [112, 134], wrist2: [94, 140], knee: [66, 166], ankle: [48, 182], toe: [38, 184], knee2: [78, 168], ankle2: [60, 184], toe2: [50, 186] }, props: [{ t: "ball", at: [96, 160], r: 24, layer: "back" }], shadow: [68, 188, 46, 4] },
  },
};

function buildExercisePose(pose, noFeet) {
  const j = pose.j;
  const props = pose.props || [];
  const body = "#2F6B5A";
  const light = "#9BC1B5";
  const dark = "#2B3138";
  const ball = "#F1DAC4";
  const accent = "#D98F45";
  const cable = "#A2ABB2";
  const segs = [];
  const rects = [];
  const circles = [];
  const ellipses = [];
  const backCircles = [];
  const point = (p) => (typeof p === "string" ? j[p] : p);
  const seg = (a, b, w, color) => {
    if (j[a] && j[b]) segs.push({ x1: j[a][0], y1: j[a][1], x2: j[b][0], y2: j[b][1], w, color });
  };
  const shadow = pose.shadow || [(j.ankle[0] + (j.toe ? j.toe[0] : j.ankle[0])) / 2, 188, 28, 5];
  ellipses.push({ cx: shadow[0], cy: shadow[1], rx: shadow[2], ry: shadow[3], fill: "rgba(0,0,0,0.06)", stroke: "none", sw: 0 });
  props
    .filter((prop) => prop.layer === "back")
    .forEach((prop) => {
      const at = point(prop.at);
      if (prop.t === "ball") backCircles.push({ cx: at[0], cy: at[1], r: prop.r, fill: ball, stroke: accent, sw: 3 });
    });
  if (j.knee2) {
    if (j.toe2 && !noFeet) seg("ankle2", "toe2", 11, light);
    seg("ankle2", "knee2", 12, light);
    seg("knee2", "hip", 15, light);
  }
  if (j.elbow2) {
    seg("shoulder", "elbow2", 12, light);
    seg("elbow2", "wrist2", 12, light);
  }
  if (j.toe && !noFeet) seg("ankle", "toe", 11, body);
  seg("ankle", "knee", 13, body);
  seg("knee", "hip", 16, body);
  seg("hip", "shoulder", 22, body);
  seg("shoulder", "elbow", 12, body);
  seg("elbow", "wrist", 12, body);
  seg("shoulder", "head", 11, body);
  circles.push({ cx: j.head[0], cy: j.head[1], r: 13, fill: body, stroke: "none", sw: 0 });
  const addDumbbell = (at) => {
    segs.push({ x1: at[0] - 13, y1: at[1], x2: at[0] + 13, y2: at[1], w: 5, color: dark });
    rects.push({ x: at[0] - 17, y: at[1] - 10, w: 7, h: 20, rx: 2.5, fill: dark });
    rects.push({ x: at[0] + 10, y: at[1] - 10, w: 7, h: 20, rx: 2.5, fill: dark });
  };
  props.forEach((prop) => {
    const at = point(prop.at);
    if (prop.t === "db" || prop.t === "db2") addDumbbell(at);
    else if (prop.t === "ball" && prop.layer !== "back") circles.push({ cx: at[0], cy: at[1], r: prop.r, fill: ball, stroke: accent, sw: 3 });
    else if (prop.t === "cable") {
      const to = point(prop.to);
      segs.push({ x1: prop.from[0], y1: prop.from[1], x2: to[0], y2: to[1], w: 2, color: cable });
      rects.push({ x: to[0] - 5, y: to[1] - 4, w: 10, h: 8, rx: 2, fill: dark });
    } else if (prop.t === "band") {
      ellipses.push({ cx: prop.at[0], cy: prop.at[1], rx: prop.rx, ry: prop.ry || 5, fill: "none", stroke: accent, sw: 3 });
    }
  });
  return { segs, rects, circles, ellipses, backCircles };
}

function exerciseVisual(exercise) {
  const visualId = EXERCISE_VISUAL_IDS[exercise.id];
  const pose = EXERCISE_POSES[visualId];
  if (!pose) return "";
  const noFeet = NO_FEET_VISUALS.has(visualId);
  const seqA = buildExercisePose(pose.a, noFeet);
  const seqB = buildExercisePose(pose.b, noFeet);
  return `
    <div class="exercise-thumb" aria-hidden="true">
      <svg viewBox="0 0 300 200" fill="none">
        ${exerciseVisualParts(seqA)}
        <path d="M138 100 h16 M150 94 l6 6 l-6 6" stroke="#D98F45" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
        <g transform="translate(158,0)">${exerciseVisualParts(seqB)}</g>
      </svg>
    </div>
  `;
}

function exerciseVisualParts(pose) {
  return `
    ${pose.ellipses.map((item) => `<ellipse cx="${item.cx}" cy="${item.cy}" rx="${item.rx}" ry="${item.ry}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.sw}"></ellipse>`).join("")}
    ${pose.backCircles.map((item) => `<circle cx="${item.cx}" cy="${item.cy}" r="${item.r}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.sw}"></circle>`).join("")}
    ${pose.segs.map((item) => `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.color}" stroke-width="${item.w}" stroke-linecap="round"></line>`).join("")}
    ${pose.rects.map((item) => `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${item.rx}" fill="${item.fill}"></rect>`).join("")}
    ${pose.circles.map((item) => `<circle cx="${item.cx}" cy="${item.cy}" r="${item.r}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.sw}"></circle>`).join("")}
  `;
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
  const authAction = `auth-${mode}`;
  const authPending = isPending(authAction);
  const authDisabled = isAnyPending();
  const submitLabel = isRegister ? "Create Account" : "Sign In";
  const pendingLabel = isRegister ? "Creating account..." : "Signing in...";
  return `
    <div class="auth-wrap">
      <section class="auth-card" aria-labelledby="auth-title">
        <div class="brand"><span class="brand-mark" aria-hidden="true">${appMarkIcon()}</span><span class="brand-name">Physical Therapy Tracker</span></div>
        <h1 class="auth-title" id="auth-title">${isRegister ? "Create account" : "Welcome back"}</h1>
        <p class="subtle">${isRegister ? "Set up your private therapy log." : "Sign in to continue your therapy log."}</p>
        <form class="form" data-auth-form="${mode}">
          ${isRegister ? formField("name", "Name", "text", "Optional", "", authDisabled) : ""}
          ${formField("email", "Email", "email", "you@example.com", "email", authDisabled)}
          ${formField("password", "Password", "password", "At least 8 characters", "current-password", authDisabled)}
          <div class="error-text" data-form-error>${escapeHtml(state.error)}</div>
          <button class="button primary full" type="submit" ${disabledAttr(authDisabled)}>${loadingButtonContent(submitLabel, pendingLabel, authPending)}</button>
        </form>
        <p class="subtle">
          ${isRegister ? "Already have an account?" : "New here?"}
          <button class="button linkish" data-nav="${isRegister ? "/sign-in" : "/register"}" ${disabledAttr(authDisabled)}>${isRegister ? "Sign in" : "Create an account"}</button>
        </p>
        ${
          isRegister
            ? ""
            : `<div class="demo-login">
                <button class="button secondary full" data-action="demo-login" type="button" ${disabledAttr(authDisabled)}>
                  ${loadingButtonContent("Try the demo experience", "Opening demo...", isPending("demo-login"))}
                </button>
              </div>`
        }
      </section>
    </div>
  `;
}

function formField(name, label, type, placeholder, autocomplete, disabled = false) {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input class="input" id="${name}" name="${name}" type="${type}" placeholder="${placeholder}" autocomplete="${autocomplete}" ${disabledAttr(disabled)}>
    </div>
  `;
}

function appShell(inner, active = routeInfo().name) {
  const isWorkout = active === "workout-new" || active === "workout-edit";
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark" aria-hidden="true">${appMarkIcon()}</span><span class="brand-name">Physical Therapy Tracker</span></div>
        <nav class="side-nav" aria-label="Main navigation">${navButtons(active)}</nav>
        <div class="sidebar-foot">
          <div class="row-title">${escapeHtml(state.user?.name || "Account")}</div>
          <div class="row-meta">${escapeHtml(state.user?.email || "")}</div>
        </div>
      </aside>
      <header class="mobile-header">
        <span class="brand-mark" aria-hidden="true">${appMarkIcon()}</span>
        <span class="mobile-header-title">${mobileTitle(active)}</span>
      </header>
      <main class="main ${isWorkout ? "workout-main" : ""}">
        <div class="content">
          ${state.error ? `<div class="error-text">${escapeHtml(state.error)}</div>` : ""}
          ${state.loading ? loadingCard() : inner}
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
        <button class="nav-button ${normalized === name ? "active" : ""}" data-nav="${path}" aria-label="${label}" ${disabledAttr(isAnyPending())}>
          <span class="nav-icon" aria-hidden="true">${navIcon(name)}</span>
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
      ${workoutTypeCard("core_hip", "Strengthening", "8 exercises")}
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
      <span class="type-icon" aria-hidden="true">${workoutTypeIcon(type)}</span>
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
        <span class="spark ${categoryClass(exercise.category)}" aria-hidden="true"></span>
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
  const saving = isPending("finish-workout");
  const controlsDisabled = isAnyPending();
  const finishLabel = draft.mode === "edit" ? "Save Changes" : "Finish Workout";
  return appShell(`
    <div class="workout-wrap">
      <div class="workout-content">
        <div class="workout-head">
          <div>
            <div class="workout-kicker">${escapeHtml(draft.typeLabel)}</div>
            <h1 class="workout-title">Workout</h1>
          </div>
          <button class="workout-cancel" data-action="cancel-workout" ${disabledAttr(controlsDisabled)}>Cancel</button>
        </div>
        <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${total ? (doneCount / total) * 100 : 0}%"></div></div>
        <p class="workout-progress-text">${doneCount} of ${total} marked done</p>
        <div class="workout-list">${draft.exercises.map(exercisePanel).join("")}</div>
      </div>
      <div class="finish-bar">
        <div class="finish-inner">
          <span class="finish-count">${doneCount} of ${total} marked done</span>
          <button class="button primary" data-action="finish-workout" ${disabledAttr(controlsDisabled)}>${loadingButtonContent(finishLabel, "Saving workout...", saving)}</button>
        </div>
        <div class="error-text">${escapeHtml(draft.error || "")}</div>
      </div>
    </div>
  `, draft.mode === "edit" ? "workout-edit" : "workout-new");
}

function exercisePanel(item) {
  const exercise = item.exercise;
  const entry = state.draft.entries[exercise.id];
  const controlsDisabled = isAnyPending();
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
        <div class="exercise-head">
          ${exerciseVisual(exercise)}
          <div class="exercise-text">
            <div class="exercise-name">${escapeHtml(exercise.name)}</div>
            <div class="exercise-cues">${escapeHtml(exercise.description)}</div>
          </div>
        </div>
        ${entry.done ? `<span class="check-pill" aria-label="Done">&#10003;</span>` : ""}
      </div>
      <div class="last-line">${lastLine(item)}</div>
      <div class="field-grid">${fields.join("")}</div>
      ${
        entry.showNote
          ? `<textarea class="textarea note-area" id="notes-${exercise.id}" data-entry-field="notes" rows="2" maxlength="1000" placeholder="Add a note for this exercise..." ${disabledAttr(controlsDisabled)}>${escapeHtml(entry.notes || "")}</textarea>`
          : ""
      }
      <div class="panel-actions">
        <button class="button primary done-button ${entry.done ? "active" : ""}" data-action="toggle-done" ${disabledAttr(controlsDisabled)}>${entry.done ? "&#10003; Done" : "Mark done"}</button>
        <button class="button secondary skip-button ${entry.skipped ? "active" : ""}" data-action="toggle-skip" ${disabledAttr(controlsDisabled)}>${entry.skipped ? "Skipped" : "Skip"}</button>
        <button class="note-toggle" data-action="toggle-note" ${disabledAttr(controlsDisabled)}>${entry.showNote ? "Hide note" : "+ Note"}</button>
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
  const controlsDisabled = isAnyPending();
  return `
    <div class="field">
      <span class="field-label">${label}</span>
      <div class="stepper" data-exercise-id="${exerciseId}" data-field="${field}" data-step="${step}">
        <button type="button" data-action="step-down" aria-label="Decrease ${label}" ${disabledAttr(controlsDisabled)}>&minus;</button>
        <span class="stepper-value">
          <input class="input" inputmode="decimal" data-entry-field="${field}" value="${escapeHtml(safeValue)}" aria-label="${label}${unit ? ` in ${unit}` : ""}" ${disabledAttr(controlsDisabled)}>
          ${unit ? `<span aria-hidden="true">${unit}</span>` : ""}
        </span>
        <button type="button" data-action="step-up" aria-label="Increase ${label}" ${disabledAttr(controlsDisabled)}>+</button>
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
  const controlsDisabled = isAnyPending();
  return appShell(`
    <button class="button ghost back-button" data-nav="/history">&lsaquo; History</button>
    <div class="detail-head">
      <div>
        <span class="badge ${categoryClass(workout.type)}">${escapeHtml(workout.typeLabel)}</span>
        <h1 class="detail-date">${formatDate(workout.performedAt, true)}</h1>
      </div>
      <button class="edit-toggle" data-nav="/history/${workout.id}/edit" ${disabledAttr(controlsDisabled)}>Edit</button>
    </div>
    <div class="detail-list">
      ${workout.notes ? workoutNotesRow(workout.notes) : ""}
      ${workout.entries.map(detailEntryRow).join("")}
    </div>
    <button class="delete-workout-button" data-action="ask-delete" data-workout-id="${workout.id}" ${disabledAttr(controlsDisabled)}>Delete workout</button>
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
  const signingOut = isPending("sign-out");
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
    <button class="signout-button" data-action="sign-out" ${disabledAttr(isAnyPending())}>${loadingButtonContent("Sign out", "Signing out...", signingOut)}</button>
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
  const pending = isAnyPending();
  const confirmPending = Boolean(state.modal.pendingAction && isPending(state.modal.pendingAction));
  const confirmLabel = state.modal.confirmPending || `${state.modal.confirm}...`;
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <section class="modal">
        <h2 class="modal-title" id="modal-title">${escapeHtml(state.modal.title)}</h2>
        <p class="subtle">${escapeHtml(state.modal.message)}</p>
        <div class="modal-actions">
          ${state.modal.cancel ? `<button class="button secondary" data-modal-action="cancel" ${disabledAttr(pending)}>${escapeHtml(state.modal.cancel)}</button>` : ""}
          <button class="button ${state.modal.danger ? "danger" : "primary"}" data-modal-action="confirm" ${disabledAttr(pending)}>${loadingButtonContent(state.modal.confirm, confirmLabel, confirmPending)}</button>
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

function workoutProgressText() {
  if (!state.draft) return "";
  const doneCount = Object.values(state.draft.entries).filter((entry) => entry.done).length;
  const total = state.draft.exercises.length;
  return `${doneCount} of ${total} marked done`;
}

function updateWorkoutProgressDom() {
  if (!state.draft) return;
  const doneCount = Object.values(state.draft.entries).filter((entry) => entry.done).length;
  const total = state.draft.exercises.length;
  const width = total ? (doneCount / total) * 100 : 0;
  const label = workoutProgressText();
  const fill = app.querySelector(".progress-fill");
  if (fill) fill.style.width = `${width}%`;
  app.querySelectorAll(".workout-progress-text, .finish-count").forEach((item) => {
    item.textContent = label;
  });
}

function updateExerciseStatusDom(panel, entry) {
  panel.classList.toggle("done", entry.done);
  panel.classList.toggle("skipped", entry.skipped);

  const exerciseTop = panel.querySelector(".exercise-top");
  const checkPill = panel.querySelector(".check-pill");
  if (entry.done && !checkPill && exerciseTop) {
    exerciseTop.insertAdjacentHTML("beforeend", `<span class="check-pill" aria-label="Done">&#10003;</span>`);
  } else if (!entry.done && checkPill) {
    checkPill.remove();
  }

  const doneButton = panel.querySelector('[data-action="toggle-done"]');
  if (doneButton) {
    doneButton.classList.toggle("active", entry.done);
    doneButton.textContent = entry.done ? "\u2713 Done" : "Mark done";
  }

  const skipButton = panel.querySelector('[data-action="toggle-skip"]');
  if (skipButton) {
    skipButton.classList.toggle("active", entry.skipped);
    skipButton.textContent = entry.skipped ? "Skipped" : "Skip";
  }
}

function updateNoteDisclosureDom(panel, entry) {
  const exerciseId = panel.dataset.exerciseId;
  const existingNote = panel.querySelector(".note-area");
  const actions = panel.querySelector(".panel-actions");
  if (entry.showNote && !existingNote && actions) {
    actions.insertAdjacentHTML(
      "beforebegin",
      `<textarea class="textarea note-area" id="notes-${exerciseId}" data-entry-field="notes" rows="2" maxlength="1000" placeholder="Add a note for this exercise...">${escapeHtml(entry.notes || "")}</textarea>`,
    );
  } else if (!entry.showNote && existingNote) {
    existingNote.remove();
  }

  const noteButton = panel.querySelector('[data-action="toggle-note"]');
  if (noteButton) noteButton.textContent = entry.showNote ? "Hide note" : "+ Note";
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
  if (isAnyPending()) return;
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
    state.pendingAction = "finish-workout";
    render();
    let saved;
    if (state.draft.mode === "edit") {
      saved = await api(`/api/workouts/${state.draft.workoutId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      state.pendingAction = null;
      navigate(`/history/${saved.workout.id}`);
    } else {
      saved = await api("/api/workouts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.pendingAction = null;
      navigate(`/workouts/${saved.workout.id}/summary`);
    }
  } catch (error) {
    state.pendingAction = null;
    state.draft.error = error.message;
    render();
  }
}

function setDraftValue(target) {
  if (isAnyPending()) return;
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
  if (isAnyPending()) return;
  const stepperEl = button.closest(".stepper");
  if (!stepperEl) return;
  const entry = state.draft.entries[stepperEl.dataset.exerciseId];
  const field = stepperEl.dataset.field;
  const step = Number(stepperEl.dataset.step || 1);
  const current = Number(entry[field] || 0);
  const next = Math.max(0, Math.round((current + step * direction) * 10) / 10);
  entry[field] = next;
  const input = stepperEl.querySelector(`[data-entry-field="${field}"]`);
  if (input) input.value = next;
}

function toggleExercise(button, action) {
  if (isAnyPending()) return;
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
    updateNoteDisclosureDom(panel, entry);
    return;
  }
  updateExerciseStatusDom(panel, entry);
  updateWorkoutProgressDom();
}

function cancelWorkout() {
  if (isAnyPending()) return;
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
  if (isAnyPending()) return;
  try {
    state.pendingAction = "delete-workout";
    render();
    await api(`/api/workouts/${id}`, { method: "DELETE" });
    state.modal = null;
    state.pendingAction = null;
    navigate("/history");
  } catch (error) {
    state.pendingAction = null;
    state.error = error.message;
    state.modal = null;
    render();
  }
}

async function signOut() {
  if (isAnyPending()) return;
  state.pendingAction = "sign-out";
  render();
  await api("/api/auth/logout", { method: "POST" }).catch(() => null);
  state.pendingAction = null;
  state.user = null;
  navigate("/sign-in");
}

async function demoLogin() {
  if (isAnyPending()) return;
  state.error = "";
  state.pendingAction = "demo-login";
  render();
  try {
    const data = await api("/api/auth/demo", { method: "POST" });
    state.user = data.user;
    state.pendingAction = null;
    navigate("/today");
  } catch (error) {
    state.error = error.message;
    state.pendingAction = null;
    render();
  }
}

app.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    if (isAnyPending()) return;
    navigate(nav.dataset.nav);
    return;
  }

  const modalButton = event.target.closest("[data-modal-action]");
  if (modalButton) {
    const modal = state.modal;
    if (!modal) return;
    if (isAnyPending()) return;
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
  if (isAnyPending()) return;
  const action = actionButton.dataset.action;
  if (action === "step-up") stepValue(actionButton, 1);
  if (action === "step-down") stepValue(actionButton, -1);
  if (action === "toggle-done" || action === "toggle-skip" || action === "toggle-note") toggleExercise(actionButton, action);
  if (action === "finish-workout") void finishWorkout();
  if (action === "cancel-workout") cancelWorkout();
  if (action === "sign-out") void signOut();
  if (action === "demo-login") void demoLogin();
  if (action === "ask-delete") {
    const id = actionButton.dataset.workoutId;
    state.modal = {
      title: "Delete workout?",
      message: "This workout will be removed from history and progress.",
      confirm: "Delete",
      confirmPending: "Deleting...",
      cancel: "Cancel",
      danger: true,
      pendingAction: "delete-workout",
      onConfirm: () => void deleteWorkout(id),
    };
    render();
  }
});

app.addEventListener("input", (event) => {
  if (isAnyPending()) return;
  const target = event.target;
  if (target.matches("[data-draft-field], [data-entry-field]")) setDraftValue(target);
});

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-auth-form]");
  if (!form) return;
  event.preventDefault();
  if (isAnyPending()) return;
  state.error = "";
  const formData = new FormData(form);
  const mode = form.dataset.authForm;
  const pendingAction = `auth-${mode}`;
  const payload = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  if (mode === "register") payload.name = formData.get("name");

  try {
    state.pendingAction = pendingAction;
    render();
    const data = await api(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.user = data.user;
    state.pendingAction = null;
    navigate("/today");
  } catch (error) {
    state.pendingAction = null;
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
