import { requireUser } from '@/lib/auth/current-user'
import { weekdayOf } from '@/lib/data/dates'
import { today } from '@/lib/data/today'
import { dayLogFor, planFor } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'
import WorkoutForm from './WorkoutForm'
import type { PlanHint, TodayExercise } from './types'

/**
 * 记录运动页。
 *
 * 服务端只做两件事：取出**今天**该练什么（训练计划里今天那一行）与今天已经
 * 记了什么。计划只当预填用——用户实际做几组、多重，由他自己填。
 */
export const dynamic = 'force-dynamic'

export default async function NewWorkout() {
  const db = getDb()
  const user = await requireUser(db)
  const date = today()

  const [plan, day] = await Promise.all([planFor(db, user.id), dayLogFor(db, user, date)])

  const todayPlan = plan.find((day) => day.weekday === weekdayOf(date))
  // 休息日（items 为空）也要传下去：那天什么都不显示，看起来像功能坏了。
  // 预填按钮只对非空的 items 渲染，休息态由表单自己说「今天计划是休息」。
  const planHint: PlanHint | null = todayPlan
    ? {
        theme: todayPlan.theme,
        items: todayPlan.items.map((item) => ({
          name: item.name,
          sets: item.sets,
          reps: item.reps,
        })),
      }
    : null

  const entries: TodayExercise[] = (day?.exercises ?? []).map((exercise) => ({
    id: exercise.id,
    kind: exercise.kind,
    name: exercise.name,
    minutes: exercise.minutes ?? null,
    setCount: exercise.sets?.length ?? 0,
    caloriesBurned: exercise.caloriesBurned,
  }))

  return <WorkoutForm plan={planHint} entries={entries} />
}
