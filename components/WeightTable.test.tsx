import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import WeightTable from './WeightTable'

const rows = [
  { date: '2026-09-22', kg: 68.4, delta: -0.3 },
  { date: '2026-09-21', kg: 68.7, delta: -0.2 },
  { date: '2026-09-20', kg: 68.9, delta: null },
]

describe('WeightTable', () => {
  it('渲染每一行', () => {
    render(<WeightTable rows={rows} />)
    expect(screen.getByText('2026-09-22')).toBeInTheDocument()
    expect(screen.getByText('68.4')).toBeInTheDocument()
  })

  it('差值带方向符号', () => {
    render(<WeightTable rows={rows} />)
    expect(screen.getByText('↓0.3')).toBeInTheDocument()
  })

  it('上涨也用同一个中性记号，不引入好坏含义', () => {
    render(<WeightTable rows={[{ date: '2026-09-19', kg: 69.0, delta: 0.4 }]} />)
    expect(screen.getByText('↑0.4')).toBeInTheDocument()
  })

  it('没有前一日数据时差值显示为占位符，不显示 NaN', () => {
    const { container } = render(<WeightTable rows={rows} />)
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('空数据时显示空态文案', () => {
    render(<WeightTable rows={[]} />)
    expect(screen.getByText(/还没有体重记录/)).toBeInTheDocument()
  })

  it('表格容器可滚动（固定高度）', () => {
    render(<WeightTable rows={rows} />)
    expect(screen.getByTestId('weight-table-scroll')).toBeInTheDocument()
  })
})
