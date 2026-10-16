import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
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
  foods,
  goals,
  inviteCodes,
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
  /**
   * 资料三件套**可以为空**：注册只要邮箱 + 口令（邀请码是唯一门槛），
   * 身高/年龄/性别是注册之后的首次引导才填的。界面必须把 null 说成
   * 「未填写」，而不是渲染一个字面量的 null 或一个编出来的数字。
   */
  heightCm: number | null
  age: number | null
  sex: 'male' | 'female' | null
  startedAt: string
  timezone: string
}

type UserRow = typeof users.$inferSelect

function toDbUser(row: UserRow): DbUser {
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

export async function userById(db: Db, userId: string): Promise<DbUser | null> {
  const row = await db.select().from(users).where(eq(users.id, userId)).get()
  return row ? toDbUser(row) : null
}

/**
 * 按邮箱取用户（登录用）。
 *
 * 查的是**规范化之后**的邮箱：存的时候是小写去空格（见 lib/auth/accounts.ts），
 * 查的时候也必须是同一种形式，否则 Alice@x.com 与 alice@x.com 会变成两个账号，
 * 而从用户那边看这两者没有任何区别。
 */
export async function userByEmail(db: Db, email: string): Promise<DbUser | null> {
  const row = await db.select().from(users).where(eq(users.email, email)).get()
  return row ? toDbUser(row) : null
}

export type InviteCodeRow = {
  code: string
  /** 备注发给谁了，便于回收没用掉的码 */
  note: string | null
  usedByUserId: string | null
  usedAt: Date | null
}

export async function inviteCodeFor(db: Db, code: string): Promise<InviteCodeRow | null> {
  const row = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).get()
  if (!row) return null
  return {
    code: row.code,
    note: row.note,
    usedByUserId: row.usedByUserId,
    usedAt: row.usedAt,
  }
}

export type InviteCodeAdminRow = InviteCodeRow & {
  /** 用掉这张码的人（没有就是 null）；只给管理端看 */
  usedByEmail: string | null
}

/**
 * 全部邀请码（管理端 CLI 用），带「谁用了」。
 *
 * 按创建时间倒序：最新发的在最上面。used_by_user_id 是外键，
 * 联到 users 拿邮箱；码被用掉之后用户再删号（on delete set null），
 * 这里仍然能看到 used_at，只是邮箱为 null。
 */
export async function inviteCodesForAdmin(db: Db): Promise<InviteCodeAdminRow[]> {
  const rows = await db
    .select({
      code: inviteCodes.code,
      note: inviteCodes.note,
      usedByUserId: inviteCodes.usedByUserId,
      usedAt: inviteCodes.usedAt,
      usedByEmail: users.email,
    })
    .from(inviteCodes)
    .leftJoin(users, eq(inviteCodes.usedByUserId, users.id))
    .orderBy(desc(inviteCodes.createdAt))
    .all()
  return rows
}

/**
 * 登录校验专用：只取「谁的、什么散列」，不取别的。
 *
 * 单独一个函数、而不是把 passwordHash 塞进 DbUser，是为了让口令散列**只在
 * 登录这一条路径上出现**：页面拿到的用户对象里根本没有它，也就没法失手渲染出来。
 * 查询层返回一个带密码的「用户」才是最容易被误用的形状。
 */
