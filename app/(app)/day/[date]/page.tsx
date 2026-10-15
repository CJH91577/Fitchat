import Link from 'next/link'
import HeroFigure from '@/components/HeroFigure'
import RingGroup, { type RingSpec } from '@/components/RingGroup'
import AiBadge from '@/components/AiBadge'
import WeightForm from '../../WeightForm'
import { today } from '@/lib/data/today'
import { formatDayHeading, isValidDateKey } from '@/lib/data/dates'
import { burnedCalories, isUpcoming, netCalories, sumMacros } from '@/lib/data/selectors'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { dayLogFor, goalFor, weightFor } from '@/lib/db/queries'
import { requireUser } from '@/lib/auth/current-user'
import { getDb } from '@/lib/db/runtime'
import styles from './day.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * 某日详情页。
 *
 * 这里以前有一个 generateStaticParams，把「开始使用日期 → 今天」的每一天
 * 预渲染成静态页面——那是静态导出（output: 'export'）的硬要求：没有服务端，
 * 所有路径必须在构建时列出来。代价是数据与「今天」一起被冻在构建那一刻。
 *
 * 现在服务端每次请求现算：任意一天的详情页都能打开，内容取自数据库当前值，
 * 「今天」也跟着真实日期走。每次请求多几个索引查询，这个体量下可以忽略。
 */
export const dynamic = 'force-dynamic'

export default async function DayDetail({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  // 请求期取「今天」：服务端每次渲染都重新算（见 lib/data/today.ts）
  const TODAY = today()

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

  // 「还没到」的日子不该渲染成「空的一天」——前者是那天不存在内容，
  // 后者是用户那天没记东西，两者在界面上必须说得不一样。
  // 这与日历上不可点的未来格子是同一件事的两面。
  if (isUpcoming(date, TODAY)) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>这一天还没有到。</p>
        <Link href="/calendar" className={styles.back}>
          回到日历
        </Link>
      </main>
    )
  }

  const db = getDb()
  // 没登录直接跳登录页（requireUser 内部会 redirect）
  const user = await requireUser(db)

  // dayLogFor 返回 null 表示「那一天用户还没开始用」，与「那天没记东西」
  //（返回空数组）是两种状态，界面上说法也不同。
  const day = await dayLogFor(db, user, date)
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

  // 还没设目标时给 0：RingGroup 会把 goal 为 0 的环画成「未设定」，
  // 而不是画一个填满的环或算出 NaN。
  const goal = await goalFor(db, user.id)

  const macros = sumMacros(day.foods)
  const burned = burnedCalories(day)
  const net = netCalories(day)
  const weight = await weightFor(db, user, date)

  const rings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: macros.calories, goal: goal?.calories ?? 0, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: burned, goal: goal?.exerciseCalories ?? 0, unit: '千卡' },
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
        {/* 过去的某一天也能在这里补记：日期默认就是页面那天，未来不许 */}
        <WeightForm currentKg={weight} date={date} minDate={user.startedAt} maxDate={TODAY} />
      </section>
    </main>
  )
}
