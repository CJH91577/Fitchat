export type GoalDirection = 'cut' | 'bulk' | 'maintain'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FoodSource = 'open-data' | 'curated' | 'user' | 'ai-estimate'

export type MacroTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type FoodEntry = {
  id: string
  slot: MealSlot
  name: string
  grams: number
  source: FoodSource
  totals: MacroTotals
}

export type StrengthSet = {
  reps: number
  weightKg: number
}

export type ExerciseEntry = {
  id: string
  kind: 'cardio' | 'strength'
  name: string
  minutes?: number
  sets?: StrengthSet[]
  caloriesBurned: number
}

export type WeightEntry = {
  date: string
  kg: number
}

export type PlanItem = {
  name: string
  sets: number
  reps: string
}

export type PlanDay = {
  weekday: number
  theme: string
  items: PlanItem[]
}

export type DayLog = {
  date: string
  foods: FoodEntry[]
  exercises: ExerciseEntry[]
}

export type UserGoal = {
  direction: GoalDirection
  calories: number
  protein: number
  carbs: number
  fat: number
  exerciseCalories: number
  targetWeightKg: number
}

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}
