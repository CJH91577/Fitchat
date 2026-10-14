import { eq, inArray } from 'drizzle-orm'
import type { FoodTemplate } from '../data/generator'
import { BREAKFAST, DINNER, LUNCH, SNACK, generateDayLog, generateWeight } from '../data/generator'
import { MOCK_GOAL, MOCK_PLAN, MOCK_USER, datesWithRecords } from '../data/mock'
import { today } from '../data/today'
import { DEMO_USER_EMAIL, DEMO_USER_ID } from './demo'
import type { Db } from './index'
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

/**
 * 把演示数据写进库里。
 *
 * 逻辑写成纯函数（接 db、返回统计）而不是直接写在 CLI 里，是为了能被测试
 * 用内存库完整跑一遍——种子脚本跑不起来的话，后面接页面时就没有可信的
 * 数据基线。
 *
 * 全异步：线上是 D1。本地与测试跑在 d1-shim 上，签名一致。
 */

// 身份常量定义在 lib/db/demo.ts：运行时的页面代码也要用它们，
// 不该为了拿两个常量而反向依赖这个种子脚本。这里再导出一次，
// 是为了让既有调用点（scripts/seed.ts、seed.test.ts）不受影响。
export { DEMO_USER_EMAIL, DEMO_USER_ID }

export type SeedOptions = {
  /** 演示用户的邮箱；重复执行时按它定位并整体重建 */
  email?: string
  /** 记录范围的起始日，默认取演示用户开始使用的日期 */
  from?: string
  /** 记录范围的结束日（含），默认取「今天」 */
  to?: string
  /** 固定生成时间戳，便于测试断言；默认取当前时刻 */
  now?: number
}

export type SeedSummary = {
  users: number
  goals: number
  foods: number
  planDays: number
  planItems: number
  foodEntries: number
  exerciseEntries: number
  strengthSets: number
  weightEntries: number
}

/**
 * 演示数据往前多播多少天。
 *
 * 演示站是「打开就有内容」的，所以库里必须有**今天之后**的记录：否则播种日
 * 一过，首页就开始显示「未记录」，看起来像坏掉了。
 *
 * 多播是安全的——日历把未来的格子渲染成不可点状态，那些数据不会被提前看到
 *（见 components/CalendarView.tsx 的 upcoming 分支）。
 *
 * 90 天是个取舍：够撑完一个面试季，又不会让种子写入量变得离谱。
 */
export const SEED_HORIZON_DAYS = 90

/**
 * 初始食物库：直接复用生成器里的营养模板。
 *
 * 生成器就是按这些模板挑食物的，所以演示记录里的每一条都能在这里找到
 * 同名的食物——为 false 时说明两处数据已经漂移。
 */
export const STARTER_FOODS: FoodTemplate[] = [...BREAKFAST, ...LUNCH, ...DINNER, ...SNACK]

export function starterFoodId(index: number): string {
  return `food-${String(index + 1).padStart(2, '0')}`
}

/**
 * SQLite 的复合 SELECT 有 500 项的上限，一次插入上千条会被它拦下。
 * 分批写，批大小取远低于上限的值。
 */
const INSERT_BATCH = 100

async function insertInBatches<T>(
  rows: T[],
  run: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    await run(rows.slice(i, i + INSERT_BATCH))
  }
}

