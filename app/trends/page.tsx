import WeightTable, { type WeightRow } from '@/components/WeightTable'
import SurplusTable, { type SurplusRow } from '@/components/SurplusTable'
import { MOCK_GOAL, MOCK_USER, TODAY, dayLogFor, datesWithRecords, weightFor } from '@/lib/data/mock'
import { calorieSurplus } from '@/lib/data/selectors'
import styles from './trends.module.css'

export default function Trends() {
  // 展示从开始使用至今的全部历史，由表格内部滚动浏览
  const dates = datesWithRecords(MOCK_USER.startedAt, TODAY)

  const weightRows: WeightRow[] = dates
    .map((date, i) => {
      const kg = weightFor(date)
      if (kg === null) return null
      const prevKg = i > 0 ? weightFor(dates[i - 1]) : null
      const delta = prevKg !== null ? Math.round((kg - prevKg) * 10) / 10 : null
      return { date, kg, delta }
    })
    .filter((row): row is WeightRow => row !== null)
    .reverse() // 最近的日期在上

  const surplusRows: SurplusRow[] = dates
    .map((date) => {
      const day = dayLogFor(date)
      if (day === null) return null
      return { date, surplus: calorieSurplus(day, MOCK_GOAL) }
    })
    .filter((row): row is SurplusRow => row !== null)
    .reverse()

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
