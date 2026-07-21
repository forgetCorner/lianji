"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { exerciseLibrary, targetLabel, weekdays } from "@/lib/training";
import type { ExerciseDefinition, PlanExercise, TrackingType, TrainingDay, TrainingPlan, WeightMode } from "@/lib/training";
import { KineticIcon } from "@/components/kinetic-icons";

type Props = {
  plan: TrainingPlan;
  saving: boolean;
  error: string | null;
  onSave: (plan: TrainingPlan) => Promise<void>;
};

function newExercise(definition?: ExerciseDefinition): PlanExercise {
  const source = definition ?? { exerciseId: `custom-${crypto.randomUUID()}`, name: "自定义动作", equipment: "", muscleGroup: "", trackingType: "weight_reps" as const, weightMode: "total" as const };
  const duration = source.trackingType === "duration" || source.trackingType === "bodyweight_duration";
  return {
    id: crypto.randomUUID(),
    ...source,
    minSets: duration && source.trackingType === "duration" ? 1 : 3,
    maxSets: duration && source.trackingType === "duration" ? 1 : 3,
    minReps: duration ? 0 : 10,
    maxReps: duration ? 0 : 12,
    minDurationSeconds: duration ? 300 : 0,
    maxDurationSeconds: duration ? 480 : 0,
    restSeconds: duration && source.trackingType === "duration" ? 0 : 90,
    speedMin: null,
    speedMax: null,
    notes: "",
    alternativeExerciseId: null,
    alternativeName: null,
    alternativeEquipment: null,
    position: 0,
  };
}

