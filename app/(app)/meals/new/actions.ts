'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/current-user'
import { nutritionFor } from '@/lib/data/meal-parser'
import { today } from '@/lib/data/today'
import type { MealSlot } from '@/lib/data/types'
import { foodsByIds } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import { addFoodEntries, deleteFoodEntry } from '@/lib/db/writes'
import type { DeleteState, SaveState } from './types'

/**
 * 记录饮食的写入路径。
 *
 * 一条规矩贯穿这两个动作：**客户端传上来的数字一个都不信**。表单里只有食物 id
 * 与用户填的克数，营养值由服务端拿食物库重算——就算有人改过那份 JSON，
 * 也改不了自己记录里的热量。
 */

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** 一次最多记这么多条：挡住「把整张食物库塞进来」的请求 */
const MAX_ITEMS = 20

/** 单条克数的合理范围，防住 0 与一亿克 */
const MAX_GRAMS = 5000

type SubmittedItem = { foodId: string; grams: number }

function readItems(raw: string): SubmittedItem[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_ITEMS) return null

  const items: SubmittedItem[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) return null
    const foodId = (entry as { foodId?: unknown }).foodId
    const grams = (entry as { grams?: unknown }).grams
    if (typeof foodId !== 'string' || foodId === '') return null
    if (typeof grams !== 'number' || !Number.isFinite(grams)) return null
    if (grams <= 0 || grams > MAX_GRAMS) return null
    items.push({ foodId, grams: Math.round(grams) })
  }
  return items
}

export async function saveMealAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const db = getDb()
  const user = await requireUser(db)

  const slot = String(formData.get('slot') ?? '')
  if (!SLOTS.includes(slot as MealSlot)) return { error: '请先选择记到哪一餐。' }

  const items = readItems(String(formData.get('items') ?? ''))
  if (items === null) return { error: '没有可保存的条目，或者条目数据不完整。' }

  const foods = await foodsByIds(
    db,
    items.map((item) => item.foodId),
  )
  const byId = new Map(foods.map((food) => [food.id, food]))

  // 食物库被改过（那一行没了），或者请求是手写的——两种情况都不该静默存下
  if (items.some((item) => !byId.has(item.foodId))) {
    return { error: '有食物已经不在食物库里了，请重新选择。' }
  }

  await addFoodEntries(
    db,
    user.id,
    today(),
    slot as MealSlot,
    items.map((item) => {
      const food = byId.get(item.foodId) as (typeof foods)[number]
      return {
        foodId: food.id,
        name: food.name,
        grams: item.grams,
        // 种子食物库里的东西标成 curated，用户自己加的标成 user
        source: food.id.startsWith('food-') ? ('curated' as const) : ('user' as const),
        ...nutritionFor(
          {
            id: food.id,
            name: food.name,
            perGrams: food.perGrams,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
          },
          item.grams,
        ),
      }
    }),
    new Date(),
  )

  // 首页、趋势、日历读的是同一份数据，写完先让它们的缓存作废，
  // 再跳回首页——用户在那里看到自己刚记的这顿饭
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function deleteMealEntryAction(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const db = getDb()
  const user = await requireUser(db)

  const entryId = String(formData.get('entryId') ?? '')
  if (entryId === '') return { error: '没有指定要删除的记录。', removedAt: 0 }

  const removed = await deleteFoodEntry(db, user.id, entryId)
  revalidatePath('/', 'layout')

  return removed
    ? { error: null, removedAt: Date.now() }
    : { error: '这条记录已经不在了。', removedAt: 0 }
}
