import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { DEMO_USER_ID } from '@/lib/db/demo'
import { getDb } from '@/lib/db/runtime'
import { foodEntries, exerciseEntries, strengthSets, users, weightEntries } from '@/lib/db/schema'
import { addFoodEntries } from '@/lib/db/writes'
import { GET } from './route'
import type { UserExport } from '@/lib/db/queries'
import { redirectTarget } from '@/tests/next-navigation-mock'
import { setSignedIn, setupSeededDatabase } from '@/tests/seeded-db'

/**
 * 「导出我的记录」。
 *
 * 验收口径（TASKS.md P2-13）：导出文件能被解析、条数与库里一致；
 * 只导出当前用户的数据（用第二个用户的夹具做负向测试）。
 */
vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('@/tests/next-navigation-mock')
  return { redirect: redirectMock }
})
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

setupSeededDatabase()

const db = () => getDb()

async function exportedData(): Promise<UserExport> {
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toContain('application/json')
  expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="fitchat-export-.*\.json"$/)
  const parsed = (await response.json()) as UserExport
  expect(parsed.exportedAt).toBeTruthy()
  return parsed
}

describe('导出我的记录', () => {
  it('条数与库里一致：饮食、运动、组数、体重一个不少', async () => {
    const data = await exportedData()

    expect(data.profile.email).toBe('demo@fitchat.local')

    expect(data.foodEntries.length).toBe(
      (await db().select().from(foodEntries).where(eq(foodEntries.userId, DEMO_USER_ID)).all()).length,
    )
    expect(data.exerciseEntries.length).toBe(
      (await db().select().from(exerciseEntries).where(eq(exerciseEntries.userId, DEMO_USER_ID)).all()).length,
    )
    expect(data.weightEntries.length).toBe(
      (await db().select().from(weightEntries).where(eq(weightEntries.userId, DEMO_USER_ID)).all()).length,
    )

    // 力量动作的组数并进各自的条目里，总数一致
    const demoExercises = await db()
      .select()
      .from(exerciseEntries)
      .where(eq(exerciseEntries.userId, DEMO_USER_ID))
      .all()
    const demoStrengthIds = demoExercises.filter((row) => row.kind === 'strength').map((row) => row.id)
    const dbSetCount = (await db().select().from(strengthSets).all()).filter((set) =>
      demoStrengthIds.includes(set.entryId),
    ).length
    const exportedSetCount = data.exerciseEntries
      .filter((entry) => entry.kind === 'strength')
      .reduce((sum, entry) => sum + entry.sets.length, 0)
    expect(exportedSetCount).toBe(dbSetCount)
  })

  it('只导出当前用户：第二个用户的记录一条都不在里面', async () => {
    // 造一个「别人」：他也有自己的饮食与体重
    await db()
      .insert(users)
      .values({
        id: 'export-rival',
        email: 'export-rival@fitchat.local',
        passwordHash: null,
        heightCm: null,
        age: null,
        sex: null,
        startedAt: '2026-01-01',
        timezone: 'Asia/Shanghai',
        createdAt: new Date(),
      })
      .run()
    await addFoodEntries(
      db(),
      'export-rival',
      '2026-10-16',
      'lunch',
      [
        {
          foodId: null,
          name: '别人的秘密午餐',
          grams: 100,
          source: 'user',
          calories: 500,
          protein: 1,
          carbs: 1,
          fat: 1,
        },
      ],
      new Date(),
    )

    const data = await exportedData()

    expect(data.foodEntries.some((row) => row.name === '别人的秘密午餐')).toBe(false)
    expect(data.profile.email).not.toBe('export-rival@fitchat.local')
  })

  it('没登录拿不到导出：跳登录页', async () => {
    setSignedIn(false)
    try {
      await GET()
      throw new Error('本该跳到登录页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/login')
    } finally {
      setSignedIn(true)
    }
  })
})
