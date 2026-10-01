import Link from 'next/link'
import styles from './CalendarMonth.module.css'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 一天的三种状态：达成、未达成、以及这一天还没开始使用。
 * 最后一种不是前两种的任何一种，界面必须能区分。
 */
export type DayStatus = { calories: boolean; exercise: boolean; notStarted?: boolean }

export type CalendarMonthProps = {
  cells: (string | null)[]
  statusByDate: Record<string, DayStatus>
  today: string
}

// 顺序固定：上=热量、下=运动。图例已去掉，身份由位置与颜色共同承载。
const BARS = [
  { label: '热量', colorVar: 'var(--ring-calories)' },
  { label: '运动', colorVar: 'var(--ring-exercise)' },
] as const

export default function CalendarMonth({ cells, statusByDate, today }: CalendarMonthProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.weekdays}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className={styles.emptyCell} />

          const dayNum = Number(date.slice(-2))
          const isToday = date === today
          const status = statusByDate[date] ?? { calories: false, exercise: false }
          const flags = [status.calories, status.exercise]

          // 尚未开始使用：不可点（点进去只会看到一句空话），也不画读条
          // （画了就与「当天未达成」长得一样）。
          if (status.notStarted) {
            return (
              <div
                key={date}
                className={`${styles.cell} ${styles.notStarted}`}
                data-testid="not-started-cell"
                aria-label={`${date}，尚未开始使用`}
              >
                <span className={`${styles.dayNum} num-tabular`}>{dayNum}</span>
              </div>
            )
          }

          return (
            <Link
              key={date}
              href={`/day/${date}`}
              className={`${styles.cell} ${isToday ? styles.today : ''}`}
              // 图例去掉后，达成与否只靠颜色与填充表达；无障碍名称是替文字读者保留的通道
              aria-label={`${date}，热量${flags[0] ? '达成' : '未达成'}，运动${flags[1] ? '达成' : '未达成'}`}
            >
              <span className={`${styles.dayNum} num-tabular`}>{dayNum}</span>
              <span className={styles.bars}>
                {BARS.map((bar, index) => (
                  <span
                    key={bar.label}
                    data-bar={bar.label}
                    className={`${styles.bar} ${flags[index] ? styles.barDone : ''}`}
                    style={{ '--bar-color': bar.colorVar } as React.CSSProperties}
                  />
                ))}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
