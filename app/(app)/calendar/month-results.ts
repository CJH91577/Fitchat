import type { DayResult } from '@/components/CalendarView'
import type { Db } from '@/lib/db'
import type { DbUser } from '@/lib/db/queries'
import type { UserGoal } from '@/lib/data/types'
import { dateRange } from '@/lib/data/dates'
import { isCalorieOnTarget, isExerciseOnTarget, isInRange } from '@/lib/data/selectors'
import { dayLogFor } from '@/lib/db/queries'

/**
 * 某个月每一天的达成情况。
 *
 * 首屏（page.tsx 算当月）与翻月（actions.ts 按需取）共用这一个函数：
 * 两条路径算出来的东西必须一模一样，否则同一格在两种加载方式下
 * 会显示不同的状态。
 */
export async function monthResults(
  db: Db,
  user: DbUser,
  goal: UserGoal | null,
  year: number,
  month: number,
): Promise<Record<string, DayResult>> {
  const pad = (n: number) => String(n).padStart(2, '0')
  // new Date(year, month, 0) 是「下个月的第 0 天」，即当月最后一天
  const lastDay = new Date(year, month, 0).getDate()
  const from = `${year}-${pad(month)}-01`
  const to = `${year}-${pad(month)}-${pad(lastDay)}`

  const results: Record<string, DayResult> = {}
  for (const date of dateRange(from, to)) {
    if (!isInRange(date, user.startedAt)) continue
    const day = await dayLogFor(db, user, date)
    if (day === null) continue
    results[date] = {
      // 还没有设目标时一律算未达成——用目标 0 去比会得出「吃了就超标」之类的假结论
      calories: goal !== null && isCalorieOnTarget(day, goal),
      exercise: goal !== null && isExerciseOnTarget(day, goal),
    }
  }
  return results
}
