import { describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { nutritionFor } from '@/lib/data/meal-parser'
import { today } from '@/lib/data/today'
import { DEMO_USER_ID } from '@/lib/db/demo'
import { allFoods, dayLogFor, userById } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import { foodEntries, users } from '@/lib/db/schema'
import { addFoodEntries } from '@/lib/db/writes'
import { deleteMealEntryAction, saveMealAction, updateMealEntryAction, createUserFoodAction } from './actions'
import { redirectTarget } from '@/tests/next-navigation-mock'
import { setupSeededDatabase } from '@/tests/seeded-db'

/**
 * 记录饮食的写入路径。
 *
 * 这里验的是「存进去的东西对不对」：热量必须由服务端按食物库重算（客户端传的
 * 数字一个都不算），删除与修改必须只认自己的记录。
 */

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', async () => {
  const { redirectMock } = await import('@/tests/next-navigation-mock')
  return { redirect: redirectMock }
})
vi.mock('@/lib/auth/cookie', async () => (await import('@/tests/auth-cookie-mock')).cookieMock())

setupSeededDatabase()

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const db = () => getDb()

async function demoDay() {
  const user = await userById(db(), DEMO_USER_ID)
  if (!user) throw new Error('种子数据里应当有演示用户')
  const day = await dayLogFor(db(), user, today())
  if (!day) throw new Error('演示用户今天应当有记录')
  return day
}

describe('保存这一餐', () => {
  it('按食物库重算热量并落库，然后跳回首页', async () => {
    const egg = (await allFoods(db())).find((food) => food.name === '鸡蛋')
    expect(egg, '单品食物应当已经在库里（种子里的 PANTRY）').toBeTruthy()

    const form = formData({
      slot: 'breakfast',
      // 客户端同时塞了一个离谱的 calories，服务端必须无视它
      items: JSON.stringify([{ foodId: egg!.id, grams: 150, calories: 99999 }]),
    })

    try {
      await saveMealAction({ error: null }, form)
      throw new Error('本该跳到首页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/')
    }

    const day = await demoDay()
    const saved = day.foods.find((food) => food.name === egg!.name && food.grams === 150)
    expect(saved?.grams).toBe(150)

    const expected = nutritionFor(
      {
        id: egg!.id,
        name: egg!.name,
        perGrams: egg!.perGrams,
        calories: egg!.calories,
        protein: egg!.protein,
        carbs: egg!.carbs,
        fat: egg!.fat,
      },
      150,
    ).calories
    expect(saved?.totals.calories).toBe(expected)
    expect(saved?.totals.calories).not.toBe(99999)
  })

  it('餐次不对、条目为空、克数离谱时都不写库', async () => {
    const foodId = (await allFoods(db()))[0].id
    const item = JSON.stringify([{ foodId, grams: 100 }])
    const cases: { name: string; form: Record<string, string> }[] = [
      { name: '餐次缺失', form: { slot: '', items: item } },
      { name: '餐次不是四个之一', form: { slot: 'brunch', items: item } },
      { name: '条目为空', form: { slot: 'lunch', items: '[]' } },
      { name: '不是 JSON', form: { slot: 'lunch', items: '这不是 JSON' } },
      { name: '克数为 0', form: { slot: 'lunch', items: JSON.stringify([{ foodId, grams: 0 }]) } },
      { name: '克数过大', form: { slot: 'lunch', items: JSON.stringify([{ foodId, grams: 999999 }]) } },
      {
        name: '条目过多',
        form: {
          slot: 'lunch',
          items: JSON.stringify(Array.from({ length: 21 }, () => ({ foodId, grams: 10 }))),
        },
      },
    ]

    for (const { name, form } of cases) {
      const state = await saveMealAction({ error: null }, formData(form))
      expect(state.error, name).not.toBeNull()
    }

    const day = await demoDay()
    expect(day.foods.some((food) => food.grams === 999999)).toBe(false)
  })

  it('食物 id 不在库里时明确报错，而不是静默存下', async () => {
    const state = await saveMealAction(
      { error: null },
      formData({ slot: 'lunch', items: JSON.stringify([{ foodId: '不存在', grams: 100 }]) }),
    )
    expect(state.error).toMatch(/不在食物库里/)
  })
})

