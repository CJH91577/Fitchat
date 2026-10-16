import CalendarView from '@/components/CalendarView'
import { today } from '@/lib/data/today'
import { goalFor } from '@/lib/db/queries'
import { requireUser } from '@/lib/auth/current-user'
import { getDb } from '@/lib/db/runtime'
import { monthResults } from './month-results'
import styles from './calendar.module.css'

/**
 * 日历页。
 *
 * 达成情况的计算留在服务端（某一天是否达成要从数据库里读当天的记录），
 * 翻月的交互留给客户端。首屏只带**当月**的数据——整段区间（约 390 天）
 * 随页面下发曾让这个页面成为全站最大（39 KB）；其它月份由客户端
 * 翻到哪个月取哪个月（见 ./actions.ts）。
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

  const year = Number(TODAY.slice(0, 4))
  const month = Number(TODAY.slice(5, 7))
  const initialDayResults = await monthResults(db, user, goal, year, month)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>日历</h1>
      <CalendarView
        today={TODAY}
        startedAt={user.startedAt}
        initialDayResults={initialDayResults}
      />
    </main>
  )
}
