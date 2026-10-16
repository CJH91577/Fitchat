'use server'

import type { DayResult } from '@/components/CalendarView'
import { requireUser } from '@/lib/auth/current-user'
import { goalFor } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import { monthResults } from './month-results'

/**
 * 日历翻月时按需取数。
 *
 * 以前整段区间（约 390 天 × 两个布尔值）随首屏一起下发，手机弱网下
 * 这是全站最大的页面。现在首屏只带当月，翻到哪个月才取哪个月；
 * 还没到的月份与开始使用之前的月份由视图自己渲染说明文字，
 * 根本不会走到这里。
 */
export async function fetchMonthResults(
  year: number,
  month: number,
): Promise<Record<string, DayResult>> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return {}
  if (!Number.isInteger(month) || month < 1 || month > 12) return {}

  const db = getDb()
  const user = await requireUser(db)
  const goal = await goalFor(db, user.id)
  return monthResults(db, user, goal, year, month)
}
