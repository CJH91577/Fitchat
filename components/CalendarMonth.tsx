import Link from 'next/link'
import styles from './CalendarMonth.module.css'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 一天的两种状态之外还有第三种：这一天还没开始使用。
 * 它不是「达成」也不是「未达成」，界面必须能与后两者区分开。
 */
export type DayStatus = { calories: boolean; exercise: boolean; notStarted?: boolean }

export type CalendarMonthProps = {
  year: number
  month: number
  cells: (string | null)[]
  statusByDate: Record<string, DayStatus>
  today: string
}

const DAY_LABEL = ['热量', '运动'] as const

export default function CalendarMonth({
  year,
  month,
  cells,
  statusByDate,
  today,
}: CalendarMonthProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {year} 年 {month} 月
      </div>

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

          // 尚未开始使用：不可点（点进去只会看到一句空话），也不画状态点
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
              aria-label={`${date}，热量${flags[0] ? '达成' : '未达成'}，运动${flags[1] ? '达成' : '未达成'}`}
            >
              <span className={`${styles.dayNum} num-tabular`}>{dayNum}</span>
              <span className={styles.dots}>
                {DAY_LABEL.map((label, index) => (
                  // 实心 / 空心 是不依赖颜色的第二通道；位置顺序固定，颜色只作强化
                  <span
                    key={label}
                    data-ring={label}
                    className={`${styles.dot} ${flags[index] ? styles.dotDone : ''}`}
                    style={
                      {
                        '--dot-color':
                          index === 0 ? 'var(--ring-calories)' : 'var(--ring-exercise)',
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            </Link>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span
            className={`${styles.dot} ${styles.dotDone}`}
            style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties}
          />
          达成
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.dot}
            style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties}
          />
          未达成
        </span>
        <span className={styles.legendItem}>左点 = 热量 · 右点 = 运动</span>
        <span className={styles.legendItem}>尚未开始使用</span>
      </div>
    </div>
  )
}
