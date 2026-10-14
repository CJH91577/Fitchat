import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import WorkoutForm from './WorkoutForm'
import type { PlanHint, TodayExercise } from './types'

vi.mock('next/navigation', () => ({
  usePathname: () => '/workouts/new',
  useRouter: () => ({ refresh: () => {} }),
}))

const PLAN: PlanHint = {
  theme: '胸 + 三头',
  items: [{ name: '卧推', sets: 4, reps: '8–10' }],
}

const ENTRIES: TodayExercise[] = [
  { id: 'x1', kind: 'cardio', name: '慢跑', minutes: 30, setCount: 0, caloriesBurned: 300 },
]

function renderForm(plan: PlanHint | null = null, entries: TodayExercise[] = []) {
  return render(<WorkoutForm plan={plan} entries={entries} />)
}

describe('添加运动页', () => {
  it('提供有氧与力量两条路径', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByRole('button', { name: '力量' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByPlaceholderText(/动作名称/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '有氧' }))

    expect(screen.getByPlaceholderText(/运动名称/)).toBeInTheDocument()
    expect(screen.getByLabelText('时长（分钟）')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '强度' })).toBeInTheDocument()
  })

  it('计划目标只作预填，重量与次数可改，且可增删组', async () => {
    const user = userEvent.setup()
    renderForm()

    // 默认力量模式，预填一组 60kg × 10
    const weight = screen.getByPlaceholderText('重量 kg')
    const reps = screen.getByPlaceholderText('次数')
    expect(weight).toHaveValue('60')
    expect(reps).toHaveValue('10')

    // 预填值不被锁定：记录反映实际发生的
    await user.clear(weight)
    await user.type(weight, '80')
    await user.clear(reps)
    await user.type(reps, '12')
    expect(weight).toHaveValue('80')
    expect(reps).toHaveValue('12')

    // 增组：1 → 2，删组：2 → 1
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '添加一组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: '删除第 2 组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(1)
  })

  it('点今天该练的动作，把动作名与目标组数预填进来', async () => {
    const user = userEvent.setup()
    renderForm(PLAN)

    expect(screen.getByText(/今天该练 · 胸 \+ 三头/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /卧推 · 4 组/ }))

    expect(screen.getByPlaceholderText(/动作名称/)).toHaveValue('卧推')
    expect(screen.getByLabelText('第 4 组次数')).toBeInTheDocument()
  })

  it('同一毫秒内连加两组不会共享 id，删除其一不会误删另一组', async () => {
    const user = userEvent.setup()
    vi.spyOn(Date, 'now').mockReturnValue(1234567890123)
    renderForm()

    await user.click(screen.getByRole('button', { name: '添加一组' }))
    await user.click(screen.getByRole('button', { name: '添加一组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(3)

    // 删除中间一组：其余两组都应保留，而非连同共享 id 的那组一起消失
    await user.click(screen.getByRole('button', { name: '删除第 2 组' }))
    expect(screen.getAllByRole('button', { name: /删除第 \d+ 组/ })).toHaveLength(2)
    vi.restoreAllMocks()
  })

  it('提交里只有重量与次数，没有客户端算好的千卡', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()

    await user.type(screen.getByPlaceholderText(/动作名称/), '卧推')
    const hidden = container.querySelector('input[name="sets"]') as HTMLInputElement
    const sets = JSON.parse(hidden.value) as { reps: number; weightKg: number }[]

    expect(sets).toEqual([{ reps: 10, weightKg: 60 }])
    expect(hidden.value).not.toContain('calories')
  })

  it('有氧的消耗按时长与强度估，并明说只是粗估', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: '有氧' }))
    await user.type(screen.getByPlaceholderText(/运动名称/), '慢跑')

    // 慢跑 10 千卡/分钟 × 30 分钟 = 300
    expect(screen.getByText('300')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '剧烈' }))
    expect(screen.getByText('375')).toBeInTheDocument()
    expect(screen.getByText(/粗估/)).toBeInTheDocument()
  })

  it('名称没填时不让保存（避免存下一条没有动作名的记录）', () => {
    renderForm()
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('今天已记录的条目带删除按钮，且删除是独立的一次提交', () => {
    renderForm(null, ENTRIES)
    expect(screen.getByText('慢跑')).toBeInTheDocument()
    expect(screen.getByText(/30 分钟 · 300 千卡/)).toBeInTheDocument()

    const remove = screen.getByRole('button', { name: '删除慢跑' })
    expect(remove).toHaveAttribute('type', 'submit')
    expect(remove.closest('form')).not.toBeNull()
  })

  it('今天还没有记录时说清楚', () => {
    renderForm(null, [])
    expect(screen.getByText('今天还没有运动记录。')).toBeInTheDocument()
  })
})