describe('删除一条记录', () => {
  it('只能删自己的：别人的记录删不掉，也不报成功', async () => {
    const now = new Date()
    await db()
      .insert(users)
      .values({
        id: 'someone-else',
        email: 'someone-else@fitchat.local',
        passwordHash: null,
        heightCm: null,
        age: null,
        sex: null,
        startedAt: '2026-01-01',
        timezone: 'Asia/Shanghai',
        createdAt: now,
      })
      .run()

    await addFoodEntries(
      db(),
      'someone-else',
      today(),
      'lunch',
      [
        {
          foodId: null,
          name: '别人的饭',
          grams: 100,
          source: 'user',
          calories: 100,
          protein: 1,
          carbs: 1,
          fat: 1,
        },
      ],
      now,
    )

    const rows = await db().select().from(foodEntries).all()
    const theirs = rows.find((row) => row.userId === 'someone-else')
    expect(theirs, '别人的那条应当写进去了').toBeTruthy()

    const state = await deleteMealEntryAction(
      { error: null, removedAt: 0 },
      formData({ entryId: theirs!.id }),
    )

    // 归属检查在 WHERE 里，所以这次删除「什么都没删掉」——界面要如实说
    expect(state.error).toMatch(/已经不在了/)
    expect(state.removedAt).toBe(0)
    const after = await db().select().from(foodEntries).all()
    expect(after.some((row) => row.id === theirs!.id)).toBe(true)
  })

  it('删自己的记录会真的删掉', async () => {
    const before = await demoDay()
    const target = before.foods[0]
    expect(target?.id).toBeTruthy()

    const state = await deleteMealEntryAction(
      { error: null, removedAt: 0 },
      formData({ entryId: target.id }),
    )
    expect(state.error).toBeNull()
    expect(state.removedAt).toBeGreaterThan(0)

    const after = await demoDay()
    expect(after.foods.some((food) => food.id === target.id)).toBe(false)
  })

  it('不指定 id 时说清楚', async () => {
    const state = await deleteMealEntryAction({ error: null, removedAt: 0 }, formData({}))
    expect(state.error).toMatch(/没有指定/)
  })
})

describe('修改一条记录', () => {
  it('改克数后营养值由服务端按食物库重算，并让首页/日历跟着变', async () => {
    const egg = (await allFoods(db())).find((food) => food.name === '鸡蛋')
    expect(egg).toBeTruthy()

    // 先记一条，客户端塞的假热量必须被无视（保存路径的既有规矩）
    try {
      await saveMealAction(
        { error: null },
        formData({
          slot: 'breakfast',
          items: JSON.stringify([{ foodId: egg!.id, grams: 100, calories: 99999 }]),
        }),
      )
      throw new Error('本该跳到首页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/')
    }

    const saved = (await demoDay()).foods.find((food) => food.name === '鸡蛋' && food.grams === 100)
    expect(saved).toBeTruthy()

    vi.mocked(revalidatePath).mockClear()
    try {
      await updateMealEntryAction(
        { error: null },
        formData({ entryId: saved!.id, foodId: egg!.id, grams: '250' }),
      )
      throw new Error('本该跳到首页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/')
    }

    const updated = (await demoDay()).foods.find((food) => food.id === saved!.id)
    expect(updated?.grams).toBe(250)

    // 营养值是「食物库 × 新克数」的服务端重算，不是按比例缩放客户端数字
    const expected = nutritionFor(
      {
        id: egg!.id,
        name: egg!.name,
        perGrams: egg!.perGrams,
        calories: egg!.calories,
        protein: egg!.protein,
        carbs: egg!.carbs,
        fat: egg!.fat,
      },
      250,
    )
    expect(updated?.totals.calories).toBe(expected.calories)
    expect(updated?.totals.protein).toBe(expected.protein)
    expect(updated?.totals.calories).not.toBe(99999)

    // 首页、某日详情、日历读的是同一份数据——改完它们的缓存必须作废
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/', 'layout')
  })

  it('只能改自己的：别人的记录改不动，也不报成功', async () => {
    const now = new Date()
    await db()
      .insert(users)
      .values({
        id: 'food-rival',
        email: 'food-rival@fitchat.local',
        passwordHash: null,
        heightCm: null,
        age: null,
        sex: null,
        startedAt: '2026-01-01',
        timezone: 'Asia/Shanghai',
        createdAt: now,
      })
      .run()
    await addFoodEntries(
      db(),
      'food-rival',
      today(),
      'lunch',
      [
        {
          foodId: null,
          name: '别人的饭',
          grams: 100,
          source: 'user',
          calories: 100,
          protein: 1,
          carbs: 1,
          fat: 1,
        },
      ],
      now,
    )
    const theirs = (await db().select().from(foodEntries).all()).find(
      (row) => row.userId === 'food-rival',
    )
    expect(theirs).toBeTruthy()

    const food = (await allFoods(db()))[0]
    const state = await updateMealEntryAction(
      { error: null },
      formData({ entryId: theirs!.id, foodId: food.id, grams: '500' }),
    )
    expect(state.error).toMatch(/已经不在了/)

    // 那行一个字段都没动
    const after = (await db().select().from(foodEntries).all()).find(
      (row) => row.id === theirs!.id,
    )
    expect(after?.grams).toBe(100)
    expect(after?.name).toBe('别人的饭')
  })

  it('食物不在库里、克数离谱时都明确拒绝', async () => {
    const saved = (await demoDay()).foods[0]
    expect(saved?.id).toBeTruthy()
    const row = (await db().select().from(foodEntries).all()).find(
      (candidate) => candidate.id === saved.id,
    )
    expect(row).toBeTruthy()

    const noFood = await updateMealEntryAction(
      { error: null },
      formData({ entryId: saved.id, foodId: '不存在', grams: '100' }),
    )
    expect(noFood.error).toMatch(/不在食物库里/)

    const badGrams = await updateMealEntryAction(
      { error: null },
      formData({ entryId: saved.id, foodId: row!.foodId ?? '', grams: '0' }),
    )
    expect(badGrams.error).toMatch(/克数/)

    const noId = await updateMealEntryAction({ error: null }, formData({}))
    expect(noId.error).toMatch(/没有指定/)
  })
})

