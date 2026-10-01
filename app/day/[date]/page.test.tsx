import { cleanup, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DayDetail, { generateStaticParams } from './page'
import { MOCK_USER, TODAY, datesWithRecords } from '@/lib/data/mock'

vi.mock('next/navigation', () => ({ usePathname: () => '/day/2026-09-22' }))

describe('某日详情页的预渲染范围', () => {
  it('覆盖从开始使用日期到今天的每一天，且不重复', () => {
    const dates = generateStaticParams().map((p) => p.date)
    const expected = datesWithRecords(MOCK_USER.startedAt, TODAY)

    expect(dates).toEqual(expected)
    expect(dates[0]).toBe(MOCK_USER.startedAt)
    expect(dates[dates.length - 1]).toBe(TODAY)
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('首尾两天都能渲染出真实内容，而不是空态', async () => {
    const dates = generateStaticParams().map((p) => p.date)

    for (const date of [dates[0], dates[dates.length - 1]]) {
      const ui = await DayDetail({ params: Promise.resolve({ date }) })
      render(ui)
      expect(screen.getByText(/净热量/)).toBeInTheDocument()
      expect(screen.getByTestId('ring-center')).toBeInTheDocument()
      // 同一次测试里渲染两次会叠加在同一份 document 上，多匹配会让断言失真
      cleanup()
    }
  })
})

describe('某日详情页', () => {
  it('标题显示所选日期', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2026-09-22' }) })
    render(ui)
    expect(screen.getByText(/9月22日/)).toBeInTheDocument()
  })

  it('与首页同构：两个圆环 + 圆心净热量', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2026-09-22' }) })
    render(ui)
    expect(screen.getByTestId('ring-center')).toBeInTheDocument()
    expect(screen.getByText('净热量')).toBeInTheDocument()
    // 「热量」只出现在圆环图例里，可以精确匹配；
    // 「运动」同时是本页一个区块的标题，因此会出现两处，需用 getAllByText。
    expect(screen.getByText('热量')).toBeInTheDocument()
    expect(screen.getAllByText('运动').length).toBeGreaterThan(0)
    // 图例中恰好有两个「数值 / 目标」——这才是「两个圆环」的真正证据。
    // 字符类含小数点：当前生成器产出的都是整数，但断言不该假定这一点，
    // 否则将来出现小数（如蛋白 76.5）会静默失配。
    expect(screen.getAllByText(/[\d.]+ \/ [\d.]+/)).toHaveLength(2)
  })

  it('只读：不提供任何记录入口', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2026-09-22' }) })
    render(ui)
    expect(screen.queryByText('开始记录')).not.toBeInTheDocument()
    expect(screen.queryByText(/添加/)).not.toBeInTheDocument()
  })

  it('日期早于开始使用日期时显示明确的空态，而非空日志', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2025-09-21' }) })
    render(ui)
    expect(screen.getByText(/还没有开始使用/)).toBeInTheDocument()
  })

  it('范围外日期不产生 NaN', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2025-09-21' }) })
    const { container } = render(ui)
    expect(container.innerHTML).not.toContain('NaN')
  })

  it('非法日期字符串不崩溃，显示空态', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: 'not-a-date' }) })
    const { container } = render(ui)
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getByText(/格式不正确/)).toBeInTheDocument()
  })

  it('非法日期如 2026-13-45 也被拒绝，不产生 Invalid Date', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2026-13-45' }) })
    const { container } = render(ui)
    expect(container.innerHTML).not.toContain('Invalid Date')
    expect(container.innerHTML).not.toContain('NaN')
  })
})
