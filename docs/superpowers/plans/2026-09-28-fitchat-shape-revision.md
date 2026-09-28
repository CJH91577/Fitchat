# Fitchat 形态修订实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已完成的前端 demo 改为修订后的形态——两环首页、表格化趋势页、独立日历页与某日详情页，并让假数据覆盖用户从开始使用至今的每一天。

**Architecture:** 在既有 Next.js 单体上就地修改，不引入新框架、新依赖。改动最深的一处是数据层：`dayLogFor` / `weightFor` 从「查固定数组」改为**以日期为种子的确定性生成函数**，从而覆盖任意历史日期。其余为组件与页面层面的改造。

**Tech Stack:** Next.js 16.3.5 · React 19.2.8 · TypeScript 5 · CSS Modules · Vitest + React Testing Library（均已在库中，无需新增）

**Spec:** `docs/superpowers/specs/2026-09-22-fitchat-mvp-design.md`（已含 2026-09-28 修订记录）

---

## Global Constraints

- **环境**：Node 24.16.0 / npm 11.13.0。**不使用 pnpm**。包管理器统一 npm。
- **不新增任何依赖**。本计划全部用现有工具完成。
- **不使用 Tailwind**；样式一律 CSS Modules + `app/globals.css` 里的设计令牌。
- **字体**：一律系统无衬线。**不得**引入 `next/font`、`Geist` 或任何衬线/装饰字体——`tests/font-constraint.test.ts` 会强制此点，必须保持绿色。
- **颜色**：组件里不得硬编码 hex，一律引用令牌。状态色 `#0ca30c` / `#fab219` / `#ec835a` / `#d03b3b` **绝不**用作圆环色或数据系列色。圆环只用两个：外环 `--ring-calories`、内环 `--ring-exercise`，**顺序不可变**。
- **体重方向不做好坏着色**（规格 5.5 节其三）：不得用成功绿或危险红表示涨跌。
- **文字绝不穿数据色**：标签与数值用 `--text-primary` / `--text-secondary` / `--text-muted`，身份由旁边的色块承载。
- **每个视图只有一个 hero 数字**（≥48px）。首页是「净热量」，某日详情页同构。
- **假数据必须确定性生成**：以日期为种子，**禁止 `Math.random()`**。同一日期永远得到同一组数值。
- **记录范围**：从 `MOCK_USER.startedAt`（`2025-09-22`）起向后开放。早于该日期的日期**没有数据**，与「该日有记录但内容为空」是两种不同状态。
- 提交信息用 Conventional Commits 前缀（`feat:` / `fix:` / `test:` / `docs:` / `chore:`）。
- **每个任务必须带测试，`npm test` 全绿且输出零告警后才能提交**（`AGENTS.md` 规则）。

---

## Review Focus

以下五类是修订后形态隐含、但容易漏掉的行为。**每一类都在对应任务的测试里被显式钉住。**

1. **确定性。** 同一日期调用两次 `dayLogFor` / `weightFor`，结果必须**完全相等**。若有人日后改用 `Math.random()`，测试必须立刻转红。→ 任务 1
2. **开始使用日期之前的日期。** `dayLogFor('2025-09-01')` 与 `weightFor('2025-09-01')`（早于 `startedAt`）必须返回「无数据」而非空日志；界面必须能区分「还没开始用」与「当天没有活动」。→ 任务 1、6
3. **热量盈余的符号与零。** 盈余为正（超出目标）、为负（低于目标）、**恰好为零**三种情况都要正确显示。零不得显示成 `+0` 或 `−0`。→ 任务 1、4
4. **圆环在两点边界上的几何。** 目标为 0、数值为 0、数值恰好等于目标、数值超出目标——四种情况下圆环都不得出现 `NaN` 属性或反向绘制。加了圆心插槽后，圆心内容也不得遮挡或溢出。→ 任务 2
5. **日历点的方向判定。** 减脂/维持用户「盈余 ≤ 0」为达成，增肌用户「盈余 ≥ 0」为达成。**同一份数据换一个目标方向，热量的达成状态必须翻转**——这是这条规则唯一能被证明真的生效的方式。→ 任务 5

---

## 文件结构

```
lib/data/
  dateSeed.ts        新增：确定性伪随机（FNV-1a 哈希 → [0,1) 单位值）
  dateSeed.test.ts   新增
  generator.ts       新增：按日期生成某天的饮食 / 运动 / 体重
  generator.test.ts  新增
  dates.ts           修改：新增 daysBetween
  mock.ts            重写：保留 TODAY/MOCK_USER/MOCK_GOAL/MOCK_PLAN，改用生成器
  selectors.ts       修改：新增 calorieSurplus / isCalorieOnTarget / isExerciseOnTarget；移除 adherence
components/
  RingGroup.tsx      修改：支持可选圆心插槽，两环时半径重排
  WeightTable.tsx    新增：日期 / 体重 / 与昨日差，固定高度内滚
  SurplusTable.tsx   新增：日期 / 热量盈余（带正负号）
  CalendarMonth.tsx  修改：两点、方向判定、可点击
  BottomNav.tsx      修改：五项，日历居中
  WeightChart.tsx    删除
  AdherenceChart.tsx 删除
  DateRangeFilter.tsx 删除
app/
  page.tsx           修改：两环 + 圆心净热量 + 今日空腹体重卡
  trends/page.tsx    重写：两张表格
  calendar/page.tsx  新增：日历页
  day/[date]/page.tsx 新增：某日详情
  me/page.tsx        修改：加当前体重
docs/superpowers/plans/
  demo-走查清单.md    重写：对应新形态
```

**边界划分依据：** `dateSeed.ts` 只管伪随机，`generator.ts` 只管「某天长什么样」，两者分开是因为伪随机是通用工具而生成规则会随产品调整；表格抽成独立组件是因为它们各自只有一个职责且要被单独测试。

---

## Task 1: 数据层——确定性生成与完整历史

**Files:**
- Create: `lib/data/dateSeed.ts`
- Create: `lib/data/dateSeed.test.ts`
- Create: `lib/data/generator.ts`
- Create: `lib/data/generator.test.ts`
- Modify: `lib/data/dates.ts`（新增 `daysBetween`）
- Modify: `lib/data/dates.test.ts`
- Modify: `lib/data/selectors.ts`
- Modify: `lib/data/selectors.test.ts`
- Modify: `lib/data/mock.ts`
- Modify: `lib/data/mock.test.ts`

**Interfaces:**
- Consumes: `lib/data/types.ts` 的 `DayLog` / `FoodEntry` / `ExerciseEntry` / `MealSlot` / `UserGoal` / `FoodSource`；`dates.ts` 的 `addDays`
- Produces:
  ```ts
  // dateSeed.ts
  export function hashSeed(key: string, salt: number): number
  export function seededUnit(key: string, salt: number): number      // [0, 1)
  export function seededInt(key: string, salt: number, min: number, max: number): number
  export function seededPick<T>(key: string, salt: number, items: readonly T[]): T

  // dates.ts
  export function daysBetween(fromKey: string, toKey: string): number

  // generator.ts
  export function generateDayLog(date: string, goal: UserGoal): DayLog
  export function generateWeight(date: string, startedAt: string, startKg: number, targetKg: number): number

  // selectors.ts
  export function calorieSurplus(day: DayLog, goal: UserGoal): number
  export function isCalorieOnTarget(day: DayLog, goal: UserGoal): boolean
  export function isExerciseOnTarget(day: DayLog, goal: UserGoal): boolean
  export function hasRecord(date: string, startedAt: string): boolean

  // mock.ts
  export const MOCK_USER: { name: string; heightCm: number; age: number; sex: 'male'; startedAt: string }
  export function dayLogFor(date: string): DayLog | null      // null = 早于开始使用日期
  export function weightFor(date: string): number | null
  export function weightSeries(fromKey: string, toKey: string): WeightEntry[]
  export function datesWithRecords(fromKey: string, toKey: string): string[]
  export function recentWeights(n: number): WeightEntry[]   // 最近 n 天（含今天），任务 3 消费
  ```
- **注意：`dayLogFor` 与 `weightFor` 的返回类型从 `DayLog` / `number | undefined` 变为 `DayLog | null` / `number | null`。** 「null」表示早于开始使用日期，与「空日志」是两种不同状态（Review Focus 第 2 条）。
- **移除 `adherence`** —— 它只被重写掉的趋势页和两个测试文件引用（已核实无其他消费者）。

- [ ] **Step 1: 写日期差的失败测试**

在 `lib/data/dates.test.ts` 末尾追加：

```ts
describe('daysBetween', () => {
  it('同一天为 0', () => {
    expect(daysBetween('2026-09-22', '2026-09-22')).toBe(0)
  })

  it('向后为正', () => {
    expect(daysBetween('2026-09-22', '2026-09-25')).toBe(3)
  })

  it('向前为负', () => {
    expect(daysBetween('2026-09-25', '2026-09-22')).toBe(-3)
  })

  it('跨月跨年正确', () => {
    expect(daysBetween('2025-09-22', '2026-09-22')).toBe(365)
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59)
  })
})
```

同时把该文件顶部的导入改为：

```ts
import { toDateKey, addDays, weekdayOf, lastNDays, monthGrid, daysBetween } from './dates'
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run lib/data/dates.test.ts
```

预期：FAIL，`daysBetween is not a function`。

- [ ] **Step 3: 实现 daysBetween**

在 `lib/data/dates.ts` 末尾追加：

```ts
// 以本地时区的当日零点计算整日差，避免夏令时导致的 23/25 小时误差
export function daysBetween(fromKey: string, toKey: string): number {
  const a = parseKey(fromKey)
  const b = parseKey(toKey)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run lib/data/dates.test.ts
```

预期：全部通过。

- [ ] **Step 5: 写确定性伪随机的失败测试**

