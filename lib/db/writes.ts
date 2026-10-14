import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from './index'
import { inviteCodes, users } from './schema'

/**
 * 写路径。
 *
 * 与 queries.ts（读路径）分成两个文件，但守的是同一条规矩：**应用与数据库
 * 之间只有这一层**。页面与 Server Action 不直接碰 drizzle，于是「这次写入
 * 有没有检查归属」「有没有放进一个事务」这类问题，只在这里回答一次。
 *
 * 阶段 4 的记录写入（饮食、运动、体重、目标）也落在这里。
 */

export type RegisterInput = {
  userId: string
  /** 已经规范化（小写去空格）的邮箱 */
  email: string
  /**
   * 已经算好的口令散列。
   *
   * 散列在**调用方**、也就是事务外面算——scrypt 要几十毫秒，而事务一旦
   * 打开就该尽快提交。d1 兼容层（以及真 D1）的事务回调里也不适合等一个
   * 与数据库无关的异步操作。
   */
  passwordHash: string
  /** 开始使用日期。新用户就是注册那天，日历与趋势都从这里往后开放 */
  startedAt: string
  timezone: string
  now: Date
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; reason: 'code-not-found' | 'code-used' | 'email-taken' }

/**
 * 用邀请码注册：验码、建用户、把码标记为已用，三件事在**同一个事务**里。
 *
 * 分开做会出现两种坏结果：码被用掉了但用户没建成（码白费），或者
 * 同一个码被两次注册同时通过（先读后写，中间没有隔离）。
 */
export async function registerWithInvite(
  db: Db,
  code: string,
  input: RegisterInput,
): Promise<RegisterResult> {
  return db.transaction(async (tx) => {
    const invite = await tx.select().from(inviteCodes).where(eq(inviteCodes.code, code)).get()
    if (!invite) return { ok: false, reason: 'code-not-found' as const }
    if (invite.usedByUserId !== null || invite.usedAt !== null) {
      return { ok: false, reason: 'code-used' as const }
    }

    const taken = await tx.select().from(users).where(eq(users.email, input.email)).get()
    if (taken) return { ok: false, reason: 'email-taken' as const }

    await tx
      .insert(users)
      .values({
        id: input.userId,
        email: input.email,
        passwordHash: input.passwordHash,
        // 资料三件套留空：首次引导里才填（见 lib/db/schema.ts 的说明）
        heightCm: null,
        age: null,
        sex: null,
        startedAt: input.startedAt,
        timezone: input.timezone,
        createdAt: input.now,
      })
      .run()

    await tx
      .update(inviteCodes)
      .set({ usedByUserId: input.userId, usedAt: input.now })
      .where(eq(inviteCodes.code, code))
      .run()

    return { ok: true as const }
  })
}

/**
 * 给还没有口令的账号补一个口令散列。
 *
 * 用在升级路径上：文档里公开写着演示账号的口令，而**老的**部署里这个账号是
 * 没有口令的（`password_hash` 允许为空，演示站当初也不需要登录）。条件写在
 * SQL 的 WHERE 里而不是先读后写：只补空缺，绝不覆盖已经设过的口令——
 * 运维改过演示口令的话，那次修改不该被一次重启抹掉。
 */
export async function setPasswordHashIfMissing(
  db: Db,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash })
    .where(and(eq(users.id, userId), isNull(users.passwordHash)))
    .run()
}

export type InviteCodeInput = { code: string; note?: string | null }

/**
 * 建邀请码。
 *
 * `onConflictDoNothing` 而不是先查后插：重复执行（比如每次容器启动都播种）
 * 不该覆盖已发出的码，尤其不该把**已经用掉的码**重置回未使用——
 * 那等于凭空多出一次注册机会。
 */
export async function createInviteCodes(
  db: Db,
  codes: InviteCodeInput[],
  now: Date,
): Promise<void> {
  if (codes.length === 0) return

  await db
    .insert(inviteCodes)
    .values(
      codes.map((input) => ({
        code: input.code,
        note: input.note ?? null,
        usedByUserId: null,
        usedAt: null,
        createdAt: now,
      })),
    )
    .onConflictDoNothing()
    .run()
}
