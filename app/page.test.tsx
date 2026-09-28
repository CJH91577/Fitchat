import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Home from './page'
import { TODAY, dayLogFor } from '@/lib/data/mock'

// usePathname 需要 Next 路由上下文；本页不依赖它，直接桩掉
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('首页', () => {
  it('净热量作为 hero 数字出现', () => {
    render(<Home />)
    expect(screen.getByText('净热量')).toBeInTheDocument()
    expect(screen.getByTestId('hero-value')).toBeInTheDocument()
  })

  it('展示四个圆环', () => {
    render(<Home />)
    expect(screen.getByText('热量')).toBeInTheDocument()
    expect(screen.getByText('运动')).toBeInTheDocument()
    expect(screen.getByText('蛋白质')).toBeInTheDocument()
    expect(screen.getByText('碳水')).toBeInTheDocument()
  })

  it('展示今天该练什么（来自训练计划）', () => {
    render(<Home />)
    // 标题渲染为「今天该练 · 胸 + 三头」，需部分匹配而非精确匹配
    expect(screen.getByText('今天该练', { exact: false })).toBeInTheDocument()
  })

  it('四餐都列出', () => {
    render(<Home />)
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByText(slot)).toBeInTheDocument()
    }
  })

  it('AI 估算的条目带可见标记', () => {
    render(<Home />)
    // 标记按餐次渲染：某餐只要含 AI 估算来源的条目就显示一个标记。
    // 期望值从数据层推导，而不是写死「至少有一个」——假数据改为按日期生成后，
    // 今天若没有加餐，正确的期望就是 0 个。
    const day = dayLogFor(TODAY)
    const slotsWithAi = new Set(
      (day?.foods ?? []).filter((f) => f.source === 'ai-estimate').map((f) => f.slot),
    )
    expect(screen.queryAllByText('AI 估算')).toHaveLength(slotsWithAi.size)
  })

  it('体重涨跌的样式不含成功或危险状态色', () => {
    // 状态色是保留色，绝不用于体重方向。颜色定义在 CSS 模块里、不在 DOM 上，
    // 因此必须查样式表本身；查 innerHTML 永远查不到，那是一条恒真的假测试。
    const css = readFileSync(join(process.cwd(), 'app', 'page.module.css'), 'utf8')
    expect(css).not.toContain('#0ca30c')
    expect(css).not.toContain('#fab219')
    expect(css).not.toContain('#ec835a')
    expect(css).not.toContain('#d03b3b')
    expect(css).not.toContain('#006300')
  })
})
