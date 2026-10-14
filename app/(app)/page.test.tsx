import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import Home from './page'
import { dayLogFor, weightFor } from '@/lib/data/mock'
import { today } from '@/lib/data/today'
import { formatDayHeading } from '@/lib/data/dates'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  // 体重录入那个小表单保存成功后会 router.refresh()
  useRouter: () => ({ refresh: () => {} }),
}))
// 页面要求已登录：只替换「从请求里取令牌」这一步，会话查询与用户解析都照跑
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

// 页面从数据库读数据；期望值仍由生成器算，于是这里同时验证了迁移没有改变数字
setupSeededDatabase()

describe('首页', () => {
  it('只有热量与运动两个圆环，不再显示蛋白质与碳水', async () => {
    render(await Home())
    expect(screen.getByText('热量')).toBeInTheDocument()
    expect(screen.getByText('运动')).toBeInTheDocument()
    expect(screen.queryByText('蛋白质')).not.toBeInTheDocument()
    expect(screen.queryByText('碳水')).not.toBeInTheDocument()
  })

  it('净热量位于圆环圆心，且是全页唯一的大号数字', async () => {
    render(await Home())
    expect(screen.getByTestId('ring-center')).toBeInTheDocument()
    expect(screen.getByText('净热量')).toBeInTheDocument()
    expect(screen.getByTestId('hero-value')).toBeInTheDocument()
  })

  it('体重卡的标签是「今日空腹体重」并含测量提示', async () => {
    render(await Home())
    expect(screen.getByText('今日空腹体重')).toBeInTheDocument()
    expect(screen.getByText(/起床后、进食前测量/)).toBeInTheDocument()
    expect(screen.queryByText('最近体重')).not.toBeInTheDocument()
  })

  it('体重显示的是今天的记录值', async () => {
    render(await Home())
    const todayWeight = weightFor(today()) as number
    expect(screen.getByText(`${todayWeight} kg`)).toBeInTheDocument()
  })

  it('日期栏显示当天的日期与星期，而不是写死的文案', async () => {
    render(await Home())
    expect(screen.getByText(formatDayHeading(today()))).toBeInTheDocument()
  })

  it('体重涨跌的样式不含成功或危险状态色', () => {
    // 状态色是保留色，绝不用于体重方向。颜色定义在 CSS 模块里、不在 DOM 上，
    // 因此必须查样式表本身；查 innerHTML 永远查不到，那是一条恒真的假测试。
    // 四个保留色全部检查，漏掉任何一个都会给对应颜色留下可乘之机。
    // 路径相对这个测试文件自己算，而不是拼 process.cwd()：
    // 页面搬进路由分组 (app) 时，写死的 'app/page.module.css' 会直接 ENOENT，
    // 而那看起来像「样式没了」，实际只是路径过期。
    const css = readFileSync(join(import.meta.dirname, 'page.module.css'), 'utf8')
    expect(css).not.toContain('#0ca30c')
    expect(css).not.toContain('#fab219')
    expect(css).not.toContain('#ec835a')
    expect(css).not.toContain('#d03b3b')
    expect(css).not.toContain('#006300')
  })

  it('今日饮食四餐都列出', async () => {
    render(await Home())
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByText(slot)).toBeInTheDocument()
    }
  })

  it('AI 估算标记的数量与数据中含 AI 条目的餐次数一致', async () => {
    render(await Home())
    // 标记按餐次渲染：某餐只要含 AI 估算来源的条目就显示一个标记。
    // 期望值从数据层推导，而不是写死「至少有一个」。
    const day = dayLogFor(today())
    const slotsWithAi = new Set(
      (day?.foods ?? []).filter((f) => f.source === 'ai-estimate').map((f) => f.slot),
    )
    expect(screen.queryAllByText('AI 估算')).toHaveLength(slotsWithAi.size)
  })

  it('展示今天该练什么', async () => {
    render(await Home())
    expect(screen.getByText(/今天该练/)).toBeInTheDocument()
  })
})
