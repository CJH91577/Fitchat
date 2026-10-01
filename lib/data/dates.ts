// 全部使用本地时区日期分量构造，不经过 UTC，避免跨零点偏移
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(key: string, delta: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
}

// 1 = 周一 … 7 = 周日
export function weekdayOf(key: string): number {
  const jsDay = parseKey(key).getDay() // 0 = 周日
  return jsDay === 0 ? 7 : jsDay
}

export function lastNDays(endKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(endKey, i - (n - 1)))
}

// 周一为一周之首；月首之前的空位用 null 填充
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const lead = first.getDay() === 0 ? 6 : first.getDay() - 1

  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${pad(month)}-${pad(day)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

// 以本地时区的当日零点计算整日差，避免夏令时导致的 23/25 小时误差
export function daysBetween(fromKey: string, toKey: string): number {
  const a = parseKey(fromKey)
  const b = parseKey(toKey)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

// 「今天」的时区基准。产品面向中文用户，而部署环境（如 Vercel）默认跑在 UTC：
// 若按运行环境的本地时区取日期，北京时间 0 点到 8 点之间会算成昨天。
export const APP_TIME_ZONE = 'Asia/Shanghai'

/**
 * 「今天」的日期键（如 2026-10-01）。
 *
 * 时区固定为 APP_TIME_ZONE，而不是运行环境的时区。这一点是刻意的：
 * 预渲染在构建机上算出的「今天」，必须与浏览器里算出的「今天」一致，
 * 否则跨过零点时客户端首次渲染会与预渲染的 HTML 不符（hydration 报错）。
 *
 * now 参数只为测试注入固定时刻，正常调用不需要传。
 */
export function todayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// 下标即 weekdayOf 的返回值（1 = 周一 … 7 = 周日），故第 0 位留空。
// 写成数组而不是函数里的 switch，是为了让「下标与返回值对应」这件事一眼可见。
export const WEEKDAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

export function weekdayLabelOf(key: string): string {
  return WEEKDAY_LABELS[weekdayOf(key)]
}

/** 「10月1日」——不带星期，用于括号内的补充说明 */
export function formatMonthDay(key: string): string {
  const [, month, day] = key.split('-')
  return `${Number(month)}月${Number(day)}日`
}

/** 「10月1日 周四」——首页与某日详情页共用的日期标题写法 */
export function formatDayHeading(key: string): string {
  return `${formatMonthDay(key)} ${weekdayLabelOf(key)}`
}
