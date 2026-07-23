"use client";

import { ArrowDown, ArrowUp, CircleAlert, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ALTERNATIVE_EXERCISES_ENABLED, exerciseLibrary, hasTrainingPlanChanges, hasTrainingPlanSetCountDraftChanges, MAX_SETS_PER_EXERCISE, restSecondsForSets, targetLabel, trainingDayDisplayName, weekdays } from "@/lib/training";
import type { ExerciseDefinition, PlanExercise, TrackingType, TrainingDay, TrainingPlan, WeightMode } from "@/lib/training";
import { KineticIcon } from "@/components/kinetic-icons";
import { PlanSharedTransition } from "@/components/plan-shared-transition";
import { TrainingDayStatusControl } from "@/components/training-day-status-control";
import { ExercisePicker, TrackSelect } from "@/components/track-select";

type Props = {
  plan: TrainingPlan;
  saving: boolean;
  error: string | null;
  scrollerRef: RefObject<HTMLDivElement | null>;
  initialWeekday: number | null;
  onWeekdayChange: (weekday: number) => void;
  onSave: (plan: TrainingPlan) => Promise<void>;
};

const trackingLabels: Record<TrackingType, string> = {
  weight_reps: "重量 × 次数",
  bodyweight_reps: "徒手次数",
  duration: "计时",
  bodyweight_duration: "徒手计时",
};

const weightOptions: Array<{ value: WeightMode; label: string }> = [
  { value: "total", label: "总重量" },
  { value: "per_side", label: "单侧重量" },
];

type SetCountAdvice = {
  title: string;
  message: string;
};

type TargetDraftField = "minReps" | "maxReps" | "minDurationSeconds" | "maxDurationSeconds";

function SetCountAdviceDialog({ advice, onClose }: { advice: SetCountAdvice | null; onClose: () => void }) {
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!advice) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus({ preventScroll: true });
    };
  }, [advice, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {advice && (
        <motion.div
          className="set-count-advice-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.16 }}
        >
          <motion.section
            className="set-count-advice"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.25, 1, 0.5, 1] }}
          >
            <span className="set-count-advice-icon" aria-hidden="true"><CircleAlert size={22} /></span>
            <div>
              <h2 id={titleId}>{advice.title}</h2>
              <p id={descriptionId}>{advice.message}</p>
            </div>
            <button ref={closeRef} type="button" className="primary-action" onClick={onClose}>知道了</button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function newExercise(definition?: ExerciseDefinition): PlanExercise {
  const source = definition ?? { exerciseId: `custom-${crypto.randomUUID()}`, name: "自定义动作", equipment: "", muscleGroup: "", trackingType: "weight_reps" as const, weightMode: "total" as const };
  const duration = source.trackingType === "duration" || source.trackingType === "bodyweight_duration";
  const maxSets = duration && source.trackingType === "duration" ? 1 : 3;
  return {
    id: crypto.randomUUID(),
    ...source,
    minSets: duration && source.trackingType === "duration" ? 1 : 3,
    maxSets,
    minReps: duration ? 0 : 10,
    maxReps: duration ? 0 : 12,
    minDurationSeconds: duration ? 300 : 0,
    maxDurationSeconds: duration ? 480 : 0,
    restSeconds: restSecondsForSets(maxSets),
    speedMin: null,
    speedMax: null,
    notes: "",
    alternativeExerciseId: null,
    alternativeName: null,
    alternativeEquipment: null,
    position: 0,
  };
}

