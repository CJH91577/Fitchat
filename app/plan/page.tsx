import { MOCK_PLAN, TODAY } from '@/lib/data/mock'
import { weekdayOf } from '@/lib/data/dates'
import styles from './plan.module.css'

const WEEKDAY_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function Plan() {
  const todayWeekday = weekdayOf(TODAY)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>训练计划</h1>

      <ul className={styles.days}>
        {MOCK_PLAN.map((day) => {
          const isToday = day.weekday === todayWeekday
          return (
            <li key={day.weekday} className={`${styles.day} ${isToday ? styles.today : ''}`}>
              <div className={styles.dayHead}>
                <span className={styles.weekday}>{WEEKDAY_LABEL[day.weekday - 1]}</span>
                <span className={styles.theme}>{day.theme}</span>
                {isToday && <span className={styles.todayTag}>今天</span>}
              </div>

              {day.items.length === 0 ? (
                <p className={styles.rest}>休息</p>
              ) : (
                <ul className={styles.items}>
                  {day.items.map((item) => (
                    <li key={item.name} className={styles.item}>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={`${styles.itemMeta} num-tabular`}>
                        {item.sets} 组 × {item.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