export function TrainingPlanView({ plan, saving, error, onSave }: Props) {
  const [draft, setDraft] = useState<TrainingPlan>(() => structuredClone(plan));
  const [selectedWeekday, setSelectedWeekday] = useState(() => plan.days.find((day) => day.enabled)?.weekday ?? 1);
  const [librarySelection, setLibrarySelection] = useState(exerciseLibrary[0].exerciseId);
  const [dirty, setDirty] = useState(false);

  const selectedDay = useMemo(() => draft.days.find((day) => day.weekday === selectedWeekday) ?? draft.days[0], [draft.days, selectedWeekday]);
  const hasEmptyTrainingDay = draft.days.some((day) => day.enabled && day.exercises.length === 0);

  function updateDay(updater: (day: TrainingDay) => TrainingDay) {
    setDraft((current) => ({ ...current, days: current.days.map((day) => day.weekday === selectedWeekday ? updater(day) : day) }));
    setDirty(true);
  }

  function updateExercise(id: string, patch: Partial<PlanExercise>) {
    updateDay((day) => ({ ...day, exercises: day.exercises.map((exercise) => exercise.id === id ? { ...exercise, ...patch } : exercise) }));
  }

  function chooseDefinition(exercise: PlanExercise, definition: ExerciseDefinition) {
    updateExercise(exercise.id, { ...definition, alternativeExerciseId: null, alternativeName: null, alternativeEquipment: null });
  }

  function addExercise() {
    const definition = exerciseLibrary.find((exercise) => exercise.exerciseId === librarySelection);
    updateDay((day) => ({ ...day, enabled: true, exercises: [...day.exercises, { ...newExercise(definition), position: day.exercises.length }] }));
  }

  function addCustomExercise() {
    updateDay((day) => ({ ...day, enabled: true, exercises: [...day.exercises, { ...newExercise(), position: day.exercises.length }] }));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    updateDay((day) => {
      const next = [...day.exercises];
      const target = index + direction;
      if (target < 0 || target >= next.length) return day;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...day, exercises: next.map((exercise, position) => ({ ...exercise, position })) };
    });
  }

  async function save() {
    await onSave({ ...draft, days: draft.days.map((day, position) => ({ ...day, position, exercises: day.exercises.map((exercise, exercisePosition) => ({ ...exercise, position: exercisePosition })) })) });
    setDirty(false);
  }

  return (
    <section className="plan-view page-view" data-testid="plan-view">
      <header className="page-header plan-page-header">
        <div><span className="eyebrow">WEEKLY PROGRAM</span><h1>安排你的一周</h1><p>训练日、动作顺序和目标都由你决定，修改只影响之后的训练。</p></div>
        <KineticIcon kind="plan" active size={52} className="header-icon" />
      </header>

      <div className="plan-workspace">
        <aside className="week-rail" aria-label="每周训练日">
          <div className="kinetic-week-track" aria-hidden="true"><i /></div>
          <div className="week-rail-title"><span>每周训练</span><strong>{draft.days.filter((day) => day.enabled).length} 天</strong></div>
          {weekdays.map((weekday) => {
            const day = draft.days.find((item) => item.weekday === weekday.value)!;
            return <button key={weekday.value} className={`${selectedWeekday === weekday.value ? "active" : ""} ${day.enabled ? "enabled" : ""}`} onClick={() => setSelectedWeekday(weekday.value)}><b>{weekday.short}</b><span><strong>{day.enabled ? day.name : "休息"}</strong><small>{day.enabled ? `${day.exercises.length} 个动作` : "未安排"}</small></span><i /></button>;
          })}
        </aside>

        <motion.div className="day-editor" key={selectedWeekday} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
          <div className="day-editor-header">
            <div><span>{weekdays.find((item) => item.value === selectedDay.weekday)?.label}</span><input aria-label="训练日名称" value={selectedDay.name} onChange={(event) => updateDay((day) => ({ ...day, name: event.target.value }))} /><input className="focus-input" aria-label="训练重点" value={selectedDay.focus} placeholder="例如：腿 + 胸 + 背" onChange={(event) => updateDay((day) => ({ ...day, focus: event.target.value }))} /></div>
            <label className="day-toggle"><input type="checkbox" checked={selectedDay.enabled} onChange={(event) => updateDay((day) => ({ ...day, enabled: event.target.checked }))} /><span>{selectedDay.enabled ? "训练日" : "休息日"}</span></label>
          </div>

          <div className="plan-exercise-list">
            <AnimatePresence initial={false}>{selectedDay.exercises.length ? selectedDay.exercises.map((exercise, index) => {
              const isDuration = exercise.trackingType === "duration" || exercise.trackingType === "bodyweight_duration";
              return (
                <motion.article className="plan-exercise-editor" layout key={exercise.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="exercise-editor-index"><b>{String(index + 1).padStart(2, "0")}</b><span>{targetLabel(exercise)}</span></div>
                  <div className="exercise-editor-body">
                    <div className="exercise-name-row">
                      <select aria-label="从动作库选择" value={exerciseLibrary.some((item) => item.exerciseId === exercise.exerciseId) ? exercise.exerciseId : "custom"} onChange={(event) => { const definition = exerciseLibrary.find((item) => item.exerciseId === event.target.value); if (definition) chooseDefinition(exercise, definition); }}><option value="custom">自定义动作</option>{exerciseLibrary.map((item) => <option key={item.exerciseId} value={item.exerciseId}>{item.name}</option>)}</select>
                      <input aria-label="动作名称" value={exercise.name} onChange={(event) => updateExercise(exercise.id, { name: event.target.value, exerciseId: exercise.exerciseId.startsWith("custom-") ? exercise.exerciseId : `custom-${crypto.randomUUID()}` })} />
                    </div>
                    <div className="exercise-meta-grid">
                      <label>器械<input value={exercise.equipment} onChange={(event) => updateExercise(exercise.id, { equipment: event.target.value })} /></label>
                      <label>肌群<input value={exercise.muscleGroup} onChange={(event) => updateExercise(exercise.id, { muscleGroup: event.target.value })} /></label>
                      <label>记录方式<select value={exercise.trackingType} onChange={(event) => { const trackingType = event.target.value as TrackingType; updateExercise(exercise.id, { trackingType, weightMode: trackingType === "weight_reps" ? exercise.weightMode === "none" ? "total" : exercise.weightMode : "none" }); }}><option value="weight_reps">重量 × 次数</option><option value="bodyweight_reps">徒手次数</option><option value="duration">计时</option><option value="bodyweight_duration">徒手计时</option></select></label>
                      {exercise.trackingType === "weight_reps" && <label>重量方式<select value={exercise.weightMode} onChange={(event) => updateExercise(exercise.id, { weightMode: event.target.value as WeightMode })}><option value="total">总重量</option><option value="per_side">左右单侧</option></select></label>}
                    </div>
                    <div className="target-editor">
                      <label>最少组<input type="number" min="1" max="12" value={exercise.minSets} onChange={(event) => updateExercise(exercise.id, { minSets: Number(event.target.value), maxSets: Math.max(Number(event.target.value), exercise.maxSets) })} /></label>
                      <label>最多组<input type="number" min={exercise.minSets} max="12" value={exercise.maxSets} onChange={(event) => updateExercise(exercise.id, { maxSets: Number(event.target.value) })} /></label>
                      {isDuration ? <><label>最短{exercise.trackingType === "bodyweight_duration" ? "秒" : "分钟"}<input type="number" min="1" value={exercise.trackingType === "bodyweight_duration" ? exercise.minDurationSeconds : Math.round(exercise.minDurationSeconds / 60)} onChange={(event) => updateExercise(exercise.id, { minDurationSeconds: Number(event.target.value) * (exercise.trackingType === "bodyweight_duration" ? 1 : 60) })} /></label><label>最长{exercise.trackingType === "bodyweight_duration" ? "秒" : "分钟"}<input type="number" min="1" value={exercise.trackingType === "bodyweight_duration" ? exercise.maxDurationSeconds : Math.round(exercise.maxDurationSeconds / 60)} onChange={(event) => updateExercise(exercise.id, { maxDurationSeconds: Number(event.target.value) * (exercise.trackingType === "bodyweight_duration" ? 1 : 60) })} /></label></> : <><label>最少次数<input type="number" min="1" max="300" value={exercise.minReps} onChange={(event) => updateExercise(exercise.id, { minReps: Number(event.target.value) })} /></label><label>最多次数<input type="number" min={exercise.minReps} max="300" value={exercise.maxReps} onChange={(event) => updateExercise(exercise.id, { maxReps: Number(event.target.value) })} /></label></>}
                      <label>休息秒数<input type="number" min="0" max="900" step="15" value={exercise.restSeconds} onChange={(event) => updateExercise(exercise.id, { restSeconds: Number(event.target.value) })} /></label>
                    </div>
                    <div className="alternative-editor"><span>备选动作</span><input value={exercise.alternativeName ?? ""} placeholder="可选，例如：45 度倒蹬" onChange={(event) => updateExercise(exercise.id, { alternativeName: event.target.value || null, alternativeExerciseId: event.target.value ? `alternative-${exercise.id}` : null })} /><input value={exercise.alternativeEquipment ?? ""} placeholder="备选器械" onChange={(event) => updateExercise(exercise.id, { alternativeEquipment: event.target.value || null })} /></div>
                    <input className="exercise-note-input" aria-label="动作提示" value={exercise.notes} placeholder="动作提示或注意事项" onChange={(event) => updateExercise(exercise.id, { notes: event.target.value })} />
                  </div>
                  <div className="exercise-editor-actions"><button aria-label="上移" disabled={index === 0} onClick={() => moveExercise(index, -1)}><ArrowUp size={16} /></button><button aria-label="下移" disabled={index === selectedDay.exercises.length - 1} onClick={() => moveExercise(index, 1)}><ArrowDown size={16} /></button><button aria-label="删除动作" onClick={() => updateDay((day) => ({ ...day, exercises: day.exercises.filter((item) => item.id !== exercise.id) }))}><Trash2 size={16} /></button></div>
                </motion.article>
              );
            }) : <motion.div className="plan-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><KineticIcon kind="plan" size={34} /><strong>这一天还没有动作</strong><p>开启训练日后，从动作库添加第一项。</p></motion.div>}</AnimatePresence>
          </div>

          <div className="add-exercise-bar"><select aria-label="选择要添加的动作" value={librarySelection} onChange={(event) => setLibrarySelection(event.target.value)}>{exerciseLibrary.map((exercise) => <option key={exercise.exerciseId} value={exercise.exerciseId}>{exercise.name} · {exercise.equipment}</option>)}</select><button className="secondary-action" onClick={addExercise}><Plus size={17} />添加动作</button><button className="text-action" onClick={addCustomExercise}>新建自定义动作</button></div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="plan-save-bar"><span>{hasEmptyTrainingDay ? "训练日至少需要一个动作" : dirty ? "有尚未同步的修改" : `已同步 · 版本 ${draft.version}`}</span><button className="primary-action" disabled={!dirty || saving || hasEmptyTrainingDay} onClick={save}><KineticIcon kind="save" active={dirty} size={19} />{saving ? "正在保存…" : "保存周计划"}</button></div>
        </motion.div>
      </div>
    </section>
  );
}
