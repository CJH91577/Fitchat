import { describe, it, expect } from 'vitest'
import { sumMacros, netCalories, adherence, emptyMacros } from './selectors'
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

const goal: UserGoal = {
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

describe('adherence', () => {
  it('恰好达标为 1', () => {
    const day: DayLog = { date: '2026-09-22', foods: [food(1800)], exercises: [] }
    expect(adherence(day, goal)).toBe(1)
  })

  it('超出目标不超过 1', () => {
    const day: DayLog = { date: '2026-09-22', foods: [food(2400)], exercises: [] }
    expect(adherence(day, goal)).toBe(1)
  })

  it('目标为 0 时返回 0，不产生除零', () => {
    const zeroGoal: UserGoal = { ...goal, calories: 0 }
    const day: DayLog = { date: '2026-09-22', foods: [food(500)], exercises: [] }
    expect(adherence(day, zeroGoal)).toBe(0)
  })

  it('没有任何记录时为 0', () => {
    expect(adherence({ date: '2026-09-22', foods: [], exercises: [] }, goal)).toBe(0)
  })
})
