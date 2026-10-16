import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { FoodSource, MealSlot } from '../data/types'
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
 * 写路径。
 *
 * 与 queries.ts（读路径）分成两个文件，但守的是同一条规矩：**应用与数据库
 * 之间只有这一层**。页面与 Server Action 不直接碰 drizzle，于是「这次写入
 * 有没有检查归属」「有没有放进一个事务」这类问题，只在这里回答一次。
 *
 * 阶段 4 的记录写入（饮食、运动、体重、目标）也落在这里。
 */

export type RegisterInput = {
  userId: string
  /** 已经规范化（小写去空格）的邮箱 */
  email: string
  /**
   * 已经算好的口令散列。
   *
   * 散列在**调用方**、也就是事务外面算——scrypt 要几十毫秒，而事务一旦
   * 打开就该尽快提交。d1 兼容层（以及真 D1）的事务回调里也不适合等一个
   * 与数据库无关的异步操作。
   */
  passwordHash: string
  /** 开始使用日期。新用户就是注册那天，日历与趋势都从这里往后开放 */
  startedAt: string
  timezone: string
  now: Date
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; reason: 'code-not-found' | 'code-used' | 'email-taken' }

/**
 * 用邀请码注册：验码、建用户、把码标记为已用，三件事在**同一个事务**里。
 *
 * 分开做会出现两种坏结果：码被用掉了但用户没建成（码白费），或者
 * 同一个码被两次注册同时通过（先读后写，中间没有隔离）。
 */
export async function registerWithInvite(
  db: Db,
  code: string,
  input: RegisterInput,
): Promise<RegisterResult> {
  return db.transaction(async (tx) => {
    const invite = await tx.select().from(inviteCodes).where(eq(inviteCodes.code, code)).get()
    if (!invite) return { ok: false, reason: 'code-not-found' as const }
    if (invite.usedByUserId !== null || invite.usedAt !== null) {
      return { ok: false, reason: 'code-used' as const }
    }

    const taken = await tx.select().from(users).where(eq(users.email, input.email)).get()
    if (taken) return { ok: false, reason: 'email-taken' as const }

    await tx
      .insert(users)
      .values({
        id: input.userId,
        email: input.email,
        passwordHash: input.passwordHash,
        // 资料三件套留空：首次引导里才填（见 lib/db/schema.ts 的说明）
        heightCm: null,
        age: null,
        sex: null,
        startedAt: input.startedAt,
        timezone: input.timezone,
        createdAt: input.now,
      })
      .run()

    await tx
      .update(inviteCodes)
      .set({ usedByUserId: input.userId, usedAt: input.now })
      .where(eq(inviteCodes.code, code))
      .run()

    return { ok: true as const }
  })
}

/**
 * 给还没有口令的账号补一个口令散列。
 *
 * 用在升级路径上：文档里公开写着演示账号的口令，而**老的**部署里这个账号是
 * 没有口令的（`password_hash` 允许为空，演示站当初也不需要登录）。条件写在
 * SQL 的 WHERE 里而不是先读后写：只补空缺，绝不覆盖已经设过的口令——
 * 运维改过演示口令的话，那次修改不该被一次重启抹掉。
 */
export async function setPasswordHashIfMissing(
  db: Db,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash })
    .where(and(eq(users.id, userId), isNull(users.passwordHash)))
    .run()
}

export type InviteCodeInput = { code: string; note?: string | null }

/**
 * 建邀请码。
 *
 * `onConflictDoNothing` 而不是先查后插：重复执行（比如每次容器启动都播种）
 * 不该覆盖已发出的码，尤其不该把**已经用掉的码**重置回未使用——
 * 那等于凭空多出一次注册机会。
 */
export async function createInviteCodes(
  db: Db,
  codes: InviteCodeInput[],
  now: Date,
): Promise<void> {
  if (codes.length === 0) return

  await db
    .insert(inviteCodes)
    .values(
      codes.map((input) => ({
        code: input.code,
        note: input.note ?? null,
        usedByUserId: null,
        usedAt: null,
        createdAt: now,
      })),
    )
    .onConflictDoNothing()
    .run()
}

/**
 * 作废一张还没用掉的邀请码（管理端 CLI 用）。
 *
 * 已经用掉的码**不能**作废：它是历史记录，「谁用哪张码注册的」不该
 * 因为一次管理操作断掉。返回 false 表示这张码不存在或已经用掉。
 */
