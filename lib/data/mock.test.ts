import { describe, it, expect } from 'vitest'
import {
  TODAY,
  MOCK_USER,
  MOCK_GOAL,
  MOCK_PLAN,
  dayLogFor,
  weightFor,
  weightSeries,
  datesWithRecords,
  recentWeights,
} from './mock'
import { calorieSurplus, hasRecord } from './selectors'

describe('使用范围', () => {
  it('开始使用日期早于今天', () => {
    expect(MOCK_USER.startedAt).toBe('2025-09-22')
  })

  it('早于开始使用日期返回 null，而不是空日志', () => {
    expect(dayLogFor('2025-09-21')).toBeNull()
    expect(weightFor('2025-09-21')).toBeNull()
  })

  it('开始使用当天有数据', () => {
    expect(dayLogFor('2025-09-22')).not.toBeNull()
    expect(weightFor('2025-09-22')).not.toBeNull()
  })

  it('hasRecord 与 dayLogFor 的判定一致', () => {
    for (const date of ['2025-09-21', '2025-09-22', '2026-09-22']) {
      expect(dayLogFor(date) === null).toBe(!hasRecord(date, MOCK_USER.startedAt))
    }
  })
})

describe('确定性（回归保护）', () => {
  it('同一日期两次取值完全相同——若有人改用 Math.random 会立刻失败', () => {
    expect(dayLogFor(TODAY)).toEqual(dayLogFor(TODAY))
    expect(weightFor(TODAY)).toBe(weightFor(TODAY))
  })
})

describe('假数据的覆盖度', () => {
  it('近一年内存在摄入超出目标的日子', () => {
    const over = datesWithRecords('2025-09-22', TODAY).some((date) => {
      const day = dayLogFor(date)
      return day !== null && calorieSurplus(day, MOCK_GOAL) > 0
    })
    expect(over).toBe(true)
  })

  it('近一年内存在摄入低于目标的日子', () => {
    const under = datesWithRecords('2025-09-22', TODAY).some((date) => {
      const day = dayLogFor(date)
      return day !== null && calorieSurplus(day, MOCK_GOAL) < 0
    })
    expect(under).toBe(true)
  })

  it('存在至少一条 AI 估算来源的饮食', () => {
    const hasAi = datesWithRecords('2026-08-01', TODAY).some((date) =>
      (dayLogFor(date)?.foods ?? []).some((f) => f.source === 'ai-estimate'),
    )
    expect(hasAi).toBe(true)
  })

  it('存在至少一次力量训练', () => {
    const hasStrength = datesWithRecords('2026-06-01', TODAY).some((date) =>
      (dayLogFor(date)?.exercises ?? []).some((e) => e.kind === 'strength'),
    )
    expect(hasStrength).toBe(true)
  })

  it('存在至少一天完全没有运动（休息日）', () => {
    const hasRest = datesWithRecords('2026-06-01', TODAY).some(
      (date) => (dayLogFor(date)?.exercises ?? []).length === 0,
    )
    expect(hasRest).toBe(true)
  })
})

describe('weightSeries / datesWithRecords', () => {
  it('weightSeries 覆盖两端且升序', () => {
    const series = weightSeries('2026-09-20', '2026-09-22')
    expect(series.map((w) => w.date)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22'])
  })

  it('weightSeries 起点早于使用范围时返回空数组', () => {
    expect(weightSeries('2025-09-01', '2025-09-10')).toEqual([])
  })

  it('起点晚于终点时返回空数组', () => {
    expect(weightSeries('2026-09-22', '2026-09-20')).toEqual([])
  })

  it('recentWeights 返回 n 条，末条为今天', () => {
    const w = recentWeights(7)
    expect(w).toHaveLength(7)
    expect(w[w.length - 1].date).toBe(TODAY)
  })

  it('datesWithRecords 不含早于开始使用日期的日期', () => {
    const dates = datesWithRecords('2025-09-20', '2025-09-24')
    expect(dates).toEqual(['2025-09-22', '2025-09-23', '2025-09-24'])
  })
})

describe('训练计划', () => {
  it('七个星期齐全，周二为训练日', () => {
    expect(MOCK_PLAN).toHaveLength(7)
    const tuesday = MOCK_PLAN.find((d) => d.weekday === 2)
    expect(tuesday?.items.length).toBeGreaterThan(0)
  })
})