export function TrainingPlanView({ plan, saving, error, scrollerRef, initialWeekday, onWeekdayChange, onSave }: Props) {
  const [draft, setDraft] = useState<TrainingPlan>(() => structuredClone(plan));
  const [selectedWeekday, setSelectedWeekday] = useState(() => {
    const rememberedDay = initialWeekday === null ? null : plan.days.find((day) => day.weekday === initialWeekday);
    return rememberedDay?.weekday ?? plan.days.find((day) => day.enabled)?.weekday ?? 1;
  });
  const [librarySelection, setLibrarySelection] = useState(exerciseLibrary[0].exerciseId);
  const [condensed, setCondensed] = useState(false);
  const [dayDirection, setDayDirection] = useState(1);
  const [setCountDrafts, setSetCountDrafts] = useState<Record<string, string>>({});
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({});
  const [setCountAdvice, setSetCountAdvice] = useState<SetCountAdvice | null>(null);
  const closeSetCountAdvice = useCallback(() => setSetCountAdvice(null), []);
  const sourceIconRef = useRef<HTMLSpanElement>(null);
  const sourceLabelRef = useRef<HTMLSpanElement>(null);
  const sourceDayNameRef = useRef<HTMLInputElement>(null);
  const sourceDayStatusRef = useRef<HTMLButtonElement>(null);
  const sourceStatusDotRef = useRef<HTMLElement>(null);
  const targetIconRef = useRef<HTMLSpanElement>(null);
  const targetLabelRef = useRef<HTMLSpanElement>(null);
  const targetDayNameRef = useRef<HTMLSpanElement>(null);
  const targetDayStatusRef = useRef<HTMLButtonElement>(null);
  const targetStatusDotRef = useRef<HTMLElement>(null);
  const compactContextRef = useRef<HTMLDivElement>(null);
  const compactWeekdaysRef = useRef<HTMLElement>(null);
  const dayEditorRef = useRef<HTMLDivElement>(null);
  const compactPointerRef = useRef({ x: 0, y: 0, moved: false });

  const selectedDay = useMemo(() => draft.days.find((day) => day.weekday === selectedWeekday) ?? draft.days[0], [draft.days, selectedWeekday]);
  const hasPendingSetCountEdit = hasTrainingPlanSetCountDraftChanges(draft, setCountDrafts);
  const hasPendingTargetEdit = Object.entries(targetDrafts).some(([key, rawValue]) => {
    const separator = key.lastIndexOf(":");
    const exerciseId = key.slice(0, separator);
    const field = key.slice(separator + 1) as TargetDraftField;
    const exercise = draft.days.flatMap((day) => day.exercises).find((item) => item.id === exerciseId);
    return !exercise || rawValue !== String(targetDisplayValue(exercise, field));
  });
  const dirty = hasTrainingPlanChanges(draft, plan) || hasPendingSetCountEdit || hasPendingTargetEdit;
  const hasEmptyTrainingDay = draft.days.some((day) => day.enabled && day.exercises.length === 0);
  const enabledDayCount = draft.days.filter((day) => day.enabled).length;
  const selectedWeekdayLabel = weekdays.find((item) => item.value === selectedDay.weekday)?.label ?? "周一";
  const selectedDayName = selectedDay.enabled ? trainingDayDisplayName(selectedDay.name) : "休息";
  const syncState = saving ? "saving" : dirty ? "dirty" : "synced";
  const syncLabel = saving ? "正在保存" : dirty ? "未保存" : "已同步";

  function selectWeekday(nextWeekday: number) {
    if (nextWeekday === selectedWeekday) return;
    setDayDirection(nextWeekday > selectedWeekday ? 1 : -1);
    setSelectedWeekday(nextWeekday);
    onWeekdayChange(nextWeekday);
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (!condensed) {
      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    const editor = dayEditorRef.current;
    if (!editor) return;
    const containerScrolls = getComputedStyle(scroller).overflowY !== "visible";
    const currentScrollTop = containerScrolls ? scroller.scrollTop : window.scrollY;
    const scrollerTop = containerScrolls ? scroller.getBoundingClientRect().top : 0;
    const fixedHeight = (compactContextRef.current?.offsetHeight ?? 56) + (compactWeekdaysRef.current?.offsetHeight ?? 0);
    const editorTop = editor.getBoundingClientRect().top;
    const collapseDistance = window.matchMedia("(max-width: 760px)").matches ? 148 : 156;
    const targetScrollTop = Math.max(collapseDistance * 0.72 + 1, currentScrollTop + editorTop - scrollerTop - fixedHeight);
    if (containerScrolls) scroller.scrollTo({ top: targetScrollTop, left: 0, behavior: "auto" });
    else window.scrollTo({ top: targetScrollTop, left: 0, behavior: "auto" });
  }

  function beginCompactPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    compactPointerRef.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function moveCompactPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const pointer = compactPointerRef.current;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) pointer.moved = true;
  }

  function chooseCompactWeekday(event: ReactMouseEvent<HTMLButtonElement>, weekday: number) {
    if (compactPointerRef.current.moved) {
      event.preventDefault();
      compactPointerRef.current.moved = false;
      return;
    }
    selectWeekday(weekday);
  }

  function updateDay(updater: (day: TrainingDay) => TrainingDay) {
    setDraft((current) => ({ ...current, days: current.days.map((day) => day.weekday === selectedWeekday ? updater(day) : day) }));
  }

  function updateExercise(id: string, patch: Partial<PlanExercise>) {
    updateDay((day) => ({ ...day, exercises: day.exercises.map((exercise) => exercise.id === id ? { ...exercise, ...patch } : exercise) }));
  }

  function setCountDraftKey(exerciseId: string, field: "min" | "max") {
    return `${exerciseId}:${field}`;
  }

  function clearSetCountDraft(exerciseId: string, field: "min" | "max") {
    const key = setCountDraftKey(exerciseId, field);
    setSetCountDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function commitSetCount(exercise: PlanExercise, field: "min" | "max", value: number) {
    if (field === "min") {
      updateExercise(exercise.id, { minSets: value, maxSets: Math.max(value, exercise.maxSets) });
      return;
    }
    updateExercise(exercise.id, { maxSets: value });
  }

  function editSetCount(exercise: PlanExercise, field: "min" | "max", rawValue: string) {
    if (!/^\d*$/.test(rawValue)) return;
    const key = setCountDraftKey(exercise.id, field);
    setSetCountDrafts((current) => ({ ...current, [key]: rawValue }));
    if (rawValue.trim() === "") return;

    const value = Number(rawValue);
    if (!Number.isInteger(value)) return;
    if (value > MAX_SETS_PER_EXERCISE) {
      clearSetCountDraft(exercise.id, field);
      setSetCountAdvice({
        title: `单个动作建议不超过 ${MAX_SETS_PER_EXERCISE} 组`,
        message: `大多数动作安排 1–${MAX_SETS_PER_EXERCISE} 组就能兼顾训练质量和恢复。需要更多训练量时，建议分配到其他动作或训练日。`,
      });
      return;
    }
    if (value < 1 || (field === "max" && value < exercise.minSets)) return;
    commitSetCount(exercise, field, value);
  }

  function finishSetCountEdit(exercise: PlanExercise, field: "min" | "max") {
    const key = setCountDraftKey(exercise.id, field);
    const rawValue = setCountDrafts[key];
    if (rawValue === undefined) return;
    const value = Number(rawValue);
    clearSetCountDraft(exercise.id, field);
    if (rawValue.trim() === "") return;
    if (!Number.isInteger(value) || value < 1) {
      setSetCountAdvice({
        title: "组数从 1 组开始",
        message: `请填写 1–${MAX_SETS_PER_EXERCISE} 之间的整数。清空输入框时会暂时保留原来的组数，方便重新输入。`,
      });
      return;
    }
    if (field === "max" && value < exercise.minSets) {
      setSetCountAdvice({
        title: "最多组不能少于最少组",
        message: "请先调整最少组，或把最多组设置为不小于最少组的数值。",
      });
      return;
    }
    if (value <= MAX_SETS_PER_EXERCISE) commitSetCount(exercise, field, value);
  }

  function targetDraftKey(exerciseId: string, field: TargetDraftField) {
    return `${exerciseId}:${field}`;
  }

  function targetDisplayValue(exercise: PlanExercise, field: TargetDraftField) {
    const value = exercise[field];
    const usesMinutes = exercise.trackingType === "duration" && (field === "minDurationSeconds" || field === "maxDurationSeconds");
    return usesMinutes ? Math.round(value / 60) : value;
  }

  function clearTargetDraft(exerciseId: string, field: TargetDraftField) {
    const key = targetDraftKey(exerciseId, field);
    setTargetDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function editTarget(exercise: PlanExercise, field: TargetDraftField, rawValue: string) {
    if (!/^\d*$/.test(rawValue)) return;
    const key = targetDraftKey(exercise.id, field);
    setTargetDrafts((current) => ({ ...current, [key]: rawValue }));
    if (rawValue === "") return;

    const value = Number(rawValue);
    const isRepetitionField = field === "minReps" || field === "maxReps";
    if (!Number.isInteger(value) || value < 1 || (isRepetitionField && value > 300)) return;
    const storedValue = exercise.trackingType === "duration" && !isRepetitionField ? value * 60 : value;
    updateExercise(exercise.id, { [field]: storedValue });
  }

  function chooseDefinition(exercise: PlanExercise, definition: ExerciseDefinition) {
    updateExercise(exercise.id, { ...definition, alternativeExerciseId: null, alternativeName: null, alternativeEquipment: null });
  }

  function addExercise() {
    const definition = exerciseLibrary.find((exercise) => exercise.exerciseId === librarySelection);
    updateDay((day) => ({ ...day, enabled: true, exercises: [...day.exercises, { ...newExercise(definition), position: day.exercises.length }] }));
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
    onWeekdayChange(selectedWeekday);
    await onSave({ ...draft, days: draft.days.map((day, position) => ({ ...day, position, exercises: day.exercises.map((exercise, exercisePosition) => ({ ...exercise, position: exercisePosition })) })) });
  }

  return (
    <section className="plan-view page-view" data-testid="plan-view">
      <div className="plan-compact-shell">
        <div ref={compactContextRef} className="plan-compact-context" aria-hidden={!condensed}>
          <span ref={targetIconRef} className="plan-compact-icon-target" />
          <span ref={targetLabelRef} className="plan-compact-label-target">周计划</span>
          <span ref={targetDayNameRef} className="plan-compact-day-name-target">{selectedDayName}</span>
          <TrainingDayStatusControl compact actionRef={targetDayStatusRef} enabled={selectedDay.enabled} exerciseCount={selectedDay.exercises.length} tabIndex={condensed ? 0 : -1} onChange={(enabled) => updateDay((day) => ({ ...day, enabled }))} />
          <span className={`plan-compact-status is-${syncState}`}><i ref={targetStatusDotRef} />{syncState !== "synced" && <b>{syncLabel}</b>}</span>
        </div>
        <nav ref={compactWeekdaysRef} className={`plan-compact-weekdays ${condensed ? "is-active" : ""}`} aria-label="固定周计划日期切换" aria-hidden={!condensed}>
          {weekdays.map((weekday) => {
            const day = draft.days.find((item) => item.weekday === weekday.value)!;
            return <button type="button" key={weekday.value} className={`${selectedWeekday === weekday.value ? "active" : ""} ${day.enabled ? "enabled" : ""}`} aria-pressed={selectedWeekday === weekday.value} tabIndex={condensed ? 0 : -1} onPointerDown={beginCompactPointer} onPointerMove={moveCompactPointer} onPointerCancel={() => { compactPointerRef.current.moved = false; }} onClick={(event) => chooseCompactWeekday(event, weekday.value)}><span>{weekday.short.replace("周", "")}</span><i /></button>;
          })}
        </nav>
      </div>

      <header className="plan-page-header">
        <div className="plan-header-meta">
          <div className="plan-header-identity"><span ref={sourceIconRef} className="plan-header-icon"><KineticIcon kind="plan" active size={28} /></span><span ref={sourceLabelRef} className="plan-header-label">周计划</span></div>
          <div className={`plan-header-status is-${syncState}`}><span>{enabledDayCount} 个训练日</span><i ref={sourceStatusDotRef} /><b>{syncLabel}</b></div>
        </div>
        <h1>安排你的一周</h1>
        <p>安排训练日和动作，保存后同步到今日训练。</p>
      </header>

      <div className="plan-workspace">
        <aside className="week-rail" aria-label="每周训练日">
          <div className="kinetic-week-track" aria-hidden="true"><i /></div>
          <div className="week-rail-title"><span>一周安排</span><strong>{enabledDayCount} 天</strong></div>
          {weekdays.map((weekday) => {
            const day = draft.days.find((item) => item.weekday === weekday.value)!;
            return <button type="button" key={weekday.value} className={`${selectedWeekday === weekday.value ? "active" : ""} ${day.enabled ? "enabled" : ""}`} aria-pressed={selectedWeekday === weekday.value} onClick={() => selectWeekday(weekday.value)}><b>{weekday.short}</b><span><strong>{day.enabled ? trainingDayDisplayName(day.name) : "休息"}</strong><small>{day.enabled ? `${day.exercises.length} 个动作` : "未安排"}</small></span><i /></button>;
          })}
        </aside>

        <motion.div ref={dayEditorRef} className="day-editor" key={selectedWeekday} initial={{ opacity: 0, x: dayDirection * 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          <div className="day-editor-header">
            <div><span>{selectedWeekdayLabel}</span><input ref={sourceDayNameRef} aria-label="训练日名称" value={selectedDay.name} placeholder="例如：全身" onChange={(event) => updateDay((day) => ({ ...day, name: event.target.value }))} /><input className="focus-input" aria-label="训练重点" value={selectedDay.focus} placeholder="例如：腿 + 胸 + 背" onChange={(event) => updateDay((day) => ({ ...day, focus: event.target.value }))} /></div>
            <TrainingDayStatusControl actionRef={sourceDayStatusRef} enabled={selectedDay.enabled} exerciseCount={selectedDay.exercises.length} onChange={(enabled) => updateDay((day) => ({ ...day, enabled }))} />
          </div>

          <div className="plan-exercise-list">
            <AnimatePresence initial={false}>{selectedDay.exercises.length ? selectedDay.exercises.map((exercise, index) => {
              const isDuration = exercise.trackingType === "duration" || exercise.trackingType === "bodyweight_duration";
              const isCustomExercise = exercise.exerciseId.startsWith("custom-");
              return (
                <motion.article className="plan-exercise-editor" layout key={exercise.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="exercise-editor-index"><b>{String(index + 1).padStart(2, "0")}</b><span>{targetLabel(exercise)}</span></div>
                  <div className="exercise-editor-body">
                    <div className={`exercise-name-row ${isCustomExercise ? "has-custom-name" : ""}`.trim()}>
                      <ExercisePicker ariaLabel="从动作库选择" value={exercise.exerciseId} displayValue={exercise.name} options={exerciseLibrary} onSelect={(exerciseId) => { const definition = exerciseLibrary.find((item) => item.exerciseId === exerciseId); if (definition) chooseDefinition(exercise, definition); }} />
                      {isCustomExercise && <input aria-label="自定义动作名称" value={exercise.name} placeholder="输入自定义动作名称" onChange={(event) => updateExercise(exercise.id, { name: event.target.value })} />}
                    </div>
                    <div className="exercise-config-row">
                      <p className="exercise-definition-summary" aria-label="动作属性">
                        <span>{exercise.equipment || "无器械"}</span>
                        <span>{exercise.muscleGroup || "未分类"}</span>
                        <span>{trackingLabels[exercise.trackingType]}</span>
                      </p>
                      {exercise.trackingType === "weight_reps" && <div className="exercise-weight-mode"><span>重量记录</span><TrackSelect ariaLabel="重量记录" value={exercise.weightMode} options={weightOptions} onChange={(weightMode) => updateExercise(exercise.id, { weightMode })} /></div>}
                    </div>
                    <div className="target-editor">
                      <label className="set-count-field">最少组<input type="text" inputMode="numeric" pattern="[0-9]*" value={setCountDrafts[setCountDraftKey(exercise.id, "min")] ?? String(exercise.minSets)} onChange={(event) => editSetCount(exercise, "min", event.target.value)} onBlur={() => finishSetCountEdit(exercise, "min")} /></label>
                      <label className="set-count-field">最多组<input type="text" inputMode="numeric" pattern="[0-9]*" value={setCountDrafts[setCountDraftKey(exercise.id, "max")] ?? String(exercise.maxSets)} onChange={(event) => editSetCount(exercise, "max", event.target.value)} onBlur={() => finishSetCountEdit(exercise, "max")} /></label>
                      {isDuration ? <><label>最短{exercise.trackingType === "bodyweight_duration" ? "秒" : "分钟"}<input type="text" inputMode="numeric" pattern="[0-9]*" value={targetDrafts[targetDraftKey(exercise.id, "minDurationSeconds")] ?? String(targetDisplayValue(exercise, "minDurationSeconds"))} onChange={(event) => editTarget(exercise, "minDurationSeconds", event.target.value)} onBlur={() => clearTargetDraft(exercise.id, "minDurationSeconds")} /></label><label>最长{exercise.trackingType === "bodyweight_duration" ? "秒" : "分钟"}<input type="text" inputMode="numeric" pattern="[0-9]*" value={targetDrafts[targetDraftKey(exercise.id, "maxDurationSeconds")] ?? String(targetDisplayValue(exercise, "maxDurationSeconds"))} onChange={(event) => editTarget(exercise, "maxDurationSeconds", event.target.value)} onBlur={() => clearTargetDraft(exercise.id, "maxDurationSeconds")} /></label></> : <><label>最少次数<input type="text" inputMode="numeric" pattern="[0-9]*" value={targetDrafts[targetDraftKey(exercise.id, "minReps")] ?? String(exercise.minReps)} onChange={(event) => editTarget(exercise, "minReps", event.target.value)} onBlur={() => clearTargetDraft(exercise.id, "minReps")} /></label><label>最多次数<input type="text" inputMode="numeric" pattern="[0-9]*" value={targetDrafts[targetDraftKey(exercise.id, "maxReps")] ?? String(exercise.maxReps)} onChange={(event) => editTarget(exercise, "maxReps", event.target.value)} onBlur={() => clearTargetDraft(exercise.id, "maxReps")} /></label></>}
                    </div>
                    {ALTERNATIVE_EXERCISES_ENABLED && <div className="alternative-editor"><span>备选动作</span><input value={exercise.alternativeName ?? ""} placeholder="可选，例如：45 度倒蹬" onChange={(event) => updateExercise(exercise.id, { alternativeName: event.target.value || null, alternativeExerciseId: event.target.value ? `alternative-${exercise.id}` : null })} /><input value={exercise.alternativeEquipment ?? ""} placeholder="备选器械" onChange={(event) => updateExercise(exercise.id, { alternativeEquipment: event.target.value || null })} /></div>}
                    <input className="exercise-note-input" aria-label="动作提示" value={exercise.notes} placeholder="动作提示或注意事项" onChange={(event) => updateExercise(exercise.id, { notes: event.target.value })} />
                  </div>
                  <div className="exercise-editor-actions"><button aria-label="上移" disabled={index === 0} onClick={() => moveExercise(index, -1)}><ArrowUp size={16} /></button><button aria-label="下移" disabled={index === selectedDay.exercises.length - 1} onClick={() => moveExercise(index, 1)}><ArrowDown size={16} /></button><button aria-label="删除动作" onClick={() => updateDay((day) => ({ ...day, exercises: day.exercises.filter((item) => item.id !== exercise.id) }))}><Trash2 size={16} /></button></div>
                </motion.article>
              );
            }) : <motion.div className="plan-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><KineticIcon kind="plan" size={34} /><strong>这一天还没有动作</strong><p>开启训练日后，从动作库添加第一项。</p></motion.div>}</AnimatePresence>
          </div>

          <div className="add-exercise-bar"><ExercisePicker ariaLabel="选择要添加的动作" value={librarySelection} options={exerciseLibrary} onSelect={setLibrarySelection} /><button className="secondary-action" aria-label="添加动作" title="添加动作" onClick={addExercise}><Plus size={20} /></button></div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <AnimatePresence initial={false}>
            {dirty && <motion.div className="plan-save-bar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}><span>{hasEmptyTrainingDay ? "训练日至少需要一个动作" : "有尚未同步的修改"}</span><button className={`primary-action plan-save-action ${saving ? "is-saving" : ""}`} disabled={saving || hasEmptyTrainingDay} onClick={save}><KineticIcon kind="save" active size={19} />{saving ? "正在保存…" : "保存周计划"}</button></motion.div>}
          </AnimatePresence>
        </motion.div>
      </div>
      <PlanSharedTransition scrollerRef={scrollerRef} sourceIconRef={sourceIconRef} sourceLabelRef={sourceLabelRef} sourceDayNameRef={sourceDayNameRef} sourceDayEditorRef={dayEditorRef} sourceDayStatusRef={sourceDayStatusRef} sourceStatusDotRef={sourceStatusDotRef} targetIconRef={targetIconRef} targetLabelRef={targetLabelRef} targetDayNameRef={targetDayNameRef} targetDayStatusRef={targetDayStatusRef} targetStatusDotRef={targetStatusDotRef} dayName={selectedDayName} dayEnabled={selectedDay.enabled} statusState={syncState} selectionKey={selectedWeekday} direction={dayDirection} onCondensedChange={setCondensed} />
      <SetCountAdviceDialog advice={setCountAdvice} onClose={closeSetCountAdvice} />
    </section>
  );
}
