import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { dailyTarget } from '@/lib/data/target'
import OnboardingForm from './OnboardingForm'

vi.mock('next/navigation', () => ({ usePathname: () => '/onboarding' }))

/** 与表单里填的东西一致，用来算期望值——公式本身在 lib/data/target.test.ts 里测 */
const PROFILE = {
  sex: 'male' as const,
  heightCm: 175,
  weightKg: 78,
  age: 30,
  activity: 'light' as const,
  direction: 'cut' as const,
}
const EXPECTED = dailyTarget(PROFILE)

async function fillProfile() {
  const user = userEvent.setup()
  render(<OnboardingForm />)

  await user.click(screen.getByRole('button', { name: /减脂/ }))
  await user.click(screen.getByRole('button', { name: '男' }))
  await user.type(screen.getByLabelText('身高（厘米）'), '175')
  await user.type(screen.getByLabelText('当前体重（公斤）'), '78')
  await user.type(screen.getByLabelText('年龄'), '30')
  await user.type(screen.getByLabelText('目标体重（公斤）'), '70')

  return user
}

describe('首次引导页', () => {
  it('提供三种目标方向，且默认一个都不选', () => {
    render(<OnboardingForm />)
    // 每个选项按钮同时渲染标签与提示，可访问名是两者拼接，因此用正则匹配
    for (const label of [/减脂/, /增肌/, /维持/]) {
      // 规格 8.1 节：默认值不得设为减脂，必须要求用户明确选择
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('资料没填完时不能进入下一步', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)

    expect(screen.getByRole('button', { name: '请先填完上面的资料' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /减脂/ }))
    // 只选了方向还不够：身高、体重、年龄、性别都得有（基础代谢的公式需要它们）
    expect(screen.getByRole('button', { name: '请先填完上面的资料' })).toBeDisabled()
  })

  it('资料齐了就能生成目标，并进入第二步', async () => {
    const user = await fillProfile()
    await user.click(screen.getByRole('button', { name: '生成我的目标' }))

    expect(screen.getByText('这是算出来的每日目标')).toBeInTheDocument()
    expect(screen.getByText(/误差在 ±10% 上下/)).toBeInTheDocument()
  })

  it('第二步展示公式算出的热量与三大营养素，并给出目标体重', async () => {
    const user = await fillProfile()
    await user.click(screen.getByRole('button', { name: '生成我的目标' }))

    expect(screen.getByLabelText('每日热量（千卡）')).toHaveValue(String(EXPECTED.calories))
    expect(screen.getByText(`${EXPECTED.protein} 克`)).toBeInTheDocument()
    expect(screen.getByText(`${EXPECTED.fat} 克`)).toBeInTheDocument()
    expect(screen.getByText(`${EXPECTED.exerciseCalories} 千卡`)).toBeInTheDocument()
    expect(screen.getByText('70 kg')).toBeInTheDocument()
  })

  it('热量可以手动微调，碳水跟着重算（三者和热量始终自洽）', async () => {
    const user = await fillProfile()
    await user.click(screen.getByRole('button', { name: '生成我的目标' }))

    const calories = screen.getByLabelText('每日热量（千卡）')
    await user.clear(calories)
    await user.type(calories, '2000')

    const carbs = Math.round((2000 - EXPECTED.protein * 4 - EXPECTED.fat * 9) / 4)
    expect(screen.getByText(`${carbs} 克`)).toBeInTheDocument()
  })

  it('可以回上一步改资料', async () => {
    const user = await fillProfile()
    await user.click(screen.getByRole('button', { name: '生成我的目标' }))
    await user.click(screen.getByRole('button', { name: '回去改资料' }))

    expect(screen.getByLabelText('身高（厘米）')).toHaveValue('175')
    expect(screen.getByRole('button', { name: '生成我的目标' })).toBeEnabled()
  })
})
