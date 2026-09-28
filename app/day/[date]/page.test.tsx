import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DayDetail from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/day/2026-09-22' }))

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
    // 图例中恰好有两个「数值 / 目标」——这才是「两个圆环」的真正证据
    expect(screen.getAllByText(/\d+ \/ \d+/)).toHaveLength(2)
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
