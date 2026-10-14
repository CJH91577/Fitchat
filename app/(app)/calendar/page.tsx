import CalendarView, { type DayResult } from '@/components/CalendarView'
import { today } from '@/lib/data/today'
import { dateRange } from '@/lib/data/dates'
import { isCalorieOnTarget, isExerciseOnTarget } from '@/lib/data/selectors'
import { dayLogFor, goalFor } from '@/lib/db/queries'
import { requireUser } from '@/lib/auth/current-user'
import { getDb } from '@/lib/db/runtime'
import styles from './calendar.module.css'

/**
 * 日历页。
 *
 * 数据的计算留在服务端：某一天是否达成要从数据库里读当天的记录。
 * 交互（翻月）留给客户端组件——静态导出之后没有服务端，翻月必须纯客户端完成，
 * 所以这一整段区间的达成情况要随页面一起送过去。
 */
// 每次请求都重新渲染：数据来自数据库，且「今天」要跟着真实日期走。
// 不加这一行，Next 会在构建时预渲染这些页面——数据被冻住，日期也一并冻住。
export const dynamic = 'force-dynamic'
export default async function Calendar() {
  // 请求期取「今天」：服务端每次渲染都重新算（见 lib/data/today.ts）
  const TODAY = today()
  const db = getDb()
  // 没登录直接跳登录页（requireUser 内部会 redirect）
  const user = await requireUser(db)
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
