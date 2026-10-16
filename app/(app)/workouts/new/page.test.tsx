import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import NewWorkout from './page'
import WorkoutForm from './WorkoutForm'
import type { PlanHint, TodayExercise } from './types'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({
  usePathname: () => '/workouts/new',
  useRouter: () => ({ refresh: () => {} }),
}))
// 页面级测试要求已登录：只替换「从请求里取令牌」这一步，会话查询与用户解析都照跑
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())
// 把「今天」钉在周四（2026-10-15）：演示计划里周四就是「休息」，
// 页面级测试才不随跑测试的星期几而变。
vi.mock('@/lib/data/today', () => ({ today: () => '2026-10-15' }))

// 编辑的提交内容要能断言：把三个 action 换成 spy，提交时收到同一个 FormData。
// 泛型写的是 action 的真实签名——实现不接参数，但 mock.calls 的元组类型要靠它。
const actions = vi.hoisted(() => ({
  saveWorkoutAction: vi.fn<
    (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>
  >(async () => ({ error: null })),
  deleteWorkoutAction: vi.fn<
    (
      prev: { error: string | null; removedAt: number },
      formData: FormData,
    ) => Promise<{ error: string | null; removedAt: number }>
  >(async () => ({ error: null, removedAt: 0 })),
  updateWorkoutAction: vi.fn<
    (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>
  >(async () => ({ error: null })),
}))
vi.mock('./actions', () => actions)

setupSeededDatabase()

const PLAN: PlanHint = {
  theme: '胸 + 三头',
  items: [{ name: '卧推', sets: 4, reps: '8–10' }],
}

const ENTRIES: TodayExercise[] = [
  {
    id: 'x1',
    kind: 'cardio',
    name: '慢跑',
    minutes: 30,
    setCount: 0,
    sets: [],
    caloriesBurned: 300,
  },
  {
    id: 'x2',
    kind: 'strength',
    name: '卧推',
    minutes: null,
    setCount: 3,
    sets: [
      { reps: 8, weightKg: 60 },
      { reps: 8, weightKg: 62.5 },
      { reps: 6, weightKg: 65 },
    ],
    caloriesBurned: 170,
  },
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

  it('休息日只给提示，不给预填按钮', () => {
    renderForm({ theme: '休息', items: [] })
    expect(screen.getByText('今天计划是休息。')).toBeInTheDocument()
    expect(screen.queryByText(/今天该练/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /组 ×/ })).not.toBeInTheDocument()
  })

  it('点「编辑」把有氧记录预填进表单，按钮变成「保存修改」', async () => {
    const user = userEvent.setup()
    renderForm(null, ENTRIES)

    await user.click(screen.getByRole('button', { name: '编辑慢跑' }))

    expect(screen.getByPlaceholderText(/运动名称/)).toHaveValue('慢跑')
    expect(screen.getByLabelText('时长（分钟）')).toHaveValue('30')
    expect(screen.getByRole('button', { name: '保存修改' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消修改' })).toBeInTheDocument()
  })

  it('点「编辑」把力量记录的每一组都预填回来', async () => {
    const user = userEvent.setup()
    renderForm(null, ENTRIES)

    await user.click(screen.getByRole('button', { name: '编辑卧推' }))

    expect(screen.getByPlaceholderText(/动作名称/)).toHaveValue('卧推')
    expect(screen.getByLabelText('第 1 组重量')).toHaveValue('60')
    expect(screen.getByLabelText('第 1 组次数')).toHaveValue('8')
    expect(screen.getByLabelText('第 3 组重量')).toHaveValue('65')
    expect(screen.getByLabelText('第 3 组次数')).toHaveValue('6')
  })

  it('保存修改提交的是 entryId 与改过的数值，千卡由服务端重算', async () => {
    const user = userEvent.setup()
    renderForm(null, ENTRIES)

    await user.click(screen.getByRole('button', { name: '编辑慢跑' }))
    const minutes = screen.getByLabelText('时长（分钟）')
    await user.clear(minutes)
    await user.type(minutes, '45')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    expect(actions.updateWorkoutAction).toHaveBeenCalled()
    const call = actions.updateWorkoutAction.mock.calls[0]
    const form = call[1] as FormData
    expect(form.get('entryId')).toBe('x1')
    expect(form.get('kind')).toBe('cardio')
    expect(form.get('minutes')).toBe('45')
    // 表单里没有 calories 之类的字段：消耗由服务端重算
    expect([...form.keys()]).not.toContain('calories')
  })

  it('取消修改退出编辑态，表单回到新记一条', async () => {
    const user = userEvent.setup()
    renderForm(null, ENTRIES)

    await user.click(screen.getByRole('button', { name: '编辑慢跑' }))
    await user.click(screen.getByRole('button', { name: '取消修改' }))

    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/运动名称/)).toHaveValue('')
  })
})

describe('记录运动页（页面级：计划行要传下来）', () => {
  it('休息日（周四）页面显示「今天计划是休息」，而不是什么都不显示', async () => {
    render(await NewWorkout())
    expect(screen.getByText('今天计划是休息。')).toBeInTheDocument()
    expect(screen.queryByText(/今天该练/)).not.toBeInTheDocument()
  })
})
