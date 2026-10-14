/**
 * 记录运动页的数据形状。
 *
 * 与饮食那边同一个套路：保存成功直接跳回首页（那里是「今天练了什么」的地方），
 * 删除留在本页，用 removedAt 让客户端知道「这次提交真的删掉了东西」。
 */

export type TodayExercise = {
  id: string
  kind: 'cardio' | 'strength'
  name: string
  /** 仅 cardio */
  minutes: number | null
  setCount: number
  caloriesBurned: number
}

/** 今天该练什么（来自训练计划），用来预填动作与目标组数 */
export type PlanHint = {
  theme: string
  items: { name: string; sets: number; reps: string }[]
}

export type SaveState = { error: string | null }

export const EMPTY_SAVE_STATE: SaveState = { error: null }

export type DeleteState = { error: string | null; removedAt: number }

export const EMPTY_DELETE_STATE: DeleteState = { error: null, removedAt: 0 }
