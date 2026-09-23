import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Trends from './page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/trends',
}))

describe('趋势页', () => {
  it('区间筛选行只有一处', () => {
    render(<Trends />)
    expect(screen.getAllByRole('group', { name: '时间区间' })).toHaveLength(1)
  })

  it('三个区间选项都在', () => {
    render(<Trends />)
    for (const label of ['7 天', '30 天', '90 天']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('体重与达标率是两张独立的图，不共用坐标轴', () => {
    render(<Trends />)
    expect(screen.getByTestId('chart-weight')).toBeInTheDocument()
    expect(screen.getByTestId('chart-adherence')).toBeInTheDocument()
    expect(screen.getByTestId('chart-weight')).not.toBe(
      screen.getByTestId('chart-adherence'),
    )
  })

  it('体重图是单系列，因此不出现图例框', () => {
    render(<Trends />)
    expect(screen.queryByTestId('legend-weight')).not.toBeInTheDocument()
  })

  it('月历渲染出当月日期', () => {
    render(<Trends />)
    expect(screen.getByText('2026 年 9 月')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })

  it('每张图都有等价的表格视图', () => {
    render(<Trends />)
    expect(screen.getByRole('button', { name: /体重.*表格/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /达标.*表格/ })).toBeInTheDocument()
  })
})