describe('自建食物', () => {
  it('录一条新的：进食物库（per_grams=100），立刻能用来记一餐', async () => {
    const state = await createUserFoodAction(
      { error: null, createdAt: 0 },
      formData({ name: '螺蛳粉', calories: '280', protein: '8', carbs: '45', fat: '9' }),
    )
    expect(state.error).toBeNull()
    expect(state.createdAt).toBeGreaterThan(0)

    const created = (await allFoods(db())).find((food) => food.name === '螺蛳粉')
    expect(created).toBeTruthy()
    expect(created?.perGrams).toBe(100)
    expect(created?.calories).toBe(280)
    expect(created?.protein).toBe(8)

    // 立刻能用它记一餐：来源标成 user（不是 curated）
    try {
      await saveMealAction(
        { error: null },
        formData({
          slot: 'dinner',
          items: JSON.stringify([{ foodId: created!.id, grams: 150 }]),
        }),
      )
      throw new Error('本该跳到首页')
    } catch (error) {
      expect(redirectTarget(error)).toBe('/')
    }

    const day = await demoDay()
    const saved = day.foods.find((food) => food.name === '螺蛳粉')
    expect(saved?.source).toBe('user')
    expect(saved?.grams).toBe(150)
  })

  it('同名冲突给明确提示，而不是 500', async () => {
    const state = await createUserFoodAction(
      { error: null, createdAt: 0 },
      formData({ name: '鸡蛋', calories: '100', protein: '10', carbs: '1', fat: '1' }),
    )
    expect(state.error).toMatch(/已经有叫「鸡蛋」的食物了/)
    expect(state.createdAt).toBe(0)
  })

  it('名称与营养值不合法时都拒绝', async () => {
    const cases: { name: string; form: Record<string, string> }[] = [
      { name: '名称为空', form: { name: '  ', calories: '100', protein: '1', carbs: '1', fat: '1' } },
      { name: '名称过长', form: { name: 'x'.repeat(21), calories: '100', protein: '1', carbs: '1', fat: '1' } },
      { name: '热量为 0', form: { name: '新食物', calories: '0', protein: '1', carbs: '1', fat: '1' } },
      { name: '热量过大', form: { name: '新食物', calories: '9999', protein: '1', carbs: '1', fat: '1' } },
      { name: '蛋白质为负', form: { name: '新食物', calories: '100', protein: '-1', carbs: '1', fat: '1' } },
    ]

    for (const { name, form } of cases) {
      const state = await createUserFoodAction({ error: null, createdAt: 0 }, formData(form))
      expect(state.error, name).not.toBeNull()
    }
  })
})
