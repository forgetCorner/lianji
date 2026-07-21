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

const exercises = [
  { id: 1, name: "坐姿划船", muscle: "背部 · 器械", target: "3×10–12" },
  { id: 2, name: "深蹲", muscle: "腿部 · 杠铃", target: "4×8–10" },
  { id: 3, name: "哑铃卧推", muscle: "胸部 · 哑铃", target: "3×10" },
];

const trendData = [
  { date: "05.25", value: 84 },
  { date: "06.01", value: 88 },
  { date: "06.08", value: 92 },
  { date: "06.15", value: 94 },
  { date: "06.22", value: 99 },
  { date: "06.29", value: 103 },
  { date: "07.06", value: 104 },
  { date: "07.13", value: 108 },
  { date: "07.20", value: 112.5 },
];

const sessions = [
  { day: "17", month: "JUL", name: "全身 A", meta: "3 动作 · 42 分钟", volume: "2,840 kg", tone: "lime" },
  { day: "14", month: "JUL", name: "上肢力量", meta: "4 动作 · 51 分钟", volume: "3,420 kg", tone: "orange" },
  { day: "11", month: "JUL", name: "全身 B", meta: "3 动作 · 39 分钟", volume: "2,610 kg", tone: "blue" },
];

const friends = [
  { rank: "01", name: "阿森", score: "+12.4%", stability: 94, width: 100, tone: "lime" },
  { rank: "02", name: "我", score: "+8.7%", stability: 92, width: 81, tone: "orange" },
  { rank: "03", name: "小北", score: "+7.9%", stability: 81, width: 71, tone: "blue" },
  { rank: "04", name: "老周", score: "+5.1%", stability: 88, width: 53, tone: "purple" },
];

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

