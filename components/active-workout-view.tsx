"use client";

import { Activity, ArrowLeft, Check, Dumbbell, Minus, Plus, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActiveWorkout, WorkoutExercise } from "@/lib/training";

export type SetInput = {
  workoutExerciseId: string;
  setIndex: number;
  weightKg: number;
  leftWeightKg: number | null;
  rightWeightKg: number | null;
  reps: number;
  durationSeconds: number;
};

type Props = {
  workout: ActiveWorkout;
  exercise: WorkoutExercise;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSaveSet: (input: SetInput) => void;
  onSkip: () => void;
};

function Stepper({ label, value, unit, step, min, onChange }: { label: string; value: number; unit: string; step: number; min: number; onChange: (value: number) => void }) {
  return <div className="metric"><span>{label}</span><div className="metric-control"><button aria-label={`减少${label}`} onClick={() => onChange(Math.max(min, value - step))}><Minus /></button><strong>{Number.isInteger(value) ? value : value.toFixed(1)}</strong><em>{unit}</em><button aria-label={`增加${label}`} onClick={() => onChange(value + step)}><Plus /></button></div></div>;
}

export function ActiveWorkoutView({ workout, exercise, saving, error, onBack, onSaveSet, onSkip }: Props) {
  const [weight, setWeight] = useState(exercise.lastWeightKg || 0);
  const [leftWeight, setLeftWeight] = useState(exercise.lastLeftWeightKg ?? (exercise.lastWeightKg ? exercise.lastWeightKg / 2 : 10));
  const [rightWeight, setRightWeight] = useState(exercise.lastRightWeightKg ?? (exercise.lastWeightKg ? exercise.lastWeightKg / 2 : 10));
  const [reps, setReps] = useState(exercise.maxReps || 10);
  const [durationSeconds, setDurationSeconds] = useState(exercise.minDurationSeconds || 60);
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.round((Date.now() - workout.startedAt) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - workout.startedAt) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [workout.startedAt]);
  const elapsedLabel = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const currentSet = exercise.sets.length + 1;
  const exerciseIndex = workout.exercises.findIndex((item) => item.id === exercise.id);
  const isDuration = exercise.trackingType === "duration" || exercise.trackingType === "bodyweight_duration";
  const isWeighted = exercise.trackingType === "weight_reps";
  const durationInMinutes = durationSeconds >= 120;

  function completeSet() {
    onSaveSet({
      workoutExerciseId: exercise.id,
      setIndex: currentSet,
      weightKg: exercise.weightMode === "total" ? weight : 0,
      leftWeightKg: exercise.weightMode === "per_side" ? leftWeight : null,
      rightWeightKg: exercise.weightMode === "per_side" ? rightWeight : null,
      reps: isDuration ? 0 : reps,
      durationSeconds: isDuration ? durationSeconds : 0,
    });
  }

  return (
    <section className="workout-view page-view" data-testid="workout-view">
      <header className="workout-header">
        <button onClick={onBack} aria-label="返回今日训练"><ArrowLeft /></button>
        <div><span>{workout.planName} · 已同步</span><strong>{elapsedLabel}</strong></div>
        <button className="skip-exercise" onClick={onSkip} disabled={saving}><SkipForward size={17} /><span>跳过</span></button>
      </header>

      <div className="workout-sequence" aria-label="训练动作进度">
        {workout.exercises.map((item, index) => <span key={item.id} className={item.completedAt ? "done" : item.id === exercise.id ? "current" : ""}><b>{String(index + 1).padStart(2, "0")}</b><small>{item.name}</small></span>)}
      </div>

      <div className="workout-focus">
        <div className="workout-title">
          <span className="eyebrow orange">动作 {String(exerciseIndex + 1).padStart(2, "0")} / {String(workout.exercises.length).padStart(2, "0")} · 第 {currentSet} 组</span>
          <h1>{exercise.name}</h1>
          <p>{exercise.equipment || "徒手"} · {exercise.minSets === exercise.maxSets ? `${exercise.maxSets} 组` : `${exercise.minSets}–${exercise.maxSets} 组`}</p>
          <div className="focus-line"><i /><span>{exercise.muscleGroup || "全身"}</span></div>
        </div>
        <Dumbbell className="workout-watermark" strokeWidth={1.25} />
      </div>

      <div className={`metrics ${exercise.weightMode === "per_side" ? "three-metrics" : ""}`}>
        {isWeighted && exercise.weightMode === "total" && <Stepper label="WEIGHT" value={weight} unit="kg" step={2.5} min={0} onChange={setWeight} />}
        {isWeighted && exercise.weightMode === "per_side" && <><Stepper label="LEFT" value={leftWeight} unit="kg" step={2.5} min={0} onChange={setLeftWeight} /><Stepper label="RIGHT" value={rightWeight} unit="kg" step={2.5} min={0} onChange={setRightWeight} /></>}
        {!isDuration && <Stepper label="REPS" value={reps} unit="次" step={1} min={1} onChange={setReps} />}
        {isDuration && <Stepper label="DURATION" value={durationInMinutes ? Math.round(durationSeconds / 60) : durationSeconds} unit={durationInMinutes ? "分钟" : "秒"} step={1} min={1} onChange={(value) => setDurationSeconds(value * (durationInMinutes ? 60 : 1))} />}
      </div>

      <section className="sets-progress">
        <span className="eyebrow">SETS · 最少 {exercise.minSets} 组</span>
        <div className="set-track">{Array.from({ length: exercise.maxSets }, (_, index) => index + 1).map((set) => <span key={set} className={set < currentSet ? "done" : set === currentSet ? "current" : ""}><i />{set}</span>)}</div>
      </section>

      <div className="technique"><span>TRAINING NOTE</span><strong>{exercise.notes || "动作质量优先，保持稳定节奏"}</strong><small>{isDuration ? `目标 ${Math.round(exercise.minDurationSeconds / 60)}–${Math.round(exercise.maxDurationSeconds / 60)} 分钟` : `目标 ${exercise.minReps}–${exercise.maxReps} 次 · 休息 ${exercise.restSeconds} 秒`}</small></div>
      <div className="previous-set"><span>当前记录</span><strong>{isDuration ? `${durationInMinutes ? Math.round(durationSeconds / 60) : durationSeconds} ${durationInMinutes ? "分钟" : "秒"}` : exercise.weightMode === "per_side" ? `左 ${leftWeight} + 右 ${rightWeight} kg × ${reps}` : isWeighted ? `${weight} kg × ${reps}` : `${reps} 次`}</strong><b>实时保存</b><small>第 {currentSet} 组 / 最多 {exercise.maxSets} 组</small><em>{elapsedLabel}</em></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary-action complete-action" data-testid="complete-set" onClick={completeSet} disabled={saving}><Check size={22} />{saving ? "正在保存…" : "完成本组"}</button>
    </section>
  );
}

