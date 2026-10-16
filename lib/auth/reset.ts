import { randomBytes } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import type { Db } from '../db'
import { userByEmail } from '../db/queries'
import { passwordResetCodes, users } from '../db/schema'
import { normalizeEmail } from './accounts'
import { MIN_PASSWORD_LENGTH, hashPassword } from './password'

/**
 * 口令找回：管理员 CLI 生成一次性重置码，用户在登录页用它设置新口令。
 *
 * 没有邮件服务，所以「自助找回」无从谈起——但「忘记口令 = 账号作废」
 * 也不该是结局。这套流程的最小闭环是：管理员在服务器上跑
 * `npm run reset-password -- --email …` 生成码交给用户，用户在登录页
 * 输入邮箱 + 码 + 新口令。
 *
 * 刻意不做「密保问题」：那些问题的答案（母亲的姓、第一所学校）大多是
 * 可被社工猜出来或查出来的，等于给账号开了一道更弱的门。
 *
 * 规则放在这个普通模块里（而不是 Server Action 里），与 accounts.ts
 * 同一个理由：不需要请求上下文就能测。
 */

/** 重置码的有效期：24 小时，够人工转交，又不至于长期留着一把备用钥匙 */
export const RESET_CODE_TTL_MS = 24 * 60 * 60 * 1000

/** 重置码同样规范化：手工抄写不该因为大小写与空格失败 */
export function normalizeResetCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/** 一次性重置码：16 字节随机数，base64url 编码（约 22 个字符，手抄友好） */
function newResetCode(): string {
  return randomBytes(16).toString('base64url').toUpperCase()
}

export type CreateResetCodeResult = { ok: true; code: string } | { ok: false; message: string }

/**
 * 给某个账号生成一张重置码（管理员 CLI 用）。
 *
 * 顺手清掉已经过期的码：它们留着只会让表无谓增长。
 */
export async function createResetCode(
  db: Db,
  email: string,
  now: Date = new Date(),
): Promise<CreateResetCodeResult> {
  const user = await userByEmail(db, normalizeEmail(email))
  if (!user) return { ok: false, message: '没有这个邮箱对应的账号。' }

  await db
    .delete(passwordResetCodes)
    .where(lt(passwordResetCodes.expiresAt, now))
    .run()

  const code = newResetCode()
  await db
    .insert(passwordResetCodes)
    .values({
      code,
      userId: user.id,
      expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MS),
      usedAt: null,
      createdAt: now,
    })
    .run()

  return { ok: true, code }
}

export type ResetPasswordResult =
  | { ok: true; userId: string }
  | { ok: false; message: string }

/**
 * 用重置码设置新口令。改口令与标记码已用必须在同一个事务里：
 * 分开做会出现「口令改了但码没废」——一把还能再开一次门的钥匙。
 *
 * 码不对、码已用、码过期、码与邮箱不匹配，全部同一句话：
 * 不帮攻击者分辨「码是假的」还是「码被用过了」。
 */
export async function resetPassword(
  db: Db,
  email: string,
  code: string,
  newPassword: string,
  now: Date = new Date(),
): Promise<ResetPasswordResult> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `新口令至少 ${MIN_PASSWORD_LENGTH} 位。` }
  }

  const user = await userByEmail(db, normalizeEmail(email))
  const row = user
    ? await db
        .select()
        .from(passwordResetCodes)
        .where(eq(passwordResetCodes.code, normalizeResetCode(code)))
        .get()
    : null

  const valid =
    row !== null &&
    row !== undefined &&
    row.userId === user?.id &&
    row.usedAt === null &&
    row.expiresAt.getTime() >= now.getTime()

  if (!valid) return { ok: false, message: '重置码不正确或已过期。' }

  const passwordHash = await hashPassword(newPassword)

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user!.id))
      .run()
    await tx
      .update(passwordResetCodes)
      .set({ usedAt: now })
      .where(eq(passwordResetCodes.code, row!.code))
      .run()
  })

  return { ok: true, userId: user!.id }
}
