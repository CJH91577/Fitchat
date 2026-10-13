import { and, eq } from 'drizzle-orm'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  MOCK_GOAL,
  MOCK_PLAN,
  MOCK_USER,
  datesWithRecords,
  dayLogFor as generatedDayLogFor,
  weightFor as generatedWeightFor,
  weightSeries as generatedWeightSeries,
} from '../data/mock'
import { TODAY } from '../data/today'
import { createD1Shim } from './d1-shim'
import { DEMO_USER_EMAIL, DEMO_USER_ID } from './demo'
import { type Db, createDb } from './index'
import { applyMigrations } from './migrate'
import {
  type DbUser,
  dayLogFor,
  goalFor,
  planFor,
  userById,
  weightFor,
  weightSeries,
} from './queries'
import { exerciseEntries, foodEntries, weightEntries } from './schema'
import { seedDatabase } from './seed'

const DATES = datesWithRecords(MOCK_USER.startedAt, TODAY)
const MID_DATE = DATES[Math.floor(DATES.length / 2)]

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-queries-'))

/** 每个测试用一份独立的新库——有的测试会删数据，共享一份会互相污染 */
async function freshSeeded(): Promise<{ db: Db; user: DbUser; close: () => void }> {
  const path = join(tempDir, `${Math.random().toString(36).slice(2)}.db`)
  applyMigrations(path)
  const shim = createD1Shim(path)
  const db = createDb(shim)
  await seedDatabase(db)

  const user = await userById(db, DEMO_USER_ID)
  if (!user) throw new Error('种子数据里应当有演示用户')

  return { db, user, close: () => shim.close() }
}

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id))
}

describe('读路径（lib/db/queries）', () => {
  it('userById 返回演示用户，未知 id 返回 null', async () => {
    const { db, user, close } = await freshSeeded()
    expect(user.id).toBe(DEMO_USER_ID)
    expect(user.email).toBe(DEMO_USER_EMAIL)
    expect(user.startedAt).toBe(MOCK_USER.startedAt)
    expect(user.heightCm).toBe(MOCK_USER.heightCm)
    expect(user.timezone).toBe('Asia/Shanghai')
    await expect(userById(db, 'nobody')).resolves.toBeNull()
    close()
  })

  it('goalFor 与 fixture 一致，没有目标时返回 null', async () => {
    const { db, close } = await freshSeeded()
    await expect(goalFor(db, DEMO_USER_ID)).resolves.toEqual(MOCK_GOAL)
    await expect(goalFor(db, 'nobody')).resolves.toBeNull()
    close()
  })

  it('planFor 与训练计划 fixture 完全一致', async () => {
    const { db, close } = await freshSeeded()
    await expect(planFor(db, DEMO_USER_ID)).resolves.toEqual(MOCK_PLAN)
    await expect(planFor(db, 'nobody')).resolves.toEqual([])
    close()
  })

  it('dayLogFor 读出的记录与生成器算出的逐字段一致', async () => {
    // 这是整条改造的安全垫：读路径换成数据库之后，页面上的数字一个都不该变。
    const { db, user, close } = await freshSeeded()
    const fromDb = await dayLogFor(db, user, MID_DATE)
    const fromGenerator = generatedDayLogFor(MID_DATE)

    expect(fromDb).not.toBeNull()
    expect(fromGenerator).not.toBeNull()
    expect(sortById(fromDb?.foods ?? [])).toEqual(sortById(fromGenerator?.foods ?? []))
    expect(sortById(fromDb?.exercises ?? [])).toEqual(sortById(fromGenerator?.exercises ?? []))

    // 运动里还嵌着组数，单独再钉一次
    const setsFromDb = (fromDb?.exercises ?? []).flatMap((e) => e.sets ?? [])
    const setsFromGenerator = (fromGenerator?.exercises ?? []).flatMap((e) => e.sets ?? [])
    expect(setsFromDb).toEqual(setsFromGenerator)
    close()
  })

  it('早于开始使用日期的日子返回 null——它是「还没开始用」，不是「那天没记」', async () => {
    const { db, user, close } = await freshSeeded()
    await expect(dayLogFor(db, user, '2025-09-21')).resolves.toBeNull()
    await expect(weightFor(db, user, '2025-09-21')).resolves.toBeNull()
    close()
  })

  it('范围内但那天什么都没记，返回空数组而不是 null', async () => {
    // 这两种状态在界面上说法不同，合并掉就丢了一个真实状态
    const { db, user, close } = await freshSeeded()
    await db
      .delete(foodEntries)
      .where(and(eq(foodEntries.userId, DEMO_USER_ID), eq(foodEntries.date, MID_DATE)))
      .run()
    await db
      .delete(exerciseEntries)
      .where(and(eq(exerciseEntries.userId, DEMO_USER_ID), eq(exerciseEntries.date, MID_DATE)))
      .run()

    await expect(dayLogFor(db, user, MID_DATE)).resolves.toEqual({
      date: MID_DATE,
      foods: [],
      exercises: [],
    })
    close()
  })

  it('weightFor 与生成器一致；没有记录的那天返回 null', async () => {
    const { db, user, close } = await freshSeeded()
    await expect(weightFor(db, user, MID_DATE)).resolves.toBe(generatedWeightFor(MID_DATE))

    await db
      .delete(weightEntries)
      .where(and(eq(weightEntries.userId, DEMO_USER_ID), eq(weightEntries.date, MID_DATE)))
      .run()
    await expect(weightFor(db, user, MID_DATE)).resolves.toBeNull()
    close()
  })

  it('weightSeries 与生成器一致，且只覆盖给定区间', async () => {
    const { db, user, close } = await freshSeeded()
    const from = DATES[0]
    const to = DATES[9]
    await expect(weightSeries(db, user, from, to)).resolves.toEqual(
      generatedWeightSeries(from, to),
    )

    // 区间之外（开始使用之前）不该冒出记录
    await expect(weightSeries(db, user, '2025-01-01', '2025-09-21')).resolves.toEqual([])
    close()
  })
})
