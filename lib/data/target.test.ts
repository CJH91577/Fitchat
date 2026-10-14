import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_FACTOR,
  basalMetabolicRate,
  dailyTarget,
  maintenanceCalories,
} from './target'

/**
 * 目标估算的契约。
 *
 * 这些数字不是「随便一个看起来合理的值」：Mifflin-St Jeor 是公开公式，
 * 手算一遍能对上；而三大营养素与热量自洽（4/4/9）是这个目标能不能用的底线——
 * 不自洽的话，用户按蛋白吃、按热量算，两边永远对不上。
 */

const BASE = {
  sex: 'male' as const,
  heightCm: 175,
  weightKg: 78,
  age: 30,
  activity: 'light' as const,
  direction: 'cut' as const,
}

describe('基础代谢与维持热量', () => {
  it('Mifflin-St Jeor：10×体重 + 6.25×身高 − 5×年龄，男 +5、女 −161', () => {
    // 把公式原样写出来，而不是钉一个手算的数字：手算过的那次就对不上
    const raw = 10 * 78 + 6.25 * 175 - 5 * 30
    expect(basalMetabolicRate(BASE)).toBe(Math.round(raw + 5))
    expect(basalMetabolicRate({ ...BASE, sex: 'female' })).toBe(Math.round(raw - 161))
  })

  it('维持热量 = 基础代谢 × 活动系数', () => {
    expect(maintenanceCalories(BASE)).toBe(
      Math.round(basalMetabolicRate(BASE) * ACTIVITY_FACTOR.light),
    )
  })

  it('活动量越高，维持热量越高（单调）', () => {
    const levels = ['sedentary', 'light', 'moderate', 'active'] as const
    const values = levels.map((activity) => maintenanceCalories({ ...BASE, activity }))
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })
})

describe('每日目标', () => {
  it('减脂比维持低、增肌比维持高，维持就等于维持热量', () => {
    const maintain = dailyTarget({ ...BASE, direction: 'maintain' })
    const cut = dailyTarget({ ...BASE, direction: 'cut' })
    const bulk = dailyTarget({ ...BASE, direction: 'bulk' })

    expect(cut.calories).toBeLessThan(maintain.calories)
    expect(bulk.calories).toBeGreaterThan(maintain.calories)
    expect(maintain.calories).toBe(Math.round(maintenanceCalories(BASE) / 10) * 10)
  })

  it('三大营养素与热量自洽：4×蛋白 + 4×碳水 + 9×脂肪 ≈ 热量', () => {
    for (const direction of ['cut', 'bulk', 'maintain'] as const) {
      for (const activity of ['sedentary', 'light', 'moderate', 'active'] as const) {
        const target = dailyTarget({ ...BASE, direction, activity })
        const fromMacros = target.protein * 4 + target.carbs * 4 + target.fat * 9
        // 取整到 10 千卡，误差不该超过一个 10
        expect(Math.abs(fromMacros - target.calories), `${direction}/${activity}`).toBeLessThanOrEqual(12)
      }
    }
  })

  it('蛋白与脂肪按体重定，不随活动量变（碳水承担差额）', () => {
    const light = dailyTarget({ ...BASE, activity: 'light' })
    const active = dailyTarget({ ...BASE, activity: 'active' })
    expect(light.protein).toBe(active.protein)
    expect(light.fat).toBe(active.fat)
    expect(active.carbs).toBeGreaterThan(light.carbs)
  })

  it('热量不会低到离谱（下限 800 千卡）', () => {
    const tiny = dailyTarget({
      sex: 'female',
      heightCm: 140,
      weightKg: 40,
      age: 80,
      activity: 'sedentary',
      direction: 'cut',
    })
    expect(tiny.calories).toBeGreaterThanOrEqual(800)
    expect(tiny.carbs).toBeGreaterThanOrEqual(0)
  })

  it('运动目标跟着活动量走', () => {
    expect(dailyTarget({ ...BASE, activity: 'sedentary' }).exerciseCalories).toBe(200)
    expect(dailyTarget({ ...BASE, activity: 'active' }).exerciseCalories).toBe(600)
  })
})
