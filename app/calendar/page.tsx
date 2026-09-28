'use client'

import { useState } from 'react'
import CalendarMonth, { type DayStatus } from '@/components/CalendarMonth'
import { monthGrid } from '@/lib/data/dates'
import { MOCK_GOAL, MOCK_USER, TODAY, dayLogFor } from '@/lib/data/mock'
import { hasRecord, isCalorieOnTarget, isExerciseOnTarget } from '@/lib/data/selectors'
import styles from './calendar.module.css'

export default function Calendar({
  initialYear = 2026,
  initialMonth = 9,
}: {
  initialYear?: number
  initialMonth?: number
}) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)

  const cells = monthGrid(year, month)

  // 该月是否整体早于用户的开始使用日期
  const lastCell = [...cells].reverse().find((c) => c !== null) ?? null
  const monthIsOutOfRange = lastCell !== null && !hasRecord(lastCell, MOCK_USER.startedAt)

  const statusByDate: Record<string, DayStatus> = {}
  for (const date of cells) {
    if (!date) continue
    const day = dayLogFor(date)
    statusByDate[date] =
      day === null
        ? { calories: false, exercise: false }
        : {
            calories: isCalorieOnTarget(day, MOCK_GOAL),
            exercise: isExerciseOnTarget(day, MOCK_GOAL),
          }
  }

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>日历</h1>

      <div className={styles.monthNav}>
        <button type="button" className={styles.navButton} onClick={prevMonth} aria-label="上个月">
          ‹
        </button>
        <span className={styles.monthLabel}>
          {year} 年 {month} 月
        </span>
        <button type="button" className={styles.navButton} onClick={nextMonth} aria-label="下个月">
          ›
        </button>
      </div>

      {monthIsOutOfRange ? (
        <p className={styles.empty}>这个月还没有开始使用。</p>
      ) : (
        <CalendarMonth
          year={year}
          month={month}
          cells={cells}
          statusByDate={statusByDate}
          today={TODAY}
        />
      )}
    </main>
  )
}
