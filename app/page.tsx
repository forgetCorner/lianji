"use client";

import {
  Activity,
  Award,
  Check,
  CircleAlert,
  Crown,
  Medal,
  Settings,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ALTERNATIVE_EXERCISES_ENABLED, targetLabel, trainingDayDisplayName, weekdays } from "@/lib/training";
import type { ActiveWorkout, PlanExercise, TodayWorkoutState, TrainingDay, TrainingPlan, WorkoutExercise } from "@/lib/training";
import { nextShanghaiMidnight } from "@/lib/daily-workout-domain";
import { TrainingPlanView } from "@/components/training-plan-view";
import { ActiveWorkoutView, WorkoutRestOverlay } from "@/components/active-workout-view";
import type { SetInput } from "@/components/active-workout-view";
import { AppBootSequence } from "@/components/app-boot-sequence";
import type { BootPhase } from "@/components/app-boot-sequence";
import { TrackMark, TrainingStatusMark, WeekStatusIcon } from "@/components/track-visuals";
import { KineticField } from "@/components/kinetic-field";
import type { KineticIntensity, KineticMode } from "@/lib/visual/kinetic-scene";
import { KineticIcon } from "@/components/kinetic-icons";
import { KineticPageTransition } from "@/components/kinetic-page-transition";
import { TodaySharedTransition } from "@/components/today-shared-transition";
import { ProfileSharedTransition } from "@/components/profile-shared-transition";
import { TrackSelect } from "@/components/track-select";
import { RecentWorkoutsTimeline } from "@/components/recent-workouts-timeline";
import { WorkoutHistoryPanel } from "@/components/workout-history-panel";
import type { WorkoutHistoryPageInfo, WorkoutSummary } from "@/lib/workout-history";

type View = "today" | "plan" | "ranking" | "profile" | "workout";
type ExerciseSelections = Record<string, "primary" | "alternative">;
const menuViews: View[] = ["today", "plan", "ranking", "profile"];
const WORKOUT_HISTORY_STATE_KEY = "__lianjiWorkoutHistory";

type AuthUser = { id: string; username: string; displayName: string; createdAt: number };
type LeaderboardEntry = {
  rank: number;
  name: string;
  progressPercent: number | null;
  stability: number;
  score: number;
  baselineStatus: "ready" | "building";
  isCurrentUser: boolean;
};
type DashboardData = {
  user: AuthUser;
  plan: TrainingPlan;
  todayPlan: TrainingDay | null;
  summary: { weeklyCount: number; weeklyTarget: number; scheduledStreak: number; totalWorkouts: number; activeWeeks: number };
  lastSession: WorkoutSummary | null;
  activity: { date: string; count: number; volumeKg: number; planNames: string[] }[];
  recentWorkouts: WorkoutSummary[];
  recentWorkoutsPageInfo: WorkoutHistoryPageInfo;
  trend: {
    exerciseId: string | null;
    exerciseName: string | null;
    points: {
      date: string;
      estimatedOneRepMaxKg: number;
      actualMaxWeightKg: number;
    }[];
    exercises: {
      exerciseId: string;
      exerciseName: string;
      points: {
        date: string;
        estimatedOneRepMaxKg: number;
        actualMaxWeightKg: number;
      }[];
    }[];
  };
  leaderboard: LeaderboardEntry[];
  syncedAt: number;
};

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) throw new ApiRequestError(payload?.error?.message ?? "请求失败，请稍后重试", response.status, payload?.error?.code);
  return payload as T;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
}

const chineseMonths = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Brand() {
  return (
    <div className="brand" aria-label="练迹">
      <TrackMark className="brand-symbol" state="active" />
      <small>TRACK</small>
    </div>
  );
}

function NavButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: "today" | "plan" | "ranking" | "profile" }) {
  return (
    <button className={`nav-button ${active ? "is-active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <KineticIcon kind={icon} active={active} size={24} />
      <span>{label}</span>
    </button>
  );
}

function Sidebar({ view, setView, onAccount, user }: { view: View; setView: (view: View) => void; onAccount: () => void; user: AuthUser | null }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav className="side-nav" aria-label="主导航">
        <NavButton active={view === "today" || view === "workout"} label="今日" onClick={() => setView("today")} icon="today" />
        <NavButton active={view === "plan"} label="计划" onClick={() => setView("plan")} icon="plan" />
        <NavButton active={view === "ranking"} label="排行" onClick={() => setView("ranking")} icon="ranking" />
        <NavButton active={view === "profile"} label="我的" onClick={() => setView("profile")} icon="profile" />
      </nav>
      <button className="account-shortcut" onClick={onAccount} aria-label="账号设置">
        <span>{user?.displayName.slice(0, 2).toUpperCase() || "--"}</span>
        <small>{user?.displayName || "账号"}</small>
      </button>
    </aside>
  );
}

function MobileNav({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <nav className="mobile-nav" aria-label="移动端主导航">
      <NavButton active={view === "today" || view === "workout"} label="今日" onClick={() => setView("today")} icon="today" />
      <NavButton active={view === "plan"} label="计划" onClick={() => setView("plan")} icon="plan" />
      <NavButton active={view === "ranking"} label="排行" onClick={() => setView("ranking")} icon="ranking" />
      <NavButton active={view === "profile"} label="我的" onClick={() => setView("profile")} icon="profile" />
    </nav>
  );
}

function ExerciseRail({ item, index, state = "pending" }: { item: PlanExercise; index: number; state?: "pending" | "current" | "complete" }) {
  return (
    <div className={`exercise-rail is-${state}`}>
      <span className="rail-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="rail-copy">
        <strong>{item.name}</strong>
        <small>{item.muscleGroup}</small>
      </span>
      <b>{targetLabel(item)}</b>
    </div>
  );
}

function TodayView({ dashboard, activeWorkout, scrollerRef, selections, setSelections, onPlan, error }: { dashboard: DashboardData; activeWorkout: ActiveWorkout | null; scrollerRef: RefObject<HTMLDivElement | null>; selections: ExerciseSelections; setSelections: Dispatch<SetStateAction<ExerciseSelections>>; onPlan: () => void; error: string | null }) {
  const now = new Date();
  const dayLabel = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "2-digit", weekday: "short" }).format(now);
  const weeklyBars = Array.from({ length: dashboard.summary.weeklyTarget }, (_, index) => index < dashboard.summary.weeklyCount);
  const weeklyProgressColumns = Math.max(1, weeklyBars.length);
  const plan = dashboard.todayPlan;
  const sourceDateRef = useRef<HTMLTimeElement>(null);
  const sourceIconRef = useRef<HTMLDivElement>(null);
  const sourceTitleRef = useRef<HTMLSpanElement>(null);
  const targetIconRef = useRef<HTMLSpanElement>(null);
  const targetPrefixRef = useRef<HTMLSpanElement>(null);
  const targetTitleRef = useRef<HTMLSpanElement>(null);
  const enabledDays = dashboard.plan.days.filter((day) => day.enabled);
  const planName = plan ? trainingDayDisplayName(plan.name) : "没有固定训练";
  const letter = plan ? (planName.match(/[A-Z]$/u)?.[0] ?? planName.slice(0, 1)) : null;
  const currentWorkoutExercise = activeWorkout?.exercises.find((exercise) => !exercise.completedAt) ?? null;
  const workoutExercisesByPlanId = new Map(activeWorkout?.exercises.filter((exercise) => exercise.planExerciseId).map((exercise) => [exercise.planExerciseId!, exercise]) ?? []);

  return (
    <section className="today-view page-view" data-testid="today-view">
      <div className="today-compact-shell" aria-hidden="true">
        <div className="today-compact-bar">
          <span ref={targetIconRef} className="today-compact-icon-target" />
          <span className="today-compact-copy-target"><span ref={targetPrefixRef}>{dayLabel}</span><span ref={targetTitleRef}>{planName}</span></span>
        </div>
      </div>
      <header className="today-header">
        <div className="today-date"><KineticIcon kind="today" active size={18} /><time ref={sourceDateRef}>{dayLabel}</time></div>
      </header>

      <div className="today-grid">
        <div className="today-main">
          <section className="plan-hero">
            <div ref={sourceIconRef} className="training-status-slot"><TrainingStatusMark planLetter={letter} /></div>
            <div className="plan-copy">
              <div className="plan-kicker-row">
                <span>{plan ? "今日计划" : "恢复日"}</span>
                <div className="plan-streak"><KineticIcon kind="streak" active size={17} /><strong>{dashboard.summary.scheduledStreak}</strong><span>连续完成</span></div>
              </div>
              <h2><span ref={sourceTitleRef}>{planName}</span></h2>
              <p>{plan ? `${plan.focus} · ${plan.exercises.length} 个动作` : "今天没有安排计划训练，让身体恢复，为下一次训练做好准备。"}</p>
            </div>
            <div className="weekly-progress">
              <strong>本周 {dashboard.summary.weeklyCount} / {dashboard.summary.weeklyTarget}</strong>
              <div style={{ gridTemplateColumns: `repeat(${weeklyProgressColumns}, minmax(0, 1fr))` }}>
                {weeklyBars.map((done, index) => <i key={index} className={done ? "done" : ""} />)}
              </div>
            </div>
          </section>

          <section className="exercise-list">
            <div className="section-heading"><div className="heading-with-symbol"><KineticIcon kind="plan" active size={18} /><h3>{plan ? "今日动作" : "本周计划"}</h3></div><button className="text-action" onClick={onPlan}>编辑周计划</button></div>
            {plan ? plan.exercises.map((item, index) => {
              const workoutExercise = workoutExercisesByPlanId.get(item.id);
              const state = workoutExercise?.completedAt ? "complete" : workoutExercise && currentWorkoutExercise?.id === workoutExercise.id ? "current" : "pending";
              return <div key={item.id}>
                <ExerciseRail item={item} index={index} state={state} />
                {ALTERNATIVE_EXERCISES_ENABLED && item.alternativeName && <div className="alternative-choice" aria-label={`${item.name}备选动作`}><span>本次选择</span><button className={selections[item.id] !== "alternative" ? "active" : ""} onClick={() => setSelections((value) => ({ ...value, [item.id]: "primary" }))}>{item.name}</button><button className={selections[item.id] === "alternative" ? "active" : ""} onClick={() => setSelections((value) => ({ ...value, [item.id]: "alternative" }))}>{item.alternativeName}</button></div>}
              </div>;
            }) : enabledDays.map((day) => <div className="free-plan-row is-readonly" key={day.id}><span>{weekdays.find((item) => item.value === day.weekday)?.label}</span><strong>{trainingDayDisplayName(day.name)}</strong><small>{day.focus} · {day.exercises.length} 个动作</small></div>)}
          </section>

        </div>

        <aside className="today-aside">
          <div className="aside-block">
            <div className="aside-label"><WeekStatusIcon /><span className="eyebrow">WEEKLY STATUS</span></div>
            <strong className="big-stat">{dashboard.summary.weeklyCount} / {dashboard.summary.weeklyTarget}</strong>
            <p>本周还剩 {Math.max(0, dashboard.summary.weeklyTarget - dashboard.summary.weeklyCount)} 次目标训练。</p>
            <div className="week-bars" aria-label="本周训练完成情况">
              {Array.from({ length: 7 }, (_, index) => <i key={index} className={index < dashboard.summary.weeklyCount ? "done" : ""} />)}
            </div>
          </div>
          <div className="aside-block compact-rank">
            <div className="aside-label"><KineticIcon kind="friends" size={17} /><span className="eyebrow">FRIENDS</span></div>
            <h3>本周进步榜</h3>
            {dashboard.leaderboard.slice(0, 3).map((friend) => (
              <div className="mini-rank" key={friend.rank}><b>{String(friend.rank).padStart(2, "0")}</b><span>{friend.isCurrentUser ? "我" : friend.name}</span><strong>{friend.progressPercent === null ? "建基线" : `${friend.progressPercent >= 0 ? "+" : ""}${friend.progressPercent}%`}</strong></div>
            ))}
          </div>
        </aside>
      </div>

      <TodaySharedTransition dateLabel={dayLabel} planName={planName} planLetter={letter} scrollerRef={scrollerRef} sourceDateRef={sourceDateRef} sourceIconRef={sourceIconRef} sourceTitleRef={sourceTitleRef} targetIconRef={targetIconRef} targetPrefixRef={targetPrefixRef} targetTitleRef={targetTitleRef} />

      {error && <p className="inline-error" role="alert">{error}</p>}
    </section>
  );
}

function Heatmap({
  activity,
  year,
  syncedAt,
  selectedDate,
  onSelectDate,
}: {
  activity: DashboardData["activity"];
  year: number;
  syncedAt: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const referenceNowRef = useRef(syncedAt);
  const suppressClickRef = useRef(false);
  const dragRef = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, dragged: false });
  const { cells, monthLabels, columnCount } = useMemo(() => {
    const counts = new Map(activity.map((entry) => [entry.date, entry.count]));
    const today = new Date(syncedAt);
    today.setHours(23, 59, 59, 999);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const leadingDays = (start.getDay() || 7) - 1;
    const nextCells = Array.from({ length: leadingDays }, (_, index) => ({
      key: `leading-${index}`,
      date: "",
      count: 0,
      level: 0,
      future: false,
      empty: true,
    }));
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const key = toDateKey(date);
      const count = counts.get(key) ?? 0;
      nextCells.push({ key, date: key, count, level: count > 0 ? 1 : 0, future: date > today, empty: false });
    }
    const labels = chineseMonths.map((label, month) => {
      const elapsedDays = Math.round((Date.UTC(year, month, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
      return { label, column: Math.floor((leadingDays + elapsedDays) / 7) + 1 };
    });
    return {
      cells: nextCells,
      monthLabels: labels,
      columnCount: Math.ceil(nextCells.length / 7),
    };
  }, [activity, syncedAt, year]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const now = new Date(referenceNowRef.current);
    const targetDate = year === now.getFullYear()
      ? new Date((new Date(year, Math.max(0, now.getMonth() - 3), now.getDate()).getTime() + now.getTime()) / 2)
      : new Date(year, 10, 15);
    const start = new Date(year, 0, 1);
    const leadingDays = (start.getDay() || 7) - 1;
    const elapsedDays = Math.max(0, Math.floor((Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()) - Date.UTC(year, 0, 1)) / 86_400_000));
    const targetColumn = Math.floor((leadingDays + elapsedDays) / 7);
    const targetX = targetColumn * 20 + 8;
    scroller.scrollLeft = Math.max(0, Math.min(scroller.scrollWidth - scroller.clientWidth, targetX - scroller.clientWidth / 2));
  }, [year]);

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current.pointerId !== event.pointerId) return;
    suppressClickRef.current = dragRef.current.dragged;
    dragRef.current.pointerId = -1;
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  const gridStyle = { "--heatmap-columns": columnCount } as React.CSSProperties;
  return (
    <div
      ref={scrollRef}
      className="heatmap-scroll"
      tabIndex={0}
      aria-label={`${year} 年训练频率，可横向拖动查看`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          scrollLeft: event.currentTarget.scrollLeft,
          dragged: false,
        };
        if (event.pointerType === "mouse") {
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add("is-dragging");
        }
      }}
      onPointerMove={(event) => {
        if (dragRef.current.pointerId !== event.pointerId) return;
        const distance = event.clientX - dragRef.current.startX;
        if (Math.abs(distance) > 7) dragRef.current.dragged = true;
        if (event.pointerType === "mouse" && dragRef.current.dragged) {
          event.preventDefault();
          event.currentTarget.scrollLeft = dragRef.current.scrollLeft - distance;
        }
      }}
      onScroll={(event) => {
        if (
          dragRef.current.pointerId !== -1
          && Math.abs(event.currentTarget.scrollLeft - dragRef.current.scrollLeft) > 3
        ) {
          dragRef.current.dragged = true;
        }
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="heatmap-year-canvas" style={gridStyle}>
        <div className="heatmap-axis" aria-hidden="true">{monthLabels.map((item) => <span key={`${item.label}-${item.column}`} style={{ gridColumn: item.column }}>{item.label}</span>)}</div>
        <div className="heatmap" aria-label={`${year} 年训练频率`}>
          {cells.map((cell) => (
            <button
              key={cell.key}
              type="button"
              className="heatmap-cell"
              data-empty={cell.empty || undefined}
              data-level={cell.level}
              data-future={cell.future || undefined}
              data-selected={cell.date === selectedDate || undefined}
              disabled={cell.empty || cell.future || cell.count === 0}
              aria-label={cell.empty ? undefined : `${cell.date}，${cell.count} 次训练`}
              aria-pressed={cell.date === selectedDate}
              title={cell.empty ? undefined : `${cell.date} · ${cell.count} 次训练`}
              onClick={() => onSelectDate(cell.date)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileView({
  dashboard,
  scrollerRef,
  accountOpen,
  onAccount,
  onOpenHistory,
  historyTriggerRef,
}: {
  dashboard: DashboardData;
  scrollerRef: RefObject<HTMLDivElement | null>;
  accountOpen: boolean;
  onAccount: () => void;
  onOpenHistory: () => void;
  historyTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const currentYear = new Date(dashboard.syncedAt).getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedFrequencyDate, setSelectedFrequencyDate] = useState<string | null>(null);
  const [selectedTrendExerciseId, setSelectedTrendExerciseId] = useState(dashboard.trend.exerciseId ?? "");
  const [showRmRule, setShowRmRule] = useState(false);
  const rmRuleRef = useRef<HTMLDivElement>(null);
  const sourceAvatarRef = useRef<HTMLSpanElement>(null);
  const sourceTitleRef = useRef<HTMLHeadingElement>(null);
  const sourceSettingsRef = useRef<HTMLSpanElement>(null);
  const targetAvatarRef = useRef<HTMLSpanElement>(null);
  const targetTitleRef = useRef<HTMLSpanElement>(null);
  const targetSettingsRef = useRef<HTMLSpanElement>(null);
  const initials = dashboard.user.displayName.slice(0, 2).toUpperCase();
  const syncLabel = `${new Date(dashboard.syncedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 已同步`;
  const selectedYearNumber = Number(selectedYear);
  const yearOptions = useMemo(() => {
    const years = new Set(dashboard.activity.map((entry) => entry.date.slice(0, 4)));
    years.add(String(currentYear));
    return [...years]
      .sort((left, right) => Number(right) - Number(left))
      .map((year) => ({ value: year, label: `${year} 年` }));
  }, [currentYear, dashboard.activity]);
  const selectedActivity = dashboard.activity.filter((entry) => entry.date.startsWith(`${selectedYear}-`));
  const latestActiveDate = selectedActivity
    .filter((entry) => entry.count > 0)
    .map((entry) => entry.date)
    .sort()
    .at(-1) ?? null;
  const effectiveFrequencyDate = selectedFrequencyDate && selectedActivity.some((entry) => entry.date === selectedFrequencyDate && entry.count > 0)
    ? selectedFrequencyDate
    : latestActiveDate;
  const selectedFrequencyActivity = effectiveFrequencyDate
    ? selectedActivity.find((entry) => entry.date === effectiveFrequencyDate)
    : null;
  const selectedFrequencyPlan = selectedFrequencyActivity?.planNames[0] ?? "";
  const selectedFrequencyDescription = selectedFrequencyActivity
    ? `${selectedFrequencyPlan}${selectedFrequencyActivity.count > 1 ? ` 等 ${selectedFrequencyActivity.count} 次` : ""} · ${formatNumber(selectedFrequencyActivity.volumeKg)} kg`
    : "";
  const selectedFrequencyDateLabel = effectiveFrequencyDate
    ? new Date(`${effectiveFrequencyDate}T00:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
    : "";
  const selectedTrend = dashboard.trend.exercises.find((exercise) => exercise.exerciseId === selectedTrendExerciseId)
    ?? dashboard.trend.exercises[0]
    ?? { exerciseId: "", exerciseName: "", points: dashboard.trend.points };
  const trendExerciseOptions = dashboard.trend.exercises.map((exercise) => ({
    value: exercise.exerciseId,
    label: exercise.exerciseName,
    description: exercise.points.length ? `${exercise.points.length} 个力量记录日` : "暂无重量趋势",
  }));
  const trendData = selectedTrend.points.map((point) => ({
    date: point.date.slice(5).replace("-", "."),
    actualWeightKg: point.actualMaxWeightKg,
    estimatedOneRepMaxKg: point.estimatedOneRepMaxKg,
  }));
  const historicalEstimatedOneRepMax = Math.max(
    0,
    ...selectedTrend.points.map((point) => point.estimatedOneRepMaxKg),
  );
  const historicalActualMaxWeight = Math.max(
    0,
    ...selectedTrend.points.map((point) => point.actualMaxWeightKg),
  );
  useEffect(() => {
    if (!showRmRule) return;
    const dismiss = () => setShowRmRule(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!rmRuleRef.current?.contains(event.target as Node)) dismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("touchmove", dismiss, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("touchmove", dismiss);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [showRmRule]);
  return (
    <section className="profile-view page-view" data-testid="profile-view">
      <div className="profile-compact-shell" aria-hidden="true">
        <div className="profile-compact-bar">
          <span ref={targetAvatarRef} className="profile-compact-avatar-target" />
          <span ref={targetTitleRef} className="profile-compact-title-target">我的训练</span>
          <span ref={targetSettingsRef} className="profile-compact-settings-target" />
        </div>
      </div>
      <header className="profile-hero-header">
        <div className="profile-hero-identity">
          <span ref={sourceAvatarRef} className="profile-hero-avatar">{initials}</span>
          <div className="profile-hero-copy"><h1 ref={sourceTitleRef}>我的训练</h1><p>查看训练频率、记录与力量变化。</p></div>
        </div>
        <div className="profile-hero-meta"><span ref={sourceSettingsRef} className="profile-settings-source" aria-hidden="true"><Settings size={18} /></span><span className="profile-sync-status"><i aria-hidden="true" />{syncLabel}</span></div>
      </header>
      <ProfileSharedTransition initials={initials} scrollerRef={scrollerRef} sourceAvatarRef={sourceAvatarRef} sourceTitleRef={sourceTitleRef} sourceSettingsRef={sourceSettingsRef} targetAvatarRef={targetAvatarRef} targetTitleRef={targetTitleRef} targetSettingsRef={targetSettingsRef} suspended={accountOpen} onAccount={onAccount} />
      <section className="profile-global-stats" aria-label="全部历史训练统计">
        <div><span>累计训练</span><strong>{dashboard.summary.totalWorkouts}</strong><small>全部已完成记录</small></div>
        <div><span>连续完成</span><strong>{dashboard.summary.scheduledStreak}</strong><small>按计划训练机会</small></div>
        <div><span>活跃周数</span><strong>{dashboard.summary.activeWeeks}</strong><small>有训练的自然周</small></div>
      </section>
      <section className="frequency">
        <div className="section-heading frequency-heading">
          <div className="frequency-heading-copy">
            <h2>训练频率</h2>
            <p>一年训练节奏，一眼看清</p>
          </div>
          <div className="frequency-year-control">
            <TrackSelect ariaLabel="选择训练年份" value={selectedYear} options={yearOptions} popupMinWidth={104} onChange={(year) => {
              setSelectedYear(year);
              setSelectedFrequencyDate(null);
            }} />
          </div>
        </div>
        <div className="heatmap-panel">
          <Heatmap activity={dashboard.activity} year={selectedYearNumber} syncedAt={dashboard.syncedAt} selectedDate={effectiveFrequencyDate} onSelectDate={setSelectedFrequencyDate} />
          {effectiveFrequencyDate && (
            <div className="frequency-selected-summary">
              <span><i aria-hidden="true" />{selectedFrequencyDateLabel}</span>
              <strong title={selectedFrequencyDescription}>{selectedFrequencyDescription}</strong>
            </div>
          )}
        </div>
      </section>
      <div className="profile-progress-columns">
        <RecentWorkoutsTimeline
          key={`${dashboard.user.id}-${dashboard.syncedAt}`}
          initialRecords={dashboard.recentWorkouts}
          initialPageInfo={dashboard.recentWorkoutsPageInfo}
          onOpenHistory={onOpenHistory}
          openTriggerRef={historyTriggerRef}
        />
        <section className="trend">
          <div className="section-heading"><div ref={rmRuleRef} className="trend-heading-title"><h2>力量趋势</h2><div className="rm-rule"><button type="button" className="rm-rule-trigger" aria-label="查看估算重量计算规则" aria-expanded={showRmRule} aria-controls="rm-rule-popover" onClick={() => setShowRmRule((visible) => !visible)}><CircleAlert size={15} /></button></div>{showRmRule && <><i className="rm-rule-pointer" aria-hidden="true" /><div id="rm-rule-popover" className="rm-rule-popover" role="dialog" aria-label="估算重量计算规则"><strong>估算重量如何计算</strong><p>训练重量 ×（1 + 次数 ÷ 30）</p><small>例如：20 kg 做 12 次，估算结果约为 28 kg。摘要取该动作的最高实际重量与最高估算重量；下方双曲线按训练日对照展示两项数据。</small></div></>}</div><div className="trend-exercise-control"><TrackSelect ariaLabel="选择力量趋势动作" value={selectedTrend.exerciseId} options={trendExerciseOptions} popupMinWidth={180} disabled={!trendExerciseOptions.length} onChange={setSelectedTrendExerciseId} /></div></div>
          <div className="trend-stats"><div><strong>{historicalActualMaxWeight ? formatNumber(historicalActualMaxWeight) : "--"} <em>kg</em></strong><span>最高实际重量</span></div><div><strong className="orange">{historicalEstimatedOneRepMax ? formatNumber(historicalEstimatedOneRepMax) : "--"} <em>kg</em></strong><span>最高估算重量</span></div><div><strong className="trend-mode">双线</strong><span>实际与估算重量对照</span></div></div>
          <div className="chart-wrap">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}><CartesianGrid stroke="#29302c" vertical={false} /><XAxis dataKey="date" stroke="#66706b" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" /><YAxis domain={["dataMin - 5", "dataMax + 5"]} stroke="#66706b" tickLine={false} axisLine={false} fontSize={10} /><Tooltip formatter={(value, name) => [`${formatNumber(Number(value))} kg`, name]} labelFormatter={(label) => `训练日期 ${label}`} contentStyle={{ background: "#121613", border: "1px solid #303733", borderRadius: 4 }} /><Line type="monotone" dataKey="actualWeightKg" name="实际重量" stroke="#c0fa4a" strokeWidth={3} dot={{ r: 3, fill: "#c0fa4a", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#c0fa4a" }} isAnimationActive={false} /><Line type="monotone" dataKey="estimatedOneRepMaxKg" name="估算重量" stroke="#ff9138" strokeWidth={3} dot={{ r: 3, fill: "#ff9138", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ff9138" }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <div className="data-empty chart-empty"><Activity size={26} /><strong>等待力量趋势</strong><p>记录同一动作的重量与次数后自动生成。</p></div>}</div>
          <p className="chart-note">绿色表示每日最高实际重量，橙色表示每日最高估算重量</p>
        </section>
      </div>
    </section>
  );
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown aria-hidden="true" size={13} strokeWidth={2.2} />;
    if (rank === 2) return <Medal aria-hidden="true" size={13} strokeWidth={2.2} />;
    if (rank === 3) return <Award aria-hidden="true" size={13} strokeWidth={2.2} />;
    return null;
  };
  const rankTone = (rank: number) => rank <= 3 ? `rank-${rank}` : "rank-default";
  return (
    <section className="leaderboard">
      <div className="section-heading"><div><h2>好友进步榜</h2><p>按相对力量进步率与训练稳定性综合排名</p></div><span>近 8 周</span></div>
      <div className="rank-list">{entries.length ? entries.map((friend) => (
        <div className={`rank-row ${rankTone(friend.rank)}`} key={`${friend.rank}-${friend.name}`}>
          <div className="rank-position">{rankIcon(friend.rank)}<b>{String(friend.rank).padStart(2, "0")}</b></div>
          <div className="rank-copy">
            <strong>{friend.isCurrentUser ? `${friend.name}（我）` : friend.name}</strong>
            <span className="rank-status">{friend.progressPercent === null ? "建立基线中" : `${friend.progressPercent >= 0 ? "+" : ""}${friend.progressPercent}%`}</span>
            <div className="rank-track"><i style={{ width: `${Math.max(5, friend.score)}%` }} /></div>
            <small>稳定性 {friend.stability} · 综合分 {friend.score}</small>
          </div>
        </div>
      )) : <div className="data-empty"><Trophy size={26} /><strong>榜单等待第一条记录</strong><p>邀请朋友并开始训练后，这里会按个人进步公平排名。</p></div>}</div>
      <footer><span>RANKING METHOD</span><p>相对进步 70% · 稳定性 30%</p></footer>
    </section>
  );
}

function RankingView({ entries }: { entries: LeaderboardEntry[] }) {
  return <section className="ranking-view page-view"><header className="page-header"><div><span className="eyebrow">FRIENDS / RANKING</span><h1>公平地看见进步</h1><p>不比较起点，只比较每个人相对自己的成长。</p></div><KineticIcon kind="ranking" active size={52} className="header-icon" /></header><div className="ranking-layout"><Leaderboard entries={entries} /><aside className="ranking-method"><span className="eyebrow">HOW IT WORKS</span><h2>不直接按重量排名</h2><p>性别、体重、初始力量都会影响绝对重量。练迹使用前后两个 28 天窗口的个人力量变化和训练稳定性计算榜单。</p><dl><div><dt>70%</dt><dd>相对力量进步</dd></div><div><dt>30%</dt><dd>训练稳定性</dd></div></dl></aside></div></section>;
}

function AccountDialog({ user, dashboard, onClose, onAuthenticated, onLoggedOut }: { user: AuthUser | null; dashboard: DashboardData | null; onClose: () => void; onAuthenticated: (user: AuthUser) => void; onLoggedOut: () => void }) {
  const [registering, setRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const logoutTitleId = useId();
  const logoutDescriptionId = useId();
  const logoutTriggerRef = useRef<HTMLButtonElement>(null);
  const logoutCancelRef = useRef<HTMLButtonElement>(null);
  const logoutConfirmRef = useRef<HTMLButtonElement>(null);
  const logoutInFlightRef = useRef(false);
  const joinedDays = user ? Math.max(1, Math.floor(((dashboard?.syncedAt ?? user.createdAt) - user.createdAt) / (24 * 60 * 60 * 1000)) + 1) : 0;
  const profileInitials = user?.displayName.slice(0, 2).toUpperCase() ?? "";

  useEffect(() => {
    if (!logoutConfirmOpen) return;
    const logoutTrigger = logoutTriggerRef.current;
    const focusFrame = window.requestAnimationFrame(() => logoutConfirmRef.current?.focus({ preventScroll: true }));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !logoutInFlightRef.current) {
        event.preventDefault();
        setLogoutConfirmOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const first = logoutCancelRef.current;
      const last = logoutConfirmRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (logoutTrigger?.isConnected) logoutTrigger.focus({ preventScroll: true });
    };
  }, [logoutConfirmOpen]);

  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ user: AuthUser }>(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: form.get("username"), password: form.get("password"), inviteCode: form.get("invite") }),
      });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "账号请求失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function createInvite() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{ invite: { code: string } }>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ label: "好友邀请", maxUses: 1, expiresDays: 7 }),
      });
      setInviteCode(result.invite.code);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "邀请码创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    logoutInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST", body: "{}" });
      onLoggedOut();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "退出失败");
    } finally {
      logoutInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  async function copyInvite() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("复制失败，请手动复制邀请码");
    }
  }

  return (
    <div className={`modal-backdrop ${user ? "profile-backdrop" : ""}`} role="presentation" onClick={(event) => user && event.target === event.currentTarget && onClose()}>
      <div className={`account-dialog ${user ? "profile-drawer" : ""}`} role="dialog" aria-modal="true" aria-hidden={logoutConfirmOpen || undefined} inert={logoutConfirmOpen} aria-label={user ? "个人档案与账号设置" : registering ? "注册练迹账号" : "登录练迹"}>
        {user && <button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button>}
        {!user && <Brand />}
        {user ? <div className="account-panel">
          <div className="profile-sheet-handle" aria-hidden="true" />
          <div className="profile-drawer-header"><span className="profile-avatar" aria-hidden="true">{profileInitials}</span><div><h2>{user.displayName}</h2><p>@{user.username} · 加入练迹 {joinedDays} 天</p></div></div>
          <div className="invite-generator">
            <div><strong>邀请朋友加入</strong><span>生成后 7 天内有效，仅限 1 人注册</span></div>
            {inviteCode ? <div className="invite-result"><code>{inviteCode}</code><button className="secondary-action" onClick={copyInvite}>{copied ? "已复制" : "复制邀请码"}</button><small>原始邀请码仅在这里显示，请及时发送给朋友。</small></div> : <button className="primary-action" onClick={createInvite} disabled={submitting}>{submitting ? "正在创建…" : "生成一次性邀请码"}</button>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button ref={logoutTriggerRef} className="text-action logout-action" onClick={() => { setError(null); setLogoutConfirmOpen(true); }} disabled={submitting}>退出当前账号</button>
        </div> : <>
          <span className="eyebrow">{registering ? "INVITE ONLY" : "WELCOME BACK"}</span>
          <h2>{registering ? "用邀请码加入练迹" : "继续你的训练轨迹"}</h2>
          <p className="account-intro">登录后，你在手机和电脑上的训练记录会保持一致。</p>
          <form onSubmit={submitAccount}>
            <label>用户名<input name="username" required autoComplete="username" placeholder="输入用户名" /></label>
            <label>密码<input name="password" required minLength={8} type="password" autoComplete={registering ? "new-password" : "current-password"} placeholder="至少 8 位" /></label>
            {registering && <label>邀请码<input name="invite" required placeholder="例如 LJ-XXXX-XXXXXXXX" /></label>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-action" type="submit" disabled={submitting}>{submitting ? "请稍候…" : registering ? "注册并开始同步" : "登录"}</button>
          </form>
          <button className="text-action" onClick={() => { setRegistering((value) => !value); setError(null); }}>{registering ? "已有账号，直接登录" : "没有账号？使用邀请码注册"}</button>
        </>}
      </div>
      {logoutConfirmOpen && (
        <div
          className="day-status-confirm-backdrop logout-confirm-backdrop"
          role="presentation"
          onClick={(event) => {
            if (!submitting && event.target === event.currentTarget) setLogoutConfirmOpen(false);
          }}
        >
          <section
            className="day-status-confirm logout-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby={logoutTitleId}
            aria-describedby={logoutDescriptionId}
          >
            <h2 id={logoutTitleId}>退出当前账号？</h2>
            <p id={logoutDescriptionId}>退出后需要重新登录，才能继续查看和记录训练。</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="day-status-confirm-actions">
              <button ref={logoutCancelRef} type="button" className="secondary-action" onClick={() => setLogoutConfirmOpen(false)} disabled={submitting}>取消</button>
              <button ref={logoutConfirmRef} type="button" className="primary-action logout-confirm-action" onClick={() => void logout()} disabled={submitting}>{submitting ? "正在退出…" : "确认退出"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const appContentRef = useRef<HTMLDivElement>(null);
  const profileHistoryScrollTopRef = useRef(0);
  const profileHistoryTriggerRef = useRef<HTMLButtonElement>(null);
  const profileHistorySnapshotRef = useRef<string | null>(null);
  const [todayActionRoot, setTodayActionRoot] = useState<HTMLDivElement | null>(null);
  const [todaySelections, setTodaySelections] = useState<ExerciseSelections>({});
  const [planWeekday, setPlanWeekday] = useState<number | null>(null);
  const [view, setView] = useState<View>("today");
  const [profileHistoryOpen, setProfileHistoryOpen] = useState(false);
  const [profileHistoryLayerActive, setProfileHistoryLayerActive] =
    useState(false);
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [bootRequestPhase, setBootRequestPhase] = useState<"checking" | "syncing">("checking");
  const [bootVisible, setBootVisible] = useState(true);
  const [brandLanded, setBrandLanded] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [todayWorkoutStatus, setTodayWorkoutStatus] = useState<TodayWorkoutState["status"]>("not_started");
  const [resting, setResting] = useState<{ exercise: WorkoutExercise; completedSet: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [visualPulse, setVisualPulse] = useState(0);
  const dashboardHistoryKey = dashboard
    ? `${dashboard.user.id}-${dashboard.syncedAt}`
    : null;

  const navigateView = useCallback((nextView: View) => {
    if (nextView === view) return;
    const currentMenuView = view === "workout" ? "today" : view;
    const currentIndex = menuViews.indexOf(currentMenuView);
    const nextIndex = menuViews.indexOf(nextView);
    if (currentIndex >= 0 && nextIndex >= 0 && currentIndex !== nextIndex) setPageDirection(nextIndex > currentIndex ? 1 : -1);
    setView(nextView);
  }, [view]);

  const openProfileHistory = useCallback(() => {
    if (!dashboardHistoryKey) return;
    profileHistoryScrollTopRef.current = appContentRef.current?.scrollTop ?? 0;
    profileHistorySnapshotRef.current = dashboardHistoryKey;
    const currentState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    if (!currentState[WORKOUT_HISTORY_STATE_KEY]) {
      window.history.pushState(
        { ...currentState, [WORKOUT_HISTORY_STATE_KEY]: true },
        "",
      );
    }
    setProfileHistoryLayerActive(true);
    setProfileHistoryOpen(true);
  }, [dashboardHistoryKey]);

  const closeProfileHistory = useCallback(() => {
    const currentState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    setProfileHistoryOpen(false);
    if (currentState[WORKOUT_HISTORY_STATE_KEY]) {
      window.history.back();
      return;
    }
  }, []);

  const handleProfileHistoryExited = useCallback(() => {
    if (appContentRef.current) {
      appContentRef.current.scrollTop = profileHistoryScrollTopRef.current;
    }
    setProfileHistoryLayerActive(false);
    if (view === "profile") {
      requestAnimationFrame(() => profileHistoryTriggerRef.current?.focus());
    }
  }, [view]);

  async function loadDashboard(resumeWorkout = false) {
    setDashboardError(null);
    try {
      const [nextDashboard, activeResult] = await Promise.all([
        apiRequest<DashboardData>("/api/dashboard"),
        apiRequest<TodayWorkoutState>("/api/workouts/active"),
      ]);
      setDashboard(nextDashboard);
      setActiveWorkout(activeResult.workout);
      setTodayWorkoutStatus(activeResult.status);
      if (resumeWorkout && activeResult.status === "in_progress" && activeResult.workout?.exercises.some((exercise) => !exercise.completedAt)) setView("workout");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        setUser(null);
        setAccountOpen(true);
      } else {
        setDashboardError(requestError instanceof Error ? requestError.message : "数据同步失败");
      }
    }
  }

  useEffect(() => {
    apiRequest<{ user: AuthUser | null }>("/api/auth/me")
      .then(async (result) => {
        setUser(result.user);
        setAccountOpen(!result.user);
        if (result.user) {
          setBootRequestPhase("syncing");
          await loadDashboard(true);
        }
      })
      .catch(() => { setUser(null); setAccountOpen(true); })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const handlePopState = () => {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      if (!currentState[WORKOUT_HISTORY_STATE_KEY]) {
        setProfileHistoryOpen(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!profileHistoryLayerActive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [profileHistoryLayerActive]);

  useEffect(() => {
    if (!profileHistoryOpen) {
      return;
    }
    const invalidHistoryContext =
      view !== "profile" ||
      !user ||
      !dashboardHistoryKey ||
      profileHistorySnapshotRef.current !== dashboardHistoryKey;
    if (!invalidHistoryContext) return;

    const frame = requestAnimationFrame(() => {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? { ...window.history.state }
          : {};
      delete currentState[WORKOUT_HISTORY_STATE_KEY];
      window.history.replaceState(currentState, "");
      setProfileHistoryOpen(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [dashboardHistoryKey, profileHistoryOpen, user, view]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      setResting(null);
      setView("today");
      void loadDashboard();
    }, Math.max(1_000, nextShanghaiMidnight() - Date.now() + 500));
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    appContentRef.current?.style.setProperty("--header-collapse", "0");
    appContentRef.current?.style.setProperty("--profile-header-collapse", "0");
    appContentRef.current?.style.setProperty("--plan-header-collapse", "0");
    appContentRef.current?.style.setProperty("--plan-context-collapse", "0");
    if (appContentRef.current) appContentRef.current.dataset.headerCondensed = "false";
    if (appContentRef.current) appContentRef.current.dataset.profileHeaderCondensed = "false";
    if (appContentRef.current) appContentRef.current.dataset.planHeaderCondensed = "false";
    if (appContentRef.current) appContentRef.current.dataset.planContextCondensed = "false";
    appContentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  async function startWorkout(dayId: string, selections: Record<string, "primary" | "alternative"> = {}) {
    if (!dashboard) return;
    if (todayWorkoutStatus === "in_progress" && activeWorkout) {
      setView("workout");
      return;
    }
    if (todayWorkoutStatus === "completed") return;
    setSaving(true);
    setWorkoutError(null);
    try {
      const result = await apiRequest<TodayWorkoutState>("/api/workouts", {
        method: "POST",
        body: JSON.stringify({ planDayId: dayId, selections }),
      });
      setActiveWorkout(result.workout);
      setTodayWorkoutStatus(result.status);
      if (result.status === "in_progress" && result.workout) setView("workout");
    } catch (requestError) {
      setWorkoutError(requestError instanceof Error ? requestError.message : "训练创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function completeWorkout(workout: ActiveWorkout) {
    setActiveWorkout(workout);
    setTodayWorkoutStatus("completed");
    setResting(null);
    setView("today");
    setNotice("训练完成，全部动作已同步");
    setVisualPulse((value) => value + 1);
    await loadDashboard();
  }

  async function advanceAfterExercise(workout: ActiveWorkout) {
    setActiveWorkout(workout);
    setResting(null);
    if (!workout.exercises.some((exercise) => !exercise.completedAt)) await completeWorkout(workout);
  }

  async function finishExercise(exerciseId: string, skipped = false) {
    if (!activeWorkout) return;
    setSaving(true);
    setWorkoutError(null);
    try {
      const result = await apiRequest<{ workout: ActiveWorkout }>(`/api/workouts/${activeWorkout.id}/exercises/${exerciseId}/complete`, {
        method: "POST",
        body: JSON.stringify({ skipped }),
      });
      await advanceAfterExercise(result.workout);
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === "WORKOUT_FINALIZED") {
        setResting(null);
        setView("today");
        await loadDashboard();
        return;
      }
      setWorkoutError(requestError instanceof Error ? requestError.message : "动作状态更新失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveSet(input: SetInput) {
    if (!activeWorkout) return;
    setSaving(true);
    setWorkoutError(null);
    try {
      const result = await apiRequest<{ workout: ActiveWorkout }>(`/api/workouts/${activeWorkout.id}/sets`, { method: "POST", body: JSON.stringify(input) });
      const updatedExercise = result.workout.exercises.find((exercise) => exercise.id === input.workoutExerciseId);
      setActiveWorkout(result.workout);
      if (!updatedExercise) throw new Error("训练动作同步失败");
      if (updatedExercise.sets.length >= updatedExercise.maxSets) {
        const completed = await apiRequest<{ workout: ActiveWorkout }>(`/api/workouts/${activeWorkout.id}/exercises/${updatedExercise.id}/complete`, { method: "POST", body: JSON.stringify({ skipped: false }) });
        await advanceAfterExercise(completed.workout);
      } else {
        setResting({ exercise: updatedExercise, completedSet: updatedExercise.sets.length });
      }
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === "WORKOUT_FINALIZED") {
        setResting(null);
        setView("today");
        await loadDashboard();
        return;
      }
      setWorkoutError(requestError instanceof Error ? requestError.message : "本组保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function savePlan(plan: TrainingPlan) {
    setSaving(true);
    setWorkoutError(null);
    try {
      const result = await apiRequest<{ plan: TrainingPlan; todayWorkout: TodayWorkoutState }>("/api/plans/active", { method: "PUT", body: JSON.stringify(plan) });
      setDashboard((current) => current ? { ...current, plan: result.plan } : current);
      setActiveWorkout(result.todayWorkout.workout);
      setTodayWorkoutStatus(result.todayWorkout.status);
      setNotice("周计划已保存并同步");
      setVisualPulse((value) => value + 1);
      await loadDashboard();
    } catch (requestError) {
      setWorkoutError(requestError instanceof Error ? requestError.message : "计划保存失败");
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  const currentWorkoutExercise = activeWorkout?.exercises.find((exercise) => !exercise.completedAt && !exercise.removedFromPlanAt) ?? null;
  const finishBoot = useCallback(() => {
    setBootVisible(false);
    setBrandLanded(true);
  }, []);
  const bootPhase: BootPhase = checkingSession
    ? bootRequestPhase
    : dashboardError && user && !dashboard
      ? "error"
      : !user || dashboard
        ? "ready"
        : "syncing";
  const kineticMode: KineticMode = bootVisible
    ? "boot"
    : resting
      ? "rest"
      : view === "profile"
        ? "profile"
        : view;
  const kineticIntensity: KineticIntensity = dashboardError || workoutError
    ? "error"
    : notice
      ? "success"
      : saving || view === "workout"
        ? "active"
        : "idle";
  const kineticProgress = dashboard?.summary.weeklyTarget
    ? dashboard.summary.weeklyCount / dashboard.summary.weeklyTarget
    : 0;

  async function retryBoot() {
    setBootRequestPhase("syncing");
    await loadDashboard(true);
  }

  const todayPlan = dashboard?.todayPlan ?? null;
  const todayFloatingAction = view === "today" && todayPlan
    ? todayWorkoutStatus === "completed"
      ? <button className="primary-action today-completed-action" type="button" disabled><Check size={21} />今日训练已完成</button>
      : <button className="primary-action" data-testid="start-workout" onClick={todayWorkoutStatus === "in_progress" && activeWorkout ? () => setView("workout") : () => startWorkout(todayPlan!.id, todaySelections)} disabled={saving}><KineticIcon kind="start" active size={22} />{saving ? "正在同步…" : todayWorkoutStatus === "in_progress" && activeWorkout ? `继续 ${currentWorkoutExercise?.selectedName ?? currentWorkoutExercise?.name ?? activeWorkout.planName}` : "开始训练"}</button>
    : null;

  const content = checkingSession ? <div className="screen-state"><Activity size={28} /><strong>正在恢复训练轨迹</strong><p>检查账号和云端同步状态…</p></div>
    : !user ? <div className="screen-state"><UserRound size={28} /><strong>登录后开始训练</strong><p>账号入口已打开。</p></div>
    : dashboardError ? <div className="screen-state"><Activity size={28} /><strong>同步暂时失败</strong><p>{dashboardError}</p><button className="secondary-action" onClick={() => void loadDashboard()}>重新同步</button></div>
    : !dashboard ? <div className="screen-state"><Activity size={28} /><strong>正在读取真实数据</strong></div>
    : view === "today" ? <TodayView dashboard={dashboard} activeWorkout={activeWorkout} scrollerRef={appContentRef} selections={todaySelections} setSelections={setTodaySelections} onPlan={() => navigateView("plan")} error={workoutError} />
    : view === "plan" ? <TrainingPlanView key={dashboard.plan.version} plan={dashboard.plan} scrollerRef={appContentRef} initialWeekday={planWeekday} onWeekdayChange={setPlanWeekday} onSave={savePlan} saving={saving} error={workoutError} />
    : view === "workout" && activeWorkout && currentWorkoutExercise ? <ActiveWorkoutView workout={activeWorkout} exercise={currentWorkoutExercise} onBack={() => setView("today")} onSaveSet={saveSet} onFinishExercise={(skipped) => finishExercise(currentWorkoutExercise.id, skipped)} saving={saving} error={workoutError} />
    : view === "ranking" ? <RankingView entries={dashboard.leaderboard} />
    : <ProfileView dashboard={dashboard} scrollerRef={appContentRef} accountOpen={accountOpen} onAccount={() => setAccountOpen(true)} onOpenHistory={openProfileHistory} historyTriggerRef={profileHistoryTriggerRef} />;
  const showMobileNav = view !== "workout" && Boolean(user);

  return (
    <main className={`app-shell ${brandLanded ? "boot-arrived" : ""} ${profileHistoryLayerActive ? "is-history-open" : ""}`.trim()}>
      <KineticField mode={kineticMode} intensity={kineticIntensity} progress={kineticProgress} pulseKey={visualPulse} />
      <div className={`app-runtime ${bootVisible ? "boot-active" : ""} ${showMobileNav ? "has-mobile-nav" : ""}`.trim()} inert={bootVisible || profileHistoryLayerActive} aria-hidden={bootVisible || profileHistoryLayerActive ? true : undefined}>
        <div ref={setTodayActionRoot} className="today-action-root" />
        <Sidebar view={view} setView={navigateView} onAccount={() => setAccountOpen(true)} user={user} />
        <div ref={appContentRef} className={`app-content ${view === "workout" ? "is-workout" : ""}`.trim()}>
          {view === "workout" ? content : <KineticPageTransition pageKey={`${view}-${checkingSession ? "checking" : user ? "ready" : "guest"}`} direction={pageDirection} suspended={bootVisible} floatingAction={todayFloatingAction} floatingRoot={todayActionRoot}>{content}</KineticPageTransition>}
        </div>
        {showMobileNav && <MobileNav view={view} setView={navigateView} />}
        {resting && <WorkoutRestOverlay exercise={resting.exercise} completedSet={resting.completedSet} onContinue={() => setResting(null)} onFinish={() => finishExercise(resting.exercise.id)} />}
        {(accountOpen || !user) && !checkingSession && <AccountDialog user={user} dashboard={dashboard} onClose={() => setAccountOpen(false)} onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); setAccountOpen(false); setDashboard(null); void loadDashboard(); }} onLoggedOut={() => { setUser(null); setDashboard(null); setActiveWorkout(null); setTodayWorkoutStatus("not_started"); setAccountOpen(true); setView("today"); }} />}
        {notice && <div className="sync-toast" role="status"><Check size={18} />{notice}</div>}
      </div>
      {dashboard && user && profileHistoryLayerActive && (
        <WorkoutHistoryPanel
          key={`${dashboard.user.id}-${dashboard.syncedAt}`}
          open={profileHistoryOpen && view === "profile"}
          initialRecords={dashboard.recentWorkouts}
          initialPageInfo={dashboard.recentWorkoutsPageInfo}
          snapshotKey={dashboard.syncedAt}
          onRequestClose={closeProfileHistory}
          onExited={handleProfileHistoryExited}
        />
      )}
      {bootVisible && <AppBootSequence phase={bootPhase} error={dashboardError} onRetry={() => void retryBoot()} onFinished={finishBoot} />}
    </main>
  );
}
