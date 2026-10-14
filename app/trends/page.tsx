import WeightTable, { type WeightRow } from '@/components/WeightTable'
import SurplusTable, { type SurplusRow } from '@/components/SurplusTable'
import { today } from '@/lib/data/today'
import { dateRange } from '@/lib/data/dates'
import { calorieSurplus } from '@/lib/data/selectors'
import { dayLogFor, goalFor, weightSeries } from '@/lib/db/queries'
import { getDb, getDemoUser } from '@/lib/db/runtime'
import styles from './trends.module.css'

// 每次请求都重新渲染：数据来自数据库，且「今天」要跟着真实日期走。
// 不加这一行，Next 会在构建时预渲染这些页面——数据被冻住，日期也一并冻住。
export const dynamic = 'force-dynamic'
export default async function Trends() {
  // 请求期取「今天」：服务端每次渲染都重新算（见 lib/data/today.ts）
  const TODAY = today()
  const db = getDb()
  const user = await getDemoUser(db)
  const goal = await goalFor(db, user.id)

  // 展示从开始使用至今的全部历史，由表格内部滚动浏览
  const dates = dateRange(user.startedAt, TODAY)

  // 一次查完整段体重序列，而不是逐日查 386 次
  const weights = await weightSeries(db, user, user.startedAt, TODAY)
  const kgByDate = new Map(weights.map((row) => [row.date, row.kg]))

  const weightRows: WeightRow[] = []
  const surplusRows: SurplusRow[] = []

  // 用 for 而不是 forEach：循环体里要 await（forEach 的回调里不能用 await）
  for (let i = 0; i < dates.length; i += 1) {
    const date = dates[i]

    const kg = kgByDate.get(date)
    if (kg !== undefined) {
      const prevKg = i > 0 ? kgByDate.get(dates[i - 1]) : undefined
      weightRows.push({
        date,
        kg,
        delta: prevKg === undefined ? null : Math.round((kg - prevKg) * 10) / 10,
      })
    }

    // 没有饮食记录的日子不放进盈余表：那天的「盈余」不是「没吃」，
    // 而是「没记」——按 0 减去目标算出的 −1800 会是一句假话。
    const day = await dayLogFor(db, user, date)
    if (day !== null && day.foods.length > 0 && goal !== null) {
      surplusRows.push({ date, surplus: calorieSurplus(day, goal) })
    }
  }

  // 最近的日期在上
  weightRows.reverse()
  surplusRows.reverse()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>趋势</h1>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>体重</h2>
        </div>
        <WeightTable rows={weightRows} />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>热量盈余</h2>
        </div>
        <SurplusTable rows={surplusRows} />
      </section>
    </main>
  )
}
