import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Me from './page'
import { MOCK_GOAL, weightFor } from '@/lib/data/mock'
import { today } from '@/lib/data/today'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({ usePathname: () => '/me' }))
// 页面要求已登录：只替换「从请求里取令牌」这一步，会话查询与用户解析都照跑
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

// 页面从数据库读用户与目标；期望值仍由生成器算，于是这里同时验证了迁移没有改变数字
setupSeededDatabase()

describe('我的页', () => {
  it('渲染当前目标', async () => {
    render(await Me())
    expect(screen.getByText('每日目标')).toBeInTheDocument()
    expect(screen.getByText('1800 千卡')).toBeInTheDocument()
  })

  it('目标方向显示为词语而非原始枚举', async () => {
    render(await Me())
    expect(screen.getByText('目标方向')).toBeInTheDocument()
    expect(screen.getByText('减脂')).toBeInTheDocument()
    expect(screen.queryByText('cut')).not.toBeInTheDocument()
  })

  it('个人资料中包含当前体重，取今天的记录值', async () => {
    render(await Me())
    expect(screen.getByText('当前体重')).toBeInTheDocument()
    const todayWeight = weightFor(today()) as number
    expect(screen.getByText(`${todayWeight} kg`)).toBeInTheDocument()
  })

  it('当前体重与目标体重是两个不同的数值', async () => {
    render(await Me())
    // 演示中的用户应当仍在减重途中。若起始体重恰好等于目标、或收敛期与
    // 使用时长相等，今天的体重会等于目标体重，两行就没有任何对比意义。
    const todayWeight = weightFor(today()) as number
    expect(todayWeight).not.toBe(MOCK_GOAL.targetWeightKg)
    expect(screen.getByText(`${todayWeight} kg`)).toBeInTheDocument()
    expect(screen.getByText(`${MOCK_GOAL.targetWeightKg} kg`)).toBeInTheDocument()
  })

  it('退出登录是一个真注销动作，不是指向登录页的链接', async () => {
    render(await Me())
    // 以前这里是一个 <a href="/login">：换了页面而已，会话还是活的，
    // 后退一页就又是登录状态。现在它必须是提交表单的按钮，
    // 交给 Server Action 删掉库里的会话行再清 Cookie。
    const button = screen.getByRole('button', { name: '退出登录' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(screen.queryByRole('link', { name: '退出登录' })).not.toBeInTheDocument()
  })

  it('有导出入口：数据是用户自己的，一键拿走', async () => {
    render(await Me())
    const link = screen.getByRole('link', { name: /导出我的记录/ })
    expect(link).toHaveAttribute('href', '/export')
  })
})
