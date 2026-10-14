import { requireUser } from '@/lib/auth/current-user'
import type { FoodOption } from '@/lib/data/meal-parser'
import { today } from '@/lib/data/today'
import { allFoods, dayLogFor } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import MealForm from './MealForm'
import type { TodayEntry } from './types'

/**
 * 记录饮食页。
 *
 * 页面的活儿只有两件：取出食物库与今天的记录，交给客户端表单。
 * 解析、改份量这类交互留在浏览器里做（lib/data/meal-parser 是纯函数），
 * 所以改一个数字不会往服务器跑一趟。
 */
export const dynamic = 'force-dynamic'

export default async function NewMeal() {
  const db = getDb()
  const user = await requireUser(db)
  const date = today()

  const [foodRows, day] = await Promise.all([allFoods(db), dayLogFor(db, user, date)])

  const foods: FoodOption[] = foodRows.map((food) => ({
    id: food.id,
    name: food.name,
    perGrams: food.perGrams,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  }))

  const entries: TodayEntry[] = (day?.foods ?? []).map((food) => ({
    id: food.id,
    slot: food.slot,
    name: food.name,
    grams: food.grams,
    calories: food.totals.calories,
    source: food.source,
  }))

  return <MealForm foods={foods} entries={entries} />
}
