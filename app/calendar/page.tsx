'use client'

import { useState } from 'react'
import CalendarMonth, { type DayStatus } from '@/components/CalendarMonth'
import { monthGrid } from '@/lib/data/dates'
import { MOCK_GOAL, MOCK_USER, TODAY, dayLogFor } from '@/lib/data/mock'
import { isCalorieOnTarget, isExerciseOnTarget, isInRange } from '@/lib/data/selectors'
import styles from './calendar.module.css'

export default function Calendar({
  initialYear,
  initialMonth,
}: {
  initialYear?: number
  initialMonth?: number
}) {
  // 默认落在「今天」所在的月份。默认值由 TODAY 推导而不是写死 2026/9——
  // 写死的话，一旦 TODAY 变了，这里会与首页和月历高亮各说各话。
  const todayYear = Number(TODAY.slice(0, 4))
  const todayMonth = Number(TODAY.slice(5, 7))
  const [year, setYear] = useState(initialYear ?? todayYear)
  const [month, setMonth] = useState(initialMonth ?? todayMonth)

  const cells = monthGrid(year, month)

  // 该月是否整体早于用户的开始使用日期
  const lastCell = [...cells].reverse().find((c) => c !== null) ?? null
  const monthIsOutOfRange = lastCell !== null && !isInRange(lastCell, MOCK_USER.startedAt)

  const statusByDate: Record<string, DayStatus> = {}
  for (const date of cells) {
    if (!date) continue
    const day = dayLogFor(date)
    statusByDate[date] =
      day === null
        ? { calories: false, exercise: false, notStarted: true }
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
        // 这层包裹负责吃掉剩余高度，网格才能铺满——宽高都由它决定
        <div className={styles.calendarArea}>
          <CalendarMonth cells={cells} statusByDate={statusByDate} today={TODAY} />
        </div>
      )}
    </main>
  )
}
