import type { DayLog, FoodEntry, MacroTotals, UserGoal } from './types'

export function emptyMacros(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

export function sumMacros(entries: FoodEntry[]): MacroTotals {
  return entries.reduce<MacroTotals>((acc, e) => {
    acc.calories += e.totals.calories
    acc.protein += e.totals.protein
    acc.carbs += e.totals.carbs
    acc.fat += e.totals.fat
    return acc
  }, emptyMacros())
}

export function burnedCalories(day: DayLog): number {
  return day.exercises.reduce((sum, e) => sum + e.caloriesBurned, 0)
}

export function netCalories(day: DayLog): number {
  return sumMacros(day.foods).calories - burnedCalories(day)
}

// 达标率 0..1。目标未设定或没有记录时为 0，绝不返回 NaN 或负值
export function adherence(day: DayLog, goal: UserGoal): number {
  if (goal.calories <= 0) return 0
  const intake = sumMacros(day.foods).calories
  if (intake <= 0) return 0
  return Math.min(intake / goal.calories, 1)
}

export function emptyDayLog(date: string): DayLog {
  return { date, foods: [], exercises: [] }
}
