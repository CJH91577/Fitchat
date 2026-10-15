import { and, eq, gte, lte } from 'drizzle-orm'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { addDays, dateRange } from '../data/dates'
import { dayLogFor as mockDayLogFor, weightFor as mockWeightFor } from '../data/mock'
import { today } from '../data/today'
import { ensureDatabase } from './bootstrap'
import { DEMO_USER_ID } from './demo'
import { type Db } from './index'
import { applyMigrations } from './migrate'
import { goalFor, userById, weightSeries } from './queries'
import { openLocalDb } from './runtime'
import { exerciseEntries, foodEntries, goals, strengthSets, weightEntries } from './schema'
import { RESEED_THRESHOLD_DAYS, SEED_HORIZON_DAYS, seedDatabase } from './seed'

const tempDir = mkdtempSync(join(tmpdir(), 'fitchat-bootstrap-'))

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

/** 把库路径指到临时目录里的一份库上，然后跑一次「首次启动」 */
async function bootstrapAt(name: string): Promise<string> {
  const path = join(tempDir, name)
  const previous = process.env.DATABASE_PATH
  process.env.DATABASE_PATH = path
  try {
    await ensureDatabase()
  } finally {
    if (previous === undefined) delete process.env.DATABASE_PATH
    else process.env.DATABASE_PATH = previous
  }
  return path
}

/** 在同一个库上再跑一次「启动」（模拟容器重启） */
async function restart(path: string): Promise<void> {
  const previous = process.env.DATABASE_PATH
  process.env.DATABASE_PATH = path
  try {
    await ensureDatabase()
  } finally {
    if (previous === undefined) delete process.env.DATABASE_PATH
    else process.env.DATABASE_PATH = previous
  }
}

type EntryTableCounts = { food: number; exercise: number; sets: number; weight: number }

/** 四张记录表各自的总行数——续播「不写一行」断言用 */
async function entryTableCounts(db: Db): Promise<EntryTableCounts> {
  const [food, exercise, sets, weight] = await Promise.all([
    db.select({ id: foodEntries.id }).from(foodEntries).all(),
    db.select({ id: exerciseEntries.id }).from(exerciseEntries).all(),
    db.select({ id: strengthSets.id }).from(strengthSets).all(),
    db.select({ date: weightEntries.date }).from(weightEntries).all(),
  ])
  return { food: food.length, exercise: exercise.length, sets: sets.length, weight: weight.length }
}

/** date（含）及以前的记录行数；力量组数按「挂在旧运动记录下」在 JS 里联表 */
async function countRowsUpTo(db: Db, date: string): Promise<EntryTableCounts> {
  const [food, exercise, sets, weight] = await Promise.all([
    db
      .select({ id: foodEntries.id })
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, DEMO_USER_ID), lte(foodEntries.date, date)))
      .all(),
    db
      .select({ id: exerciseEntries.id })
      .from(exerciseEntries)
      .where(and(eq(exerciseEntries.userId, DEMO_USER_ID), lte(exerciseEntries.date, date)))
      .all(),
    db.select().from(strengthSets).all(),
    db
      .select({ date: weightEntries.date })
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, DEMO_USER_ID), lte(weightEntries.date, date)))
      .all(),
  ])
  const oldEntryIds = new Set(exercise.map((row) => row.id))
  return {
    food: food.length,
    exercise: exercise.length,
    sets: sets.filter((row) => oldEntryIds.has(row.entryId)).length,
    weight: weight.length,
  }
}