export async function credentialsByEmail(
  db: Db,
  email: string,
): Promise<{ userId: string; passwordHash: string | null } | null> {
  const row = await db
    .select({ userId: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .get()
  return row ?? null
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

/** 记录饮食时用：按 id 批量取食物，把用户填的克数换算成营养值 */
export async function foodsByIds(db: Db, ids: string[]): Promise<FoodRow[]> {
  if (ids.length === 0) return []
  return db.select().from(foods).where(inArray(foods.id, ids)).all()
}

/** 食物库（用于搜索与一句话解析） */
export async function allFoods(db: Db): Promise<FoodRow[]> {
  return db.select().from(foods).orderBy(asc(foods.id)).all()
}

export type FoodRow = typeof foods.$inferSelect

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

/**
 * 用户记录的最新日期——饮食、运动、体重三张表里的最大日期。
 *
 * 只被播种续播用（见 seed.ts 的 topUpDemoHorizon）：续播只补「最新日期之后」
 * 的区间，所以用户删过的日子不会被加回来，已有的行也一个都不会被碰。
 *
 * 日期键是 YYYY-MM-DD 文本，字典序就是日期序，直接比大小即可。
 */
export async function latestRecordDateFor(db: Db, userId: string): Promise<string | null> {
  const [food, exercise, weight] = await Promise.all([
    db
      .select({ date: foodEntries.date })
      .from(foodEntries)
      .where(eq(foodEntries.userId, userId))
      .orderBy(desc(foodEntries.date))
      .limit(1)
      .get(),
    db
      .select({ date: exerciseEntries.date })
      .from(exerciseEntries)
      .where(eq(exerciseEntries.userId, userId))
      .orderBy(desc(exerciseEntries.date))
      .limit(1)
      .get(),
    db
      .select({ date: weightEntries.date })
      .from(weightEntries)
      .where(eq(weightEntries.userId, userId))
      .orderBy(desc(weightEntries.date))
      .limit(1)
      .get(),
  ])

  const dates = [food?.date, exercise?.date, weight?.date].filter(
    (date): date is string => date !== undefined,
  )
  if (dates.length === 0) return null
  return dates.reduce((latest, date) => (date > latest ? date : latest))
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

/** 「导出我的记录」的数据形状：一次取全，避免逐日 N 次查询 */
export type UserExport = {
  exportedAt: string
  profile: {
    email: string
    heightCm: number | null
    age: number | null
    sex: 'male' | 'female' | null
    startedAt: string
    timezone: string
  }
  goal: UserGoal | null
  foodEntries: {
    date: string
    slot: string
    name: string
    grams: number
    source: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }[]
  exerciseEntries: {
    date: string
    kind: 'cardio' | 'strength'
    name: string
    minutes: number | null
    caloriesBurned: number
    sets: { reps: number; weightKg: number }[]
  }[]
  weightEntries: { date: string; kg: number }[]
  plan: PlanDay[]
}

export async function userExportData(db: Db, user: DbUser): Promise<UserExport> {
  const [goal, plan, foodRows, exerciseRows, weightRows] = await Promise.all([
    goalFor(db, user.id),
    planFor(db, user.id),
    db
      .select()
      .from(foodEntries)
      .where(eq(foodEntries.userId, user.id))
      .orderBy(asc(foodEntries.date), asc(foodEntries.id))
      .all(),
    db
      .select()
      .from(exerciseEntries)
      .where(eq(exerciseEntries.userId, user.id))
      .orderBy(asc(exerciseEntries.date), asc(exerciseEntries.id))
      .all(),
    db
      .select()
      .from(weightEntries)
      .where(eq(weightEntries.userId, user.id))
      .orderBy(asc(weightEntries.date))
      .all(),
  ])

  const strengthIds = exerciseRows.filter((row) => row.kind === 'strength').map((row) => row.id)
  const setRows = strengthIds.length
    ? await db
        .select()
        .from(strengthSets)
        .where(inArray(strengthSets.entryId, strengthIds))
        .orderBy(asc(strengthSets.entryId), asc(strengthSets.setIndex))
        .all()
    : []

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      email: user.email,
      heightCm: user.heightCm,
      age: user.age,
      sex: user.sex,
      startedAt: user.startedAt,
      timezone: user.timezone,
    },
    goal,
    foodEntries: foodRows.map((row) => ({
      date: row.date,
      slot: row.slot,
      name: row.name,
      grams: row.grams,
      source: row.source,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
    })),
    exerciseEntries: exerciseRows.map((row) => ({
      date: row.date,
      kind: row.kind,
      name: row.name,
      minutes: row.minutes,
      caloriesBurned: row.caloriesBurned,
      sets: setRows
        .filter((set) => set.entryId === row.id)
        .map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
    })),
    weightEntries: weightRows.map((row) => ({ date: row.date, kg: row.kg })),
    plan,
  }
}
