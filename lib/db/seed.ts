import { eq, inArray } from 'drizzle-orm'
import type { FoodTemplate } from '../data/generator'
import { BREAKFAST, DINNER, LUNCH, SNACK, generateDayLog, generateWeight } from '../data/generator'
import { MOCK_GOAL, MOCK_PLAN, MOCK_USER, datesWithRecords } from '../data/mock'
import { addDays } from '../data/dates'
import { PANTRY } from '../data/pantry'
import { today } from '../data/today'
import { DEMO_INVITE_CODES, DEMO_USER_EMAIL, DEMO_USER_ID } from './demo'
import type { Db } from './index'
import { latestRecordDateFor } from './queries'
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
import { createInviteCodes } from './writes'

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
  /**
   * 演示账号的口令散列。种子脚本自己不散列口令（那是 lib/auth 的事），
   * 由调用方算好传进来——scrypt 要几十毫秒，而它必须在事务外面完成。
   * 传 null（默认）表示这个账号没有口令，登不进去。
   */
  passwordHash?: string | null
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
 * 初始食物库：生成器里的营养模板 + 常用单品（lib/data/pantry.ts）。
 *
 * 生成器就是按前四组模板挑食物的，所以演示记录里的每一条都能在这里找到
 * 同名的食物——为 false 时说明两处数据已经漂移。
 *
 * 三条约束，都是踩过才知道的：
 *
 *   1. **只能往后追加，不能插队**：食物的 id 由下标算出来（starterFoodId），
 *      插在中间会让现有部署里记录的 food_id 指到别的食物上去。
 *   2. **同名只留第一次出现的**：零食那组里已经有「苹果」「酸奶」，
 *      单品表里再来一次会撞上 foods.name 的唯一索引，播种直接失败。
 *   3. 前四组是「一份」的数值，不是每 100 克——见 SERVING_GRAMS。
 */
export const STARTER_FOODS: FoodTemplate[] = dedupeByName([
  ...BREAKFAST,
  ...LUNCH,
  ...DINNER,
  ...SNACK,
  ...PANTRY,
])

function dedupeByName(foods: FoodTemplate[]): FoodTemplate[] {
  const seen = new Set<string>()
  return foods.filter((food) => (seen.has(food.name) ? false : seen.add(food.name)))
}

/**
 * 生成器那 12 样各是「一份」，不是每 100 克。
 *
 * 食物库要按克换算，就必须知道一份大约多少克：不写的话默认按 100 克算，
 * 于是「苹果 200 克」会被算成两倍还多（那份数值本身就不对应 100 克）。
 * 单品表里的是每 100 克，所以不在这里。
 *
 * 这些是常见份量的近似值；用户记录时看到的是克数与总热量，可以自己改。
 */
const SERVING_GRAMS: Record<string, number> = {
  燕麦牛奶: 350,
  豆浆鸡蛋: 300,
  全麦三明治: 200,
  鸡胸肉盖饭: 450,
  牛肉面: 500,
  清蒸鱼套餐: 400,
  '清炒时蔬 + 米饭': 400,
  番茄鸡蛋面: 450,
  鸡腿饭: 450,
  苹果: 180,
  酸奶: 150,
  坚果: 30,
}

/** 食物库里的一行，含它的营养值对应的克数 */
export function starterFoodRow(index: number) {
  const food = STARTER_FOODS[index]
  return {
    id: starterFoodId(index),
    name: food.name,
    perGrams: SERVING_GRAMS[food.name] ?? 100,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  }
}

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

/**
 * 按日期逐日生成记录行（不写库）。
 *
 * 播种与续播共用这一个函数：两条路径产出的行必须一模一样，否则「续播之后
 * 的库」与「重新播种的库」会在同一日期上出现两套数据，谁也没法解释差异。
 * 生成器对同一日期是确定性的（见 lib/data/dateSeed.ts），所以同一段日期
 * 重跑多少遍都得到同一批行。
 */
function entryRowsForDates(
  dates: string[],
  userId: string,
  foodIdByName: Map<string, string>,
  now: Date,
) {
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

  return { foodRows, exerciseRows, setRows, weightRows }
}