describe('首次启动建库（容器启动走的就是这条路）', () => {
  it('库不存在时：建库、跑迁移、播种，并多播到 90 天之后', async () => {
    const path = await bootstrapAt('fresh.db')

    process.env.DATABASE_PATH = path
    const { db, close } = openLocalDb(path)
    try {
      const user = await userById(db, DEMO_USER_ID)
      if (!user) throw new Error('首次启动应当把演示用户建出来')
      expect(await goalFor(db, DEMO_USER_ID)).not.toBeNull()

      // 演示站必须是「打开就有内容」的：库里得有今天之后的数据，
      // 否则播种日一过，首页就开始显示「未记录」，看起来像坏了。
      const horizon = addDays(today(), SEED_HORIZON_DAYS)
      expect(horizon > today()).toBe(true)

      const series = await weightSeries(db, user, user.startedAt, horizon)
      expect(series.length).toBeGreaterThan(0)

      // 最后一条正好落在多播的终点
      expect(await weightSeries(db, user, horizon, horizon)).toHaveLength(1)
    } finally {
      close()
      delete process.env.DATABASE_PATH
    }
  })

  it('库里已有数据时不再播种——写入的记录不会被一次重启抹掉', async () => {
    const path = await bootstrapAt('existing.db')

    // 改一个值，再跑一次「启动」，改动必须活着
    process.env.DATABASE_PATH = path
    const first = openLocalDb(path)
    await first.db.update(goals).set({ calories: 1234 }).run()
    first.close()

    await ensureDatabase()

    const second = openLocalDb(path)
    const goal = await goalFor(second.db, DEMO_USER_ID)
    second.close()
    delete process.env.DATABASE_PATH

    expect(goal?.calories).toBe(1234)
  })
})

