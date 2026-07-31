import type { ExerciseDefinition } from "@/lib/training";

export type ExerciseCategory = "strength" | "cardio" | "core";
export type ExerciseCategoryFilter = "all" | ExerciseCategory;
export type ExerciseCategoryCounts = Record<ExerciseCategoryFilter, number>;

export const exerciseCategoryFilters: ReadonlyArray<{
  value: ExerciseCategoryFilter;
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "strength", label: "力量" },
  { value: "cardio", label: "有氧" },
  { value: "core", label: "核心" },
];

const exerciseCategories: Readonly<Record<string, ExerciseCategory>> = {
  "treadmill-warmup": "cardio",
  "leg-press-45": "strength",
  "seated-chest-press": "strength",
  "lat-pulldown": "strength",
  "seated-leg-curl": "strength",
  plank: "core",
  "incline-walk": "cardio",
  "seated-row": "strength",
  "hip-thrust": "strength",
  "seated-shoulder-press": "strength",
  "hip-abduction": "strength",
  "face-pull": "strength",
  "dead-bug": "core",
  "hack-squat": "strength",
  "incline-chest-press": "strength",
  "leg-extension": "strength",
  "triceps-pushdown": "strength",
  crunch: "core",
};

export function exerciseCategory(exerciseId: string): ExerciseCategory | null {
  return exerciseCategories[exerciseId] ?? null;
}

export function exerciseCategoryCounts(options: ExerciseDefinition[]): ExerciseCategoryCounts {
  const counts: ExerciseCategoryCounts = {
    all: options.length,
    strength: 0,
    cardio: 0,
    core: 0,
  };

  for (const option of options) {
    const category = exerciseCategory(option.exerciseId);
    if (category) counts[category] += 1;
  }

  return counts;
}

export function filterExerciseOptions(
  options: ExerciseDefinition[],
  query: string,
  category: ExerciseCategoryFilter,
): ExerciseDefinition[] {
  const keyword = query.trim().toLocaleLowerCase("zh-CN");

  return options.filter((option) => {
    const matchesQuery = !keyword
      || `${option.name} ${option.equipment} ${option.muscleGroup}`.toLocaleLowerCase("zh-CN").includes(keyword);
    const matchesCategory = category === "all" || exerciseCategory(option.exerciseId) === category;
    return matchesQuery && matchesCategory;
  });
}
