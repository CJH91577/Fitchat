import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Plan from './page'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/navigation', () => ({
  usePathname: () => '/plan',
  useRouter: () => ({ refresh: () => {} }),
}))
// 页面要求已登录：只替换「从请求里取令牌」这一步，会话查询与用户解析都照跑
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

// 编辑的提交内容要能断言：把 action 换成 spy，提交时收到同一个 FormData。
// 泛型写的是 action 的真实签名——实现不接参数，但 mock.calls 的元组类型要靠它。
const actions = vi.hoisted(() => ({
  savePlanDayAction: vi.fn<
    (
      prev: { error: string | null; savedAt: number },
      formData: FormData,
    ) => Promise<{ error: string | null; savedAt: number }>
  >(async () => ({ error: null, savedAt: 0 })),
}))
vi.mock('./actions', () => actions)

// 页面从数据库读训练计划，先准备一份种子库并把 DATABASE_PATH 指过去
setupSeededDatabase()

describe('训练计划页', () => {
  it('渲染七个星期', async () => {
    render(await Plan())
    for (const w of ['周一', '周二', '周三', '周四', '周五', '周六', '周日']) {
      expect(screen.getByText(w)).toBeInTheDocument()
    }
  })

  it('周二是训练主题「胸 + 三头」而非休息', async () => {
    render(await Plan())
    expect(screen.getByText('胸 + 三头')).toBeInTheDocument()
    expect(screen.getByText('卧推')).toBeInTheDocument()
  })

  it('每一天都有编辑入口（编辑是按钮，不是指向别处的链接）', async () => {
    render(await Plan())
    expect(screen.getAllByRole('button', { name: /^编辑周/ })).toHaveLength(7)
    expect(screen.queryByRole('link', { name: /编辑/ })).not.toBeInTheDocument()
  })

  it('今天那行有「去记录」入口，指向记录运动页', async () => {
    render(await Plan())
    const link = screen.getByRole('link', { name: /去记录/ })
    expect(link).toHaveAttribute('href', '/workouts/new')
  })

  it('点编辑进入编辑态：主题与动作预填，可增删动作', async () => {
    const user = userEvent.setup()
    render(await Plan())

    await user.click(screen.getByRole('button', { name: '编辑周二' }))

    expect(screen.getByLabelText('周二的主题')).toBeInTheDocument()
    expect(screen.getByLabelText('周二的主题')).toHaveValue('胸 + 三头')
    expect(screen.getByLabelText('第 1 个动作名称')).toHaveValue('卧推')
    expect(screen.getByLabelText('第 1 个动作组数')).toHaveValue('4')
    expect(screen.getByLabelText('第 1 个动作次数')).toHaveValue('8–10')

    await user.click(screen.getByRole('button', { name: '添加动作' }))
    expect(screen.getByLabelText('第 4 个动作名称')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除第 4 个动作' }))
    expect(screen.queryByLabelText('第 4 个动作名称')).not.toBeInTheDocument()
  })

  it('保存提交的是星期几、主题与动作列表，没有客户端算出来的东西', async () => {
    const user = userEvent.setup()
    render(await Plan())

    await user.click(screen.getByRole('button', { name: '编辑周二' }))
    const theme = screen.getByLabelText('周二的主题')
    await user.clear(theme)
    await user.type(theme, '背 + 二头')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(actions.savePlanDayAction).toHaveBeenCalled()
    const call = actions.savePlanDayAction.mock.calls[0]
    const form = call[1] as FormData
    expect(form.get('weekday')).toBe('2')
    expect(form.get('theme')).toBe('背 + 二头')
    const items = JSON.parse(String(form.get('items'))) as unknown[]
    expect(items).toEqual([
      { name: '卧推', sets: 4, reps: '8–10' },
      { name: '上斜哑铃卧推', sets: 3, reps: '12' },
      { name: '绳索下压', sets: 3, reps: '15' },
    ])
  })

  it('取消编辑回到只读态，改动不进表单', async () => {
    const user = userEvent.setup()
    render(await Plan())

    await user.click(screen.getByRole('button', { name: '编辑周二' }))
    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByLabelText('周二的主题')).not.toBeInTheDocument()
    expect(screen.getByText('胸 + 三头')).toBeInTheDocument()
  })
})