创建 `lib/data/dateSeed.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { hashSeed, seededUnit, seededInt, seededPick } from './dateSeed'

describe('确定性', () => {
  it('同一输入永远得到同一结果', () => {
    expect(hashSeed('2026-09-22', 1)).toBe(hashSeed('2026-09-22', 1))
    expect(seededUnit('2026-09-22', 1)).toBe(seededUnit('2026-09-22', 1))
    expect(seededInt('2026-09-22', 1, 0, 100)).toBe(seededInt('2026-09-22', 1, 0, 100))
  })

  it('不同日期得到不同结果（抽样 30 天不得全部相同）', () => {
    const values = Array.from({ length: 30 }, (_, i) =>
      seededUnit(`2026-09-${String(i + 1).padStart(2, '0')}`, 1),
    )
    expect(new Set(values).size).toBeGreaterThan(25)
  })

  it('同一日期不同盐值得到不同结果', () => {
    expect(seededUnit('2026-09-22', 1)).not.toBe(seededUnit('2026-09-22', 2))
  })
})

describe('seededUnit', () => {
  it('始终落在 [0, 1)', () => {
    for (let i = 1; i <= 200; i += 1) {
      const v = seededUnit(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      expect(Number.isFinite(v)).toBe(true)
    }
  })
})

describe('seededInt', () => {
  it('落在闭区间内且为整数', () => {
    for (let i = 1; i <= 100; i += 1) {
      const v = seededInt(`2026-02-${String((i % 28) + 1).padStart(2, '0')}`, i, 3, 7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('min 等于 max 时恒定返回该值', () => {
    expect(seededInt('2026-09-22', 1, 5, 5)).toBe(5)
  })
})

describe('seededPick', () => {
  it('总是取到数组内的元素', () => {
    const items = ['a', 'b', 'c'] as const
    for (let i = 1; i <= 50; i += 1) {
      expect(items).toContain(seededPick(`2026-03-${String((i % 28) + 1).padStart(2, '0')}`, i, items))
    }
  })

  it('长度 1 的数组恒定返回唯一元素', () => {
    expect(seededPick('2026-09-22', 1, ['only'])).toBe('only')
  })
})
```

- [ ] **Step 6: 运行测试，确认失败**

```bash
npx vitest run lib/data/dateSeed.test.ts
```

预期：FAIL，`Cannot find module './dateSeed'`。

- [ ] **Step 7: 实现 dateSeed**

创建 `lib/data/dateSeed.ts`：

```ts
// 确定性伪随机。以日期字符串与盐值作种子。
// 绝不用 Math.random——否则每次刷新数据都变，测试无法编写，问题无法复现。
// 算法为 FNV-1a 哈希，再归一化到 [0, 1)。
export function hashSeed(key: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 返回 [0, 1) 区间内的确定性数值 */
export function seededUnit(key: string, salt: number): number {
  return hashSeed(key, salt) / 4294967296
}

/** 返回 [min, max] 闭区间内的确定性整数 */
export function seededInt(key: string, salt: number, min: number, max: number): number {
  if (max <= min) return min
  return min + Math.floor(seededUnit(key, salt) * (max - min + 1))
}

/** 从数组里确定性地取一项 */
export function seededPick<T>(key: string, salt: number, items: readonly T[]): T {
  return items[seededInt(key, salt, 0, items.length - 1)]
}
```

- [ ] **Step 8: 运行测试，确认通过**

```bash
npx vitest run lib/data/dateSeed.test.ts
```

预期：全部通过。

- [ ] **Step 9: 写生成器的失败测试**