export function WorkoutRestOverlay({ exercise, completedSet, onContinue, onFinish }: { exercise: WorkoutExercise; completedSet: number; onContinue: () => void; onFinish: () => void }) {
  const [seconds, setSeconds] = useState(exercise.restSeconds);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const canFinish = completedSet >= exercise.minSets;
  return (
    <div className="rest-overlay" role="dialog" aria-modal="true" aria-label="休息计时" data-testid="rest-overlay">
      <div className="rest-top"><span>SET {String(completedSet).padStart(2, "0")} COMPLETE · 已同步</span><small>{canFinish ? "已达到最低组数，可以结束动作" : "恢复呼吸，准备下一组"}</small></div>
      <div className="timer-ring"><strong>{time}</strong><span>REST / {exercise.restSeconds} SEC</span><Activity size={22} /></div>
      <div className="next-set"><span>NEXT</span><h2>{exercise.name} · 第 {completedSet + 1} 组</h2><strong>{canFinish ? "加做一组，或者进入下个动作" : "保持刚才的动作质量"}</strong><p>计划范围 {exercise.minSets}–{exercise.maxSets} 组</p><div className="next-progress">{Array.from({ length: exercise.maxSets }, (_, index) => <i key={index} className={index < completedSet ? "done" : ""} />)}</div></div>
      <button className="primary-action" data-testid="continue-workout" onClick={onContinue}><Check size={21} />{seconds ? "提前开始下一组" : "开始下一组"}</button>
      {canFinish && <button className="text-action finish-exercise-action" onClick={onFinish}><SkipForward size={15} />完成动作，进入下一项</button>}
    </div>
  );
}
