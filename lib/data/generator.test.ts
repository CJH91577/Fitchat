import { describe, it, expect } from 'vitest'
import { generateDayLog, generateWeight } from './generator'
import { sumMacros, burnedCalories } from './selectors'
import type { UserGoal } from './types'

const goal: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}

const START = '2025-09-22'

describe('generateDayLog 的确定性', () => {
  it('同一日期两次生成结果完全相等', () => {
    expect(generateDayLog('2026-09-22', goal)).toEqual(generateDayLog('2026-09-22', goal))
  })

  it('不同日期生成结果不同', () => {
    expect(generateDayLog('2026-09-22', goal)).not.toEqual(generateDayLog('2026-09-23', goal))
  })
})

describe('generateDayLog 的内容', () => {
  it('每天包含早、午、晚三餐', () => {
    const day = generateDayLog('2026-09-22', goal)
    const slots = day.foods.map((f) => f.slot)
    expect(slots).toContain('breakfast')
    expect(slots).toContain('lunch')
    expect(slots).toContain('dinner')
  })

  it('加餐若存在，来源为 AI 估算', () => {
    // 扫描 60 天，凡是出现加餐的日子，其加餐必须标为 ai-estimate
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-08-${String((i % 28) + 1).padStart(2, '0')}`
      const snacks = generateDayLog(date, goal).foods.filter((f) => f.slot === 'snack')
      for (const snack of snacks) {
        expect(snack.source).toBe('ai-estimate')
      }
    }
  })

  it('三条主餐的来源不是 AI 估算', () => {
    const day = generateDayLog('2026-09-22', goal)
    const main = day.foods.filter((f) => f.slot !== 'snack')
    expect(main).toHaveLength(3)
    for (const entry of main) {
      expect(entry.source).not.toBe('ai-estimate')
    }
  })

  it('摄入热量在目标附近的合理区间内浮动（抽样 60 天）', () => {
    const totals: number[] = []
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-07-${String((i % 28) + 1).padStart(2, '0')}`
      totals.push(sumMacros(generateDayLog(date, goal).foods).calories)
    }
    for (const total of totals) {
      expect(total).toBeGreaterThan(goal.calories * 0.6)
      expect(total).toBeLessThan(goal.calories * 1.4)
    }
    // 必须既有低于目标也有高于目标的日子，否则盈余永远只有一个符号
    expect(totals.some((t) => t < goal.calories)).toBe(true)
    expect(totals.some((t) => t > goal.calories)).toBe(true)
  })

  it('运动非每日发生：抽样 60 天中既有有运动的日子也有没有的日子', () => {
    const withExercise: number[] = []
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-06-${String((i % 28) + 1).padStart(2, '0')}`
      withExercise.push(burnedCalories(generateDayLog(date, goal)))
    }
    expect(withExercise.some((v) => v > 0)).toBe(true)
    expect(withExercise.some((v) => v === 0)).toBe(true)
  })

  it('力量训练记录的每一组都有正数重量与次数', () => {
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-05-${String((i % 28) + 1).padStart(2, '0')}`
      for (const ex of generateDayLog(date, goal).exercises) {
        if (ex.kind === 'strength') {
          expect(ex.sets?.length).toBeGreaterThan(0)
          for (const set of ex.sets ?? []) {
            expect(set.weightKg).toBeGreaterThan(0)
            expect(set.reps).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('任何数值都不为 NaN、不为负', () => {
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-04-${String((i % 28) + 1).padStart(2, '0')}`
      const day = generateDayLog(date, goal)
      for (const f of day.foods) {
        expect(Number.isFinite(f.totals.calories)).toBe(true)
        expect(f.totals.calories).toBeGreaterThanOrEqual(0)
        expect(f.totals.protein).toBeGreaterThanOrEqual(0)
        expect(f.totals.carbs).toBeGreaterThanOrEqual(0)
        expect(f.totals.fat).toBeGreaterThanOrEqual(0)
      }
      for (const e of day.exercises) {
        expect(Number.isFinite(e.caloriesBurned)).toBe(true)
        expect(e.caloriesBurned).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('generateWeight', () => {
  it('确定性：同一日期两次结果相同', () => {
    expect(generateWeight('2026-09-22', START, 78, 65)).toBe(generateWeight('2026-09-22', START, 78, 65))
  })

  it('开始那天接近起始体重（允许噪点）', () => {
    const w = generateWeight(START, START, 78, 65)
    expect(Math.abs(w - 78)).toBeLessThan(0.5)
  })

  it('随时间向目标体重靠拢', () => {
    const early = generateWeight('2025-10-22', START, 78, 65)
    const late = generateWeight('2026-09-22', START, 78, 65)
    expect(late).toBeLessThan(early)
  })

  it('结果为一位小数且有限', () => {
    for (let i = 0; i < 40; i += 1) {
      const date = `2026-03-${String((i % 28) + 1).padStart(2, '0')}`
      const w = generateWeight(date, START, 78, 65)
      expect(Number.isFinite(w)).toBe(true)
      expect(Math.round(w * 10) / 10).toBe(w)
    }
  })

  it('起始体重等于目标体重时不会除零，也不产生 NaN', () => {
    const w = generateWeight('2026-09-22', START, 70, 70)
    expect(Number.isFinite(w)).toBe(true)
  })
})
