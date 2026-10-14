import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * 数据模型。
 *
 * 与 `lib/data/types.ts` 的类型一一对应——那一层是纯函数的数据形状，
 * 这一层是它在 SQLite 里的落点。日期一律存 `YYYY-MM-DD` 文本键，
 * 与 `lib/data/dates.ts` 产出的键同构：跨时区比较时不会因为 Date 对象
 * 被隐式转成 UTC 而错位。
 *
 * 主键用文本而不是自增整数：不需要服务端序列，将来换成 D1 或
 * 其他 SQLite 托管时也不用改。
 */

// ---------------------------------------------------------------- 用户与认证

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  /**
   * 认证在阶段 3 落地，所以现在允许为空（演示用户没有凭据）。
   * 登录逻辑必须显式拒绝 password_hash 为 null 的行——
   * 绝不能把「没有密码」当成「无需密码」。
   */
  passwordHash: text('password_hash'),
  /**
   * 资料三件套（身高/年龄/性别）**允许为空**。
   *
   * 注册只要邮箱 + 口令（邀请码是唯一门槛），资料是注册之后的「首次引导」
   * 才补的——算每日目标要用到它们，而那时才第一次需要。把它们设成 NOT NULL
   * 就等于逼注册表单要么多问三个字段、要么先塞一组假数字，两条路都不诚实。
   */
  heightCm: integer('height_cm'),
  age: integer('age'),
  sex: text('sex', { enum: ['male', 'female'] }),
  /**
   * 用户开始使用的日期。早于它的日期没有数据——这与「当天有记录但内容为空」
   * 是两种不同状态，界面需要区别对待（见 lib/data/selectors.ts 的 isInRange）。
   */
  startedAt: text('started_at').notNull(),
  /**
   * IANA 时区名。「今天」按它解析，不再依赖构建时间——
   * 这正是接后端后要去掉 NEXT_PUBLIC_TODAY 的原因。
   */
  timezone: text('timezone').notNull().default('Asia/Shanghai'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const sessions = sqliteTable(
  'sessions',
  {
    /** 会话令牌的哈希，而不是令牌本身：库被读走也无法直接冒充登录 */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const inviteCodes = sqliteTable('invite_codes', {
  code: text('code').primaryKey(),
  /** 备注发给谁了，便于回收没用掉的码 */
  note: text('note'),
  usedByUserId: text('used_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

// ---------------------------------------------------------------- 目标

/**
 * 每日目标：一个用户一行。
 *
 * 刻意不做版本历史——改目标就是覆盖。代价是趋势页回顾历史盈余时用的是
 * 「当前目标」，与演示版保持同一个取舍。若将来要修正历史口径，
 * 需要给这张表加生效区间，届时趋势页的盈余定义也要一起改。
 */
export const goals = sqliteTable('goals', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  direction: text('direction', { enum: ['cut', 'bulk', 'maintain'] }).notNull(),
  calories: integer('calories').notNull(),
  protein: integer('protein').notNull(),
  carbs: integer('carbs').notNull(),
  fat: integer('fat').notNull(),
  exerciseCalories: integer('exercise_calories').notNull(),
  targetWeightKg: real('target_weight_kg').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

// ---------------------------------------------------------------- 食物库

export const foods = sqliteTable(
  'foods',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** 下面这组营养值对应的克数，用于按实际份量换算 */
    perGrams: integer('per_grams').notNull().default(100),
    calories: integer('calories').notNull(),
    protein: real('protein').notNull(),
    carbs: real('carbs').notNull(),
    fat: real('fat').notNull(),
  },
  (t) => [uniqueIndex('foods_name_idx').on(t.name)],
)

// ---------------------------------------------------------------- 记录

export const foodEntries = sqliteTable(
  'food_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 当地日期，按用户时区算出来的「那天」 */
    date: text('date').notNull(),
    slot: text('slot', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] }).notNull(),
    /** 来自食物库时记下出处；用户手填或 AI 估算时为 null */
    foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    grams: real('grams').notNull(),
    source: text('source', { enum: ['open-data', 'curated', 'user', 'ai-estimate'] }).notNull(),
    /**
     * 营养值是**快照**，不随食物库变化：食物库里的数字日后会被修正，
     * 但历史记录必须冻结当时估算出的值，否则「那天吃了多少」会被追溯改写。
     */
    calories: integer('calories').notNull(),
    protein: real('protein').notNull(),
    carbs: real('carbs').notNull(),
    fat: real('fat').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('food_entries_user_date_idx').on(t.userId, t.date)],
)

export const exerciseEntries = sqliteTable(
  'exercise_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    kind: text('kind', { enum: ['cardio', 'strength'] }).notNull(),
    name: text('name').notNull(),
    /** 仅 cardio 使用 */
    minutes: integer('minutes'),
    caloriesBurned: integer('calories_burned').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('exercise_entries_user_date_idx').on(t.userId, t.date)],
)

export const strengthSets = sqliteTable(
  'strength_sets',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
      .notNull()
      .references(() => exerciseEntries.id, { onDelete: 'cascade' }),
    /** 组序号，从 1 开始：顺序不该由数据库的返回顺序隐式决定 */
    setIndex: integer('set_index').notNull(),
    reps: integer('reps').notNull(),
    weightKg: real('weight_kg').notNull(),
  },
  (t) => [uniqueIndex('strength_sets_entry_index_idx').on(t.entryId, t.setIndex)],
)

/**
 * 一天一条（「今日空腹体重」），所以 (user_id, date) 本身就是主键，
 * 不需要再加一个代理 id。
 */
export const weightEntries = sqliteTable(
  'weight_entries',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    kg: real('kg').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
)

// ---------------------------------------------------------------- 训练计划

export const planDays = sqliteTable(
  'plan_days',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 1 = 周一 … 7 = 周日，与 lib/data/dates.ts 的 weekdayOf 返回一致 */
    weekday: integer('weekday').notNull(),
    theme: text('theme').notNull(),
  },
  (t) => [uniqueIndex('plan_days_user_weekday_idx').on(t.userId, t.weekday)],
)

export const planItems = sqliteTable(
  'plan_items',
  {
    id: text('id').primaryKey(),
    planDayId: text('plan_day_id')
      .notNull()
      .references(() => planDays.id, { onDelete: 'cascade' }),
    /** 条目序号，从 0 开始。字段名不用 order——那是 SQL 关键字 */
    itemIndex: integer('item_index').notNull(),
    name: text('name').notNull(),
    sets: integer('sets').notNull(),
    /** 次数是文本：计划里会出现「力竭」「8–10」这类写法，不是数字 */
    reps: text('reps').notNull(),
  },
  (t) => [uniqueIndex('plan_items_day_index_idx').on(t.planDayId, t.itemIndex)],
)
