'use client'

import { useEffect, useState } from 'react'
import CalendarMonth, { type DayStatus } from './CalendarMonth'
import { fetchMonthResults } from '@/app/(app)/calendar/actions'
import { monthGrid } from '@/lib/data/dates'
import { isInRange, isUpcoming } from '@/lib/data/selectors'
import styles from './CalendarView.module.css'

/** 服务端算好的、某一天是否达成 */
export type DayResult = { calories: boolean; exercise: boolean }

export type CalendarViewProps = {
  /** 演示里的「今天」 */
  today: string
  /** 开始使用日期；早于它的日子是「尚未开始使用」 */
  startedAt: string
  /**
   * **首月**（今天所在月）的达成情况，随首屏一起送过来。
   * 其它月份不再随页面下发——翻到哪个月，才按需取哪个月
   *（见 app/(app)/calendar/actions.ts）。取回来之前的月份
   * 先按「未达成」渲染，与服务端没送数据的旧行为一致。
   */
  initialDayResults: Record<string, DayResult>
  /** 仅供测试：直接落到某个月 */
  initialYear?: number
  initialMonth?: number
}

function monthKey(year: number, month: number): string {
  return `${year}-${month}`
}

export default function CalendarView({
  today,
  startedAt,
  initialDayResults,
  initialYear,
  initialMonth,
}: CalendarViewProps) {
  // 默认落在「今天」所在的月份。默认值由 today 推导而不是写死——
  // 写死的话，一旦「今天」变了，这里会与首页和月历高亮各说各话。
  const [year, setYear] = useState(initialYear ?? Number(today.slice(0, 4)))
  const [month, setMonth] = useState(initialMonth ?? Number(today.slice(5, 7)))

  const [resultsByMonth, setResultsByMonth] = useState<
    Record<string, Record<string, DayResult>>
  >({ [monthKey(year, month)]: initialDayResults })
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(
    () => new Set([monthKey(year, month)]),
  )

  const cells = monthGrid(year, month)

  // 该月是否整体早于开始使用日期、或整体晚于今天。
  // 两种情况都渲染成一句说明而不是一张空网格——一整屏灰格子看起来像坏掉了。
  const firstCell = cells.find((c) => c !== null) ?? null
  const lastCell = [...cells].reverse().find((c) => c !== null) ?? null
  const monthIsOutOfRange = lastCell !== null && !isInRange(lastCell, startedAt)
  const monthIsUpcoming = firstCell !== null && isUpcoming(firstCell, today)

  // 翻月后按需取数：还没到的月份与开始使用之前的月份不需要数据，
  // 取回来的结果补进当前月的网格（在 .then 里 setState——外部数据
  // 到达的回调，不是 effect 体内的同步 setState）。
  useEffect(() => {
    if (monthIsOutOfRange || monthIsUpcoming) return
    const key = monthKey(year, month)
    if (loadedMonths.has(key)) return

    let cancelled = false
    fetchMonthResults(year, month).then((results) => {
      if (cancelled) return
      setResultsByMonth((previous) => ({ ...previous, [key]: results }))
      setLoadedMonths((previous) => new Set(previous).add(key))
    })
    return () => {
      cancelled = true
    }
  }, [year, month, monthIsOutOfRange, monthIsUpcoming, loadedMonths])

  /**
   * 三种状态在这里合流。顺序不能换：
   *   1. 早于开始使用 —— 那天用户还没开始用
   *   2. 晚于今天     —— 那天还没到（尤其不能渲染成链接：构建时只为今天之前
   *                      的每一天生成了页面，点进去是 404；线上实测过整个月
   *                      31 个链接里 19 个是死链）
   *   3. 其余         —— 查服务端算好的达成情况
   */
  const statusFor = (date: string): DayStatus => {
    if (!isInRange(date, startedAt)) return { calories: false, exercise: false, notStarted: true }
    if (isUpcoming(date, today)) return { calories: false, exercise: false, upcoming: true }
    return (resultsByMonth[monthKey(year, month)] ?? {})[date] ?? {
      calories: false,
      exercise: false,
    }
  }

  const statusByDate: Record<string, DayStatus> = {}
  for (const date of cells) {
    if (!date) continue
    statusByDate[date] = statusFor(date)
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
    <>
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
          <CalendarMonth cells={cells} statusByDate={statusByDate} today={today} />
        </div>
      )}
    </>
  )
}
