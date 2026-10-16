'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/current-user'
import { getDb } from '@/lib/db/runtime'
import { savePlanDay } from '@/lib/db/writes'
import type { PlanFormState } from './types'

/**
 * 保存某一天的训练计划（主题与动作列表）。
 *
 * 与饮食/运动同一个规矩：客户端报的内容服务端逐项验一遍。
 * 计划按 (user_id, weekday) 定位，用户改的只能是自己的那一行——
 * 归属检查是结构性的，不需要额外的「这条是谁的」判断。
 */

const MAX_ITEMS = 10
const MAX_THEME_LENGTH = 20
const MAX_NAME_LENGTH = 20
const MAX_REPS_LENGTH = 10

type SubmittedItem = { name: string; sets: number; reps: string }

function readItems(raw: string): SubmittedItem[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_ITEMS) return null

  const items: SubmittedItem[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) return null
    const name = (entry as { name?: unknown }).name
    const sets = (entry as { sets?: unknown }).sets
    const reps = (entry as { reps?: unknown }).reps
    if (typeof name !== 'string' || name.trim() === '' || name.trim().length > MAX_NAME_LENGTH) {
      return null
    }
    if (typeof sets !== 'number' || !Number.isInteger(sets) || sets < 1 || sets > 20) return null
    if (typeof reps !== 'string' || reps.trim() === '' || reps.trim().length > MAX_REPS_LENGTH) {
      return null
    }
    items.push({ name: name.trim(), sets, reps: reps.trim() })
  }
  return items
}

export async function savePlanDayAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const db = getDb()
  const user = await requireUser(db)

  const weekday = Number(formData.get('weekday'))
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return { error: '星期几不对。', savedAt: 0 }
  }

  const theme = String(formData.get('theme') ?? '').trim()
  if (theme === '' || theme.length > MAX_THEME_LENGTH) {
    return { error: '主题请填 1–20 个字（休息日填「休息」）。', savedAt: 0 }
  }

  const items = readItems(String(formData.get('items') ?? ''))
  if (items === null) {
    return { error: '动作列表不对：名称 1–20 字、组数 1–20、次数写文字（如「8」或「力竭」）。', savedAt: 0 }
  }

  await savePlanDay(db, user.id, { weekday, theme, items })
  // 首页的「今天该练」与记录页的预填都读这份计划，一并作废缓存
  revalidatePath('/', 'layout')

  return { error: null, savedAt: Date.now() }
}