export async function revokeInviteCode(db: Db, code: string): Promise<boolean> {
  const row = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).get()
  if (!row || row.usedAt !== null) return false

  await db.delete(inviteCodes).where(eq(inviteCodes.code, code)).run()
  return true
}

export type FoodLibraryRow = {
  id: string
  name: string
  perGrams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

/**
 * 补齐食物库。
 *
 * 与邀请码同一个道理：新版本给食物库加了常用单品（见 lib/data/pantry.ts），
 * 而**已经跑起来**的站点不会重新播种（演示用户早就在库里）——不补这一步，
 * 升级后的人说「两个鸡蛋」会一个食物都匹配不上。
 *
 * 冲突一律什么都不做：库里已有的行（包括用户自己改过的数值）不动，
 * 只把缺的加进去。
 */
export async function ensureFoodLibrary(db: Db, rows: FoodLibraryRow[]): Promise<void> {
  if (rows.length === 0) return

  await db.insert(foods).values(rows).onConflictDoNothing().run()
}

export type UserFoodInput = {
  name: string
  /** 每 100 克的营养值（与 foods.per_grams = 100 对应） */
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type CreateUserFoodResult = { ok: true; id: string } | { ok: false; reason: 'name-taken' }

/**
 * 用户自建一条食物（每 100 克营养值）。
 *
 * foods.name 有唯一索引，同名冲突**不是** 500：先查后插，命中就说
 * 「名字被占了」——食物库里没有「两个同名不同值」的合法状态，
 * 搜索时用户也没法分辨该选哪一个。单实例、低并发下先查后插的
 * 窗口可以接受；真要并发起来，唯一索引也会兜底（报错而不是错数据）。
 */
export async function createUserFood(db: Db, input: UserFoodInput): Promise<CreateUserFoodResult> {
  const taken = await db
    .select({ id: foods.id })
    .from(foods)
    .where(eq(foods.name, input.name))
    .get()
  if (taken) return { ok: false, reason: 'name-taken' }

  const id = randomUUID()
  await db
    .insert(foods)
    .values({
      id,
      name: input.name,
      perGrams: 100,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
    })
    .run()
  return { ok: true, id }
}

export type FoodEntryInput = {
  foodId: string | null
  name: string
  grams: number
  source: FoodSource
  calories: number
  protein: number
  carbs: number
  fat: number
}

/**
 * 写入一天的饮食记录。
 *
 * 营养值是**快照**（见 lib/schema.ts 的说明）：食物库里的数字日后会被修正，
 * 但历史记录必须冻结当时算出来的值，否则「那天吃了多少」会被追溯改写。
 */
export async function addFoodEntries(
  db: Db,
  userId: string,
  date: string,
  slot: MealSlot,
  entries: FoodEntryInput[],
  now: Date,
): Promise<void> {
  if (entries.length === 0) return

  await db
    .insert(foodEntries)
    .values(
      entries.map((entry) => ({
        id: randomUUID(),
        userId,
        date,
        slot,
        foodId: entry.foodId,
        name: entry.name,
        grams: entry.grams,
        source: entry.source,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        createdAt: now,
      })),
    )
    .run()
}

/**
 * 写入一条运动记录。力量动作的组数一起写，且与主记录在同一个事务里——
 * 否则会出现「有这条运动，但一组都没有」的半条记录。
 */
export async function addExerciseEntry(
  db: Db,
  userId: string,
  date: string,
  entry: {
    kind: 'cardio' | 'strength'
    name: string
    minutes: number | null
    caloriesBurned: number
    sets: { reps: number; weightKg: number }[]
  },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const entryId = randomUUID()

    await tx
      .insert(exerciseEntries)
      .values({
        id: entryId,
        userId,
        date,
        kind: entry.kind,
        name: entry.name,
        minutes: entry.minutes,
        caloriesBurned: entry.caloriesBurned,
        createdAt: now,
      })
      .run()

    if (entry.sets.length > 0) {
      await tx
        .insert(strengthSets)
        .values(
          entry.sets.map((set, index) => ({
            id: randomUUID(),
            entryId,
            // 组序号从 1 开始：顺序不该由数据库返回的顺序隐式决定
            setIndex: index + 1,
            reps: set.reps,
            weightKg: set.weightKg,
          })),
        )
        .run()
    }
  })
}

