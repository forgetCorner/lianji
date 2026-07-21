export type TrackingType = "weight_reps" | "duration" | "bodyweight_reps" | "bodyweight_duration";
export type WeightMode = "total" | "per_side" | "none";

export type ExerciseDefinition = {
  exerciseId: string;
  name: string;
  equipment: string;
  muscleGroup: string;
  trackingType: TrackingType;
  weightMode: WeightMode;
};

export type PlanExercise = ExerciseDefinition & {
  id: string;
  minSets: number;
  maxSets: number;
  minReps: number;
  maxReps: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  restSeconds: number;
  speedMin: number | null;
  speedMax: number | null;
  notes: string;
  alternativeExerciseId: string | null;
  alternativeName: string | null;
  alternativeEquipment: string | null;
  position: number;
};

export type TrainingDay = {
  id: string;
  weekday: number;
  name: string;
  focus: string;
  enabled: boolean;
  position: number;
  exercises: PlanExercise[];
};

export type TrainingPlan = {
  id: string;
  name: string;
  version: number;
  updatedAt: number;
  days: TrainingDay[];
};

export type WorkoutSet = {
  id: string;
  workoutExerciseId: string | null;
  exerciseId: string;
  setIndex: number;
  trackingType: TrackingType;
  weightKg: number;
  leftWeightKg: number | null;
  rightWeightKg: number | null;
  reps: number;
  durationSeconds: number;
  completedAt: number;
};

export type WorkoutExercise = PlanExercise & {
  planExerciseId: string | null;
  selectedName: string;
  selectedEquipment: string;
  skipped: boolean;
  completedAt: number | null;
  sets: WorkoutSet[];
  lastWeightKg: number;
  lastLeftWeightKg: number | null;
  lastRightWeightKg: number | null;
};

export type ActiveWorkout = {
  id: string;
  planName: string;
  planDayId: string | null;
  startedAt: number;
  exercises: WorkoutExercise[];
};

export const weekdays = [
  { value: 1, short: "一", label: "周一" },
  { value: 2, short: "二", label: "周二" },
  { value: 3, short: "三", label: "周三" },
  { value: 4, short: "四", label: "周四" },
  { value: 5, short: "五", label: "周五" },
  { value: 6, short: "六", label: "周六" },
  { value: 7, short: "日", label: "周日" },
] as const;

export const exerciseLibrary: ExerciseDefinition[] = [
  { exerciseId: "treadmill-warmup", name: "跑步机热身", equipment: "跑步机", muscleGroup: "热身", trackingType: "duration", weightMode: "none" },
  { exerciseId: "leg-press-45", name: "45 度倒蹬", equipment: "45 度倒蹬机", muscleGroup: "腿部", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "seated-chest-press", name: "坐姿推胸", equipment: "坐姿推胸机", muscleGroup: "胸部", trackingType: "weight_reps", weightMode: "per_side" },
  { exerciseId: "lat-pulldown", name: "高位下拉", equipment: "高位下拉机", muscleGroup: "背部", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "seated-leg-curl", name: "坐姿腿弯举", equipment: "坐姿腿弯举机", muscleGroup: "腿后侧", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "plank", name: "平板支撑", equipment: "垫子", muscleGroup: "核心", trackingType: "bodyweight_duration", weightMode: "none" },
  { exerciseId: "incline-walk", name: "爬坡", equipment: "跑步机", muscleGroup: "有氧", trackingType: "duration", weightMode: "none" },
  { exerciseId: "seated-row", name: "坐姿划船", equipment: "划船机", muscleGroup: "背部", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "hip-thrust", name: "臀推", equipment: "臀推机", muscleGroup: "臀腿", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "seated-shoulder-press", name: "坐姿推肩", equipment: "坐姿推肩机", muscleGroup: "肩部", trackingType: "weight_reps", weightMode: "per_side" },
  { exerciseId: "hip-abduction", name: "髋外展", equipment: "开合腿机", muscleGroup: "臀部", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "face-pull", name: "面拉", equipment: "龙门架", muscleGroup: "肩后束", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "dead-bug", name: "死虫", equipment: "垫子", muscleGroup: "核心", trackingType: "bodyweight_reps", weightMode: "none" },
  { exerciseId: "hack-squat", name: "哈克深蹲", equipment: "哈克深蹲机", muscleGroup: "腿部", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "incline-chest-press", name: "上斜推胸", equipment: "上斜推胸机", muscleGroup: "胸部", trackingType: "weight_reps", weightMode: "per_side" },
  { exerciseId: "leg-extension", name: "腿屈伸", equipment: "腿屈伸机", muscleGroup: "股四头肌", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "triceps-pushdown", name: "绳索下压", equipment: "龙门架", muscleGroup: "肱三头肌", trackingType: "weight_reps", weightMode: "total" },
  { exerciseId: "crunch", name: "卷腹", equipment: "垫子", muscleGroup: "核心", trackingType: "bodyweight_reps", weightMode: "none" },
];

export function targetLabel(exercise: PlanExercise): string {
  if (exercise.trackingType === "duration" || exercise.trackingType === "bodyweight_duration") {
    const min = Math.round(exercise.minDurationSeconds / 60);
    const max = Math.round(exercise.maxDurationSeconds / 60);
    const duration = exercise.maxDurationSeconds < 120 ? `${exercise.minDurationSeconds}–${exercise.maxDurationSeconds} 秒` : `${min}–${max} 分钟`;
    return exercise.maxSets > 1 ? `${exercise.minSets === exercise.maxSets ? exercise.maxSets : `${exercise.minSets}–${exercise.maxSets}`} 组 · ${duration}` : duration;
  }
  const sets = exercise.minSets === exercise.maxSets ? `${exercise.maxSets}` : `${exercise.minSets}–${exercise.maxSets}`;
  const reps = exercise.minReps === exercise.maxReps ? `${exercise.maxReps}` : `${exercise.minReps}–${exercise.maxReps}`;
  return `${sets}×${reps}`;
}
