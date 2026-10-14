import { createHash, randomBytes } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import type { Db } from '../db'
import { type DbUser, userById } from '../db/queries'
import { sessions } from '../db/schema'

/**
 * 会话。
 *
 * 两条规矩，都是从「库被读走」这个前提倒推出来的：
 *
 *   1. **库里存的是令牌的 SHA-256，不是令牌本身。** 拿到库文件的人可以直接
 *      伪造一行 session，但伪造出来的 id 是哈希，而哈希**不能**当令牌用——
 *      令牌必须能被 SHA-256 还原成这一行。所以库泄漏不等于账号被接管。
 *   2. 令牌是 32 字节随机数（base64url 43 个字符），不是可猜的 id + 时间戳。
 *
 * 令牌用随机数而不是签名（JWT 那一套）：签名令牌没法在服务端撤销，
 * 退出登录就只能等它自己过期。这里有一个 sessions 表，退出即删除。
 */

export const SESSION_COOKIE = 'fitchat_session'

/** 30 天。短期演示站不需要滑动续期，过期就重新登录。 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const TOKEN_BYTES = 32

export function newSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** 库里只留哈希。用 SHA-256 而不是慢哈希：令牌本身就是高熵随机数，不需要抗暴力破解 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type CreatedSession = { token: string; expiresAt: Date }

export async function createSession(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<CreatedSession> {
  const token = newSessionToken()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  await db
    .insert(sessions)
    .values({ id: hashSessionToken(token), userId, expiresAt, createdAt: now })
    .run()

  return { token, expiresAt }
}

/**
 * 令牌 → 用户。拿不到就返回 null（没登录、令牌错、会话过期都走这一条）。
 *
 * 分两次查询而不是 JOIN：一次按主键取会话，一次按主键取用户。这两条都是
 * 索引命中的单行查询，而 sessions 的行结构因此不必泄漏到上层去。
 */
export async function userBySessionToken(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<DbUser | null> {
  if (token === '') return null

  const id = hashSessionToken(token)
  const row = await db.select().from(sessions).where(eq(sessions.id, id)).get()
  if (!row) return null

  if (row.expiresAt.getTime() <= now.getTime()) {
    // 过期的会话顺手删掉：它留着只会让「谁还登录着」这个问题越来越难看
    await db.delete(sessions).where(eq(sessions.id, id)).run()
    return null
  }

  return userById(db, row.userId)
}

/** 退出登录：删掉这一条会话，其他设备上的会话不受影响 */
export async function deleteSession(db: Db, token: string): Promise<void> {
  if (token === '') return
  await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token))).run()
}

/**
 * 清理过期会话。
 *
 * 单靠「用到时顺手删」不够：没人再拿那个令牌来，那行就永远留着。
 * 在登录时清一次——登录是天然的、频率有界的触发点，不必再引入定时任务。
 */
export async function deleteExpiredSessions(db: Db, now: Date = new Date()): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now)).run()
}
