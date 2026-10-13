import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Me from './page'
import { MOCK_GOAL, weightFor } from '@/lib/data/mock'
import { TODAY } from '@/lib/data/today'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({ usePathname: () => '/me' }))

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
    const today = weightFor(TODAY) as number
    expect(screen.getByText(`${today} kg`)).toBeInTheDocument()
  })

  it('当前体重与目标体重是两个不同的数值', async () => {
    render(await Me())
    // 演示中的用户应当仍在减重途中。若起始体重恰好等于目标、或收敛期与
    // 使用时长相等，今天的体重会等于目标体重，两行就没有任何对比意义。
    const today = weightFor(TODAY) as number
    expect(today).not.toBe(MOCK_GOAL.targetWeightKg)
    expect(screen.getByText(`${today} kg`)).toBeInTheDocument()
    expect(screen.getByText(`${MOCK_GOAL.targetWeightKg} kg`)).toBeInTheDocument()
  })
})
