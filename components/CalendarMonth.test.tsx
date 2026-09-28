import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CalendarMonth from './CalendarMonth'

const cells = [null, '2026-09-01', '2026-09-02', '2026-09-22']

const statusByDate = {
  '2026-09-01': { calories: true, exercise: true },
  '2026-09-02': { calories: false, exercise: true },
  '2026-09-22': { calories: true, exercise: false },
}

describe('CalendarMonth', () => {
  it('每个日期格都链接到该日的详情页', () => {
    render(
      <CalendarMonth
        year={2026}
        month={9}
        cells={cells}
        statusByDate={statusByDate}
        today="2026-09-22"
      />,
    )
    expect(screen.getByRole('link', { name: /2026-09-01/ })).toHaveAttribute(
      'href',
      '/day/2026-09-01',
    )
    expect(screen.getByRole('link', { name: /2026-09-22/ })).toHaveAttribute(
      'href',
      '/day/2026-09-22',
    )
  })

  it('空占位格不渲染链接', () => {
    render(
      <CalendarMonth
        year={2026}
        month={9}
        cells={cells}
        statusByDate={statusByDate}
        today="2026-09-22"
      />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('没有状态的日期按未达成渲染，不崩溃', () => {
    const { container } = render(
      <CalendarMonth
        year={2026}
        month={9}
        cells={['2026-09-30']}
        statusByDate={{}}
        today="2026-09-22"
      />,
    )
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('每一天只有两个点：热量与运动', () => {
    const { container } = render(
      <CalendarMonth
        year={2026}
        month={9}
        cells={['2026-09-01']}
        statusByDate={statusByDate}
        today="2026-09-22"
      />,
    )
    const dots = container.querySelectorAll('[data-ring]')
    expect([...dots].map((d) => d.getAttribute('data-ring'))).toEqual(['热量', '运动'])
  })

  it('达成与未达成靠实心/空心区分，不依赖色相', () => {
    const { container } = render(
      <CalendarMonth
        year={2026}
        month={9}
        cells={['2026-09-01', '2026-09-02']}
        statusByDate={statusByDate}
        today="2026-09-22"
      />,
    )
    const firstDayDots = container.querySelectorAll('[data-ring]')
    // 2026-09-01 两项都达成 → 两个点都是实心（类名含 done）
    // 2026-09-02 只有运动达成 → 第一个点空心、第二个实心
    expect(firstDayDots[0].className).toMatch(/dotDone/)
    expect(firstDayDots[1].className).toMatch(/dotDone/)
    expect(firstDayDots[2].className).not.toMatch(/dotDone/)
    expect(firstDayDots[3].className).toMatch(/dotDone/)
  })

  it('图例说明两个点的含义', () => {
    render(
      <CalendarMonth
        year={2026}
        month={9}
        cells={cells}
        statusByDate={statusByDate}
        today="2026-09-22"
      />,
    )
    expect(screen.getByText(/左点.*热量.*右点.*运动/)).toBeInTheDocument()
  })
})
