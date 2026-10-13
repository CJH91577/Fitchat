import WeightTable, { type WeightRow } from '@/components/WeightTable'
import SurplusTable, { type SurplusRow } from '@/components/SurplusTable'
import { TODAY } from '@/lib/data/today'
import { dateRange } from '@/lib/data/dates'
import { calorieSurplus } from '@/lib/data/selectors'
import { dayLogFor, goalFor, weightSeries } from '@/lib/db/queries'
import { getDb, getDemoUser } from '@/lib/db/runtime'
import styles from './trends.module.css'

export default async function Trends() {
  const db = getDb()
  const user = getDemoUser(db)
  const goal = goalFor(db, user.id)

  // 展示从开始使用至今的全部历史，由表格内部滚动浏览
  const dates = dateRange(user.startedAt, TODAY)

  // 一次查完整段体重序列，而不是逐日查 386 次
  const kgByDate = new Map(
    weightSeries(db, user, user.startedAt, TODAY).map((row) => [row.date, row.kg]),
  )

  const weightRows: WeightRow[] = []
  const surplusRows: SurplusRow[] = []

  dates.forEach((date, i) => {
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
    const day = dayLogFor(db, user, date)
    if (day !== null && day.foods.length > 0 && goal !== null) {
      surplusRows.push({ date, surplus: calorieSurplus(day, goal) })
    }
  })

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