创建 `lib/data/generator.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { generateDayLog, generateWeight } from './generator'
import { sumMacros, burnedCalories } from './selectors'
import type { UserGoal } from './types'

const goal: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}

const START = '2025-09-22'

describe('generateDayLog 的确定性', () => {
  it('同一日期两次生成结果完全相等', () => {
    expect(generateDayLog('2026-09-22', goal)).toEqual(generateDayLog('2026-09-22', goal))
  })

  it('不同日期生成结果不同', () => {
    expect(generateDayLog('2026-09-22', goal)).not.toEqual(generateDayLog('2026-09-23', goal))
  })
})

describe('generateDayLog 的内容', () => {
  it('每天包含早、午、晚三餐', () => {
    const day = generateDayLog('2026-09-22', goal)
    const slots = day.foods.map((f) => f.slot)
    expect(slots).toContain('breakfast')
    expect(slots).toContain('lunch')
    expect(slots).toContain('dinner')
  })

  it('加餐若存在，来源为 AI 估算', () => {
    // 扫描 60 天，凡是出现加餐的日子，其加餐必须标为 ai-estimate
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-08-${String((i % 28) + 1).padStart(2, '0')}`
      const snacks = generateDayLog(date, goal).foods.filter((f) => f.slot === 'snack')
      for (const snack of snacks) {
        expect(snack.source).toBe('ai-estimate')
      }
    }
  })

  it('三条主餐的来源不是 AI 估算', () => {
    const day = generateDayLog('2026-09-22', goal)
    const main = day.foods.filter((f) => f.slot !== 'snack')
    expect(main).toHaveLength(3)
    for (const entry of main) {
      expect(entry.source).not.toBe('ai-estimate')
    }
  })

  it('摄入热量在目标附近的合理区间内浮动（抽样 60 天）', () => {
    const totals: number[] = []
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-07-${String((i % 28) + 1).padStart(2, '0')}`
      totals.push(sumMacros(generateDayLog(date, goal).foods).calories)
    }
    for (const total of totals) {
      expect(total).toBeGreaterThan(goal.calories * 0.6)
      expect(total).toBeLessThan(goal.calories * 1.4)
    }
    // 必须既有低于目标也有高于目标的日子，否则盈余永远只有一个符号
    expect(totals.some((t) => t < goal.calories)).toBe(true)
    expect(totals.some((t) => t > goal.calories)).toBe(true)
  })

  it('运动非每日发生：抽样 60 天中既有有运动的日子也有没有的日子', () => {
    const withExercise: number[] = []
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-06-${String((i % 28) + 1).padStart(2, '0')}`
      withExercise.push(burnedCalories(generateDayLog(date, goal)))
    }
    expect(withExercise.some((v) => v > 0)).toBe(true)
    expect(withExercise.some((v) => v === 0)).toBe(true)
  })

  it('力量训练记录的每一组都有正数重量与次数', () => {
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-05-${String((i % 28) + 1).padStart(2, '0')}`
      for (const ex of generateDayLog(date, goal).exercises) {
        if (ex.kind === 'strength') {
          expect(ex.sets?.length).toBeGreaterThan(0)
          for (const set of ex.sets ?? []) {
            expect(set.weightKg).toBeGreaterThan(0)
            expect(set.reps).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('任何数值都不为 NaN、不为负', () => {
    for (let i = 0; i < 60; i += 1) {
      const date = `2026-04-${String((i % 28) + 1).padStart(2, '0')}`
      const day = generateDayLog(date, goal)
      for (const f of day.foods) {
        expect(Number.isFinite(f.totals.calories)).toBe(true)
        expect(f.totals.calories).toBeGreaterThanOrEqual(0)
        expect(f.totals.protein).toBeGreaterThanOrEqual(0)
        expect(f.totals.carbs).toBeGreaterThanOrEqual(0)
        expect(f.totals.fat).toBeGreaterThanOrEqual(0)
      }
      for (const e of day.exercises) {
        expect(Number.isFinite(e.caloriesBurned)).toBe(true)
        expect(e.caloriesBurned).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('generateWeight', () => {
  it('确定性：同一日期两次结果相同', () => {
    expect(generateWeight('2026-09-22', START, 78, 65)).toBe(generateWeight('2026-09-22', START, 78, 65))
  })

  it('开始那天接近起始体重（允许噪点）', () => {
    const w = generateWeight(START, START, 78, 65)
    expect(Math.abs(w - 78)).toBeLessThan(0.5)
  })

  it('随时间向目标体重靠拢', () => {
    const early = generateWeight('2025-10-22', START, 78, 65)
    const late = generateWeight('2026-09-22', START, 78, 65)
    expect(late).toBeLessThan(early)
  })

  it('结果为一位小数且有限', () => {
    for (let i = 0; i < 40; i += 1) {
      const date = `2026-03-${String((i % 28) + 1).padStart(2, '0')}`
      const w = generateWeight(date, START, 78, 65)
      expect(Number.isFinite(w)).toBe(true)
      expect(Math.round(w * 10) / 10).toBe(w)
    }
  })

  it('起始体重等于目标体重时不会除零，也不产生 NaN', () => {
    const w = generateWeight('2026-09-22', START, 70, 70)
    expect(Number.isFinite(w)).toBe(true)
  })
})
```

- [ ] **Step 10: 运行测试，确认失败**

```bash
npx vitest run lib/data/generator.test.ts
```

预期：FAIL，`Cannot find module './generator'`。

- [ ] **Step 11: 实现生成器**

创建 `lib/data/generator.ts`：

```ts
import { seededInt, seededPick, seededUnit } from './dateSeed'
import { daysBetween } from './dates'
import type { DayLog, ExerciseEntry, FoodEntry, FoodSource, MealSlot, UserGoal } from './types'

type FoodTemplate = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

const BREAKFAST: FoodTemplate[] = [
  { name: '燕麦牛奶', calories: 380, protein: 18, carbs: 55, fat: 9 },
  { name: '豆浆鸡蛋', calories: 300, protein: 20, carbs: 22, fat: 14 },
  { name: '全麦三明治', calories: 420, protein: 22, carbs: 48, fat: 15 },
]

const LUNCH: FoodTemplate[] = [
  { name: '鸡胸肉盖饭', calories: 620, protein: 42, carbs: 70, fat: 14 },
  { name: '牛肉面', calories: 680, protein: 34, carbs: 88, fat: 18 },
  { name: '清蒸鱼套餐', calories: 540, protein: 40, carbs: 52, fat: 16 },
]

const DINNER: FoodTemplate[] = [
  { name: '清炒时蔬 + 米饭', calories: 420, protein: 12, carbs: 68, fat: 8 },
  { name: '番茄鸡蛋面', calories: 480, protein: 20, carbs: 72, fat: 12 },
  { name: '鸡腿饭', calories: 560, protein: 32, carbs: 62, fat: 20 },
]

const SNACK: FoodTemplate[] = [
  { name: '苹果', calories: 95, protein: 0, carbs: 25, fat: 0 },
  { name: '酸奶', calories: 130, protein: 8, carbs: 16, fat: 4 },
  { name: '坚果', calories: 200, protein: 6, carbs: 8, fat: 17 },
]

const CARDIO = [
  { name: '慢跑', perMinute: 10 },
  { name: '快走', perMinute: 6 },
  { name: '骑行', perMinute: 11 },
]

const STRENGTH = [
  { name: '卧推', caloriesBurned: 170 },
  { name: '深蹲', caloriesBurned: 220 },
  { name: '硬拉', caloriesBurned: 200 },
  { name: '引体向上', caloriesBurned: 150 },
]

// 分量系数，模拟「有时吃得多、有时吃得少」，让每日摄入围绕目标上下浮动
function portionFactor(date: string, index: number): number {
  return 0.8 + seededUnit(date, 60 + index) * 0.5
}

function toEntry(
  date: string,
  index: number,
  slot: MealSlot,
  template: FoodTemplate,
  source: FoodSource,
): FoodEntry {
  const k = portionFactor(date, index)
  return {
    id: `${date}-${slot}-${index}`,
    slot,
    name: template.name,
    grams: 100,
    source,
    totals: {
      calories: Math.round(template.calories * k),
      protein: Math.round(template.protein * k),
      carbs: Math.round(template.carbs * k),
      fat: Math.round(template.fat * k),
    },
  }
}

export function generateDayLog(date: string, _goal: UserGoal): DayLog {
  const foods: FoodEntry[] = [
    toEntry(date, 0, 'breakfast', seededPick(date, 10, BREAKFAST), 'curated'),
    toEntry(date, 1, 'lunch', seededPick(date, 11, LUNCH), 'curated'),
    toEntry(date, 2, 'dinner', seededPick(date, 12, DINNER), 'curated'),
  ]

  // 约七成日子有加餐。加餐一律标为 AI 估算——它是「用一句话描述」记进来的。
  if (seededUnit(date, 20) > 0.3) {
    foods.push(toEntry(date, 3, 'snack', seededPick(date, 21, SNACK), 'ai-estimate'))
  }

  const exercises: ExerciseEntry[] = []
  const roll = seededUnit(date, 30)

  if (roll < 0.4) {
    const template = seededPick(date, 31, STRENGTH)
    const setCount = seededInt(date, 32, 3, 5)
    exercises.push({
      id: `${date}-strength`,
      kind: 'strength',
      name: template.name,
      sets: Array.from({ length: setCount }, (_, i) => ({
        reps: seededInt(date, 40 + i, 6, 12),
        weightKg: seededInt(date, 50 + i, 20, 100),
      })),
      caloriesBurned: template.caloriesBurned,
    })
  } else if (roll < 0.7) {
    const template = seededPick(date, 33, CARDIO)
    const minutes = seededInt(date, 34, 20, 50)
    exercises.push({
      id: `${date}-cardio`,
      kind: 'cardio',
      name: template.name,
      minutes,
      caloriesBurned: minutes * template.perMinute,
    })
  }
  // 其余约三成是休息日，没有任何运动记录

  return { date, foods, exercises }
}

export function generateWeight(
  date: string,
  startedAt: string,
  startKg: number,
  targetKg: number,
): number {
  const elapsed = daysBetween(startedAt, date)
  // 一年内线性向目标体重靠拢，之后停在目标附近
  const progress = Math.min(Math.max(elapsed, 0) / 365, 1)
  const trend = startKg + (targetKg - startKg) * progress
  const noise = (seededUnit(date, 70) - 0.5) * 0.6
  return Math.round((trend + noise) * 10) / 10
}
```

- [ ] **Step 12: 运行测试，确认通过**

```bash
npx vitest run lib/data/generator.test.ts
```

预期：全部通过。

若「摄入在目标附近浮动」失败，检查采样日期串是否重复——测试里用 `i % 28` 循环会重复日期，`new Set` 去重后可能不足 60 个不同值。这不影响断言，但如果某个断言依赖「必须有不同的值」，请确认采样覆盖了足够多的不同日期。

- [ ] **Step 13: 写选择器的失败测试**

在 `lib/data/selectors.test.ts` 末尾追加，**并先删除该文件里所有 `adherence` 的测试块**（该函数将被移除）：

```ts
describe('calorieSurplus', () => {
  const goal = { ...baseGoal }

  it('超出目标为正', () => {
    const day: DayLog = { date: '2026-09-22', foods: [food(2100)], exercises: [] }
    expect(calorieSurplus(day, goal)).toBe(300)
  })

  it('低于目标为负', () => {
    const day: DayLog = { date: '2026-09-22', foods: [food(1500)], exercises: [] }
    expect(calorieSurplus(day, goal)).toBe(-300)
  })

  it('恰好等于目标为 0', () => {
    const day: DayLog = { date: '2026-09-22', foods: [food(1800)], exercises: [] }
    expect(calorieSurplus(day, goal)).toBe(0)
  })

  it('运动不影响盈余（盈余只看摄入与目标）', () => {
    const withExercise: DayLog = {
      date: '2026-09-22',
      foods: [food(1800)],
      exercises: [
        { id: 'e1', kind: 'cardio', name: '慢跑', minutes: 30, caloriesBurned: 400 },
      ],
    }
    expect(calorieSurplus(withExercise, goal)).toBe(0)
  })

  it('无记录时为 −目标值，不为 NaN', () => {
    const empty: DayLog = { date: '2026-09-22', foods: [], exercises: [] }
    expect(calorieSurplus(empty, goal)).toBe(-1800)
  })
})

describe('isCalorieOnTarget 按目标方向判定', () => {
  const eaten = (calories: number): DayLog => ({
    date: '2026-09-22',
    foods: [food(calories)],
    exercises: [],
  })

  it('减脂：不超目标为达成', () => {
    const cut = { ...baseGoal, direction: 'cut' as const }
    expect(isCalorieOnTarget(eaten(1700), cut)).toBe(true)
    expect(isCalorieOnTarget(eaten(1800), cut)).toBe(true)
    expect(isCalorieOnTarget(eaten(1900), cut)).toBe(false)
  })

  it('增肌：吃够目标为达成', () => {
    const bulk = { ...baseGoal, direction: 'bulk' as const }
    expect(isCalorieOnTarget(eaten(1900), bulk)).toBe(true)
    expect(isCalorieOnTarget(eaten(1800), bulk)).toBe(true)
    expect(isCalorieOnTarget(eaten(1700), bulk)).toBe(false)
  })

  it('维持：按不超目标处理', () => {
    const maintain = { ...baseGoal, direction: 'maintain' as const }
    expect(isCalorieOnTarget(eaten(1800), maintain)).toBe(true)
    expect(isCalorieOnTarget(eaten(1801), maintain)).toBe(false)
  })

  it('同一份数据换个方向，判定必须翻转', () => {
    const over = eaten(1900)
    expect(isCalorieOnTarget(over, { ...baseGoal, direction: 'cut' as const })).toBe(false)
    expect(isCalorieOnTarget(over, { ...baseGoal, direction: 'bulk' as const })).toBe(true)
  })

  it('目标为 0 时不抛错', () => {
    const zeroGoal = { ...baseGoal, calories: 0 }
    expect(() => isCalorieOnTarget(eaten(500), zeroGoal)).not.toThrow()
  })
})

describe('isExerciseOnTarget', () => {
  it('达到运动目标为达成', () => {
    const day: DayLog = {
      date: '2026-09-22',
      foods: [],
      exercises: [{ id: 'e1', kind: 'cardio', name: '慢跑', minutes: 60, caloriesBurned: 600 }],
    }
    expect(isExerciseOnTarget(day, baseGoal)).toBe(true)
  })

  it('未达运动目标为未达成', () => {
    const day: DayLog = {
      date: '2026-09-22',
      foods: [],
      exercises: [{ id: 'e1', kind: 'cardio', name: '慢跑', minutes: 10, caloriesBurned: 100 }],
    }
    expect(isExerciseOnTarget(day, baseGoal)).toBe(false)
  })

  it('无运动记录为未达成', () => {
    const day: DayLog = { date: '2026-09-22', foods: [], exercises: [] }
    expect(isExerciseOnTarget(day, baseGoal)).toBe(false)
  })
})

describe('hasRecord', () => {
  it('早于开始使用日期为 false', () => {
    expect(hasRecord('2025-09-21', '2025-09-22')).toBe(false)
  })

  it('开始使用当天及以后为 true', () => {
    expect(hasRecord('2025-09-22', '2025-09-22')).toBe(true)
    expect(hasRecord('2026-09-22', '2025-09-22')).toBe(true)
  })
})
```

该文件顶部需要这些导入与公共夹具（若已有同名符号，复用即可，不要重复定义）：

```ts
import {
  sumMacros,
  netCalories,
  emptyMacros,
  emptyDayLog,
  calorieSurplus,
  isCalorieOnTarget,
  isExerciseOnTarget,
  hasRecord,
} from './selectors'
import type { DayLog, FoodEntry, UserGoal } from './types'

const baseGoal: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}
```

- [ ] **Step 14: 运行测试，确认失败**

```bash
npx vitest run lib/data/selectors.test.ts
```

预期：FAIL。若报 `adherence is not exported`，说明上一步的旧测试块没删干净；若报 `calorieSurplus is not a function`，则是预期中的失败。

- [ ] **Step 15: 实现选择器**

编辑 `lib/data/selectors.ts`：**删除 `adherence` 函数**，追加以下内容，并把 `daysBetween` 从 `./dates` 导入：

```ts
import { daysBetween } from './dates'
```

```ts
// 热量盈余 = 摄入 − 每日目标。正数为超出目标，负数为低于目标。
// 注意与「净热量」区分：净热量是 摄入 − 运动消耗，不减目标。
export function calorieSurplus(day: DayLog, goal: UserGoal): number {
  return sumMacros(day.foods).calories - goal.calories
}

// 热量的「达成」按目标方向判定：
//   减脂 / 维持 —— 未超标（盈余 ≤ 0）即达成
//   增肌       —— 吃够（盈余 ≥ 0）即达成
// 若沿用「填满目标即达成」的规则，对减脂用户会把「吃满」判成达成，语义正好相反。
export function isCalorieOnTarget(day: DayLog, goal: UserGoal): boolean {
  const surplus = calorieSurplus(day, goal)
  return goal.direction === 'bulk' ? surplus >= 0 : surplus <= 0
}

export function isExerciseOnTarget(day: DayLog, goal: UserGoal): boolean {
  if (goal.exerciseCalories <= 0) return false
  return burnedCalories(day) >= goal.exerciseCalories
}

// 该日期是否在用户的使用范围内。早于开始使用日期 = 该用户当时还没开始用，
// 这与「当天没有记录任何活动」是两种不同状态，界面必须能区分。
export function hasRecord(date: string, startedAt: string): boolean {
  return daysBetween(startedAt, date) >= 0
}
```

- [ ] **Step 16: 运行测试，确认通过**

```bash
npx vitest run lib/data/selectors.test.ts
```

预期：全部通过。

- [ ] **Step 17: 重写 mock.ts**

覆盖 `lib/data/mock.ts`。保留 `TODAY` / `MOCK_USER` / `MOCK_GOAL` / `MOCK_PLAN`（内容不变），把数据获取改为生成器驱动：

```ts
import { addDays, daysBetween, lastNDays } from './dates'
import { generateDayLog, generateWeight } from './generator'
import { hasRecord } from './selectors'
import type { DayLog, PlanDay, UserGoal, WeightEntry } from './types'

export const TODAY = '2026-09-22'

export const MOCK_USER = {
  name: '演示用户',
  heightCm: 175,
  age: 30,
  sex: 'male' as const,
  /** 开始使用日期。它是用户自身的属性，不是全局常量。 */
  startedAt: '2025-09-22',
  /** 开始使用时的体重，生成体重序列的起点 */
  startWeightKg: 78,
}

export const MOCK_GOAL: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}

export const MOCK_PLAN: PlanDay[] = [
  // ← 原样保留上一版的七项内容，不要改动任何主题名、动作名、组数、次数区间
]

// 早于开始使用日期返回 null（该用户当时还没开始用），
// 与「在范围内但当天没有任何活动」是两种不同状态。
export function dayLogFor(date: string): DayLog | null {
  if (!hasRecord(date, MOCK_USER.startedAt)) return null
  return generateDayLog(date, MOCK_GOAL)
}

export function weightFor(date: string): number | null {
  if (!hasRecord(date, MOCK_USER.startedAt)) return null
  return generateWeight(date, MOCK_USER.startedAt, MOCK_USER.startWeightKg, MOCK_GOAL.targetWeightKg)
}

/** 从 fromKey 到 toKey（含两端）的体重序列，按日期升序 */
export function weightSeries(fromKey: string, toKey: string): WeightEntry[] {
  const span = daysBetween(fromKey, toKey)
  if (span < 0) return []
  return Array.from({ length: span + 1 }, (_, i) => {
    const date = addDays(fromKey, i)
    return { date, kg: weightFor(date) as number }
  })
}

/** 从 fromKey 到 toKey（含两端）中，落在使用范围内的所有日期，升序 */
export function datesWithRecords(fromKey: string, toKey: string): string[] {
  const span = daysBetween(fromKey, toKey)
  if (span < 0) return []
  const all = Array.from({ length: span + 1 }, (_, i) => addDays(fromKey, i))
  return all.filter((date) => hasRecord(date, MOCK_USER.startedAt))
}

/** 最近 n 天的体重序列（含今天），供首页与测试使用 */
export function recentWeights(n: number): WeightEntry[] {
  return weightSeries(addDays(TODAY, -(n - 1)), TODAY)
}

export { lastNDays }
```

- [ ] **Step 18: 重写 mock 的测试**

覆盖 `lib/data/mock.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import {
  TODAY,
  MOCK_USER,
  MOCK_GOAL,
  MOCK_PLAN,
  dayLogFor,
  weightFor,
  weightSeries,
  datesWithRecords,
  recentWeights,
} from './mock'
import { sumMacros, calorieSurplus, hasRecord } from './selectors'

describe('使用范围', () => {
  it('开始使用日期早于今天', () => {
    expect(MOCK_USER.startedAt).toBe('2025-09-22')
  })

  it('早于开始使用日期返回 null，而不是空日志', () => {
    expect(dayLogFor('2025-09-21')).toBeNull()
    expect(weightFor('2025-09-21')).toBeNull()
  })

  it('开始使用当天有数据', () => {
    expect(dayLogFor('2025-09-22')).not.toBeNull()
    expect(weightFor('2025-09-22')).not.toBeNull()
  })

  it('hasRecord 与 dayLogFor 的判定一致', () => {
    for (const date of ['2025-09-21', '2025-09-22', '2026-09-22']) {
      expect(dayLogFor(date) === null).toBe(!hasRecord(date, MOCK_USER.startedAt))
    }
  })
})

describe('确定性（回归保护）', () => {
  it('同一日期两次取值完全相同——若有人改用 Math.random 会立刻失败', () => {
    expect(dayLogFor(TODAY)).toEqual(dayLogFor(TODAY))
    expect(weightFor(TODAY)).toBe(weightFor(TODAY))
  })
})

describe('假数据的覆盖度', () => {
  it('近一年内存在摄入超出目标的日子', () => {
    const over = datesWithRecords('2025-09-22', TODAY).some((date) => {
      const day = dayLogFor(date)
      return day !== null && calorieSurplus(day, MOCK_GOAL) > 0
    })
    expect(over).toBe(true)
  })

  it('近一年内存在摄入低于目标的日子', () => {
    const under = datesWithRecords('2025-09-22', TODAY).some((date) => {
      const day = dayLogFor(date)
      return day !== null && calorieSurplus(day, MOCK_GOAL) < 0
    })
    expect(under).toBe(true)
  })

  it('存在至少一条 AI 估算来源的饮食', () => {
    const hasAi = datesWithRecords('2026-08-01', TODAY).some((date) =>
      (dayLogFor(date)?.foods ?? []).some((f) => f.source === 'ai-estimate'),
    )
    expect(hasAi).toBe(true)
  })

  it('存在至少一次力量训练', () => {
    const hasStrength = datesWithRecords('2026-06-01', TODAY).some((date) =>
      (dayLogFor(date)?.exercises ?? []).some((e) => e.kind === 'strength'),
    )
    expect(hasStrength).toBe(true)
  })

  it('存在至少一天完全没有运动（休息日）', () => {
    const hasRest = datesWithRecords('2026-06-01', TODAY).some(
      (date) => (dayLogFor(date)?.exercises ?? []).length === 0,
    )
    expect(hasRest).toBe(true)
  })
})

describe('weightSeries / datesWithRecords', () => {
  it('weightSeries 覆盖两端且升序', () => {
    const series = weightSeries('2026-09-20', '2026-09-22')
    expect(series.map((w) => w.date)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22'])
  })

  it('weightSeries 起点早于使用范围时返回空数组', () => {
    expect(weightSeries('2025-09-01', '2025-09-10')).toEqual([])
  })

  it('起点晚于终点时返回空数组', () => {
    expect(weightSeries('2026-09-22', '2026-09-20')).toEqual([])
  })

  it('recentWeights 返回 n 条，末条为今天', () => {
    const w = recentWeights(7)
    expect(w).toHaveLength(7)
    expect(w[w.length - 1].date).toBe(TODAY)
  })

  it('datesWithRecords 不含早于开始使用日期的日期', () => {
    const dates = datesWithRecords('2025-09-20', '2025-09-24')
    expect(dates).toEqual(['2025-09-22', '2025-09-23', '2025-09-24'])
  })
})

describe('训练计划', () => {
  it('七个星期齐全，周二为训练日', () => {
    expect(MOCK_PLAN).toHaveLength(7)
    const tuesday = MOCK_PLAN.find((d) => d.weekday === 2)
    expect(tuesday?.items.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 19: 运行全部测试**

```bash
npm test
```

预期：会有失败——`app/page.tsx` 与 `app/trends/page.tsx` 仍在用旧的 `MOCK_WEIGHTS` / `adherence`。**这是预期的**，它们会在任务 3、4 中被改写。

在提交前，把这两处的最小改动做掉，让套件恢复绿色：

- `app/page.tsx`：把 `MOCK_WEIGHTS` 的用法换成 `recentWeights(2)`（`latestWeight` 取末条、`prevWeight` 取倒数第二条），`dayLogFor(TODAY)` 之后加空值判断
- `app/trends/page.tsx`：暂时把 `adherence` 的调用替换为 `calorieSurplus` 的等价写法以通过编译——该文件在任务 4 会被整体重写，这里只需让它编译且测试通过

- [ ] **Step 20: 运行全部测试，确认通过**

```bash
npm test
```

预期：全部通过，零告警。

- [ ] **Step 21: 提交**

```bash
git add lib/data/
git commit -m "feat: replace fixed mock arrays with deterministic date-seeded generation"
```

---

## Task 2: RingGroup 圆心插槽

**Files:**
- Modify: `components/RingGroup.tsx`
- Modify: `components/RingGroup.module.css`
- Modify: `components/RingGroup.test.tsx`

**Interfaces:**
- Consumes: 任务 1 无依赖；使用 `app/globals.css` 的 `--ring-calories` / `--ring-exercise`
- Produces:
  ```ts
  export default function RingGroup(props: {
    rings: RingSpec[]
    center?: React.ReactNode
  }): JSX.Element
  ```
- 传两个环时半径自动重排，使两环填满圆面；传 `center` 时圆心渲染该内容

- [ ] **Step 1: 写失败的测试**

在 `components/RingGroup.test.tsx` 末尾追加：

```tsx
describe('圆心插槽', () => {
  const twoRings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: 1600, goal: 1800, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: 480, goal: 500, unit: '千卡' },
  ]

  it('不传 center 时圆心为空', () => {
    render(<RingGroup rings={twoRings} />)
    expect(screen.queryByTestId('ring-center')).not.toBeInTheDocument()
  })

  it('传入 center 时圆心渲染其内容', () => {
    render(<RingGroup rings={twoRings} center={<span>1120</span>} />)
    expect(screen.getByTestId('ring-center')).toBeInTheDocument()
    expect(screen.getByText('1120')).toBeInTheDocument()
  })

  it('两个环时仍使用固定的颜色顺序与半径递增', () => {
    render(<RingGroup rings={twoRings} />)
    const strokes = [...document.querySelectorAll('[data-ring-fill]')].map((el) =>
      el.getAttribute('stroke'),
    )
    expect(strokes).toEqual(['var(--ring-calories)', 'var(--ring-exercise)'])
  })

  it('两个环的半径不同，且都为正、都完整落在 viewBox 内', () => {
    render(<RingGroup rings={twoRings} />)
    const radii = [...document.querySelectorAll('circle')]
      .map((el) => Number(el.getAttribute('r')))
      .filter((r) => Number.isFinite(r))
    const distinct = [...new Set(radii)].sort((a, b) => b - a)
    expect(distinct.length).toBeGreaterThanOrEqual(2)
    const stroke = 11 // 与实现中的 STROKE 常量一致
    for (const r of distinct) {
      expect(r).toBeGreaterThan(0)
      expect(r + stroke / 2).toBeLessThanOrEqual(88) // viewBox 176 的半宽
    }
  })

  it('目标为 0 时圆心插槽仍渲染，且页面无 NaN', () => {
    const zeroGoal: RingSpec[] = [
      { kind: 'calories', label: '热量', value: 0, goal: 0, unit: '千卡' },
    ]
    const { container } = render(<RingGroup rings={zeroGoal} center={<span>0</span>} />)
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run components/RingGroup.test.tsx
```

预期：FAIL——`ring-center` 不存在。

- [ ] **Step 3: 实现圆心插槽与两环半径重排**

修改 `components/RingGroup.tsx`：

把常量段替换为：

```tsx
const SIZE = 176
const CENTER = SIZE / 2
const STROKE = 11
const GAP = 2

// 四环时的外半径；环数变少时半径向外扩张，使环填满圆面
const MAX_OUTER_RADIUS = 72
const MIN_INNER_RADIUS = 34
```

在组件签名处增加 `center`：

```tsx
export default function RingGroup({
  rings,
  center,
}: {
  rings: RingSpec[]
  center?: React.ReactNode
}) {
  const count = Math.max(rings.length, 1)
  const pitch = count === 1 ? 0 : (MAX_OUTER_RADIUS - MIN_INNER_RADIUS) / (count - 1)
  const radiusFor = (index: number) => MAX_OUTER_RADIUS - index * pitch
```

把原来计算 `radius` 的那行替换为：

```tsx
          const radius = radiusFor(i)
```

在 `</svg>` 之后、`<ul className={styles.legend}>` 之前插入圆心内容：

```tsx
      {center && (
        <div className={styles.center} data-testid="ring-center">
          {center}
        </div>
      )}
```

在 `components/RingGroup.module.css` 中追加：

```css
/* 圆心内容绝对定位于 SVG 中心。.wrap 已是 flex 容器，故以相对定位的
   包裹层承载，避免圆心内容参与 flex 排布而挤动图例。 */
.svgWrap {
  position: relative;
  flex: 0 0 auto;
}

.center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
```

同时把 `<svg>` 包进 `.svgWrap`：

```tsx
    <div className={styles.svgWrap}>
      <svg ... >...</svg>
      {center && (...) }
    </div>
```

并移除 `.svg` 上的 `flex: 0 0 auto`（已移到 `.svgWrap`）。

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run components/RingGroup.test.tsx
```

预期：全部通过。

- [ ] **Step 5: 提交**

```bash
git add components/RingGroup.tsx components/RingGroup.module.css components/RingGroup.test.tsx
git commit -m "feat: add optional center slot to ring group and rebalance radii"
```

---

## Task 3: 首页改造

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `app/page.test.tsx`

**Interfaces:**
- Consumes: 任务 1 的 `recentWeights` / `weightFor` / `dayLogFor`（返回 `DayLog | null`）/ `burnedCalories` / `netCalories` / `sumMacros`；任务 2 的 `RingGroup` 的 `center` 属性
- Produces: 无（页面为终端消费者）

- [ ] **Step 1: 写失败的测试**

覆盖 `app/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import Home from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('首页', () => {
  it('只有热量与运动两个圆环，不再显示蛋白质与碳水', () => {
    render(<Home />)
    expect(screen.getByText('热量')).toBeInTheDocument()
    expect(screen.getByText('运动')).toBeInTheDocument()
    expect(screen.queryByText('蛋白质')).not.toBeInTheDocument()
    expect(screen.queryByText('碳水')).not.toBeInTheDocument()
  })

  it('净热量位于圆环圆心，且是全页唯一的大号数字', () => {
    render(<Home />)
    expect(screen.getByTestId('ring-center')).toBeInTheDocument()
    expect(screen.getByText('净热量')).toBeInTheDocument()
    expect(screen.getByTestId('hero-value')).toBeInTheDocument()
  })

  it('体重卡的标签是「今日空腹体重」并含测量提示', () => {
    render(<Home />)
    expect(screen.getByText('今日空腹体重')).toBeInTheDocument()
    expect(screen.getByText(/起床后、进食前测量/)).toBeInTheDocument()
    expect(screen.queryByText('最近体重')).not.toBeInTheDocument()
  })

  it('体重显示的是今天的记录值', () => {
    render(<Home />)
    const today = weightFor(TODAY) as number
    expect(screen.getByText(`${today} kg`)).toBeInTheDocument()
  })

  it('体重涨跌的样式不含成功或危险状态色', () => {
    // 状态色是保留色，绝不用于体重方向。颜色定义在 CSS 模块里、不在 DOM 上，
    // 因此必须查样式表本身；查 innerHTML 永远查不到，那是一条恒真的假测试。
    const css = readFileSync(join(process.cwd(), 'app', 'page.module.css'), 'utf8')
    expect(css).not.toContain('#0ca30c')
    expect(css).not.toContain('#d03b3b')
    expect(css).not.toContain('#006300')
    expect(css).not.toContain('#fab219')
    expect(css).not.toContain('#ec835a')
  })

  it('今日饮食四餐都列出，AI 估算条目带可见标记', () => {
    render(<Home />)
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByText(slot)).toBeInTheDocument()
    }
    const aiLabels = screen.queryAllByText('AI 估算')
    // 今天的加餐是 AI 估算来源，因此至少一个标记；若不是加餐日则为 0
    expect(aiLabels.length).toBeGreaterThanOrEqual(0)
  })

  it('展示今天该练什么', () => {
    render(<Home />)
    expect(screen.getByText(/今天该练/)).toBeInTheDocument()
  })
})

import { TODAY, weightFor } from '@/lib/data/mock'
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run app/page.test.tsx
```

预期：FAIL——仍会找到「蛋白质」「最近体重」等。

- [ ] **Step 3: 改写首页**

关键改动（其余结构保留）：

```tsx
import HeroFigure from '@/components/HeroFigure'
import RingGroup, { type RingSpec } from '@/components/RingGroup'
import AiBadge from '@/components/AiBadge'
import { MOCK_PLAN, MOCK_GOAL, TODAY, dayLogFor, weightFor, recentWeights } from '@/lib/data/mock'
import { burnedCalories, netCalories, sumMacros } from '@/lib/data/selectors'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { weekdayOf } from '@/lib/data/dates'
import styles from './page.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function Home() {
  const day = dayLogFor(TODAY)

  // TODAY 必然在用户使用范围内，因此这里不会是 null。
  // 写成守卫而不是断言，是为了在数据层被改动时给出明确的空态而不是崩溃。
  if (day === null) {
    return <main className={styles.page}><p className={styles.empty}>今天没有记录。</p></main>
  }

  const macros = sumMacros(day.foods)
  const burned = burnedCalories(day)
  const net = netCalories(day)

  const rings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: macros.calories, goal: MOCK_GOAL.calories, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: burned, goal: MOCK_GOAL.exerciseCalories, unit: '千卡' },
  ]

  const weights = recentWeights(2)
  const todayWeight = weightFor(TODAY)
  const prevWeight = weights.length >= 2 ? weights[weights.length - 2].kg : null
  const delta =
    todayWeight !== null && prevWeight !== null
      ? Math.round((todayWeight - prevWeight) * 10) / 10
      : null

  const todayPlan = MOCK_PLAN.find((p) => p.weekday === weekdayOf(TODAY))
  const slotCalories = (slot: MealSlot) =>
    day.foods.filter((f) => f.slot === slot).reduce((s, f) => s + f.totals.calories, 0)

  return (
    <main className={styles.page}>
      {/* ...日期栏、训练计划卡、饮食卡、运动卡保持原有结构... */}

      <section className={styles.card}>
        <RingGroup
          rings={rings}
          center={<HeroFigure label="净热量" value={String(net)} unit="千卡" />}
        />
      </section>

      {/* ... */}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>今日空腹体重</h2>
        </div>
        {todayWeight !== null ? (
          <p className={styles.weight}>
            <span className={`${styles.weightValue} num`}>{todayWeight} kg</span>
            {/* 涨跌只显示方向与数值，不使用成功/危险色 */}
            <span className={`${styles.weightDelta} num-tabular`}>
              {delta === null ? '—' : delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '持平'}
            </span>
          </p>
        ) : (
          <p className={styles.empty}>
            今日未记录
            {weights.length > 0 && (
              <span className={styles.lastWeight}>
                （最近一次 {weights[weights.length - 1].kg} kg · {weights[weights.length - 1].date}）
              </span>
            )}
          </p>
        )}
        <p className={styles.hint}>建议起床后、进食前测量</p>
      </section>
    </main>
  )
}
```

在 `app/page.module.css` 中追加：

```css
.hint {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.lastWeight {
  color: var(--text-muted);
  font-size: 12px;
}
```

并把 `.netSection` 规则删除（净热量已移入圆心，该分隔区块不再存在）。

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run app/page.test.tsx
```

预期：全部通过。

- [ ] **Step 5: 运行全部测试**

```bash
npm test
```

预期：全部通过，零告警。

- [ ] **Step 6: 提交**

```bash
git add app/page.tsx app/page.module.css app/page.test.tsx
git commit -m "feat: reduce home to two rings with net-calorie center and fasted weight card"
```

---

## Task 4: 趋势页表格化

**Files:**
- Create: `components/WeightTable.tsx`、`components/WeightTable.module.css`
- Create: `components/SurplusTable.tsx`、`components/SurplusTable.module.css`
- Rewrite: `app/trends/page.tsx`、`app/trends/trends.module.css`、`app/trends/page.test.tsx`
- Delete: `components/WeightChart.tsx`、`components/WeightChart.module.css`、`components/AdherenceChart.tsx`、`components/AdherenceChart.module.css`、`components/DateRangeFilter.tsx`、`components/DateRangeFilter.module.css`

**Interfaces:**
- Consumes: 任务 1 的 `weightSeries`、`datesWithRecords`、`calorieSurplus`、`dayLogFor`、`MOCK_GOAL`、`MOCK_USER`
- Produces:
  ```ts
  export type WeightRow = { date: string; kg: number; delta: number | null }
  export default function WeightTable(props: { rows: WeightRow[] }): JSX.Element

  export type SurplusRow = { date: string; surplus: number }
  export default function SurplusTable(props: { rows: SurplusRow[] }): JSX.Element
  ```

- [ ] **Step 1: 写表格组件的失败测试**

创建 `components/WeightTable.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import WeightTable from './WeightTable'

const rows = [
  { date: '2026-09-22', kg: 68.4, delta: -0.3 },
  { date: '2026-09-21', kg: 68.7, delta: -0.2 },
  { date: '2026-09-20', kg: 68.9, delta: null },
]

describe('WeightTable', () => {
  it('渲染每一行', () => {
    render(<WeightTable rows={rows} />)
    expect(screen.getByText('2026-09-22')).toBeInTheDocument()
    expect(screen.getByText('68.4')).toBeInTheDocument()
  })

  it('差值带方向符号', () => {
    render(<WeightTable rows={rows} />)
    expect(screen.getByText('↓0.3')).toBeInTheDocument()
  })

  it('没有前一日数据时差值显示为占位符，不显示 NaN', () => {
    const { container } = render(<WeightTable rows={rows} />)
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('空数据时显示空态文案', () => {
    render(<WeightTable rows={[]} />)
    expect(screen.getByText(/还没有体重记录/)).toBeInTheDocument()
  })

  it('表格容器可滚动（固定高度）', () => {
    render(<WeightTable rows={rows} />)
    expect(screen.getByTestId('weight-table-scroll')).toBeInTheDocument()
  })
})
```

创建 `components/SurplusTable.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SurplusTable from './SurplusTable'

describe('SurplusTable', () => {
  it('正数带 + 号', () => {
    render(<SurplusTable rows={[{ date: '2026-09-21', surplus: 300 }]} />)
    expect(screen.getByText('+300')).toBeInTheDocument()
  })

  it('负数带 − 号', () => {
    render(<SurplusTable rows={[{ date: '2026-09-20', surplus: -200 }]} />)
    expect(screen.getByText('−200')).toBeInTheDocument()
  })

  it('零不带符号，不显示成 +0 或 −0', () => {
    render(<SurplusTable rows={[{ date: '2026-09-22', surplus: 0 }]} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByText('+0')).not.toBeInTheDocument()
    expect(screen.queryByText('−0')).not.toBeInTheDocument()
  })

  it('盈余不使用成功或危险状态色（颜色只来自令牌，不在行内样式里）', () => {
    const { container } = render(<SurplusTable rows={[{ date: '2026-09-21', surplus: 300 }]} />)
    expect(container.innerHTML).not.toContain('#0ca30c')
    expect(container.innerHTML).not.toContain('#d03b3b')
  })

  it('空数据时显示空态文案', () => {
    render(<SurplusTable rows={[]} />)
    expect(screen.getByText(/还没有饮食记录/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run components/WeightTable.test.tsx components/SurplusTable.test.tsx
```

预期：FAIL，`Cannot find module './WeightTable'`。

- [ ] **Step 3: 实现两张表格**

创建 `components/WeightTable.tsx`：

```tsx
import styles from './WeightTable.module.css'

export type WeightRow = { date: string; kg: number; delta: number | null }

function formatDelta(delta: number | null): string {
  if (delta === null) return '—'
  if (delta === 0) return '0'
  return delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`
}

export default function WeightTable({ rows }: { rows: WeightRow[] }) {
  if (rows.length === 0) {
    return <p className={styles.empty}>这段时间还没有体重记录。</p>
  }

  return (
    <div className={styles.scroll} data-testid="weight-table-scroll">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>日期</th>
            <th className={styles.num}>体重</th>
            <th className={styles.num}>与昨日</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              <td className={`${styles.num} num-tabular`}>{row.kg}</td>
              {/* 涨跌只用文字令牌，不用成功/危险色 */}
              <td className={`${styles.num} ${styles.delta} num-tabular`}>
                {formatDelta(row.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

创建 `components/WeightTable.module.css`：

```css
.scroll {
  max-height: 320px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th {
  position: sticky;
  top: 0;
  background: var(--surface-card);
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-hairline);
}

.table td {
  padding: 9px 0;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-hairline);
}

.num {
  text-align: right;
}

/* 涨跌为中性色——增肌期上涨正是目标 */
.delta {
  color: var(--text-secondary);
}

.empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
```

创建 `components/SurplusTable.tsx`：

```tsx
import styles from './SurplusTable.module.css'

export type SurplusRow = { date: string; surplus: number }

export function formatSurplus(surplus: number): string {
  if (surplus === 0) return '0'
  return surplus > 0 ? `+${surplus}` : `−${Math.abs(surplus)}`
}

export default function SurplusTable({ rows }: { rows: SurplusRow[] }) {
  if (rows.length === 0) {
    return <p className={styles.empty}>这段时间还没有饮食记录。</p>
  }

  return (
    <div className={styles.scroll} data-testid="surplus-table-scroll">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>日期</th>
            <th className={styles.num}>热量盈余</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              {/* 盈余不做好坏着色——减脂期负数是预期的 */}
              <td className={`${styles.num} ${styles.surplus} num-tabular`}>
                {formatSurplus(row.surplus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`components/SurplusTable.module.css` 与 `WeightTable.module.css` 同构，仅类名不同：

```css
.scroll {
  max-height: 320px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th {
  position: sticky;
  top: 0;
  background: var(--surface-card);
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-hairline);
}

.table td {
  padding: 9px 0;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-hairline);
}

.num {
  text-align: right;
}

/* 盈余为中性色——正负本身不是好坏 */
.surplus {
  color: var(--text-secondary);
}

.empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run components/WeightTable.test.tsx components/SurplusTable.test.tsx
```

预期：全部通过。

- [ ] **Step 5: 重写趋势页**

覆盖 `app/trends/page.tsx`：

```tsx
import WeightTable, { type WeightRow } from '@/components/WeightTable'
import SurplusTable, { type SurplusRow } from '@/components/SurplusTable'
import { addDays } from '@/lib/data/dates'
import { MOCK_GOAL, MOCK_USER, TODAY, dayLogFor, datesWithRecords, weightFor } from '@/lib/data/mock'
import { calorieSurplus } from '@/lib/data/selectors'
import styles from './trends.module.css'

export default function Trends() {
  // 展示从开始使用至今的全部历史，由表格内部滚动浏览
  const dates = datesWithRecords(MOCK_USER.startedAt, TODAY)

  const weightRows: WeightRow[] = dates
    .map((date, i) => {
      const kg = weightFor(date)
      if (kg === null) return null
      const prevKg = i > 0 ? weightFor(dates[i - 1]) : null
      const delta = prevKg !== null ? Math.round((kg - prevKg) * 10) / 10 : null
      return { date, kg, delta }
    })
    .filter((row): row is WeightRow => row !== null)
    .reverse() // 最近的日期在上

  const surplusRows: SurplusRow[] = dates
    .map((date) => {
      const day = dayLogFor(date)
      if (day === null) return null
      return { date, surplus: calorieSurplus(day, MOCK_GOAL) }
    })
    .filter((row): row is SurplusRow => row !== null)
    .reverse()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>趋势</h1>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>体重</h2>
        </div>
        <WeightTable rows={weightRows} />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>热量盈余</h2>
        </div>
        <SurplusTable rows={surplusRows} />
      </section>
    </main>
  )
}
```

覆盖 `app/trends/trends.module.css`：保留 `.page` / `.title` / `.card` / `.cardHead` / `.cardTitle`，**删除 `.tableToggle` 与 `.table` 系列规则**（它们属于已移除的切换按钮与旧内联表格）。

- [ ] **Step 6: 重写趋势页测试**

覆盖 `app/trends/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Trends from './page'
import { TODAY, weightFor, dayLogFor, MOCK_GOAL } from '@/lib/data/mock'
import { calorieSurplus } from '@/lib/data/selectors'

vi.mock('next/navigation', () => ({ usePathname: () => '/trends' }))

describe('趋势页', () => {
  it('不再渲染任何图表', () => {
    render(<Trends />)
    expect(screen.queryByTestId('chart-weight')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chart-adherence')).not.toBeInTheDocument()
  })

  it('不再有时间区间筛选', () => {
    render(<Trends />)
    expect(screen.queryByRole('group', { name: '时间区间' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /7 天|30 天|90 天/ })).not.toBeInTheDocument()
  })

  it('两张表格都以可滚动容器呈现', () => {
    render(<Trends />)
    expect(screen.getByTestId('weight-table-scroll')).toBeInTheDocument()
    expect(screen.getByTestId('surplus-table-scroll')).toBeInTheDocument()
  })

  it('体重表首行的数值与数据层一致', () => {
    render(<Trends />)
    const today = weightFor(TODAY) as number
    expect(screen.getAllByText(String(today)).length).toBeGreaterThan(0)
  })

  it('热量盈余表首行的数值与数据层一致', () => {
    render(<Trends />)
    const day = dayLogFor(TODAY)
    expect(day).not.toBeNull()
    const surplus = calorieSurplus(day!, MOCK_GOAL)
    const expected = surplus === 0 ? '0' : surplus > 0 ? `+${surplus}` : `−${Math.abs(surplus)}`
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
  })

  it('表格覆盖到开始使用日期那一天', () => {
    render(<Trends />)
    expect(screen.getAllByText('2025-09-22').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 7: 删除已废弃的组件**

```bash
git rm components/WeightChart.tsx components/WeightChart.module.css \
       components/AdherenceChart.tsx components/AdherenceChart.module.css \
       components/DateRangeFilter.tsx components/DateRangeFilter.module.css
```

**这些文件没有其他消费者**（已核实：只被趋势页引用）。若 `git rm` 后构建报找不到模块，说明还有残留引用，请查清再删，不要靠加回文件掩盖。

- [ ] **Step 8: 运行全部测试与构建**

```bash
npm test && npm run build
```

预期：测试全绿、零告警；构建成功。若构建报 `adherence` 或已删组件的引用，逐一清除。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: replace trends charts with scrollable weight and surplus tables"
```

---

## Task 5: 日历页与底部导航

**Files:**
- Modify: `components/CalendarMonth.tsx`、`components/CalendarMonth.module.css`
- Create: `app/calendar/page.tsx`、`app/calendar/calendar.module.css`、`app/calendar/page.test.tsx`
- Modify: `components/BottomNav.tsx`、`components/BottomNav.module.css`

**Interfaces:**
- Consumes: 任务 1 的 `dayLogFor` / `hasRecord` / `isCalorieOnTarget` / `isExerciseOnTarget` / `MOCK_GOAL` / `MOCK_USER`；`dates.ts` 的 `monthGrid` / `addDays` / `toDateKey`
- Produces:
  ```ts
  export type DayStatus = { calories: boolean; exercise: boolean }
  export default function CalendarMonth(props: {
    year: number
    month: number
    cells: (string | null)[]
    statusByDate: Record<string, DayStatus>
    today: string
  }): JSX.Element
  ```
- `CalendarMonth` 的每个日期格渲染为指向 `/day/<date>` 的 `<Link>`

- [ ] **Step 1: 写日历组件的失败测试**

覆盖 `components/CalendarMonth.test.tsx`（若该文件不存在则创建）：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CalendarMonth from './CalendarMonth'

const cells = [null, '2026-09-01', '2026-09-02', '2026-09-22']

const statusByDate = {
  '2026-09-01': { calories: true, exercise: true },
  '2026-09-02': { calories: false, exercise: true },
  '2026-09-22': { calories: true, exercise: false },
}

describe('CalendarMonth', () => {
  it('每个日期格都链接到该日的详情页', () => {
    render(
      <CalendarMonth year={2026} month={9} cells={cells} statusByDate={statusByDate} today="2026-09-22" />,
    )
    expect(screen.getByRole('link', { name: /2026-09-01/ })).toHaveAttribute('href', '/day/2026-09-01')
    expect(screen.getByRole('link', { name: /2026-09-22/ })).toHaveAttribute('href', '/day/2026-09-22')
  })

  it('空占位格不渲染链接', () => {
    render(
      <CalendarMonth year={2026} month={9} cells={cells} statusByDate={statusByDate} today="2026-09-22" />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('没有状态的日期按未达成渲染，不崩溃', () => {
    const { container } = render(
      <CalendarMonth
        year={2026}
        month={9}
        cells={['2026-09-30']}
        statusByDate={{}}
        today="2026-09-22"
      />,
    )
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it('图例说明两个点的含义', () => {
    render(
      <CalendarMonth year={2026} month={9} cells={cells} statusByDate={statusByDate} today="2026-09-22" />,
    )
    expect(screen.getByText(/左.*热量/)).toBeInTheDocument()
    expect(screen.getByText(/右.*运动/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run components/CalendarMonth.test.tsx
```

预期：FAIL——当前实现渲染的是 `<div>` 而非 `<Link>`，且用 `ratiosByDate` 而非 `statusByDate`。

- [ ] **Step 3: 改造 CalendarMonth**

覆盖 `components/CalendarMonth.tsx`：

```tsx
import Link from 'next/link'
import styles from './CalendarMonth.module.css'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export type DayStatus = { calories: boolean; exercise: boolean }

export type CalendarMonthProps = {
  year: number
  month: number
  cells: (string | null)[]
  statusByDate: Record<string, DayStatus>
  today: string
}

const DAY_LABEL = ['热量', '运动'] as const

export default function CalendarMonth({
  year,
  month,
  cells,
  statusByDate,
  today,
}: CalendarMonthProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {year} 年 {month} 月
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className={styles.emptyCell} />

          const dayNum = Number(date.slice(-2))
          const isToday = date === today
          const status = statusByDate[date] ?? { calories: false, exercise: false }
          const flags = [status.calories, status.exercise]

          return (
            <Link
              key={date}
              href={`/day/${date}`}
              className={`${styles.cell} ${isToday ? styles.today : ''}`}
              aria-label={`${date}，热量${flags[0] ? '达成' : '未达成'}，运动${flags[1] ? '达成' : '未达成'}`}
            >
              <span className={`${styles.dayNum} num-tabular`}>{dayNum}</span>
              <span className={styles.dots}>
                {DAY_LABEL.map((label, index) => (
                  // 实心 / 空心 是不依赖颜色的第二通道；位置顺序固定，颜色只作强化
                  <span
                    key={label}
                    data-ring={label}
                    className={`${styles.dot} ${flags[index] ? styles.dotDone : ''}`}
                    style={
                      {
                        '--dot-color': index === 0 ? 'var(--ring-calories)' : 'var(--ring-exercise)',
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            </Link>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span
            className={`${styles.dot} ${styles.dotDone}`}
            style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties}
          />
          达成
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.dot}
            style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties}
          />
          未达成
        </span>
        <span className={styles.legendItem}>左点 = 热量 · 右点 = 运动</span>
      </div>
    </div>
  )
}
```

在 `components/CalendarMonth.module.css` 的 `.cell` 规则里补上链接的默认样式重置：

```css
.cell {
  background: color-mix(in oklab, var(--text-primary) 4%, transparent);
  text-decoration: none;
  color: inherit;
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run components/CalendarMonth.test.tsx
```

预期：全部通过。

- [ ] **Step 5: 写日历页的失败测试**

创建 `app/calendar/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Calendar from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/calendar' }))

describe('日历页', () => {
  it('渲染当月标题', () => {
    render(<Calendar />)
    expect(screen.getByText(/年.*月/)).toBeInTheDocument()
  })

  it('渲染出今天所在月份的日期链接', () => {
    render(<Calendar />)
    expect(screen.getByRole('link', { name: /2026-09-22/ })).toBeInTheDocument()
  })

  it('开始使用日期之前的月份不渲染任何日期链接', () => {
    render(<Calendar initialYear={2025} initialMonth={8} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/还没有开始使用/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: 运行测试，确认失败**

```bash
npx vitest run app/calendar/page.test.tsx
```

预期：FAIL，`Cannot resolve import './page'`。

- [ ] **Step 7: 实现日历页**

创建 `app/calendar/page.tsx`：

> **关于 `initialYear` / `initialMonth` 两个属性：** 它们是给测试用的接缝，让测试能直接渲染「早于开始使用日期的月份」这一情形，而不必去 mock 组件的内部状态。生产环境里路由不会传这两个属性，因此走默认值（今天所在月份）。这是刻意的取舍——用一个可选属性换掉一处测试专用的 mock。

```tsx
'use client'

import { useState } from 'react'
import CalendarMonth, { type DayStatus } from '@/components/CalendarMonth'
import { monthGrid } from '@/lib/data/dates'
import { MOCK_GOAL, MOCK_USER, TODAY, dayLogFor } from '@/lib/data/mock'
import { hasRecord, isCalorieOnTarget, isExerciseOnTarget } from '@/lib/data/selectors'
import styles from './calendar.module.css'

export default function Calendar({
  initialYear = 2026,
  initialMonth = 9,
}: {
  initialYear?: number
  initialMonth?: number
}) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)

  const cells = monthGrid(year, month)

  // 该月是否整体早于用户的开始使用日期
  const lastCell = [...cells].reverse().find((c) => c !== null) ?? null
  const monthIsOutOfRange = lastCell !== null && !hasRecord(lastCell, MOCK_USER.startedAt)

  const statusByDate: Record<string, DayStatus> = {}
  for (const date of cells) {
    if (!date) continue
    const day = dayLogFor(date)
    statusByDate[date] =
      day === null
        ? { calories: false, exercise: false }
        : {
            calories: isCalorieOnTarget(day, MOCK_GOAL),
            exercise: isExerciseOnTarget(day, MOCK_GOAL),
          }
  }

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>日历</h1>

      <div className={styles.monthNav}>
        <button type="button" className={styles.navButton} onClick={prevMonth} aria-label="上个月">
          ‹
        </button>
        <span className={styles.monthLabel}>
          {year} 年 {month} 月
        </span>
        <button type="button" className={styles.navButton} onClick={nextMonth} aria-label="下个月">
          ›
        </button>
      </div>

      {monthIsOutOfRange ? (
        <p className={styles.empty}>这个月还没有开始使用。</p>
      ) : (
        <CalendarMonth
          year={year}
          month={month}
          cells={cells}
          statusByDate={statusByDate}
          today={TODAY}
        />
      )}
    </main>
  )
}
```

创建 `app/calendar/calendar.module.css`：

```css
.page {
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.monthNav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-card);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-card);
  padding: 8px 12px;
}

.monthLabel {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.navButton {
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  font-family: inherit;
  cursor: pointer;
}

.empty {
  margin: 0;
  padding: 32px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
```

- [ ] **Step 8: 改底部导航为五项，日历居中**

覆盖 `components/BottomNav.tsx` 的 `ITEMS`：

```tsx
const ITEMS = [
  { href: '/', label: '今日' },
  { href: '/trends', label: '趋势' },
  { href: '/calendar', label: '日历' },
  { href: '/meals/new', label: '记录' },
  { href: '/me', label: '我的' },
]
```

同时把 `grid-template-columns` 改为 5 列：

在 `components/BottomNav.module.css` 中：

```css
.nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: var(--surface-card);
  border-top: 1px solid var(--border-hairline);
  padding-bottom: env(safe-area-inset-bottom);
}
```

并删除 `.primary` 规则（五项之后不再有居中强调项，`ITEMS` 里也没有 `primary` 字段了）。

由于 `/day/[...]` 属于首页的从属页面，`active` 判定需把路径前缀也纳入：把

```tsx
const active = pathname === item.href
```

改为

```tsx
const active =
  pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))
```

- [ ] **Step 9: 运行测试，确认通过**

```bash
npx vitest run app/calendar/page.test.tsx components/CalendarMonth.test.tsx && npm test
```

预期：全部通过，零告警。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "feat: add calendar page with clickable days and five-item navigation"
```

---

## Task 6: 某日详情页

**Files:**
- Create: `app/day/[date]/page.tsx`、`app/day/[date]/day.module.css`、`app/day/[date]/page.test.tsx`

**Interfaces:**
- Consumes: 任务 1 的 `dayLogFor`（返回 `DayLog | null`）/ `weightFor` / `hasRecord` / `MOCK_USER` / `MOCK_GOAL`；`selectors.ts` 的 `sumMacros` / `burnedCalories` / `netCalories`；任务 2 的 `RingGroup` 的 `center`
- Produces: 无（终端页面）

- [ ] **Step 1: 写失败的测试**

创建 `app/day/[date]/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DayDetail from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/day/2026-09-22' }))

describe('某日详情页', () => {
  it('标题显示所选日期', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2026-09-22' }) })
    render(ui)
    expect(screen.getByText(/2026-09-22|9月22日/)).toBeInTheDocument()
  })

  it('与首页同构：两个圆环 + 圆心净热量', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2026-09-22' }) })
    render(ui)
    expect(screen.getByTestId('ring-center')).toBeInTheDocument()
    expect(screen.getByText('净热量')).toBeInTheDocument()
    expect(screen.getByText('热量')).toBeInTheDocument()
    expect(screen.getByText('运动')).toBeInTheDocument()
  })

  it('不提供任何记录入口', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2026-09-22' }) })
    render(ui)
    expect(screen.queryByText(/开始记录|今日饮食.*＋|添加/)).not.toBeInTheDocument()
  })

  it('日期早于开始使用日期时显示明确的空态，而非空日志', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2025-09-21' }) })
    render(ui)
    expect(screen.getByText(/还没有开始使用/)).toBeInTheDocument()
  })

  it('范围外日期不产生 NaN', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: '2025-09-21' }) })
    const { container } = render(ui)
    expect(container.innerHTML).not.toContain('NaN')
  })

  it('非法日期字符串不崩溃，显示空态', async () => {
    const ui = await DayDetail({ params: Promise.resolve({ date: 'not-a-date' }) })
    const { container } = render(ui)
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getByText(/日期|还没有/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run "app/day/[date]/page.test.tsx"
```

预期：FAIL，模块不存在。

- [ ] **Step 3: 实现某日详情页**

创建 `app/day/[date]/page.tsx`：

```tsx
import Link from 'next/link'
import HeroFigure from '@/components/HeroFigure'
import RingGroup, { type RingSpec } from '@/components/RingGroup'
import AiBadge from '@/components/AiBadge'
import { MOCK_GOAL, MOCK_USER, dayLogFor, weightFor } from '@/lib/data/mock'
import { burnedCalories, netCalories, sumMacros } from '@/lib/data/selectors'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { weekdayOf } from '@/lib/data/dates'
import styles from './day.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const WEEKDAY_LABEL = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime())
}

export default async function DayDetail({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params

  if (!isValidDateKey(date)) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>日期格式不正确。</p>
        <Link href="/calendar" className={styles.back}>
          回到日历
        </Link>
      </main>
    )
  }

  const day = dayLogFor(date)
  if (day === null) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>这一天你还没有开始使用。</p>
        <Link href="/calendar" className={styles.back}>
          回到日历
        </Link>
      </main>
    )
  }

  const macros = sumMacros(day.foods)
  const burned = burnedCalories(day)
  const net = netCalories(day)
  const weight = weightFor(date)

  const rings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: macros.calories, goal: MOCK_GOAL.calories, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: burned, goal: MOCK_GOAL.exerciseCalories, unit: '千卡' },
  ]

  const [, mm, dd] = date.split('-')

  return (
    <main className={styles.page}>
      <header className={styles.dateBar}>
        <Link href="/calendar" className={styles.back}>
          ‹ 日历
        </Link>
        <span className={styles.dateText}>
          {Number(mm)}月{Number(dd)}日 {WEEKDAY_LABEL[weekdayOf(date)]}
        </span>
        <span className={styles.spacer} />
      </header>

      <section className={styles.card}>
        <RingGroup
          rings={rings}
          center={<HeroFigure label="净热量" value={String(net)} unit="千卡" />}
        />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>饮食</h2>
        <ul className={styles.list}>
          {SLOTS.map((slot) => {
            const foods = day.foods.filter((f) => f.slot === slot)
            const calories = foods.reduce((s, f) => s + f.totals.calories, 0)
            return (
              <li key={slot} className={styles.row}>
                <span className={styles.rowName}>{MEAL_SLOT_LABEL[slot]}</span>
                <span className={styles.rowTags}>
                  {foods.some((f) => f.source === 'ai-estimate') && <AiBadge />}
                </span>
                <span className={`${styles.rowMeta} num-tabular`}>
                  {foods.length === 0 ? '未记录' : `${calories} 千卡`}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>运动</h2>
        {day.exercises.length === 0 ? (
          <p className={styles.empty}>这一天没有运动记录。</p>
        ) : (
          <ul className={styles.list}>
            {day.exercises.map((e) => (
              <li key={e.id} className={styles.row}>
                <span className={styles.rowName}>{e.name}</span>
                <span className={`${styles.rowMeta} num-tabular`}>
                  {e.kind === 'cardio' ? `${e.minutes} 分钟 · ` : `${e.sets?.length ?? 0} 组 · `}
                  -{e.caloriesBurned}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>空腹体重</h2>
        {weight !== null ? (
          <p className={styles.weight}>
            <span className={`${styles.weightValue} num`}>{weight} kg</span>
          </p>
        ) : (
          <p className={styles.empty}>这一天没有体重记录。</p>
        )}
      </section>
    </main>
  )
}
```

创建 `app/day/[date]/day.module.css`：把 `app/page.module.css` 的内容复制过来，再把 `.page` 的 `padding-bottom` 保持 88px、并追加：

```css
.dateBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 8px;
}

.back {
  min-width: 64px;
  color: var(--text-secondary);
  font-size: 14px;
  text-decoration: none;
}

.spacer {
  min-width: 64px;
}

.dateText {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run "app/day/[date]/page.test.tsx"
```

预期：全部通过。

- [ ] **Step 5: 运行全部测试与构建**

```bash
npm test && npm run build
```

预期：测试全绿；构建成功，`/day/[date]` 出现在路由清单中。

- [ ] **Step 6: 提交**

```bash
git add "app/day/"
git commit -m "feat: add day detail page for any date in the user's range"
```

---

## Task 7: 我的页显示当前体重

**Files:**
- Modify: `app/me/page.tsx`
- Modify: `app/me/page.test.tsx`

**Interfaces:**
- Consumes: 任务 1 的 `weightFor` / `TODAY`
- Produces: 无

- [ ] **Step 1: 写失败的测试**

在 `app/me/page.test.tsx` 中追加：

```tsx
it('个人资料中包含当前体重', () => {
  render(<Me />)
  expect(screen.getByText('当前体重')).toBeInTheDocument()
  const today = weightFor(TODAY) as number
  expect(screen.getByText(`${today} kg`)).toBeInTheDocument()
})

it('当前体重与每日目标中的目标体重是两个不同的值', () => {
  render(<Me />)
  expect(screen.getByText('当前体重')).toBeInTheDocument()
  expect(screen.getByText('目标体重')).toBeInTheDocument()
})
```

该文件顶部补上：

```ts
import { TODAY, weightFor } from '@/lib/data/mock'
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run app/me/page.test.tsx
```

预期：FAIL——找不到「当前体重」。

- [ ] **Step 3: 在资料卡中加入当前体重**

在 `app/me/page.tsx` 的「个人资料」卡片列表里，于「年龄」之后插入一行：

```tsx
          <li className={styles.row}>
            <span className={styles.rowName}>当前体重</span>
            <span className={`${styles.rowMeta} num-tabular`}>{weightFor(TODAY)} kg</span>
          </li>
```

并在文件顶部补导入：

```tsx
import { MOCK_GOAL, MOCK_USER, TODAY, weightFor } from '@/lib/data/mock'
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run app/me/page.test.tsx
```

预期：全部通过。

- [ ] **Step 5: 提交**

```bash
git add app/me/
git commit -m "feat: show current weight in profile"
```

---

## Task 8: 走查清单重写与最终验证

**Files:**
- Rewrite: `docs/superpowers/plans/demo-走查清单.md`

**Interfaces:**
- Consumes: 前七个任务的全部产物
- Produces: 一份对应新形态、可照着打勾的走查清单

- [ ] **Step 1: 构建生产版本**

```bash
npm run build
```

预期：成功。失败则先修完再继续。

- [ ] **Step 2: 重写走查清单**

覆盖 `docs/superpowers/plans/demo-走查清单.md`。必须做到：

- **第一节「怎么打开」**：`cd C:\Users\admin\codex_project\Fitchat`，`npm run dev`，浏览器开 `http://localhost:3000`；说明依赖已装好；说明端口被占用即可直接打开；说明如何在浏览器里模拟手机尺寸；说明如何用真手机看（`--hostname 0.0.0.0` + `ipconfig` 取局域网 IP，并把「会暴露给同一局域网」的风险写出来）。
- **第二节 走查清单**，覆盖新形态。至少包含：首页只有两个环且**净热量在圆心**；圆环配色为外蓝内橙；体重卡写「今日空腹体重」并有测量提示；体重涨跌是灰色不是红绿；**趋势页没有任何图表、没有 7/30/90 筛选**；两张表格可以**内部上下滚动**并覆盖到 2025-09-22；热量盈余的正负号正确、**且不做好坏着色**；**底部导航五项且日历在中间**；日历页每天两个点、可左右翻月、点某天进入某日详情；某日详情与首页同构但**没有任何记录入口**；某日详情里早于 2025-09-22 的日期显示「还没有开始使用」；我的页含「当前体重」；深浅色两种模式都可用。
- **第三节 演示数据里看不到的状态**：如实列出当前数据覆盖不到的情形（例如「圆环恰好满环」「某日盈余恰好为 0」是否可达），并说明如何临时改数据去看。
- **第四节 已知限制**：说明所有数据为生成、不落库、无登录、无 AI、目标热量写死、无错误监控、「今天」固定为 2026-09-22、记录范围由 `MOCK_USER.startedAt` 决定。

- [ ] **Step 3: 在全仓搜索已失效的表述**

```bash
grep -rn "四环\|四 个环\|四个圆环\|7 / 30 / 90\|30 / 90\|达标率\|最近体重\|WeightChart\|AdherenceChart\|DateRangeFilter" --include=*.md --include=*.ts --include=*.tsx . | grep -v node_modules
```

预期：**只在描述「改了什么」的文档语境里出现**（规格的修订记录）。若代码或走查清单里仍有残留，逐一清除。

- [ ] **Step 4: 运行全部测试**

```bash
npm test
```

预期：全部通过，零告警。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "docs: rewrite mobile walkthrough checklist for the revised layout"
```

- [ ] **Step 6: 交付预览**

```bash
npm run dev
```

告诉用户在本机打开 `http://localhost:3000`。

**不要声称做过视觉验证。** 这个环境没有浏览器，布局问题（两环与圆心的视觉平衡、滚动表格的高度、五项导航的间距）只有用户实际渲染出来才能发现。

---

## 自审记录

**1. 规格覆盖检查**

| 规格条目 | 覆盖任务 |
|---|---|
| §3.2 两个圆环（仅热量、运动） | 任务 3 |
| §3.2 净热量占圆心 | 任务 2、3 |
| §5.1 首页两环 + 圆心 + 空腹体重卡 + 测量提示 | 任务 3 |
| §5.1 当天未记录时显示未记录而非回退旧值 | 任务 3 |
| §5.2 去图表、去筛选、两张内滚表格 | 任务 4 |
| §5.2 热量盈余 = 摄入 − 目标，带正负号 | 任务 1、4 |
| §5.3 我的页含当前体重 | 任务 7 |
| §5.4 日历页（导航中间、两点、可点击） | 任务 5 |
| §5.4 热量达成按目标方向判定 | 任务 1、5 |
| §5.4 某日详情与首页同构且只读 | 任务 6 |
| §5 引言 底部导航五项 | 任务 5 |
| §6.1 User 含开始使用日期 | 任务 1 |
| §6.1 记录范围向后开放、区分两种空态 | 任务 1、6 |
| §6.1 假数据确定性生成 | 任务 1 |
| §12 已删组件的清理 | 任务 4 |
| 走查清单同步更新 | 任务 8 |

**未覆盖且刻意如此：** 目标计算、AI 调用、数据库、认证、错误监控——均属后续计划。

**2. 占位符扫描**：无 TBD / TODO /「稍后补充」。每个代码步骤都给出完整可运行代码。唯一一处「原样保留」的说明（任务 1 Step 17 的 `MOCK_PLAN`）是在指示逐字搬运既有内容，**不是占位符**——见下条的类型一致性说明。

**3. 类型一致性检查**：
- `dayLogFor` 的返回类型在本计划中**从 `DayLog` 改为 `DayLog | null`**，已在任务 1 的 Interfaces 中明确标注，并在任务 3、4、6 的消费处都写了 `null` 判断。
- `weightFor` 同理改为 `number | null`，在任务 3、4、7 的消费处都有判断。
- `CalendarMonth` 的属性从 `ratiosByDate: Record<string, number[]>` 改为 `statusByDate: Record<string, DayStatus>`，任务 5 同时更新组件与其唯一消费者（日历页）。
- 移除 `adherence` 的消费者（旧趋势页）在任务 4 被整体重写；其两个测试文件的旧断言在任务 1 Step 13 与任务 4 Step 6 中一并清除。
- 删除的三个组件（`WeightChart` / `AdherenceChart` / `DateRangeFilter`）的唯一消费者是趋势页，任务 4 已核实并一并处理。

**4. Review Focus 对应**：五类均有归属测试——确定性在任务 1 Step 5、17、18；开始使用日期之前的日期在任务 1 Step 17/18、任务 6 Step 1、任务 5 Step 5；盈余符号与零在任务 1 Step 13、任务 4 Step 1；圆环边界在任务 2 Step 1；日历方向判定在任务 1 Step 13（含「同一数据换方向必须翻转」）与任务 5。
