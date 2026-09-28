import Link from 'next/link'
import HeroFigure from '@/components/HeroFigure'
import RingGroup, { type RingSpec } from '@/components/RingGroup'
import AiBadge from '@/components/AiBadge'
import { MOCK_GOAL, dayLogFor, weightFor } from '@/lib/data/mock'
import { burnedCalories, netCalories, sumMacros } from '@/lib/data/selectors'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { weekdayOf } from '@/lib/data/dates'
import styles from './day.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const WEEKDAY_LABEL = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

export default async function DayDetail({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params

  if (!isValidDateKey(date)) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>日期格式不正确。</p>
        <Link href="/calendar" className={styles.back}>
          回到日历
        </Link>
      </main>
    )
  }

  const day = dayLogFor(date)
  if (day === null) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>这一天你还没有开始使用。</p>
        <Link href="/calendar" className={styles.back}>
          回到日历
        </Link>
      </main>
    )
  }

  const macros = sumMacros(day.foods)
  const burned = burnedCalories(day)
  const net = netCalories(day)
  const weight = weightFor(date)

  const rings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: macros.calories, goal: MOCK_GOAL.calories, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: burned, goal: MOCK_GOAL.exerciseCalories, unit: '千卡' },
  ]

  const [, mm, dd] = date.split('-')

  return (
    <main className={styles.page}>
      <header className={styles.dateBar}>
        <Link href="/calendar" className={styles.back}>
          ‹ 日历
        </Link>
        <span className={styles.dateText}>
          {Number(mm)}月{Number(dd)}日 {WEEKDAY_LABEL[weekdayOf(date)]}
        </span>
        <span className={styles.spacer} />
      </header>

      <section className={styles.card}>
        <RingGroup
          rings={rings}
          center={<HeroFigure label="净热量" value={String(net)} unit="千卡" />}
        />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>饮食</h2>
        <ul className={styles.list}>
          {SLOTS.map((slot) => {
            const foods = day.foods.filter((f) => f.slot === slot)
            const calories = foods.reduce((s, f) => s + f.totals.calories, 0)
            return (
              <li key={slot} className={styles.row}>
                <span className={styles.rowName}>{MEAL_SLOT_LABEL[slot]}</span>
                <span className={styles.rowTags}>
                  {foods.some((f) => f.source === 'ai-estimate') && <AiBadge />}
                </span>
                <span className={`${styles.rowMeta} num-tabular`}>
                  {foods.length === 0 ? '未记录' : `${calories} 千卡`}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>运动</h2>
        {day.exercises.length === 0 ? (
          <p className={styles.empty}>这一天没有运动记录。</p>
        ) : (
          <ul className={styles.list}>
            {day.exercises.map((e) => (
              <li key={e.id} className={styles.row}>
                <span className={styles.rowName}>{e.name}</span>
                <span className={`${styles.rowMeta} num-tabular`}>
                  {e.kind === 'cardio' ? `${e.minutes} 分钟 · ` : `${e.sets?.length ?? 0} 组 · `}
                  -{e.caloriesBurned}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>空腹体重</h2>
        {weight !== null ? (
          <p className={styles.weight}>
            <span className={`${styles.weightValue} num`}>{weight} kg</span>
          </p>
        ) : (
          <p className={styles.empty}>这一天没有体重记录。</p>
        )}
      </section>
    </main>
  )
}
