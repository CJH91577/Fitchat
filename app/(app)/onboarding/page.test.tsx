import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Onboarding from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/onboarding' }))

describe('首次引导页', () => {
  it('提供三种目标方向，且默认不选中减脂', () => {
    render(<Onboarding />)
    // 每个选项按钮同时渲染标签与提示，可访问名是两者拼接，因此用正则匹配
    const cut = screen.getByRole('button', { name: /减脂/ })
    const bulk = screen.getByRole('button', { name: /增肌/ })
    const maintain = screen.getByRole('button', { name: /维持/ })
    // 规格 8.1 节：默认值不得设为减脂，必须要求用户明确选择
    expect(cut).toHaveAttribute('aria-pressed', 'false')
    expect(bulk).toHaveAttribute('aria-pressed', 'false')
    expect(maintain).toHaveAttribute('aria-pressed', 'false')
  })

  it('主按钮在选择目标前禁用，选择后文案变为生成目标', async () => {
    const user = userEvent.setup()
    render(<Onboarding />)

    const primary = screen.getByRole('button', { name: '请先选择目标' })
    expect(primary).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /增肌/ }))

    const next = screen.getByRole('button', { name: '生成我的目标' })
    expect(next).toBeEnabled()
  })
})
