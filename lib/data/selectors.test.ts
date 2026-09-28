import { describe, it, expect } from 'vitest'
import {
  sumMacros,
  netCalories,
  emptyMacros,
  calorieSurplus,
  isCalorieOnTarget,
  isExerciseOnTarget,
  isInRange,
} from './selectors'
import type { DayLog, FoodEntry, UserGoal } from './types'

function food(calories: number, protein = 0, carbs = 0, fat = 0): FoodEntry {
  return {
    id: `f${calories}`,
    slot: 'lunch',
    name: '测试食物',
    grams: 100,
    source: 'curated',
    totals: { calories, protein, carbs, fat },
  }
}

const baseGoal: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}

describe('emptyMacros', () => {
  it('全为 0', () => {
    expect(emptyMacros()).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe('sumMacros', () => {
  it('空数组返回全 0，不返回 NaN', () => {
    expect(sumMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('逐项求和', () => {
    const total = sumMacros([food(380, 20, 40, 10), food(620, 30, 60, 20)])
    expect(total).toEqual({ calories: 1000, protein: 50, carbs: 100, fat: 30 })
  })
})

describe('netCalories', () => {
  it('净热量 = 摄入 − 运动消耗', () => {
    const day: DayLog = {
      date: '2026-09-22',
      foods: [food(1420)],
      exercises: [
        {
          id: 'e1',
          kind: 'cardio',
          name: '跑步',
          minutes: 30,
          caloriesBurned: 380,
        },
      ],
    }
    expect(netCalories(day)).toBe(1040)
  })

  it('无记录时为 0', () => {
    expect(netCalories({ date: '2026-09-22', foods: [], exercises: [] })).toBe(0)
  })
})

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

describe('isInRange', () => {
  it('早于开始使用日期为 false', () => {
    expect(isInRange('2025-09-21', '2025-09-22')).toBe(false)
  })

  it('开始使用当天及以后为 true', () => {
    expect(isInRange('2025-09-22', '2025-09-22')).toBe(true)
    expect(isInRange('2026-09-22', '2025-09-22')).toBe(true)
  })
})
