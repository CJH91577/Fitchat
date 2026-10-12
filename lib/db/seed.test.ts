import { and, count, eq, isNull } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { describe, expect, it } from 'vitest'
import { generateDayLog } from '../data/generator'
import { MOCK_GOAL, MOCK_PLAN, MOCK_USER, TODAY, datesWithRecords, dayLogFor, weightFor } from '../data/mock'
import { burnedCalories, sumMacros } from '../data/selectors'
import type { ExerciseEntry, FoodEntry } from '../data/types'
import { type Db, createDb } from './index'
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
import { DEMO_USER_ID, STARTER_FOODS, seedDatabase } from './seed'

function freshDb(): Db {
  const db = createDb(':memory:')
  migrate(db, { migrationsFolder: './drizzle' })
  return db
}

function rowCount(db: Db, table: typeof foodEntries | typeof exerciseEntries | typeof strengthSets | typeof weightEntries | typeof users | typeof goals | typeof planDays | typeof planItems | typeof foods): number {
  return db.select({ n: count() }).from(table).get()?.n ?? 0
}

const DATES = datesWithRecords(MOCK_USER.startedAt, TODAY)

describe('种子数据', () => {
  it('统计数字与数据层算出的数量一致', () => {
    const db = freshDb()
    const summary = seedDatabase(db)

    const expectedFoods = DATES.reduce((sum, date) => sum + generateDayLog(date, MOCK_GOAL).foods.length, 0)
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
    expect(rowCount(db, weightEntries)).toBe(summary.weightEntries)
    expect(rowCount(db, foodEntries)).toBe(summary.foodEntries)
    expect(rowCount(db, exerciseEntries)).toBe(summary.exerciseEntries)
    expect(rowCount(db, strengthSets)).toBe(summary.strengthSets)
    expect(rowCount(db, foods)).toBe(summary.foods)
    expect(rowCount(db, planDays)).toBe(summary.planDays)
    expect(rowCount(db, planItems)).toBe(summary.planItems)
  })

  it('重复执行是幂等的', () => {
    const db = freshDb()
    const first = seedDatabase(db)
    const second = seedDatabase(db)

    expect(second).toEqual(first)
    expect(rowCount(db, users)).toBe(1)
    expect(rowCount(db, foodEntries)).toBe(second.foodEntries)
    expect(rowCount(db, weightEntries)).toBe(second.weightEntries)
  })

  it('某一天落库的记录与数据层算出的完全一致', () => {
    const db = freshDb()
    seedDatabase(db)

    // 抽中间一天：既不是起点也不是今天，避免边界特例掩盖问题。
    const date = DATES[Math.floor(DATES.length / 2)]
    const day = dayLogFor(date)
    if (day === null) throw new Error(`数据层应覆盖 ${date}`)

    const foodRows = db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, DEMO_USER_ID), eq(foodEntries.date, date)))
      .all()
    const asFoodEntries: FoodEntry[] = foodRows.map((row) => ({
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
    }))
    expect(sumMacros(asFoodEntries)).toEqual(sumMacros(day.foods))

    const exerciseRows = db
      .select()
      .from(exerciseEntries)
      .where(and(eq(exerciseEntries.userId, DEMO_USER_ID), eq(exerciseEntries.date, date)))
      .all()
    const asExercises: ExerciseEntry[] = exerciseRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      minutes: row.minutes ?? undefined,
      caloriesBurned: row.caloriesBurned,
    }))
    expect(burnedCalories({ date, foods: [], exercises: asExercises })).toBe(burnedCalories(day))

    const weightRow = db
      .select()
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, DEMO_USER_ID), eq(weightEntries.date, date)))
      .get()
    expect(weightRow?.kg).toBe(weightFor(date))
  })

  it('每条饮食记录都指向食物库里的一条食物', () => {
    const db = freshDb()
    seedDatabase(db)

    const orphaned = db
      .select({ n: count() })
      .from(foodEntries)
      .where(isNull(foodEntries.foodId))
      .get()?.n

    expect(orphaned).toBe(0)
  })

  it('外键真的生效：删掉用户会级联清掉他的记录，但不动共享的食物库', () => {
    const db = freshDb()
    const summary = seedDatabase(db)

    db.delete(users).where(eq(users.id, DEMO_USER_ID)).run()

    // 外键若没打开（缺少 PRAGMA foreign_keys = ON），这里会全部失败——
    // 这正是这条测试要盯住的地方。
    expect(rowCount(db, foodEntries)).toBe(0)
    expect(rowCount(db, exerciseEntries)).toBe(0)
    expect(rowCount(db, strengthSets)).toBe(0)
    expect(rowCount(db, weightEntries)).toBe(0)
    expect(rowCount(db, goals)).toBe(0)
    expect(rowCount(db, planDays)).toBe(0)
    expect(rowCount(db, planItems)).toBe(0)

    // 食物库不属于某个用户，不该被牵连
    expect(rowCount(db, foods)).toBe(summary.foods)
  })
})
