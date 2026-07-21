import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("生产构建包含练迹页面与真实数据 API", async () => {
  await access(new URL("dist/server/index.js", root));
  const [page, styles, hosting, visuals, bootSequence, kineticField, pageTransition, kineticScene, kineticShaders, kineticIcons, packageJson, favicon] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("components/track-visuals.tsx", root), "utf8"),
    readFile(new URL("components/app-boot-sequence.tsx", root), "utf8"),
    readFile(new URL("components/kinetic-field.tsx", root), "utf8"),
    readFile(new URL("components/kinetic-page-transition.tsx", root), "utf8"),
    readFile(new URL("lib/visual/kinetic-scene.ts", root), "utf8"),
    readFile(new URL("lib/visual/kinetic-shaders.ts", root), "utf8"),
    readFile(new URL("components/kinetic-icons.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/favicon.svg", root), "utf8"),
  ]);

  assert.match(page, /apiRequest<DashboardData>\("\/api\/dashboard"\)/);
  assert.match(page, /\/api\/auth\/register/);
  assert.match(page, /\/api\/workouts\/\$\{activeWorkout\.id\}\/sets/);
  assert.match(page, /TrainingPlanView/);
  assert.match(page, /\/api\/plans\/active/);
  assert.match(page, /\/api\/workouts\/active/);
  assert.match(page, /aria-label="训练频率时间范围"/);
  assert.match(page, /selectedActivity\.reduce/);
  assert.match(page, /const chineseMonths = \["一月".+"十二月"\]/);
  assert.match(page, /period === "year" \? startOfCalendarYear/);
  assert.match(page, /12 月 31 日/);
  assert.match(page, /data-testid="profile-view"/);
  assert.match(page, /个人档案与账号设置/);
  assert.doesNotMatch(page, /HistoryView/);
  assert.doesNotMatch(page, /view === "history"/);
  assert.match(page, /<TrackMark className="brand-symbol"/);
  assert.doesNotMatch(page, /<span>练<\/span>/);
  assert.match(page, /<TrainingStatusMark planLetter=\{letter\}/);
  assert.match(page, /<KineticField mode=\{kineticMode\}/);
  assert.match(page, /<KineticPageTransition/);
  assert.match(page, /suspended=\{bootVisible\}/);
  assert.match(page, /<AppBootSequence phase=\{bootPhase\}/);
  assert.match(page, /brandLanded \? "boot-arrived"/);
  assert.match(page, /bootVisible \? "boot-active"/);
  assert.equal(page.match(/<Leaderboard /g)?.length, 1);
  assert.match(styles, /grid-template-columns: repeat\(4, 1fr\)/);
  assert.match(styles, /profile-drawer/);
  assert.match(styles, /\.boot-sequence/);
  assert.match(styles, /\.kinetic-field-layer[^}]+pointer-events: none/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(visuals, /export function TrackMark/);
  assert.match(visuals, /export function TrainingStatusMark/);
  assert.match(bootSequence, /role=\{phase === "error" \? "alert" : "status"\}/);
  assert.match(bootSequence, />从断点重新同步<\/button>/);
  assert.match(bootSequence, /boot-reactor-flare/);
  assert.match(bootSequence, /flyingMarkRef/);
  assert.match(bootSequence, /function flightPoint/);
  assert.match(bootSequence, /duration: 0\.72/);
  assert.match(bootSequence, /kinetic-flight-start/);
  assert.match(bootSequence, /\.sidebar \.brand-symbol/);
  assert.match(bootSequence, /boot-flight-wake/);
  assert.match(styles, /brand-arrival-catch/);
  assert.match(kineticField, /import\("@\/lib\/visual\/kinetic-scene"\)/);
  assert.match(kineticField, /webglcontextlost/);
  assert.match(kineticField, /kinetic-flight-start/);
  assert.match(kineticField, /kinetic-flight-end/);
  assert.match(pageTransition, /suspended = false/);
  assert.match(pageTransition, /staticTransition/);
  assert.match(kineticScene, /powerPreference: "high-performance"/);
  assert.match(kineticScene, /LINK_STATUS/);
  assert.match(kineticShaders, /energyRibbon/);
  assert.match(kineticIcons, /export function KineticIcon/);
  assert.equal(JSON.parse(packageJson).dependencies.ogl.startsWith("^"), true);
  assert.equal(JSON.parse(packageJson).dependencies.motion.startsWith("^"), true);
  assert.match(favicon, /#C0FA4A/);
  assert.match(favicon, /#FF9138/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("账号、训练和排行榜路由均已实现", async () => {
  const routes = [
    "app/api/auth/register/route.ts",
    "app/api/auth/login/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/auth/me/route.ts",
    "app/api/dashboard/route.ts",
    "app/api/invites/route.ts",
    "app/api/workouts/route.ts",
    "app/api/workouts/[id]/sets/route.ts",
    "app/api/workouts/[id]/complete/route.ts",
    "app/api/workouts/[id]/exercises/[exerciseId]/complete/route.ts",
    "app/api/workouts/active/route.ts",
    "app/api/plans/active/route.ts",
    "app/api/exercises/route.ts",
  ];
  await Promise.all(routes.map((route) => access(new URL(route, root))));
});

test("数据库迁移不保存密码、会话或邀请码原文", async () => {
  const [migration, auth] = await Promise.all([
    readFile(new URL("drizzle/0000_amazing_robin_chapel.sql", root), "utf8"),
    readFile(new URL("lib/server/auth.ts", root), "utf8"),
  ]);

  assert.match(migration, /password_hash/);
  assert.match(migration, /token_hash/);
  assert.match(migration, /code_hash/);
  assert.doesNotMatch(migration, /\bpassword\b/);
  assert.match(auth, /PBKDF2/);
  assert.match(auth, /passwordIterations = 100_000/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
});

test("周计划、训练快照与多种记录方式已进入迁移", async () => {
  const migration = await readFile(new URL("drizzle/0001_careful_madelyne_pryor.sql", root), "utf8");
  assert.match(migration, /CREATE TABLE `training_plans`/);
  assert.match(migration, /CREATE TABLE `training_plan_days`/);
  assert.match(migration, /CREATE TABLE `training_plan_exercises`/);
  assert.match(migration, /CREATE TABLE `workout_exercises`/);
  assert.match(migration, /`tracking_type`/);
  assert.match(migration, /`left_weight_kg`/);
  assert.match(migration, /`duration_seconds`/);
});
