import { seededInt, seededPick, seededUnit } from './dateSeed'
import { daysBetween } from './dates'
import type { DayLog, ExerciseEntry, FoodEntry, FoodSource, MealSlot, UserGoal } from './types'

type FoodTemplate = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

const BREAKFAST: FoodTemplate[] = [
  { name: '燕麦牛奶', calories: 380, protein: 18, carbs: 55, fat: 9 },
  { name: '豆浆鸡蛋', calories: 300, protein: 20, carbs: 22, fat: 14 },
  { name: '全麦三明治', calories: 420, protein: 22, carbs: 48, fat: 15 },
]

const LUNCH: FoodTemplate[] = [
  { name: '鸡胸肉盖饭', calories: 620, protein: 42, carbs: 70, fat: 14 },
  { name: '牛肉面', calories: 680, protein: 34, carbs: 88, fat: 18 },
  { name: '清蒸鱼套餐', calories: 540, protein: 40, carbs: 52, fat: 16 },
]

const DINNER: FoodTemplate[] = [
  { name: '清炒时蔬 + 米饭', calories: 420, protein: 12, carbs: 68, fat: 8 },
  { name: '番茄鸡蛋面', calories: 480, protein: 20, carbs: 72, fat: 12 },
  { name: '鸡腿饭', calories: 560, protein: 32, carbs: 62, fat: 20 },
]

const SNACK: FoodTemplate[] = [
  { name: '苹果', calories: 95, protein: 0, carbs: 25, fat: 0 },
  { name: '酸奶', calories: 130, protein: 8, carbs: 16, fat: 4 },
  { name: '坚果', calories: 200, protein: 6, carbs: 8, fat: 17 },
]

const CARDIO = [
  { name: '慢跑', perMinute: 10 },
  { name: '快走', perMinute: 6 },
  { name: '骑行', perMinute: 11 },
]

const STRENGTH = [
  { name: '卧推', caloriesBurned: 170 },
  { name: '深蹲', caloriesBurned: 220 },
  { name: '硬拉', caloriesBurned: 200 },
  { name: '引体向上', caloriesBurned: 150 },
]

// 每餐的分量波动系数，模拟「有时吃得多、有时吃得少」
function portionFactor(date: string, index: number): number {
  return 0.8 + seededUnit(date, 60 + index) * 0.5
}

function toEntry(
  date: string,
  index: number,
  slot: MealSlot,
  template: FoodTemplate,
  source: FoodSource,
  factor: number,
): FoodEntry {
  return {
    id: `${date}-${slot}-${index}`,
    slot,
    name: template.name,
    grams: 100,
    source,
    totals: {
      calories: Math.round(template.calories * factor),
      protein: Math.round(template.protein * factor),
      carbs: Math.round(template.carbs * factor),
      fat: Math.round(template.fat * factor),
    },
  }
}

export function generateDayLog(date: string, goal: UserGoal): DayLog {
  const meals: { slot: MealSlot; template: FoodTemplate; source: FoodSource }[] = [
    { slot: 'breakfast', template: seededPick(date, 10, BREAKFAST), source: 'curated' },
    { slot: 'lunch', template: seededPick(date, 11, LUNCH), source: 'curated' },
    { slot: 'dinner', template: seededPick(date, 12, DINNER), source: 'curated' },
  ]

  // 约七成日子有加餐。加餐一律标为 AI 估算——它是「用一句话描述」记进来的。
  if (seededUnit(date, 20) > 0.3) {
    meals.push({ slot: 'snack', template: seededPick(date, 21, SNACK), source: 'ai-estimate' })
  }

  // 把当天的模板合计缩放到目标热量附近，再叠加每餐波动（0.8~1.2）。
  // 这样「摄入围绕目标浮动」是相对**用户自己的目标**成立的真实属性；
  // 若不做这层缩放，它只在一个恰好等于模板合计的目标下才碰巧成立。
  //
  // 浮动区间随目标方向偏移：减脂与维持的日子多数略低于目标，增肌的日子
  // 多数略高于目标。否则盈余的正负分布会与该用户的计划相矛盾——例如一个
  // 减脂用户有六成天数超标。
  const templateSum = meals.reduce((sum, m) => sum + m.template.calories, 0)
  const [lo, hi] = goal.direction === 'bulk' ? [0.95, 1.15] : [0.8, 1.0]
  const dayTarget =
    goal.calories > 0 ? goal.calories * (lo + seededUnit(date, 1) * (hi - lo)) : templateSum
  const dayFactor = templateSum > 0 ? dayTarget / templateSum : 1

  const foods: FoodEntry[] = meals.map((meal, i) =>
    toEntry(
      date,
      i,
      meal.slot,
      meal.template,
      meal.source,
      dayFactor * portionFactor(date, i),
    ),
  )

  const exercises: ExerciseEntry[] = []
  const roll = seededUnit(date, 30)

  if (roll < 0.4) {
    const template = seededPick(date, 31, STRENGTH)
    const setCount = seededInt(date, 32, 3, 5)
    exercises.push({
      id: `${date}-strength`,
      kind: 'strength',
      name: template.name,
      sets: Array.from({ length: setCount }, (_, i) => ({
        reps: seededInt(date, 40 + i, 6, 12),
        weightKg: seededInt(date, 50 + i, 20, 100),
      })),
      caloriesBurned: template.caloriesBurned,
    })
  } else if (roll < 0.7) {
    const template = seededPick(date, 33, CARDIO)
    const minutes = seededInt(date, 34, 20, 50)
    exercises.push({
      id: `${date}-cardio`,
      kind: 'cardio',
      name: template.name,
      minutes,
      caloriesBurned: minutes * template.perMinute,
    })
  }
  // 其余约三成是休息日，没有任何运动记录

  return { date, foods, exercises }
}

export function generateWeight(
  date: string,
  startedAt: string,
  startKg: number,
  targetKg: number,
): number {
  const elapsed = daysBetween(startedAt, date)
  // 用一年半作为收敛期。若收敛期恰好等于使用时长，今天的体重会正好落在目标
  // 上——演示里的用户看起来已经达成目标，体重序列末端也会变成一条平线。
  const progress = Math.min(Math.max(elapsed, 0) / 548, 1)
  const trend = startKg + (targetKg - startKg) * progress
  const noise = (seededUnit(date, 70) - 0.5) * 0.6
  return Math.round((trend + noise) * 10) / 10
}
