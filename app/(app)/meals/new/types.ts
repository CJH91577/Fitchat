import type { FoodSource, MealSlot } from '@/lib/data/types'

/**
 * 今天已经记下的一条。
 *
 * 页面初次渲染时由服务端查询组装；保存与删除之后由 `router.refresh()` 让服务端
 * 重新渲染一次，于是「刚存的那条」与「刷新后看到的那条」走的是同一条路径，
 * 不存在两份渲染逻辑。
 */
export type TodayEntry = {
  id: string
  slot: MealSlot
  name: string
  grams: number
  calories: number
  source: FoodSource
}

/** 保存成功会直接跳回首页（那里正是「今天吃了什么」的地方），所以这个状态只承载失败 */
export type SaveState = { error: string | null }

export const EMPTY_SAVE_STATE: SaveState = { error: null }

/**
 * 删除留在本页：删错了要能看见列表变了。
 *
 * removedAt 是给客户端判断「这次提交真的删掉了东西」用的——只用 error 的话，
 * 分不清「还没提交过」与「提交成功」，于是要么不刷新，要么每次渲染都刷新。
 */
export type DeleteState = { error: string | null; removedAt: number }

export const EMPTY_DELETE_STATE: DeleteState = { error: null, removedAt: 0 }

/**
 * 编辑成功与保存一样直接跳回首页（那里正是「今天吃了什么」的地方），
 * 所以这个状态只承载失败。
 */
export type UpdateState = { error: string | null }

export const EMPTY_UPDATE_STATE: UpdateState = { error: null }
