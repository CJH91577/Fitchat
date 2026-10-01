import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import CalendarMonth from './CalendarMonth'

const cells = [null, '2026-09-01', '2026-09-02', '2026-09-22']

const statusByDate = {
  '2026-09-01': { calories: true, exercise: true },
  '2026-09-02': { calories: false, exercise: true },
  '2026-09-22': { calories: true, exercise: false },
}

function renderMonth() {
  return render(
    <CalendarMonth cells={cells} statusByDate={statusByDate} today="2026-09-22" />,
  )
}

function barsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('[data-bar]')] as HTMLElement[]
}

describe('CalendarMonth', () => {
  it('每个日期格都链接到该日的详情页', () => {
    renderMonth()
    expect(screen.getByRole('link', { name: /2026-09-01/ })).toHaveAttribute(
      'href',
      '/day/2026-09-01',
    )
  })

  it('空占位格不渲染链接，也不渲染读条', () => {
    const { container } = renderMonth()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    // 三个日期各两根读条，占位格一根都没有
    expect(barsOf(container)).toHaveLength(6)
  })

  it('每天恰好两根读条，顺序固定为上热量、下运动', () => {
    const { container } = renderMonth()
    expect(barsOf(container).map((b) => b.getAttribute('data-bar'))).toEqual([
      '热量',
      '运动',
      '热量',
      '运动',
      '热量',
      '运动',
    ])
  })

  it('达标填满读条，未达标只画空轨道', () => {
    const { container } = renderMonth()
    const bars = barsOf(container)
    // 2026-09-01 两项都达成
    expect(bars[0].className).toMatch(/barDone/)
    expect(bars[1].className).toMatch(/barDone/)
    // 2026-09-02 只有运动达成 → 热量那根是空轨道
    expect(bars[2].className).not.toMatch(/barDone/)
    expect(bars[3].className).toMatch(/barDone/)
  })

  it('读条颜色与主页圆环用的是同一组令牌', () => {
    const { container } = renderMonth()
    const colors = barsOf(container).map((b) => b.style.getPropertyValue('--bar-color'))
    expect(colors).toEqual([
      'var(--ring-calories)',
      'var(--ring-exercise)',
      'var(--ring-calories)',
      'var(--ring-exercise)',
      'var(--ring-calories)',
      'var(--ring-exercise)',
    ])
  })

  it('未达标的空轨道用灰色，不沿用指标的颜色', () => {
    // 颜色定义在 CSS 模块里、不在 DOM 上，因此必须查样式表本身
    const css = readFileSync(join(process.cwd(), 'components', 'CalendarMonth.module.css'), 'utf8')
    const barRule = /\.bar\s*\{[^}]*\}/.exec(css)
    expect(barRule, '没找到 .bar 规则').not.toBeNull()
    expect(barRule![0]).toContain('var(--text-muted)')
    expect(barRule![0]).not.toContain('--bar-color')
  })

  it('不再渲染图例', () => {
    renderMonth()
    expect(screen.queryByText(/达成/)).not.toBeInTheDocument()
    expect(screen.queryByText(/左点/)).not.toBeInTheDocument()
    expect(screen.queryByText(/尚未开始/)).not.toBeInTheDocument()
  })

  it('不再重复渲染月份表头——月份只由页面的导航显示一次', () => {
    renderMonth()
    expect(screen.queryByText('2026 年 9 月')).not.toBeInTheDocument()
  })

  it('尚未开始使用的日期不可点，也不画读条', () => {
    const { container } = render(
      <CalendarMonth
        cells={['2025-09-01']}
        statusByDate={{ '2025-09-01': { calories: false, exercise: false, notStarted: true } }}
        today="2026-09-22"
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByTestId('not-started-cell')).toBeInTheDocument()
    expect(barsOf(container)).toHaveLength(0)
  })

  it('每个日期格的无障碍名称说明了各项指标是否达成', () => {
    renderMonth()
    // 图例去掉之后，达成与否只靠颜色与填充表达；无障碍名称是替文字读者保留的通道
    expect(screen.getByRole('link', { name: /2026-09-02，热量未达成，运动达成/ })).toBeInTheDocument()
  })
})
