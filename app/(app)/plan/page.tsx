import { today } from '@/lib/data/today'
import { weekdayOf } from '@/lib/data/dates'
import { planFor } from '@/lib/db/queries'
import { requireUser } from '@/lib/auth/current-user'
import { getDb } from '@/lib/db/runtime'
import PlanEditor from './PlanEditor'

// 每次请求都重新渲染：数据来自数据库，且「今天」要跟着真实日期走。
// 不加这一行，Next 会在构建时预渲染这些页面——数据被冻住，日期也一并冻住。
export const dynamic = 'force-dynamic'
export default async function Plan() {
  // 请求期取「今天」：服务端每次渲染都重新算（见 lib/data/today.ts）
  const TODAY = today()
  const db = getDb()
  // 没登录直接跳登录页（requireUser 内部会 redirect）
  const user = await requireUser(db)
  const plan = await planFor(db, user.id)
  const todayWeekday = weekdayOf(TODAY)

  // key 是计划数据的序列化：保存成功后 router.refresh() 会让服务端重渲染，
  // 数据一变整个编辑器重挂——浏览器里的编辑态随之退出，不需要手动重置。
  return <PlanEditor key={JSON.stringify(plan)} plan={plan} todayWeekday={todayWeekday} />
}
