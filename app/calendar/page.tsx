'use client'

import { useState } from 'react'
import CalendarMonth, { type DayStatus } from '@/components/CalendarMonth'
import { monthGrid } from '@/lib/data/dates'
import { MOCK_GOAL, MOCK_USER, TODAY, dayLogFor } from '@/lib/data/mock'
import { isCalorieOnTarget, isExerciseOnTarget, isInRange, isUpcoming } from '@/lib/data/selectors'
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

  // 该月是否整体早于开始使用日期、或整体晚于今天。
  // 两种情况都渲染成一句说明而不是一张空网格——一整屏灰格子看起来像坏掉了。
  const firstCell = cells.find((c) => c !== null) ?? null
  const lastCell = [...cells].reverse().find((c) => c !== null) ?? null
  const monthIsOutOfRange = lastCell !== null && !isInRange(lastCell, MOCK_USER.startedAt)
  const monthIsUpcoming = firstCell !== null && isUpcoming(firstCell, TODAY)

  const statusByDate: Record<string, DayStatus> = {}
  for (const date of cells) {
    if (!date) continue

    // 未来的日期要最先判掉。数据层对「晚于今天」的日子照样能算出内容——
    // dayLogFor 只判断「不早于开始使用日期」——但那些内容不该出现在界面上，
    // 尤其不能渲染成链接：构建时只预渲染到今天，「今天之后」的详情页从未
    // 存在过，点进去只会是 404。实测过：整个月 31 个链接里有 19 个是死链。
    if (isUpcoming(date, TODAY)) {
      statusByDate[date] = { calories: false, exercise: false, upcoming: true }
      continue
    }

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
      ) : monthIsUpcoming ? (
        <p className={styles.empty}>这个月还没有到。</p>
      ) : (
        // 这层包裹负责吃掉剩余高度，网格才能铺满——宽高都由它决定
        <div className={styles.calendarArea}>
          <CalendarMonth cells={cells} statusByDate={statusByDate} today={TODAY} />
        </div>
      )}
    </main>
  )
}
