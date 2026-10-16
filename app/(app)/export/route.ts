import { requireUser } from '@/lib/auth/current-user'
import { today } from '@/lib/data/today'
import { userExportData } from '@/lib/db/queries'
import { getDb } from '@/lib/db/runtime'

// 每次请求都现取数据：数据来自数据库、用户来自会话，
// 不加这一行会被构建期预渲染成一份冻住的响应。
export const dynamic = 'force-dynamic'

/**
 * 「导出我的记录」：当前登录用户的全部数据，JSON 下载。
 *
 * 只导出**当前用户**——requireUser 从会话拿人，然后所有查询都带
 * user_id 条件；别人的数据在这条路径上根本取不出来。
 */
export async function GET(): Promise<Response> {
  const db = getDb()
  const user = await requireUser(db)

  const data = await userExportData(db, user)

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="fitchat-export-${today()}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
