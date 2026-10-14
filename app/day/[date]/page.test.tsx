import { cleanup, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DayDetail from './page'
import { MOCK_USER } from '@/lib/data/mock'
import { today } from '@/lib/data/today'
import { addDays } from '@/lib/data/dates'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({ usePathname: () => '/day/2026-09-22' }))

// 页面从数据库读数据，先准备一份种子库并把 DATABASE_PATH 指过去
setupSeededDatabase()

describe('某日详情页的渲染范围', () => {
  it('开始使用那天与今天都能渲染出真实内容，而不是空态', async () => {
    // 这里曾经断言的是 generateStaticParams 的覆盖范围——那是静态导出的产物：
    // 没有服务端，所有路径必须在构建时列出来。现在按请求渲染，清单不存在了，
    // 该验的是「两端都能真的渲染出来」。
    for (const date of [MOCK_USER.startedAt, today()]) {
      const ui = await DayDetail({ params: Promise.resolve({ date }) })
      render(ui)
      expect(screen.getByText(/净热量/)).toBeInTheDocument()
      expect(screen.getByTestId('ring-center')).toBeInTheDocument()
      // 同一次测试里渲染两次会叠加在同一份 document 上，多匹配会让断言失真
      cleanup()
    }
  })

  it('未来的日期显示「还没有到」，而不是渲染成空的一天', async () => {
    // 「那天不存在内容」与「那天用户没记东西」是两件事，说法必须不同——
    // 这与日历上不可点的未来格子是同一件事的两面。
    const ui = await DayDetail({ params: Promise.resolve({ date: addDays(today(), 1) }) })
    render(ui)
    expect(screen.getByText(/还没有到/)).toBeInTheDocument()
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
