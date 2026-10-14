import { describe, expect, it } from 'vitest'
import { type FoodOption, parseMealSentence } from './meal-parser'
import { PANTRY } from './pantry'

/**
 * 解析器是纯函数，所以这里可以把它当规格来写：句子里说了什么，
 * 就应该拆出什么，不多不少。
 */

/** 把 pantry 当成食物库，id 用名字代替——测试里不需要真实 id */
const FOODS: FoodOption[] = [
  ...PANTRY.map((food) => ({
    id: food.name,
    name: food.name,
    perGrams: 100,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  })),
  // 一个「套餐」名，用来验证长名字优先
  { id: 'set', name: '鸡胸肉盖饭', perGrams: 100, calories: 620, protein: 42, carbs: 70, fat: 14 },
]

function names(result: ReturnType<typeof parseMealSentence>): string[] {
  return result.items.map((item) => `${item.name} ${item.grams}g`)
}

describe('一句话拆食物', () => {
  it('「两个鸡蛋一碗米饭」→ 100 克鸡蛋 + 200 克米饭', () => {
    const result = parseMealSentence('中午吃了两个鸡蛋一碗米饭', FOODS)
    expect(names(result)).toEqual(['鸡蛋 100g', '米饭 200g'])
    expect(result.slotHint).toBe('lunch')
    expect(result.unrecognized).toEqual([])
  })

  it('热量按克数换算，而不是把 100 克的数值直接抄下来', () => {
    const result = parseMealSentence('一个鸡蛋', FOODS)
    // 鸡蛋每 100 克 144 千卡，一个按 50 克算 → 72
    expect(result.items[0]).toMatchObject({ name: '鸡蛋', grams: 50, calories: 72 })
  })

  it('写「克」时按克算，不做份量换算', () => {
    const result = parseMealSentence('200克米饭', FOODS)
    expect(names(result)).toEqual(['米饭 200g'])
    const half = parseMealSentence('50 克燕麦', FOODS)
    expect(half.items[0]).toMatchObject({ name: '燕麦', grams: 50 })
  })

  it('没写份量时按一份算，并把克数显式给出来', () => {
    const result = parseMealSentence('吃了点鸡胸肉', FOODS)
    expect(names(result)).toEqual(['鸡胸肉 100g'])
  })

  it('长名字优先：鸡胸肉盖饭不会被拆成鸡胸肉', () => {
    const result = parseMealSentence('一份鸡胸肉盖饭', FOODS)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('鸡胸肉盖饭')
  })

  it('认不出的部分原样退回，而不是猜一个食物', () => {
    const result = parseMealSentence('中午吃了两个鸡蛋和一份佛跳墙', FOODS)
    expect(names(result)).toEqual(['鸡蛋 100g'])
    expect(result.unrecognized).toEqual(['一份佛跳墙'])
  })

  it('一句里什么都没有时给出空结果，而不是编一条出来', () => {
    const result = parseMealSentence('今天心情不错', FOODS)
    expect(result.items).toEqual([])
    expect(result.unrecognized).toEqual(['今天心情不错'])
    expect(result.slotHint).toBeNull()
  })

  it('同一句话永远得到同样的结果（可复现，演示时不会翻车）', () => {
    const once = parseMealSentence('早饭两个鸡蛋一杯牛奶', FOODS)
    const twice = parseMealSentence('早饭两个鸡蛋一杯牛奶', FOODS)
    expect(once).toEqual(twice)
    expect(once.slotHint).toBe('breakfast')
    expect(names(once)).toEqual(['鸡蛋 100g', '牛奶 250g'])
  })

  it('餐次从句子里认出来；认不出时返回 null，由界面上的选择决定', () => {
    expect(parseMealSentence('晚上吃了玉米', FOODS).slotHint).toBe('dinner')
    expect(parseMealSentence('来点酸奶', FOODS).slotHint).toBeNull()
  })

  it('没有模型参与，所以拆出来的条目没有一条是「AI 估算」', () => {
    const result = parseMealSentence('两个鸡蛋一碗米饭一杯酸奶', FOODS)
    expect(result.items.length).toBe(3)
    expect(result.items.every((item) => item.source === 'curated')).toBe(true)
  })
})
