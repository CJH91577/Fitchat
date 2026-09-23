import { describe, it, expect } from 'vitest'
import { MOCK_DAYS, MOCK_WEIGHTS, dayLogFor } from './mock'
import { sumMacros, netCalories } from './selectors'
import { MOCK_GOAL } from './mock'

describe('假数据', () => {
  it('包含一天摄入超出目标', () => {
    const over = Object.values(MOCK_DAYS).some(
      (d) => sumMacros(d.foods).calories > MOCK_GOAL.calories,
    )
    expect(over).toBe(true)
  })

  it('包含一天无任何记录', () => {
    const empty = Object.values(MOCK_DAYS).some(
      (d) => d.foods.length === 0 && d.exercises.length === 0,
    )
    expect(empty).toBe(true)
  })

  it('包含至少一条 AI 估算来源的饮食', () => {
    const hasAi = Object.values(MOCK_DAYS).some((d) =>
      d.foods.some((f) => f.source === 'ai-estimate'),
    )
    expect(hasAi).toBe(true)
  })

  it('包含至少一次力量训练记录', () => {
    const hasStrength = Object.values(MOCK_DAYS).some((d) =>
      d.exercises.some((e) => e.kind === 'strength'),
    )
    expect(hasStrength).toBe(true)
  })

  it('查询未记录的日期返回空日志而非 undefined', () => {
    expect(dayLogFor('2020-01-01').foods).toEqual([])
    expect(dayLogFor('2020-01-01').exercises).toEqual([])
  })

  it('体重序列覆盖 90 天且不含 NaN', () => {
    expect(MOCK_WEIGHTS).toHaveLength(90)
    expect(MOCK_WEIGHTS.every((w) => Number.isFinite(w.kg))).toBe(true)
  })

  it('净热量计算对空记录返回 0', () => {
    expect(netCalories(dayLogFor('2020-01-01'))).toBe(0)
  })
})
