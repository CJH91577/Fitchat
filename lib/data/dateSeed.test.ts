import { describe, it, expect } from 'vitest'
import { hashSeed, seededUnit, seededInt, seededPick } from './dateSeed'

describe('确定性', () => {
  it('同一输入永远得到同一结果', () => {
    expect(hashSeed('2026-09-22', 1)).toBe(hashSeed('2026-09-22', 1))
    expect(seededUnit('2026-09-22', 1)).toBe(seededUnit('2026-09-22', 1))
    expect(seededInt('2026-09-22', 1, 0, 100)).toBe(seededInt('2026-09-22', 1, 0, 100))
  })

  it('不同日期得到不同结果（抽样 30 天不得全部相同）', () => {
    const values = Array.from({ length: 30 }, (_, i) =>
      seededUnit(`2026-09-${String(i + 1).padStart(2, '0')}`, 1),
    )
    expect(new Set(values).size).toBeGreaterThan(25)
  })

  it('同一日期不同盐值得到不同结果', () => {
    expect(seededUnit('2026-09-22', 1)).not.toBe(seededUnit('2026-09-22', 2))
  })
})

describe('分布', () => {
  // 实测记录：只做 FNV-1a 而没有收尾雪崩混合时，仅末位字符不同的日期串
  // 会产出挤在窄带里的值——salt 30 全部落在 0.056~0.650，salt 1 全部落在
  // 0.227~0.321。这些值互不相同，所以「互不相同」的断言完全抓不到它，
  // 但它会让生成器的分支判定（如 roll < 0.4 / < 0.7）恒定走同一边。
  // 下面两条断言就是为此设的。

  it('salt 30 的取值必须跨越生成器依赖的分界', () => {
    const values = Array.from({ length: 28 }, (_, i) =>
      seededUnit(`2026-06-${String(i + 1).padStart(2, '0')}`, 30),
    )
    expect(values.some((v) => v < 0.4)).toBe(true) // 必须有落在「休息日」一侧的
    expect(values.some((v) => v > 0.7)).toBe(true) // 也必须有落在「有运动」一侧的
  })

  it('值域必须铺开，不是挤在窄带里', () => {
    const values = Array.from({ length: 28 }, (_, i) =>
      seededUnit(`2026-06-${String(i + 1).padStart(2, '0')}`, 1),
    )
    const span = Math.max(...values) - Math.min(...values)
    expect(span).toBeGreaterThan(0.3)
  })
})

describe('seededUnit', () => {
  it('始终落在 [0, 1)', () => {
    for (let i = 1; i <= 200; i += 1) {
      const v = seededUnit(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      expect(Number.isFinite(v)).toBe(true)
    }
  })
})

describe('seededInt', () => {
  it('落在闭区间内且为整数', () => {
    for (let i = 1; i <= 100; i += 1) {
      const v = seededInt(`2026-02-${String((i % 28) + 1).padStart(2, '0')}`, i, 3, 7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('min 等于 max 时恒定返回该值', () => {
    expect(seededInt('2026-09-22', 1, 5, 5)).toBe(5)
  })
})

describe('seededPick', () => {
  it('总是取到数组内的元素', () => {
    const items = ['a', 'b', 'c'] as const
    for (let i = 1; i <= 50; i += 1) {
      expect(items).toContain(seededPick(`2026-03-${String((i % 28) + 1).padStart(2, '0')}`, i, items))
    }
  })

  it('长度 1 的数组恒定返回唯一元素', () => {
    expect(seededPick('2026-09-22', 1, ['only'])).toBe('only')
  })
})