describe('演示数据 horizon 续播（播种日 + 90 天之后首页不该显示「未记录」）', () => {
  it('horizon 还充足时启动：一行都不写', async () => {
    const path = await bootstrapAt('full-horizon.db')

    process.env.DATABASE_PATH = path
    const first = openLocalDb(path)
    const before = await entryTableCounts(first.db)
    first.close()

    await restart(path)

    const second = openLocalDb(path)
    const after = await entryTableCounts(second.db)
    second.close()
    delete process.env.DATABASE_PATH

    // 刚播种的库最后一天是「今天 + 90」，再启动一遍不该补任何东西
    expect(after).toEqual(before)
  })

  it('最后一天早于阈值时：补到「今天 + 90」，已有的行一个不动', async () => {
    const path = join(tempDir, 'expired.db')
    const expiredTo = addDays(today(), -5)

    process.env.DATABASE_PATH = path
    try {
      // 造一个「播种到 5 天前」的库：模拟播种日过了 95 天的状态
      applyMigrations(path)
      const setup = openLocalDb(path)
      await seedDatabase(setup.db, { to: expiredTo })

      // 用户动过演示账号的数据：改了一条体重、删掉了一整天的记录
      const editedDay = addDays(today(), -6)
      const deletedDay = addDays(today(), -8)
      await setup.db
        .update(weightEntries)
        .set({ kg: 999 })
        .where(and(eq(weightEntries.userId, DEMO_USER_ID), eq(weightEntries.date, editedDay)))
        .run()
      await setup.db
        .delete(foodEntries)
        .where(and(eq(foodEntries.userId, DEMO_USER_ID), eq(foodEntries.date, deletedDay)))
        .run()
      await setup.db
        .delete(exerciseEntries)
        .where(and(eq(exerciseEntries.userId, DEMO_USER_ID), eq(exerciseEntries.date, deletedDay)))
        .run()
      await setup.db
        .delete(weightEntries)
        .where(and(eq(weightEntries.userId, DEMO_USER_ID), eq(weightEntries.date, deletedDay)))
        .run()

      const before = await countRowsUpTo(setup.db, expiredTo)
      setup.close()

      await restart(path)

      const check = openLocalDb(path)
      try {
        // 旧区间一行没动：被删的那天还是空的，改过的体重还是 999
        expect(await countRowsUpTo(check.db, expiredTo)).toEqual(before)
        const edited = await check.db
          .select({ kg: weightEntries.kg })
          .from(weightEntries)
          .where(and(eq(weightEntries.userId, DEMO_USER_ID), eq(weightEntries.date, editedDay)))
          .get()
        expect(edited?.kg).toBe(999)

        // 补的区间与数据层参照实现逐日一致（包括今天——「未记录」的病灶）
        const from = addDays(expiredTo, 1)
        const to = addDays(today(), SEED_HORIZON_DAYS)
        const [topFood, topExercise, topWeight, allSets] = await Promise.all([
          check.db
            .select()
            .from(foodEntries)
            .where(and(eq(foodEntries.userId, DEMO_USER_ID), gte(foodEntries.date, from)))
            .all(),
          check.db
            .select()
            .from(exerciseEntries)
            .where(and(eq(exerciseEntries.userId, DEMO_USER_ID), gte(exerciseEntries.date, from)))
            .all(),
          check.db
            .select()
            .from(weightEntries)
            .where(and(eq(weightEntries.userId, DEMO_USER_ID), gte(weightEntries.date, from)))
            .all(),
          check.db.select().from(strengthSets).all(),
        ])

        for (const date of dateRange(from, to)) {
          const day = mockDayLogFor(date)
          if (!day) throw new Error(`数据层应覆盖 ${date}`)

          const foodIds = topFood.filter((row) => row.date === date).map((row) => row.id)
          expect(foodIds.sort()).toEqual(day.foods.map((food) => food.id).sort())

          const exerciseIds = topExercise
            .filter((row) => row.date === date)
            .map((row) => row.id)
          expect(exerciseIds.sort()).toEqual(day.exercises.map((entry) => entry.id).sort())

          for (const entry of day.exercises) {
            const expectedSets = entry.sets ?? []
            const dbSets = allSets
              .filter((set) => set.entryId === entry.id)
              .sort((a, b) => a.setIndex - b.setIndex)
            expect(dbSets).toEqual(
              expectedSets.map((set, index) => ({
                id: `${entry.id}-set-${index + 1}`,
                entryId: entry.id,
                setIndex: index + 1,
                reps: set.reps,
                weightKg: set.weightKg,
              })),
            )
          }

          expect(topWeight.find((row) => row.date === date)?.kg).toBe(mockWeightFor(date))
        }
      } finally {
        check.close()
      }
    } finally {
      delete process.env.DATABASE_PATH
    }
  })

  it('续播只发生在阈值之内；补过之后再启动一行不写', async () => {
    // 最后一天正好是「今天 + 阈值」：不补
    const boundary = join(tempDir, 'boundary.db')
    process.env.DATABASE_PATH = boundary
    try {
      applyMigrations(boundary)
      const seeded = openLocalDb(boundary)
      await seedDatabase(seeded.db, { to: addDays(today(), RESEED_THRESHOLD_DAYS) })
      const before = await entryTableCounts(seeded.db)
      seeded.close()

      await restart(boundary)

      const checked = openLocalDb(boundary)
      expect(await entryTableCounts(checked.db)).toEqual(before)
      checked.close()
    } finally {
      delete process.env.DATABASE_PATH
    }

    // 最后一天少一天（阈值 - 1）：补满到 90 天，与一次全新播种完全一致
    const short = join(tempDir, 'short.db')
    process.env.DATABASE_PATH = short
    try {
      applyMigrations(short)
      const seeded = openLocalDb(short)
      await seedDatabase(seeded.db, { to: addDays(today(), RESEED_THRESHOLD_DAYS - 1) })
      const before = await entryTableCounts(seeded.db)
      seeded.close()

      await restart(short)

      const topped = openLocalDb(short)
      const after = await entryTableCounts(topped.db)
      topped.close()

      // 参照：一份从头播到「今天 + 90」的新库
      const reference = join(tempDir, 'reference.db')
      applyMigrations(reference)
      const ref = openLocalDb(reference)
      await seedDatabase(ref.db, { to: addDays(today(), SEED_HORIZON_DAYS) })
      const expected = await entryTableCounts(ref.db)
      ref.close()

      // 续播之后比续播之前多，且与全新播种的行数完全一致（生成器是确定性的）
      expect(after).toEqual(expected)
      expect(after.food).toBeGreaterThan(before.food)

      // 再启动一次：一行不写（幂等）
      await restart(short)
      const again = openLocalDb(short)
      expect(await entryTableCounts(again.db)).toEqual(expected)
      again.close()
    } finally {
      delete process.env.DATABASE_PATH
    }
  })
})