export async function seedDatabase(db: Db, options: SeedOptions = {}): Promise<SeedSummary> {
  const email = options.email ?? DEMO_USER_EMAIL
  const from = options.from ?? MOCK_USER.startedAt
  const to = options.to ?? today()
  const now = new Date(options.now ?? Date.now())

  return db.transaction(async (tx) => {
    // 幂等：先按邮箱删掉演示用户。外键都带 on delete cascade，
    // 他的目标、记录与计划会一并清掉，所以可以反复执行。
    await tx.delete(users).where(eq(users.email, email)).run()

    const userId = DEMO_USER_ID

    await tx
      .insert(users)
      .values({
        id: userId,
        email,
        // 演示用户没有凭据：登录逻辑必须显式拒绝 password_hash 为空的行
        passwordHash: null,
        heightCm: MOCK_USER.heightCm,
        age: MOCK_USER.age,
        sex: MOCK_USER.sex,
        startedAt: from,
        timezone: 'Asia/Shanghai',
        createdAt: now,
      })
      .run()

    await tx
      .insert(goals)
      .values({
        userId,
        direction: MOCK_GOAL.direction,
        calories: MOCK_GOAL.calories,
        protein: MOCK_GOAL.protein,
        carbs: MOCK_GOAL.carbs,
        fat: MOCK_GOAL.fat,
        exerciseCalories: MOCK_GOAL.exerciseCalories,
        targetWeightKg: MOCK_GOAL.targetWeightKg,
        updatedAt: now,
      })
      .run()

    // 初始食物库 + 名称到下标的映射，用于给记录标注出处
    const foodIdByName = new Map<string, string>()
    STARTER_FOODS.forEach((food, index) => foodIdByName.set(food.name, starterFoodId(index)))

    // 食物库是共享的，不随用户级联删除，所以重复执行时它还在——必须先按
    // 确定性 id 清掉我们自己那批（不碰用户自行新增的食物），否则会撞上
    // foods.name 的唯一索引。
    await tx
      .delete(foods)
      .where(
        inArray(
          foods.id,
          STARTER_FOODS.map((_, index) => starterFoodId(index)),
        ),
      )
      .run()

    await tx
      .insert(foods)
      .values(
        STARTER_FOODS.map((food, index) => ({
          id: starterFoodId(index),
          name: food.name,
          perGrams: 100,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
        })),
      )
      .run()

    // 训练计划：固定周表
    let itemCount = 0
    for (const day of MOCK_PLAN) {
      const planDayId = `plan-day-${day.weekday}`
      await tx
        .insert(planDays)
        .values({ id: planDayId, userId, weekday: day.weekday, theme: day.theme })
        .run()
      if (day.items.length > 0) {
        await tx
          .insert(planItems)
          .values(
            day.items.map((item, index) => ({
              id: `${planDayId}-item-${index}`,
              planDayId,
              itemIndex: index,
              name: item.name,
              sets: item.sets,
              reps: item.reps,
            })),
          )
          .run()
        itemCount += day.items.length
      }
    }

    // 逐日生成记录
    const dates = datesWithRecords(from, to)
    const foodRows: (typeof foodEntries.$inferInsert)[] = []
    const exerciseRows: (typeof exerciseEntries.$inferInsert)[] = []
    const setRows: (typeof strengthSets.$inferInsert)[] = []
    const weightRows: (typeof weightEntries.$inferInsert)[] = []

    for (const date of dates) {
      const day = generateDayLog(date, MOCK_GOAL)

      for (const food of day.foods) {
        foodRows.push({
          id: food.id,
          userId,
          date,
          slot: food.slot,
          foodId: foodIdByName.get(food.name) ?? null,
          name: food.name,
          grams: food.grams,
          source: food.source,
          // 存的是当时的估算值（快照），不随食物库日后修正而变
          calories: food.totals.calories,
          protein: food.totals.protein,
          carbs: food.totals.carbs,
          fat: food.totals.fat,
          createdAt: now,
        })
      }

      for (const exercise of day.exercises) {
        exerciseRows.push({
          id: exercise.id,
          userId,
          date,
          kind: exercise.kind,
          name: exercise.name,
          minutes: exercise.minutes ?? null,
          caloriesBurned: exercise.caloriesBurned,
          createdAt: now,
        })
        exercise.sets?.forEach((set, index) => {
          setRows.push({
            id: `${exercise.id}-set-${index + 1}`,
            entryId: exercise.id,
            setIndex: index + 1,
            reps: set.reps,
            weightKg: set.weightKg,
          })
        })
      }

      weightRows.push({
        userId,
        date,
        kg: generateWeight(
          date,
          MOCK_USER.startedAt,
          MOCK_USER.startWeightKg,
          MOCK_GOAL.targetWeightKg,
        ),
        createdAt: now,
      })
    }

    await insertInBatches(foodRows, (batch) => tx.insert(foodEntries).values(batch).run())
    await insertInBatches(exerciseRows, (batch) => tx.insert(exerciseEntries).values(batch).run())
    await insertInBatches(setRows, (batch) => tx.insert(strengthSets).values(batch).run())
    await insertInBatches(weightRows, (batch) => tx.insert(weightEntries).values(batch).run())

    return {
      users: 1,
      goals: 1,
      foods: STARTER_FOODS.length,
      planDays: MOCK_PLAN.length,
      planItems: itemCount,
      foodEntries: foodRows.length,
      exerciseEntries: exerciseRows.length,
      strengthSets: setRows.length,
      weightEntries: weightRows.length,
    }
  })
}
