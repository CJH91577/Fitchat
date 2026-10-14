import { DEFAULT_PORTION_GRAMS, PORTION_GRAMS } from './pantry'
import type { FoodSource, MealSlot } from './types'

/**
 * 把一句话拆成待确认的食物条目。
 *
 * **这不是模型，是一张词表加一套量词换算**，所以：
 *
 *   - 它只认词表里有的食物，认不出的部分原样退回给用户，绝不猜一个不存在的食物；
 *   - 份量永远显式给出来（「两个鸡蛋」→ 100 克），用户在保存前可以改；
 *   - 结果里没有「AI 估算」条目——既然没有模型参与，就不该盖那个章。
 *
 * 这样写的好处不只是诚实：它完全确定，同一句话永远拆出同样的结果，
 * 于是可以写测试，也不会有「演示时换一句话就崩」的风险。
 */

export type FoodOption = {
  id: string
  name: string
  /** 上面那组营养值对应的克数 */
  perGrams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type ParsedItem = {
  foodId: string | null
  name: string
  grams: number
  source: FoodSource
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type ParseResult = {
  items: ParsedItem[]
  /** 句子里没认出来的片段，原样回给用户 */
  unrecognized: string[]
  /** 句子里提到的餐次；没说就是 null */
  slotHint: MealSlot | null
}

// 长的排前面：`毫升` 要赢过单独的字，`小碗` 要赢过 `碗`
const UNITS = [
  '毫升', '小碗', '个', '只', '根', '片', '块', '杯', '盒', '袋', '罐', '瓶', '碗', '份', '勺', '把', '克', 'g',
]

const UNIT_PATTERN = `(?:${UNITS.join('|')})`

// 数量词：阿拉伯数字、十X、X十、X十Y、单个汉字数字（含「两」「半」）
const QUANTITY_PATTERN = '(?:十[一二三四五六七八九]|[二三四五六七八九]十[一二三四五六七八九]?|[0-9]+(?:\\.[0-9]+)?|[一二两三四五六七八九十半])'

const TAIL_WITH_UNIT = new RegExp(`(${QUANTITY_PATTERN})\\s*(${UNIT_PATTERN})$`)
const TAIL_BARE = new RegExp(`(${QUANTITY_PATTERN})$`)

const CN_DIGITS: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 半: 0.5,
}

/** 「中午」「早饭」这类词到餐次的映射，取句子里最靠前的一个 */
const SLOT_HINTS: [string, MealSlot][] = [
  ['早餐', 'breakfast'],
  ['早饭', 'breakfast'],
  ['早上', 'breakfast'],
  ['午餐', 'lunch'],
  ['午饭', 'lunch'],
  ['中午', 'lunch'],
  ['晚餐', 'dinner'],
  ['晚饭', 'dinner'],
  ['晚上', 'dinner'],
  ['加餐', 'snack'],
  ['夜宵', 'snack'],
  ['下午茶', 'snack'],
]

/** 子句分隔符：用来指出「哪一段没认出来」 */
const CLAUSE_SPLIT = /[，,、。；;！!？?\s]+|和|与|跟|还有|另外|外加/

/** 只由餐次、时间与语气词组成的片段不算「没认出来」——报出来只会让人困惑 */
const FILLER_ONLY = /^[早晚中下午餐饭点吃喝了加上我你他昨天今天明天号是有在的跟和与，、。！？,.]*$/

function quantityValue(token: string): number {
  if (/^[0-9]/.test(token)) return Number(token)
  if (token === '十') return 10
  if (token.startsWith('十')) return 10 + (CN_DIGITS[token[1]] ?? 0)

  const tens = /^([二三四五六七八九])十([一二三四五六七八九])?$/.exec(token)
  if (tens) return CN_DIGITS[tens[1]] * 10 + (tens[2] ? CN_DIGITS[tens[2]] : 0)

  return CN_DIGITS[token] ?? 1
}

/**
 * 份量换算。
 *
 * 「克」「毫升」「g」是绝对单位；别的单位查 PORTION_GRAMS（「一个鸡蛋 = 50 克」）；
 * 没写进那张表的食物按一份 100 克。兜底值会原样出现在确认页上，用户看得见也改得动。
 */
function gramsFor(name: string, unit: string | null, quantity: number): number {
  if (unit === '克' || unit === 'g' || unit === '毫升') return Math.round(quantity)
  const perUnit = unit === null ? undefined : PORTION_GRAMS[name]?.[unit]
  return Math.round(quantity * (perUnit ?? DEFAULT_PORTION_GRAMS))
}

function scale(food: FoodOption, grams: number) {
  const ratio = grams / food.perGrams
  const round1 = (value: number) => Math.round(value * 10) / 10
  return {
    calories: Math.round(food.calories * ratio),
    protein: round1(food.protein * ratio),
    carbs: round1(food.carbs * ratio),
    fat: round1(food.fat * ratio),
  }
}

/**
 * 按克数算这一条的营养值。
 *
 * 导出是给界面用的：用户在确认页改克数时要立刻看到热量跟着变，而**保存时
 * 服务端会拿同一个函数再算一遍**——客户端传上来的数字一律不被信任。
 */
export function nutritionFor(food: FoodOption, grams: number) {
  return scale(food, grams)
}

/** 往前找份量：返回数量、单位，以及这段份量从哪里开始（好把它从「没认出来」里排除） */
function quantityBefore(text: string, at: number): { quantity: number; unit: string | null; start: number } {
  // 只看食物名前面的一小段：隔着八个字以上的数字与这顿饭无关
  const from = Math.max(0, at - 8)
  const before = text.slice(from, at)

  const withUnit = TAIL_WITH_UNIT.exec(before)
  if (withUnit) {
    return {
      quantity: quantityValue(withUnit[1]),
      unit: withUnit[2],
      start: at - withUnit[0].length,
    }
  }

  const bare = TAIL_BARE.exec(before)
  if (bare) return { quantity: quantityValue(bare[1]), unit: null, start: at - bare[0].length }

  return { quantity: 1, unit: null, start: at }
}

export function parseMealSentence(sentence: string, foods: FoodOption[]): ParseResult {
  const text = sentence.trim()

  let slotHint: MealSlot | null = null
  let hintAt = Number.POSITIVE_INFINITY
  for (const [word, slot] of SLOT_HINTS) {
    const at = text.indexOf(word)
    if (at !== -1 && at < hintAt) {
      hintAt = at
      slotHint = slot
    }
  }

  // 长的名字优先：「鸡胸肉盖饭」要赢过「鸡胸肉」
  const catalogue = [...foods].sort((a, b) => b.name.length - a.name.length)

  const items: ParsedItem[] = []

  for (let i = 0; i < text.length; i += 1) {
    const food = catalogue.find((candidate) => text.startsWith(candidate.name, i))
    if (!food) continue

    // 份量写在食物**前面**：「两个鸡蛋」「一碗米饭」「200 克米饭」。
    // 「鸡蛋两个」这种说法不认——它会落进「没认出来」列给用户看，
    // 而不是被静默记成 100 克。
    const { quantity, unit } = quantityBefore(text, i)
    const grams = gramsFor(food.name, unit, quantity)

    items.push({
      foodId: food.id,
      name: food.name,
      grams,
      source: 'curated',
      ...scale(food, grams),
    })

    i += food.name.length - 1
  }

  const unrecognized = text
    .split(CLAUSE_SPLIT)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== '')
    .filter((clause) => !catalogue.some((food) => clause.includes(food.name)))
    .filter((clause) => !FILLER_ONLY.test(clause))

  return { items, unrecognized, slotHint }
}
