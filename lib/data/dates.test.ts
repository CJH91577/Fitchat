import { describe, it, expect } from 'vitest'
import { toDateKey, addDays, weekdayOf, lastNDays, monthGrid, daysBetween } from './dates'

describe('toDateKey', () => {
  it('使用本地时区，跨零点不偏移', () => {
    // 本地时间 23:59，若误用 UTC 换算会跑到次日
    expect(toDateKey(new Date(2026, 8, 22, 23, 59))).toBe('2026-09-22')
  })

  it('本地时间 00:01 归属当天', () => {
    expect(toDateKey(new Date(2026, 8, 22, 0, 1))).toBe('2026-09-22')
  })

  it('月份与日补零', () => {
    expect(toDateKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('跨月向前', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('跨月向后', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('跨年前', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('跨年后', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('闰年 2 月', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('weekdayOf', () => {
  it('2026-09-22 是周二', () => {
    expect(weekdayOf('2026-09-22')).toBe(2)
  })

  it('2026-09-21 是周一', () => {
    expect(weekdayOf('2026-09-21')).toBe(1)
  })
})

describe('lastNDays', () => {
  it('含末尾当天，长度等于 n，升序', () => {
    const days = lastNDays('2026-09-22', 3)
    expect(days).toEqual(['2026-09-20', '2026-09-21', '2026-09-22'])
  })
})

describe('monthGrid', () => {
  it('9 月 1 日是周二，首格前应补 1 个空位', () => {
    const grid = monthGrid(2026, 9)
    expect(grid[0]).toBeNull()
    expect(grid[1]).toBe('2026-09-01')
  })

  it('总格数为 7 的倍数', () => {
    for (const m of [1, 2, 4, 9, 12]) {
      expect(monthGrid(2026, m).length % 7).toBe(0)
    }
  })
})

describe('daysBetween', () => {
  it('同一天为 0', () => {
    expect(daysBetween('2026-09-22', '2026-09-22')).toBe(0)
  })

  it('向后为正', () => {
    expect(daysBetween('2026-09-22', '2026-09-25')).toBe(3)
  })

  it('向前为负', () => {
    expect(daysBetween('2026-09-25', '2026-09-22')).toBe(-3)
  })

  it('跨月跨年正确', () => {
    expect(daysBetween('2025-09-22', '2026-09-22')).toBe(365)
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59)
  })
})
