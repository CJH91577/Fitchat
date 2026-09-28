import { daysBetween } from './dates'
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

// 热量盈余 = 摄入 − 每日目标。正数为超出目标，负数为低于目标。
// 注意与「净热量」区分：净热量是 摄入 − 运动消耗，不减目标。
export function calorieSurplus(day: DayLog, goal: UserGoal): number {
  return sumMacros(day.foods).calories - goal.calories
}

// 热量的「达成」按目标方向判定：
//   减脂 / 维持 —— 未超标（盈余 ≤ 0）即达成
//   增肌       —— 吃够（盈余 ≥ 0）即达成
// 若沿用「填满目标即达成」的规则，对减脂用户会把「吃满」判成达成，语义正好相反。
export function isCalorieOnTarget(day: DayLog, goal: UserGoal): boolean {
  const surplus = calorieSurplus(day, goal)
  return goal.direction === 'bulk' ? surplus >= 0 : surplus <= 0
}

export function isExerciseOnTarget(day: DayLog, goal: UserGoal): boolean {
  if (goal.exerciseCalories <= 0) return false
  return burnedCalories(day) >= goal.exerciseCalories
}

// 该日期是否落在用户的使用范围内（即不早于开始使用日期）。
// 名字刻意不叫 hasRecord——「在范围内」不等于「那天有记录」：
// 范围内完全可能一天什么都没记，那是另一种状态，界面需要区别对待。
export function isInRange(date: string, startedAt: string): boolean {
  return daysBetween(startedAt, date) >= 0
}