export async function seedDatabase(db: Db, options: SeedOptions = {}): Promise<SeedSummary> {
  const email = options.email ?? DEMO_USER_EMAIL
  const from = options.from ?? MOCK_USER.startedAt
  const to = options.to ?? today()
  const now = new Date(options.now ?? Date.now())

  const summary = await db.transaction(async (tx) => {
    // 幂等：先按邮箱删掉演示用户。外键都带 on delete cascade，
    // 他的目标、记录与计划会一并清掉，所以可以反复执行。
    await tx.delete(users).where(eq(users.email, email)).run()

    const userId = DEMO_USER_ID

    await tx
      .insert(users)
      .values({
        id: userId,
        email,
        // 口令散列由调用方算好传进来；不传就是「没有凭据」，
        // 登录逻辑必须显式拒绝这种账号（见 lib/auth/password.ts 的 verifyPassword）
        passwordHash: options.passwordHash ?? null,
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
      .values(STARTER_FOODS.map((_, index) => starterFoodRow(index)))
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
    const { foodRows, exerciseRows, setRows, weightRows } = entryRowsForDates(
      datesWithRecords(from, to),
      userId,
      foodIdByName,
      now,
    )

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

  // 邀请码在事务**外面**写，而且冲突就不动：它与演示数据无关，重复播种
  // 不该把已经用掉的码重置回未使用——那等于凭空多出一次注册机会。
  await createInviteCodes(
    db,
    DEMO_INVITE_CODES.map((code) => ({ code, note: '随演示数据附送，公开' })),
    now,
  )

  return summary
}

/**
 * 续播触发阈值（天）：剩余 horizon 少于这么多天时，启动时把它补回 90 天。
 *
 * 不能设成 90（每次启动都补）：那样每重启一次容器就写一批行。也不能太小：
 * 续播只发生在启动时，站点若连续运行超过剩余 horizon 天数，过期是拦不住的，
 * 所以阈值要留出足够宽的窗口，让「最近一次重启」大概率落在窗口里。
 */
export const RESEED_THRESHOLD_DAYS = 7

export type TopUpSummary = {
  foodEntries: number
  exerciseEntries: number
  strengthSets: number
  weightEntries: number
}

/**
 * 给演示账号补写 from..to（含两端）的记录行。
 *
 * 只插入、不删不改：调用方负责把 from 定在「库里已有记录之后」，
 * 这样续播永远不会碰到已有行——包括用户自己改过的体重、删过的日子。
 */
export async function topUpDatabase(
  db: Db,
  options: { from: string; to: string; now?: Date },
): Promise<TopUpSummary> {
  const now = new Date(options.now ?? Date.now())
  const foodIdByName = new Map<string, string>()
  STARTER_FOODS.forEach((food, index) => foodIdByName.set(food.name, starterFoodId(index)))

  return db.transaction(async (tx) => {
    const { foodRows, exerciseRows, setRows, weightRows } = entryRowsForDates(
      datesWithRecords(options.from, options.to),
      DEMO_USER_ID,
      foodIdByName,
      now,
    )

    await insertInBatches(foodRows, (batch) => tx.insert(foodEntries).values(batch).run())
    await insertInBatches(exerciseRows, (batch) => tx.insert(exerciseEntries).values(batch).run())
    await insertInBatches(setRows, (batch) => tx.insert(strengthSets).values(batch).run())
    await insertInBatches(weightRows, (batch) => tx.insert(weightEntries).values(batch).run())

    return {
      foodEntries: foodRows.length,
      exerciseEntries: exerciseRows.length,
      strengthSets: setRows.length,
      weightEntries: weightRows.length,
    }
  })
}

/**
 * 启动时把演示数据的 horizon 补满：库里最后一天早于「今天 + 阈值」就补到
 * 「今天 + 90 天」，否则什么都不做。
 *
 * 为什么不能简单重播：seedDatabase 会按 cascade 删掉演示用户重来，用户
 * 在演示账号里留下的真实写入（改过的体重、删过的日子）会一起消失。续播
 * 只从「最新记录日期之后」接着写——用户删过的日子不会被加回来。
 *
 * 返回 null 表示这次启动不需要续播。
 */
export async function topUpDemoHorizon(
  db: Db,
  now: Date = new Date(),
): Promise<TopUpSummary | null> {
  const latest = await latestRecordDateFor(db, DEMO_USER_ID)
  if (latest !== null && latest >= addDays(today(), RESEED_THRESHOLD_DAYS)) return null

  // 一行记录都没有（例如被清空过）：从开始使用日期整段补回来，
  // 演示站「打开就有内容」比「尊重一次清空操作」更值得守。
  const from = latest === null ? MOCK_USER.startedAt : addDays(latest, 1)
  return topUpDatabase(db, { from, to: addDays(today(), SEED_HORIZON_DAYS), now })
}
