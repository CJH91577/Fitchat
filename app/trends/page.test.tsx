import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Trends from './page'
import { formatSurplus } from '@/components/SurplusTable'
import { MOCK_GOAL, MOCK_USER, dayLogFor, weightFor } from '@/lib/data/mock'
import { addDays, formatMonthDay, lastNDays } from '@/lib/data/dates'
import { today } from '@/lib/data/today'
import { calorieSurplus, isCalorieOnTarget } from '@/lib/data/selectors'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({ usePathname: () => '/trends' }))

/**
 * 页面从数据库读数据，而这里的期望值仍然由**生成器**算出。
 * 于是这组测试同时充当「迁移没有改变任何数字」的端到端检查：
 * 读库读错了、少读了几天、或者哪天算错了，都会在这里失败。
 */
setupSeededDatabase()

const TODAY = today()
/** 表格窗口：最近 7 天 */
const WINDOW = lastNDays(TODAY, 7)

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** 结论行里的涨跌写法，与页面一致：中性色文字令牌，不用红绿 */
function deltaText(delta: number): string {
  const value = round1(delta)
  if (value === 0) return '持平'
  return value > 0 ? `↑${value} kg` : `↓${Math.abs(value)} kg`
}

describe('趋势页', () => {
  it('不再渲染任何图表', async () => {
    render(await Trends())
    expect(screen.queryByTestId('chart-weight')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chart-adherence')).not.toBeInTheDocument()
  })

  it('不再有时间区间筛选', async () => {
    render(await Trends())
    expect(screen.queryByRole('group', { name: '时间区间' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /7 天|30 天|90 天/ })).not.toBeInTheDocument()
  })

  it('窗口写死在卡片上，两处都是「最近 7 天」', async () => {
    render(await Trends())
    expect(screen.getAllByText('最近 7 天')).toHaveLength(2)
  })

  it('两张表格都以可滚动容器呈现', async () => {
    render(await Trends())
    expect(screen.getByTestId('weight-table-scroll')).toBeInTheDocument()
    expect(screen.getByTestId('surplus-table-scroll')).toBeInTheDocument()
  })

  it('只铺最近 7 天，不再把全部历史摊开', async () => {
    render(await Trends())

    // 窗口两端都在
    expect(screen.getAllByText(WINDOW[0]).length).toBeGreaterThan(0)
    expect(screen.getAllByText(TODAY).length).toBeGreaterThan(0)

    // 窗口外的第一天不该出现；开始使用那天（2025-09-22）更不该出现
    expect(screen.queryByText(addDays(TODAY, -7))).not.toBeInTheDocument()
    expect(screen.queryByText(MOCK_USER.startedAt)).not.toBeInTheDocument()
  })

  it('最早一行也带「与昨日」，因为多取了一天做对比', async () => {
    render(await Trends())
    // 表格里最旧的一行也要能算出与昨日的差，否则这一列会出现「—」
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('体重表包含今天的值，与数据层一致', async () => {
    render(await Trends())
    const todayWeight = weightFor(TODAY) as number
    expect(screen.getAllByText(String(todayWeight)).length).toBeGreaterThan(0)
  })

  it('热量盈余表包含今天的值，与数据层一致', async () => {
    render(await Trends())
    const day = dayLogFor(TODAY)
    expect(day).not.toBeNull()
    const expected = formatSurplus(calorieSurplus(day!, MOCK_GOAL))
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
  })

  it('体重结论给出 7 天均值、环比与 30 天跨度', async () => {
    render(await Trends())

    const thisWeek = mean(WINDOW.map((date) => weightFor(date) as number))
    const lastWeek = mean(lastNDays(addDays(TODAY, -7), 7).map((date) => weightFor(date) as number))
    const baselineDate = addDays(TODAY, -30)
    const baseline = weightFor(baselineDate) as number

    const expected =
      `均值 ${round1(thisWeek)} kg，` +
      `比上一个 7 天 ${deltaText(thisWeek - lastWeek)}，` +
      `较 30 天前（${formatMonthDay(baselineDate)}）${deltaText((weightFor(TODAY) as number) - baseline)}。`

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('热量结论的分母是有记录的天数，不是 7', async () => {
    render(await Trends())

    const logged = WINDOW.map((date) => dayLogFor(date)).filter(
      (day) => day !== null && day.foods.length > 0,
    )
    const onTarget = logged.filter((day) => isCalorieOnTarget(day!, MOCK_GOAL)).length

    const expected =
      logged.length === 7
        ? `7 天都记了，其中 ${onTarget} 天热量达成目标。`
        : `7 天里有记录的 ${logged.length} 天，其中 ${onTarget} 天热量达成目标。`

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
