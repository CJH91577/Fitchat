import { lastNDays } from './dates'
import type {
  DayLog,
  FoodEntry,
  PlanDay,
  UserGoal,
  WeightEntry,
} from './types'

export const TODAY = '2026-09-22'

export const MOCK_USER = {
  name: '演示用户',
  heightCm: 175,
  age: 30,
  sex: 'male' as const,
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
  {
    weekday: 1,
    theme: '背 + 二头',
    items: [
      { name: '引体向上', sets: 4, reps: '力竭' },
      { name: '杠铃划船', sets: 4, reps: '10' },
      { name: '哑铃弯举', sets: 3, reps: '12' },
    ],
  },
  {
    weekday: 2,
    theme: '胸 + 三头',
    items: [
      { name: '卧推', sets: 4, reps: '8–10' },
      { name: '上斜哑铃卧推', sets: 3, reps: '12' },
      { name: '绳索下压', sets: 3, reps: '15' },
    ],
  },
  {
    weekday: 3,
    theme: '腿',
    items: [
      { name: '深蹲', sets: 5, reps: '5' },
      { name: '罗马尼亚硬拉', sets: 3, reps: '10' },
    ],
  },
  { weekday: 4, theme: '休息', items: [] },
  {
    weekday: 5,
    theme: '肩 + 核心',
    items: [
      { name: '推举', sets: 4, reps: '8' },
      { name: '侧平举', sets: 4, reps: '15' },
    ],
  },
  { weekday: 6, theme: '有氧', items: [{ name: '慢跑', sets: 1, reps: '40 分钟' }] },
  { weekday: 7, theme: '休息', items: [] },
]

function entry(id: string, slot: FoodEntry['slot'], name: string, calories: number, protein: number, carbs: number, fat: number, source: FoodEntry['source'] = 'curated'): FoodEntry {
  return {
    id,
    slot,
    name,
    grams: 100,
    source,
    totals: { calories, protein, carbs, fat },
  }
}

// 今天：摄入略低于目标，含一条 AI 估算和一次力量训练
const today: DayLog = {
  date: TODAY,
  foods: [
    entry('t1', 'breakfast', '燕麦牛奶', 380, 18, 55, 9),
    entry('t2', 'lunch', '鸡胸肉盖饭', 620, 42, 70, 14),
    entry('t3', 'dinner', '清炒时蔬 + 米饭', 420, 12, 68, 8),
    entry('t4', 'snack', '红烧肉（AI 估算）', 180, 8, 4, 14, 'ai-estimate'),
  ],
  exercises: [
    {
      id: 'tx1',
      kind: 'strength',
      name: '卧推',
      sets: [
        { reps: 10, weightKg: 60 },
        { reps: 9, weightKg: 65 },
        { reps: 8, weightKg: 65 },
      ],
      caloriesBurned: 180,
    },
    {
      id: 'tx2',
      kind: 'cardio',
      name: '慢跑',
      minutes: 30,
      caloriesBurned: 300,
    },
  ],
}

// 昨天：超出目标，用于验证「超出」提示
const yesterday: DayLog = {
  date: '2026-09-21',
  foods: [
    entry('y1', 'breakfast', '豆浆油条', 520, 14, 62, 24, 'open-data'),
    entry('y2', 'lunch', '火锅', 1100, 55, 70, 65, 'ai-estimate'),
    entry('y3', 'dinner', '面条', 480, 16, 80, 8),
  ],
  exercises: [],
}

// 前天：完全空记录，用于验证空状态
const emptyDay: DayLog = { date: '2026-09-20', foods: [], exercises: [] }

const older: DayLog = {
  date: '2026-09-19',
  foods: [entry('o1', 'lunch', '牛肉饭', 700, 38, 82, 18)],
  exercises: [
    { id: 'ox1', kind: 'strength', name: '深蹲', sets: [{ reps: 5, weightKg: 100 }], caloriesBurned: 220 },
  ],
}

export const MOCK_DAYS: Record<string, DayLog> = {
  [today.date]: today,
  [yesterday.date]: yesterday,
  [emptyDay.date]: emptyDay,
  [older.date]: older,
}

// 覆盖 90 天的体重序列（带噪点，不是直线），以及最近 30 天的达标记录
export const MOCK_WEIGHTS: WeightEntry[] = lastNDays(TODAY, 90).map((date, i) => ({
  date,
  kg: Number((72.4 - i * 0.06 + Math.sin(i * 1.7) * 0.35).toFixed(1)),
}))

export function dayLogFor(date: string): DayLog {
  return MOCK_DAYS[date] ?? { date, foods: [], exercises: [] }
}

export function weightFor(date: string): number | undefined {
  return MOCK_WEIGHTS.find((w) => w.date === date)?.kg
}
