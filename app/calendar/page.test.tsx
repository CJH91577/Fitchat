import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import Calendar from './page'
import { TODAY } from '@/lib/data/today'
import { isCalorieOnTarget, isExerciseOnTarget } from '@/lib/data/selectors'
import { dayLogFor, goalFor } from '@/lib/db/queries'
import { getDb, getDemoUser } from '@/lib/db/runtime'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({ usePathname: () => '/calendar' }))

// 日历页在服务端读库，把整段区间的达成情况交给客户端视图
setupSeededDatabase()

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
    const viewCss = css('components/CalendarView.module.css')
    const wrapCss = css('components/CalendarMonth.module.css')

    expect(ruleHas(pageCss, '.page', 'min-height: 100dvh')).toBe(true)
    expect(ruleHas(viewCss, '.calendarArea', 'flex: 1')).toBe(true)
    expect(ruleHas(viewCss, '.calendarArea', 'display: flex')).toBe(true)
    expect(ruleHas(wrapCss, '.wrap', 'flex: 1')).toBe(true)
    expect(ruleHas(wrapCss, '.grid', 'flex: 1')).toBe(true)
    expect(ruleHas(wrapCss, '.grid', 'grid-auto-rows: 1fr')).toBe(true)
  })

  it('默认月份是「今天」所在的月份，且只显示一处', async () => {
    render(await Calendar())
    const year = Number(TODAY.slice(0, 4))
    const month = Number(TODAY.slice(5, 7))
    expect(screen.getAllByText(`${year} 年 ${month} 月`)).toHaveLength(1)
  })

  it('今天那一格是链接，指向当天的详情页', async () => {
    render(await Calendar())
    expect(screen.getByRole('link', { name: new RegExp(TODAY) })).toHaveAttribute(
      'href',
      `/day/${TODAY}`,
    )
  })

  it('每格的达成状态来自数据库，而不是写死的', async () => {
    // 端到端：期望值由查询层算出，页面若没读库（或读错了）就会失败。
    // 取当月 1 号——它必然不晚于今天，也必然不早于开始使用日期。
    render(await Calendar())
    const date = `${TODAY.slice(0, 7)}-01`

    const db = getDb()
    const user = await getDemoUser(db)
    const goal = await goalFor(db, user.id)
    const day = await dayLogFor(db, user, date)
    expect(day).not.toBeNull()
    expect(goal).not.toBeNull()

    const expected = `${date}，热量${isCalorieOnTarget(day!, goal!) ? '达成' : '未达成'}，运动${
      isExerciseOnTarget(day!, goal!) ? '达成' : '未达成'
    }`
    expect(screen.getByRole('link', { name: expected })).toBeInTheDocument()
  })

  it('晚于今天的日子不渲染成链接，今天本身仍然可点', async () => {
    // 回归测试。数据层对未来的日期照样算得出内容（dayLogFor 只看「不早于
    // 开始使用日期」），于是日历曾把整个月的每一天都渲染成链接；而构建时只
    // 预渲染到今天，指向未来的详情页从未存在——线上实测 31 个链接里 19 个
    // 是死链，点进去就是 404。
    render(await Calendar())

    const hrefs = screen
      .queryAllByRole('link')
      .map((el) => el.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/day/'))

    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs.filter((href) => href.slice('/day/'.length) > TODAY)).toEqual([])
    expect(hrefs).toContain(`/day/${TODAY}`)
  })
})
