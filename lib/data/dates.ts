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