/** 删掉一条运动记录。归属检查写在条件里，与饮食记录同一个规矩 */
export async function deleteExerciseEntry(
  db: Db,
  userId: string,
  entryId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: exerciseEntries.id })
      .from(exerciseEntries)
      .where(and(eq(exerciseEntries.id, entryId), eq(exerciseEntries.userId, userId)))
      .get()
    if (!existing) return false

    // 组数由外键的 on delete cascade 一起清掉（连接上是开着外键的）
    await tx
      .delete(exerciseEntries)
      .where(and(eq(exerciseEntries.id, entryId), eq(exerciseEntries.userId, userId)))
      .run()
    return true
  })
}

/**
 * 改一条饮食记录的克数（与随之重算的营养快照）。
 *
 * 归属检查写在 WHERE 里（与删除同一个规矩）：改别人的记录时一行都不会动，
 * 返回 false 让界面说「这条记录不在了」而不是假装成功。
 * 营养快照由调用方按食物库与新的克数算好传进来——写这一层只负责落库，
 * 「数字由谁算」是 action 层的规矩（见 meals/new/actions.ts）。
 */
export async function updateFoodEntry(
  db: Db,
  userId: string,
  entryId: string,
  input: {
    foodId: string
    name: string
    grams: number
    source: FoodSource
    calories: number
    protein: number
    carbs: number
    fat: number
  },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: foodEntries.id })
      .from(foodEntries)
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.userId, userId)))
      .get()
    if (!existing) return false

    await tx
      .update(foodEntries)
      .set({
        foodId: input.foodId,
        name: input.name,
        grams: input.grams,
        source: input.source,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
      })
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.userId, userId)))
      .run()
    return true
  })
}

/**
 * 改一条运动记录：时长（有氧）或逐组重量次数（力量）与重新估算的消耗。
 *
 * 组数整体替换、set_index 从 1 重新连续编号——「编辑时删掉中间一组」不该
 * 在组号里留下空洞。主记录与组数在同一个事务里，要么全改要么全不改。
 */
export async function updateExerciseEntry(
  db: Db,
  userId: string,
  entryId: string,
  entry: {
    kind: 'cardio' | 'strength'
    name: string
    minutes: number | null
    caloriesBurned: number
    sets: { reps: number; weightKg: number }[]
  },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: exerciseEntries.id })
      .from(exerciseEntries)
      .where(and(eq(exerciseEntries.id, entryId), eq(exerciseEntries.userId, userId)))
      .get()
    if (!existing) return false

    await tx
      .update(exerciseEntries)
      .set({
        kind: entry.kind,
        name: entry.name,
        minutes: entry.minutes,
        caloriesBurned: entry.caloriesBurned,
      })
      .where(and(eq(exerciseEntries.id, entryId), eq(exerciseEntries.userId, userId)))
      .run()

    await tx.delete(strengthSets).where(eq(strengthSets.entryId, entryId)).run()

    if (entry.sets.length > 0) {
      await tx
        .insert(strengthSets)
        .values(
          entry.sets.map((set, index) => ({
            id: randomUUID(),
            entryId,
            // 组序号从 1 开始且连续：顺序不该由数据库返回的顺序隐式决定
            setIndex: index + 1,
            reps: set.reps,
            weightKg: set.weightKg,
          })),
        )
        .run()
    }

    return true
  })
}

/**
 * 写一天（weekday）的训练计划：主题与动作列表整体替换。
 *
 * (user_id, weekday) 有唯一索引，所以「改计划」就是覆盖这一天；
 * 动作条目整组删掉重插，item_index 从 0 重新连续编号——编辑时删掉
 * 中间一条不该在序号里留下空洞。全部在一个事务里：要么整份新计划
 * 生效，要么什么都不变。
 *
 * 归属检查是结构性的：计划按 (user_id, weekday) 定位，用户改的
 * 只能是自己的那一行。
 */
