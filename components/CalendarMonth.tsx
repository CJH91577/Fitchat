import styles from './CalendarMonth.module.css'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export type CalendarMonthProps = {
  year: number
  month: number
  cells: (string | null)[]
  /** 每个日期对应四个环的达标情况，顺序固定：热量、运动、蛋白质、碳水 */
  ratiosByDate: Record<string, number[]>
  today: string
}

const RING_ORDER = ['热量', '运动', '蛋白质', '碳水'] as const

export default function CalendarMonth({
  year,
  month,
  cells,
  ratiosByDate,
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
          const ratios = ratiosByDate[date] ?? [0, 0, 0, 0]
          const isToday = date === today

          return (
            <div key={date} className={`${styles.cell} ${isToday ? styles.today : ''}`}>
              <span className={`${styles.dayNum} num-tabular`}>{dayNum}</span>
              <span className={styles.dots}>
                {RING_ORDER.map((name, ringIndex) => {
                  // 实心 / 空心 是非颜色的第二通道；位置顺序固定，颜色只作强化
                  const done = (ratios[ringIndex] ?? 0) >= 1
                  return (
                    <span
                      key={name}
                      data-ring={name}
                      title={`${name}：${done ? '达成' : '未达成'}`}
                      className={`${styles.dot} ${done ? styles.dotDone : ''}`}
                      style={
                        {
                          '--dot-color': [
                            'var(--ring-calories)',
                            'var(--ring-exercise)',
                            'var(--ring-protein)',
                            'var(--ring-carbs)',
                          ][ringIndex],
                        } as React.CSSProperties
                      }
                    />
                  )
                })}
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotDone}`} style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties} />
          达成
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties} />
          未达成
        </span>
      </div>
    </div>
  )
}
