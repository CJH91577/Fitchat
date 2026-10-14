'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/current-user'
import { ACTIVITY_FACTOR, type ActivityLevel, dailyTarget } from '@/lib/data/target'
import { today } from '@/lib/data/today'
import { getDb } from '@/lib/db/runtime'
import { saveProfileAndGoal } from '@/lib/db/writes'

/**
 * 首次引导的写入路径：资料、目标、当前体重一次写完。
 *
 * 成功走 redirect，所以返回的对象只在失败时出现——客户端用 useActionState
 * 接住它并把话原样显示出来。
 */
export async function saveOnboardingAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const db = getDb()
  const user = await requireUser(db)

  const heightCm = Number(formData.get('heightCm'))
  const weightKg = Number(formData.get('weightKg'))
  const age = Number(formData.get('age'))
  const sex = String(formData.get('sex') ?? '')
  const activity = String(formData.get('activity') ?? '') as ActivityLevel
  const direction = String(formData.get('direction') ?? '')
  const targetWeightKg = Number(formData.get('targetWeightKg'))
  const caloriesOverride = Number(formData.get('calories'))

  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
    return { error: '身高请填 100–250 厘米之间。' }
  }
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    return { error: '体重请填 20–400 公斤之间。' }
  }
  if (!Number.isInteger(age) || age < 10 || age > 100) {
    return { error: '年龄请填 10–100 之间。' }
  }
  if (sex !== 'male' && sex !== 'female') {
    return { error: '请选择性别——基础代谢的公式需要它。' }
  }
  if (!(activity in ACTIVITY_FACTOR)) {
    return { error: '请选择活动量。' }
  }
  if (direction !== 'cut' && direction !== 'bulk' && direction !== 'maintain') {
    return { error: '请选择目标方向。' }
  }
  if (!Number.isFinite(targetWeightKg) || targetWeightKg < 20 || targetWeightKg > 400) {
    return { error: '目标体重请填 20–400 公斤之间。' }
  }

  const suggested = dailyTarget({
    sex,
    heightCm: Math.round(heightCm),
    weightKg,
    age,
    activity,
    direction,
  })

  // 热量允许用户微调，其余三项跟着它走：蛋白与脂肪按体重定，碳水吃剩下的热量
  const calories =
    Number.isFinite(caloriesOverride) && caloriesOverride >= 800 && caloriesOverride <= 6000
      ? Math.round(caloriesOverride / 10) * 10
      : suggested.calories

  await saveProfileAndGoal(
    db,
    user.id,
    today(),
    {
      heightCm: Math.round(heightCm),
      age,
      sex,
      weightKg: Math.round(weightKg * 10) / 10,
      goal: {
        direction,
        calories,
        protein: suggested.protein,
        fat: suggested.fat,
        carbs: Math.max(0, Math.round((calories - suggested.protein * 4 - suggested.fat * 9) / 4)),
        exerciseCalories: suggested.exerciseCalories,
        targetWeightKg: Math.round(targetWeightKg * 10) / 10,
      },
    },
    new Date(),
  )

  // 首页、日历、趋势都读同一份数据；写完再回首页看自己的目标
  revalidatePath('/', 'layout')
  redirect('/')
}