export async function savePlanDay(
  db: Db,
  userId: string,
  input: {
    /** 1 = 周一 … 7 = 周日，与 lib/data/dates.ts 的 weekdayOf 一致 */
    weekday: number
    theme: string
    items: { name: string; sets: number; reps: string }[]
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: planDays.id })
      .from(planDays)
      .where(and(eq(planDays.userId, userId), eq(planDays.weekday, input.weekday)))
      .get()

    const dayId = existing?.id ?? randomUUID()

    if (existing) {
      await tx
        .update(planDays)
        .set({ theme: input.theme })
        .where(and(eq(planDays.userId, userId), eq(planDays.weekday, input.weekday)))
        .run()
    } else {
      await tx
        .insert(planDays)
        .values({ id: dayId, userId, weekday: input.weekday, theme: input.theme })
        .run()
    }

    await tx.delete(planItems).where(eq(planItems.planDayId, dayId)).run()

    if (input.items.length > 0) {
      await tx
        .insert(planItems)
        .values(
          input.items.map((item, index) => ({
            id: randomUUID(),
            planDayId: dayId,
            // 条目序号从 0 开始且连续（字段名不用 order——那是 SQL 关键字）
            itemIndex: index,
            name: item.name,
            sets: item.sets,
            reps: item.reps,
          })),
        )
        .run()
    }
  })
}

/**
 * 记下某一天的体重。
 *
 * (user_id, date) 就是主键，所以一天一条——重复记录是**改**而不是追加。
 * 这一点很重要：一天称两次不该变成两条记录，否则趋势页的日均值会被同一天
 * 的数据重复计入。
 */
export async function upsertWeightEntry(
  db: Db,
  userId: string,
  date: string,
  kg: number,
  now: Date,
): Promise<void> {
  await db
    .insert(weightEntries)
    .values({ userId, date, kg, createdAt: now })
    .onConflictDoUpdate({
      target: [weightEntries.userId, weightEntries.date],
      set: { kg, createdAt: now },
    })
    .run()
}

/**
 * 写入资料与每日目标，并把「当前体重」记成今天的空腹体重。
 *
 * 三件事一个事务：首次引导要么全成，要么全不成。只写上目标而没写体重，
 * 首页会显示「今日未记录」而目标是按体重算出来的——这种半截状态最难解释。
 */
export async function saveProfileAndGoal(
  db: Db,
  userId: string,
  /** 应用口径的「今天」（按用户时区算，见 lib/data/today.ts），不是运行环境的本地日期 */
  date: string,
  input: {
    heightCm: number
    age: number
    sex: 'male' | 'female'
    weightKg: number
    goal: {
      direction: 'cut' | 'bulk' | 'maintain'
      calories: number
      protein: number
      carbs: number
      fat: number
      exerciseCalories: number
      targetWeightKg: number
    }
  },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ heightCm: input.heightCm, age: input.age, sex: input.sex })
      .where(eq(users.id, userId))
      .run()

    await tx
      .insert(goals)
      .values({
        userId,
        direction: input.goal.direction,
        calories: input.goal.calories,
        protein: input.goal.protein,
        carbs: input.goal.carbs,
        fat: input.goal.fat,
        exerciseCalories: input.goal.exerciseCalories,
        targetWeightKg: input.goal.targetWeightKg,
        updatedAt: now,
      })
      // 一个用户一行：重新引导就是覆盖（刻意不做版本历史，见 lib/db/schema.ts）
      .onConflictDoUpdate({
        target: goals.userId,
        set: {
          direction: input.goal.direction,
          calories: input.goal.calories,
          protein: input.goal.protein,
          carbs: input.goal.carbs,
          fat: input.goal.fat,
          exerciseCalories: input.goal.exerciseCalories,
          targetWeightKg: input.goal.targetWeightKg,
          updatedAt: now,
        },
      })
      .run()

    await tx
      .insert(weightEntries)
      .values({ userId, date, kg: input.weightKg, createdAt: now })
      .onConflictDoUpdate({
        target: [weightEntries.userId, weightEntries.date],
        set: { kg: input.weightKg, createdAt: now },
      })
      .run()
  })
}

/**
 * 删掉一条饮食记录。
 *
 * 归属检查写在**条件里**，而不是先查出来比对：`WHERE id = ? AND user_id = ?`
 * 这一句本身就表达了「只能删自己的」。先查后删会在两次查询之间留一个窗口，
 * 而且一旦有人日后把查出来的结果换成别的东西，检查就静默失效了。
 *
 * 返回是否真的删掉了一行，好让界面能说「这条记录不在了」而不是假装成功。
 */
export async function deleteFoodEntry(
  db: Db,
  userId: string,
  entryId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: foodEntries.id })
      .from(foodEntries)
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.userId, userId)))
      .get()
    if (!existing) return false

    await tx
      .delete(foodEntries)
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.userId, userId)))
      .run()
    return true
  })
}
