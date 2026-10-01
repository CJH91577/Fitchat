import Link from 'next/link'
import HeroFigure from '@/components/HeroFigure'
import RingGroup, { type RingSpec } from '@/components/RingGroup'
import AiBadge from '@/components/AiBadge'
import { MOCK_GOAL, MOCK_USER, TODAY, datesWithRecords, dayLogFor, weightFor } from '@/lib/data/mock'
import { burnedCalories, netCalories, sumMacros } from '@/lib/data/selectors'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { formatDayHeading } from '@/lib/data/dates'
import styles from './day.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

/**
 * 预渲染从开始使用日期到今天的每一天。
 *
 * 这些页面本来就完全由日期决定、内容不随请求变化，没必要每次请求现算。
 * 更实际的理由是：将来切到静态导出（output: 'export'）时没有服务端，
 * 所有路径必须在构建时就列出来，否则它们会直接 404。
 *
 * 「今天」在构建时确定，所以覆盖范围会随每次构建往前推进——这也是需要
 * 定时重建的原因之一（见 .github/workflows/nightly-rebuild.yml）。
 */
export function generateStaticParams(): { date: string }[] {
  return datesWithRecords(MOCK_USER.startedAt, TODAY).map((date) => ({ date }))
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

  return (
    <main className={styles.page}>
      <header className={styles.dateBar}>
        <Link href="/calendar" className={styles.back}>
          ‹ 日历
        </Link>
        <span className={styles.dateText}>{formatDayHeading(date)}</span>
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
