import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("生产构建包含练迹页面与真实数据 API", async () => {
  await access(new URL("dist/server/index.js", root));
  const [page, layout, styles, hosting, visuals, bootSequence, kineticField, pageTransition, planTransition, kineticScene, kineticShaders, kineticIcons, trackSelect, trainingPlan, trainingDayStatus, packageJson, favicon] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("components/track-visuals.tsx", root), "utf8"),
    readFile(new URL("components/app-boot-sequence.tsx", root), "utf8"),
    readFile(new URL("components/kinetic-field.tsx", root), "utf8"),
    readFile(new URL("components/kinetic-page-transition.tsx", root), "utf8"),
    readFile(new URL("components/plan-shared-transition.tsx", root), "utf8"),
    readFile(new URL("lib/visual/kinetic-scene.ts", root), "utf8"),
    readFile(new URL("lib/visual/kinetic-shaders.ts", root), "utf8"),
    readFile(new URL("components/kinetic-icons.tsx", root), "utf8"),
    readFile(new URL("components/track-select.tsx", root), "utf8"),
    readFile(new URL("components/training-plan-view.tsx", root), "utf8"),
    readFile(new URL("components/training-day-status-control.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/favicon.svg", root), "utf8"),
  ]);

  assert.match(page, /apiRequest<DashboardData>\("\/api\/dashboard"\)/);
  assert.match(page, /\/api\/auth\/register/);
  assert.match(page, /\/api\/workouts\/\$\{activeWorkout\.id\}\/sets/);
  assert.match(page, /TrainingPlanView/);
  assert.match(page, /\/api\/plans\/active/);
  assert.match(page, /\/api\/workouts\/active/);
  assert.match(page, /ariaLabel="选择训练年份"/);
  assert.match(page, /className="profile-global-stats"/);
  assert.match(page, /<Crown aria-hidden="true"/);
  assert.match(page, /<Medal aria-hidden="true"/);
  assert.match(page, /<Award aria-hidden="true"/);
  assert.match(page, /className="rank-position"/);
  assert.match(styles, /\.rank-row \{[^}]+align-items: start/);
  assert.match(styles, /\.rank-row \{ min-height: 72px/);
  assert.match(styles, /\.ranking-layout > \.leaderboard \.rank-row \{ min-height: 72px/);
  assert.match(styles, /\.rank-position \{[^}]+height: 16px[^}]+align-self: start/);
  assert.match(styles, /\.rank-copy > strong \{[^}]+line-height: 16px/);
  assert.match(styles, /\.rank-status \{[^}]+top: 0[^}]+font: 700 12px\/16px/);
  assert.match(styles, /\.rank-copy > strong \{[^}]+color: var\(--text\)/);
  assert.match(styles, /\.rank-row\.rank-1 \.rank-position svg,[^}]+\.rank-row\.rank-1 \.rank-copy > strong[^}]+color: var\(--lime\)/);
  assert.match(styles, /\.rank-row\.rank-2 \.rank-position svg,[^}]+\.rank-row\.rank-2 \.rank-copy > strong[^}]+color: var\(--orange\)/);
  assert.match(styles, /\.rank-row\.rank-3 \.rank-position svg,[^}]+\.rank-row\.rank-3 \.rank-copy > strong[^}]+color: var\(--blue\)/);
  assert.match(styles, /\.rank-row\.rank-default \.rank-position b,[^}]+\.rank-row\.rank-default \.rank-status \{ color: var\(--text\)/);
  assert.match(styles, /\.rank-row\.rank-default \.rank-track i \{ background: var\(--text\)/);
  assert.match(styles, /\.leaderboard \.section-heading > span \{ color: var\(--lime\)/);
  assert.match(layout, /<html lang="zh-CN" className=\{`\$\{notoSans\.variable\} \$\{robotoMono\.variable\}`\}>/);
  assert.doesNotMatch(layout, /Saira_Condensed/);
  assert.match(styles, /--font-mono: var\(--font-roboto-mono\)/);
  assert.match(styles, /body \{[^}]+font-family: var\(--font-data\)/);
  assert.match(styles, /\.profile-global-stats strong \{[^}]+font: 700 31px\/\.95 var\(--font-mono\)/);
  assert.match(styles, /\.profile-global-stats > div:nth-child\(1\) strong \{ color: var\(--lime\)/);
  assert.match(styles, /\.profile-global-stats > div:nth-child\(2\) strong \{ color: var\(--orange\)/);
  assert.match(styles, /\.profile-global-stats > div:nth-child\(3\) strong \{ color: var\(--blue\)/);
  assert.match(page, /className="heatmap-scroll"/);
  assert.match(page, /可横向拖动查看/);
  assert.match(page, /const chineseMonths = \["一月".+"十二月"\]/);
  assert.match(page, /className="frequency-heading-copy"/);
  assert.match(page, /<h2>训练频率<\/h2>\s*<p>一年训练节奏，一眼看清<\/p>/);
  assert.match(styles, /\.frequency-heading-copy \{[^}]+display: flex[^}]+align-items: baseline/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]+\.heatmap-panel \{ margin-top: 8px/);
  assert.doesNotMatch(page, /训练频率时间范围/);
  assert.doesNotMatch(page, /frequencyPeriods/);
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
  assert.match(page, /appContentRef\.current\?\.scrollTo\(\{ top: 0/);
  assert.match(page, /showMobileNav \? "has-mobile-nav"/);
  assert.match(page, /gridTemplateColumns: `repeat\(\$\{weeklyProgressColumns\}, minmax\(0, 1fr\)\)`/);
  assert.doesNotMatch(styles, /\.weekly-progress > div \{[^}]+repeat\(3/);
  assert.match(page, /profile-backdrop.+onClick=/);
  assert.doesNotMatch(page, /profile-backdrop.+onMouseDown=/);
  assert.equal(page.match(/<Leaderboard /g)?.length, 1);
  assert.match(styles, /grid-template-columns: repeat\(4, 1fr\)/);
  assert.match(styles, /profile-drawer/);
  assert.match(page, /profile-sheet-handle/);
  assert.doesNotMatch(page, /profile-drawer-stats/);
  assert.doesNotMatch(page, /profile-sync-line/);
  assert.doesNotMatch(page, /训练数据已同步/);
  assert.doesNotMatch(styles, /profile-drawer-stats/);
  assert.doesNotMatch(styles, /profile-sync-line/);
  assert.match(page, /生成后 7 天内有效，仅限 1 人注册/);
  assert.doesNotMatch(page, /邀请码 7 天内可使用 1 次/);
  assert.match(page, /logoutConfirmOpen/);
  assert.match(page, /退出当前账号？/);
  assert.match(page, /确认退出/);
  assert.match(page, /aria-describedby=\{logoutDescriptionId\}/);
  assert.match(page, /onClick=\{\(\) => void logout\(\)\}/);
  assert.match(styles, /profile-drawer \.invite-generator[^}]+background: var\(--surface-2\)/);
  assert.match(styles, /\.boot-sequence/);
  assert.match(styles, /\.kinetic-field-layer[^}]+pointer-events: none/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /app-runtime\.has-mobile-nav \.app-content \{ height: calc\(100svh - var\(--mobile-nav-height\)\)/);
  assert.match(styles, /\.today-view \{ padding-bottom: var\(--mobile-action-space\)/);
  assert.match(styles, /\.plan-view \{ padding-inline: 18px; padding-bottom: 0/);
  assert.match(styles, /\.day-editor \{ padding: 20px 0 0/);
  assert.match(styles, /\.plan-save-bar \{ bottom: 0; justify-content: center/);
  assert.match(styles, /data-header-condensed="true"\] \.today-compact-bar \{ pointer-events: auto/);
  assert.match(styles, /data-profile-header-condensed="true"\] \.profile-compact-bar \{ pointer-events: auto/);
  assert.match(styles, /data-plan-header-condensed="true"\] \.plan-compact-context \{ pointer-events: auto/);
  assert.match(styles, /\.plan-compact-weekdays button\.active\.enabled i \{ background: var\(--lime\)/);
  assert.match(styles, /\.day-status-control\.is-compact \.day-status-action \{ min-height: 32px/);
  assert.match(styles, /\.day-status-control\.is-compact \.day-status-label \{ line-height: 20px; transform: translateY\(1px\)/);
  assert.match(planTransition, /targetDayStatus\.height\) \/ 2;/);
  assert.match(trainingPlan, /sourceWeekdaysRef=\{sourceWeekdaysRef\}/);
  assert.match(trainingPlan, /targetWeekdaysRef=\{compactWeekdaysRef\}/);
  assert.match(planTransition, /querySelectorAll<HTMLElement>\("button > b"\)/);
  assert.match(planTransition, /querySelectorAll<HTMLElement>\("button > span"\)/);
  assert.match(planTransition, /querySelectorAll<HTMLElement>\("button > i"\)/);
  assert.match(planTransition, /const PLAN_HEADER_CONDENSED_THRESHOLD = 0\.72/);
  assert.match(planTransition, /const weekdayProgress = clamp\(\(progress - 0\.08\) \/ \(PLAN_HEADER_CONDENSED_THRESHOLD - 0\.08\)\)/);
  assert.match(planTransition, /const getHeaderSnapScrollTop = \(\) => Math\.ceil\([\s\S]+getCollapseDistance\(\) \* PLAN_HEADER_CONDENSED_THRESHOLD/);
  assert.doesNotMatch(trainingPlan, /plan-scroll-snap-anchor/);
  assert.doesNotMatch(styles, /scroll-snap-type/);
  assert.match(planTransition, /const contentRegion = sourceDayEditor\?\.closest<HTMLElement>\("\.plan-workspace"\)/);
  assert.match(planTransition, /scroller\.style\.overflowY = "hidden"/);
  assert.match(planTransition, /setExactScrollTop\(snapScrollTop\)/);
  assert.match(planTransition, /snapLockFrame = window\.requestAnimationFrame\(\(\) => \{[\s\S]+scroller\.scrollTop = snapScrollTop/);
  assert.match(planTransition, /scroller\.addEventListener\("touchmove", handleTouchMove, \{ passive: true \}\)/);
  assert.match(planTransition, /scroller\.addEventListener\("scroll", handleTrackedScroll, \{ passive: true \}\)/);
  assert.match(planTransition, /contentRegion\.style\.transform = `translate3d\(0, \$\{offset\.toFixed\(3\)\}px, 0\)`/);
  assert.match(planTransition, /const overshoot = touchSnapSide < 0[\s\S]+writeContentRubberBandOffset\(contentRubberBandTarget\)/);
  assert.match(planTransition, /getRubberBandDistanceForOffset\(overshoot\)/);
  assert.match(planTransition, /distance[\s\S]+viewportSize[\s\S]+CONTENT_RUBBER_BAND_COEFFICIENT[\s\S]+viewportSize[\s\S]+CONTENT_RUBBER_BAND_COEFFICIENT \* distance/);
  assert.match(planTransition, /const CONTENT_RUBBER_BAND_COEFFICIENT = 0\.46/);
  assert.match(planTransition, /const CONTENT_FORCE_PROJECTION_FREQUENCY = 5\.8/);
  assert.match(planTransition, /const CONTENT_RETURN_BASE_FREQUENCY = 9/);
  assert.match(planTransition, /const CONTENT_RETURN_INTENSITY_SLOWDOWN = 0\.22/);
  assert.match(planTransition, /const CONTENT_RETURN_DAMPING_RATIO = 0\.68/);
  assert.match(planTransition, /Math\.abs\(touchVelocity\)[\s\S]+CONTENT_FORCE_PROJECTION_FREQUENCY \* 4/);
  assert.match(planTransition, /const gestureIntensity = \([\s\S]+Math\.abs\(effectiveTouchVelocity\)[\s\S]+Math\.abs\(contentRubberBandOffset\) \/ viewportSize/);
  assert.match(planTransition, /contentReturnFrequency = CONTENT_RETURN_BASE_FREQUENCY \/ \(/);
  assert.match(planTransition, /const springAcceleration = \([\s\S]+contentReturnFrequency \* contentReturnFrequency[\s\S]+CONTENT_RETURN_DAMPING_RATIO[\s\S]+contentReturnVelocity/);
  assert.match(planTransition, /contentReturnFrame = window\.requestAnimationFrame\(stepContentReturn\)/);
  assert.doesNotMatch(planTransition, /releaseDuration|contentRegion\.animate|planScrollSnap|snapAnchor|CONTENT_RUBBER_BAND_LIMIT/);
  assert.doesNotMatch(planTransition, /playWeekdaySnapFeedback|weekdaySnapOffset/);
  assert.match(planTransition, /const compactShellTop = compactShell\?\.getBoundingClientRect\(\)\.top \?\? stickyTop/);
  assert.match(planTransition, /y: stickyTop \+ rect\.top - compactShellTop/);
  assert.match(planTransition, /const weekdayDetailsFadeEnd = window\.innerWidth <= 600 \? 1 \/ 2\.1 : 1 \/ 1\.5/);
  assert.match(planTransition, /const weekdayDotRevealProgress = smoothstep\(clamp\(\(progress - weekdayDetailsFadeEnd\) \/ 0\.1\)\)/);
  assert.match(planTransition, /writeWeekday\(element, measurements!\.sourceWeekdays\[index\], measurements!\.targetWeekdays\[index\]/);
  assert.match(planTransition, /writeWeekdayDot\(element, measurements!\.sourceWeekdays\[index\], measurements!\.targetWeekdayDots\[index\]/);
  assert.doesNotMatch(planTransition, /weekdayHandoffComplete/);
  assert.match(planTransition, /setTargetWeekdayLabelsVisibility\(false\);[\s\S]+setSharedWeekdaysVisibility\(true\);[\s\S]+setTargetWeekdaySharedTransition\(true\)/);
  assert.match(planTransition, /writeWeekdayUnderline\([\s\S]+measurements\.targetWeekdayUnderline/);
  assert.match(styles, /\.plan-shared-weekday \{ opacity: 0; white-space: nowrap; transform-origin: left top/);
  assert.match(styles, /\.plan-shared-weekday-dot \{ border-radius: 50%; opacity: 0; will-change: transform, opacity/);
  assert.match(styles, /\.plan-shared-weekday-underline \{ background: var\(--lime\); opacity: 0; will-change: transform, opacity/);
  assert.match(styles, /\.plan-compact-weekdays\[data-shared-weekdays="true"\] button\.active::after \{ opacity: 0/);
  assert.match(styles, /\.app-content \{[^}]+--compact-row-height: 56px;[^}]+--compact-leading-size: 26px;[^}]+--compact-gap: 10px/);
  assert.match(styles, /\.today-compact-bar \{[^}]+height: var\(--compact-row-height\);[^}]+gap: var\(--compact-gap\)/);
  assert.match(styles, /\.plan-compact-context \{[^}]+height: var\(--compact-row-height\);[^}]+grid-template-columns: var\(--compact-leading-size\)[^}]+gap: var\(--compact-gap\)/);
  assert.match(styles, /\.profile-compact-bar \{[^}]+height: var\(--compact-row-height\);[^}]+grid-template-columns: var\(--compact-leading-size\)[^}]+gap: var\(--compact-gap\)/);
  assert.match(styles, /\.profile-view \{ --profile-section-gap: 32px; --profile-settings-edge-offset: 10px/);
  assert.match(styles, /\.profile-compact-settings-target \{[^}]+transform: translate3d\(var\(--profile-settings-edge-offset\),0,0\)/);
  assert.match(styles, /\.profile-settings-source \{[^}]+transform: translate3d\(var\(--profile-settings-edge-offset\),0,0\)/);
  assert.match(styles, /\.app-content \{ --compact-row-height: 54px; height: 100svh/);
  assert.match(styles, /\.plan-compact-shell \{ margin-inline: 6px/);
  assert.match(styles, /\.plan-compact-shell::before \{ left: -24px; right: -24px; height: 106px/);
  assert.match(styles, /\.plan-compact-weekdays \{[^}]+margin-top: -4px/);
  assert.match(styles, /\.plan-compact-weekdays button span \{ font: 700 13px\/1 var\(--font-mono\)/);
  assert.match(styles, /\.week-rail > button > b \{ font-size: 13px/);
  assert.match(styles, /\.plan-page-header \{ min-height: 118px; padding: 2px 0 12px/);
  assert.match(styles, /\.plan-page-header h1 \{ margin-top: 10px/);
  assert.match(styles, /\.plan-compact-status \{[^}]+var\(--plan-header-collapse\) - \.12/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /\.week-rail \{ touch-action: pan-y/);
  assert.match(styles, /\.exercise-picker-options \{ touch-action: pan-y/);
  assert.match(styles, /safe-area-inset-bottom/);
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
  assert.match(pageTransition, /transitionEnd: \{ transform: "none", filter: "none", clipPath: "none" \}/);
  assert.match(planTransition, /export function PlanSharedTransition/);
  assert.match(planTransition, /--plan-header-collapse/);
  assert.match(planTransition, /kinetic-page-transition-complete/);
  assert.match(planTransition, /measurements\.scrollerTop \+ \(measurements\.compactHeight - measurements\.targetIcon\.height\) \/ 2/);
  assert.match(planTransition, /const identityProgress = smoothstep/);
  assert.match(planTransition, /const contextStartScroll = Math\.max/);
  assert.match(planTransition, /measurements\.sourceDayName\.rect\.top \+ measurements\.sourceDayName\.rect\.height \/ 2 - fixedBottom/);
  assert.match(planTransition, /--plan-context-collapse/);
  assert.match(kineticScene, /powerPreference: "high-performance"/);
  assert.match(kineticScene, /LINK_STATUS/);
  assert.match(kineticShaders, /energyRibbon/);
  assert.match(kineticIcons, /export function KineticIcon/);
  assert.match(trackSelect, /export function TrackSelect/);
  assert.match(trackSelect, /export function ExercisePicker/);
  assert.match(trackSelect, /createPortal/);
  assert.match(trackSelect, /role="listbox"/);
  assert.match(trackSelect, /event\.pointerType === "mouse"/);
  assert.match(trackSelect, /className="exercise-picker-backdrop" onClick=\{close\}/);
  assert.doesNotMatch(trackSelect, /className="exercise-picker-backdrop" onPointerDown/);
  assert.doesNotMatch(trainingPlan, /<select/);
  assert.match(trainingPlan, /<TrackSelect/);
  assert.match(trainingPlan, /<ExercisePicker/);
  assert.match(trainingPlan, /<TrainingDayStatusControl/);
  assert.doesNotMatch(trainingPlan, /className="day-toggle"/);
  assert.match(trainingPlan, /currentScrollTop \+ editorTop - scrollerTop - fixedHeight/);
  assert.match(trainingDayStatus, /role="switch"/);
  assert.match(trainingDayStatus, /aria-checked=\{enabled\}/);
  assert.match(trainingDayStatus, /createPortal/);
  assert.match(trainingDayStatus, /设为休息日/);
  assert.match(trainingDayStatus, /个动作会保留/);
  assert.match(trainingDayStatus, /className="day-status-confirm-backdrop"[^>]+onClick=/);
  assert.doesNotMatch(trainingDayStatus, /day-status-confirm-backdrop[^>]+onPointerDown=/);
  assert.match(styles, /\.day-status-track/);
  assert.match(styles, /\.day-status-confirm-backdrop/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /\.exercise-picker-backdrop/);
  assert.equal(JSON.parse(packageJson).dependencies.ogl.startsWith("^"), true);
  assert.equal(JSON.parse(packageJson).dependencies.motion.startsWith("^"), true);
  assert.match(favicon, /#C0FA4A/);
  assert.match(favicon, /#FF9138/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("训练日名称支持真实空值与统一展示回退", async () => {
  const [trainingPlan, plansRoute, serverPlans, workoutsRoute] = await Promise.all([
    readFile(new URL("components/training-plan-view.tsx", root), "utf8"),
    readFile(new URL("app/api/plans/active/route.ts", root), "utf8"),
    readFile(new URL("lib/server/plans.ts", root), "utf8"),
    readFile(new URL("app/api/workouts/route.ts", root), "utf8"),
  ]);

  assert.match(trainingPlan, /placeholder="例如：全身"/);
  assert.match(trainingPlan, /placeholder="例如：腿 \+ 胸 \+ 背"/);
  assert.doesNotMatch(plansRoute, /name: text\(row\.name, 60\) \|\| "训练日"/);
  assert.doesNotMatch(serverPlans, /\{ weekday: [2467], name: "训练日"/);
  assert.doesNotMatch(serverPlans, /\{ weekday: [2467], name: "", focus: "自定义"/);
  assert.match(serverPlans, /normalizeLegacyTrainingDayName/);
  assert.match(serverPlans, /normalizeLegacyTrainingDayFocus/);
  assert.match(workoutsRoute, /const planName = trainingDayDisplayName\(day\.name\)/);
  assert.match(workoutsRoute, /user\.id, planName, startedAt/);
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

test("爬坡训练按速度、坡度和时间保存实际数据", async () => {
  const [workoutView, styles, setsRoute, migration] = await Promise.all([
    readFile(new URL("components/active-workout-view.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/workouts/[id]/sets/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0003_nosy_dreaming_celestial.sql", root), "utf8"),
  ]);

  assert.match(workoutView, /function WorkoutMetricControl/);
  assert.match(workoutView, /className="workout-metric-name">\{label\}/);
  assert.match(workoutView, /className="workout-metric-unit">\{unit\}/);
  assert.match(workoutView, />训练提示</);
  assert.match(workoutView, />休息 \/ \{exercise\.restSeconds\} 秒</);
  assert.match(workoutView, />下一组</);
  assert.doesNotMatch(workoutView, />SETS|>TRAINING NOTE|>NEXT|REST \/| SEC</);
  assert.match(workoutView, /label="重量" unit="kg"[\s\S]+label="次数" unit="次"/);
  assert.match(workoutView, /label="左侧" unit="kg"[\s\S]+label="右侧" unit="kg"/);
  assert.match(workoutView, /label="速度" unit="km\/h"[\s\S]+step=\{0\.1\}[\s\S]+label="坡度" unit="%"[\s\S]+step=\{1\}/);
  assert.match(workoutView, /label="时间" unit=\{durationInMinutes \? "分钟" : "秒"\}/);
  assert.match(styles, /\.workout-metrics \{[^}]+grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.workout-metric:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; \}/);
  assert.match(styles, /\.workout-metric-name \{[^}]+font-size: 24px/);
  assert.match(styles, /\.workout-metric-unit \{[^}]+font-size: 14px/);
  assert.match(setsRoute, /speed_kmh, incline_percent/);
  assert.match(setsRoute, /validateInclineWalkMetrics/);
  assert.match(migration, /ADD `speed_kmh` real/);
  assert.match(migration, /ADD `incline_percent` real/);
});

test("训练页组数轨道完全由计划组数动态生成", async () => {
  const [workoutView, progressView, progressModel, styles] = await Promise.all([
    readFile(new URL("components/active-workout-view.tsx", root), "utf8"),
    readFile(new URL("components/workout-set-progress.tsx", root), "utf8"),
    readFile(new URL("lib/workout-set-progress.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(workoutView, /<WorkoutSetProgress minSets=\{exercise\.minSets\} maxSets=\{exercise\.maxSets\} completedSets=\{exercise\.sets\.length\}/);
  assert.match(progressView, /"--set-count": model\.nodes\.length/);
  assert.match(progressView, /String\(node\.setNumber\)\.padStart\(2, "0"\)/);
  assert.match(progressView, /set-progress-check-cutout/);
  assert.match(progressView, /set-progress-check-mark/);
  assert.match(progressView, /<Scan preserveAspectRatio="none" \/>/);
  assert.match(workoutView, /gridTemplateColumns: `repeat\(\$\{exercise\.maxSets\}, minmax\(0, 1fr\)\)`/);
  assert.match(progressView, /最低目标已达/);
  assert.match(progressView, /加练中/);
  assert.match(progressView, /node\.zone/);
  assert.match(progressView, /node\.state/);
  assert.match(progressModel, /mode: "single" \| "fixed" \| "range"/);
  assert.match(progressModel, /Array\.from\(\{ length: normalizedMax \}/);
  assert.match(progressModel, /setNumber <= normalizedMin \? "required" : "optional"/);
  assert.match(styles, /\.set-progress-sequence \{[^}]+repeat\(var\(--set-count\), minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.set-progress-number \{/);
  assert.match(styles, /\.workout-set-progress\.is-dense \.set-progress-number/);
  assert.match(styles, /\.workout-set-progress\.is-single \.set-progress-sequence/);
  assert.match(styles, /\.set-progress-node\.optional\.pending/);
  assert.match(styles, /\.set-progress-node\.current \.set-progress-number/);
  assert.doesNotMatch(styles, /\.next-progress \{[^}]+repeat\(4/);
  assert.doesNotMatch(styles, /\.set-track/);
});

test("计划中的单个动作最多允许六组", async () => {
  const [training, trainingPlan, planRoute, styles] = await Promise.all([
    readFile(new URL("lib/training.ts", root), "utf8"),
    readFile(new URL("components/training-plan-view.tsx", root), "utf8"),
    readFile(new URL("app/api/plans/active/route.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(training, /MAX_SETS_PER_EXERCISE = 6/);
  assert.match(trainingPlan, /value > MAX_SETS_PER_EXERCISE/);
  assert.match(trainingPlan, /单个动作建议不超过 \$\{MAX_SETS_PER_EXERCISE\} 组/);
  assert.match(trainingPlan, /rawValue\.trim\(\) === ""/);
  assert.match(trainingPlan, /set-count-advice/);
  assert.doesNotMatch(trainingPlan, /set-limit-error/);
  assert.match(planRoute, /exceedsSetLimit/);
  assert.match(planRoute, /每个动作最多 \$\{MAX_SETS_PER_EXERCISE\} 组/);
  assert.match(styles, /\.set-count-advice-backdrop/);
  assert.match(styles, /\.set-count-advice/);
  assert.doesNotMatch(styles, /\.set-limit-error/);
});

test("计划页只编辑训练目标并统一休息规则", async () => {
  const [trainingPlan, planRoute, page, styles] = await Promise.all([
    readFile(new URL("components/training-plan-view.tsx", root), "utf8"),
    readFile(new URL("app/api/plans/active/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(trainingPlan, /className="exercise-definition-summary"/);
  assert.match(trainingPlan, /<span>重量记录<\/span>/);
  assert.match(trainingPlan, /ariaLabel="重量记录"/);
  assert.doesNotMatch(trainingPlan, /<label>器械<input/);
  assert.doesNotMatch(trainingPlan, /<label>肌群<input/);
  assert.doesNotMatch(trainingPlan, /ariaLabel="记录方式"/);
  assert.doesNotMatch(trainingPlan, /<label>休息秒数/);
  assert.match(planRoute, /definition\?\.equipment \?\? text\(row\.equipment, 60\)/);
  assert.match(planRoute, /definition\?\.muscleGroup \?\? text\(row\.muscleGroup, 60\)/);
  assert.match(planRoute, /restSeconds: restSecondsForSets\(maxSets\)/);
  assert.match(page, /updatedExercise\.sets\.length >= updatedExercise\.maxSets/);
  assert.match(page, /setResting\(\{ exercise: updatedExercise, completedSet: updatedExercise\.sets\.length \}\)/);
  assert.match(styles, /\.exercise-config-row \{[^}]+grid-template-columns: minmax\(0, 1fr\) minmax\(160px, 220px\)/);
  assert.match(styles, /\.target-editor \{[^}]+grid-template-columns: repeat\(4, minmax\(82px, 1fr\)\)/);
  assert.match(styles, /\.target-editor input \{ font-size: 16px; font-weight: 600/);
});

test("备选动作入口暂时隐藏但保留数据能力", async () => {
  const [training, trainingPlan, page] = await Promise.all([
    readFile(new URL("lib/training.ts", root), "utf8"),
    readFile(new URL("components/training-plan-view.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);

  assert.match(training, /ALTERNATIVE_EXERCISES_ENABLED = false/);
  assert.match(trainingPlan, /ALTERNATIVE_EXERCISES_ENABLED && <div className="alternative-editor"/);
  assert.match(page, /ALTERNATIVE_EXERCISES_ENABLED && item\.alternativeName/);
});

test("周计划只在存在实际改动时展示保存按钮", async () => {
  const trainingPlan = await readFile(new URL("components/training-plan-view.tsx", root), "utf8");

  assert.match(trainingPlan, /\{dirty && <motion\.div className="plan-save-bar"/);
  assert.match(trainingPlan, /disabled=\{saving \|\| hasEmptyTrainingDay\}/);
});

test("计划数字输入允许清空重输且不会在聚焦时强制全选", async () => {
  const trainingPlan = await readFile(new URL("components/training-plan-view.tsx", root), "utf8");

  assert.doesNotMatch(trainingPlan, /currentTarget\.select\(\)/);
  assert.match(trainingPlan, /if \(rawValue === ""\) return/);
  assert.match(trainingPlan, /targetDrafts\[targetDraftKey\(exercise\.id, "minReps"\)\]/);
  assert.match(trainingPlan, /targetDrafts\[targetDraftKey\(exercise\.id, "minDurationSeconds"\)\]/);
});

test("训练统计使用全历史数据和计划版本口径", async () => {
  const [database, schema, plans, dashboard, page, styles] = await Promise.all([
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("lib/server/plans.ts", root), "utf8"),
    readFile(new URL("lib/server/dashboard.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(database, /CREATE TABLE IF NOT EXISTS training_plan_schedule_revisions/);
  assert.match(schema, /export const trainingPlanScheduleRevisions/);
  assert.match(plans, /ensurePlanScheduleRevision/);
  assert.match(plans, /enabledWeekdays\(input\)/);
  assert.match(dashboard, /calculateScheduledTrainingStreak/);
  assert.match(dashboard, /scheduledStreak: calculateScheduledTrainingStreak/);
  assert.match(dashboard, /countActiveWeeks/);
  assert.match(dashboard, /WITH eligible_sets AS/);
  assert.match(dashboard, /ROW_NUMBER\(\) OVER/);
  assert.match(dashboard, /strengthExerciseResult/);
  assert.match(dashboard, /strengthExerciseResult\.results\.map/);
  assert.match(dashboard, /MAX\(eligible_sets\.weight_kg \* \(1 \+ eligible_sets\.reps \/ 30\.0\)\) AS estimated_one_rep_max_kg/);
  assert.match(dashboard, /MAX\(eligible_sets\.weight_kg\) AS actual_max_weight_kg/);
  assert.match(dashboard, /estimatedOneRepMaxKg:/);
  assert.match(dashboard, /actualMaxWeightKg:/);
  assert.match(dashboard, /exercises: trendExercises/);
  assert.doesNotMatch(dashboard, /workout_sessions\.started_at >= \?/);
  assert.match(page, /全部历史训练统计/);
  assert.match(page, /按计划训练机会/);
  assert.match(page, /最高估算重量/);
  assert.doesNotMatch(page, />历史最高估算重量</);
  assert.match(page, /最高实际重量/);
  assert.doesNotMatch(page, /有记录的训练日/);
  assert.match(page, /dataKey="actualWeightKg"/);
  assert.match(page, /dataKey="estimatedOneRepMaxKg"/);
  assert.match(page, /"实际重量"/);
  assert.match(page, /"估算重量"/);
  assert.match(page, /ariaLabel="选择力量趋势动作"/);
  assert.match(page, /onChange=\{setSelectedTrendExerciseId\}/);
  assert.match(page, /暂无重量趋势/);
  assert.match(page, /绿色表示每日最高实际重量，橙色表示每日最高估算重量/);
  assert.match(page, /selectedFrequencyActivity\.volumeKg/);
  assert.match(page, /level: count > 0 \? 1 : 0/);
  assert.doesNotMatch(page, /训练记录图例|heatmap-legend/);
  assert.doesNotMatch(page, /<span>少<\/span>.+<span>多<\/span>/);
  assert.match(styles, /\.heatmap-scroll \{[^}]+overflow-x: auto/);
  assert.match(styles, /\.heatmap-year-canvas \{[^}]+--heatmap-cell: 16px/);
  assert.match(styles, /\.heatmap-cell\[data-level="1"\][^}]+background: var\(--lime\)/);
  assert.doesNotMatch(styles, /background: #455533|background: #8ab83b/);
  assert.match(styles, /\.profile-view \{ --profile-section-gap: 32px/);
  assert.match(styles, /\.frequency \{ padding: var\(--profile-section-gap\) 0 0/);
  assert.match(styles, /\.profile-progress-columns \{[^}]+padding-top: var\(--profile-section-gap\)/);
  assert.match(styles, /\.profile-global-stats \{ min-height: 0; padding: 0/);
  assert.match(styles, /grid-template-columns: 1fr; gap: var\(--profile-section-gap\); padding-top: var\(--profile-section-gap\)/);
});

test("近期训练使用三列账页布局并保持容量结果", async () => {
  const [page, recentWorkouts, historyList, styles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("components/recent-workouts-timeline.tsx", root), "utf8"),
    readFile(new URL("components/workout-history-list.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /<RecentWorkoutsTimeline/);
  assert.match(recentWorkouts, /<WorkoutHistoryList records=\{previewRecords\}/);
  assert.match(historyList, /className="session-date"/);
  assert.match(historyList, /className="session-name"/);
  assert.match(historyList, /className="session-volume"/);
  assert.match(historyList, /className="session-meta"/);
  assert.match(historyList, /className="session-volume-label">训练容量/);
  assert.match(historyList, /date\.getMonth\(\) \+ 1/);
  assert.match(historyList, /weekday\.value === \(date\.getDay\(\) \|\| 7\)/);
  assert.match(historyList, /formatNumber\(session\.volume_kg\)\} <small>kg/);
  assert.doesNotMatch(historyList, /session\.volume_kg\s*[?:]/);
  assert.doesNotMatch(page, /累计 \{dashboard\.summary\.totalWorkouts\} 次训练/);
  assert.doesNotMatch(page, /已云端同步/);
  assert.match(styles, /\.session \{ --session-accent: var\(--lime\);[^}]+min-height: 0[^}]+grid-template-columns: 56px minmax\(0, 1fr\) max-content[^}]+grid-template-rows: auto auto/);
  assert.match(styles, /\.session-name \{[^}]+font: 700 17px\/1\.25[^}]+text-wrap: pretty/);
  assert.match(styles, /\.session\.orange \{ --session-accent: var\(--orange\)/);
  assert.match(styles, /\.session\.blue \{ --session-accent: var\(--blue\)/);
  assert.match(styles, /\.session-date strong \{ color: var\(--session-accent\)/);
  assert.match(styles, /\.session-name \{[^}]+color: var\(--session-accent\)/);
  assert.match(styles, /\.session-volume \{[^}]+color: var\(--session-accent\)/);
  assert.match(styles, /\.session-meta \{[^}]+color: var\(--muted\)/);
  assert.match(styles, /\.session-volume-label \{[^}]+color: var\(--muted\)/);
  assert.match(styles, /\.session:last-child::before \{ display: none/);
});

test("近期训练预览与三分之二历史抽屉使用十条游标分页和触底自动加载", async () => {
  const [page, recentWorkouts, historyPanel, historyList, dashboard, historyQuery, historyRoute, historyContract, styles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("components/recent-workouts-timeline.tsx", root), "utf8"),
    readFile(new URL("components/workout-history-panel.tsx", root), "utf8"),
    readFile(new URL("components/workout-history-list.tsx", root), "utf8"),
    readFile(new URL("lib/server/dashboard.ts", root), "utf8"),
    readFile(new URL("lib/server/workout-history.ts", root), "utf8"),
    readFile(new URL("app/api/workouts/history/route.ts", root), "utf8"),
    readFile(new URL("lib/workout-history.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /recentWorkoutsPageInfo: WorkoutHistoryPageInfo/);
  assert.match(page, /initialPageInfo=\{dashboard\.recentWorkoutsPageInfo\}/);
  assert.match(dashboard, /INITIAL_WORKOUT_HISTORY_LIMIT/);
  assert.match(dashboard, /recentWorkoutsPageInfo: recentWorkoutPage\.pageInfo/);
  assert.doesNotMatch(dashboard, /completedSessions\.slice\(0, 20\)/);
  assert.match(historyQuery, /ORDER BY workout_sessions\.started_at DESC, workout_sessions\.id DESC/);
  assert.match(historyQuery, /LIMIT \?/);
  assert.match(historyRoute, /decodeWorkoutHistoryCursor/);
  assert.match(historyContract, /WORKOUT_HISTORY_PREVIEW_SIZE = 6/);
  assert.match(historyContract, /INITIAL_WORKOUT_HISTORY_LIMIT = 10/);
  assert.match(historyContract, /WORKOUT_HISTORY_PAGE_SIZE = 10/);
  assert.match(recentWorkouts, /查看全部训练/);
  assert.match(recentWorkouts, /initialRecords\.slice\(0, WORKOUT_HISTORY_PREVIEW_SIZE\)/);
  assert.match(recentWorkouts, /initialRecords\.length > WORKOUT_HISTORY_PREVIEW_SIZE/);
  assert.match(recentWorkouts, /<WorkoutHistoryList records=\{previewRecords\}/);
  assert.doesNotMatch(recentWorkouts, /requestWorkoutHistory/);
  assert.doesNotMatch(recentWorkouts, /is-scrollable/);
  assert.match(historyPanel, /WORKOUT_HISTORY_PAGE_SIZE/);
  assert.match(historyPanel, /search\.set\("cursor", cursor\)/);
  assert.match(historyPanel, /initialRecords\.length < INITIAL_WORKOUT_HISTORY_LIMIT/);
  assert.match(historyPanel, /requestWorkoutHistory\(null\)/);
  assert.match(historyPanel, /shouldRefreshInitialPage \? \[\] : initialRecords/);
  assert.doesNotMatch(historyPanel, /openedOnceRef/);
  assert.match(historyPanel, /AUTO_LOAD_THRESHOLD_PX = 48/);
  assert.match(historyPanel, /scrollHeight - body\.scrollTop - body\.clientHeight/);
  assert.doesNotMatch(historyPanel, /加载更早记录/);
  assert.match(historyPanel, /"connecting"/);
  assert.match(historyPanel, /MIN_LOADING_FEEDBACK_MS = 1360/);
  assert.doesNotMatch(historyPanel, /AUTO_REVEAL_MAX_PX/);
  assert.doesNotMatch(historyPanel, /addedRecordCount/);
  assert.match(historyPanel, /className="history-energy-track"/);
  assert.match(historyPanel, /className="history-loading-copy"/);
  assert.match(historyPanel, /正在读取最近的训练记录…/);
  assert.match(historyPanel, /正在追溯更早的训练记录…/);
  assert.match(historyPanel, /正在接入训练记录…/);
  assert.doesNotMatch(historyPanel, /正在读取最近 10 次训练/);
  assert.doesNotMatch(historyPanel, /正在接入[^"]*addedRecords\.length/);
  assert.match(historyPanel, /加载失败，点击重试/);
  assert.match(historyPanel, /已经追溯到最早一次训练/);
  assert.match(historyPanel, /className="workout-history-panel-body"/);
  assert.match(historyPanel, /className="workout-history-layer"/);
  assert.match(historyPanel, /event\.target !== event\.currentTarget/);
  assert.match(historyPanel, /aria-label="关闭训练历史"/);
  assert.doesNotMatch(historyPanel, /返回我的训练/);
  assert.doesNotMatch(historyPanel, /workout-history-panel-count/);
  assert.match(historyList, /newRecordIndex \* 0\.032/);
  assert.match(historyList, /filter: "blur\(2px\)"/);
  assert.match(historyList, /data-new-record-index=/);
  assert.match(page, /profileHistoryOpen/);
  assert.match(page, /profileHistoryLayerActive/);
  assert.match(page, /profileHistoryScrollTopRef/);
  assert.match(page, /appContentRef\.current\.scrollTop = profileHistoryScrollTopRef\.current/);
  assert.match(page, /inert=\{bootVisible \|\| profileHistoryLayerActive\}/);
  assert.match(page, /setProfileHistoryOpen\(false\);[\s\S]+window\.history\.back\(\)/);
  assert.match(page, /showMobileNav = view !== "workout" && Boolean\(user\);/);
  assert.doesNotMatch(page, /showMobileNav = [^;]+profileHistory/);
  assert.match(page, /dashboard && user && profileHistoryLayerActive/);
  assert.doesNotMatch(styles, /\.timeline-viewport\.is-scrollable/);
  assert.match(styles, /\.workout-history-panel-body \{[^}]+overflow-y: auto/);
  assert.match(styles, /\.workout-history-layer \{[^}]+align-items: flex-end/);
  assert.match(styles, /\.workout-history-panel \{[^}]+height: 66\.6667dvh/);
  assert.match(styles, /\.workout-history-panel-header \{[^}]+position: relative/);
  assert.match(styles, /@keyframes history-energy-trace/);
  assert.match(styles, /\.history-energy-track \{[^}]+height: 44px/);
  assert.match(styles, /translateY\(37px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce[^}]+workout-history-panel/s);
});

test("保存周计划后恢复保存前选中的星期", async () => {
  const [trainingPlan, page] = await Promise.all([
    readFile(new URL("components/training-plan-view.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);

  assert.match(trainingPlan, /onWeekdayChange\(selectedWeekday\);\s+await onSave/);
  assert.match(page, /initialWeekday=\{planWeekday\} onWeekdayChange=\{setPlanWeekday\}/);
});

test("切换到短内容休息日后按实际滚动位置退出固定栏状态", async () => {
  const transition = await readFile(new URL("components/plan-shared-transition.tsx", root), "utf8");

  assert.match(transition, /const condensedStateRef = useRef\(false\)/);
  assert.match(transition, /if \(condensedStateRef\.current === next\) return/);
  assert.doesNotMatch(transition, /let condensedState = false/);
});
