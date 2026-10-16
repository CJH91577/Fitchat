'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/current-user'
import { today } from '@/lib/data/today'
import {
  type Intensity,
  INTENSITY_LABEL,
  estimateCardioCalories,
  estimateStrengthCalories,
} from '@/lib/data/workout'
import { getDb } from '@/lib/db/runtime'
import { addExerciseEntry, deleteExerciseEntry, updateExerciseEntry } from '@/lib/db/writes'
import type { DeleteState, SaveState, UpdateState } from './types'

/**
 * 记录运动的写入路径。
 *
 * 消耗量在这里算，不在浏览器里算：客户端只报「什么动作、多久、几组」，
 * 千卡由服务端按同一套口径估出来，和库里的历史记录保持一致。
 */

const MAX_SETS = 20
const MAX_MINUTES = 600
const MAX_WEIGHT = 500
const MAX_REPS = 100

type SubmittedSet = { reps: number; weightKg: number }

function readSets(raw: string): SubmittedSet[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_SETS) return null

  const sets: SubmittedSet[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) return null
    const reps = (entry as { reps?: unknown }).reps
    const weightKg = (entry as { weightKg?: unknown }).weightKg
    if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return null
    if (typeof weightKg !== 'number' || !Number.isFinite(weightKg)) return null
    if (weightKg < 0 || weightKg > MAX_WEIGHT) return null
    sets.push({ reps, weightKg })
  }
  return sets
}

function cleanName(value: string): string | null {
  const name = value.trim()
  if (name === '' || name.length > 20) return null
  return name
}

type WorkoutInput = {
  kind: 'cardio' | 'strength'
  name: string
  minutes: number | null
  caloriesBurned: number
  sets: SubmittedSet[]
}

/**
 * 从表单读出一次「实际完成了什么」：保存与编辑共用，两个动作的校验
 * 与消耗口径因此不可能漂移。消耗量在这里算，不在浏览器里算——
 * 客户端只报「什么动作、多久、几组」。
 */
function readWorkout(formData: FormData): { error: string } | { entry: WorkoutInput } {
  const kind = String(formData.get('kind') ?? '')
  const name = cleanName(String(formData.get('name') ?? ''))
  if (name === null) return { error: '请填写动作名称（20 个字以内）。' }

  if (kind === 'cardio') {
    const minutes = Number(formData.get('minutes'))
    const intensity = String(formData.get('intensity') ?? '') as Intensity
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_MINUTES) {
      return { error: '请填写时长（分钟）。' }
    }
    if (!(intensity in INTENSITY_LABEL)) return { error: '请选择强度。' }

    return {
      entry: {
        kind: 'cardio',
        name,
        minutes: Math.round(minutes),
        caloriesBurned: estimateCardioCalories(name, Math.round(minutes), intensity),
        sets: [],
      },
    }
  }

  if (kind === 'strength') {
    const sets = readSets(String(formData.get('sets') ?? ''))
    if (sets === null) return { error: '组数不对：重量填 0–500 公斤，次数填 1–100。' }

    return {
      entry: {
        kind: 'strength',
        name,
        minutes: null,
        caloriesBurned: estimateStrengthCalories(sets.length),
        sets,
      },
    }
  }

  return { error: '请选择有氧或力量。' }
}

export async function saveWorkoutAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const db = getDb()
  const user = await requireUser(db)

  const read = readWorkout(formData)
  if ('error' in read) return { error: read.error }

  await addExerciseEntry(db, user.id, today(), read.entry, new Date())

  // 首页、某日详情、日历都读同一份数据，写完让缓存作废再回首页
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function deleteWorkoutAction(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const db = getDb()
  const user = await requireUser(db)

  const entryId = String(formData.get('entryId') ?? '')
  if (entryId === '') return { error: '没有指定要删除的记录。', removedAt: 0 }

  const removed = await deleteExerciseEntry(db, user.id, entryId)
  revalidatePath('/', 'layout')

  return removed
    ? { error: null, removedAt: Date.now() }
    : { error: '这条记录已经不在了。', removedAt: 0 }
}

/**
 * 改一条已保存的运动记录：时长（有氧）或逐组重量次数（力量）。
 *
 * 与保存共用 readWorkout，消耗同样由服务端重算。成功与保存一样跳回首页，
 * 在那里看到改过的数字。
 */
export async function updateWorkoutAction(
  _prev: UpdateState,
  formData: FormData,
): Promise<UpdateState> {
  const db = getDb()
  const user = await requireUser(db)

  const entryId = String(formData.get('entryId') ?? '')
  if (entryId === '') return { error: '没有指定要修改的记录。' }

  const read = readWorkout(formData)
  if ('error' in read) return { error: read.error }

  const updated = await updateExerciseEntry(db, user.id, entryId, read.entry)

  if (!updated) return { error: '这条记录已经不在了。' }

  revalidatePath('/', 'layout')
  redirect('/')
}
