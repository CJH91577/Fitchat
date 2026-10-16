import { describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { DEMO_USER_ID } from '@/lib/db/demo'
import { planFor } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import { users } from '@/lib/db/schema'
import { savePlanDay } from '@/lib/db/writes'
import { savePlanDayAction } from './actions'
import { setupSeededDatabase } from '@/tests/seeded-db'

/**
 * 训练计划的写入路径。
 *
 * 计划按 (user_id, weekday) 定位：归属检查是结构性的，用户改的只能是
 * 自己那一行；动作条目整组替换、序号连续。验收口径（TASKS.md P2-11）：
 * 改完刷新仍在、记录页的预填反映新计划、非本人的计划改不动。
 */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('@/tests/next-navigation-mock')
  return { redirect: redirectMock }
})
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

setupSeededDatabase()

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const db = () => getDb()

describe('保存某天的训练计划', () => {
  it('改主题与动作后，读出来的计划就是新的那份', async () => {
    vi.mocked(revalidatePath).mockClear()
    const state = await savePlanDayAction(
      { error: null, savedAt: 0 },
      formData({
        weekday: '2',
        theme: '背 + 二头',
        items: JSON.stringify([
          { name: '引体向上', sets: 4, reps: '力竭' },
          { name: '杠铃划船', sets: 4, reps: '10' },
        ]),
      }),
    )
    expect(state.error).toBeNull()
    expect(state.savedAt).toBeGreaterThan(0)

    const plan = await planFor(db(), DEMO_USER_ID)
    const tuesday = plan.find((day) => day.weekday === 2)
    expect(tuesday?.theme).toBe('背 + 二头')
    expect(tuesday?.items).toEqual([
      { name: '引体向上', sets: 4, reps: '力竭' },
      { name: '杠铃划船', sets: 4, reps: '10' },
    ])

    // 首页的「今天该练」与记录页的预填都读这份计划，缓存要作废
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/', 'layout')
  })

  it('条目整组替换、序号连续：删掉中间一条不留空洞', async () => {
    await savePlanDay(db(), DEMO_USER_ID, {
      weekday: 3,
      theme: '腿',
      items: [
        { name: '深蹲', sets: 5, reps: '5' },
        { name: '罗马尼亚硬拉', sets: 3, reps: '10' },
        { name: '腿举', sets: 3, reps: '12' },
      ],
    })

    await savePlanDayAction(
      { error: null, savedAt: 0 },
      formData({
        weekday: '3',
        theme: '腿',
        items: JSON.stringify([
          { name: '深蹲', sets: 5, reps: '5' },
          { name: '腿举', sets: 3, reps: '12' },
        ]),
      }),
    )

    const plan = await planFor(db(), DEMO_USER_ID)
    const wednesday = plan.find((day) => day.weekday === 3)
    expect(wednesday?.items.map((item) => item.name)).toEqual(['深蹲', '腿举'])
    expect(wednesday?.items).toHaveLength(2)
  })

  it('非本人的计划不受影响：各自的 (user, weekday) 行互不干涉', async () => {
    const other = 'other-planner'
    await db()
      .insert(users)
      .values({
        id: other,
        email: 'other-planner@fitchat.local',
        passwordHash: null,
        heightCm: null,
        age: null,
        sex: null,
        startedAt: '2026-01-01',
        timezone: 'Asia/Shanghai',
        createdAt: new Date(),
      })
      .run()
    await savePlanDay(db(), other, {
      weekday: 2,
      theme: '别人家的周二',
      items: [{ name: '别人的动作', sets: 1, reps: '1' }],
    })

    // 演示用户改自己的周二
    await savePlanDayAction(
      { error: null, savedAt: 0 },
      formData({
        weekday: '2',
        theme: '胸 + 三头',
        items: JSON.stringify([{ name: '卧推', sets: 4, reps: '8–10' }]),
      }),
    )

    const mine = await planFor(db(), DEMO_USER_ID)
    const theirs = await planFor(db(), other)
    expect(mine.find((day) => day.weekday === 2)?.theme).toBe('胸 + 三头')
    expect(theirs.find((day) => day.weekday === 2)?.theme).toBe('别人家的周二')
    expect(theirs.find((day) => day.weekday === 2)?.items).toEqual([
      { name: '别人的动作', sets: 1, reps: '1' },
    ])
  })

  it('休息日就是主题「休息」+ 空动作列表', async () => {
    const state = await savePlanDayAction(
      { error: null, savedAt: 0 },
      formData({ weekday: '4', theme: '休息', items: '[]' }),
    )
    expect(state.error).toBeNull()

    const plan = await planFor(db(), DEMO_USER_ID)
    expect(plan.find((day) => day.weekday === 4)?.items).toEqual([])
  })

  it('星期几、主题、动作列表不合法时都拒绝', async () => {
    const cases: { name: string; form: Record<string, string> }[] = [
      { name: '星期几缺失', form: { theme: '胸', items: '[]' } },
      { name: '星期几越界', form: { weekday: '8', theme: '胸', items: '[]' } },
      { name: '主题为空', form: { weekday: '1', theme: '  ', items: '[]' } },
      { name: '主题过长', form: { weekday: '1', theme: 'x'.repeat(21), items: '[]' } },
      { name: '动作名为空', form: { weekday: '1', theme: '胸', items: JSON.stringify([{ name: '', sets: 3, reps: '10' }]) } },
      { name: '组数为 0', form: { weekday: '1', theme: '胸', items: JSON.stringify([{ name: '卧推', sets: 0, reps: '10' }]) } },
      { name: '次数为空', form: { weekday: '1', theme: '胸', items: JSON.stringify([{ name: '卧推', sets: 3, reps: ' ' }]) } },
      { name: '条目过多', form: { weekday: '1', theme: '胸', items: JSON.stringify(Array.from({ length: 11 }, () => ({ name: '卧推', sets: 3, reps: '10' }))) } },
      { name: '不是 JSON', form: { weekday: '1', theme: '胸', items: '这不是 JSON' } },
    ]

    for (const { name, form } of cases) {
      const state = await savePlanDayAction({ error: null, savedAt: 0 }, formData(form))
      expect(state.error, name).not.toBeNull()
      expect(state.savedAt, name).toBe(0)
    }
  })
})
