import { describe, expect, it, vi } from 'vitest'
import { estimateCardioCalories, estimateStrengthCalories } from '@/lib/data/workout'
import { today } from '@/lib/data/today'
import { DEMO_USER_ID } from '@/lib/db/demo'
import { dayLogFor, userById } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import { exerciseEntries, strengthSets, users } from '@/lib/db/schema'
import { addExerciseEntry } from '@/lib/db/writes'
import { deleteWorkoutAction, saveWorkoutAction } from './actions'
import { redirectTarget } from '@/tests/next-navigation-mock'
import { setupSeededDatabase } from '@/tests/seeded-db'

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

async function demoDay() {
  const user = await userById(db(), DEMO_USER_ID)
  if (!user) throw new Error('种子数据里应当有演示用户')
  const day = await dayLogFor(db(), user, today())
  if (!day) throw new Error('演示用户今天应当有记录')
  return day
}

describe('运动消耗的估算', () => {
  it('有氧按时长与强度算，表里没有的动作按中等强度', () => {
    expect(estimateCardioCalories('慢跑', 30, 'moderate')).toBe(300)
    expect(estimateCardioCalories('慢跑', 30, 'easy')).toBe(240)
    expect(estimateCardioCalories('慢跑', 30, 'hard')).toBe(375)
    // 表里没有的动作不会算出 0，而是按默认每分钟 8 千卡
    expect(estimateCardioCalories('划船机', 10, 'moderate')).toBe(80)
  })

  it('力量按组数算', () => {
    expect(estimateStrengthCalories(4)).toBe(160)
    expect(estimateStrengthCalories(0)).toBe(0)
  })
})

describe('保存一条运动', () => {
  it('力量：主记录与每一组在同一个事务里写下去，然后跳回首页', async () => {
    const sets = [
      { reps: 8, weightKg: 60 },
      { reps: 8, weightKg: 62.5 },
      { reps: 6, weightKg: 65 },
    ]

    try {
      await saveWorkoutAction(
        { error: null },
        formData({ kind: 'strength', name: '卧推', sets: JSON.stringify(sets) }),
      )
      throw new Error('本该跳到首页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/')
    }

    const day = await demoDay()
    const saved = day.exercises.find((exercise) => exercise.name === '卧推')
    expect(saved?.kind).toBe('strength')
    expect(saved?.sets).toEqual(sets)
    // 消耗由服务端按组数估，客户端没有发言权
    expect(saved?.caloriesBurned).toBe(estimateStrengthCalories(3))

    const rows = await db().select().from(strengthSets).all()
    const mine = rows.filter((row) => row.entryId === saved?.id)
    // 组序号从 1 开始，且顺序由 set_index 决定，不靠数据库返回顺序
    expect(mine.map((row) => row.setIndex).sort()).toEqual([1, 2, 3])
  })

  it('有氧：时长与强度决定消耗', async () => {
    try {
      await saveWorkoutAction(
        { error: null },
        formData({ kind: 'cardio', name: '骑行', minutes: '40', intensity: 'hard' }),
      )
      throw new Error('本该跳到首页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/')
    }

    const day = await demoDay()
    const saved = day.exercises.find((exercise) => exercise.name === '骑行')
    expect(saved?.minutes).toBe(40)
    expect(saved?.caloriesBurned).toBe(estimateCardioCalories('骑行', 40, 'hard'))
  })

  it('字段不合法时一条都不写', async () => {
    const cases: { name: string; form: Record<string, string> }[] = [
      { name: '没有动作名', form: { kind: 'strength', name: '  ', sets: JSON.stringify([{ reps: 8, weightKg: 60 }]) } },
      { name: '动作名过长', form: { kind: 'strength', name: 'x'.repeat(21), sets: JSON.stringify([{ reps: 8, weightKg: 60 }]) } },
      { name: '组数为空', form: { kind: 'strength', name: '卧推', sets: '[]' } },
      { name: '次数为 0', form: { kind: 'strength', name: '卧推', sets: JSON.stringify([{ reps: 0, weightKg: 60 }]) } },
      { name: '重量过大', form: { kind: 'strength', name: '卧推', sets: JSON.stringify([{ reps: 8, weightKg: 999 }]) } },
      { name: '组数过多', form: { kind: 'strength', name: '卧推', sets: JSON.stringify(Array.from({ length: 21 }, () => ({ reps: 8, weightKg: 60 }))) } },
      { name: '时长缺失', form: { kind: 'cardio', name: '慢跑', minutes: '0', intensity: 'moderate' } },
      { name: '强度非法', form: { kind: 'cardio', name: '慢跑', minutes: '30', intensity: '疯狂' } },
      { name: '类型缺失', form: { kind: '', name: '慢跑' } },
    ]

    for (const { name, form } of cases) {
      const state = await saveWorkoutAction({ error: null }, formData(form))
      expect(state.error, name).not.toBeNull()
    }
  })
})

describe('删除一条运动记录', () => {
  it('只能删自己的：别人的记录删不掉', async () => {
    const now = new Date()
    await db()
      .insert(users)
      .values({
        id: 'gym-rival',
        email: 'gym-rival@fitchat.local',
        passwordHash: null,
        heightCm: null,
        age: null,
        sex: null,
        startedAt: '2026-01-01',
        timezone: 'Asia/Shanghai',
        createdAt: now,
      })
      .run()

    await addExerciseEntry(
      db(),
      'gym-rival',
      today(),
      { kind: 'strength', name: '别人的深蹲', minutes: null, caloriesBurned: 200, sets: [] },
      now,
    )

    const theirs = (await db().select().from(exerciseEntries).all()).find(
      (row) => row.userId === 'gym-rival',
    )
    expect(theirs).toBeTruthy()

    const state = await deleteWorkoutAction(
      { error: null, removedAt: 0 },
      formData({ entryId: theirs!.id }),
    )
    expect(state.error).toMatch(/已经不在了/)
    expect(state.removedAt).toBe(0)
    expect(
      (await db().select().from(exerciseEntries).all()).some((row) => row.id === theirs!.id),
    ).toBe(true)
  })

  it('删自己的记录会真的删掉，连组数一起', async () => {
    try {
      await saveWorkoutAction(
        { error: null },
        formData({
          kind: 'strength',
          name: '待删除的硬拉',
          sets: JSON.stringify([{ reps: 5, weightKg: 100 }]),
        }),
      )
    } catch {
      // redirect 是正常的成功路径
    }

    const before = await demoDay()
    const target = before.exercises.find((exercise) => exercise.name === '待删除的硬拉')
    expect(target).toBeTruthy()
    expect((await db().select().from(strengthSets).all()).some((row) => row.entryId === target!.id)).toBe(true)

    const state = await deleteWorkoutAction(
      { error: null, removedAt: 0 },
      formData({ entryId: target!.id }),
    )
    expect(state.error).toBeNull()

    const after = await demoDay()
    expect(after.exercises.some((exercise) => exercise.id === target!.id)).toBe(false)
    // 组数随主记录一起消失（外键 on delete cascade）
    expect((await db().select().from(strengthSets).all()).some((row) => row.entryId === target!.id)).toBe(false)
  })
})
