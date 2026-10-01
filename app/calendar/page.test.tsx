import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import Calendar from './page'
import { TODAY } from '@/lib/data/mock'

vi.mock('next/navigation', () => ({ usePathname: () => '/calendar' }))

function css(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf8')
}

/**
 * 判断某个选择器的规则块里是否含某条声明。
 * 必须把「选择器」与「声明」绑在同一对花括号内判断——否则像
 * `.weekdays, .grid { … }` 这条共用规则会被误认为 .grid 自身的规则，
 * 结果是断言了一个不相干的块。
 */
function ruleHas(source: string, selector: string, declaration: string): boolean {
  const decl = declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\${selector}\\s*\\{[^}]*${decl}[^}]*\\}`).test(source)
}

describe('日历页', () => {
  it('铺满高度所需的声明都在', () => {
    // 注意这条钉的是**声明**，不是渲染结果——「是否真的铺满手机屏幕」
    // 只有真机能确认。它的价值在于：谁删掉链上的任何一环，这里会立刻转红。
    // 实测过一次：.calendarArea 不是 flex 容器、.wrap 用 height:100% 解析
    // 不到确定高度，于是 grid-auto-rows:1fr 退化成按内容高，网格只有半屏。
    const pageCss = css('app/calendar/calendar.module.css')
    const wrapCss = css('components/CalendarMonth.module.css')

    expect(ruleHas(pageCss, '.page', 'min-height: 100dvh')).toBe(true)
    expect(ruleHas(pageCss, '.calendarArea', 'flex: 1')).toBe(true)
    expect(ruleHas(pageCss, '.calendarArea', 'display: flex')).toBe(true)
    expect(ruleHas(wrapCss, '.wrap', 'flex: 1')).toBe(true)
    expect(ruleHas(wrapCss, '.grid', 'flex: 1')).toBe(true)
    expect(ruleHas(wrapCss, '.grid', 'grid-auto-rows: 1fr')).toBe(true)
  })


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
