"use client";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  CircleUserRound,
  Dumbbell,
  Flame,
  History,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  Settings,
  SkipForward,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type View = "today" | "history" | "ranking" | "profile" | "workout";

type AuthUser = { id: string; username: string; displayName: string; createdAt: number };
type PlanExercise = { id: string; name: string; muscleGroup: string; target: string };
type WorkoutSummary = {
  id: string;
  plan_name: string;
  started_at: number;
  completed_at: number | null;
  duration_seconds: number;
  set_count: number;
  volume_kg: number;
};
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
  todayPlan: { id: string; name: string; summary: string; weeklyTarget: number; exercises: PlanExercise[] };
  summary: { weeklyCount: number; weeklyTarget: number; streak: number; totalWorkouts: number };
  lastSession: WorkoutSummary | null;
  activity: { date: string; count: number }[];
  recentWorkouts: WorkoutSummary[];
  trend: { exerciseId: string | null; exerciseName: string | null; points: { date: string; value: number }[] };
  leaderboard: LeaderboardEntry[];
  syncedAt: number;
};

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new ApiRequestError(payload?.error?.message ?? "请求失败，请稍后重试", response.status);
  return payload as T;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "不足 1 分钟";
  return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
}

function Brand() {
  return (
    <div className="brand" aria-label="练迹">
      <span>练</span>
      <small>TRACK</small>
    </div>
  );
}

function NavButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button className={`nav-button ${active ? "is-active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Sidebar({ view, setView, onAccount, user }: { view: View; setView: (view: View) => void; onAccount: () => void; user: AuthUser | null }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav className="side-nav" aria-label="主导航">
        <NavButton active={view === "today" || view === "workout"} label="今日" onClick={() => setView("today")} icon={<Dumbbell size={23} />} />
        <NavButton active={view === "history"} label="历史" onClick={() => setView("history")} icon={<History size={23} />} />
        <NavButton active={view === "ranking"} label="排行" onClick={() => setView("ranking")} icon={<Trophy size={23} />} />
        <NavButton active={view === "profile"} label="我的" onClick={() => setView("profile")} icon={<UserRound size={23} />} />
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
      <NavButton active={view === "today" || view === "workout"} label="今日" onClick={() => setView("today")} icon={<Dumbbell size={21} />} />
      <NavButton active={view === "history"} label="历史" onClick={() => setView("history")} icon={<History size={21} />} />
      <NavButton active={view === "ranking"} label="排行" onClick={() => setView("ranking")} icon={<Trophy size={21} />} />
      <NavButton active={view === "profile"} label="我的" onClick={() => setView("profile")} icon={<UserRound size={21} />} />
    </nav>
  );
}

function ExerciseRail({ item, index, current = false }: { item: PlanExercise; index: number; current?: boolean }) {
  return (
    <div className={`exercise-rail ${current ? "is-current" : ""}`}>
      <span className="rail-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="rail-copy">
        <strong>{item.name}</strong>
        <small>{item.muscleGroup}</small>
      </span>
      <b>{item.target}</b>
    </div>
  );
}

function TodayView({ dashboard, onStart, starting, error }: { dashboard: DashboardData; onStart: () => void; starting: boolean; error: string | null }) {
  const now = new Date();
  const dayLabel = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "2-digit", weekday: "short" }).format(now);
  const weeklyBars = Array.from({ length: dashboard.summary.weeklyTarget }, (_, index) => index < dashboard.summary.weeklyCount);
  const last = dashboard.lastSession;
  return (
    <section className="today-view page-view" data-testid="today-view">
      <header className="today-header">
        <div>
          <span className="eyebrow">{dayLabel}</span>
          <h1>今天，练{dashboard.todayPlan.name.replace(/\s*[A-Z]$/u, "")}</h1>
        </div>
        <div className="streak"><Flame size={22} /><strong>{dashboard.summary.streak}</strong><span>连续训练日</span></div>
      </header>

      <div className="today-grid">
        <div className="today-main">
          <section className="plan-hero">
            <span className="plan-letter">A</span>
            <div className="plan-copy">
              <span>今日计划</span>
              <h2>{dashboard.todayPlan.name}</h2>
              <p>{dashboard.todayPlan.summary}</p>
            </div>
            <div className="weekly-progress">
              <strong>本周 {dashboard.summary.weeklyCount} / {dashboard.summary.weeklyTarget}</strong>
              <div>{weeklyBars.map((done, index) => <i key={index} className={done ? "done" : ""} />)}</div>
            </div>
          </section>

          <section className="exercise-list">
            <div className="section-heading"><h3>今日动作</h3><span>{dashboard.todayPlan.exercises.length} 个动作</span></div>
            {dashboard.todayPlan.exercises.map((item, index) => <ExerciseRail key={item.id} item={item} index={index} current={index === 0} />)}
          </section>

          <div className="last-session">
            <span>{last ? "上次完成" : "还没有训练记录"}</span>
            <strong>{last ? `${new Date(last.completed_at!).toLocaleDateString("zh-CN")}　·　${formatDuration(last.duration_seconds).toUpperCase()}　·　${formatNumber(last.volume_kg)} KG` : "完成第一组后，轨迹会从这里开始"}</strong>
            <p>{last ? "记录已同步到你的账号" : "今天就建立第一条真实记录 →"}</p>
          </div>
        </div>

        <aside className="today-aside">
          <div className="aside-block">
            <span className="eyebrow">WEEKLY STATUS</span>
            <strong className="big-stat">{dashboard.summary.weeklyCount} / {dashboard.summary.weeklyTarget}</strong>
            <p>本周还剩 {Math.max(0, dashboard.summary.weeklyTarget - dashboard.summary.weeklyCount)} 次目标训练。</p>
            <div className="week-bars" aria-label="本周训练完成情况">
              {Array.from({ length: 7 }, (_, index) => <i key={index} className={index < dashboard.summary.weeklyCount ? "done" : ""} />)}
            </div>
          </div>
          <div className="aside-block compact-rank">
            <span className="eyebrow">FRIENDS</span>
            <h3>本周进步榜</h3>
            {dashboard.leaderboard.slice(0, 3).map((friend) => (
              <div className="mini-rank" key={friend.rank}><b>{String(friend.rank).padStart(2, "0")}</b><span>{friend.isCurrentUser ? "我" : friend.name}</span><strong>{friend.progressPercent === null ? "建基线" : `${friend.progressPercent >= 0 ? "+" : ""}${friend.progressPercent}%`}</strong></div>
            ))}
          </div>
        </aside>
      </div>

      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary-action" data-testid="start-workout" onClick={onStart} disabled={starting}><Play size={21} fill="currentColor" />{starting ? "正在同步…" : "开始训练"}</button>
    </section>
  );
}

function WorkoutView({ exercise, setIndex, startedAt, onBack, onComplete, saving, error }: { exercise: PlanExercise; setIndex: number; startedAt: number; onBack: () => void; onComplete: (weight: number, reps: number) => void; saving: boolean; error: string | null }) {
  const [weight, setWeight] = useState(55);
  const [reps, setReps] = useState(10);
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const elapsedLabel = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <section className="workout-view page-view" data-testid="workout-view">
      <header className="workout-header">
        <button onClick={onBack} aria-label="返回今日训练"><ArrowLeft /></button>
        <div><span>训练中 · 已同步</span><strong>{elapsedLabel}</strong></div>
        <button aria-label="更多操作"><MoreHorizontal /></button>
      </header>

      <div className="workout-focus">
        <div className="workout-title">
          <span className="eyebrow orange">{String(setIndex).padStart(2, "0")} / 04</span>
          <h1>{exercise.name}</h1>
          <p>中立握 · 胸椎稳定 · 肘向后收</p>
          <div className="focus-line"><i /><span>{exercise.muscleGroup}</span></div>
        </div>
        <Dumbbell className="workout-watermark" strokeWidth={1.25} />
      </div>

      <div className="metrics">
        <div className="metric">
          <span>WEIGHT</span>
          <div className="metric-control"><button aria-label="减少重量" onClick={() => setWeight((v) => Math.max(0, v - 2.5))}><Minus /></button><strong>{weight}</strong><em>kg</em><button aria-label="增加重量" onClick={() => setWeight((v) => v + 2.5)}><Plus /></button></div>
          <small>左右按钮微调</small>
        </div>
        <div className="metric">
          <span>REPS</span>
          <div className="metric-control"><button aria-label="减少次数" onClick={() => setReps((v) => Math.max(1, v - 1))}><Minus /></button><strong>{reps}</strong><em className="orange">次</em><button aria-label="增加次数" onClick={() => setReps((v) => v + 1)}><Plus /></button></div>
          <small>目标 8–12 次</small>
        </div>
      </div>

      <section className="sets-progress">
        <span className="eyebrow">SETS</span>
        <div className="set-track">
          {[1, 2, 3, 4].map((set) => <span key={set} className={set < setIndex ? "done" : set === setIndex ? "current" : ""}><i />{set}</span>)}
        </div>
      </section>

      <div className="technique"><span>TECHNIQUE</span><strong>回拉时停顿 1 秒，肩膀不要耸起</strong><small>拉时呼气 · 放时吸气</small></div>
      <div className="previous-set"><span>当前记录</span><strong>{weight} kg × {reps}</strong><b>实时保存</b><small>第 {setIndex} 组 / 共 4 组</small><em>{elapsedLabel}</em></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary-action complete-action" data-testid="complete-set" onClick={() => onComplete(weight, reps)} disabled={saving}><Check size={22} />{saving ? "正在保存…" : setIndex === 4 ? "完成训练" : "完成本组"}</button>
    </section>
  );
}

function RestOverlay({ onContinue, completedSet }: { onContinue: () => void; completedSet: number }) {
  const [seconds, setSeconds] = useState(88);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value <= 1 ? 90 : value - 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="rest-overlay" role="dialog" aria-modal="true" aria-label="休息计时" data-testid="rest-overlay">
      <div className="rest-top"><span>SET {String(completedSet).padStart(2, "0")} COMPLETE · 已同步</span><small>点击下方按钮可提前继续</small></div>
      <div className="timer-ring"><strong>{time}</strong><span>REST / 90 SEC</span><Activity size={22} /></div>
      <div className="next-set">
        <span>NEXT SET</span><h2>坐姿划船 · 第 {completedSet + 1} 组</h2><strong>保持刚才的节奏</strong><p>动作质量优先，重量可在下一组调整</p>
        <div className="next-progress"><i /><i /><i /><i /></div>
      </div>
      <button className="primary-action" data-testid="continue-workout" onClick={onContinue}><Play size={21} fill="currentColor" />提前开始下一组</button>
      <button className="text-action" onClick={onContinue}><SkipForward size={15} />跳过休息</button>
    </div>
  );
}

function Heatmap({ activity }: { activity: DashboardData["activity"] }) {
  const cells = useMemo(() => {
    const counts = new Map(activity.map((entry) => [entry.date, entry.count]));
    return Array.from({ length: 364 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (363 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return Math.min(3, counts.get(key) ?? 0);
    });
  }, [activity]);
  return <div className="heatmap" aria-label="2026 年训练热力图">{cells.map((level, index) => <i key={index} data-level={level} />)}</div>;
}

function HistoryView({ dashboard }: { dashboard: DashboardData }) {
  const [period, setPeriod] = useState("年度");
  const trendData = dashboard.trend.points.map((point) => ({ date: point.date.slice(5).replace("-", "."), value: point.value }));
  const currentStrength = trendData.at(-1)?.value ?? 0;
  const activeWeeks = new Set(dashboard.activity.map((entry) => {
    const date = new Date(`${entry.date}T00:00:00`);
    date.setDate(date.getDate() - ((date.getDay() || 7) - 1));
    return date.toISOString().slice(0, 10);
  })).size;
  return (
    <section className="history-view page-view" data-testid="history-view">
      <header className="page-header">
        <div><span className="eyebrow">HISTORY / PROGRESS</span><h1>历史与进步</h1><p>看见训练留下的轨迹，而不只是今天的数字</p></div>
        <div className="year"><CalendarDays size={20} /><strong>{new Date().getFullYear()}</strong><small>{new Date(dashboard.syncedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 同步</small></div>
      </header>
      <section className="frequency">
        <div className="section-heading"><div><h2>训练频率</h2><p>每一个方格代表一天</p></div><div className="period-tabs">{["年度", "12 周", "4 周"].map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></div>
        <div className="heatmap-row"><div><div className="months">{["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((m) => <span key={m}>{m}</span>)}</div><Heatmap activity={dashboard.activity} /></div><div className="frequency-stats"><div><strong>{dashboard.summary.totalWorkouts}</strong><span>次训练</span></div><div><b>{activeWeeks}</b><span>活跃周</span><b className="orange">{dashboard.summary.streak}</b><span>当前连续</span></div></div></div>
      </section>
      <div className="history-columns">
        <section className="timeline"><div className="section-heading"><h2>近期训练</h2><span>真实记录</span></div>{dashboard.recentWorkouts.length ? dashboard.recentWorkouts.map((session, index) => { const date = new Date(session.started_at); return <div className={`session ${["lime", "orange", "blue"][index % 3]}`} key={session.id}><i /><time><strong>{String(date.getDate()).padStart(2, "0")}</strong><small>{date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</small></time><div><h3>{session.plan_name}</h3><p>{session.set_count} 组 · {formatDuration(session.duration_seconds)}</p><b>{formatNumber(session.volume_kg)} kg</b></div></div>; }) : <div className="data-empty"><History size={26} /><strong>还没有训练记录</strong><p>完成第一组后，这里会形成你的训练时间线。</p></div>}<footer><span>累计 {dashboard.summary.totalWorkouts} 次训练</span><b>云端同步</b></footer></section>
        <section className="trend">
          <div className="section-heading"><h2>力量趋势</h2><button>{dashboard.trend.exerciseName || "等待记录"} <ChevronDown size={14} /></button></div>
          <div className="trend-stats"><div><span>当前估算 1RM</span><strong>{currentStrength ? formatNumber(currentStrength) : "--"} <em>kg</em></strong></div><div><b>{trendData.length}</b><span>有效记录点</span></div><div><b className="orange">真实</b><span>训练组数据</span></div></div>
          <div className="chart-wrap">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}><CartesianGrid stroke="#29302c" vertical={false} /><XAxis dataKey="date" stroke="#66706b" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" /><YAxis domain={["dataMin - 5", "dataMax + 5"]} stroke="#66706b" tickLine={false} axisLine={false} fontSize={10} /><Tooltip contentStyle={{ background: "#121613", border: "1px solid #303733", borderRadius: 4 }} /><Line type="monotone" dataKey="value" stroke="#c0fa4a" strokeWidth={3} dot={{ r: 3, fill: "#c0fa4a", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ff9138" }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <div className="data-empty chart-empty"><Activity size={26} /><strong>等待力量轨迹</strong><p>记录同一动作的重量与次数后自动生成。</p></div>}</div>
          <p className="chart-note">基于每组重量与次数估算，减少体重和初始力量差异影响</p>
        </section>
        <Leaderboard entries={dashboard.leaderboard} compact />
      </div>
    </section>
  );
}

function Leaderboard({ entries, compact = false }: { entries: LeaderboardEntry[]; compact?: boolean }) {
  const tones = ["lime", "orange", "blue", "purple"];
  return (
    <section className={`leaderboard ${compact ? "compact" : ""}`}>
      <div className="section-heading"><div><h2>好友进步榜</h2><p>按相对力量进步率与训练稳定性综合排名</p></div><span>近 8 周</span></div>
      <div className="rank-list">{entries.length ? entries.map((friend, index) => <div className={`rank-row ${tones[index % tones.length]}`} key={`${friend.rank}-${friend.name}`}><b>{String(friend.rank).padStart(2, "0")}</b><div><strong>{friend.isCurrentUser ? `${friend.name}（我）` : friend.name}</strong><span>{friend.progressPercent === null ? "建立基线中" : `${friend.progressPercent >= 0 ? "+" : ""}${friend.progressPercent}%`}</span><div className="rank-track"><i style={{ width: `${Math.max(5, friend.score)}%` }} /></div><small>稳定性 {friend.stability} · 综合分 {friend.score}</small></div></div>) : <div className="data-empty"><Trophy size={26} /><strong>榜单等待第一条记录</strong><p>邀请朋友并开始训练后，这里会按个人进步公平排名。</p></div>}</div>
      <footer><span>RANKING METHOD</span><p>相对进步 70% · 稳定性 30%</p></footer>
    </section>
  );
}

function RankingView({ entries }: { entries: LeaderboardEntry[] }) {
  return <section className="ranking-view page-view"><header className="page-header"><div><span className="eyebrow">FRIENDS / RANKING</span><h1>公平地看见进步</h1><p>不比较起点，只比较每个人相对自己的成长。</p></div><Trophy className="header-icon" /></header><div className="ranking-layout"><Leaderboard entries={entries} /><aside className="ranking-method"><span className="eyebrow">HOW IT WORKS</span><h2>不直接按重量排名</h2><p>性别、体重、初始力量都会影响绝对重量。练迹使用前后两个 28 天窗口的个人力量变化和训练稳定性计算榜单。</p><dl><div><dt>70%</dt><dd>相对力量进步</dd></div><div><dt>30%</dt><dd>训练稳定性</dd></div></dl></aside></div></section>;
}

function ProfileView({ dashboard, onAccount }: { dashboard: DashboardData; onAccount: () => void }) {
  const me = dashboard.leaderboard.find((entry) => entry.isCurrentUser);
  const joinedDays = Math.max(1, Math.floor((dashboard.syncedAt - dashboard.user.createdAt) / (24 * 60 * 60 * 1000)) + 1);
  return <section className="profile-view page-view"><header className="page-header"><div><span className="eyebrow">PROFILE / SETTINGS</span><h1>我的训练档案</h1><p>管理账号、同步状态和好友邀请码。</p></div><Settings className="header-icon" /></header><div className="profile-grid"><div className="profile-identity"><CircleUserRound size={72} /><div><span>@{dashboard.user.username}</span><h2>{dashboard.user.displayName}</h2><p>连续训练 {dashboard.summary.streak} 天 · 加入 {joinedDays} 天</p></div></div><div className="profile-stats"><div><strong>{dashboard.summary.totalWorkouts}</strong><span>累计训练</span></div><div><strong>{me?.stability ?? 0}</strong><span>稳定性评分</span></div><div><strong>{me?.progressPercent === null || me?.progressPercent === undefined ? "--" : `${me.progressPercent}%`}</strong><span>近 28 天进步</span></div></div><button className="secondary-action" onClick={onAccount}>账号与邀请码</button></div></section>;
}

function AccountDialog({ user, onClose, onAuthenticated, onLoggedOut }: { user: AuthUser | null; onClose: () => void; onAuthenticated: (user: AuthUser) => void; onLoggedOut: () => void }) {
  const [registering, setRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

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
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST", body: "{}" });
      onLoggedOut();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "退出失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => user && event.target === event.currentTarget && onClose()}>
      <div className="account-dialog" role="dialog" aria-modal="true" aria-label={user ? "账号与邀请码" : registering ? "注册练迹账号" : "登录练迹"}>
        {user && <button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button>}
        <Brand />
        {user ? <div className="account-panel">
          <span className="eyebrow">SYNCED ACCOUNT</span>
          <h2>{user.displayName}</h2>
          <p>@{user.username} · 训练数据已使用云端账号同步</p>
          <div className="invite-generator">
            <span>好友邀请码</span>
            {inviteCode ? <><strong>{inviteCode}</strong><small>7 天内可使用 1 次，原始码仅在这里显示。</small><button className="secondary-action" onClick={() => navigator.clipboard?.writeText(inviteCode)}>复制邀请码</button></> : <button className="primary-action" onClick={createInvite} disabled={submitting}>{submitting ? "正在创建…" : "生成一次性邀请码"}</button>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="text-action logout-action" onClick={logout} disabled={submitting}>退出当前账号</button>
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
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("today");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<{ id: string; startedAt: number } | null>(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [resting, setResting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadDashboard() {
    setDashboardError(null);
    try {
      setDashboard(await apiRequest<DashboardData>("/api/dashboard"));
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
        if (result.user) await loadDashboard();
      })
      .catch(() => { setUser(null); setAccountOpen(true); })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function startWorkout() {
    if (!dashboard) return;
    setSaving(true);
    setWorkoutError(null);
    try {
      const result = await apiRequest<{ workout: { id: string; startedAt: number } }>("/api/workouts", {
        method: "POST",
        body: JSON.stringify({ planName: dashboard.todayPlan.name }),
      });
      setActiveWorkout(result.workout);
      setCurrentSet(1);
      setView("workout");
    } catch (requestError) {
      setWorkoutError(requestError instanceof Error ? requestError.message : "训练创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveSet(weight: number, reps: number) {
    if (!activeWorkout || !dashboard) return;
    setSaving(true);
    setWorkoutError(null);
    try {
      const exercise = dashboard.todayPlan.exercises[0];
      await apiRequest(`/api/workouts/${activeWorkout.id}/sets`, {
        method: "POST",
        body: JSON.stringify({ exerciseId: exercise.id, exerciseName: exercise.name, muscleGroup: exercise.muscleGroup, setIndex: currentSet, weightKg: weight, reps }),
      });
      if (currentSet === 4) {
        await apiRequest(`/api/workouts/${activeWorkout.id}/complete`, {
          method: "POST",
          body: JSON.stringify({ durationSeconds: Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 1000)) }),
        });
        setActiveWorkout(null);
        setView("today");
        setNotice("训练完成，记录已同步");
        await loadDashboard();
      } else {
        setResting(true);
      }
    } catch (requestError) {
      setWorkoutError(requestError instanceof Error ? requestError.message : "本组保存失败");
    } finally {
      setSaving(false);
    }
  }

  function continueWorkout() {
    setCurrentSet((value) => value + 1);
    setResting(false);
  }

  const content = checkingSession ? <div className="screen-state"><Activity size={28} /><strong>正在恢复训练轨迹</strong><p>检查账号和云端同步状态…</p></div>
    : !user ? <div className="screen-state"><UserRound size={28} /><strong>登录后开始训练</strong><p>账号入口已打开。</p></div>
    : dashboardError ? <div className="screen-state"><Activity size={28} /><strong>同步暂时失败</strong><p>{dashboardError}</p><button className="secondary-action" onClick={loadDashboard}>重新同步</button></div>
    : !dashboard ? <div className="screen-state"><Activity size={28} /><strong>正在读取真实数据</strong></div>
    : view === "today" ? <TodayView dashboard={dashboard} onStart={startWorkout} starting={saving} error={workoutError} />
    : view === "workout" && activeWorkout ? <WorkoutView exercise={dashboard.todayPlan.exercises[0]} setIndex={currentSet} startedAt={activeWorkout.startedAt} onBack={() => setView("today")} onComplete={saveSet} saving={saving} error={workoutError} />
    : view === "history" ? <HistoryView dashboard={dashboard} />
    : view === "ranking" ? <RankingView entries={dashboard.leaderboard} />
    : <ProfileView dashboard={dashboard} onAccount={() => setAccountOpen(true)} />;

  return (
    <main className="app-shell">
      <Sidebar view={view} setView={setView} onAccount={() => setAccountOpen(true)} user={user} />
      <div className="app-content">{content}</div>
      {view !== "workout" && user && <MobileNav view={view} setView={setView} />}
      {resting && <RestOverlay completedSet={currentSet} onContinue={continueWorkout} />}
      {(accountOpen || !user) && !checkingSession && <AccountDialog user={user} onClose={() => setAccountOpen(false)} onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); setAccountOpen(false); setDashboard(null); void loadDashboard(); }} onLoggedOut={() => { setUser(null); setDashboard(null); setAccountOpen(true); setView("today"); }} />}
      {notice && <div className="sync-toast" role="status"><Check size={18} />{notice}</div>}
    </main>
  );
}
