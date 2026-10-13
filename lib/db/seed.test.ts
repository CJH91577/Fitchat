import { and, count, eq, isNull } from 'drizzle-orm'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { generateDayLog } from '../data/generator'
import { MOCK_GOAL, MOCK_PLAN, MOCK_USER, datesWithRecords } from '../data/mock'
import { TODAY } from '../data/today'
import { createD1Shim } from './d1-shim'
import { DEMO_USER_ID, STARTER_FOODS, seedDatabase } from './seed'
import { type Db, createDb } from './index'
import { applyMigrations } from './migrate'
import {
  exerciseEntries,
  foodEntries,
  foods,
  goals,
  planDays,
  planItems,
  strengthSets,
  users,
  weightEntries,
} from './schema'

const DATES = datesWithRecords(MOCK_USER.startedAt, TODAY)

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-seed-'))

/** 每个测试用一份独立的新库 */
function freshDb(): { db: Db; close: () => void } {
  const path = join(tempDir, `${Math.random().toString(36).slice(2)}.db`)
  applyMigrations(path)
  const shim = createD1Shim(path)
  return { db: createDb(shim), close: () => shim.close() }
}

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

/** rowCount 只认识这几张表——写成联合类型，而不是留一个只当类型用的常量 */
type CountableTable =
  | typeof foodEntries
  | typeof exerciseEntries
  | typeof strengthSets
  | typeof weightEntries
  | typeof users
  | typeof goals
  | typeof planDays
  | typeof planItems
  | typeof foods

async function rowCount(db: Db, table: CountableTable): Promise<number> {
  const row = await db.select({ n: count() }).from(table).get()
  return row?.n ?? 0
}

describe('种子数据', () => {
  it('统计数字与数据层算出的数量一致', async () => {
    const { db, close } = freshDb()
    const summary = await seedDatabase(db)

    const expectedFoods = DATES.reduce(
      (sum, date) => sum + generateDayLog(date, MOCK_GOAL).foods.length,
      0,
    )
    const expectedExercises = DATES.reduce(
      (sum, date) => sum + generateDayLog(date, MOCK_GOAL).exercises.length,
      0,
    )
    const expectedSets = DATES.reduce(
      (sum, date) =>
        sum +
        generateDayLog(date, MOCK_GOAL).exercises.reduce((n, e) => n + (e.sets?.length ?? 0), 0),
      0,
    )

    expect(summary.weightEntries).toBe(DATES.length)
    expect(summary.foodEntries).toBe(expectedFoods)
    expect(summary.exerciseEntries).toBe(expectedExercises)
    expect(summary.strengthSets).toBe(expectedSets)
    expect(summary.foods).toBe(STARTER_FOODS.length)
    expect(summary.planDays).toBe(MOCK_PLAN.length)
    expect(summary.planItems).toBe(MOCK_PLAN.reduce((sum, day) => sum + day.items.length, 0))

    // 统计数字必须与库里真实的行数对得上——否则函数返回的是一份「自述」，
    // 而不是事实。
    expect(await rowCount(db, weightEntries)).toBe(summary.weightEntries)
    expect(await rowCount(db, foodEntries)).toBe(summary.foodEntries)
    expect(await rowCount(db, exerciseEntries)).toBe(summary.exerciseEntries)
    expect(await rowCount(db, strengthSets)).toBe(summary.strengthSets)
    expect(await rowCount(db, foods)).toBe(summary.foods)
    expect(await rowCount(db, planDays)).toBe(summary.planDays)
    expect(await rowCount(db, planItems)).toBe(summary.planItems)

    close()
  })

  it('重复执行是幂等的', async () => {
    const { db, close } = freshDb()
    const first = await seedDatabase(db)
    const second = await seedDatabase(db)

    expect(second).toEqual(first)
    expect(await rowCount(db, users)).toBe(1)
    expect(await rowCount(db, foodEntries)).toBe(second.foodEntries)
    expect(await rowCount(db, weightEntries)).toBe(second.weightEntries)

    close()
  })

  it('某一天落库的记录与数据层算出的完全一致', async () => {
    const { db, close } = freshDb()
    await seedDatabase(db)

    // 抽中间一天：既不是起点也不是今天，避免边界特例掩盖问题。
    const date = DATES[Math.floor(DATES.length / 2)]
    const { dayLogFor } = await import('../data/mock')
    const day = dayLogFor(date)
    if (day === null) throw new Error(`数据层应覆盖 ${date}`)

    const foodRows = await db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, DEMO_USER_ID), eq(foodEntries.date, date)))
      .all()
    const { sumMacros, burnedCalories } = await import('../data/selectors')
    const macrosFromDb = sumMacros(
      foodRows.map((row) => ({
        id: row.id,
        slot: row.slot,
        name: row.name,
        grams: row.grams,
        source: row.source,
        totals: {
          calories: row.calories,
          protein: row.protein,
          carbs: row.carbs,
          fat: row.fat,
        },
      })),
    )
    expect(macrosFromDb).toEqual(sumMacros(day.foods))

    const exerciseRows = await db
      .select()
      .from(exerciseEntries)
      .where(and(eq(exerciseEntries.userId, DEMO_USER_ID), eq(exerciseEntries.date, date)))
      .all()
    const burnedFromDb = burnedCalories({
      date,
      foods: [],
      exercises: exerciseRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name,
        minutes: row.minutes ?? undefined,
        caloriesBurned: row.caloriesBurned,
      })),
    })
    expect(burnedFromDb).toBe(burnedCalories(day))

    close()
  })

  it('每条饮食记录都指向食物库里的一条食物', async () => {
    const { db, close } = freshDb()
    await seedDatabase(db)

    const orphaned = await db
      .select({ n: count() })
      .from(foodEntries)
      .where(isNull(foodEntries.foodId))
      .get()

    expect(orphaned?.n).toBe(0)
    close()
  })

  it('外键真的生效：删掉用户会级联清掉他的记录，但不动共享的食物库', async () => {
    const { db, close } = freshDb()
    const summary = await seedDatabase(db)

    await db.delete(users).where(eq(users.id, DEMO_USER_ID)).run()

    // 外键若没打开（兼容层里少了 PRAGMA foreign_keys = ON），这里会全部失败——
    // 这正是这条测试要盯住的地方。
    expect(await rowCount(db, foodEntries)).toBe(0)
    expect(await rowCount(db, exerciseEntries)).toBe(0)
    expect(await rowCount(db, strengthSets)).toBe(0)
    expect(await rowCount(db, weightEntries)).toBe(0)
    expect(await rowCount(db, goals)).toBe(0)
    expect(await rowCount(db, planDays)).toBe(0)
    expect(await rowCount(db, planItems)).toBe(0)

    // 食物库不属于某个用户，不该被牵连
    expect(await rowCount(db, foods)).toBe(summary.foods)

    close()
  })
})
