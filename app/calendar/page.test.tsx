import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Calendar from './page'
import { TODAY } from '@/lib/data/mock'

vi.mock('next/navigation', () => ({ usePathname: () => '/calendar' }))

describe('日历页', () => {

  it('默认月份由 TODAY 推导，与「今天」所在的月份一致', () => {
    render(<Calendar />)
    const year = Number(TODAY.slice(0, 4))
    const month = Number(TODAY.slice(5, 7))
    // 月份文案在页面上出现两处：导航标题与 CalendarMonth 的表头
    expect(screen.getAllByText(`${year} 年 ${month} 月`).length).toBeGreaterThan(0)
  })

  it('月份文案只出现一处——页面导航，网格不再重复', () => {
    render(<Calendar />)
    const year = Number(TODAY.slice(0, 4))
    const month = Number(TODAY.slice(5, 7))
    expect(screen.getAllByText(`${year} 年 ${month} 月`)).toHaveLength(1)
  })

  it('渲染当月标题', () => {
    render(<Calendar />)
    // 月份文案会出现两处：页面的导航标题，以及 CalendarMonth 自带的表头。
    // 用 getAllByText 而非 getByText——后者在多匹配时会抛错。
    expect(screen.getAllByText(/年.*月/).length).toBeGreaterThan(0)
  })

  it('渲染出今天所在月份的日期链接', () => {
    render(<Calendar />)
    expect(screen.getByRole('link', { name: /2026-09-22/ })).toBeInTheDocument()
  })

  it('开始使用日期之前的月份不渲染任何日期链接', () => {
    render(<Calendar initialYear={2025} initialMonth={8} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/还没有开始使用/)).toBeInTheDocument()
  })
})
