import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CalendarView from './CalendarView'

describe('日历视图', () => {
  it('开始使用之前的月份不渲染任何日期链接', () => {
    render(
      <CalendarView
        today="2026-09-22"
        startedAt="2025-09-22"
        dayResults={{}}
        initialYear={2025}
        initialMonth={8}
      />,
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/还没有开始使用/)).toBeInTheDocument()
  })

  it('整体还没到的月份显示一句说明，而不是一整屏灰格子', () => {
    render(
      <CalendarView
        today="2026-09-22"
        startedAt="2025-09-22"
        dayResults={{}}
        initialYear={2099}
        initialMonth={1}
      />,
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/还没有到/)).toBeInTheDocument()
  })

  it('按两个边界推导每一格的状态：尚未开始 / 可点 / 还没到', () => {
    render(
      <CalendarView
        today="2026-01-20"
        startedAt="2026-01-15"
        dayResults={{
          '2026-01-15': { calories: true, exercise: false },
          '2026-01-20': { calories: false, exercise: true },
        }}
        initialYear={2026}
        initialMonth={1}
      />,
    )

    // 2026 年 1 月：1–14 尚未开始使用，15–20 可点，21–31 还没到
    expect(screen.getAllByTestId('not-started-cell')).toHaveLength(14)
    expect(screen.getAllByTestId('upcoming-cell')).toHaveLength(11)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(6)
    expect(links[0]).toHaveAttribute('href', '/day/2026-01-15')
    expect(links[5]).toHaveAttribute('href', '/day/2026-01-20')

    // 达成状态取自服务端送来的数据
    expect(
      screen.getByRole('link', { name: /2026-01-15，热量达成，运动未达成/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /2026-01-20，热量未达成，运动达成/ }),
    ).toBeInTheDocument()
  })

  it('没有送来数据的区间内日子按未达成处理，不产生 NaN 或崩溃', () => {
    render(
      <CalendarView
        today="2026-01-20"
        startedAt="2025-09-22"
        dayResults={{}}
        initialYear={2026}
        initialMonth={1}
      />,
    )
    expect(
      screen.getByRole('link', { name: /2026-01-10，热量未达成，运动未达成/ }),
    ).toBeInTheDocument()
  })

  it('翻到下个月：标题跟着变，翻到还没到的月份显示说明', () => {
    render(
      <CalendarView
        today="2026-01-20"
        startedAt="2025-09-22"
        dayResults={{}}
        initialYear={2026}
        initialMonth={1}
      />,
    )
    fireEvent.click(screen.getByLabelText('下个月'))
    expect(screen.getByText('2026 年 2 月')).toBeInTheDocument()
    expect(screen.getByText(/还没有到/)).toBeInTheDocument()
  })

  it('翻到上个月：已过去的月份仍然渲染出网格', () => {
    render(
      <CalendarView
        today="2026-01-20"
        startedAt="2025-09-22"
        dayResults={{}}
        initialYear={2026}
        initialMonth={1}
      />,
    )
    fireEvent.click(screen.getByLabelText('上个月'))
    expect(screen.getByText('2025 年 12 月')).toBeInTheDocument()
    expect(screen.queryAllByRole('link').length).toBeGreaterThan(0)
  })

  it('跨年翻月：1 月往前是上一年 12 月', () => {
    render(
      <CalendarView
        today="2026-01-20"
        startedAt="2025-09-22"
        dayResults={{}}
        initialYear={2026}
        initialMonth={1}
      />,
    )
    fireEvent.click(screen.getByLabelText('上个月'))
    expect(screen.getByText('2025 年 12 月')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('下个月'))
    expect(screen.getByText('2026 年 1 月')).toBeInTheDocument()
  })
})
