import { redirect } from 'next/navigation'
import type { Db } from '../db'
import type { DbUser } from '../db/queries'
import { getDb } from '../db/runtime'
import { readSessionToken } from './cookie'
import { userBySessionToken } from './session'

/**
 * 「当前登录的是谁」——页面里唯一该问这个问题的地方。
 *
 * 阶段 2 时页面拿的是 getDemoUser()：库里只有一个人，直接按常量取。现在
 * 用户来自会话，于是页面代码里 `getDemoUser(db)` 换成 `requireUser()`，
 * 其余一行都不用改（查询、组件、样式都不关心用户是怎么来的）。
 */

/** 没登录返回 null。给登录页这种「登录了就不该在这」的地方用 */
export async function getCurrentUser(db: Db = getDb()): Promise<DbUser | null> {
  const token = await readSessionToken()
  if (token === null) return null
  return userBySessionToken(db, token)
}

/**
 * 数据页面的入口守卫：没登录直接跳登录页，登录了返回这个用户。
 *
 * 刻意是「每个数据页自己在第一行调用」而不是只靠某个外层守卫：
 * 新增一个页面时忘了加守卫的后果是数据泄漏，而不是一个显眼的报错。
 * 这种「忘掉就出事」的默认值不能靠自觉——有 tests/auth-guard.test.ts
 * 逐页检查每个读库的页面都调用了它。
 */
export async function requireUser(db: Db = getDb()): Promise<DbUser> {
  const user = await getCurrentUser(db)
  if (user === null) redirect('/login')
  return user
}
