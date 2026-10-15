import { and, eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { addDays } from '@/lib/data/dates'
import { today } from '@/lib/data/today'
import { DEMO_USER_ID } from '@/lib/db/demo'
import { userById, weightFor } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import { weightEntries } from '@/lib/db/schema'
import { saveWeightAction } from './weight-action'
import { setupSeededDatabase } from '@/tests/seeded-db'

/**
 * 体重写入路径。
 *
 * 日期来自表单、是用户可改的，所以这里验的都是服务端边界：
 * 未来不许记、开始使用之前不许记、同一天重复记是改不是追加。
 */
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
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

async function demoUser() {
  const user = await userById(db(), DEMO_USER_ID)
  if (!user) throw new Error('种子数据里应当有演示用户')
  return user
}

async function rowsOn(date: string): Promise<number> {
  const rows = await db()
    .select({ date: weightEntries.date })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, DEMO_USER_ID), eq(weightEntries.date, date)))
    .all()
  return rows.length
}

describe('保存体重', () => {
  it('可以补记过去的一天，落库到那个日期', async () => {
    const date = addDays(today(), -3)
    const state = await saveWeightAction(
      { error: null, savedAt: 0 },
      formData({ date, kg: '71.3' }),
    )
    expect(state.error).toBeNull()

    const user = await demoUser()
    expect(await weightFor(db(), user, date)).toBe(71.3)
  })

  it('不填日期默认记今天', async () => {
    const state = await saveWeightAction({ error: null, savedAt: 0 }, formData({ kg: '70' }))
    expect(state.error).toBeNull()

    const user = await demoUser()
    expect(await weightFor(db(), user, today())).toBe(70)
  })

  it('未来日期被拒绝：不写库，已有的行也不动', async () => {
    const date = addDays(today(), 1)
    // 种子数据本来就播到了 90 天之后，未来那天已有一行——它必须原样保留
    const user = await demoUser()
    const before = await weightFor(db(), user, date)

    const state = await saveWeightAction(
      { error: null, savedAt: 0 },
      formData({ date, kg: '71' }),
    )
    expect(state.error).toMatch(/还没有到/)

    expect(await weightFor(db(), user, date)).toBe(before)
  })

  it('早于开始使用日期的日子被拒绝', async () => {
    const state = await saveWeightAction(
      { error: null, savedAt: 0 },
      formData({ date: '2025-01-01', kg: '71' }),
    )
    expect(state.error).toMatch(/还没有开始使用/)
  })

  it('日期格式错误被拒绝', async () => {
    const state = await saveWeightAction(
      { error: null, savedAt: 0 },
      formData({ date: '昨天', kg: '71' }),
    )
    expect(state.error).toMatch(/格式不正确/)
  })

  it('同一天重复记是改不是追加：行数不变，值更新', async () => {
    const date = addDays(today(), -2)

    const first = await saveWeightAction(
      { error: null, savedAt: 0 },
      formData({ date, kg: '72' }),
    )
    expect(first.error).toBeNull()
    expect(await rowsOn(date)).toBe(1)

    const second = await saveWeightAction(
      { error: null, savedAt: 0 },
      formData({ date, kg: '73.5' }),
    )
    expect(second.error).toBeNull()
    expect(await rowsOn(date)).toBe(1)

    const user = await demoUser()
    expect(await weightFor(db(), user, date)).toBe(73.5)
  })

  it('体重数值离谱时拒绝', async () => {
    const state = await saveWeightAction({ error: null, savedAt: 0 }, formData({ kg: '9999' }))
    expect(state.error).toMatch(/20–400/)
  })
})
