import HeroFigure from '@/components/HeroFigure'
import RingGroup, { type RingSpec } from '@/components/RingGroup'
import AiBadge from '@/components/AiBadge'
import { MOCK_PLAN, MOCK_GOAL, TODAY, dayLogFor, weightFor, recentWeights } from '@/lib/data/mock'
import { burnedCalories, netCalories, sumMacros } from '@/lib/data/selectors'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { weekdayOf } from '@/lib/data/dates'
import styles from './page.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function Home() {
  const day = dayLogFor(TODAY)

  // TODAY 必然在用户使用范围内，因此这里不会是 null。
  // 写成守卫而不是断言，是为了在数据层被改动时给出明确的空态而不是崩溃。
  if (day === null) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>今天没有记录。</p>
      </main>
    )
  }

  const macros = sumMacros(day.foods)
  const burned = burnedCalories(day)
  const net = netCalories(day)

  const rings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: macros.calories, goal: MOCK_GOAL.calories, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: burned, goal: MOCK_GOAL.exerciseCalories, unit: '千卡' },
  ]

  const weights = recentWeights(2)
  const todayWeight = weightFor(TODAY)
  const prevWeight = weights.length >= 2 ? weights[weights.length - 2].kg : null
  const delta =
    todayWeight !== null && prevWeight !== null
      ? Math.round((todayWeight - prevWeight) * 10) / 10
      : null

  const todayPlan = MOCK_PLAN.find((p) => p.weekday === weekdayOf(TODAY))

  const slotCalories = (slot: MealSlot) =>
    day.foods.filter((f) => f.slot === slot).reduce((s, f) => s + f.totals.calories, 0)

  return (
    <main className={styles.page}>
      <header className={styles.dateBar}>
        <span className={styles.dateText}>9月22日 周二</span>
      </header>

      <section className={styles.card}>
        <RingGroup
          rings={rings}
          center={<HeroFigure label="净热量" value={String(net)} unit="千卡" />}
        />
      </section>

      {todayPlan && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>今天该练 · {todayPlan.theme}</h2>
          </div>
          {todayPlan.items.length === 0 ? (
            <p className={styles.empty}>今天休息，好好恢复。</p>
          ) : (
            <ul className={styles.list}>
              {todayPlan.items.map((item) => (
                <li key={item.name} className={styles.row}>
                  <span className={styles.rowName}>{item.name}</span>
                  <span className={`${styles.rowMeta} num-tabular`}>
                    {item.sets} × {item.reps}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>今日饮食</h2>
        </div>
        <ul className={styles.list}>
          {SLOTS.map((slot) => {
            const foods = day.foods.filter((f) => f.slot === slot)
            const calories = slotCalories(slot)
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
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>今日运动</h2>
        </div>
        {day.exercises.length === 0 ? (
          <p className={styles.empty}>今天还没有运动记录。</p>
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
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>今日空腹体重</h2>
        </div>
        {todayWeight !== null ? (
          <p className={styles.weight}>
            <span className={`${styles.weightValue} num`}>{todayWeight} kg</span>
            {/* 涨跌只显示方向与数值，不使用成功/危险色 */}
            <span className={`${styles.weightDelta} num-tabular`}>
              {delta === null
                ? '—'
                : delta > 0
                  ? `↑${delta}`
                  : delta < 0
                    ? `↓${Math.abs(delta)}`
                    : '持平'}
            </span>
          </p>
        ) : (
          <p className={styles.empty}>
            今日未记录
            {weights.length > 0 && (
              <span className={styles.lastWeight}>
                （最近一次 {weights[weights.length - 1].kg} kg · {weights[weights.length - 1].date}）
              </span>
            )}
          </p>
        )}
        <p className={styles.hint}>建议起床后、进食前测量</p>
      </section>
    </main>
  )
}
