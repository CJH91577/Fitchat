import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Trends from './page'
import { MOCK_GOAL, TODAY, dayLogFor, weightFor } from '@/lib/data/mock'
import { adherence } from '@/lib/data/selectors'

vi.mock('next/navigation', () => ({
  usePathname: () => '/trends',
}))

function valueCell(table: HTMLElement, date: string): string {
  const row = within(table).getByText(date).closest('tr') as HTMLElement
  return within(row).getAllByRole('cell')[1].textContent as string
}

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

  it('点击「显示体重表格」后出现真实表格，数值与图一致', async () => {
    const user = userEvent.setup()
    render(<Trends />)
    await user.click(screen.getByRole('button', { name: /体重.*表格/ }))

    expect(screen.queryByTestId('chart-weight')).not.toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('体重 (kg)')).toBeInTheDocument()
    expect(valueCell(table, TODAY)).toBe(String(weightFor(TODAY)))
  })

  it('点击「显示达标表格」后出现真实表格，达标率与图一致', async () => {
    const user = userEvent.setup()
    render(<Trends />)
    await user.click(screen.getByRole('button', { name: /达标.*表格/ }))

    expect(screen.queryByTestId('chart-adherence')).not.toBeInTheDocument()
    const table = screen.getByRole('table')
    const expected = `${Math.round(adherence(dayLogFor(TODAY), MOCK_GOAL) * 100)}%`
    expect(valueCell(table, TODAY)).toBe(expected)
  })

  it('7 天视图包含空记录日 2026-09-20，不渲染 NaN 且达标率为 0%', async () => {
    const user = userEvent.setup()
    const { container } = render(<Trends />)
    await user.click(screen.getByRole('button', { name: '7 天' }))

    // 图与月历都不应出现 NaN 或空白占位
    expect(container.innerHTML).not.toContain('NaN')

    await user.click(screen.getByRole('button', { name: /达标.*表格/ }))
    const table = screen.getByRole('table')
    expect(valueCell(table, '2026-09-20')).toBe('0%')
  })
})
