'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/current-user'
import { today } from '@/lib/data/today'
import { getDb } from '@/lib/db/runtime'
import { upsertWeightEntry } from '@/lib/db/writes'

/**
 * 记下今天的体重。
 *
 * 一天一条（(user_id, date) 是主键），所以再记一次是改掉今天那条，
 * 而不是在趋势里多出一天。写完之后不跳走——用户就在首页上看着那个数字变。
 */
export async function saveWeightAction(
  _prev: { error: string | null; savedAt: number },
  formData: FormData,
): Promise<{ error: string | null; savedAt: number }> {
  const db = getDb()
  const user = await requireUser(db)

  const kg = Number(formData.get('kg'))
  if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
    return { error: '体重请填 20–400 公斤之间。', savedAt: 0 }
  }

  await upsertWeightEntry(db, user.id, today(), Math.round(kg * 10) / 10, new Date())
  revalidatePath('/', 'layout')

  return { error: null, savedAt: Date.now() }
}