function Sidebar({ view, setView, onAccount }: { view: View; setView: (view: View) => void; onAccount: () => void }) {
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
        <span>AM</span>
        <small>我的</small>
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

function ExerciseRail({ item, current = false }: { item: (typeof exercises)[number]; current?: boolean }) {
  return (
    <div className={`exercise-rail ${current ? "is-current" : ""}`}>
      <span className="rail-index">{String(item.id).padStart(2, "0")}</span>
      <span className="rail-copy">
        <strong>{item.name}</strong>
        <small>{item.muscle}</small>
      </span>
      <b>{item.target}</b>
    </div>
  );
}

function TodayView({ onStart }: { onStart: () => void }) {
  return (
    <section className="today-view page-view" data-testid="today-view">
      <header className="today-header">
        <div>
          <span className="eyebrow">20 JUL · 周一</span>
          <h1>今天，练全身</h1>
        </div>
        <div className="streak"><Flame size={22} /><strong>12</strong><span>连续训练</span></div>
      </header>

      <div className="today-grid">
        <div className="today-main">
          <section className="plan-hero">
            <span className="plan-letter">A</span>
            <div className="plan-copy">
              <span>今日计划</span>
              <h2>全身 A</h2>
              <p>腿 + 胸 + 背 · 约 45 分钟</p>
            </div>
            <div className="weekly-progress">
              <strong>本周 2 / 3</strong>
              <div><i /><i /><i /></div>
            </div>
          </section>

          <section className="exercise-list">
            <div className="section-heading"><h3>今日动作</h3><span>3 个动作</span></div>
            {exercises.map((item, index) => <ExerciseRail key={item.id} item={item} current={index === 0} />)}
          </section>

          <div className="last-session">
            <span>上次完成</span>
            <strong>07.17　·　42 MIN　·　2,840 KG</strong>
            <p>没有计划？进入自由训练 →</p>
          </div>
        </div>

        <aside className="today-aside">
          <div className="aside-block">
            <span className="eyebrow">WEEKLY STATUS</span>
            <strong className="big-stat">2 / 3</strong>
            <p>保持现在的节奏，本周还剩 1 次训练。</p>
            <div className="week-bars" aria-label="本周训练完成情况">
              {[1, 1, 0, 0, 0, 0, 0].map((done, index) => <i key={index} className={done ? "done" : ""} />)}
            </div>
          </div>
          <div className="aside-block compact-rank">
            <span className="eyebrow">FRIENDS</span>
            <h3>本周进步榜</h3>
            {friends.slice(0, 3).map((friend) => (
              <div className="mini-rank" key={friend.rank}><b>{friend.rank}</b><span>{friend.name}</span><strong>{friend.score}</strong></div>
            ))}
          </div>
        </aside>
      </div>

      <button className="primary-action" data-testid="start-workout" onClick={onStart}><Play size={21} fill="currentColor" />开始训练</button>
    </section>
  );
}

function WorkoutView({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [weight, setWeight] = useState(55);
  const [reps, setReps] = useState(10);
  return (
    <section className="workout-view page-view" data-testid="workout-view">
      <header className="workout-header">
        <button onClick={onBack} aria-label="返回今日训练"><ArrowLeft /></button>
        <div><span>训练中</span><strong>00:18:42</strong></div>
        <button aria-label="更多操作"><MoreHorizontal /></button>
      </header>

      <div className="workout-focus">
        <div className="workout-title">
          <span className="eyebrow orange">02 / 04</span>
          <h1>坐姿划船</h1>
          <p>中立握 · 胸椎稳定 · 肘向后收</p>
          <div className="focus-line"><i /><span>背阔肌 / 菱形肌</span></div>
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
          {[1, 2, 3, 4].map((set) => <span key={set} className={set === 1 ? "done" : set === 2 ? "current" : ""}><i />{set}</span>)}
        </div>
      </section>

      <div className="technique"><span>TECHNIQUE</span><strong>回拉时停顿 1 秒，肩膀不要耸起</strong><small>拉时呼气 · 放时吸气</small></div>
      <div className="previous-set"><span>上次同动作</span><strong>52.5 kg × 10</strong><b>+2.5 kg</b><small>第 2 组 / 共 4 组</small><em>约 08:30</em></div>
      <button className="primary-action complete-action" data-testid="complete-set" onClick={onComplete}><Check size={22} />完成本组</button>
    </section>
  );
}

function RestOverlay({ onContinue }: { onContinue: () => void }) {
  const [seconds, setSeconds] = useState(88);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value <= 1 ? 90 : value - 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="rest-overlay" role="dialog" aria-modal="true" aria-label="休息计时" data-testid="rest-overlay">
      <div className="rest-top"><span>SET 02 COMPLETE</span><small>点击下方按钮可提前继续</small></div>
      <div className="timer-ring"><strong>{time}</strong><span>REST / 90 SEC</span><Activity size={22} /></div>
      <div className="next-set">
        <span>NEXT SET</span><h2>坐姿划船 · 第 3 组</h2><strong>55 kg × 10 次</strong><p>保持重量，动作质量优先</p>
        <div className="next-progress"><i /><i /><i /><i /></div>
      </div>
      <button className="primary-action" data-testid="continue-workout" onClick={onContinue}><Play size={21} fill="currentColor" />提前开始下一组</button>
      <button className="text-action" onClick={onContinue}><SkipForward size={15} />跳过休息</button>
    </div>
  );
}

function Heatmap() {
  const cells = useMemo(() => Array.from({ length: 364 }, (_, index) => {
    const week = Math.floor(index / 7);
    const day = index % 7;
    const score = (week * 11 + day * 7 + (week % 5) * 3) % 17;
    return score > 13 ? 3 : score > 9 ? 2 : score > 5 ? 1 : 0;
  }), []);
  return <div className="heatmap" aria-label="2026 年训练热力图">{cells.map((level, index) => <i key={index} data-level={level} />)}</div>;
}

function HistoryView() {
  const [period, setPeriod] = useState("年度");
  return (
    <section className="history-view page-view" data-testid="history-view">
      <header className="page-header">
        <div><span className="eyebrow">HISTORY / PROGRESS</span><h1>历史与进步</h1><p>看见训练留下的轨迹，而不只是今天的数字</p></div>
        <div className="year"><CalendarDays size={20} /><strong>2026</strong><small>刚刚同步</small></div>
      </header>
      <section className="frequency">
        <div className="section-heading"><div><h2>训练频率</h2><p>每一个方格代表一天</p></div><div className="period-tabs">{["年度", "12 周", "4 周"].map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></div>
        <div className="heatmap-row"><div><div className="months">{["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((m) => <span key={m}>{m}</span>)}</div><Heatmap /></div><div className="frequency-stats"><div><strong>178</strong><span>次训练</span></div><div><b>46</b><span>活跃周</span><b className="orange">12</b><span>当前连续</span></div></div></div>
      </section>
      <div className="history-columns">
        <section className="timeline"><div className="section-heading"><h2>近期训练</h2><button>查看全部 →</button></div>{sessions.map((session) => <div className={`session ${session.tone}`} key={session.day}><i /><time><strong>{session.day}</strong><small>{session.month}</small></time><div><h3>{session.name}</h3><p>{session.meta}</p><b>{session.volume}</b></div></div>)}<footer><span>本月 9 个训练日</span><b>计划完成率 92%</b></footer></section>
        <section className="trend">
          <div className="section-heading"><h2>力量趋势</h2><button>深蹲 <ChevronDown size={14} /></button></div>
          <div className="trend-stats"><div><span>当前估算 1RM</span><strong>112.5 <em>kg</em></strong></div><div><b>+8.7%</b><span>近 8 周</span></div><div><b className="orange">5 × 95</b><span>最佳工作组</span></div></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}><CartesianGrid stroke="#29302c" vertical={false} /><XAxis dataKey="date" stroke="#66706b" tickLine={false} axisLine={false} fontSize={10} interval={1} /><YAxis domain={[80, 120]} stroke="#66706b" tickLine={false} axisLine={false} fontSize={10} /><Tooltip contentStyle={{ background: "#121613", border: "1px solid #303733", borderRadius: 4 }} /><Line type="monotone" dataKey="value" stroke="#c0fa4a" strokeWidth={3} dot={{ r: 3, fill: "#c0fa4a", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ff9138" }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
          <p className="chart-note">基于每组重量与次数估算，减少体重和初始力量差异影响</p>
        </section>
        <Leaderboard compact />
      </div>
    </section>
  );
}

function Leaderboard({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`leaderboard ${compact ? "compact" : ""}`}>
      <div className="section-heading"><div><h2>好友进步榜</h2><p>按相对力量进步率与训练稳定性综合排名</p></div><span>近 8 周</span></div>
      <div className="rank-list">{friends.map((friend) => <div className={`rank-row ${friend.tone}`} key={friend.rank}><b>{friend.rank}</b><div><strong>{friend.name}</strong><span>{friend.score}</span><div className="rank-track"><i style={{ width: `${friend.width}%` }} /></div><small>稳定性 {friend.stability}</small></div></div>)}</div>
      <footer><span>RANKING METHOD</span><p>相对进步 70% · 稳定性 30%</p></footer>
    </section>
  );
}

function RankingView() {
  return <section className="ranking-view page-view"><header className="page-header"><div><span className="eyebrow">FRIENDS / RANKING</span><h1>公平地看见进步</h1><p>不比较起点，只比较每个人相对自己的成长。</p></div><Trophy className="header-icon" /></header><div className="ranking-layout"><Leaderboard /><aside className="ranking-method"><span className="eyebrow">HOW IT WORKS</span><h2>不直接按重量排名</h2><p>性别、体重、初始力量都会影响绝对重量。练迹使用近 8 周相对力量变化和训练稳定性计算榜单。</p><dl><div><dt>70%</dt><dd>相对力量进步</dd></div><div><dt>30%</dt><dd>训练稳定性</dd></div></dl></aside></div></section>;
}

function ProfileView({ onAccount }: { onAccount: () => void }) {
  return <section className="profile-view page-view"><header className="page-header"><div><span className="eyebrow">PROFILE / SETTINGS</span><h1>我的训练档案</h1><p>管理训练偏好、单位和好友邀请码。</p></div><Settings className="header-icon" /></header><div className="profile-grid"><div className="profile-identity"><CircleUserRound size={72} /><div><span>训练者</span><h2>amron</h2><p>连续训练 12 次 · 加入 126 天</p></div></div><div className="profile-stats"><div><strong>178</strong><span>累计训练</span></div><div><strong>92%</strong><span>计划完成率</span></div><div><strong>8.7%</strong><span>近 8 周进步</span></div></div><button className="secondary-action" onClick={onAccount}>账号与邀请码</button></div></section>;
}

function AccountDialog({ onClose }: { onClose: () => void }) {
  const [registering, setRegistering] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="account-dialog" role="dialog" aria-modal="true" aria-label={registering ? "注册练迹账号" : "登录练迹"}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <Brand />
        {submitted ? <div className="form-success"><Check size={36} /><h2>{registering ? "注册信息已准备" : "登录信息已验证"}</h2><p>正式接入账号服务后，这里会完成多设备同步。</p><button className="primary-action" onClick={onClose}>进入练迹</button></div> : <>
          <span className="eyebrow">{registering ? "INVITE ONLY" : "WELCOME BACK"}</span>
          <h2>{registering ? "用邀请码加入练迹" : "继续你的训练轨迹"}</h2>
          <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
            <label>用户名<input name="username" required autoComplete="username" placeholder="输入用户名" /></label>
            <label>密码<input name="password" required minLength={6} type="password" autoComplete={registering ? "new-password" : "current-password"} placeholder="至少 6 位" /></label>
            {registering && <label>邀请码<input name="invite" required placeholder="例如 LIANJI-2026" /></label>}
            <button className="primary-action" type="submit">{registering ? "注册账号" : "登录"}</button>
          </form>
          <button className="text-action" onClick={() => setRegistering((value) => !value)}>{registering ? "已有账号，直接登录" : "没有账号？使用邀请码注册"}</button>
        </>}
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("today");
  const [resting, setResting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const content = view === "today" ? <TodayView onStart={() => setView("workout")} /> : view === "workout" ? <WorkoutView onBack={() => setView("today")} onComplete={() => setResting(true)} /> : view === "history" ? <HistoryView /> : view === "ranking" ? <RankingView /> : <ProfileView onAccount={() => setAccountOpen(true)} />;
  return (
    <main className="app-shell">
      <Sidebar view={view} setView={setView} onAccount={() => setAccountOpen(true)} />
      <div className="app-content">{content}</div>
      {view !== "workout" && <MobileNav view={view} setView={setView} />}
      {resting && <RestOverlay onContinue={() => setResting(false)} />}
      {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
    </main>
  );
}
