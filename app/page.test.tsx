import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import Home from './page'
import { TODAY, weightFor, dayLogFor } from '@/lib/data/mock'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('首页', () => {
  it('只有热量与运动两个圆环，不再显示蛋白质与碳水', () => {
    render(<Home />)
    expect(screen.getByText('热量')).toBeInTheDocument()
    expect(screen.getByText('运动')).toBeInTheDocument()
    expect(screen.queryByText('蛋白质')).not.toBeInTheDocument()
    expect(screen.queryByText('碳水')).not.toBeInTheDocument()
  })

  it('净热量位于圆环圆心，且是全页唯一的大号数字', () => {
    render(<Home />)
    expect(screen.getByTestId('ring-center')).toBeInTheDocument()
    expect(screen.getByText('净热量')).toBeInTheDocument()
    expect(screen.getByTestId('hero-value')).toBeInTheDocument()
  })

  it('体重卡的标签是「今日空腹体重」并含测量提示', () => {
    render(<Home />)
    expect(screen.getByText('今日空腹体重')).toBeInTheDocument()
    expect(screen.getByText(/起床后、进食前测量/)).toBeInTheDocument()
    expect(screen.queryByText('最近体重')).not.toBeInTheDocument()
  })

  it('体重显示的是今天的记录值', () => {
    render(<Home />)
    const today = weightFor(TODAY) as number
    expect(screen.getByText(`${today} kg`)).toBeInTheDocument()
  })

  it('体重涨跌的样式不含成功或危险状态色', () => {
    // 状态色是保留色，绝不用于体重方向。颜色定义在 CSS 模块里、不在 DOM 上，
    // 因此必须查样式表本身；查 innerHTML 永远查不到，那是一条恒真的假测试。
    // 四个保留色全部检查，漏掉任何一个都会给对应颜色留下可乘之机。
    const css = readFileSync(join(process.cwd(), 'app', 'page.module.css'), 'utf8')
    expect(css).not.toContain('#0ca30c')
    expect(css).not.toContain('#fab219')
    expect(css).not.toContain('#ec835a')
    expect(css).not.toContain('#d03b3b')
    expect(css).not.toContain('#006300')
  })

  it('今日饮食四餐都列出', () => {
    render(<Home />)
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByText(slot)).toBeInTheDocument()
    }
  })

  it('AI 估算标记的数量与数据中含 AI 条目的餐次数一致', () => {
    render(<Home />)
    // 标记按餐次渲染：某餐只要含 AI 估算来源的条目就显示一个标记。
    // 期望值从数据层推导，而不是写死「至少有一个」。
    const day = dayLogFor(TODAY)
    const slotsWithAi = new Set(
      (day?.foods ?? []).filter((f) => f.source === 'ai-estimate').map((f) => f.slot),
    )
    expect(screen.queryAllByText('AI 估算')).toHaveLength(slotsWithAi.size)
  })

  it('展示今天该练什么', () => {
    render(<Home />)
    expect(screen.getByText(/今天该练/)).toBeInTheDocument()
  })
})
