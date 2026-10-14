import { describe, expect, it, vi } from 'vitest'
import { dailyTarget } from '@/lib/data/target'
import { today } from '@/lib/data/today'
import { DEMO_USER_ID } from '@/lib/db/demo'
import { goalFor, userById, weightFor } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import { saveOnboardingAction } from './actions'
import { redirectTarget } from '@/tests/next-navigation-mock'
import { setupSeededDatabase } from '@/tests/seeded-db'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('@/tests/next-navigation-mock')
  return { redirect: redirectMock }
})
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

setupSeededDatabase()

const db = () => getDb()

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const VALID = {
  heightCm: '180',
  weightKg: '80',
  age: '28',
  sex: 'female',
  activity: 'moderate',
  direction: 'bulk',
  targetWeightKg: '85',
}

const EXPECTED = dailyTarget({
  sex: 'female',
  heightCm: 180,
  weightKg: 80,
  age: 28,
  activity: 'moderate',
  direction: 'bulk',
})

describe('首次引导的写入', () => {
  it('资料、目标、今天的体重三样一次写完，然后回首页', async () => {
    try {
      await saveOnboardingAction({ error: null }, formData(VALID))
      throw new Error('本该跳到首页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/')
    }

    const user = await userById(db(), DEMO_USER_ID)
    expect(user?.heightCm).toBe(180)
    expect(user?.age).toBe(28)
    expect(user?.sex).toBe('female')

    const goal = await goalFor(db(), DEMO_USER_ID)
    expect(goal).toMatchObject({
      direction: 'bulk',
      calories: EXPECTED.calories,
      protein: EXPECTED.protein,
      fat: EXPECTED.fat,
      exerciseCalories: EXPECTED.exerciseCalories,
      targetWeightKg: 85,
    })
    // 三大营养素与热量自洽
    expect(goal!.protein * 4 + goal!.carbs * 4 + goal!.fat * 9).toBeCloseTo(goal!.calories, -1)

    // 「当前体重」记成今天的空腹体重：不写的话首页会显示「今日未记录」，
    // 而目标是按这个体重算出来的——那种半截状态最难解释
    expect(await weightFor(db(), user!, today())).toBe(80)
  })

  it('热量被手动改过时，碳水按剩下的热量重算', async () => {
    try {
      await saveOnboardingAction({ error: null }, formData({ ...VALID, calories: '2400' }))
    } catch {
      // 成功路径就是 redirect
    }

    const goal = await goalFor(db(), DEMO_USER_ID)
    expect(goal?.calories).toBe(2400)
    expect(goal?.carbs).toBe(Math.round((2400 - EXPECTED.protein * 4 - EXPECTED.fat * 9) / 4))
  })

  it('字段不合法时一项都不写', async () => {
    const before = await goalFor(db(), DEMO_USER_ID)

    const cases: Record<string, string>[] = [
      { ...VALID, heightCm: '0' },
      { ...VALID, heightCm: '300' },
      { ...VALID, weightKg: '5' },
      { ...VALID, age: '3' },
      { ...VALID, sex: 'other' },
      { ...VALID, activity: '超人' },
      { ...VALID, direction: 'shred' },
      { ...VALID, targetWeightKg: '1000' },
    ]

    for (const fields of cases) {
      const state = await saveOnboardingAction({ error: null }, formData(fields))
      expect(state.error, JSON.stringify(fields)).not.toBeNull()
    }

    // 目标没有被改动（上面第二个用例刚写过 2400，这里应当还是它）
    expect(await goalFor(db(), DEMO_USER_ID)).toEqual(before)
  })
})
