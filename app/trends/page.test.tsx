import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Trends from './page'
import { TODAY, weightFor, dayLogFor, MOCK_GOAL, MOCK_USER } from '@/lib/data/mock'
import { calorieSurplus } from '@/lib/data/selectors'

vi.mock('next/navigation', () => ({ usePathname: () => '/trends' }))

function formatSurplus(surplus: number): string {
  if (surplus === 0) return '0'
  return surplus > 0 ? `+${surplus}` : `−${Math.abs(surplus)}`
}

describe('趋势页', () => {
  it('不再渲染任何图表', () => {
    render(<Trends />)
    expect(screen.queryByTestId('chart-weight')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chart-adherence')).not.toBeInTheDocument()
  })

  it('不再有时间区间筛选', () => {
    render(<Trends />)
    expect(screen.queryByRole('group', { name: '时间区间' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /7 天|30 天|90 天/ })).not.toBeInTheDocument()
  })

  it('两张表格都以可滚动容器呈现', () => {
    render(<Trends />)
    expect(screen.getByTestId('weight-table-scroll')).toBeInTheDocument()
    expect(screen.getByTestId('surplus-table-scroll')).toBeInTheDocument()
  })

  it('体重表包含今天的值，与数据层一致', () => {
    render(<Trends />)
    const today = weightFor(TODAY) as number
    expect(screen.getAllByText(String(today)).length).toBeGreaterThan(0)
  })

  it('热量盈余表包含今天的值，与数据层一致', () => {
    render(<Trends />)
    const day = dayLogFor(TODAY)
    expect(day).not.toBeNull()
    const expected = formatSurplus(calorieSurplus(day!, MOCK_GOAL))
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
  })

  it('表格覆盖到开始使用日期那一天', () => {
    render(<Trends />)
    expect(screen.getAllByText(MOCK_USER.startedAt).length).toBeGreaterThan(0)
  })
})
