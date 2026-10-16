import { eq, lt } from 'drizzle-orm'
import type { Db } from '../db'
import { loginAttempts } from '../db/schema'

/**
 * 登录/注册的失败频率限制：一个计数键在窗口内失败到上限，就拒绝到窗口结束。
 *
 * 规则刻意不放在 accounts.ts 里、也不放在 actions.ts 里：这里只有
 * 「窗口、上限、计数」三件事，可以用普通函数测，不需要请求上下文。
 * 键是 `ip:<地址>` 或 `email:<邮箱>`（见 attemptKey）——限流针对的是
 * 「谁在试」，没注册过的邮箱与没有账号的 IP 也要能计数。
 *
 * 计数落在库里而不是内存里：单实例内存计数重启即失效，而容器每次部署
 * 都会重启——一个「重启就作废」的限流等于没有。
 *
 * 固定窗口（从第一次失败起算），窗口一过整行重置复用；过期的其它键
 * 在记失败时顺手清掉，表不会无界增长。
 */

export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
export const ATTEMPT_LIMIT = 10

export const RATE_LIMITED_MESSAGE = '尝试次数过多，请稍后再试。'

export function attemptKey(kind: 'ip' | 'email', value: string): string {
  return `${kind}:${value}`
}

/** 这个键在窗口内是否已经到上限 */
export async function isRateLimited(db: Db, key: string, now: number = Date.now()): Promise<boolean> {
  const row = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get()
  if (!row) return false
  if (now - row.windowStartedAt.getTime() >= ATTEMPT_WINDOW_MS) return false
  return row.count >= ATTEMPT_LIMIT
}

/** 记一次失败；窗口已过则整行重置后从 1 开始 */
export async function recordFailure(db: Db, key: string, now: number = Date.now()): Promise<void> {
  const row = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get()
  const fresh = !row || now - row.windowStartedAt.getTime() >= ATTEMPT_WINDOW_MS

  if (fresh) {
    await db
      .insert(loginAttempts)
      .values({ key, windowStartedAt: new Date(now), count: 1 })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: { windowStartedAt: new Date(now), count: 1 },
      })
      .run()
  } else {
    await db
      .update(loginAttempts)
      .set({ count: row.count + 1 })
      .where(eq(loginAttempts.key, key))
      .run()
  }

  // 顺手清掉已经出窗口的其它键（它们的行已经没意义了）
  await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.windowStartedAt, new Date(now - ATTEMPT_WINDOW_MS)))
    .run()
}

/** 成功后清零：一次成功登录不该累积成下一次的锁定 */
export async function clearFailures(db: Db, key: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key)).run()
}
