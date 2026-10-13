import { and, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, it } from 'vitest'
import {
  MOCK_GOAL,
  MOCK_PLAN,
  MOCK_USER,
  TODAY,
  dayLogFor as generatedDayLogFor,
  datesWithRecords,
  weightFor as generatedWeightFor,
  weightSeries as generatedWeightSeries,
} from '../data/mock'
import { DEMO_USER_EMAIL, DEMO_USER_ID } from './demo'
import { type Db, createDb } from './index'
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

function seeded(): { db: Db; user: DbUser } {
  const db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
  seedDatabase(db)
  const user = userById(db, DEMO_USER_ID)
  if (!user) throw new Error('种子数据里应当有演示用户')
  return { db, user }
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id))
}

describe('读路径（lib/db/queries）', () => {
  it('userById 返回演示用户，未知 id 返回 null', () => {
    const { db, user } = seeded()
    expect(user.id).toBe(DEMO_USER_ID)
    expect(user.email).toBe(DEMO_USER_EMAIL)
    expect(user.startedAt).toBe(MOCK_USER.startedAt)
    expect(user.heightCm).toBe(MOCK_USER.heightCm)
    expect(user.timezone).toBe('Asia/Shanghai')
    expect(userById(db, 'nobody')).toBeNull()
  })

  it('goalFor 与 fixture 一致，没有目标时返回 null', () => {
    const { db } = seeded()
    expect(goalFor(db, DEMO_USER_ID)).toEqual(MOCK_GOAL)
    expect(goalFor(db, 'nobody')).toBeNull()
  })

  it('planFor 与训练计划 fixture 完全一致', () => {
    const { db } = seeded()
    expect(planFor(db, DEMO_USER_ID)).toEqual(MOCK_PLAN)
    expect(planFor(db, 'nobody')).toEqual([])
  })

  it('dayLogFor 读出的记录与生成器算出的逐字段一致', () => {
    // 这是整条改造的安全垫：读路径换成数据库之后，页面上的数字一个都不该变。
    const { db, user } = seeded()
    const fromDb = dayLogFor(db, user, MID_DATE)
    const fromGenerator = generatedDayLogFor(MID_DATE)

    expect(fromDb).not.toBeNull()
    expect(fromGenerator).not.toBeNull()
    expect(sortById(fromDb?.foods ?? [])).toEqual(sortById(fromGenerator?.foods ?? []))
    expect(sortById(fromDb?.exercises ?? [])).toEqual(sortById(fromGenerator?.exercises ?? []))
    // 运动里还嵌着组数，单独再钉一次
    const setsFromDb = (fromDb?.exercises ?? []).flatMap((e) => e.sets ?? [])
    const setsFromGenerator = (fromGenerator?.exercises ?? []).flatMap((e) => e.sets ?? [])
    expect(setsFromDb).toEqual(setsFromGenerator)
  })

  it('早于开始使用日期的日子返回 null——它是「还没开始用」，不是「那天没记」', () => {
    const { db, user } = seeded()
    expect(dayLogFor(db, user, '2025-09-21')).toBeNull()
    expect(weightFor(db, user, '2025-09-21')).toBeNull()
  })

  it('范围内但那天什么都没记，返回空数组而不是 null', () => {
    // 这两种状态在界面上说法不同，合并掉就丢了一个真实状态
    const { db, user } = seeded()
    db.delete(foodEntries)
      .where(and(eq(foodEntries.userId, DEMO_USER_ID), eq(foodEntries.date, MID_DATE)))
      .run()
    db.delete(exerciseEntries)
      .where(and(eq(exerciseEntries.userId, DEMO_USER_ID), eq(exerciseEntries.date, MID_DATE)))
      .run()

    expect(dayLogFor(db, user, MID_DATE)).toEqual({ date: MID_DATE, foods: [], exercises: [] })
  })

  it('weightFor 与生成器一致；没有记录的那天返回 null', () => {
    const { db, user } = seeded()
    expect(weightFor(db, user, MID_DATE)).toBe(generatedWeightFor(MID_DATE))

    db.delete(weightEntries)
      .where(and(eq(weightEntries.userId, DEMO_USER_ID), eq(weightEntries.date, MID_DATE)))
      .run()
    expect(weightFor(db, user, MID_DATE)).toBeNull()
  })

  it('weightSeries 与生成器一致，且只覆盖给定区间', () => {
    const { db, user } = seeded()
    const from = DATES[0]
    const to = DATES[9]
    expect(weightSeries(db, user, from, to)).toEqual(generatedWeightSeries(from, to))

    // 区间之外（开始使用之前）不该冒出记录
    expect(weightSeries(db, user, '2025-01-01', '2025-09-21')).toEqual([])
  })
})
