'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/current-user'
import { isValidDateKey } from '@/lib/data/dates'
import { isInRange, isUpcoming } from '@/lib/data/selectors'
import { today } from '@/lib/data/today'
import { getDb } from '@/lib/db/runtime'
import { upsertWeightEntry } from '@/lib/db/writes'

/**
 * 记下某一天的体重（默认今天，可以补记过去的日子）。
 *
 * 一天一条（(user_id, date) 是主键），所以同一天再记一次是改掉那条，
 * 而不是在趋势里多出一天。写完之后不跳走——用户就看着那个数字变。
 *
 * 日期来自表单，是用户可改的，所以三个校验都在服务端做：
 * 格式、未来（日历不可点、某日详情「还没有到」都是同一件事）、
 * 早于开始使用日期。客户端设的 min/max 只是顺手拦住，不是边界。
 */
export async function saveWeightAction(
  _prev: { error: string | null; savedAt: number },
  formData: FormData,
): Promise<{ error: string | null; savedAt: number }> {
  const db = getDb()
  const user = await requireUser(db)

  const date = String(formData.get('date') ?? today())
  if (!isValidDateKey(date)) {
    return { error: '日期格式不正确。', savedAt: 0 }
  }
  if (isUpcoming(date, today())) {
    return { error: '这一天还没有到，不能记体重。', savedAt: 0 }
  }
  if (!isInRange(date, user.startedAt)) {
    return { error: '这一天你还没有开始使用。', savedAt: 0 }
  }

  const kg = Number(formData.get('kg'))
  if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
    return { error: '体重请填 20–400 公斤之间。', savedAt: 0 }
  }

  await upsertWeightEntry(db, user.id, date, Math.round(kg * 10) / 10, new Date())
  revalidatePath('/', 'layout')

  return { error: null, savedAt: Date.now() }
}
