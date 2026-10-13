import CalendarView, { type DayResult } from '@/components/CalendarView'
import { TODAY } from '@/lib/data/today'
import { dateRange } from '@/lib/data/dates'
import { isCalorieOnTarget, isExerciseOnTarget } from '@/lib/data/selectors'
import { dayLogFor, goalFor } from '@/lib/db/queries'
import { getDb, getDemoUser } from '@/lib/db/runtime'
import styles from './calendar.module.css'

/**
 * 日历页。
 *
 * 数据的计算留在服务端：某一天是否达成要从数据库里读当天的记录。
 * 交互（翻月）留给客户端组件——静态导出之后没有服务端，翻月必须纯客户端完成，
 * 所以这一整段区间的达成情况要随页面一起送过去。
 */
export default async function Calendar() {
  const db = getDb()
  const user = await getDemoUser(db)
  const goal = await goalFor(db, user.id)

  // 约 390 天，每天两个布尔值——十几 KB，比趋势页那两张表小得多
  const dayResults: Record<string, DayResult> = {}
  for (const date of dateRange(user.startedAt, TODAY)) {
    const day = await dayLogFor(db, user, date)
    if (day === null) continue
    dayResults[date] = {
      // 还没有设目标时一律算未达成——用目标 0 去比会得出「吃了就超标」之类的假结论
      calories: goal !== null && isCalorieOnTarget(day, goal),
      exercise: goal !== null && isExerciseOnTarget(day, goal),
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>日历</h1>
      <CalendarView today={TODAY} startedAt={user.startedAt} dayResults={dayResults} />
    </main>
  )
}
