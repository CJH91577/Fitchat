import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { isInRange } from '../data/selectors'
import type {
  DayLog,
  ExerciseEntry,
  FoodEntry,
  PlanDay,
  UserGoal,
  WeightEntry,
} from '../data/types'
import type { Db } from './index'
import {
  exerciseEntries,
  foodEntries,
  goals,
  planDays,
  planItems,
  strengthSets,
  users,
  weightEntries,
} from './schema'

/**
 * 读路径。这一层是应用与数据库之间**唯一**的接口。
 *
 * 全部是 async：线上的 Cloudflare D1 是异步 API。本地与测试跑在
 * lib/db/d1-shim 提供的兼容层上，签名一致——于是「本地能跑、线上另有一套
 * 代码」这种情况不会发生。
 *
 * 有意不在这里引入「今天」的概念——查询只回答「库里有什么」。
 * 「那一天到了没有」是界面的事（见 selectors.isUpcoming）。
 * 唯一的例外是 startedAt：它决定「用户当时还没开始用」与「那天没记东西」
 * 是两种不同状态，而这两者在界面上必须区别对待，所以由这里返回 null 来表达。
 */

export type DbUser = {
  id: string
  email: string
  heightCm: number
  age: number
  sex: 'male' | 'female'
  startedAt: string
  timezone: string
}

export async function userById(db: Db, userId: string): Promise<DbUser | null> {
  const row = await db.select().from(users).where(eq(users.id, userId)).get()
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    heightCm: row.heightCm,
    age: row.age,
    sex: row.sex,
    startedAt: row.startedAt,
    timezone: row.timezone,
  }
}

export async function goalFor(db: Db, userId: string): Promise<UserGoal | null> {
  const row = await db.select().from(goals).where(eq(goals.userId, userId)).get()
  if (!row) return null
  return {
    direction: row.direction,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    exerciseCalories: row.exerciseCalories,
    targetWeightKg: row.targetWeightKg,
  }
}

/**
 * 某一天的完整记录。
 *
 * 三种结果对应界面上三种不同的说法：
 *   - null                     —— 那天用户还没开始用（显示「这一天你还没有开始使用」）
 *   - 空数组                    —— 在范围内，但那天什么都没记（显示「未记录」）
 *   - 有内容                    —— 正常渲染
 * 把前两者合并会丢掉一个真实状态：曾经有一天没记东西，和当时还没注册，
 * 对用户是完全不同的两件事。
 */
export async function dayLogFor(db: Db, user: DbUser, date: string): Promise<DayLog | null> {
  if (!isInRange(date, user.startedAt)) return null

  const foodRows = await db
    .select()
    .from(foodEntries)
    .where(and(eq(foodEntries.userId, user.id), eq(foodEntries.date, date)))
    .orderBy(asc(foodEntries.id))
    .all()

  const foods: FoodEntry[] = foodRows.map((row) => ({
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

  const exerciseRows = await db
    .select()
    .from(exerciseEntries)
    .where(and(eq(exerciseEntries.userId, user.id), eq(exerciseEntries.date, date)))
    .orderBy(asc(exerciseEntries.id))
    .all()

  const strengthIds = exerciseRows.filter((row) => row.kind === 'strength').map((row) => row.id)
  const setRows = strengthIds.length
    ? await db
        .select()
        .from(strengthSets)
        .where(inArray(strengthSets.entryId, strengthIds))
        .orderBy(asc(strengthSets.entryId), asc(strengthSets.setIndex))
        .all()
    : []

  const exercises: ExerciseEntry[] = exerciseRows.map((row) => {
    const sets = setRows
      .filter((set) => set.entryId === row.id)
      .map((set) => ({ reps: set.reps, weightKg: set.weightKg }))
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      minutes: row.minutes ?? undefined,
      sets: sets.length > 0 ? sets : undefined,
      caloriesBurned: row.caloriesBurned,
    }
  })

  return { date, foods, exercises }
}

export async function weightFor(db: Db, user: DbUser, date: string): Promise<number | null> {
  const row = await db
    .select({ kg: weightEntries.kg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, user.id), eq(weightEntries.date, date)))
    .get()
  return row?.kg ?? null
}

/** from..to（含两端）之间实际存在的体重记录，按日期升序 */
export async function weightSeries(
  db: Db,
  user: DbUser,
  from: string,
  to: string,
): Promise<WeightEntry[]> {
  return db
    .select({ date: weightEntries.date, kg: weightEntries.kg })
    .from(weightEntries)
    .where(
      and(
        eq(weightEntries.userId, user.id),
        gte(weightEntries.date, from),
        lte(weightEntries.date, to),
      ),
    )
    .orderBy(asc(weightEntries.date))
    .all()
}

/** 一周七天的训练计划，按星期升序（1 = 周一 … 7 = 周日） */
export async function planFor(db: Db, userId: string): Promise<PlanDay[]> {
  const days = await db
    .select()
    .from(planDays)
    .where(eq(planDays.userId, userId))
    .orderBy(asc(planDays.weekday))
    .all()

  if (days.length === 0) return []

  const items = await db
    .select()
    .from(planItems)
    .where(
      inArray(
        planItems.planDayId,
        days.map((day) => day.id),
      ),
    )
    .orderBy(asc(planItems.planDayId), asc(planItems.itemIndex))
    .all()

  return days.map((day) => ({
    weekday: day.weekday,
    theme: day.theme,
    items: items
      .filter((item) => item.planDayId === day.id)
      .map((item) => ({ name: item.name, sets: item.sets, reps: item.reps })),
  }))
}
