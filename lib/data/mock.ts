import { addDays, daysBetween } from './dates'
import { generateDayLog, generateWeight } from './generator'
import { hasRecord } from './selectors'
import type { DayLog, PlanDay, UserGoal, WeightEntry } from './types'

export const TODAY = '2026-09-22'

export const MOCK_USER = {
  name: '演示用户',
  heightCm: 175,
  age: 30,
  sex: 'male' as const,
  /** 开始使用日期。它是用户自身的属性，不是全局常量。 */
  startedAt: '2025-09-22',
  /** 开始使用时的体重，生成体重序列的起点 */
  startWeightKg: 78,
}

export const MOCK_GOAL: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}

export const MOCK_PLAN: PlanDay[] = [
  {
    weekday: 1,
    theme: '背 + 二头',
    items: [
      { name: '引体向上', sets: 4, reps: '力竭' },
      { name: '杠铃划船', sets: 4, reps: '10' },
      { name: '哑铃弯举', sets: 3, reps: '12' },
    ],
  },
  {
    weekday: 2,
    theme: '胸 + 三头',
    items: [
      { name: '卧推', sets: 4, reps: '8–10' },
      { name: '上斜哑铃卧推', sets: 3, reps: '12' },
      { name: '绳索下压', sets: 3, reps: '15' },
    ],
  },
  {
    weekday: 3,
    theme: '腿',
    items: [
      { name: '深蹲', sets: 5, reps: '5' },
      { name: '罗马尼亚硬拉', sets: 3, reps: '10' },
    ],
  },
  { weekday: 4, theme: '休息', items: [] },
  {
    weekday: 5,
    theme: '肩 + 核心',
    items: [
      { name: '推举', sets: 4, reps: '8' },
      { name: '侧平举', sets: 4, reps: '15' },
    ],
  },
  { weekday: 6, theme: '有氧', items: [{ name: '慢跑', sets: 1, reps: '40 分钟' }] },
  { weekday: 7, theme: '休息', items: [] },
]

// 早于开始使用日期返回 null（该用户当时还没开始用），
// 与「在范围内但当天没有任何活动」是两种不同状态。
export function dayLogFor(date: string): DayLog | null {
  if (!hasRecord(date, MOCK_USER.startedAt)) return null
  return generateDayLog(date, MOCK_GOAL)
}

export function weightFor(date: string): number | null {
  if (!hasRecord(date, MOCK_USER.startedAt)) return null
  return generateWeight(date, MOCK_USER.startedAt, MOCK_USER.startWeightKg, MOCK_GOAL.targetWeightKg)
}

/** 从 fromKey 到 toKey（含两端）的体重序列，按日期升序；范围外的日期被剔除 */
export function weightSeries(fromKey: string, toKey: string): WeightEntry[] {
  return datesWithRecords(fromKey, toKey).map((date) => ({
    date,
    kg: weightFor(date) as number,
  }))
}

/** 从 fromKey 到 toKey（含两端）中，落在使用范围内的所有日期，升序 */
export function datesWithRecords(fromKey: string, toKey: string): string[] {
  const span = daysBetween(fromKey, toKey)
  if (span < 0) return []
  const all = Array.from({ length: span + 1 }, (_, i) => addDays(fromKey, i))
  return all.filter((date) => hasRecord(date, MOCK_USER.startedAt))
}

/** 最近 n 天的体重序列（含今天），供首页与测试使用 */
export function recentWeights(n: number): WeightEntry[] {
  return weightSeries(addDays(TODAY, -(n - 1)), TODAY)
}
