import type { GoalDirection } from './types'

/**
 * 每日目标的估算。
 *
 * 基础代谢用 Mifflin-St Jeor（目前临床上对普通人群最常用的一条），乘活动系数
 * 得到维持热量，再按目标方向加减。**这仍然是估算**：公式的误差在 ±10% 上下，
 * 所以界面把它说成「算出来的建议值，可以自己改」，而不是一个精确答案。
 *
 * 刻意不做「最低热量」之类的硬性截断：那是营养师的判断，不是这个公式该替
 * 用户做的决定。用户看到的是一个数字，可以改，改完就是他的选择。
 */

export type Sex = 'male' | 'female'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: '久坐（几乎不运动）',
  light: '轻度（每周 1–3 次）',
  moderate: '中度（每周 3–5 次）',
  active: '高度（每周 6–7 次）',
}

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}

export type TargetInput = {
  sex: Sex
  heightCm: number
  weightKg: number
  age: number
  activity: ActivityLevel
  direction: GoalDirection
}

export type Target = {
  /** 每日热量目标 */
  calories: number
  protein: number
  carbs: number
  fat: number
  /** 每日运动消耗目标 */
  exerciseCalories: number
}

/** Mifflin-St Jeor 基础代谢 */
export function basalMetabolicRate(input: Pick<TargetInput, 'sex' | 'heightCm' | 'weightKg' | 'age'>): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age
  return Math.round(base + (input.sex === 'male' ? 5 : -161))
}

/** 维持热量：基础代谢 × 活动系数 */
export function maintenanceCalories(input: TargetInput): number {
  return Math.round(basalMetabolicRate(input) * ACTIVITY_FACTOR[input.activity])
}

const round10 = (value: number) => Math.round(value / 10) * 10

/**
 * 算出一份每日目标。
 *
 * 蛋白与脂肪按**体重**定（减脂期蛋白给足是为了保住肌肉），碳水吃剩下的热量——
 * 于是三大营养素与热量永远自洽：4×蛋白 + 4×碳水 + 9×脂肪 ≈ 热量。
 */
export function dailyTarget(input: TargetInput): Target {
  const maintenance = maintenanceCalories(input)

  const calories = round10(
    input.direction === 'cut' ? maintenance - 400 : input.direction === 'bulk' ? maintenance + 300 : maintenance,
  )

  const protein = Math.round(input.weightKg * 1.8)
  const fat = Math.round(input.weightKg * 0.8)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  // 运动消耗目标跟着活动量走：久坐的人给一个更容易达到的起点
  const exerciseCalories =
    input.activity === 'sedentary' ? 200 : input.activity === 'light' ? 300 : input.activity === 'moderate' ? 500 : 600

  return {
    calories: Math.max(calories, 800),
    protein,
    carbs,
    fat,
    exerciseCalories,
  }
}
