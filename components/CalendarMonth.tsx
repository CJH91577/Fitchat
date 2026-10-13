import Link from 'next/link'
import styles from './CalendarMonth.module.css'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 一天的四种状态：达成、未达成，以及两种不可点的日子——
 * 「开始使用之前」（notStarted）与「还没到的将来」（upcoming）。
 *
 * 后两种都不是「未达成」：未达成是有记录但没达标，会长成有底色、有灰色
 * 空轨道的样子；这两种是压根没有那一天的内容，界面必须能区分。
 */
export type DayStatus = {
  calories: boolean
  exercise: boolean
  notStarted?: boolean
  upcoming?: boolean
}

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

          // 两种不可点的日子共用同一份视觉（不可点、不画读条），但无障碍名称
          // 分开：不画读条是因为画了就与「当天未达成」长得一样；不可点是因为
          // 点进去要么只有一句空话（尚未开始使用），要么直接是 404（还没到）。
          if (status.notStarted || status.upcoming) {
            const notStarted = Boolean(status.notStarted)
            return (
              <div
                key={date}
                className={`${styles.cell} ${styles.inactive}`}
                data-testid={notStarted ? 'not-started-cell' : 'upcoming-cell'}
                aria-label={`${date}，${notStarted ? '尚未开始使用' : '还没到'}`}
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
