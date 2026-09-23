'use client'

import { useMemo, useState } from 'react'
import DateRangeFilter, { type RangeKey } from '@/components/DateRangeFilter'
import WeightChart from '@/components/WeightChart'
import AdherenceChart from '@/components/AdherenceChart'
import CalendarMonth from '@/components/CalendarMonth'
import { lastNDays, monthGrid } from '@/lib/data/dates'
import { MOCK_DAYS, MOCK_GOAL, MOCK_WEIGHTS, TODAY } from '@/lib/data/mock'
import { adherence, burnedCalories, emptyDayLog, sumMacros } from '@/lib/data/selectors'
import styles from './trends.module.css'

export default function Trends() {
  const [range, setRange] = useState<RangeKey>(30)

  const days = useMemo(() => lastNDays(TODAY, range), [range])

  const weightPoints = useMemo(
    () => MOCK_WEIGHTS.filter((w) => days.includes(w.date)).map((w) => ({ date: w.date, kg: w.kg })),
    [days],
  )

  const adherencePoints = useMemo(
    () =>
      days.map((date) => ({
        date,
        ratio: adherence(MOCK_DAYS[date] ?? emptyDayLog(date), MOCK_GOAL),
      })),
    [days],
  )

  const cells = useMemo(() => monthGrid(2026, 9), [])

  // 月历上每个日期的四个环达标情况，顺序固定：热量、运动、蛋白质、碳水
  const ratiosByDate = useMemo(() => {
    const out: Record<string, number[]> = {}
    for (const date of cells) {
      if (!date) continue
      const day = MOCK_DAYS[date] ?? emptyDayLog(date)
      const macros = sumMacros(day.foods)
      out[date] = [
        MOCK_GOAL.calories > 0 ? Math.min(macros.calories / MOCK_GOAL.calories, 1) : 0,
        MOCK_GOAL.exerciseCalories > 0
          ? Math.min(burnedCalories(day) / MOCK_GOAL.exerciseCalories, 1)
          : 0,
        MOCK_GOAL.protein > 0 ? Math.min(macros.protein / MOCK_GOAL.protein, 1) : 0,
        MOCK_GOAL.carbs > 0 ? Math.min(macros.carbs / MOCK_GOAL.carbs, 1) : 0,
      ]
    }
    return out
  }, [cells])

  const [showWeightTable, setShowWeightTable] = useState(false)
  const [showAdherenceTable, setShowAdherenceTable] = useState(false)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>趋势</h1>

      {/* 唯一一处筛选行，位于两张图之上，一次切换同时作用于两者 */}
      <DateRangeFilter value={range} onChange={setRange} />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>体重</h2>
          <button
            type="button"
            className={styles.tableToggle}
            onClick={() => setShowWeightTable((v) => !v)}
          >
            {showWeightTable ? '隐藏' : '显示'}体重表格
          </button>
        </div>

        {showWeightTable ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>日期</th>
                <th>体重 (kg)</th>
              </tr>
            </thead>
            <tbody>
              {weightPoints.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td className="num-tabular">{p.kg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <WeightChart points={weightPoints} />
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>热量达标</h2>
          <button
            type="button"
            className={styles.tableToggle}
            onClick={() => setShowAdherenceTable((v) => !v)}
          >
            {showAdherenceTable ? '隐藏' : '显示'}达标表格
          </button>
        </div>

        {showAdherenceTable ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>日期</th>
                <th>达标率</th>
              </tr>
            </thead>
            <tbody>
              {adherencePoints.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td className="num-tabular">{Math.round(p.ratio * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <AdherenceChart points={adherencePoints} />
        )}
      </section>

      <section className={styles.card}>
        <CalendarMonth
          year={2026}
          month={9}
          cells={cells}
          ratiosByDate={ratiosByDate}
          today={TODAY}
        />
      </section>
    </main>
  )
}
